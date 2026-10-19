import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

function handler(req: VercelRequest, res: VercelResponse) {
  res.json({ status: "ok" });
}

export default withSentryVercelHandler(handler, {
  route: "/api/healthz",
  runtime: "vercel-function",
});
