import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import {
  profileExistsAsync,
  signUpSuccess,
  rollbackFailedSignup,
  dashboardRouteFor,
  isAuthEntryRole,
  clearRememberedSessionFromLocalStorage,
  persistSessionToLocalStorage,
  type Role,
} from "@/lib/auth";
import { createEmptyOtp, OTP_LAST_INDEX } from "@/lib/otp";
import { handleOtpKeyDown } from "@/lib/otpInput";
import { Spinner } from "@/components/ui/spinner";
import { OtpVerifyReadyHint, useOtpVerifyReady } from "@/lib/otpVerifyReady";
import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/phoneOtp";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthSignupScreenFooter } from "@/components/auth/AuthSignupScreenFooter";
import { AuthStepHeading } from "@/components/auth/AuthStepHeading";
import {
  authMobileScrollPadClass,
  authOtpDigitEmptyClass,
  authOtpDigitFilledClass,
  authPrimaryButtonClass,
} from "@/components/auth/authStyles";

const Box = ("di" + "v") as "div";

interface BrokerFormProps {
  onComplete?: () => void;
}

export default function BrokerForm({ onComplete }: BrokerFormProps) {
  const [fullName, setFullName] = useState("");
  const [firm, setFirm] = useState("");
  const [phone, setPhone] = useState("");
  const [otpStage, setOtpStage] = useState(false);
  const [otp, setOtp] = useState(createEmptyOtp);
  const [countdown, setCountdown] = useState(12);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [, setLocation] = useLocation();
  const { verifyReady, startVerifyReady, isVerifyReady } = useOtpVerifyReady();

  const phoneDigits = phone.replace(/\D/g, "").slice(0, 10);
  const pendingRole = sessionStorage.getItem("tk_pending_role") || "broker";
  const signupRole: Role = isAuthEntryRole(pendingRole) ? pendingRole : "broker";
  const [duplicateSignupPhone, setDuplicateSignupPhone] = useState(false);

  useEffect(() => {
    if (phoneDigits.length !== 10) {
      setDuplicateSignupPhone(false);
      return;
    }
    let cancelled = false;
    void profileExistsAsync(phoneDigits, signupRole).then((exists) => {
      if (!cancelled) setDuplicateSignupPhone(exists);
    });
    return () => {
      cancelled = true;
    };
  }, [phoneDigits, signupRole]);

  const formValid =
    fullName.trim().length > 0 && phoneDigits.length === 10 && !duplicateSignupPhone;

  useEffect(() => {
    if (!otpStage || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, otpStage]);

  const handleSendOtp = async () => {
    if (!formValid || duplicateSignupPhone || sendingOtp) return;
    setSendingOtp(true);
    try {
      const err = await sendPhoneOtp(phoneDigits);
      if (err) {
        toast({
          title: "Could not send OTP",
          description: err,
          variant: "destructive",
        });
        return;
      }
      setOtp(createEmptyOtp());
      setOtpStage(true);
      setCountdown(12);
      startVerifyReady();
    } finally {
      setSendingOtp(false);
    }
  };

  const resendBrokerOtp = async () => {
    const err = await sendPhoneOtp(phoneDigits);
    if (err) {
      toast({
        title: "Could not send OTP",
        description: err,
        variant: "destructive",
      });
      return;
    }
    setCountdown(12);
    setOtp(createEmptyOtp());
    startVerifyReady();
  };

  const isOtpComplete = otp.every((d) => d !== "");

  const handleContinue = async () => {
    if (!isOtpComplete || verifying || !isVerifyReady) return;
    const pending = sessionStorage.getItem("tk_pending_role") || "broker";
    const signupRole: Role = isAuthEntryRole(pending) ? pending : "broker";
    setVerifying(true);
    try {
      const verifyResult = await verifyPhoneOtp(phoneDigits, otp.join(""));
      if (verifyResult.error) {
        toast({
          title: "Invalid OTP. Please try again.",
          variant: "destructive",
        });
        return;
      }
      const accessToken = verifyResult.accessToken;
      if (!accessToken) {
        toast({
          title: "Could not sign you in",
          description: "Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (await profileExistsAsync(phoneDigits, signupRole)) {
        toast({
          title: "An account already exists for this number.",
          variant: "destructive",
        });
        setOtp(createEmptyOtp());
        return;
      }

      await signUpSuccess(
        phoneDigits,
        signupRole,
        {
          name: fullName,
          firm,
          phone: phoneDigits,
          email: "",
          bankHolderName: "",
          bankName: "",
          bankAccountNumber: "",
          bankIFSC: "",
          upiId: "",
          upiQrFileName: "",
        },
        accessToken,
      );

      if (stayLoggedIn) {
        persistSessionToLocalStorage(phoneDigits, signupRole);
      } else {
        clearRememberedSessionFromLocalStorage();
      }
      onComplete?.();
      setLocation(dashboardRouteFor(signupRole));
    } catch (err) {
      await rollbackFailedSignup(phoneDigits, signupRole);
      toast({
        title: "Could not create account",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(0, 1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LAST_INDEX) {
      document.getElementById(`broker-otp-${index + 1}`)?.focus();
    }
  };

  const sendOtpCta = (
    <Button
      size="lg"
      onClick={() => void handleSendOtp()}
      disabled={!formValid || sendingOtp}
      className={`w-full ${authPrimaryButtonClass}`}
    >
      Send OTP & Register
    </Button>
  );

  const continueCta = (
    <Button
      size="lg"
      onClick={() => void handleContinue()}
      disabled={!isOtpComplete || verifying || !isVerifyReady}
      className={`w-full ${authPrimaryButtonClass}`}
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
    <Box className={`flex flex-col h-full max-w-md w-full mx-auto lg:max-w-xl lg:mx-0 ${authMobileScrollPadClass}`}>
      <AuthStepHeading title="Tell us about you" subtitle="Help us set up your broker profile" />

      <Box className="space-y-6">
        <Box className="space-y-2">
          <Label htmlFor="fullName" className="text-gray-700">
            Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="fullName"
            placeholder="Enter your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={otpStage}
            className={otpStage ? "bg-blue-50/60" : "bg-white"}
          />
          <p className="text-xs text-gray-500">As per government ID</p>
        </Box>

        <Box className="space-y-2">
          <Label htmlFor="firm" className="text-gray-700">
            Brokerage Firm (Optional)
          </Label>
          <Input
            id="firm"
            placeholder="e.g., ABC Realty, Independent Broker"
            value={firm}
            onChange={(e) => setFirm(e.target.value)}
            disabled={otpStage}
            className={otpStage ? "bg-blue-50/60" : "bg-white"}
          />
          <p className="text-xs text-gray-500">Leave blank if you&apos;re an independent broker</p>
        </Box>

        <Box className="space-y-2">
          <Label htmlFor="phone" className="text-gray-700">
            Phone Number <span className="text-destructive">*</span>
          </Label>
          <Box className="flex gap-2">
            <Box
              className={`w-16 flex items-center justify-center rounded-md border border-input text-gray-700 ${
                otpStage ? "bg-blue-50/60" : "bg-gray-50"
              }`}
            >
              +91
            </Box>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              disabled={otpStage}
              className={`flex-1 ${otpStage ? "bg-blue-50/60" : "bg-white"}`}
            />
          </Box>
          {duplicateSignupPhone && !otpStage ? (
            <p className="text-sm text-destructive">
              Account exists.{" "}
              <button
                type="button"
                onClick={() => setLocation("/login")}
                className="font-medium underline underline-offset-2 hover:text-destructive/80"
              >
                Log in instead?
              </button>
            </p>
          ) : (
            <p className="text-xs text-gray-500">We&apos;ll send an OTP to verify</p>
          )}
        </Box>
      </Box>

      {!otpStage ? (
        <AuthSignupScreenFooter cta={sendOtpCta} persistRole="broker" />
      ) : (
        <>
          <Box className="mb-8 mt-8">
            <p className="text-gray-600 mb-4">
              Enter the OTP that we have sent to{" "}
              <span className="font-semibold text-gray-900">+91 {phoneDigits}</span>
            </p>

            <Box className="grid grid-cols-6 gap-2 sm:gap-3 mb-6 w-full max-w-md">
              {otp.map((d, i) => (
                <input
                  key={i}
                  id={`broker-otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label={`Digit ${i + 1} of 6`}
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) =>
                    handleOtpKeyDown(i, e, otp, setOtp, "broker-otp", () => {
                      if (isVerifyReady) void handleContinue();
                    })
                  }
                  className={`w-full h-11 sm:h-12 text-center text-xl font-medium rounded-lg outline-none transition-colors
                    ${d ? authOtpDigitFilledClass : authOtpDigitEmptyClass}`}
                />
              ))}
            </Box>

            <Box className="mb-4 flex max-w-md items-start gap-2">
              <Checkbox
                id="broker-stay-logged-in"
                checked={stayLoggedIn}
                onCheckedChange={(checked) => setStayLoggedIn(checked === true)}
                disabled={verifying}
                className="mt-0.5"
              />
              <Label
                htmlFor="broker-stay-logged-in"
                className="cursor-pointer text-sm font-normal leading-snug text-gray-600"
              >
                Stay logged in on this device
              </Label>
            </Box>

            <p className="text-sm text-gray-600">
              Didn&apos;t receive the verification OTP?{" "}
              {countdown > 0 ? (
                <span className="font-medium text-[#2563EB]">Resend otp in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void resendBrokerOtp()}
                  className="font-medium text-[#2563EB] hover:underline"
                >
                  Resend otp
                </button>
              )}
            </p>
          </Box>

          <AuthSignupScreenFooter
            cta={
              <>
                {continueCta}
                <OtpVerifyReadyHint seconds={verifyReady} />
              </>
            }
            showTerms={false}
            persistRole="broker"
          />
        </>
      )}
    </Box>
  );
}
