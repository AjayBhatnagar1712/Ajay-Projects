import { describe, expect, it } from "vitest";
import { CREATE_AGREEMENT_GESTURE_OPTIONS } from "./createAgreementGestureOptions";

describe("CREATE_AGREEMENT_GESTURE_OPTIONS", () => {
  it("disables native swipe-back (root and nested stacks must both use this)", () => {
    expect(CREATE_AGREEMENT_GESTURE_OPTIONS.gestureEnabled).toBe(false);
    expect(CREATE_AGREEMENT_GESTURE_OPTIONS.fullScreenGestureEnabled).toBe(
      false,
    );
  });
});
