import React from "react";
import { cn } from "@/lib/utils";

/** Reserve space above a mobile sticky action bar so content is never covered. */
export const FLOW_STICKY_CONTENT_CLASS =
  "pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] sm:pb-0";

type FlowStickyActionBarProps = {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
};

/** Mobile-only fixed bottom action bar used across owner and broker flows. */
export function FlowStickyActionBar({
  children,
  className,
  innerClassName,
}: FlowStickyActionBarProps) {
  return (
    <div
      className={cn(
        "sm:hidden fixed inset-x-0 bottom-0 z-20 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_10px_rgba(0,0,0,0.05)]",
        className,
      )}
    >
      <div className={cn(innerClassName)}>{children}</div>
    </div>
  );
}
