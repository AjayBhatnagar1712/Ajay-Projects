import { describe, expect, it } from "vitest";
import {
  iconButtonHitSlop,
  iconButtonTouchExtent,
  MIN_ICON_BUTTON_TOUCH_PT,
  PAPER_ICON_PADDING,
} from "./iconButtonTouchTarget";

describe("AppIconButton touch target", () => {
  it("expands default icon size 24 (Paper 40) to at least 44", () => {
    expect(24 + 2 * PAPER_ICON_PADDING).toBe(40);
    expect(iconButtonTouchExtent(24)).toBe(MIN_ICON_BUTTON_TOUCH_PT);
    expect(iconButtonHitSlop(24)).toEqual({ top: 2, bottom: 2, left: 2, right: 2 });
  });

  it("keeps larger icons at Paper size when already ≥ 44", () => {
    expect(iconButtonTouchExtent(28)).toBe(44);
    expect(iconButtonHitSlop(28)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    expect(iconButtonTouchExtent(32)).toBe(48);
    expect(iconButtonHitSlop(32)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });
});
