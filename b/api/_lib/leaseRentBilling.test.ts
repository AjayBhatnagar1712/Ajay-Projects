import { describe, expect, it } from "vitest";
import {
  calculateLeaseRentInvoice,
  indiaDate,
  issuedLeaseRentInvoices,
} from "./leaseRentBilling.js";

const original = {
  effectiveDate: "2026-09-10",
  endDate: "2027-08-10",
  monthlyRentPaise: 3_000_000,
};
const renewed = {
  effectiveDate: "2027-08-11",
  endDate: "2028-07-11",
  monthlyRentPaise: 6_200_000,
};

describe("calendar-month rent bills", () => {
  it("charges 20 first-month days and gives until September 15", () => {
    expect(
      calculateLeaseRentInvoice({ ...original, rentPeriod: "2026-09" }),
    ).toEqual({
      rentPeriod: "2026-09",
      coverageStart: "2026-09-10",
      coverageEnd: "2026-09-30",
      billedDays: 20,
      daysInMonth: 30,
      amountPaise: 2_000_000,
      dueDate: "2026-09-15",
    });
  });
  it.each([
    "2026-10",
    "2026-11",
    "2026-12",
    "2027-01",
    "2027-02",
    "2027-03",
    "2027-04",
    "2027-05",
    "2027-06",
    "2027-07",
  ])("charges full rent for %s, payable by the fifth", (rentPeriod) => {
    expect(
      calculateLeaseRentInvoice({ ...original, rentPeriod }),
    ).toMatchObject({
      amountPaise: 3_000_000,
      dueDate: `${rentPeriod}-05`,
    });
  });
  it("splits August into disjoint old/new bills using each agreement's own rate", () => {
    expect(
      calculateLeaseRentInvoice({ ...original, rentPeriod: "2027-08" }),
    ).toMatchObject({
      coverageStart: "2027-08-01",
      coverageEnd: "2027-08-10",
      billedDays: 10,
      daysInMonth: 31,
      amountPaise: 967742,
      dueDate: "2027-08-05",
    });
    expect(
      calculateLeaseRentInvoice({ ...renewed, rentPeriod: "2027-08" }),
    ).toMatchObject({
      coverageStart: "2027-08-11",
      coverageEnd: "2027-08-31",
      billedDays: 20,
      daysInMonth: 31,
      amountPaise: 4_000_000,
      dueDate: "2027-08-16",
    });
    expect(
      calculateLeaseRentInvoice({ ...renewed, rentPeriod: "2027-09" }),
    ).toMatchObject({
      amountPaise: 6_200_000,
      dueDate: "2027-09-05",
    });
  });
  it.each([
    ["2028-02-10", "2028-02-29", 19, 29],
    ["2027-02-10", "2027-02-28", 18, 28],
  ])(
    "uses actual February length for %s",
    (effectiveDate, endDate, billedDays, daysInMonth) => {
      expect(
        calculateLeaseRentInvoice({
          effectiveDate,
          endDate,
          monthlyRentPaise: 2_900_000,
          rentPeriod: effectiveDate.slice(0, 7),
        }),
      ).toMatchObject({
        billedDays,
        daysInMonth,
        amountPaise: Math.round((2_900_000 * billedDays) / daysInMonth),
      });
    },
  );
  it("omits a zero-day first invoice when an agreement starts at month end", () => {
    const lateStart = {
      ...original,
      effectiveDate: "2026-12-31",
      endDate: "2027-11-30",
    };
    expect(
      calculateLeaseRentInvoice({ ...lateStart, rentPeriod: "2026-12" }),
    ).toBeNull();
    expect(
      issuedLeaseRentInvoices(lateStart, new Date("2027-01-02T00:00:00Z")),
    ).toHaveLength(1);
  });
  it("keeps past issued bills available, but never issues future or out-of-term bills", () => {
    expect(
      issuedLeaseRentInvoices(original, new Date("2026-09-09T18:29:59Z")),
    ).toEqual([]);
    expect(
      issuedLeaseRentInvoices(original, new Date("2026-09-09T18:30:00Z")),
    ).toHaveLength(1);
    expect(
      issuedLeaseRentInvoices(original, new Date("2028-01-01T00:00:00Z")),
    ).toHaveLength(12);
    expect(
      calculateLeaseRentInvoice({ ...original, rentPeriod: "2027-09" }),
    ).toBeNull();
    expect(
      calculateLeaseRentInvoice({ ...original, rentPeriod: "2026-08" }),
    ).toBeNull();
  });
  it("rounds once to the nearest paise", () => {
    expect(
      calculateLeaseRentInvoice({
        ...original,
        monthlyRentPaise: 100,
        rentPeriod: "2027-08",
      })?.amountPaise,
    ).toBe(32);
  });
  it.each([
    { rentPeriod: "2026-13" },
    { effectiveDate: "2026-02-30" },
    { endDate: "2025-08-10" },
    { monthlyRentPaise: -1 },
    { monthlyRentPaise: 1.1 },
  ])("rejects invalid inputs %j", (overrides) => {
    expect(
      calculateLeaseRentInvoice({
        ...original,
        rentPeriod: "2026-09",
        ...overrides,
      }),
    ).toBeNull();
  });
  it("uses India's calendar date regardless of server timezone", () => {
    expect(indiaDate(new Date("2026-09-30T18:30:00Z"))).toBe("2026-10-01");
  });
});
