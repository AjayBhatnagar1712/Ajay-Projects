/**
 * Vercel serverless entry for POST /api/contact — marketing site contact form.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleContactRequest } from "./_lib/contactHandler.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleContactRequest(req, res);
}

export default withSentryVercelHandler(handler, {
  route: "/api/contact",
  runtime: "vercel-function",
});
