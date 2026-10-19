import {
  BrokerOnboardingStep4Schema,
  type BrokerProfile,
} from "@workspace/api-schemas";
import type { z } from "zod";

type Step4Values = z.infer<typeof BrokerOnboardingStep4Schema>;

/**
 * Map a saved broker profile into step-4 form defaults.
 * Used when remounting after Stack back/replace or resume.
 */
export function step4ValuesFromProfile(
  profile: Pick<BrokerProfile, "region" | "pincodes">,
): Step4Values {
  return {
    region: profile.region.trim(),
    pincodes: [...profile.pincodes],
    stepCompleted: 4,
  };
}

/** True when the profile has any step-4 field worth hydrating. */
export function profileHasStep4Data(
  profile: Pick<BrokerProfile, "region" | "pincodes"> | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.region.trim().length > 0) return true;
  if (profile.pincodes.length > 0) return true;
  return false;
}
