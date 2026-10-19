import { describe, expect, it, vi } from "vitest";
import { goBackOrFallback } from "./goBackOrFallback";

describe("goBackOrFallback", () => {
  it("calls router.back when history exists", () => {
    const back = vi.fn();
    const fallback = vi.fn();
    goBackOrFallback({ canGoBack: () => true, back }, fallback);
    expect(back).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("runs fallback when there is no history (resume / cold land)", () => {
    const back = vi.fn();
    const fallback = vi.fn();
    goBackOrFallback({ canGoBack: () => false, back }, fallback);
    expect(back).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
  });
});
