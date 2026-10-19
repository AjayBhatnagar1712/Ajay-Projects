import React, { useEffect, useMemo, useState } from "react";
import {
  Bath,
  BedDouble,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  Compass,
  CookingPot,
  Dumbbell,
  Flame,
  IndianRupee,
  Layers,
  Leaf,
  Loader2,
  MapPin,
  Package,
  PawPrint,
  ShieldCheck,
  Sofa,
  Sparkles,
  SquareDashedBottom,
  Train,
  Trophy,
  Users,
  Waves,
  Wind,
  Zap,
  Bell,
  BookOpen,
} from "lucide-react";
import { FlowSegmentTabs } from "@/components/FlowSegmentTabs";
import { FLOW_STICKY_CONTENT_CLASS, FlowStickyActionBar } from "@/components/FlowStickyActionBar";
import { Button } from "@/components/ui/button";
import { getPropertyTitle, type Property } from "@/lib/properties";
import { BROKER_OWNER_MASK_MESSAGE } from "@/lib/propertyShareView";
import type { TenantShareResponse } from "@/lib/tenantShareSession";
import { cn } from "@/lib/utils";

type Tab = "overview" | "amenities" | "neighbourhood" | "owner";

const CITY_NEIGHBOURHOOD: Record<
  string,
  { transit: { name: string; distance: string }[]; nearby: string[] }
> = {
  Hyderabad: {
    transit: [
      { name: "Hitech Shilparamam", distance: "~1.5 km" },
      { name: "Madhapur Metro Station", distance: "~2.8 km" },
      { name: "Madhapur Bus Stop", distance: "~0.5 km" },
    ],
    nearby: ["Apollo Pharmacy", "JNTU College", "Inorbit Mall", "AIG Hospitals", "Hitech City Metro"],
  },
  Bengaluru: {
    transit: [
      { name: "Koramangala Bus Stop", distance: "~0.8 km" },
      { name: "Jayanagar Metro Station", distance: "~3.2 km" },
      { name: "BTM BMTC Depot", distance: "~1.4 km" },
    ],
    nearby: ["Forum Mall", "St. John's Hospital", "Christ University", "Sony World Junction", "Garuda Mall"],
  },
  Mumbai: {
    transit: [
      { name: "Andheri Station (W)", distance: "~1.2 km" },
      { name: "Andheri Metro Station", distance: "~0.9 km" },
      { name: "Powai Bus Stop", distance: "~0.4 km" },
    ],
    nearby: ["Hiranandani Hospital", "Galleria Mall", "IIT Bombay", "Powai Lake", "R-City Mall"],
  },
  Delhi: {
    transit: [
      { name: "Saket Metro Station", distance: "~1.0 km" },
      { name: "Malviya Nagar Metro", distance: "~2.5 km" },
      { name: "Saket Bus Terminal", distance: "~0.8 km" },
    ],
    nearby: ["Select Citywalk", "Fortis Hospital", "DLF Mall", "Max Hospital", "JNU Campus"],
  },
  Pune: {
    transit: [
      { name: "Hinjewadi Bus Stop", distance: "~0.6 km" },
      { name: "Baner Bus Stop", distance: "~1.3 km" },
      { name: "Shivaji Nagar Station", distance: "~8.0 km" },
    ],
    nearby: ["Seasons Mall", "Jehangir Hospital", "Symbiosis College", "Aga Khan Palace", "Phoenix Market City"],
  },
  Noida: {
    transit: [
      { name: "Sector 62 Metro", distance: "~0.7 km" },
      { name: "Electronic City Metro", distance: "~1.2 km" },
      { name: "Sector 18 Metro", distance: "~3.5 km" },
    ],
    nearby: ["DLF Mall of India", "Fortis Hospital", "Amity University", "Great India Place", "Wave City Center"],
  },
};

const AMENITY_ICONS: Record<string, React.ElementType> = {
  "Sport Club": Trophy,
  Gym: Dumbbell,
  "Store Room": Package,
  "Parking Space": Car,
  Pool: Waves,
  "Power Backup": Zap,
  "Alarm System": Bell,
  Refrigerator: CookingPot,
  "Covered Car Parking Space": Car,
  "Pooja Room": Flame,
  "Study Room": BookOpen,
  "Servant Room": Users,
  Garden: Leaf,
  "Pets Allowed": PawPrint,
  "Air Conditioning": Wind,
  "Basketball Court": Trophy,
  Spa: Sparkles,
  "Uncovered Car Parking Space": Car,
};

function formatRent(v?: string): string {
  const n = Number(v);
  if (!n) return "—";
  return `₹${n.toLocaleString("en-IN")}/mo`;
}

function formatDeposit(v?: string): string {
  const n = Number(v);
  if (!n) return "—";
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

function formatDate(v?: string): string {
  if (!v) return "Immediately";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function bhkLabel(property: Property): string {
  const size =
    property.unitSize === "Other" ? property.unitSizeOther || "—" : property.unitSize || property.bedrooms;
  return size || "—";
}

function displayTitle(property: Property): string {
  return property.nickname?.trim() || getPropertyTitle(property);
}

const PLACEHOLDER_GRADIENTS = [
  "from-blue-200 to-indigo-300",
  "from-gray-200 to-gray-300",
  "from-slate-200 to-blue-200",
];

function PublicImageGallery({
  images,
  selectedImage,
  onSelect,
  isLive,
}: {
  images: string[];
  selectedImage: number;
  onSelect: (i: number) => void;
  isLive: boolean;
}) {
  const hasImages = images.length > 0;
  const count = hasImages ? images.length : 1;

  return (
    <div>
      <div
        className={cn(
          "rounded-xl overflow-hidden relative",
          hasImages ? "bg-gray-100" : `bg-gradient-to-br ${PLACEHOLDER_GRADIENTS[selectedImage % PLACEHOLDER_GRADIENTS.length]}`,
        )}
        style={{ height: 280 }}
      >
        {hasImages ? (
          <img
            src={images[selectedImage]}
            alt={`Property image ${selectedImage + 1}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Building2 size={48} className="text-white/40" />
          </div>
        )}
        {isLive ? (
          <span className="absolute top-3 left-3 bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            Live
          </span>
        ) : null}
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
          {selectedImage + 1} / {count}
        </span>
      </div>
      {hasImages && images.length > 1 ? (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                "w-20 h-14 shrink-0 rounded-lg overflow-hidden relative transition-all bg-gray-100",
                selectedImage === i ? "ring-2 ring-primary ring-offset-1" : "opacity-70 hover:opacity-100",
              )}
            >
              <img src={src} alt={`thumb ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OverviewTab({ property }: { property: Property }) {
  const rows: { icon: React.ElementType; label: string; value: string }[] = [
    { icon: Wind, label: "Furnishing Status", value: property.furnishing || "—" },
    {
      icon: Layers,
      label: "Floor Level",
      value: property.floorLevel ? `${property.floorLevel} / ${property.totalFloors} Floors` : "—",
    },
    {
      icon: SquareDashedBottom,
      label: "Built-up Area",
      value: property.builtUpArea ? `${property.builtUpArea} ${property.builtUpUnits}` : "—",
    },
    { icon: Compass, label: "Main Door Faces", value: property.mainDoorDirection || "—" },
    { icon: Users, label: "Tenant Preference", value: property.tenantsPreferred?.join(", ") || "No Preference" },
    { icon: Calendar, label: "Available From", value: formatDate(property.availableFrom) },
    { icon: BedDouble, label: "Bedrooms", value: property.bedrooms || "—" },
    { icon: Bath, label: "Bathrooms", value: property.bathrooms || "—" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Property Details</h3>
      <div className="grid grid-cols-1 gap-y-3">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-2 text-sm min-w-0">
            <Icon size={14} className="text-gray-400 shrink-0 mt-0.5" />
            <span className="text-gray-500 shrink-0">{label}:</span>
            <span className="font-medium text-gray-800 break-words">{value}</span>
          </div>
        ))}
      </div>
      {property.securityDeposit ? (
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-start gap-2 text-sm">
          <IndianRupee size={14} className="text-gray-400 shrink-0 mt-0.5" />
          <span className="text-gray-500">Security Deposit:</span>
          <span className="font-medium text-gray-800">{formatDeposit(property.securityDeposit)}</span>
        </div>
      ) : null}
      {property.address ? (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">Full Address</p>
          <p className="text-sm text-gray-700 mt-0.5">{property.address}</p>
        </div>
      ) : null}
    </div>
  );
}

function AmenitiesTab({ property }: { property: Property }) {
  const amenities = property.amenities || [];
  if (amenities.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Amenities</h3>
        <p className="text-sm text-gray-500">No amenities listed for this property.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-5">Amenities</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {amenities.map((a) => {
          const Icon = AMENITY_ICONS[a] || ShieldCheck;
          return (
            <div
              key={a}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 bg-gray-50 text-center"
            >
              <Icon size={20} className="text-primary" />
              <span className="text-xs text-gray-600 leading-tight">{a}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NeighbourhoodTab({ property }: { property: Property }) {
  const data = CITY_NEIGHBOURHOOD[property.city] ?? {
    transit: [
      { name: `${property.area || property.city} Bus Stop`, distance: "~0.5 km" },
      { name: `${property.city} Metro Station`, distance: "~2.0 km" },
    ],
    nearby: ["Local Market", "Hospital", "School", "Mall", "Park"],
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-5">
      <h3 className="text-base font-semibold text-gray-900">Neighbourhood</h3>
      <div>
        <h4 className="text-sm font-semibold text-gray-800 mb-3">Transit</h4>
        <div className="space-y-2">
          {data.transit.map((t) => (
            <div key={t.name} className="flex items-center gap-3 text-sm">
              <Train size={14} className="text-primary shrink-0" />
              <span className="text-gray-700 flex-1">{t.name}</span>
              <span className="text-gray-500">{t.distance}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-gray-800 mb-3">Nearby</h4>
        <div className="flex flex-wrap gap-2">
          {data.nearby.map((n) => (
            <span
              key={n}
              className="px-3 py-1 rounded-full border border-gray-200 text-xs text-gray-600 bg-white"
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function AboutOwnerTab({
  property,
  maskOwnerDetails,
}: {
  property: Property;
  maskOwnerDetails: boolean;
}) {
  if (maskOwnerDetails) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">About Owner</h3>
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center">
          <ShieldCheck size={28} className="text-primary mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-800">{BROKER_OWNER_MASK_MESSAGE}</p>
          <p className="text-xs text-gray-500 mt-2">
            Your broker will guide you through the next steps on TrustKeyper.
          </p>
        </div>
      </div>
    );
  }

  const co = property.coOwners ?? [];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-5">About Owner</h3>
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-semibold shrink-0">
          {(property.ownerName || "O").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-base">{property.ownerName || "Owner"}</p>
          <p className="text-sm text-gray-500 mt-0.5">Property Owner</p>
          {property.ownerContact ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <span className="text-gray-400">Contact:</span>
              <span className="font-medium">{property.ownerContact}</span>
            </div>
          ) : null}
          {co.length > 0 ? (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Additional owners
              </p>
              <ul className="space-y-3">
                {co.map((o, i) => (
                  <li key={i} className="flex flex-col sm:flex-row sm:items-center sm:gap-3 text-sm">
                    <span className="font-medium text-gray-900">{o.name || "—"}</span>
                    {o.contact ? <span className="text-gray-600">{o.contact}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-3 flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <CheckCircle2 size={13} />
            <span>Verified Owner</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center min-w-0">
      <Icon size={16} className="text-gray-400 mx-auto mb-1" />
      <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function CtaSection({
  response,
  loading,
  onInterested,
  onNotInterested,
  className,
}: {
  response: TenantShareResponse | null;
  loading: boolean;
  onInterested: () => void;
  onNotInterested: () => void;
  className?: string;
}) {
  if (response === "interested") {
    return (
      <div className={cn("rounded-xl border border-green-200 bg-green-50 p-4 text-center", className)}>
        <CheckCircle2 size={28} className="text-green-600 mx-auto mb-2" />
        <p className="text-sm font-semibold text-green-900">You expressed interest</p>
        <p className="text-xs text-green-700 mt-1">Your interest has been shared successfully.</p>
      </div>
    );
  }

  if (response === "not_interested") {
    return (
      <div className={cn("rounded-xl border border-gray-200 bg-gray-50 p-4 text-center", className)}>
        <p className="text-sm font-semibold text-gray-800">Thank you for your response.</p>
        <p className="text-xs text-gray-500 mt-1">You marked this property as not interested.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        type="button"
        className="w-full h-11 rounded-[4px] font-semibold"
        disabled={loading}
        onClick={onInterested}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin mr-2" /> Submitting…
          </>
        ) : (
          "I am interested"
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full h-11 rounded-[4px] font-semibold border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
        disabled={loading}
        onClick={onNotInterested}
      >
        Not Interested
      </Button>
    </div>
  );
}

export function PropertyPublicCardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-xl bg-gray-200 h-[280px]" />
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="h-6 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PropertyPublicCard({
  property,
  maskOwnerDetails = false,
  response,
  ctaLoading,
  onInterested,
  onNotInterested,
}: {
  property: Property;
  maskOwnerDetails?: boolean;
  response: TenantShareResponse | null;
  ctaLoading: boolean;
  onInterested: () => void;
  onNotInterested: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedImage, setSelectedImage] = useState(0);
  const images = useMemo(() => property.images ?? [], [property.images]);
  const title = displayTitle(property);
  const location = [property.area, property.city].filter(Boolean).join(", ");
  const isLive = property.status === "Active";

  const tabs: { value: Tab; label: string }[] = [
    { value: "overview", label: "Overview" },
    { value: "amenities", label: "Amenities" },
    { value: "neighbourhood", label: "Neighbourhood" },
    { value: "owner", label: "About Owner" },
  ];

  useEffect(() => {
    setSelectedImage(0);
  }, [property.id]);

  return (
    <div className={cn("space-y-4", FLOW_STICKY_CONTENT_CLASS)}>
      <PublicImageGallery
        images={images}
        selectedImage={selectedImage}
        onSelect={setSelectedImage}
        isLive={isLive}
      />

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-4">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 leading-tight">{title}</h1>
          {location ? (
            <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
              <MapPin size={14} className="text-gray-400 shrink-0" />
              <span>{location}</span>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatCard icon={BedDouble} label="BHK" value={bhkLabel(property)} />
          <StatCard icon={IndianRupee} label="Price" value={formatRent(property.monthlyRent)} />
          <StatCard
            icon={SquareDashedBottom}
            label="Area"
            value={
              property.builtUpArea
                ? `${property.builtUpArea} ${property.builtUpUnits || "sq ft"}`.trim()
                : "—"
            }
          />
          <StatCard icon={Sofa} label="Furnishing" value={property.furnishing || "—"} />
        </div>

        <div className="hidden sm:block">
          <CtaSection
            response={response}
            loading={ctaLoading}
            onInterested={onInterested}
            onNotInterested={onNotInterested}
          />
        </div>
      </div>

      <FlowSegmentTabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as Tab)}
        options={tabs}
      />

      <div>
        {activeTab === "overview" && <OverviewTab property={property} />}
        {activeTab === "amenities" && <AmenitiesTab property={property} />}
        {activeTab === "neighbourhood" && <NeighbourhoodTab property={property} />}
        {activeTab === "owner" && (
          <AboutOwnerTab property={property} maskOwnerDetails={maskOwnerDetails} />
        )}
      </div>

      <FlowStickyActionBar>
        <CtaSection
          response={response}
          loading={ctaLoading}
          onInterested={onInterested}
          onNotInterested={onNotInterested}
        />
      </FlowStickyActionBar>
    </div>
  );
}
