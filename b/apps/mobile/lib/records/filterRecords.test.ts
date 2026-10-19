import { describe, expect, it } from "vitest";
import type { LeaseAgreement, PartyContactSummary } from "../api/client";
import {
  filterAgreementsByAddress,
  filterParties,
  filterProperties,
} from "./filterRecords";

const properties = [
  {
    key: "a",
    address: "12A, Sai Residency, Andheri West",
    areaSqft: 850,
    facing: "East",
    carParkingCount: 1,
  },
  {
    key: "b",
    address: "G-402, Prestige Ferns, Bellandur",
    areaSqft: 1250,
    facing: null,
    carParkingCount: null,
  },
];

const parties: PartyContactSummary[] = [
  {
    name: "Venkat Shekhar",
    phone: "9876543210",
    email: null,
    address: null,
    role: "owner",
    alternateNames: [],
    agreementCount: 1,
    agreements: [],
  },
  {
    name: "Priya Nair",
    phone: "9123456780",
    email: null,
    address: null,
    role: "tenant",
    alternateNames: [],
    agreementCount: 1,
    agreements: [],
  },
];

describe("filterProperties", () => {
  it("returns all when query empty", () => {
    expect(filterProperties(properties, "  ")).toHaveLength(2);
  });

  it("matches address case-insensitively", () => {
    expect(filterProperties(properties, "andheri")).toEqual([properties[0]]);
  });
});

describe("filterParties", () => {
  it("matches name", () => {
    expect(filterParties(parties, "priya")).toEqual([parties[1]]);
  });

  it("matches phone digits ignoring formatting", () => {
    expect(filterParties(parties, "98765")).toEqual([parties[0]]);
  });
});

const agreements: LeaseAgreement[] = [
  {
    id: "1",
    createdByUserId: "u1",
    status: "draft",
    executionDate: null,
    effectiveDate: null,
    endDate: null,
    executionCity: null,
    durationMonths: null,
    minStayMonths: null,
    noticePeriodLicenseeMonths: null,
    noticePeriodLicensorMonths: null,
    monthlyRentPaise: null,
    securityDepositPaise: null,
    rentDueDay: null,
    maintenanceIncluded: false,
    monthlyMaintenancePaise: null,
    propertyAddress: "402, Ferns Paradise, Bellandur",
    areaSqft: null,
    facing: null,
    carParkingCount: null,
    createdAt: "2025-01-15T00:00:00Z",
    updatedAt: "2025-01-15T00:00:00Z",
  },
  {
    id: "2",
    createdByUserId: "u1",
    status: "draft",
    executionDate: null,
    effectiveDate: null,
    endDate: null,
    executionCity: null,
    durationMonths: null,
    minStayMonths: null,
    noticePeriodLicenseeMonths: null,
    noticePeriodLicensorMonths: null,
    monthlyRentPaise: null,
    securityDepositPaise: null,
    rentDueDay: null,
    maintenanceIncluded: false,
    monthlyMaintenancePaise: null,
    propertyAddress: null,
    areaSqft: null,
    facing: null,
    carParkingCount: null,
    createdAt: "2025-01-12T00:00:00Z",
    updatedAt: "2025-01-12T00:00:00Z",
  },
];

describe("filterAgreementsByAddress", () => {
  it("returns all when query empty", () => {
    expect(filterAgreementsByAddress(agreements, "  ")).toHaveLength(2);
  });

  it("matches address case-insensitively", () => {
    expect(filterAgreementsByAddress(agreements, "ferns")).toEqual([
      agreements[0],
    ]);
  });

  it("excludes agreements without an address when searching", () => {
    expect(filterAgreementsByAddress(agreements, "paradise")).toEqual([
      agreements[0],
    ]);
  });
});
