import { Link } from "wouter";
import { ChevronRight, UserCircle } from "lucide-react";
import {
  formatTenantKycStatusLabel,
  getTenantAccountProfile,
  tenantProfileCompletionPercent,
} from "@/lib/tenantProfile";
import { TenantKycStatusBadge } from "@/components/tenant/TenantKycStatusBadge";
import { cn } from "@/lib/utils";

export function TenantDashboardProfileCard({ loading }: { loading?: boolean }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 animate-pulse">
        <div className="h-10 w-10 rounded-xl bg-gray-100 mb-4" />
        <div className="h-5 bg-gray-100 rounded w-1/2 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-full" />
      </div>
    );
  }

  const profile = getTenantAccountProfile();
  const completion = tenantProfileCompletionPercent(profile);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <UserCircle size={20} />
        </div>
        <TenantKycStatusBadge status={profile.overallKycStatus} />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">Your Profile</h3>
      <p className="text-sm text-gray-600 leading-relaxed mb-4">
        KYC status: {formatTenantKycStatusLabel(profile.overallKycStatus)}. Uploaded documents and bank
        details are saved to your profile automatically.
      </p>
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Profile completion</span>
          <span>{completion}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn("h-full rounded-full bg-primary transition-all")}
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>
      <Link
        href="/tenant/profile"
        className="mt-auto inline-flex items-center justify-center gap-1 h-9 px-4 rounded-lg border border-primary text-primary text-sm font-semibold hover:bg-primary/5 transition-colors"
      >
        View Profile <ChevronRight size={14} />
      </Link>
    </div>
  );
}
