import { describe, expect, it } from "vitest";
import { buildTenantDocumentTableRows, countUploadedTenantDocuments } from "./tenantDocuments";
import type { DocumentUploadInvitePayload } from "./publicAgreementDocumentUpload";
import type { TenantAccountProfile } from "./tenantProfile";

const profile: TenantAccountProfile = {
  phone: "9876543210",
  name: "Meena",
  updatedAt: Date.now(),
};

const invite: DocumentUploadInvitePayload = {
  token: "tok_test",
  tenantPhone: "9876543210",
  tenantName: "Meena",
  requesterName: "Anita",
  requesterRole: "owner",
  propertyLabel: "Flat 401",
  requestedDocumentIds: ["aadhaar", "pan", "bank"],
  documentStatuses: {
    aadhaar: "uploaded",
    pan: "not_uploaded",
    bank: "uploaded",
  },
  documents: {
    aadhaar: {
      fileName: "aadhaar.pdf",
      fileSize: 1200,
      mimeType: "application/pdf",
      uploadedAt: Date.parse("2026-03-01T10:00:00Z"),
    },
  },
  bankDetails: {
    mode: "account",
    holderName: "Meena",
    bankName: "HDFC Bank",
    accountNumber: "1234567890",
    ifscCode: "HDFC0001234",
  },
  tenantDocumentStatus: "documents_submitted",
  status: "submitted",
  submittedAt: Date.parse("2026-03-01T10:00:00Z"),
  expiresAt: Date.parse("2027-03-01T10:00:00Z"),
  hasTenantAccount: true,
};

describe("tenantDocuments", () => {
  it("builds document table rows from invite and profile", () => {
    const rows = buildTenantDocumentTableRows({ invite, profile, token: invite.token });
    expect(rows).toHaveLength(3);
    expect(rows[0]?.documentLabel).toBeTruthy();
    expect(rows[0]?.detailsLabel).toBe("aadhaar.pdf");
    expect(rows[0]?.canView).toBe(true);
    expect(rows[1]?.detailsLabel).toBe("Not uploaded");
    expect(rows[2]?.detailsLabel).toContain("HDFC Bank");
    expect(countUploadedTenantDocuments(rows)).toBe(2);
  });

  it("defaults requested documents when invite is missing", () => {
    const rows = buildTenantDocumentTableRows({ invite: null, profile });
    expect(rows.map((row) => row.id)).toEqual(["aadhaar", "pan", "bank"]);
  });
});
