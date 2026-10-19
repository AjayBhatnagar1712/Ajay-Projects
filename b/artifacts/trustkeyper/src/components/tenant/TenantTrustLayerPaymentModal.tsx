import { ArrowRight, X } from "lucide-react";
import { useEffect } from "react";
import trustLayerIllustration from "@assets/trustkeyper_no_cut_illustration.png";
import { authPrimaryButtonClass } from "@/components/auth/authStyles";
import { Button } from "@/components/ui/button";
import {
  resolveTenantTrustLayerPaymentModalCopy,
  type TenantAgreementReviewPresentation,
} from "@/lib/tenantAgreementReview";
import { cn } from "@/lib/utils";

export interface TenantTrustLayerPaymentModalProps {
  open: boolean;
  presentation: TenantAgreementReviewPresentation;
  onClose: () => void;
  onProceedWithPayment?: () => void;
  proceeding?: boolean;
}

export function TenantTrustLayerPaymentModal({
  open,
  presentation,
  onClose,
  onProceedWithPayment,
  proceeding = false,
}: TenantTrustLayerPaymentModalProps) {
  const copy = resolveTenantTrustLayerPaymentModalCopy(presentation);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md relative animate-in zoom-in-95 fade-in duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-trust-layer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="px-6 pt-8 pb-6 sm:px-8 sm:pt-10 sm:pb-8 text-center">
          <div className="mx-auto mb-6 flex justify-center">
            <img
              src={trustLayerIllustration}
              alt=""
              className="h-36 w-auto sm:h-40 object-contain"
            />
          </div>

          <h2
            id="tenant-trust-layer-title"
            className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight mb-4"
          >
            {copy.title}
          </h2>

          <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-8 px-1">
            {copy.description}
          </p>

          <Button
            type="button"
            className={cn(authPrimaryButtonClass, "w-full gap-1.5")}
            disabled={proceeding}
            onClick={onProceedWithPayment}
          >
            {copy.ctaLabel}
            <ArrowRight size={16} aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
