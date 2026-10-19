import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadAgreementWorkflowDraft,
  sanitizeDocumentPersonsForDraft,
  saveAgreementWorkflowDraft,
  type AgreementPersonDraftState,
} from "./agreementWorkflowDraft";

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
  };
}

const samplePersons: AgreementPersonDraftState[] = [
  {
    name: "Rajesh",
    contact: "+919123456789",
    personLabel: "TENANT 1",
    documentUploadToken: "adu_test",
    docs: [
      {
        id: "aadhaar",
        label: "Aadhaar Card",
        status: "link_sent",
      },
      {
        id: "pan",
        label: "PAN Card",
        status: "uploaded",
        fileName: "pan.pdf",
        dataUrl: "data:application/pdf;base64,abc",
      },
      {
        id: "bank",
        label: "Bank Account Details",
        status: "pending",
      },
    ],
  },
];

describe("agreementWorkflowDraft", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    sessionStorage.setItem("tk_active_phone", "9876543210");
    sessionStorage.setItem("tk_active_role", "broker");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("strips dataUrl from document persons before persisting", () => {
    const sanitized = sanitizeDocumentPersonsForDraft(samplePersons);
    const pan = sanitized[0]?.docs[1];
    expect(pan?.fileName).toBe("pan.pdf");
    expect("dataUrl" in (pan ?? {})).toBe(false);
    expect(sanitized[0]?.documentUploadToken).toBe("adu_test");
    expect(sanitized[0]?.docs[0]?.status).toBe("link_sent");
  });

  it("saves and restores workflow step, persons, and person index", () => {
    saveAgreementWorkflowDraft({
      v: 1,
      step: 3,
      selectedPropertyId: "prop_1",
      ownerName: "Owner",
      ownerContact: "+919876543210",
      primaryOwnerSelected: true,
      additionalOwners: [],
      selectedTenants: [{ name: "Rajesh", contact: "+919123456789" }],
      documentsComplete: false,
      documentPersons: samplePersons,
      documentStepPersonIdx: 1,
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
    });

    const loaded = loadAgreementWorkflowDraft();
    expect(loaded?.step).toBe(3);
    expect(loaded?.documentStepPersonIdx).toBe(1);
    expect(loaded?.documentPersons[0]?.documentUploadToken).toBe("adu_test");
    expect(loaded?.documentPersons[0]?.docs[1]?.fileName).toBe("pan.pdf");
    expect("dataUrl" in (loaded?.documentPersons[0]?.docs[1] ?? {})).toBe(false);
  });
});
