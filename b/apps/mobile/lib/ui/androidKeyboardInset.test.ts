import { describe, expect, it } from "vitest";
import {
  androidKeyboardInsetFromHeight,
  androidOverlayKeyboardInset,
  androidWindowDidResizeForKeyboard,
} from "./androidKeyboardInset";

describe("androidKeyboardInsetFromHeight", () => {
  it("pads by keyboard height on Android when the window did not resize", () => {
    expect(androidKeyboardInsetFromHeight("android", 320, false)).toBe(320);
  });

  it("does not pad on Android when adjustResize already shrank the window", () => {
    expect(androidKeyboardInsetFromHeight("android", 320, true)).toBe(0);
  });

  it("returns 0 on iOS (KeyboardAvoidingView handles that platform)", () => {
    expect(androidKeyboardInsetFromHeight("ios", 320, false)).toBe(0);
  });

  it("ignores non-positive heights", () => {
    expect(androidKeyboardInsetFromHeight("android", 0, false)).toBe(0);
    expect(androidKeyboardInsetFromHeight("android", -10, false)).toBe(0);
  });
});

describe("androidOverlayKeyboardInset", () => {
  it("always pads by keyboard height on Android (Modal is not the resized Activity)", () => {
    expect(androidOverlayKeyboardInset("android", 320)).toBe(320);
  });

  it("returns 0 on iOS", () => {
    expect(androidOverlayKeyboardInset("ios", 320)).toBe(0);
  });

  it("ignores non-positive heights", () => {
    expect(androidOverlayKeyboardInset("android", 0)).toBe(0);
  });
});

describe("androidWindowDidResizeForKeyboard", () => {
  it("detects overlay (no window shrink) as not resized", () => {
    expect(androidWindowDidResizeForKeyboard(800, 800, 300)).toBe(false);
  });

  it("detects adjustResize when window shrank by most of the keyboard height", () => {
    expect(androidWindowDidResizeForKeyboard(800, 500, 300)).toBe(true);
  });

  it("treats a small shrink as not resized", () => {
    expect(androidWindowDidResizeForKeyboard(800, 780, 300)).toBe(false);
  });
});
