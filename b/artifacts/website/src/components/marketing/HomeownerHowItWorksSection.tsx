import React from "react";
import howItWorksConnector from "@/assets/marketing/homeowners/how-it-works/connector.svg";
import { MarketingAuthTrigger } from "@/components/auth/MarketingAuthTrigger";
import { cn } from "@/lib/utils";

interface HowItWorksStep {
  number: number;
  title: string;
  description: string;
  align: "left" | "right";
  desktopClassName: string;
}

const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    number: 1,
    title: "Register your property",
    description: "Share your contact details and basic property information.",
    align: "right",
    desktopClassName:
      "lg:col-start-1 lg:row-start-1 lg:max-w-[279px] lg:justify-self-start",
  },
  {
    number: 2,
    title: "Speak with a TrustKeyper expert",
    description:
      "Our team understands the property, occupancy status, and support required.",
    align: "left",
    desktopClassName:
      "lg:col-start-2 lg:row-start-1 lg:mt-[174px] lg:max-w-[285px] lg:justify-self-end",
  },
  {
    number: 3,
    title: "Property assessment and service plan",
    description:
      "We assess the property and define the management scope and responsibilities.",
    align: "right",
    desktopClassName:
      "lg:col-start-1 lg:row-start-2 lg:mt-8 lg:max-w-[297px] lg:justify-self-start",
  },
  {
    number: 4,
    title: "Ongoing property management",
    description:
      "TrustKeyper begins coordinating tenants, servicing, repairs, and regular updates.",
    align: "left",
    desktopClassName:
      "lg:col-start-2 lg:row-start-2 lg:mt-[208px] lg:max-w-[297px] lg:justify-self-end",
  },
];

function StepBadge({ number }: { number: number }) {
  return (
    <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-marketing-neutral-1100 text-sm font-bold text-white">
      {number}
    </span>
  );
}

function HowItWorksStepItem({
  number,
  title,
  description,
  align,
  desktopClassName,
}: HowItWorksStep) {
  return (
    <li
      className={cn(
        "relative flex flex-col items-center gap-5 text-center",
        desktopClassName,
        align === "right"
          ? "lg:items-end lg:text-right"
          : "lg:items-start lg:text-left",
      )}
    >
      <StepBadge number={number} />
      <div
        className={cn(
          "relative z-10 space-y-3",
          align === "right" ? "lg:text-right" : "lg:text-left",
        )}
      >
        <h3 className="font-roboto text-base font-medium leading-6 text-marketing-navy-dark">
          {title}
        </h3>
        <p className="font-roboto text-sm leading-5 text-marketing-neutral-1000">
          {description}
        </p>
      </div>
      {number < HOW_IT_WORKS_STEPS.length ? (
        <span
          className="absolute left-1/2 top-full h-10 w-px -translate-x-1/2 bg-marketing-azure-stroke/70 lg:hidden"
          aria-hidden
        />
      ) : null}
    </li>
  );
}

export function HomeownerHowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="bg-white py-16 lg:py-[140px]"
      aria-labelledby="homeowner-how-it-works-heading"
    >
      <div className="mx-auto max-w-[1168px] px-6 sm:px-8 lg:px-12">
        <header className="mx-auto max-w-[938px] text-center">
          <p className="font-roboto text-xs font-medium uppercase tracking-[1.2px] text-marketing-neutral-1100">
            How It Works
          </p>
          <h2
            id="homeowner-how-it-works-heading"
            className="mt-5 text-[40px] font-medium leading-[46px] text-marketing-navy-dark"
          >
            From registration to complete property care
          </h2>
        </header>

        <div className="relative mt-12 lg:mt-[60px] lg:min-h-[calc(min(62vw,720px)+92px)]">
          <img
            src={howItWorksConnector}
            alt=""
            className="pointer-events-none absolute left-1/2 top-[92px] z-0 hidden h-[min(62vw,720px)] w-[min(42vw,490px)] -translate-x-1/2 lg:block"
            draggable={false}
            aria-hidden
          />

          <ol className="relative z-10 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-x-20 lg:gap-y-0">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <HowItWorksStepItem key={step.number} {...step} />
            ))}
          </ol>
        </div>

        <div className="mx-auto mt-14 max-w-[575px] text-center lg:mt-10">
          <h3 className="text-xl font-bold leading-[26px] text-marketing-navy-dark sm:text-[40px] sm:font-medium sm:leading-[46px]">
            Ready to simplify property management?
          </h3>
          <MarketingAuthTrigger className="mt-6 inline-flex h-14 items-center justify-center rounded-full bg-marketing-green px-10 font-roboto text-base font-medium text-marketing-neutral-1100 transition-colors hover:bg-marketing-green/90">
            Register your property
          </MarketingAuthTrigger>
        </div>
      </div>
    </section>
  );
}
