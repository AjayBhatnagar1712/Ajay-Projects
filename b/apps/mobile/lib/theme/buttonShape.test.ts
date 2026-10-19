import { describe, expect, it } from "vitest";
import { shape } from "./shape";

describe("shared Button shape tokens", () => {
  it("defines one CTA height used app-wide", () => {
    expect(shape.buttonHeight).toBe(48);
  });

  it("keeps radiusButton as a true pill of buttonHeight", () => {
    expect(shape.radiusButton).toBe(shape.buttonHeight / 2);
  });

  it("defines 32px field stack gap for input-heavy screens", () => {
    expect(shape.fieldStackGap).toBe(32);
  });
});
