/**
 * Resolves the API base URL for frontend fetch calls.
 * Local dev must include `/api` (e.g. http://localhost:8080/api). When unset, uses
 * same-origin `/api` which Vite proxies to the API server.
 *
 * At runtime, ignores build-time localhost URLs when the page is not served from localhost
 * (common production misconfiguration when VITE_API_URL is set for dev only).
 */
function isBrowserLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function normalizeConfiguredApiBase(rawEnv: string | undefined): string {
  const raw = typeof rawEnv === "string" ? rawEnv.trim().replace(/\/$/, "") : "";
  if (!raw) return "/api";
  if (/localhost|127\.0\.0\.1/.test(raw) && !isBrowserLocalHost()) {
    return "/api";
  }
  if (raw.endsWith("/api")) return raw;
  return `${raw}/api`;
}

export function resolveApiBase(): string {
  return normalizeConfiguredApiBase(import.meta.env.VITE_API_URL as string | undefined);
}

/** Prefer this for fetch calls so production never uses a stale localhost build URL. */
export function getApiBase(): string {
  return resolveApiBase();
}

export const API_BASE = resolveApiBase();
