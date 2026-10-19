/**
 * Shared TypeScript types for the feedback API pipeline.
 */

/** Allowed feedback categories submitted by the client. */
export const FEEDBACK_CATEGORIES = ["bug", "feature", "general", "ux", "other"] as const;

/** Valid feedback category literal union. */
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/** Maximum stored message length after sanitisation. */
export const FEEDBACK_MESSAGE_MAX_LENGTH = 2000;

/** Minimum and maximum inclusive star rating. */
export const FEEDBACK_RATING_MIN = 1;
export const FEEDBACK_RATING_MAX = 5;

/** Normalised payload persisted to Postgres. */
export interface FeedbackRecord {
  id: string;
  message: string;
  rating: number;
  category: FeedbackCategory;
  userPhone: string | null;
  userRole: string | null;
  pageUrl: string | null;
  userEmail: string | null;
  aiSummary: string | null;
  aiSentiment: string | null;
  aiTags: string[] | null;
  emailSent: boolean;
  createdAt: string;
}

/** Client POST body shape (before validation). */
export interface FeedbackRequestBody {
  message?: unknown;
  rating?: unknown;
  category?: unknown;
  phone?: unknown;
  role?: unknown;
  pageUrl?: unknown;
  email?: unknown;
}

/** Validated and sanitised input ready for persistence. */
export interface ValidatedFeedbackInput {
  message: string;
  rating: number;
  category: FeedbackCategory;
  userPhone: string | null;
  userRole: string | null;
  pageUrl: string | null;
  userEmail: string | null;
}

/** Successful API response returned immediately after DB insert. */
export interface FeedbackCreateResponse {
  feedbackId: string;
  createdAt: string;
}

/** Structured log payload for feedback operations. */
export interface FeedbackLogPayload {
  event: string;
  feedbackId?: string;
  status?: number;
  detail?: string;
  error?: string;
}
