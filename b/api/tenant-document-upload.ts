import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json } from "./_lib/http.js";
import {
  captureAndFlushApiError,
  withSentryVercelHandler,
} from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const { handleTenantDocumentUploadRequest } =
      await import("./_lib/tenantDocumentUploadHandler.js");
    await handleTenantDocumentUploadRequest(req, res);
  } catch (err) {
    await captureAndFlushApiError(err, {
      method: req.method,
      route: "/api/tenant-document-upload",
      runtime: "vercel-function",
      url: req.url,
    });
    json(res, 500, {
      error: "Tenant document upload function failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

export default withSentryVercelHandler(handler, {
  route: "/api/tenant-document-upload",
  runtime: "vercel-function",
});
