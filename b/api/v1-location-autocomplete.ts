/**
 * Vercel serverless entry for POST /api/v1/location-autocomplete.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";
import { handleLocationAutocompleteRequest } from "./_lib/locationHandler.js";

async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  await handleLocationAutocompleteRequest(req, res);
}

export default withSentryVercelHandler(handler, { route: "/api/v1/location-autocomplete" });
