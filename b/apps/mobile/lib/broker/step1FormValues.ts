import {
  BrokerOnboardingStep1Schema,
  type BrokerProfile,
} from "@workspace/api-schemas";
import type { z } from "zod";

type Step1Values = z.infer<typeof BrokerOnboardingStep1Schema>;

/**
 * Map a saved broker profile into step-1 form defaults.
 * Used when remounting after Stack back/replace — local RHF state is gone;
 * the PATCH on Next is the source of truth.
 */
export function step1ValuesFromProfile(
  profile: Pick<BrokerProfile, "name" | "age" | "firmName">,
): Step1Values {
  return {
    name: profile.name.trim().length > 0 ? profile.name : "",
    age:
      profile.age === null || profile.age === undefined
        ? (undefined as unknown as number)
        : profile.age,
    firmName: profile.firmName,
    stepCompleted: 1,
  };
}

/** True when the profile has any step-1 field worth hydrating. */
export function profileHasStep1Data(
  profile: Pick<BrokerProfile, "name" | "age" | "firmName"> | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.name.trim().length > 0) return true;
  if (profile.age !== null && profile.age !== undefined) return true;
  if (profile.firmName != null && profile.firmName.trim().length > 0) {
    return true;
  }
  return false;
}
