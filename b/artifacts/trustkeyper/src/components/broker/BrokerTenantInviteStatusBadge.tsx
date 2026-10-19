import {
  INVITE_STATUS_LABELS,
  inviteStatusBadgeClass,
  type BrokerOnboardInviteStatus,
} from "@/lib/brokerTenantInviteStatus";

export function BrokerTenantInviteStatusBadge({
  status,
}: {
  status: BrokerOnboardInviteStatus;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${inviteStatusBadgeClass(status)}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          status === "onboarding_pending"
            ? "bg-amber-500"
            : status === "onboarding_started"
              ? "bg-blue-500"
              : status === "requirements_submitted"
                ? "bg-violet-500"
                : status === "converted"
                  ? "bg-emerald-500"
                  : "bg-gray-400"
        }`}
        aria-hidden
      />
      {INVITE_STATUS_LABELS[status]}
    </span>
  );
}
