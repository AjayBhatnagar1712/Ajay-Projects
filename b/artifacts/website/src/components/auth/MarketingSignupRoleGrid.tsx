import React from "react";
import { Home, IndianRupee, User, type LucideIcon } from "lucide-react";
import {
  MARKETING_AUTH_ROLES,
  marketingRoleLabel,
  type MarketingAuthRole,
} from "@/lib/marketingAuthRoles";
import { cn } from "@/lib/utils";

const ROLE_ICONS: Record<MarketingAuthRole, LucideIcon> = {
  owner: User,
  broker: IndianRupee,
  tenant: Home,
};

export interface MarketingSignupRoleGridProps {
  value: MarketingAuthRole | "";
  onChange: (role: MarketingAuthRole) => void;
}

/** Vertical role cards for new-user signup — matches Android / Desktop signup designs. */
export function MarketingSignupRoleGrid({ value, onChange }: MarketingSignupRoleGridProps) {
  return (
    <div className="flex flex-col gap-3">
      {MARKETING_AUTH_ROLES.map((role) => {
        const Icon = ROLE_ICONS[role];
        const isSelected = value === role;
        return (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            className={cn(
              "flex min-h-[88px] w-full flex-col items-center justify-center rounded-xl border px-4 py-5 transition-colors",
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
                "text-center text-sm font-medium leading-snug sm:text-base",
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
