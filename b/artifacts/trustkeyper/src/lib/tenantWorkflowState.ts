import type { TenantDocumentUploadStatus } from "@workspace/tenant-document-upload";
import type {
  TenantNotificationContent,
  TenantProgressStep,
  TenantWorkspaceRecord,
} from "./tenantWorkspace";
import {
  resolveTenantAwaitingSignaturesStatus,
  type TenantAwaitingSignaturesStatus,
} from "./tenantAgreementSignatureStatus";

export const TENANT_WORKFLOW_UPDATED_EVENT = "tk-tenant-workflow-updated";

export type TenantWorkflowStage =
  | "no_property"
  | "no_workflow"
  | "invitation_sent"
  | "account_created"
  | "rental_requirements_submitted"
  | "documents_requested"
  | "documents_in_progress"
  | "documents_submitted"
  | "documents_under_review"
  | "additional_documents_required"
  | "agreement_being_prepared"
  | "agreement_ready"
  | "esign_document_upload"
  | "awaiting_esign_signatures"
  | "agreement_signed"
  | "rent_payment_due"
  | "move_in_scheduled"
  | "maintenance_update"
  | "lease_renewal"
  | "active_tenant"
  | "agreement_cancelled"
  | "property_removed"
  | "relationship_error";

export interface TenantWorkflowError {
  code: "missing_property" | "missing_owner" | "missing_agreement" | "invalid_relationship";
  message: string;
}

export interface TenantWorkflowSnapshot {
  stage: TenantWorkflowStage;
  progressSteps: TenantProgressStep[];
  notification: TenantNotificationContent;
  showBroker: boolean;
  signatureStatus?: TenantAwaitingSignaturesStatus;
  error?: TenantWorkflowError;
}

const PROGRESS_STEP_DEFS = [
  { id: "documents", label: "Document Upload" },
  { id: "agreement", label: "Agreement Generation" },
  { id: "review", label: "Review & Sign" },
] as const;

function stageRank(stage: TenantWorkflowStage): number {
  const order: TenantWorkflowStage[] = [
    "no_property",
    "no_workflow",
    "relationship_error",
    "property_removed",
    "agreement_cancelled",
    "invitation_sent",
    "account_created",
    "rental_requirements_submitted",
    "documents_requested",
    "documents_in_progress",
    "documents_submitted",
    "documents_under_review",
    "additional_documents_required",
    "agreement_being_prepared",
    "agreement_ready",
    "esign_document_upload",
    "awaiting_esign_signatures",
    "agreement_signed",
    "rent_payment_due",
    "move_in_scheduled",
    "maintenance_update",
    "lease_renewal",
    "active_tenant",
  ];
  return order.indexOf(stage);
}

function documentsPhaseComplete(stage: TenantWorkflowStage): boolean {
  return stageRank(stage) >= stageRank("documents_under_review");
}

function agreementPhaseComplete(stage: TenantWorkflowStage): boolean {
  return stageRank(stage) >= stageRank("agreement_ready");
}

function reviewPhaseComplete(stage: TenantWorkflowStage): boolean {
  return stageRank(stage) >= stageRank("awaiting_esign_signatures");
}

export function buildProgressStepsFromStage(stage: TenantWorkflowStage): TenantProgressStep[] {
  const documentsDone = documentsPhaseComplete(stage);
  const agreementDone = agreementPhaseComplete(stage);
  const reviewDone = reviewPhaseComplete(stage);

  const agreementCurrent =
    documentsDone && !agreementDone && stageRank(stage) < stageRank("agreement_ready");
  const reviewCurrent = agreementDone && !reviewDone;

  return PROGRESS_STEP_DEFS.map((step) => {
    if (step.id === "documents") {
      if (documentsDone) return { ...step, state: "complete" as const };
      if (stageRank(stage) >= stageRank("documents_requested")) {
        return { ...step, state: "current" as const };
      }
      return { ...step, state: "upcoming" as const };
    }
    if (step.id === "agreement") {
      if (agreementDone) return { ...step, state: "complete" as const };
      if (agreementCurrent || stage === "agreement_being_prepared") {
        return { ...step, state: "current" as const };
      }
      return { ...step, state: "upcoming" as const };
    }
    if (reviewDone) return { ...step, state: "complete" as const };
    if (reviewCurrent) return { ...step, state: "current" as const };
    return { ...step, state: "upcoming" as const };
  });
}

function mapUploadStatusToStage(
  status: TenantDocumentUploadStatus | undefined,
  workspace: TenantWorkspaceRecord,
): TenantWorkflowStage {
  if (workspace.agreementCancelled) return "agreement_cancelled";
  if (workspace.propertyMissing) return "property_removed";
  if (!status || status === "document_request_sent") return "documents_requested";
  if (status === "documents_in_progress") return "documents_in_progress";
  if (status === "documents_submitted") return "documents_under_review";
  if (status === "agreement_ready") return "agreement_ready";
  return "agreement_being_prepared";
}

function resolveStage(workspace: TenantWorkspaceRecord | null): TenantWorkflowStage {
  if (!workspace) return "no_workflow";
  if (workspace.relationshipError) return "relationship_error";
  if (workspace.agreementCancelled) return "agreement_cancelled";
  if (workspace.propertyMissing) return "property_removed";
  if (!workspace.propertyId && !workspace.propertyLabel) return "no_property";

  if (workspace.lifecycleStage) return workspace.lifecycleStage;

  if (workspace.rentalRequirementsSubmitted && !workspace.documentUploadStatus) {
    return "rental_requirements_submitted";
  }

  if (workspace.accountCreatedAt && !workspace.documentUploadStatus) {
    return "account_created";
  }

  return mapUploadStatusToStage(workspace.documentUploadStatus, workspace);
}

export function shouldShowBrokerForStage(
  stage: TenantWorkflowStage,
  workspace?: TenantWorkspaceRecord | null,
): boolean {
  if (workspace?.requesterRole !== "broker") return false;
  return stageRank(stage) < stageRank("rent_payment_due");
}

function resolvePostSigningRentNotification(
  workspace: TenantWorkspaceRecord | null,
): TenantNotificationContent {
  const depositAlreadyPaid = workspace?.preSigningEscrowType === "security_deposit";
  if (depositAlreadyPaid) {
    return {
      kind: "rent_due",
      title: "Rent payment due",
      description:
        "Your agreement is complete. Pay your first month's rent to confirm move-in.",
      actionLabel: "Pay rent",
      actionHref: "/tenant/rent",
    };
  }

  return {
    kind: "rent_due",
    title: "Rent and deposit due",
    description:
      "Your agreement is complete. Pay rent and the security deposit to confirm move-in.",
    actionLabel: "Pay rent and security deposit",
    actionHref: "/tenant/rent",
  };
}

function buildNotification(
  stage: TenantWorkflowStage,
  workspace: TenantWorkspaceRecord | null,
): TenantNotificationContent {
  const uploadHref = workspace?.documentUploadToken
    ? `/upload/documents/${workspace.documentUploadToken}`
    : undefined;

  const byStage: Partial<Record<TenantWorkflowStage, TenantNotificationContent>> = {
    no_property: {
      kind: "no_property",
      title: "No property assigned yet",
      description:
        "Once your property owner or broker links you to a rental, your property details and next steps will appear here.",
    },
    no_workflow: {
      kind: "no_property",
      title: "Welcome to TrustKeyper",
      description:
        "Your rental journey will appear here once you accept an invitation from your owner or broker.",
    },
    relationship_error: {
      kind: "no_property",
      title: "Unable to load your rental journey",
      description:
        "We could not verify your property relationship. Please contact support or ask your owner to resend the invite.",
    },
    property_removed: {
      kind: "no_property",
      title: "Property no longer available",
      description:
        "The property linked to your invitation is no longer available. Please contact your owner or broker for an updated invite.",
    },
    agreement_cancelled: {
      kind: "no_property",
      title: "Agreement cancelled",
      description:
        "This rental agreement process was cancelled. Please contact your owner or broker if you believe this is a mistake.",
    },
    invitation_sent: {
      kind: "documents_pending",
      title: "Invitation received",
      description:
        "You have been invited to complete your rental onboarding. Create your account and upload the requested documents to continue.",
      actionLabel: "Continue",
      actionHref: uploadHref,
    },
    account_created: {
      kind: "documents_pending",
      title: "Account created",
      description:
        "Your TrustKeyper account is ready. Upload your required documents to continue with your rental application.",
      actionLabel: "Upload Documents",
      actionHref: uploadHref,
    },
    rental_requirements_submitted: {
      kind: "documents_pending",
      title: "Rental preferences saved",
      description:
        "Your rental requirements have been submitted. Upload your KYC documents next to proceed with the agreement.",
      actionLabel: "Upload Documents",
      actionHref: uploadHref,
    },
    documents_requested: {
      kind: "documents_pending",
      title: "Documents requested",
      description:
        "Your property owner or broker has requested documents. Upload them securely using your personal link.",
      actionLabel: "Upload Documents",
      actionHref: uploadHref,
    },
    documents_in_progress: {
      kind: "documents_pending",
      title: "Documents in progress",
      description:
        "You have started uploading documents. Complete and submit all required files to continue.",
      actionLabel: "Continue Document Collection",
      actionHref: uploadHref,
    },
    documents_submitted: {
      kind: "documents_under_review",
      title: "Documents Submitted",
      description:
        "Your documents have been submitted successfully. They are now being reviewed before agreement generation begins.",
      actionLabel: "View Documents",
      actionHref: "/tenant/documents",
    },
    documents_under_review: {
      kind: "documents_under_review",
      title: "Documents Under Review",
      description:
        "Your documents have been submitted successfully and are currently being reviewed. You will be notified once your agreement is ready.",
      actionLabel: "View Documents",
      actionHref: "/tenant/documents",
    },
    additional_documents_required: {
      kind: "documents_pending",
      title: "Additional documents required",
      description:
        "Some documents need to be updated or re-uploaded before your agreement can proceed. Please review the requested changes.",
      actionLabel: "Update Documents",
      actionHref: uploadHref ?? "/tenant/documents",
    },
    agreement_being_prepared: {
      kind: "agreement_being_prepared",
      title: "Agreement Being Prepared",
      description:
        "Your documents have been received. The property owner or broker is preparing your rental agreement.",
    },
    agreement_ready: {
      kind: "agreement_ready",
      title: "Approve Agreement",
      description:
        "Your approval is required on the final lease agreement to secure your move-in date.",
      actionLabel: "Review and Approve Agreement",
      actionHref: workspace?.agreementId
        ? `/tenant/agreement?agreementId=${encodeURIComponent(workspace.agreementId)}`
        : "/tenant/agreement",
    },
    esign_document_upload: {
      kind: "esign_document_upload",
      title: "Upload Signed Agreement",
      description:
        "Download your agreement, sign it offline, and upload your signed rental agreement so your owner can finalise your move-in.",
      actionLabel: "Upload Signed Agreement",
      actionHref: "/tenant/agreement/upload-signed",
    },
    awaiting_esign_signatures: {
      kind: "awaiting_esign_signatures",
      title: "Waiting for signatures",
      description: "You'll be notified once everyone signs.",
    },
    agreement_signed: {
      kind: "agreement_signed",
      title: "Agreement signed",
      description:
        "Your rental agreement has been signed. Rent payment and move-in details will appear here shortly.",
    },
    rent_payment_due: resolvePostSigningRentNotification(workspace),
    move_in_scheduled: {
      kind: "move_in_scheduled",
      title: "Move-in scheduled",
      description:
        workspace?.agreementSnapshot?.leaseStartDate
          ? `Your move-in is scheduled for ${workspace.agreementSnapshot.leaseStartDate}. Property access details will appear here soon.`
          : "Your move-in date has been scheduled. Check your dashboard for property access details.",
    },
    maintenance_update: {
      kind: "maintenance_open",
      title: "Maintenance update",
      description:
        "There is an update on your maintenance request. Open Maintenance to view details.",
      actionLabel: "View Maintenance",
      actionHref: "/tenant/maintenance",
    },
    lease_renewal: {
      kind: "agreement_being_prepared",
      title: "Lease renewal",
      description:
        "Your lease renewal is in progress. You will be notified when the updated agreement is ready.",
    },
    active_tenant: {
      kind: "agreement_signed",
      title: "Active tenant",
      description:
        "You are an active tenant on TrustKeyper. Use your dashboard to manage documents, payments, and maintenance.",
    },
  };

  return (
    byStage[stage] ?? {
      kind: "documents_pending",
      title: "Continue your rental journey",
      description: "Check back soon for updates on your rental application.",
    }
  );
}

function resolveWorkflowError(
  workspace: TenantWorkspaceRecord | null,
  stage: TenantWorkflowStage,
): TenantWorkflowError | undefined {
  if (!workspace) return undefined;
  if (stage === "property_removed") {
    return {
      code: "missing_property",
      message: "The property linked to your invitation could not be found.",
    };
  }
  if (stage === "relationship_error") {
    return {
      code: "invalid_relationship",
      message: workspace.relationshipError ?? "Your tenant relationship could not be verified.",
    };
  }
  if (!workspace.ownerName && workspace.propertyId && stageRank(stage) >= stageRank("documents_under_review")) {
    return {
      code: "missing_owner",
      message: "Owner details are not available for this property yet.",
    };
  }
  return undefined;
}

export function resolveTenantWorkflowState(
  workspace: TenantWorkspaceRecord | null,
): TenantWorkflowSnapshot {
  const stage = resolveStage(workspace);
  const progressSteps = buildProgressStepsFromStage(stage);
  const notification = buildNotification(stage, workspace);
  const showBroker = shouldShowBrokerForStage(stage, workspace);
  const error = resolveWorkflowError(workspace, stage);
  const signatureStatus =
    stage === "awaiting_esign_signatures"
      ? resolveTenantAwaitingSignaturesStatus(workspace)
      : undefined;

  return {
    stage,
    progressSteps,
    notification,
    showBroker,
    signatureStatus,
    error,
  };
}

export function broadcastTenantWorkflowUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TENANT_WORKFLOW_UPDATED_EVENT));
}
