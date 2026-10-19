/**
 * Aadhaar number checks for TrustKeyper party forms.
 *
 * Verhoeff validates the UIDAI check digit only. It does **not** call UIDAI,
 * prove the number is issued, or detect a fabricated number that still has a
 * valid checksum.
 */

/** User-facing copy when 12 digits fail format/checksum (not a live UIDAI check). */
export const AADHAAR_INVALID_ERROR = "Invalid Aadhaar number";

export const AADHAAR_LENGTH_ERROR = "Aadhaar must be 12 digits";

/** Multiplication table (dihedral group D5). */
const VERHOEFF_D: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

/** Permutation table. */
const VERHOEFF_P: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Digits only, at most 12 — for controlled text input. */
export function normalizeAadhaarDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 12);
}

/**
 * Verhoeff checksum over a digit string (full number including check digit).
 * Valid when the running checksum ends at 0.
 */
export function verhoeffChecksumOk(digits: string): boolean {
  if (!/^\d+$/.test(digits) || digits.length === 0) return false;
  let c = 0;
  const reversed = digits.split("").map(Number).reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    const digit = reversed[i];
    if (digit === undefined) return false;
    const permRow = VERHOEFF_P[i % 8];
    const multRow = VERHOEFF_D[c];
    if (!permRow || !multRow) return false;
    const permuted = permRow[digit];
    if (permuted === undefined) return false;
    const next = multRow[permuted];
    if (next === undefined) return false;
    c = next;
  }
  return c === 0;
}

/**
 * Structural Aadhaar validity: 12 digits, first digit 2–9 (UIDAI), Verhoeff OK.
 * Not a live UIDAI verification.
 */
export function isValidAadhaarNumber(raw: string | null | undefined): boolean {
  const digits = normalizeAadhaarDigits(raw ?? "");
  if (!/^[2-9]\d{11}$/.test(digits)) return false;
  return verhoeffChecksumOk(digits);
}
