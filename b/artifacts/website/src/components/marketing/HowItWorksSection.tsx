import React from "react";
import {
  Edit3,
  FileText,
  PhoneIncoming,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { MarketingCtaButton } from "@/components/marketing/MarketingCtaButton";
import { cn } from "@/lib/utils";

interface StepItem {
  icon: LucideIcon;
  title: React.ReactNode;
  description: string;
  cardClassName: string;
  dark?: boolean;
}

const STEPS: StepItem[] = [
  {
    icon: Edit3,
    title: "Get in touch",
    description: "Share your property details with us. it's quick, easy, and free.",
    cardClassName: "bg-marketing-mint-card",
  },
  {
    icon: PhoneIncoming,
    title: "Experts will call you",
    description:
      "Our team will understand your needs and walk you through the process step-by-step.",
    cardClassName: "bg-marketing-sky-card",
  },
  {
    icon: FileText,
    title: "Agreement signing",
    description: "Secure your guaranteed rent with simple, transparent agreements.",
    cardClassName: "bg-marketing-cyan-card",
  },
  {
    icon: ShieldCheck,
    title: (
      <>
        Start getting <span className="text-marketing-green">Rent</span>
      </>
    ),
    description:
      "Sit back and relax, receive on-time payments every month without the stress of managing tenants.",
    cardClassName: "bg-marketing-navy text-white",
    dark: true,
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-marketing-muted-bg py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12">
        <h2 className="border-b border-marketing-muted/20 pb-4 text-[40px] font-medium leading-tight text-marketing-navy">
          How it <span className="text-marketing-blue">Works</span>
        </h2>
      </div>

      <div className="relative mt-10 overflow-x-clip sm:mt-12">
        <div
          className="pointer-events-none absolute inset-x-0 top-10 z-0 hidden md:block"
          aria-hidden
        >
          <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12">
            <div className="relative h-[42px]">
              <div
                className={cn(
                  "absolute inset-y-0 right-0 bg-marketing-blue",
                  "left-[calc(-1*(max(0px,(100vw-1200px)/2)+1.25rem))]",
                  "sm:left-[calc(-1*(max(0px,(100vw-1200px)/2)+2rem))]",
                  "lg:left-[calc(-1*(max(0px,(100vw-1200px)/2)+3rem))]",
                )}
              />
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12">
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-4">
            {STEPS.map((step) => (
              <li
                key={step.description}
                className={cn(
                  "relative flex flex-col gap-12 rounded-lg p-7",
                  step.cardClassName,
                  step.dark ? "md:min-h-[288px]" : "md:mt-5",
                )}
              >
                <step.icon
                  size={24}
                  className={step.dark ? "text-marketing-blue-bright" : "text-marketing-navy"}
                  strokeWidth={2}
                  aria-hidden
                />

                <div className={cn("flex flex-col", step.dark && "flex-1")}>
                  <h3
                    className={cn(
                      "font-marketing-cta text-[24px] font-medium leading-snug",
                      step.dark ? "text-white" : "text-marketing-navy",
                    )}
                  >
                    {step.title}
                  </h3>
                  <p
                    className={cn(
                      "mt-3 font-roboto text-[14px] leading-[22px]",
                      step.dark ? "text-marketing-muted" : "text-marketing-body",
                    )}
                  >
                    {step.description}
                  </p>
                  {step.dark ? (
                    <MarketingCtaButton
                      opensAuthModal
                      className="mt-6 w-full text-[16px] font-medium font-sans sm:w-auto"
                    >
                      Get Started
                    </MarketingCtaButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
