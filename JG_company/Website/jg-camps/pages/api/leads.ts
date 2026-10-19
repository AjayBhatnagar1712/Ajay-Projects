// pages/api/leads.ts
import type { NextApiRequest, NextApiResponse } from "next";

const WEBHOOK = process.env.LEADS_WEBHOOK_URL!; // Apps Script /exec URL

async function forward(url: string, body: any) {
  // tiny retry & tolerant JSON parsing (Apps Script sometimes returns text)
  for (let i = 0; i < 2; i++) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const txt = await r.text();
    let data: any = null;
    try { data = txt ? JSON.parse(txt) : null; } catch {}
    if (r.ok) return { ok: true, status: r.status, data };
    if (i === 1) return { ok: false, status: r.status, data };
  }
  return { ok: false, status: 500, data: null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      envPresent: !!WEBHOOK,
      message: WEBHOOK ? "API ready" : "Missing LEADS_WEBHOOK_URL",
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!WEBHOOK) {
    return res.status(500).json({ ok: false, error: "LEADS_WEBHOOK_URL missing" });
  }

  try {
    const payload = req.body ?? {};
    const result = await forward(WEBHOOK, payload);
    if (!result.ok) {
      return res.status(502).json({ ok: false, status: result.status, upstream: result.data });
    }
    return res.status(200).json({ ok: true, upstream: result.data });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
