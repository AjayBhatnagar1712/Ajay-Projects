import { describe, expect, it, vi } from "vitest";
import * as agreementsModule from "./agreements";
import { resolveTenantAwaitingSignaturesStatus } from "./tenantAgreementSignatureStatus";
import { buildProgressStepsFromStage, resolveTenantWorkflowState } from "./tenantWorkflowState";
import type { TenantWorkspaceRecord } from "./tenantWorkspace";

const baseWorkspace: TenantWorkspaceRecord = {
  phone: "6369856040",
  tenantName: "Meena",
  propertyId: "prop-1",
  propertyLabel: "Prestige Unit 1806",
  propertyAddress: "Financial District, Hyderabad",
  monthlyRent: "13000",
  ownerName: "Rajesh Kumar",
  updatedAt: Date.now(),
};

describe("tenantAgreementSignatureStatus", () => {
  it("marks the active tenant as signed and owners as pending", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => {
        if (key === "tk_active_phone") return "6369856040";
        if (key === "tk_active_role") return "tenant";
        return null;
      },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    });

    const status = resolveTenantAwaitingSignaturesStatus({
      ...baseWorkspace,
      ownerContact: "+9163698580584",
      lifecycleStage: "awaiting_esign_signatures",
    });

    expect(status.title).toBe("Waiting for signatures");
    expect(status.groups[0]?.label).toBe("Owner");
    expect(status.groups[0]?.parties.every((party) => !party.signed)).toBe(true);
    expect(status.groups[1]?.label).toBe("Tenant");
    expect(status.groups[1]?.parties[0]?.signed).toBe(true);

    vi.unstubAllGlobals();
  });

  it("builds owner and tenant groups from agreement parties", () => {
    vi.spyOn(agreementsModule, "getAgreements").mockReturnValue([
      {
        id: "agr-1",
        ownerContact: "+9163698580584,+9163698580584",
        tenantContact: "+916369856040",
        coTenantContact: "+919988776655",
      } as agreementsModule.Agreement,
    ]);

    const status = resolveTenantAwaitingSignaturesStatus({
      ...baseWorkspace,
      agreementId: "agr-1",
      esignSignedPartyPhones: ["6369856040"],
    });

    expect(status.groups[0]?.parties).toHaveLength(2);
    expect(status.groups[1]?.parties).toHaveLength(2);
    expect(status.groups[1]?.parties[0]?.signed).toBe(true);
    expect(status.groups[1]?.parties[1]?.signed).toBe(false);

    vi.restoreAllMocks();
  });
});

describe("awaiting e-sign dashboard workflow", () => {
  it("completes all progress steps and exposes signature status", () => {
    const steps = buildProgressStepsFromStage("awaiting_esign_signatures");
    expect(steps.every((step) => step.state === "complete")).toBe(true);

    const snapshot = resolveTenantWorkflowState({
      ...baseWorkspace,
      lifecycleStage: "awaiting_esign_signatures",
      esignSignedPartyPhones: ["6369856040"],
    });

    expect(snapshot.stage).toBe("awaiting_esign_signatures");
    expect(snapshot.signatureStatus?.title).toBe("Waiting for signatures");
    expect(snapshot.signatureStatus?.groups.length).toBeGreaterThan(0);
  });
});
