import { describe, expect, it } from "vitest";
import type { PaymentOnboardStatus } from "@/lib/api/client";
import { derivePayoutSetupView, isPayoutActivated } from "./payoutStatus";

function status(
  overrides: Partial<PaymentOnboardStatus> = {},
): PaymentOnboardStatus {
  return {
    validationStatus: "pending",
    hasLinkedAccount: false,
    accountId: null,
    bankAccountLast4: null,
    ...overrides,
  };
}

describe("derivePayoutSetupView", () => {
  it("returns not_setup when status is missing or pending without an account", () => {
    expect(derivePayoutSetupView(null)).toBe("not_setup");
    expect(derivePayoutSetupView(undefined)).toBe("not_setup");
    expect(derivePayoutSetupView(status())).toBe("not_setup");
  });

  it("returns pending when submitted or a linked account exists", () => {
    expect(
      derivePayoutSetupView(status({ validationStatus: "submitted" })),
    ).toBe("pending");
    expect(
      derivePayoutSetupView(status({ validationStatus: "cooling" })),
    ).toBe("pending");
    expect(
      derivePayoutSetupView(
        status({ validationStatus: "needs_clarification" }),
      ),
    ).toBe("pending");
    expect(
      derivePayoutSetupView(
        status({ hasLinkedAccount: true, accountId: "acc_1" }),
      ),
    ).toBe("pending");
  });

  it("returns active and failed for terminal statuses", () => {
    expect(
      derivePayoutSetupView(status({ validationStatus: "activated" })),
    ).toBe("active");
    expect(
      derivePayoutSetupView(status({ validationStatus: "failed" })),
    ).toBe("failed");
  });
});

describe("isPayoutActivated", () => {
  it("is true only for activated status", () => {
    expect(isPayoutActivated(status({ validationStatus: "activated" }))).toBe(
      true,
    );
    expect(isPayoutActivated(status({ validationStatus: "submitted" }))).toBe(
      false,
    );
    expect(isPayoutActivated(null)).toBe(false);
  });
});
