import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizePhoneDigits } from "@workspace/auth-server/phone";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveSessionIdentity,
  saveSessionTokens,
} from "./secureSession";
import { NETWORK_TIMEOUT_MS, withTimeout } from "../network/withTimeout";

export const OTP_SEND_TIMEOUT_MESSAGE =
  "Couldn't send code. Check your connection and try again.";

export const OTP_VERIFY_TIMEOUT_MESSAGE =
  "Couldn't verify code. Check your connection and try again.";

/**
 * Metro only inlines EXPO_PUBLIC_* when accessed as a static member
 * (process.env.EXPO_PUBLIC_FOO). Computed/bracket process.env lookups are
 * never replaced and are always undefined in release bundles.
 */
function requireSupabaseUrl(): string {
  const value = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL. Copy apps/mobile/.env.example to .env",
    );
  }
  return value;
}

function requireSupabaseAnonKey(): string {
  const value = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy apps/mobile/.env.example to .env",
    );
  }
  return value;
}

let client: SupabaseClient | null = null;
let refreshListenerAttached = false;

async function persistSessionTokens(session: {
  access_token: string;
  refresh_token: string;
}): Promise<void> {
  await saveSessionTokens({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  });
}

function attachTokenRefreshListener(supabase: SupabaseClient): void {
  if (refreshListenerAttached) {
    return;
  }
  refreshListenerAttached = true;
  supabase.auth.onAuthStateChange((event, session) => {
    if ((event === "TOKEN_REFRESHED" || event === "SIGNED_IN") && session) {
      void persistSessionTokens(session);
    }
  });
}

export function getSupabase(): SupabaseClient {
  if (client) {
    return client;
  }
  client = createClient(requireSupabaseUrl(), requireSupabaseAnonKey(), {
    auth: {
      // Tokens live in SecureStore via saveSessionTokens — not AsyncStorage.
      persistSession: false,
      // Brokers often reopen the app after hours/days idle; refresh instead of forcing OTP.
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  attachTokenRefreshListener(client);
  return client;
}

/** Sends SMS OTP via Supabase Auth (Twilio Verify is configured in Supabase). */
export async function sendPhoneOtp(phoneDigits: string): Promise<string | null> {
  try {
    const phone = normalizePhoneDigits(phoneDigits);
    const { error } = await withTimeout(
      getSupabase().auth.signInWithOtp({
        phone: `+91${phone}`,
      }),
      NETWORK_TIMEOUT_MS,
      OTP_SEND_TIMEOUT_MESSAGE,
    );
    return error?.message ?? null;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Missing EXPO_PUBLIC")) {
      return "App configuration error. Please reinstall or contact support.";
    }
    return err instanceof Error ? err.message : OTP_SEND_TIMEOUT_MESSAGE;
  }
}

/** Verifies SMS OTP and persists tokens in SecureStore (never AsyncStorage). */
export async function verifyPhoneOtp(
  phoneDigits: string,
  token: string,
): Promise<{ error: string | null; accessToken: string | null }> {
  try {
    const phone = normalizePhoneDigits(phoneDigits);
    const { data, error } = await withTimeout(
      getSupabase().auth.verifyOtp({
        phone: `+91${phone}`,
        token,
        type: "sms",
      }),
      NETWORK_TIMEOUT_MS,
      OTP_VERIFY_TIMEOUT_MESSAGE,
    );

    const accessToken = data.session?.access_token ?? null;
    if (data.session) {
      await persistSessionTokens(data.session);
      await saveSessionIdentity({ phone });
    }

    return {
      error: error?.message ?? null,
      accessToken,
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Missing EXPO_PUBLIC")) {
      return {
        error: "App configuration error. Please reinstall or contact support.",
        accessToken: null,
      };
    }
    return {
      error: err instanceof Error ? err.message : OTP_VERIFY_TIMEOUT_MESSAGE,
      accessToken: null,
    };
  }
}

export async function signOut(): Promise<void> {
  try {
    await getSupabase().auth.signOut();
  } finally {
    await clearSession();
  }
}

/**
 * Hydrates the in-memory Supabase client from SecureStore.
 * Returns false when tokens are missing or the refresh fails (caller should clear + re-auth).
 */
export async function restoreSupabaseSession(): Promise<boolean> {
  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();
  if (!accessToken || !refreshToken) {
    return false;
  }

  const { data, error } = await getSupabase().auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    return false;
  }

  // setSession may rotate tokens when the access JWT was expired — persist the fresh pair.
  await persistSessionTokens(data.session);
  return true;
}
