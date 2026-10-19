export type BrokerOnboardInviteStatus =
  | "onboarding_pending"
  | "onboarding_started"
  | "requirements_submitted"
  | "converted"
  | "expired";

/** Legacy statuses persisted before invite-tracking rollout. */
export type LegacyBrokerOnboardInviteStatus = "pending" | "submitted";

export type StoredBrokerOnboardInviteStatus =
  | BrokerOnboardInviteStatus
  | LegacyBrokerOnboardInviteStatus;

export const BROKER_ONBOARDING_INVITES_UPDATED_EVENT =
  "trustkeyper:broker-onboarding-invites-updated";

export function notifyBrokerInvitesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BROKER_ONBOARDING_INVITES_UPDATED_EVENT));
}

export function normalizeStoredInviteStatus(
  status: string,
): BrokerOnboardInviteStatus {
  if (status === "pending" || status === "onboarding_pending") {
    return "onboarding_pending";
  }
  if (status === "onboarding_started") return "onboarding_started";
  if (status === "submitted" || status === "requirements_submitted") {
    return "requirements_submitted";
  }
  if (status === "converted") return "converted";
  return "expired";
}

export function resolveInviteStatus(
  storedStatus: string,
  expiresAt: number,
  deletedAt?: number,
): BrokerOnboardInviteStatus {
  if (deletedAt) return "expired";
  const normalized = normalizeStoredInviteStatus(storedStatus);
  if (normalized === "converted" || normalized === "requirements_submitted") {
    return normalized;
  }
  if (expiresAt <= Date.now()) return "expired";
  return normalized;
}

export function isActiveInviteStatus(status: BrokerOnboardInviteStatus): boolean {
  return status === "onboarding_pending" || status === "onboarding_started";
}

export const INVITE_STATUS_LABELS: Record<BrokerOnboardInviteStatus, string> = {
  onboarding_pending: "Onboarding Pending",
  onboarding_started: "Onboarding Started",
  requirements_submitted: "Requirements Submitted",
  converted: "Active Tenant",
  expired: "Expired",
};

export function inviteStatusBadgeClass(status: BrokerOnboardInviteStatus): string {
  switch (status) {
    case "onboarding_pending":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "onboarding_started":
      return "bg-blue-50 text-blue-800 border-blue-200";
    case "requirements_submitted":
      return "bg-violet-50 text-violet-800 border-violet-200";
    case "converted":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "expired":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}
