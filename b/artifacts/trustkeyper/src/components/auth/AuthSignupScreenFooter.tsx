import React from "react";
import { AuthSignupBelowCta } from "@/components/auth/AuthSignupBelowCta";

type FooterLink = "login" | "signup" | "none";

interface AuthSignupScreenFooterProps {
  cta: React.ReactNode;
  showTerms?: boolean;
  linkType?: FooterLink;
  persistRole?: string;
}

/** Auth footer: CTA + divider + terms/links inline in page flow. */
export function AuthSignupScreenFooter({
  cta,
  showTerms = true,
  linkType = "login",
  persistRole,
}: AuthSignupScreenFooterProps) {
  const below = (
    <AuthSignupBelowCta
      showTerms={showTerms}
      linkType={linkType}
      persistRole={persistRole}
    />
  );

  return (
    <div className="mt-5 max-w-md w-full">
      {cta}
      {below}
    </div>
  );
}
