/**
 * Orchestrates POST /api/feedback — validate, persist, side effects, then respond.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { analyseFeedbackWithGemini } from "./feedbackAi.js";
import { insertFeedback, markFeedbackEmailSent, updateFeedbackAiAnalysis } from "./feedbackDb.js";
import { sendFeedbackNotificationEmail } from "./feedbackEmail.js";
import { logFeedbackEvent } from "./feedbackLogger.js";
import type { FeedbackRecord, FeedbackRequestBody, ValidatedFeedbackInput } from "./feedbackTypes.js";
import { validateFeedbackBody } from "./feedbackValidation.js";
import { json, readJsonBody } from "./http.js";

/**
 * Placeholder for future rate limiting (429). Returns ok until wired to Redis or Upstash.
 * @param _req - Incoming request (client IP headers reserved for future use).
 * @returns Rate-limit decision.
 */
function checkRateLimit(_req: VercelRequest): { ok: true } | { ok: false; status: 429; error: string } {
  return { ok: true };
}

/**
 * Persists Claude analysis when available; logs failures without throwing.
 * @param feedbackId - Persisted feedback id.
 * @param input - Validated feedback input.
 * @returns Promise resolved when analysis attempt completes.
 */
async function persistAiAnalysis(feedbackId: string, input: ValidatedFeedbackInput): Promise<void> {
  try {
    const analysis = await analyseFeedbackWithGemini(input, feedbackId);
    if (!analysis) return;

    await updateFeedbackAiAnalysis(
      feedbackId,
      analysis.summary,
      analysis.sentiment,
      analysis.tags,
    );
  } catch (err) {
    logFeedbackEvent({
      event: "ai_persist_failed",
      feedbackId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Sends notification email when configured; logs failures without throwing.
 * @param record - Persisted feedback record.
 * @returns Promise resolved when email attempt completes.
 */
async function persistEmailNotification(record: FeedbackRecord): Promise<void> {
  try {
    const sent = await sendFeedbackNotificationEmail(record);
    if (sent) {
      await markFeedbackEmailSent(record.id);
    }
  } catch (err) {
    logFeedbackEvent({
      event: "email_persist_failed",
      feedbackId: record.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Runs Gemini analysis and Resend email before the HTTP response is sent.
 * Failures are logged; feedback row is never deleted.
 * @param record - Persisted feedback record.
 * @returns Promise resolved when side effects settle.
 */
async function runPostSaveSideEffects(record: FeedbackRecord): Promise<void> {
  const input: ValidatedFeedbackInput = {
    message: record.message,
    rating: record.rating,
    category: record.category,
    userPhone: record.userPhone,
    userRole: record.userRole,
    pageUrl: record.pageUrl,
    userEmail: record.userEmail,
  };

  await Promise.all([
    persistAiAnalysis(record.id, input),
    persistEmailNotification(record),
  ]);

  logFeedbackEvent({
    event: "post_save_complete",
    feedbackId: record.id,
  });
}

/**
 * Handles POST /api/feedback requests end-to-end.
 * @param req - Incoming Vercel request.
 * @param res - Vercel response.
 * @returns Promise resolved when handler and side effects complete.
 */
export async function handleFeedbackRequest(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const rate = checkRateLimit(req);
  if (!rate.ok) {
    json(res, rate.status, { error: rate.error });
    return;
  }

  const rawBody = readJsonBody(req);
  if (rawBody === null) {
    json(res, 400, { error: "Malformed JSON body" });
    return;
  }

  const validated = validateFeedbackBody(rawBody as FeedbackRequestBody);
  if (!validated.ok) {
    json(res, validated.status, { error: validated.error });
    return;
  }

  let record: FeedbackRecord;
  try {
    record = await insertFeedback(validated.value);
  } catch (err) {
    logFeedbackEvent({
      event: "insert_failed",
      error: err instanceof Error ? err.message : String(err),
    });
    json(res, 500, { error: "Failed to save feedback. Please try again." });
    return;
  }

  try {
    await runPostSaveSideEffects(record);
  } catch (err) {
    logFeedbackEvent({
      event: "post_save_failed",
      feedbackId: record.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  json(res, 201, {
    feedbackId: record.id,
    createdAt: record.createdAt,
  });
}
