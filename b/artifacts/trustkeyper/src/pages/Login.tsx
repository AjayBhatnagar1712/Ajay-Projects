import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AuthFlowLayout } from "@/components/AuthFlowLayout";
import { AuthPhoneField } from "@/components/auth/AuthPhoneField";
import { AuthSignupScreenFooter } from "@/components/auth/AuthSignupScreenFooter";
import { AuthEntryRoleGrid } from "@/components/auth/AuthEntryRoleGrid";
import { AuthStepHeading } from "@/components/auth/AuthStepHeading";
import {
  authMobileScrollPadClass,
  authOtpDigitEmptyClass,
  authOtpDigitFilledClass,
  authPrimaryButtonClass,
} from "@/components/auth/authStyles";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { resolveTenantPostLoginRoute } from "@/lib/tenantPostLoginRoute";
import {
  type AccountLookupResult,
  type AuthEntryRole,
  type Role,
  canProceedWithLoginLookup,
  clearInvalidAuthPendingRole,
  clearRememberedSessionFromLocalStorage,
  dashboardRouteFor,
  describeLoginPhoneHint,
  loginLookupErrorMessage,
  loginSuccess,
  lookupAccountForAuth,
  persistSessionToLocalStorage,
  readAuthPendingRole,
  setAuthPendingRole,
  restoreRememberedSessionFromLocalStorage,
  roleDisplayLabel,
} from "@/lib/auth";
import { resetSessionForAuthEntry } from "@/lib/authPublicEntry";
import { clearActiveSessionBackup } from "@/lib/initAppStorage";
import { createEmptyOtp, OTP_LAST_INDEX } from "@/lib/otp";
import { handleOtpKeyDown } from "@/lib/otpInput";
import { Spinner } from "@/components/ui/spinner";
import { OtpVerifyReadyHint, useOtpVerifyReady } from "@/lib/otpVerifyReady";
import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/phoneOtp";

type Phase = "role" | "phone" | "otp";

function postAuthRoute(role: Role, phone: string): string {
  if (role === "tenant") return resolveTenantPostLoginRoute(phone);
  return dashboardRouteFor(role);
}

/** Phone + OTP login (role from signup / session — no "I am a" cards). */
export default function Login() {
  const [, setLocation] = useLocation();
  const [loginRole, setLoginRole] = useState<AuthEntryRole | null>(() => readAuthPendingRole());
  const [phase, setPhase] = useState<Phase>(() => (readAuthPendingRole() ? "phone" : "role"));
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(createEmptyOtp);
  const [countdown, setCountdown] = useState(10);
  const [accountLookup, setAccountLookup] = useState<AccountLookupResult | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { verifyReady, startVerifyReady, isVerifyReady } = useOtpVerifyReady();

  useEffect(() => {
    const remembered = restoreRememberedSessionFromLocalStorage();
    if (remembered) {
      setLocation(postAuthRoute(remembered.role, remembered.phone));
      return;
    }

    resetSessionForAuthEntry();
    clearInvalidAuthPendingRole();
    const pending = readAuthPendingRole();
    if (pending) {
      setLoginRole(pending);
      setPhase((current) => (current === "role" ? "phone" : current));
    }
  }, [setLocation]);

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

  const goToPhoneStep = () => {
    if (!loginRole) return;
    setAuthPendingRole(loginRole);
    setPhase("phone");
  };

  const handleOtpChange = (index: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(0, 1);
    const next = [...otp];
    next[index] = v;
    setOtp(next);
    if (v && index < OTP_LAST_INDEX) {
      document.getElementById(`login-otp-${index + 1}`)?.focus();
    }
  };

  const finishLogin = async () => {
    if (!loginRole || !isVerifyReady) return;
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
      const { error: verifyError, accessToken } = await verifyPhoneOtp(phoneDigits, otp.join(""));
      if (verifyError) {
        toast({
          title: "Invalid OTP. Please try again.",
          variant: "destructive",
        });
        return;
      }
      const ok = await loginSuccess(phoneDigits, loginRole, accessToken);
      if (ok) {
        if (rememberMe) {
          persistSessionToLocalStorage(phoneDigits, loginRole);
        } else {
          clearRememberedSessionFromLocalStorage();
          clearActiveSessionBackup();
        }
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

  const phoneHint = loginRole ? describeLoginPhoneHint(accountLookup, loginRole) : null;
  const accountExistsForLogin =
    phoneDigits.length === 10 &&
    accountLookup !== null &&
    canProceedWithLoginLookup(accountLookup);
  const isOtpComplete = otp.every((d) => d !== "");

  const resendLoginOtp = async () => {
    const err = await sendPhoneOtp(phoneDigits);
    if (err) {
      toast({
        title: "Could not send OTP",
        description: err,
        variant: "destructive",
      });
      return;
    }
    setCountdown(10);
    setOtp(createEmptyOtp());
    startVerifyReady();
  };

  const rolePickCta = (
    <Button
      size="lg"
      disabled={!loginRole}
      onClick={goToPhoneStep}
      className={authPrimaryButtonClass}
    >
      Continue &rarr;
    </Button>
  );

  const requestOtpCta = (
    <Button
      size="lg"
      disabled={!accountExistsForLogin}
      onClick={() => {
        void (async () => {
          if (!accountExistsForLogin) return;
          const err = await sendPhoneOtp(phoneDigits);
          if (err) {
            toast({
              title: "Could not send OTP",
              description: err,
              variant: "destructive",
            });
            return;
          }
          setCountdown(10);
          setOtp(createEmptyOtp());
          startVerifyReady();
          setPhase("otp");
        })();
      }}
      className={authPrimaryButtonClass}
    >
      Request OTP &rarr;
    </Button>
  );

  const continueLoginCta = (
    <Button
      size="lg"
      disabled={!isOtpComplete || loggingIn || !isVerifyReady}
      onClick={() => void finishLogin()}
      className={authPrimaryButtonClass}
    >
      {loggingIn ? (
        <>
          <Spinner className="mr-2" />
          Verifying...
        </>
      ) : (
        <>Continue &rarr;</>
      )}
    </Button>
  );

  return (
    <AuthFlowLayout onBack={handleBack} backDisabled={false}>
      <div className={`flex flex-col flex-1 min-h-0 max-w-md w-full ${authMobileScrollPadClass}`}>
        {phase === "role" && (
          <>
            <AuthStepHeading
              title="Login to TrustKeyper"
              subtitle="Select your account type to continue"
            />
            <AuthEntryRoleGrid
              value={loginRole ?? ""}
              onChange={(role) => {
                setLoginRole(role);
                setAuthPendingRole(role);
              }}
            />
            <p className="text-gray-500 mb-2 mt-4 text-sm">
              Tenants who completed document upload can log in with the same mobile number.
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
          <>
        <div className="auth-step-heading mb-8 border-b border-gray-200 pb-4 shrink-0">
          <h1 className="text-3xl font-semibold text-gray-900">
            Login to TrustKeyper as {roleDisplayLabel(loginRole)}
          </h1>
        </div>

        {phase === "phone" && (
          <>
            <div className="max-w-md mb-6">
              <AuthPhoneField
                id="login-phone"
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

        {phase === "otp" && (
          <>
            <div className="space-y-6 mb-6 max-w-md opacity-80 pointer-events-none">
              <AuthPhoneField
                id="login-otp-phone-readonly"
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
                  id={`login-otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label={`Digit ${i + 1} of 6`}
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) =>
                    handleOtpKeyDown(i, e, otp, setOtp, "login-otp", () => {
                      if (isVerifyReady) void finishLogin();
                    })
                  }
                  className={`w-full h-11 sm:h-12 text-center text-xl font-medium rounded-lg outline-none transition-colors
                    ${digit ? authOtpDigitFilledClass : authOtpDigitEmptyClass}`}
                />
              ))}
            </div>

            <div className="mb-4 flex max-w-md items-start gap-2">
              <Checkbox
                id="login-remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                disabled={loggingIn}
                className="mt-0.5"
              />
              <Label
                htmlFor="login-remember-me"
                className="cursor-pointer text-sm font-normal leading-snug text-gray-600"
              >
                Remember me on this device
              </Label>
            </div>

            <p className="text-sm text-gray-600 mb-2 max-w-md">
              Didn&apos;t receive the verification OTP?{" "}
              {countdown > 0 ? (
                <span className="font-medium text-[#2563EB]">Resend otp in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void resendLoginOtp()}
                  className="font-medium text-[#2563EB] hover:underline"
                >
                  Resend otp
                </button>
              )}
            </p>

            <AuthSignupScreenFooter
              cta={
                <>
                  {continueLoginCta}
                  <OtpVerifyReadyHint seconds={verifyReady} />
                </>
              }
              showTerms={false}
              linkType="signup"
              persistRole={loginRole}
            />
          </>
        )}
          </>
        )}
      </div>
    </AuthFlowLayout>
  );
}
