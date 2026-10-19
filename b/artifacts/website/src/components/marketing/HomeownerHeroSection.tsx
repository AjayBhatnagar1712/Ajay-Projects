import React from "react";
import { ArrowRight, Check, Clock } from "lucide-react";
import heroGreenCurve from "@/assets/marketing/homeowners/hero/hero-green-curve.svg";
import heroManagerPhoto from "@/assets/marketing/homeowners/hero/hero-manager-photo.png";
import heroPropertyPhoto from "@/assets/marketing/homeowners/hero/hero-property-photo.jpg";
import { MARKETING_CTA } from "@/lib/marketingConstants";
import { cn } from "@/lib/utils";

interface StatusRow {
  label: string;
  status: string;
  icon: "check" | "clock";
}

const PROPERTY_STATUS_ROWS: StatusRow[] = [
  { label: "Rent coordination", status: "Up to date", icon: "check" },
  { label: "Monthly servicing", status: "Completed", icon: "check" },
  { label: "Repair request", status: "Visit scheduled", icon: "clock" },
  { label: "Tenant status", status: "Verified", icon: "clock" },
];

function StatusBadge({ status, icon }: Pick<StatusRow, "status" | "icon">) {
  const Icon = icon === "check" ? Check : Clock;

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-marketing-green px-1.5 py-1 text-xs font-medium text-white">
      <Icon size={12} strokeWidth={2.5} aria-hidden />
      {status}
    </span>
  );
}

function PropertyStatusCard({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "rounded-[20px] bg-white p-4 shadow-[0_1px_1px_rgba(8,50,42,0.04),0_16px_20px_rgba(8,50,42,0.06)] sm:rounded-3xl sm:p-5",
        className,
      )}
      aria-label="Property status overview"
    >
      <h2 className="text-sm font-semibold text-marketing-navy-dark sm:text-base">Property Status</h2>
      <ul className="mt-4 space-y-0 sm:mt-5">
        {PROPERTY_STATUS_ROWS.map((row, index) => (
          <li
            key={row.label}
            className={cn(
              "flex items-center justify-between gap-3 py-1.5 sm:py-2",
              index < PROPERTY_STATUS_ROWS.length - 1 && "border-b border-[rgba(227,233,255,0.5)]",
            )}
          >
            <span className="text-xs text-marketing-navy-dark">{row.label}</span>
            <StatusBadge status={row.status} icon={row.icon} />
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function HomeownerHeroSection() {
  return (
    <section className="px-4 pt-4 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[24px] bg-marketing-neutral-1300 sm:rounded-[36px] lg:rounded-[44px]">
        <div className="absolute inset-0">
          <img
            src={heroPropertyPhoto}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-marketing-hero-gradient-start via-[rgba(33,63,79,0.42)] via-55% to-[rgba(33,63,79,0.08)] to-76%"
            aria-hidden
          />
        </div>

        <div
          className="pointer-events-none absolute -bottom-7 -right-32 h-[210px] w-[280px] rotate-[-25deg] lg:-bottom-14 lg:-right-64 lg:h-[min(44vw,420px)] lg:w-[min(56vw,560px)]"
          aria-hidden
        >
          <img src={heroGreenCurve} alt="" className="h-full w-full object-contain" draggable={false} />
        </div>

        <div className="relative grid min-h-[min(88vh,820px)] gap-10 px-6 py-12 sm:px-10 sm:py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-8 lg:px-[122px] lg:py-16">
          <div className="flex max-w-[710px] flex-col gap-8 lg:gap-10">
            <div className="space-y-5">
              <h1 className="text-[40px] font-medium leading-[1.08] tracking-tight text-white sm:text-[52px] sm:leading-[1.05] lg:text-[64px] lg:leading-[70px]">
                Property management, without the daily stress.
              </h1>
              <p className="max-w-xl font-roboto text-sm font-medium leading-5 text-marketing-neutral-300 sm:text-[15px] sm:leading-5">
                From finding reliable tenants to coordinating rent collection, monthly servicing and
                repairs, TrustKeyper keeps your property cared for and under control.
              </p>
            </div>

            <div className="space-y-4">
              <a
                href={MARKETING_CTA.getStarted}
                className="inline-flex h-14 w-full max-w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-center font-roboto text-sm font-medium text-marketing-navy-dark transition-colors hover:bg-white/95 sm:h-auto sm:w-auto sm:px-10 sm:py-4 sm:text-base"
              >
                Register and we&apos;ll get back to you soon
                <ArrowRight size={16} strokeWidth={2} aria-hidden />
              </a>
              <p className="font-roboto text-xs leading-4 text-marketing-neutral-300">
                No upfront commitment. Our team will contact you to understand your property
                requirements.
              </p>
            </div>
          </div>

          <div className="relative mx-auto h-[220px] w-full max-w-[362px] self-end sm:h-[250px] sm:max-w-[420px] lg:mx-0 lg:self-auto lg:justify-self-end">
            <div className="absolute bottom-0 left-0 z-10 w-[38%] max-w-[166px] overflow-hidden rounded-3xl bg-marketing-sky-card shadow-[0_1px_2px_rgba(8,50,42,0.04),0_16px_40px_rgba(8,50,42,0.06)]">
              <img
                src={heroManagerPhoto}
                alt="TrustKeyper property manager"
                className="aspect-[166/208] h-full w-full object-cover object-top"
                draggable={false}
              />
            </div>

            <PropertyStatusCard className="absolute right-0 top-0 z-20 w-[66%] max-w-[277px]" />
          </div>
        </div>
      </div>
    </section>
  );
}
