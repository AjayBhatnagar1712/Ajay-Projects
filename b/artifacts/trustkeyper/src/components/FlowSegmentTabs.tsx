import React, { useEffect, useRef } from "react";

export type FlowSegmentOption<T extends string> = { value: T; label: string };

type FlowSegmentTabsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  /** Inferred from `value` / `onChange`, not widened by `.map()` on options. */
  options: FlowSegmentOption<NoInfer<T>>[];
  className?: string;
  /** Stretch tabs evenly across the container width (e.g. property status filters). */
  fullWidth?: boolean;
};

export function FlowSegmentTabs<const T extends string>({
  value,
  onChange,
  options,
  className = "",
  fullWidth = false,
}: FlowSegmentTabsProps<T>) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [value]);

  return (
    <div
      className={`flex items-center gap-1 bg-white border border-gray-200 rounded-[4px] p-1 overflow-x-auto max-w-full scroll-smooth ${
        fullWidth ? "w-full" : "w-fit"
      } ${className}`}
      role="tablist"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            ref={active ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`h-9 rounded-[4px] text-sm font-medium transition-colors whitespace-nowrap ${
              fullWidth ? "flex-1 min-w-0 px-1 sm:px-2 text-center" : "px-4 sm:px-6"
            } ${
              active ? "rounded-[8px] bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
