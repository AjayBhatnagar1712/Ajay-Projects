import {
  BedDouble,
  Building2,
  Calendar,
  CheckCircle2,
  MapPin,
  Users,
} from "lucide-react";
import type { Property } from "@/lib/properties";
import {
  formatPropertyAvailableDate,
  formatPropertyDeposit,
  formatPropertyRent,
  getPropertyDetailTitle,
  getPropertyDetailTypeLabel,
} from "@/lib/propertyDetailFormatters";
import { cn } from "@/lib/utils";
import { PropertyDetailActions } from "@/components/property/PropertyDetailActions";

export interface PropertyDetailSummaryCardProps {
  property: Property;
  title?: string;
  onShare: () => void;
  onEdit: () => void;
  editLabel?: string;
  showEdit?: boolean;
  verifiedLabel?: string;
  verifiedTone?: "success" | "warning";
}

export function PropertyDetailSummaryCard({
  property,
  title,
  onShare,
  onEdit,
  editLabel = "Edit Details",
  showEdit = true,
  verifiedLabel = "Verified Available",
  verifiedTone = "success",
}: PropertyDetailSummaryCardProps) {
  const displayTitle = title ?? getPropertyDetailTitle(property);
  const type = getPropertyDetailTypeLabel(property);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 leading-tight">{displayTitle}</h1>
        <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
          <MapPin size={13} className="text-gray-400 shrink-0" />
          <span>
            {property.area}, {property.city}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-semibold text-primary">{formatPropertyRent(property.monthlyRent)}</p>
          <p className="text-[10px] text-gray-500">Rent/month</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{property.builtUpArea || "—"}</p>
          <p className="text-[10px] text-gray-500">{property.builtUpArea ? property.builtUpUnits : ""}</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{formatPropertyDeposit(property.securityDeposit)}</p>
          <p className="text-[10px] text-gray-500">Deposit</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-2 text-sm">
        {property.unitSize ? (
          <div className="flex items-center gap-2 text-gray-700 min-w-0">
            <BedDouble size={14} className="text-gray-400 shrink-0" />
            <span className="truncate">
              {property.unitSize !== "Other" ? property.unitSize : property.unitSizeOther}
            </span>
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-gray-700 min-w-0">
          <Building2 size={14} className="text-gray-400 shrink-0" />
          <span className="truncate">{type}</span>
        </div>
        {property.tenantsPreferred && property.tenantsPreferred.length > 0 ? (
          <div className="flex items-center gap-2 text-gray-700 min-w-0">
            <Users size={14} className="text-gray-400 shrink-0" />
            <span className="truncate">{property.tenantsPreferred[0]}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-gray-700">
          <Calendar size={14} className="text-gray-400 shrink-0" />
          <span>{formatPropertyAvailableDate(property.availableFrom)}</span>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium",
          verifiedTone === "warning" ? "text-amber-600" : "text-green-600",
        )}
      >
        <CheckCircle2 size={15} className="shrink-0" />
        <span>{verifiedLabel}</span>
      </div>

      <PropertyDetailActions
        onShare={onShare}
        onEdit={onEdit}
        editLabel={editLabel}
        showEdit={showEdit}
      />
    </div>
  );
}
