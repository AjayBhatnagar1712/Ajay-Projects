import React from "react";
import { motion } from "framer-motion";
import houseImage from "@/assets/marketing/Image.png";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { useFooterHouseReveal } from "@/hooks/useFooterHouseReveal";

export function FooterHouseReveal() {
  const { sectionRef, bannerY, bannerOpacity, footerOverlap } = useFooterHouseReveal();

  return (
    <section ref={sectionRef} className="relative bg-marketing-bg">
      <div className="relative z-10 overflow-hidden pb-0 pt-4 sm:pt-8">
        <div className="mx-auto flex max-w-7xl justify-center px-5 sm:px-8 lg:px-12">
          <motion.img
            src={houseImage}
            alt=""
            style={{ y: bannerY, opacity: bannerOpacity }}
            className="block w-full max-w-[min(100%,720px)] object-contain object-bottom drop-shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:max-w-[820px] lg:max-w-[900px]"
            draggable={false}
            aria-hidden
          />
        </div>
      </div>

      <motion.div className="relative z-20 shrink-0" style={{ marginTop: footerOverlap }}>
        <MarketingFooter />
      </motion.div>
    </section>
  );
}
