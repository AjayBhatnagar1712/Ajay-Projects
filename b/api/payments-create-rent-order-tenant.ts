/**
 * Vercel serverless entry for POST /api/payments-create-rent-order-tenant —
 * tenant-initiated monthly rent collection order.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleTenantRentOrderRequest } from "./_lib/paymentOrderHandler.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleTenantRentOrderRequest(req, res);
}

export default withSentryVercelHandler(handler, {
  route: "/api/payments-create-rent-order-tenant",
  runtime: "vercel-function",
});
