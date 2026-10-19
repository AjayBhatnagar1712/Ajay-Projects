import { describe, expect, it } from "vitest";
import {
  TEXT_AREA_COMPACT_LINES,
  TEXT_AREA_DEFAULT_LINES,
  TEXT_AREA_MIN_CONTENT_HEIGHT,
  textAreaContentMinHeight,
} from "./textAreaFieldChrome";

describe("textAreaContentMinHeight", () => {
  it("keeps the historical 4-line address field at 88pt", () => {
    expect(textAreaContentMinHeight(TEXT_AREA_DEFAULT_LINES)).toBe(88);
  });

  it("caps compact inventory description at 2 lines (44pt)", () => {
    expect(textAreaContentMinHeight(TEXT_AREA_COMPACT_LINES)).toBe(
      TEXT_AREA_MIN_CONTENT_HEIGHT,
    );
  });

  it("rejects non-positive line counts back to the 44pt floor", () => {
    expect(textAreaContentMinHeight(0)).toBe(TEXT_AREA_MIN_CONTENT_HEIGHT);
    expect(textAreaContentMinHeight(1.5)).toBe(TEXT_AREA_MIN_CONTENT_HEIGHT);
  });
});
