/** Public tenant share session — uses raw sessionStorage, not account-scoped keys. */

const KEY_PREFIX = "tk_public_share_";

export interface TenantShareSession {
  propertyId: string;
  name: string;
  phone: string;
  verifiedAt: number;
}

function sessionKey(propertyId: string): string {
  return `${KEY_PREFIX}session_${propertyId}`;
}

function responseKey(propertyId: string): string {
  return `${KEY_PREFIX}response_${propertyId}`;
}

export function getTenantShareSession(propertyId: string): TenantShareSession | null {
  if (typeof window === "undefined" || !propertyId) return null;
  try {
    const raw = sessionStorage.getItem(sessionKey(propertyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TenantShareSession;
    if (parsed.propertyId !== propertyId) return null;
    if (!parsed.name?.trim() || !parsed.phone?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setTenantShareSession(session: TenantShareSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(sessionKey(session.propertyId), JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function clearTenantShareSession(propertyId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(sessionKey(propertyId));
    sessionStorage.removeItem(responseKey(propertyId));
  } catch {
    /* ignore */
  }
}

export type TenantShareResponse = "interested" | "not_interested";

export function getTenantShareResponse(propertyId: string): TenantShareResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(responseKey(propertyId));
    if (raw === "interested" || raw === "not_interested") return raw;
    return null;
  } catch {
    return null;
  }
}

export function setTenantShareResponse(propertyId: string, response: TenantShareResponse): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(responseKey(propertyId), response);
  } catch {
    /* ignore */
  }
}
