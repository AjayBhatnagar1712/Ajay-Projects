import { Link } from "wouter";
import { Building2, Phone, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TenantWorkspaceRecord } from "@/lib/tenantWorkspace";

export interface TenantActivePropertyLeaseCardProps {
  workspace: TenantWorkspaceRecord | null;
  propertyTitle: string;
  propertySubtitle: string;
  leaseMonthLabel: string;
  leaseProgressPercent: number;
  leaseStartLabel: string;
  leaseEndLabel: string;
  loading?: boolean;
  errorMessage?: string;
}

export function TenantActivePropertyLeaseCard({
  workspace,
  propertyTitle,
  propertySubtitle,
  leaseMonthLabel,
  leaseProgressPercent,
  leaseStartLabel,
  leaseEndLabel,
  loading,
  errorMessage,
}: TenantActivePropertyLeaseCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-6 animate-pulse min-h-[320px]">
        <div className="flex gap-3 mb-6">
          <div className="w-20 h-20 rounded-xl bg-gray-100 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-gray-100 rounded w-3/4" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
        <div className="h-2 bg-gray-100 rounded-full w-full" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm text-amber-800">{errorMessage}</p>
      </div>
    );
  }

  const progress = Math.min(100, Math.max(0, leaseProgressPercent));

  return (
    <div className="rounded-xl bg-white p-6 flex flex-col gap-6 h-full">
      <div className="flex gap-3 items-start">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0">
          {workspace?.propertyImage ? (
            <img src={workspace.propertyImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#E8F4FC] to-[#D4EBE4]">
              <Building2 size={28} className="text-primary/35" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-[#14181f] leading-6">{propertyTitle}</p>
          <p className="text-sm text-[#6b7280] tracking-wide mt-1">{propertySubtitle}</p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-end justify-between gap-3">
          <p className="text-sm text-[#191b23] tracking-wide">Lease Validity</p>
          <p className="text-sm text-[#004ac6] tracking-wide">{leaseMonthLabel}</p>
        </div>

        <div className="relative pt-6 pb-8">
          <div className="h-2 w-full rounded-full bg-[#cbd5e2] overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div
            className="absolute top-0 flex items-center justify-center w-[42px] h-[42px] rounded-full bg-white border border-primary/20 shadow-sm -translate-x-1/2"
            style={{ left: `${progress}%` }}
          >
            <span className="text-xs font-semibold text-primary">{progress}%</span>
          </div>
          <div className="flex items-center justify-between text-sm text-[#768ea7] tracking-wide mt-2">
            <span>{leaseStartLabel}</span>
            <span>{leaseEndLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-12 px-5 rounded border-primary text-primary text-base font-normal hover:bg-primary/5"
          asChild
        >
          <Link href="/tenant/contact">
            <Phone size={16} />
            Contact Owner
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 px-5 rounded border-primary text-primary text-base font-normal hover:bg-primary/5"
          asChild
        >
          <Link href="/tenant/maintenance">
            <Wrench size={16} />
            Raise Complaint
          </Link>
        </Button>
      </div>
    </div>
  );
}
