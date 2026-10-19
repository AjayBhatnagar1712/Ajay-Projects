/**
 * Vercel serverless entry for POST /api/v1/location-details.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";
import { handleLocationDetailsRequest } from "./_lib/locationHandler.js";

async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  await handleLocationDetailsRequest(req, res);
}

export default withSentryVercelHandler(handler, { route: "/api/v1/location-details" });
