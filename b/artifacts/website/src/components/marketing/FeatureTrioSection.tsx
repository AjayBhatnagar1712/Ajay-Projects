import React from "react";
import { BadgeCheck, MapPin, MessageCircle } from "lucide-react";

const FEATURES = [
  {
    icon: BadgeCheck,
    title: "Verified Tenants & Secure Agreements",
    description: "Background checks and rent agreements done right.",
  },
  {
    icon: MapPin,
    title: "Site Check Made Simple",
    description: "Quick preliminary visits to assess your property.",
  },
  {
    icon: MessageCircle,
    title: "Direct Tenant Connect",
    description: "Engage with qualified, interested tenants.",
  },
] as const;

export function FeatureTrioSection() {
  return (
    <section className="bg-marketing-bg py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-white/8 bg-marketing-surface/60 p-6 sm:p-8"
            >
              <feature.icon
                className="mb-4 h-8 w-8 text-marketing-blue-bright"
                strokeWidth={1.5}
                aria-hidden
              />
              <h3 className="text-lg font-semibold text-white sm:text-xl">{feature.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-marketing-muted sm:text-base">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
