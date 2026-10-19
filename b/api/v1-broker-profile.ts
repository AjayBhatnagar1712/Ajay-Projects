/**
 * Vercel serverless entry for GET|PATCH /api/v1/broker/profile.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleBrokerProfileRequest } from "./_lib/brokerProfileHandler.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleBrokerProfileRequest(req, res);
}

export default withSentryVercelHandler(handler, {
  route: "/api/v1/broker/profile",
  runtime: "vercel-function",
});
