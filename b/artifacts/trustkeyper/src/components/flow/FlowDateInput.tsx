import React, { useRef } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const PICKER_OVERLAY_CLASS =
  "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer";

type FlowDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  id?: string;
  className?: string;
  variant?: "owner" | "broker";
};

export function FlowDateInput({
  value,
  onChange,
  min,
  id,
  className,
  variant = "broker",
}: FlowDateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
      } catch {
        el.click();
      }
    } else {
      el.click();
    }
  };

  const isOwner = variant === "owner";

  return (
    <div
      className={cn(
        "relative flex items-center overflow-hidden cursor-text bg-white",
        isOwner
          ? "h-10 rounded-sm border border-gray-200"
          : "h-9 rounded-md border border-input",
        className,
      )}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      role="presentation"
    >
      <input
        ref={inputRef}
        id={id}
        type="date"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "flex-1 min-w-0 h-full w-full pl-3 pr-10 text-gray-900 bg-transparent focus:outline-none",
          isOwner ? "text-[13px]" : "text-sm",
          PICKER_OVERLAY_CLASS,
        )}
      />
      <Calendar
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none shrink-0"
        aria-hidden
      />
    </div>
  );
}
