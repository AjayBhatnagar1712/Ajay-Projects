import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeTenantLoginAfterOtp,
  provisionTenantProfileFromWorkspace,
  tenantLocalWorkspaceExists,
} from "./tenantLogin";
import { pushAccountKeyToCloud } from "./cloudSync";
import { storageKey } from "./storageKeys";

vi.mock("./cloudSync", () => ({
  pullAccountFromCloud: vi.fn().mockResolvedValue(false),
  pushAccountKeyToCloud: vi.fn().mockResolvedValue(true),
  pushLocalKeysToCloud: vi.fn().mockResolvedValue(true),
  queueCloudSyncForAccount: vi.fn(),
}));

vi.mock("./tenantWorkflowServer", () => ({
  pullTenantWorkspaceFromServer: vi.fn().mockResolvedValue(null),
}));

vi.mock("./storageMigration", () => ({
  migrateLegacyStorage: vi.fn(),
}));

vi.mock("./initAppStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./initAppStorage")>();
  return {
    ...actual,
    persistActiveSessionBackup: vi.fn(),
  };
});

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

describe("tenantLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
  });

  it("detects local tenant workspace without profile", () => {
    localStorage.setItem(
      "tk_6369856040_tenant_workspace",
      JSON.stringify({ phone: "6369856040", tenantName: "Sumit", propertyLabel: "Unit 1" }),
    );
    expect(tenantLocalWorkspaceExists("6369856040")).toBe(true);
  });

  it("provisions profile from workspace snapshot", async () => {
    await provisionTenantProfileFromWorkspace("6369856040", {
      phone: "6369856040",
      tenantName: "Sumit",
      propertyLabel: "Unit 1",
      updatedAt: Date.now(),
    });

    const raw = localStorage.getItem(storageKey("6369856040", "tenant", "profile"));
    expect(raw).toContain("Sumit");
    expect(vi.mocked(pushAccountKeyToCloud)).toHaveBeenCalledWith(
      "6369856040",
      "tenant",
      "tenant_workspace",
      expect.stringContaining("6369856040"),
      undefined,
    );
  });

  it("completes login when only workspace exists locally", async () => {
    localStorage.setItem(
      "tk_6369856040_tenant_workspace",
      JSON.stringify({
        phone: "6369856040",
        tenantName: "Sumit",
        propertyLabel: "Unit 1",
        updatedAt: Date.now(),
      }),
    );

    const ok = await completeTenantLoginAfterOtp("6369856040", "token");
    expect(ok).toBe(true);
    expect(sessionStorage.getItem("tk_active_role")).toBe("tenant");
    expect(localStorage.getItem(storageKey("6369856040", "tenant", "profile"))).toContain("Sumit");
  });
});
