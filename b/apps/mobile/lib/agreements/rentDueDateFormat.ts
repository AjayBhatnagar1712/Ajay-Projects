/**
 * Helpers for rent-due day digits.
 *
 * The editable TextInput must ONLY ever hold digits (`parseRentDueDayInput`).
 * Ordinal + phrase belong in TextField's trailing Affix (same as Notice
 * `suffix="months"`), never baked into the input value.
 */

import {
  rentDueDateOrdinalParticle,
  rentDueDateTrailingPhrase,
} from "./dateHelpers";

/** Digits only, max 2 chars, clamped to a storable 1–31 day (or empty). */
export function parseRentDueDayInput(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 2);
  if (digits.length === 0) return "";

  // No bare 0 / 00 — day must be 1–31.
  if (/^0+$/.test(digits)) return "";

  // Leading zero from paste ("05") → single significant digit.
  if (digits.startsWith("0")) {
    return parseRentDueDayInput(digits.slice(1));
  }

  const n = Number(digits);
  if (n >= 1 && n <= 31) return digits;

  // e.g. typing "32" — keep the first digit when it alone is valid.
  return parseRentDueDayInput(digits.slice(0, 1));
}

/**
 * Continuous display string for non-input surfaces (preview copy, a11y).
 * Never set this as TextInput `value`. Empty / invalid → "".
 */
export function formatRentDueDateDisplay(dayRaw: string): string {
  const digits = parseRentDueDayInput(dayRaw);
  const particle = rentDueDateOrdinalParticle(digits);
  if (!particle) return "";
  return `${digits}${particle} ${rentDueDateTrailingPhrase()}`;
}
