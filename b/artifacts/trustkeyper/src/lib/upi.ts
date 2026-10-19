/** Indian UPI VPA: username@psp (2–256 chars before @, 2–64 letter PSP). */
export const UPI_ID_REGEX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;

export function isValidUpiId(id: string): boolean {
  return UPI_ID_REGEX.test(id.trim());
}

/** Restrict typing to characters allowed in a UPI ID. */
export function sanitizeUpiInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._@-]/g, "").slice(0, 260);
}
