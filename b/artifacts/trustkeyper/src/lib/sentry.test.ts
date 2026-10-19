import { afterEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  breadcrumbsIntegration: vi.fn(() => ({ name: "Breadcrumbs" })),
  init: vi.fn<(options: Record<string, unknown>) => void>(),
}));

vi.mock("@sentry/react", () => sentryMocks);

import { initAppSentry, resolveSentryRuntimeConfig } from "@/lib/sentry";

const originalDsn = import.meta.env.VITE_SENTRY_DSN;
const originalEnabled = import.meta.env.VITE_SENTRY_ENABLED;

afterEach(() => {
  import.meta.env.VITE_SENTRY_DSN = originalDsn;
  import.meta.env.VITE_SENTRY_ENABLED = originalEnabled;
  vi.clearAllMocks();
});

describe("resolveSentryRuntimeConfig", () => {
  it("disables Sentry when the DSN is missing", () => {
    expect(resolveSentryRuntimeConfig({})).toBeNull();
  });

  it("disables Sentry when the kill switch is set", () => {
    expect(
      resolveSentryRuntimeConfig({
        VITE_SENTRY_DSN: "https://public@example.ingest.sentry.io/123",
        VITE_SENTRY_ENABLED: "false",
      }),
    ).toBeNull();
  });

  it("rejects malformed and non-HTTPS DSNs without throwing", () => {
    expect(
      resolveSentryRuntimeConfig({ VITE_SENTRY_DSN: "not-a-url" }),
    ).toBeNull();
    expect(
      resolveSentryRuntimeConfig({
        VITE_SENTRY_DSN: "http://public@example.ingest.sentry.io/123",
      }),
    ).toBeNull();
  });

  it("accepts a valid HTTPS DSN", () => {
    expect(
      resolveSentryRuntimeConfig({
        VITE_SENTRY_DSN: "https://public@example.ingest.sentry.io/123",
      }),
    ).toEqual({
      dsn: "https://public@example.ingest.sentry.io/123",
    });
  });

  it("initializes error monitoring with privacy controls and no tracing or replay", () => {
    import.meta.env.VITE_SENTRY_DSN =
      "https://public@example.ingest.sentry.io/123";
    import.meta.env.VITE_SENTRY_ENABLED = "true";

    expect(initAppSentry()).toBe(true);
    expect(sentryMocks.init).toHaveBeenCalledTimes(1);

    const options = sentryMocks.init.mock.calls[0]?.[0];
    expect(options).toBeDefined();
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

  it("keeps the App running if the SDK cannot initialize", () => {
    import.meta.env.VITE_SENTRY_DSN =
      "https://public@example.ingest.sentry.io/123";
    sentryMocks.init.mockImplementationOnce(() => {
      throw new Error("SDK initialization failed");
    });

    expect(initAppSentry()).toBe(false);
  });
});
