import { parseRentPeriod } from "./leaseAgreementPayability.js";

const DAY_MS = 86_400_000;
const INDIA_OFFSET_MS = 330 * 60_000;

export type LeaseRentInvoice = {
  rentPeriod: string;
  coverageStart: string;
  coverageEnd: string;
  billedDays: number;
  daysInMonth: number;
  amountPaise: number;
  dueDate: string;
};

export function indiaDate(now = new Date()): string {
  return new Date(now.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10);
}

function dateValue(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
    ? time
    : null;
}

export function calculateLeaseRentInvoice(input: {
  rentPeriod: string;
  effectiveDate: string | null;
  endDate: string | null;
  monthlyRentPaise: number | null;
}): LeaseRentInvoice | null {
  const period = parseRentPeriod(input.rentPeriod);
  const start = dateValue(input.effectiveDate);
  const end = dateValue(input.endDate);
  const rent = input.monthlyRentPaise;
  if (
    !period ||
    start === null ||
    end === null ||
    end < start ||
    rent === null ||
    !Number.isSafeInteger(rent) ||
    rent <= 0
  )
    return null;
  const first = Math.max(start, period.start.getTime());
  const last = Math.min(end, period.end.getTime());
  if (first > last) return null;

  const startsMidMonth =
    start === first && first > period.start.getTime();
  // Product rule: a mid-month agreement starting on the 10th is charged for
  // 20 days in a 30-day month. Calendar-start and final partial months remain
  // inclusive, so an agreement ending on the 10th charges 10 days.
  const billedDays =
    Math.round((last - first) / DAY_MS) + (startsMidMonth ? 0 : 1);
  if (billedDays <= 0) return null;
  const daysInMonth = period.end.getUTCDate();
  // Round once at invoice level, in paise; never round the daily rate first.
  const numerator = BigInt(rent) * BigInt(billedDays);
  const amountPaise = Number(
    (numerator * 2n + BigInt(daysInMonth)) / (2n * BigInt(daysInMonth)),
  );
  // A full/calendar-start month is due on the 5th. Mid-month starts get +5 days,
  // even when that date falls in the next calendar month.
  const due =
    first === period.start.getTime() ? first + 4 * DAY_MS : first + 5 * DAY_MS;
  return {
    rentPeriod: input.rentPeriod,
    coverageStart: new Date(first).toISOString().slice(0, 10),
    coverageEnd: new Date(last).toISOString().slice(0, 10),
    billedDays,
    daysInMonth,
    amountPaise,
    dueDate: new Date(due).toISOString().slice(0, 10),
  };
}

export function issuedLeaseRentInvoices(
  input: {
    effectiveDate: string | null;
    endDate: string | null;
    monthlyRentPaise: number | null;
  },
  now = new Date(),
): LeaseRentInvoice[] {
  const start = dateValue(input.effectiveDate);
  const end = dateValue(input.endDate);
  if (start === null || end === null || end < start) return [];
  const today = indiaDate(now);
  const cursor = new Date(start);
  cursor.setUTCDate(1);
  const invoices: LeaseRentInvoice[] = [];
  while (
    cursor.toISOString().slice(0, 10) <= today &&
    cursor.getTime() <= end
  ) {
    const invoice = calculateLeaseRentInvoice({
      ...input,
      rentPeriod: cursor.toISOString().slice(0, 7),
    });
    if (invoice && invoice.coverageStart <= today) invoices.push(invoice);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return invoices;
}
