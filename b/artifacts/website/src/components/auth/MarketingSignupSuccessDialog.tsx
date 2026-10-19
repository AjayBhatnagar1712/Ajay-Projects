import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MarketingSignupSuccessDialogProps {
  open: boolean;
  onContinue: () => void;
}

export function MarketingSignupSuccessDialog({ open, onContinue }: MarketingSignupSuccessDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#2b2b2b]/50 px-6"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketing-signup-success-title"
        className="w-full max-w-[320px] rounded-2xl bg-white px-6 py-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.2)]"
      >
        <div
          className={cn(
            "mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full",
            "bg-[#e8f7f1] text-marketing-green",
          )}
          aria-hidden
        >
          <Check size={32} strokeWidth={2.5} />
        </div>
        <h2
          id="marketing-signup-success-title"
          className="text-xl font-semibold text-marketing-navy"
        >
          Successfully Verified!
        </h2>
        <p className="mt-2 text-sm text-marketing-muted">Your details have been saved.</p>
        <button
          type="button"
          onClick={onContinue}
          className="mt-6 w-full rounded-lg bg-marketing-blue py-3.5 text-base font-semibold text-white transition-colors hover:bg-marketing-blue-bright"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
