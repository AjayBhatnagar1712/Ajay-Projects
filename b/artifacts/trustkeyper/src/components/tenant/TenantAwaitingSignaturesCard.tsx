import { Check, Loader2, Mail } from "lucide-react";
import type { TenantAwaitingSignaturesStatus } from "@/lib/tenantAgreementSignatureStatus";
import { cn } from "@/lib/utils";

export interface TenantAwaitingSignaturesCardProps {
  status: TenantAwaitingSignaturesStatus;
  loading?: boolean;
}

export function TenantAwaitingSignaturesCard({ status, loading }: TenantAwaitingSignaturesCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[#D9EAF8] bg-[#F3F9FE] p-4 h-full animate-pulse">
        <div className="rounded-xl bg-[#FFF4ED] p-5 h-full min-h-[200px]">
          <div className="h-10 w-10 rounded-xl bg-orange-100 mb-4" />
          <div className="h-5 bg-orange-100 rounded w-2/3 mb-2" />
          <div className="h-4 bg-orange-50 rounded w-full mb-6" />
          <div className="space-y-3">
            <div className="h-8 bg-white/70 rounded-lg" />
            <div className="h-8 bg-white/70 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#D9EAF8] bg-[#F3F9FE] p-4 h-full">
      <div className="rounded-xl bg-[#FFF4ED] border border-orange-100 p-5 sm:p-6 h-full flex flex-col shadow-sm">
        <div className="flex items-start gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-500 flex items-center justify-center shrink-0">
            <Mail size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-orange-600 leading-tight">
              {status.title}
            </h3>
            <p className="text-sm text-gray-600 mt-1">{status.description}</p>
          </div>
        </div>

        <div className="mt-4 space-y-4 flex-1">
          {status.groups.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.parties.map((party) => (
                  <div
                    key={party.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/80 border border-orange-100/80 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {party.phoneDisplay}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 flex items-center justify-center w-7 h-7 rounded-full",
                        party.signed ? "text-green-600" : "text-primary",
                      )}
                      aria-label={party.signed ? "Signed" : "Awaiting signature"}
                    >
                      {party.signed ? (
                        <Check size={18} strokeWidth={2.5} />
                      ) : (
                        <Loader2 size={18} className="animate-spin" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
