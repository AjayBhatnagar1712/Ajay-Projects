/**
 * Gemini analysis for submitted feedback — non-blocking side effect.
 */
import { logFeedbackEvent } from "./feedbackLogger.js";
import type { ValidatedFeedbackInput } from "./feedbackTypes.js";

/** Gemini analysis result persisted when successful. */
export interface FeedbackAiAnalysis {
  summary: string;
  sentiment: string;
  tags: string[];
}

/** Gemini generateContent endpoint for flash model. */
const GEMINI_GENERATE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/** Default timeout for Gemini API calls in milliseconds. */
const GEMINI_TIMEOUT_MS = 10_000;

/** Fetch response shape for Node.js / Vercel runtime compatibility. */
type FetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
};

/** Gemini generateContent response shape (partial). */
interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

/**
 * Builds the analysis prompt sent to Gemini.
 * @param input - Validated feedback payload.
 * @returns Prompt string requesting JSON output.
 */
function buildAnalysisPrompt(input: ValidatedFeedbackInput): string {
  return `Analyse this app feedback and respond with JSON only: {"summary":"...","sentiment":"positive|neutral|negative","tags":["..."]}\n\nCategory: ${input.category}\nRating: ${input.rating}/5\nMessage: ${input.message}`;
}

/**
 * Parses and validates Gemini JSON output into a FeedbackAiAnalysis.
 * @param text - Raw model text response.
 * @param feedbackId - Persisted feedback id for logging correlation.
 * @returns Parsed analysis or null when shape is invalid.
 */
function parseAnalysisResponse(text: string, feedbackId: string): FeedbackAiAnalysis | null {
  const parsed = JSON.parse(text) as {
    summary?: unknown;
    sentiment?: unknown;
    tags?: unknown;
  };

  if (typeof parsed.summary !== "string" || typeof parsed.sentiment !== "string") {
    logFeedbackEvent({ event: "gemini_invalid_shape", feedbackId });
    return null;
  }

  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 10)
    : [];

  return {
    summary: parsed.summary.slice(0, 500),
    sentiment: parsed.sentiment.slice(0, 32),
    tags,
  };
}

/**
 * Calls Gemini to analyse feedback content.
 * @param input - Validated feedback payload.
 * @param feedbackId - Persisted feedback id for logging correlation.
 * @returns Analysis result or null when unavailable or failed.
 */
export async function analyseFeedbackWithGemini(
  input: ValidatedFeedbackInput,
  feedbackId: string,
): Promise<FeedbackAiAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    logFeedbackEvent({ event: "gemini_skipped", feedbackId, detail: "GEMINI_API_KEY not set" });
    return null;
  }

  try {
    const url = `${GEMINI_GENERATE_URL}?key=${encodeURIComponent(apiKey)}`;
    const response = (await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: buildAnalysisPrompt(input) }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 256,
        },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    })) as FetchResponse;

    if (!response.ok) {
      logFeedbackEvent({
        event: "gemini_http_error",
        feedbackId,
        status: response.status,
        detail: await response.text(),
      });
      return null;
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      logFeedbackEvent({ event: "gemini_empty_response", feedbackId });
      return null;
    }

    return parseAnalysisResponse(text, feedbackId);
  } catch (err) {
    logFeedbackEvent({
      event: "gemini_failed",
      feedbackId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
