import React from "react";
import heroHandPhone from "@/assets/marketing/hero/hero-hand-phone.png";
import { useMarketingAuthModal } from "@/components/auth/MarketingAuthModalContext";
import { cn } from "@/lib/utils";

export interface HeroCenterPhoneProps {
  className?: string;
  phoneClassName?: string;
}

/**
 * Figma hero phone (529×776). UI is baked into the asset; only Get Started is an
 * invisible hit target aligned to the button in hero-hand-phone.png.
 */
export function HeroCenterPhone({ className, phoneClassName }: HeroCenterPhoneProps) {
  const { openAuthModal } = useMarketingAuthModal();

  return (
    <div className={cn("relative mx-auto block w-full leading-none", className)}>
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] z-0 h-[62%] w-[108%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(48,94,255,0.14)_0%,rgba(48,94,255,0.06)_45%,transparent_72%)] sm:h-[66%] sm:w-[118%] lg:h-[68%] lg:w-[130%]"
        aria-hidden
      />

      <div
        className={cn(
          "relative z-10 mx-auto w-full max-w-[320px] leading-none sm:max-w-[397px]",
          phoneClassName,
        )}
      >
        <img
          src={heroHandPhone}
          alt="TrustKeyper mobile app — Get Rent from Anywhere Effortlessly"
          className="block h-auto w-full align-bottom object-contain object-bottom drop-shadow-[0_24px_48px_rgba(25,40,57,0.15)]"
          width={529}
          height={776}
          draggable={false}
        />

        <button
          type="button"
          onClick={openAuthModal}
          aria-label="Get Started"
          className="absolute left-[14.2%] top-[50.3%] z-10 h-[6.1%] w-[71.6%] rounded-lg transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marketing-blue"
        />
      </div>
    </div>
  );
}
