import { describe, expect, it, vi } from "vitest";
import { replaceRoot } from "./replaceRoot";

describe("replaceRoot", () => {
  it("dismisses only when canDismiss is true, then replaces", () => {
    const dismissAll = vi.fn();
    const replace = vi.fn();
    replaceRoot(
      { canDismiss: () => true, dismissAll, replace } as never,
      "/(auth)/phone",
    );
    expect(dismissAll).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/(auth)/phone");
  });

  it("skips dismissAll when the stack has nothing to pop (Splash alone)", () => {
    const dismissAll = vi.fn();
    const replace = vi.fn();
    replaceRoot(
      { canDismiss: () => false, dismissAll, replace } as never,
      "/(auth)/phone",
    );
    expect(dismissAll).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/(auth)/phone");
  });

  it("still replaces when dismiss APIs are unavailable", () => {
    const replace = vi.fn();
    replaceRoot({ replace } as never, "/(onboarding)/step-1");
    expect(replace).toHaveBeenCalledWith("/(onboarding)/step-1");
  });
});
