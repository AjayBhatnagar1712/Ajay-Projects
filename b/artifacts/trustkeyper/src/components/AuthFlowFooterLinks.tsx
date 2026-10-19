import React from "react";
import { useLocation } from "wouter";
import { isAuthEntryRole, setAuthPendingRole } from "@/lib/auth";

const ctaButton =
  "inline p-0 h-auto min-h-0 border-0 bg-transparent shadow-none rounded-none font-semibold text-[#2563EB] hover:text-[#1d4ed8] underline-offset-2 hover:underline cursor-pointer align-baseline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2";

export function AuthGoToLoginLink({
  className,
  persistRole,
}: {
  className?: string;
  persistRole?: string;
}) {
  const [, setLocation] = useLocation();
  return (
    <p className={className ?? "text-sm text-gray-500 mt-4 text-center pb-28 sm:pb-0"}>
      Already have an account?{" "}
      <button
        type="button"
        onClick={() => {
          if (persistRole) sessionStorage.setItem("tk_pending_role", persistRole);
          setLocation("/login");
        }}
        className={ctaButton}
      >
        LOGIN
      </button>
    </p>
  );
}

export function AuthGoToSignupLink({
  className,
  persistRole,
}: {
  className?: string;
  persistRole?: string;
}) {
  const [, setLocation] = useLocation();
  return (
    <p className={className ?? "text-sm text-gray-500 mt-4 text-center pb-28 sm:pb-0"}>
      Don&apos;t have an account?{" "}
      <button
        type="button"
        onClick={() => {
          if (persistRole && isAuthEntryRole(persistRole)) setAuthPendingRole(persistRole);
          setLocation("/");
        }}
        className={ctaButton}
      >
        SIGN UP
      </button>
    </p>
  );
}
