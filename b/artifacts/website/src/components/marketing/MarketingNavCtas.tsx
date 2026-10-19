import React from "react";
import { Link } from "wouter";
import { MarketingAuthTrigger } from "@/components/auth/MarketingAuthTrigger";
import { MARKETING_CTA } from "@/lib/marketingConstants";
import { cn } from "@/lib/utils";

export const marketingNavCtaClassName =
  "inline-flex items-center justify-center rounded-full px-6 py-3 font-roboto text-base font-medium transition-colors";

const contactUsCtaClassName = cn(
  marketingNavCtaClassName,
  "border border-marketing-azure-200 bg-transparent text-marketing-neutral-1100 hover:bg-white/70",
);

function scrollToHashAnchor(hash: string): void {
  const targetId = hash.replace(/^#/, "");
  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.pushState(null, "", hash);
}

export function MarketingSignupLoginCta({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  return (
    <MarketingAuthTrigger
      onClick={onClick}
      className={cn(
        marketingNavCtaClassName,
        "bg-marketing-neutral-1100 text-white hover:bg-marketing-neutral-1000",
        className,
      )}
    >
      Sign Up/Login
    </MarketingAuthTrigger>
  );
}

export function MarketingContactUsCta({
  className,
  onClick,
  href = MARKETING_CTA.contactUs,
}: {
  className?: string;
  onClick?: () => void;
  href?: string;
}) {
  if (href.startsWith("#")) {
    return (
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          scrollToHashAnchor(href);
          onClick?.();
        }}
        className={cn(contactUsCtaClassName, className)}
      >
        Contact Us
      </a>
    );
  }

  return (
    <Link href={href} onClick={onClick} className={cn(contactUsCtaClassName, className)}>
      Contact Us
    </Link>
  );
}
