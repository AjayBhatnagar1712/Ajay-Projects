import { AlertCircle, Building2, MapPin, User } from "lucide-react";
import {
  formatTenantSecurityDeposit,
  shouldDisplayBrokerName,
} from "@/lib/tenantEcosystem";
import type { TenantWorkspaceRecord } from "@/lib/tenantWorkspace";
import { formatTenantRent } from "@/lib/tenantWorkspace";
import type { TenantWorkflowStage } from "@/lib/tenantWorkflowState";

export interface TenantDashboardPropertyCardProps {
  workspace: TenantWorkspaceRecord | null;
  workflowStage: TenantWorkflowStage;
  loading?: boolean;
  errorMessage?: string;
}

export function TenantDashboardPropertyCard({
  workspace,
  workflowStage,
  loading,
  errorMessage,
}: TenantDashboardPropertyCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 animate-pulse h-full">
        <div className="flex gap-4">
          <div className="w-28 h-24 sm:w-36 sm:h-28 rounded-xl bg-gray-100 shrink-0" />
          <div className="flex-1 space-y-3 py-1">
            <div className="h-5 bg-gray-100 rounded w-2/3" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
            <div className="h-4 bg-gray-100 rounded w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 h-full">
        <div className="flex gap-3 items-start">
          <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Property unavailable</p>
            <p className="text-sm text-amber-800 mt-1">{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!workspace?.propertyLabel) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center h-full flex flex-col items-center justify-center">
        <Building2 size={28} className="text-gray-300 mb-3" />
        <p className="text-sm font-semibold text-gray-800">No property assigned</p>
        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
          Your assigned rental will appear here once your owner or broker completes onboarding.
        </p>
      </div>
    );
  }

  const deposit = formatTenantSecurityDeposit(workspace.securityDeposit);
  const showBroker = shouldDisplayBrokerName(workspace, workflowStage);
  const isAgreementFlowView =
    workflowStage === "agreement_ready" ||
    workflowStage === "esign_document_upload" ||
    workflowStage === "awaiting_esign_signatures";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm h-full">
      <div className="flex gap-4 items-stretch">
        <div className="w-28 h-24 sm:w-36 sm:h-28 rounded-xl overflow-hidden bg-gray-100 shrink-0">
          {workspace.propertyImage ? (
            <img src={workspace.propertyImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#E8F4FC] to-[#D4EBE4]">
              <Building2 size={28} className="text-primary/35" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight">
            {workspace.propertyLabel}
          </h2>
          {workspace.propertyAddress ? (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <MapPin size={14} className="shrink-0" />
              <span className="truncate">{workspace.propertyAddress}</span>
            </p>
          ) : null}
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Expected Rent
            </p>
            <p className="text-lg font-semibold text-primary">{formatTenantRent(workspace.monthlyRent)}</p>
          </div>
          {isAgreementFlowView ? null : (
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
            {deposit ? (
              <div>
                <dt className="inline font-medium text-gray-600">Security deposit: </dt>
                <dd className="inline">{deposit}</dd>
              </div>
            ) : null}
            {workspace.propertyType ? (
              <div>
                <dt className="inline font-medium text-gray-600">Type: </dt>
                <dd className="inline">{workspace.propertyType}</dd>
              </div>
            ) : null}
            {workspace.propertyStatus ? (
              <div>
                <dt className="inline font-medium text-gray-600">Status: </dt>
                <dd className="inline">{workspace.propertyStatus}</dd>
              </div>
            ) : null}
            {workspace.ownerName ? (
              <div className="flex items-center gap-1 min-w-0">
                <User size={12} className="shrink-0 text-gray-400" />
                <span className="truncate">
                  <span className="font-medium text-gray-600">Owner: </span>
                  {workspace.ownerName}
                </span>
              </div>
            ) : null}
            {showBroker && workspace.brokerName ? (
              <div className="flex items-center gap-1 min-w-0">
                <User size={12} className="shrink-0 text-gray-400" />
                <span className="truncate">
                  <span className="font-medium text-gray-600">Broker: </span>
                  {workspace.brokerName}
                </span>
              </div>
            ) : null}
          </dl>
          )}
        </div>
      </div>
    </div>
  );
}
