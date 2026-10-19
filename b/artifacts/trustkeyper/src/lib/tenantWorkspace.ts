import type { TenantDocumentUploadStatus } from "@workspace/tenant-document-upload";
import type { DocumentUploadInvitePayload } from "@/lib/publicAgreementDocumentUpload";
import { queueCloudSync, queueCloudSyncForAccount } from "@/lib/cloudSync";
import { enrichTenantWorkspaceEcosystem } from "@/lib/tenantEcosystem";
import { getProperties, getPropertyTitle } from "@/lib/properties";
import {
  broadcastTenantWorkflowUpdated,
  resolveTenantWorkflowState,
} from "@/lib/tenantWorkflowState";
import type { TenantWorkflowStage } from "@/lib/tenantWorkflowState";
import {
  mergeInviteIntoTenantWorkspace,
} from "@/lib/tenantWorkspaceInviteMerge";
import { getActiveSession, getSessionItem, storageKey, writeLocalForAccount } from "@/lib/storageKeys";

export type TenantDashboardPhase =
  | "no_property"
  | "documents_pending"
  | "documents_submitted"
  | "agreement_pending"
  | "agreement_ready"
  | "active_tenant";

export type TenantNotificationKind =
  | "no_property"
  | "documents_pending"
  | "documents_under_review"
  | "agreement_being_prepared"
  | "agreement_ready"
  | "esign_document_upload"
  | "awaiting_esign_signatures"
  | "agreement_signed"
  | "move_in_scheduled"
  | "maintenance_open"
  | "rent_due";

export type TenantPreSigningEscrowType = "brokerage_tenant" | "security_deposit";

export type TenantEscrowPaymentStatus = "created" | "paid" | "settled" | "failed";

export interface TenantAgreementSnapshot {
  ownerName: string;
  ownerContact?: string;
  tenantName: string;
  propertyAddress: string;
  propertyType?: string;
  leaseStartDate: string;
  leaseEndDate?: string;
  monthlyRent: string;
  securityDeposit: string;
  rentDueDay: string;
  lockInPeriod: string;
  noticePeriod: string;
  brokerageAmount?: string;
  agreementText?: string;
}

export interface TenantWorkspaceRecord {
  phone: string;
  tenantName: string;
  propertyId?: string;
  propertyLabel: string;
  propertyAddress?: string;
  propertyImage?: string;
  monthlyRent?: string;
  securityDeposit?: string;
  propertyType?: string;
  propertyStatus?: string;
  ownerName?: string;
  ownerContact?: string;
  brokerName?: string;
  documentUploadToken?: string;
  documentUploadStatus?: TenantDocumentUploadStatus;
  documentUploadSubmittedAt?: number;
  requesterName?: string;
  requesterRole?: "owner" | "broker";
  agreementId?: string;
  accountCreatedAt?: number;
  rentalRequirementsSubmitted?: boolean;
  lifecycleStage?: TenantWorkflowStage;
  preSigningEscrowType?: TenantPreSigningEscrowType;
  escrowPaymentId?: string;
  escrowPaymentStatus?: TenantEscrowPaymentStatus;
  agreementSnapshot?: TenantAgreementSnapshot;
  propertyMissing?: boolean;
  agreementCancelled?: boolean;
  relationshipError?: string;
  esignSignedPartyPhones?: string[];
  updatedAt: number;
}

export interface TenantProgressStep {
  id: string;
  label: string;
  state: "complete" | "current" | "upcoming";
}

export interface TenantNotificationContent {
  kind: TenantNotificationKind;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function workspaceStorageKey(digits: string): string {
  return `tk_${digits}_tenant_workspace`;
}

function formatPropertyAddress(property: {
  area: string;
  city: string;
}): string {
  return [property.area, property.city].filter(Boolean).join(", ");
}

function formatPropertyStatusLabel(status: string): string {
  if (status === "Rented") return "Occupied";
  if (status === "Draft") return "Draft";
  return "Available";
}

export type SaveTenantWorkspaceOptions = {
  /** Mirror to sync API — only for legacy bulk restore. Workflow writes use tenant-workflow API. */
  syncToCloud?: boolean;
};

export function saveTenantWorkspace(
  record: TenantWorkspaceRecord,
  options?: SaveTenantWorkspaceOptions,
): void {
  const digits = phoneDigits(record.phone);
  const enriched = enrichTenantWorkspaceEcosystem({ ...record, phone: digits, updatedAt: Date.now() });
  const payload = JSON.stringify(enriched);
  localStorage.setItem(workspaceStorageKey(digits), payload);
  writeLocalForAccount(digits, "tenant", "tenant_workspace", payload, false);
  const session = getActiveSession();
  if (session && phoneDigits(session.phone) === digits && session.role === "tenant") {
    if (options?.syncToCloud) {
      queueCloudSync("tenant_workspace", payload);
    } else {
      queueCloudSyncForAccount(digits, "tenant", "tenant_workspace", payload);
    }
  } else {
    queueCloudSyncForAccount(digits, "tenant", "tenant_workspace", payload);
  }
  broadcastTenantWorkflowUpdated();
}

export function getTenantWorkspaceForPhone(phone: string): TenantWorkspaceRecord | null {
  const digits = phoneDigits(phone);
  if (!digits) return null;
  const raw =
    localStorage.getItem(workspaceStorageKey(digits)) ??
    localStorage.getItem(storageKey(digits, "tenant", "tenant_workspace"));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TenantWorkspaceRecord;
    return enrichTenantWorkspaceEcosystem(parsed);
  } catch {
    return null;
  }
}

export function getActiveTenantWorkspace(): TenantWorkspaceRecord | null {
  const session = getActiveSession();
  if (!session || session.role !== "tenant") return null;
  return getTenantWorkspaceForPhone(session.phone);
}

export function saveTenantWorkspaceFromInvite(
  invite: DocumentUploadInvitePayload,
  overrides?: Partial<TenantWorkspaceRecord>,
): TenantWorkspaceRecord {
  let propertyImage: string | undefined;
  let monthlyRent: string | undefined;
  let propertyAddress: string | undefined;
  let propertyStatus: string | undefined;
  let securityDeposit: string | undefined;
  let propertyType: string | undefined;
  let ownerName: string | undefined;
  let brokerName: string | undefined;

  const linkedProperty = invite.propertyId
    ? getProperties().find((row) => row.id === invite.propertyId)
    : undefined;

  if (linkedProperty) {
    propertyImage = linkedProperty.images?.[0];
    monthlyRent = linkedProperty.monthlyRent;
    propertyAddress = formatPropertyAddress(linkedProperty);
    propertyStatus = formatPropertyStatusLabel(linkedProperty.status);
    securityDeposit = linkedProperty.securityDeposit;
    propertyType = linkedProperty.propertyType;
    ownerName = linkedProperty.ownerName;
  } else {
    propertyImage = invite.propertyImage;
    monthlyRent = invite.monthlyRent;
    propertyAddress = invite.propertyAddress;
    securityDeposit = invite.securityDeposit;
  }

  const propertyTitle =
    invite.propertyLabel ?? (linkedProperty ? getPropertyTitle(linkedProperty) : "Assigned Property");

  if (invite.requesterRole === "broker") {
    brokerName = invite.requesterName;
  } else {
    ownerName = ownerName ?? invite.requesterName;
  }

  const digits = phoneDigits(invite.tenantPhone);
  const existing = getTenantWorkspaceForPhone(digits);

  const inviteRecord: TenantWorkspaceRecord = {
    phone: digits,
    tenantName: invite.tenantName,
    propertyId: invite.propertyId,
    propertyLabel: propertyTitle,
    propertyAddress,
    propertyImage,
    monthlyRent,
    securityDeposit,
    propertyType,
    propertyStatus,
    ownerName,
    brokerName,
    documentUploadToken: invite.token,
    documentUploadStatus: overrides?.documentUploadStatus ?? invite.tenantDocumentStatus,
    documentUploadSubmittedAt: overrides?.documentUploadSubmittedAt ?? invite.submittedAt,
    requesterName: invite.requesterName,
    requesterRole: invite.requesterRole,
    updatedAt: Date.now(),
    ...overrides,
  };

  const record = enrichTenantWorkspaceEcosystem(
    mergeInviteIntoTenantWorkspace(existing, inviteRecord),
  );

  saveTenantWorkspace(record);
  void import("./tenantWorkflowServer").then((mod) =>
    mod.upsertTenantWorkspaceOnServer(record),
  );
  return record;
}

/** @deprecated Use resolveTenantWorkflowState instead */
export function resolveTenantDashboardPhase(
  workspace: TenantWorkspaceRecord | null,
): TenantDashboardPhase {
  if (!workspace?.propertyLabel) return "no_property";
  const status = workspace.documentUploadStatus;
  if (!status || status === "document_request_sent") return "documents_pending";
  if (status === "documents_in_progress") return "documents_pending";
  if (status === "documents_submitted") return "documents_submitted";
  if (status === "agreement_ready") return "agreement_ready";
  return "agreement_pending";
}

/** @deprecated Use resolveTenantWorkflowState instead */
export function resolveTenantProgressSteps(
  workspace: TenantWorkspaceRecord | null,
): TenantProgressStep[] {
  return resolveTenantWorkflowState(workspace).progressSteps;
}

/** @deprecated Use resolveTenantWorkflowState instead */
export function resolveTenantNotification(
  workspace: TenantWorkspaceRecord | null,
): TenantNotificationContent {
  return resolveTenantWorkflowState(workspace).notification;
}

export function getTenantDisplayName(): string {
  const fromSession = getSessionItem("name")?.trim();
  if (fromSession) return fromSession.replace(/!$/, "");
  const workspace = getActiveTenantWorkspace();
  if (workspace?.tenantName) return workspace.tenantName;
  return "there";
}

export function formatTenantRent(monthlyRent?: string): string {
  if (!monthlyRent) return "—";
  const amount = Number(monthlyRent);
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return `₹${amount.toLocaleString("en-IN")}/month`;
}
