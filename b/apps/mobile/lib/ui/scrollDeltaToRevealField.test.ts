import { describe, expect, it } from "vitest";
import { scrollDeltaToRevealField } from "./scrollDeltaToRevealField";

describe("scrollDeltaToRevealField", () => {
  it("returns 0 when the field is already inside the visible area", () => {
    expect(
      scrollDeltaToRevealField({
        fieldY: 200,
        fieldHeight: 56,
        scrollViewY: 100,
        scrollViewHeight: 400,
      }),
    ).toBe(0);
  });

  it("scrolls down when the field sits below the visible bottom", () => {
    expect(
      scrollDeltaToRevealField({
        fieldY: 480,
        fieldHeight: 56,
        scrollViewY: 100,
        scrollViewHeight: 400,
        margin: 24,
      }),
    ).toBe(480 + 56 - (100 + 400 - 24));
  });

  it("scrolls up when the field sits above the visible top", () => {
    expect(
      scrollDeltaToRevealField({
        fieldY: 80,
        fieldHeight: 56,
        scrollViewY: 100,
        scrollViewHeight: 400,
        margin: 24,
      }),
    ).toBe(80 - (100 + 24));
  });
});
