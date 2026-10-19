/**
 * Vercel serverless entry for GET /api/payments-owner-history —
 * authenticated owner rent payment history (includes settlement split).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOwnerPaymentHistoryRequest } from "./_lib/paymentReadHandler.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleOwnerPaymentHistoryRequest(req, res);
}

export default withSentryVercelHandler(handler, {
  route: "/api/payments-owner-history",
  runtime: "vercel-function",
});
