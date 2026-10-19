import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import TenantLayout from "@/components/TenantLayout";
import { TenantActiveDashboardView } from "@/components/tenant/TenantActiveDashboardView";
import { TenantAwaitingSignaturesCard } from "@/components/tenant/TenantAwaitingSignaturesCard";
import { TenantDashboardPropertyCard } from "@/components/tenant/TenantDashboardPropertyCard";
import { TenantProgressTracker } from "@/components/tenant/TenantProgressTracker";
import { TenantStatusNotificationCard } from "@/components/tenant/TenantStatusNotificationCard";
import { TENANT_DOCUMENT_MANAGEMENT_UPDATED_EVENT } from "@/lib/tenantDocumentManagementSync";
import { TENANT_DOCUMENT_STATUS_UPDATED_EVENT } from "@/lib/tenantDocumentUploadStatus";
import { TENANT_PROFILE_UPDATED_EVENT } from "@/lib/tenantProfile";
import { isActiveTenantDashboardStage } from "@/lib/tenantActiveDashboard";
import {
  getActiveTenantWorkspace,
  getTenantDisplayName,
  type TenantWorkspaceRecord,
} from "@/lib/tenantWorkspace";
import {
  resolveTenantWorkflowState,
  TENANT_WORKFLOW_UPDATED_EVENT,
  type TenantWorkflowSnapshot,
} from "@/lib/tenantWorkflowState";
import { pullTenantWorkspaceFromServer } from "@/lib/tenantWorkflowServer";

const ACTIVE_TENANT_PREVIEW_WORKSPACE: TenantWorkspaceRecord = {
  phone: "9876543210",
  tenantName: "Meena",
  propertyId: "prop-preview",
  propertyLabel: "Flat 401, Ayyappa Society",
  propertyAddress: "Flat 401, Ayyappa Society, Madhapur, Hyderabad",
  propertyType: "Single Room in 3 BHK Apartment",
  monthlyRent: "13000",
  securityDeposit: "39000",
  ownerName: "Anita Owner",
  preSigningEscrowType: "security_deposit",
  escrowPaymentStatus: "paid",
  lifecycleStage: "active_tenant",
  agreementSnapshot: {
    ownerName: "Anita Owner",
    tenantName: "Meena",
    propertyAddress: "Flat 401, Ayyappa Society, Madhapur, Hyderabad",
    leaseStartDate: "2025-09-05",
    leaseEndDate: "2026-08-05",
    monthlyRent: "13000",
    securityDeposit: "39000",
    rentDueDay: "1",
    lockInPeriod: "11 months",
    noticePeriod: "2 months",
  },
  updatedAt: Date.now(),
};

export default function TenantDashboard() {
  const previewActive = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("preview") === "active";
  }, []);
  const [workspace, setWorkspace] = useState<TenantWorkspaceRecord | null>(null);
  const [workflow, setWorkflow] = useState<TenantWorkflowSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshDashboard = useCallback(() => {
    try {
      const nextWorkspace = getActiveTenantWorkspace();
      const nextWorkflow = resolveTenantWorkflowState(nextWorkspace);
      setWorkspace(nextWorkspace);
      setWorkflow(nextWorkflow);
      setLoadError(null);
    } catch {
      setLoadError("Could not load your dashboard. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const pull = () => void pullTenantWorkspaceFromServer().finally(() => refreshDashboard());
    pull();
    const interval = window.setInterval(pull, 15000);
    const onUpdate = () => refreshDashboard();
    window.addEventListener("focus", pull);
    window.addEventListener(TENANT_DOCUMENT_STATUS_UPDATED_EVENT, onUpdate);
    window.addEventListener(TENANT_PROFILE_UPDATED_EVENT, onUpdate);
    window.addEventListener(TENANT_WORKFLOW_UPDATED_EVENT, onUpdate);
    window.addEventListener(TENANT_DOCUMENT_MANAGEMENT_UPDATED_EVENT, onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", pull);
      window.removeEventListener(TENANT_DOCUMENT_STATUS_UPDATED_EVENT, onUpdate);
      window.removeEventListener(TENANT_PROFILE_UPDATED_EVENT, onUpdate);
      window.removeEventListener(TENANT_WORKFLOW_UPDATED_EVENT, onUpdate);
      window.removeEventListener(TENANT_DOCUMENT_MANAGEMENT_UPDATED_EVENT, onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, [refreshDashboard]);

  const tenantName = getTenantDisplayName();
  const displayWorkspace = previewActive ? (workspace ?? ACTIVE_TENANT_PREVIEW_WORKSPACE) : workspace;
  const isActiveTenant =
    previewActive || (workflow ? isActiveTenantDashboardStage(workflow.stage) : false);

  return (
    <TenantLayout>
      {isActiveTenant ? (
        <TenantActiveDashboardView
          tenantName={tenantName}
          workspace={displayWorkspace}
          loading={loading && !previewActive}
          loadError={previewActive ? null : loadError}
        />
      ) : (
      <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
        <h1 className="text-2xl sm:text-[28px] font-semibold text-primary leading-tight">
          Hi, {tenantName}!
        </h1>

        {loadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex gap-3 items-start">
            <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{loadError}</p>
          </div>
        ) : null}

        <TenantProgressTracker steps={workflow?.progressSteps ?? []} />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
          <div className="lg:col-span-3">
            <TenantDashboardPropertyCard
              workspace={workspace}
              workflowStage={workflow?.stage ?? "no_workflow"}
              loading={loading}
              errorMessage={
                workflow?.error?.code === "missing_property"
                  ? workflow.error.message
                  : undefined
              }
            />
          </div>
          <div className="lg:col-span-2">
            {workflow?.stage === "awaiting_esign_signatures" && workflow.signatureStatus ? (
              <TenantAwaitingSignaturesCard status={workflow.signatureStatus} loading={loading} />
            ) : (
              <TenantStatusNotificationCard
                notification={
                  workflow?.notification ?? {
                    kind: "no_property",
                    title: "Loading…",
                    description: "Fetching your latest rental activity.",
                  }
                }
                loading={loading}
              />
            )}
          </div>
        </div>
      </div>
      )}
    </TenantLayout>
  );
}
