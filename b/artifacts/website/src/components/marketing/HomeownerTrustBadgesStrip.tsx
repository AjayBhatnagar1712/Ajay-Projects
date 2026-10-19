import React from "react";
import { Bell, MapPin, UserCheck, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrustBadge {
  icon: LucideIcon;
  label: string;
}

const TRUST_BADGES: TrustBadge[] = [
  { icon: UserCheck, label: "Verified Tenant Screening" },
  { icon: Users, label: "Dedicated Property Manager" },
  { icon: Bell, label: "Transparent Service Updates" },
  { icon: MapPin, label: "Hyderabad-Based Support" },
];

function TrustBadgeItem({ icon: Icon, label }: TrustBadge) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 px-3 py-3 sm:min-h-[76px] sm:px-6 sm:py-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marketing-neutral-200 sm:h-9 sm:w-9">
        <Icon size={16} strokeWidth={2} className="text-marketing-navy-dark" aria-hidden />
      </span>
      <span className="font-roboto text-xs font-medium leading-snug text-marketing-navy-dark sm:text-sm">
        {label}
      </span>
    </div>
  );
}

function badgeDividerClass(index: number): string {
  return cn(
    "border-marketing-neutral-100",
    index % 2 === 1 && "border-l",
    index >= 2 && "border-t lg:border-t-0",
    index > 0 && "lg:border-l",
  );
}

export function HomeownerTrustBadgesStrip() {
  return (
    <section
      aria-label="TrustKeyper service guarantees"
      className="relative z-10 -mt-6 px-4 sm:px-6 lg:px-8"
    >
      <div
        className={cn(
          "mx-auto max-w-[1351px] rounded-3xl bg-white",
          "shadow-[0_1px_1px_rgba(8,50,42,0.04),0_16px_20px_rgba(8,50,42,0.06)]",
        )}
      >
        <ul className="grid grid-cols-2 lg:grid-cols-4">
          {TRUST_BADGES.map((badge, index) => (
            <li key={badge.label} className={badgeDividerClass(index)}>
              <TrustBadgeItem {...badge} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
