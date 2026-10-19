import { describe, expect, it } from "vitest";
import {
  INVITE_STATUS_LABELS,
  isActiveInviteStatus,
  normalizeStoredInviteStatus,
  resolveInviteStatus,
} from "./brokerTenantInviteStatus";

describe("brokerTenantInviteStatus", () => {
  it("normalizes legacy pending and submitted statuses", () => {
    expect(normalizeStoredInviteStatus("pending")).toBe("onboarding_pending");
    expect(normalizeStoredInviteStatus("submitted")).toBe("requirements_submitted");
  });

  it("resolves expired invites", () => {
    const status = resolveInviteStatus("onboarding_pending", Date.now() - 1000);
    expect(status).toBe("expired");
  });

  it("keeps converted status even when expired", () => {
    const status = resolveInviteStatus("converted", Date.now() - 1000);
    expect(status).toBe("converted");
  });

  it("labels onboarding pending for broker UI", () => {
    expect(INVITE_STATUS_LABELS.onboarding_pending).toBe("Onboarding Pending");
  });

  it("treats pending and started as active", () => {
    expect(isActiveInviteStatus("onboarding_pending")).toBe(true);
    expect(isActiveInviteStatus("onboarding_started")).toBe(true);
    expect(isActiveInviteStatus("requirements_submitted")).toBe(false);
  });
});
