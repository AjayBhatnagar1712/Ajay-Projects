import React from "react";
import { AuthTermsText } from "@/components/AuthTermsText";

interface AuthSignupActionBlockProps {
  children: React.ReactNode;
  showTerms?: boolean;
  className?: string;
}

/** Primary CTA + divider + terms — 16px spacing between each block. */
export function AuthSignupActionBlock({
  children,
  showTerms = true,
  className = "",
}: AuthSignupActionBlockProps) {
  return (
    <div className={className}>
      {children}
      {showTerms ? (
        <>
          <div className="mt-4 border-t border-gray-200" aria-hidden />
          <AuthTermsText className="mt-4 text-center" />
        </>
      ) : null}
    </div>
  );
}

interface AuthSignupStickyFooterProps {
  children: React.ReactNode;
  showTerms?: boolean;
}

/** Mobile fixed bottom bar for signup CTAs. */
export function AuthSignupStickyFooter({ children, showTerms = true }: AuthSignupStickyFooterProps) {
  return (
    <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-gray-200 p-4 shadow-[0_-12px_28px_rgba(15,23,42,0.08)] safe-area-bottom">
      <AuthSignupActionBlock showTerms={showTerms}>{children}</AuthSignupActionBlock>
    </div>
  );
}
