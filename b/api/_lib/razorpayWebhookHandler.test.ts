import { afterEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("./vercelSyncDb.js", () => ({
  getPool: () => ({
    query: queryMock,
  }),
}));

vi.mock("./razorpayRouteHelpers.js", () => ({
  attachTransferToRentPayment: vi.fn().mockResolvedValue(null),
  readActivationStatus: vi.fn(),
  readLinkedAccountId: vi.fn(),
  readProductId: vi.fn(),
  updateRecipientValidationStatus: vi.fn(),
  validationStatusForRouteWebhook: vi.fn(),
}));

import {
  applyTransferProcessed,
  promoteToSettledIfComplete,
  razorpayWebhookHandlerTestApi,
} from "./razorpayWebhookHandler.js";

const {
  handlePaymentCaptured,
  handleTransferFailed,
  handleSettlementProcessed,
  processWebhookEvent,
} = razorpayWebhookHandlerTestApi;

function baseEvent(
  eventName: string,
  payload: Record<string, unknown>,
): {
  id: string;
  entity: string;
  event: string;
  payload: Record<string, unknown>;
  created_at: number;
} {
  return {
    id: "evt_test",
    entity: "event",
    event: eventName,
    payload,
    created_at: 1_700_000_000,
  };
}

function parentTransferFailedUpdates(): unknown[][] {
  return queryMock.mock.calls.filter((call) => {
    const sql = String(call[0] ?? "");
    return sql.includes("rent_payments") && sql.includes("transfer_failed_at");
  });
}

function settledUpdates(): unknown[][] {
  return queryMock.mock.calls.filter((call) => {
    const sql = String(call[0] ?? "");
    return sql.includes("status = 'settled'");
  });
}

describe("handlePaymentCaptured", () => {
  afterEach(() => {
    queryMock.mockReset();
  });

  it("sets payment_method from the webhook payload when marking paid", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: "rp_1", status: "created" }],
      })
      .mockResolvedValueOnce({ rowCount: 1 })
      // promoteToSettledIfComplete count — transfer still pending
      .mockResolvedValueOnce({ rows: [{ total: 1, processed: 0 }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const rentPaymentId = await handlePaymentCaptured(
      baseEvent("payment.captured", {
        payment: {
          entity: {
            id: "pay_abc",
            order_id: "order_abc",
            method: "upi",
          },
        },
      }),
      "rzp_evt_payment_captured",
    );

    expect(rentPaymentId).toBe("rp_1");

    const paidUpdate = queryMock.mock.calls.find((call) => {
      const sql = String(call[0] ?? "");
      return sql.includes("status = 'paid'") && sql.includes("payment_method");
    });
    expect(paidUpdate).toBeDefined();
    expect(String(paidUpdate?.[0] ?? "")).toContain(
      "payment_method = COALESCE($3, payment_method)",
    );
    expect(paidUpdate?.[1]).toEqual(["rp_1", "pay_abc", "upi"]);
  });

  it("does not update payment_method when status is already paid", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: "rp_1", status: "paid" }],
      })
      // promoteToSettledIfComplete count — transfer still pending
      .mockResolvedValueOnce({ rows: [{ total: 1, processed: 0 }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    await handlePaymentCaptured(
      baseEvent("payment.captured", {
        payment: {
          entity: {
            id: "pay_abc",
            order_id: "order_abc",
            method: "card",
          },
        },
      }),
      "rzp_evt_payment_captured_idempotent",
    );

    const paidUpdates = queryMock.mock.calls.filter((call) =>
      String(call[0] ?? "").includes("status = 'paid'"),
    );
    expect(paidUpdates).toHaveLength(0);
  });
});

describe("promoteToSettledIfComplete", () => {
  afterEach(() => {
    queryMock.mockReset();
  });

  it("settles when all transfers of a multi-transfer payment are processed", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ total: 2, processed: 2 }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const promoted = await promoteToSettledIfComplete("rp_1");

    expect(promoted).toBe(true);
    const updates = settledUpdates();
    expect(updates).toHaveLength(1);
    const sql = String(updates[0]?.[0] ?? "");
    expect(sql).toContain("AND status = 'paid'");
    expect(sql).toContain("settled_at = NOW()");
    expect(updates[0]?.[1]).toEqual(["rp_1"]);
  });

  it("does not settle a multi-transfer payment when only one transfer is processed", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ total: 2, processed: 1 }] });

    const promoted = await promoteToSettledIfComplete("rp_1");

    expect(promoted).toBe(false);
    expect(settledUpdates()).toHaveLength(0);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("does not settle when there are no child transfers", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ total: 0, processed: 0 }] });

    const promoted = await promoteToSettledIfComplete("rp_1");

    expect(promoted).toBe(false);
    expect(settledUpdates()).toHaveLength(0);
  });

  it("is a no-op on a paid payment with a failed child transfer", async () => {
    // A failed child is not counted as processed, so total !== processed.
    queryMock.mockResolvedValueOnce({ rows: [{ total: 1, processed: 0 }] });

    const promoted = await promoteToSettledIfComplete("rp_1");

    expect(promoted).toBe(false);
    expect(settledUpdates()).toHaveLength(0);
  });

  it("is idempotent: a second call on an already-settled row is a no-op", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ total: 1, processed: 1 }] })
      .mockResolvedValueOnce({ rowCount: 1 })
      // Second call: counts unchanged, but row is 'settled' so the guarded
      // UPDATE (WHERE status = 'paid') matches nothing.
      .mockResolvedValueOnce({ rows: [{ total: 1, processed: 1 }] })
      .mockResolvedValueOnce({ rowCount: 0 });

    const first = await promoteToSettledIfComplete("rp_1");
    const second = await promoteToSettledIfComplete("rp_1");

    expect(first).toBe(true);
    expect(second).toBe(false);
    for (const call of settledUpdates()) {
      expect(String(call[0] ?? "")).toContain("AND status = 'paid'");
    }
  });
});

describe("settlement webhook ordering", () => {
  afterEach(() => {
    queryMock.mockReset();
  });

  it("settles via payment.captured when transfer.processed arrived first", async () => {
    // Phase 1 — transfer.processed while the parent is still 'created':
    // child is marked processed, but the guarded settle UPDATE matches 0 rows.
    queryMock
      .mockResolvedValueOnce({ rows: [{ rent_payment_id: "rp_1" }] })
      .mockResolvedValueOnce({
        rows: [{ id: "rpt_1", rent_payment_id: "rp_1", status: "pending" }],
      })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 1, processed: 1 }] })
      .mockResolvedValueOnce({ rowCount: 0 });

    await applyTransferProcessed("trf_1", { id: "trf_1", source: "order_abc" });

    expect(settledUpdates()).toHaveLength(1);
    queryMock.mockReset();

    // Phase 2 — payment.captured arrives: sets 'paid' and re-checks settlement.
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: "rp_1", status: "created" }] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 1, processed: 1 }] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    const rentPaymentId = await handlePaymentCaptured(
      baseEvent("payment.captured", {
        payment: {
          entity: { id: "pay_abc", order_id: "order_abc", method: "upi" },
        },
      }),
      "rzp_evt_captured_after_transfer",
    );

    expect(rentPaymentId).toBe("rp_1");
    const updates = settledUpdates();
    expect(updates).toHaveLength(1);
    expect(String(updates[0]?.[0] ?? "")).toContain("AND status = 'paid'");
    expect(updates[0]?.[1]).toEqual(["rp_1"]);
  });

  it("settles via transfer.processed when payment.captured arrived first (happy path)", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ rent_payment_id: "rp_1" }] })
      .mockResolvedValueOnce({
        rows: [{ id: "rpt_1", rent_payment_id: "rp_1", status: "pending" }],
      })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 1, processed: 1 }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const rentPaymentId = await applyTransferProcessed("trf_1", {
      id: "trf_1",
      source: "order_abc",
    });

    expect(rentPaymentId).toBe("rp_1");
    const updates = settledUpdates();
    expect(updates).toHaveLength(1);
    expect(String(updates[0]?.[0] ?? "")).toContain("AND status = 'paid'");
    expect(updates[0]?.[1]).toEqual(["rp_1"]);
  });
});

describe("handleTransferFailed", () => {
  afterEach(() => {
    queryMock.mockReset();
  });

  it("marks the child transfer failed, sets parent transfer_failed_at, leaves status untouched", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ rent_payment_id: "rp_1" }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "rpt_1", rent_payment_id: "rp_1", status: "pending" }],
      })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    const rentPaymentId = await handleTransferFailed(
      baseEvent("transfer.failed", {
        transfer: {
          entity: {
            id: "trf_fail_1",
            source: "order_abc",
            recipient: "acc_owner",
            error: { description: "Bank account invalid", code: "BAD_REQUEST_ERROR" },
          },
        },
      }),
      "rzp_evt_transfer_failed",
    );

    expect(rentPaymentId).toBe("rp_1");

    const childUpdateSql = String(queryMock.mock.calls[2]?.[0] ?? "");
    expect(childUpdateSql).toContain("rent_payment_transfers");
    expect(childUpdateSql).toContain("status = 'failed'");

    const parentUpdates = parentTransferFailedUpdates();
    expect(parentUpdates).toHaveLength(1);
    const parentSql = String(parentUpdates[0]?.[0] ?? "");
    expect(parentSql).toContain("transfer_failed_at = COALESCE(transfer_failed_at, NOW())");
    expect(parentSql).not.toMatch(/\bstatus\s*=/);
    expect(parentUpdates[0]?.[1]).toEqual(["rp_1"]);
  });

  it("skips the child UPDATE when status is already failed but still flags the parent", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ rent_payment_id: "rp_1" }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "rpt_1", rent_payment_id: "rp_1", status: "failed" }],
      })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await handleTransferFailed(
      baseEvent("transfer.failed", {
        transfer: { entity: { id: "trf_fail_2", source: "order_abc" } },
      }),
      "rzp_evt_transfer_failed_idempotent",
    );

    const childFailedUpdates = queryMock.mock.calls.filter((call) =>
      String(call[0] ?? "").includes("SET status = 'failed'"),
    );
    expect(childFailedUpdates).toHaveLength(0);

    const parentUpdates = parentTransferFailedUpdates();
    expect(parentUpdates).toHaveLength(1);
    expect(String(parentUpdates[0]?.[0] ?? "")).not.toMatch(/\bstatus\s*=/);
  });
});

describe("handleSettlementProcessed", () => {
  afterEach(() => {
    queryMock.mockReset();
  });

  it("marks the webhook processed without inventing settlement ledger writes", async () => {
    queryMock.mockResolvedValue({ rowCount: 1 });

    const rentPaymentId = await handleSettlementProcessed(
      baseEvent("settlement.processed", {
        settlement: {
          entity: {
            id: "setl_7IZKKI4Pnt2kEe",
            entity: "settlement",
            amount: 50000,
            status: "processed",
            fees: 0,
            tax: 0,
            utr: "1597813219e1pq6w",
            created_at: 1509622307,
          },
        },
      }),
      "rzp_evt_settlement",
    );

    expect(rentPaymentId).toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(1);
    const sql = String(queryMock.mock.calls[0]?.[0] ?? "");
    expect(sql).toContain("razorpay_webhook_events");
    expect(queryMock.mock.calls[0]?.[1]?.[1]).toBe("processed");
  });
});

describe("processWebhookEvent routing", () => {
  afterEach(() => {
    queryMock.mockReset();
  });

  it("routes settlement.processed instead of ignoring it", async () => {
    queryMock.mockResolvedValue({ rowCount: 1 });

    await processWebhookEvent(
      baseEvent("settlement.processed", {
        settlement: { entity: { id: "setl_test" } },
      }),
      "rzp_evt_settlement_route",
    );

    expect(queryMock.mock.calls[0]?.[1]?.[1]).toBe("processed");
  });
});
