import React, { useState, useEffect } from "react";
import { Plus, Building2, Eye, Heart, Phone, KeyRound } from "lucide-react";
import { useLocation } from "wouter";
import BrokerLayout from "@/components/BrokerLayout";
import { BrokerFlowButton } from "@/components/broker/BrokerFlowButton";
import { FlowSegmentTabs } from "@/components/FlowSegmentTabs";
import {
  getProperties,
  updatePropertyStatus,
  getPropertyTitle,
  type Property,
  type PropertyStatus,
} from "@/lib/properties";
import { PROPERTIES_UPDATED_EVENT } from "@/lib/propertyEditValidation";
import { timeAgo } from "@/lib/tenants";

const TAB_IDS: { id: "all" | PropertyStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "Active", label: "Active" },
  { id: "Draft", label: "Draft" },
  { id: "Rented", label: "Rented" },
];

function StatusBadge({ status }: { status: PropertyStatus }) {
  const styles: Record<PropertyStatus, string> = {
    Active: "text-green-600 bg-green-50",
    Draft: "text-gray-500 bg-gray-100",
    Rented: "text-blue-600 bg-blue-50",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>
      {status === "Active" && <span className="text-green-500">✓</span>}
      {status}
    </span>
  );
}

function PropertyCard({
  property,
  onMarkRented,
  onViewDetails,
  onEditProperty,
}: {
  property: Property;
  onMarkRented: (id: string) => void;
  onViewDetails: (id: string) => void;
  onEditProperty: (id: string) => void;
}) {
  const type = property.propertyType === "Other"
    ? (property.propertyTypeOther || "Property")
    : property.propertyType;
  const size = property.unitSize === "Other"
    ? (property.unitSizeOther || "")
    : property.unitSize;
  const title = getPropertyTitle(property);
  const subtitle = `${property.area}, ${property.city}`;
  const rent = property.monthlyRent
    ? `₹${Number(property.monthlyRent).toLocaleString("en-IN")}/month`
    : "—";
  const deposit = property.securityDeposit
    ? `₹${Number(property.securityDeposit).toLocaleString("en-IN")} deposit`
    : "";
  const area = property.builtUpArea
    ? `${property.builtUpArea} ${property.builtUpUnits}`
    : "";



  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
      {/* Image */}
      <button
        type="button"
        onClick={() => onViewDetails(property.id)}
        className="w-full aspect-video bg-gray-100 relative flex items-center justify-center overflow-hidden"
      >
        {property.images && property.images.length > 0 ? (
          <img
            src={property.images[0]}
            alt="property"
            className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform"
          />
        ) : (
          <Building2 size={48} className="text-gray-400" />
        )}
        {property.imageCount > 0 && (
          <span className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-lg font-medium">
            {property.imageCount} pics
          </span>
        )}
      </button>

      {/* Content */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 leading-tight truncate" title={title}>{title}</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate" title={subtitle}>{subtitle}</p>
          </div>
          <StatusBadge status={property.status} />
        </div>

        {/* Price & Details */}
        <div>
          <p className="text-base font-semibold text-gray-900">
            {rent}
          </p>
          {deposit && <p className="text-xs text-gray-500 mt-0.5">{deposit}</p>}
        </div>

        <p className="text-xs text-gray-500">
          {[area, property.furnishing, `Listed ${timeAgo(property.createdAt)}`]
            .filter(Boolean)
            .join(" • ")}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-500 pt-2 border-t border-gray-100">
          <span className="flex items-center gap-1"><Eye size={12} /> 0</span>
          <span className="flex items-center gap-1"><Heart size={12} /> 0</span>
          <span className="flex items-center gap-1"><Phone size={12} /> 0</span>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-2 pt-2 mt-auto">
          <div className="flex gap-2 w-full min-w-0">
            <BrokerFlowButton
              type="button"
              flowVariant="sm-primary"
              onClick={(event) => {
                event.stopPropagation();
                onViewDetails(property.id);
              }}
              className="flex-1 min-w-0"
            >
              View Details
            </BrokerFlowButton>
            <BrokerFlowButton
              type="button"
              flowVariant="sm-ghost"
              onClick={(event) => {
                event.stopPropagation();
                onEditProperty(property.id);
              }}
              className="flex-1 min-w-0"
            >
              Edit
            </BrokerFlowButton>
          </div>
          {property.status !== "Rented" && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onMarkRented(property.id);
              }}
              className="inline-flex items-center justify-center gap-1.5 self-center sm:self-end w-fit border-0 bg-transparent shadow-none px-2 py-1 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <KeyRound size={14} className="shrink-0 text-primary" aria-hidden />
              Mark as Rented
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BrokerProperties() {
  const [, setLocation] = useLocation();
  const [properties, setProperties] = useState<Property[]>([]);
  const [active, setActive] = useState<"all" | PropertyStatus>("all");

  const refresh = () => setProperties(getProperties());

  const handleViewDetails = (id: string) => setLocation(`/broker/properties/${id}`);
  const handleEditProperty = (id: string) => setLocation(`/broker/properties/add?edit=${id}`);

  useEffect(() => {
    refresh();
    window.addEventListener(PROPERTIES_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROPERTIES_UPDATED_EVENT, refresh);
  }, []);

  const handleMarkRented = (id: string) => {
    updatePropertyStatus(id, "Rented");
    refresh();
  };

  const counts = {
    all: properties.length,
    Active: properties.filter((p) => p.status === "Active").length,
    Draft: properties.filter((p) => p.status === "Draft").length,
    Rented: properties.filter((p) => p.status === "Rented").length,
  };

  const visible = properties.filter((p) => {
    if (active === "all") return true;
    return p.status === active;
  });

  return (
    <BrokerLayout>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          My Properties ({counts.all})
        </h1>
        <BrokerFlowButton onClick={() => setLocation("/broker/properties/add")} className="w-full sm:w-fit">
          <Plus size={16} /> Add Property
        </BrokerFlowButton>
      </div>

      <FlowSegmentTabs
        value={active}
        onChange={(v) => setActive(v)}
        className="mb-8"
        options={TAB_IDS.map((t) => ({
          value: t.id,
          label: `${t.label} (${counts[t.id]})`,
        }))}
      />

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-gray-400 mb-4">
            <Building2 size={28} />
          </div>
          <p className="text-gray-500 font-medium mb-1">No Properties Found</p>
          <p className="text-sm text-gray-400">
            Add your first property to get started with TrustKeyper
          </p>
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3 auto-rows-fr">
          {visible.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              onMarkRented={handleMarkRented}
              onViewDetails={handleViewDetails}
              onEditProperty={handleEditProperty}
            />
          ))}
        </div>
      )}
    </BrokerLayout>
  );
}
