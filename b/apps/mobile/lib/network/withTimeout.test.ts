import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "./withTimeout";

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when the promise settles before the deadline", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1_000)).resolves.toBe("ok");
  });

  it("rejects with the timeout message when the promise hangs", async () => {
    vi.useFakeTimers();
    const hung = new Promise<string>(() => {
      /* never settles */
    });
    const pending = withTimeout(hung, 15_000, "Couldn't send code. Check your connection and try again.");
    const assertion = expect(pending).rejects.toThrow(
      "Couldn't send code. Check your connection and try again.",
    );
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});
