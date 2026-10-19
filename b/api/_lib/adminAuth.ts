/**
 * Server-side admin auth — JWT verification + ADMIN_PHONES allowlist check
 */
import { AuthClient, type GoTrueClient } from "@supabase/auth-js";

/** Successful admin authentication — verified phone from JWT. */
export type AdminAuthSuccess = { ok: true; phone: string };

/** Failed admin authentication with HTTP status and message. */
export type AdminAuthFailure = { ok: false; status: number; error: string };

/** Result of {@link assertAdminAuth} — never throws. */
export type AdminAuthResult = AdminAuthSuccess | AdminAuthFailure;

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function getSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL?.trim() || undefined;
}

function getSupabaseAnonKey(): string | undefined {
  return process.env.SUPABASE_ANON_KEY?.trim() || undefined;
}

/**
 * True when Supabase JWT verification is required for admin routes.
 * Mirrors sync auth: disabled when `SYNC_AUTH_DISABLED=1` or Supabase env is missing.
 */
function isAdminAuthRequired(): boolean {
  if (process.env.SYNC_AUTH_DISABLED === "1") return false;
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

const rawAdminPhones = process.env.ADMIN_PHONES ?? "";

/** Normalized 10-digit admin phones from `ADMIN_PHONES` (comma-separated). */
export const ADMIN_PHONES: readonly string[] = rawAdminPhones
  .split(",")
  .map((entry) => normalizePhoneDigits(entry.trim()))
  .filter((digits) => digits.length === 10);

let verifierClient: GoTrueClient | null = null;

function getVerifierClient(): GoTrueClient {
  if (verifierClient) return verifierClient;

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error("Supabase env missing (SUPABASE_URL, SUPABASE_ANON_KEY)");
  }

  verifierClient = new AuthClient({
    url: `${url.replace(/\/$/, "")}/auth/v1`,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    persistSession: false,
    autoRefreshToken: false,
  });
  return verifierClient;
}

function parseBearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Verifies a Supabase access token and returns the user's normalized phone.
 * @param authorization - `Authorization` header value.
 */
async function verifyAdminBearerToken(
  authorization: string | undefined,
): Promise<string | null> {
  const token = parseBearerToken(authorization);
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await getVerifierClient().getUser(token);

  if (error || !user?.phone) return null;

  const phone = normalizePhoneDigits(user.phone);
  if (phone.length !== 10) return null;

  return phone;
}

/**
 * Returns true when the phone is in the server admin allowlist.
 * @param phone - Raw or formatted phone string.
 */
export function isServerAdminPhone(phone: string): boolean {
  const digits = normalizePhoneDigits(phone);
  if (digits.length !== 10) return false;
  if (ADMIN_PHONES.length === 0) return false;
  return ADMIN_PHONES.includes(digits);
}

/**
 * Verifies Bearer JWT via Supabase and checks the phone against `ADMIN_PHONES`.
 * Never throws — returns a typed success or failure result.
 * @param authHeader - `Authorization` header (Bearer JWT).
 */
export async function assertAdminAuth(
  authHeader: string | undefined,
): Promise<AdminAuthResult> {
  try {
    if (ADMIN_PHONES.length === 0) {
      return { ok: false, status: 403, error: "Admin access is not configured" };
    }

    if (!isAdminAuthRequired()) {
      const phone = ADMIN_PHONES[0];
      if (!phone) {
        return { ok: false, status: 403, error: "Admin access is not configured" };
      }
      return { ok: true, phone };
    }

    const phone = await verifyAdminBearerToken(authHeader);
    if (!phone) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }

    if (!isServerAdminPhone(phone)) {
      return { ok: false, status: 403, error: "Forbidden" };
    }

    return { ok: true, phone };
  } catch {
    return { ok: false, status: 500, error: "Authentication service unavailable" };
  }
}

/**
 * Reads the Authorization header from a Vercel request (handles string | string[]).
 * @param headers - Request headers object.
 */
export function readAuthorizationHeader(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const header = headers.authorization ?? headers.Authorization;
  if (Array.isArray(header)) return header[0];
  return header;
}
