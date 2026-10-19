import { describe, expect, it } from "vitest";
import { formatRupeesDisplay, parseRupeesInput } from "./moneyFormat";

describe("parseRupeesInput", () => {
  it("strips grouping and currency noise", () => {
    expect(parseRupeesInput("₹ 45,000")).toBe("45000");
    expect(parseRupeesInput("1,35,000")).toBe("135000");
  });

  it("keeps at most two decimal places", () => {
    expect(parseRupeesInput("123.456")).toBe("123.45");
  });
});

describe("formatRupeesDisplay", () => {
  it("groups with Indian thousands separators", () => {
    expect(formatRupeesDisplay("45000")).toBe("45,000");
    expect(formatRupeesDisplay("135000")).toBe("1,35,000");
  });

  it("preserves a trailing decimal while typing", () => {
    expect(formatRupeesDisplay("45.")).toBe("45.");
  });

  it("formats decimal amounts", () => {
    expect(formatRupeesDisplay("123.45")).toBe("123.45");
  });

  it("returns empty for blank input", () => {
    expect(formatRupeesDisplay("")).toBe("");
  });
});
