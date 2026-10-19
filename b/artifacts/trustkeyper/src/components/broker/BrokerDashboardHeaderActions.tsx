import React from "react";
import { FilePlus2, Plus, UserPlus } from "lucide-react";
import { BrokerActionStack, type BrokerActionStackProps } from "./BrokerActionStack";
import { BrokerFlowButton } from "./BrokerFlowButton";

/** Dashboard header CTAs: horizontal row on md+, stacked hierarchy on mobile. */
export function BrokerDashboardHeaderActions(props: BrokerActionStackProps) {
  const { onGenerateAgreement, onAddProperty, onAddTenant, className } = props;

  return (
    <>
      <div
        className={`hidden md:flex items-center gap-3 flex-wrap shrink-0 ${className ?? ""}`}
      >
        <BrokerFlowButton type="button" flowVariant="outline" onClick={onAddTenant}>
          <UserPlus size={16} className="text-primary" /> Add Tenant
        </BrokerFlowButton>
        <BrokerFlowButton type="button" flowVariant="outline" onClick={onAddProperty}>
          <Plus size={16} className="text-primary" /> Add Property
        </BrokerFlowButton>
        <BrokerFlowButton type="button" onClick={onGenerateAgreement}>
          <FilePlus2 size={16} /> Generate Rent Agreement
        </BrokerFlowButton>
      </div>
      <BrokerActionStack
        onGenerateAgreement={onGenerateAgreement}
        onAddProperty={onAddProperty}
        onAddTenant={onAddTenant}
        className={className}
      />
    </>
  );
}
