import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type FlowNativeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  variant?: "owner" | "broker";
};

export function FlowNativeSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  variant = "broker",
}: FlowNativeSelectProps) {
  const isOwner = variant === "owner";

  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full appearance-none bg-white px-3 pr-8 text-gray-900 focus:outline-none",
          isOwner
            ? "h-10 rounded-sm border border-gray-200 text-sm focus:border-primary/50"
            : "h-9 rounded-md border border-input text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary",
          !value && "text-gray-400",
        )}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        aria-hidden
      />
    </div>
  );
}
