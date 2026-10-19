import type { LeasePartyInput } from "@workspace/api-schemas";
import {
  isValidAadhaarNumber,
  normalizePartyPhoneE164,
} from "@workspace/api-schemas";

/** True when the party row has any user-entered values worth confirming before remove. */
export function partyHasEnteredData(party: LeasePartyInput): boolean {
  if (party.name.trim().length > 0) return true;
  if (party.phone.trim().length > 0) return true;
  if (party.title != null && String(party.title).trim().length > 0) return true;
  if (party.age != null) return true;
  if (party.address != null && party.address.trim().length > 0) return true;
  if (party.aadhaar != null && String(party.aadhaar).trim().length > 0) return true;
  if (party.pan != null && String(party.pan).trim().length > 0) return true;
  if (party.email != null && party.email.trim().length > 0) return true;
  return false;
}

export function partyCardLabel(
  role: "owner" | "tenant",
  _indexWithinRole: number,
  name: string,
): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return role === "owner" ? "New owner" : "New tenant";
  }
  return trimmed;
}

/**
 * Same completeness bar as step Next / Add-gating: name, phone, title, age,
 * address, 12-digit Aadhaar, email. PAN remains optional.
 */
export function isPartyFullyComplete(party: {
  name: string;
  phone: string;
  title?: string | null;
  age?: number | null;
  address?: string | null;
  aadhaar?: string | null;
  email?: string | null;
}): boolean {
  if (party.name.trim().length === 0) return false;
  if (!normalizePartyPhoneE164(party.phone)) return false;
  if (party.title == null || String(party.title).trim().length === 0) return false;
  if (
    party.age === null ||
    party.age === undefined ||
    !Number.isInteger(party.age) ||
    party.age < 18 ||
    party.age > 120
  ) {
    return false;
  }
  if (party.address == null || party.address.trim().length === 0) return false;
  if (!isValidAadhaarNumber(party.aadhaar)) return false;
  const email = party.email?.trim() ?? "";
  if (email.length === 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  return true;
}

/** Digits-only Aadhaar input — at most 12 characters; empty → null. */
export function normalizeAadhaarInput(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  return digits.length === 0 ? null : digits;
}
