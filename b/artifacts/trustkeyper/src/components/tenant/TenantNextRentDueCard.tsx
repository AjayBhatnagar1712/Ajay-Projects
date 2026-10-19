import { Link } from "wouter";
import { ArrowRight, Building2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TenantNextRentDueCardProps {
  amountLabel: string;
  dueLabel: string;
  loading?: boolean;
}

export function TenantNextRentDueCard({ amountLabel, dueLabel, loading }: TenantNextRentDueCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm animate-pulse min-h-[280px]">
        <div className="h-8 w-8 bg-gray-100 rounded mb-4" />
        <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
        <div className="h-12 bg-gray-100 rounded w-2/3" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[rgba(195,198,215,0.1)] bg-white p-6 shadow-sm flex flex-col gap-6 h-full">
      <div className="space-y-2">
        <div className="w-8 h-8 text-primary">
          <Building2 size={32} strokeWidth={1.5} />
        </div>
        <p className="text-sm text-[#192839] opacity-70 tracking-wide">NEXT RENT DUE</p>
        <p className="text-[48px] font-bold leading-none text-[#191b23] tracking-tight">{amountLabel}</p>
        <div className="flex items-center gap-2 pt-2 text-[#00a251]">
          <Calendar size={14} className="shrink-0" />
          <p className="text-sm font-medium">{dueLabel}</p>
        </div>
      </div>

      <div className="mt-auto">
        <Button type="button" className="h-12 px-5 rounded text-base font-normal gap-2" asChild>
          <Link href="/tenant/rent">
            Pay Now
            <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    </div>
  );
}
