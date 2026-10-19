import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { MarketingAuthFlowShell } from "@/components/auth/MarketingAuthFlowShell";
import { MarketingOwnerSignupForm } from "@/components/auth/MarketingOwnerSignupForm";
import { MarketingSignupSuccessDialog } from "@/components/auth/MarketingSignupSuccessDialog";
import {
  clearMarketingAuthHandoff,
  persistMarketingAuthHandoff,
  readMarketingAuthHandoff,
} from "@/lib/marketingAuthHandoff";
import { buildMarketingExistingAccountUrl } from "@/lib/marketingAppRoutes";
import {
  buildOwnerSignupProfile,
  pushMarketingSignupProfile,
} from "@/lib/marketingSignupApi";

const MOCK_HANDOFF = {
  phone: "6369856040",
  rememberMe: false,
  verifiedAt: Date.now(),
  accessToken: null,
  refreshToken: null,
};

export interface MarketingOwnerSignupPageProps {
  mock?: boolean;
}

export function MarketingOwnerSignupPage({
  mock = false,
}: MarketingOwnerSignupPageProps) {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [propertyCount, setPropertyCount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handoff = readMarketingAuthHandoff();
  const activeHandoff = mock ? (handoff ?? MOCK_HANDOFF) : handoff;

  useEffect(() => {
    if (mock) {
      persistMarketingAuthHandoff(MOCK_HANDOFF);
      return;
    }
    if (!handoff) {
      setLocation("/");
    }
  }, [handoff, mock, setLocation]);

  if (!activeHandoff) {
    return null;
  }

  const finishToDashboard = () => {
    if (mock) {
      clearMarketingAuthHandoff();
      setLocation("/");
      return;
    }
    const params = {
      phone: activeHandoff.phone,
      role: "owner" as const,
      rememberMe: activeHandoff.rememberMe,
      accessToken: activeHandoff.accessToken,
      refreshToken: activeHandoff.refreshToken,
    };
    clearMarketingAuthHandoff();
    window.location.assign(buildMarketingExistingAccountUrl(params));
  };

  const dismissSignup = () => {
    clearMarketingAuthHandoff();
    setLocation("/");
  };

  const handleSubmit = () => {
    if (!name.trim() || !propertyCount || submitting) return;
    setSubmitting(true);
    setError(null);
    void (async () => {
      if (mock) {
        buildOwnerSignupProfile(activeHandoff.phone, name, propertyCount);
        setShowSuccess(true);
        setSubmitting(false);
        return;
      }
      const profile = buildOwnerSignupProfile(
        activeHandoff.phone,
        name,
        propertyCount,
      );
      const result = await pushMarketingSignupProfile({
        phone: activeHandoff.phone,
        role: "owner",
        profile,
        accessToken: activeHandoff.accessToken,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not create your account.");
        setSubmitting(false);
        return;
      }
      setShowSuccess(true);
      setSubmitting(false);
    })();
  };

  return (
    <>
      <MarketingAuthFlowShell
        ariaLabel="Property owner signup"
        onClose={showSuccess ? undefined : dismissSignup}
      >
        <MarketingOwnerSignupForm
          name={name}
          propertyCount={propertyCount}
          submitting={submitting}
          onNameChange={setName}
          onPropertyCountChange={setPropertyCount}
          onSubmit={handleSubmit}
        />
        {error ? (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        ) : null}
      </MarketingAuthFlowShell>

      <MarketingSignupSuccessDialog
        open={showSuccess}
        onContinue={finishToDashboard}
      />
    </>
  );
}
