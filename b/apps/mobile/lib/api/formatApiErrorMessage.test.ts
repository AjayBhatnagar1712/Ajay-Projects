import { describe, expect, it } from "vitest";
import {
  formatApiErrorMessage,
  isSafeUserFacingApiDetail,
} from "./formatApiErrorMessage";

describe("formatApiErrorMessage", () => {
  it("returns string error bodies as-is", () => {
    expect(formatApiErrorMessage(401, { error: "Not authenticated" })).toBe(
      "Not authenticated",
    );
  });

  it("surfaces Razorpay detail alongside generic onboard errors", () => {
    expect(
      formatApiErrorMessage(502, {
        error: "Onboarding step failed",
        step: "stakeholder",
        detail: "The pan is invalid",
      }),
    ).toBe("Onboarding step failed: The pan is invalid");
  });

  it("does not duplicate when detail matches error", () => {
    expect(
      formatApiErrorMessage(502, {
        error: "Bank account invalid",
        detail: "Bank account invalid",
      }),
    ).toBe("Bank account invalid");
  });

  it("ignores unsafe detail (stack traces / oversized dumps)", () => {
    expect(
      formatApiErrorMessage(500, {
        error: "Failed to load account",
        detail: "Error: boom\n    at handler (file.ts:1:1)",
      }),
    ).toBe("Failed to load account");
  });

  it("formats Zod issue arrays from broker profile 400s", () => {
    expect(
      formatApiErrorMessage(400, {
        error: [
          {
            code: "invalid_type",
            path: ["employmentType"],
            message: "Required",
            expected: "'full_time' | 'part_time'",
            received: "undefined",
          },
        ],
      }),
    ).toBe("employmentType: Required");
  });

  it("falls back when body has no usable error", () => {
    expect(formatApiErrorMessage(500, null)).toBe("Request failed (500)");
  });
});

describe("isSafeUserFacingApiDetail", () => {
  it("allows short Razorpay-style validation copy", () => {
    expect(isSafeUserFacingApiDetail("The pan is invalid")).toBe(true);
    expect(isSafeUserFacingApiDetail("Bank account invalid")).toBe(true);
    expect(
      isSafeUserFacingApiDetail("Account creation failed"),
    ).toBe(true);
  });

  it("rejects stacks and oversized text", () => {
    expect(
      isSafeUserFacingApiDetail("Error: boom\n    at handler (file.ts:1:1)"),
    ).toBe(false);
    expect(isSafeUserFacingApiDetail("x".repeat(281))).toBe(false);
  });
});
