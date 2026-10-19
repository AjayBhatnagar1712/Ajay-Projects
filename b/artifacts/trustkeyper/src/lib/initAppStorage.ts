import type { Role } from "./auth";
import { pullAccountFromCloud } from "./cloudSync";
import { migrateLegacyStorage, migrateLegacyStorageGlobal } from "./storageMigration";

const VALID_ROLES: Role[] = ["broker", "owner", "tenant", "manager"];

const BACKUP_PHONE_KEY = "tk_session_backup_phone";
const BACKUP_ROLE_KEY = "tk_session_backup_role";

/**
 * Mobile browsers and installed web apps often clear sessionStorage when the
 * tab or PWA is closed. Restore the active session from localStorage backup
 * so namespaced data reads keep working without changing login flows.
 */
export function restoreActiveSessionFromBackup(): void {
  if (typeof window === "undefined") return;
  try {
    const phone = sessionStorage.getItem("tk_active_phone");
    const role = sessionStorage.getItem("tk_active_role");
    if (phone && role) return;

    const backupPhone = localStorage.getItem(BACKUP_PHONE_KEY);
    const backupRole = localStorage.getItem(BACKUP_ROLE_KEY);
    if (!backupPhone || !backupRole || !VALID_ROLES.includes(backupRole as Role)) return;

    sessionStorage.setItem("tk_active_phone", backupPhone);
    sessionStorage.setItem("tk_active_role", backupRole);
  } catch {
    /* ignore */
  }
}

export function persistActiveSessionBackup(phone: string, role: Role): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BACKUP_PHONE_KEY, phone);
    localStorage.setItem(BACKUP_ROLE_KEY, role);
  } catch {
    /* ignore */
  }
}

export function clearActiveSessionBackup(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(BACKUP_PHONE_KEY);
    localStorage.removeItem(BACKUP_ROLE_KEY);
  } catch {
    /* ignore */
  }
}

/** Run once before React mounts — same code path for mobile and desktop web. */
export function initAppStorage(): void {
  if (typeof window === "undefined") return;
  restoreActiveSessionFromBackup();
  migrateLegacyStorageGlobal();

  try {
    const phone = sessionStorage.getItem("tk_active_phone");
    const role = sessionStorage.getItem("tk_active_role") as Role | null;
    if (phone && role && VALID_ROLES.includes(role)) {
      migrateLegacyStorage(phone, role);
      void pullAccountFromCloud(phone, role);
    }
  } catch {
    /* ignore */
  }
}
