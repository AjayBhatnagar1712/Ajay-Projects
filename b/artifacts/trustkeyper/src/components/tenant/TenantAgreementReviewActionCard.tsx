import { ArrowRight, FileText, Info } from "lucide-react";
import { authPrimaryButtonClass } from "@/components/auth/authStyles";
import { Button } from "@/components/ui/button";
import type { TenantAgreementReviewPresentation } from "@/lib/tenantAgreementReview";
import { cn } from "@/lib/utils";

export interface TenantAgreementReviewActionCardProps {
  presentation: TenantAgreementReviewPresentation;
  onProceed?: () => void;
  proceeding?: boolean;
}

export function TenantAgreementReviewActionCard({
  presentation,
  onProceed,
  proceeding = false,
}: TenantAgreementReviewActionCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6 h-fit lg:sticky lg:top-24">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <FileText size={20} />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Review Complete?</h2>
          <p className="text-sm text-gray-500 mt-1">
            Please read the agreement carefully before proceeding.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 mb-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-700">{presentation.feeLabel}</span>
          <span className="text-base font-bold text-gray-900">{presentation.feeAmount}</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">{presentation.feeCaption}</p>
      </div>

      <div className="rounded-xl border border-[#D9EAF8] bg-[#F3F9FE] px-4 py-3 flex gap-3 mb-5">
        <Info size={18} className="text-primary shrink-0 mt-0.5" aria-hidden />
        <p className="text-sm text-gray-700 leading-relaxed">
          <span className="font-semibold text-gray-900">Next step: </span>
          {presentation.nextStepMessage}
        </p>
      </div>

      <Button
        type="button"
        className={cn(authPrimaryButtonClass, "w-full gap-1.5")}
        disabled={proceeding}
        onClick={onProceed}
      >
        {presentation.ctaLabel}
        <ArrowRight size={16} aria-hidden />
      </Button>
    </div>
  );
}
