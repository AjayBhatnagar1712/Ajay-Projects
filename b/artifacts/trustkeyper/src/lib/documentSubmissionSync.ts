import type { RequesterDocumentUploadInviteView } from "@workspace/tenant-document-upload";
import { applyReceivedInviteToAgreementDocs } from "@/components/agreement/TenantSubmittedDocumentsModal";
import {
  areAgreementDocumentsComplete,
  reconcileAgreementDocumentPersons,
} from "./agreementDocumentPersons";
import {
  loadAgreementWorkflowDraft,
  saveAgreementWorkflowDraft,
  type AgreementPersonDraftState,
  type AgreementWorkflowDraft,
} from "./agreementWorkflowDraft";
import {
  createDocumentSubmissionNotification,
  isInviteFullySubmitted,
  type DocumentSubmissionNotification,
} from "./documentSubmissionNotifications";
import { getProperties } from "./properties";

export const DOCUMENT_SUBMISSION_SYNC_EVENT = "tk-document-submission-sync";

function phoneLast10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function broadcastSync(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DOCUMENT_SUBMISSION_SYNC_EVENT));
}

function ensureTenantInParties(
  tenants: Array<{ name: string; contact: string }>,
  tenant: { name: string; contact: string },
): Array<{ name: string; contact: string }> {
  const digits = phoneLast10(tenant.contact);
  const exists = tenants.some((row) => phoneLast10(row.contact) === digits);
  if (exists) return tenants;
  return [...tenants, tenant];
}

function applyInviteToPersonDocs(
  person: AgreementPersonDraftState,
  invite: RequesterDocumentUploadInviteView,
): AgreementPersonDraftState {
  const matchesToken = person.documentUploadToken === invite.token;
  const matchesPhone = phoneLast10(person.contact) === phoneLast10(invite.tenantPhone);
  if (!matchesToken && !matchesPhone) return person;

  return {
    ...person,
    name: invite.tenantName,
    contact: invite.tenantPhone,
    documentUploadToken: invite.token,
    docs: applyReceivedInviteToAgreementDocs(person.docs, invite),
  };
}

function buildPartiesFromDraft(draft: AgreementWorkflowDraft): {
  allParties: Array<{ name: string; contact: string }>;
  ownerCount: number;
} {
  const ownerCount = (draft.primaryOwnerSelected ? 1 : 0) + draft.additionalOwners.length;
  const allParties = [
    ...(draft.primaryOwnerSelected
      ? [{ name: draft.ownerName, contact: draft.ownerContact }]
      : []),
    ...draft.additionalOwners,
    ...draft.selectedTenants,
  ];
  return { allParties, ownerCount };
}

function syncExistingDraftWithInvite(
  draft: AgreementWorkflowDraft,
  invite: RequesterDocumentUploadInviteView,
): AgreementWorkflowDraft {
  const tenantParty = { name: invite.tenantName, contact: invite.tenantPhone };
  const selectedTenants = ensureTenantInParties(draft.selectedTenants, tenantParty);
  const { allParties, ownerCount } = buildPartiesFromDraft({
    ...draft,
    selectedTenants,
  });

  let documentPersons = reconcileAgreementDocumentPersons(
    draft.documentPersons,
    allParties,
    ownerCount,
  ).map((person) => applyInviteToPersonDocs(person, invite));

  const documentsComplete = areAgreementDocumentsComplete(documentPersons);
  const propertyStillExists = invite.propertyId
    ? getProperties().some((property) => property.id === invite.propertyId)
    : true;

  return {
    ...draft,
    selectedPropertyId:
      propertyStillExists && invite.propertyId
        ? invite.propertyId
        : draft.selectedPropertyId,
    selectedTenants,
    documentPersons,
    documentsComplete,
    step: Math.max(draft.step, 3),
    savedAt: Date.now(),
  };
}

function seedDraftFromInvite(invite: RequesterDocumentUploadInviteView): AgreementWorkflowDraft {
  const tenantParty = { name: invite.tenantName, contact: invite.tenantPhone };
  const property = invite.propertyId
    ? getProperties().find((row) => row.id === invite.propertyId) ?? null
    : null;

  const documentPersons: AgreementPersonDraftState[] = [
    {
      name: invite.tenantName,
      contact: invite.tenantPhone,
      personLabel: "TENANT 1",
      documentUploadToken: invite.token,
      docs: applyReceivedInviteToAgreementDocs(
        [
          { id: "aadhaar", label: "Aadhaar Card", status: "pending" },
          { id: "pan", label: "PAN Card", status: "pending" },
          { id: "bank", label: "Bank Account Details", status: "pending" },
        ],
        invite,
      ),
    },
  ];

  return {
    v: 1,
    step: 3,
    selectedPropertyId: property?.id ?? invite.propertyId ?? null,
    ownerName: property?.ownerName ?? "",
    ownerContact: property?.ownerContact ?? "",
    primaryOwnerSelected: true,
    additionalOwners: [],
    selectedTenants: [tenantParty],
    documentsComplete: areAgreementDocumentsComplete(documentPersons),
    documentPersons,
    documentStepPersonIdx: 0,
    startDate: "",
    monthlyRent: "",
    securityDeposit: "",
    lockInPeriod: "",
    noticePeriod: "",
    rentDueDay: "",
    maintenanceCharges: "",
    maintenanceIncluded: false,
    brokerageAmount: "",
    brokerageAmountOwner: "",
    brokerageAmountTenant: "",
    brokeragePaidBy: "Tenant",
    brokerageMode: "Bank Transfer",
    editingAgreementId: null,
    savedAt: Date.now(),
  };
}

export function syncAgreementWorkflowWithSubmittedInvite(
  invite: RequesterDocumentUploadInviteView,
): boolean {
  if (!isInviteFullySubmitted(invite)) return false;

  const existing = loadAgreementWorkflowDraft();
  const next = existing && !existing.sentCompleted
    ? syncExistingDraftWithInvite(existing, invite)
    : seedDraftFromInvite(invite);

  saveAgreementWorkflowDraft(next);
  broadcastSync();
  return true;
}

export function processIncomingDocumentSubmissions(
  invites: RequesterDocumentUploadInviteView[],
  requesterRole: "owner" | "broker",
): DocumentSubmissionNotification[] {
  const created: DocumentSubmissionNotification[] = [];

  for (const invite of invites) {
    if (!isInviteFullySubmitted(invite)) continue;
    syncAgreementWorkflowWithSubmittedInvite(invite);
    const notification = createDocumentSubmissionNotification({ invite, requesterRole });
    if (notification) created.push(notification);
  }

  if (created.length > 0) {
    broadcastSync();
  }

  return created;
}
