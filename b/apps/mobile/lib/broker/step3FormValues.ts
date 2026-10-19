import {
  BrokerDealsWithOptionSchema,
  BrokerOnboardingStep3Schema,
  BrokerPropertyTypeSchema,
  type BrokerProfile,
} from "@workspace/api-schemas";
import type { z } from "zod";

type Step3Values = z.infer<typeof BrokerOnboardingStep3Schema>;
type DealOption = z.infer<typeof BrokerDealsWithOptionSchema>;
type PropertyOption = z.infer<typeof BrokerPropertyTypeSchema>;

function filterDeals(values: readonly string[]): DealOption[] {
  const out: DealOption[] = [];
  for (const value of values) {
    const parsed = BrokerDealsWithOptionSchema.safeParse(value);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

function filterPropertyTypes(values: readonly string[]): PropertyOption[] {
  const out: PropertyOption[] = [];
  for (const value of values) {
    const parsed = BrokerPropertyTypeSchema.safeParse(value);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * Map a saved broker profile into step-3 form defaults.
 * Used when remounting after Stack back/replace or resume.
 */
export function step3ValuesFromProfile(
  profile: Pick<
    BrokerProfile,
    "dealsWith" | "dealsWithOther" | "propertyTypes" | "propertyTypesOther"
  >,
): Step3Values {
  const dealsWith = filterDeals(profile.dealsWith);
  const propertyTypes = filterPropertyTypes(profile.propertyTypes);
  return {
    dealsWith,
    dealsWithOther: dealsWith.includes("other")
      ? (profile.dealsWithOther ?? null)
      : null,
    propertyTypes,
    propertyTypesOther: propertyTypes.includes("other")
      ? (profile.propertyTypesOther ?? null)
      : null,
    stepCompleted: 3,
  };
}

/** True when the profile has any step-3 field worth hydrating. */
export function profileHasStep3Data(
  profile:
    | Pick<
        BrokerProfile,
        "dealsWith" | "dealsWithOther" | "propertyTypes" | "propertyTypesOther"
      >
    | null
    | undefined,
): boolean {
  if (!profile) return false;
  if (filterDeals(profile.dealsWith).length > 0) return true;
  if (filterPropertyTypes(profile.propertyTypes).length > 0) return true;
  if (
    profile.dealsWithOther != null &&
    profile.dealsWithOther.trim().length > 0
  ) {
    return true;
  }
  if (
    profile.propertyTypesOther != null &&
    profile.propertyTypesOther.trim().length > 0
  ) {
    return true;
  }
  return false;
}
