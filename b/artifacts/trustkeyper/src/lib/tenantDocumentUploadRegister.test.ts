import { describe, expect, it } from "vitest";
import {
  getRequesterDocumentUploadInvite,
  listRequesterDocumentUploadInvites,
  registerDocumentUploadInvite,
  submitDocumentUpload,
  type DocumentUploadStore,
} from "@workspace/tenant-document-upload";

type StoredEntry = {
  phone: string;
  role: string;
  dataKey: string;
  value: string;
};

function createMemoryStore(): { store: DocumentUploadStore; entries: StoredEntry[] } {
  const entries: StoredEntry[] = [];
  const store: DocumentUploadStore = {
    async findEntryByDataKey(dataKey: string) {
      const row = entries.find((entry) => entry.dataKey === dataKey);
      return row ? { phone: row.phone, role: row.role, value: row.value } : null;
    },
    async getAccountData(phone: string, role: string) {
      const data: Record<string, string> = {};
      for (const entry of entries) {
        if (entry.phone === phone && entry.role === role) {
          data[entry.dataKey] = entry.value;
        }
      }
      return data;
    },
    async setAccountDataKey(phone: string, role: string, dataKey: string, value: string) {
      const idx = entries.findIndex(
        (entry) => entry.phone === phone && entry.role === role && entry.dataKey === dataKey,
      );
      if (idx === -1) {
        entries.push({ phone, role, dataKey, value });
        return;
      }
      entries[idx] = { phone, role, dataKey, value };
    },
  };
  return { store, entries };
}

describe("registerDocumentUploadInvite", () => {
  it("creates a token snapshot for public document upload lookup", async () => {
    const { store, entries } = createMemoryStore();

    const result = await registerDocumentUploadInvite(store, {
      requesterPhone: "9876543210",
      requesterRole: "broker",
      requesterName: "Demo Broker",
      tenantName: "Rajesh Kumar",
      tenantPhone: "9123456789",
      propertyLabel: "Prestige Unit 1806",
      origin: "https://staging.app.trustkeyper.com",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.invite.inviteLink).toContain("/upload/documents/");
    const tokenRow = entries.find((entry) => entry.dataKey.startsWith("agreement_doc_upload_"));
    expect(tokenRow).toBeDefined();
  });

  it("rejects duplicate active invites for the same tenant phone", async () => {
    const { store } = createMemoryStore();

    const first = await registerDocumentUploadInvite(store, {
      requesterPhone: "9876543210",
      requesterRole: "owner",
      requesterName: "Owner",
      tenantName: "Rajesh Kumar",
      tenantPhone: "9123456789",
      origin: "https://staging.app.trustkeyper.com",
    });
    expect(first.ok).toBe(true);

    const second = await registerDocumentUploadInvite(store, {
      requesterPhone: "9876543210",
      requesterRole: "owner",
      requesterName: "Owner",
      tenantName: "Rajesh Kumar",
      tenantPhone: "+919123456789",
      origin: "https://staging.app.trustkeyper.com",
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toBe("duplicate_invite");
  });

  it("lets the requester retrieve submitted tenant documents", async () => {
    const { store } = createMemoryStore();

    const created = await registerDocumentUploadInvite(store, {
      requesterPhone: "9876543210",
      requesterRole: "broker",
      requesterName: "Demo Broker",
      tenantName: "Rajesh Kumar",
      tenantPhone: "9123456789",
      origin: "https://staging.app.trustkeyper.com",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const token = created.invite.token;
    const submitted = await submitDocumentUpload(store, token, {
      documents: {
        aadhaar: {
          fileName: "aadhaar.pdf",
          fileSize: 1200,
          mimeType: "application/pdf",
          dataUrl: "data:application/pdf;base64,QUJD",
        },
        pan: {
          fileName: "pan.pdf",
          fileSize: 900,
          mimeType: "application/pdf",
          dataUrl: "data:application/pdf;base64,UEFO",
        },
      },
      bankDetails: {
        mode: "bank",
        holderName: "Rajesh Kumar",
        bankName: "HDFC Bank",
        accountNumber: "1234567890",
        ifscCode: "HDFC0001234",
      },
    });
    expect(submitted.ok).toBe(true);

    const list = await listRequesterDocumentUploadInvites(store, "9876543210", "broker");
    expect(list).toHaveLength(1);
    expect(list[0]?.status).toBe("submitted");
    expect(list[0]?.documents.aadhaar?.fileName).toBe("aadhaar.pdf");

    const detail = await getRequesterDocumentUploadInvite(store, "9876543210", "broker", token);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.invite.bankDetails?.accountNumber).toBe("1234567890");
  });

  it("archives prior file versions when tenant replaces a submitted document", async () => {
    const { store } = createMemoryStore();

    const created = await registerDocumentUploadInvite(store, {
      requesterPhone: "9876543210",
      requesterRole: "broker",
      requesterName: "Demo Broker",
      tenantName: "Rajesh Kumar",
      tenantPhone: "9123456789",
      origin: "https://staging.app.trustkeyper.com",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const token = created.invite.token;
    const firstUpload = await submitDocumentUpload(store, token, {
      draft: false,
      documents: {
        aadhaar: {
          fileName: "aadhaar-v1.pdf",
          fileSize: 1200,
          mimeType: "application/pdf",
          dataUrl: "data:application/pdf;base64,QUJD",
        },
        pan: {
          fileName: "pan.pdf",
          fileSize: 900,
          mimeType: "application/pdf",
          dataUrl: "data:application/pdf;base64,UEFO",
        },
      },
      bankDetails: {
        mode: "bank",
        holderName: "Rajesh Kumar",
        bankName: "HDFC Bank",
        accountNumber: "1234567890",
        ifscCode: "HDFC0001234",
      },
    });
    expect(firstUpload.ok).toBe(true);

    const replaced = await submitDocumentUpload(store, token, {
      draft: true,
      documents: {
        aadhaar: {
          fileName: "aadhaar-v2.pdf",
          fileSize: 1300,
          mimeType: "application/pdf",
          dataUrl: "data:application/pdf;base64,RENEW",
        },
      },
    });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) return;

    expect(replaced.snapshot.documents.aadhaar?.fileName).toBe("aadhaar-v2.pdf");
    expect(replaced.snapshot.status).toBe("submitted");
    expect(replaced.snapshot.documentHistory?.aadhaar?.versions).toHaveLength(1);
    expect(replaced.snapshot.documentHistory?.aadhaar?.versions[0]?.fileName).toBe("aadhaar-v1.pdf");
  });
});
