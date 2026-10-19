/**
 * Vercel serverless entry for /api/v1/lease-agreements (+ /:id, /:id/renew, parties, inventory).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleLeaseAgreementRequest } from "./_lib/leaseAgreementHandler.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleLeaseAgreementRequest(req, res);
}

export default withSentryVercelHandler(handler, {
  route: "/api/v1/lease-agreements",
  runtime: "vercel-function",
});
