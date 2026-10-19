import { afterEach, describe, expect, it } from "vitest";
import type { LeaseAgreementDetail } from "../api/client";
import {
  capturePreviewEditSnapshot,
  clearAllPreviewEditSnapshots,
  inventoryReplaceFromDetail,
  partiesReplaceFromDetail,
  peekPreviewEditSnapshot,
  scalarPatchFromDetail,
} from "./previewEditSession";

function detail(
  overrides: Partial<LeaseAgreementDetail> = {},
): LeaseAgreementDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    createdByUserId: "22222222-2222-4222-8222-222222222222",
    status: "draft",
    executionDate: "2026-08-13",
    effectiveDate: "2026-08-14",
    endDate: "2027-08-12",
    executionCity: "Hyderabad",
    durationMonths: 11,
    minStayMonths: 0,
    noticePeriodLicenseeMonths: 1,
    noticePeriodLicensorMonths: 1,
    monthlyRentPaise: 6000000,
    securityDepositPaise: 12000000,
    rentDueDay: 5,
    maintenanceIncluded: true,
    monthlyMaintenancePaise: null,
    propertyAddress: "12 Lake View",
    areaSqft: 1200,
    facing: "East",
    carParkingCount: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    parties: [
      {
        id: "owner-1",
        role: "owner",
        name: "Owner",
        phone: "+919876543210",
        title: null,
        age: 40,
        address: "Owner address",
        aadhaar: null,
        pan: null,
        email: null,
        isPrimary: true,
        sortOrder: 0,
        approvalStatus: "pending",
        reviewComment: null,
        reviewedAt: null,
        hasReviewToken: false,
        reviewLinkStatus: "none",
        reviewSharedAt: null,
        hasBeenShared: false,
      },
      {
        id: "tenant-1",
        role: "tenant",
        name: "Tenant",
        phone: "+919876543211",
        title: null,
        age: 30,
        address: "Tenant address",
        aadhaar: null,
        pan: null,
        email: null,
        isPrimary: true,
        sortOrder: 1,
        approvalStatus: "pending",
        reviewComment: null,
        reviewedAt: null,
        hasReviewToken: false,
        reviewLinkStatus: "none",
        reviewSharedAt: null,
        hasBeenShared: false,
      },
    ],
    inventory: [
      {
        id: "inv-1",
        description: "Fridge",
        quantity: 1,
        sortOrder: 0,
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  clearAllPreviewEditSnapshots();
});

describe("preview edit snapshot", () => {
  it("stores a clone so later cache mutations do not change the snapshot", () => {
    const source = detail();
    const owner = source.parties[0];
    const fridge = source.inventory[0];
    expect(owner).toBeDefined();
    expect(fridge).toBeDefined();
    capturePreviewEditSnapshot(source);
    source.propertyAddress = "mutated";
    if (owner) owner.name = "mutated";
    if (fridge) fridge.description = "mutated";
    const snap = peekPreviewEditSnapshot(source.id);
    expect(snap?.propertyAddress).toBe("12 Lake View");
    expect(snap?.parties[0]?.name).toBe("Owner");
    expect(snap?.inventory[0]?.description).toBe("Fridge");
  });
});

describe("restore payloads from snapshot", () => {
  it("maps every scalar field including nulls so in-session fills can be cleared", () => {
    const snap = detail({
      facing: null,
      monthlyMaintenancePaise: null,
    });
    expect(scalarPatchFromDetail(snap)).toMatchObject({
      propertyAddress: "12 Lake View",
      facing: null,
      monthlyMaintenancePaise: null,
      durationMonths: 11,
      maintenanceIncluded: true,
    });
  });

  it("rebuilds parties and inventory replace bodies from the snapshot", () => {
    const snap = detail();
    const parties = partiesReplaceFromDetail(snap);
    expect(parties?.parties).toHaveLength(2);
    expect(parties?.parties[0]).toMatchObject({
      role: "owner",
      name: "Owner",
      phone: "+919876543210",
      isPrimary: true,
    });
    expect(inventoryReplaceFromDetail(snap)).toEqual({
      items: [{ description: "Fridge", quantity: 1, sortOrder: 0 }],
    });
  });

  it("returns null parties payload when the snapshot has no saveable parties", () => {
    expect(partiesReplaceFromDetail(detail({ parties: [] }))).toBeNull();
  });
});
