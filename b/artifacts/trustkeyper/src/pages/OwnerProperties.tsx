import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Building2, ChevronLeft } from "lucide-react";
import OwnerLayout, { getOwnerName } from "@/components/OwnerLayout";
import { OwnerPropertyCard } from "@/components/owner/OwnerPropertyCard";
import { FlowSegmentTabs } from "@/components/FlowSegmentTabs";
import { Button } from "@/components/ui/button";
import { OwnerFlowButton } from "@/components/owner/OwnerFlowButton";
import { getProperties, type Property } from "@/lib/properties";
import { PROPERTIES_UPDATED_EVENT } from "@/lib/propertyEditValidation";

const TABS = [
  { id: "all", label: "All" },
  { id: "Occupied", label: "Occupied" },
  { id: "Vacant", label: "Vacant" },
];

export default function OwnerProperties() {
  const [, setLocation] = useLocation();
  const ownerName = getOwnerName().replace("!", "").trim();
  const [properties, setProperties] = useState<Property[]>([]);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    const refresh = () => {
      const all = getProperties();
      const ownerProps = all.filter(
        (p) => p.uploadedBy === "owner" || p.ownerName === ownerName,
      );
      setProperties(ownerProps);
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener(PROPERTIES_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(PROPERTIES_UPDATED_EVENT, refresh);
    };
  }, [ownerName]);

  const counts = {
    all: properties.length,
    Occupied: properties.filter((p) => p.status === "Rented").length,
    Vacant: properties.filter((p) => p.status !== "Rented").length,
  };

  const visible = properties.filter((p) => {
    if (activeTab === "all") return true;
    if (activeTab === "Occupied") return p.status === "Rented";
    if (activeTab === "Vacant") return p.status !== "Rented";
    return true;
  });

  return (
    <OwnerLayout>
      <div className="p-4 sm:p-8 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <button onClick={() => window.history.back()} className="flex items-center gap-2 text-primary font-semibold text-lg hover:underline w-fit">
            <ChevronLeft size={20} /> Back
          </button>
          <OwnerFlowButton onClick={() => setLocation("/owner/properties/add")}>
            Add Property
          </OwnerFlowButton>
        </div>
        <FlowSegmentTabs
          fullWidth
          value={activeTab}
          onChange={setActiveTab}
          className="mb-8"
          options={TABS.map((t) => ({
            value: t.id,
            label: `${t.label} (${counts[t.id as keyof typeof counts]})`,
          }))}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.length === 0 ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-white rounded-lg border border-dashed border-gray-300">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-gray-400 mb-4 bg-gray-50">
                <Building2 size={24} />
              </div>
              <p className="text-gray-600 font-medium mb-1">No properties in this category</p>
              {activeTab === "all" && (
                <button onClick={() => setLocation("/owner/properties/add")} className="text-primary text-sm font-medium hover:underline mt-2">
                  Add a property
                </button>
              )}
            </div>
          ) : (
            visible.map((property) => (
              <OwnerPropertyCard
                key={property.id}
                property={property}
                onClick={() => setLocation(`/owner/properties/${property.id}`)}
              />
            ))
          )}
        </div>
      </div>
    </OwnerLayout>
  );
}
