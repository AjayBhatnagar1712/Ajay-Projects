import { getProperties, getPropertyTitle, type Property } from "./properties";
import { hasServerWorkspaceSnapshot } from "@workspace/tenant-workflow";
import type { TenantWorkspaceRecord } from "./tenantWorkspace";
import type { TenantWorkflowStage } from "./tenantWorkflowState";

function formatPropertyAddress(property: Property): string {
  return [property.area, property.city].filter(Boolean).join(", ");
}

function formatPropertyStatus(property: Property): string {
  if (property.status === "Rented") return "Occupied";
  if (property.status === "Draft") return "Draft";
  return "Available";
}

export function enrichTenantWorkspaceEcosystem(
  workspace: TenantWorkspaceRecord,
): TenantWorkspaceRecord {
  if (!workspace.propertyId) {
    if (!workspace.propertyLabel) {
      return workspace;
    }
    return {
      ...workspace,
      ownerName: workspace.ownerName ?? (workspace.requesterRole === "owner" ? workspace.requesterName : undefined),
      brokerName: workspace.brokerName ?? (workspace.requesterRole === "broker" ? workspace.requesterName : undefined),
    };
  }

  const property = getProperties().find((row) => row.id === workspace.propertyId);
  if (!property) {
    if (hasServerWorkspaceSnapshot(workspace)) {
      return {
        ...workspace,
        ownerName:
          workspace.ownerName ??
          (workspace.requesterRole === "owner" ? workspace.requesterName : undefined),
        brokerName:
          workspace.brokerName ??
          (workspace.requesterRole === "broker" ? workspace.requesterName : undefined),
        propertyMissing: false,
      };
    }
    return {
      ...workspace,
      propertyMissing: true,
    };
  }

  const ownerName = property.ownerName?.trim() || workspace.ownerName;
  const brokerName =
    workspace.requesterRole === "broker"
      ? workspace.requesterName ?? workspace.brokerName
      : workspace.brokerName;

  return {
    ...workspace,
    propertyLabel: workspace.propertyLabel || getPropertyTitle(property),
    propertyAddress: workspace.propertyAddress || formatPropertyAddress(property),
    propertyImage: workspace.propertyImage ?? property.images?.[0],
    monthlyRent: workspace.monthlyRent ?? property.monthlyRent,
    securityDeposit: workspace.securityDeposit ?? property.securityDeposit,
    propertyType: workspace.propertyType ?? property.propertyType,
    propertyStatus: workspace.propertyStatus ?? formatPropertyStatus(property),
    ownerName,
    brokerName,
    propertyMissing: false,
  };
}

export function saveTenantWorkspaceEcosystem(record: TenantWorkspaceRecord): TenantWorkspaceRecord {
  const enriched = enrichTenantWorkspaceEcosystem(record);
  return enriched;
}

export function shouldDisplayBrokerName(
  workspace: TenantWorkspaceRecord,
  stage: TenantWorkflowStage,
): boolean {
  if (!workspace.brokerName) return false;
  const hideAfterAgreement = [
    "agreement_ready",
    "esign_document_upload",
    "awaiting_esign_signatures",
    "agreement_signed",
    "rent_payment_due",
    "move_in_scheduled",
    "maintenance_update",
    "lease_renewal",
    "active_tenant",
  ] as const;
  return !hideAfterAgreement.includes(stage as (typeof hideAfterAgreement)[number]);
}

export function formatTenantSecurityDeposit(value?: string): string | null {
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return `₹${amount.toLocaleString("en-IN")}`;
}
