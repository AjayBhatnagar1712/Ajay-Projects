import { describe, expect, it } from "vitest";
import {
  isLeaseAgreementFrozenForEdits,
  leaseAgreementFrozenEditError,
} from "./leaseAgreementEditGuard.js";

describe("leaseAgreementEditGuard", () => {
  it("freezes party and commercial edits after send-for-signing", () => {
    expect(isLeaseAgreementFrozenForEdits("esign_sent")).toBe(true);
    expect(isLeaseAgreementFrozenForEdits("signed")).toBe(true);
    expect(isLeaseAgreementFrozenForEdits("in_review")).toBe(false);
    expect(leaseAgreementFrozenEditError("esign_sent")).toContain("sent for signing");
    expect(leaseAgreementFrozenEditError("signed")).toContain("signed");
  });
});
