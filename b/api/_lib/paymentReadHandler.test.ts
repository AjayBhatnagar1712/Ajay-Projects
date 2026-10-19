import { afterEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const {
  queryMock,
  assertPaymentAuthMock,
  transfersFetchMock,
  applyTransferProcessedMock,
  applyTransferFailedMock,
  promoteToSettledIfCompleteMock,
} = vi.hoisted(() => ({
  queryMock: vi.fn(),
  assertPaymentAuthMock: vi.fn(),
  transfersFetchMock: vi.fn(),
  applyTransferProcessedMock: vi.fn(),
  applyTransferFailedMock: vi.fn(),
  promoteToSettledIfCompleteMock: vi.fn(),
}));

vi.mock("./vercelSyncDb.js", () => ({
  getPool: () => ({
    query: queryMock,
  }),
  normalizePhone: (phone: string) => phone.replace(/\D/g, "").slice(-10),
}));

vi.mock("./syncAuth.js", () => ({
  assertPaymentAuth: assertPaymentAuthMock,
}));

vi.mock("./razorpayClient.js", () => ({
  getRazorpayClient: () => ({
    transfers: {
      fetch: transfersFetchMock,
    },
  }),
}));

vi.mock("./razorpayWebhookHandler.js", () => ({
  applyTransferProcessed: applyTransferProcessedMock,
  applyTransferFailed: applyTransferFailedMock,
  promoteToSettledIfComplete: promoteToSettledIfCompleteMock,
}));

import {
  handleBrokerPaymentHistoryRequest,
  handleOwnerPaymentHistoryRequest,
  handleTenantPaymentHistoryRequest,
  mapBrokerPaymentHistoryItem,
  mapOwnerPaymentHistoryItem,
  mapTenantPaymentHistoryItem,
  reconcileStaleTransfers,
} from "./paymentReadHandler.js";

function createMockResponse() {
  let statusCode = 200;
  let body = "";

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    setHeader() {
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
    get parsedBody() {
      return body ? (JSON.parse(body) as unknown) : null;
    },
  };
}

function historyRequest(
  query: Record<string, string | string[] | undefined>,
  auth?: string,
): VercelRequest {
  return {
    method: "GET",
    query,
    headers: auth ? { authorization: auth } : {},
  } as unknown as VercelRequest;
}

describe("mapTenantPaymentHistoryItem", () => {
  it("maps DB columns to tenant-facing fields without commission", () => {
    const item = mapTenantPaymentHistoryItem({
      id: "rp_1",
      rent_period: "2026-07",
      amount_paise: 500,
      status: "paid",
      payment_method: "upi",
      paid_at: new Date("2026-07-13T05:26:33.000Z"),
      created_at: new Date("2026-07-13T05:23:43.000Z"),
    });

    expect(item).toEqual({
      id: "rp_1",
      rentPeriod: "2026-07",
      amountPaise: 500,
      status: "paid",
      paymentMethod: "upi",
      paidAt: "2026-07-13T05:26:33.000Z",
      createdAt: "2026-07-13T05:23:43.000Z",
    });
    expect(item).not.toHaveProperty("commissionPaise");
    expect(item).not.toHaveProperty("ownerSettlementPaise");
  });
});

describe("handleTenantPaymentHistoryRequest", () => {
  afterEach(() => {
    queryMock.mockReset();
    assertPaymentAuthMock.mockReset();
    transfersFetchMock.mockReset();
    applyTransferProcessedMock.mockReset();
    applyTransferFailedMock.mockReset();
  });

  it("returns 401 when auth fails", async () => {
    assertPaymentAuthMock.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });
    const mock = createMockResponse();

    await handleTenantPaymentHistoryRequest(
      historyRequest({ phone: "9000000030" }, "Bearer bad"),
      mock.res,
    );

    expect(mock.statusCode).toBe(401);
    expect(mock.parsedBody).toEqual({ error: "Unauthorized" });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("returns empty payments array when tenant has none", async () => {
    assertPaymentAuthMock.mockResolvedValue({ ok: true, user: { phone: "9000000030" } });
    queryMock
      .mockResolvedValueOnce({ rows: [] }) // reconcile candidates
      .mockResolvedValueOnce({ rows: [] }); // history
    const mock = createMockResponse();

    await handleTenantPaymentHistoryRequest(
      historyRequest({ phone: "9000000030" }, "Bearer tok"),
      mock.res,
    );

    expect(mock.statusCode).toBe(200);
    expect(mock.parsedBody).toEqual({ payments: [] });
    expect(transfersFetchMock).not.toHaveBeenCalled();
    expect(String(queryMock.mock.calls[1]?.[0] ?? "")).toContain("agreements");
    expect(queryMock.mock.calls[1]?.[1]).toEqual(["9000000030"]);
  });

  it("returns mapped payments and normalizes phone for auth", async () => {
    assertPaymentAuthMock.mockResolvedValue({ ok: true, user: { phone: "9000000030" } });
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "rp_new",
            rent_period: "2026-07",
            amount_paise: 500,
            status: "paid",
            payment_method: "upi",
            paid_at: new Date("2026-07-13T05:26:33.000Z"),
            created_at: new Date("2026-07-13T05:23:43.000Z"),
          },
        ],
      });
    const mock = createMockResponse();

    await handleTenantPaymentHistoryRequest(
      historyRequest({ phone: "+91 9000000030" }, "Bearer tok"),
      mock.res,
    );

    expect(assertPaymentAuthMock).toHaveBeenCalledWith("Bearer tok", "9000000030");
    expect(mock.statusCode).toBe(200);
    expect(mock.parsedBody).toEqual({
      payments: [
        {
          id: "rp_new",
          rentPeriod: "2026-07",
          amountPaise: 500,
          status: "paid",
          paymentMethod: "upi",
          paidAt: "2026-07-13T05:26:33.000Z",
          createdAt: "2026-07-13T05:23:43.000Z",
        },
      ],
    });
  });
});

describe("mapOwnerPaymentHistoryItem", () => {
  it("maps DB columns including settlement split and transfer failure", () => {
    const item = mapOwnerPaymentHistoryItem({
      id: "rp_1",
      rent_period: "2026-07",
      amount_paise: 500,
      owner_settlement_paise: 500,
      commission_paise: 0,
      status: "paid",
      payment_method: "upi",
      paid_at: new Date("2026-07-13T05:26:33.000Z"),
      created_at: new Date("2026-07-13T05:23:43.000Z"),
      transfer_failed_at: null,
    });

    expect(item).toEqual({
      id: "rp_1",
      rentPeriod: "2026-07",
      amountPaise: 500,
      ownerSettlementPaise: 500,
      commissionPaise: 0,
      status: "paid",
      paymentMethod: "upi",
      paidAt: "2026-07-13T05:26:33.000Z",
      createdAt: "2026-07-13T05:23:43.000Z",
      transferFailedAt: null,
    });
  });
});

describe("handleOwnerPaymentHistoryRequest", () => {
  afterEach(() => {
    queryMock.mockReset();
    assertPaymentAuthMock.mockReset();
    transfersFetchMock.mockReset();
    applyTransferProcessedMock.mockReset();
    applyTransferFailedMock.mockReset();
  });

  it("returns 401 when auth fails", async () => {
    assertPaymentAuthMock.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });
    const mock = createMockResponse();

    await handleOwnerPaymentHistoryRequest(
      historyRequest({ phone: "9000000001" }, "Bearer bad"),
      mock.res,
    );

    expect(mock.statusCode).toBe(401);
    expect(mock.parsedBody).toEqual({ error: "Unauthorized" });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("returns empty payments array when owner has none", async () => {
    assertPaymentAuthMock.mockResolvedValue({ ok: true, user: { phone: "9000000001" } });
    queryMock.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const mock = createMockResponse();

    await handleOwnerPaymentHistoryRequest(
      historyRequest({ phone: "9000000001" }, "Bearer tok"),
      mock.res,
    );

    expect(mock.statusCode).toBe(200);
    expect(mock.parsedBody).toEqual({ payments: [] });
    const sql = String(queryMock.mock.calls[1]?.[0] ?? "");
    expect(sql).toContain("account_phone");
    expect(sql).toContain("account_role = 'owner'");
    expect(sql).toContain("owner_settlement_paise");
    expect(sql).toContain("transfer_failed_at");
    expect(queryMock.mock.calls[1]?.[1]).toEqual(["9000000001"]);
  });

  it("returns mapped payments with settlement fields", async () => {
    assertPaymentAuthMock.mockResolvedValue({ ok: true, user: { phone: "9000000001" } });
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "rp_own",
            rent_period: "2026-07",
            amount_paise: "500",
            owner_settlement_paise: "500",
            commission_paise: "0",
            status: "paid",
            payment_method: "upi",
            paid_at: new Date("2026-07-13T05:26:33.000Z"),
            created_at: new Date("2026-07-13T05:23:43.000Z"),
            transfer_failed_at: null,
          },
        ],
      });
    const mock = createMockResponse();

    await handleOwnerPaymentHistoryRequest(
      historyRequest({ phone: "+91 9000000001" }, "Bearer tok"),
      mock.res,
    );

    expect(assertPaymentAuthMock).toHaveBeenCalledWith("Bearer tok", "9000000001");
    expect(mock.statusCode).toBe(200);
    expect(mock.parsedBody).toEqual({
      payments: [
        {
          id: "rp_own",
          rentPeriod: "2026-07",
          amountPaise: "500",
          ownerSettlementPaise: "500",
          commissionPaise: "0",
          status: "paid",
          paymentMethod: "upi",
          paidAt: "2026-07-13T05:26:33.000Z",
          createdAt: "2026-07-13T05:23:43.000Z",
          transferFailedAt: null,
        },
      ],
    });
  });
});

describe("reconcileStaleTransfers", () => {
  afterEach(() => {
    queryMock.mockReset();
    transfersFetchMock.mockReset();
    applyTransferProcessedMock.mockReset();
    applyTransferFailedMock.mockReset();
    promoteToSettledIfCompleteMock.mockReset();
  });

  it("skips Razorpay when there are no candidates", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    await reconcileStaleTransfers("9000000030", "tenant");

    expect(transfersFetchMock).not.toHaveBeenCalled();
    expect(applyTransferProcessedMock).not.toHaveBeenCalled();
    expect(applyTransferFailedMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("applies processed/failed via shared helpers and updates last_reconciled_at", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { rent_payment_id: "rp_1", razorpay_transfer_id: "trf_ok", child_status: "pending" },
          { rent_payment_id: "rp_1", razorpay_transfer_id: "trf_bad", child_status: "pending" },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });
    transfersFetchMock
      .mockResolvedValueOnce({ id: "trf_ok", status: "processed", source: "order_1" })
      .mockResolvedValueOnce({ id: "trf_bad", status: "failed", source: "order_1" });
    applyTransferProcessedMock.mockResolvedValue("rp_1");
    applyTransferFailedMock.mockResolvedValue("rp_1");

    await reconcileStaleTransfers("9000000001", "owner");

    expect(applyTransferProcessedMock).toHaveBeenCalledWith("trf_ok", {
      id: "trf_ok",
      status: "processed",
      source: "order_1",
    });
    expect(applyTransferFailedMock).toHaveBeenCalledWith("trf_bad", {
      id: "trf_bad",
      status: "failed",
      source: "order_1",
    });

    const updateSql = String(queryMock.mock.calls[1]?.[0] ?? "");
    expect(updateSql).toContain("last_reconciled_at");
    expect(queryMock.mock.calls[1]?.[1]).toEqual([["rp_1"]]);
  });

  it("continues after a per-transfer Razorpay failure", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { rent_payment_id: "rp_1", razorpay_transfer_id: "trf_boom", child_status: "pending" },
          { rent_payment_id: "rp_2", razorpay_transfer_id: "trf_ok", child_status: "pending" },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });
    transfersFetchMock
      .mockRejectedValueOnce(new Error("razorpay down"))
      .mockResolvedValueOnce({ id: "trf_ok", status: "processed" });
    applyTransferProcessedMock.mockResolvedValue("rp_2");

    await reconcileStaleTransfers("9000000030", "tenant");

    expect(applyTransferProcessedMock).toHaveBeenCalledWith("trf_ok", {
      id: "trf_ok",
      status: "processed",
    });
    expect(applyTransferFailedMock).not.toHaveBeenCalled();
  });

  it("leaves pending transfers alone without calling apply*", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { rent_payment_id: "rp_1", razorpay_transfer_id: "trf_pending", child_status: "pending" },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });
    transfersFetchMock.mockResolvedValueOnce({ id: "trf_pending", status: "pending" });

    await reconcileStaleTransfers("9000000030", "tenant");

    expect(applyTransferProcessedMock).not.toHaveBeenCalled();
    expect(applyTransferFailedMock).not.toHaveBeenCalled();
  });

  it("promotes a stranded paid row with an already-processed child without calling Razorpay", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            rent_payment_id: "rp_stranded",
            razorpay_transfer_id: "trf_done",
            child_status: "processed",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });
    promoteToSettledIfCompleteMock.mockResolvedValue(true);

    await reconcileStaleTransfers("9000000001", "owner");

    expect(transfersFetchMock).not.toHaveBeenCalled();
    expect(applyTransferProcessedMock).not.toHaveBeenCalled();
    expect(applyTransferFailedMock).not.toHaveBeenCalled();
    expect(promoteToSettledIfCompleteMock).toHaveBeenCalledTimes(1);
    expect(promoteToSettledIfCompleteMock).toHaveBeenCalledWith("rp_stranded");

    // Candidate query must keep settled rows out and only admit fully-processed
    // stranded rows (Path B) alongside non-terminal children (Path A).
    const candidateSql = String(queryMock.mock.calls[0]?.[0] ?? "");
    expect(candidateSql).toContain("rp.status = 'paid'");
    expect(candidateSql).toContain("NOT IN ('processed', 'failed')");
    expect(candidateSql).toContain("NOT EXISTS");

    // Cooldown still updated so a promote failure can't cause thrash.
    const updateSql = String(queryMock.mock.calls[1]?.[0] ?? "");
    expect(updateSql).toContain("last_reconciled_at");
    expect(queryMock.mock.calls[1]?.[1]).toEqual([["rp_stranded"]]);
  });
});

describe("mapBrokerPaymentHistoryItem", () => {
  it("maps DB columns and trims the property label", () => {
    const item = mapBrokerPaymentHistoryItem({
      id: "rp_b1",
      agreement_id: "agr_1",
      amount_paise: 45_000_00,
      status: "paid",
      paid_at: new Date("2026-08-13T05:26:33.000Z"),
      created_at: new Date("2026-08-13T05:23:43.000Z"),
      property_label: "  12 MG Road  ",
    });

    expect(item).toEqual({
      id: "rp_b1",
      agreementId: "agr_1",
      amountPaise: 45_000_00,
      status: "paid",
      paidAt: "2026-08-13T05:26:33.000Z",
      createdAt: "2026-08-13T05:23:43.000Z",
      propertyAddress: "12 MG Road",
    });
  });

  it("returns null propertyAddress when the label is blank", () => {
    const item = mapBrokerPaymentHistoryItem({
      id: "rp_b2",
      agreement_id: null,
      amount_paise: 100,
      status: "settled",
      paid_at: null,
      created_at: new Date("2026-08-01T00:00:00.000Z"),
      property_label: "   ",
    });
    expect(item.propertyAddress).toBeNull();
    expect(item.agreementId).toBeNull();
    expect(item.paidAt).toBeNull();
  });
});

describe("handleBrokerPaymentHistoryRequest", () => {
  afterEach(() => {
    queryMock.mockReset();
    assertPaymentAuthMock.mockReset();
  });

  it("returns 401 when auth fails", async () => {
    assertPaymentAuthMock.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });
    const mock = createMockResponse();

    await handleBrokerPaymentHistoryRequest(
      historyRequest({ phone: "9000000001" }, "Bearer bad"),
      mock.res,
    );

    expect(mock.statusCode).toBe(401);
    expect(mock.parsedBody).toEqual({ error: "Unauthorized" });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("returns empty payments array when the broker has none", async () => {
    assertPaymentAuthMock.mockResolvedValue({ ok: true, user: { phone: "9000000001" } });
    queryMock.mockResolvedValueOnce({ rows: [] });
    const mock = createMockResponse();

    await handleBrokerPaymentHistoryRequest(
      historyRequest({ phone: "9000000001" }, "Bearer tok"),
      mock.res,
    );

    expect(mock.statusCode).toBe(200);
    expect(mock.parsedBody).toEqual({ payments: [] });
    const sql = String(queryMock.mock.calls[0]?.[0] ?? "");
    expect(sql).toContain("broker_phone");
    expect(sql).toContain("brokerage_tenant");
    expect(sql).toContain("brokerage_owner");
    expect(sql).toContain("lease_agreements");
    expect(queryMock.mock.calls[0]?.[1]).toEqual(["9000000001"]);
  });

  it("returns mapped paid consultancy-fee payments", async () => {
    assertPaymentAuthMock.mockResolvedValue({ ok: true, user: { phone: "9000000001" } });
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: "rp_b1",
          agreement_id: "agr_1",
          amount_paise: 2500000,
          status: "paid",
          paid_at: new Date("2026-08-13T05:26:33.000Z"),
          created_at: new Date("2026-08-13T05:23:43.000Z"),
          property_label: "88 Brigade Road",
        },
      ],
    });
    const mock = createMockResponse();

    await handleBrokerPaymentHistoryRequest(
      historyRequest({ phone: "9000000001" }, "Bearer tok"),
      mock.res,
    );

    expect(mock.statusCode).toBe(200);
    expect(mock.parsedBody).toEqual({
      payments: [
        {
          id: "rp_b1",
          agreementId: "agr_1",
          amountPaise: 2500000,
          status: "paid",
          paidAt: "2026-08-13T05:26:33.000Z",
          createdAt: "2026-08-13T05:23:43.000Z",
          propertyAddress: "88 Brigade Road",
        },
      ],
    });
  });
});
