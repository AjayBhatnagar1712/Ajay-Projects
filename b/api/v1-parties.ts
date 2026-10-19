/**
 * Vercel serverless entry for GET /api/v1/parties?role=owner|tenant.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handlePartiesRequest } from "./_lib/partiesHandler.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handlePartiesRequest(req, res);
}

export default withSentryVercelHandler(handler, {
  route: "/api/v1/parties",
  runtime: "vercel-function",
});
