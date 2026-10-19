/**
 * Vercel serverless entry for GET /api/payments-tenant-history —
 * authenticated tenant rent payment history.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleTenantPaymentHistoryRequest } from "./_lib/paymentReadHandler.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleTenantPaymentHistoryRequest(req, res);
}

export default withSentryVercelHandler(handler, {
  route: "/api/payments-tenant-history",
  runtime: "vercel-function",
});
