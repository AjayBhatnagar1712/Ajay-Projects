/** Supporting line so mid-onboarding reopen does not feel like a wipe. */
export const ONBOARDING_RESUME_HINT =
  "Welcome back — continuing where you left off.";

export function onboardingStepDescription(
  base: string | undefined,
  isResumed: boolean,
): string | undefined {
  if (!isResumed) return base;
  if (!base || base.trim().length === 0) return ONBOARDING_RESUME_HINT;
  return `${ONBOARDING_RESUME_HINT} ${base}`;
}
