import { describe, expect, it } from "vitest";
import {
  digitsOnly,
  formatIndianMobileDisplay,
  formatIndianMobileMasked,
} from "./phoneDisplay";

describe("phoneDisplay", () => {
  it("strips non-digits and caps length", () => {
    expect(digitsOnly("98a76-54321099", 10)).toBe("9876543210");
  });

  it("formats display with a space after five digits", () => {
    expect(formatIndianMobileDisplay("98765")).toBe("98765");
    expect(formatIndianMobileDisplay("9876543210")).toBe("98765 43210");
  });

  it("formats masked caption with country code", () => {
    expect(formatIndianMobileMasked("9876543210")).toBe("+91 98765 43210");
  });
});
