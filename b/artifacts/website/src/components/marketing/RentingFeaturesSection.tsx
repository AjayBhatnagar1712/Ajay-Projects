import React from "react";
import { ShieldCheck, ThumbsUp, UserCheck } from "lucide-react";
import propertyManagementIcon from "@/assets/marketing/renting-features/property-management-icon.png";
import rentalIncomeIcon from "@/assets/marketing/renting-features/rental-income-icon.png";
import tenantManagementIcon from "@/assets/marketing/renting-features/tenant-management-icon.png";

interface FeatureItem {
  image: string;
  title: React.ReactNode;
  description: string;
  cardClassName: string;
}

const FEATURES: FeatureItem[] = [
  {
    image: rentalIncomeIcon,
    title: (
      <>
        Rental Income.
        <br />
        Zero Hassle
      </>
    ),
    description: "Get guaranteed monthly rent stress-free",
    cardClassName: "bg-marketing-mint-card border-[#c1eee0]",
  },
  {
    image: propertyManagementIcon,
    title: (
      <>
        Complete Property
        <br />
        Management
      </>
    ),
    description: "From interiors to tenant search, we handle it all, start to finish.",
    cardClassName: "bg-marketing-sky-card border-[#c1eee0]",
  },
  {
    image: tenantManagementIcon,
    title: (
      <>
        Tenant Management
        <br />
        Made Easy
      </>
    ),
    description: "We handle tenants end-to-end keeping your property filled and worry-free.",
    cardClassName: "bg-marketing-cyan-card border-[#c1eee0]",
  },
];

const TRUST_BADGES = [
  { label: "Full Transparency", icon: UserCheck, iconClassName: "text-marketing-blue" },
  { label: "Completely Encrypted", icon: ShieldCheck, iconClassName: "text-[#009e5c]" },
  { label: "Satisfaction Guarantee", icon: ThumbsUp, iconClassName: "text-marketing-blue" },
] as const;

export function RentingFeaturesSection() {
  return (
    <section className="bg-white py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12">
        <h2 className="border-b border-marketing-muted/20 pb-4 text-[40px] font-medium leading-tight text-marketing-navy">
          You&apos;ll Love Renting with Us
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:mt-10 md:grid-cols-3 md:gap-[73px]">
          {FEATURES.map((feature) => (
            <article
              key={feature.description}
              className={`flex flex-col rounded-lg border p-7 shadow-[1px_2px_5px_rgba(103,103,103,0.1)] ${feature.cardClassName}`}
            >
              <div className="relative mb-5 h-[120px] w-[122px]">
                <img
                  src={feature.image}
                  alt=""
                  className="h-full w-full object-contain object-left"
                  draggable={false}
                />
              </div>
              <h3 className="font-marketing-cta text-[24px] font-medium leading-snug text-marketing-navy">
                {feature.title}
              </h3>
              <p className="mt-3 font-roboto text-[14px] leading-[22px] text-marketing-body">
                {feature.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-10 flex max-w-[1144px] flex-wrap items-center justify-center gap-4 sm:mt-12 sm:gap-[22px]">
          {TRUST_BADGES.map((badge) => (
            <div
              key={badge.label}
              className="flex min-w-[280px] flex-1 items-center justify-center gap-3 rounded-lg border border-marketing-border bg-white px-6 py-5 shadow-[1px_2px_5px_rgba(103,103,103,0.1)] sm:min-w-[340px]"
            >
              <badge.icon size={34} className={badge.iconClassName} strokeWidth={2} aria-hidden />
              <span className="text-base font-medium text-marketing-blue sm:text-lg">
                {badge.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
