import React from "react";
import { ArrowRight, Check } from "lucide-react";
import heroPhoneHouse from "@/assets/marketing/hero/hero-phone-house.png";
import { useMarketingAuthModal } from "@/components/auth/MarketingAuthModalContext";
import { cn } from "@/lib/utils";

export interface HeroPhoneScreenContentProps {
  className?: string;
  /** Hero = insets on the marketing phone mockup; compact = standalone phone component. */
  variant?: "hero" | "compact";
}

export function HeroPhoneScreenContent({ className, variant = "compact" }: HeroPhoneScreenContentProps) {
  const isHero = variant === "hero";
  const { openAuthModal } = useMarketingAuthModal();

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden bg-[#fafafa]",
        isHero ? "px-[7.5%] pb-[5%] pt-[7%]" : "items-center justify-center px-3 pb-3 pt-2 text-center",
        className,
      )}
    >
      <div className={cn("flex w-full flex-col items-center", isHero ? "flex-1" : undefined)}>
        <div
          className={cn(
            "relative flex items-center justify-center",
            isHero ? "mb-[5.5%] aspect-square w-[46%] min-w-[72px] max-w-[132px]" : "mb-2",
          )}
        >
          <div className="absolute inset-0 rounded-full bg-[#d4f5e4]/90" aria-hidden />
          <div
            className={cn(
              "relative flex items-center justify-center rounded-full bg-[#48d08c]",
              isHero ? "aspect-square w-[52%]" : "h-8 w-8 sm:h-9 sm:w-9",
            )}
          >
            <Check
              className={cn("text-white", isHero ? "h-[44%] w-[44%]" : "h-3.5 w-3.5 sm:h-4 sm:w-4")}
              strokeWidth={3}
              aria-hidden
            />
          </div>
        </div>

        <p
          className={cn(
            "w-full text-center font-medium leading-[1.25] text-marketing-navy",
            isHero ? "text-[clamp(9px,2.65vw,13px)]" : "text-[11px] sm:text-xs lg:text-[13px]",
          )}
        >
          Get Rent from Anywhere
          <br />
          <span className="text-marketing-blue">Effortlessly</span>
        </p>

        <p
          className={cn(
            "mt-[3.5%] w-full text-center font-roboto leading-[1.35] text-marketing-muted",
            isHero
              ? "max-w-[96%] text-[clamp(7px,2.1vw,10px)]"
              : "mt-1.5 max-w-[92%] text-[8px] sm:text-[9px] lg:text-[10px]",
          )}
        >
          Secure rent payments you can rely on, no matter your location.
        </p>

        <button
          type="button"
          onClick={openAuthModal}
          className={cn(
            "font-marketing-cta mt-[4.5%] inline-flex w-full items-center justify-center gap-1 rounded-md bg-marketing-blue font-medium text-white transition-colors hover:bg-marketing-blue-bright",
            isHero
              ? "max-w-full py-[2.8%] text-[clamp(8px,2.35vw,11px)]"
              : "mt-2 max-w-[92%] px-3 py-2 text-[10px] sm:text-[11px] lg:text-xs",
          )}
        >
          Get Started
          <ArrowRight
            className={cn(isHero ? "h-[1em] w-[1em]" : "h-3.5 w-3.5")}
            strokeWidth={2}
            aria-hidden
          />
        </button>
      </div>

      <img
        src={heroPhoneHouse}
        alt=""
        className={cn(
          "pointer-events-none object-contain object-bottom-right opacity-90",
          isHero
            ? "absolute bottom-[2%] right-[1%] w-[46%] max-w-[122px]"
            : "absolute bottom-0 right-0 h-[34%] w-[40%]",
        )}
        draggable={false}
        aria-hidden
      />
    </div>
  );
}
