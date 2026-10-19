import { describe, expect, it } from "vitest";
import { isPartyFormExpanded, nextExclusiveExpandedIds } from "./partyExpandState";

describe("isPartyFormExpanded", () => {
  it("always expands when there is only one party of the role", () => {
    expect(
      isPartyFormExpanded({
        roleCount: 1,
        hasErrors: false,
        isInExpandedSet: false,
      }),
    ).toBe(true);
  });

  it("keeps errored parties expanded even when not in expandedIds", () => {
    expect(
      isPartyFormExpanded({
        roleCount: 1,
        hasErrors: true,
        isInExpandedSet: false,
      }),
    ).toBe(true);
    expect(
      isPartyFormExpanded({
        roleCount: 2,
        hasErrors: true,
        isInExpandedSet: false,
      }),
    ).toBe(true);
  });

  it("uses expandedIds for multi-party rows without errors", () => {
    expect(
      isPartyFormExpanded({
        roleCount: 2,
        hasErrors: false,
        isInExpandedSet: false,
      }),
    ).toBe(false);
    expect(
      isPartyFormExpanded({
        roleCount: 2,
        hasErrors: false,
        isInExpandedSet: true,
      }),
    ).toBe(true);
  });
});

describe("nextExclusiveExpandedIds", () => {
  it("expands only the tapped party, collapsing any other", () => {
    expect(nextExclusiveExpandedIds(new Set(["a"]), "b")).toEqual(new Set(["b"]));
  });

  it("collapses the tapped party when it is already expanded", () => {
    expect(nextExclusiveExpandedIds(new Set(["a"]), "a")).toEqual(new Set());
  });
});
