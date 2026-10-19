/** Server-side Supabase URL (not VITE_ prefixed). */
export function getSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL?.trim() || undefined;
}

/** Server-side anon/publishable key for JWT verification only — never service role. */
export function getSupabaseAnonKey(): string | undefined {
  return process.env.SUPABASE_ANON_KEY?.trim() || undefined;
}

/**
 * When true, sync read/write routes require a valid Supabase JWT whose phone matches the URL.
 * Disabled automatically when Supabase env is missing (local mock / PGlite without OTP).
 */
export function isSyncAuthRequired(): boolean {
  if (process.env.SYNC_AUTH_DISABLED === "1") return false;
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
