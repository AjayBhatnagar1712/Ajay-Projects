import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  isSentryApiTestErrorAllowed,
  throwSentryApiSourceMapProbe,
} from "./_lib/sentryTestError.js";
import { withSentryVercelHandler } from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!isSentryApiTestErrorAllowed(req)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  throwSentryApiSourceMapProbe();
}

export default withSentryVercelHandler(handler, {
  route: "/api/sentry-test-error",
  runtime: "vercel-function",
});
