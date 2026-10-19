import { queueCloudSync } from "./cloudSync";
import { getItem, getSessionItem, setItem, setSessionItem } from "./storageKeys";

export type BrokerDocumentKind = "aadhaar" | "pan";

export interface BrokerDocumentMeta {
  fileName?: string;
  fileSize?: number;
  uploadedAt?: number;
  dataUrl?: string;
}

export interface BrokerProfile {
  name: string;
  firm: string;
  phone: string;
  email: string;
  // Bank
  bankHolderName: string;
  bankName: string;
  bankAccountNumber: string;
  bankIFSC: string;
  // UPI
  upiId: string;
  upiQrFileName: string;
  aadhaar?: BrokerDocumentMeta;
  pan?: BrokerDocumentMeta;
}

const defaults: BrokerProfile = {
  name: "",
  firm: "",
  phone: "",
  email: "",
  bankHolderName: "",
  bankName: "",
  bankAccountNumber: "",
  bankIFSC: "",
  upiId: "",
  upiQrFileName: "",
};

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function sanitizeDocumentMeta(meta?: BrokerDocumentMeta): BrokerDocumentMeta | undefined {
  if (!meta?.fileName) return meta ? { ...meta, dataUrl: undefined } : undefined;
  return {
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    uploadedAt: meta.uploadedAt,
  };
}

export function getBrokerProfile(): BrokerProfile {
  try {
    const raw = getItem("profile");
    const stored = raw ? (JSON.parse(raw) as Partial<BrokerProfile>) : {};
    const name = stored.name || getSessionItem("name") || "";
    const firm = stored.firm || getSessionItem("firm") || "";
    const phone = normalizePhoneDigits(stored.phone || getSessionItem("phone") || "");
    return { ...defaults, ...stored, name, firm, phone };
  } catch {
    return {
      ...defaults,
      name: getSessionItem("name") || "",
      firm: getSessionItem("firm") || "",
      phone: normalizePhoneDigits(getSessionItem("phone") || ""),
    };
  }
}

export function saveBrokerProfile(profile: BrokerProfile): void {
  try {
    const normalized = {
      ...profile,
      phone: normalizePhoneDigits(profile.phone),
      aadhaar: sanitizeDocumentMeta(profile.aadhaar),
      pan: sanitizeDocumentMeta(profile.pan),
    };
    const payload = JSON.stringify(normalized);
    setItem("profile", payload);
    setSessionItem("name", normalized.name);
    setSessionItem("firm", normalized.firm);
    setSessionItem("phone", normalized.phone);
    queueCloudSync("profile", payload);
  } catch {}
}

export function hasBankDetails(): boolean {
  const p = getBrokerProfile();
  return !!(p.bankName && p.bankAccountNumber && p.bankIFSC);
}

const MAX_PROFILE_DOC_BYTES = 4 * 1024 * 1024;

export function saveBrokerProfileDocument(
  kind: BrokerDocumentKind,
  file: File,
  callbacks?: { onSuccess?: () => void; onError?: (message: string) => void },
): void {
  if (file.size > MAX_PROFILE_DOC_BYTES) {
    callbacks?.onError?.("File too large. Maximum size is 4MB for profile storage.");
    return;
  }

  try {
    const current = getBrokerProfile();
    const meta: BrokerDocumentMeta = {
      fileName: file.name,
      fileSize: file.size,
      uploadedAt: Date.now(),
    };
    saveBrokerProfile({
      ...current,
      [kind]: meta,
    });
    callbacks?.onSuccess?.();
  } catch {
    callbacks?.onError?.("Could not read the file. Please try again.");
  }
}

export function removeBrokerProfileDocument(kind: BrokerDocumentKind): void {
  const current = getBrokerProfile();
  const next = { ...current };
  delete next[kind];
  saveBrokerProfile(next);
}
