import {
  DOC_UPLOAD_INVITES_KEY,
  type RequesterDocumentUploadInviteView,
  type TenantDocumentUploadStatus,
} from "@workspace/tenant-document-upload";
import {
  sanitizeDocumentUploadInviteForLocalStorage,
  type StoredDocumentUploadInvite,
} from "./agreementDocumentUploadSanitize";
import { queueCloudSync } from "./cloudSync";
import { getItem, setItem } from "./storageKeys";

export { DOC_UPLOAD_INVITES_KEY as AGREEMENT_DOCUMENT_UPLOAD_INVITES_KEY };
export { sanitizeDocumentUploadInviteForLocalStorage, type StoredDocumentUploadInvite } from "./agreementDocumentUploadSanitize";
export const AGREEMENT_DOCUMENT_UPLOAD_UPDATED_EVENT = "tk-agreement-document-upload-updated";

function phoneLast10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function readInvites(): StoredDocumentUploadInvite[] {
  try {
    const raw = getItem(DOC_UPLOAD_INVITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RequesterDocumentUploadInviteView[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeDocumentUploadInviteForLocalStorage);
  } catch {
    return [];
  }
}

function persistInvites(invites: StoredDocumentUploadInvite[]): void {
  try {
    const payload = JSON.stringify(invites);
    const prev = getItem(DOC_UPLOAD_INVITES_KEY);
    if (prev === payload) return;
    setItem(DOC_UPLOAD_INVITES_KEY, payload);
    queueCloudSync(DOC_UPLOAD_INVITES_KEY, payload);
    window.dispatchEvent(new CustomEvent(AGREEMENT_DOCUMENT_UPLOAD_UPDATED_EVENT));
  } catch {
    /* Quota exceeded — never block other flows (e.g. add property). */
  }
}

export function getStoredDocumentUploadInvites(): StoredDocumentUploadInvite[] {
  return readInvites();
}

export function findDocumentUploadInviteByToken(token: string): StoredDocumentUploadInvite | undefined {
  return readInvites().find((invite) => invite.token === token);
}

export function findDocumentUploadInviteByTenantPhone(phone: string): StoredDocumentUploadInvite | undefined {
  const digits = phoneLast10(phone);
  return readInvites().find((invite) => phoneLast10(invite.tenantPhone) === digits);
}

export function upsertStoredDocumentUploadInvite(invite: RequesterDocumentUploadInviteView): void {
  const sanitized = sanitizeDocumentUploadInviteForLocalStorage(invite);
  const invites = readInvites();
  const idx = invites.findIndex((row) => row.token === sanitized.token);
  if (idx === -1) {
    persistInvites([sanitized, ...invites]);
    return;
  }
  const next = [...invites];
  next[idx] = { ...next[idx], ...sanitized };
  persistInvites(next);
}

export function mergeStoredDocumentUploadInvites(serverInvites: RequesterDocumentUploadInviteView[]): void {
  if (serverInvites.length === 0) return;
  const byToken = new Map(readInvites().map((invite) => [invite.token, invite]));
  for (const invite of serverInvites) {
    const sanitized = sanitizeDocumentUploadInviteForLocalStorage(invite);
    const existing = byToken.get(sanitized.token);
    byToken.set(sanitized.token, existing ? { ...existing, ...sanitized } : sanitized);
  }
  const merged = [...byToken.values()].sort(
    (a, b) => (b.submittedAt ?? b.linkSentAt ?? 0) - (a.submittedAt ?? a.linkSentAt ?? 0),
  );
  persistInvites(merged);
}

export function inviteTenantDocumentStatus(invite: StoredDocumentUploadInvite): TenantDocumentUploadStatus {
  return invite.tenantDocumentStatus;
}
