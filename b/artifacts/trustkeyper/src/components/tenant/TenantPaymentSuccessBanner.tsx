import { CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TenantPaymentSuccessBannerProps {
  message: string;
  loading?: boolean;
  onDownloadReceipt?: () => void;
}

export function TenantPaymentSuccessBanner({
  message,
  loading,
  onDownloadReceipt,
}: TenantPaymentSuccessBannerProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50/50 px-6 py-4 animate-pulse h-[60px]" />
    );
  }

  return (
    <div className="rounded-xl border border-[rgba(0,162,81,0.18)] bg-[rgba(0,162,81,0.09)] px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <CheckCircle2 size={24} className="text-[#00a251] shrink-0" />
        <p className="text-base sm:text-lg font-semibold text-[#4c5357] leading-snug">{message}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="h-auto p-0 text-primary font-normal text-base hover:bg-transparent hover:underline shrink-0 gap-2"
        onClick={onDownloadReceipt}
      >
        <Download size={16} />
        Download Receipt
      </Button>
    </div>
  );
}
