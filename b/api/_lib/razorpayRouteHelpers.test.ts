import { afterEach, describe, expect, it, vi } from "vitest";

const { fetchMock, queryMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  queryMock: vi.fn().mockResolvedValue({ rowCount: 1 }),
}));

vi.mock("./razorpayClient.js", () => ({
  getRazorpayClient: () => ({
    products: { fetch: fetchMock },
  }),
}));

vi.mock("./vercelSyncDb.js", () => ({
  getPool: () => ({
    query: queryMock,
  }),
}));

import {
  syncRecipientValidationFromRazorpay,
  validationStatusFromActivationStatus,
} from "./razorpayRouteHelpers.js";

describe("validationStatusFromActivationStatus", () => {
  it("maps activated to activated", () => {
    expect(validationStatusFromActivationStatus("activated")).toBe("activated");
  });

  it("maps needs_clarification", () => {
    expect(validationStatusFromActivationStatus("needs_clarification")).toBe(
      "needs_clarification",
    );
  });

  it("uses fallback when activation status is missing", () => {
    expect(validationStatusFromActivationStatus(null, "submitted")).toBe("submitted");
  });
});

describe("syncRecipientValidationFromRazorpay", () => {
  afterEach(() => {
    fetchMock.mockReset();
    queryMock.mockClear();
  });

  it("updates DB when Razorpay activation differs from stored status", async () => {
    fetchMock.mockResolvedValue({ activation_status: "activated" });

    const result = await syncRecipientValidationFromRazorpay({
      linkedAccountId: "acc_test",
      productId: "acc_prd_test",
      currentValidationStatus: "needs_clarification",
    });

    expect(result).toEqual({
      validationStatus: "activated",
      activationStatus: "activated",
      synced: true,
    });
    expect(fetchMock).toHaveBeenCalledWith("acc_test", "acc_prd_test");
  });

  it("returns stored status and does not throw when Razorpay fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await syncRecipientValidationFromRazorpay({
      linkedAccountId: "acc_test",
      productId: "acc_prd_test",
      currentValidationStatus: "needs_clarification",
    });

    expect(result).toEqual({
      validationStatus: "needs_clarification",
      activationStatus: null,
      synced: false,
    });
  });

  it("keeps needs_clarification when Razorpay still reports that status", async () => {
    fetchMock.mockResolvedValue({
      activation_status: "needs_clarification",
      requirements: [],
    });

    const result = await syncRecipientValidationFromRazorpay({
      linkedAccountId: "acc_old",
      productId: "acc_prd_old",
      currentValidationStatus: "needs_clarification",
    });

    expect(result.validationStatus).toBe("needs_clarification");
    expect(result.activationStatus).toBe("needs_clarification");
    expect(result.synced).toBe(false);
  });
});
