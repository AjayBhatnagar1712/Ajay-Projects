import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  sanitizeServerSentryText,
  sanitizeServerSentryUrl,
  scrubServerSentryEvent,
} from "./serverSentryPrivacy.js";

type ServerSentryEnv = Record<string, string | undefined>;

export type ServerSentryRuntimeConfig = {
  dsn: string;
  environment: string;
  release: string;
};

export type ApiErrorContext = {
  method?: string;
  route?: string;
  runtime?: "vercel-function" | "express";
  url?: string;
};

type VercelHandler = (
  req: VercelRequest,
  res: VercelResponse,
) => void | Promise<void>;

let initializedConfigKey: string | null = null;

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveServerSentryEnvironment(env: ServerSentryEnv): string {
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

export function resolveServerSentryRelease(env: ServerSentryEnv): string {
  const explicitRelease = env.SENTRY_RELEASE?.trim();
  if (explicitRelease) {
    return explicitRelease;
  }

  const commitSha = env.VERCEL_GIT_COMMIT_SHA?.trim();
  return commitSha ? `trustkeyper-api@${commitSha}` : "trustkeyper-api@local";
}

export function resolveServerSentryRuntimeConfig(
  env: ServerSentryEnv,
): ServerSentryRuntimeConfig | null {
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

export function initServerSentry(env: ServerSentryEnv = process.env): boolean {
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

export function captureApiError(
  err: unknown,
  context: ApiErrorContext = {},
): string | undefined {
  if (!initServerSentry()) {
    return undefined;
  }

  return Sentry.withScope((scope: Sentry.Scope) => {
    scope.setTag("runtime", context.runtime ?? "vercel-function");
    if (context.route) {
      scope.setTag("route", sanitizeServerSentryText(context.route));
    }
    if (context.method) {
      scope.setTag("method", context.method);
    }
    if (context.url) {
      scope.setContext("request", {
        method: context.method,
        url: sanitizeServerSentryUrl(context.url),
      });
    }

    return Sentry.captureException(err);
  });
}

export async function flushServerSentry(timeout = 2000): Promise<boolean> {
  if (initializedConfigKey === null) {
    return false;
  }

  return Sentry.flush(timeout);
}

export async function captureAndFlushApiError(
  err: unknown,
  context: ApiErrorContext = {},
): Promise<string | undefined> {
  const eventId = captureApiError(err, context);
  if (eventId !== undefined) {
    await flushServerSentry();
  }
  return eventId;
}

export function withSentryVercelHandler(
  handler: VercelHandler,
  context: Omit<ApiErrorContext, "method" | "url"> = {},
): VercelHandler {
  return async function sentryWrappedVercelHandler(req, res) {
    initServerSentry();

    try {
      await handler(req, res);
    } catch (err) {
      await captureAndFlushApiError(err, {
        ...context,
        method: req.method,
        url: req.url,
      });
      throw err;
    }
  };
}

export function __resetServerSentryForTests(): void {
  initializedConfigKey = null;
}
