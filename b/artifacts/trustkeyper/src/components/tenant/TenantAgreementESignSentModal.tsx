import { Download } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { authPrimaryButtonClass } from "@/components/auth/authStyles";
import { Button } from "@/components/ui/button";
import { resolveTenantAgreementDownloadModalCopy } from "@/lib/tenantAgreementReview";
import { cn } from "@/lib/utils";

export interface TenantAgreementDownloadModalProps {
  open: boolean;
  onDownload: () => Promise<void> | void;
  downloading?: boolean;
}

export function TenantAgreementDownloadModal({
  open,
  onDownload,
  downloading = false,
}: TenantAgreementDownloadModalProps) {
  const [, setLocation] = useLocation();
  const copy = resolveTenantAgreementDownloadModalCopy();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void onDownload();
  }, [open, onDownload]);

  if (!open) return null;

  const handleContinue = () => {
    setLocation("/tenant/dashboard");
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md animate-in zoom-in-95 fade-in duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-agreement-download-title"
      >
        <div className="px-6 pt-8 pb-6 sm:px-8 sm:pt-10 sm:pb-8 text-center">
          <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-[#E8F4FC] text-primary flex items-center justify-center">
            <Download size={24} strokeWidth={2} aria-hidden />
          </div>

          <h2
            id="tenant-agreement-download-title"
            className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight mb-3"
          >
            {copy.title}
          </h2>

          <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-8">
            {copy.description}
          </p>

          <Button
            type="button"
            className={cn(authPrimaryButtonClass, "w-full")}
            disabled={downloading}
            onClick={handleContinue}
          >
            {downloading ? "Preparing download…" : copy.ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use TenantAgreementDownloadModal */
export const TenantAgreementESignSentModal = TenantAgreementDownloadModal;
