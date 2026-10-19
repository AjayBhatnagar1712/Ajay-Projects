import React from "react";
import { ChevronLeft } from "lucide-react";
import sidebarImage from "@assets/Frame_3466237_1777382669479.png";
import { AuthCornerDecor } from "@/components/AuthCornerDecor";
import { AuthMobileBrandBanner } from "@/components/auth/AuthMobileBrandBanner";

interface AuthFlowLayoutProps {
  children: React.ReactNode;
  onBack: () => void;
  backDisabled?: boolean;
}

export function AuthFlowLayout({
  children,
  onBack,
  backDisabled = false,
}: AuthFlowLayoutProps) {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F5F7FA]">
      <div className="hidden lg:block relative bg-primary overflow-hidden shrink-0 h-screen sticky top-0">
        <img src={sidebarImage} alt="" className="h-full w-auto block" />
        <a
          href="https://trustkeyper.com"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-10 left-10 z-10 block h-12 w-[112px] rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="TrustKeyper"
        />
      </div>

      <div className="w-full flex-1 flex flex-col relative min-h-[100dvh] lg:min-h-screen">
        <AuthMobileBrandBanner />

        <div className="flex flex-col flex-1 pt-4 pb-28 px-5 sm:px-6 lg:pt-[60px] lg:pb-16 lg:px-[140px] relative bg-[#F5F7FA] overflow-hidden">
          <AuthCornerDecor className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 lg:absolute lg:bottom-6 lg:right-8 z-[1] w-[min(46vw,220px)] sm:w-[min(40vw,280px)] lg:w-[min(92vw,360px)]" />

          <div className="relative z-10 flex flex-col min-h-0 max-w-full mx-auto w-full lg:max-w-none">
            {!backDisabled && (
              <button
                type="button"
                onClick={onBack}
                className="absolute -left-1 top-0 w-10 h-10 flex items-center justify-center rounded-lg bg-[#E8EEF4] text-gray-700 transition-colors hover:bg-[#DCE4EC] z-10"
                aria-label="Go back"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div
              className={`flex flex-col min-h-0 w-full${!backDisabled ? " [&_.auth-step-heading]:pl-14" : ""}`}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
