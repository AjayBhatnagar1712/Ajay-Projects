import * as SecureStore from "expo-secure-store";

const ONBOARDING_COMPLETE_KEY = "tk_mobile_onboarding_complete";

/**
 * Local mirror of brokers.onboarding_completed_at for signed-out auth chrome
 * and cold-launch routing. Incomplete → intro carousel (splash + Phone Back).
 * Complete → Phone Entry for re-login; never show the carousel again.
 */
export async function hasCompletedOnboardingLocal(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(ONBOARDING_COMPLETE_KEY);
  return value === "1";
}

export async function markOnboardingCompleteLocal(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, "1");
}

export async function clearOnboardingCompleteLocal(): Promise<void> {
  await SecureStore.deleteItemAsync(ONBOARDING_COMPLETE_KEY);
}
