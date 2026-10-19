import React from "react";
import { MarketingAuthDifferentRoleCards } from "@/components/auth/MarketingAuthDifferentRoleCards";
import type { MarketingAccountSummary } from "@/lib/marketingAuthRoles";
import {
  marketingRoleLabel,
  type MarketingAuthRole,
} from "@/lib/marketingAuthRoles";
import { cn } from "@/lib/utils";

export interface MarketingAuthWelcomeBackProps {
  accounts: MarketingAccountSummary[];
  missingRoles: MarketingAuthRole[];
  selectedSignupRole: MarketingAuthRole | null;
  continuingRole: MarketingAuthRole | null;
  onExistingAccountClick: (role: MarketingAuthRole) => void;
  onSignupRoleSelect: (role: MarketingAuthRole) => void;
}

export function MarketingAuthWelcomeBack({
  accounts,
  missingRoles,
  selectedSignupRole,
  continuingRole,
  onExistingAccountClick,
  onSignupRoleSelect,
}: MarketingAuthWelcomeBackProps) {
  return (
    <div>
      <h1 className="border-b border-marketing-muted/20 pb-4 text-center text-[22px] font-semibold leading-snug text-marketing-navy sm:text-2xl">
        Welcome back to TrustKeyper
      </h1>

      <div className="mt-6 space-y-3">
        {accounts.map((account) => {
          const isContinuing = continuingRole === account.role;
          return (
            <button
              key={account.role}
              type="button"
              disabled={continuingRole !== null}
              onClick={() => onExistingAccountClick(account.role)}
              className={cn(
                "flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors",
                "border-[#cbd5e2] bg-white hover:border-marketing-muted/40",
                isContinuing && "opacity-80",
                continuingRole !== null && !isContinuing && "cursor-not-allowed opacity-60",
              )}
            >
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#e2e8f0] text-base font-semibold text-marketing-muted"
                aria-hidden
              >
                {account.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-marketing-muted">
                  Logged in as {marketingRoleLabel(account.role)}
                </p>
                <p className="truncate text-lg font-semibold text-marketing-navy">
                  {account.displayName}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {missingRoles.length > 0 ? (
        <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-[#cbd5e2]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-sm font-semibold text-marketing-blue">OR</span>
            </div>
          </div>

          <p className="mb-4 text-center text-xs font-medium uppercase tracking-wide text-marketing-muted">
            Signup for a different role
          </p>

          <MarketingAuthDifferentRoleCards
            roles={missingRoles}
            selectedRole={selectedSignupRole}
            onSelectRole={onSignupRoleSelect}
          />
        </>
      ) : null}
    </div>
  );
}
