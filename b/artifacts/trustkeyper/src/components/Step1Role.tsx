import React from "react";
import { Button } from "@/components/ui/button";
import { AuthEntryRoleGrid } from "@/components/auth/AuthEntryRoleGrid";
import { AuthSignupScreenFooter } from "@/components/auth/AuthSignupScreenFooter";
import { AuthStepHeading } from "@/components/auth/AuthStepHeading";
import { authMobileScrollPadClass, authPrimaryButtonClass } from "@/components/auth/authStyles";
import { isAuthEntryRole } from "@/lib/auth";

interface Step1RoleProps {
  role: string;
  setRole: (role: string) => void;
  onNext: () => void;
  footerLinkType?: "login" | "signup";
}

export default function Step1Role({
  role,
  setRole,
  onNext,
  footerLinkType = "login",
}: Step1RoleProps) {
  const tenantSelected = role === "tenant";
  const canContinue = isAuthEntryRole(role) && !tenantSelected;

  const cta = (
    <Button size="lg" onClick={onNext} disabled={!canContinue} className={authPrimaryButtonClass}>
      Continue
    </Button>
  );

  const persistRole = isAuthEntryRole(role) ? role : undefined;

  return (
    <div className={`flex flex-col h-full mx-auto w-full max-w-md lg:max-w-none ${authMobileScrollPadClass}`}>
      <AuthStepHeading title="I am a" />

      <AuthEntryRoleGrid
        value={role}
        onChange={(r) => setRole(r)}
      />

      {tenantSelected ? (
        <p className="mt-4 text-sm text-gray-500 text-center max-w-md">
          Tenant signup is coming soon. If your broker shared a link, open it to complete onboarding.
        </p>
      ) : null}

      {/* Always render the footer so the sticky CTA bar is visible on mobile even before selection */}
      <AuthSignupScreenFooter
        cta={cta}
        showTerms={false}
        linkType={footerLinkType}
        persistRole={persistRole}
      />
    </div>
  );
}
