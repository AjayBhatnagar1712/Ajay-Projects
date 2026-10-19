import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  captureAndFlushApiError,
  withSentryVercelHandler,
} from "./_lib/serverSentry.js";

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { name, phone, propertyCount, propertyIntent, entrySource } =
    req.body as {
      name?: string;
      phone?: string;
      propertyCount?: string;
      propertyIntent?: string;
      entrySource?: string;
    };

  if (!phone) {
    res.status(400).json({ error: "Phone is required" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.FEEDBACK_FROM_EMAIL?.trim() ??
    "TrustKeyper <noreply@trustkeyper.com>";
  const to = "info@trustkeyper.com";

  if (!apiKey) {
    res.status(500).json({ error: "Email not configured" });
    return;
  }

  const intentList = (() => {
    try {
      return (JSON.parse(propertyIntent ?? "[]") as string[]).join(", ");
    } catch {
      return propertyIntent ?? "Not specified";
    }
  })();

  const html = `
    <h2>New Managed Property Interest</h2>
    <p>A property owner has expressed interest in the Managed plan.</p>
    <table>
      <tr><td><strong>Name</strong></td><td>${name || "Not provided"}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${phone}</td></tr>
      <tr><td><strong>Property Count</strong></td><td>${propertyCount || "Not specified"}</td></tr>
      <tr><td><strong>Intent</strong></td><td>${intentList}</td></tr>
      <tr><td><strong>Entry Source</strong></td><td>${entrySource || "Unknown"}</td></tr>
    </table>
  `;

  try {
    const response = (await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: `[Managed Interest] ${name || "Unknown"} — ${phone}`,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    })) as Response & { ok: boolean; status: number };
    if (!response.ok) {
      res.status(500).json({ error: "Failed to send email" });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    await captureAndFlushApiError(err, {
      method: req.method,
      route: "/api/managed-interest",
      runtime: "vercel-function",
      url: req.url,
    });
    res.status(500).json({ error: "Email send failed" });
  }
}

export default withSentryVercelHandler(handler, {
  route: "/api/managed-interest",
  runtime: "vercel-function",
});
