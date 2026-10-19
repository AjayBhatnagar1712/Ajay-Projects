import React from "react";
import { Menu } from "lucide-react";
import logoDark from "@/assets/marketing/trustkeyper Logo.svg";
import { HeroPhoneScreenContent } from "@/components/marketing/HeroPhoneScreenContent";
import { cn } from "@/lib/utils";

export interface HeroPhoneMockupProps {
  className?: string;
}

export function HeroPhoneMockup({ className }: HeroPhoneMockupProps) {
  return (
    <div
      className={cn(
        "relative mx-auto w-[220px] shrink-0 sm:w-[240px]",
        className,
      )}
    >
      <div className="rounded-[2rem] border-[6px] border-[#1a1a1a] bg-[#1a1a1a] p-1 shadow-[0_24px_48px_rgba(25,40,57,0.18)] sm:rounded-[2.25rem] sm:border-8">
        <div className="overflow-hidden rounded-[1.5rem] bg-[#fafafa] sm:rounded-[1.75rem]">
          <div className="flex items-center justify-between px-3 pb-1 pt-2 text-[9px] font-medium text-gray-800">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-gray-800" aria-hidden />
              <span className="h-2 w-2 rounded-full bg-gray-800" aria-hidden />
            </div>
          </div>

          <div className="flex items-center justify-between px-3 pb-2">
            <img src={logoDark} alt="TrustKeyper" className="h-4 w-auto" draggable={false} />
            <Menu size={14} className="text-marketing-navy" aria-hidden />
          </div>

          <div className="min-h-[220px]">
            <HeroPhoneScreenContent />
          </div>
        </div>
      </div>
    </div>
  );
}
