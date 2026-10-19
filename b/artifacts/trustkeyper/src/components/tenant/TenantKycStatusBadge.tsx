import { cn } from "@/lib/utils";
import {
  TENANT_KYC_STATUS_STYLES,
  formatTenantKycStatusLabel,
  normalizeTenantKycStatus,
  type TenantKycVerificationStatus,
} from "@/lib/tenantKycStatus";

export function TenantKycStatusBadge({
  status,
  className,
}: {
  status: TenantKycVerificationStatus | string;
  className?: string;
}) {
  const normalized = normalizeTenantKycStatus(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        TENANT_KYC_STATUS_STYLES[normalized],
        className,
      )}
    >
      {formatTenantKycStatusLabel(normalized)}
    </span>
  );
}
