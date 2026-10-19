/** Last 10 digits — matches sync-store and frontend normalizePhoneDigits. */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}
