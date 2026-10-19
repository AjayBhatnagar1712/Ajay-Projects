import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureTenantDashboardSession,
  finalizeTenantDashboardAccess,
} from "./tenantDocumentUploadRedirect";

vi.mock("./cloudSync", () => ({
  pushLocalKeysToCloud: vi.fn().mockResolvedValue(true),
}));

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

describe("ensureTenantDashboardSession", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", createMemoryStorage());
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  it("reuses the active tenant session when it matches the phone", async () => {
    const login = vi.fn<(phone: string, role: "tenant") => Promise<boolean>>().mockResolvedValue(true);

    const ok = await ensureTenantDashboardSession(
      "+91 98765 43210",
      () => ({ phone: "9876543210", role: "tenant" }),
      login,
    );

    expect(ok).toBe(true);
    expect(login).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("tk_pending_role")).toBe("tenant");
  });

  it("logs the tenant back in when no matching active session exists", async () => {
    const login = vi.fn<(phone: string, role: "tenant") => Promise<boolean>>().mockResolvedValue(true);

    const ok = await ensureTenantDashboardSession(
      "+91 98765 43210",
      () => null,
      login,
    );

    expect(ok).toBe(true);
    expect(login).toHaveBeenCalledWith("9876543210", "tenant", undefined);
    expect(sessionStorage.getItem("tk_pending_role")).toBe("tenant");
  });
});

describe("finalizeTenantDashboardAccess", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", createMemoryStorage());
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  it("persists remember-me keys when requested", async () => {
    const login = vi.fn<(phone: string, role: "tenant") => Promise<boolean>>().mockResolvedValue(true);

    const ok = await finalizeTenantDashboardAccess(
      "9876543210",
      () => ({ phone: "9876543210", role: "tenant" }),
      login,
      { remember: true },
    );

    expect(ok).toBe(true);
    expect(localStorage.getItem("tk_active_phone")).toBe("9876543210");
    expect(localStorage.getItem("tk_active_role")).toBe("tenant");
  });
});
