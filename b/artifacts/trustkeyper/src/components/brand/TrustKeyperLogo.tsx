import React from "react";
import { cn } from "@/lib/utils";
import logoBrand from "@assets/Trustkeyper_Logo_1777989635996.png";
import logoLight from "@assets/trustkeyper_logo_light.png";

export type TrustKeyperLogoVariant = "brand" | "inverse";

export type TrustKeyperLogoSize = "header" | "footer" | "authMobile";

export interface TrustKeyperLogoProps {
  variant?: TrustKeyperLogoVariant;
  /** Preset dimensions — desktop header/footer: 112×48px per brand spec. */
  size?: TrustKeyperLogoSize;
  className?: string;
}

/** Desktop wordmark: 112×48px (w-[112px] h-12). */
const SIZE_CLASSES: Record<TrustKeyperLogoSize, string> = {
  header:
    "h-9 w-auto max-w-[84px] sm:h-10 sm:max-w-[93px] md:h-12 md:w-[112px] md:max-w-[112px]",
  footer:
    "h-9 w-auto max-w-[84px] sm:h-10 sm:max-w-[93px] md:h-12 md:w-[112px] md:max-w-[112px]",
  authMobile: "h-10 w-auto max-w-[min(100%,200px)] sm:h-11",
};

/**
 * TrustKeyper wordmark from brand exports — fixed aspect, object-contain, no upscale blur.
 */
export function TrustKeyperLogo({
  variant = "brand",
  size = "header",
  className,
}: TrustKeyperLogoProps) {
  const src = variant === "inverse" ? logoLight : logoBrand;

  return (
    <img
      src={src}
      alt="TrustKeyper"
      width={112}
      height={48}
      draggable={false}
      className={cn(
        "block shrink-0 select-none object-contain object-left",
        SIZE_CLASSES[size],
        className,
      )}
    />
  );
}
