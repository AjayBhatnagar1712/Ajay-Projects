import type { Agreement } from "./agreements";

export interface AgreementSigningStatusSnapshot {
  agreementId: string;
  lifecycleStage?: string;
  esignSignedPartyPhones: string[];
  allSigned: boolean;
}

export interface AgreementSignaturePartyRow {
  id: string;
  contactDisplay: string;
  signed: boolean;
}

export interface AgreementSignaturePartyGroup {
  label: string;
  parties: AgreementSignaturePartyRow[];
}

export interface AgreementAwaitingSignaturesView {
  agreementId: string;
  propertyTitle: string;
  sentAt: number;
  title: string;
  description: string;
  groups: AgreementSignaturePartyGroup[];
  allSigned: boolean;
}

function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function splitContacts(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function expandContacts(raw: string | undefined): string[] {
  const split = splitContacts(raw);
  if (split.length > 0) return split;
  if (raw?.trim()) return [raw.trim()];
  return [];
}

function formatContactDisplay(contact: string): string {
  const digits = phoneDigits(contact);
  if (digits.length === 10) {
    return `+91 ${digits}`;
  }
  return contact.trim();
}

function isContactSigned(contact: string, signedPhones: Set<string>): boolean {
  const digits = phoneDigits(contact);
  if (digits.length !== 10) return false;
  return signedPhones.has(digits);
}

function buildPartyRows(
  contacts: string[],
  signedPhones: Set<string>,
  idPrefix: string,
): AgreementSignaturePartyRow[] {
  return contacts.map((contact, index) => ({
    id: `${idPrefix}-${index}`,
    contactDisplay: formatContactDisplay(contact),
    signed: isContactSigned(contact, signedPhones),
  }));
}

export function buildAgreementAwaitingSignaturesView(
  agreement: Agreement,
  status: AgreementSigningStatusSnapshot | null,
): AgreementAwaitingSignaturesView | null {
  if (agreement.status !== "Sent" || !status) return null;

  const signedPhones = new Set<string>(
    status.esignSignedPartyPhones.map((phone) => phoneDigits(phone)).filter((digits) => digits.length === 10),
  );

  const ownerContacts = expandContacts(agreement.ownerContact);
  const tenantContacts = [
    ...expandContacts(agreement.tenantContact),
    ...splitContacts(agreement.coTenantContact),
  ];

  if (tenantContacts.length === 0 && agreement.tenantContact.trim()) {
    tenantContacts.push(agreement.tenantContact.trim());
  }

  const ownerParties = buildPartyRows(ownerContacts, signedPhones, "owner");
  const tenantParties = buildPartyRows(tenantContacts, signedPhones, "tenant");

  const groups: AgreementSignaturePartyGroup[] = [];
  if (ownerParties.length > 0) {
    groups.push({ label: "Owner", parties: ownerParties });
  }
  if (tenantParties.length > 0) {
    groups.push({ label: "Tenant", parties: tenantParties });
  }

  return {
    agreementId: agreement.id,
    propertyTitle: agreement.propertyTitle,
    sentAt: agreement.createdAt,
    title: "Waiting for Signatures",
    description: `For ${agreement.propertyTitle}`,
    groups,
    allSigned: status.allSigned,
  };
}

export function isAgreementAwaitingSignatures(
  agreement: Agreement,
  status: AgreementSigningStatusSnapshot | null,
): boolean {
  if (agreement.status !== "Sent") return false;
  if (!status) return false;
  return !status.allSigned;
}

export function formatAgreementSentTimestamp(sentAt: number, now = Date.now()): string {
  const sentDate = new Date(sentAt);
  const today = new Date(now);
  const isToday =
    sentDate.getFullYear() === today.getFullYear() &&
    sentDate.getMonth() === today.getMonth() &&
    sentDate.getDate() === today.getDate();

  const timeLabel = sentDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (isToday) return `Today ${timeLabel}`;

  return sentDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function firstUnsignedTenantPhone(
  agreement: Agreement,
  status: AgreementSigningStatusSnapshot,
): string | null {
  const signedPhones = new Set(status.esignSignedPartyPhones.map((phone) => phoneDigits(phone)));
  const tenantDigits = phoneDigits(agreement.tenantContact);
  if (tenantDigits.length === 10 && !signedPhones.has(tenantDigits)) {
    return tenantDigits;
  }

  for (const contact of splitContacts(agreement.coTenantContact)) {
    const digits = phoneDigits(contact);
    if (digits.length === 10 && !signedPhones.has(digits)) {
      return digits;
    }
  }

  return null;
}
