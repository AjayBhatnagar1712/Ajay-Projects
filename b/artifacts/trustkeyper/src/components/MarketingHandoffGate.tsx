import React, { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  applyMarketingHandoff,
  clearMarketingHandoffFromUrl,
  parseMarketingHandoffFromWindow,
  type MarketingHandoffParams,
} from "@/lib/marketingHandoff";

type GatePhase = "loading" | "ready" | "failed";

export const MARKETING_HANDOFF_ERROR_KEY = "tk_marketing_handoff_error";

/**
 * Sync snapshot used for the gate's initial render. Exported for tests.
 * When non-null, the router/layouts must not mount until handoff finishes.
 */
export function readPendingMarketingHandoff(): MarketingHandoffParams | null {
  return parseMarketingHandoffFromWindow();
}

function persistHandoffError(message: string): void {
  try {
    sessionStorage.setItem(MARKETING_HANDOFF_ERROR_KEY, message);
  } catch {
    /* ignore quota / private mode */
  }
}

function navigateToLoginPreservingOrigin(): void {
  window.history.replaceState({}, document.title, "/login");
}

/**
 * Render gate above the app router. While a marketing handoff URL is present,
 * layouts and route guards never mount — so they cannot race-clear the hash.
 */
export function MarketingHandoffGate({ children }: { children: React.ReactNode }) {
  const [pending] = useState<MarketingHandoffParams | null>(() => readPendingMarketingHandoff());
  const [phase, setPhase] = useState<GatePhase>(() => (pending ? "loading" : "ready"));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return;

    let cancelled = false;

    void (async () => {
      const result = await applyMarketingHandoff(pending);
      if (cancelled) return;

      if (result.ok) {
        clearMarketingHandoffFromUrl();
        setPhase("ready");
        return;
      }

      clearMarketingHandoffFromUrl();
      persistHandoffError(result.error);
      navigateToLoginPreservingOrigin();
      setError(result.error);
      setPhase("failed");
    })();

    return () => {
      cancelled = true;
    };
  }, [pending]);

  if (phase === "loading") {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center bg-background"
        role="status"
        aria-live="polite"
        aria-label="Loading your account"
      >
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <>
        <div
          className="fixed inset-x-0 top-0 z-[300] border-b border-red-200 bg-red-50 px-4 py-3 text-center"
          role="alert"
        >
          <p className="text-sm text-red-700">{error ?? "Could not restore your session. Please log in again."}</p>
        </div>
        {children}
      </>
    );
  }

  return <>{children}</>;
}
