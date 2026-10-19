import type { Breadcrumb, ErrorEvent } from "@sentry/react";

const REDACTED = "[REDACTED]";

const sensitiveRoutePattern = new RegExp(
  "(/(?:api/)?(?:sync/accounts|tenant-document-upload|broker-tenant-onboard|v1/review|share/property)/)[^/?#\\s]+",
  "gi",
);

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

export function sanitizeSentryUrl(value: string): string {
  const queryIndex = value.search(/[?#]/);
  const withoutQuery = queryIndex === -1 ? value : value.slice(0, queryIndex);
  const withoutCredentials = withoutQuery.replace(/(:\/\/)[^/@\s]+@/g, "$1");

  return redactKnownSensitiveValues(withoutCredentials);
}

export function sanitizeSentryText(value: string): string {
  const withoutSensitiveUrlDetails = value.replace(
    /https?:\/\/[^\s"'<>]+/gi,
    (url) => sanitizeSentryUrl(url),
  );

  return redactKnownSensitiveValues(withoutSensitiveUrlDetails);
}

function sanitizeOptionalText(value: string | undefined): string | undefined {
  return value === undefined ? undefined : sanitizeSentryText(value);
}

export function scrubSentryBreadcrumb(
  breadcrumb: Breadcrumb,
): Breadcrumb | null {
  if (
    breadcrumb.category === "console" ||
    breadcrumb.category?.startsWith("ui.")
  ) {
    return null;
  }

  const safeData: NonNullable<Breadcrumb["data"]> = {};
  const method = breadcrumb.data?.method;
  const statusCode = breadcrumb.data?.status_code;

  if (typeof method === "string") {
    safeData.method = method;
  }

  if (typeof statusCode === "number") {
    safeData.status_code = statusCode;
  }

  for (const key of ["url", "from", "to"]) {
    const value = breadcrumb.data?.[key];
    if (typeof value === "string") {
      safeData[key] = sanitizeSentryUrl(value);
    }
  }

  return {
    ...breadcrumb,
    message: sanitizeOptionalText(breadcrumb.message),
    data: Object.keys(safeData).length > 0 ? safeData : undefined,
  };
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  return {
    ...event,
    message: sanitizeOptionalText(event.message),
    logentry:
      event.logentry === undefined
        ? undefined
        : {
            message: sanitizeOptionalText(event.logentry.message),
          },
    transaction:
      event.transaction === undefined
        ? undefined
        : sanitizeSentryUrl(event.transaction),
    request:
      event.request === undefined
        ? undefined
        : {
            method: event.request.method,
            url:
              event.request.url === undefined
                ? undefined
                : sanitizeSentryUrl(event.request.url),
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
      ?.map(scrubSentryBreadcrumb)
      .filter((breadcrumb) => breadcrumb !== null),
    fingerprint: event.fingerprint?.map(sanitizeSentryText),
    tags:
      event.tags === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(event.tags).map(([key, value]) => [
              key,
              typeof value === "string" ? sanitizeSentryText(value) : value,
            ]),
          ),
    user: undefined,
    extra: undefined,
  };
}
