import {
  persistSessionToLocalStorage,
  setAuthPendingRole,
  type Role,
} from "./auth";
import { pushLocalKeysToCloud } from "./cloudSync";

type SessionReader = () => { phone: string; role: Role } | null;
type LoginFn = (phone: string, role: "tenant", accessToken?: string | null) => Promise<boolean>;

function tenantDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export async function ensureTenantDashboardSession(
  phone: string,
  getSession: SessionReader,
  login: LoginFn,
  accessToken?: string | null,
): Promise<boolean> {
  const digits = tenantDigits(phone);
  setAuthPendingRole("tenant");

  const session = getSession();
  if (session?.role === "tenant" && session.phone === digits) {
    return true;
  }

  return login(digits, "tenant", accessToken);
}

/** Establishes tenant login state after document upload and syncs account data to cloud. */
export async function finalizeTenantDashboardAccess(
  phone: string,
  getSession: SessionReader,
  login: LoginFn,
  options?: { remember?: boolean; accessToken?: string | null },
): Promise<boolean> {
  const digits = tenantDigits(phone);
  const ok = await ensureTenantDashboardSession(digits, getSession, login, options?.accessToken);
  if (!ok) return false;

  setAuthPendingRole("tenant");
  if (options?.remember) {
    persistSessionToLocalStorage(digits, "tenant");
  }
  void pushLocalKeysToCloud(digits, "tenant", options?.accessToken ?? undefined);
  return true;
}
