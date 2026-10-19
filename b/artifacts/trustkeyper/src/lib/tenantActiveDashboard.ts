import type { TenantWorkspaceRecord } from "./tenantWorkspace";
import { formatTenantRent } from "./tenantWorkspace";

export type TenantActiveMaintenancePreview = {
  id: string;
  title: string;
  status: "Pending" | "Issue Solved";
  reportedAt: number;
};

export type TenantActiveDashboardSnapshot = {
  paymentSuccessMessage: string;
  propertyTitle: string;
  propertySubtitle: string;
  leaseMonthLabel: string;
  leaseProgressPercent: number;
  leaseStartLabel: string;
  leaseEndLabel: string;
  nextRentAmountLabel: string;
  nextRentDueLabel: string;
};

const ACTIVE_TENANT_STAGES = ["move_in_scheduled", "active_tenant"] as const;

export type ActiveTenantDashboardStage = (typeof ACTIVE_TENANT_STAGES)[number];

export function isActiveTenantDashboardStage(stage: string): stage is ActiveTenantDashboardStage {
  return ACTIVE_TENANT_STAGES.includes(stage as ActiveTenantDashboardStage);
}

function formatLeaseDate(value?: string): string {
  if (!value?.trim()) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseLockInMonths(lockInPeriod?: string): number {
  if (!lockInPeriod) return 11;
  const match = lockInPeriod.match(/(\d+)/);
  if (!match) return 11;
  const months = Number(match[1]);
  return Number.isFinite(months) && months > 0 ? months : 11;
}

function computeLeaseProgress(
  leaseStart?: string,
  leaseEnd?: string,
  lockInPeriod?: string,
): { monthLabel: string; percent: number } {
  const totalMonths = parseLockInMonths(lockInPeriod);
  const start = leaseStart ? new Date(leaseStart) : null;
  const end = leaseEnd ? new Date(leaseEnd) : null;
  const now = new Date();

  if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
    return { monthLabel: `Month 0 of ${totalMonths}`, percent: 2 };
  }

  const elapsedMs = Math.max(0, now.getTime() - start.getTime());
  const totalMs = Math.max(1, end.getTime() - start.getTime());
  const rawPercent = Math.round((elapsedMs / totalMs) * 100);
  const percent = Math.min(100, Math.max(2, rawPercent));
  const monthsElapsed = Math.min(
    totalMonths,
    Math.max(0, Math.floor(elapsedMs / (30 * 24 * 60 * 60 * 1000))),
  );

  return {
    monthLabel: `Month ${monthsElapsed} of ${totalMonths}`,
    percent,
  };
}

function formatNextRentDue(leaseStart?: string, rentDueDay?: string): string {
  const dueDay = rentDueDay ? Number(rentDueDay) : 1;
  const base = leaseStart ? new Date(leaseStart) : new Date();
  const nextDue = new Date(base);
  nextDue.setMonth(nextDue.getMonth() + 1);
  if (Number.isFinite(dueDay) && dueDay >= 1 && dueDay <= 28) {
    nextDue.setDate(dueDay);
  }
  if (Number.isNaN(nextDue.getTime())) {
    return "Due on —";
  }
  return `Due on ${nextDue.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

function resolvePaymentSuccessMessage(workspace: TenantWorkspaceRecord | null): string {
  const depositPaid =
    workspace?.preSigningEscrowType === "security_deposit" ||
    workspace?.escrowPaymentStatus === "paid" ||
    workspace?.escrowPaymentStatus === "settled";

  if (depositPaid) {
    return "Your rent and security deposit have been successfully paid!!";
  }
  return "Your first month's rent has been successfully paid!!";
}

function formatRentAmountLabel(monthlyRent?: string): string {
  if (!monthlyRent) return "—";
  const amount = Number(monthlyRent);
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function buildActiveTenantDashboardSnapshot(
  workspace: TenantWorkspaceRecord | null,
): TenantActiveDashboardSnapshot {
  const snapshot = workspace?.agreementSnapshot;
  const leaseStart = snapshot?.leaseStartDate;
  const leaseEnd = snapshot?.leaseEndDate;
  const { monthLabel, percent } = computeLeaseProgress(
    leaseStart,
    leaseEnd,
    snapshot?.lockInPeriod,
  );

  return {
    paymentSuccessMessage: resolvePaymentSuccessMessage(workspace),
    propertyTitle:
      workspace?.propertyAddress ??
      workspace?.propertyLabel ??
      "Flat 401, Ayyappa Society, Madhapur, Hyderabad",
    propertySubtitle: workspace?.propertyType ?? "Single Room in 3 BHK Apartment",
    leaseMonthLabel: monthLabel,
    leaseProgressPercent: percent,
    leaseStartLabel: formatLeaseDate(leaseStart),
    leaseEndLabel: formatLeaseDate(leaseEnd),
    nextRentAmountLabel: formatRentAmountLabel(workspace?.monthlyRent ?? snapshot?.monthlyRent),
    nextRentDueLabel: formatNextRentDue(leaseStart, snapshot?.rentDueDay),
  };
}
