import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { MarketingAuthContinueButton } from "@/components/auth/MarketingAuthContinueButton";
import { MarketingAuthFlowShell } from "@/components/auth/MarketingAuthFlowShell";
import { MarketingSignupRoleGrid } from "@/components/auth/MarketingSignupRoleGrid";
import {
  clearMarketingAuthHandoff,
  persistMarketingAuthHandoff,
  readMarketingAuthHandoff,
} from "@/lib/marketingAuthHandoff";
import { buildMarketingSignupRoleFormPath } from "@/lib/marketingSignupPaths";
import type { MarketingAuthRole } from "@/lib/marketingAuthRoles";

const ACTIVE_SIGNUP_ROLES: MarketingAuthRole[] = ["owner", "broker"];

const MOCK_HANDOFF = {
  phone: "6369856040",
  rememberMe: false,
  verifiedAt: Date.now(),
  accessToken: null,
  refreshToken: null,
};

export interface MarketingSignupRolePageProps {
  mock?: boolean;
}

export function MarketingSignupRolePage({
  mock = false,
}: MarketingSignupRolePageProps) {
  const [, setLocation] = useLocation();
  const [role, setRole] = useState<MarketingAuthRole | "">("");

  useEffect(() => {
    if (mock) {
      persistMarketingAuthHandoff(MOCK_HANDOFF);
      return;
    }
    const handoff = readMarketingAuthHandoff();
    if (!handoff) {
      setLocation("/");
    }
  }, [mock, setLocation]);

  const tenantSelected = role === "tenant";
  const canContinue = ACTIVE_SIGNUP_ROLES.includes(role as MarketingAuthRole);

  const handleContinue = () => {
    if (!canContinue || !role) return;
    setLocation(buildMarketingSignupRoleFormPath(role));
  };

  const dismissSignup = () => {
    clearMarketingAuthHandoff();
    setLocation("/");
  };

  return (
    <MarketingAuthFlowShell
      ariaLabel="Choose your role"
      onClose={dismissSignup}
    >
      <h1 className="border-b border-marketing-muted/20 pb-4 text-center text-[22px] font-semibold leading-snug text-marketing-navy sm:text-2xl">
        I am a
      </h1>

      <div className="mt-6">
        <MarketingSignupRoleGrid value={role} onChange={setRole} />
      </div>

      {tenantSelected ? (
        <p className="mt-4 text-center text-sm text-marketing-muted">
          Tenant signup is coming soon. If your broker shared a link, open it to
          complete onboarding.
        </p>
      ) : null}

      <MarketingAuthContinueButton
        disabled={!canContinue}
        onClick={handleContinue}
      />
    </MarketingAuthFlowShell>
  );
}
