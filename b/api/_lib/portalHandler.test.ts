import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PGlite } from "../../lib/db/node_modules/@electric-sql/pglite/dist/index.js";

const mockState = vi.hoisted(() => ({
  testUserId: "00000000-0000-4000-8000-000000000001",
  testPhone: "9876543211",
  pool: null as {
    query: (
      sql: string,
      params?: unknown[],
    ) => Promise<{ rows: unknown[]; rowCount: number }>;
  } | null,
}));

vi.mock("./vercelSyncDb.js", () => ({
  getPool: () => {
    if (!mockState.pool) {
      throw new Error("Mock pool not initialized");
    }
    return mockState.pool;
  },
  phoneVariantsForPartyMatch: (phone: string) => [
    phone,
    `91${phone}`,
    `+91${phone}`,
  ],
}));

vi.mock("./syncAuth.js", () => ({
  assertJwtUserAuth: vi.fn(async () => ({
    ok: true as const,
    user: {
      phone: mockState.testPhone,
      userId: mockState.testUserId,
    },
  })),
}));

import {
  computeRentPaymentState as computeState,
  handlePortalRequest,
} from "./portalHandler.js";

function computeRentPaymentState(
  input: Omit<
    Parameters<typeof computeState>[0],
    "effectiveDate" | "endDate" | "monthlyRentPaise"
  > & {
    effectiveDate?: string | null;
    endDate?: string | null;
  },
) {
  return computeState({
    effectiveDate: "2026-08-01",
    endDate: "2027-07-31",
    monthlyRentPaise: 3_000_000,
    ...input,
  });
}

function createMockResponse() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body = "";

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
      return res;
    },
    end(payload?: string) {
      body = payload ?? "";
    },
  };

  return {
    res: res as unknown as VercelResponse,
    get statusCode() {
      return statusCode;
    },
    get headers() {
      return headers;
    },
    get body() {
      return body;
    },
  };
}

function portalRequest(portalPath?: string): VercelRequest {
  return {
    method: "GET",
    headers: { authorization: "Bearer test-token" },
    query: portalPath === undefined ? {} : { portalPath },
  } as unknown as VercelRequest;
}

describe("computeRentPaymentState", () => {
  it.each([
    ["2026-09-10T00:00:00+05:30", "due_soon"],
    ["2026-09-15T23:59:59+05:30", "due_soon"],
    ["2026-09-16T00:00:00+05:30", "late"],
  ])("applies the mid-month deadline in India at %s", (now, state) => {
    expect(
      computeRentPaymentState({
        agreementStatus: "signed",
        rentDueDay: 5,
        periodPayment: null,
        effectiveDate: "2026-09-10",
        endDate: "2027-08-10",
        now: new Date(now),
      }),
    ).toMatchObject({ state, dueDate: "2026-09-15" });
  });
  it.each([
    ["2026-10-05T23:59:59+05:30", "due_soon"],
    ["2026-10-06T00:00:00+05:30", "late"],
  ])("applies the full-month deadline at %s", (now, state) => {
    expect(
      computeRentPaymentState({
        agreementStatus: "signed",
        rentDueDay: 10,
        periodPayment: null,
        effectiveDate: "2026-09-10",
        endDate: "2027-08-10",
        now: new Date(now),
      }),
    ).toMatchObject({ state, dueDate: "2026-10-05" });
  });
  it("ignores an old late marker during the corrected grace window", () => {
    expect(
      computeRentPaymentState({
        agreementStatus: "signed",
        rentDueDay: 1,
        effectiveDate: "2026-09-10",
        endDate: "2027-08-10",
        now: new Date("2026-09-11T00:00:00Z"),
        periodPayment: {
          id: "old",
          payment_type: "rent",
          rent_period: "2026-09",
          status: "late",
          amount_paise: 3_000_000,
          paid_at: null,
        },
      }).state,
    ).toBe("due_soon");
  });
  it("returns none when agreement is not signed", () => {
    const result = computeRentPaymentState({
      agreementStatus: "draft",
      rentDueDay: 5,
      periodPayment: null,
      now: new Date("2026-08-16T12:00:00Z"),
    });
    expect(result.state).toBe("none");
  });

  it("marks late after due date with no paid row", () => {
    const result = computeRentPaymentState({
      agreementStatus: "signed",
      rentDueDay: 1,
      periodPayment: null,
      now: new Date("2026-08-16T12:00:00Z"),
    });
    expect(result.state).toBe("late");
    expect(result.rentPeriod).toBe("2026-08");
  });

  it("uses the fifth even when a legacy agreement stored a different due day", () => {
    const result = computeRentPaymentState({
      agreementStatus: "signed",
      rentDueDay: 17,
      periodPayment: null,
      now: new Date("2026-08-04T12:00:00+05:30"),
    });
    expect(result.state).toBe("due_soon");
    expect(result.dueDate).toBe("2026-08-05");
  });

  it("returns none when the current rent period is outside the agreement dates", () => {
    const result = computeRentPaymentState({
      agreementStatus: "signed",
      rentDueDay: 5,
      periodPayment: null,
      effectiveDate: "2025-08-01",
      endDate: "2026-07-31",
      now: new Date("2026-08-16T12:00:00Z"),
    });
    expect(result.state).toBe("none");
  });

  it("marks paid when period payment is paid", () => {
    const result = computeRentPaymentState({
      agreementStatus: "signed",
      rentDueDay: 5,
      periodPayment: {
        id: "p1",
        payment_type: "rent",
        rent_period: "2026-08",
        status: "paid",
        amount_paise: 100,
        paid_at: new Date(),
      },
      now: new Date("2026-08-20T12:00:00Z"),
    });
    expect(result.state).toBe("paid");
  });

  it("shows review required instead of overdue rent for a shared renewal month", () => {
    expect(
      computeRentPaymentState({
        agreementStatus: "signed",
        rentDueDay: 5,
        periodPayment: null,
        hasRenewalConflict: true,
        now: new Date("2026-09-20T12:00:00Z"),
      }),
    ).toMatchObject({ state: "needs_review", dueDate: null });
  });

  it("preserves completed payment history even when a renewal shares its month", () => {
    expect(
      computeRentPaymentState({
        agreementStatus: "signed",
        rentDueDay: 5,
        hasRenewalConflict: true,
        now: new Date("2026-09-20T12:00:00Z"),
        periodPayment: {
          id: "paid",
          payment_type: "rent",
          rent_period: "2026-09",
          status: "paid",
          amount_paise: 100,
          paid_at: new Date(),
        },
      }).state,
    ).toBe("paid");
  });
});

describe("handlePortalRequest renewal visibility", () => {
  let db: PGlite;
  const originalId = "11111111-1111-4111-8111-111111111111";
  const draftRenewalId = "22222222-2222-4222-8222-222222222222";
  const signedRenewalId = "33333333-3333-4333-8333-333333333333";

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE auth.users (
        id uuid PRIMARY KEY,
        phone text
      );
      CREATE TABLE public.lease_agreements (
        id uuid PRIMARY KEY,
        created_by_user_id uuid NOT NULL,
        renewed_from_agreement_id uuid,
        status text NOT NULL DEFAULT 'draft',
        property_address text,
        monthly_rent_paise integer,
        security_deposit_paise integer,
        rent_due_day integer,
        brokerage_fee_paise integer,
        effective_date date,
        end_date date,
        execution_date date,
        execution_city text,
        duration_months integer,
        min_stay_months integer,
        notice_period_licensee_months integer,
        notice_period_licensor_months integer,
        maintenance_included boolean NOT NULL DEFAULT false,
        monthly_maintenance_paise integer,
        area_sqft numeric,
        facing text,
        car_parking_count integer,
        signed_at timestamptz,
        signed_pdf_pathname text,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE public.agreement_parties (
        id uuid PRIMARY KEY,
        agreement_id uuid NOT NULL REFERENCES public.lease_agreements(id) ON DELETE CASCADE,
        role text NOT NULL,
        name text NOT NULL,
        phone text NOT NULL,
        is_primary boolean NOT NULL DEFAULT false,
        sort_order integer NOT NULL DEFAULT 0,
        approval_status text NOT NULL DEFAULT 'pending'
      );
      CREATE TABLE public.rent_payments (
        id text PRIMARY KEY,
        agreement_id uuid NOT NULL,
        payment_type text NOT NULL,
        rent_period text,
        status text NOT NULL,
        amount_paise integer NOT NULL,
        paid_at timestamptz,
        razorpay_order_id text,
        owner_phone text,
        tenant_phone text,
        commission_paise integer,
        owner_settlement_paise integer,
        initiated_by text,
        payer_phone text,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX rent_period_unique ON rent_payments (agreement_id, rent_period) WHERE payment_type = 'rent';
      CREATE TABLE public.payment_recipient_config (
        phone text NOT NULL,
        role text NOT NULL,
        validation_status text NOT NULL,
        razorpay_linked_account_id text
      );
    `);

    await db.query(`INSERT INTO auth.users (id, phone) VALUES ($1, $2)`, [
      mockState.testUserId,
      "9876543210",
    ]);
    await db.query(
      `INSERT INTO public.lease_agreements (
         id, created_by_user_id, renewed_from_agreement_id, status, property_address,
         monthly_rent_paise, security_deposit_paise, rent_due_day, effective_date, end_date,
         execution_date, execution_city, duration_months, signed_at, updated_at
       ) VALUES
         ($1, $4, NULL, 'signed', 'Original Lease', 5000000, 10000000, NULL,
          '2026-08-01', '2027-07-31', '2026-07-27', 'Hyderabad', 11, now(), now() - interval '2 days'),
         ($2, $4, $1, 'draft', 'Draft Renewal', 5000000, 10000000, NULL,
          '2027-08-01', '2028-07-31', '2027-07-20', 'Hyderabad', 11, NULL, now()),
         ($3, $4, $1, 'signed', 'Signed Renewal', 5000000, 10000000, NULL,
          '2028-08-01', '2029-07-31', '2028-07-20', 'Hyderabad', 11, now(), now() - interval '1 day')`,
      [originalId, draftRenewalId, signedRenewalId, mockState.testUserId],
    );

    for (const [agreementId, partyId] of [
      [originalId, "11111111-1111-4111-8111-000000000001"],
      [draftRenewalId, "22222222-2222-4222-8222-000000000001"],
      [signedRenewalId, "33333333-3333-4333-8333-000000000001"],
    ] as const) {
      await db.query(
        `INSERT INTO public.agreement_parties (id, agreement_id, role, name, phone, is_primary, sort_order)
         VALUES ($1, $2, 'tenant', 'Tenant One', $3, true, 0)`,
        [partyId, agreementId, mockState.testPhone],
      );
    }

    const query = async (sql: string, params?: unknown[]) => {
      const result = await db.query(sql, params);
      return {
        rows: result.rows ?? [],
        rowCount: result.rows?.length ?? 0,
      };
    };
    mockState.pool = { query };
  });

  afterEach(async () => {
    vi.useRealTimers();
    mockState.pool = null;
    await db.close();
  });

  it("lists signed agreements but hides unfinished renewal drafts", async () => {
    const response = createMockResponse();
    await handlePortalRequest(portalRequest(), response.res);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      agreements: Array<{ id: string; status: string }>;
    };
    expect(body.agreements.map((agreement) => agreement.id)).toEqual([
      signedRenewalId,
      originalId,
    ]);
    expect(body.agreements).not.toContainEqual(
      expect.objectContaining({ id: draftRenewalId }),
    );
  });

  it("shows matching partial amounts in list and detail and keeps unpaid prior bills", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-08-16T00:00:00Z"));
    await db.query(
      `UPDATE lease_agreements SET effective_date = '2026-09-10', end_date = '2027-08-10',
      monthly_rent_paise = 3000000, rent_due_day = 10 WHERE id = $1`,
      [originalId],
    );
    await db.query(
      `UPDATE lease_agreements SET effective_date = '2027-08-11', end_date = '2028-07-11',
      monthly_rent_paise = 6200000, rent_due_day = 10 WHERE id = $1`,
      [signedRenewalId],
    );
    const list = createMockResponse();
    await handlePortalRequest(portalRequest(), list.res);
    const items = JSON.parse(list.body).agreements;
    const old = items.find((item: { id: string }) => item.id === originalId);
    expect(old.rentInvoices).toHaveLength(12);
    expect(old.rentInvoices[0]).toMatchObject({
      rentPeriod: "2026-09",
      amountPaise: 2_000_000,
      state: "late",
    });
    expect(old.rentInvoices[11]).toMatchObject({
      amountPaise: 967742,
      dueDate: "2027-08-05",
      state: "late",
    });
    expect(
      items.find((item: { id: string }) => item.id === signedRenewalId)
        .rentInvoices[0],
    ).toMatchObject({
      amountPaise: 4_000_000,
      dueDate: "2027-08-16",
      state: "due_soon",
    });
    const detail = createMockResponse();
    await handlePortalRequest(portalRequest(originalId), detail.res);
    expect(JSON.parse(detail.body).rentInvoices).toEqual(old.rentInvoices);
  });

  it("preserves historical paid amounts and flags an incompatible earlier checkout", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T00:00:00Z"));
    await db.query(
      `UPDATE lease_agreements SET effective_date = '2026-09-10', end_date = '2026-10-10',
      monthly_rent_paise = 3000000 WHERE id = $1`,
      [originalId],
    );
    await db.query(
      `INSERT INTO rent_payments (id, agreement_id, payment_type, rent_period, status, amount_paise, paid_at, razorpay_order_id)
      VALUES ('paid-sep', $1, 'rent', '2026-09', 'paid', 3000000, now(), 'order_paid'),
             ('pending-oct', $1, 'rent', '2026-10', 'created', 3000000, NULL, 'order_old')`,
      [originalId],
    );
    const detail = createMockResponse();
    await handlePortalRequest(portalRequest(originalId), detail.res);
    const invoices = JSON.parse(detail.body).rentInvoices;
    expect(invoices[0]).toMatchObject({
      amountPaise: 3_000_000,
      state: "paid",
    });
    expect(invoices[1]).toMatchObject({
      amountPaise: 967742,
      state: "needs_review",
    });
  });

  it("writes only prorated arrears and does not duplicate the late marker", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-16T00:00:00Z"));
    await db.query(
      `UPDATE lease_agreements SET effective_date = '2026-09-10', end_date = '2027-08-10',
      monthly_rent_paise = 3000000 WHERE id = $1`,
      [originalId],
    );
    await db.query(
      `INSERT INTO agreement_parties (id, agreement_id, role, name, phone)
      VALUES ('44444444-4444-4444-8444-444444444444', $1, 'owner', 'Test Owner', '9876543212')`,
      [originalId],
    );
    for (let i = 0; i < 2; i++) {
      const list = createMockResponse();
      await handlePortalRequest(portalRequest(), list.res);
      expect(list.statusCode).toBe(200);
    }
    expect(
      (await db.query("SELECT amount_paise, status FROM rent_payments")).rows,
    ).toEqual([{ amount_paise: 2_000_000, status: "late" }]);
  });

  it("returns 404 for direct access to an unfinished renewal draft", async () => {
    const response = createMockResponse();
    await handlePortalRequest(portalRequest(draftRenewalId), response.res);

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: "Agreement not found" });
  });

  it.each(["draft", "in_review", "esign_sent"])(
    "hides an ordinary %s agreement from both list and direct detail access",
    async (status) => {
      await db.query(`UPDATE lease_agreements SET status = $1 WHERE id = $2`, [
        status,
        originalId,
      ]);
      const list = createMockResponse();
      await handlePortalRequest(portalRequest(), list.res);
      expect(list.statusCode).toBe(200);
      expect(JSON.parse(list.body).agreements).not.toContainEqual(
        expect.objectContaining({ id: originalId }),
      );

      const detail = createMockResponse();
      await handlePortalRequest(portalRequest(originalId), detail.res);
      expect(detail.statusCode).toBe(404);
      expect(JSON.parse(detail.body)).toEqual({ error: "Agreement not found" });
    },
  );

  it.each(["in_review", "esign_sent"])("hides a %s renewal", async (status) => {
    await db.query(`UPDATE lease_agreements SET status = $1 WHERE id = $2`, [
      status,
      draftRenewalId,
    ]);
    const response = createMockResponse();
    await handlePortalRequest(portalRequest(draftRenewalId), response.res);
    expect(response.statusCode).toBe(404);
  });
});
