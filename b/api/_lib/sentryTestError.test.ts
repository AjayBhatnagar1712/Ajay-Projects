import { describe, expect, it } from "vitest";
import type { VercelRequest } from "@vercel/node";
import {
  isSentryApiTestErrorAllowed,
  throwSentryApiSourceMapProbe,
} from "./sentryTestError";

function requestWithHeader(value?: string): VercelRequest {
  return {
    headers: value === undefined ? {} : { "x-trustkeyper-sentry-test": value },
  } as VercelRequest;
}

describe("Sentry API test error gate", () => {
  it("stays closed unless the staging probe flag and token match", () => {
    expect(
      isSentryApiTestErrorAllowed(requestWithHeader("secret"), {
        SENTRY_API_TEST_ERROR_ENABLED: "0",
        VERCEL_ENV: "preview",
        SENTRY_API_TEST_ERROR_TOKEN: "secret",
      } as NodeJS.ProcessEnv),
    ).toBe(false);

    expect(
      isSentryApiTestErrorAllowed(requestWithHeader("wrong"), {
        SENTRY_API_TEST_ERROR_ENABLED: "1",
        VERCEL_ENV: "preview",
        SENTRY_API_TEST_ERROR_TOKEN: "secret",
      } as NodeJS.ProcessEnv),
    ).toBe(false);

    expect(
      isSentryApiTestErrorAllowed(requestWithHeader("secret"), {
        SENTRY_API_TEST_ERROR_ENABLED: "1",
        VERCEL_ENV: "preview",
        SENTRY_API_TEST_ERROR_TOKEN: "secret",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it.each([
    {},
    { VERCEL_ENV: "production", SENTRY_ENVIRONMENT: "staging" },
    { VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "production" },
    { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "main" },
    { VERCEL_ENV: "preview", SENTRY_ENVIRONMENT: "production" },
    { NODE_ENV: "production", SENTRY_ENVIRONMENT: "staging" },
  ])("rejects production or unknown deployment metadata: %j", (env) => {
    expect(isSentryApiTestErrorAllowed(requestWithHeader("secret"), {
      ...env,
      SENTRY_API_TEST_ERROR_ENABLED: "1",
      SENTRY_API_TEST_ERROR_TOKEN: "secret",
    })).toBe(false);
  });

  it("allows an explicitly configured local staging test", () => {
    expect(isSentryApiTestErrorAllowed(requestWithHeader("secret"), {
      NODE_ENV: "development",
      SENTRY_ENVIRONMENT: "staging",
      SENTRY_API_TEST_ERROR_ENABLED: "1",
      SENTRY_API_TEST_ERROR_TOKEN: "secret",
    })).toBe(true);
  });

  it("throws the deliberate source-map verification error", () => {
    expect(() => throwSentryApiSourceMapProbe()).toThrow(
      "TrustKeyper API Sentry source-map verification",
    );
  });
});
