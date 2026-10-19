/**
 * Request validation and sanitisation for POST /api/feedback.
 */
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  FEEDBACK_RATING_MAX,
  FEEDBACK_RATING_MIN,
  type FeedbackCategory,
  type FeedbackRequestBody,
  type ValidatedFeedbackInput,
} from "./feedbackTypes.js";

/** Validation failure with HTTP status and message. */
export type FeedbackValidationResult =
  | { ok: true; value: ValidatedFeedbackInput }
  | { ok: false; status: 400; error: string };

/**
 * Strips basic HTML tags and collapses whitespace.
 * @param raw - Raw user message string.
 * @returns Sanitised plain-text message.
 */
function sanitiseMessage(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalises optional phone to 10 digits or null.
 * @param value - Raw phone field.
 * @returns Normalised phone or null.
 */
function normaliseOptionalPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? digits : null;
}

/**
 * Normalises optional email or returns null when invalid.
 * @param value - Raw email field.
 * @returns Trimmed email or null.
 */
function normaliseOptionalEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

/**
 * Checks whether a string is a valid feedback category.
 * @param value - Candidate category.
 * @returns True when value is an allowed category.
 */
function isFeedbackCategory(value: string): value is FeedbackCategory {
  return (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Validates and sanitises a feedback POST body.
 * @param body - Parsed JSON body.
 * @returns Validated input or a 400 error descriptor.
 */
export function validateFeedbackBody(body: FeedbackRequestBody | null): FeedbackValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Invalid JSON body" };
  }

  if (typeof body.message !== "string") {
    return { ok: false, status: 400, error: "Message is required" };
  }

  const sanitised = sanitiseMessage(body.message);
  if (!sanitised) {
    return { ok: false, status: 400, error: "Message cannot be empty" };
  }

  const message =
    sanitised.length > FEEDBACK_MESSAGE_MAX_LENGTH
      ? sanitised.slice(0, FEEDBACK_MESSAGE_MAX_LENGTH)
      : sanitised;

  if (typeof body.rating !== "number" || !Number.isInteger(body.rating)) {
    return { ok: false, status: 400, error: "Rating must be an integer" };
  }

  if (body.rating < FEEDBACK_RATING_MIN || body.rating > FEEDBACK_RATING_MAX) {
    return {
      ok: false,
      status: 400,
      error: `Rating must be between ${FEEDBACK_RATING_MIN} and ${FEEDBACK_RATING_MAX}`,
    };
  }

  if (typeof body.category !== "string" || !isFeedbackCategory(body.category.trim().toLowerCase())) {
    return { ok: false, status: 400, error: "Invalid category" };
  }

  const pageUrl =
    typeof body.pageUrl === "string" && body.pageUrl.trim().length > 0
      ? body.pageUrl.trim().slice(0, 500)
      : null;

  const userRole =
    typeof body.role === "string" && body.role.trim().length > 0
      ? body.role.trim().slice(0, 32)
      : null;

  return {
    ok: true,
    value: {
      message,
      rating: body.rating,
      category: body.category.trim().toLowerCase() as FeedbackCategory,
      userPhone: normaliseOptionalPhone(body.phone),
      userRole,
      pageUrl,
      userEmail: normaliseOptionalEmail(body.email),
    },
  };
}
