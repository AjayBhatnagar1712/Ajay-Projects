/**
 * Vercel serverless entry for POST /api/payments-create-order — rent collection order.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handlePaymentCreateOrderRequest } from "./_lib/paymentOrderHandler.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handlePaymentCreateOrderRequest(req, res);
}

export default withSentryVercelHandler(handler, {
  route: "/api/payments-create-order",
  runtime: "vercel-function",
});
