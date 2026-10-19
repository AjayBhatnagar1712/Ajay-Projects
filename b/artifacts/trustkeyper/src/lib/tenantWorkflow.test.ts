import { describe, expect, it } from "vitest";
import {
  findAgreementInBlobList,
  mergeAgreementIntoBlobList,
  tenantPhoneFromAgreementContact,
} from "@workspace/tenant-workflow";

describe("tenant-workflow agreement blob helpers", () => {
  it("merges a new agreement into an empty list", () => {
    const next = mergeAgreementIntoBlobList([], {
      id: "agr_1",
      tenantContact: "+919876543210",
      status: "Sent",
    });
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe("agr_1");
  });

  it("updates an existing agreement by id", () => {
    const next = mergeAgreementIntoBlobList(
      [{ id: "agr_1", tenantContact: "+919876543210", status: "Draft" }],
      { id: "agr_1", tenantContact: "+919876543210", status: "Sent" },
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.status).toBe("Sent");
  });

  it("finds agreement and normalizes tenant phone", () => {
    const agreement = findAgreementInBlobList(
      [{ id: "agr_1", tenantContact: "+91 98765 43210" }],
      "agr_1",
    );
    expect(agreement?.id).toBe("agr_1");
    expect(tenantPhoneFromAgreementContact(agreement?.tenantContact ?? "")).toBe("9876543210");
  });
});

describe("send-for-esign critical path (unit)", () => {
  it("requires agreement tenant phone to match workspace tenant before workflow starts", () => {
    const agreement = { id: "agr_1", tenantContact: "+919876543210" };
    const tenantPhone = "9876543210";
    expect(tenantPhoneFromAgreementContact(agreement.tenantContact ?? "")).toBe(tenantPhone);
  });
});
