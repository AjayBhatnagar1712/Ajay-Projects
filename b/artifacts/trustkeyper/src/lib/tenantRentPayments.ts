import { formatPaiseToInr } from "./formatMoney";
import type { TenantPaymentRow } from "./tenantRentPayment";
import type { TenantWorkspaceRecord } from "./tenantWorkspace";

export { formatPaiseToInr };

export type TenantRentPaymentHistoryRow = {
  id: string;
  monthLabel: string;
  amountLabel: string;
  paidOnLabel: string;
  paymentMode: string;
  statusLabel: string;
};

export type TenantRentPaymentReceipt = {
  amountPaidLabel: string;
  monthLabel: string;
  paidOnLabel: string;
  paymentMode: string;
  transactionId: string;
  fromLabel: string;
  toLabel: string;
  propertyLabel: string;
};

export type TenantRentPaymentsSnapshot = {
  statusLabel: string;
  dueByLabel: string;
  currentDueDateLabel: string;
  minimumExtensionDate: string;
  monthlyRentAmountLabel: string;
};

function parseAmount(value?: string): number {
  if (!value) return 0;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function formatDueByLabel(rentDueDay?: string): string {
  return `Due by ${formatCurrentDueDateLabel(rentDueDay)}`;
}

export function computeCurrentRentDueDate(rentDueDay?: string): Date {
  const dueDay = rentDueDay ? Number(rentDueDay) : 5;
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + 1);
  if (Number.isFinite(dueDay) && dueDay >= 1 && dueDay <= 28) {
    dueDate.setDate(dueDay);
  }
  dueDate.setHours(0, 0, 0, 0);
  return dueDate;
}

export function formatCurrentDueDateLabel(rentDueDay?: string): string {
  return computeCurrentRentDueDate(rentDueDay).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function computeDaysLeft(rentDueDay?: string): number {
  const dueDate = computeCurrentRentDueDate(rentDueDay);
  const diffMs = dueDate.getTime() - Date.now();
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function minimumExtensionDateInput(rentDueDay?: string): string {
  const nextDay = computeCurrentRentDueDate(rentDueDay);
  nextDay.setDate(nextDay.getDate() + 1);
  return formatDateInputValue(nextDay);
}

/** Format rent period "2026-07" → "Jul 2026". */
export function formatRentPeriodLabel(rentPeriod: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(rentPeriod.trim());
  if (!match) return rentPeriod || "—";
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return rentPeriod;
  const label = new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  return label;
}

export function formatPaymentMethodLabel(method: string | null): string {
  if (!method) return "—";
  const normalized = method.trim().toLowerCase();
  if (normalized === "upi") return "UPI";
  if (normalized === "card") return "Card";
  if (normalized === "netbanking") return "Net Banking";
  if (normalized === "wallet") return "Wallet";
  return method;
}

export function formatPaidAtLabel(paidAt: string | null): string {
  if (!paidAt) return "—";
  const date = new Date(paidAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatStatusLabel(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "paid") return "Paid";
  if (normalized === "settled") return "Settled";
  if (normalized === "created") return "Pending";
  if (normalized === "failed") return "Failed";
  return status || "—";
}

export function mapTenantPaymentRowToHistoryRow(
  row: TenantPaymentRow,
): TenantRentPaymentHistoryRow {
  return {
    id: row.id,
    monthLabel: formatRentPeriodLabel(row.rentPeriod),
    amountLabel: formatPaiseToInr(row.amountPaise),
    paidOnLabel: formatPaidAtLabel(row.paidAt),
    paymentMode: formatPaymentMethodLabel(row.paymentMethod),
    statusLabel: formatStatusLabel(row.status),
  };
}

/**
 * Statement card snapshot from workspace monthly rent only — no mock breakdown/history.
 */
export function buildTenantRentPaymentsSnapshot(
  workspace: TenantWorkspaceRecord | null,
): TenantRentPaymentsSnapshot {
  const monthlyRentRupees = parseAmount(
    workspace?.monthlyRent ?? workspace?.agreementSnapshot?.monthlyRent,
  );
  const monthlyRentPaise = Math.round(monthlyRentRupees * 100);
  const daysLeft = computeDaysLeft(workspace?.agreementSnapshot?.rentDueDay);
  const rentDueDay = workspace?.agreementSnapshot?.rentDueDay;

  return {
    statusLabel: `Pending (${daysLeft} days left)`,
    dueByLabel: formatDueByLabel(rentDueDay),
    currentDueDateLabel: formatCurrentDueDateLabel(rentDueDay),
    minimumExtensionDate: minimumExtensionDateInput(rentDueDay),
    monthlyRentAmountLabel: formatPaiseToInr(monthlyRentPaise),
  };
}

function buildTransactionId(rowId: string): string {
  const suffix = rowId.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();
  return `TXN22026${suffix.padStart(5, "0").slice(0, 5)}`;
}

export function buildTenantRentPaymentReceipt(
  workspace: TenantWorkspaceRecord | null,
  row: TenantRentPaymentHistoryRow,
): TenantRentPaymentReceipt {
  const tenantName =
    workspace?.tenantName?.trim() ||
    workspace?.agreementSnapshot?.tenantName?.trim() ||
    "Tenant";
  const ownerName =
    workspace?.ownerName?.trim() ||
    workspace?.agreementSnapshot?.ownerName?.trim() ||
    "Property Owner";
  const propertyLabel =
    workspace?.propertyLabel?.trim() ||
    workspace?.agreementSnapshot?.propertyAddress?.trim() ||
    "Assigned Property";

  return {
    amountPaidLabel: row.amountLabel,
    monthLabel: row.monthLabel,
    paidOnLabel: row.paidOnLabel,
    paymentMode: row.paymentMode,
    transactionId: buildTransactionId(row.id),
    fromLabel: tenantName,
    toLabel: ownerName,
    propertyLabel,
  };
}

export function findRentPaymentHistoryRow(
  rows: TenantRentPaymentHistoryRow[],
  rowId: string,
): TenantRentPaymentHistoryRow | undefined {
  return rows.find((row) => row.id === rowId);
}
