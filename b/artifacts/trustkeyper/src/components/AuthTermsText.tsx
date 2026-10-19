import React from "react";

/** 16px below divider — centered on signup screens. */
export function AuthTermsText({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-gray-600 mt-4 text-center ${className}`}>
      By continuing, you agree to TrustKeyper{" "}
      <a
        href="https://trustkeyper.com/terms-and-conditions"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary font-medium hover:underline"
      >
        Terms and Conditions
      </a>
    </p>
  );
}

/** Spacing between a primary auth CTA and footer link (LOGIN / SIGN UP). */
export const AUTH_FOOTER_LINK_CLASS = "text-sm text-gray-500 mt-4 pb-28 sm:pb-0";
