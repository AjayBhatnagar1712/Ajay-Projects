import { describe, expect, it, vi } from "vitest";
import {
  buildOwnerSignupProfile,
  describeMarketingSignupProfileFailure,
  pushMarketingSignupProfile,
} from "./marketingSignupApi";

describe("buildOwnerSignupProfile", () => {
  it("trims name and keeps property count", () => {
    expect(buildOwnerSignupProfile("6369856040", "  Meena  ", "01")).toMatchObject({
      phone: "6369856040",
      name: "Meena",
      propertyCount: "01",
    });
  });
});

describe("describeMarketingSignupProfileFailure", () => {
  it("maps 401 to session-expired messaging", async () => {
    const res = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    await expect(describeMarketingSignupProfileFailure(res)).resolves.toMatch(/session expired/i);
  });

  it("maps 403 to phone mismatch messaging", async () => {
    const res = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    await expect(describeMarketingSignupProfileFailure(res)).resolves.toMatch(/does not match/i);
  });

  it("includes server error text for other statuses", async () => {
    const res = new Response(JSON.stringify({ error: "rate limited" }), { status: 429 });
    await expect(describeMarketingSignupProfileFailure(res)).resolves.toContain("rate limited");
  });
});

describe("pushMarketingSignupProfile", () => {
  it("returns missing-session when access token is absent", async () => {
    const result = await pushMarketingSignupProfile({
      phone: "6369856040",
      role: "owner",
      profile: buildOwnerSignupProfile("6369856040", "Meena", "01"),
      accessToken: null,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Missing verification session/i);
  });

  it("surfaces mapped API errors when the profile PUT fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      ),
    );
    const result = await pushMarketingSignupProfile({
      phone: "6369856040",
      role: "owner",
      profile: buildOwnerSignupProfile("6369856040", "Meena", "01"),
      accessToken: "tok",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/session expired/i);
    vi.unstubAllGlobals();
  });
});
