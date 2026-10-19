import React from "react";
import { cn } from "@/lib/utils";

const PROPERTY_COUNT_OPTIONS = [
  { value: "01", label: "01" },
  { value: "02-10", label: "02 - 10" },
  { value: "10+", label: "10+" },
] as const;

export interface MarketingOwnerSignupFormProps {
  name: string;
  propertyCount: string;
  submitting: boolean;
  onNameChange: (value: string) => void;
  onPropertyCountChange: (value: string) => void;
  onSubmit: () => void;
}

export function MarketingOwnerSignupForm({
  name,
  propertyCount,
  submitting,
  onNameChange,
  onPropertyCountChange,
  onSubmit,
}: MarketingOwnerSignupFormProps) {
  const canSubmit = name.trim().length > 0 && propertyCount.length > 0 && !submitting;

  return (
    <div>
      <div className="space-y-2">
        <label htmlFor="marketing-owner-name" className="text-sm text-marketing-body">
          Your Name
        </label>
        <input
          id="marketing-owner-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          className="w-full rounded-lg border border-[#cbd5e2] bg-white px-4 py-3.5 text-base text-marketing-navy outline-none transition-colors focus:border-marketing-blue"
          placeholder=""
        />
      </div>

      <h2 className="mt-8 border-b border-marketing-muted/20 pb-4 text-center text-[22px] font-semibold leading-snug text-marketing-navy sm:text-2xl">
        How many properties do you own?
      </h2>

      <div className="mt-6 flex flex-col gap-3">
        {PROPERTY_COUNT_OPTIONS.map((option) => {
          const isSelected = propertyCount === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onPropertyCountChange(option.value)}
              className={cn(
                "w-full rounded-xl border px-6 py-4 text-center text-base font-medium transition-colors",
                isSelected
                  ? "border-marketing-green bg-[#e8f7f1] text-marketing-navy"
                  : "border-[#cbd5e2] bg-white text-marketing-body hover:border-marketing-muted/40",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className={cn(
          "mt-6 w-full rounded-lg py-3.5 text-base font-semibold text-white transition-colors",
          canSubmit
            ? "bg-marketing-blue hover:bg-marketing-blue-bright"
            : "cursor-not-allowed bg-[#a0aec0]",
        )}
      >
        {submitting ? "Please wait..." : "Submit"}
      </button>
    </div>
  );
}
