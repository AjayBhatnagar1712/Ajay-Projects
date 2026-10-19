import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enrichTenantWorkspaceEcosystem } from "./tenantEcosystem";
import type { TenantWorkspaceRecord } from "./tenantWorkspace";

vi.mock("./properties", () => ({
  getProperties: () => [
    {
      id: "prop-1",
      nickname: "Prestige Unit 1806",
      address: "Tower A",
      area: "Financial District",
      city: "Hyderabad",
      pincode: "500032",
      country: "India",
      ownerName: "Anita Owner",
      ownerContact: "+919000000001",
      propertyType: "Apartment",
      unitSize: "2 BHK",
      furnishing: "Semi",
      builtUpArea: "1200",
      builtUpUnits: "sqft",
      totalFloors: "20",
      bedrooms: "2",
      bathrooms: "2",
      balconies: "1",
      floorLevel: "18",
      mainDoorDirection: "East",
      amenities: [],
      tenantsPreferred: [],
      monthlyRent: "13000",
      rentNegotiable: false,
      maintenanceIncluded: true,
      monthlyMaintenance: "2000",
      securityDeposit: "39000",
      availableFrom: "2026-04-01",
      images: ["https://example.com/prestige.jpg"],
      imageCount: 1,
      status: "Active",
      createdAt: Date.now(),
    },
  ],
  getPropertyTitle: (property: { nickname?: string; area: string }) =>
    property.nickname ?? property.area,
}));

describe("tenantEcosystem", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: () => null,
      length: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enriches workspace from linked property", () => {
    const enriched = enrichTenantWorkspaceEcosystem({
      phone: "9876543210",
      tenantName: "Meena",
      propertyId: "prop-1",
      propertyLabel: "",
      requesterName: "Demo Broker",
      requesterRole: "broker",
      updatedAt: Date.now(),
    });

    expect(enriched.propertyLabel).toBe("Prestige Unit 1806");
    expect(enriched.propertyAddress).toBe("Financial District, Hyderabad");
    expect(enriched.monthlyRent).toBe("13000");
    expect(enriched.securityDeposit).toBe("39000");
    expect(enriched.ownerName).toBe("Anita Owner");
    expect(enriched.brokerName).toBe("Demo Broker");
    expect(enriched.propertyImage).toBe("https://example.com/prestige.jpg");
  });

  it("marks property missing when id cannot be resolved and snapshot is incomplete", () => {
    const enriched = enrichTenantWorkspaceEcosystem({
      phone: "9876543210",
      tenantName: "Meena",
      propertyId: "missing-prop",
      propertyLabel: "",
      updatedAt: Date.now(),
    });

    expect(enriched.propertyMissing).toBe(true);
  });

  it("keeps server workspace snapshot when local property list is empty", () => {
    const enriched = enrichTenantWorkspaceEcosystem({
      phone: "9876543210",
      tenantName: "Meena",
      propertyId: "missing-prop",
      propertyLabel: "Prestige Unit 1806",
      propertyAddress: "Financial District, Hyderabad",
      monthlyRent: "13000",
      requesterName: "Demo Broker",
      requesterRole: "broker",
      updatedAt: Date.now(),
    });

    expect(enriched.propertyMissing).toBe(false);
    expect(enriched.propertyLabel).toBe("Prestige Unit 1806");
    expect(enriched.monthlyRent).toBe("13000");
    expect(enriched.brokerName).toBe("Demo Broker");
  });
});
