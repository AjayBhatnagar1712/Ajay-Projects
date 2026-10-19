import { clearIntroSeen } from "./introSeen";
import { clearOnboardingCompleteLocal } from "./onboardingCompleteLocal";
import { signOut } from "./phoneOtp";
import { clearPayoutVerifiedAlertSeen } from "../payments/payoutVerifiedAlertSeen";

/**
 * Clears first-launch intro flag, local onboarding-complete mirror, and signs
 * out (SecureStore session + Supabase). Next splash gate behaves like a fresh
 * install for local client state. Does not delete server-side broker profile rows.
 */
export async function resetLocalOnboardingData(): Promise<void> {
  await clearIntroSeen();
  await clearOnboardingCompleteLocal();
  await clearPayoutVerifiedAlertSeen();
  await signOut();
}
