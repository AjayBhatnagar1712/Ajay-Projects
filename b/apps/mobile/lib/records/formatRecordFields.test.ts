import { describe, expect, it } from "vitest";
import {
  formatAreaSqft,
  propertyCountLabel,
  propertyDetailRows,
} from "./formatRecordFields";

describe("formatAreaSqft", () => {
  it("formats with locale grouping and sq ft suffix", () => {
    expect(formatAreaSqft(1250)).toBe("1,250 sq ft");
  });
});

describe("propertyCountLabel", () => {
  it("singular and plural", () => {
    expect(propertyCountLabel(1)).toBe("1 property");
    expect(propertyCountLabel(3)).toBe("3 properties");
  });
});

describe("propertyDetailRows", () => {
  it("omits null and empty fields", () => {
    expect(
      propertyDetailRows({
        key: "a",
        address: "12A",
        areaSqft: 850,
        facing: null,
        carParkingCount: null,
      }),
    ).toEqual([{ label: "Area", value: "850 sq ft" }]);
  });

  it("includes zero parking and trims facing", () => {
    expect(
      propertyDetailRows({
        key: "b",
        address: "Flat 1",
        areaSqft: null,
        facing: "  East  ",
        carParkingCount: 0,
      }),
    ).toEqual([
      { label: "Facing", value: "East" },
      { label: "Car parking", value: "0" },
    ]);
  });

  it("omits blank facing strings", () => {
    expect(
      propertyDetailRows({
        key: "c",
        address: "X",
        areaSqft: null,
        facing: "   ",
        carParkingCount: null,
      }),
    ).toEqual([]);
  });
});
