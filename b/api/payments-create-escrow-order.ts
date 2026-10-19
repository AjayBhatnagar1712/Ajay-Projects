import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handlePaymentCreateEscrowOrderRequest } from "./_lib/paymentEscrowHandler.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handlePaymentCreateEscrowOrderRequest(req, res);
}

export default withSentryVercelHandler(handler, {
  route: "/api/payments-create-escrow-order",
  runtime: "vercel-function",
});
