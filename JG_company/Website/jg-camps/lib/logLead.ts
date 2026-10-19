export type LeadPayload = {
  name?: string;
  phone?: string;
  note?: string;
  channel: string;         // "contact-modal" | "planner" | "whatsapp" | ...
  page?: string;           // e.g. location.pathname
  meta?: Record<string, unknown>;
};

export async function logLead(payload: LeadPayload) {
  try {
    const page = payload.page ?? (typeof window !== "undefined" ? window.location.pathname : "");
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const meta = { tz, userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "", ...payload.meta };

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, page, meta }),
    });

    // don’t block UI on logging; swallow errors
    if (!res.ok) console.warn("Lead log upstream non-200", await res.text());
    return true;
  } catch (e) {
    console.warn("Lead log failed", e);
    return false;
  }
}
