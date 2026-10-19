/**
 * Vercel serverless entry for /api/v1/review/:token (public, token-gated).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleLeaseAgreementReviewRequest } from "./_lib/leaseAgreementReviewHandler.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleLeaseAgreementReviewRequest(req, res);
}

export default withSentryVercelHandler(handler, {
  route: "/api/v1/review",
  runtime: "vercel-function",
});
