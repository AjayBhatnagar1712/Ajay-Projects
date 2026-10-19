import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handlePaymentReleaseEscrowRequest } from "./_lib/paymentEscrowHandler.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handlePaymentReleaseEscrowRequest(req, res);
}

export default withSentryVercelHandler(handler, {
  route: "/api/payments-release-escrow",
  runtime: "vercel-function",
});
