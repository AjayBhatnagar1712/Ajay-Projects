/**
 * Aggregate selected work locations into brokers.region + brokers.pincodes.
 * No schema change — multiple places become joined region names + pincode list.
 * Pincodes are optional: city/locality Places results often have no postal_code.
 */

export type WorkLocationSelection = {
  /** placeId or `manual:<id>` */
  key: string;
  label: string;
  region: string;
  pincode: string | null;
};

export function selectionsToProfileFields(
  selections: WorkLocationSelection[],
): { region: string; pincodes: string[] } {
  const regions: string[] = [];
  const pincodes: string[] = [];
  const seenRegion = new Set<string>();
  const seenPin = new Set<string>();

  for (const item of selections) {
    const region = item.region.trim();
    if (region.length > 0 && !seenRegion.has(region.toLowerCase())) {
      seenRegion.add(region.toLowerCase());
      regions.push(region);
    }
    const pin = item.pincode?.trim() ?? "";
    if (/^\d{6}$/.test(pin) && !seenPin.has(pin)) {
      seenPin.add(pin);
      pincodes.push(pin);
    }
  }

  return {
    region: regions.join(", "),
    pincodes,
  };
}

/**
 * Duplicate = same Google placeId (or same manual key), nothing else.
 *
 * Do not compare derived region/pincode: neighbourhoods in the same city often
 * share locality (e.g. both "Hyderabad") and omit postal_code, which falsely
 * flagged distinct places as duplicates.
 */
export function selectionIsDuplicate(
  selections: WorkLocationSelection[],
  candidate: Pick<WorkLocationSelection, "key">,
): boolean {
  return selections.some((item) => item.key === candidate.key);
}

/** Rebuild chips from saved profile (best-effort; placeIds are not stored). */
export function selectionsFromProfile(
  profile: Pick<{ region: string; pincodes: string[] }, "region" | "pincodes">,
): WorkLocationSelection[] {
  const regionParts = profile.region
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const pincodes = profile.pincodes.filter((pin) => /^\d{6}$/.test(pin));

  if (pincodes.length === 0 && regionParts.length === 0) return [];

  if (pincodes.length === 0) {
    return regionParts.map((region, index) => ({
      key: `saved:region:${index}:${region}`,
      label: region,
      region,
      pincode: null,
    }));
  }

  return pincodes.map((pincode, index) => {
    const region = regionParts[index] ?? regionParts[0] ?? "";
    const label = region.length > 0 ? `${region} · ${pincode}` : pincode;
    return {
      key: `saved:pin:${pincode}`,
      label,
      region: region.length > 0 ? region : pincode,
      pincode,
    };
  });
}

/** Finish requires at least one place/region — pincodes may be empty. */
export function selectionsReadyToSubmit(
  selections: WorkLocationSelection[],
): boolean {
  const { region } = selectionsToProfileFields(selections);
  return region.length > 0;
}
