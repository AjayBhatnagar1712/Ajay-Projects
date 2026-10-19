import { describe, expect, it } from "vitest";
import { applyReceivedInviteToAgreementDocs } from "./TenantSubmittedDocumentsModal";
import type { DocumentUploadInviteForUi } from "@/lib/agreementDocumentUploadSanitize";

describe("applyReceivedInviteToAgreementDocs", () => {
  const baseDocs = [
    { id: "aadhaar" as const, label: "Aadhaar Card", status: "pending" as const },
    { id: "pan" as const, label: "PAN Card", status: "pending" as const },
    { id: "bank" as const, label: "Bank Account Details", status: "pending" as const },
  ];

  it("marks file docs uploaded when status is uploaded even without file metadata", () => {
    const invite: DocumentUploadInviteForUi = {
      token: "adu_test",
      tenantName: "Sumit",
      tenantPhone: "+919811112222",
      status: "submitted",
      tenantDocumentStatus: "documents_submitted",
      requestedDocumentIds: ["aadhaar", "pan", "bank"],
      documentStatuses: { aadhaar: "uploaded", pan: "uploaded", bank: "uploaded" },
      documents: {},
      bankDetails: { mode: "upi", upiId: "sumit@upi" },
      expiresAt: Date.now() + 1000,
      submittedAt: Date.now(),
    };

    const next = applyReceivedInviteToAgreementDocs(baseDocs, invite);

    expect(next[0]?.status).toBe("uploaded");
    expect(next[0]?.fileName).toBe("Uploaded");
    expect(next[1]?.status).toBe("uploaded");
    expect(next[2]?.fileName).toBe("UPI Details");
  });
});
