import { describe, expect, it } from "vitest";
import { previewBlockedBulletItems } from "./previewBlocked";

describe("previewBlockedBulletItems", () => {
  it("prefers the API missing array when present", () => {
    expect(
      previewBlockedBulletItems("Lease agreement draft is incomplete. Ignored.", [
        "Add monthly rent",
        "Add security deposit",
      ]),
    ).toEqual(["Add monthly rent", "Add security deposit"]);
  });

  it("splits the combined owner/tenant requirement into two bullets", () => {
    expect(
      previewBlockedBulletItems("ignored", [
        "Add at least one owner and one tenant before previewing",
      ]),
    ).toEqual(["At least one owner", "At least one tenant"]);
  });

  it("parses the joined error string when missing is absent", () => {
    expect(
      previewBlockedBulletItems(
        "Lease agreement draft is incomplete. Add at least one owner and one tenant before previewing. Add monthly rent.",
        null,
      ),
    ).toEqual(["At least one owner", "At least one tenant", "Add monthly rent"]);
  });

  it("falls back to the full message when nothing can be split", () => {
    expect(previewBlockedBulletItems("Something went wrong", null)).toEqual([
      "Something went wrong",
    ]);
  });
});
