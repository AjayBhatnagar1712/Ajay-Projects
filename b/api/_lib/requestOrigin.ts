import type { VercelRequest } from "@vercel/node";

/**
 * Public origin for links in emails and review URLs (API and app share the Vercel host).
 */
export function requestOrigin(req: VercelRequest): string {
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const protoHeader = req.headers["x-forwarded-proto"] ?? "https";
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  if (host) return `${proto}://${host}`;
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;
  return "https://app.trustkeyper.com";
}
