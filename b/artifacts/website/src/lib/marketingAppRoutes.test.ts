import { describe, expect, it, vi } from "vitest";
import {
  buildMarketingExistingAccountUrl,
  buildMarketingNewUserSignupUrl,
  buildMarketingSignupUrl,
} from "./marketingAppRoutes";
import { decodeMarketingSessionHash } from "./marketingSessionHandoff";

describe("marketingAppRoutes", () => {
  it("builds dashboard handoff urls for existing accounts", () => {
    const url = new URL(
      buildMarketingExistingAccountUrl({
        phone: "6369856040",
        role: "owner",
        rememberMe: true,
      }),
    );
    expect(url.pathname).toBe("/owner/dashboard");
    expect(url.searchParams.get("phone")).toBe("6369856040");
    expect(url.searchParams.get("role")).toBe("owner");
    expect(url.searchParams.get("remember")).toBe("1");
    expect(url.searchParams.get("from")).toBe("marketing");
  });

  it("embeds supabase session tokens in the handoff hash", () => {
    const url = new URL(
      buildMarketingExistingAccountUrl({
        phone: "6369856040",
        role: "broker",
        rememberMe: false,
        accessToken: "access-123",
        refreshToken: "refresh-456",
      }),
    );
    expect(decodeMarketingSessionHash(url.hash)).toEqual({
      access_token: "access-123",
      refresh_token: "refresh-456",
    });
  });

  it("builds signup handoff urls for new roles", () => {
    const url = new URL(
      buildMarketingSignupUrl({
        phone: "6369856040",
        role: "broker",
        rememberMe: false,
      }),
    );
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("signup")).toBe("1");
    expect(url.searchParams.get("role")).toBe("broker");
  });

  it("builds new-user signup urls without a preset role", () => {
    const url = new URL(buildMarketingNewUserSignupUrl("6369856040", true));
    expect(url.searchParams.get("signup")).toBe("1");
    expect(url.searchParams.get("role")).toBeNull();
    expect(url.searchParams.get("remember")).toBe("1");
  });

  it("uses staging app base when VITE_APP_URL is set", () => {
    vi.stubEnv("VITE_APP_URL", "https://staging.app.trustkeyper.com");
    const url = new URL(
      buildMarketingExistingAccountUrl({
        phone: "6369856040",
        role: "owner",
        rememberMe: false,
      }),
    );
    expect(url.origin).toBe("https://staging.app.trustkeyper.com");
    vi.unstubAllEnvs();
  });
});
