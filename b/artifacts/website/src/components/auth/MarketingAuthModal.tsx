import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { MarketingAuthContinueButton } from "@/components/auth/MarketingAuthContinueButton";
import { MarketingAuthModalHeader } from "@/components/auth/MarketingAuthModalHeader";
import type { MarketingAuthVerifiedPayload } from "@/components/auth/MarketingAuthModalContext";
import {
  buildExistingAccountPagePath,
  buildMarketingSignupRolePath,
  persistMarketingAuthHandoff,
} from "@/lib/marketingAuthHandoff";
import { fetchMarketingRolesForPhone } from "@/lib/marketingAuthLookup";
import {
  sendMarketingPhoneOtp,
  verifyMarketingPhoneOtp,
} from "@/lib/marketingPhoneOtp";
import {
  createEmptyMarketingOtp,
  formatMarketingPhoneDisplay,
  isMarketingOtpComplete,
  isValidMarketingPhone,
  MARKETING_OTP_LAST_INDEX,
  MARKETING_OTP_RESEND_SECONDS,
  normalizeMarketingPhoneDigits,
} from "@/lib/marketingAuthOtp";
import { cn } from "@/lib/utils";

type AuthPhase = "phone" | "otp";

export interface MarketingAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthVerified?: (payload: MarketingAuthVerifiedPayload) => void;
}

function focusOtpInput(index: number): void {
  document.getElementById(`marketing-auth-otp-${index}`)?.focus();
}

export function MarketingAuthModal({ open, onOpenChange, onAuthVerified }: MarketingAuthModalProps) {
  const [, setLocation] = useLocation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<AuthPhase>("phone");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [otp, setOtp] = useState(createEmptyMarketingOtp);
  const [rememberMe, setRememberMe] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(MARKETING_OTP_RESEND_SECONDS);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setPhase("phone");
    setPhoneDigits("");
    setOtp(createEmptyMarketingOtp());
    setRememberMe(false);
    setResendSeconds(MARKETING_OTP_RESEND_SECONDS);
    setSendingOtp(false);
    setVerifying(false);
    setSendError(null);
    setVerifyError(null);
    setFlowError(null);
  }, []);

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      phoneInputRef.current?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [open, resetState]);

  useEffect(() => {
    if (!open || phase !== "otp" || resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [open, phase, resendSeconds]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  const phoneReady = isValidMarketingPhone(phoneDigits);
  const otpReady = isMarketingOtpComplete(otp);

  const handlePhoneChange = (value: string) => {
    setPhoneDigits(normalizeMarketingPhoneDigits(value));
    setSendError(null);
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setVerifyError(null);
    if (digit && index < MARKETING_OTP_LAST_INDEX) {
      focusOtpInput(index + 1);
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      focusOtpInput(index - 1);
    }
  };

  const handleOtpPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, MARKETING_OTP_LAST_INDEX + 1);
    if (!pasted) return;
    event.preventDefault();
    const next = createEmptyMarketingOtp();
    for (let index = 0; index < pasted.length; index += 1) {
      next[index] = pasted[index] ?? "";
    }
    setOtp(next);
    focusOtpInput(Math.min(pasted.length, MARKETING_OTP_LAST_INDEX));
  };

  const routeAfterOtp = async (accessToken: string | null, refreshToken: string | null) => {
    const roles = await fetchMarketingRolesForPhone(phoneDigits);
    persistMarketingAuthHandoff({
      phone: phoneDigits,
      rememberMe,
      verifiedAt: Date.now(),
      accessToken,
      refreshToken,
    });
    close();
    if (roles.length === 0) {
      setLocation(buildMarketingSignupRolePath());
      return;
    }
    setLocation(buildExistingAccountPagePath(phoneDigits, rememberMe));
  };

  const sendOtp = async () => {
    if (!phoneReady || sendingOtp) return;
    setSendingOtp(true);
    setSendError(null);
    try {
      const error = await sendMarketingPhoneOtp(phoneDigits);
      if (error) {
        setSendError("Could not send OTP. Please try again.");
        return;
      }
      setPhase("otp");
      setOtp(createEmptyMarketingOtp());
      setResendSeconds(MARKETING_OTP_RESEND_SECONDS);
      window.setTimeout(() => focusOtpInput(0), 0);
    } catch {
      setSendError("Could not send OTP. Please try again.");
    } finally {
      setSendingOtp(false);
    }
  };

  const resendOtp = async () => {
    if (resendSeconds > 0 || sendingOtp) return;
    setSendingOtp(true);
    setSendError(null);
    setVerifyError(null);
    try {
      const error = await sendMarketingPhoneOtp(phoneDigits);
      if (error) {
        setSendError("Could not resend OTP. Please try again.");
        return;
      }
      setOtp(createEmptyMarketingOtp());
      setResendSeconds(MARKETING_OTP_RESEND_SECONDS);
      focusOtpInput(0);
    } catch {
      setSendError("Could not resend OTP. Please try again.");
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (!otpReady || verifying) return;
    setVerifying(true);
    setVerifyError(null);
    setFlowError(null);
    try {
      const { error: verifyError, accessToken, refreshToken } = await verifyMarketingPhoneOtp(
        phoneDigits,
        otp.join(""),
      );
      if (verifyError) {
        setVerifyError("Invalid OTP. Please try again.");
        return;
      }
      onAuthVerified?.({
        phone: phoneDigits,
        rememberMe,
        otp: otp.join(""),
      });
      await routeAfterOtp(accessToken, refreshToken);
    } catch {
      setVerifyError("Invalid OTP. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  if (!open) return null;

  const continueDisabled = phase === "phone" ? !phoneReady || sendingOtp : !otpReady || verifying;
  const continueLoading = phase === "otp" && verifying;
  const continueLabel =
    phase === "phone"
      ? sendingOtp
        ? "Sending..."
        : "Continue"
      : verifying
        ? "Verifying..."
        : "Continue";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2b2b2b]/70 px-4 py-6 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[90dvh] w-full max-w-[420px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
      >
        <MarketingAuthModalHeader variant="illustration" onClose={close} />

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
          {phase === "phone" ? (
            <>
              <h2
                id={titleId}
                className="text-center text-[22px] font-semibold leading-snug text-marketing-navy sm:text-2xl"
              >
                Log in or sign up to TrustKeyper
              </h2>

              <div className="mt-6 space-y-2">
                <label htmlFor="marketing-auth-phone" className="text-sm text-marketing-body">
                  Phone Number <span className="text-marketing-navy">*</span>
                </label>
                <div className="flex overflow-hidden rounded-lg border border-[#cbd5e2] bg-white">
                  <span className="flex w-[72px] shrink-0 items-center justify-center border-r border-[#cbd5e2] bg-white text-sm font-medium text-marketing-navy">
                    +91
                  </span>
                  <input
                    ref={phoneInputRef}
                    id="marketing-auth-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    value={phoneDigits}
                    onChange={(event) => handlePhoneChange(event.target.value)}
                    aria-required="true"
                    aria-invalid={sendError ? true : undefined}
                    aria-describedby={sendError ? "marketing-auth-phone-error" : undefined}
                    className="min-w-0 flex-1 bg-white px-4 py-3.5 text-base text-marketing-navy outline-none placeholder:text-marketing-muted/70"
                    placeholder=""
                  />
                </div>
                {sendError ? (
                  <p id="marketing-auth-phone-error" className="text-sm text-red-600">
                    {sendError}
                  </p>
                ) : null}
              </div>

              <label className="mt-5 inline-flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-[#cbd5e2] text-marketing-blue focus:ring-marketing-blue"
                />
                <span className="text-sm text-marketing-body">Keep me logged in</span>
              </label>
            </>
          ) : (
            <>
              <h2
                id={titleId}
                className="text-center text-[22px] font-semibold leading-snug text-marketing-navy sm:text-2xl"
              >
                Enter OTP
              </h2>
              <p className="mt-2 text-center text-sm text-marketing-muted">
                Sent to {formatMarketingPhoneDisplay(phoneDigits)}
              </p>

              <div className="mt-6 grid grid-cols-6 gap-1.5 sm:gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`marketing-auth-otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    value={digit}
                    onChange={(event) => handleOtpChange(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    onPaste={index === 0 ? handleOtpPaste : undefined}
                    aria-label={`OTP digit ${index + 1}`}
                    className={cn(
                      "aspect-square w-full min-w-0 rounded-lg border text-center text-base font-medium text-marketing-navy outline-none transition-colors sm:text-lg",
                      digit
                        ? "border-[#c1eee0] bg-[#e8f7f1]"
                        : "border-[#cbd5e2] bg-white",
                      "focus:border-marketing-blue focus:ring-2 focus:ring-marketing-blue/20",
                    )}
                  />
                ))}
              </div>

              <p className="mt-5 text-center text-sm text-marketing-body">
                Didn&apos;t receive the verification OTP?{" "}
                {resendSeconds > 0 ? (
                  <span className="font-semibold text-marketing-navy">
                    Resend otp in {resendSeconds}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void resendOtp()}
                    disabled={sendingOtp}
                    className="font-semibold text-marketing-blue hover:text-marketing-blue-bright disabled:opacity-60"
                  >
                    {sendingOtp ? "Sending..." : "Resend OTP"}
                  </button>
                )}
              </p>

              {verifyError ? (
                <p className="mt-3 text-center text-sm text-red-600">{verifyError}</p>
              ) : null}
            </>
          )}

          {flowError ? (
            <p className="mt-4 text-center text-sm text-red-600">{flowError}</p>
          ) : null}

          <MarketingAuthContinueButton
            disabled={continueDisabled}
            loading={continueLoading}
            label={continueLabel}
            loadingLabel={continueLabel}
            onClick={() => {
              if (phase === "phone") {
                void sendOtp();
                return;
              }
              void verifyOtp();
            }}
          />

          <p className="mt-5 text-center text-xs leading-relaxed text-marketing-muted sm:text-sm">
            By continuing, you agree to TrustKeyper{" "}
            <Link
              href="/terms-and-conditions"
              onClick={close}
              className="font-medium text-marketing-blue hover:text-marketing-blue-bright"
            >
              Terms and Conditions
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
