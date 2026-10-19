import { beforeEach, describe, expect, it, vi } from "vitest";

const getItemAsync = vi.fn();
const setItemAsync = vi.fn();
const deleteItemAsync = vi.fn();

vi.mock("expo-secure-store", () => ({
  getItemAsync: (...args: unknown[]) => getItemAsync(...args),
  setItemAsync: (...args: unknown[]) => setItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => deleteItemAsync(...args),
}));

import { clearIntroSeen, hasSeenIntro, markIntroSeen } from "./introSeen";

describe("introSeen SecureStore persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports unseen when key is missing", async () => {
    getItemAsync.mockResolvedValue(null);
    await expect(hasSeenIntro()).resolves.toBe(false);
    expect(getItemAsync).toHaveBeenCalledWith("tk_mobile_intro_seen");
  });

  it("reports seen only for value 1", async () => {
    getItemAsync.mockResolvedValue("1");
    await expect(hasSeenIntro()).resolves.toBe(true);

    getItemAsync.mockResolvedValue("0");
    await expect(hasSeenIntro()).resolves.toBe(false);
  });

  it("marks intro seen permanently via SecureStore", async () => {
    setItemAsync.mockResolvedValue(undefined);
    await markIntroSeen();
    expect(setItemAsync).toHaveBeenCalledWith("tk_mobile_intro_seen", "1");
  });

  it("can clear the flag for QA", async () => {
    deleteItemAsync.mockResolvedValue(undefined);
    await clearIntroSeen();
    expect(deleteItemAsync).toHaveBeenCalledWith("tk_mobile_intro_seen");
  });
});
