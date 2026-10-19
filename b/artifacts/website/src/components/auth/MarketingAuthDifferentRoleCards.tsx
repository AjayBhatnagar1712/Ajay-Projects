import React from "react";
import { Home, IndianRupee, User, type LucideIcon } from "lucide-react";
import {
  marketingRoleLabel,
  type MarketingAuthRole,
} from "@/lib/marketingAuthRoles";
import { cn } from "@/lib/utils";

const ROLE_ICONS: Record<MarketingAuthRole, LucideIcon> = {
  owner: User,
  broker: IndianRupee,
  tenant: Home,
};

export interface MarketingAuthDifferentRoleCardsProps {
  roles: readonly MarketingAuthRole[];
  selectedRole: MarketingAuthRole | null;
  onSelectRole: (role: MarketingAuthRole) => void;
}

/** Compact role cards for “signup for a different role” — no “I am a” heading. */
export function MarketingAuthDifferentRoleCards({
  roles,
  selectedRole,
  onSelectRole,
}: MarketingAuthDifferentRoleCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {roles.map((role) => {
        const Icon = ROLE_ICONS[role];
        const isSelected = selectedRole === role;
        return (
          <button
            key={role}
            type="button"
            onClick={() => onSelectRole(role)}
            className={cn(
              "flex min-h-[112px] flex-col items-center justify-center rounded-xl border px-4 py-5 transition-colors",
              isSelected
                ? "border-marketing-green bg-[#e8f7f1]"
                : "border-[#cbd5e2] bg-white hover:border-marketing-muted/40",
            )}
          >
            <Icon
              size={28}
              strokeWidth={1.75}
              className={cn("mb-2", isSelected ? "text-marketing-navy" : "text-marketing-muted")}
              aria-hidden
            />
            <span
              className={cn(
                "text-center text-sm font-medium leading-snug",
                isSelected ? "text-marketing-navy" : "text-marketing-body",
              )}
            >
              {marketingRoleLabel(role)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
