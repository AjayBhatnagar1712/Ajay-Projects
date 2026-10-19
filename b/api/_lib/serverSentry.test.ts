import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(() => "event-id"),
  flush: vi.fn(async () => true),
  init: vi.fn<(options: Record<string, unknown>) => void>(),
  withScope: vi.fn((callback: (scope: Record<string, unknown>) => string) =>
    callback({
      setContext: vi.fn(),
      setTag: vi.fn(),
    }),
  ),
}));

vi.mock("@sentry/node", () => sentryMocks);

import {
  __resetServerSentryForTests,
  captureApiError,
  initServerSentry,
  resolveServerSentryRuntimeConfig,
} from "./serverSentry";

const originalSentryDsn = process.env.SENTRY_DSN;
const originalSentryEnabled = process.env.SENTRY_ENABLED;

beforeEach(() => {
  delete process.env.SENTRY_DSN;
  delete process.env.SENTRY_ENABLED;
});

afterEach(() => {
  if (originalSentryDsn === undefined) {
    delete process.env.SENTRY_DSN;
  } else {
    process.env.SENTRY_DSN = originalSentryDsn;
  }
  if (originalSentryEnabled === undefined) {
    delete process.env.SENTRY_ENABLED;
  } else {
    process.env.SENTRY_ENABLED = originalSentryEnabled;
  }
  __resetServerSentryForTests();
  vi.clearAllMocks();
});

describe("resolveServerSentryRuntimeConfig", () => {
  it("disables server Sentry when the DSN is missing", () => {
    expect(resolveServerSentryRuntimeConfig({})).toBeNull();
  });

  it("disables server Sentry when the kill switch is set", () => {
    expect(
      resolveServerSentryRuntimeConfig({
        SENTRY_DSN: "https://public@example.ingest.sentry.io/123",
        SENTRY_ENABLED: "false",
      }),
    ).toBeNull();
  });

  it("rejects malformed and non-HTTPS DSNs without throwing", () => {
    expect(
      resolveServerSentryRuntimeConfig({ SENTRY_DSN: "not-a-url" }),
    ).toBeNull();
    expect(
      resolveServerSentryRuntimeConfig({
        SENTRY_DSN: "http://public@example.ingest.sentry.io/123",
      }),
    ).toBeNull();
  });

  it("infers staging environment and API release from Vercel branch and commit", () => {
    expect(
      resolveServerSentryRuntimeConfig({
        SENTRY_DSN: "https://public@example.ingest.sentry.io/123",
        VERCEL_GIT_COMMIT_REF: "staging",
        VERCEL_GIT_COMMIT_SHA: "abc123",
      }),
    ).toEqual({
      dsn: "https://public@example.ingest.sentry.io/123",
      environment: "staging",
      release: "trustkeyper-api@abc123",
    });
  });
});

describe("initServerSentry", () => {
  it("initializes with privacy controls and no tracing, profiling, replay, or logs", () => {
    expect(
      initServerSentry({
        SENTRY_DSN: "https://public@example.ingest.sentry.io/123",
        SENTRY_ENABLED: "true",
      }),
    ).toBe(true);

    const options = sentryMocks.init.mock.calls[0]?.[0];
    expect(options).toMatchObject({
      dataCollection: {
        cookies: false,
        databaseQueryData: false,
        frameContextLines: 0,
        graphQL: { document: false, variables: false },
        httpBodies: [],
        httpHeaders: { request: false, response: false },
        stackFrameVariables: false,
        urlQueryParams: false,
        userInfo: false,
      },
      enableLogs: false,
      sendDefaultPii: false,
    });
    expect(options).not.toHaveProperty("profilesSampleRate");
    expect(options).not.toHaveProperty("replaysOnErrorSampleRate");
    expect(options).not.toHaveProperty("replaysSessionSampleRate");
    expect(options).not.toHaveProperty("tracesSampleRate");
    expect(options).not.toHaveProperty("tracesSampler");
  });

  it("does not capture when server Sentry is disabled", () => {
    expect(captureApiError(new Error("boom"))).toBeUndefined();
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });
});
