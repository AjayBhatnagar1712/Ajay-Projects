/**
 * Pure date helpers for the Terms step.
 * Form storage stays ISO `YYYY-MM-DD`; display uses DD/MM/YYYY.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!ISO_DATE.test(trimmed)) return null;
  const date = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const [year, month, day] = trimmed.split("-").map(Number);
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Display ISO as DD/MM/YYYY for the date field chrome. */
export function formatIsoDateDisplay(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value.trim().length === 0 ? "" : value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/**
 * Add calendar months to an ISO date, clamping to the last day of the
 * target month (e.g. 31 Jan + 1 month → 28/29 Feb).
 */
export function addMonthsToIsoDate(iso: string, months: number): string | null {
  const date = parseIsoDate(iso);
  if (!date || !Number.isFinite(months) || months < 0) return null;
  const wholeMonths = Math.trunc(months);
  const day = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth() + wholeMonths, 1);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return toIsoDate(result);
}

/**
 * Whole calendar months between Start and End.
 *
 * Largest N such that `addMonthsToIsoDate(Start, N) <= End` (month-end days
 * clamp — e.g. 31 Jan + 1 month → 28 Feb). Examples:
 * - 15 Aug → 14 Aug next year → 11 months
 * - 15 Aug → 15 Aug next year → 12 months
 * - 31 Jan → 28 Feb (non-leap) → 1 month (clamped)
 * - 31 Mar → 30 Apr → 1 month (clamped)
 * - 1 Jan → 30 Nov same year → 10 months
 *
 * Returns null when either date is invalid or End is not after Start.
 * Returns 0 when the range is shorter than one full calendar month.
 */
export function durationMonthsFromRange(
  startIso: string,
  endIso: string,
): number | null {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return null;
  if (end.getTime() <= start.getTime()) return null;

  // Largest N where Start+N months (clamped) still lands on or before End.
  let months = 0;
  for (let candidate = 1; candidate <= 600; candidate += 1) {
    const afterIso = addMonthsToIsoDate(startIso, candidate);
    const after = afterIso ? parseIsoDate(afterIso) : null;
    if (!after || after.getTime() > end.getTime()) break;
    months = candidate;
  }
  return months;
}

export type DurationParts = {
  months: number;
  days: number;
};

/**
 * Exact calendar span as whole months + leftover days (display-only phrasing).
 * Months use {@link durationMonthsFromRange}; days are End minus (Start + months).
 * Returns null when either date is invalid or End is not after Start.
 */
export function durationPartsFromRange(
  startIso: string,
  endIso: string,
): DurationParts | null {
  const months = durationMonthsFromRange(startIso, endIso);
  if (months === null) return null;
  const afterMonths = addMonthsToIsoDate(startIso, months);
  const end = parseIsoDate(endIso);
  const cursor = afterMonths ? parseIsoDate(afterMonths) : null;
  if (!end || !cursor) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round((end.getTime() - cursor.getTime()) / dayMs);
  return { months, days: Math.max(0, days) };
}

/** UI label, e.g. "Duration: 11 months and 30 days". */
export function formatDurationDisplay(parts: DurationParts): string {
  const monthLabel =
    parts.months === 1 ? "1 month" : `${parts.months} months`;
  const dayLabel = parts.days === 1 ? "1 day" : `${parts.days} days`;
  if (parts.months === 0) return `Duration: ${dayLabel}`;
  if (parts.days === 0) return `Duration: ${monthLabel}`;
  return `Duration: ${monthLabel} and ${dayLabel}`;
}

/** Soft warning only — execution after start is unusual but allowed. */
export function isExecutionAfterStart(
  executionDate: string,
  startDate: string,
): boolean {
  const execution = parseIsoDate(executionDate);
  const start = parseIsoDate(startDate);
  if (!execution || !start) return false;
  return execution.getTime() > start.getTime();
}

/** Local calendar midnight for "today" (noon-safe via toIsoDate helpers). */
export function startOfLocalToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

/** Year picker: current year and later (no past years). */
export function datePickerYearBounds(today: Date = startOfLocalToday()): {
  startYear: number;
  endYear: number;
} {
  const startYear = today.getFullYear();
  return { startYear, endYear: startYear + 50 };
}

/**
 * Form value for derived durationMonths.
 * Valid range → whole months as a string, including "0" when the span is
 * shorter than one calendar month (the form then rejects 0 with a
 * min-duration message). Incomplete/invalid dates → "".
 */
export function durationMonthsFieldValue(startIso: string, endIso: string): string {
  const months = durationMonthsFromRange(startIso, endIso);
  return months === null ? "" : String(months);
}

/**
 * Minimum selectable date for the End picker.
 * Uses Start when set; otherwise today (same floor as Execution / Start).
 */
export function endDatePickerMinDate(startIso: string): Date {
  return parseIsoDate(startIso) ?? startOfLocalToday();
}

/** English ordinal for day-of-month (1→1st, 2→2nd, 3→3rd, 11→11th, 21→21st). */
export function englishDayOrdinal(day: number): string | null {
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** Plain-language rent due confirmation, e.g. "5th of every month". */
export function formatRentDueDateConfirmation(day: number | string): string | null {
  const n = typeof day === "string" ? Number(day.trim()) : day;
  const ordinal = englishDayOrdinal(n);
  if (!ordinal) return null;
  return `${ordinal} of every month`;
}

/**
 * Ordinal particle only (st/nd/rd/th) for a day string typed in Rent due date.
 * Null when empty or not a valid 1–31 day.
 */
export function rentDueDateOrdinalParticle(dayRaw: string): string | null {
  const trimmed = dayRaw.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  const ordinal = englishDayOrdinal(n);
  if (!ordinal) return null;
  return ordinal.slice(String(n).length);
}

/**
 * Trailing phrase after the day + ordinal particle.
 * Kept separate so layout can put an exact gap before "of every month".
 */
export function rentDueDateTrailingPhrase(): string {
  return "of every month";
}

/**
 * Trailing Affix for TextField (same pattern as Notice `suffix="months"`).
 * Null when empty or outside 1–31 — empty field must show no suffix.
 * Uses a single ASCII space between particle and phrase (normal word gap).
 */
export function rentDueDateFieldSuffix(dayRaw: string): string | null {
  const particle = rentDueDateOrdinalParticle(dayRaw);
  if (!particle) return null;
  return `${particle} ${rentDueDateTrailingPhrase()}`;
}
