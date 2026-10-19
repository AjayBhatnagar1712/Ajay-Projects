import type { QueryClient } from "@tanstack/react-query";
import type { Router } from "expo-router";
import type { CreateAgreementEntry } from "./createAgreementNav";

export type ReviewShareParty = {
  id: string;
  name: string;
  role: string;
  reviewLink: string;
};

/** Per-party resend response — `id` may be omitted on older API deploys. */
export type ReviewSharePartyResendResult = {
  name: string;
  role: string;
  reviewLink: string;
  id?: string;
};

/** Stamp the detail-screen party id so share/confirm never depend on resend response shape. */
export function reviewSharePartyFromResend(
  partyId: string,
  result: ReviewSharePartyResendResult,
): ReviewShareParty {
  return {
    ...result,
    id: partyId,
  };
}

export type ReviewSharePayload = {
  agreementId: string;
  propertyAddress: string;
  parties: ReviewShareParty[];
};

export function reviewShareQueryKey(agreementId: string) {
  return ["lease-agreement-share", agreementId] as const;
}

export function buildPartyShareMessage(
  address: string,
  party: Pick<ReviewShareParty, "name" | "reviewLink">,
): string {
  return `Hi ${party.name}, please review the leave & licence agreement for ${address}:\n${party.reviewLink}`;
}

/** Where the terms step should go after a successful save. */
export function destinationAfterTermsSave(
  status: string,
): "preview" | "detail-review-saved" {
  return status === "in_review" ? "detail-review-saved" : "preview";
}

export function stashReviewSharePayload(
  queryClient: QueryClient,
  payload: ReviewSharePayload,
): void {
  queryClient.setQueryData(reviewShareQueryKey(payload.agreementId), payload);
}

export function openReviewShareScreen(
  router: Router,
  queryClient: QueryClient,
  payload: ReviewSharePayload,
  mode: "push" | "replace" = "push",
  completionEntry?: CreateAgreementEntry,
): void {
  stashReviewSharePayload(queryClient, payload);
  const href = {
    pathname: "/agreements/[agreementId]/share" as const,
    params: {
      agreementId: payload.agreementId,
      ...(completionEntry ? { completionEntry } : {}),
    },
  };
  if (mode === "replace") router.replace(href);
  else router.push(href);
}
