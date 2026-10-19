import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PGlite } from "../../lib/db/node_modules/@electric-sql/pglite/dist/index.js";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  create: vi.fn(),
  fetch: vi.fn(),
  release: vi.fn(),
}));
vi.mock("./vercelSyncDb.js", () => ({
  getPool: () => ({
    query: mocks.query,
    connect: async () => ({ query: mocks.query, release: mocks.release }),
  }),
  phoneVariantsForPartyMatch: (phone: string) => [phone, `+91${phone}`],
}));
vi.mock("./syncAuth.js", () => ({
  assertPaymentAuth: async () => ({ ok: true }),
}));
vi.mock("./razorpayClient.js", () => ({
  getRazorpayClient: () => ({
    orders: { create: mocks.create, fetch: mocks.fetch },
  }),
}));
import { handleLeaseRentOrderRequest } from "./leasePaymentHandler.js";

const originalId = "11111111-1111-4111-8111-111111111111";
const renewedId = "22222222-2222-4222-8222-222222222222";

describe("calendar rent checkout against the payment ledger", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE lease_agreements (
        id uuid PRIMARY KEY, renewed_from_agreement_id uuid, status text,
        monthly_rent_paise integer, brokerage_fee_paise integer,
        created_by_user_id uuid, effective_date date, end_date date
      );
      CREATE TABLE agreement_parties (agreement_id uuid, role text, name text, phone text);
      CREATE TABLE payment_recipient_config (
        phone text, role text, razorpay_linked_account_id text, commission_rate_bps integer, validation_status text
      );
      CREATE TABLE rent_payments (
        id text PRIMARY KEY, agreement_id text, owner_phone text, tenant_phone text, rent_period text,
        payment_type text, amount_paise bigint, commission_paise bigint, owner_settlement_paise bigint,
        razorpay_order_id text, status text, initiated_by text, payer_phone text,
        razorpay_transfer_ids jsonb, paid_at timestamptz, updated_at timestamptz DEFAULT now()
      );
      CREATE UNIQUE INDEX rent_period_unique ON rent_payments (agreement_id, rent_period) WHERE payment_type = 'rent';
      CREATE TABLE rent_payment_transfers (
        id text PRIMARY KEY, rent_payment_id text REFERENCES rent_payments(id),
        recipient_phone text, recipient_name text, recipient_role text, amount_paise bigint,
        razorpay_transfer_id text, status text
      );
    `);
  });
  afterAll(async () => {
    await db.close();
  });
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-08-16T00:00:00Z"));
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_unit_only");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "unit-test-only");
    vi.clearAllMocks();
    mocks.query.mockImplementation((sql, params) => db.query(sql, params));
    mocks.create.mockImplementation(async (body) => ({
      id: `order_${mocks.create.mock.calls.length}`,
      amount: body.amount,
      status: "created",
      transfers: [
        {
          id: `trf_${mocks.create.mock.calls.length}`,
          amount: body.transfers[0].amount,
        },
      ],
    }));
    mocks.fetch.mockResolvedValue({
      id: "order_1",
      amount: 2_000_000,
      status: "created",
    });
    await db.exec(`TRUNCATE rent_payment_transfers, rent_payments, agreement_parties, lease_agreements, payment_recipient_config;
      INSERT INTO lease_agreements VALUES
        ('${originalId}', NULL, 'signed', 3000000, NULL, NULL, '2026-09-10', '2027-08-10'),
        ('${renewedId}', '${originalId}', 'signed', 6200000, NULL, NULL, '2027-08-11', '2028-07-11');
      INSERT INTO agreement_parties VALUES
        ('${originalId}', 'tenant', 'Test Tenant', '9876543211'),
        ('${originalId}', 'owner', 'Test Owner', '9876543212'),
        ('${renewedId}', 'tenant', 'Test Tenant', '9876543211'),
        ('${renewedId}', 'owner', 'Test Owner', '9876543212');
      INSERT INTO payment_recipient_config VALUES ('9876543212', 'owner', 'acc_owner', 100, 'activated');
    `);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  async function checkout(
    rentPeriod = "2026-09",
    agreementId = originalId,
    phone = "9876543211",
  ) {
    const res = {
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    await handleLeaseRentOrderRequest(
      {
        method: "POST",
        headers: {},
        body: { phone, agreementId, rentPeriod },
      } as unknown as VercelRequest,
      res as unknown as VercelResponse,
    );
    return {
      status: res.status.mock.calls.at(-1)?.[0],
      body: JSON.parse(res.end.mock.calls.at(-1)![0]),
    };
  }

  it("charges, transfers and persists September's 20/30 rent", async () => {
    const response = await checkout();
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      amountPaise: 2_000_000,
      commissionPaise: 20_000,
      ownerSettlementPaise: 1_980_000,
      invoice: {
        coverageStart: "2026-09-10",
        coverageEnd: "2026-09-30",
        dueDate: "2026-09-15",
      },
    });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2_000_000,
        transfers: [
          expect.objectContaining({
            amount: 1_980_000,
            account: "acc_owner",
            on_hold: 0,
          }),
        ],
      }),
    );
    const saved = (
      await db.query<{ amount: number; settlement: number }>(
        "SELECT amount_paise::int AS amount, owner_settlement_paise::int AS settlement FROM rent_payments",
      )
    ).rows[0];
    expect(saved).toEqual({ amount: 2_000_000, settlement: 1_980_000 });
  });
  it("charges full rent for October", async () => {
    expect((await checkout("2026-10")).body).toMatchObject({
      amountPaise: 3_000_000,
      invoice: { dueDate: "2026-10-05" },
    });
  });
  it("allows both August portions with different rates and separate records", async () => {
    expect((await checkout("2027-08")).body).toMatchObject({
      amountPaise: 967742,
      invoice: { dueDate: "2027-08-05" },
    });
    expect((await checkout("2027-08", renewedId)).body).toMatchObject({
      amountPaise: 4_000_000,
      invoice: { dueDate: "2027-08-16" },
    });
    expect((await db.query("SELECT id FROM rent_payments")).rows).toHaveLength(
      2,
    );
  });
  it("rejects an actual shared date before creating an order", async () => {
    await db.exec(
      `UPDATE lease_agreements SET effective_date = '2027-08-10' WHERE id = '${renewedId}'`,
    );
    expect((await checkout("2027-08")).body.code).toBe(
      "renewal_rent_review_required",
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["2026-08", "2027-09", "2026-13"])(
    "rejects out-of-term or invalid period %s",
    async (period) => {
      expect((await checkout(period)).status).toBe(400);
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
  it("does not issue the renewal bill before August 11", async () => {
    vi.setSystemTime(new Date("2027-08-10T12:00:00Z"));
    expect((await checkout("2027-08", renewedId)).body.code).toBe(
      "rent_not_issued",
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects a caller who is not a tenant on the agreement", async () => {
    expect((await checkout("2026-09", originalId, "9876543219")).status).toBe(
      403,
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("reuses an existing checkout instead of overwriting its order and transfers", async () => {
    const first = await checkout();
    const second = await checkout();
    expect(second.body.orderId).toBe(first.body.orderId);
    expect(second.body.rentPaymentId).toBe(first.body.rentPaymentId);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(
      (await db.query("SELECT id FROM rent_payment_transfers")).rows,
    ).toHaveLength(1);
  });
  it.each(["paid", "settled"])("never resets a %s payment", async (status) => {
    await checkout();
    await db.query("UPDATE rent_payments SET status = $1, paid_at = now()", [
      status,
    ]);
    expect((await checkout()).body.code).toBe("rent_already_paid");
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(
      (await db.query<{ status: string }>("SELECT status FROM rent_payments"))
        .rows[0].status,
    ).toBe(status);
  });
  it("blocks a received payment while its webhook is still pending", async () => {
    await checkout();
    mocks.fetch.mockResolvedValue({
      id: "order_1",
      amount: 2_000_000,
      status: "paid",
    });
    expect((await checkout()).body.code).toBe("rent_already_paid");
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("requires review of an old full-month checkout without replacing it", async () => {
    await checkout();
    await db.exec("UPDATE rent_payments SET amount_paise = 3000000");
    expect((await checkout()).body.code).toBe("rent_amount_review_required");
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("rolls back the ledger and releases the connection if Razorpay fails", async () => {
    mocks.create.mockRejectedValueOnce(new Error("test gateway unavailable"));
    expect((await checkout()).status).toBe(502);
    expect((await db.query("SELECT id FROM rent_payments")).rows).toEqual([]);
    expect(mocks.release).toHaveBeenCalled();
    expect((await checkout()).status).toBe(201);
  });
});
