import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";
import { handlePortalRequest } from "./_lib/portalHandler.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handlePortalRequest(req, res);
}

export default withSentryVercelHandler(handler, { route: "/api/v1/portal" });
