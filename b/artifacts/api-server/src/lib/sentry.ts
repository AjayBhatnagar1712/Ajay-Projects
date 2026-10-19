import * as Sentry from "@sentry/node";
import type { ErrorRequestHandler, Request, RequestHandler } from "express";

const REDACTED = "[REDACTED]";
const TEST_ERROR_HEADER = "x-trustkeyper-sentry-test";

const sensitiveRoutePattern = new RegExp(
  "(/(?:api/)?(?:sync/accounts|tenant-document-upload|broker-tenant-onboard|v1/review|share/property)/)[^/?#\\s]+",
  "gi",
);

type ServerSentryEnv = Record<string, string | undefined>;

let initializedConfigKey: string | null = null;

function redactKnownSensitiveValues(value: string): string {
  return value
    .replace(/Bearer\s+[^\s,;]+/gi, `Bearer ${REDACTED}`)
    .replace(
      /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
      REDACTED,
    )
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, REDACTED)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED)
    .replace(/\b\d{9,18}\b/g, REDACTED)
    .replace(
      /\b(password|passcode|secret|token|authorization|api[_-]?key|otp|phone|mobile|account(?:[_-]?(?:number|no))?)\b(\s*[:=]\s*)[^\s,;&]+/gi,
      (_match, key: string, separator: string) =>
        `${key}${separator}${REDACTED}`,
    )
    .replace(sensitiveRoutePattern, `$1${REDACTED}`);
}

function sanitizeServerSentryUrl(value: string): string {
  const queryIndex = value.search(/[?#]/);
  const withoutQuery = queryIndex === -1 ? value : value.slice(0, queryIndex);
  const withoutCredentials = withoutQuery.replace(/(:\/\/)[^/@\s]+@/g, "$1");

  return redactKnownSensitiveValues(withoutCredentials);
}

function sanitizeServerSentryText(value: string): string {
  const withoutSensitiveUrlDetails = value.replace(
    /https?:\/\/[^\s"'<>]+/gi,
    (url) => sanitizeServerSentryUrl(url),
  );

  return redactKnownSensitiveValues(withoutSensitiveUrlDetails);
}

function sanitizeOptionalText(value: string | undefined): string | undefined {
  return value === undefined ? undefined : sanitizeServerSentryText(value);
}

function scrubServerSentryEvent(event: Sentry.Event): Sentry.Event {
  return {
    ...event,
    message: sanitizeOptionalText(event.message),
    logentry:
      event.logentry === undefined
        ? undefined
        : {
            ...event.logentry,
            message: sanitizeOptionalText(event.logentry.message),
          },
    transaction:
      event.transaction === undefined
        ? undefined
        : sanitizeServerSentryUrl(event.transaction),
    request:
      event.request === undefined
        ? undefined
        : {
            method: event.request.method,
            url:
              event.request.url === undefined
                ? undefined
                : sanitizeServerSentryUrl(event.request.url),
          },
    exception:
      event.exception === undefined
        ? undefined
        : {
            ...event.exception,
            values: event.exception.values?.map((exception) => ({
              ...exception,
              value: sanitizeOptionalText(exception.value),
            })),
          },
    breadcrumbs: event.breadcrumbs
      ?.filter(
        (breadcrumb) =>
          breadcrumb.category !== "console" &&
          !breadcrumb.category?.startsWith("ui."),
      )
      .map((breadcrumb) => ({
        ...breadcrumb,
        message: sanitizeOptionalText(breadcrumb.message),
      })),
    fingerprint: event.fingerprint?.map(sanitizeServerSentryText),
    tags:
      event.tags === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(event.tags).map(([key, value]) => [
              key,
              typeof value === "string"
                ? sanitizeServerSentryText(value)
                : value,
            ]),
          ),
    user: undefined,
    extra: undefined,
    contexts:
      event.contexts === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(event.contexts).filter(([key]) => key !== "device"),
          ),
  };
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function resolveServerSentryEnvironment(env: ServerSentryEnv): string {
  const explicitEnvironment = env.SENTRY_ENVIRONMENT?.trim();
  if (explicitEnvironment) {
    return explicitEnvironment;
  }

  const branch = env.VERCEL_GIT_COMMIT_REF?.trim();
  if (branch === "main") {
    return "production";
  }
  if (branch === "staging") {
    return "staging";
  }
  if (branch || env.VERCEL_ENV === "preview") {
    return "preview";
  }
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") {
    return "production";
  }

  return "local";
}

function resolveServerSentryRelease(env: ServerSentryEnv): string {
  const explicitRelease = env.SENTRY_RELEASE?.trim();
  if (explicitRelease) {
    return explicitRelease;
  }

  const commitSha = env.VERCEL_GIT_COMMIT_SHA?.trim();
  return commitSha ? `trustkeyper-api@${commitSha}` : "trustkeyper-api@local";
}

function resolveServerSentryRuntimeConfig(env: ServerSentryEnv) {
  const dsn = env.SENTRY_DSN?.trim();
  if (env.SENTRY_ENABLED === "false" || dsn === undefined || !isHttpsUrl(dsn)) {
    return null;
  }

  return {
    dsn,
    environment: resolveServerSentryEnvironment(env),
    release: resolveServerSentryRelease(env),
  };
}

export function initApiServerSentry(
  env: ServerSentryEnv = process.env,
): boolean {
  const config = resolveServerSentryRuntimeConfig(env);
  if (config === null) {
    initializedConfigKey = null;
    return false;
  }

  const configKey = JSON.stringify(config);
  if (initializedConfigKey === configKey) {
    return true;
  }

  try {
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      sendDefaultPii: false,
      enableLogs: false,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: {
          request: false,
          response: false,
        },
        httpBodies: [],
        urlQueryParams: false,
        graphQL: {
          document: false,
          variables: false,
        },
        genAI: {
          inputs: false,
          outputs: false,
        },
        databaseQueryData: false,
        stackFrameVariables: false,
        frameContextLines: 0,
      },
      beforeSend: scrubServerSentryEvent,
    } as Parameters<typeof Sentry.init>[0]);
    initializedConfigKey = configKey;
    return true;
  } catch {
    initializedConfigKey = null;
    return false;
  }
}

function captureExpressError(err: unknown, req: Request): string | undefined {
  if (!initApiServerSentry()) {
    return undefined;
  }

  return Sentry.withScope((scope) => {
    scope.setTag("runtime", "express");
    scope.setTag("method", req.method);
    scope.setTag(
      "route",
      sanitizeServerSentryText(req.route?.path ?? req.path),
    );
    scope.setContext("request", {
      method: req.method,
      url: sanitizeServerSentryUrl(req.originalUrl ?? req.url),
    });

    return Sentry.captureException(err);
  });
}

function isSentryApiTestErrorAllowed(req: Request): boolean {
  const env = process.env;
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

  if (process.env.SENTRY_API_TEST_ERROR_ENABLED !== "1") {
    return false;
  }

  const expectedToken = process.env.SENTRY_API_TEST_ERROR_TOKEN?.trim();
  if (!expectedToken) {
    return false;
  }

  const actualToken = req.get(TEST_ERROR_HEADER)?.trim();
  return actualToken === expectedToken;
}

export const sentryApiTestErrorRoute: RequestHandler = (req, res) => {
  if (!isSentryApiTestErrorAllowed(req)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  throw new Error("TrustKeyper API Sentry source-map verification");
};

export const sentryExpressErrorHandler: ErrorRequestHandler = (
  err,
  req,
  _res,
  next,
) => {
  const eventId = captureExpressError(err, req);
  if (eventId === undefined) {
    next(err);
    return;
  }

  void Sentry.flush(2000).finally(() => {
    next(err);
  });
};
