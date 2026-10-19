import { AuthClient, type GoTrueClient } from "@supabase/auth-js";
import { getSupabaseAnonKey, getSupabaseUrl, isSyncAuthRequired } from "./env.js";
import { normalizePhoneDigits } from "./phone.js";

export type VerifiedSyncUser = {
  phone: string;
  userId: string;
};

export type SyncAuthResult =
  | { ok: true; user: VerifiedSyncUser }
  | { ok: false; status: 401 | 403; error: string };

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

export function parseBearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/** Validates JWT via Supabase Auth and returns the user's 10-digit phone. */
export async function verifySyncBearerToken(
  authorization: string | undefined,
): Promise<VerifiedSyncUser | null> {
  const token = parseBearerToken(authorization);
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await getVerifierClient().getUser(token);

  if (error || !user?.phone) return null;

  const phone = normalizePhoneDigits(user.phone);
  if (phone.length !== 10) return null;

  return { phone, userId: user.id };
}

/**
 * Ensures the caller may access sync data for `pathPhone`.
 * Public routes (exists, roles) should not call this.
 */
export async function assertSyncAccountAuth(
  authorization: string | undefined,
  pathPhone: string,
): Promise<SyncAuthResult> {
  const normalizedPathPhone = normalizePhoneDigits(pathPhone);
  if (normalizedPathPhone.length !== 10) {
    return { ok: false, status: 403, error: "Invalid phone" };
  }

  if (!isSyncAuthRequired()) {
    return { ok: true, user: { phone: normalizedPathPhone, userId: "local-dev" } };
  }

  const user = await verifySyncBearerToken(authorization);
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  if (user.phone !== normalizedPathPhone) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, user };
}
