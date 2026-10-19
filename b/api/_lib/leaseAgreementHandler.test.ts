import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PGlite } from "../../lib/db/node_modules/@electric-sql/pglite/dist/index.js";

const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";

const mockState = vi.hoisted(() => ({
  pool: null as {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
    connect: () => Promise<{
      query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
      release: () => void;
    }>;
  } | null,
  sendSigningNotificationEmail: vi.fn(async () => true),
}));

vi.mock("./vercelSyncDb.js", () => ({
  getPool: () => {
    if (!mockState.pool) {
      throw new Error("Mock pool not initialized");
    }
    return mockState.pool;
  },
}));

vi.mock("./syncAuth.js", () => ({
  assertJwtUserAuth: vi.fn(async () => ({
    ok: true as const,
    user: {
      phone: "9876543210",
      userId: TEST_USER_ID,
    },
  })),
}));

vi.mock("./signingEmail.js", () => ({
  sendSigningNotificationEmail: mockState.sendSigningNotificationEmail,
}));

const blobMocks = vi.hoisted(() => {
  class SignedPdfBlobError extends Error {
    readonly code: "not_configured" | "invalid_pdf" | "too_large" | "store_failed" | "not_found";

    constructor(code: "not_configured" | "invalid_pdf" | "too_large" | "store_failed" | "not_found", message: string) {
      super(message);
      this.name = "SignedPdfBlobError";
      this.code = code;
    }
  }

  return {
    SignedPdfBlobError,
    getSignedPdfBytes: vi.fn(async (pathname: string) => {
      if (pathname.includes("missing")) {
        throw new SignedPdfBlobError("not_found", "Signed PDF is not available.");
      }
      return Buffer.from("%PDF-1.4 signed");
    }),
    putSignedPdf: vi.fn(async () => ({
      pathname: "signed-lease-agreements/test/signed.pdf",
    })),
    deleteSignedPdf: vi.fn(async () => undefined),
    assertPdfBytes: vi.fn(),
    SIGNED_PDF_MAX_BYTES: 10 * 1024 * 1024,
  };
});

vi.mock("./signedPdfBlob.js", () => blobMocks);

import { handleLeaseAgreementRequest } from "./leaseAgreementHandler.js";

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

function statusRequest(id: string, status: "in_review" | "esign_sent" | "signed"): VercelRequest {
  return {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
    },
    query: {
      leasePath: `${id}/status`,
    },
    body: {
      status,
    },
  } as unknown as VercelRequest;
}

describe("handleLeaseAgreementRequest status persistence", () => {
  let db: PGlite;
  const agreementId = "11111111-1111-4111-8111-111111111111";

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE public.lease_agreements (
        id uuid PRIMARY KEY,
        created_by_user_id uuid NOT NULL,
        renewed_from_agreement_id uuid,
        status text NOT NULL DEFAULT 'draft',
        execution_date date,
        effective_date date,
        end_date date,
        execution_city text,
        duration_months integer,
        min_stay_months integer,
        notice_period_licensee_months integer,
        notice_period_licensor_months integer,
        monthly_rent_paise integer,
        security_deposit_paise integer,
        rent_due_day integer,
        brokerage_fee_paise integer,
        maintenance_included boolean NOT NULL DEFAULT false,
        monthly_maintenance_paise integer,
        property_address text,
        area_sqft numeric,
        facing text,
        car_parking_count integer,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        signed_pdf_pathname text,
        signed_at timestamptz,
        signed_uploaded_by_phone text,
        signing_notified_at timestamptz
      );
      CREATE TABLE public.agreement_parties (
        id uuid PRIMARY KEY,
        agreement_id uuid NOT NULL REFERENCES public.lease_agreements(id) ON DELETE CASCADE,
        role text NOT NULL,
        name text NOT NULL,
        phone text NOT NULL,
        title text,
        age integer,
        address text,
        aadhaar text,
        pan text,
        email text,
        is_primary boolean NOT NULL DEFAULT false,
        sort_order integer NOT NULL DEFAULT 0,
        review_token text,
        review_token_expires_at timestamptz,
        approval_status text NOT NULL DEFAULT 'pending',
        review_comment text,
        reviewed_at timestamptz,
        review_shared_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE public.agreement_inventory_items (
        id uuid PRIMARY KEY,
        agreement_id uuid NOT NULL REFERENCES public.lease_agreements(id) ON DELETE CASCADE,
        description text NOT NULL,
        quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await db.query(
      `INSERT INTO public.lease_agreements (
        id, created_by_user_id, status, execution_date, effective_date, end_date,
        execution_city, duration_months, min_stay_months,
        notice_period_licensee_months, notice_period_licensor_months,
        monthly_rent_paise, security_deposit_paise, rent_due_day,
        property_address, area_sqft, facing, car_parking_count
      ) VALUES (
        $1, $2, 'draft', '2026-07-27', '2026-08-01', '2027-07-31',
        'Hyderabad', 12, 6, 2, 2, 6000000, 12000000, 5,
        '1 Main Road', 1200, 'East', 1
      )`,
      [agreementId, TEST_USER_ID],
    );

    const parties = [
      [
        "22222222-2222-4222-8222-222222222222",
        "owner",
        "Owner One",
        "9876543210",
        "Mr.",
        42,
        "1 Main Road",
        "967132807649",
        "ABCDE1234F",
        "owner@example.com",
        true,
        0,
      ],
      [
        "33333333-3333-4333-8333-333333333333",
        "tenant",
        "Tenant One",
        "9876543211",
        "Ms.",
        31,
        "1 Main Road",
        "234123412346",
        null,
        "tenant@example.com",
        true,
        1,
      ],
    ];

    for (const party of parties) {
      await db.query(
        `INSERT INTO public.agreement_parties (
          id, agreement_id, role, name, phone, title, age, address,
          aadhaar, pan, email, is_primary, sort_order
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13
        )`,
        [party[0], agreementId, ...party.slice(1)],
      );
    }

    const query = async (sql: string, params?: unknown[]) => {
      const result = await db.query(sql, params);
      return {
        rows: result.rows ?? [],
        rowCount: result.rows?.length ?? 0,
      };
    };

    mockState.pool = {
      query,
      connect: async () => ({
        query,
        release() {},
      }),
    };
  });

  afterEach(async () => {
    mockState.pool = null;
    await db.close();
  });

  it("persists a draft -> in_review transition and exposes it through direct SQL", async () => {
    const response = createMockResponse();

    await handleLeaseAgreementRequest(statusRequest(agreementId, "in_review"), response.res);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      id: agreementId,
      status: "in_review",
    });

    const persisted = await db.query<{ status: string }>(`SELECT status FROM public.lease_agreements WHERE id = $1`, [
      agreementId,
    ]);
    expect(persisted.rows[0]?.status).toBe("in_review");
  });
});

function deleteRequest(id: string): VercelRequest {
  return {
    method: "DELETE",
    headers: {
      authorization: "Bearer test-token",
    },
    query: {
      leasePath: id,
    },
  } as unknown as VercelRequest;
}

describe("handleLeaseAgreementRequest DELETE draft cancel", () => {
  let db: PGlite;
  const agreementId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const otherBrokerAgreementId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const otherUserId = "00000000-0000-4000-8000-000000000099";

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE public.lease_agreements (
        id uuid PRIMARY KEY,
        created_by_user_id uuid NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        property_address text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        signed_pdf_pathname text,
        signed_at timestamptz,
        signed_uploaded_by_phone text,
        signing_notified_at timestamptz
      );
      CREATE TABLE public.agreement_parties (
        id uuid PRIMARY KEY,
        agreement_id uuid NOT NULL REFERENCES public.lease_agreements(id) ON DELETE CASCADE,
        role text NOT NULL,
        name text NOT NULL,
        phone text NOT NULL,
        is_primary boolean NOT NULL DEFAULT false,
        sort_order integer NOT NULL DEFAULT 0,
        approval_status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE public.agreement_inventory_items (
        id uuid PRIMARY KEY,
        agreement_id uuid NOT NULL REFERENCES public.lease_agreements(id) ON DELETE CASCADE,
        description text NOT NULL,
        quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await db.query(
      `INSERT INTO public.lease_agreements (id, created_by_user_id, status, property_address)
       VALUES ($1, $2, 'draft', '1 Cancel Lane')`,
      [agreementId, TEST_USER_ID],
    );
    await db.query(
      `INSERT INTO public.agreement_parties (
        id, agreement_id, role, name, phone, is_primary, sort_order
      ) VALUES (
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc', $1, 'owner', 'Owner', '9876543210', true, 0
      )`,
      [agreementId],
    );
    await db.query(
      `INSERT INTO public.agreement_inventory_items (
        id, agreement_id, description, sort_order
      ) VALUES (
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd', $1, 'Sofa', 0
      )`,
      [agreementId],
    );

    await db.query(
      `INSERT INTO public.lease_agreements (id, created_by_user_id, status, property_address)
       VALUES ($1, $2, 'draft', 'Other Broker St')`,
      [otherBrokerAgreementId, otherUserId],
    );

    const query = async (sql: string, params?: unknown[]) => {
      const result = await db.query(sql, params);
      return {
        rows: result.rows ?? [],
        rowCount: result.rows?.length ?? 0,
      };
    };

    mockState.pool = {
      query,
      connect: async () => ({
        query,
        release() {},
      }),
    };
  });

  afterEach(async () => {
    mockState.pool = null;
    await db.close();
  });

  it("deletes a draft agreement and cascades parties + inventory", async () => {
    const response = createMockResponse();

    await handleLeaseAgreementRequest(deleteRequest(agreementId), response.res);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });

    const agreements = await db.query(`SELECT id FROM public.lease_agreements WHERE id = $1`, [agreementId]);
    expect(agreements.rows).toHaveLength(0);

    const parties = await db.query(`SELECT id FROM public.agreement_parties WHERE agreement_id = $1`, [agreementId]);
    expect(parties.rows).toHaveLength(0);

    const inventory = await db.query(`SELECT id FROM public.agreement_inventory_items WHERE agreement_id = $1`, [
      agreementId,
    ]);
    expect(inventory.rows).toHaveLength(0);
  });

  it("returns 404 when deleting another broker's draft", async () => {
    const response = createMockResponse();

    await handleLeaseAgreementRequest(deleteRequest(otherBrokerAgreementId), response.res);

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toMatchObject({
      error: "Lease agreement not found",
    });

    const stillThere = await db.query(`SELECT id FROM public.lease_agreements WHERE id = $1`, [otherBrokerAgreementId]);
    expect(stillThere.rows).toHaveLength(1);
  });

  it("rejects deleting a non-draft agreement", async () => {
    await db.query(`UPDATE public.lease_agreements SET status = 'in_review' WHERE id = $1`, [agreementId]);

    const response = createMockResponse();
    await handleLeaseAgreementRequest(deleteRequest(agreementId), response.res);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({
      error: "Only draft agreements can be cancelled",
    });

    const stillThere = await db.query(`SELECT id, status FROM public.lease_agreements WHERE id = $1`, [agreementId]);
    expect(stillThere.rows).toHaveLength(1);
    expect(stillThere.rows[0]).toMatchObject({ status: "in_review" });
  });
});

const LEASE_SCHEMA = `
  CREATE TABLE public.lease_agreements (
    id uuid PRIMARY KEY,
    created_by_user_id uuid NOT NULL,
    renewed_from_agreement_id uuid,
    status text NOT NULL DEFAULT 'draft',
    execution_date date,
    effective_date date,
    end_date date,
    execution_city text,
    duration_months integer,
    min_stay_months integer,
    notice_period_licensee_months integer,
    notice_period_licensor_months integer,
    monthly_rent_paise integer,
    security_deposit_paise integer,
    rent_due_day integer,
    brokerage_fee_paise integer,
    maintenance_included boolean NOT NULL DEFAULT false,
    monthly_maintenance_paise integer,
    property_address text,
    area_sqft numeric,
    facing text,
    car_parking_count integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    signed_pdf_pathname text,
    signed_at timestamptz,
    signed_uploaded_by_phone text,
    signing_notified_at timestamptz
  );
  CREATE TABLE public.agreement_parties (
    id uuid PRIMARY KEY,
    agreement_id uuid NOT NULL REFERENCES public.lease_agreements(id) ON DELETE CASCADE,
    role text NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    title text,
    age integer,
    address text,
    aadhaar text,
    pan text,
    email text,
    is_primary boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    review_token text,
    review_token_expires_at timestamptz,
    approval_status text NOT NULL DEFAULT 'pending',
    review_comment text,
    reviewed_at timestamptz,
    review_shared_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.agreement_inventory_items (
    id uuid PRIMARY KEY,
    agreement_id uuid NOT NULL REFERENCES public.lease_agreements(id) ON DELETE CASCADE,
    description text NOT NULL,
    quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX lease_agreements_one_active_renewal_idx
    ON public.lease_agreements (renewed_from_agreement_id)
    WHERE renewed_from_agreement_id IS NOT NULL
      AND status IN ('draft', 'in_review', 'esign_sent');
`;

function jsonRequest(method: "GET" | "POST" | "PUT" | "PATCH", leasePath: string, body?: unknown): VercelRequest {
  return {
    method,
    headers: { authorization: "Bearer test-token" },
    query: { leasePath },
    body,
  } as unknown as VercelRequest;
}

describe("handleLeaseAgreementRequest renewal", () => {
  let db: PGlite;
  const agreementId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const otherUserId = "00000000-0000-4000-8000-000000000099";
  const otherAgreementId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  async function attachPool(): Promise<void> {
    const query = async (sql: string, params?: unknown[]) => {
      const result = await db.query(sql, params);
      return {
        rows: result.rows ?? [],
        rowCount: result.rows?.length ?? 0,
      };
    };
    mockState.pool = {
      query,
      connect: async () => ({
        query,
        release() {},
      }),
    };
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-07-20T10:00:00.000Z"));
    db = new PGlite();
    await db.exec(LEASE_SCHEMA);
    await db.query(
      `INSERT INTO public.lease_agreements (
        id, created_by_user_id, status, execution_date, effective_date, end_date,
        execution_city, duration_months, min_stay_months,
        notice_period_licensee_months, notice_period_licensor_months,
        monthly_rent_paise, security_deposit_paise, rent_due_day,
        brokerage_fee_paise, maintenance_included, monthly_maintenance_paise,
        property_address, area_sqft, facing, car_parking_count,
        signed_pdf_pathname, signed_at
      ) VALUES (
        $1, $2, 'signed', '2026-07-27', '2026-08-01', '2027-07-31',
        'Hyderabad', 12, 6, 2, 3, 6000000, 12000000, 5,
        6000000, false, 300000,
        '1 Main Road', 1200, 'East', 1,
        'signed-lease-agreements/original/signed.pdf', now()
      )`,
      [agreementId, TEST_USER_ID],
    );
    await db.query(
      `INSERT INTO public.agreement_parties (
        id, agreement_id, role, name, phone, title, age, address, aadhaar, pan, email,
        is_primary, sort_order, approval_status, review_token, review_token_expires_at,
        review_comment, reviewed_at, review_shared_at
      ) VALUES
        (
          '11111111-1111-4111-8111-111111111111', $1, 'owner', 'Owner', '9876543210',
          'Mr.', 42, '1 Main Road', '967132807649', 'ABCDE1234F', 'owner@example.com',
          true, 0, 'approved', 'old-owner-token', now() + interval '1 day',
          'Approved', now(), now()
        ),
        (
          '22222222-2222-4222-8222-222222222222', $1, 'tenant', 'Tenant', '9876543211',
          'Ms.', 31, '1 Main Road', '234123412346', NULL, 'tenant@example.com',
          true, 1, 'approved', 'old-tenant-token', now() + interval '1 day',
          'Approved', now(), now()
        )`,
      [agreementId],
    );
    await db.query(
      `INSERT INTO public.agreement_inventory_items (
        id, agreement_id, description, quantity, sort_order
      ) VALUES (
        '33333333-3333-4333-8333-333333333333', $1, 'Sofa', 2, 0
      )`,
      [agreementId],
    );
    await db.query(
      `INSERT INTO public.lease_agreements (
        id, created_by_user_id, status, effective_date, end_date, signed_at
      ) VALUES ($1, $2, 'signed', '2026-01-01', '2026-12-31', now())`,
      [otherAgreementId, otherUserId],
    );
    await attachPool();
  });

  afterEach(async () => {
    vi.useRealTimers();
    mockState.pool = null;
    await db.close();
  });

  it("clones a signed agreement into a linked draft with recalculated dates", async () => {
    const response = createMockResponse();

    await handleLeaseAgreementRequest(jsonRequest("POST", `${agreementId}/renew`, {}), response.res);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body) as {
      id: string;
      status: string;
      renewedFromAgreementId: string | null;
      executionDate: string | null;
      effectiveDate: string | null;
      endDate: string | null;
      durationMonths: number | null;
      parties: unknown[];
      inventory: unknown[];
    };
    expect(body).toMatchObject({
      status: "draft",
      renewedFromAgreementId: agreementId,
      executionDate: "2027-07-20",
      effectiveDate: "2027-08-01",
      endDate: "2028-07-31",
      durationMonths: 11,
    });
    expect(body.id).not.toBe(agreementId);
    expect(body.parties).toHaveLength(2);
    expect(body.inventory).toHaveLength(1);

    const agreements = await db.query<{
      id: string;
      renewed_from_agreement_id: string | null;
      status: string;
      execution_date: string | null;
      effective_date: string | null;
      end_date: string | null;
      duration_months: number | null;
      brokerage_fee_paise: number | null;
      signed_pdf_pathname: string | null;
      signed_at: Date | null;
    }>(
      `SELECT id,
              renewed_from_agreement_id,
              status,
              to_char(execution_date, 'YYYY-MM-DD') AS execution_date,
              to_char(effective_date, 'YYYY-MM-DD') AS effective_date,
              to_char(end_date, 'YYYY-MM-DD') AS end_date,
              duration_months,
              brokerage_fee_paise,
              signed_pdf_pathname,
              signed_at
       FROM public.lease_agreements
       WHERE renewed_from_agreement_id = $1`,
      [agreementId],
    );
    expect(agreements.rows).toHaveLength(1);
    expect(agreements.rows[0]).toMatchObject({
      id: body.id,
      renewed_from_agreement_id: agreementId,
      status: "draft",
      execution_date: "2027-07-20",
      effective_date: "2027-08-01",
      end_date: "2028-07-31",
      duration_months: 11,
      brokerage_fee_paise: 6000000,
      signed_pdf_pathname: null,
      signed_at: null,
    });

    const parties = await db.query<{
      role: string;
      approval_status: string;
      review_token: string | null;
      review_shared_at: Date | null;
    }>(
      `SELECT role, approval_status, review_token, review_shared_at
       FROM public.agreement_parties
       WHERE agreement_id = $1
       ORDER BY sort_order`,
      [body.id],
    );
    expect(parties.rows).toEqual([
      {
        role: "owner",
        approval_status: "pending",
        review_token: null,
        review_shared_at: null,
      },
      {
        role: "tenant",
        approval_status: "pending",
        review_token: null,
        review_shared_at: null,
      },
    ]);

    const inventory = await db.query<{ description: string; quantity: number }>(
      `SELECT description, quantity
       FROM public.agreement_inventory_items
       WHERE agreement_id = $1`,
      [body.id],
    );
    expect(inventory.rows).toEqual([{ description: "Sofa", quantity: 2 }]);
  });

  it("rejects renewal for non-signed agreements", async () => {
    await db.query(`UPDATE public.lease_agreements SET status = 'esign_sent' WHERE id = $1`, [agreementId]);
    const response = createMockResponse();

    await handleLeaseAgreementRequest(jsonRequest("POST", `${agreementId}/renew`, {}), response.res);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({
      error: "Only signed agreements can be renewed",
    });
    const clones = await db.query(`SELECT id FROM public.lease_agreements WHERE renewed_from_agreement_id = $1`, [
      agreementId,
    ]);
    expect(clones.rows).toHaveLength(0);
  });

  it("returns 409 instead of creating a duplicate active renewal", async () => {
    const first = createMockResponse();
    await handleLeaseAgreementRequest(jsonRequest("POST", `${agreementId}/renew`, {}), first.res);
    expect(first.statusCode).toBe(201);
    const firstBody = JSON.parse(first.body) as { id: string };

    const second = createMockResponse();
    await handleLeaseAgreementRequest(jsonRequest("POST", `${agreementId}/renew`, {}), second.res);

    expect(second.statusCode).toBe(409);
    expect(JSON.parse(second.body)).toMatchObject({
      error: "Active renewal already exists for this agreement",
      renewalAgreementId: firstBody.id,
      status: "draft",
    });
    const clones = await db.query(`SELECT id FROM public.lease_agreements WHERE renewed_from_agreement_id = $1`, [
      agreementId,
    ]);
    expect(clones.rows).toHaveLength(1);
  });

  it("returns 404 when renewing another broker's agreement", async () => {
    const response = createMockResponse();

    await handleLeaseAgreementRequest(jsonRequest("POST", `${otherAgreementId}/renew`, {}), response.res);

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toMatchObject({
      error: "Lease agreement not found",
    });
  });
});

describe("handleLeaseAgreementRequest send-for-signing and freeze", () => {
  let db: PGlite;
  const agreementId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const otherUserId = "00000000-0000-4000-8000-000000000099";
  const otherAgreementId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  async function attachPool(): Promise<void> {
    const query = async (sql: string, params?: unknown[]) => {
      const result = await db.query(sql, params);
      return {
        rows: result.rows ?? [],
        rowCount: result.rows?.length ?? 0,
      };
    };
    mockState.pool = {
      query,
      connect: async () => ({
        query,
        release() {},
      }),
    };
  }

  beforeEach(async () => {
    mockState.sendSigningNotificationEmail.mockReset();
    mockState.sendSigningNotificationEmail.mockResolvedValue(true);
    db = new PGlite();
    await db.exec(LEASE_SCHEMA);
    await db.query(
      `INSERT INTO public.lease_agreements (
        id, created_by_user_id, status, execution_date, effective_date, end_date,
        execution_city, duration_months, min_stay_months,
        notice_period_licensee_months, notice_period_licensor_months,
        monthly_rent_paise, security_deposit_paise, rent_due_day,
        property_address, area_sqft, facing, car_parking_count
      ) VALUES (
        $1, $2, 'in_review', '2026-07-27', '2026-08-01', '2027-07-31',
        'Hyderabad', 12, 6, 2, 2, 6000000, 12000000, 5,
        '1 Main Road', 1200, 'East', 1
      )`,
      [agreementId, TEST_USER_ID],
    );
    await db.query(
      `INSERT INTO public.agreement_parties (
        id, agreement_id, role, name, phone, title, age, address, aadhaar, email,
        is_primary, sort_order, approval_status
      ) VALUES
        ('11111111-1111-4111-8111-111111111111', $1, 'owner', 'Owner', '9876543210',
         'Mr.', 42, '1 Main Road', '967132807649', 'owner@example.com', true, 0, 'approved'),
        ('22222222-2222-4222-8222-222222222222', $1, 'tenant', 'Tenant', '9876543211',
         'Ms.', 31, '1 Main Road', '234123412346', 'tenant@example.com', true, 1, 'approved')`,
      [agreementId],
    );
    await db.query(
      `INSERT INTO public.agreement_inventory_items (id, agreement_id, description, sort_order)
       VALUES ('33333333-3333-4333-8333-333333333333', $1, 'Sofa', 0)`,
      [agreementId],
    );
    await attachPool();
  });

  afterEach(async () => {
    mockState.pool = null;
    await db.close();
  });

  it("blocks send-for-signing when a party is still pending", async () => {
    await db.query(`UPDATE public.agreement_parties SET approval_status = 'pending' WHERE role = 'tenant'`);
    const response = createMockResponse();
    await handleLeaseAgreementRequest(statusRequest(agreementId, "esign_sent"), response.res);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({
      error: "Cannot send for signing until every party has approved.",
    });
    const persisted = await db.query<{ status: string }>(`SELECT status FROM public.lease_agreements WHERE id = $1`, [
      agreementId,
    ]);
    expect(persisted.rows[0]?.status).toBe("in_review");
  });

  it("sends for signing when every party is approved and does not roll back if email fails", async () => {
    mockState.sendSigningNotificationEmail.mockResolvedValue(false);
    const response = createMockResponse();
    await handleLeaseAgreementRequest(statusRequest(agreementId, "esign_sent"), response.res);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ status: "esign_sent" });
    expect(mockState.sendSigningNotificationEmail).toHaveBeenCalledTimes(1);

    const persisted = await db.query<{
      status: string;
      signing_notified_at: Date | null;
    }>(`SELECT status, signing_notified_at FROM public.lease_agreements WHERE id = $1`, [agreementId]);
    expect(persisted.rows[0]?.status).toBe("esign_sent");
    expect(persisted.rows[0]?.signing_notified_at).toBeNull();
  });

  it("records signing_notified_at when the email succeeds", async () => {
    const response = createMockResponse();
    await handleLeaseAgreementRequest(statusRequest(agreementId, "esign_sent"), response.res);
    expect(response.statusCode).toBe(200);
    const persisted = await db.query<{ signing_notified_at: Date | null }>(
      `SELECT signing_notified_at FROM public.lease_agreements WHERE id = $1`,
      [agreementId],
    );
    expect(persisted.rows[0]?.signing_notified_at).toBeTruthy();
  });

  it("responds promptly when email succeeds on a single-connection pool (regression: max:1 deadlock)", async () => {
    let connectionCheckedOut = false;
    const query = async (sql: string, params?: unknown[]) => {
      const result = await db.query(sql, params);
      return {
        rows: result.rows ?? [],
        rowCount: result.rows?.length ?? 0,
      };
    };
    mockState.pool = {
      query: async (sql: string, params?: unknown[]) => {
        if (connectionCheckedOut) {
          throw new Error("pool.query called while the only connection is checked out");
        }
        return query(sql, params);
      },
      connect: async () => {
        connectionCheckedOut = true;
        return {
          query,
          release() {
            connectionCheckedOut = false;
          },
        };
      },
    };

    mockState.sendSigningNotificationEmail.mockImplementation(async () => {
      expect(connectionCheckedOut).toBe(true);
      return true;
    });

    const response = createMockResponse();
    const startedAt = Date.now();
    await handleLeaseAgreementRequest(statusRequest(agreementId, "esign_sent"), response.res);
    expect(Date.now() - startedAt).toBeLessThan(2_000);
    expect(response.statusCode).toBe(200);
    const persisted = await db.query<{ signing_notified_at: Date | null }>(
      `SELECT signing_notified_at FROM public.lease_agreements WHERE id = $1`,
      [agreementId],
    );
    expect(persisted.rows[0]?.signing_notified_at).toBeTruthy();
  });

  it("rejects broker self-serve mark-as-signed", async () => {
    await db.query(`UPDATE public.lease_agreements SET status = 'esign_sent' WHERE id = $1`, [agreementId]);
    const response = createMockResponse();
    await handleLeaseAgreementRequest(statusRequest(agreementId, "signed"), response.res);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain("Only TrustKeyper can mark");
    const persisted = await db.query<{ status: string }>(`SELECT status FROM public.lease_agreements WHERE id = $1`, [
      agreementId,
    ]);
    expect(persisted.rows[0]?.status).toBe("esign_sent");
  });

  it("blocks party and inventory edits after esign_sent", async () => {
    await db.query(`UPDATE public.lease_agreements SET status = 'esign_sent' WHERE id = $1`, [agreementId]);

    const parties = createMockResponse();
    await handleLeaseAgreementRequest(
      jsonRequest("PUT", `${agreementId}/parties`, {
        parties: [
          {
            role: "owner",
            name: "Owner",
            phone: "9876543210",
            title: "Mr.",
            age: 42,
            address: "1 Main Road",
            aadhaar: "967132807649",
            pan: "ABCDE1234F",
            email: "owner@example.com",
            isPrimary: true,
            sortOrder: 0,
          },
          {
            role: "tenant",
            name: "Tenant",
            phone: "9876543211",
            title: "Ms.",
            age: 31,
            address: "1 Main Road",
            aadhaar: "234123412346",
            email: "tenant@example.com",
            isPrimary: true,
            sortOrder: 1,
          },
        ],
      }),
      parties.res,
    );
    expect(parties.statusCode).toBe(400);
    expect(JSON.parse(parties.body).error).toContain("sent for signing");

    const inventory = createMockResponse();
    await handleLeaseAgreementRequest(
      jsonRequest("PUT", `${agreementId}/inventory`, {
        items: [{ description: "Fridge", quantity: 1, sortOrder: 0 }],
      }),
      inventory.res,
    );
    expect(inventory.statusCode).toBe(400);

    const patch = createMockResponse();
    await handleLeaseAgreementRequest(jsonRequest("PATCH", agreementId, { monthlyRentPaise: 7000000 }), patch.res);
    expect(patch.statusCode).toBe(400);
  });

  it("requires ownership for signed PDF download", async () => {
    await db.query(
      `INSERT INTO public.lease_agreements (id, created_by_user_id, status, signed_pdf_pathname, signed_at)
       VALUES ($1, $2, 'signed', 'signed-lease-agreements/other/signed.pdf', now())`,
      [otherAgreementId, otherUserId],
    );

    const missing = createMockResponse();
    await handleLeaseAgreementRequest(jsonRequest("GET", `${otherAgreementId}/signed-pdf`), missing.res);
    expect(missing.statusCode).toBe(404);

    await db.query(
      `UPDATE public.lease_agreements
       SET status = 'signed', signed_pdf_pathname = 'signed-lease-agreements/mine/signed.pdf', signed_at = now()
       WHERE id = $1`,
      [agreementId],
    );
    const owned = createMockResponse();
    await handleLeaseAgreementRequest(jsonRequest("GET", `${agreementId}/signed-pdf`), owned.res);
    expect(owned.statusCode).toBe(200);
    expect(owned.headers["Content-Type"]).toBe("application/pdf");
  });
});
