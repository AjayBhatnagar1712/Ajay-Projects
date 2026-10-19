/**
 * GET /api/admin/feedback — all user feedback submissions (admin only).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertAdminAuth, readAuthorizationHeader } from "../_lib/adminAuth.js";
import { fetchAdminFeedback } from "../_lib/adminDb.js";
import { json } from "../_lib/http.js";
import {
  captureAndFlushApiError,
  withSentryVercelHandler,
} from "../_lib/serverSentry.js";

/**
 * Handles GET /api/admin/feedback — returns all feedback rows for the admin portal.
 * @param req - Incoming Vercel request.
 * @param res - Vercel response.
 * @returns Promise resolved when the handler completes.
 */
async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const auth = await assertAdminAuth(readAuthorizationHeader(req.headers));
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  try {
    const feedback = await fetchAdminFeedback();
    json(res, 200, { feedback });
  } catch (err) {
    await captureAndFlushApiError(err, {
      method: req.method,
      route: "/api/admin/feedback",
      runtime: "vercel-function",
      url: req.url,
    });
    json(res, 500, {
      error: "Failed to load admin feedback",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

export default withSentryVercelHandler(handler, {
  route: "/api/admin/feedback",
  runtime: "vercel-function",
});
