import type { VercelRequest } from "@vercel/node";

const TEST_ERROR_HEADER = "x-trustkeyper-sentry-test";

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isSentryApiTestErrorAllowed(
  req: VercelRequest,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  // Production deployment metadata takes precedence over opt-in flags.
  if (
    env.VERCEL_ENV === "production" ||
    env.VERCEL_TARGET_ENV === "production" ||
    env.VERCEL_GIT_COMMIT_REF === "main" ||
    env.SENTRY_ENVIRONMENT === "production"
  ) {
    return false;
  }
  const nonProduction = env.VERCEL_ENV === "preview" ||
    (env.VERCEL_ENV === undefined && env.NODE_ENV !== "production" && env.SENTRY_ENVIRONMENT === "staging");
  if (!nonProduction) return false;

  if (env.SENTRY_API_TEST_ERROR_ENABLED !== "1") {
    return false;
  }

  const expectedToken = env.SENTRY_API_TEST_ERROR_TOKEN?.trim();
  if (!expectedToken) {
    return false;
  }

  const actualToken = firstHeaderValue(req.headers[TEST_ERROR_HEADER])?.trim();
  return actualToken === expectedToken;
}

export function throwSentryApiSourceMapProbe(): never {
  throw new Error("TrustKeyper API Sentry source-map verification");
}
