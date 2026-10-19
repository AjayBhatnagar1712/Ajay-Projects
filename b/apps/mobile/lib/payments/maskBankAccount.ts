/**
 * Mask a bank account for display. Example: last four "0251" → "••••0251".
 */

export function maskBankAccountLast4(
  last4: string | null | undefined,
): string | null {
  if (last4 == null) return null;
  const digits = last4.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return `••••${digits.slice(-4)}`;
}
