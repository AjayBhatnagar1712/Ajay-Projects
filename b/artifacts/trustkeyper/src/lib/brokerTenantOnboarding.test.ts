import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBrokerTenantOnboardWhatsAppMessage,
  getTenantOnboardUrl,
  isValidIndianMobile,
} from "./brokerTenantOnboarding";

describe("isValidIndianMobile", () => {
  it("accepts 10-digit numbers", () => {
    expect(isValidIndianMobile("8367849588")).toBe(true);
    expect(isValidIndianMobile("+91 8367849588")).toBe(true);
  });

  it("rejects short numbers", () => {
    expect(isValidIndianMobile("12345")).toBe(false);
    expect(isValidIndianMobile("")).toBe(false);
  });
});

describe("buildBrokerTenantOnboardWhatsAppMessage", () => {
  it("includes tenant name and link", () => {
    const message = buildBrokerTenantOnboardWhatsAppMessage(
      "Meena",
      "https://app.trustkeyper.com/onboard/tenant/bt_abc",
    );
    expect(message).toContain("Hi Meena,");
    expect(message).toContain("https://app.trustkeyper.com/onboard/tenant/bt_abc");
    expect(message).toContain("TrustKeyper");
    expect(message).not.toContain("Complete your profile here:");
  });
});

describe("getTenantOnboardUrl", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: { origin: "https://app.trustkeyper.com" },
    });
  });

  it("builds absolute onboarding url", () => {
    expect(getTenantOnboardUrl("bt_test")).toBe(
      "https://app.trustkeyper.com/onboard/tenant/bt_test",
    );
  });
});
