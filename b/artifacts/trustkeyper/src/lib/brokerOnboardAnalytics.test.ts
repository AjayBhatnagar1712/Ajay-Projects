import { beforeEach, describe, expect, it, vi } from "vitest";

const { storage } = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock("./storageKeys", () => ({
  getActiveSession: () => ({ phone: "9876543211", role: "broker" }),
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
}));

vi.mock("./cloudSync", () => ({
  queueCloudSync: vi.fn(),
}));

describe("trackBrokerOnboardEvent", () => {
  beforeEach(() => {
    storage.clear();
    vi.resetModules();
  });

  it("records link_generated with broker phone", async () => {
    const { trackBrokerOnboardEvent, getBrokerOnboardAnalytics } = await import(
      "./brokerOnboardAnalytics"
    );
    trackBrokerOnboardEvent("link_generated", {
      tenantPhone: "+918367849588",
      token: "bt_test",
    });
    const records = getBrokerOnboardAnalytics();
    expect(records).toHaveLength(1);
    expect(records[0]?.event).toBe("link_generated");
    expect(records[0]?.brokerPhone).toBe("9876543211");
    expect(records[0]?.tenantPhone).toBe("+918367849588");
    expect(records[0]?.token).toBe("bt_test");
  });

  it("records link_copied events", async () => {
    const { trackBrokerOnboardEvent, getBrokerOnboardAnalytics } = await import(
      "./brokerOnboardAnalytics"
    );
    trackBrokerOnboardEvent("link_copied", { token: "bt_test" });
    expect(getBrokerOnboardAnalytics()[0]?.event).toBe("link_copied");
  });
});
