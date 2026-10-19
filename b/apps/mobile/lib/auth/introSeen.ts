import * as SecureStore from "expo-secure-store";

const INTRO_SEEN_KEY = "tk_mobile_intro_seen";

/**
 * Legacy first-launch flag. Cold launch and Phone Back no longer consult this —
 * `onboardingCompleteLocal` is the routing signal. Still cleared by Profile QA
 * reset so local SecureStore stays tidy; `markIntroSeen` remains a no-op for
 * callers that have not been removed yet.
 */
export async function hasSeenIntro(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(INTRO_SEEN_KEY);
  return value === "1";
}

export async function markIntroSeen(): Promise<void> {
  await SecureStore.setItemAsync(INTRO_SEEN_KEY, "1");
}

/** Test / QA helper — also used by resetLocalOnboardingData. */
export async function clearIntroSeen(): Promise<void> {
  await SecureStore.deleteItemAsync(INTRO_SEEN_KEY);
}
