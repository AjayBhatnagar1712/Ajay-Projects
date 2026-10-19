import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthPhoneField } from "@/components/auth/AuthPhoneField";
import {
  authOtpDigitEmptyClass,
  authOtpDigitFilledClass,
  authPrimaryButtonClass,
} from "@/components/auth/authStyles";
import { createEmptyOtp, OTP_LAST_INDEX } from "@/lib/otp";
import { handleOtpKeyDown } from "@/lib/otpInput";
import { OtpVerifyReadyHint, useOtpVerifyReady } from "@/lib/otpVerifyReady";
import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/phoneOtp";
import { cn } from "@/lib/utils";

export type TenantOnboardModalPhase = "welcome" | "otp" | "account_success";

export type TenantOnboardModalFlowContext = "broker_onboard" | "document_upload";

export interface TenantOnboardModalCopy {
  welcomeTitle: string;
  welcomeDescription: string;
  consentLabel: string;
  successTitle: string;
  successDescription: string;
  successCta: string;
}

export function resolveTenantOnboardModalCopy(input: {
  flowContext: TenantOnboardModalFlowContext;
  requesterName?: string;
  propertyLabel?: string;
}): TenantOnboardModalCopy {
  if (input.flowContext === "document_upload") {
    const requester = input.requesterName?.trim() || "Your property manager";
    const property = input.propertyLabel?.trim();
    return {
      welcomeTitle: "Upload your documents",
      welcomeDescription: property
        ? `${requester} has requested documents for ${property}. Verify your phone to continue securely.`
        : `${requester} has requested documents for your rental application. Verify your phone to continue securely.`,
      consentLabel: "I agree to share my documents with the property owner and broker",
      successTitle: "Phone verified",
      successDescription:
        "You can now upload the documents needed to continue your agreement process.",
      successCta: "Continue to documents",
    };
  }

  return {
    welcomeTitle: "Welcome to TrustKeyper",
    welcomeDescription:
      "Help us understand your rental requirements so we can find properties that best match your needs.",
    consentLabel: "I agree to share my contact details with the Owner and Broker",
    successTitle: "Account Verified",
    successDescription:
      "Let's capture your rental preferences so your broker can find the right property.",
    successCta: "Continue",
  };
}

export function TenantBrokerOnboardModal({
  phase,
  name,
  phone,
  flowContext = "broker_onboard",
  requesterName,
  propertyLabel,
  onNameChange,
  onPhoneChange,
  onClose,
  onOtpVerified,
  onAccountSuccessDone,
  sendOtpError,
  verifyOtpError,
  sendingOtp,
  onSendOtp,
  rememberMe = false,
  onRememberMeChange,
  showRememberMe = false,
}: {
  phase: TenantOnboardModalPhase;
  name: string;
  phone: string;
  flowContext?: TenantOnboardModalFlowContext;
  requesterName?: string;
  propertyLabel?: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onClose?: () => void;
  onOtpVerified: (success: boolean, accessToken?: string | null) => void;
  onAccountSuccessDone: () => void;
  sendOtpError: string | null;
  verifyOtpError: string | null;
  sendingOtp: boolean;
  onSendOtp: () => Promise<boolean>;
  rememberMe?: boolean;
  onRememberMeChange?: (value: boolean) => void;
  showRememberMe?: boolean;
}) {
  const copy = resolveTenantOnboardModalCopy({ flowContext, requesterName, propertyLabel });
  const [agreed, setAgreed] = useState(false);
  const [otp, setOtp] = useState(createEmptyOtp);
  const [countdown, setCountdown] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ name: false, phone: false });
  const { verifyReady, startVerifyReady, isVerifyReady } = useOtpVerifyReady();

  const phoneDigits = phone.replace(/\D/g, "").slice(-10);
  const nameValid = name.trim().length >= 2;
  const phoneValid = phoneDigits.length === 10;
  const canSendOtp = nameValid && phoneValid && agreed && !sendingOtp;
  const otpComplete = otp.every((digit) => digit !== "");

  const nameError = touched.name && !nameValid ? "Enter your full name" : null;
  const phoneError =
    touched.phone && !phoneValid ? "Enter a valid 10-digit mobile number" : null;

  useEffect(() => {
    if (phase !== "otp") return;
    startVerifyReady();
  }, [phase, startVerifyReady]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (phase === "welcome") {
      setOtp(createEmptyOtp());
      setCountdown(0);
      setResendError(null);
    }
  }, [phase]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const next = [...otp];
    next[index] = value.replace(/\D/g, "");
    setOtp(next);
    if (value && index < OTP_LAST_INDEX) {
      document.getElementById(`tenant-onboard-otp-${index + 1}`)?.focus();
    }
  };

  const handleResend = async () => {
    setResendError(null);
    const err = await sendPhoneOtp(phoneDigits);
    if (err) {
      setResendError(err);
      return;
    }
    setCountdown(10);
    setOtp(createEmptyOtp());
    startVerifyReady();
  };

  const handleVerifyOtp = async () => {
    if (!otpComplete || verifying || !isVerifyReady) return;
    setVerifying(true);
    try {
      const { error, accessToken } = await verifyPhoneOtp(phoneDigits, otp.join(""));
      if (error || !accessToken) {
        onOtpVerified(false);
        return;
      }
      onOtpVerified(true, accessToken);
    } finally {
      setVerifying(false);
    }
  };

  const handleSendOtpClick = async () => {
    setTouched({ name: true, phone: true });
    if (!canSendOtp) return;
    const sent = await onSendOtp();
    if (!sent) return;
    setCountdown(10);
    setOtp(createEmptyOtp());
    startVerifyReady();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-onboard-modal-title"
      >
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        ) : null}

        {phase === "account_success" ? (
          <div className="p-8 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{copy.successTitle}</h2>
            <p className="text-sm text-gray-500 mb-6">{copy.successDescription}</p>
            <Button type="button" className={authPrimaryButtonClass} onClick={onAccountSuccessDone}>
              {copy.successCta}
            </Button>
          </div>
        ) : (
          <div className="p-6 sm:p-8">
            <div className="border-b border-gray-100 pb-5 mb-5 pr-8">
              <h2 id="tenant-onboard-modal-title" className="text-lg font-semibold text-gray-900 mb-1">
                {copy.welcomeTitle}
              </h2>
              <p className="text-sm text-gray-500">{copy.welcomeDescription}</p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="tenant-onboard-name" className="text-gray-700">
                  Your Name
                </Label>
                <Input
                  id="tenant-onboard-name"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                  readOnly={phase === "otp"}
                  placeholder="Enter your name"
                  className={cn("h-10", phase === "otp" && "bg-gray-50")}
                  aria-invalid={!!nameError}
                />
                {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
              </div>
              <AuthPhoneField
                id="tenant-onboard-phone"
                label="Email/Phone Number"
                value={phone}
                onChange={onPhoneChange}
                onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                disabled={phase === "otp"}
                helperText={undefined}
                errorText={phoneError ?? sendOtpError}
              />

              {phase === "otp" ? (
                <div className="space-y-2 pt-2">
                  <Label className="text-gray-700">Enter OTP</Label>
                  <div className="flex justify-center gap-2 sm:gap-3">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`tenant-onboard-otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) =>
                          handleOtpKeyDown(index, e, otp, setOtp, "tenant-onboard-otp", () => {
                            void handleVerifyOtp();
                          })
                        }
                        className={cn(
                          "w-11 h-11 sm:w-12 sm:h-12 text-center text-lg font-semibold rounded-lg outline-none transition-colors",
                          digit ? authOtpDigitFilledClass : authOtpDigitEmptyClass,
                        )}
                        aria-label={`OTP digit ${index + 1}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-center text-gray-500">
                    Didn&apos;t receive verification OTP?{" "}
                    {countdown > 0 ? (
                      <span className="text-primary font-medium">Resending in {countdown}s</span>
                    ) : (
                      <button
                        type="button"
                        className="text-primary font-medium hover:underline"
                        onClick={() => void handleResend()}
                      >
                        Resend OTP
                      </button>
                    )}
                  </p>
                  {resendError ? (
                    <p className="text-xs text-center text-destructive">{resendError}</p>
                  ) : null}
                  {verifyOtpError ? (
                    <p className="text-xs text-center text-destructive">{verifyOtpError}</p>
                  ) : null}
                  <OtpVerifyReadyHint seconds={verifyReady} />
                </div>
              ) : (
                <>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
                    <span className="text-sm text-gray-600 leading-snug">{copy.consentLabel}</span>
                  </label>
                  {showRememberMe && onRememberMeChange ? (
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={rememberMe}
                        onCheckedChange={(v) => onRememberMeChange(v === true)}
                      />
                      <span className="text-sm text-gray-600 leading-snug">
                        Remember me on this device
                      </span>
                    </label>
                  ) : null}
                </>
              )}
            </div>

            {phase === "welcome" ? (
              <Button
                type="button"
                className={cn(authPrimaryButtonClass, "w-full")}
                disabled={!canSendOtp}
                onClick={() => void handleSendOtpClick()}
              >
                {sendingOtp ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" /> Sending OTP…
                  </>
                ) : (
                  "Request OTP"
                )}
              </Button>
            ) : (
              <Button
                type="button"
                className={cn(authPrimaryButtonClass, "w-full")}
                disabled={!otpComplete || verifying || !isVerifyReady}
                onClick={() => void handleVerifyOtp()}
              >
                {verifying ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" /> Verifying…
                  </>
                ) : (
                  <>Continue &rarr;</>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
