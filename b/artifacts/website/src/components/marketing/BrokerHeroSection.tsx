import React from "react";
import { ArrowRight } from "lucide-react";
import { MarketingAuthTrigger } from "@/components/auth/MarketingAuthTrigger";
import {
  BrokerHeroVisualDesktop,
  BrokerHeroVisualMobile,
} from "@/components/marketing/BrokerHeroVisual";

const registerCtaClassName =
  "inline-flex h-14 w-full max-w-[280px] items-center justify-center gap-2 rounded-full bg-white px-8 text-center font-roboto text-sm font-medium text-marketing-navy-dark transition-colors hover:bg-white/95 sm:h-auto sm:max-w-none sm:px-8 sm:py-4 sm:text-base lg:w-auto";

export function BrokerHeroSection() {
  return (
    <section className="px-4 pb-6 pt-4 sm:px-6 sm:pb-8 lg:px-8 lg:pb-10">
      <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[24px] bg-marketing-neutral-1300 sm:rounded-[36px] lg:rounded-[44px]">
        <BrokerHeroVisualDesktop />

        <div className="relative z-10 flex flex-col items-center gap-8 px-6 pb-0 pt-10 text-center sm:gap-10 sm:px-10 sm:pt-14 lg:grid lg:min-h-[min(88vh,816px)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center lg:gap-6 lg:px-[124px] lg:py-[88px] lg:text-left">
          <div className="flex w-full max-w-[576px] flex-col items-center gap-8 sm:gap-10 lg:items-start lg:gap-[40px]">
            <div className="space-y-4 sm:space-y-5">
              <h1 className="text-[34px] font-medium leading-[1.12] tracking-tight text-white sm:text-[52px] sm:leading-[1.05] lg:text-[64px] lg:leading-[70px]">
                Get verified property leads.
                <br />
                Close with confidence.
              </h1>
              <p className="mx-auto max-w-xl font-roboto text-sm font-medium leading-5 text-marketing-neutral-300 sm:text-[15px] sm:leading-5 lg:mx-0">
                Join the TrustKeyper broker network and access a dedicated portal for verified property
                opportunities, lead management, and faster follow-ups.
              </p>
            </div>

            <div className="flex w-full flex-col items-center space-y-3 sm:space-y-4 lg:items-start">
              <MarketingAuthTrigger className={registerCtaClassName}>
                Register Now
                <ArrowRight size={16} strokeWidth={2} aria-hidden />
              </MarketingAuthTrigger>
              <p className="font-roboto text-xs leading-4 text-marketing-neutral-300">
                Broker access is subject to profile verification.
              </p>
            </div>
          </div>

          <BrokerHeroVisualMobile className="mt-2 w-full shrink-0" />
        </div>
      </div>
    </section>
  );
}
