import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json } from "./_lib/http.js";
import {
  captureAndFlushApiError,
  withSentryVercelHandler,
} from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const { handleTenantWorkflowRequest } =
      await import("./_lib/tenantWorkflowHandler.js");
    await handleTenantWorkflowRequest(req, res);
  } catch (err) {
    await captureAndFlushApiError(err, {
      method: req.method,
      route: "/api/tenant-workflow",
      runtime: "vercel-function",
      url: req.url,
    });
    json(res, 500, {
      error: "Tenant workflow function failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

export default withSentryVercelHandler(handler, {
  route: "/api/tenant-workflow",
  runtime: "vercel-function",
});
