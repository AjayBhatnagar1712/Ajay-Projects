import React, { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Home,
  Wallet,
  ImageIcon,
  X,
  Check,
  Plus,
  ChevronDown,
  Upload,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BrokerLayout from "@/components/BrokerLayout";
import { FlowDateInput } from "@/components/flow/FlowDateInput";
import { FlowNativeSelect } from "@/components/flow/FlowNativeSelect";
import { FLOW_STICKY_CONTENT_CLASS, FlowStickyActionBar } from "@/components/FlowStickyActionBar";
import { FlowChipButton } from "@/components/FlowChipButton";
import { AddPropertyProgressBar } from "@/components/AddPropertyProgressBar";
import { useScrollToTopOnChange } from "@/hooks/useScrollToTopOnChange";
import { toast } from "@/hooks/use-toast";
import { getActiveSession } from "@/lib/auth";
import { todayLocalDateInputMin } from "@/lib/dateInput";
import { broadcastBrokerPendingFlowsUpdated } from "@/lib/brokerPendingFlows";
import { addProperty, deriveBedroomsFromUnitSize } from "@/lib/properties";
import { appendPropertyImagesFromFiles, preparePropertyImagesForStorage } from "@/lib/propertyMedia";
import { getItem, getSessionItem, removeItem, removeSessionItem, setItem, setSessionItem } from "@/lib/storageKeys";
import { CITY_LOCALITIES } from "@/lib/tenants";

// ─── Constants ────────────────────────────────────────────────────────────────

const PROPERTY_TYPES = ["Apartment", "House", "Studio", "Villa", "Other"];
const UNIT_SIZES = ["1 RK", "1 BHK", "2 BHK", "3 BHK", "4 BHK", "Other"];
const FURNISHING_OPTIONS = ["Unfurnished", "Semi Furnished", "Fully Furnished"];
const UNIT_OPTIONS = ["sq ft", "sq m", "sq yards"];
const FLOORS_OPTIONS = Array.from({ length: 30 }, (_, i) => String(i + 1));
const BATHROOM_OPTIONS = Array.from({ length: 8 }, (_, i) => String(i + 1));
const BALCONY_OPTIONS = ["0", "1", "2", "3", "4", "5+"];
const FLOOR_LEVEL_OPTIONS = [
  "Ground",
  ...Array.from({ length: 20 }, (_, i) => `${i + 1}${["st","nd","rd"][i] ?? "th"}`),
  "Penthouse",
];
const DIRECTION_OPTIONS = [
  "North", "South", "East", "West",
  "North-East", "North-West", "South-East", "South-West",
];
const COUNTRIES = ["India"];
const CITIES = Object.keys(CITY_LOCALITIES);

const AMENITIES_LEFT = [
  "Sport Club", "Gym", "Store Room", "Parking Space", "Pool",
  "Power Backup", "Alarm System", "Refrigerator", "Covered Car Parking Space",
];
const AMENITIES_RIGHT = [
  "Pooja Room", "Study Room", "Servant Room", "Garden", "Pets Allowed",
  "Air Conditioning", "Basketball Court", "Spa", "Uncovered Car Parking Space",
];

// ─── Reusable UI ─────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function SelectField({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <FlowNativeSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
    />
  );
}

function ChipButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return <FlowChipButton label={label} selected={selected} onClick={onClick} />;
}

function AmenityCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary accent-primary" />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

// ─── Skip Banner ──────────────────────────────────────────────────────────────

function SkipBanner({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 mb-5">
      <p className="text-xs text-blue-700">
        These details help generate a more accurate agreement — but you can fill them in later.
      </p>
      <button
        onClick={onSkip}
        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 shrink-0 ml-3"
      >
        <SkipForward size={13} /> Skip step
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AddProperty2() {
  const availableFromMin = todayLocalDateInputMin();
  const [, setLocation] = useLocation();

  const loadSavedData = () => {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(getItem("add_property_data") ?? "null");
    } catch {
      return null;
    }
  };
  const savedData = loadSavedData();
  const [subStep, setSubStep] = useState(savedData?.subStep ?? 0);
  useScrollToTopOnChange(subStep);

  // Sub-step 0 – Property Details
  const [nickname, setNickname] = useState(savedData?.nickname ?? "");
  const [address, setAddress] = useState(savedData?.address ?? "");
  const [area, setArea] = useState(savedData?.area ?? "");
  const [city, setCity] = useState(savedData?.city ?? "");
  const [pincode, setPincode] = useState(savedData?.pincode ?? "");
  const [country, setCountry] = useState(savedData?.country ?? "India");
  const [ownerName, setOwnerName] = useState(savedData?.ownerName ?? "");
  const [ownerContact, setOwnerContact] = useState(savedData?.ownerContact ?? "");

  // Sub-step 1 – Type/Size/Furnishing
  const [propertyType, setPropertyType] = useState(savedData?.propertyType ?? "");
  const [propertyTypeOther, setPropertyTypeOther] = useState(savedData?.propertyTypeOther ?? "");
  const [unitSize, setUnitSize] = useState(savedData?.unitSize ?? "");
  const [unitSizeOther, setUnitSizeOther] = useState(savedData?.unitSizeOther ?? "");
  const [furnishing, setFurnishing] = useState(savedData?.furnishing ?? "");

  // Sub-step 2 – Dimensions
  const [builtUpArea, setBuiltUpArea] = useState(savedData?.builtUpArea ?? "");
  const [builtUpUnits, setBuiltUpUnits] = useState(savedData?.builtUpUnits ?? "sq ft");
  const [totalFloors, setTotalFloors] = useState(savedData?.totalFloors ?? "");
  const [bathrooms, setBathrooms] = useState(savedData?.bathrooms ?? "");
  const [balconies, setBalconies] = useState(savedData?.balconies ?? "");
  const [floorLevel, setFloorLevel] = useState(savedData?.floorLevel ?? "");
  const [mainDoorDirection, setMainDoorDirection] = useState(savedData?.mainDoorDirection ?? "");

  // Sub-step 3 – Amenities
  const [amenities, setAmenities] = useState<string[]>(savedData?.amenities ?? []);
  const [amenityOtherChecked, setAmenityOtherChecked] = useState(savedData?.amenityOtherChecked ?? false);
  const [amenityOtherText, setAmenityOtherText] = useState(savedData?.amenityOtherText ?? "");

  // Sub-step 4 – Rental Details
  const [tenantsPreferred, setTenantsPreferred] = useState<string[]>(savedData?.tenantsPreferred ?? []);
  const [monthlyRent, setMonthlyRent] = useState(savedData?.monthlyRent ?? "");
  const [rentNegotiable, setRentNegotiable] = useState(savedData?.rentNegotiable ?? false);
  const [maintenanceIncluded, setMaintenanceIncluded] = useState(savedData?.maintenanceIncluded ?? false);
  const [monthlyMaintenance, setMonthlyMaintenance] = useState(savedData?.monthlyMaintenance ?? "");
  const [securityDeposit, setSecurityDeposit] = useState(savedData?.securityDeposit ?? "");
  const [availableFrom, setAvailableFrom] = useState(savedData?.availableFrom ?? "");

  // Sub-step 5 – Images (kept in memory only — not written to draft storage)
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [pendingImageUploads, setPendingImageUploads] = useState(0);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearDraft = () => {
    try {
      removeItem("add_property_data");
    } catch {}
    setSubStep(0);
    setNickname("");
    setAddress("");
    setArea("");
    setCity("");
    setPincode("");
    setCountry("India");
    setOwnerName("");
    setOwnerContact("");
    setPropertyType("");
    setPropertyTypeOther("");
    setUnitSize("");
    setUnitSizeOther("");
    setFurnishing("");
    setBuiltUpArea("");
    setBuiltUpUnits("sq ft");
    setTotalFloors("");
    setBathrooms("");
    setBalconies("");
    setFloorLevel("");
    setMainDoorDirection("");
    setAmenities([]);
    setAmenityOtherChecked(false);
    setAmenityOtherText("");
    setTenantsPreferred([]);
    setMonthlyRent("");
    setRentNegotiable(false);
    setMaintenanceIncluded(false);
    setMonthlyMaintenance("");
    setSecurityDeposit("");
    setAvailableFrom("");
    setImageUrls([]);
    setImageUploadError(null);
    setShowSuccess(false);
    broadcastBrokerPendingFlowsUpdated();
  };


  // ── Helpers ──────────────────────────────────────────────────────────────────

  const toggleAmenity = (a: string) =>
    setAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);

  const toggleTenant = (t: string) =>
    setTenantsPreferred((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || pendingImageUploads > 0) return;

    setImageUploadError(null);
    setPendingImageUploads(files.length);

    try {
      const result = await appendPropertyImagesFromFiles(files, imageUrls);
      setImageUrls(result.images);

      if (result.failedCount > 0) {
        setImageUploadError("Some photos could not be uploaded. Try again with image files only.");
      } else if (result.skippedDuplicateCount > 0 && result.addedCount === 0) {
        setImageUploadError("That photo is already in your gallery.");
      }
    } finally {
      setPendingImageUploads(0);
    }
  }, [imageUrls, pendingImageUploads]);

  const removeImage = (idx: number) => {
    setImageUploadError(null);
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  };
  const parseAddressDetails = (value: string) => {
    const pincodeMatch = value.match(/\b\d{6}\b/);
    if (pincodeMatch) {
      setPincode((current: string) => current || pincodeMatch[0]);
    }

    if (!city) {
      const foundCity = CITIES.find((c) => value.toLowerCase().includes(c.toLowerCase()));
      if (foundCity) setCity(foundCity);
    }

    if (!area) {
      const segments = value.split(",").map((part) => part.trim()).filter(Boolean);
      if (segments.length > 0) {
        setArea(segments[0]);
      }
    }
  };

  const handleAddressChange = (value: string) => {
    setAddress(value);
    if (value.length > 10) parseAddressDetails(value);
  };

  const handleAddressPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = event.clipboardData.getData("Text");
    if (pastedText) {
      parseAddressDetails(pastedText);
    }
  };

  const pincodeTouched = pincode.length > 0;
  const pincodeError = pincodeTouched && !/^\d{6}$/.test(pincode);
  // ── Validation ────────────────────────────────────────────────────────────────

  const isValidContact = (v: string): boolean => {
    if (!v.trim()) return false;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
    const phoneOk = /^\+?[\d\s\-().]{7,15}$/.test(v.trim());
    return emailOk || phoneOk;
  };

  const contactTouched = ownerContact.length > 0;
  const contactError = contactTouched && !isValidContact(ownerContact);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const data = {
      subStep,
      nickname,
      address,
      area,
      city,
      pincode,
      country,
      ownerName,
      ownerContact,
      propertyType,
      propertyTypeOther,
      unitSize,
      unitSizeOther,
      furnishing,
      builtUpArea,
      builtUpUnits,
      totalFloors,
      bathrooms,
      balconies,
      floorLevel,
      mainDoorDirection,
      amenities,
      amenityOtherChecked,
      amenityOtherText,
      tenantsPreferred,
      monthlyRent,
      rentNegotiable,
      maintenanceIncluded,
      monthlyMaintenance,
      securityDeposit,
      availableFrom,
    };

    try {
      setItem("add_property_data", JSON.stringify(data));
      broadcastBrokerPendingFlowsUpdated();
    } catch {
      // ignore storage failure
    }
  }, [
    subStep,
    nickname,
    address,
    area,
    city,
    pincode,
    country,
    ownerName,
    ownerContact,
    propertyType,
    propertyTypeOther,
    unitSize,
    unitSizeOther,
    furnishing,
    builtUpArea,
    builtUpUnits,
    totalFloors,
    bathrooms,
    balconies,
    floorLevel,
    mainDoorDirection,
    amenities,
    amenityOtherChecked,
    amenityOtherText,
    tenantsPreferred,
    monthlyRent,
    rentNegotiable,
    maintenanceIncluded,
    monthlyMaintenance,
    securityDeposit,
    availableFrom,
  ]);

  const canContinue = (): boolean => {
    if (subStep === 0) {
      return !!(address && area && city && pincode && !pincodeError && country && ownerName && isValidContact(ownerContact));
    }
    // Steps 1–3 always continuable (skip is available)
    if (subStep === 1) {
      const typeOk = propertyType !== "" && (propertyType !== "Other" || propertyTypeOther.trim() !== "");
      const sizeOk = unitSize !== "" && (unitSize !== "Other" || unitSizeOther.trim() !== "");
      return typeOk && sizeOk && furnishing !== "";
    }
    if (subStep === 2) {
      return !!(builtUpArea && builtUpUnits && totalFloors && bathrooms && balconies && floorLevel && mainDoorDirection);
    }
    if (subStep === 3) return true;
    if (subStep === 4) {
      return tenantsPreferred.length > 0 && !!monthlyRent && !!securityDeposit && !!availableFrom;
    }
    // Step 5 images are optional — always continuable
    return true;
  };

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!getActiveSession()) {
      toast({ title: "Please sign in to save properties", variant: "destructive" });
      sessionStorage.setItem("tk_pending_role", "broker");
      setLocation("/login");
      return;
    }
    if (isSaving || pendingImageUploads > 0) return;

    const finalAmenities = [...amenities];
    if (amenityOtherChecked && amenityOtherText.trim()) {
      finalAmenities.push(amenityOtherText.trim());
    }

    setIsSaving(true);
    try {
      const preparedImages = await preparePropertyImagesForStorage(imageUrls);
      const newProp = addProperty({
        nickname,
        address,
        area,
        city,
        pincode,
        country,
        ownerName,
        ownerContact,
        propertyType,
        propertyTypeOther,
        unitSize,
        unitSizeOther,
        furnishing,
        builtUpArea,
        builtUpUnits,
        totalFloors,
        bedrooms: deriveBedroomsFromUnitSize(unitSize, unitSizeOther),
        bathrooms,
        balconies,
        floorLevel,
        mainDoorDirection,
        amenities: finalAmenities,
        tenantsPreferred,
        monthlyRent,
        rentNegotiable,
        maintenanceIncluded,
        monthlyMaintenance,
        securityDeposit,
        availableFrom,
        images: preparedImages.images,
        imageCount: preparedImages.imageCount,
        status: "Active",
        uploadedBy: "broker",
      });
      try {
        setSessionItem("agreement_pending_property", newProp.id);
        removeItem("add_property_data");
        broadcastBrokerPendingFlowsUpdated();
      } catch {}
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setLocation("/broker/agreements/generate");
      }, 1800);
    } catch {
      toast({
        title: "Could not save property",
        description: "Storage may be full. Try fewer or smaller photos, then try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    if (subStep < 5) setSubStep((s: number) => s + 1);
    else void handleSubmit();
  };

  const handleBack = () => {
    if (subStep > 0) {
      setSubStep((s: number) => s - 1);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }

    setLocation("/broker/properties");
  };
  const handleSkip = () => {
    if (subStep < 5) setSubStep((s: number) => s + 1);
    else handleSubmit();
  };

  // ── Sub-step Renders ─────────────────────────────────────────────────────────

  const renderStep0 = () => (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 text-center mb-6 pb-4 border-b border-gray-100">
        Property details
      </h2>
      <div className="space-y-4">
        <div>
          <FieldLabel>Property Nickname</FieldLabel>
          <Input placeholder="My property 01" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
        <div>
          <FieldLabel required>Address</FieldLabel>
          <textarea
            value={address}
            onChange={(e) => handleAddressChange(e.target.value)}
            onPaste={handleAddressPaste}
            placeholder="e.g. 201, Orchid Residency, Sector 76, Noida, 201301"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none h-20"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel required>Area/Landmark</FieldLabel>
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="" />
          </div>
          <div>
            <FieldLabel required>City</FieldLabel>
            <SelectField value={city} onChange={setCity} options={CITIES} placeholder="Select" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel required>Pincode</FieldLabel>
            <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="" maxLength={6} />
            {pincodeError && <p className="text-xs text-red-500 mt-1">Enter a valid 6-digit pincode.</p>}
          </div>
          <div>
            <FieldLabel required>Country</FieldLabel>
            <SelectField value={country} onChange={setCountry} options={COUNTRIES} />
          </div>
        </div>
        <div className="pt-4 pb-1">
          <h3 className="text-base font-semibold text-gray-900 pb-3 border-b border-gray-100">Property Owner Details</h3>
        </div>
        <div>
          <FieldLabel required>Owner&apos;s Name</FieldLabel>
          <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="" />
        </div>
        <div>
          <FieldLabel required>Email/Phone Number</FieldLabel>
          <Input
            value={ownerContact}
            onChange={(e) => setOwnerContact(e.target.value)}
            placeholder="email@example.com or +91 9876543210"
            className={contactError ? "border-red-400 focus:border-red-400 focus:ring-red-200" : ""}
          />
          {contactError && <p className="text-xs text-red-500 mt-1">Enter a valid email address or phone number</p>}
        </div>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 text-center mb-4 pb-4 border-b border-gray-100">
        Tell us more about the property
      </h2>
      <SkipBanner onSkip={handleSkip} />
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Property Type</p>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((t) => (
              <ChipButton key={t} label={t} selected={propertyType === t} onClick={() => { setPropertyType(t); if (t !== "Other") setPropertyTypeOther(""); }} />
            ))}
          </div>
          {propertyType === "Other" && (
            <div className="mt-3">
              <Input placeholder="Specify property type" value={propertyTypeOther} onChange={(e) => setPropertyTypeOther(e.target.value)} />
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Unit Size</p>
          <div className="flex flex-wrap gap-2">
            {UNIT_SIZES.map((s) => (
              <ChipButton key={s} label={s} selected={unitSize === s} onClick={() => { setUnitSize(s); if (s !== "Other") setUnitSizeOther(""); }} />
            ))}
          </div>
          {unitSize === "Other" && (
            <div className="mt-3">
              <Input placeholder="Specify unit size" value={unitSizeOther} onChange={(e) => setUnitSizeOther(e.target.value)} />
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Furnishing Status</p>
          <div className="flex flex-wrap gap-2">
            {FURNISHING_OPTIONS.map((f) => (
              <ChipButton key={f} label={f} selected={furnishing === f} onClick={() => setFurnishing(f)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 text-center mb-4 pb-4 border-b border-gray-100">
        Tell us more about the property
      </h2>
      <SkipBanner onSkip={handleSkip} />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Built Up Area</FieldLabel>
            <Input value={builtUpArea} onChange={(e) => setBuiltUpArea(e.target.value)} placeholder="" type="number" />
          </div>
          <div>
            <FieldLabel>Units</FieldLabel>
            <SelectField value={builtUpUnits} onChange={setBuiltUpUnits} options={UNIT_OPTIONS} placeholder="Select" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Total Floors</FieldLabel>
            <Input value={totalFloors} onChange={(e) => setTotalFloors(e.target.value)} placeholder="e.g. 10" type="text" />
          </div>
          <div>
            <FieldLabel>Bathrooms</FieldLabel>
            <SelectField value={bathrooms} onChange={setBathrooms} options={BATHROOM_OPTIONS} placeholder="Select" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Balconies</FieldLabel>
            <SelectField value={balconies} onChange={setBalconies} options={BALCONY_OPTIONS} placeholder="Select" />
          </div>
          <div>
            <FieldLabel>Floor Level</FieldLabel>
            <Input value={floorLevel} onChange={(e) => setFloorLevel(e.target.value)} placeholder="e.g. 3rd" type="text" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Facing</FieldLabel>
            <SelectField value={mainDoorDirection} onChange={setMainDoorDirection} options={DIRECTION_OPTIONS} placeholder="Select" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 text-center mb-4 pb-4 border-b border-gray-100">
        Tell us more about the property
      </h2>
      <SkipBanner onSkip={handleSkip} />
      <div className="grid grid-cols-2 gap-y-4 gap-x-12">
        <div className="space-y-4">
          {AMENITIES_LEFT.map((a) => (
            <AmenityCheck key={a} label={a} checked={amenities.includes(a)} onChange={() => toggleAmenity(a)} />
          ))}
        </div>
        <div className="space-y-4">
          {AMENITIES_RIGHT.map((a) => (
            <AmenityCheck key={a} label={a} checked={amenities.includes(a)} onChange={() => toggleAmenity(a)} />
          ))}
        </div>
      </div>
      <div className="mt-6 border-t border-gray-100 pt-4">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={amenityOtherChecked} onChange={(e) => setAmenityOtherChecked(e.target.checked)} className="w-4 h-4 accent-primary" />
          <span className="text-sm text-gray-700">Other</span>
        </label>
        {amenityOtherChecked && (
          <div className="mt-3">
            <Input value={amenityOtherText} onChange={(e) => setAmenityOtherText(e.target.value)} placeholder="Type other amenities" />
          </div>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 text-center mb-6 pb-4 border-b border-gray-100">
        Rental details for the property
      </h2>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Tenants Preferred<span className="text-red-500 ml-0.5">*</span>
          </p>
          <div className="flex items-center gap-6 flex-wrap pb-3 border-b border-gray-100">
            {["Family", "Bachelors - Male", "Bachelors - Female"].map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={tenantsPreferred.includes(t)} onChange={() => toggleTenant(t)} className="w-4 h-4 accent-primary" />
                <span className="text-sm text-gray-700">{t}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel required>Expected Monthly Rent</FieldLabel>
          <div className="flex items-center border border-input rounded-md overflow-hidden">
            <span className="px-3 text-sm text-gray-500 border-r border-input bg-gray-50 h-9 flex items-center">₹</span>
            <input type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} className="flex-1 h-9 px-3 text-sm focus:outline-none bg-white" placeholder="" />
            <span className="px-3 text-sm text-gray-500 border-l border-input bg-gray-50 h-9 flex items-center">/month</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={rentNegotiable} onChange={(e) => setRentNegotiable(e.target.checked)} className="w-4 h-4 accent-primary" />
            <span className="text-sm text-gray-700">Rent Negotiable</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={maintenanceIncluded} onChange={(e) => { setMaintenanceIncluded(e.target.checked); if (e.target.checked) setMonthlyMaintenance(""); }} className="w-4 h-4 accent-primary" />
            <span className="text-sm text-gray-700">Maintenance included</span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Monthly Maintenance Amount</FieldLabel>
            <div className={`flex items-center border rounded-md overflow-hidden transition-opacity ${maintenanceIncluded ? "opacity-40 pointer-events-none" : "border-input"}`}>
              <span className="px-3 text-sm text-gray-500 border-r border-input bg-gray-50 h-9 flex items-center">₹</span>
              <input type="number" value={monthlyMaintenance} onChange={(e) => setMonthlyMaintenance(e.target.value)} disabled={maintenanceIncluded} className="flex-1 h-9 px-3 text-sm focus:outline-none bg-white disabled:bg-gray-50" />
            </div>
          </div>
          <div>
            <FieldLabel required>Expected Security Deposit</FieldLabel>
            <div className="flex items-center border border-input rounded-md overflow-hidden">
              <span className="px-3 text-sm text-gray-500 border-r border-input bg-gray-50 h-9 flex items-center">₹</span>
              <input type="number" value={securityDeposit} onChange={(e) => setSecurityDeposit(e.target.value)} className="flex-1 h-9 px-3 text-sm focus:outline-none bg-white" />
            </div>
          </div>
        </div>
        <div>
          <FieldLabel required>Available From</FieldLabel>
          <FlowDateInput
            min={availableFromMin}
            value={availableFrom}
            onChange={setAvailableFrom}
          />
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 text-center mb-4 pb-4 border-b border-gray-100">
        Upload property images
      </h2>

      {/* Optional badge */}
      <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 mb-5">
        <p className="text-xs text-amber-700">
          Images are optional — you can add them later from the property details page.
        </p>
        <button
          onClick={handleSkip}
          className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-800 shrink-0 ml-3"
        >
          <SkipForward size={13} /> Skip
        </button>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <p className="text-sm font-semibold text-gray-800 mb-1">Guidelines</p>
          <p className="text-xs text-gray-600 mb-3">
            Our AI system automatically checks every photo for clarity, lighting, and relevance.
            Following these guidelines ensures your listing is approved and published instantly.
          </p>
          <ul className="space-y-1">
            {[
              "Maximum 5 photos",
              "Show all rooms clearly with good lighting (daylight preferred)",
              "Clear and in focus",
            ].map((g) => (
              <li key={g} className="flex items-start gap-2 text-xs text-gray-600">
                <Check size={12} className="text-green-600 mt-0.5 shrink-0" /> {g}
              </li>
            ))}
          </ul>
        </div>

        {pendingImageUploads > 0 ? (
          <p className="text-sm text-gray-600">Uploading photos…</p>
        ) : null}
        {imageUploadError ? (
          <p className="text-sm text-destructive">{imageUploadError}</p>
        ) : null}

        {imageUrls.length === 0 ? (
          <button
            type="button"
            disabled={pendingImageUploads > 0}
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-primary/40 rounded-xl bg-blue-50/40 flex flex-col items-center justify-center py-10 gap-3 hover:bg-blue-50 transition-colors disabled:opacity-60"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void handleFiles(e.dataTransfer.files); }}
          >
            <ImageIcon size={32} className="text-primary" />
            <p className="text-sm text-gray-700">Drag an <span className="text-primary font-medium">Image</span> to Upload</p>
            <Button size="sm" variant="outline" className="border-primary text-primary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              Select photos
            </Button>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {imageUrls.length < 5 && (
              <button type="button" disabled={pendingImageUploads > 0} onClick={() => fileInputRef.current?.click()} className="aspect-square border-2 border-dashed border-primary/40 rounded-lg bg-blue-50/40 flex items-center justify-center hover:bg-blue-50 transition-colors disabled:opacity-60">
                <Plus size={24} className="text-primary" />
              </button>
            )}
            {imageUrls.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                <img src={url} alt={`Property ${i + 1}`} className="w-full h-full object-cover" />
                <button onClick={() => removeImage(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/80">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }} />
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <BrokerLayout>
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <button
          type="button"
          onClick={clearDraft}
          className="text-xs font-semibold text-primary border-0 bg-transparent shadow-none px-2 py-1.5 rounded-lg hover:bg-primary/10 transition-colors shrink-0"
        >
          Clear
        </button>
      </div>

      <AddPropertyProgressBar subStep={subStep} />

      <div className={`max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-8 ${FLOW_STICKY_CONTENT_CLASS} sm:pb-8`}>
        {subStep === 0 && renderStep0()}
        {subStep === 1 && renderStep1()}
        {subStep === 2 && renderStep2()}
        {subStep === 3 && renderStep3()}
        {subStep === 4 && renderStep4()}
        {subStep === 5 && renderStep5()}

        {/* Continue / Submit — desktop */}
        <div className="mt-8 hidden sm:flex justify-center">
          <Button
            size="lg"
            onClick={handleContinue}
            disabled={!canContinue() || isSaving || pendingImageUploads > 0}
            className="w-48 bg-primary hover:bg-primary/90"
          >
            {isSaving ? "Saving…" : subStep === 5 ? "Submit" : "Continue →"}
          </Button>
        </div>
      </div>

      {/* Continue / Submit — mobile sticky */}
      <FlowStickyActionBar>
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={!canContinue() || isSaving || pendingImageUploads > 0}
          className="w-full bg-primary hover:bg-primary/90 rounded-[4px]"
        >
          {isSaving ? "Saving…" : subStep === 5 ? "Submit" : "Continue →"}
        </Button>
      </FlowStickyActionBar>

      {showSuccess && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center gap-3 w-72 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <Check size={28} className="text-green-500" />
            </div>
            <p className="text-lg font-semibold text-gray-900">Property Added!</p>
            <p className="text-sm text-gray-500">Taking you back to the agreement…</p>
          </div>
        </div>
      )}
    </BrokerLayout>
  );
}
