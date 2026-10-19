import { describe, expect, it } from "vitest";
import {
  marketingRolesMissingFrom,
  marketingRoleLabel,
  toMarketingAccountSummaries,
} from "./marketingAuthRoles";

describe("marketingAuthRoles", () => {
  it("labels roles for welcome-back cards", () => {
    expect(marketingRoleLabel("owner")).toBe("Property Owner");
    expect(marketingRoleLabel("broker")).toBe("Broker");
  });

  it("returns roles the phone does not have yet", () => {
    expect(marketingRolesMissingFrom(["owner"])).toEqual(["broker", "tenant"]);
    expect(marketingRolesMissingFrom(["owner", "broker", "tenant"])).toEqual([]);
  });

  it("builds account summaries with optional display names", () => {
    expect(
      toMarketingAccountSummaries(["owner"], { owner: "Meena" }),
    ).toEqual([{ role: "owner", displayName: "Meena" }]);
  });
});
