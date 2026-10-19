import { randomBytes } from "node:crypto";
import { z } from "zod";

/** 14 days — matches existing onboarding invite expiry convention. */
export const REVIEW_TOKEN_EXPIRY_DAYS = 14;

/**
 * Cryptographically strong review token.
 * Do not use the onboarding `bt_${Date.now()…}` pattern — it embeds a timestamp
 * and is weaker than needed for a token that gates a legal document.
 */
export function generateReviewToken(): string {
  return randomBytes(32).toString("base64url");
}

export function reviewTokenExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + REVIEW_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

/** Shown when a live token is used after the broker moved the agreement on. */
export const AGREEMENT_MOVED_FORWARD_MESSAGE =
  "This agreement has moved forward — contact your broker";

export const WITHDRAW_REQUIRES_APPROVAL_MESSAGE =
  "You can only withdraw after you have approved";

export const REVIEW_WITHDRAWN_TERMINAL_MESSAGE =
  "You withdrew your approval. Ask your broker to send a new link.";

export const LeaseReviewDecisionSchema = z.object({
  decision: z.enum(["approved", "changes_requested", "withdrawn"]),
  comment: z.string().trim().optional(),
});

export type LeaseReviewDecision = z.infer<typeof LeaseReviewDecisionSchema>;

export const LeasePartyApprovalStatusSchema = z.enum([
  "pending",
  "approved",
  "changes_requested",
  "withdrawn",
]);

export type LeasePartyApprovalStatus = z.infer<typeof LeasePartyApprovalStatusSchema>;
