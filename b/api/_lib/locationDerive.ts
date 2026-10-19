/**
 * Map Google Places (New) address components → broker profile region + pincode.
 * Kept free of fetch/React so Vitest can cover derivation without network.
 */

export type PlacesAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

function componentText(
  components: PlacesAddressComponent[],
  type: string,
): string {
  const match = components.find((item) => item.types?.includes(type));
  const text = match?.longText?.trim() || match?.shortText?.trim() || "";
  return text;
}

/**
 * Prefer the most specific place name for broker "work location" region.
 * Neighbourhoods (Gachibowli) must win over city locality (Hyderabad) so
 * multi-select chips do not all collapse to the same city string.
 */
export function deriveRegionFromAddressComponents(
  components: PlacesAddressComponent[],
): string {
  const candidates = [
    componentText(components, "neighborhood"),
    componentText(components, "sublocality_level_1"),
    componentText(components, "sublocality"),
    componentText(components, "locality"),
    componentText(components, "administrative_area_level_3"),
    componentText(components, "administrative_area_level_2"),
    componentText(components, "administrative_area_level_1"),
  ];
  for (const value of candidates) {
    if (value.length > 0) return value;
  }
  return "";
}

/**
 * India broker pincodes are exactly 6 digits when present.
 * City/locality Place Details often omit postal_code entirely — that is a
 * genuine absence (not ignored data). Non-6-digit values are also treated as
 * absent; callers must not prompt for manual entry.
 */
export function derivePincodeFromAddressComponents(
  components: PlacesAddressComponent[],
): string | null {
  const raw = componentText(components, "postal_code");
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 6) return digits;
  return null;
}

export function normalizeIndiaPincodeInput(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length !== 6) return null;
  return digits;
}
