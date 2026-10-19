/**
 * Vercel serverless entry for /api/admin/lease-agreements (+ nested signing routes).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";
import { handleAdminLeaseAgreementRequest } from "./_lib/adminLeaseAgreementHandler.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleAdminLeaseAgreementRequest(req, res);
}

export default withSentryVercelHandler(handler, { route: "/api/admin/lease-agreements" });
