import { describe, expect, it } from "vitest";
import { resolveTenantPostLoginRoute } from "./tenantPostLoginRoute";

describe("resolveTenantPostLoginRoute", () => {
  it("routes tenants to the dashboard", () => {
    expect(resolveTenantPostLoginRoute("9876543210")).toBe("/tenant/dashboard");
  });
});
