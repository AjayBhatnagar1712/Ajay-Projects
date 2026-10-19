import { getAgreements } from "./agreements";
import { getActiveSession } from "./storageKeys";
import type { TenantWorkspaceRecord } from "./tenantWorkspace";
import { formatTenantWhatsAppPhoneDisplay } from "./tenantAgreementReview";

export interface TenantSignaturePartyRow {
  id: string;
  phoneDisplay: string;
  signed: boolean;
}

export interface TenantSignaturePartyGroup {
  label: string;
  parties: TenantSignaturePartyRow[];
}

export interface TenantAwaitingSignaturesStatus {
  title: string;
  description: string;
  groups: TenantSignaturePartyGroup[];
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

function isPhoneSigned(phone: string, signedPhones: Set<string>): boolean {
  return signedPhones.has(phoneDigits(phone));
}

function buildPartyRows(
  contacts: string[],
  signedPhones: Set<string>,
  idPrefix: string,
): TenantSignaturePartyRow[] {
  return contacts.map((contact, index) => ({
    id: `${idPrefix}-${index}`,
    phoneDisplay: formatTenantWhatsAppPhoneDisplay(contact),
    signed: isPhoneSigned(contact, signedPhones),
  }));
}

export function resolveTenantAwaitingSignaturesStatus(
  workspace: TenantWorkspaceRecord | null,
): TenantAwaitingSignaturesStatus {
  const session = typeof window === "undefined" ? null : getActiveSession();
  const sessionDigits =
    session?.role === "tenant" ? phoneDigits(session.phone) : phoneDigits(workspace?.phone ?? "");

  const signedPhones = new Set<string>(
    (workspace?.esignSignedPartyPhones ?? [])
      .map((phone) => phoneDigits(phone))
      .filter((digits) => digits.length === 10),
  );

  if (sessionDigits.length === 10) {
    signedPhones.add(sessionDigits);
  }

  const agreement = workspace?.agreementId
    ? getAgreements().find((row) => row.id === workspace.agreementId)
    : undefined;

  const ownerContacts = agreement
    ? expandContacts(agreement.ownerContact)
    : workspace?.ownerContact
      ? expandContacts(workspace.ownerContact)
      : workspace?.agreementSnapshot?.ownerContact
        ? expandContacts(workspace.agreementSnapshot.ownerContact)
        : [];

  const tenantContacts = agreement
    ? [...expandContacts(agreement.tenantContact), ...splitContacts(agreement.coTenantContact)]
    : workspace?.phone
      ? [workspace.phone]
      : [];

  const ownerParties = buildPartyRows(ownerContacts, signedPhones, "owner");
  const tenantParties = buildPartyRows(tenantContacts, signedPhones, "tenant");

  const groups: TenantSignaturePartyGroup[] = [];
  if (ownerParties.length > 0) {
    groups.push({ label: "Owner", parties: ownerParties });
  }
  if (tenantParties.length > 0) {
    groups.push({ label: "Tenant", parties: tenantParties });
  }

  return {
    title: "Waiting for signatures",
    description: "You'll be notified once everyone signs.",
    groups,
  };
}
