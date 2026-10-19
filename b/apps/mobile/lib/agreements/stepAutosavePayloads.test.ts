import { describe, expect, it } from "vitest";
import {
  buildInventoryAutosavePayload,
  buildPartiesAutosavePayload,
  buildPropertyAutosavePatch,
  buildTermsAutosavePatch,
  serializeAutosavePayload,
} from "./stepAutosavePayloads";
import { emptyParty, primaryByRole } from "./flow";

describe("buildPropertyAutosavePatch", () => {
  it("returns null when nothing is filled", () => {
    expect(
      buildPropertyAutosavePatch({
        propertyAddress: "",
        areaSqft: "",
        facing: "",
        carParkingCount: "",
      }),
    ).toBeNull();
  });

  it("includes only filled valid fields", () => {
    expect(
      buildPropertyAutosavePatch({
        propertyAddress: "  12 MG Road  ",
        areaSqft: "1200",
        facing: "",
        carParkingCount: "2",
      }),
    ).toEqual({
      propertyAddress: "12 MG Road",
      areaSqft: 1200,
      carParkingCount: 2,
    });
  });
});

describe("buildPartiesAutosavePayload", () => {
  it("returns null while phones are incomplete", () => {
    const parties = primaryByRole([
      { ...emptyParty("owner", true), name: "A", phone: "98765" },
      { ...emptyParty("tenant", true), name: "B", phone: "9876543211" },
    ]);
    expect(buildPartiesAutosavePayload(parties)).toBeNull();
  });

  it("saves without title/age/aadhaar (bypasses step validation)", () => {
    const parties = primaryByRole([
      {
        ...emptyParty("owner", true),
        name: "Owner",
        phone: "9876543210",
        aadhaar: "123", // mid-type — stripped
      },
      {
        ...emptyParty("tenant", true),
        name: "Tenant",
        phone: "9876543211",
      },
    ]);
    const payload = buildPartiesAutosavePayload(parties);
    expect(payload).not.toBeNull();
    expect(payload?.parties).toHaveLength(2);
    expect(payload?.parties[0]?.phone).toBe("+919876543210");
    expect(payload?.parties[0]?.aadhaar).toBeNull();
    expect(payload?.parties[0]?.title).toBeNull();
  });

  it("keeps a valid aadhaar", () => {
    const parties = primaryByRole([
      {
        ...emptyParty("owner", true),
        name: "Owner",
        phone: "9876543210",
        aadhaar: "9671 3280 7649",
      },
      {
        ...emptyParty("tenant", true),
        name: "Tenant",
        phone: "9876543211",
      },
    ]);
    expect(buildPartiesAutosavePayload(parties)?.parties[0]?.aadhaar).toBe(
      "967132807649",
    );
  });

  it("allows owners-only draft saves", () => {
    const parties = primaryByRole([
      {
        ...emptyParty("owner", true),
        name: "Owner",
        phone: "9876543210",
      },
    ]);
    const payload = buildPartiesAutosavePayload(parties);
    expect(payload).not.toBeNull();
    expect(payload?.parties).toHaveLength(1);
    expect(payload?.parties[0]?.role).toBe("owner");
  });
});

describe("buildInventoryAutosavePayload", () => {
  it("drops blank rows, keeps quantity, and allows empty list", () => {
    expect(
      buildInventoryAutosavePayload([
        { description: "  Sofa  ", quantity: 2 },
        { description: "   ", quantity: 1 },
      ]),
    ).toEqual({
      items: [{ description: "Sofa", quantity: 2, sortOrder: 0 }],
    });
    expect(
      buildInventoryAutosavePayload([{ description: "Fan", quantity: null }]),
    ).toEqual({
      items: [{ description: "Fan", quantity: 1, sortOrder: 0 }],
    });
    expect(buildInventoryAutosavePayload([{ description: "" }])).toEqual({
      items: [],
    });
  });
});

describe("buildTermsAutosavePatch", () => {
  it("omits endDate when it is not after effectiveDate", () => {
    const patch = buildTermsAutosavePatch({
      executionDate: "2026-08-01",
      effectiveDate: "2026-08-01",
      endDate: "2026-07-01",
      executionCity: "Hyderabad",
      durationMonths: "12",
      minStayMonths: "",
      noticePeriodLicenseeMonths: "",
      noticePeriodLicensorMonths: "",
      monthlyRentRupees: "50000",
      securityDepositRupees: "",
      maintenanceIncluded: false,
      monthlyMaintenanceRupees: "3000",
      rentDueDay: "5",
    });
    expect(patch).toMatchObject({
      executionDate: "2026-08-01",
      effectiveDate: "2026-08-01",
      executionCity: "Hyderabad",
      durationMonths: 12,
      monthlyRentPaise: 5000000,
      maintenanceIncluded: false,
      monthlyMaintenancePaise: 300000,
      rentDueDay: 5,
    });
    expect(patch).not.toHaveProperty("endDate");
  });

  it("does not persist durationMonths 0 for a sub-month range", () => {
    const patch = buildTermsAutosavePatch({
      executionDate: "2026-08-13",
      effectiveDate: "2026-08-14",
      endDate: "2026-08-31",
      executionCity: "Hyderabad",
      durationMonths: "0",
      minStayMonths: "",
      noticePeriodLicenseeMonths: "",
      noticePeriodLicensorMonths: "",
      monthlyRentRupees: "",
      securityDepositRupees: "",
      maintenanceIncluded: true,
      monthlyMaintenanceRupees: "3000",
      rentDueDay: "",
    });
    expect(patch).not.toHaveProperty("durationMonths");
  });
});

describe("serializeAutosavePayload", () => {
  it("is stable for dirty checks", () => {
    const a = serializeAutosavePayload({ x: 1, y: "a" });
    const b = serializeAutosavePayload({ x: 1, y: "a" });
    expect(a).toBe(b);
  });
});
