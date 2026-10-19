/**
 * Turn API error JSON into a readable string for UI alerts.
 * Zod validation failures return `{ error: ZodIssue[] }` — not a string.
 *
 * Payment onboard failures return `{ error, step?, detail? }` where `detail` is
 * Razorpay's `error.description` (validation copy). Prefer that over the generic
 * `error` string when it is safe to show.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNonEmptyString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Reject values that look like stacks or oversized dumps — not Razorpay
 * validation copy (those are short, single-line descriptions).
 */
export function isSafeUserFacingApiDetail(detail: string): boolean {
  if (detail.length > 280) return false;
  if (detail.includes("\n    at ")) return false;
  if (/\bat\s+\S+\s+\(/.test(detail)) return false;
  return true;
}

export function formatApiErrorMessage(status: number, parsed: unknown): string {
  if (!isRecord(parsed) || !("error" in parsed)) {
    return `Request failed (${status})`;
  }

  const err = parsed.error;
  const detail = readNonEmptyString(parsed, "detail");

  if (typeof err === "string" && err.length > 0) {
    if (detail && detail !== err && isSafeUserFacingApiDetail(detail)) {
      // Generic wrappers (e.g. "Onboarding step failed") keep context; detail is
      // the actionable Razorpay / validation reason.
      return `${err}: ${detail}`;
    }
    return err;
  }

  if (Array.isArray(err)) {
    const parts: string[] = [];
    for (const issue of err) {
      if (!isRecord(issue)) {
        parts.push(String(issue));
        continue;
      }
      const message =
        typeof issue.message === "string"
          ? issue.message
          : JSON.stringify(issue);
      const path =
        Array.isArray(issue.path) && issue.path.length > 0
          ? issue.path.map(String).join(".")
          : "";
      parts.push(path ? `${path}: ${message}` : message);
    }
    if (parts.length > 0) {
      return parts.join("; ");
    }
  }

  if (detail && isSafeUserFacingApiDetail(detail)) {
    return detail;
  }

  return `Request failed (${status})`;
}
