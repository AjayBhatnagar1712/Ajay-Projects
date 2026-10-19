import { getApiBase } from "@/lib/apiBase";
import type { Agreement } from "./agreements";
import { getActiveSession, normalizePhoneDigits } from "./storageKeys";
import { syncAuthHeaders } from "./syncSession";

export interface AgreementSigningStatus {
  agreementId: string;
  lifecycleStage?: string;
  tenantPhone: string;
  ownerContact?: string;
  esignSignedPartyPhones: string[];
  tenantSigned: boolean;
  ownerSigned: boolean;
  allSigned: boolean;
  ownerUploadRequired: boolean;
}

export interface AgreementSigningPresentation {
  label: string;
  tone: "muted" | "action" | "complete";
  uploadLabel?: string;
}

function workflowUrl(path: string): string {
  return `${getApiBase()}/tenant-workflow/${path}`;
}

function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export function ownerPhonesFromAgreement(agreement: Agreement): string[] {
  const contacts = agreement.ownerContact
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (contacts.length === 0 && agreement.ownerContact.trim()) {
    return [phoneDigits(agreement.ownerContact)];
  }
  return contacts.map((contact) => phoneDigits(contact)).filter((digits) => digits.length === 10);
}

export function tenantPhoneFromAgreement(agreement: Agreement): string {
  return phoneDigits(agreement.tenantContact);
}

export function buildAgreementSigningStatus(input: {
  agreementId: string;
  tenantPhone: string;
  ownerContact?: string;
  lifecycleStage?: string;
  esignSignedPartyPhones?: string[];
}): AgreementSigningStatus {
  const signed = new Set((input.esignSignedPartyPhones ?? []).map((phone) => phoneDigits(phone)));
  const tenantDigits = phoneDigits(input.tenantPhone);
  const ownerDigits = input.ownerContact ? phoneDigits(input.ownerContact) : "";
  const tenantSigned = tenantDigits.length === 10 && signed.has(tenantDigits);
  const ownerSigned = ownerDigits.length === 10 && signed.has(ownerDigits);
  const signingStarted =
    input.lifecycleStage === "esign_document_upload" ||
    input.lifecycleStage === "awaiting_esign_signatures" ||
    input.lifecycleStage === "rent_payment_due" ||
    input.lifecycleStage === "agreement_signed";

  return {
    agreementId: input.agreementId,
    lifecycleStage: input.lifecycleStage,
    tenantPhone: tenantDigits,
    ownerContact: input.ownerContact,
    esignSignedPartyPhones: [...signed],
    tenantSigned,
    ownerSigned,
    allSigned: tenantSigned && ownerSigned,
    ownerUploadRequired: signingStarted && !ownerSigned,
  };
}

export function resolveAgreementSigningPresentation(
  status: AgreementSigningStatus | null,
  agreement: Agreement,
  requesterRole: "owner" | "broker" = "owner",
): AgreementSigningPresentation | null {
  if (agreement.status !== "Sent" || !status) return null;
  if (status.allSigned) {
    return { label: "Fully signed", tone: "complete" };
  }
  if (status.ownerSigned && !status.tenantSigned) {
    return { label: "Awaiting tenant signature", tone: "muted" };
  }
  if (status.tenantSigned && !status.ownerSigned) {
    if (requesterRole === "broker") {
      return { label: "Awaiting owner signature", tone: "muted" };
    }
    return {
      label: "Tenant signed",
      tone: "action",
      uploadLabel: "Upload signed copy",
    };
  }
  if (status.ownerUploadRequired || !status.ownerSigned) {
    if (requesterRole === "broker") {
      return { label: "Awaiting tenant review", tone: "muted" };
    }
    return {
      label: "Awaiting tenant review",
      tone: "muted",
      uploadLabel: status.lifecycleStage === "agreement_ready" ? undefined : "Upload signed copy",
    };
  }
  return { label: "Awaiting signatures", tone: "muted" };
}

function resolveRequesterSession(): { phone: string; role: "owner" | "broker" } | null {
  const session = getActiveSession();
  if (!session) return null;
  if (session.role !== "owner" && session.role !== "broker") return null;
  const phone = normalizePhoneDigits(session.phone);
  if (phone.length !== 10) return null;
  return { phone, role: session.role };
}

export async function fetchAgreementSigningStatus(
  agreementId: string,
): Promise<AgreementSigningStatus | null> {
  const session = resolveRequesterSession();
  if (!session) return null;

  try {
    const headers = await syncAuthHeaders();
    if (!headers) return null;

    const params = new URLSearchParams({
      phone: session.phone,
      role: session.role,
    });
    const res = await fetch(
      `${workflowUrl(`agreement-status/${encodeURIComponent(agreementId)}`)}?${params.toString()}`,
      { headers },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;

    const json = (await res.json()) as { status?: AgreementSigningStatus };
    return json.status ?? null;
  } catch {
    return null;
  }
}

export async function recordOwnerAgreementSignature(input: {
  agreementId: string;
  tenantPhone: string;
  signedPartyPhone: string;
  fileName: string;
  fileUrl: string;
}): Promise<{ ok: true; allSigned: boolean } | { ok: false; error: string }> {
  const session = resolveRequesterSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  try {
    const headers = await syncAuthHeaders("application/json");
    if (!headers) return { ok: false, error: "Not authenticated" };

    const res = await fetch(workflowUrl("record-party-signature"), {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: session.phone,
        role: session.role,
        agreementId: input.agreementId,
        tenantPhone: input.tenantPhone,
        signedPartyPhone: input.signedPartyPhone,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
      }),
    });

    const json = (await res.json()) as { allSigned?: boolean; error?: string };
    if (!res.ok) {
      return { ok: false, error: json.error ?? "Could not save signed agreement" };
    }

    return { ok: true, allSigned: json.allSigned === true };
  } catch {
    return { ok: false, error: "Network error while saving signed agreement" };
  }
}

export function resolveOwnerSignerPhone(agreement: Agreement, sessionPhone: string): string | null {
  const sessionDigits = phoneDigits(sessionPhone);
  const ownerPhones = ownerPhonesFromAgreement(agreement);
  if (ownerPhones.includes(sessionDigits)) return sessionDigits;
  if (ownerPhones.length === 1) return ownerPhones[0] ?? null;
  return ownerPhones[0] ?? null;
}
