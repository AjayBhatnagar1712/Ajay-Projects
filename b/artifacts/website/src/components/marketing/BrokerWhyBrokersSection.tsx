import React from "react";
import iconFaster from "@/assets/marketing/brokers/why/icon-faster.svg";
import iconVerified from "@/assets/marketing/brokers/why/icon-verified.svg";
import iconWorkflow from "@/assets/marketing/brokers/why/icon-workflow.svg";

interface WhyBrokerCard {
  iconSrc: string;
  title: string;
  description: string;
}

const WHY_BROKER_CARDS: WhyBrokerCard[] = [
  {
    iconSrc: iconVerified,
    title: "Verified Opportunities",
    description:
      "Review property opportunities with owner and property information checked through TrustKeyper's verification process.",
  },
  {
    iconSrc: iconFaster,
    title: "Faster Qualification",
    description: "See essential property and requirement details before beginning your follow-up.",
  },
  {
    iconSrc: iconWorkflow,
    title: "One Organised Workflow",
    description: "Track each opportunity from new lead to site visit, negotiation, and closure.",
  },
];

function WhyBrokerCardItem({ iconSrc, title, description }: WhyBrokerCard) {
  return (
    <article className="flex h-full flex-col rounded-3xl bg-white p-5 shadow-[0_1px_1px_rgba(8,50,42,0.04),0_16px_20px_rgba(8,50,42,0.06)] sm:p-8">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-marketing-icon-circle/10">
        <img src={iconSrc} alt="" width={24} height={24} className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="mt-5 text-xl font-semibold leading-[26px] text-marketing-navy-dark">{title}</h3>
      <p className="mt-4 font-roboto text-sm leading-5 text-marketing-neutral-1000">{description}</p>
    </article>
  );
}

export function BrokerWhyBrokersSection() {
  return (
    <section className="bg-white py-16 lg:py-[140px]" aria-labelledby="broker-why-heading">
      <div className="mx-auto max-w-[1168px] px-6 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-6 md:gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div className="max-w-[368px] shrink-0">
            <p className="font-roboto text-xs font-medium uppercase tracking-[1.2px] text-marketing-neutral-1100">
              Why Brokers Use TrustKeyper
            </p>
            <h2
              id="broker-why-heading"
              className="mt-5 text-[40px] font-medium leading-[46px] text-marketing-navy-dark"
            >
              Spend less time
              <br />
              chasing weak leads.
            </h2>
          </div>
          <p className="max-w-[500px] font-roboto text-base leading-6 text-marketing-navy-dark lg:pb-1">
            Every lead on TrustKeyper goes through a verification process before it reaches you, so you
            can make better decisions about where to invest your time.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 lg:mt-[60px] lg:grid-cols-3 lg:gap-[17px]">
          {WHY_BROKER_CARDS.map((card) => (
            <li key={card.title} className="h-full min-w-0">
              <WhyBrokerCardItem {...card} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
