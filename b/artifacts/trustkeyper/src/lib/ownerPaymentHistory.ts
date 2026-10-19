import { getApiBase } from "@/lib/apiBase";
import { getActiveSession, normalizePhoneDigits } from "./storageKeys";
import { syncAuthHeaders } from "./syncSession";

/** API row from GET /api/payments-owner-history (paise fields are bigint strings). */
export type OwnerPaymentRow = {
  id: string;
  rentPeriod: string;
  amountPaise: string;
  ownerSettlementPaise: string;
  commissionPaise: string;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
  transferFailedAt: string | null;
};

export type FetchOwnerPaymentHistoryResult =
  | { ok: true; payments: OwnerPaymentRow[] }
  | { ok: false; error: string };

export type OwnerPaymentSummary = {
  thisMonthPaise: number;
  allTimePaise: number;
};

function resolveOwnerPhone(): string | null {
  const session = getActiveSession();
  if (!session || session.role !== "owner") return null;
  const digits = normalizePhoneDigits(session.phone);
  return digits.length === 10 ? digits : null;
}

function coercePaise(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "0";
}

function isSettledStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "paid" || normalized === "settled";
}

/** Current calendar month as YYYY-MM (local). */
export function computeCurrentRentPeriod(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Sum ownerSettlementPaise for paid/settled rows.
 * thisMonth uses rentPeriod === current YYYY-MM.
 */
export function summarizeOwnerSettlements(
  payments: OwnerPaymentRow[],
  now: Date = new Date(),
): OwnerPaymentSummary {
  const thisMonthPeriod = computeCurrentRentPeriod(now);
  let thisMonthPaise = 0;
  let allTimePaise = 0;

  for (const row of payments) {
    if (!isSettledStatus(row.status)) continue;
    const paise = Math.round(Number(row.ownerSettlementPaise));
    if (!Number.isFinite(paise)) continue;
    allTimePaise += paise;
    if (row.rentPeriod === thisMonthPeriod) {
      thisMonthPaise += paise;
    }
  }

  return { thisMonthPaise, allTimePaise };
}

export async function fetchOwnerPaymentHistory(
  phone?: string,
): Promise<FetchOwnerPaymentHistoryResult> {
  const digits = normalizePhoneDigits(phone ?? resolveOwnerPhone() ?? "");
  if (digits.length !== 10) return { ok: false, error: "Owner session required" };

  try {
    const headers = await syncAuthHeaders();
    if (!headers) return { ok: false, error: "Not authenticated" };

    const res = await fetch(
      `${getApiBase()}/payments-owner-history?phone=${encodeURIComponent(digits)}`,
      { method: "GET", headers },
    );

    const json = (await res.json()) as {
      payments?: Array<{
        id?: string;
        rentPeriod?: string | null;
        amountPaise?: string | number;
        ownerSettlementPaise?: string | number | null;
        commissionPaise?: string | number;
        status?: string;
        paymentMethod?: string | null;
        paidAt?: string | null;
        createdAt?: string;
        transferFailedAt?: string | null;
      }>;
      error?: string;
    };

    if (!res.ok) {
      return { ok: false, error: json.error ?? "Could not load payment history" };
    }

    const payments: OwnerPaymentRow[] = (json.payments ?? [])
      .filter(
        (row): row is {
          id: string;
          rentPeriod?: string | null;
          amountPaise?: string | number;
          ownerSettlementPaise?: string | number | null;
          commissionPaise?: string | number;
          status: string;
          paymentMethod?: string | null;
          paidAt?: string | null;
          createdAt: string;
          transferFailedAt?: string | null;
        } =>
          typeof row.id === "string" &&
          typeof row.status === "string" &&
          typeof row.createdAt === "string",
      )
      .map((row) => ({
        id: row.id,
        rentPeriod: typeof row.rentPeriod === "string" ? row.rentPeriod : "",
        amountPaise: coercePaise(row.amountPaise),
        ownerSettlementPaise: coercePaise(row.ownerSettlementPaise),
        commissionPaise: coercePaise(row.commissionPaise),
        status: row.status,
        paymentMethod: row.paymentMethod ?? null,
        paidAt: row.paidAt ?? null,
        createdAt: row.createdAt,
        transferFailedAt: row.transferFailedAt ?? null,
      }));

    return { ok: true, payments };
  } catch {
    return { ok: false, error: "Network error while loading payment history" };
  }
}
