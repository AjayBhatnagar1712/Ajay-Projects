import React from "react";
import peaceOfMindBanner from "@/assets/marketing/Frame 1597880554.png";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export function PeaceOfMindBanner() {
  return (
    <section className="relative mt-auto bg-white" aria-label="Peace of mind">
      <div className="mx-auto w-full max-w-[1692px]">
        <img
          src={peaceOfMindBanner}
          alt="Keyper of Your Peace of Mind."
          className="block h-auto w-full"
          draggable={false}
        />
      </div>

      <MarketingFooter />
    </section>
  );
}
