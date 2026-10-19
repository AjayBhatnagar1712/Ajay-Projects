import { describe, expect, it } from "vitest";
import { emptyParty, primaryByRole } from "./flow";
import {
  maxPartiesForRole,
  mergeRolePartiesForSave,
} from "./rolePartyMerge";

describe("mergeRolePartiesForSave", () => {
  it("puts owners before tenants and stamps primaries", () => {
    const owners = primaryByRole([
      { ...emptyParty("owner", true), name: "O1", phone: "9876543210" },
    ]);
    const tenants = primaryByRole([
      { ...emptyParty("tenant", true), name: "T1", phone: "9876543211" },
    ]);
    const merged = mergeRolePartiesForSave("owner", owners, tenants);
    expect(merged.map((party) => party.role)).toEqual(["owner", "tenant"]);
    expect(merged.every((party) => party.isPrimary)).toBe(true);
  });

  it("allows owners-only merge when tenants are empty", () => {
    const owners = primaryByRole([
      { ...emptyParty("owner", true), name: "O1", phone: "9876543210" },
    ]);
    expect(mergeRolePartiesForSave("owner", owners, [])).toHaveLength(1);
  });
});

describe("maxPartiesForRole", () => {
  it("reserves one slot for the opposite role when empty", () => {
    expect(maxPartiesForRole(0)).toBe(4);
  });

  it("uses remaining capacity when opposite role already has parties", () => {
    expect(maxPartiesForRole(2)).toBe(3);
  });
});
