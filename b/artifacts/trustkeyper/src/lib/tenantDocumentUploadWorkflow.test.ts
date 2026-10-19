import { describe, expect, it } from "vitest";
import { submitDocumentUpload } from "@workspace/tenant-document-upload";
import type { DocumentUploadStore, DocumentUploadTokenSnapshot } from "@workspace/tenant-document-upload";

function createMemoryStore(initial: Record<string, string> = {}): DocumentUploadStore {
  const rows = new Map<string, { phone: string; role: string; value: string }>();

  for (const [key, value] of Object.entries(initial)) {
    const [phone, role, ...rest] = key.split(":");
    const dataKey = rest.join(":");
    if (!phone || !role || !dataKey) continue;
    rows.set(dataKey, { phone, role, value });
  }

  return {
    findEntryByDataKey: async (dataKey) => rows.get(dataKey) ?? null,
    getAccountData: async (phone, role) => {
      const out: Record<string, string> = {};
      for (const [dataKey, row] of rows.entries()) {
        if (row.phone === phone && row.role === role) out[dataKey] = row.value;
      }
      return out;
    },
    setAccountDataKey: async (phone, role, dataKey, value) => {
      rows.set(dataKey, { phone, role, value });
    },
  };
}

function seedInviteSnapshot(): DocumentUploadTokenSnapshot {
  const now = Date.now();
  return {
    token: "adu_test_token",
    tenantName: "Meena",
    tenantPhone: "+919876543210",
    requesterPhone: "9876543211",
    requesterRole: "broker",
    requesterName: "Demo Broker",
    propertyLabel: "Prestige Unit 1806",
    requestedDocumentIds: ["aadhaar", "pan", "bank"],
    status: "link_sent",
    tenantDocumentStatus: "document_request_sent",
    documents: {},
    documentStatuses: { aadhaar: "not_uploaded", pan: "not_uploaded", bank: "not_uploaded" },
    createdAt: now,
    expiresAt: now + 14 * 24 * 60 * 60 * 1000,
  };
}

describe("document upload invite submit workflow", () => {
  it("moves invite to documents_submitted when tenant finalizes upload", async () => {
    const snapshot = seedInviteSnapshot();
    const store = createMemoryStore({
      "9876543211:broker:agreement_doc_upload_adu_test_token": JSON.stringify(snapshot),
    });

    const result = await submitDocumentUpload(store, snapshot.token, {
      draft: false,
      bankDetails: { mode: "upi", upiId: "tenant@upi" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.status).toBe("submitted");
    expect(result.snapshot.tenantDocumentStatus).toBe("documents_submitted");
  });
});
