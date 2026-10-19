export type TenantDocumentUploadSession = {
  token: string;
  name: string;
  phone: string;
  requesterName: string;
  verifiedAt: number;
};

function sessionKey(token: string): string {
  return `tk_tenant_doc_upload_session_${token}`;
}

function rememberedSessionKey(token: string): string {
  return `tk_tenant_doc_upload_remember_${token}`;
}

export function getTenantDocumentUploadSession(token: string): TenantDocumentUploadSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      sessionStorage.getItem(sessionKey(token)) ?? localStorage.getItem(rememberedSessionKey(token));
    if (!raw) return null;
    return JSON.parse(raw) as TenantDocumentUploadSession;
  } catch {
    return null;
  }
}

export function setTenantDocumentUploadSession(
  session: TenantDocumentUploadSession,
  options?: { remember?: boolean },
): void {
  sessionStorage.setItem(sessionKey(session.token), JSON.stringify(session));
  if (options?.remember) {
    localStorage.setItem(rememberedSessionKey(session.token), JSON.stringify(session));
  }
}

export function clearTenantDocumentUploadSession(
  token: string,
  options?: { preserveRemembered?: boolean },
): void {
  sessionStorage.removeItem(sessionKey(token));
  if (!options?.preserveRemembered) {
    localStorage.removeItem(rememberedSessionKey(token));
  }
}

export function hasRememberedTenantDocumentUploadSession(token: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(rememberedSessionKey(token)) !== null;
}

function draftKey(token: string): string {
  return `tk_tenant_doc_upload_draft_${token}`;
}

export type TenantDocumentUploadDraft = {
  step: 1 | 2;
  uploads: Record<string, { fileName: string; fileSize: number; mimeType: string; dataUrl: string }>;
  bankDetails?: {
    mode: "bank" | "upi";
    holderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
    upiQrFileName?: string;
  };
};

export function getTenantDocumentUploadDraft(token: string): TenantDocumentUploadDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftKey(token));
    if (!raw) return null;
    return JSON.parse(raw) as TenantDocumentUploadDraft;
  } catch {
    return null;
  }
}

export function setTenantDocumentUploadDraft(token: string, draft: TenantDocumentUploadDraft): void {
  localStorage.setItem(draftKey(token), JSON.stringify(draft));
}

export function clearTenantDocumentUploadDraft(token: string): void {
  localStorage.removeItem(draftKey(token));
}
