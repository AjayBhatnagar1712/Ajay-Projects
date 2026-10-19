import { describe, expect, it } from "vitest";
import { derivePayoutAddressFromProfile } from "./payoutAddress";

describe("derivePayoutAddressFromProfile", () => {
  it("parses a Google-style region with state and a saved pincode", () => {
    const result = derivePayoutAddressFromProfile({
      region: "Indiranagar, Bengaluru, Karnataka, India",
      pincodes: ["560038"],
    });
    expect(result).toEqual({
      ok: true,
      address: {
        street1: "Indiranagar, Bengaluru, Karnataka, India",
        city: "Indiranagar",
        state: "KARNATAKA",
        postalCode: "560038",
      },
    });
  });

  it("maps a city-only region via the city table and extracts PIN from the string", () => {
    const result = derivePayoutAddressFromProfile({
      region: "Hyderabad 500032",
      pincodes: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.address.state).toBe("TELANGANA");
    expect(result.address.postalCode).toBe("500032");
    expect(result.address.city).toBe("Hyderabad");
  });

  it("fails when region is missing", () => {
    const result = derivePayoutAddressFromProfile({ region: "  ", pincodes: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("missing_region");
    expect(result.error).toMatch(/work location/i);
  });

  it("fails when no pincode can be derived", () => {
    const result = derivePayoutAddressFromProfile({
      region: "Bengaluru, Karnataka",
      pincodes: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("missing_postal_code");
    expect(result.error).toMatch(/pincode/i);
  });

  it("fails when state cannot be derived", () => {
    const result = derivePayoutAddressFromProfile({
      region: "Mystery Town",
      pincodes: ["560001"],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unknown_state");
    expect(result.error).toMatch(/state/i);
  });
});
