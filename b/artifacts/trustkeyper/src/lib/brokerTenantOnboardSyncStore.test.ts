import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerBrokerOnboardingInvite,
  type OnboardStore,
} from "@workspace/broker-tenant-onboarding";

describe("sync-store broker onboard token persistence", () => {
  beforeEach(() => {
    vi.stubEnv("USE_MOCK_DB", "1");
    vi.stubEnv("VERCEL", "1");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("registers and resolves invite tokens via sync-store on Vercel without Postgres", async () => {
    const syncStore = await import("@workspace/sync-store");

    const store: OnboardStore = {
      findEntryByDataKey: syncStore.findEntryByDataKey,
      getAccountData: syncStore.getAccountData,
      setAccountDataKey: syncStore.setAccountDataKey,
    };

    const result = await registerBrokerOnboardingInvite(store, {
      brokerPhone: "9876543211",
      brokerName: "Demo Broker",
      tenantName: "Meena Kumari",
      tenantPhone: "+919994444826",
      origin: "https://staging.app.trustkeyper.com",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const tokenKey = `broker_tenant_onboard_${result.invite.token}`;
    const lookup = await store.findEntryByDataKey(tokenKey);
    expect(lookup).not.toBeNull();
    expect(lookup?.phone).toBe("9876543211");
    expect(lookup?.role).toBe("broker");
    expect(lookup?.value).toContain("Meena Kumari");
    expect(result.invite.inviteLink).toBe(
      `https://staging.app.trustkeyper.com/onboard/tenant/${result.invite.token}`,
    );
  });
});
