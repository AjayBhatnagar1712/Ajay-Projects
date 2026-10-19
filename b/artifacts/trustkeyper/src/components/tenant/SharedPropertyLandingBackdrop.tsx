import React from "react";
import sidebarImage from "@assets/Frame_3466237_1777382669479.png";
import { AuthMobileBrandBanner } from "@/components/auth/AuthMobileBrandBanner";
import { AuthEntryRoleGrid } from "@/components/auth/AuthEntryRoleGrid";
import { AuthStepHeading } from "@/components/auth/AuthStepHeading";
import { TrustKeyperLogo } from "@/components/brand";

/**
 * Read-only TrustKeyper onboarding landing used behind the share-link verification modal.
 */
export function SharedPropertyLandingBackdrop() {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F5F7FA]">
      <div className="hidden lg:block relative bg-primary overflow-hidden shrink-0 h-screen">
        <img src={sidebarImage} alt="" className="h-full w-auto block" />
        <div className="absolute top-10 left-10 z-10">
          <TrustKeyperLogo variant="inverse" size="header" />
        </div>
      </div>

      <div className="w-full flex-1 flex flex-col min-h-screen">
        <AuthMobileBrandBanner />
        <div className="flex flex-col flex-1 pt-8 pb-10 px-5 sm:px-6 lg:pt-[60px] lg:px-[140px] bg-[#F5F7FA]">
          <div className="max-w-md lg:max-w-none mx-auto w-full space-y-6">
            <AuthStepHeading title="I am a" />
            <div className="pointer-events-none select-none opacity-90" aria-hidden>
              <AuthEntryRoleGrid value="owner" onChange={() => undefined} />
            </div>
            <p className="text-center text-sm text-gray-500 lg:text-left max-w-md">
              We lease. You relax. Manage rentals with confidence on TrustKeyper.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
