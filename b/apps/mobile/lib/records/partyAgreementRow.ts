import type { PartyContactAgreement } from "@/lib/api/client";

export type PartyAgreementRowKind = "draft" | "address" | "omit";

/**
 * How an associated agreement should appear on an Owners/Tenants Records card.
 * Drafts never show placeholder addresses — they get a continue CTA instead.
 */
export function partyAgreementRowKind(
  agreement: PartyContactAgreement,
): PartyAgreementRowKind {
  if (agreement.status === "draft") return "draft";
  if (agreement.propertyAddress?.trim()) return "address";
  return "omit";
}
