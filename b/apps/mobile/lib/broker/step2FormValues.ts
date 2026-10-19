import {
  BrokerOnboardingStep2Schema,
  type BrokerProfile,
} from "@workspace/api-schemas";
import type { z } from "zod";

type Step2Values = z.infer<typeof BrokerOnboardingStep2Schema>;

function employmentFromProfile(
  value: string,
): Step2Values["employmentType"] {
  if (value === "full_time" || value === "part_time") return value;
  return "full_time";
}

/**
 * Map a saved broker profile into step-2 form defaults.
 * Used when remounting after Stack back/replace or resume — local RHF state
 * is gone; the PATCH on Next is the source of truth.
 */
export function step2ValuesFromProfile(
  profile: Pick<
    BrokerProfile,
    "employmentType" | "businessSinceYear" | "propertiesHandled"
  >,
): Step2Values {
  return {
    employmentType: employmentFromProfile(profile.employmentType),
    businessSinceYear:
      profile.businessSinceYear === null ||
      profile.businessSinceYear === undefined
        ? (undefined as unknown as number)
        : profile.businessSinceYear,
    propertiesHandled:
      profile.propertiesHandled === null ||
      profile.propertiesHandled === undefined
        ? (undefined as unknown as number)
        : profile.propertiesHandled,
    stepCompleted: 2,
  };
}

/** True when the profile has any step-2 field worth hydrating. */
export function profileHasStep2Data(
  profile:
    | Pick<
        BrokerProfile,
        "employmentType" | "businessSinceYear" | "propertiesHandled"
      >
    | null
    | undefined,
): boolean {
  if (!profile) return false;
  if (
    profile.employmentType === "full_time" ||
    profile.employmentType === "part_time"
  ) {
    return true;
  }
  if (
    profile.businessSinceYear !== null &&
    profile.businessSinceYear !== undefined
  ) {
    return true;
  }
  if (
    profile.propertiesHandled !== null &&
    profile.propertiesHandled !== undefined
  ) {
    return true;
  }
  return false;
}
