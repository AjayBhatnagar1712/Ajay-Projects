import { describe, expect, it } from "vitest";
import { resolveSecondaryAccent } from "./buttonSecondaryAccent";

describe("resolveSecondaryAccent", () => {
  it("keeps primary tint when interactive", () => {
    expect(
      resolveSecondaryAccent({
        isDisabled: false,
        textColor: "#0066FF",
        outlineColor: "#0066FF",
      }),
    ).toEqual({
      textColor: "#0066FF",
      outlineStyle: { borderColor: "#0066FF" },
    });
  });

  it("drops custom text and outline when disabled so Paper muted styles apply", () => {
    expect(
      resolveSecondaryAccent({
        isDisabled: true,
        textColor: "#0066FF",
        outlineColor: "#0066FF",
      }),
    ).toEqual({ textColor: undefined, outlineStyle: null });
  });

  it("drops custom accents while loading", () => {
    expect(
      resolveSecondaryAccent({
        isDisabled: false,
        isLoading: true,
        textColor: "#0066FF",
        outlineColor: "#0066FF",
      }),
    ).toEqual({ textColor: undefined, outlineStyle: null });
  });
});
