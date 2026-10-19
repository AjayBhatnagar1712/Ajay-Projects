import type {
  PortalAgreementListItem,
  PortalRentPaymentState,
} from "@/lib/api/client";

export type PortalAlertKind = "rent_late" | "rent_due_soon" | "brokerage_due";

export type PortalDerivedAlert = {
  id: string;
  kind: PortalAlertKind;
  agreementId: string;
  message: string;
  propertyAddress: string | null;
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

/**
 * Owner/tenant portal alerts from list rows.
 * Owner: rent_late. Tenant: rent_due_soon + brokerage_due.
 * No broker-facing late alerts.
 */
export function buildPortalDerivedAlerts(
  agreements: readonly PortalAgreementListItem[],
): PortalDerivedAlert[] {
  const alerts: PortalDerivedAlert[] = [];

  for (const agreement of agreements) {
    const address = propertyLabel(agreement.propertyAddress);
    const addressLine = propertyAddressOrNull(agreement.propertyAddress);
    const role = agreement.partyRole;

    if (role === "owner" && agreement.rentPaymentState === "late") {
      alerts.push({
        id: `rent_late:${agreement.id}:${agreement.rentPeriod}`,
        kind: "rent_late",
        agreementId: agreement.id,
        message: `Rent for ${agreement.rentPeriod} is late for ${address}`,
        propertyAddress: addressLine,
      });
    }

    if (role === "tenant") {
      if (agreement.rentPaymentState === "due_soon") {
        alerts.push({
          id: `rent_due_soon:${agreement.id}:${agreement.rentPeriod}`,
          kind: "rent_due_soon",
          agreementId: agreement.id,
          message: `Rent for ${agreement.rentPeriod} is due by ${agreement.rentDueDate} for ${address}`,
          propertyAddress: addressLine,
        });
      }

      const fee = agreement.brokerageFeePaise;
      const signed = agreement.status === "signed";
      if (signed && fee != null && fee > 0 && !agreement.brokeragePaid) {
        alerts.push({
          id: `brokerage_due:${agreement.id}`,
          kind: "brokerage_due",
          agreementId: agreement.id,
          message: `Consultancy fee is due for ${address}`,
          propertyAddress: addressLine,
        });
      }
    }
  }

  return alerts;
}

export function rentStateLabel(state: PortalRentPaymentState): string {
  switch (state) {
    case "needs_review":
      return "Contact TrustKeyper to review this rent month";
    case "due_soon":
      return "Due soon";
    case "late":
      return "Late";
    case "paid":
      return "Paid";
    case "settled":
      return "Settled";
    case "upcoming":
      return "Upcoming";
    default:
      return "—";
  }
}

export function consultancyPaymentStatusLabel(
  status: string | null | undefined,
): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "settled":
      return "Settled";
    case "created":
      return "Payment started";
    case "failed":
      return "Failed — try again";
    default:
      return "Due";
  }
}
