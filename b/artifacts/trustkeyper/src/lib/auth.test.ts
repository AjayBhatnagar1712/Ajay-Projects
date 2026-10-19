import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canProceedWithLoginLookup,
  describeLoginPhoneHint,
  loginLookupErrorMessage,
  loginSuccess,
  signUpSuccess,
} from "./auth";
import { storageKey } from "./storageKeys";

vi.mock("./cloudSync", () => ({
  lookupCloudAccount: vi.fn(),
  pushAccountKeyToCloudDetailed: vi.fn(),
  pushAccountKeyToCloud: vi.fn(),
  pushLocalKeysToCloud: vi.fn(),
  cloudPushFailureMessage: (reason: string) =>
    reason === "network"
      ? "Could not reach the server. Check your connection and try again."
      : "Could not save your account to the cloud.",
  cloudAccountExists: vi.fn(),
  fetchCloudRolesForPhone: vi.fn(),
  pullAccountFromCloud: vi.fn(),
}));

vi.mock("./storageMigration", () => ({
  migrateLegacyStorage: vi.fn(),
}));

vi.mock("./tenantLogin", () => ({
  completeTenantLoginAfterOtp: vi.fn(),
  tenantLocalWorkspaceExists: vi.fn(),
}));

vi.mock("./initAppStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./initAppStorage")>();
  return {
    ...actual,
    persistActiveSessionBackup: vi.fn(),
    clearActiveSessionBackup: vi.fn(),
  };
});

import {
  lookupCloudAccount,
  pullAccountFromCloud,
  pushAccountKeyToCloudDetailed,
  pushLocalKeysToCloud,
} from "./cloudSync";
import { completeTenantLoginAfterOtp } from "./tenantLogin";

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
  };
}

describe("login lookup helpers", () => {
  it("allows login when account is found locally or in cloud", () => {
    expect(canProceedWithLoginLookup({ status: "found", source: "local" })).toBe(true);
    expect(canProceedWithLoginLookup({ status: "found", source: "cloud" })).toBe(true);
    expect(canProceedWithLoginLookup({ status: "cloud_unavailable" })).toBe(true);
    expect(canProceedWithLoginLookup({ status: "not_found", otherRoles: [] })).toBe(false);
  });

  it("describes wrong-role hints on the phone field", () => {
    const hint = describeLoginPhoneHint(
      { status: "not_found", otherRoles: ["owner"] },
      "tenant",
    );
    expect(hint.errorText).toContain("Property Owner");
    expect(hint.errorText).toContain("Tenant");
  });

  it("returns wrong account type message when another role exists", () => {
    const message = loginLookupErrorMessage({ status: "not_found", otherRoles: ["broker"] });
    expect(message?.title).toBe("Wrong account type");
    expect(message?.description).toContain("Broker");
  });
});

describe("signUpSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
  });

  it("does not create a session when cloud profile save fails", async () => {
    vi.mocked(pushAccountKeyToCloudDetailed).mockResolvedValue({ ok: false, reason: "network" });

    await expect(
      signUpSuccess("9876543210", "owner", { name: "Meena", phone: "9876543210" }, "token"),
    ).rejects.toThrow("Could not reach the server");

    expect(sessionStorage.getItem("tk_active_phone")).toBeNull();
    expect(localStorage.getItem(storageKey("9876543210", "owner", "profile"))).toBeNull();
  });

  it("persists profile and session only after cloud verification succeeds", async () => {
    vi.mocked(pushAccountKeyToCloudDetailed).mockResolvedValue({ ok: true });
    vi.mocked(lookupCloudAccount).mockResolvedValue({ kind: "exists" });
    vi.mocked(pushLocalKeysToCloud).mockResolvedValue(true);

    await signUpSuccess(
      "9876543210",
      "owner",
      { name: "Meena", phone: "9876543210" },
      "token",
    );

    expect(sessionStorage.getItem("tk_active_phone")).toBe("9876543210");
    expect(sessionStorage.getItem("tk_active_role")).toBe("owner");
    expect(localStorage.getItem(storageKey("9876543210", "owner", "profile"))).toContain("Meena");
  });
});

describe("loginSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
  });

  it("falls back to tenant login when cloud account exists but pull fails", async () => {
    vi.mocked(lookupCloudAccount).mockResolvedValue({ kind: "exists" });
    vi.mocked(pullAccountFromCloud).mockResolvedValue(false);
    vi.mocked(completeTenantLoginAfterOtp).mockResolvedValue(true);

    const ok = await loginSuccess("6369856040", "tenant", "token");

    expect(ok).toBe(true);
    expect(completeTenantLoginAfterOtp).toHaveBeenCalledWith("6369856040", "token");
  });
});
