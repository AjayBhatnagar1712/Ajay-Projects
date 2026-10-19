import { describe, expect, it } from "vitest";
import { deriveBedroomsFromUnitSize } from "./properties";

describe("deriveBedroomsFromUnitSize", () => {
  it("returns bedroom count from standard BHK options", () => {
    expect(deriveBedroomsFromUnitSize("1 BHK")).toBe("1");
    expect(deriveBedroomsFromUnitSize("2 BHK")).toBe("2");
    expect(deriveBedroomsFromUnitSize("3 BHK")).toBe("3");
    expect(deriveBedroomsFromUnitSize("4 BHK")).toBe("4");
  });

  it("returns 1 for 1 RK", () => {
    expect(deriveBedroomsFromUnitSize("1 RK")).toBe("1");
  });

  it("parses BHK from custom Other text", () => {
    expect(deriveBedroomsFromUnitSize("Other", "5 BHK penthouse")).toBe("5");
  });

  it("returns empty string when size cannot be parsed", () => {
    expect(deriveBedroomsFromUnitSize("Other", "Studio loft")).toBe("");
    expect(deriveBedroomsFromUnitSize("", "")).toBe("");
  });
});
