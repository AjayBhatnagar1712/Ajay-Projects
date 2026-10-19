import { describe, expect, it } from "vitest";
import { sanitizeErrorForLog } from "./sanitizeErrorForLog.js";

function assertNoMetadataLeak(result: unknown): void {
  const serialized = JSON.stringify(result);
  expect(serialized).not.toMatch(/metadata/i);
  expect(result).not.toHaveProperty("metadata");
  expect(result).not.toHaveProperty("error");
  if (result && typeof result === "object") {
    for (const value of Object.values(result)) {
      expect(typeof value === "string" || value === undefined).toBe(true);
    }
  }
}

describe("sanitizeErrorForLog", () => {
  it("returns message for a plain Error", () => {
    const result = sanitizeErrorForLog(new Error("connection refused"));
    expect(result).toEqual({ message: "connection refused" });
    assertNoMetadataLeak(result);
  });

  it("returns message and code for a Razorpay-shaped error without metadata", () => {
    const result = sanitizeErrorForLog({
      error: {
        code: "BAD_REQUEST_ERROR",
        description: "Account creation failed",
        metadata: {
          account_id: "acc_secret",
          pan: "ABCDE1234F",
        },
      },
    });
    expect(result).toEqual({
      message: "Account creation failed",
      code: "BAD_REQUEST_ERROR",
    });
    assertNoMetadataLeak(result);
    expect(JSON.stringify(result)).not.toContain("acc_secret");
    expect(JSON.stringify(result)).not.toContain("ABCDE1234F");
  });

  it("returns the string itself when a string is thrown", () => {
    const result = sanitizeErrorForLog("boom");
    expect(result).toEqual({ message: "boom" });
    assertNoMetadataLeak(result);
  });

  it("handles null and undefined without throwing", () => {
    const nullResult = sanitizeErrorForLog(null);
    expect(nullResult).toEqual({ message: "null" });
    assertNoMetadataLeak(nullResult);

    const undefinedResult = sanitizeErrorForLog(undefined);
    expect(undefinedResult).toEqual({ message: "undefined" });
    assertNoMetadataLeak(undefinedResult);
  });
});
