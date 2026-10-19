import { useLocalSearchParams } from "expo-router";

/**
 * True when splash / OTP / onboarding gate landed here with `resumed=1`
 * (broker already had step_completed ≥ 1). In-flow Next pushes omit the flag.
 */
export function useIsOnboardingResume(): boolean {
  const params = useLocalSearchParams<{ resumed?: string | string[] }>();
  const raw = params.resumed;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "1" || value === "true";
}

export function useIsProfileEdit(): boolean {
  const params = useLocalSearchParams<{ edit?: string | string[] }>();
  const raw = params.edit;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "1" || value === "true";
}

export {
  ONBOARDING_RESUME_HINT,
  onboardingStepDescription,
} from "./onboardingResumeCopy";
