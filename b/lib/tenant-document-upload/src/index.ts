import {
  AGREEMENT_DEFAULT_DOCUMENT_IDS,
  type ExtendedDocumentId,
  type UploadDocumentStatus,
  documentLabel,
  isFileDocumentId,
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
} from "./documentTypes.js";

export {
  AGREEMENT_DEFAULT_DOCUMENT_IDS,
  DOCUMENT_LABELS,
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  documentLabel,
  isFileDocumentId,
  type AgreementDocumentId,
  type ExtendedDocumentId,
  type UploadDocumentStatus,
} from "./documentTypes.js";
import {
  archiveDocumentFile,
  canTenantModifyDocuments,
  type DocumentHistoryMap,
  type DocumentVersionHistory,
  type StoredUploadFileVersion,
} from "./documentHistory.js";

export {
  archiveDocumentFile,
  canTenantModifyDocuments,
  type DocumentHistoryMap,
  type DocumentVersionHistory,
  type StoredUploadFileVersion,
} from "./documentHistory.js";

export type DocumentUploadRequesterRole = "owner" | "broker";

export type DocumentUploadInviteStatus =
  | "pending"
  | "link_sent"
  | "in_progress"
  | "submitted"
  | "expired";

export type TenantDocumentUploadStatus =
  | "document_request_sent"
  | "documents_in_progress"
  | "documents_submitted"
  | "agreement_ready";

export type StoredUploadFile = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  dataUrl: string;
  uploadedAt: number;
};

export type StoredBankDetails = {
  mode: "bank" | "upi";
  holderName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  upiQrFileName?: string;
};

export type DocumentUploadTokenSnapshot = {
  token: string;
  tenantName: string;
  tenantPhone: string;
  requesterPhone: string;
  requesterRole: DocumentUploadRequesterRole;
  requesterName: string;
  propertyId?: string;
  propertyLabel?: string;
  propertyImage?: string;
  propertyAddress?: string;
  monthlyRent?: string;
  securityDeposit?: string;
  agreementDraftId?: string;
  requestedDocumentIds: ExtendedDocumentId[];
  status: DocumentUploadInviteStatus;
  tenantDocumentStatus: TenantDocumentUploadStatus;
  documents: Partial<Record<ExtendedDocumentId, StoredUploadFile>>;
  documentStatuses: Partial<Record<ExtendedDocumentId, UploadDocumentStatus>>;
  bankDetails?: StoredBankDetails;
  documentHistory?: DocumentHistoryMap;
  createdAt: number;
  expiresAt: number;
  linkSentAt?: number;
  startedAt?: number;
  submittedAt?: number;
  lastDocumentUpdateAt?: number;
};

export type DocumentUploadStore = {
  findEntryByDataKey: (
    dataKey: string,
  ) => Promise<{ phone: string; role: string; value: string } | null>;
  getAccountData: (phone: string, role: string) => Promise<Record<string, string>>;
  setAccountDataKey: (phone: string, role: string, dataKey: string, value: string) => Promise<void>;
  accountHasProfile?: (phone: string, role: string) => Promise<boolean>;
};

export type DocumentUploadRequest = {
  method: string;
  query: Record<string, string | string[] | undefined>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
};

export type DocumentUploadResponse = {
  status: (code: number) => DocumentUploadResponse;
  setHeader: (name: string, value: string | string[]) => DocumentUploadResponse;
  end: (body: string) => void;
};

export const DOC_UPLOAD_TOKEN_PREFIX = "agreement_doc_upload_";
export const DOC_UPLOAD_INVITES_KEY = "agreement_document_upload_invites";
const DOC_UPLOAD_EXPIRY_DAYS = 14;

function json(res: DocumentUploadResponse, status: number, body: unknown): void {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function readJsonBody(req: DocumentUploadRequest): unknown {
  const body = req.body;
  if (body === undefined || body === null) return null;
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return null;
    }
  }
  return body;
}

export function phoneLast10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export function tokenDataKey(token: string): string {
  return `${DOC_UPLOAD_TOKEN_PREFIX}${token}`;
}

function generateToken(): string {
  return `adu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isExpired(snapshot: DocumentUploadTokenSnapshot): boolean {
  return Date.now() > snapshot.expiresAt;
}

function resolveStatus(snapshot: DocumentUploadTokenSnapshot): DocumentUploadInviteStatus {
  if (snapshot.status === "submitted") return "submitted";
  if (isExpired(snapshot)) return "expired";
  return snapshot.status;
}

type InviteRow = DocumentUploadTokenSnapshot & { id: string; inviteLink?: string };

export type RegisterDocumentUploadInviteInput = {
  requesterPhone: string;
  requesterRole: DocumentUploadRequesterRole;
  requesterName: string;
  tenantName: string;
  tenantPhone: string;
  propertyId?: string;
  propertyLabel?: string;
  propertyImage?: string;
  propertyAddress?: string;
  monthlyRent?: string;
  securityDeposit?: string;
  agreementDraftId?: string;
  requestedDocumentIds?: ExtendedDocumentId[];
  origin: string;
};

export type RegisterDocumentUploadInviteError =
  | "invalid_name"
  | "invalid_phone"
  | "duplicate_invite";

export type RegisterDocumentUploadInviteResult =
  | {
      ok: true;
      invite: DocumentUploadTokenSnapshot & { id: string; inviteLink: string };
    }
  | { ok: false; error: RegisterDocumentUploadInviteError };

export async function registerDocumentUploadInvite(
  store: DocumentUploadStore,
  input: RegisterDocumentUploadInviteInput,
): Promise<RegisterDocumentUploadInviteResult> {
  const name = input.tenantName.trim();
  const phoneDigits = phoneLast10(input.tenantPhone);
  const requesterPhone = phoneLast10(input.requesterPhone);

  if (name.length < 2) return { ok: false, error: "invalid_name" };
  if (phoneDigits.length !== 10) return { ok: false, error: "invalid_phone" };

  const data = await store.getAccountData(requesterPhone, input.requesterRole);
  let invites: InviteRow[] = [];
  const invitesRaw = data[DOC_UPLOAD_INVITES_KEY];
  if (invitesRaw) {
    try {
      const parsed = JSON.parse(invitesRaw) as InviteRow[];
      if (Array.isArray(parsed)) invites = parsed;
    } catch {
      invites = [];
    }
  }

  const activeInvite = invites.find((inv) => {
    if (phoneLast10(inv.tenantPhone) !== phoneDigits) return false;
    if (inv.status === "submitted") return false;
    if (Date.now() > inv.expiresAt) return false;
    return true;
  });
  if (activeInvite) return { ok: false, error: "duplicate_invite" };

  const now = Date.now();
  const token = generateToken();
  const tenantPhone = `+91${phoneDigits}`;
  const origin = input.origin.replace(/\/$/, "");
  const inviteLink = `${origin}/upload/documents/${token}`;
  const requestedDocumentIds = input.requestedDocumentIds ?? [...AGREEMENT_DEFAULT_DOCUMENT_IDS];

  const documentStatuses: Partial<Record<ExtendedDocumentId, UploadDocumentStatus>> = {};
  for (const id of requestedDocumentIds) {
    documentStatuses[id] = "not_uploaded";
  }

  const snapshot: DocumentUploadTokenSnapshot = {
    token,
    tenantName: name,
    tenantPhone,
    requesterPhone,
    requesterRole: input.requesterRole,
    requesterName: input.requesterName.trim() || "Your property manager",
    propertyId: input.propertyId,
    propertyLabel: input.propertyLabel,
    propertyImage: input.propertyImage,
    propertyAddress: input.propertyAddress,
    monthlyRent: input.monthlyRent,
    securityDeposit: input.securityDeposit,
    agreementDraftId: input.agreementDraftId,
    requestedDocumentIds,
    status: "link_sent",
    tenantDocumentStatus: "document_request_sent",
    documents: {},
    documentStatuses,
    createdAt: now,
    expiresAt: now + DOC_UPLOAD_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    linkSentAt: now,
  };

  const invite: InviteRow = { ...snapshot, id: `adu_${now}_${Math.random().toString(36).slice(2, 7)}`, inviteLink };
  invites.unshift(invite);

  await store.setAccountDataKey(
    requesterPhone,
    input.requesterRole,
    DOC_UPLOAD_INVITES_KEY,
    JSON.stringify(invites),
  );
  await store.setAccountDataKey(
    requesterPhone,
    input.requesterRole,
    tokenDataKey(token),
    JSON.stringify(snapshot),
  );

  return { ok: true, invite: { ...snapshot, id: invite.id, inviteLink } };
}

async function loadTokenSnapshot(
  store: DocumentUploadStore,
  token: string,
): Promise<{ snapshot: DocumentUploadTokenSnapshot; requesterPhone: string; requesterRole: string } | null> {
  const entry = await store.findEntryByDataKey(tokenDataKey(token));
  if (!entry) return null;
  try {
    const snapshot = JSON.parse(entry.value) as DocumentUploadTokenSnapshot;
    if (!snapshot.token) return null;
    return { snapshot, requesterPhone: phoneLast10(entry.phone), requesterRole: entry.role };
  } catch {
    return null;
  }
}

async function persistSnapshot(
  store: DocumentUploadStore,
  requesterPhone: string,
  requesterRole: string,
  snapshot: DocumentUploadTokenSnapshot,
): Promise<void> {
  await store.setAccountDataKey(
    requesterPhone,
    requesterRole,
    tokenDataKey(snapshot.token),
    JSON.stringify(snapshot),
  );

  const data = await store.getAccountData(requesterPhone, requesterRole);
  const invitesRaw = data[DOC_UPLOAD_INVITES_KEY];
  if (!invitesRaw) return;
  try {
    const invites = JSON.parse(invitesRaw) as InviteRow[];
    if (!Array.isArray(invites)) return;
    const next = invites.map((row) =>
      row.token === snapshot.token ? { ...row, ...snapshot, inviteLink: row.inviteLink } : row,
    );
    await store.setAccountDataKey(
      requesterPhone,
      requesterRole,
      DOC_UPLOAD_INVITES_KEY,
      JSON.stringify(next),
    );
  } catch {
    /* ignore */
  }
}

export type SubmitDocumentUploadBody = {
  documents?: Partial<
    Record<
      ExtendedDocumentId,
      { fileName: string; fileSize: number; mimeType: string; dataUrl: string }
    >
  >;
  bankDetails?: StoredBankDetails;
  draft?: boolean;
  removeDocumentIds?: ExtendedDocumentId[];
};

function validateFilePayload(file: {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  dataUrl?: string;
}): string | null {
  const fileName = (file.fileName ?? "").trim();
  const mimeType = (file.mimeType ?? "").trim().toLowerCase();
  const dataUrl = (file.dataUrl ?? "").trim();
  if (!fileName) return "File name is required";
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(mimeType as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number])) {
    return "Unsupported file type";
  }
  if (typeof file.fileSize !== "number" || file.fileSize <= 0 || file.fileSize > MAX_UPLOAD_BYTES) {
    return "File size must be 5MB or less";
  }
  if (!dataUrl.startsWith("data:")) return "Invalid file payload";
  return null;
}

function validateBankDetails(bank: StoredBankDetails): string | null {
  if (bank.mode === "upi") {
    const upi = (bank.upiId ?? "").trim();
    const qr = (bank.upiQrFileName ?? "").trim();
    if (!upi && !qr) return "UPI ID or QR code is required";
    return null;
  }
  if (!(bank.holderName ?? "").trim()) return "Account holder name is required";
  if (!(bank.bankName ?? "").trim()) return "Bank name is required";
  if (!(bank.accountNumber ?? "").trim()) return "Account number is required";
  if (!(bank.ifscCode ?? "").trim()) return "IFSC code is required";
  return null;
}

export async function submitDocumentUpload(
  store: DocumentUploadStore,
  token: string,
  body: SubmitDocumentUploadBody,
): Promise<{ ok: true; snapshot: DocumentUploadTokenSnapshot } | { ok: false; error: string; code?: string }> {
  const record = await loadTokenSnapshot(store, token);
  if (!record) return { ok: false, error: "Invalid document upload link", code: "invalid_link" };

  const status = resolveStatus(record.snapshot);
  if (status === "expired") {
    return { ok: false, error: "This document upload link has expired", code: "expired" };
  }
  if (status === "submitted" && !body.draft) {
    return { ok: false, error: "Documents were already submitted", code: "already_submitted" };
  }

  const snapshot: DocumentUploadTokenSnapshot = { ...record.snapshot };
  const wasSubmitted =
    snapshot.status === "submitted" || snapshot.tenantDocumentStatus === "documents_submitted";
  if (!canTenantModifyDocuments(snapshot) && (body.documents || body.bankDetails || body.removeDocumentIds?.length)) {
    return {
      ok: false,
      error: "Documents cannot be changed after agreement generation",
      code: "documents_locked",
    };
  }

  const nextDocuments = { ...snapshot.documents };
  const nextStatuses = { ...snapshot.documentStatuses };
  const nextHistory: DocumentHistoryMap = { ...(snapshot.documentHistory ?? {}) };

  if (body.removeDocumentIds?.length) {
    for (const id of body.removeDocumentIds) {
      if (!snapshot.requestedDocumentIds.includes(id)) continue;
      if (id === "bank") {
        snapshot.bankDetails = undefined;
        nextStatuses.bank = "not_uploaded";
        continue;
      }
      if (!isFileDocumentId(id)) continue;
      const current = nextDocuments[id];
      if (current) {
        nextHistory[id] = archiveDocumentFile(nextHistory[id], current);
      }
      delete nextDocuments[id];
      nextStatuses[id] = "not_uploaded";
    }
  }

  if (body.documents) {
    for (const [id, file] of Object.entries(body.documents) as [ExtendedDocumentId, NonNullable<SubmitDocumentUploadBody["documents"]>[ExtendedDocumentId]][]) {
      if (!file) continue;
      if (!snapshot.requestedDocumentIds.includes(id)) continue;
      if (!isFileDocumentId(id)) continue;
      const validationError = validateFilePayload(file);
      if (validationError) return { ok: false, error: validationError, code: "invalid_file" };
      const current = nextDocuments[id];
      if (current) {
        nextHistory[id] = archiveDocumentFile(nextHistory[id], current);
      }
      nextDocuments[id] = {
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        dataUrl: file.dataUrl,
        uploadedAt: Date.now(),
      };
      nextStatuses[id] = "uploaded";
    }
  }

  if (body.bankDetails) {
    const bankError = validateBankDetails(body.bankDetails);
    if (bankError) return { ok: false, error: bankError, code: "invalid_bank" };
    snapshot.bankDetails = body.bankDetails;
    nextStatuses.bank = "uploaded";
  }

  snapshot.documents = nextDocuments;
  snapshot.documentStatuses = nextStatuses;
  snapshot.documentHistory = nextHistory;
  snapshot.lastDocumentUpdateAt = Date.now();

  if (body.draft) {
    snapshot.status = wasSubmitted ? "submitted" : "in_progress";
    snapshot.tenantDocumentStatus = wasSubmitted
      ? snapshot.tenantDocumentStatus
      : "documents_in_progress";
  } else {
    snapshot.status = "submitted";
    snapshot.tenantDocumentStatus = "documents_submitted";
    snapshot.submittedAt = Date.now();
  }
  snapshot.startedAt = snapshot.startedAt ?? Date.now();

  await persistSnapshot(store, record.requesterPhone, record.requesterRole, snapshot);

  return { ok: true, snapshot };
}

export type RequesterDocumentUploadInviteView = {
  token: string;
  id?: string;
  tenantName: string;
  tenantPhone: string;
  propertyId?: string;
  propertyLabel?: string;
  propertyImage?: string;
  propertyAddress?: string;
  monthlyRent?: string;
  securityDeposit?: string;
  status: DocumentUploadInviteStatus;
  tenantDocumentStatus: TenantDocumentUploadStatus;
  requestedDocumentIds: ExtendedDocumentId[];
  documentStatuses: Partial<Record<ExtendedDocumentId, UploadDocumentStatus>>;
  documents: Partial<Record<ExtendedDocumentId, StoredUploadFile>>;
  bankDetails?: StoredBankDetails;
  submittedAt?: number;
  linkSentAt?: number;
  startedAt?: number;
  expiresAt: number;
  inviteLink?: string;
};

function inviteRowToRequesterView(row: InviteRow): RequesterDocumentUploadInviteView {
  return {
    token: row.token,
    id: row.id,
    tenantName: row.tenantName,
    tenantPhone: row.tenantPhone,
    propertyId: row.propertyId,
    propertyLabel: row.propertyLabel,
    propertyImage: row.propertyImage,
    propertyAddress: row.propertyAddress,
    monthlyRent: row.monthlyRent,
    securityDeposit: row.securityDeposit,
    status: resolveStatus(row),
    tenantDocumentStatus: row.tenantDocumentStatus,
    requestedDocumentIds: row.requestedDocumentIds,
    documentStatuses: row.documentStatuses,
    documents: row.documents,
    bankDetails: row.bankDetails,
    submittedAt: row.submittedAt,
    linkSentAt: row.linkSentAt,
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
    inviteLink: row.inviteLink,
  };
}

export async function listRequesterDocumentUploadInvites(
  store: DocumentUploadStore,
  requesterPhone: string,
  requesterRole: DocumentUploadRequesterRole,
): Promise<RequesterDocumentUploadInviteView[]> {
  const phone = phoneLast10(requesterPhone);
  const data = await store.getAccountData(phone, requesterRole);
  const invitesRaw = data[DOC_UPLOAD_INVITES_KEY];
  if (!invitesRaw) return [];

  try {
    const invites = JSON.parse(invitesRaw) as InviteRow[];
    if (!Array.isArray(invites)) return [];
    return invites.map(inviteRowToRequesterView);
  } catch {
    return [];
  }
}

export async function getRequesterDocumentUploadInvite(
  store: DocumentUploadStore,
  requesterPhone: string,
  requesterRole: DocumentUploadRequesterRole,
  token: string,
): Promise<
  | { ok: true; invite: RequesterDocumentUploadInviteView }
  | { ok: false; error: string; code: "not_found" | "forbidden" }
> {
  const record = await loadTokenSnapshot(store, token);
  if (!record) return { ok: false, error: "Document upload invite not found", code: "not_found" };

  const phone = phoneLast10(requesterPhone);
  if (record.requesterPhone !== phone || record.requesterRole !== requesterRole) {
    return { ok: false, error: "You do not have access to this upload", code: "forbidden" };
  }

  const data = await store.getAccountData(phone, requesterRole);
  let inviteLink: string | undefined;
  const invitesRaw = data[DOC_UPLOAD_INVITES_KEY];
  if (invitesRaw) {
    try {
      const invites = JSON.parse(invitesRaw) as InviteRow[];
      inviteLink = invites.find((row) => row.token === token)?.inviteLink;
    } catch {
      inviteLink = undefined;
    }
  }

  return {
    ok: true,
    invite: inviteRowToRequesterView({ ...record.snapshot, id: token, inviteLink }),
  };
}

function uploadPathSegments(req: DocumentUploadRequest): string[] {
  const raw = req.query.uploadPath ?? req.query.path;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.length > 0) return raw.split("/").filter(Boolean);
  return [];
}

export async function handleTenantDocumentUploadRequest(
  req: DocumentUploadRequest,
  res: DocumentUploadResponse,
  store: DocumentUploadStore,
): Promise<void> {
  const segments = uploadPathSegments(req);
  const token = segments[0];

  if (!token) {
    json(res, 404, { error: "Not found" });
    return;
  }

  if (segments.length === 1) {
    if (req.method !== "GET") {
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    const record = await loadTokenSnapshot(store, token);
    if (!record) {
      json(res, 404, { error: "Invalid document upload link" });
      return;
    }

    const status = resolveStatus(record.snapshot);
    const hasTenantAccount = store.accountHasProfile
      ? await store.accountHasProfile(phoneLast10(record.snapshot.tenantPhone), "tenant")
      : false;

    json(res, status === "expired" ? 410 : 200, {
      token: record.snapshot.token,
      tenantName: record.snapshot.tenantName,
      tenantPhone: record.snapshot.tenantPhone,
      requesterName: record.snapshot.requesterName,
      requesterRole: record.snapshot.requesterRole,
      propertyId: record.snapshot.propertyId,
      propertyLabel: record.snapshot.propertyLabel,
      propertyImage: record.snapshot.propertyImage,
      propertyAddress: record.snapshot.propertyAddress,
      monthlyRent: record.snapshot.monthlyRent,
      securityDeposit: record.snapshot.securityDeposit,
      requestedDocumentIds: record.snapshot.requestedDocumentIds,
      status,
      tenantDocumentStatus: record.snapshot.tenantDocumentStatus,
      documentStatuses: record.snapshot.documentStatuses,
      documents: Object.fromEntries(
        Object.entries(record.snapshot.documents).map(([id, file]) => [
          id,
          { fileName: file.fileName, fileSize: file.fileSize, mimeType: file.mimeType, uploadedAt: file.uploadedAt },
        ]),
      ),
      bankDetails: record.snapshot.bankDetails
        ? {
            mode: record.snapshot.bankDetails.mode,
            holderName: record.snapshot.bankDetails.holderName,
            bankName: record.snapshot.bankDetails.bankName,
            accountNumber: record.snapshot.bankDetails.accountNumber
              ? `****${record.snapshot.bankDetails.accountNumber.slice(-4)}`
              : undefined,
            ifscCode: record.snapshot.bankDetails.ifscCode,
            upiId: record.snapshot.bankDetails.upiId,
            upiQrFileName: record.snapshot.bankDetails.upiQrFileName,
          }
        : undefined,
      expiresAt: record.snapshot.expiresAt,
      submittedAt: record.snapshot.submittedAt,
      hasTenantAccount,
    });
    return;
  }

  if (segments[1] === "submit") {
    if (req.method !== "POST") {
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    const rawBody = readJsonBody(req);
    const body: SubmitDocumentUploadBody =
      rawBody && typeof rawBody === "object" ? (rawBody as SubmitDocumentUploadBody) : {};

    const result = await submitDocumentUpload(store, token, body);
    if (!result.ok) {
      const status =
        result.code === "expired" ? 410 : result.code === "already_submitted" ? 409 : 400;
      json(res, status, { error: result.error, code: result.code });
      return;
    }

    json(res, body.draft ? 200 : 201, {
      ok: true,
      status: result.snapshot.status,
      tenantDocumentStatus: result.snapshot.tenantDocumentStatus,
      submittedAt: result.snapshot.submittedAt,
      requesterName: result.snapshot.requesterName,
      requesterRole: result.snapshot.requesterRole,
    });
    return;
  }

  if (segments[1] === "start") {
    if (req.method !== "POST") {
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    const record = await loadTokenSnapshot(store, token);
    if (!record) {
      json(res, 404, { error: "Invalid document upload link" });
      return;
    }
    if (resolveStatus(record.snapshot) === "expired") {
      json(res, 410, { error: "This document upload link has expired", code: "expired" });
      return;
    }

    const snapshot: DocumentUploadTokenSnapshot = {
      ...record.snapshot,
      status: "in_progress",
      tenantDocumentStatus: "documents_in_progress",
      startedAt: Date.now(),
    };
    await persistSnapshot(store, record.requesterPhone, record.requesterRole, snapshot);
    json(res, 200, { ok: true });
    return;
  }

  if (segments[1] === "file" && segments[2]) {
    if (req.method !== "GET") {
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    const docId = segments[2] as ExtendedDocumentId;
    const record = await loadTokenSnapshot(store, token);
    if (!record) {
      json(res, 404, { error: "Invalid document upload link" });
      return;
    }
    if (resolveStatus(record.snapshot) === "expired") {
      json(res, 410, { error: "This document upload link has expired", code: "expired" });
      return;
    }

    const file = record.snapshot.documents[docId];
    if (!file?.dataUrl) {
      json(res, 404, { error: "Document file not found", code: "not_found" });
      return;
    }

    json(res, 200, {
      documentId: docId,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      uploadedAt: file.uploadedAt,
      dataUrl: file.dataUrl,
    });
    return;
  }

  json(res, 404, { error: "Not found" });
}
