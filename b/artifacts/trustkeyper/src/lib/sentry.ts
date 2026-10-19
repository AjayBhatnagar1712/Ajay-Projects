import * as Sentry from "@sentry/react";
import { z } from "zod";
import { scrubSentryBreadcrumb, scrubSentryEvent } from "@/lib/sentryPrivacy";

const sentryRuntimeEnvSchema = z.object({
  VITE_SENTRY_DSN: z
    .string()
    .trim()
    .url()
    .refine((value) => value.startsWith("https://"))
    .optional(),
  VITE_SENTRY_ENABLED: z.enum(["true", "false"]).optional(),
});

export type SentryRuntimeConfig = {
  dsn: string;
};

export function resolveSentryRuntimeConfig(
  input: unknown,
): SentryRuntimeConfig | null {
  const result = sentryRuntimeEnvSchema.safeParse(input);

  if (
    !result.success ||
    result.data.VITE_SENTRY_ENABLED === "false" ||
    result.data.VITE_SENTRY_DSN === undefined
  ) {
    return null;
  }

  return { dsn: result.data.VITE_SENTRY_DSN };
}

export function initAppSentry(): boolean {
  const config = resolveSentryRuntimeConfig(import.meta.env);
  if (config === null) {
    return false;
  }

  try {
    Sentry.init({
      dsn: config.dsn,
      environment: __SENTRY_ENVIRONMENT__,
      release: __SENTRY_RELEASE__,
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
      integrations: (defaultIntegrations) => [
        ...defaultIntegrations.filter(
          (integration) => integration.name !== "Breadcrumbs",
        ),
        Sentry.breadcrumbsIntegration({
          console: false,
          dom: false,
          fetch: true,
          history: true,
          sentry: true,
          xhr: true,
        }),
      ],
      beforeBreadcrumb: scrubSentryBreadcrumb,
      beforeSend: scrubSentryEvent,
    });

    return true;
  } catch {
    return false;
  }
}
