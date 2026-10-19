/**
 * Resend notification emails for marketing contact form submissions.
 */
import {
  ContactRoleLabels,
  ContactServiceTimingLabels,
  type ValidatedContactInput,
} from "./contactValidation.js";
import { escapeHtml } from "./htmlEscape.js";

const RESEND_TIMEOUT_MS = 8_000;
const CONTACT_TO_EMAIL = "info@trustkeyper.com";
const CONTACT_FROM_EMAIL = "TrustKeyper Contact <noreply@trustkeyper.com>";

type FetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

/**
 * Sends a contact form notification email via Resend.
 */
export async function sendContactFormEmail(input: ValidatedContactInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const roleLabel = ContactRoleLabels[input.role];
  const timingLabel = ContactServiceTimingLabels[input.serviceTiming];
  const fullName = `${input.firstName} ${input.lastName}`.trim();

  const html = `
    <h2>New TrustKeyper contact inquiry</h2>
    <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
    <p><strong>Phone:</strong> +91 ${escapeHtml(input.phone)}</p>
    <p><strong>Email:</strong> ${escapeHtml(input.email || "—")}</p>
    <p><strong>Role:</strong> ${escapeHtml(roleLabel)}</p>
    <p><strong>Service needed:</strong> ${escapeHtml(timingLabel)}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(input.message).replace(/\n/g, "<br />")}</p>
  `;

  try {
    const response = (await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: CONTACT_FROM_EMAIL,
        to: [CONTACT_TO_EMAIL],
        subject: `[Contact] ${fullName} — +91 ${input.phone}`,
        html,
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    })) as FetchResponse;

    return response.ok;
  } catch {
    return false;
  }
}
