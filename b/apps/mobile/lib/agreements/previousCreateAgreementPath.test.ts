import { describe, expect, it } from "vitest";
import { previousCreateAgreementPath } from "./previousCreateAgreementPath";

describe("previousCreateAgreementPath", () => {
  it("maps owners/tenants/inventory/terms to the prior creation step", () => {
    expect(previousCreateAgreementPath(2)).toBe("/(create-agreement)/property");
    expect(previousCreateAgreementPath(3)).toBe("/(create-agreement)/owners");
    expect(previousCreateAgreementPath(4)).toBe("/(create-agreement)/tenants");
    expect(previousCreateAgreementPath(5)).toBe("/(create-agreement)/inventory");
  });
});
