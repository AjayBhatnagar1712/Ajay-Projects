/**
 * Vercel-local sync JWT verification (bundled with /api/sync — do not import @workspace/* here).
 */
import { AuthClient, type GoTrueClient } from "@supabase/auth-js";

export type VerifiedSyncUser = {
  phone: string;
  userId: string;
};

export type SyncAuthResult =
  | { ok: true; user: VerifiedSyncUser }
  | { ok: false; status: 401 | 403; error: string };

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function getSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL?.trim() || undefined;
}

function getSupabaseAnonKey(): string | undefined {
  return process.env.SUPABASE_ANON_KEY?.trim() || undefined;
}

function isSyncAuthRequired(): boolean {
  if (process.env.SYNC_AUTH_DISABLED === "1") return false;
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

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

async function verifySyncBearerToken(
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

/** Payment routes — JWT phone match only; role/ownership checks added in later increments. */
export async function assertPaymentAuth(
  authorization: string | undefined,
  phone: string,
): Promise<SyncAuthResult> {
  return assertSyncAccountAuth(authorization, phone);
}

/**
 * JWT-only auth for user-scoped resources (e.g. brokers.user_id).
 * Does not require a phone path/body match.
 */
export async function assertJwtUserAuth(
  authorization: string | undefined,
): Promise<SyncAuthResult> {
  if (!isSyncAuthRequired()) {
    return {
      ok: true,
      user: {
        phone: "0000000000",
        userId: "00000000-0000-4000-8000-000000000001",
      },
    };
  }

  const user = await verifySyncBearerToken(authorization);
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true, user };
}
