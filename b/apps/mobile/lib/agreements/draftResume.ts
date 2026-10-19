import type { LeaseAgreement } from "@/lib/api/client";

/** Label for Home / Continue cards — address when set, else untitled. */
export function draftAgreementLabel(
  propertyAddress: string | null | undefined,
): string {
  const trimmed = propertyAddress?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Untitled draft";
}

/**
 * Home unfinished-draft card heading — property address when the Property
 * step has been completed; otherwise the generic unfinished copy.
 */
export function unfinishedDraftHeading(
  propertyAddress: string | null | undefined,
): string {
  const trimmed = propertyAddress?.trim();
  return trimmed && trimmed.length > 0
    ? trimmed
    : "You have an unfinished agreement";
}

/**
 * Most recently updated draft for Home resume CTA.
 * Force-quit mid-flow does not delete drafts — they stay on the server;
 * Home previously never surfaced them.
 */
export function selectMostRecentDraft(
  agreements: readonly LeaseAgreement[],
): LeaseAgreement | null {
  let best: LeaseAgreement | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;

  for (const agreement of agreements) {
    if (agreement.status !== "draft") continue;
    const ms = Date.parse(agreement.updatedAt);
    const sortMs = Number.isNaN(ms) ? Date.parse(agreement.createdAt) : ms;
    const effective = Number.isNaN(sortMs) ? 0 : sortMs;
    if (effective >= bestMs) {
      bestMs = effective;
      best = agreement;
    }
  }

  return best;
}

/** Count of draft agreements — Home uses this for the "See all" affordance. */
export function countDraftAgreements(
  agreements: readonly LeaseAgreement[],
): number {
  let count = 0;
  for (const agreement of agreements) {
    if (agreement.status === "draft") count += 1;
  }
  return count;
}
