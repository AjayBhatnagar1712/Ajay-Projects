/**
 * Derive Razorpay registered/residential address from the broker profile
 * work locations. The payout form does not collect address fields.
 */

import { deriveIndianState } from "../broker/workLocationState";

export type PayoutAddress = {
  street1: string;
  city: string;
  state: string;
  postalCode: string;
};

export type PayoutAddressSource = {
  region: string;
  pincodes: readonly string[];
};

export type PayoutAddressResult =
  | { ok: true; address: PayoutAddress }
  | {
      ok: false;
      code: "missing_region" | "missing_postal_code" | "unknown_state";
      error: string;
    };

function extractPincode(
  region: string,
  pincodes: readonly string[],
): string | null {
  const fromProfile = pincodes.find((pin) => /^\d{6}$/.test(pin));
  if (fromProfile) return fromProfile;
  const match = region.match(/\b(\d{6})\b/);
  return match?.[1] ?? null;
}

function firstPlaceToken(region: string): string {
  const token = region
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.length > 0 && !/^\d{6}$/.test(part) && part.toLowerCase() !== "india");
  const withoutPin = (token ?? region.trim()).replace(/\s*\b\d{6}\b/g, "").trim();
  return withoutPin.length > 0 ? withoutPin : region.trim();
}

/**
 * Build a Razorpay address from work locations. Fails with a user-facing
 * message when PIN or state cannot be derived — do not invent either.
 */
export function derivePayoutAddressFromProfile(
  profile: PayoutAddressSource | null | undefined,
): PayoutAddressResult {
  const region = profile?.region.trim() ?? "";
  const pincodes = profile?.pincodes ?? [];
  if (region.length === 0) {
    return {
      ok: false,
      code: "missing_region",
      error:
        "Add a work location on your profile so we can send a registered address with payout details.",
    };
  }

  const postalCode = extractPincode(region, pincodes);
  if (!postalCode) {
    return {
      ok: false,
      code: "missing_postal_code",
      error:
        "Add a 6-digit pincode to your work locations, then submit payout details again.",
    };
  }

  const state = deriveIndianState(region);
  if (!state) {
    return {
      ok: false,
      code: "unknown_state",
      error:
        "We could not tell which state your work location is in. Include the state name in the location, then try again.",
    };
  }

  const city = firstPlaceToken(region);
  return {
    ok: true,
    address: {
      street1: region,
      city,
      state,
      postalCode,
    },
  };
}
