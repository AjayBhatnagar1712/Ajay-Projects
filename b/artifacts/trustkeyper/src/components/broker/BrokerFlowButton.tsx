import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BrokerFlowButtonVariant = "primary" | "outline" | "sm-primary" | "sm-outline" | "sm-ghost";

type BrokerFlowButtonProps = React.ComponentProps<typeof Button> & {
  flowVariant?: BrokerFlowButtonVariant;
};

const variantClasses: Record<BrokerFlowButtonVariant, string> = {
  primary:
    "h-10 min-h-10 px-6 text-sm font-semibold rounded-[4px] gap-2 border-0 shadow-md shadow-primary/25",
  outline:
    "h-10 min-h-10 px-6 text-sm font-semibold rounded-[4px] gap-2 bg-white border border-primary text-primary hover:bg-primary/5",
  "sm-primary":
    "h-9 min-h-9 px-3 text-xs font-semibold rounded-[4px] gap-2 border-0 shadow-none",
  "sm-outline":
    "h-9 min-h-9 px-3 text-xs font-semibold rounded-[4px] gap-2 bg-white border border-primary text-primary hover:bg-primary/5",
  "sm-ghost":
    "h-9 min-h-9 px-3 text-xs font-semibold rounded-[4px] gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50",
};

/**
 * Standard broker-flow CTA: 4px radius, matches Broker Tenants page styling.
 */
export function BrokerFlowButton({
  className,
  flowVariant = "primary",
  children,
  ...props
}: BrokerFlowButtonProps) {
  return (
    <Button
      variant={flowVariant === "primary" || flowVariant === "sm-primary" ? "default" : "outline"}
      className={cn(
        "w-full sm:w-fit",
        variantClasses[flowVariant],
        flowVariant !== "primary" && flowVariant !== "sm-primary" && "shadow-none",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
