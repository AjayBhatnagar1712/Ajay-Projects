import React from "react";
import {
  Eye,
  Megaphone,
  Package,
  Search,
  Settings,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import benefitsCenterHouse from "@/assets/marketing/benefits/benefits-center-house.png";

interface BenefitCard {
  icon: LucideIcon;
  title: string;
  description: string;
}

const LEFT_BENEFITS: BenefitCard[] = [
  {
    icon: Search,
    title: "Verified Tenants & Secure Agreements",
    description: "Background checks and rent agreements done right.",
  },
  {
    icon: Eye,
    title: "Site Check Made Simple",
    description: "Quick preliminary visits to assess your property.",
  },
  {
    icon: UserCheck,
    title: "Direct Tenant Connect",
    description: "Engage with qualified, interested tenants.",
  },
];

const RIGHT_BENEFITS: BenefitCard[] = [
  {
    icon: Package,
    title: "Facilitate tenant move-in",
    description: "We make tenant onboarding seamless.",
  },
  {
    icon: Megaphone,
    title: "Wider Reach",
    description: "Advertised across multiple channels for faster occupancy.",
  },
  {
    icon: Settings,
    title: "Repairs & maintenance",
    description: "Repairs and maintenance handled, hassle-free.",
  },
];

const SIDE_CARD_CLASS =
  "rounded-lg border-0 border-b border-[rgba(18,145,208,0.28)] bg-[rgba(18,145,208,0.09)] p-7";

function BenefitCardItem({ icon: Icon, title, description }: BenefitCard) {
  return (
    <article className={SIDE_CARD_CLASS}>
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-full bg-marketing-green">
        <Icon size={20} className="text-[#145252]" strokeWidth={2} aria-hidden />
      </div>
      <h3 className="font-marketing-cta text-[24px] font-medium leading-snug text-marketing-navy">
        {title}
      </h3>
      <p className="mt-3 font-roboto text-[14px] leading-[22px] text-marketing-body">
        {description}
      </p>
    </article>
  );
}

export function BenefitsSection() {
  return (
    <section className="bg-white py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12">
        <div className="mx-auto grid w-full max-w-[1136px] grid-cols-1 gap-8 lg:grid-cols-[1fr_272px_1fr] lg:items-stretch">
          <div className="flex flex-col gap-8">
            {LEFT_BENEFITS.map((benefit) => (
              <BenefitCardItem key={benefit.title} {...benefit} />
            ))}
          </div>

          <article className="flex h-full min-h-[646px] flex-col overflow-hidden rounded-lg border-0 border-b border-[#c1eee0] bg-[#F1F1F1] px-5 pb-0 pt-6 text-center">
            <h2 className="text-[32px] font-medium leading-tight text-marketing-navy">
              Unlock the Benefits of{" "}
              <span className="text-marketing-green">Stress-Free Renting</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[240px] font-roboto text-[14px] leading-[22px] text-marketing-muted">
              Earn more, worry less, and let us handle the rest.
            </p>
            <div className="mt-6 flex flex-1 items-end">
              <img
                src={benefitsCenterHouse}
                alt=""
                className="mx-auto h-auto w-full max-w-[232px] object-contain object-bottom"
                width={232}
                height={385}
                draggable={false}
              />
            </div>
          </article>

          <div className="flex flex-col gap-8">
            {RIGHT_BENEFITS.map((benefit) => (
              <BenefitCardItem key={benefit.title} {...benefit} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
