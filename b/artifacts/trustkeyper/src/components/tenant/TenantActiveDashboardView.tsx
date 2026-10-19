import { AlertCircle } from "lucide-react";
import { TenantActivePropertyLeaseCard } from "@/components/tenant/TenantActivePropertyLeaseCard";
import { TenantMoveOutCard } from "@/components/tenant/TenantMoveOutCard";
import { TenantNextRentDueCard } from "@/components/tenant/TenantNextRentDueCard";
import { TenantPaymentSuccessBanner } from "@/components/tenant/TenantPaymentSuccessBanner";
import {
  buildActiveTenantDashboardSnapshot,
  type TenantActiveDashboardSnapshot,
} from "@/lib/tenantActiveDashboard";
import type { TenantWorkspaceRecord } from "@/lib/tenantWorkspace";
import { toast } from "@/hooks/use-toast";

export interface TenantActiveDashboardViewProps {
  tenantName: string;
  workspace: TenantWorkspaceRecord | null;
  loading?: boolean;
  loadError?: string | null;
  snapshot?: TenantActiveDashboardSnapshot;
}

export function TenantActiveDashboardView({
  tenantName,
  workspace,
  loading,
  loadError,
  snapshot: snapshotOverride,
}: TenantActiveDashboardViewProps) {
  const snapshot = snapshotOverride ?? buildActiveTenantDashboardSnapshot(workspace);
  const propertyError =
    loadError ??
    (workspace && !workspace.propertyLabel && !workspace.propertyAddress
      ? "Property details are not available yet."
      : undefined);

  const handleDownloadReceipt = () => {
    toast({
      title: "Receipt download",
      description: "Your payment receipt will be available here once connected to the backend.",
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <h1 className="text-[28px] font-medium text-primary leading-9">Hi, {tenantName}!</h1>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex gap-3 items-start">
          <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{loadError}</p>
        </div>
      ) : null}

      <TenantPaymentSuccessBanner
        message={snapshot.paymentSuccessMessage}
        loading={loading}
        onDownloadReceipt={handleDownloadReceipt}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-4">
        <TenantActivePropertyLeaseCard
          workspace={workspace}
          propertyTitle={snapshot.propertyTitle}
          propertySubtitle={snapshot.propertySubtitle}
          leaseMonthLabel={snapshot.leaseMonthLabel}
          leaseProgressPercent={snapshot.leaseProgressPercent}
          leaseStartLabel={snapshot.leaseStartLabel}
          leaseEndLabel={snapshot.leaseEndLabel}
          loading={loading}
          errorMessage={propertyError}
        />
        <TenantNextRentDueCard
          amountLabel={snapshot.nextRentAmountLabel}
          dueLabel={snapshot.nextRentDueLabel}
          loading={loading}
        />
      </div>

      <TenantMoveOutCard loading={loading} />
    </div>
  );
}
