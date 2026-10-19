import { createElement, useCallback, useEffect, useState, type ReactNode } from "react";

/** Seconds to wait after OTP send before verify/submit is allowed (Supabase registration lag). */
export const OTP_VERIFY_READY_SECONDS = 3;

/**
 * Countdown after sendPhoneOtp succeeds — blocks verify until it reaches 0.
 * Independent of OTP digit edits and resend cooldown timers.
 */
export function useOtpVerifyReady() {
  const [verifyReady, setVerifyReady] = useState(0);

  useEffect(() => {
    if (verifyReady <= 0) return;
    const timer = setTimeout(() => setVerifyReady((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [verifyReady]);

  const startVerifyReady = useCallback(() => {
    setVerifyReady(OTP_VERIFY_READY_SECONDS);
  }, []);

  const isVerifyReady = verifyReady === 0;

  return { verifyReady, startVerifyReady, isVerifyReady };
}

/** Muted countdown below verify CTA while Supabase registers the OTP. */
export function OtpVerifyReadyHint({ seconds }: { seconds: number }): ReactNode {
  if (seconds <= 0) return null;
  return createElement(
    "p",
    { className: "text-xs text-gray-400 mt-2 max-w-md w-full" },
    `Ready in ${seconds}...`,
  );
}
