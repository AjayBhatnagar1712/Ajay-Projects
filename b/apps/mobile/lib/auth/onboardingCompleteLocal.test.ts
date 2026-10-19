import { beforeEach, describe, expect, it, vi } from "vitest";

const getItemAsync = vi.fn();
const setItemAsync = vi.fn();
const deleteItemAsync = vi.fn();

vi.mock("expo-secure-store", () => ({
  getItemAsync: (...args: unknown[]) => getItemAsync(...args),
  setItemAsync: (...args: unknown[]) => setItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => deleteItemAsync(...args),
}));

import {
  clearOnboardingCompleteLocal,
  hasCompletedOnboardingLocal,
  markOnboardingCompleteLocal,
} from "./onboardingCompleteLocal";

describe("onboardingCompleteLocal SecureStore persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports incomplete when key is missing", async () => {
    getItemAsync.mockResolvedValue(null);
    await expect(hasCompletedOnboardingLocal()).resolves.toBe(false);
    expect(getItemAsync).toHaveBeenCalledWith("tk_mobile_onboarding_complete");
  });

  it("reports complete only for value 1", async () => {
    getItemAsync.mockResolvedValue("1");
    await expect(hasCompletedOnboardingLocal()).resolves.toBe(true);

    getItemAsync.mockResolvedValue("0");
    await expect(hasCompletedOnboardingLocal()).resolves.toBe(false);
  });

  it("marks onboarding complete via SecureStore", async () => {
    setItemAsync.mockResolvedValue(undefined);
    await markOnboardingCompleteLocal();
    expect(setItemAsync).toHaveBeenCalledWith(
      "tk_mobile_onboarding_complete",
      "1",
    );
  });

  it("can clear the flag", async () => {
    deleteItemAsync.mockResolvedValue(undefined);
    await clearOnboardingCompleteLocal();
    expect(deleteItemAsync).toHaveBeenCalledWith(
      "tk_mobile_onboarding_complete",
    );
  });
});
