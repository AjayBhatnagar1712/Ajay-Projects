import { describe, expect, it } from "vitest";
import { ApiError } from "../api/errors";
import { classifyLaunchFailure, isUnauthorizedError } from "./launchGate";

describe("isUnauthorizedError", () => {
  it("returns true for ApiError 401", () => {
    expect(isUnauthorizedError(new ApiError(401, "Unauthorised", null))).toBe(true);
  });

  it("returns false for other ApiError statuses", () => {
    expect(isUnauthorizedError(new ApiError(500, "Server error", null))).toBe(false);
    expect(isUnauthorizedError(new ApiError(404, "Not found", null))).toBe(false);
  });

  it("returns false for generic errors", () => {
    expect(isUnauthorizedError(new Error("Unauthorised"))).toBe(false);
    expect(isUnauthorizedError("Unauthorised")).toBe(false);
  });
});

describe("classifyLaunchFailure", () => {
  it("routes 401 to unauthenticated", () => {
    expect(classifyLaunchFailure(new ApiError(401, "Unauthorised", null))).toBe(
      "unauthenticated",
    );
  });

  it("keeps network/server failures as retryable errors", () => {
    expect(classifyLaunchFailure(new ApiError(503, "Unavailable", null))).toBe("error");
    expect(classifyLaunchFailure(new Error("Network request failed"))).toBe("error");
  });
});
