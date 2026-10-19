import { beforeEach, describe, expect, it, vi } from "vitest";

const clearIntroSeen = vi.fn();
const clearOnboardingCompleteLocal = vi.fn();
const clearPayoutVerifiedAlertSeen = vi.fn();
const signOut = vi.fn();

vi.mock("./introSeen", () => ({
  clearIntroSeen: () => clearIntroSeen(),
}));

vi.mock("./onboardingCompleteLocal", () => ({
  clearOnboardingCompleteLocal: () => clearOnboardingCompleteLocal(),
}));

vi.mock("../payments/payoutVerifiedAlertSeen", () => ({
  clearPayoutVerifiedAlertSeen: () => clearPayoutVerifiedAlertSeen(),
}));

vi.mock("./phoneOtp", () => ({
  signOut: () => signOut(),
}));

import { resetLocalOnboardingData } from "./resetLocalOnboardingData";

describe("resetLocalOnboardingData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearIntroSeen.mockResolvedValue(undefined);
    clearOnboardingCompleteLocal.mockResolvedValue(undefined);
    clearPayoutVerifiedAlertSeen.mockResolvedValue(undefined);
    signOut.mockResolvedValue(undefined);
  });

  it("clears intro + local onboarding-complete then signs out", async () => {
    await resetLocalOnboardingData();
    expect(clearIntroSeen).toHaveBeenCalledTimes(1);
    expect(clearOnboardingCompleteLocal).toHaveBeenCalledTimes(1);
    expect(clearPayoutVerifiedAlertSeen).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    const introOrder = clearIntroSeen.mock.invocationCallOrder[0];
    const completeOrder = clearOnboardingCompleteLocal.mock.invocationCallOrder[0];
    const signOutOrder = signOut.mock.invocationCallOrder[0];
    expect(introOrder).toBeDefined();
    expect(completeOrder).toBeDefined();
    expect(signOutOrder).toBeDefined();
    expect(introOrder!).toBeLessThan(signOutOrder!);
    expect(completeOrder!).toBeLessThan(signOutOrder!);
  });
});
