import React from "react";
import { MarketingAuthTrigger } from "@/components/auth/MarketingAuthTrigger";
import { MARKETING_CTA } from "@/lib/marketingConstants";
import { cn } from "@/lib/utils";

export interface MarketingCtaButtonProps {
  href?: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
  className?: string;
  /** Opens the login/signup modal instead of navigating. */
  opensAuthModal?: boolean;
}

export function MarketingCtaButton({
  href = MARKETING_CTA.signupLogin,
  children,
  variant = "primary",
  className,
  opensAuthModal = false,
}: MarketingCtaButtonProps) {
  const styles = cn(
    "inline-flex items-center justify-center rounded px-5 py-3 text-sm font-semibold transition-colors sm:text-base",
    variant === "primary" &&
      "bg-marketing-blue text-white hover:bg-marketing-blue-bright",
    variant === "outline" &&
      "border border-marketing-border bg-white text-marketing-navy hover:border-marketing-muted/40 hover:bg-marketing-muted-bg",
    className,
  );

  if (opensAuthModal) {
    return (
      <MarketingAuthTrigger className={styles}>{children}</MarketingAuthTrigger>
    );
  }

  return (
    <a href={href} className={styles}>
      {children}
    </a>
  );
}

export { MARKETING_CTA };
