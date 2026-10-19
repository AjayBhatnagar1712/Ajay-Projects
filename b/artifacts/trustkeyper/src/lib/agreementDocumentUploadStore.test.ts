import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequesterDocumentUploadInviteView } from "@workspace/tenant-document-upload";
import { addProperty, getProperties } from "./properties";
import { upsertStoredDocumentUploadInvite } from "./agreementDocumentUploadStore";
import { resolveExistingDocumentUploadInvite } from "./agreementDocumentUpload";
import { sanitizeDocumentUploadInviteForLocalStorage } from "./agreementDocumentUploadSanitize";

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

function sampleInvite(dataUrl: string): RequesterDocumentUploadInviteView {
  return {
    token: "adu_test",
    tenantName: "Rajesh Kumar",
    tenantPhone: "+919123456789",
    status: "submitted",
    tenantDocumentStatus: "documents_submitted",
    requestedDocumentIds: ["aadhaar", "pan", "bank"],
    documentStatuses: { aadhaar: "uploaded", pan: "uploaded", bank: "uploaded" },
    documents: {
      aadhaar: {
        fileName: "aadhaar.pdf",
        fileSize: 1200,
        mimeType: "application/pdf",
        dataUrl,
        uploadedAt: 1,
      },
    },
    bankDetails: {
      mode: "bank",
      holderName: "Rajesh Kumar",
      bankName: "HDFC Bank",
      accountNumber: "1234567890",
      ifscCode: "HDFC0001234",
    },
    expiresAt: Date.now() + 1000,
  };
}

describe("sanitizeDocumentUploadInviteForLocalStorage", () => {
  it("removes base64 file payloads from local cache entries", () => {
    const huge = `data:application/pdf;base64,${"A".repeat(500_000)}`;
    const sanitized = sanitizeDocumentUploadInviteForLocalStorage(sampleInvite(huge));

    expect(sanitized.documents.aadhaar?.fileName).toBe("aadhaar.pdf");
    expect("dataUrl" in (sanitized.documents.aadhaar ?? {})).toBe(false);
    expect(JSON.stringify(sanitized).length).toBeLessThan(10_000);
    expect(sanitized.bankDetails?.accountNumber).toBe("1234567890");
  });
});

describe("upsertStoredDocumentUploadInvite", () => {
  let localStore: Storage;
  let sessionStore: Storage;

  beforeEach(() => {
    localStore = createMemoryStorage();
    sessionStore = createMemoryStorage();
    vi.stubGlobal("localStorage", localStore);
    vi.stubGlobal("sessionStorage", sessionStore);
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    sessionStore.setItem("tk_active_phone", "9876543210");
    sessionStore.setItem("tk_active_role", "broker");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores metadata only so broker property saves still succeed", () => {
    const huge = `data:application/pdf;base64,${"A".repeat(500_000)}`;
    upsertStoredDocumentUploadInvite(sampleInvite(huge));

    const property = addProperty({
      address: "12 MG Road",
      area: "Indiranagar",
      city: "Bengaluru",
      pincode: "560038",
      country: "India",
      ownerName: "Owner Name",
      ownerContact: "+919876543210",
      propertyType: "Apartment",
      unitSize: "2 BHK",
      furnishing: "Semi Furnished",
      builtUpArea: "1200",
      builtUpUnits: "sq ft",
      totalFloors: "10",
      bedrooms: "2",
      bathrooms: "2",
      balconies: "1",
      floorLevel: "5th",
      mainDoorDirection: "East",
      amenities: [],
      tenantsPreferred: ["Family"],
      monthlyRent: "25000",
      rentNegotiable: false,
      maintenanceIncluded: true,
      monthlyMaintenance: "2000",
      securityDeposit: "50000",
      availableFrom: "2026-07-01",
      images: [],
      imageCount: 0,
      uploadedBy: "broker",
    });

    expect(property.id).toMatch(/^prop_/);
    expect(getProperties()).toHaveLength(1);
    expect(getProperties()[0]?.id).toBe(property.id);
  });

  it("reuses an existing invite for resend actions", () => {
    upsertStoredDocumentUploadInvite(sampleInvite("data:application/pdf;base64,abc"));

    const existing = resolveExistingDocumentUploadInvite({
      tenantPhone: "+919123456789",
    });

    expect(existing?.token).toBe("adu_test");
    expect(existing?.inviteLink).toContain("/upload/documents/adu_test");
  });
});
