import type { LeaseAgreement, LeaseAgreementDetail } from "@/lib/api/client";

export type DerivedAlertKind =
  | "changes_requested"
  | "ready_to_send"
  | "withdrawn"
  | "signed"
  | "payout_verified";

export type DerivedAlert = {
  id: string;
  kind: DerivedAlertKind;
  /** Agreement to open; null for account-level alerts (payout verified). */
  agreementId: string | null;
  message: string;
  /** Property address for secondary muted copy (ready-to-send); may be null. */
  propertyAddress: string | null;
  /** ISO timestamp when the alert condition became true, if known. */
  occurredAt: string | null;
};

function propertyLabel(address: string | null | undefined): string {
  const trimmed = address?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Untitled property";
}

function propertyAddressOrNull(
  address: string | null | undefined,
): string | null {
  const trimmed = address?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function maxReviewedAt(
  parties: LeaseAgreementDetail["parties"],
  status: "approved" | "changes_requested",
): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const party of parties) {
    if (party.approvalStatus !== status || !party.reviewedAt) continue;
    const ms = Date.parse(party.reviewedAt);
    if (Number.isNaN(ms)) continue;
    if (ms >= latestMs) {
      latestMs = ms;
      latest = party.reviewedAt;
    }
  }
  return latest;
}

/** Local date + time for alert cards (reviewedAt is an instant, not a date-only field). */
export function formatAlertDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Live alerts from agreement list (+ detail parties for names / timestamps).
 * No event log — recomputed from current rows only.
 */
export function buildDerivedAlerts(
  agreements: readonly LeaseAgreement[],
  detailsById: ReadonlyMap<string, LeaseAgreementDetail>,
): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];

  for (const agreement of agreements) {
    const address = propertyLabel(agreement.propertyAddress);
    const addressLine = propertyAddressOrNull(agreement.propertyAddress);

    if (agreement.status === "signed") {
      alerts.push({
        id: `signed:${agreement.id}`,
        kind: "signed",
        agreementId: agreement.id,
        message: `Agreement signed for ${address}`,
        propertyAddress: addressLine,
        occurredAt: agreement.signedAt ?? agreement.updatedAt,
      });
      continue;
    }

    if (agreement.status !== "in_review") continue;

    const changes = agreement.changesRequestedCount ?? 0;
    const withdrawn = agreement.withdrawnCount ?? 0;
    const partyCount = agreement.partyCount ?? 0;
    const approved = agreement.approvedCount ?? 0;
    const detail = detailsById.get(agreement.id);

    if (changes > 0) {
      const parties =
        detail?.parties.filter((p) => p.approvalStatus === "changes_requested") ?? [];

      if (parties.length > 0) {
        for (const party of parties) {
          alerts.push({
            id: `changes:${agreement.id}:${party.id}`,
            kind: "changes_requested",
            agreementId: agreement.id,
            message: `${party.name} requested changes on ${address}`,
            propertyAddress: addressLine,
            occurredAt: party.reviewedAt,
          });
        }
      } else {
        alerts.push({
          id: `changes:${agreement.id}:pending`,
          kind: "changes_requested",
          agreementId: agreement.id,
          message: `A party requested changes on ${address}`,
          propertyAddress: addressLine,
          occurredAt: null,
        });
      }
    }

    if (withdrawn > 0) {
      const parties =
        detail?.parties.filter((p) => p.approvalStatus === "withdrawn") ?? [];

      if (parties.length > 0) {
        for (const party of parties) {
          alerts.push({
            id: `withdrawn:${agreement.id}:${party.id}`,
            kind: "withdrawn",
            agreementId: agreement.id,
            message: `${party.name} withdrew approval on ${address}`,
            propertyAddress: addressLine,
            occurredAt: party.reviewedAt,
          });
        }
      } else {
        alerts.push({
          id: `withdrawn:${agreement.id}:pending`,
          kind: "withdrawn",
          agreementId: agreement.id,
          message: `A party withdrew approval on ${address}`,
          propertyAddress: addressLine,
          occurredAt: null,
        });
      }
    }

    if (changes === 0 && withdrawn === 0 && partyCount > 0 && approved === partyCount) {
      alerts.push({
        id: `ready:${agreement.id}`,
        kind: "ready_to_send",
        agreementId: agreement.id,
        message: "Agreement is ready to send for signing",
        propertyAddress: addressLine,
        // Last approval among approved parties — no list-level timestamp exists.
        occurredAt: detail ? maxReviewedAt(detail.parties, "approved") : null,
      });
    }
  }

  return alerts;
}

export const PAYOUT_VERIFIED_ALERT_MESSAGE =
  "Your payout details are verified — you can now receive consultancy fees.";

/**
 * Account-level alert when payout status is activated and the broker has not
 * yet opened Payments (one-shot seen flag). Same derived-alert shape as signed.
 */
export function buildPayoutVerifiedAlert(): DerivedAlert {
  return {
    id: "payout:verified",
    kind: "payout_verified",
    agreementId: null,
    message: PAYOUT_VERIFIED_ALERT_MESSAGE,
    propertyAddress: null,
    occurredAt: null,
  };
}

/**
 * Agreements that need a detail fetch for alert enrichment (party names + reviewedAt).
 * Includes ready-to-send rows so we can derive "last approved" without an API change.
 */
export function agreementsNeedingPartyDetail(
  agreements: readonly LeaseAgreement[],
): LeaseAgreement[] {
  return agreements.filter((agreement) => {
    if (agreement.status !== "in_review") return false;
    const changes = agreement.changesRequestedCount ?? 0;
    if (changes > 0) return true;
    const withdrawn = agreement.withdrawnCount ?? 0;
    if (withdrawn > 0) return true;
    const partyCount = agreement.partyCount ?? 0;
    const approved = agreement.approvedCount ?? 0;
    return partyCount > 0 && approved === partyCount;
  });
}

export function greetingFirstName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? "there";
}
