import { X } from "lucide-react";
import { useEffect } from "react";
import type { TenantRentPaymentReceipt } from "@/lib/tenantRentPayments";

export interface TenantRentPaymentReceiptModalProps {
  open: boolean;
  receipt: TenantRentPaymentReceipt | null;
  onClose: () => void;
}

type ReceiptDetailRowProps = {
  label: string;
  value: string;
};

function ReceiptDetailRow({ label, value }: ReceiptDetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 w-full text-xs leading-[18px]">
      <span className="text-black/32 uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-[#161b3d] text-right">{value}</span>
    </div>
  );
}

export function TenantRentPaymentReceiptModal({
  open,
  receipt,
  onClose,
}: TenantRentPaymentReceiptModalProps) {
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
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open || !receipt) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg border-b-2 border-[#00a251] shadow-xl w-full max-w-[463px] animate-in zoom-in-95 fade-in duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-rent-receipt-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 pt-6 pb-4">
          <div className="flex justify-end mb-1">
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center text-[#192839] hover:text-primary transition-colors"
              aria-label="Close receipt"
            >
              <X size={20} />
            </button>
          </div>

          <h2
            id="tenant-rent-receipt-title"
            className="text-base font-semibold text-[#192839] text-center leading-6 mb-4"
          >
            Payment Receipt
          </h2>

          <div className="h-px bg-[#d8e3ff] w-full max-w-[339px] mx-auto mb-4" />

          <div className="text-center mb-6">
            <p className="text-xs text-[#6b7280] leading-4 mb-1">Amount Paid</p>
            <p className="text-base font-semibold text-[#192839] leading-6">{receipt.amountPaidLabel}</p>
          </div>

          <div className="flex flex-col gap-1 mb-4">
            <ReceiptDetailRow label="Month" value={receipt.monthLabel} />
            <ReceiptDetailRow label="Paid On" value={receipt.paidOnLabel} />
            <ReceiptDetailRow label="Payment Mode" value={receipt.paymentMode} />
            <ReceiptDetailRow label="Transaction ID" value={receipt.transactionId} />
          </div>

          <div className="border-t border-[#cbd5e2] pt-4 flex flex-col gap-1">
            <ReceiptDetailRow label="From" value={receipt.fromLabel} />
            <ReceiptDetailRow label="To" value={receipt.toLabel} />
            <ReceiptDetailRow label="Property" value={receipt.propertyLabel} />
          </div>
        </div>
      </div>
    </div>
  );
}
