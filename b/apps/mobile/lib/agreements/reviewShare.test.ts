import { describe, expect, it } from "vitest";
import {
  buildPartyShareMessage,
  destinationAfterTermsSave,
  reviewSharePartyFromResend,
  reviewShareQueryKey,
} from "./reviewShare";

describe("reviewShare helpers", () => {
  it("builds a single-party share message with that party's link only", () => {
    expect(
      buildPartyShareMessage("1 Main Road", {
        name: "Owner One",
        reviewLink: "https://app.trustkeyper.com/review/abc",
      }),
    ).toBe(
      "Hi Owner One, please review the leave & licence agreement for 1 Main Road:\nhttps://app.trustkeyper.com/review/abc",
    );
  });

  it("routes in_review terms save to detail with confirmation, drafts to preview", () => {
    expect(destinationAfterTermsSave("in_review")).toBe("detail-review-saved");
    expect(destinationAfterTermsSave("draft")).toBe("preview");
    expect(destinationAfterTermsSave("esign_sent")).toBe("preview");
  });

  it("scopes share payload cache by agreement id", () => {
    expect(reviewShareQueryKey("11111111-1111-4111-8111-111111111111")).toEqual([
      "lease-agreement-share",
      "11111111-1111-4111-8111-111111111111",
    ]);
  });

  it("stamps detail-screen party id on per-party resend even when API omits id", () => {
    const partyId = "22222222-2222-4222-8222-222222222222";
    expect(
      reviewSharePartyFromResend(partyId, {
        name: "Owner One",
        role: "owner",
        reviewLink: "https://app.trustkeyper.com/review/abc",
      }),
    ).toEqual({
      id: partyId,
      name: "Owner One",
      role: "owner",
      reviewLink: "https://app.trustkeyper.com/review/abc",
    });
  });

  it("prefers detail-screen party id when resend response includes a different id", () => {
    const partyId = "33333333-3333-4333-8333-333333333333";
    expect(
      reviewSharePartyFromResend(partyId, {
        id: "99999999-9999-4999-8999-999999999999",
        name: "Tenant Two",
        role: "tenant",
        reviewLink: "https://app.trustkeyper.com/review/xyz",
      }).id,
    ).toBe(partyId);
  });
});
