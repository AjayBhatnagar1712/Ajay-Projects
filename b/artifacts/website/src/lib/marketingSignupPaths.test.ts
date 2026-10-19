import { describe, expect, it } from "vitest";
import {
  buildMarketingSignupRoleFormPath,
  buildMarketingSignupRolePath,
} from "./marketingSignupPaths";

describe("marketingSignupPaths", () => {
  it("builds the role selection path", () => {
    expect(buildMarketingSignupRolePath()).toBe("/signup/role");
  });

  it("builds owner and broker signup form paths", () => {
    expect(buildMarketingSignupRoleFormPath("owner")).toBe("/signup/owner");
    expect(buildMarketingSignupRoleFormPath("broker")).toBe("/signup/broker");
  });
});
