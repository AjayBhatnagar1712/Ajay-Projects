import React from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import logoLight from "@/assets/marketing/logo light.svg";
import { cn } from "@/lib/utils";

export interface MarketingAuthPageLayoutProps {
  children: React.ReactNode;
  className?: string;
  backHref?: string;
}

/** Full-page auth shell — not a modal. Used for post-OTP existing-account flow. */
export function MarketingAuthPageLayout({
  children,
  className,
  backHref = "/",
}: MarketingAuthPageLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-white">
      <header className="relative flex h-[120px] items-center justify-center bg-gradient-to-b from-[#305eff] to-[#6b93ff] sm:h-[132px]">
        <Link
          href={backHref}
          className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-6"
          aria-label="Back to home"
        >
          <ArrowLeft size={18} strokeWidth={2} aria-hidden />
        </Link>
        <img src={logoLight} alt="TrustKeyper" className="h-10 w-auto sm:h-11" draggable={false} />
      </header>

      <main
        className={cn(
          "mx-auto w-full max-w-md px-5 pb-10 pt-6 sm:max-w-lg sm:px-8 sm:pb-12 sm:pt-8",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
