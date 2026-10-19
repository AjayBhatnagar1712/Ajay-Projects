import React from "react";
import { useMarketingAuthModal } from "@/components/auth/MarketingAuthModalContext";
import { cn } from "@/lib/utils";

export interface MarketingAuthTriggerProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/** Opens the marketing login/signup modal without navigation. */
export function MarketingAuthTrigger({ children, className, onClick }: MarketingAuthTriggerProps) {
  const { openAuthModal } = useMarketingAuthModal();

  return (
    <button
      type="button"
      className={cn(className)}
      onClick={() => {
        onClick?.();
        openAuthModal();
      }}
    >
      {children}
    </button>
  );
}
