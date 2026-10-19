import { ApiError } from "../api/errors";

/** True when the API (or local auth gate) rejected the session. */
export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/**
 * Launch-gate failure classification.
 * Auth failures must clear the session and return to sign-in — never a Retry dead-end.
 */
export function classifyLaunchFailure(error: unknown): "unauthenticated" | "error" {
  if (isUnauthorizedError(error)) {
    return "unauthenticated";
  }
  return "error";
}
