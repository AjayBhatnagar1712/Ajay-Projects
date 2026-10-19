import { describe, expect, it } from "vitest";
import {
  formatTenantKycStatusLabel,
  normalizeTenantKycStatus,
  TENANT_KYC_STATUSES,
} from "./tenantKycStatus";

describe("tenantKycStatus", () => {
  it("exposes all workflow states required for future broker verification", () => {
    expect(TENANT_KYC_STATUSES).toEqual([
      "pending_upload",
      "under_review",
      "verified",
      "rejected",
      "requires_reupload",
    ]);
  });

  it("normalizes legacy pending values", () => {
    expect(normalizeTenantKycStatus("pending")).toBe("pending_upload");
    expect(normalizeTenantKycStatus("under_review")).toBe("under_review");
  });

  it("formats labels without hardcoding in UI components", () => {
    expect(formatTenantKycStatusLabel("pending_upload")).toBe("Pending Upload");
    expect(formatTenantKycStatusLabel("requires_reupload")).toBe("Requires Re-upload");
  });
});
