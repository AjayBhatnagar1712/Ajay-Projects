import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequesterDocumentUploadInviteView } from "@workspace/tenant-document-upload";
import { AGREEMENT_DRAFT_KEY } from "./agreementWorkflowDraft";
import { processIncomingDocumentSubmissions } from "./documentSubmissionSync";

const storage = new Map<string, string>();

vi.mock("./storageKeys", () => ({
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
}));

vi.mock("./cloudSync", () => ({
  queueCloudSync: vi.fn(),
}));

vi.mock("./brokerPendingFlows", () => ({
  broadcastBrokerPendingFlowsUpdated: vi.fn(),
}));

vi.mock("./properties", () => ({
  getProperties: () => [
    {
      id: "prop_1",
      ownerName: "Anita Owner",
      ownerContact: "+91 9000000001",
      address: "12 MG Road",
      area: "Koramangala",
      city: "Bengaluru",
      pincode: "560034",
      country: "India",
      propertyType: "Apartment",
      unitSize: "2 BHK",
      furnishing: "Semi",
      builtUpArea: "1000",
      builtUpUnits: "sqft",
      totalFloors: "10",
      bedrooms: "2",
      bathrooms: "2",
      balconies: "1",
      floorLevel: "5",
      mainDoorDirection: "East",
      amenities: [],
      tenantsPreferred: [],
      monthlyRent: "25000",
      rentNegotiable: false,
      maintenanceIncluded: false,
      monthlyMaintenance: "2000",
      securityDeposit: "50000",
      availableFrom: "2026-01-01",
      images: [],
      imageCount: 0,
      status: "Active",
      createdAt: Date.now(),
    },
  ],
}));

function submittedInvite(): RequesterDocumentUploadInviteView {
  return {
    token: "tok_sync",
    tenantName: "Ravi Kumar",
    tenantPhone: "+91 9876543210",
    status: "submitted",
    tenantDocumentStatus: "documents_submitted",
    submittedAt: 1_700_000_000_000,
    requestedDocumentIds: ["aadhaar", "pan", "bank"],
    documentStatuses: { aadhaar: "uploaded", pan: "uploaded", bank: "uploaded" },
    documents: {
      aadhaar: { fileName: "aadhaar.pdf", fileSize: 1200, mimeType: "application/pdf" },
      pan: { fileName: "pan.pdf", fileSize: 900, mimeType: "application/pdf" },
    },
    bankDetails: {
      mode: "bank",
      accountHolderName: "Ravi Kumar",
      accountNumber: "1234567890",
      ifsc: "HDFC0001234",
      bankName: "HDFC Bank",
    },
    expiresAt: Date.now() + 86_400_000,
    propertyId: "prop_1",
    propertyLabel: "Green Heights",
  };
}

describe("documentSubmissionSync", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
    });
  });

  it("seeds agreement draft and notification on full submission", () => {
    const created = processIncomingDocumentSubmissions([submittedInvite()], "owner");
    expect(created).toHaveLength(1);

    const draftRaw = storage.get(AGREEMENT_DRAFT_KEY);
    expect(draftRaw).toBeTruthy();
    const draft = JSON.parse(draftRaw ?? "{}") as {
      step: number;
      selectedPropertyId: string;
      documentPersons: Array<{ docs: Array<{ status: string }> }>;
    };
    expect(draft.step).toBe(3);
    expect(draft.selectedPropertyId).toBe("prop_1");
    expect(draft.documentPersons[0]?.docs.every((doc) => doc.status === "uploaded")).toBe(true);
  });

  it("ignores partial uploads", () => {
    const partial = submittedInvite();
    partial.tenantDocumentStatus = "documents_in_progress";
    const created = processIncomingDocumentSubmissions([partial], "broker");
    expect(created).toHaveLength(0);
    expect(storage.get(AGREEMENT_DRAFT_KEY)).toBeUndefined();
  });
});
