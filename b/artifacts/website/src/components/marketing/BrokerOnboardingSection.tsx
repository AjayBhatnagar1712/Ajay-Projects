import React from "react";
import { MarketingAuthTrigger } from "@/components/auth/MarketingAuthTrigger";

interface OnboardingStep {
  number: number;
  title: string;
  description: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    number: 1,
    title: "Create your broker profile",
    description: "Register with your professional and contact details.",
  },
  {
    number: 2,
    title: "Complete verification",
    description: "Our team reviews your submitted profile information.",
  },
  {
    number: 3,
    title: "Select preferred areas and property types",
    description: "Set your operating localities and property categories.",
  },
  {
    number: 4,
    title: "Access matching leads",
    description:
      "Begin receiving verified property opportunities through the portal.",
  },
];

function StepBadge({ number }: { number: number }) {
  return (
    <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marketing-neutral-1100 text-sm font-bold text-white shadow-[0_0_0_8px_#fff]">
      {number}
    </span>
  );
}

export function BrokerOnboardingSection() {
  return (
    <section
      className="bg-white py-16 lg:py-[140px]"
      aria-labelledby="broker-onboarding-heading"
    >
      <div className="mx-auto max-w-[1168px] px-6 sm:px-8 lg:px-12">
        <header className="mx-auto max-w-[589px] text-center lg:mx-0 lg:text-left">
          <p className="font-roboto text-xs font-medium uppercase tracking-[1.2px] text-marketing-neutral-1100">
            Broker Onboarding
          </p>
          <h2
            id="broker-onboarding-heading"
            className="mt-5 text-[40px] font-medium leading-[46px] text-marketing-navy-dark"
          >
            Start receiving relevant
            <br />
            opportunities in four steps.
          </h2>
        </header>

        <div className="relative mt-12 isolate lg:mt-[52px]">
          {/*
            Desktop connector behind badges. The right inset ends at the right
            edge of badge 4 in the four-column grid.
          */}
          <div
            className="pointer-events-none absolute top-5 left-5 z-0 hidden h-px bg-marketing-neutral-200 lg:block lg:right-[calc((100%-6rem)/4-40px)]"
            aria-hidden
          />

          <ol className="relative z-[1] grid grid-cols-1 gap-10 lg:grid-cols-4 lg:gap-8">
            {ONBOARDING_STEPS.map((step, index) => (
              <li
                key={step.number}
                className="relative flex flex-col items-center gap-5 text-center lg:items-start lg:text-left"
              >
                <StepBadge number={step.number} />
                <div className="relative z-10 space-y-3">
                  <h3 className="font-roboto text-base font-medium leading-6 text-marketing-navy-dark">
                    {step.title}
                  </h3>
                  <p className="font-roboto text-sm leading-5 text-marketing-neutral-1000">
                    {step.description}
                  </p>
                </div>
                {index < ONBOARDING_STEPS.length - 1 ? (
                  <span
                    className="absolute left-1/2 top-full h-10 w-px -translate-x-1/2 bg-marketing-neutral-200 lg:hidden"
                    aria-hidden
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-12 flex justify-center lg:mt-[52px] lg:justify-start">
          <MarketingAuthTrigger className="inline-flex h-14 items-center justify-center rounded-full bg-marketing-green px-10 font-roboto text-base font-medium text-marketing-neutral-1100 transition-colors hover:bg-marketing-green/90">
            Start Broker Registration
          </MarketingAuthTrigger>
        </div>
      </div>
    </section>
  );
}
