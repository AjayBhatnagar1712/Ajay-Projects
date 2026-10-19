import React, { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import {
  MapPin,
  Users,
  Building2,
  Calendar,
  Flag,
  Layers,
  Wind,
  Zap,
  Car,
  Leaf,
  Dumbbell,
  Package,
  BookOpen,
  Flame,
  PawPrint,
  Waves,
  Bell,
  ShieldCheck,
  CookingPot,
  ScanLine,
  Trophy,
  Sparkles,
  BedDouble,
  Bath,
  Compass,
  CheckCircle2,
  Train,
  ChevronRight,
  IndianRupee,
  SquareDashedBottom,
} from "lucide-react";
import { getProperties, type Property } from "@/lib/properties";
import { PROPERTIES_UPDATED_EVENT } from "@/lib/propertyEditValidation";
import BrokerLayout from "@/components/BrokerLayout";
import { FlowSegmentTabs } from "@/components/FlowSegmentTabs";
import { PropertyDetailImageGallery } from "@/components/property/PropertyDetailImageGallery";
import { PropertyDetailPageLayout } from "@/components/property/PropertyDetailPageLayout";
import { PropertyDetailSummaryCard } from "@/components/property/PropertyDetailSummaryCard";
import { SharePropertyModal } from "@/components/owner/SharePropertyModal";
import { formatPropertyAvailableDate, getPropertyDetailTitle } from "@/lib/propertyDetailFormatters";

// ─── Neighbourhood data keyed by city ─────────────────────────────────────────

const CITY_NEIGHBOURHOOD: Record<string, {
  transit: { name: string; distance: string }[];
  nearby: string[];
}> = {
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

// ─── Amenity icon map ─────────────────────────────────────────────────────────

const AMENITY_ICONS: Record<string, React.ElementType> = {
  "Sport Club": Trophy,
  "Gym": Dumbbell,
  "Store Room": Package,
  "Parking Space": Car,
  "Pool": Waves,
  "Power Backup": Zap,
  "Alarm System": Bell,
  "Refrigerator": CookingPot,
  "Covered Car Parking Space": Car,
  "Pooja Room": Flame,
  "Study Room": BookOpen,
  "Servant Room": Users,
  "Garden": Leaf,
  "Pets Allowed": PawPrint,
  "Air Conditioning": Wind,
  "Basketball Court": Trophy,
  "Spa": Sparkles,
  "Uncovered Car Parking Space": Car,
};

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = "overview" | "amenities" | "neighbourhood" | "owner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Tab Content Components ───────────────────────────────────────────────────

function OverviewTab({ property }: { property: Property }) {
  const type = property.propertyType === "Other"
    ? (property.propertyTypeOther || "Property")
    : property.propertyType;
  const size = property.unitSize === "Other"
    ? (property.unitSizeOther || "")
    : property.unitSize;

  const rows: { icon: React.ElementType; label: string; value: string }[] = [
    { icon: Wind, label: "Furnishing Status", value: property.furnishing || "—" },
    { icon: Layers, label: "Floor Level", value: property.floorLevel ? `${property.floorLevel} / ${property.totalFloors} Floors` : "—" },
    { icon: SquareDashedBottom, label: "Built-up Area", value: property.builtUpArea ? `${property.builtUpArea} ${property.builtUpUnits}` : "—" },
    { icon: Compass, label: "Main Door Faces", value: property.mainDoorDirection || "—" },
    { icon: Users, label: "Tenant Preference", value: property.tenantsPreferred?.join(", ") || "No Preference" },
    { icon: Calendar, label: "Available From", value: formatPropertyAvailableDate(property.availableFrom) },
    { icon: BedDouble, label: "Bedrooms", value: property.bedrooms || "—" },
    { icon: Bath, label: "Bathrooms", value: property.bathrooms || "—" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Property Details</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-2 text-sm min-w-0">
            <Icon size={14} className="text-gray-400 shrink-0" />
            <span className="text-gray-500">{label}:</span>
            <span className="font-medium text-gray-800 break-words">{value}</span>
          </div>
        ))}
      </div>
      {property.address && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">Full Address</p>
          <p className="text-sm text-gray-700 mt-0.5">{property.address}</p>
        </div>
      )}
    </div>
  );
}

function AmenitiesTab({ property }: { property: Property }) {
  const amenities = property.amenities || [];
  if (amenities.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Amenities</h3>
        <p className="text-sm text-gray-500">No amenities listed for this property.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-5">Amenities</h3>
      <div className="grid grid-cols-4 gap-3">
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

function buildMapsSearchQuery(property: Property): string | null {
  const addr = property.address?.trim() ?? "";
  if (addr.length < 3) return null;
  const tail = [property.area, property.city, property.pincode, property.country]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .filter((part) => !addr.toLowerCase().includes(part.toLowerCase()));
  return [addr, ...tail].join(", ");
}

function googleMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function googleMapsEmbedUrl(query: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

function NeighbourhoodAddressMap({ property }: { property: Property }) {
  const query = useMemo(
    () => buildMapsSearchQuery(property),
    [property.address, property.area, property.city, property.pincode, property.country],
  );
  /** Optional: enables Geocoding validation so bogus addresses show “Not available”. */
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const [validated, setValidated] = useState<"yes" | "no" | "pending">(() => {
    if (!query) return "no";
    if (!apiKey) return "yes";
    return "pending";
  });

  useEffect(() => {
    if (!query) {
      setValidated("no");
      return;
    }
    if (!apiKey) {
      setValidated("yes");
      return;
    }

    setValidated("pending");
    let cancelled = false;
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", query);
    url.searchParams.set("key", apiKey);

    fetch(url.toString())
      .then((res) => res.json() as Promise<{ status?: string; results?: unknown[] }>)
      .then((data) => {
        if (cancelled) return;
        const ok = data.status === "OK" && Array.isArray(data.results) && data.results.length > 0;
        setValidated(ok ? "yes" : "no");
      })
      .catch(() => {
        if (!cancelled) setValidated("no");
      });

    return () => {
      cancelled = true;
    };
  }, [query, apiKey]);

  if (!query || validated === "no") {
    return (
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50 h-44 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <MapPin size={28} className="text-gray-400" />
        <p className="text-sm font-medium text-gray-600">Not available</p>
        <p className="text-xs text-gray-500 max-w-xs">
          Add a valid property address to see the location on the map.
        </p>
      </div>
    );
  }

  if (validated === "pending") {
    return (
      <div className="rounded-xl border border-gray-200 h-44 flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading map…</p>
      </div>
    );
  }

  const openMaps = () => {
    window.open(googleMapsSearchUrl(query), "_blank", "noopener,noreferrer");
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="relative rounded-xl border border-gray-200 overflow-hidden h-44 sm:h-52 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      onClick={openMaps}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openMaps();
        }
      }}
      aria-label="Open this address in Google Maps"
    >
      <iframe
        title="Property location on Google Maps"
        className="absolute inset-0 w-full h-full border-0 pointer-events-none"
        src={googleMapsEmbedUrl(query)}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.04] transition-colors pointer-events-none" />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none max-w-[90%]">
        <span className="text-xs font-medium text-white bg-black/60 px-3 py-1 rounded-full shadow-sm">
          Tap to open in Google Maps
        </span>
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
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <h3 className="text-base font-semibold text-gray-900">Neighbourhood</h3>

      <NeighbourhoodAddressMap property={property} />

      {/* Transit */}
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

      {/* Nearby */}
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

function AboutOwnerTab({ property }: { property: Property }) {
  const co = property.coOwners ?? [];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-5">About Owner</h3>
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-semibold shrink-0">
          {(property.ownerName || "O").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-base">{property.ownerName || "Owner"}</p>
          <p className="text-sm text-gray-500 mt-0.5">Property Owner</p>
          {property.ownerContact && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <span className="text-gray-400">Contact:</span>
              <span className="font-medium">{property.ownerContact}</span>
            </div>
          )}
          {co.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Additional owners</p>
              <ul className="space-y-3">
                {co.map((o, i) => (
                  <li key={i} className="flex flex-col sm:flex-row sm:items-center sm:gap-3 text-sm">
                    <span className="font-medium text-gray-900">{o.name || "—"}</span>
                    {o.contact && <span className="text-gray-600">{o.contact}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <CheckCircle2 size={13} />
            <span>Verified Owner</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PropertyDetails() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [property, setProperty] = useState<Property | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedImage, setSelectedImage] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

  const openEditFlow = () => {
    if (!id) return;
    setLocation(`/broker/properties/add?edit=${id}`);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("edit") === "true" && id) {
      setLocation(`/broker/properties/add?edit=${id}`);
    }
  }, [id, setLocation]);

  useEffect(() => {
    const list = getProperties();
    const found = list.find((p) => p.id === id);
    if (found) setProperty(found);
  }, [id]);

  useEffect(() => {
    const refresh = () => {
      if (!id) return;
      const found = getProperties().find((p) => p.id === id);
      if (found) setProperty(found);
    };
    window.addEventListener(PROPERTIES_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROPERTIES_UPDATED_EVENT, refresh);
  }, [id]);

  if (!property) {
    return (
      <BrokerLayout>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Building2 size={48} className="text-gray-300 mb-3" />
          <p className="text-gray-500">Property not found</p>
          <button
            onClick={() => setLocation("/broker/properties")}
            className="mt-4 text-sm text-primary hover:underline"
          >
            ← Back to Properties
          </button>
        </div>
      </BrokerLayout>
    );
  }

  const title = getPropertyDetailTitle(property);

  const tabs: { value: Tab; label: string }[] = [
    { value: "overview", label: "Overview" },
    { value: "amenities", label: "Amenities" },
    { value: "neighbourhood", label: "Neighbourhood" },
    { value: "owner", label: "About Owner" },
  ];

  const summaryCard = (
    <PropertyDetailSummaryCard
      property={property}
      title={title}
      onShare={() => setShareOpen(true)}
      onEdit={openEditFlow}
      editLabel="Edit Property"
    />
  );

  return (
    <BrokerLayout>
      <PropertyDetailPageLayout
        backLabel="Back to Properties"
        onBack={() => setLocation("/broker/properties")}
        mobileEditLabel="Edit Property"
        onMobileEdit={openEditFlow}
        summaryCard={summaryCard}
      >
        <PropertyDetailImageGallery
          images={property.images ?? []}
          selectedImage={selectedImage}
          onSelect={setSelectedImage}
        />

        <div className="md:hidden mt-4">{summaryCard}</div>

        <FlowSegmentTabs
          value={activeTab}
          onChange={(value) => setActiveTab(value as Tab)}
          options={tabs}
          className="mt-6"
        />

        <div className="mt-4">
          {activeTab === "overview" && <OverviewTab property={property} />}
          {activeTab === "amenities" && <AmenitiesTab property={property} />}
          {activeTab === "neighbourhood" && <NeighbourhoodTab property={property} />}
          {activeTab === "owner" && <AboutOwnerTab property={property} />}
        </div>
      </PropertyDetailPageLayout>

      <SharePropertyModal property={property} open={shareOpen} onClose={() => setShareOpen(false)} />
    </BrokerLayout>
  );
}
