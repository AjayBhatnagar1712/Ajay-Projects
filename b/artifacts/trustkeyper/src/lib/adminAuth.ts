/**
 * Client-side admin portal auth: allowlisted phones, session checks, and route guards.
 * Server APIs must independently verify JWT + ADMIN_PHONES — this module is UX only.
 */
import { getActiveSession } from "./auth";
import { normalizePhoneDigits } from "./storageKeys";

/** Trustkeyper admin portal primary brand colour (navy). */
export const ADMIN_PRIMARY = "#1B4F8A";

const rawAdminPhones = (import.meta.env.VITE_ADMIN_PHONES as string | undefined) ?? "";

/** Normalized 10-digit admin phones from VITE_ADMIN_PHONES (comma-separated). */
export const ADMIN_PHONES: readonly string[] = rawAdminPhones
  .split(",")
  .map((entry) => normalizePhoneDigits(entry.trim()))
  .filter((digits) => digits.length === 10);

/**
 * Returns true when the given phone is in the client admin allowlist.
 * @param phone - Raw or formatted phone string.
 */
export function isAdminPhone(phone: string): boolean {
  const digits = normalizePhoneDigits(phone);
  if (digits.length !== 10) return false;
  return ADMIN_PHONES.includes(digits);
}

/**
 * Returns the active admin session phone, or null when role is not admin.
 */
export function getAdminSession(): { phone: string } | null {
  const session = getActiveSession();
  if (!session || session.role !== "admin") return null;
  return { phone: session.phone };
}

/**
 * Ensures an admin session exists; redirects to login when missing.
 * @param redirect - Navigation callback (e.g. wouter setLocation).
 * @returns Admin session phone, or null after scheduling redirect.
 */
export function requireAdminSession(
  redirect: (path: string) => void,
): { phone: string } | null {
  const session = getAdminSession();
  if (session) return session;
  redirect("/admin/login");
  return null;
}
