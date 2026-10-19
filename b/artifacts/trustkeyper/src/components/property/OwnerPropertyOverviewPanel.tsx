import type { Property } from "@/lib/properties";

export interface OwnerPropertyOverviewPanelProps {
  property: Property;
  rentLabel: string;
  areaLabel: string;
}

/** Owner overview details panel — property facts without duplicating the shared gallery. */
export function OwnerPropertyOverviewPanel({
  property,
  rentLabel,
  areaLabel,
}: OwnerPropertyOverviewPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Property Details</h2>
      <div className="space-y-4">
        {[
          { label: "Property Type", value: property.propertyType },
          { label: "BHK / Size", value: `${property.bedrooms} Bed, ${property.bathrooms} Bath` },
          { label: "Built-up Area", value: areaLabel },
          { label: "Furnishing", value: property.furnishing },
          { label: "Expected Rent", value: `${rentLabel}/mo` },
          {
            label: "Security Deposit",
            value: `₹${Number(property.securityDeposit || 0).toLocaleString("en-IN")}`,
          },
          { label: "Floor Level", value: property.floorLevel },
          { label: "Direction", value: property.mainDoorDirection },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between py-2 border-b border-gray-50 last:border-none"
          >
            <span className="text-sm text-gray-500 font-medium">{item.label}</span>
            <span className="text-sm font-semibold text-gray-900">{item.value || "—"}</span>
          </div>
        ))}
      </div>
      {property.amenities && property.amenities.length > 0 ? (
        <div className="pt-5 flex flex-wrap gap-2">
          {property.amenities.map((amenity) => (
            <span
              key={amenity}
              className="px-3 py-1 bg-primary/10 text-primary text-[11px] font-semibold rounded-full border border-primary/15"
            >
              {amenity}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
