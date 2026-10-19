import React from "react";
import { ContactSection } from "@/components/marketing/ContactSection";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { PeaceOfMindBanner } from "@/components/marketing/PeaceOfMindBanner";

export function ContactPage() {
  return (
    <MarketingLayout>
      <ContactSection />
      <PeaceOfMindBanner />
    </MarketingLayout>
  );
}
