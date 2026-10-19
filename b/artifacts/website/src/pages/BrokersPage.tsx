import React from "react";
import { BrokerFaqSection } from "@/components/marketing/BrokerFaqSection";
import { BrokerHeroSection } from "@/components/marketing/BrokerHeroSection";
import { BrokerLeadQualitySection } from "@/components/marketing/BrokerLeadQualitySection";
import { BrokerOnboardingSection } from "@/components/marketing/BrokerOnboardingSection";
import { BrokerPlatformFeaturesSection } from "@/components/marketing/BrokerPlatformFeaturesSection";
import { BrokerPortalPreviewSection } from "@/components/marketing/BrokerPortalPreviewSection";
import { BrokerWhyBrokersSection } from "@/components/marketing/BrokerWhyBrokersSection";
import { HomeownerContactSection } from "@/components/marketing/HomeownerContactSection";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export function BrokersPage() {
  return (
    <MarketingLayout navVariant="homeowner">
      <BrokerHeroSection />
      <BrokerPortalPreviewSection />
      <BrokerWhyBrokersSection />
      <BrokerPlatformFeaturesSection />
      <BrokerOnboardingSection />
      <BrokerLeadQualitySection />
      <BrokerFaqSection />
      <div id="get-started" className="scroll-mt-[88px] sm:scroll-mt-[96px]">
        <HomeownerContactSection />
      </div>
      <MarketingFooter />
    </MarketingLayout>
  );
}
