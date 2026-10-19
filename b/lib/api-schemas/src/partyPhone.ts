/**
 * Party phone numbers — E.164 storage via libphonenumber-js.
 * Accepts legacy bare 10-digit India numbers on read/write for transition.
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

/** Countries pinned to the top of the picker (NRI + common). */
export const PRIORITY_PARTY_PHONE_COUNTRIES: readonly CountryCode[] = [
  "IN",
  "US",
  "GB",
  "AE",
  "SG",
  "AU",
  "CA",
];

/**
 * Coerce runtime phone input to a string. Non-strings (including Zod's
 * `{ status: "aborted" }` transform sentinel when a phone field fails) → "".
 */
function partyPhoneRawString(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

/**
 * Normalize any accepted party phone input to E.164.
 * - Valid E.164 / international strings parse as-is
 * - Bare 10-digit → India (+91…) for legacy rows / clients
 * - Invalid / incomplete / non-string → null
 */
export function normalizePartyPhoneE164(
  raw: string | null | undefined,
): string | null {
  const trimmed = partyPhoneRawString(raw).trim();
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

/**
 * Compose a stored phone value from country + national digits.
 * Valid → E.164; incomplete → provisional `+{callingCode}{digits}` so a foreign
 * mid-edit number is never India-defaulted by the API; empty → "".
 */
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

/** Split a stored phone into country + national digits for the form UI. */
export function splitPartyPhone(
  stored: string | null | undefined,
  fallbackCountry: CountryCode = DEFAULT_PARTY_PHONE_COUNTRY,
): { country: CountryCode; national: string } {
  const trimmed = partyPhoneRawString(stored).trim();
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

/** Digits-only national number input (blocks non-digits). */
export function normalizeNationalPhoneInput(
  raw: string,
  maxLength = 15,
): string {
  return raw.replace(/\D/g, "").slice(0, maxLength);
}

/** Typical national digit length for UI maxLength / realtime checks. */
export function nationalPhoneDigitLength(country: CountryCode): number {
  const example = getExampleNumber(country, examples);
  return example?.nationalNumber.length ?? 15;
}

/**
 * Blur validation for the national number given a selected country.
 * Empty → required (create-agreement parties); incomplete → format error.
 */
export function partyPhoneBlurError(
  nationalOrStored: string | null | undefined,
  country: CountryCode,
): string | null {
  const trimmed = partyPhoneRawString(nationalOrStored).trim();
  if (trimmed.length === 0) return PARTY_PHONE_REQUIRED_ERROR;

  const composed = trimmed.startsWith("+")
    ? trimmed
    : composePartyPhone(country, normalizeNationalPhoneInput(trimmed));
  return normalizePartyPhoneE164(composed) ? null : PARTY_PHONE_FORMAT_ERROR;
}

/**
 * Real-time (on-change) phone validation — empty / still-typing stay quiet.
 * Once national digits reach the country example length (or more), show the
 * same format error as blur if libphonenumber does not accept the number.
 */
export function partyPhoneChangeError(
  nationalOrStored: string | null | undefined,
  country: CountryCode,
): string | null {
  const trimmed = partyPhoneRawString(nationalOrStored).trim();
  if (trimmed.length === 0) return null;

  const national = normalizeNationalPhoneInput(trimmed);
  const composed = trimmed.startsWith("+")
    ? trimmed
    : composePartyPhone(country, national);
  if (normalizePartyPhoneE164(composed)) return null;

  if (national.length < nationalPhoneDigitLength(country)) return null;
  return PARTY_PHONE_FORMAT_ERROR;
}

/** Human-readable international format for Records / lists. */
export function formatPartyPhoneDisplay(
  phone: string | null | undefined,
): string {
  const trimmed = partyPhoneRawString(phone).trim();
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

/** Unique-key for duplicate checks — prefer E.164, else trimmed raw. */
export function partyPhoneUniqueKey(
  phone: string | null | undefined,
): string {
  const raw = partyPhoneRawString(phone);
  const e164 = normalizePartyPhoneE164(raw);
  if (e164) return e164;
  return raw.trim();
}

export function countryFlagEmoji(country: CountryCode): string {
  return country
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

export function countryDisplayName(country: CountryCode): string {
  try {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return names.of(country) ?? country;
  } catch {
    return country;
  }
}

export type PartyPhoneCountryOption = {
  country: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
  label: string;
};

let cachedCountryOptions: PartyPhoneCountryOption[] | null = null;

/** Searchable country list for the picker — priority countries first. */
export function listPartyPhoneCountries(): PartyPhoneCountryOption[] {
  if (cachedCountryOptions) return cachedCountryOptions;

  const priority = new Set(PRIORITY_PARTY_PHONE_COUNTRIES);
  const rest = getCountries()
    .filter((country) => !priority.has(country))
    .sort((a, b) =>
      countryDisplayName(a).localeCompare(countryDisplayName(b)),
    );

  const ordered = [...PRIORITY_PARTY_PHONE_COUNTRIES, ...rest];
  cachedCountryOptions = ordered.map((country) => {
    const name = countryDisplayName(country);
    const dialCode = `+${getCountryCallingCode(country)}`;
    const flag = countryFlagEmoji(country);
    return {
      country,
      name,
      dialCode,
      flag,
      label: `${flag} ${name} (${dialCode})`,
    };
  });
  return cachedCountryOptions;
}
