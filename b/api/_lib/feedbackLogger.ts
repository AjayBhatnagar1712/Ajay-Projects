/**
 * Structured JSON logging for feedback API operations.
 */
import type { FeedbackLogPayload } from "./feedbackTypes.js";

/**
 * Writes a structured feedback log line to stderr.
 * @param payload - Event metadata and optional error detail.
 * @returns void
 */
export function logFeedbackEvent(payload: FeedbackLogPayload): void {
  console.error(
    JSON.stringify({
      scope: "feedback-api",
      timestamp: new Date().toISOString(),
      ...payload,
    }),
  );
}
