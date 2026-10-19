import { describe, expect, it } from "vitest";
import {
  INTRO_AUTO_ADVANCE_MS,
  INTRO_ILLUSTRATION_HEIGHT,
  introSegmentFill,
  introUsesImage,
  nextIntroPage,
} from "./introCarousel";

describe("introCarousel helpers", () => {
  it("uses a 4–5s auto-advance window", () => {
    expect(INTRO_AUTO_ADVANCE_MS).toBeGreaterThanOrEqual(4000);
    expect(INTRO_AUTO_ADVANCE_MS).toBeLessThanOrEqual(5000);
  });

  it("keeps the illustration panel tall", () => {
    expect(INTRO_ILLUSTRATION_HEIGHT).toBe("70%");
  });

  it("advances and wraps after the last slide", () => {
    expect(nextIntroPage(0, 3)).toBe(1);
    expect(nextIntroPage(1, 3)).toBe(2);
    expect(nextIntroPage(2, 3)).toBe(0);
  });

  it("fills past segments, empties upcoming, and partial-fills active", () => {
    expect(introSegmentFill(0, 1, 0.4)).toBe(1);
    expect(introSegmentFill(1, 1, 0.4)).toBe(0.4);
    expect(introSegmentFill(2, 1, 0.4)).toBe(0);
  });

  it("uses image when present and falls back to icon when absent", () => {
    expect(introUsesImage({ icon: "file-document-edit-outline", image: 1 })).toBe(
      true,
    );
    expect(introUsesImage({ icon: "file-document-edit-outline" })).toBe(false);
    expect(
      introUsesImage({ icon: "file-document-edit-outline", image: undefined }),
    ).toBe(false);
  });
});
