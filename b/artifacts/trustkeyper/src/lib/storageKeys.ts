import { restoreActiveSessionFromBackup } from "./initAppStorage";

// Returns the active phone + role from session (restores from local backup if needed)
export function getActiveSession(): { phone: string; role: string } | null {
  restoreActiveSessionFromBackup();
  const phone = sessionStorage.getItem("tk_active_phone");
  const role = sessionStorage.getItem("tk_active_role");
  if (!phone || !role) return null;
  return { phone, role };
}

// Master key builder — ALL storage access must go through this
export function storageKey(phone: string, role: string, dataType: string): string {
  return `tk_${phone}_${role}_${dataType}`;
}

// Convenience: get a key for the CURRENT active session
export function activeKey(dataType: string): string | null {
  const session = getActiveSession();
  if (!session) return null;
  return storageKey(session.phone, session.role, dataType);
}

// Convenience wrappers
export function getItem(dataType: string): string | null {
  const key = activeKey(dataType);
  return key ? localStorage.getItem(key) : null;
}

export function setItem(dataType: string, value: string): void {
  const key = activeKey(dataType);
  if (key) localStorage.setItem(key, value);
}

export function removeItem(dataType: string): void {
  const key = activeKey(dataType);
  if (key) localStorage.removeItem(key);
}

// Session storage variant
export function getSessionItem(dataType: string): string | null {
  const key = activeKey(dataType);
  return key ? sessionStorage.getItem(key) : null;
}

export function setSessionItem(dataType: string, value: string): void {
  const key = activeKey(dataType);
  if (key) sessionStorage.setItem(key, value);
}

export function removeSessionItem(dataType: string): void {
  const key = activeKey(dataType);
  if (key) sessionStorage.removeItem(key);
}

/** Write local storage for a specific account (used when restoring from cloud). */
export function writeLocalForAccount(
  phone: string,
  role: string,
  dataType: string,
  value: string,
  mirrorSession = true,
): void {
  const key = storageKey(phone, role, dataType);
  try {
    localStorage.setItem(key, value);
    if (mirrorSession) {
      const session = getActiveSession();
      if (session?.phone === phone && session?.role === role) {
        sessionStorage.setItem(key, value);
      }
    }
  } catch {
    /* quota / private mode */
  }
}

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}
