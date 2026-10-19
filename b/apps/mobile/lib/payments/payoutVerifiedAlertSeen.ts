import * as SecureStore from "expo-secure-store";

const PAYOUT_VERIFIED_ALERT_SEEN_KEY = "tk_mobile_payout_verified_alert_seen";

/**
 * One-shot flag for the payout-verified derived alert. Cleared on local QA reset.
 * The alert itself is still derived from current payout status (activated).
 */
export async function hasSeenPayoutVerifiedAlert(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(PAYOUT_VERIFIED_ALERT_SEEN_KEY);
  return value === "1";
}

export async function markPayoutVerifiedAlertSeen(): Promise<void> {
  await SecureStore.setItemAsync(PAYOUT_VERIFIED_ALERT_SEEN_KEY, "1");
}

export async function clearPayoutVerifiedAlertSeen(): Promise<void> {
  await SecureStore.deleteItemAsync(PAYOUT_VERIFIED_ALERT_SEEN_KEY);
}
