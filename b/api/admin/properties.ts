/**
 * GET /api/admin/properties — all platform properties (admin only).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertAdminAuth, readAuthorizationHeader } from "../_lib/adminAuth.js";
import { fetchAdminProperties } from "../_lib/adminDb.js";
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
    const properties = await fetchAdminProperties();
    json(res, 200, { properties });
  } catch (err) {
    await captureAndFlushApiError(err, {
      method: req.method,
      route: "/api/admin/properties",
      runtime: "vercel-function",
      url: req.url,
    });
    json(res, 500, {
      error: "Failed to load admin properties",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

export default withSentryVercelHandler(handler, {
  route: "/api/admin/properties",
  runtime: "vercel-function",
});
