import { describe, expect, it } from "vitest";
import { maskBankAccountLast4 } from "./maskBankAccount";

describe("maskBankAccountLast4", () => {
  it("formats four digits with bullets", () => {
    expect(maskBankAccountLast4("0251")).toBe("••••0251");
  });

  it("uses the last four when extra digits are present", () => {
    expect(maskBankAccountLast4("12340251")).toBe("••••0251");
  });

  it("returns null when there are not four digits", () => {
    expect(maskBankAccountLast4(null)).toBeNull();
    expect(maskBankAccountLast4("")).toBeNull();
    expect(maskBankAccountLast4("12")).toBeNull();
  });
});
