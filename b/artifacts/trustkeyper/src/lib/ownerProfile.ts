import { queueCloudSync } from "@/lib/cloudSync";
import type { BrokerProfile } from "@/lib/brokerProfile";
import { getItem, getSessionItem, setItem, setSessionItem } from "@/lib/storageKeys";

export type OwnerDocumentKind = "aadhaar" | "pan";

export interface OwnerDocumentMeta {
  fileName?: string;
  fileSize?: number;
  uploadedAt?: number;
  dataUrl?: string;
}

export interface OwnerProfile extends BrokerProfile {
  propertyCount?: string;
  propertyIntent?: string;
  aadhaar?: OwnerDocumentMeta;
  pan?: OwnerDocumentMeta;
}

const defaults: OwnerProfile = {
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

function sanitizeDocumentMeta(meta?: OwnerDocumentMeta): OwnerDocumentMeta | undefined {
  if (!meta?.fileName) return meta ? { ...meta, dataUrl: undefined } : undefined;
  return {
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    uploadedAt: meta.uploadedAt,
  };
}

function readStored(): OwnerProfile {
  if (typeof window === "undefined") return { ...defaults };
  try {
    const raw = getItem("profile");
    const stored = raw ? (JSON.parse(raw) as Partial<OwnerProfile>) : {};
    const name =
      stored.name ||
      getSessionItem("name") ||
      getSessionItem("owner_name") ||
      "";
    const phone =
      normalizePhoneDigits(
        stored.phone ||
          getSessionItem("phone") ||
          getSessionItem("owner_phone") ||
          "",
      );
    return { ...defaults, ...stored, name, phone };
  } catch {
    return {
      ...defaults,
      name: getSessionItem("name") || getSessionItem("owner_name") || "",
      phone: normalizePhoneDigits(
        getSessionItem("phone") || getSessionItem("owner_phone") || "",
      ),
    };
  }
}

export function getOwnerProfile(): OwnerProfile {
  return readStored();
}

export function saveOwnerProfile(profile: OwnerProfile): void {
  try {
    const phone = normalizePhoneDigits(profile.phone);
    const payload: OwnerProfile = {
      ...profile,
      phone,
      aadhaar: sanitizeDocumentMeta(profile.aadhaar),
      pan: sanitizeDocumentMeta(profile.pan),
    };
    const json = JSON.stringify(payload);
    setItem("profile", json);
    setSessionItem("name", payload.name);
    setSessionItem("phone", phone);
    setSessionItem("owner_name", payload.name);
    setSessionItem("owner_phone", phone);
    queueCloudSync("profile", json);
  } catch {
    /* ignore */
  }
}

export function hasProfileBankDetails(p: Pick<OwnerProfile, "bankName" | "bankAccountNumber" | "bankIFSC">): boolean {
  return !!(p.bankName && p.bankAccountNumber && p.bankIFSC);
}

export function hasProfileUpiDetails(p: Pick<OwnerProfile, "upiId" | "upiQrFileName">): boolean {
  return !!(p.upiId?.trim() || p.upiQrFileName?.trim());
}

export function hasProfilePaymentDetails(p: Pick<OwnerProfile, "bankName" | "bankAccountNumber" | "bankIFSC" | "upiId" | "upiQrFileName">): boolean {
  return hasProfileBankDetails(p) || hasProfileUpiDetails(p);
}

export function hasOwnerBankDetails(): boolean {
  return hasProfileBankDetails(getOwnerProfile());
}

export function hasOwnerUpiDetails(): boolean {
  return hasProfileUpiDetails(getOwnerProfile());
}

const MAX_PROFILE_DOC_BYTES = 4 * 1024 * 1024;

export function saveOwnerProfileDocument(
  kind: OwnerDocumentKind,
  file: File,
  callbacks?: { onSuccess?: () => void; onError?: (message: string) => void },
): void {
  if (file.size > MAX_PROFILE_DOC_BYTES) {
    callbacks?.onError?.("File too large. Maximum size is 4MB for profile storage.");
    return;
  }

  try {
    const current = getOwnerProfile();
    const meta: OwnerDocumentMeta = {
      fileName: file.name,
      fileSize: file.size,
      uploadedAt: Date.now(),
    };
    saveOwnerProfile({
      ...current,
      [kind]: meta,
    });
    callbacks?.onSuccess?.();
  } catch {
    callbacks?.onError?.("Could not read the file. Please try again.");
  }
}

export function removeOwnerProfileDocument(kind: OwnerDocumentKind): void {
  const current = getOwnerProfile();
  const next = { ...current };
  delete next[kind];
  saveOwnerProfile(next);
}

export function saveOwnerProfileBank(data: {
  holderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}): void {
  const current = getOwnerProfile();
  saveOwnerProfile({
    ...current,
    bankHolderName: data.holderName,
    bankName: data.bankName,
    bankAccountNumber: data.accountNumber,
    bankIFSC: data.ifscCode,
  });
}

export function saveOwnerProfileUpi(upiId: string): void {
  const current = getOwnerProfile();
  saveOwnerProfile({
    ...current,
    upiId: upiId.trim(),
  });
}

export function saveOwnerProfileUpiDetails(data: { upiId: string; upiQrFileName: string }): void {
  const current = getOwnerProfile();
  saveOwnerProfile({
    ...current,
    upiId: data.upiId.trim(),
    upiQrFileName: data.upiQrFileName.trim(),
  });
}

export function clearOwnerProfileUpi(): void {
  const current = getOwnerProfile();
  saveOwnerProfile({
    ...current,
    upiId: "",
    upiQrFileName: "",
  });
}

export function clearOwnerProfileBank(): void {
  const current = getOwnerProfile();
  saveOwnerProfile({
    ...current,
    bankHolderName: "",
    bankName: "",
    bankAccountNumber: "",
    bankIFSC: "",
  });
}
