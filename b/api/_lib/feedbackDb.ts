/**
 * Postgres persistence for feedback records (Vercel serverless pool).
 */
import { randomUUID } from "node:crypto";
import { queryRows, usePostgres } from "./vercelSyncDb.js";
import type { FeedbackRecord, ValidatedFeedbackInput } from "./feedbackTypes.js";

interface InsertedFeedbackRow {
  id: string;
  created_at: Date;
}

/**
 * Inserts a new feedback row and returns its id and timestamp.
 * @param input - Validated feedback payload.
 * @returns Persisted feedback record metadata.
 * @throws When Postgres is unavailable or insert fails.
 */
export async function insertFeedback(input: ValidatedFeedbackInput): Promise<FeedbackRecord> {
  if (!usePostgres()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const id = randomUUID();
  const rows = await queryRows<InsertedFeedbackRow>(
    `INSERT INTO feedback (
       id, message, rating, category, user_phone, user_role, page_url, user_email,
       ai_summary, ai_sentiment, ai_tags, email_sent, created_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       NULL, NULL, NULL, FALSE, NOW()
     )
     RETURNING id, created_at`,
    [
      id,
      input.message,
      input.rating,
      input.category,
      input.userPhone,
      input.userRole,
      input.pageUrl,
      input.userEmail,
    ],
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Feedback insert returned no row");
  }

  return {
    id: row.id,
    message: input.message,
    rating: input.rating,
    category: input.category,
    userPhone: input.userPhone,
    userRole: input.userRole,
    pageUrl: input.pageUrl,
    userEmail: input.userEmail,
    aiSummary: null,
    aiSentiment: null,
    aiTags: null,
    emailSent: false,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Updates AI analysis fields for an existing feedback row.
 * @param feedbackId - Feedback primary key.
 * @param aiSummary - Claude-generated summary.
 * @param aiSentiment - Claude-generated sentiment label.
 * @param aiTags - Claude-generated tag list.
 * @returns Promise resolved when update completes.
 */
export async function updateFeedbackAiAnalysis(
  feedbackId: string,
  aiSummary: string | null,
  aiSentiment: string | null,
  aiTags: string[] | null,
): Promise<void> {
  await queryRows(
    `UPDATE feedback
     SET ai_summary = $2, ai_sentiment = $3, ai_tags = $4
     WHERE id = $1`,
    [feedbackId, aiSummary, aiSentiment, aiTags ? JSON.stringify(aiTags) : null],
  );
}

/**
 * Marks a feedback row as having a notification email sent.
 * @param feedbackId - Feedback primary key.
 * @returns Promise resolved when update completes.
 */
export async function markFeedbackEmailSent(feedbackId: string): Promise<void> {
  await queryRows(`UPDATE feedback SET email_sent = TRUE WHERE id = $1`, [feedbackId]);
}
