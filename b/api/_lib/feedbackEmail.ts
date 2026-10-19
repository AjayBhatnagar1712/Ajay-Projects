/**
 * Resend notification emails for new feedback — non-blocking side effect.
 */
import { logFeedbackEvent } from "./feedbackLogger.js";
import type { FeedbackRecord } from "./feedbackTypes.js";

/** Default timeout for Resend API calls in milliseconds. */
const RESEND_TIMEOUT_MS = 8_000;

/** Fetch response shape for Node.js / Vercel runtime compatibility. */
type FetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
};

/**
 * Sends a feedback notification email via Resend.
 * @param record - Persisted feedback row.
 * @returns True when Resend accepted the email; false otherwise.
 */
export async function sendFeedbackNotificationEmail(record: FeedbackRecord): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.FEEDBACK_NOTIFY_EMAIL?.trim();
  const from = process.env.FEEDBACK_FROM_EMAIL?.trim() ?? "TrustKeyper Feedback <feedback@trustkeyper.com>";

  if (!apiKey || !to) {
    logFeedbackEvent({
      event: "email_skipped",
      feedbackId: record.id,
      detail: "RESEND_API_KEY or FEEDBACK_NOTIFY_EMAIL not set",
    });
    return false;
  }

  try {
    const response = (await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: to.split(",").map((email) => email.trim()).filter(Boolean),
        subject: `[Feedback] ${record.category} · ${record.rating}/5`,
        html: `
          <h2>New TrustKeyper feedback</h2>
          <p><strong>ID:</strong> ${record.id}</p>
          <p><strong>Rating:</strong> ${record.rating}/5</p>
          <p><strong>Category:</strong> ${record.category}</p>
          <p><strong>Message:</strong> ${record.message}</p>
          <p><strong>Phone:</strong> ${record.userPhone ?? "—"}</p>
          <p><strong>Role:</strong> ${record.userRole ?? "—"}</p>
          <p><strong>Page:</strong> ${record.pageUrl ?? "—"}</p>
        `,
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    })) as FetchResponse;

    if (!response.ok) {
      logFeedbackEvent({
        event: "email_http_error",
        feedbackId: record.id,
        status: response.status,
        detail: await response.text(),
      });
      return false;
    }

    return true;
  } catch (err) {
    logFeedbackEvent({
      event: "email_failed",
      feedbackId: record.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
