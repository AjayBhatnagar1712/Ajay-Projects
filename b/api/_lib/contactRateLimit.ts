import type { VercelRequest } from "@vercel/node";

const CONTACT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const CONTACT_RATE_LIMIT_MAX_REQUESTS = 3;

const requestTimestampsByIp = new Map<string, number[]>();
let lastCleanupAt = 0;

/**
 * Derives client IP from Vercel-forwarded headers.
 */
export function getContactClientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const first = raw.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

function cleanupExpiredEntries(now: number): void {
  if (now - lastCleanupAt < CONTACT_RATE_LIMIT_WINDOW_MS) return;
  lastCleanupAt = now;

  for (const [ip, timestamps] of requestTimestampsByIp.entries()) {
    const recent = timestamps.filter((timestamp) => now - timestamp < CONTACT_RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      requestTimestampsByIp.delete(ip);
      continue;
    }
    requestTimestampsByIp.set(ip, recent);
  }
}

export type ContactRateLimitResult = { ok: true } | { ok: false; status: 429; error: string };

/**
 * In-memory rolling-window rate limiter (per serverless instance only).
 */
export function checkContactRateLimit(
  ip: string,
  now: number = Date.now(),
): ContactRateLimitResult {
  cleanupExpiredEntries(now);

  const recent = (requestTimestampsByIp.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < CONTACT_RATE_LIMIT_WINDOW_MS,
  );

  if (recent.length >= CONTACT_RATE_LIMIT_MAX_REQUESTS) {
    return {
      ok: false,
      status: 429,
      error: "Too many requests. Please try again in a few minutes.",
    };
  }

  recent.push(now);
  requestTimestampsByIp.set(ip, recent);
  return { ok: true };
}

/** Clears in-memory buckets — test helper only. */
export function resetContactRateLimitStore(): void {
  requestTimestampsByIp.clear();
  lastCleanupAt = 0;
}
