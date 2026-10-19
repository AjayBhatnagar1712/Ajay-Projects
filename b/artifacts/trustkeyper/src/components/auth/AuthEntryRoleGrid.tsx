import React from "react";
import { Home, User, IndianRupee } from "lucide-react";
import { AUTH_ENTRY_ROLES, isAuthEntryRole, type AuthEntryRole } from "@/lib/auth";
import { authRoleCardSelectedClass, authRoleCardUnselectedClass } from "@/components/auth/authStyles";

const ROLE_UI: Record<
  AuthEntryRole,
  { shortLabel: string; icon: typeof User }
> = {
  owner: { shortLabel: "Property Owner", icon: User },
  broker: { shortLabel: "Broker", icon: IndianRupee },
  tenant: { shortLabel: "Tenant", icon: Home },
};

interface AuthEntryRoleGridProps {
  value: string;
  onChange: (role: AuthEntryRole) => void;
}

/**
 * Signup/login role cards — owner, broker, and tenant (manager suppressed).
 * Mobile: vertical stack. Desktop (lg+): three columns.
 */
export function AuthEntryRoleGrid({ value, onChange }: AuthEntryRoleGridProps) {
  return (
    <div className="flex w-full max-w-md flex-col gap-3 lg:max-w-none lg:grid lg:grid-cols-3 lg:gap-4">
      {AUTH_ENTRY_ROLES.map((id) => {
        const meta = ROLE_UI[id];
        const isSelected = value === id;
        const Icon = meta.icon;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`relative flex min-h-[5.25rem] flex-col items-center justify-center rounded-xl px-4 py-5 transition-all duration-200 lg:min-h-[7.5rem] lg:p-6 ${
              isSelected ? authRoleCardSelectedClass : authRoleCardUnselectedClass
            }`}
          >
            <Icon
              size={28}
              strokeWidth={1.75}
              className={`mb-2 shrink-0 ${isSelected ? "text-gray-800" : "text-gray-500"}`}
              aria-hidden
            />
            <span
              className={`max-w-full px-1 text-center text-sm font-medium leading-snug sm:text-base ${
                isSelected ? "text-gray-900" : "text-gray-600"
              }`}
            >
              {meta.shortLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function roleFromGridValue(value: string): AuthEntryRole | null {
  return isAuthEntryRole(value) ? value : null;
}
