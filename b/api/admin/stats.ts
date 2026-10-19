/**
 * GET /api/admin/stats — aggregate platform statistics (admin only).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertAdminAuth, readAuthorizationHeader } from "../_lib/adminAuth.js";
import { fetchAdminStats } from "../_lib/adminDb.js";
import { json } from "../_lib/http.js";
import {
  captureAndFlushApiError,
  withSentryVercelHandler,
} from "../_lib/serverSentry.js";

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
    const stats = await fetchAdminStats();
    json(res, 200, stats);
  } catch (err) {
    await captureAndFlushApiError(err, {
      method: req.method,
      route: "/api/admin/stats",
      runtime: "vercel-function",
      url: req.url,
    });
    json(res, 500, {
      error: "Failed to load admin stats",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

export default withSentryVercelHandler(handler, {
  route: "/api/admin/stats",
  runtime: "vercel-function",
});
