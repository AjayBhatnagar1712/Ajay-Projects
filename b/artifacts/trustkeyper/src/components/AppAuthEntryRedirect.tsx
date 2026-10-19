import React, { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { buildMarketingAuthRedirectUrl } from "@/lib/marketingHandoff";

export interface AppAuthEntryRedirectProps {
  mode: "login" | "signup";
  children: React.ReactNode;
}

/** Redirects to the marketing site auth entry when VITE_MARKETING_URL is configured. */
export function AppAuthEntryRedirect({ mode, children }: AppAuthEntryRedirectProps) {
  const redirectUrl = buildMarketingAuthRedirectUrl(mode);

  useEffect(() => {
    if (redirectUrl) {
      window.location.replace(redirectUrl);
    }
  }, [redirectUrl]);

  if (redirectUrl) {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center bg-background"
        role="status"
        aria-live="polite"
        aria-label="Redirecting to signup"
      >
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
