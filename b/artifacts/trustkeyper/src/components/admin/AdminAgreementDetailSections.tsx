/**
 * Full agreement detail sections for the admin signing view — property, terms,
 * party KYC, and inventory. Render-only; data comes from authenticated admin GET.
 */
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminLeaseAgreementDetail, AdminLeaseAgreementParty } from "@/lib/adminApi";
import { formatPaiseToInr } from "@/lib/formatMoney";
import { cn } from "@/lib/utils";

type AdminAgreementDetailSectionsProps = {
  agreement: AdminLeaseAgreementDetail;
};

function formatCalendarDate(value: string | null): string {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "—";
  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "—";
  return new Date(timestamp).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDurationMonths(value: number | null): string {
  if (value === null || value <= 0) return "—";
  return value === 1 ? "1 month" : `${value} months`;
}

function formatNoticeMonths(value: number | null, label: string): string {
  if (value === null || value <= 0) return "—";
  return value === 1 ? `${value} month (${label})` : `${value} months (${label})`;
}

function partyRoleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "tenant") return "Tenant";
  return role;
}

function partyApprovalLabel(status: string): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "changes_requested":
      return "Changes requested";
    case "withdrawn":
      return "Withdrawn";
    default:
      return "Pending";
  }
}

function partyApprovalBadgeClass(status: string): string {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "changes_requested":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "withdrawn":
      return "border-gray-200 bg-gray-50 text-gray-600";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function maintenanceLabel(agreement: AdminLeaseAgreementDetail): string {
  if (agreement.maintenanceIncluded) return "Included in rent";
  if (agreement.monthlyMaintenancePaise !== null && agreement.monthlyMaintenancePaise > 0) {
    return `${formatPaiseToInr(agreement.monthlyMaintenancePaise)}/mo (separate)`;
  }
  return "Not included";
}

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,11rem)_1fr]">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 break-words">{value}</dd>
    </div>
  );
}

function PartySection({ party }: { party: AdminLeaseAgreementParty }) {
  const displayName = [party.title?.trim(), party.name].filter(Boolean).join(" ");
  return (
    <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{displayName || party.name}</p>
          <p className="text-xs text-gray-500">
            {partyRoleLabel(party.role)}
            {party.isPrimary ? " · Primary" : ""}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn("font-normal", partyApprovalBadgeClass(party.approvalStatus))}
        >
          {partyApprovalLabel(party.approvalStatus)}
        </Badge>
      </div>
      <dl className="space-y-2">
        <DetailRow label="Age" value={party.age !== null ? String(party.age) : "—"} />
        <DetailRow label="Address" value={party.address?.trim() || "—"} />
        <DetailRow label="Phone" value={party.phone?.trim() || "—"} />
        <DetailRow label="Email" value={party.email?.trim() || "—"} />
        <DetailRow label="Aadhaar" value={party.aadhaar?.trim() || "—"} />
        <DetailRow label="PAN" value={party.pan?.trim() || "—"} />
        <DetailRow label="Reviewed at" value={formatDateTime(party.reviewedAt)} />
        {party.reviewComment?.trim() ? (
          <DetailRow label="Review comment" value={party.reviewComment.trim()} />
        ) : null}
      </dl>
    </div>
  );
}

export function AdminAgreementDetailSections({ agreement }: AdminAgreementDetailSectionsProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold text-gray-900">Property</h3>
          <dl className="space-y-3">
            <DetailRow label="Address" value={agreement.propertyAddress?.trim() || "—"} />
            <DetailRow
              label="Area"
              value={
                agreement.areaSqft !== null && agreement.areaSqft > 0
                  ? `${agreement.areaSqft.toLocaleString("en-IN")} sq ft`
                  : "—"
              }
            />
            <DetailRow label="Facing" value={agreement.facing?.trim() || "—"} />
            <DetailRow
              label="Car parking"
              value={
                agreement.carParkingCount !== null && agreement.carParkingCount >= 0
                  ? String(agreement.carParkingCount)
                  : "—"
              }
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold text-gray-900">Terms</h3>
          <dl className="space-y-3">
            <DetailRow label="Execution date" value={formatCalendarDate(agreement.executionDate)} />
            <DetailRow label="Start date" value={formatCalendarDate(agreement.effectiveDate)} />
            <DetailRow label="End date" value={formatCalendarDate(agreement.endDate)} />
            <DetailRow label="Duration" value={formatDurationMonths(agreement.durationMonths)} />
            <DetailRow label="Min stay" value={formatDurationMonths(agreement.minStayMonths)} />
            <DetailRow
              label="Execution city"
              value={agreement.executionCity?.trim() || "—"}
            />
            <DetailRow
              label="Monthly rent"
              value={
                agreement.monthlyRentPaise !== null
                  ? formatPaiseToInr(agreement.monthlyRentPaise)
                  : "—"
              }
            />
            <DetailRow
              label="Security deposit"
              value={
                agreement.securityDepositPaise !== null
                  ? formatPaiseToInr(agreement.securityDepositPaise)
                  : "—"
              }
            />
            <DetailRow label="Maintenance" value={maintenanceLabel(agreement)} />
            <DetailRow
              label="Rent due day"
              value={
                agreement.rentDueDay !== null && agreement.rentDueDay > 0
                  ? `${agreement.rentDueDay}${ordinalSuffix(agreement.rentDueDay)} of month`
                  : "—"
              }
            />
            <DetailRow
              label="Tenant notice"
              value={formatNoticeMonths(
                agreement.noticePeriodLicenseeMonths,
                "licensee",
              )}
            />
            <DetailRow
              label="Owner notice"
              value={formatNoticeMonths(
                agreement.noticePeriodLicensorMonths,
                "licensor",
              )}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold text-gray-900">Parties</h3>
          {agreement.parties.length === 0 ? (
            <p className="text-sm text-gray-500">No parties on this agreement.</p>
          ) : (
            <div className="space-y-4">
              {agreement.parties.map((party) => (
                <PartySection key={party.id} party={party} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold text-gray-900">Inventory</h3>
          {agreement.inventory.length === 0 ? (
            <p className="text-sm text-gray-500">No inventory items listed.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {agreement.inventory.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-gray-900">{item.description}</span>
                  <span className="text-gray-500">Qty {item.quantity}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
