import { describe, expect, it } from "vitest";
import { isSheetEnterPending } from "./bottomSheetEnter";

describe("isSheetEnterPending", () => {
  it("becomes pending on the closed → open edge", () => {
    expect(isSheetEnterPending(true, false, false)).toBe(true);
  });

  it("stays pending while still open until onLayout consumes it", () => {
    expect(isSheetEnterPending(true, true, true)).toBe(true);
  });

  it("stays consumed after onLayout while still open", () => {
    expect(isSheetEnterPending(true, true, false)).toBe(false);
  });

  it("clears pending on close", () => {
    expect(isSheetEnterPending(false, true, true)).toBe(false);
    expect(isSheetEnterPending(false, false, false)).toBe(false);
  });
});
