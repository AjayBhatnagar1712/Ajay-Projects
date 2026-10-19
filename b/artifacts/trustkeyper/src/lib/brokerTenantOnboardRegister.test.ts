import { describe, expect, it } from "vitest";
import {
  registerBrokerOnboardingInvite,
  type OnboardStore,
} from "@workspace/broker-tenant-onboarding";

type StoredEntry = {
  phone: string;
  role: string;
  dataKey: string;
  value: string;
};

function createMemoryOnboardStore(): { store: OnboardStore; entries: StoredEntry[] } {
  const entries: StoredEntry[] = [];

  const store: OnboardStore = {
    async findEntryByDataKey(dataKey: string) {
      const row = entries.find((entry) => entry.dataKey === dataKey);
      return row ? { phone: row.phone, role: row.role, value: row.value } : null;
    },
    async getAccountData(phone: string, role: string) {
      const data: Record<string, string> = {};
      for (const entry of entries) {
        if (entry.phone === phone && entry.role === role) {
          data[entry.dataKey] = entry.value;
        }
      }
      return data;
    },
    async setAccountDataKey(phone: string, role: string, dataKey: string, value: string) {
      const idx = entries.findIndex(
        (entry) => entry.phone === phone && entry.role === role && entry.dataKey === dataKey,
      );
      if (idx === -1) {
        entries.push({ phone, role, dataKey, value });
        return;
      }
      entries[idx] = { phone, role, dataKey, value };
    },
  };

  return { store, entries };
}

describe("registerBrokerOnboardingInvite", () => {
  it("persists token snapshot so public lookup can resolve the invite", async () => {
    const { store, entries } = createMemoryOnboardStore();

    const result = await registerBrokerOnboardingInvite(store, {
      brokerPhone: "9876543210",
      brokerName: "Demo Broker",
      tenantName: "Meena Kumari",
      tenantPhone: "+918367849588",
      origin: "https://staging.app.trustkeyper.com",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.invite.inviteLink).toBe(
      `https://staging.app.trustkeyper.com/onboard/tenant/${result.invite.token}`,
    );

    const tokenKey = `broker_tenant_onboard_${result.invite.token}`;
    const tokenRow = entries.find((entry) => entry.dataKey === tokenKey);
    expect(tokenRow).toBeDefined();
    expect(tokenRow?.phone).toBe("9876543210");
    expect(tokenRow?.role).toBe("broker");

    const lookup = await store.findEntryByDataKey(tokenKey);
    expect(lookup?.value).toContain(result.invite.token);
    expect(lookup?.value).toContain("Meena Kumari");
  });

  it("rejects duplicate active invites for the same tenant phone", async () => {
    const { store } = createMemoryOnboardStore();

    const first = await registerBrokerOnboardingInvite(store, {
      brokerPhone: "9876543210",
      brokerName: "Demo Broker",
      tenantName: "Meena Kumari",
      tenantPhone: "8367849588",
      origin: "https://staging.app.trustkeyper.com",
    });
    expect(first.ok).toBe(true);

    const second = await registerBrokerOnboardingInvite(store, {
      brokerPhone: "9876543210",
      brokerName: "Demo Broker",
      tenantName: "Meena Kumari",
      tenantPhone: "+918367849588",
      origin: "https://staging.app.trustkeyper.com",
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toBe("duplicate_tenant");
  });

  it("rejects invite when phone already has a tenant account", async () => {
    const { store } = createMemoryOnboardStore();
    store.accountHasProfile = async (phone, role) => phone === "8367849588" && role === "tenant";

    const result = await registerBrokerOnboardingInvite(store, {
      brokerPhone: "9876543210",
      brokerName: "Demo Broker",
      tenantName: "Meena Kumari",
      tenantPhone: "8367849588",
      origin: "https://staging.app.trustkeyper.com",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("duplicate_tenant_account");
  });

  it("rejects invite when another broker already claimed the tenant phone", async () => {
    const { store } = createMemoryOnboardStore();

    const first = await registerBrokerOnboardingInvite(store, {
      brokerPhone: "9876543210",
      brokerName: "Broker A",
      tenantName: "Meena Kumari",
      tenantPhone: "8367849588",
      origin: "https://staging.app.trustkeyper.com",
    });
    expect(first.ok).toBe(true);

    const second = await registerBrokerOnboardingInvite(store, {
      brokerPhone: "9123456789",
      brokerName: "Broker B",
      tenantName: "Meena Kumari",
      tenantPhone: "8367849588",
      origin: "https://staging.app.trustkeyper.com",
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toBe("duplicate_tenant");
  });
});
