import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthSignupScreenFooter } from "@/components/auth/AuthSignupScreenFooter";
import { authMobileScrollPadClass, authPrimaryButtonClass } from "@/components/auth/authStyles";
import { createEmptyOtp, OTP_LAST_INDEX } from "@/lib/otp";

const Box = ("di" + "v") as "div";

interface Step3OTPProps {
  details: { name: string; phone: string };
  onNext: () => void;
}

export default function Step3OTP({ details, onNext }: Step3OTPProps) {
  const [otp, setOtp] = useState(createEmptyOtp);
  const [countdown, setCountdown] = useState(10);
  const pending = sessionStorage.getItem("tk_pending_role") || undefined;

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(0, 1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < OTP_LAST_INDEX) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const isComplete = otp.every((digit) => digit !== "");
  const displayPhone = details.phone.replace(/\D/g, "").slice(0, 10);

  const cta = (
    <Button size="lg" onClick={onNext} disabled={!isComplete} className={authPrimaryButtonClass}>
      Continue &rarr;
    </Button>
  );

  return (
    <Box className={`flex flex-col h-full max-w-md ${authMobileScrollPadClass}`}>
      <Box className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Let&apos;s know you better</h1>
      </Box>

      <Box className="space-y-6 mb-6 max-w-md opacity-70 pointer-events-none">
        <Box className="space-y-2">
          <Label className="text-gray-700">Your Name</Label>
          <Input value={details.name} readOnly className="bg-gray-50" />
        </Box>
        <Box className="space-y-2">
          <Label className="text-gray-700">Phone Number</Label>
          <Input value={displayPhone} readOnly className="bg-gray-50" />
        </Box>
      </Box>

      <Box className="mb-8">
        <p className="text-gray-600 mb-4">
          Enter the OTP that we have sent to{" "}
          <span className="font-semibold text-gray-900">+91 {displayPhone}</span>
        </p>

        <Box className="grid grid-cols-6 gap-2 sm:gap-3 mb-6 w-full max-w-md">
          {otp.map((digit, i) => (
            <input
              key={i}
              id={`otp-${i}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              className={`w-full h-11 sm:h-12 text-center text-xl font-medium rounded-lg border outline-none transition-colors
                ${digit ? "bg-[#E8F5EE] border-accent border-b-4" : "bg-white border-gray-300 focus:border-primary"}`}
            />
          ))}
        </Box>

        <p className="text-sm text-gray-600">
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
      </Box>

      <AuthSignupScreenFooter cta={cta} showTerms={false} persistRole={pending} />
    </Box>
  );
}
