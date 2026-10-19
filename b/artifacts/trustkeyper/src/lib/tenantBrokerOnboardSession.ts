/** Session for broker-assisted tenant onboarding — raw sessionStorage, not account-scoped. */

const KEY_PREFIX = "tk_broker_tenant_onboard_";

export interface TenantBrokerOnboardSession {
  token: string;
  name: string;
  phone: string;
  brokerName: string;
  verifiedAt: number;
}

function sessionKey(token: string): string {
  return `${KEY_PREFIX}session_${token}`;
}

function draftKey(token: string): string {
  return `${KEY_PREFIX}draft_${token}`;
}

export function getTenantBrokerOnboardSession(token: string): TenantBrokerOnboardSession | null {
  if (typeof window === "undefined" || !token) return null;
  try {
    const raw = sessionStorage.getItem(sessionKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TenantBrokerOnboardSession;
    if (parsed.token !== token) return null;
    if (!parsed.name?.trim() || !parsed.phone?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setTenantBrokerOnboardSession(session: TenantBrokerOnboardSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(sessionKey(session.token), JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function clearTenantBrokerOnboardSession(token: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(sessionKey(token));
    sessionStorage.removeItem(draftKey(token));
  } catch {
    /* ignore */
  }
}

export function getTenantOnboardDraft<T>(token: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(draftKey(token));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function setTenantOnboardDraft(token: string, draft: unknown): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(draftKey(token), JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}
