import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface MarketingBrokerSignupFormProps {
  fullName: string;
  firm: string;
  submitting: boolean;
  onFullNameChange: (value: string) => void;
  onFirmChange: (value: string) => void;
  onSubmit: () => void;
}

export function MarketingBrokerSignupForm({
  fullName,
  firm,
  submitting,
  onFullNameChange,
  onFirmChange,
  onSubmit,
}: MarketingBrokerSignupFormProps) {
  const canSubmit = fullName.trim().length > 0 && !submitting;

  return (
    <div>
      <h1 className="border-b border-marketing-muted/20 pb-4 text-center text-[22px] font-semibold leading-snug text-marketing-navy sm:text-2xl">
        Tell us about you
      </h1>
      <p className="mt-2 text-center text-sm text-marketing-muted">
        Help us set up your broker profile
      </p>

      <div className="mt-6 space-y-6">
        <div className="space-y-2">
          <label htmlFor="marketing-broker-name" className="text-sm text-marketing-body">
            Full Name <span className="text-marketing-navy">*</span>
          </label>
          <input
            id="marketing-broker-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => onFullNameChange(event.target.value)}
            placeholder="Enter your full name"
            className="w-full rounded-lg border border-[#cbd5e2] bg-white px-4 py-3.5 text-base text-marketing-navy outline-none transition-colors focus:border-marketing-blue"
          />
          <p className="text-xs text-marketing-muted">As per government ID</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="marketing-broker-firm" className="text-sm text-marketing-body">
            Brokerage Firm (Optional)
          </label>
          <input
            id="marketing-broker-firm"
            type="text"
            value={firm}
            onChange={(event) => onFirmChange(event.target.value)}
            placeholder="e.g., ABC Realty, Independent Broker"
            className="w-full rounded-lg border border-[#cbd5e2] bg-white px-4 py-3.5 text-base text-marketing-navy outline-none transition-colors focus:border-marketing-blue"
          />
          <p className="text-xs text-marketing-muted">
            Leave blank if you&apos;re an independent broker
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className={cn(
          "mt-8 w-full rounded-lg py-3.5 text-base font-semibold text-white transition-colors",
          canSubmit
            ? "bg-marketing-blue hover:bg-marketing-blue-bright"
            : "cursor-not-allowed bg-[#a0aec0]",
        )}
      >
        {submitting ? "Please wait..." : "Continue"}
      </button>
    </div>
  );
}
