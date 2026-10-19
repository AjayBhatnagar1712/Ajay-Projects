import React from "react";
import { AuthTermsText } from "@/components/AuthTermsText";
import { AuthGoToLoginLink, AuthGoToSignupLink } from "@/components/AuthFlowFooterLinks";

type FooterLink = "login" | "signup" | "none";

interface AuthSignupBelowCtaProps {
  showTerms?: boolean;
  linkType?: FooterLink;
  persistRole?: string;
  className?: string;
}

/** Divider + centered terms / alternate auth link — sits below CTA, never in sticky bar. */
export function AuthSignupBelowCta({
  showTerms = true,
  linkType = "login",
  persistRole,
  className = "",
}: AuthSignupBelowCtaProps) {
  const showLink = linkType !== "none";
  if (!showTerms && !showLink) return null;

  return (
    <div className={`w-full max-w-md ${className}`}>
      <hr className="mt-2 border-0 border-t border-gray-200" aria-hidden />
      {showTerms ? <AuthTermsText className="mt-4 text-center" /> : null}
      {linkType === "login" ? (
        <AuthGoToLoginLink className="mt-4 text-center pb-0 sm:pb-0" persistRole={persistRole} />
      ) : null}
      {linkType === "signup" ? (
        <AuthGoToSignupLink className="mt-4 text-center pb-0 sm:pb-0" persistRole={persistRole} />
      ) : null}
    </div>
  );
}
