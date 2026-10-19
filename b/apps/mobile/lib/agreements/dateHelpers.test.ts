import { describe, expect, it } from "vitest";
import {
  addMonthsToIsoDate,
  datePickerYearBounds,
  durationMonthsFieldValue,
  durationMonthsFromRange,
  durationPartsFromRange,
  endDatePickerMinDate,
  englishDayOrdinal,
  formatDurationDisplay,
  formatIsoDateDisplay,
  formatRentDueDateConfirmation,
  isExecutionAfterStart,
  parseIsoDate,
  rentDueDateFieldSuffix,
  rentDueDateOrdinalParticle,
  rentDueDateTrailingPhrase,
  startOfLocalToday,
  toIsoDate,
} from "./dateHelpers";

describe("parseIsoDate / toIsoDate", () => {
  it("round-trips a valid calendar date", () => {
    const date = parseIsoDate("2026-12-01");
    expect(date).not.toBeNull();
    expect(toIsoDate(date!)).toBe("2026-12-01");
  });

  it("rejects invalid calendar dates", () => {
    expect(parseIsoDate("2026-02-31")).toBeNull();
    expect(parseIsoDate("not-a-date")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
  });
});

describe("formatIsoDateDisplay", () => {
  it("formats ISO as DD/MM/YYYY", () => {
    expect(formatIsoDateDisplay("2026-11-24")).toBe("24/11/2026");
  });

  it("returns empty for blank input", () => {
    expect(formatIsoDateDisplay("")).toBe("");
  });
});

describe("addMonthsToIsoDate", () => {
  it("adds whole months from start date", () => {
    expect(addMonthsToIsoDate("2026-12-01", 11)).toBe("2027-11-01");
  });

  it("clamps to the last day of the target month", () => {
    expect(addMonthsToIsoDate("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("returns null for invalid inputs", () => {
    expect(addMonthsToIsoDate("", 11)).toBeNull();
    expect(addMonthsToIsoDate("2026-12-01", -1)).toBeNull();
  });
});

describe("durationMonthsFromRange", () => {
  it("floors a day-before-anniversary span to 11 months", () => {
    expect(durationMonthsFromRange("2025-08-15", "2026-08-14")).toBe(11);
  });

  it("counts an exact anniversary as 12 months", () => {
    expect(durationMonthsFromRange("2025-08-15", "2026-08-15")).toBe(12);
  });

  it("returns 0 for a span shorter than one calendar month", () => {
    expect(durationMonthsFromRange("2026-08-15", "2026-09-14")).toBe(0);
  });

  it("derives 0 (not blank) for the 17-day Finish repro so the form can reject it", () => {
    expect(durationMonthsFromRange("2026-08-14", "2026-08-31")).toBe(0);
    expect(durationMonthsFieldValue("2026-08-14", "2026-08-31")).toBe("0");
    expect(durationMonthsFieldValue("2026-08-14", "2027-08-12")).toBe("11");
    expect(durationMonthsFieldValue("", "2026-08-31")).toBe("");
  });

  it("returns null when end is not after start", () => {
    expect(durationMonthsFromRange("2026-08-15", "2026-08-15")).toBeNull();
    expect(durationMonthsFromRange("2026-08-15", "2026-08-01")).toBeNull();
    expect(durationMonthsFromRange("", "2026-08-14")).toBeNull();
  });

  it("counts month-end to shorter month-end as one clamped month", () => {
    expect(addMonthsToIsoDate("2027-01-31", 1)).toBe("2027-02-28");
    expect(durationMonthsFromRange("2027-01-31", "2027-02-28")).toBe(1);
    expect(addMonthsToIsoDate("2027-03-31", 1)).toBe("2027-04-30");
    expect(durationMonthsFromRange("2027-03-31", "2027-04-30")).toBe(1);
  });
});

describe("durationPartsFromRange / formatDurationDisplay", () => {
  it("splits whole months and leftover days", () => {
    expect(durationPartsFromRange("2025-08-15", "2026-08-14")).toEqual({
      months: 11,
      days: 30,
    });
    expect(formatDurationDisplay({ months: 11, days: 30 })).toBe(
      "Duration: 11 months and 30 days",
    );
  });

  it("omits the days clause on an exact anniversary", () => {
    expect(durationPartsFromRange("2025-08-15", "2026-08-15")).toEqual({
      months: 12,
      days: 0,
    });
    expect(formatDurationDisplay({ months: 12, days: 0 })).toBe(
      "Duration: 12 months",
    );
  });

  it("handles a sub-month span as days only", () => {
    expect(durationPartsFromRange("2026-08-15", "2026-08-30")).toEqual({
      months: 0,
      days: 15,
    });
    expect(formatDurationDisplay({ months: 0, days: 15 })).toBe(
      "Duration: 15 days",
    );
  });

  it("uses singular labels", () => {
    expect(formatDurationDisplay({ months: 1, days: 1 })).toBe(
      "Duration: 1 month and 1 day",
    );
  });

  /**
   * Six stress cases — including leap-year and month-end clamp.
   * Days = End − (Start + months); End === (Start + months) + days.
   */
  it.each([
    {
      start: "2026-08-15",
      end: "2027-08-14",
      parts: { months: 11, days: 30 },
      label: "Duration: 11 months and 30 days",
    },
    {
      start: "2027-01-01",
      end: "2027-02-28",
      parts: { months: 1, days: 27 },
      label: "Duration: 1 month and 27 days",
    },
    {
      start: "2028-01-01",
      end: "2028-02-29",
      parts: { months: 1, days: 28 },
      label: "Duration: 1 month and 28 days",
    },
    {
      // 31 Jan + 1 month clamps to 28 Feb = End → exact 1 month, 0 leftover
      start: "2027-01-31",
      end: "2027-02-28",
      parts: { months: 1, days: 0 },
      label: "Duration: 1 month",
    },
    {
      // 31 Mar + 1 month clamps to 30 Apr = End → exact 1 month, 0 leftover
      start: "2027-03-31",
      end: "2027-04-30",
      parts: { months: 1, days: 0 },
      label: "Duration: 1 month",
    },
    {
      start: "2027-03-01",
      end: "2028-03-01",
      parts: { months: 12, days: 0 },
      label: "Duration: 12 months",
    },
  ] as const)(
    "$start → $end → $label",
    ({ start, end, parts, label }) => {
      expect(addMonthsToIsoDate(start, parts.months)).not.toBeNull();
      expect(durationPartsFromRange(start, end)).toEqual(parts);
      expect(formatDurationDisplay(parts)).toBe(label);
    },
  );
});

describe("englishDayOrdinal / formatRentDueDateConfirmation", () => {
  it("uses correct English ordinal suffixes", () => {
    expect(englishDayOrdinal(1)).toBe("1st");
    expect(englishDayOrdinal(2)).toBe("2nd");
    expect(englishDayOrdinal(3)).toBe("3rd");
    expect(englishDayOrdinal(4)).toBe("4th");
    expect(englishDayOrdinal(5)).toBe("5th");
    expect(englishDayOrdinal(11)).toBe("11th");
    expect(englishDayOrdinal(12)).toBe("12th");
    expect(englishDayOrdinal(13)).toBe("13th");
    expect(englishDayOrdinal(21)).toBe("21st");
    expect(englishDayOrdinal(22)).toBe("22nd");
    expect(englishDayOrdinal(23)).toBe("23rd");
    expect(englishDayOrdinal(31)).toBe("31st");
  });

  it("formats rent due confirmation copy", () => {
    expect(formatRentDueDateConfirmation(5)).toBe("5th of every month");
    expect(formatRentDueDateConfirmation("1")).toBe("1st of every month");
    expect(formatRentDueDateConfirmation("22")).toBe("22nd of every month");
    expect(formatRentDueDateConfirmation("")).toBeNull();
  });

  it("builds a live field suffix only for valid 1–31 days", () => {
    expect(rentDueDateFieldSuffix("")).toBeNull();
    expect(rentDueDateFieldSuffix("0")).toBeNull();
    expect(rentDueDateFieldSuffix("1")).toBe("st of every month");
    expect(rentDueDateFieldSuffix("2")).toBe("nd of every month");
    expect(rentDueDateFieldSuffix("3")).toBe("rd of every month");
    expect(rentDueDateFieldSuffix("5")).toBe("th of every month");
    expect(rentDueDateFieldSuffix("11")).toBe("th of every month");
    expect(rentDueDateFieldSuffix("22")).toBe("nd of every month");
    expect(rentDueDateFieldSuffix("99")).toBeNull();
  });

  it("splits ordinal particle from the trailing phrase", () => {
    expect(rentDueDateOrdinalParticle("")).toBeNull();
    expect(rentDueDateOrdinalParticle("21")).toBe("st");
    expect(rentDueDateOrdinalParticle("5")).toBe("th");
    expect(rentDueDateOrdinalParticle("99")).toBeNull();
    expect(rentDueDateTrailingPhrase()).toBe("of every month");
  });
});

describe("isExecutionAfterStart", () => {
  it("is true when execution is after start", () => {
    expect(isExecutionAfterStart("2026-12-10", "2026-12-01")).toBe(true);
  });

  it("is false when execution is on or before start", () => {
    expect(isExecutionAfterStart("2026-11-24", "2026-12-01")).toBe(false);
    expect(isExecutionAfterStart("2026-12-01", "2026-12-01")).toBe(false);
  });
});

describe("datePickerYearBounds", () => {
  it("starts at the current year and extends forward", () => {
    expect(datePickerYearBounds(new Date(2026, 7, 13, 12, 0, 0))).toEqual({
      startYear: 2026,
      endYear: 2076,
    });
  });
});

describe("endDatePickerMinDate", () => {
  it("uses start date when set", () => {
    const min = endDatePickerMinDate("2026-08-25");
    expect(toIsoDate(min)).toBe("2026-08-25");
  });

  it("falls back to today when start is blank", () => {
    const min = endDatePickerMinDate("");
    expect(toIsoDate(min)).toBe(toIsoDate(startOfLocalToday()));
  });
});
