/**
 * Vercel serverless entry for POST /api/feedback — user feedback ingestion.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleFeedbackRequest } from "./_lib/feedbackHandler.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

/**
 * Handles POST /api/feedback.
 * @param req - Incoming Vercel request.
 * @param res - Vercel response.
 * @returns Promise that resolves when the handler completes.
 */
async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleFeedbackRequest(req, res);
}

export default withSentryVercelHandler(handler, {
  route: "/api/feedback",
  runtime: "vercel-function",
});
