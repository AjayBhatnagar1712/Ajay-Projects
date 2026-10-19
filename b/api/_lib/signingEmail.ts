/**
 * Resend notification when an agreement is sent for signing — non-blocking side effect.
 */
import { escapeHtml } from "./htmlEscape.js";
import { sanitizeErrorForLog } from "./sanitizeErrorForLog.js";

const RESEND_TIMEOUT_MS = 8_000;

type FetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

export type SigningNotificationInput = {
  agreementId: string;
  propertyAddress: string | null;
  adminUrl: string;
};

function signingFromEmail(): string {
  return (
    process.env.SIGNING_FROM_EMAIL?.trim() ?? "TrustKeyper <noreply@trustkeyper.com>"
  );
}

/**
 * Sends Aman the admin deep link after in_review → esign_sent.
 * Failures are non-blocking — callers must not roll back status.
 */
export async function sendSigningNotificationEmail(
  input: SigningNotificationInput,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.SIGNING_NOTIFY_EMAIL?.trim();
  const from = signingFromEmail();

  if (!apiKey || !to) {
    console.error("[signing-email] skipped: RESEND_API_KEY or SIGNING_NOTIFY_EMAIL not set");
    return false;
  }

  const address = input.propertyAddress?.trim() || "Untitled property";
  const subject = `Agreement ready for signing — ${address}`;

  try {
    const response = (await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: to
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean),
        subject,
        html: `
          <h2>Lease agreement sent for signing</h2>
          <p><strong>Property:</strong> ${escapeHtml(address)}</p>
          <p><strong>Agreement ID:</strong> ${escapeHtml(input.agreementId)}</p>
          <p><a href="${escapeHtml(input.adminUrl)}">Open in admin portal</a></p>
          <p>Download the unsigned PDF, complete signing in Leegality, then upload the signed copy.</p>
        `,
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    })) as FetchResponse;

    if (!response.ok) {
      console.error("[signing-email] Resend HTTP error", {
        status: response.status,
        detail: await response.text(),
        agreementId: input.agreementId,
      });
      return false;
    }

    return true;
  } catch (err) {
    console.error("[signing-email] failed", {
      agreementId: input.agreementId,
      error: sanitizeErrorForLog(err),
    });
    return false;
  }
}
