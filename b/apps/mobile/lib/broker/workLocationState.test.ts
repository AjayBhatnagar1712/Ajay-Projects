import { describe, expect, it } from "vitest";
import {
  deriveIndianState,
  findIndianStateInRegion,
  formatIndianState,
  normalizeIndianState,
  regionWithIndianState,
  regionWithoutIndianState,
} from "./workLocationState";

describe("work location state", () => {
  it("normalizes valid state names", () => {
    expect(normalizeIndianState("  Karnataka ")).toBe("KARNATAKA");
    expect(normalizeIndianState("not a state")).toBeNull();
  });

  it("finds explicit states and derives common city states", () => {
    expect(findIndianStateInRegion("Indiranagar, Bengaluru, Karnataka")).toBe(
      "KARNATAKA",
    );
    expect(deriveIndianState("Bengaluru")).toBe("KARNATAKA");
  });

  it("replaces the stored state without changing the location", () => {
    expect(regionWithIndianState("Bengaluru, Karnataka", "Telangana")).toBe(
      "Bengaluru, TELANGANA",
    );
    expect(
      regionWithIndianState(
        "Indiranagar, Bengaluru, Karnataka, India",
        "Karnataka",
      ),
    ).toBe("Indiranagar, Bengaluru, KARNATAKA, India");
  });

  it("separates location and state for profile display", () => {
    expect(regionWithoutIndianState("Bengaluru, KARNATAKA")).toBe("Bengaluru");
    expect(formatIndianState("KARNATAKA")).toBe("Karnataka");
  });
});
