import { describe, expect, it } from "vitest";
import {
  PHONE_ENTRY_PRIVACY_POLICY_URL,
  PHONE_ENTRY_TERMS_URL,
  PHONE_ENTRY_TRUST_CARD_GAP,
  PHONE_ENTRY_TRUST_POINTS,
} from "./phoneEntryTrust";

describe("phoneEntryTrust", () => {
  it("keeps exactly the three generic trust points", () => {
    expect(PHONE_ENTRY_TRUST_POINTS).toEqual([
      "Your data is encrypted and never sold to third parties",
      "Used only to create and manage your lease agreements",
      "You're always in control of what you share",
    ]);
  });

  it("does not include certification claims", () => {
    const joined = PHONE_ENTRY_TRUST_POINTS.join(" ").toLowerCase();
    for (const claim of ["iso", "gdpr", "dpdp", "soc 2", "certified"]) {
      expect(joined).not.toContain(claim);
    }
  });

  it("points legal links at trustkeyper.com", () => {
    expect(PHONE_ENTRY_PRIVACY_POLICY_URL).toBe(
      "https://trustkeyper.com/privacy-policy",
    );
    expect(PHONE_ENTRY_TERMS_URL).toBe(
      "https://trustkeyper.com/terms-and-conditions",
    );
  });

  it("uses a 32–48px gap above the trust card", () => {
    expect(PHONE_ENTRY_TRUST_CARD_GAP).toBeGreaterThanOrEqual(32);
    expect(PHONE_ENTRY_TRUST_CARD_GAP).toBeLessThanOrEqual(48);
  });
});
