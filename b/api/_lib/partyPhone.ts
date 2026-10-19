/**
 * Vercel-bundled copy of lib/api-schemas/src/partyPhone.ts — keep in sync.
 * Party phone numbers — E.164 storage via libphonenumber-js.
 */
import {
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";

export const DEFAULT_PARTY_PHONE_COUNTRY: CountryCode = "IN";

export const PARTY_PHONE_FORMAT_ERROR = "Enter a valid phone number";
export const PARTY_PHONE_REQUIRED_ERROR = "Phone Number is required";

export const PRIORITY_PARTY_PHONE_COUNTRIES: readonly CountryCode[] = [
  "IN",
  "US",
  "GB",
  "AE",
  "SG",
  "AU",
  "CA",
];

export function normalizePartyPhoneE164(
  raw: string | null | undefined,
): string | null {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) return null;

  let parsed = parsePhoneNumberFromString(trimmed);
  if (!parsed) {
    const digits = trimmed.replace(/\D/g, "");
    if (/^\d{10}$/.test(digits)) {
      parsed = parsePhoneNumberFromString(digits, DEFAULT_PARTY_PHONE_COUNTRY);
    } else if (digits.length > 0 && trimmed.startsWith("+")) {
      parsed = parsePhoneNumberFromString(`+${digits}`);
    }
  }

  if (!parsed?.isValid()) return null;
  return parsed.format("E.164");
}

export function composePartyPhone(
  country: CountryCode,
  nationalDigits: string,
): string {
  const digits = nationalDigits.replace(/\D/g, "");
  if (digits.length === 0) return "";

  const parsed = parsePhoneNumberFromString(digits, country);
  if (parsed?.isValid()) {
    return parsed.format("E.164");
  }
  return `+${getCountryCallingCode(country)}${digits}`;
}

export function splitPartyPhone(
  stored: string | null | undefined,
  fallbackCountry: CountryCode = DEFAULT_PARTY_PHONE_COUNTRY,
): { country: CountryCode; national: string } {
  const trimmed = (stored ?? "").trim();
  if (trimmed.length === 0) {
    return { country: fallbackCountry, national: "" };
  }

  const parsed = parsePhoneNumberFromString(trimmed);
  if (parsed?.country) {
    return {
      country: parsed.country,
      national: parsed.nationalNumber,
    };
  }

  const digits = trimmed.replace(/\D/g, "");
  if (/^\d{10}$/.test(digits) && !trimmed.startsWith("+")) {
    return { country: DEFAULT_PARTY_PHONE_COUNTRY, national: digits };
  }

  if (trimmed.startsWith("+") && digits.length > 0) {
    const hintCode = String(getCountryCallingCode(fallbackCountry));
    if (digits.startsWith(hintCode)) {
      return {
        country: fallbackCountry,
        national: digits.slice(hintCode.length),
      };
    }

    let bestCode = "";
    let bestCountry: CountryCode | null = null;
    for (const country of getCountries()) {
      const code = String(getCountryCallingCode(country));
      if (!digits.startsWith(code)) continue;
      if (code.length > bestCode.length) {
        bestCode = code;
        bestCountry = country;
      } else if (code.length === bestCode.length) {
        if (country === "US" && code === "1") {
          bestCountry = "US";
        } else if (country === fallbackCountry) {
          bestCountry = fallbackCountry;
        }
      }
    }
    if (bestCountry) {
      return {
        country: bestCountry,
        national: digits.slice(bestCode.length),
      };
    }
  }

  return { country: fallbackCountry, national: digits };
}

export function normalizeNationalPhoneInput(
  raw: string,
  maxLength = 15,
): string {
  return raw.replace(/\D/g, "").slice(0, maxLength);
}

export function partyPhoneBlurError(
  nationalOrStored: string | null | undefined,
  country: CountryCode,
): string | null {
  const trimmed = (nationalOrStored ?? "").trim();
  if (trimmed.length === 0) return PARTY_PHONE_REQUIRED_ERROR;

  const composed = trimmed.startsWith("+")
    ? trimmed
    : composePartyPhone(country, normalizeNationalPhoneInput(trimmed));
  return normalizePartyPhoneE164(composed) ? null : PARTY_PHONE_FORMAT_ERROR;
}

export function nationalPhoneDigitLength(country: CountryCode): number {
  const example = getExampleNumber(country, examples);
  return example?.nationalNumber.length ?? 15;
}

export function partyPhoneChangeError(
  nationalOrStored: string | null | undefined,
  country: CountryCode,
): string | null {
  const trimmed = (nationalOrStored ?? "").trim();
  if (trimmed.length === 0) return null;

  const national = normalizeNationalPhoneInput(trimmed);
  const composed = trimmed.startsWith("+")
    ? trimmed
    : composePartyPhone(country, national);
  if (normalizePartyPhoneE164(composed)) return null;

  if (national.length < nationalPhoneDigitLength(country)) return null;
  return PARTY_PHONE_FORMAT_ERROR;
}

export function formatPartyPhoneDisplay(
  phone: string | null | undefined,
): string {
  const trimmed = (phone ?? "").trim();
  if (trimmed.length === 0) return "";

  const e164 = normalizePartyPhoneE164(trimmed);
  const parsed = e164
    ? parsePhoneNumberFromString(e164)
    : parsePhoneNumberFromString(trimmed);
  if (parsed) {
    return parsed.formatInternational();
  }
  return trimmed;
}

export function partyPhoneUniqueKey(
  phone: string | null | undefined,
): string {
  const e164 = normalizePartyPhoneE164(phone);
  if (e164) return e164;
  return (phone ?? "").trim();
}
