import {
  type Role,
  isAuthEntryRole,
  loginSuccess,
  persistSessionToLocalStorage,
} from "@/lib/auth";
import { normalizePhoneDigits } from "@/lib/storageKeys";
import { supabase } from "@/lib/supabaseClient";

export interface MarketingSessionTokens {
  access_token: string;
  refresh_token?: string;
}

export interface MarketingHandoffParams {
  phone: string;
  role: Role;
  rememberMe: boolean;
  tokens: MarketingSessionTokens | null;
}

const SESSION_HASH_PREFIX = "tk_session=";

export function getMarketingSiteUrl(): string | null {
  const configured = import.meta.env.VITE_MARKETING_URL;
  if (typeof configured !== "string" || !configured.trim()) return null;
  return configured.replace(/\/$/, "");
}

export function buildMarketingAuthRedirectUrl(mode: "login" | "signup"): string | null {
  const base = getMarketingSiteUrl();
  if (!base) return null;
  return `${base}#${mode}`;
}

export function decodeMarketingSessionHash(hash: string): MarketingSessionTokens | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.startsWith(SESSION_HASH_PREFIX)) return null;
  try {
    const encoded = raw.slice(SESSION_HASH_PREFIX.length);
    const parsed = JSON.parse(atob(decodeURIComponent(encoded))) as MarketingSessionTokens;
    if (typeof parsed.access_token !== "string" || !parsed.access_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseMarketingHandoffFromWindow(): MarketingHandoffParams | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") !== "marketing") return null;

  const phone = normalizePhoneDigits(params.get("phone") ?? "");
  const roleParam = params.get("role") ?? "";
  if (phone.length !== 10 || !isAuthEntryRole(roleParam)) return null;

  return {
    phone,
    role: roleParam,
    rememberMe: params.get("remember") === "1",
    tokens: decodeMarketingSessionHash(window.location.hash),
  };
}

async function phoneMatchesSupabaseSession(expectedPhone: string): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionPhone = session?.user.phone?.replace(/\D/g, "").slice(-10) ?? "";
  return sessionPhone === expectedPhone;
}

export async function applyMarketingHandoff(
  handoff: MarketingHandoffParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!handoff.tokens?.access_token) {
    return { ok: false, error: "Missing verification session. Please log in again." };
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: handoff.tokens.access_token,
    refresh_token: handoff.tokens.refresh_token ?? "",
  });
  if (sessionError) {
    return { ok: false, error: "Could not restore your session. Please log in again." };
  }

  if (!(await phoneMatchesSupabaseSession(handoff.phone))) {
    await supabase.auth.signOut();
    return { ok: false, error: "Phone verification mismatch. Please log in again." };
  }

  const loggedIn = await loginSuccess(handoff.phone, handoff.role, handoff.tokens.access_token);
  if (!loggedIn) {
    return { ok: false, error: "Could not load your account. Please try again." };
  }

  if (handoff.rememberMe) {
    persistSessionToLocalStorage(handoff.phone, handoff.role);
  }

  return { ok: true };
}

export function clearMarketingHandoffFromUrl(): void {
  if (typeof window === "undefined") return;
  window.history.replaceState({}, document.title, window.location.pathname);
}
