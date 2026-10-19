import React, { type ReactNode } from "react";
import heroNavEllipse from "@/assets/marketing/homeowners/hero/hero-nav-ellipse.png";
import { HomeownerMarketingNav } from "@/components/marketing/HomeownerMarketingNav";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { cn } from "@/lib/utils";

export interface MarketingLayoutProps {
  children: ReactNode;
  className?: string;
  hideNav?: boolean;
  navVariant?: "default" | "homeowner";
}

export function MarketingLayout({
  children,
  className,
  hideNav = false,
  navVariant = "default",
}: MarketingLayoutProps) {
  const mainOffsetClassName =
    navVariant === "homeowner" ? "pt-[82px] sm:pt-[96px]" : "pt-[88px] sm:pt-[96px]";

  return (
    <div className={cn("relative isolate flex min-h-screen flex-col bg-marketing-bg", className)}>
      {navVariant === "homeowner" ? (
        <img
          src={heroNavEllipse}
          alt=""
          className="pointer-events-none absolute left-1/2 top-0 z-0 h-auto w-screen max-w-none -translate-x-1/2 select-none"
          draggable={false}
          aria-hidden
        />
      ) : null}
      {!hideNav ? (navVariant === "homeowner" ? <HomeownerMarketingNav /> : <MarketingNav />) : null}
      <main className={cn("relative z-10 flex flex-1 flex-col", !hideNav && mainOffsetClassName)}>
        {children}
      </main>
    </div>
  );
}
