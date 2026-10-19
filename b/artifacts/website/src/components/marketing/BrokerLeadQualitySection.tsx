import React from "react";
import iconAvailability from "@/assets/marketing/brokers/lead-quality/icon-04-availability.svg";
import iconDuplicates from "@/assets/marketing/brokers/lead-quality/icon-05-duplicates.svg";
import iconIssueReporting from "@/assets/marketing/brokers/lead-quality/icon-07-issue-reporting.svg";
import iconOutdated from "@/assets/marketing/brokers/lead-quality/icon-06-outdated.svg";
import iconOwnerIdentity from "@/assets/marketing/brokers/lead-quality/icon-01-owner-identity.svg";
import iconPropertyDetails from "@/assets/marketing/brokers/lead-quality/icon-02-property-details.svg";
import iconRequirement from "@/assets/marketing/brokers/lead-quality/icon-03-requirement.svg";

const LEAD_QUALITY_BADGES = [
  { label: "Owner identity reviewed", iconSrc: iconOwnerIdentity },
  { label: "Property details checked", iconSrc: iconPropertyDetails },
  { label: "Requirement confirmed", iconSrc: iconRequirement },
  { label: "Property availability reviewed", iconSrc: iconAvailability },
  { label: "Duplicate leads reduced", iconSrc: iconDuplicates },
  { label: "Outdated opportunities flagged", iconSrc: iconOutdated },
  { label: "Lead issue-reporting process available", iconSrc: iconIssueReporting },
] as const;

/**
 * Figma node 7223:147509 — metadata exports only the bold prefix "Please note:".
 * Body copy below is from the reference screenshot in the design brief; confirm against Figma before launch.
 */
const LEAD_QUALITY_DISCLAIMER = {
  prefix: "Please note:",
  body: "While we verify all leads for intent and accuracy, TrustKeyper does not guarantee lead conversion or final sale outcomes.",
} as const;

function LeadQualityBadge({ label, iconSrc }: { label: string; iconSrc: string }) {
  return (
    <li className="flex min-h-[60px] items-center gap-2 rounded-[52px] border border-white/10 bg-marketing-neutral-1050 px-3 py-3 sm:min-h-[80px] sm:gap-4 sm:px-6 sm:py-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marketing-green">
        <img src={iconSrc} alt="" width={18} height={18} className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="font-roboto text-[10px] font-medium leading-3 text-white sm:text-base sm:leading-6">
        {label}
      </span>
    </li>
  );
}

export function BrokerLeadQualitySection() {
  return (
    <section
      className="bg-marketing-neutral-1100 py-16 lg:py-[140px]"
      aria-labelledby="broker-lead-quality-heading"
    >
      <div className="mx-auto max-w-[1168px] px-6 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-6 md:gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div className="max-w-[540px] shrink-0">
            <p className="font-roboto text-xs font-medium uppercase tracking-[1.2px] text-marketing-green">
              Lead Quality
            </p>
            <h2
              id="broker-lead-quality-heading"
              className="mt-5 text-[40px] font-medium leading-[46px] text-marketing-azure-050"
            >
              Better information
              <br />
              before you make the call.
            </h2>
          </div>
          <p className="max-w-[456px] font-roboto text-base leading-6 text-white lg:pb-1">
            Each property opportunity on TrustKeyper goes through a review process before it&apos;s visible
            to brokers.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-2 gap-1.5 sm:grid-cols-2 sm:gap-4 lg:mt-[60px] lg:grid-cols-4 lg:gap-4">
          {LEAD_QUALITY_BADGES.map((badge) => (
            <LeadQualityBadge key={badge.label} label={badge.label} iconSrc={badge.iconSrc} />
          ))}
        </ul>

        <div className="mt-8 rounded-[20px] border border-white/10 bg-marketing-neutral-1050 px-5 py-6 sm:px-6 lg:mt-10">
          <p className="font-roboto text-sm leading-5 text-white/90 sm:text-base sm:leading-6">
            <strong className="font-semibold text-white">{LEAD_QUALITY_DISCLAIMER.prefix}</strong>{" "}
            {LEAD_QUALITY_DISCLAIMER.body}
          </p>
        </div>
      </div>
    </section>
  );
}
