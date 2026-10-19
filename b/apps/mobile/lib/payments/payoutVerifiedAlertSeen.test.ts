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
  clearPayoutVerifiedAlertSeen,
  hasSeenPayoutVerifiedAlert,
  markPayoutVerifiedAlertSeen,
} from "./payoutVerifiedAlertSeen";

describe("payoutVerifiedAlertSeen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is unseen until marked", async () => {
    getItemAsync.mockResolvedValue(null);
    expect(await hasSeenPayoutVerifiedAlert()).toBe(false);
    getItemAsync.mockResolvedValue("1");
    expect(await hasSeenPayoutVerifiedAlert()).toBe(true);
  });

  it("writes and clears the SecureStore flag", async () => {
    setItemAsync.mockResolvedValue(undefined);
    deleteItemAsync.mockResolvedValue(undefined);
    await markPayoutVerifiedAlertSeen();
    expect(setItemAsync).toHaveBeenCalledWith(
      "tk_mobile_payout_verified_alert_seen",
      "1",
    );
    await clearPayoutVerifiedAlertSeen();
    expect(deleteItemAsync).toHaveBeenCalledWith(
      "tk_mobile_payout_verified_alert_seen",
    );
  });
});
