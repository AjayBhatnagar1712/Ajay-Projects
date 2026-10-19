import React from "react";
import { TrustKeyperLogo } from "@/components/brand/TrustKeyperLogo";
import topPanel from "@assets/auth_mobile_top_panel.png";

/**
 * Mobile signup/login header — blue top panel + white TrustKeyper wordmark.
 * @see auth mobile UI reference (top panel asset).
 */
export function AuthMobileBrandBanner() {
  return (
    <div className="lg:hidden relative w-full shrink-0 overflow-hidden bg-[#1E4FD9]">
      <img
        src={topPanel}
        alt=""
        className="block w-full h-20 object-cover object-center"
        aria-hidden
      />
      <div className="absolute inset-0 flex items-center justify-center px-6 py-5">
        <a
          href="https://trustkeyper.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="TrustKeyper"
        >
          <TrustKeyperLogo variant="inverse" size="authMobile" className="mx-auto object-center" />
        </a>
      </div>
    </div>
  );
}
