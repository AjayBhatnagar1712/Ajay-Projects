/**
 * Vercel serverless entry for POST /api/razorpay-webhook — Razorpay payment ledger webhooks.
 * No auth middleware; signature verification is handled in the handler.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleRazorpayWebhookRequest } from "./_lib/razorpayWebhookHandler.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleRazorpayWebhookRequest(req, res);
}

export default withSentryVercelHandler(handler, {
  route: "/api/razorpay-webhook",
  runtime: "vercel-function",
});
