import { describe, expect, it } from "vitest";
import { chipWidthForRow } from "./chipWidthForRow";

describe("chipWidthForRow", () => {
  it("splits a measured row into equal columns with gaps", () => {
    // 320 wide, 1 gap of 8 → (320 - 8) / 2 = 156
    expect(chipWidthForRow(320, 2, 8)).toBe(156);
  });

  it("returns 0 for unknown layout width", () => {
    expect(chipWidthForRow(0)).toBe(0);
  });
});
