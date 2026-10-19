import { describe, expect, it, vi } from "vitest";
import {
  buildMarketingAuthRedirectUrl,
  decodeMarketingSessionHash,
  getMarketingSiteUrl,
} from "./marketingHandoff";

describe("marketingHandoff", () => {
  it("returns null redirect url when marketing url is unset", () => {
    expect(getMarketingSiteUrl()).toBeNull();
    expect(buildMarketingAuthRedirectUrl("login")).toBeNull();
  });

  it("decodes session tokens from the marketing handoff hash", () => {
    const payload = btoa(JSON.stringify({ access_token: "abc", refresh_token: "def" }));
    const hash = `#tk_session=${encodeURIComponent(payload)}`;
    expect(decodeMarketingSessionHash(hash)).toEqual({
      access_token: "abc",
      refresh_token: "def",
    });
  });
});

describe("marketingHandoff with VITE_MARKETING_URL", () => {
  it("builds login and signup redirect urls", () => {
    vi.stubEnv("VITE_MARKETING_URL", "https://staging.trustkeyper.com");
    expect(getMarketingSiteUrl()).toBe("https://staging.trustkeyper.com");
    expect(buildMarketingAuthRedirectUrl("login")).toBe("https://staging.trustkeyper.com#login");
    expect(buildMarketingAuthRedirectUrl("signup")).toBe("https://staging.trustkeyper.com#signup");
    vi.unstubAllEnvs();
  });
});
