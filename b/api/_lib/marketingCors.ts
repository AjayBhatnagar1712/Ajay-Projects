import type { VercelRequest, VercelResponse } from "@vercel/node";

const PRODUCTION_MARKETING_ORIGIN = "https://trustkeyper.com";
const LOCAL_MARKETING_ORIGIN = "http://localhost:5174";

/** Stable staging / alias hosts — always allowlisted (env can still add extras). */
const BUILTIN_STAGING_MARKETING_ORIGINS = [
  "https://staging.trustkeyper.com",
  "https://www.trustkeyper.com",
  "https://trustkeyper-website.vercel.app",
] as const;

export type MarketingCorsRoute = "roles" | "summaries" | "profile";

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

export function getMarketingCorsAllowlist(): readonly string[] {
  const origins = new Set<string>([
    PRODUCTION_MARKETING_ORIGIN,
    LOCAL_MARKETING_ORIGIN,
    ...BUILTIN_STAGING_MARKETING_ORIGINS,
  ]);
  const staging = process.env.MARKETING_STAGING_ORIGIN?.trim();
  if (staging) origins.add(normalizeOrigin(staging));
  return [...origins];
}

export function requestOrigin(req: VercelRequest): string | undefined {
  const header = req.headers.origin ?? req.headers.Origin;
  if (Array.isArray(header)) return header[0];
  return typeof header === "string" ? header : undefined;
}

export function matchMarketingOrigin(originHeader: string | undefined): string | null {
  if (!originHeader) return null;
  const normalized = normalizeOrigin(originHeader);
  return getMarketingCorsAllowlist().includes(normalized) ? normalized : null;
}

export function getMarketingCorsRoute(
  segments: string[],
  method: string | undefined,
): MarketingCorsRoute | null {
  if (segments[0] !== "accounts" || !segments[1]) return null;

  const verb = (method ?? "GET").toUpperCase();

  if (segments.length === 3 && segments[2] === "roles" && verb === "GET") return "roles";
  if (segments.length === 3 && segments[2] === "summaries" && verb === "GET") return "summaries";
  if (segments.length === 4 && segments[3] === "profile" && (verb === "PUT" || verb === "OPTIONS")) {
    return "profile";
  }

  return null;
}

export function setMarketingCorsHeaders(
  res: VercelResponse,
  origin: string,
  route: MarketingCorsRoute,
): void {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");

  if (route === "profile") {
    res.setHeader("Access-Control-Allow-Methods", "PUT, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
    return;
  }

  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Accept");
}

/**
 * Handles OPTIONS preflight for the marketing profile PUT route only.
 * Returns true when the request was fully handled.
 */
export function handleMarketingCorsPreflight(
  req: VercelRequest,
  res: VercelResponse,
  segments: string[],
): boolean {
  if ((req.method ?? "").toUpperCase() !== "OPTIONS") return false;
  if (getMarketingCorsRoute(segments, "OPTIONS") !== "profile") return false;

  const origin = matchMarketingOrigin(requestOrigin(req));
  if (!origin) {
    res.status(403).end();
    return true;
  }

  setMarketingCorsHeaders(res, origin, "profile");
  res.status(204).end();
  return true;
}

export function resolveMarketingCorsOrigin(
  req: VercelRequest,
  segments: string[],
): string | null {
  const route = getMarketingCorsRoute(segments, req.method);
  if (!route) return null;
  return matchMarketingOrigin(requestOrigin(req));
}

export function setContactCorsHeaders(res: VercelResponse, origin: string): void {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

/**
 * Handles OPTIONS preflight for POST /api/contact.
 * Returns true when the request was fully handled.
 */
export function handleContactCorsPreflight(req: VercelRequest, res: VercelResponse): boolean {
  if ((req.method ?? "").toUpperCase() !== "OPTIONS") return false;

  const origin = matchMarketingOrigin(requestOrigin(req));
  if (!origin) {
    res.status(403).end();
    return true;
  }

  setContactCorsHeaders(res, origin);
  res.status(204).end();
  return true;
}

export function resolveContactCorsOrigin(req: VercelRequest): string | null {
  const method = (req.method ?? "").toUpperCase();
  if (method !== "POST" && method !== "OPTIONS") return null;
  return matchMarketingOrigin(requestOrigin(req));
}
