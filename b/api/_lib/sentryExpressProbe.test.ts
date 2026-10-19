import { afterEach, describe, expect, it, vi } from "vitest";
import { sentryApiTestErrorRoute } from "../../artifacts/api-server/src/lib/sentry.js";

type Request = Parameters<typeof sentryApiTestErrorRoute>[0];
type Response = Parameters<typeof sentryApiTestErrorRoute>[1];

afterEach(() => vi.unstubAllEnvs());

describe("Express Sentry probe deployment gate", () => {
  it.each([
    { VERCEL_ENV: "production", SENTRY_ENVIRONMENT: "staging" },
    { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "main" },
    { VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "production" },
    { VERCEL_ENV: "preview", SENTRY_ENVIRONMENT: "production" },
    { NODE_ENV: "production", SENTRY_ENVIRONMENT: "staging" },
    {},
  ])("returns 404 without throwing for %j", (env) => {
    for (const key of ["VERCEL_ENV", "VERCEL_TARGET_ENV", "VERCEL_GIT_COMMIT_REF", "SENTRY_ENVIRONMENT", "NODE_ENV"]) {
      vi.stubEnv(key, undefined);
    }
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    vi.stubEnv("SENTRY_API_TEST_ERROR_ENABLED", "1");
    vi.stubEnv("SENTRY_API_TEST_ERROR_TOKEN", "secret");
    const req = { get: () => "secret" } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    expect(() => sentryApiTestErrorRoute(req, res, vi.fn())).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("throws the probe only on an opted-in preview with the matching token", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_TARGET_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "codex/sentry-api-monitoring");
    vi.stubEnv("SENTRY_ENVIRONMENT", "preview");
    vi.stubEnv("SENTRY_API_TEST_ERROR_ENABLED", "1");
    vi.stubEnv("SENTRY_API_TEST_ERROR_TOKEN", "secret");
    const req = { get: () => "secret" } as unknown as Request;
    expect(() => sentryApiTestErrorRoute(req, {} as Response, vi.fn())).toThrow("source-map verification");
  });
});
