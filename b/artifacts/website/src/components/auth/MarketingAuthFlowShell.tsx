import React from "react";
import { HomePage } from "@/pages/HomePage";
import { MarketingAuthModalHeader } from "@/components/auth/MarketingAuthModalHeader";

export interface MarketingAuthFlowShellProps {
  children: React.ReactNode;
  /** Accessible name for the desktop modal dialog. */
  ariaLabel: string;
  /** Desktop modal header — illustration (default) or brand gradient. */
  headerVariant?: "illustration" | "brand";
  /** Dismisses the route-backed auth shell. When omitted, the shell is not dismissible. */
  onClose?: () => void;
}

/** Post-OTP auth shell: full page on mobile, centered modal over homepage on desktop. */
export function MarketingAuthFlowShell({
  children,
  ariaLabel,
  headerVariant = "illustration",
  onClose,
}: MarketingAuthFlowShellProps) {
  const close = React.useCallback(() => {
    onClose?.();
  }, [onClose]);

  React.useEffect(() => {
    if (!onClose) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, onClose]);

  return (
    <>
      <div className="hidden lg:fixed lg:inset-0 lg:z-[100] lg:flex lg:items-center lg:justify-center lg:p-6">
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          aria-hidden
        >
          <div className="min-h-full">
            <HomePage />
          </div>
        </div>
        <div
          className="absolute inset-0 z-[1] bg-[#2b2b2b]/70"
          aria-hidden
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          className="relative z-10 flex max-h-[96dvh] w-full max-w-[420px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
        >
          <MarketingAuthModalHeader
            variant={headerVariant}
            onClose={onClose ? close : undefined}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
            {children}
          </div>
        </div>
      </div>

      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2b2b2b]/70 px-4 py-6 lg:hidden"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          className="relative flex max-h-[90dvh] w-full max-w-[420px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
        >
          <MarketingAuthModalHeader
            variant="brand"
            onClose={onClose ? close : undefined}
          />
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
