import type { PaymentOnboardStatus } from "@/lib/api/client";

export type PayoutSetupView = "not_setup" | "pending" | "active" | "failed";

/**
 * Status-aware payout UI. Matches owner payment-setup view mapping:
 * activated → active; failed → failed; submitted/cooling/clarification or a
 * linked account → pending; otherwise not set up.
 */
export function derivePayoutSetupView(
  status: PaymentOnboardStatus | null | undefined,
): PayoutSetupView {
  if (status == null) return "not_setup";
  if (status.validationStatus === "activated") return "active";
  if (status.validationStatus === "failed") return "failed";
  if (
    status.hasLinkedAccount ||
    status.validationStatus === "submitted" ||
    status.validationStatus === "cooling" ||
    status.validationStatus === "needs_clarification"
  ) {
    return "pending";
  }
  return "not_setup";
}

export function isPayoutActivated(
  status: PaymentOnboardStatus | null | undefined,
): boolean {
  return derivePayoutSetupView(status) === "active";
}
