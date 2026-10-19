import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json } from "./_lib/http.js";
import {
  captureAndFlushApiError,
  withSentryVercelHandler,
} from "./_lib/serverSentry.js";

/** Entry for /api/sync — nested paths arrive via vercel.json rewrite (?syncPath=...). */
async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const { handleSyncRequest, syncPathSegments } =
      await import("./_lib/syncHandler.js");
    const segments = syncPathSegments(req);
    if (segments.length === 0) {
      json(res, 404, { error: "Not found" });
      return;
    }
    await handleSyncRequest(req, res);
  } catch (err) {
    await captureAndFlushApiError(err, {
      method: req.method,
      route: "/api/sync",
      runtime: "vercel-function",
      url: req.url,
    });
    json(res, 500, {
      error: "Sync function failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

export default withSentryVercelHandler(handler, {
  route: "/api/sync",
  runtime: "vercel-function",
});
