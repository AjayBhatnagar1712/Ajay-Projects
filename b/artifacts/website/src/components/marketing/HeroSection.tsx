import React from "react";
import type { MotionValue } from "framer-motion";
import heroCardAddProperty from "@/assets/marketing/hero/hero-card-add-property.png";
import heroCardFindTenants from "@/assets/marketing/hero/hero-card-find-tenants.png";
import heroCardManageProperty from "@/assets/marketing/hero/hero-card-manage-property.png";
import heroCardOnTime from "@/assets/marketing/hero/hero-card-on-time.png";
import heroCardRentDistribution from "@/assets/marketing/hero/hero-card-rent-distribution.png";
import { HeroCenterPhone } from "@/components/marketing/HeroCenterPhone";
import { HeroFloatingCard } from "@/components/marketing/HeroFloatingCard";
import { useHeroParallaxCards } from "@/hooks/useHeroParallaxCards";

function HeroFloatingAsset({
  src,
  alt,
  className,
  y,
  delay,
}: {
  src: string;
  alt: string;
  className?: string;
  y: MotionValue<number>;
  delay?: number;
}) {
  return (
    <HeroFloatingCard y={y} delay={delay} variant="asset" className={className}>
      <img src={src} alt={alt} className="block h-auto w-full" draggable={false} />
    </HeroFloatingCard>
  );
}

export function HeroSection() {
  const { sectionRef, propertyY, rentY, findTenantsY, onTimeY, galleryY } = useHeroParallaxCards();

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-marketing-hero pb-0 pt-12 sm:pt-14 lg:pt-16"
    >
      <div className="relative mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-[40px] font-medium leading-[1.1] tracking-tight text-marketing-navy sm:text-[52px] lg:text-[76px]">
            You Own It.{" "}
            <span className="text-marketing-blue">We Manage It</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[717px] font-roboto text-[14px] leading-[22px] text-marketing-muted">
            From tenants screening to rent collection and maintenance, we handle everything for
            multi-property owners so you never have to worry, no matter where you are.
          </p>
        </div>

        <div className="relative mx-auto mt-8 w-full max-w-[1200px] sm:mt-10 lg:mt-12">
          <div className="hidden lg:block">
            <div className="relative h-[660px] w-full">
              <div className="absolute left-[12%] top-[8%] z-30 w-[26%]">
                <HeroFloatingAsset
                  src={heroCardManageProperty}
                  alt="Manage your property with ease"
                  y={propertyY}
                  delay={0.1}
                />
              </div>

              <div className="absolute left-[10%] top-[48%] z-30 w-[22%]">
                <HeroFloatingAsset
                  src={heroCardRentDistribution}
                  alt="Rent distribution breakdown"
                  y={rentY}
                  delay={0.2}
                />
              </div>

              <div className="absolute left-[56%] top-[1%] z-30 w-[17%]">
                <HeroFloatingAsset
                  src={heroCardFindTenants}
                  alt="Find tenants"
                  y={findTenantsY}
                  delay={0.15}
                />
              </div>

              <div className="absolute left-[54%] top-[10%] z-30 w-[12%]">
                <HeroFloatingAsset
                  src={heroCardOnTime}
                  alt="02 days to get rent on time"
                  y={onTimeY}
                  delay={0.25}
                />
              </div>

              <div className="absolute left-[52%] top-[34%] z-30 w-[30%]">
                <HeroFloatingAsset
                  src={heroCardAddProperty}
                  alt="Add your property seamlessly"
                  y={galleryY}
                  delay={0.3}
                />
              </div>

              <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center">
                <HeroCenterPhone phoneClassName="w-[min(100%,430px)]" />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center lg:hidden">
            <HeroCenterPhone className="mb-6 w-full max-w-[360px] px-2 sm:mb-8 sm:max-w-[397px] sm:px-0" />

            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
              <HeroFloatingAsset
                src={heroCardManageProperty}
                alt="Manage your property with ease"
                y={propertyY}
              />

              <HeroFloatingAsset
                src={heroCardRentDistribution}
                alt="Rent distribution breakdown"
                y={rentY}
              />

              <HeroFloatingAsset
                src={heroCardFindTenants}
                alt="Find tenants"
                y={findTenantsY}
                className="sm:col-span-2 sm:max-w-xs sm:justify-self-center"
              />

              <HeroFloatingAsset
                src={heroCardOnTime}
                alt="02 days to get rent on time"
                y={onTimeY}
                className="sm:max-w-[200px] sm:justify-self-center"
              />

              <HeroFloatingAsset
                src={heroCardAddProperty}
                alt="Add your property seamlessly"
                y={galleryY}
                className="sm:col-span-2"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}