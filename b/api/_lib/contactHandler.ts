/**
 * Orchestrates POST /api/contact — validate, rate limit, send email, respond.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendContactFormEmail } from "./contactEmail.js";
import { checkContactRateLimit, getContactClientIp } from "./contactRateLimit.js";
import {
  isContactHoneypotTriggered,
  validateContactBody,
} from "./contactValidation.js";
import { readJsonBody } from "./http.js";
import {
  handleContactCorsPreflight,
  resolveContactCorsOrigin,
  setContactCorsHeaders,
} from "./marketingCors.js";

function contactJson(
  res: VercelResponse,
  status: number,
  body: unknown,
  corsOrigin: string | null,
): void {
  res.status(status).setHeader("Content-Type", "application/json");
  if (corsOrigin) {
    setContactCorsHeaders(res, corsOrigin);
  }
  res.end(JSON.stringify(body));
}

/**
 * Handles POST /api/contact requests end-to-end.
 */
export async function handleContactRequest(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleContactCorsPreflight(req, res)) return;

  const corsOrigin = resolveContactCorsOrigin(req);

  if (req.method !== "POST") {
    contactJson(res, 405, { error: "Method not allowed" }, corsOrigin);
    return;
  }

  const rawBody = readJsonBody(req);
  if (rawBody === null) {
    contactJson(res, 400, { error: "Malformed JSON body" }, corsOrigin);
    return;
  }

  if (isContactHoneypotTriggered(rawBody)) {
    contactJson(res, 200, { ok: true }, corsOrigin);
    return;
  }

  const rate = checkContactRateLimit(getContactClientIp(req));
  if (!rate.ok) {
    contactJson(res, rate.status, { error: rate.error }, corsOrigin);
    return;
  }

  const validated = validateContactBody(rawBody);
  if (!validated.ok) {
    contactJson(res, validated.status, { error: validated.error }, corsOrigin);
    return;
  }

  const sent = await sendContactFormEmail(validated.value);
  if (!sent) {
    contactJson(res, 500, { error: "Failed to send message. Please try again." }, corsOrigin);
    return;
  }

  contactJson(res, 200, { ok: true }, corsOrigin);
}
