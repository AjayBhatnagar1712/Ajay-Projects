import { describe, it, expect } from "vitest";
import { offsetsForStrength, SCROLL_KEYFRAMES } from "@/lib/heroParallax";

describe("offsetsForStrength", () => {
  it("returns five keyframe offsets with alternating sign", () => {
    const offsets = offsetsForStrength(10);
    expect(offsets).toHaveLength(5);
    expect(offsets[0]).toBe(6);
    expect(offsets[1]).toBe(-10);
    expect(offsets[4]).toBe(5);
  });

  it("scales linearly with strength", () => {
    const weak = offsetsForStrength(5);
    const strong = offsetsForStrength(10);
    expect(strong[1]).toBe(weak[1] * 2);
  });
});

describe("SCROLL_KEYFRAMES", () => {
  it("spans from 0 to 1 in equal steps", () => {
    expect(SCROLL_KEYFRAMES).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});
