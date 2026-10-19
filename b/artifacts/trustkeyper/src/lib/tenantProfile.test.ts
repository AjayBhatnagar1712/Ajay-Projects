import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatTenantKycStatusLabel,
  mapUploadStatusToVerification,
  maskAccountNumber,
  mergeTenantProfileFromDocumentUpload,
  mergeTenantProfileFromInvitePayload,
  resolveOverallKycStatus,
  saveTenantRentalPreferences,
  tenantProfileCompletionPercent,
  getTenantAccountProfileForPhone,
  type TenantAccountProfile,
} from "./tenantProfile";

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

describe("tenantProfile", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    sessionStorage.setItem("tk_active_phone", "9123456789");
    sessionStorage.setItem("tk_active_role", "tenant");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("masks account numbers showing last four digits", () => {
    expect(maskAccountNumber("1234567890")).toBe("****7890");
  });

  it("maps upload statuses to verification states", () => {
    expect(mapUploadStatusToVerification("uploaded", "documents_submitted")).toBe("under_review");
    expect(mapUploadStatusToVerification("reupload_required")).toBe("requires_reupload");
    expect(mapUploadStatusToVerification("not_uploaded")).toBe("pending_upload");
  });

  it("formats verification labels for profile cards", () => {
    expect(formatTenantKycStatusLabel("requires_reupload")).toBe("Requires Re-upload");
    expect(formatTenantKycStatusLabel("under_review")).toBe("Under Review");
  });

  it("calculates profile completion from populated sections", () => {
    const profile: TenantAccountProfile = {
      name: "Meena",
      phone: "9876543210",
      email: "",
      createdAt: Date.now(),
      bankVerificationStatus: "under_review",
      overallKycStatus: "under_review",
      aadhaar: {
        fileName: "aadhaar.pdf",
        verificationStatus: "under_review",
      },
      pan: {
        fileName: "pan.pdf",
        verificationStatus: "under_review",
      },
      bankDetails: {
        mode: "bank",
        holderName: "Meena",
        bankName: "HDFC",
        accountNumber: "1234567890",
        ifscCode: "HDFC0001234",
      },
    };
    expect(tenantProfileCompletionPercent(profile)).toBe(100);
    expect(resolveOverallKycStatus(profile)).toBe("under_review");
  });

  it("merges uploaded KYC metadata into profile shape", () => {
    const merged = mergeTenantProfileFromDocumentUpload({
      token: "adu_test",
      tenantName: "Rajesh",
      tenantPhone: "+919123456789",
      propertyId: "prop_1",
      propertyLabel: "Unit 1806",
      documentStatuses: { aadhaar: "uploaded", pan: "uploaded", bank: "uploaded" },
      documents: {
        aadhaar: {
          fileName: "aadhaar.pdf",
          fileSize: 1200,
          mimeType: "application/pdf",
          dataUrl: "data:application/pdf;base64,abc",
        },
        pan: {
          fileName: "pan.pdf",
          fileSize: 900,
          mimeType: "application/pdf",
        },
      },
      bankDetails: {
        mode: "bank",
        holderName: "Rajesh Kumar",
        bankName: "HDFC Bank",
        accountNumber: "1234567890",
        ifscCode: "HDFC0001234",
      },
      tenantDocumentStatus: "documents_submitted",
      submitted: true,
    });

    expect(merged.aadhaar?.fileName).toBe("aadhaar.pdf");
    expect(merged.aadhaar?.previewAvailable).toBe(true);
    expect(merged.pan?.fileName).toBe("pan.pdf");
    expect(merged.bankDetails?.holderName).toBe("Rajesh Kumar");
    expect(merged.documentUploadToken).toBe("adu_test");
    expect(merged.propertyId).toBe("prop_1");
    expect(merged.overallKycStatus).toBe("under_review");
  });

  it("preserves cached preview data when server invite reload omits dataUrl", () => {
    mergeTenantProfileFromDocumentUpload({
      token: "adu_test",
      tenantPhone: "+919123456789",
      documentStatuses: { aadhaar: "uploaded" },
      documents: {
        aadhaar: {
          fileName: "aadhaar.pdf",
          fileSize: 1200,
          mimeType: "application/pdf",
          dataUrl: "data:application/pdf;base64,abc",
        },
      },
    });

    const merged = mergeTenantProfileFromInvitePayload({
      token: "adu_test",
      tenantName: "Rajesh",
      tenantPhone: "+919123456789",
      requesterName: "Owner",
      requesterRole: "owner",
      requestedDocumentIds: ["aadhaar", "pan", "bank"],
      status: "in_progress",
      tenantDocumentStatus: "documents_in_progress",
      documentStatuses: { aadhaar: "uploaded", pan: "not_uploaded", bank: "not_uploaded" },
      documents: {
        aadhaar: {
          fileName: "aadhaar.pdf",
          fileSize: 1200,
          mimeType: "application/pdf",
          uploadedAt: 1,
        },
      },
      expiresAt: Date.now() + 1000,
      hasTenantAccount: true,
    });

    expect(merged.aadhaar?.dataUrl).toBe("data:application/pdf;base64,abc");
    expect(merged.aadhaar?.previewAvailable).toBe(true);
  });

  it("persists rental preferences in cloud-synced profile payload", () => {
    saveTenantRentalPreferences(
      "9123456789",
      {
        foodPreference: "Veg",
        sharingPreference: "Single",
        moveInTimeline: "Within 1 month",
      },
      { propertyId: "prop_2", propertyLabel: "Prestige Unit" },
    );

    const raw = localStorage.getItem("tk_9123456789_tenant_profile");
    expect(raw).toContain("foodPreference");
    expect(raw).toContain("prop_2");
    expect(localStorage.getItem("tk_9123456789_tenant_rental_prefs")).toBeNull();
  });

  it("saves tenant profile by phone without an active session", () => {
    sessionStorage.clear();
    mergeTenantProfileFromDocumentUpload({
      token: "adu_test",
      tenantName: "Rajesh",
      tenantPhone: "+919876543210",
      documentStatuses: { aadhaar: "uploaded" },
      documents: {
        aadhaar: {
          fileName: "aadhaar.pdf",
          fileSize: 1200,
          mimeType: "application/pdf",
        },
      },
    });

    const stored = getTenantAccountProfileForPhone("9876543210");
    expect(stored.name).toBe("Rajesh");
    expect(localStorage.getItem("tk_9876543210_tenant_profile")).toContain("Rajesh");
  });
});
