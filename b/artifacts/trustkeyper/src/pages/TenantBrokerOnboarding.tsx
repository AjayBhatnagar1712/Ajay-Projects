import React, { useCallback, useEffect, useState } from "react";
import { useRoute } from "wouter";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharedPropertyLandingBackdrop } from "@/components/tenant/SharedPropertyLandingBackdrop";
import {
  TenantBrokerOnboardModal,
  type TenantOnboardModalPhase,
} from "@/components/tenant/TenantBrokerOnboardModal";
import { TenantOnboardRequirementFlow } from "@/components/tenant/TenantOnboardRequirementFlow";
import { markInviteStartedLocally, markInviteSubmittedLocally } from "@/lib/brokerTenantOnboarding";
import { fetchBrokerOnboardInvite } from "@/lib/publicBrokerTenantOnboard";
import { sendPhoneOtp } from "@/lib/phoneOtp";
import {
  clearTenantBrokerOnboardSession,
  getTenantBrokerOnboardSession,
  setTenantBrokerOnboardSession,
  type TenantBrokerOnboardSession,
} from "@/lib/tenantBrokerOnboardSession";

type PagePhase =
  | "loading"
  | "invalid"
  | "expired"
  | "already_submitted"
  | "modal"
  | "requirements"
  | "done";

export default function TenantBrokerOnboarding() {
  const [, params] = useRoute("/onboard/tenant/:token");
  const token = params?.token ?? "";

  const [pagePhase, setPagePhase] = useState<PagePhase>("loading");
  const [modalPhase, setModalPhase] = useState<TenantOnboardModalPhase>("welcome");
  const [brokerName, setBrokerName] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sendOtpError, setSendOtpError] = useState<string | null>(null);
  const [verifyOtpError, setVerifyOtpError] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [session, setSession] = useState<TenantBrokerOnboardSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    if (!token) {
      setPagePhase("invalid");
      setLoadError("Invalid onboarding link");
      return;
    }

    setPagePhase("loading");
    const { payload, error, status } = await fetchBrokerOnboardInvite(token);
    if (!payload) {
      if (status === 410) {
        setPagePhase("expired");
        setLoadError(error ?? "This onboarding link has expired");
        return;
      }
      setPagePhase("invalid");
      setLoadError(error ?? "Invalid onboarding link");
      return;
    }

    if (payload.status === "expired") {
      setPagePhase("expired");
      setLoadError("This onboarding link has expired");
      return;
    }

    if (payload.status === "submitted" || payload.status === "requirements_submitted") {
      clearTenantBrokerOnboardSession(token);
      setPagePhase("already_submitted");
      setBrokerName(payload.brokerName);
      return;
    }

    markInviteStartedLocally(token);

    const existingSession = getTenantBrokerOnboardSession(token);
    if (existingSession) {
      setSession(existingSession);
      setPagePhase("requirements");
      return;
    }

    setBrokerName(payload.brokerName);
    setName(payload.tenantName);
    setPhone(payload.tenantPhone.replace(/\D/g, "").slice(-10));
    setModalPhase("welcome");
    setPagePhase("modal");
  }, [token]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const handleSendOtp = async (): Promise<boolean> => {
    setSendOtpError(null);
    setSendingOtp(true);
    try {
      const digits = phone.replace(/\D/g, "").slice(-10);
      const err = await sendPhoneOtp(digits);
      if (err) {
        setSendOtpError(err);
        return false;
      }
      setModalPhase("otp");
      return true;
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpVerified = (success: boolean) => {
    if (!success) {
      setVerifyOtpError("Invalid or expired OTP. Please try again.");
      return;
    }
    setVerifyOtpError(null);
    const nextSession: TenantBrokerOnboardSession = {
      token,
      name: name.trim(),
      phone: `+91${phone.replace(/\D/g, "").slice(-10)}`,
      brokerName,
      verifiedAt: Date.now(),
    };
    setTenantBrokerOnboardSession(nextSession);
    setSession(nextSession);
    setModalPhase("account_success");
  };

  const handleAccountSuccessDone = () => {
    setPagePhase("requirements");
  };

  const handleFlowDone = () => {
    markInviteSubmittedLocally(token);
    clearTenantBrokerOnboardSession(token);
    setPagePhase("done");
    window.location.href = "/";
  };

  if (pagePhase === "loading") {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6">
        <Loader2 size={32} className="animate-spin text-primary mb-4" />
        <p className="text-sm text-gray-500">Loading your invitation…</p>
      </div>
    );
  }

  if (pagePhase === "requirements" && session) {
    return <TenantOnboardRequirementFlow session={session} onDone={handleFlowDone} />;
  }

  if (pagePhase === "done") {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6">
        <p className="text-sm text-gray-600">Thank you. You can close this tab.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 overflow-hidden blur-sm pointer-events-none select-none">
        <SharedPropertyLandingBackdrop />
      </div>

      {pagePhase === "modal" ? (
        <TenantBrokerOnboardModal
          phase={modalPhase}
          name={name}
          phone={phone}
          onNameChange={setName}
          onPhoneChange={setPhone}
          onOtpVerified={handleOtpVerified}
          onAccountSuccessDone={handleAccountSuccessDone}
          sendOtpError={sendOtpError}
          verifyOtpError={verifyOtpError}
          sendingOtp={sendingOtp}
          onSendOtp={handleSendOtp}
        />
      ) : null}

      {pagePhase === "invalid" || pagePhase === "expired" || pagePhase === "already_submitted" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {pagePhase === "already_submitted"
                ? "Requirements already submitted"
                : pagePhase === "expired"
                  ? "Link expired"
                  : "Invalid link"}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {pagePhase === "already_submitted"
                ? `Your rental requirements were already shared with ${brokerName || "your broker"}.`
                : (loadError ?? "This onboarding link is not valid.")}
            </p>
            <Button type="button" variant="outline" onClick={() => (window.location.href = "/")}>
              Go to TrustKeyper
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
