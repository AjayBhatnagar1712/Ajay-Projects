import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";
import { handleLeaseRentOrderRequest } from "./_lib/leasePaymentHandler.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleLeaseRentOrderRequest(req, res);
}

export default withSentryVercelHandler(handler, { route: "/api/payments-create-lease-rent-order" });
