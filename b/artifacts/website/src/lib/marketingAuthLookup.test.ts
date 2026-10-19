import { describe, expect, it } from "vitest";
import { toMarketingAccountSummaries } from "./marketingAuthRoles";

describe("fetchMarketingAccountSummariesForPhone mapping", () => {
  it("maps API account summaries with display names", () => {
    const accounts = [
      { role: "owner" as const, displayName: "Meena" },
      { role: "tenant" as const, displayName: "" },
    ];
    const roles = accounts.map((account) => account.role);
    const displayNames = Object.fromEntries(
      accounts
        .filter((account) => account.displayName.trim())
        .map((account) => [account.role, account.displayName]),
    );

    expect(toMarketingAccountSummaries(roles, displayNames)).toEqual([
      { role: "owner", displayName: "Meena" },
      { role: "tenant", displayName: "Tenant" },
    ]);
  });
});
