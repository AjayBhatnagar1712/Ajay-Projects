import type { BrokerPaymentHistoryItem } from "@/lib/api/client";

export type BrokerPaymentMonthGroup = {
  /** Sort key YYYY-MM */
  monthKey: string;
  /** e.g. "August 2026" */
  title: string;
  payments: BrokerPaymentHistoryItem[];
};

function paidAtDate(payment: BrokerPaymentHistoryItem): Date {
  const iso = payment.paidAt ?? payment.createdAt;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return new Date(0);
  return parsed;
}

function monthKeyFromDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = (parts.find((part) => part.type === "month")?.value ?? "00").padStart(
    2,
    "0",
  );
  return `${year}-${month}`;
}

export function formatPaymentMonthTitle(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatPaymentReceivedDate(iso: string | null): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/** Display rupees with Indian grouping, e.g. 2500000 paise → "₹25,000". */
export function formatConsultancyRupees(paise: number): string {
  const rupees = paise / 100;
  const formatted = rupees.toLocaleString("en-IN", {
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  });
  return `₹${formatted}`;
}

export function currentMonthKey(now: Date = new Date()): string {
  return monthKeyFromDate(now);
}

export function thisMonthTotalPaise(
  payments: readonly BrokerPaymentHistoryItem[],
  now: Date = new Date(),
): number {
  const key = currentMonthKey(now);
  let total = 0;
  for (const payment of payments) {
    if (monthKeyFromDate(paidAtDate(payment)) !== key) continue;
    const amount =
      typeof payment.amountPaise === "string"
        ? Number(payment.amountPaise)
        : payment.amountPaise;
    if (Number.isFinite(amount)) total += amount;
  }
  return total;
}

export function groupBrokerPaymentsByMonth(
  payments: readonly BrokerPaymentHistoryItem[],
): BrokerPaymentMonthGroup[] {
  const buckets = new Map<string, BrokerPaymentHistoryItem[]>();
  for (const payment of payments) {
    const key = monthKeyFromDate(paidAtDate(payment));
    const list = buckets.get(key) ?? [];
    list.push(payment);
    buckets.set(key, list);
  }

  const keys = [...buckets.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  return keys.map((monthKey) => ({
    monthKey,
    title: formatPaymentMonthTitle(monthKey),
    payments: buckets.get(monthKey) ?? [],
  }));
}

export function paymentPropertyLabel(
  payment: BrokerPaymentHistoryItem,
): string {
  const trimmed = payment.propertyAddress?.trim();
  if (trimmed && trimmed.length > 0) return trimmed;
  if (payment.agreementId) {
    return `Agreement ${payment.agreementId.slice(0, 8)}`;
  }
  return "Consultancy fee";
}
