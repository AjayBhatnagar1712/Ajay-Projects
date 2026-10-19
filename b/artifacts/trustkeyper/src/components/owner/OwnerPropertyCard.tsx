import React from "react";
import { MapPin } from "lucide-react";
import type { Property } from "@/lib/properties";

export interface OwnerPropertyCardProps {
  property: Property;
  onClick: () => void;
  className?: string;
}

/**
 * Standard owner property card — matches /owner/properties grid styling.
 */
export function OwnerPropertyCard({ property, onClick, className = "" }: OwnerPropertyCardProps) {
  const title = property.nickname || property.address || "Property Name";
  const location = [property.area, property.city].filter(Boolean).join(", ");
  const isRented = property.status === "Rented";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm flex flex-col cursor-pointer hover:shadow-md transition-shadow ${className}`}
    >
      <div className="relative h-48 bg-gray-100 shrink-0">
        {property.images?.[0] ? (
          <img src={property.images[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            No Image
          </div>
        )}
        <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded flex items-center gap-1 shadow-sm">
          {!isRented && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
          {isRented ? "Occupied" : "Live"}
        </div>
      </div>
      <div className="p-3 sm:p-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 text-lg sm:text-base line-clamp-2">{title}</h3>
          <div className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 shrink-0">
            <span className="text-[10px]">›</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 flex items-center gap-1 mb-3 line-clamp-1">
          <MapPin size={12} className="shrink-0" />
          {location || "—"}
        </p>
        <div className="mt-auto pt-3 border-t border-gray-100">
          <p className="font-semibold text-gray-900 text-base sm:text-[15px]">
            ₹{Number(property.monthlyRent || 0).toLocaleString("en-IN")}
            <span className="text-xs text-gray-500 font-normal">/mo</span>
          </p>
        </div>
      </div>
    </div>
  );
}
