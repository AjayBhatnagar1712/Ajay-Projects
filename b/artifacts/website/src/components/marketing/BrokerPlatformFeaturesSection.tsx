import React from "react";
import iconBrokerProfile from "@/assets/marketing/brokers/features/icon-07-broker-profile.svg";
import iconFollowUp from "@/assets/marketing/brokers/features/icon-04-follow-up.svg";
import iconLeadPipeline from "@/assets/marketing/brokers/features/icon-03-lead-pipeline.svg";
import iconNotifications from "@/assets/marketing/brokers/features/icon-06-notifications.svg";
import iconPerformance from "@/assets/marketing/brokers/features/icon-08-performance.svg";
import iconPropertyDetails from "@/assets/marketing/brokers/features/icon-05-property-details.svg";
import iconSmartFilters from "@/assets/marketing/brokers/features/icon-02-smart-filters.svg";
import iconSupport from "@/assets/marketing/brokers/features/icon-09-support.svg";
import iconVerifiedLeadFeed from "@/assets/marketing/brokers/features/icon-01-verified-lead-feed.svg";

interface PlatformFeature {
  iconSrc: string;
  title: string;
  description: string;
}

const PLATFORM_FEATURES: PlatformFeature[] = [
  {
    iconSrc: iconVerifiedLeadFeed,
    title: "Verified Lead Feed",
    description: "Access newly available property opportunities with verification indicators.",
  },
  {
    iconSrc: iconSmartFilters,
    title: "Smart Lead Filters",
    description: "Filter by locality, property type, budget, requirement, availability, and recency.",
  },
  {
    iconSrc: iconLeadPipeline,
    title: "Lead Pipeline",
    description:
      "Move leads through New, Contacted, Qualified, Visit Scheduled, Negotiation, Closed, and Archived.",
  },
  {
    iconSrc: iconFollowUp,
    title: "Follow-Up Tasks",
    description: "Set reminders and track pending actions.",
  },
  {
    iconSrc: iconPropertyDetails,
    title: "Property Details",
    description: "Review essential property information and owner requirements before contacting.",
  },
  {
    iconSrc: iconNotifications,
    title: "Notifications",
    description: "Receive alerts for matching opportunities and important follow-ups.",
  },
  {
    iconSrc: iconBrokerProfile,
    title: "Broker Profile",
    description: "Manage service locations, property categories, business details, and availability.",
  },
  {
    iconSrc: iconPerformance,
    title: "Performance Insights",
    description: "Monitor lead activity, response time, site visits, and closures.",
  },
  {
    iconSrc: iconSupport,
    title: "Broker Support",
    description: "Access support for lead issues, verification questions, and account assistance.",
  },
];

function PlatformFeatureCard({ iconSrc, title, description }: PlatformFeature) {
  return (
    <article className="flex h-full gap-4 rounded-3xl bg-white p-3 shadow-[0_1px_1px_rgba(8,50,42,0.04),0_16px_20px_rgba(8,50,42,0.06)] sm:p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marketing-green">
        <img src={iconSrc} alt="" width={20} height={20} className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-roboto text-base font-medium leading-6 text-marketing-navy-dark">{title}</h3>
        <p className="mt-3 font-roboto text-sm leading-5 text-marketing-neutral-1000">{description}</p>
      </div>
    </article>
  );
}

export function BrokerPlatformFeaturesSection() {
  return (
    <section
      className="bg-marketing-cloud-050 py-16 lg:py-[140px]"
      aria-labelledby="broker-platform-features-heading"
    >
      <div className="mx-auto max-w-[1168px] px-6 sm:px-8 lg:px-12">
        <header className="max-w-[751px]">
          <p className="font-roboto text-xs font-medium uppercase tracking-[1.2px] text-marketing-neutral-1100">
            Platform Features
          </p>
          <h2
            id="broker-platform-features-heading"
            className="mt-5 text-[40px] font-medium leading-[46px] text-marketing-navy-dark"
          >
            Everything brokers need
            <br />
            to manage property opportunities.
          </h2>
        </header>

        <ul className="mt-12 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:mt-[60px] lg:grid-cols-3 lg:gap-[9px]">
          {PLATFORM_FEATURES.map((feature) => (
            <li key={feature.title} className="h-full min-w-0">
              <PlatformFeatureCard {...feature} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
