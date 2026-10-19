import React from "react";
import { FilePlus2, Plus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrokerFlowButton } from "./BrokerFlowButton";

export interface BrokerActionStackProps {
  onGenerateAgreement: () => void;
  onAddProperty: () => void;
  onAddTenant: () => void;
  className?: string;
}

/**
 * Mobile-only broker actions: primary full-width, two secondary CTAs below (50/50).
 */
export function BrokerActionStack({
  onGenerateAgreement,
  onAddProperty,
  onAddTenant,
  className,
}: BrokerActionStackProps) {
  return (
    <div className={cn("flex w-full max-w-md flex-col gap-3 md:hidden", className)}>
      <BrokerFlowButton
        type="button"
        onClick={onGenerateAgreement}
        className="w-full"
      >
        <FilePlus2 size={18} strokeWidth={2.25} />
        <span>Generate Rent Agreement</span>
      </BrokerFlowButton>

      <div className="grid grid-cols-2 gap-3">
        <BrokerFlowButton
          type="button"
          flowVariant="outline"
          onClick={onAddTenant}
          className="w-full px-3"
        >
          <UserPlus size={16} className="shrink-0 text-primary" />
          <span className="truncate">Add Tenant</span>
        </BrokerFlowButton>
        <BrokerFlowButton
          type="button"
          flowVariant="outline"
          onClick={onAddProperty}
          className="w-full px-3"
        >
          <Plus size={16} className="shrink-0 text-primary" />
          <span className="truncate">Add Property</span>
        </BrokerFlowButton>
      </div>
    </div>
  );
}
