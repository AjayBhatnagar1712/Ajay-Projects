import { describe, expect, it, vi } from "vitest";
import { createTapUnlock } from "./createTapUnlock";

describe("createTapUnlock", () => {
  it("fires after the required taps within the window", () => {
    const onUnlock = vi.fn();
    let t = 1_000;
    const tap = createTapUnlock({
      tapsRequired: 5,
      windowMs: 2_000,
      onUnlock,
      now: () => t,
    });

    tap();
    tap();
    tap();
    tap();
    expect(onUnlock).not.toHaveBeenCalled();
    tap();
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it("resets the count when the window expires", () => {
    const onUnlock = vi.fn();
    let t = 1_000;
    const tap = createTapUnlock({
      tapsRequired: 5,
      windowMs: 2_000,
      onUnlock,
      now: () => t,
    });

    tap();
    tap();
    tap();
    t = 4_000;
    tap();
    tap();
    tap();
    tap();
    expect(onUnlock).not.toHaveBeenCalled();
    tap();
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });
});
