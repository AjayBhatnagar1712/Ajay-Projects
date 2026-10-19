import { beforeEach, describe, expect, it, vi } from "vitest";

const hasCompletedOnboardingLocal = vi.fn();
const markOnboardingCompleteLocal = vi.fn();
const loadStoredSession = vi.fn();
const saveSessionIdentity = vi.fn();
const restoreSupabaseSession = vi.fn();
const signOut = vi.fn();
const getBrokerProfile = vi.fn();
const getAccountRoles = vi.fn();

vi.mock("./onboardingCompleteLocal", () => ({
  hasCompletedOnboardingLocal: () => hasCompletedOnboardingLocal(),
  markOnboardingCompleteLocal: () => markOnboardingCompleteLocal(),
}));

vi.mock("./secureSession", () => ({
  loadStoredSession: () => loadStoredSession(),
  saveSessionIdentity: (...args: unknown[]) => saveSessionIdentity(...args),
}));

vi.mock("./phoneOtp", () => ({
  restoreSupabaseSession: () => restoreSupabaseSession(),
  signOut: () => signOut(),
}));

vi.mock("../api/client", () => ({
  getBrokerProfile: () => getBrokerProfile(),
  getAccountRoles: (phone: string) => getAccountRoles(phone),
}));

import { resolveLaunchDestination } from "./resolveLaunchDestination";

describe("resolveLaunchDestination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markOnboardingCompleteLocal.mockResolvedValue(undefined);
    saveSessionIdentity.mockResolvedValue(undefined);
    signOut.mockResolvedValue(undefined);
  });

  it("routes signed-out incomplete onboarding to intro (ignores prior introSeen)", async () => {
    hasCompletedOnboardingLocal.mockResolvedValue(false);
    loadStoredSession.mockResolvedValue(null);

    const result = await resolveLaunchDestination();

    expect(result).toEqual({ status: "ready", href: "/(auth)/intro" });
  });

  it("routes signed-out completed onboarding to phone for re-login", async () => {
    hasCompletedOnboardingLocal.mockResolvedValue(true);
    loadStoredSession.mockResolvedValue(null);

    const result = await resolveLaunchDestination();

    expect(result).toEqual({ status: "ready", href: "/(auth)/phone" });
  });

  it("routes signed-in complete brokers to tabs and mirrors onboarding complete", async () => {
    hasCompletedOnboardingLocal.mockResolvedValue(false);
    loadStoredSession.mockResolvedValue({
      accessToken: "tok",
      refreshToken: null,
      phone: "9876543210",
      role: "broker",
    });
    restoreSupabaseSession.mockResolvedValue(true);
    getAccountRoles.mockResolvedValue({ phone: "9876543210", roles: ["broker"] });
    getBrokerProfile.mockResolvedValue({
      onboardingCompletedAt: "2026-08-01T00:00:00.000Z",
      stepCompleted: 4,
    });

    const result = await resolveLaunchDestination();

    expect(markOnboardingCompleteLocal).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: "ready", href: "/(tabs)/home" });
  });

  it("routes signed-in incomplete brokers to the next onboarding step", async () => {
    hasCompletedOnboardingLocal.mockResolvedValue(false);
    loadStoredSession.mockResolvedValue({
      accessToken: "tok",
      refreshToken: null,
      phone: "9876543210",
      role: null,
    });
    restoreSupabaseSession.mockResolvedValue(true);
    getAccountRoles.mockResolvedValue({ phone: "9876543210", roles: ["broker"] });
    getBrokerProfile.mockResolvedValue({
      onboardingCompletedAt: null,
      stepCompleted: 2,
    });

    const result = await resolveLaunchDestination();

    expect(result).toEqual({
      status: "ready",
      href: {
        pathname: "/(onboarding)/step-3",
        params: { resumed: "1" },
      },
    });
  });

  it("routes signed-in owners to portal home without broker profile", async () => {
    hasCompletedOnboardingLocal.mockResolvedValue(true);
    loadStoredSession.mockResolvedValue({
      accessToken: "tok",
      refreshToken: null,
      phone: "9876543210",
      role: "owner",
    });
    restoreSupabaseSession.mockResolvedValue(true);

    const result = await resolveLaunchDestination();

    expect(getBrokerProfile).not.toHaveBeenCalled();
    expect(getAccountRoles).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "ready", href: "/(portal)/home" });
  });
});
