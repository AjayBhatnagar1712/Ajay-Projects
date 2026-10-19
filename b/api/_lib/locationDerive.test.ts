import { describe, expect, it } from "vitest";
import {
  derivePincodeFromAddressComponents,
  deriveRegionFromAddressComponents,
  normalizeIndiaPincodeInput,
  type PlacesAddressComponent,
} from "./locationDerive";

const hyderabad: PlacesAddressComponent[] = [
  { longText: "500032", types: ["postal_code"] },
  { longText: "Hyderabad", types: ["locality", "political"] },
  { longText: "Telangana", types: ["administrative_area_level_1", "political"] },
  { longText: "India", types: ["country", "political"] },
];

describe("deriveRegionFromAddressComponents", () => {
  it("uses locality when no more specific component exists", () => {
    expect(deriveRegionFromAddressComponents(hyderabad)).toBe("Hyderabad");
  });

  it("prefers sublocality over city locality", () => {
    expect(
      deriveRegionFromAddressComponents([
        { longText: "Gachibowli", types: ["sublocality_level_1", "political"] },
        { longText: "Hyderabad", types: ["locality", "political"] },
        { longText: "Telangana", types: ["administrative_area_level_1"] },
      ]),
    ).toBe("Gachibowli");
  });

  it("falls back to sublocality when locality is absent", () => {
    expect(
      deriveRegionFromAddressComponents([
        { longText: "Banjara Hills", types: ["sublocality", "political"] },
        { longText: "Telangana", types: ["administrative_area_level_1"] },
      ]),
    ).toBe("Banjara Hills");
  });

  it("returns empty string when nothing usable", () => {
    expect(deriveRegionFromAddressComponents([])).toBe("");
  });
});

describe("derivePincodeFromAddressComponents", () => {
  it("returns a 6-digit Indian postal code", () => {
    expect(derivePincodeFromAddressComponents(hyderabad)).toBe("500032");
  });

  it("returns null when postal code is missing", () => {
    expect(
      derivePincodeFromAddressComponents([
        { longText: "Mumbai", types: ["locality"] },
      ]),
    ).toBeNull();
  });

  it("returns null when postal code is not 6 digits", () => {
    expect(
      derivePincodeFromAddressComponents([
        { longText: "94043", types: ["postal_code"] },
      ]),
    ).toBeNull();
  });
});

describe("normalizeIndiaPincodeInput", () => {
  it("accepts 6 digits", () => {
    expect(normalizeIndiaPincodeInput("560001")).toBe("560001");
  });

  it("strips non-digits and rejects short values", () => {
    expect(normalizeIndiaPincodeInput("56-00")).toBeNull();
  });
});
