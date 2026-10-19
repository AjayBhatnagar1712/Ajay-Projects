import { describe, expect, it } from "vitest";

/**
 * Mirrors MultiSelectCheckboxGroup toggle behaviour without RN rendering.
 */
function nextValues(
  values: readonly string[],
  value: string,
  checked: boolean,
): string[] {
  if (checked) {
    if (values.includes(value)) return [...values];
    return [...values, value];
  }
  return values.filter((item) => item !== value);
}

describe("MultiSelectCheckboxGroup toggle contract", () => {
  it("adds a value when checked", () => {
    expect(nextValues(["rent"], "sale", true)).toEqual(["rent", "sale"]);
  });

  it("removes a value when unchecked", () => {
    expect(nextValues(["rent", "sale"], "rent", false)).toEqual(["sale"]);
  });

  it("is idempotent when checking an already-selected value", () => {
    expect(nextValues(["rent"], "rent", true)).toEqual(["rent"]);
  });
});
