import { describe, expect, it } from "vitest";
import {
  FORM_SCROLL_KEYBOARD_SHOULD_PERSIST_TAPS,
  formScrollKeyboardDismissMode,
} from "./formScrollKeyboard";

describe("formScrollKeyboard", () => {
  it("persists taps so focus can move to another field without dismissing", () => {
    expect(FORM_SCROLL_KEYBOARD_SHOULD_PERSIST_TAPS).toBe("handled");
  });

  it("keeps the keyboard up while scrolling on iOS (interactive, not on-drag)", () => {
    expect(formScrollKeyboardDismissMode("ios")).toBe("interactive");
  });

  it("does not dismiss the keyboard on Android scroll (none, not on-drag)", () => {
    expect(formScrollKeyboardDismissMode("android")).toBe("none");
  });

  it("uses interactive on web (same as iOS; web ignores unknown modes)", () => {
    expect(formScrollKeyboardDismissMode("web")).toBe("interactive");
  });
});
