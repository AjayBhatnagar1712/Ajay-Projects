/**
 * Vercel serverless entry for GET /api/payments-onboard-status — Route recipient status.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handlePaymentOnboardStatusRequest } from "./_lib/paymentOnboardHandler.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handlePaymentOnboardStatusRequest(req, res);
}

export default withSentryVercelHandler(handler, {
  route: "/api/payments-onboard-status",
  runtime: "vercel-function",
});
