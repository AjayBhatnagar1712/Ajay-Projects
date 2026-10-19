import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ShieldCheck } from "lucide-react";
import { AuthPhoneField } from "@/components/auth/AuthPhoneField";
import { TrustKeyperLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ADMIN_PRIMARY, getAdminSession, isAdminPhone } from "@/lib/adminAuth";
import { setActiveSession } from "@/lib/auth";
import { createEmptyOtp, OTP_LAST_INDEX } from "@/lib/otp";
import { handleOtpKeyDown } from "@/lib/otpInput";
import { OtpVerifyReadyHint, useOtpVerifyReady } from "@/lib/otpVerifyReady";
import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/phoneOtp";

type Phase = "phone" | "otp";

const adminButtonClass =
  "w-full h-12 rounded-lg text-white font-medium text-base hover:opacity-90 disabled:opacity-50";

/**
 * Admin portal login page — phone OTP authentication with admin
 * allowlist check. Redirects to /admin/dashboard on success.
 */
export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(createEmptyOtp);
  const [countdown, setCountdown] = useState(10);
  const [loading, setLoading] = useState(false);
  const [unauthorised, setUnauthorised] = useState(false);
  const { verifyReady, startVerifyReady, isVerifyReady } = useOtpVerifyReady();

  const phoneDigits = phone.replace(/\D/g, "").slice(0, 10);
  const isPhoneComplete = phoneDigits.length === 10;
  const isOtpComplete = otp.every((digit) => digit !== "");

  useEffect(() => {
    if (getAdminSession()) {
      setLocation("/admin/dashboard");
    }
  }, [setLocation]);

  useEffect(() => {
    if (phase !== "otp" || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, phase]);

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(0, 1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LAST_INDEX) {
      document.getElementById(`admin-otp-${index + 1}`)?.focus();
    }
  };

  const handleRequestOtp = async () => {
    if (!isPhoneComplete) return;
    setLoading(true);
    setUnauthorised(false);
    try {
      const error = await sendPhoneOtp(phoneDigits);
      if (error) {
        toast({
          title: "Could not send OTP",
          description: error,
          variant: "destructive",
        });
        return;
      }
      setCountdown(10);
      setOtp(createEmptyOtp());
      startVerifyReady();
      setPhase("otp");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const error = await sendPhoneOtp(phoneDigits);
      if (error) {
        toast({
          title: "Could not send OTP",
          description: error,
          variant: "destructive",
        });
        return;
      }
      setCountdown(10);
      setOtp(createEmptyOtp());
      startVerifyReady();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!isOtpComplete || !isVerifyReady) return;
    setLoading(true);
    setUnauthorised(false);
    try {
      const { error: verifyError } = await verifyPhoneOtp(phoneDigits, otp.join(""));
      if (verifyError) {
        toast({
          title: "Invalid OTP",
          description: "Please check the code and try again.",
          variant: "destructive",
        });
        return;
      }

      if (!isAdminPhone(phoneDigits)) {
        setUnauthorised(true);
        toast({
          title: "Access denied",
          description: "You are not authorised to access this portal.",
          variant: "destructive",
        });
        return;
      }

      setActiveSession(phoneDigits, "admin");
      toast({ title: "Signed in", description: "Welcome to the TrustKeyper admin portal." });
      setLocation("/admin/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <TrustKeyperLogo size="authMobile" className="mb-6" />
          <div
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: `${ADMIN_PRIMARY}14`, color: ADMIN_PRIMARY }}
          >
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Admin Portal</h1>
          <p className="mt-2 text-sm text-gray-500">
            Sign in with your authorised mobile number
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {phase === "phone" && (
            <div className="space-y-6">
              <AuthPhoneField
                id="admin-login-phone"
                value={phoneDigits}
                onChange={setPhone}
                helperText="Only allowlisted numbers can access the admin portal"
              />
              {unauthorised ? (
                <p className="text-sm text-destructive">
                  You are not authorised to access this portal.
                </p>
              ) : null}
              <Button
                type="button"
                disabled={!isPhoneComplete || loading}
                onClick={() => void handleRequestOtp()}
                className={adminButtonClass}
                style={{ backgroundColor: ADMIN_PRIMARY }}
              >
                {loading ? "Sending OTP…" : "Request OTP →"}
              </Button>
            </div>
          )}

          {phase === "otp" && (
            <div className="space-y-6">
              <AuthPhoneField
                id="admin-login-phone-readonly"
                value={phoneDigits}
                onChange={() => {}}
                disabled
                helperText=""
              />

              <p className="text-sm text-gray-600">
                Enter the OTP sent to{" "}
                <span className="font-semibold text-gray-900">+91 {phoneDigits}</span>
              </p>

              <div className="flex gap-3">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`admin-otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    aria-label={`Digit ${index + 1} of 6`}
                    maxLength={1}
                    value={digit}
                    onChange={(event) => handleOtpChange(index, event.target.value)}
                    onKeyDown={(e) =>
                      handleOtpKeyDown(index, e, otp, setOtp, "admin-otp", () => {
                        if (isVerifyReady) void handleVerifyOtp();
                      })
                    }
                    className="h-12 w-12 rounded-lg border border-gray-200 text-center text-lg font-medium outline-none transition-colors focus:border-[#1B4F8A] focus:ring-2 focus:ring-[#1B4F8A]/20"
                    style={digit ? { borderColor: ADMIN_PRIMARY } : undefined}
                  />
                ))}
              </div>

              {unauthorised ? (
                <p className="text-sm text-destructive">
                  You are not authorised to access this portal.
                </p>
              ) : null}

              <p className="text-sm text-gray-600">
                Didn&apos;t receive the OTP?{" "}
                {countdown > 0 ? (
                  <span style={{ color: ADMIN_PRIMARY }}>Resend in {countdown}s</span>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void handleResendOtp()}
                    className="font-medium hover:underline disabled:opacity-50"
                    style={{ color: ADMIN_PRIMARY }}
                  >
                    Resend OTP
                  </button>
                )}
              </p>

              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  disabled={!isOtpComplete || loading || !isVerifyReady}
                  onClick={() => void handleVerifyOtp()}
                  className={adminButtonClass}
                  style={{ backgroundColor: ADMIN_PRIMARY }}
                >
                  {loading ? "Verifying…" : "Sign in →"}
                </Button>
                <OtpVerifyReadyHint seconds={verifyReady} />
                <Button
                  type="button"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => {
                    setPhase("phone");
                    setOtp(createEmptyOtp());
                    setUnauthorised(false);
                  }}
                >
                  Change phone number
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
