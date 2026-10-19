import { broadcastBrokerPendingFlowsUpdated } from "./brokerPendingFlows";
import { queueCloudSync } from "./cloudSync";
import { getItem, setItem } from "./storageKeys";

export const AGREEMENT_DRAFT_KEY = "agreement_draft";

export type AgreementDocDraftStatus = "pending" | "uploaded" | "link_sent";

export interface AgreementDocDraftState {
  id: "aadhaar" | "pan" | "bank";
  label: string;
  status: AgreementDocDraftStatus;
  fileName?: string;
  fileSize?: number;
  uploadedAt?: number;
  dataUrl?: string;
}

export interface AgreementPersonDraftState {
  name: string;
  contact: string;
  personLabel: string;
  documentUploadToken?: string;
  docs: AgreementDocDraftState[];
}

export interface AgreementWorkflowDraft {
  v: 1;
  step: number;
  selectedPropertyId: string | null;
  ownerName: string;
  ownerContact: string;
  primaryOwnerSelected: boolean;
  additionalOwners: Array<{ name: string; contact: string }>;
  selectedTenants: Array<{ name: string; contact: string }>;
  documentsComplete: boolean;
  documentPersons: AgreementPersonDraftState[];
  documentStepPersonIdx: number;
  startDate: string;
  monthlyRent: string;
  securityDeposit: string;
  lockInPeriod: string;
  noticePeriod: string;
  rentDueDay: string;
  maintenanceCharges: string;
  maintenanceIncluded: boolean;
  brokerageAmount: string;
  brokerageAmountOwner: string;
  brokerageAmountTenant: string;
  brokeragePaidBy: "Owner" | "Tenant" | "Both";
  brokerageMode: "Bank Transfer" | "UPI";
  editingAgreementId: string | null;
  savedAt: number;
  sentCompleted?: boolean;
}

/** Strip large base64 payloads before writing to localStorage. */
export function sanitizeDocumentPersonsForDraft(
  persons: AgreementPersonDraftState[],
): AgreementPersonDraftState[] {
  return persons.map((person) => ({
    ...person,
    docs: person.docs.map((doc) => {
      if (!doc.dataUrl) return doc;
      const { dataUrl: _removed, ...rest } = doc;
      return rest;
    }),
  }));
}

export function saveAgreementWorkflowDraft(draft: AgreementWorkflowDraft): void {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({
      ...draft,
      documentPersons: sanitizeDocumentPersonsForDraft(draft.documentPersons),
    });
    setItem(AGREEMENT_DRAFT_KEY, payload);
    queueCloudSync(AGREEMENT_DRAFT_KEY, payload);
    broadcastBrokerPendingFlowsUpdated();
  } catch {
    /* Quota exceeded — never block the flow. */
  }
}

export function loadAgreementWorkflowDraft(): AgreementWorkflowDraft | null {
  if (typeof window === "undefined") return null;
  const raw = getItem(AGREEMENT_DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AgreementWorkflowDraft>;
    if (parsed.v !== 1) return null;
    if (typeof parsed.step !== "number" || parsed.step < 1 || parsed.step > 6) return null;
    return {
      v: 1,
      step: parsed.step,
      selectedPropertyId: parsed.selectedPropertyId ?? null,
      ownerName: parsed.ownerName ?? "",
      ownerContact: parsed.ownerContact ?? "",
      primaryOwnerSelected: parsed.primaryOwnerSelected ?? true,
      additionalOwners: parsed.additionalOwners ?? [],
      selectedTenants: parsed.selectedTenants ?? [],
      documentsComplete: parsed.documentsComplete ?? false,
      documentPersons: parsed.documentPersons ?? [],
      documentStepPersonIdx: parsed.documentStepPersonIdx ?? 0,
      startDate: parsed.startDate ?? "",
      monthlyRent: parsed.monthlyRent ?? "",
      securityDeposit: parsed.securityDeposit ?? "",
      lockInPeriod: parsed.lockInPeriod ?? "",
      noticePeriod: parsed.noticePeriod ?? "",
      rentDueDay: parsed.rentDueDay ?? "",
      maintenanceCharges: parsed.maintenanceCharges ?? "",
      maintenanceIncluded: parsed.maintenanceIncluded ?? false,
      brokerageAmount: parsed.brokerageAmount ?? "",
      brokerageAmountOwner: parsed.brokerageAmountOwner ?? "",
      brokerageAmountTenant: parsed.brokerageAmountTenant ?? "",
      brokeragePaidBy: parsed.brokeragePaidBy ?? "Tenant",
      brokerageMode: parsed.brokerageMode ?? "Bank Transfer",
      editingAgreementId: parsed.editingAgreementId ?? null,
      savedAt: parsed.savedAt ?? Date.now(),
      sentCompleted: parsed.sentCompleted,
    };
  } catch {
    return null;
  }
}
