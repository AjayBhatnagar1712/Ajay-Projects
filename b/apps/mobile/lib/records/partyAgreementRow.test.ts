import { describe, expect, it } from "vitest";
import { partyAgreementRowKind } from "./partyAgreementRow";

describe("partyAgreementRowKind", () => {
  it("treats draft as CTA even with a placeholder address", () => {
    expect(
      partyAgreementRowKind({
        agreementId: "a1",
        propertyAddress: "Step 4 address",
        status: "draft",
      }),
    ).toBe("draft");
  });

  it("shows address text for non-draft agreements", () => {
    expect(
      partyAgreementRowKind({
        agreementId: "a2",
        propertyAddress: "12A, Sai Residency",
        status: "in_review",
      }),
    ).toBe("address");
  });

  it("omits non-draft rows with empty address", () => {
    expect(
      partyAgreementRowKind({
        agreementId: "a3",
        propertyAddress: "  ",
        status: "signed",
      }),
    ).toBe("omit");
  });
});
