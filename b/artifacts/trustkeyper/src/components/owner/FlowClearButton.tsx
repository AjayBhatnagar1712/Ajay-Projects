import * as React from "react";
import { cn } from "@/lib/utils";

/** Borderless, fill-less action control (broker add-property pattern). */
export function FlowClearButton({
  className,
  children = "Clear",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "text-xs font-semibold text-primary border-0 bg-transparent shadow-none px-2 py-1.5 rounded-[4px] hover:bg-primary/10 transition-colors shrink-0",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
