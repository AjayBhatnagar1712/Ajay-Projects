import React from "react";
import {
  Bell,
  ClipboardList,
  FileText,
  Lock,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

interface TransparencyBadge {
  icon: LucideIcon;
  label: string;
}

const TRANSPARENCY_BADGES: TransparencyBadge[] = [
  { icon: UserCheck, label: "Verified Tenant Screening" },
  { icon: ShieldCheck, label: "Owner Approval for Major Work" },
  { icon: FileText, label: "Documented Repair Estimates" },
  { icon: ClipboardList, label: "Inspection and Service Records" },
  { icon: Bell, label: "Transparent Property Updates" },
  { icon: Lock, label: "Controlled Access to Property Information" },
];

function TransparencyBadgePill({ icon: Icon, label }: TransparencyBadge) {
  return (
    <li className="flex min-h-[64px] items-center gap-2 rounded-[52px] border border-white/10 bg-marketing-neutral-1050 px-3 py-3 sm:min-h-[90px] sm:gap-4 sm:px-6 sm:py-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marketing-green">
        <Icon size={20} strokeWidth={2} className="text-marketing-icon-circle" aria-hidden />
      </span>
      <span className="font-roboto text-[10px] font-medium leading-3 text-white sm:text-base sm:leading-6">
        {label}
      </span>
    </li>
  );
}

export function HomeownerTransparencySection() {
  return (
    <section
      className="bg-marketing-neutral-1100 py-16 lg:py-[140px]"
      aria-labelledby="homeowner-transparency-heading"
    >
      <div className="mx-auto max-w-[1168px] px-6 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-16 xl:gap-[228px]">
          <div className="max-w-[396px] shrink-0">
            <p className="font-roboto text-xs font-medium uppercase tracking-[1.2px] text-marketing-green">
              Trust & Security
            </p>
            <h2
              id="homeowner-transparency-heading"
              className="mt-5 text-[40px] font-medium leading-[46px] text-marketing-azure-050"
            >
              Built around
              <br />
              transparency
              <br />
              and accountability.
            </h2>
          </div>
          <p className="max-w-[542px] font-roboto text-base leading-6 text-white">
            TrustKeyper follows clear approval, documentation, and communication processes for all
            property-related work.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-2 gap-1.5 sm:grid-cols-2 sm:gap-4 lg:mt-[60px] lg:grid-cols-3 lg:gap-x-4 lg:gap-y-[15px]">
          {TRANSPARENCY_BADGES.map((badge) => (
            <TransparencyBadgePill key={badge.label} {...badge} />
          ))}
        </ul>
      </div>
    </section>
  );
}
