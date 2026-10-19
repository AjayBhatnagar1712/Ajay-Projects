import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AuthPhoneField } from "@/components/auth/AuthPhoneField";
import { AuthTextField } from "@/components/auth/AuthTextField";
import { AuthSignupScreenFooter } from "@/components/auth/AuthSignupScreenFooter";
import { AuthStepHeading } from "@/components/auth/AuthStepHeading";
import {
  authMobileScrollPadClass,
  authOtpDigitEmptyClass,
  authOtpDigitFilledClass,
  authPrimaryButtonClass,
} from "@/components/auth/authStyles";
import { toast } from "@/hooks/use-toast";
import { createEmptyOtp, OTP_LAST_INDEX } from "@/lib/otp";
import { handleOtpKeyDown } from "@/lib/otpInput";
import { Spinner } from "@/components/ui/spinner";
import { OtpVerifyReadyHint, useOtpVerifyReady } from "@/lib/otpVerifyReady";
import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/phoneOtp";

interface OwnerStep4OTPProps {
  phone: string;
  details: { name: string; phone: string };
  onNext: (accessToken: string) => Promise<void>;
}

export default function OwnerStep4OTP({ phone, details, onNext }: OwnerStep4OTPProps) {
  const [otp, setOtp] = useState(createEmptyOtp);
  const [countdown, setCountdown] = useState(10);
  const [verifying, setVerifying] = useState(false);
  const { verifyReady, startVerifyReady, isVerifyReady } = useOtpVerifyReady();

  useEffect(() => {
    startVerifyReady();
  }, [startVerifyReady]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value.replace(/\D/g, "");
    setOtp(newOtp);
    if (value && index < OTP_LAST_INDEX) {
      document.getElementById(`owner-otp-${index + 1}`)?.focus();
    }
  };

  const isComplete = otp.every((digit) => digit !== "");
  const displayPhone = phone.replace(/\D/g, "").slice(0, 10);

  const resendOwnerOtp = async () => {
    const err = await sendPhoneOtp(displayPhone);
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

  const handleContinue = async () => {
    if (!isComplete || verifying || !isVerifyReady) return;
    setVerifying(true);
    try {
      const { error: verifyError, accessToken } = await verifyPhoneOtp(
        displayPhone,
        otp.join(""),
      );
      if (verifyError) {
        toast({
          title: "Invalid OTP. Please try again.",
          variant: "destructive",
        });
        return;
      }
      if (!accessToken) {
        toast({
          title: "Could not sign you in",
          description: "Please try again.",
          variant: "destructive",
        });
        return;
      }
      await onNext(accessToken);
    } finally {
      setVerifying(false);
    }
  };

  const cta = (
    <Button
      size="lg"
      onClick={() => void handleContinue()}
      disabled={!isComplete || verifying || !isVerifyReady}
      className={authPrimaryButtonClass}
    >
      {verifying ? (
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
    <div className={`flex flex-col h-full max-w-md w-full mx-auto lg:max-w-2xl lg:mx-0 ${authMobileScrollPadClass}`}>
      <AuthStepHeading title="Let's know you better" />

      <div className="space-y-6 mb-8 max-w-md opacity-70 pointer-events-none">
        <AuthTextField id="owner-otp-name" label="Your Name" value={details.name} onChange={() => {}} disabled />
        <AuthPhoneField id="owner-otp-phone" value={displayPhone} onChange={() => {}} disabled helperText="" />
      </div>

      <div className="mb-4 max-w-md">
        <p className="text-gray-500 text-sm mb-4">
          Enter the OTP that we have sent to{" "}
          <span className="font-semibold text-gray-900">+91 {displayPhone}</span>
        </p>
        <div className="grid grid-cols-6 gap-2 sm:gap-3 mb-4 w-full max-w-md">
          {otp.map((digit, i) => (
            <input
              key={i}
              id={`owner-otp-${i}`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label={`Digit ${i + 1} of 6`}
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) =>
                handleOtpKeyDown(i, e, otp, setOtp, "owner-otp", () => {
                  if (isVerifyReady) void handleContinue();
                })
              }
              className={`w-full h-11 sm:h-12 text-center text-xl font-medium rounded-lg outline-none transition-colors
                ${digit ? authOtpDigitFilledClass : authOtpDigitEmptyClass}`}
            />
          ))}
        </div>
        <p className="text-sm text-gray-500">
          Didn&apos;t receive the verification OTP?{" "}
          {countdown > 0 ? (
            <span className="font-medium text-primary">Resend otp in {countdown}s</span>
          ) : (
            <button
              type="button"
              onClick={() => void resendOwnerOtp()}
              className="font-medium text-primary hover:underline"
            >
              Resend otp
            </button>
          )}
        </p>
      </div>

      <AuthSignupScreenFooter
        cta={
          <>
            {cta}
            <OtpVerifyReadyHint seconds={verifyReady} />
          </>
        }
        showTerms={false}
        linkType="none"
        persistRole="owner"
      />
    </div>
  );
}
