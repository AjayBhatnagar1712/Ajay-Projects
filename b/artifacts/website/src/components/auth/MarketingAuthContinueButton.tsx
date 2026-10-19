import React from "react";
import { cn } from "@/lib/utils";

export interface MarketingAuthContinueButtonProps {
  disabled: boolean;
  loading?: boolean;
  label?: string;
  loadingLabel?: string;
  onClick: () => void;
}

export function MarketingAuthContinueButton({
  disabled,
  loading = false,
  label = "Continue",
  loadingLabel = "Please wait...",
  onClick,
}: MarketingAuthContinueButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        "mt-6 w-full rounded-lg py-3.5 text-base font-semibold text-white transition-colors",
        disabled || loading
          ? "cursor-not-allowed bg-[#a0aec0]"
          : "bg-marketing-blue hover:bg-marketing-blue-bright",
      )}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
