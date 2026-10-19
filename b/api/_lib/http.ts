import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setMarketingCorsHeaders, type MarketingCorsRoute } from "./marketingCors.js";

export function json(
  res: VercelResponse,
  status: number,
  body: unknown,
  cors?: { origin: string; route: MarketingCorsRoute },
): void {
  res.status(status).setHeader("Content-Type", "application/json");
  if (cors) {
    setMarketingCorsHeaders(res, cors.origin, cors.route);
  }
  res.end(JSON.stringify(body));
}

export function readJsonBody(req: VercelRequest): unknown {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}
