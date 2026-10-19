const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function ordSuffix(n: number): string {
  if (n === 1 || n === 21 || n === 31) return "st";
  if (n === 2 || n === 22) return "nd";
  if (n === 3 || n === 23) return "rd";
  return "th";
}

/** Indian-style number words (Lakh / Crore). Reused logic from web rentalAgreementDocument. */
export function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convert(num: number): string {
    if (num < 20) return ones[num] ?? "";
    if (num < 100) {
      return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    }
    if (num < 1000) {
      return (
        ones[Math.floor(num / 100)] +
        " Hundred" +
        (num % 100 ? " " + convert(num % 100) : "")
      );
    }
    if (num < 100000) {
      return (
        convert(Math.floor(num / 1000)) +
        " Thousand" +
        (num % 1000 ? " " + convert(num % 1000) : "")
      );
    }
    if (num < 10000000) {
      return (
        convert(Math.floor(num / 100000)) +
        " Lakh" +
        (num % 100000 ? " " + convert(num % 100000) : "")
      );
    }
    return (
      convert(Math.floor(num / 10000000)) +
      " Crore" +
      (num % 10000000 ? " " + convert(num % 10000000) : "")
    );
  }

  return convert(n);
}

/**
 * Format YYYY-MM-DD as "15 July 2026" without locale/ICU APIs.
 * Treats the string as a calendar date (no UTC day-shift).
 */
export function formatDateYmd(ymd: string): string {
  if (!ymd) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return ymd;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return ymd;
  const monthName = MONTH_NAMES[month - 1];
  if (!monthName) return ymd;
  return `${day} ${monthName} ${year}`;
}

/** Day-of-month + "Month Year" for the execution preamble. */
export function formatExecutionDayParts(ymd: string): {
  dayLabel: string;
  monthYear: string;
} {
  if (!ymd) return { dayLabel: "-", monthYear: "-" };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return { dayLabel: ymd, monthYear: "-" };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthName = MONTH_NAMES[month - 1];
  if (!monthName || day < 1 || day > 31) {
    return { dayLabel: ymd, monthYear: "-" };
  }
  return {
    dayLabel: `${day}${ordSuffix(day)}`,
    monthYear: `${monthName} ${year}`,
  };
}

/** Format YYYY-MM-DD as "27th June 2026" without locale APIs. */
export function formatDayMonthYearWithSuffix(ymd: string): string {
  if (!ymd) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return ymd;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthName = MONTH_NAMES[month - 1];
  if (!monthName || day < 1 || day > 31) return ymd;
  return `${day}${ordSuffix(day)} ${monthName} ${year}`;
}

/** Explicit Indian grouping (e.g. 12,34,567) — no toLocaleString. */
export function formatIndianGroupedInteger(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  const sign = n < 0 ? "-" : "";
  const s = String(abs);
  if (s.length <= 3) return sign + s;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  return `${sign}${groups.join(",")},${last3}`;
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * INR display for PDF StandardFonts (WinAnsi) — uses "Rs." not the ₹ glyph.
 */
export function formatInrPaise(paise: number): string {
  const rupees = paiseToRupees(paise);
  if (!Number.isFinite(rupees) || rupees === 0) return "-";
  const whole = Math.trunc(rupees);
  return `Rs.${formatIndianGroupedInteger(whole)}/- (RUPEES ${numberToWords(whole).toUpperCase()} ONLY)`;
}

/** Strip/replace characters StandardFonts (WinAnsi) cannot encode. */
export function toWinAnsiSafe(text: string): string {
  const replaced = text
    .replace(/\u20B9/g, "Rs.")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");

  // Helvetica/WinAnsi only covers Latin-1-ish bytes. Emoji, CJK, etc. throw
  // `WinAnsi cannot encode` from pdf-lib on both drawText and widthOfTextAtSize —
  // strip them (do not leave "?") so PDF preview never 500s on broker input.
  let out = "";
  for (const ch of replaced) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x09 || code === 0x0a || code === 0x0d) {
      out += ch;
      continue;
    }
    if (code >= 0x20 && code <= 0x7e) {
      out += ch;
      continue;
    }
    if (code >= 0xa0 && code <= 0xff) {
      out += ch;
      continue;
    }
  }
  return out.replace(/[ \t]{2,}/g, " ").trimEnd();
}
