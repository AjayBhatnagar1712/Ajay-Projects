import React from "react";
import { cn } from "@/lib/utils";

/** Selection chip — matches owner add-property flow (green underline). */
export function FlowChipButton({
  label,
  selected,
  onClick,
  className,
}: {
  label: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
        selected
          ? "bg-[#E8F5EE] border-gray-200 border-b-[3px] border-b-[#22C55E] text-gray-800"
          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300",
        className,
      )}
    >
      {label}
    </button>
  );
}
