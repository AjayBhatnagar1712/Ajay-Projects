const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RENT_PERIOD = /^\d{4}-\d{2}$/;

function parseIsoDate(value: string | null): Date | null {
  if (value === null || !ISO_DATE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

export function parseRentPeriod(value: string): { start: Date; end: Date } | null {
  if (!RENT_PERIOD.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)),
    end: new Date(Date.UTC(year, month, 0, 12, 0, 0)),
  };
}

export function rentPeriodOverlapsAgreement(
  rentPeriod: string,
  effectiveDate: string | null,
  endDate: string | null,
): boolean {
  const period = parseRentPeriod(rentPeriod);
  const agreementStart = parseIsoDate(effectiveDate);
  const agreementEnd = parseIsoDate(endDate);
  if (!period || !agreementStart || !agreementEnd || agreementEnd.getTime() < agreementStart.getTime()) {
    return false;
  }
  return period.end.getTime() >= agreementStart.getTime() && period.start.getTime() <= agreementEnd.getTime();
}
