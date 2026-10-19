const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RenewalDateInput = {
  effectiveDate: string | null;
  endDate: string | null;
  durationMonths: number | null;
};

export type RenewalDates = {
  executionDate: string;
  effectiveDate: string | null;
  endDate: string | null;
  durationMonths: number | null;
};

function parseIsoDate(value: string | null): Date | null {
  if (value === null || !ISO_DATE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToIsoDate(iso: string, days: number): string | null {
  const date = parseIsoDate(iso);
  if (!date) return null;
  return toIsoDate(new Date(date.getTime() + days * DAY_MS));
}

function addMonthsToIsoDate(iso: string, months: number): string | null {
  const date = parseIsoDate(iso);
  if (!date || !Number.isFinite(months) || months < 0) return null;
  const wholeMonths = Math.trunc(months);
  const day = date.getUTCDate();
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + wholeMonths, 1, 12, 0, 0));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0, 12, 0, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return toIsoDate(result);
}

function durationMonthsFromRange(startIso: string, endIso: string): number | null {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end || end.getTime() <= start.getTime()) return null;

  let months = 0;
  for (let candidate = 1; candidate <= 600; candidate += 1) {
    const afterIso = addMonthsToIsoDate(startIso, candidate);
    const after = afterIso ? parseIsoDate(afterIso) : null;
    if (!after || after.getTime() > end.getTime()) break;
    months = candidate;
  }
  return months;
}

function durationPartsFromRange(startIso: string, endIso: string): { months: number; days: number } | null {
  const months = durationMonthsFromRange(startIso, endIso);
  if (months === null) return null;
  const afterMonthsIso = addMonthsToIsoDate(startIso, months);
  const cursor = afterMonthsIso ? parseIsoDate(afterMonthsIso) : null;
  const end = parseIsoDate(endIso);
  if (!cursor || !end) return null;
  const days = Math.round((end.getTime() - cursor.getTime()) / DAY_MS);
  return { months, days: Math.max(0, days) };
}

function currentUtcIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function maxIsoDate(left: string, right: string): string {
  return left >= right ? left : right;
}

export function calculateRenewalDates(input: RenewalDateInput, todayIso = currentUtcIsoDate()): RenewalDates {
  const originalStart = parseIsoDate(input.effectiveDate);
  const originalEnd = parseIsoDate(input.endDate);
  const executionDate = todayIso;

  if (!originalStart || !originalEnd || originalEnd.getTime() <= originalStart.getTime()) {
    return {
      executionDate,
      effectiveDate: null,
      endDate: null,
      durationMonths: input.durationMonths,
    };
  }

  const parts = durationPartsFromRange(input.effectiveDate!, input.endDate!);
  const dayAfterOriginalEnd = addDaysToIsoDate(input.endDate!, 1);
  if (!parts || !dayAfterOriginalEnd) {
    return {
      executionDate,
      effectiveDate: null,
      endDate: null,
      durationMonths: input.durationMonths,
    };
  }

  const effectiveDate = maxIsoDate(dayAfterOriginalEnd, todayIso);
  const afterMonths = addMonthsToIsoDate(effectiveDate, parts.months);
  const endDate = afterMonths ? addDaysToIsoDate(afterMonths, parts.days) : null;

  return {
    executionDate,
    effectiveDate,
    endDate,
    durationMonths: parts.months,
  };
}
