import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import {
  focusNextField,
  runPrimaryAfterDismiss,
  type FieldFocusHandle,
} from "./fieldFocusChain";

describe("focusNextField", () => {
  it("calls focus on the next ref when present", () => {
    const focus = vi.fn();
    const nextRef = createRef<FieldFocusHandle | null>();
    nextRef.current = { focus };
    focusNextField(nextRef)();
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("no-ops when the next ref is empty", () => {
    const nextRef = createRef<FieldFocusHandle | null>();
    expect(() => focusNextField(nextRef)()).not.toThrow();
  });
});

describe("runPrimaryAfterDismiss", () => {
  it("dismisses then runs the primary action", () => {
    const dismiss = vi.fn();
    const action = vi.fn();
    runPrimaryAfterDismiss(action, dismiss);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
    expect(dismiss.mock.invocationCallOrder[0]).toBeLessThan(
      action.mock.invocationCallOrder[0]!,
    );
  });
});
