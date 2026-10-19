import { ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { TenantAgreementDocumentPreview } from "@/components/tenant/TenantAgreementDocumentPreview";
import { TenantAgreementReviewActionCard } from "@/components/tenant/TenantAgreementReviewActionCard";
import type {
  TenantAgreementPreviewData,
  TenantAgreementReviewPresentation,
} from "@/lib/tenantAgreementReview";

export interface TenantAgreementReviewViewProps {
  agreement: TenantAgreementPreviewData;
  presentation: TenantAgreementReviewPresentation;
  onProceed?: () => void;
  proceeding?: boolean;
}

export function TenantAgreementReviewView({
  agreement,
  presentation,
  onProceed,
  proceeding,
}: TenantAgreementReviewViewProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="relative pt-1">
        <Link
          href="/tenant/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-primary transition-colors"
        >
          <ChevronLeft size={18} aria-hidden />
          Back to Dashboard
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 text-center mt-4 sm:mt-2">
          Review Agreement
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-start">
        <div className="lg:col-span-2 order-1">
          <TenantAgreementDocumentPreview agreement={agreement} />
        </div>
        <div className="lg:col-span-1 order-2">
          <TenantAgreementReviewActionCard
            presentation={presentation}
            onProceed={onProceed}
            proceeding={proceeding}
          />
        </div>
      </div>
    </div>
  );
}
