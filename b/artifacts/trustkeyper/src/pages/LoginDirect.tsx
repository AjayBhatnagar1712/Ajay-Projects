import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AuthFlowLayout } from "@/components/AuthFlowLayout";
import { AuthEntryRoleGrid } from "@/components/auth/AuthEntryRoleGrid";
import { AuthPhoneField } from "@/components/auth/AuthPhoneField";
import { AuthSignupScreenFooter } from "@/components/auth/AuthSignupScreenFooter";
import { AuthStepHeading } from "@/components/auth/AuthStepHeading";
import {
  authMobileScrollPadClass,
  authOtpDigitEmptyClass,
  authOtpDigitFilledClass,
  authPrimaryButtonClass,
} from "@/components/auth/authStyles";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { resolveTenantPostLoginRoute } from "@/lib/tenantPostLoginRoute";
import {
  type AccountLookupResult,
  type AuthEntryRole,
  type Role,
  canProceedWithLoginLookup,
  clearInvalidAuthPendingRole,
  dashboardRouteFor,
  describeLoginPhoneHint,
  isAuthEntryRole,
  loginLookupErrorMessage,
  loginSuccess,
  lookupAccountForAuth,
  readAuthPendingRole,
  roleDisplayLabel,
  setAuthPendingRole,
} from "@/lib/auth";
import { resetSessionForAuthEntry } from "@/lib/authPublicEntry";
import { createEmptyOtp, OTP_LAST_INDEX } from "@/lib/otp";

type Phase = "role" | "phone" | "otp";

function postAuthRoute(role: Role, phone: string): string {
  if (role === "tenant") return resolveTenantPostLoginRoute(phone);
  return dashboardRouteFor(role);
}

/** Login with "I am a" role cards — not linked in app until enabled. */
export default function LoginDirect() {
  const [, setLocation] = useLocation();
  const [loginRole, setLoginRole] = useState<AuthEntryRole | null>(() => readAuthPendingRole());
  const [phase, setPhase] = useState<Phase>(() => (readAuthPendingRole() ? "phone" : "role"));
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(createEmptyOtp);
  const [countdown, setCountdown] = useState(10);
  const [accountLookup, setAccountLookup] = useState<AccountLookupResult | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    resetSessionForAuthEntry();
    clearInvalidAuthPendingRole();
    const pending = readAuthPendingRole();
    if (pending) {
      setLoginRole(pending);
      setPhase((p) => (p === "role" ? "phone" : p));
    }
  }, []);

  useEffect(() => {
    if (phase !== "otp" || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, phase]);

  const phoneDigits = phone.replace(/\D/g, "").slice(0, 10);

  useEffect(() => {
    if (!loginRole || phoneDigits.length !== 10) {
      setAccountLookup(null);
      return;
    }
    let cancelled = false;
    void lookupAccountForAuth(phoneDigits, loginRole).then((lookup) => {
      if (!cancelled) setAccountLookup(lookup);
    });
    return () => {
      cancelled = true;
    };
  }, [phoneDigits, loginRole]);

  const handleBack = () => {
    if (phase === "otp") {
      setPhase("phone");
      setOtp(createEmptyOtp());
      return;
    }
    if (phase === "phone") {
      setPhase("role");
      setPhone("");
      setAccountLookup(null);
      return;
    }
    setLocation("/");
  };

  const handleOtpChange = (index: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(0, 1);
    const next = [...otp];
    next[index] = v;
    setOtp(next);
    if (v && index < OTP_LAST_INDEX) {
      document.getElementById(`logindirect-otp-${index + 1}`)?.focus();
    }
  };

  const finishLogin = async () => {
    if (!loginRole) return;
    setLoggingIn(true);
    try {
      const lookup = await lookupAccountForAuth(phoneDigits, loginRole);
      const loginError = loginLookupErrorMessage(lookup);
      if (loginError) {
        toast({
          title: loginError.title,
          description: loginError.description,
          variant: "destructive",
        });
        return;
      }
      const ok = await loginSuccess(phoneDigits, loginRole);
      if (ok) {
        toast({ title: "Signed in", description: "Welcome back to TrustKeyper." });
        setLocation(postAuthRoute(loginRole, phoneDigits));
        return;
      }
      const postLoginError = loginLookupErrorMessage(
        await lookupAccountForAuth(phoneDigits, loginRole),
      );
      toast({
        title: postLoginError?.title ?? "No account found",
        description:
          postLoginError?.description ??
          "Sign up first, then log in on any device with the same number.",
        variant: "destructive",
      });
    } finally {
      setLoggingIn(false);
    }
  };

  const goToPhoneStep = () => {
    if (!loginRole) return;
    setAuthPendingRole(loginRole);
    setPhase("phone");
  };

  const phoneHint = loginRole ? describeLoginPhoneHint(accountLookup, loginRole) : null;
  const accountExistsForLogin =
    phoneDigits.length === 10 &&
    accountLookup !== null &&
    canProceedWithLoginLookup(accountLookup);
  const isOtpComplete = otp.every((d) => d !== "");

  const rolePickCta = (
    <Button
      size="lg"
      disabled={!loginRole}
      onClick={goToPhoneStep}
      className={authPrimaryButtonClass}
    >
      Continue
    </Button>
  );

  const requestOtpCta = (
    <Button
      size="lg"
      disabled={!accountExistsForLogin}
      onClick={() => {
        if (!accountExistsForLogin) return;
        setCountdown(10);
        setOtp(createEmptyOtp());
        setPhase("otp");
      }}
      className={authPrimaryButtonClass}
    >
      Request OTP &rarr;
    </Button>
  );

  const continueLoginCta = (
    <Button
      size="lg"
      disabled={!isOtpComplete || loggingIn}
      onClick={() => void finishLogin()}
      className={authPrimaryButtonClass}
    >
      Continue &rarr;
    </Button>
  );

  return (
    <AuthFlowLayout onBack={handleBack} backDisabled={false}>
      <div className={`flex flex-col flex-1 min-h-0 max-w-md w-full mx-auto lg:mx-0 ${authMobileScrollPadClass}`}>
        {phase === "role" && (
          <>
            <AuthStepHeading
              title="Login to TrustKeyper"
              subtitle="Select your account type to continue"
            />

            <AuthEntryRoleGrid
              value={loginRole ?? ""}
              onChange={(r) => {
                setLoginRole(r);
                setAuthPendingRole(r);
              }}
            />

            <p className="text-gray-500 mb-2 mt-4 text-sm text-center lg:text-left">
              Use the same role you chose when you signed up
            </p>

            <AuthSignupScreenFooter
              cta={rolePickCta}
              showTerms={false}
              linkType="signup"
              persistRole={loginRole ?? undefined}
            />
          </>
        )}

        {phase !== "role" && loginRole && (
          <div className="auth-step-heading mb-8 border-b border-gray-200 pb-4 shrink-0 text-center lg:text-left">
            <h1 className="text-3xl font-semibold text-gray-900">
              Login to TrustKeyper as {roleDisplayLabel(loginRole)}
            </h1>
          </div>
        )}

        {phase === "phone" && loginRole && (
          <>
            <div className="max-w-md mb-6">
              <AuthPhoneField
                id="logindirect-phone"
                value={phoneDigits}
                onChange={setPhone}
                helperText={phoneHint?.helperText ?? undefined}
                errorText={phoneHint?.errorText ?? null}
              />
            </div>
            <AuthSignupScreenFooter
              cta={requestOtpCta}
              showTerms={false}
              linkType="signup"
              persistRole={loginRole}
            />
          </>
        )}

        {phase === "otp" && loginRole && (
          <>
            <div className="space-y-6 mb-6 max-w-md opacity-80 pointer-events-none">
              <AuthPhoneField
                id="logindirect-otp-phone-readonly"
                value={phoneDigits}
                onChange={() => {}}
                disabled
                helperText=""
              />
            </div>

            <p className="text-gray-600 text-sm mb-4 max-w-md">
              Enter the OTP that we have sent to{" "}
              <span className="font-semibold text-gray-900">+91 {phoneDigits}</span>
            </p>

            <div className="grid grid-cols-6 gap-2 sm:gap-3 mb-4 max-w-md w-full">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  id={`logindirect-otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  className={`w-full h-11 sm:h-12 text-center text-xl font-medium rounded-lg outline-none transition-colors
                    ${digit ? authOtpDigitFilledClass : authOtpDigitEmptyClass}`}
                />
              ))}
            </div>

            <p className="text-sm text-gray-600 mb-2 max-w-md">
              Didn&apos;t receive the verification OTP?{" "}
              {countdown > 0 ? (
                <span className="font-medium text-[#2563EB]">Resend otp in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setCountdown(10)}
                  className="font-medium text-[#2563EB] hover:underline"
                >
                  Resend otp
                </button>
              )}
            </p>

            <AuthSignupScreenFooter
              cta={continueLoginCta}
              showTerms={false}
              linkType="signup"
              persistRole={loginRole}
            />
          </>
        )}
      </div>
    </AuthFlowLayout>
  );
}
