/** Inline blur / change validators for party detail text/number fields. */

import {
  AADHAAR_INVALID_ERROR,
  isValidAadhaarNumber,
  normalizeAadhaarDigits,
  PARTY_PHONE_FORMAT_ERROR,
} from "@workspace/api-schemas";

export {
  AADHAAR_INVALID_ERROR,
  isValidAadhaarNumber,
  PARTY_PHONE_FORMAT_ERROR as PHONE_FORMAT_ERROR,
} from "@workspace/api-schemas";

export const AGE_ERROR_MESSAGE = "Please enter a correct age.";
export const AGE_REQUIRED_ERROR = "Age is required";
export const NAME_REQUIRED_ERROR = "Name is required";
export const ADDRESS_REQUIRED_ERROR = "Current address is required";
export const AADHAAR_REQUIRED_ERROR = "Aadhaar Number is required";
export const AADHAAR_FORMAT_ERROR = "Aadhaar Number must be exactly 12 digits";
export const EMAIL_REQUIRED_ERROR = "Email Address is required";
export const EMAIL_FORMAT_ERROR = "Enter a valid email address";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Name on blur — blank is required for create-agreement parties.
 */
export function nameBlurError(raw: string | null | undefined): string | null {
  if ((raw ?? "").trim().length === 0) return NAME_REQUIRED_ERROR;
  return null;
}

/**
 * Current address on blur — blank is required for create-agreement parties.
 */
export function addressBlurError(
  raw: string | null | undefined,
): string | null {
  if ((raw ?? "").trim().length === 0) return ADDRESS_REQUIRED_ERROR;
  return null;
}

/**
 * Aadhaar on blur — blank required; incomplete length; 12 digits must pass
 * Verhoeff checksum (not live UIDAI verification).
 */
export function aadhaarBlurError(
  raw: string | null | undefined,
): string | null {
  const digits = normalizeAadhaarDigits(raw ?? "");
  if (digits.length === 0) return AADHAAR_REQUIRED_ERROR;
  if (digits.length !== 12) return AADHAAR_FORMAT_ERROR;
  if (!isValidAadhaarNumber(digits)) return AADHAAR_INVALID_ERROR;
  return null;
}

/**
 * Aadhaar on change — quiet while typing; at 12 digits show invalid if
 * checksum/format fails. Does not prove UIDAI registration.
 */
export function aadhaarChangeError(
  raw: string | null | undefined,
): string | null {
  const digits = normalizeAadhaarDigits(raw ?? "");
  if (digits.length < 12) return null;
  if (!isValidAadhaarNumber(digits)) return AADHAAR_INVALID_ERROR;
  return null;
}

/**
 * Email on blur — blank required; non-empty must look like an email.
 */
export function emailBlurError(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) return EMAIL_REQUIRED_ERROR;
  return EMAIL_RE.test(trimmed) ? null : EMAIL_FORMAT_ERROR;
}

/**
 * Age on blur — blank required; out of 18–120 → product incorrect-age copy.
 */
export function ageBlurError(value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return AGE_REQUIRED_ERROR;
  }
  if (!Number.isInteger(value) || value < 18 || value > 120) {
    return AGE_ERROR_MESSAGE;
  }
  return null;
}
