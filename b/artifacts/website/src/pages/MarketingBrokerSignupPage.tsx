import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { MarketingAuthFlowShell } from "@/components/auth/MarketingAuthFlowShell";
import { MarketingBrokerSignupForm } from "@/components/auth/MarketingBrokerSignupForm";
import { MarketingSignupSuccessDialog } from "@/components/auth/MarketingSignupSuccessDialog";
import {
  clearMarketingAuthHandoff,
  persistMarketingAuthHandoff,
  readMarketingAuthHandoff,
} from "@/lib/marketingAuthHandoff";
import { buildMarketingExistingAccountUrl } from "@/lib/marketingAppRoutes";
import {
  buildBrokerSignupProfile,
  pushMarketingSignupProfile,
} from "@/lib/marketingSignupApi";

const MOCK_HANDOFF = {
  phone: "6369856040",
  rememberMe: false,
  verifiedAt: Date.now(),
  accessToken: null,
  refreshToken: null,
};

export interface MarketingBrokerSignupPageProps {
  mock?: boolean;
}

export function MarketingBrokerSignupPage({
  mock = false,
}: MarketingBrokerSignupPageProps) {
  const [, setLocation] = useLocation();
  const [fullName, setFullName] = useState("");
  const [firm, setFirm] = useState("");
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
      role: "broker" as const,
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
    if (!fullName.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    void (async () => {
      if (mock) {
        buildBrokerSignupProfile(activeHandoff.phone, fullName, firm);
        setShowSuccess(true);
        setSubmitting(false);
        return;
      }
      const profile = buildBrokerSignupProfile(
        activeHandoff.phone,
        fullName,
        firm,
      );
      const result = await pushMarketingSignupProfile({
        phone: activeHandoff.phone,
        role: "broker",
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
        ariaLabel="Broker signup"
        onClose={showSuccess ? undefined : dismissSignup}
      >
        <MarketingBrokerSignupForm
          fullName={fullName}
          firm={firm}
          submitting={submitting}
          onFullNameChange={setFullName}
          onFirmChange={setFirm}
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
