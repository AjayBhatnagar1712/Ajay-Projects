import React, { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Home,
  Wallet,
  ImageIcon,
  X,
  Check,
  Plus,
  ChevronDown,
  ArrowLeft,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import OwnerLayout from "@/components/OwnerLayout";
import { FlowDateInput } from "@/components/flow/FlowDateInput";
import { FlowNativeSelect } from "@/components/flow/FlowNativeSelect";
import { FLOW_STICKY_CONTENT_CLASS, FlowStickyActionBar } from "@/components/FlowStickyActionBar";
import { FlowClearButton } from "@/components/owner/FlowClearButton";
import { todayLocalDateInputMin } from "@/lib/dateInput";
import { addProperty, deriveBedroomsFromUnitSize } from "@/lib/properties";
import { appendPropertyImagesFromFiles } from "@/lib/propertyMedia";
import { CITY_LOCALITIES } from "@/lib/tenants";
import { getSessionItem, removeSessionItem, setSessionItem } from "@/lib/storageKeys";

// ─── Constants ───────────────────────────────────────────────────────────────
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

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ subStep }: { subStep: number }) {
  const steps = [
    { label: "Property Details", Icon: Home },
    { label: "Rental Details", Icon: Wallet },
    { label: "Upload Image", Icon: ImageIcon },
  ];

  const majorStep = subStep <= 3 ? 0 : subStep === 4 ? 1 : 2;

  const lineFill = (i: number): number => {
    if (i === 0) {
      if (subStep >= 4) return 100;
      return (subStep / 4) * 100;
    }
    if (i === 1) {
      return subStep >= 5 ? 100 : 0;
    }
    return 0;
  };

  return (
    <div className="flex items-start justify-center gap-0 mb-8 pt-8 px-4 w-full max-w-3xl mx-auto">
      {steps.map((s, i) => {
        const done = majorStep > i;
        const active = majorStep === i;
        const Icon = s.Icon;
        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center w-28 md:w-32 shrink-0">
              <Icon
                size={22}
                className={active || done ? "text-primary mb-1" : "text-gray-400 mb-1"}
              />
              <span
                className={`text-[10px] md:text-[11px] font-medium mb-2 text-center leading-tight ${
                  active || done ? "text-gray-700" : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold transition-colors z-10 ${
                  done || active
                    ? "bg-primary text-white ring-4 ring-[#F5F7FA]"
                    : "bg-white border-2 border-gray-300 text-gray-400 ring-4 ring-[#F5F7FA]"
                }`}
              >
                {done ? <Check size={14} /> : i + 1}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 mt-[52px] -mx-4 md:-mx-2 bg-gray-200 h-[2px] relative rounded-full">
                <div
                  className="absolute inset-y-0 left-0 bg-primary transition-all duration-500 ease-in-out"
                  style={{ width: `${lineFill(i)}%` }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Reusable UI Pieces ────────────────────────────────────────────────────────
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-gray-700 ml-0.5">*</span>}
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
      variant="owner"
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
    />
  );
}

function ChipButton({
  label, selected, onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-6 py-2.5 rounded-lg border text-sm transition-colors ${
        selected
          ? "bg-[#E8F5EE] border-gray-200 border-b-[3px] border-b-[#22C55E] text-gray-800"
          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
      }`}
    >
      {label}
    </button>
  );
}

function AmenityCheck({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none py-1 group" onClick={(e) => { e.preventDefault(); onChange(!checked); }}>
      <div className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors shadow-sm ${
        checked ? "bg-primary border-primary" : "bg-white border-gray-400 group-hover:border-primary"
      }`}>
        {checked && <Check size={12} strokeWidth={3} className="text-white" />}
      </div>
      <span className="text-[13px] text-gray-600">{label}</span>
    </label>
  );
}

const AGREEMENT_PROPERTY_DRAFT_KEY = "owner_add_property_agreement";

function SkipBanner({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 mb-5">
      <p className="text-xs text-blue-700">
        These details help generate a more accurate agreement — but you can fill them in later.
      </p>
      <button
        type="button"
        onClick={onSkip}
        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 shrink-0 ml-3"
      >
        <SkipForward size={13} /> Skip step
      </button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function OwnerAddProperty2() {
  const availableFromMin = todayLocalDateInputMin();
  const [, setLocation] = useLocation();
  const [subStep, setSubStep] = useState(0);

  // Sub-step 0 – Property Details
  const [nickname, setNickname] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [pincode, setPincode] = useState("");
  const [country, setCountry] = useState("India");
  const [ownerName, setOwnerName] = useState("");
  const [ownerContact, setOwnerContact] = useState("");

  // Sub-step 1 – Type/Size/Furnishing
  const [propertyType, setPropertyType] = useState("");
  const [propertyTypeOther, setPropertyTypeOther] = useState("");
  const [unitSize, setUnitSize] = useState("");
  const [unitSizeOther, setUnitSizeOther] = useState("");
  const [furnishing, setFurnishing] = useState("");

  // Sub-step 2 – Dimensions
  const [builtUpArea, setBuiltUpArea] = useState("");
  const [builtUpUnits, setBuiltUpUnits] = useState("sq ft");
  const [totalFloors, setTotalFloors] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [balconies, setBalconies] = useState("");
  const [floorLevel, setFloorLevel] = useState("");
  const [mainDoorDirection, setMainDoorDirection] = useState("");

  // Sub-step 3 – Amenities
  const [amenities, setAmenities] = useState<string[]>([]);
  const [amenityOtherChecked, setAmenityOtherChecked] = useState(false);
  const [amenityOtherText, setAmenityOtherText] = useState("");

  // Sub-step 4 – Rental Details
  const [tenantsPreferred, setTenantsPreferred] = useState<string[]>([]);
  const [monthlyRent, setMonthlyRent] = useState("");
  const [rentNegotiable, setRentNegotiable] = useState(false);
  const [maintenanceIncluded, setMaintenanceIncluded] = useState(false);
  const [monthlyMaintenance, setMonthlyMaintenance] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");

  // Sub-step 5 – Images & Success
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [pendingImageUploads, setPendingImageUploads] = useState(0);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedName = getSessionItem("name");
    const storedPhone = getSessionItem("phone") || getSessionItem("contact");
    if (storedName) setOwnerName(storedName);
    if (storedPhone) setOwnerContact(storedPhone);

    const savedData = getSessionItem(AGREEMENT_PROPERTY_DRAFT_KEY);
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setNickname(data.nickname || "");
        setAddress(data.address || "");
        setArea(data.area || "");
        setCity(data.city || "Hyderabad");
        setPincode(data.pincode || "");
        setCountry(data.country || "India");
        setPropertyType(data.propertyType || "");
        setPropertyTypeOther(data.propertyTypeOther || "");
        setUnitSize(data.unitSize || "");
        setUnitSizeOther(data.unitSizeOther || "");
        setFurnishing(data.furnishing || "");
        setBuiltUpArea(data.builtUpArea || "");
        setBuiltUpUnits(data.builtUpUnits || "sq ft");
        setTotalFloors(data.totalFloors || "");
        setBathrooms(data.bathrooms || "");
        setBalconies(data.balconies || "");
        setFloorLevel(data.floorLevel || "");
        setMainDoorDirection(data.mainDoorDirection || "");
        setAmenities(data.amenities || []);
        setAmenityOtherChecked(data.amenityOtherChecked || false);
        setAmenityOtherText(data.amenityOtherText || "");
        setTenantsPreferred(data.tenantsPreferred || []);
        setMonthlyRent(data.monthlyRent || "");
        setRentNegotiable(data.rentNegotiable || false);
        setMaintenanceIncluded(data.maintenanceIncluded || false);
        setMonthlyMaintenance(data.monthlyMaintenance || "");
        setSecurityDeposit(data.securityDeposit || "");
        setAvailableFrom(data.availableFrom || "");
        setSubStep(data.subStep || 0);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    const data = {
      nickname, address, area, city, pincode, country,
      ownerName, ownerContact,
      propertyType, propertyTypeOther, unitSize, unitSizeOther, furnishing,
      builtUpArea, builtUpUnits, totalFloors, bathrooms, balconies, floorLevel, mainDoorDirection,
      amenities, amenityOtherChecked, amenityOtherText,
      tenantsPreferred, monthlyRent, rentNegotiable, maintenanceIncluded, monthlyMaintenance, securityDeposit, availableFrom,
      subStep,
    };
    setSessionItem(AGREEMENT_PROPERTY_DRAFT_KEY, JSON.stringify(data));
  }, [
    nickname, address, area, city, pincode, country, ownerName, ownerContact,
    nickname, address, area, city, pincode, country,
    propertyType, propertyTypeOther, unitSize, unitSizeOther, furnishing,
    builtUpArea, builtUpUnits, totalFloors, bathrooms, balconies, floorLevel, mainDoorDirection,
    amenities, amenityOtherChecked, amenityOtherText,
    tenantsPreferred, monthlyRent, rentNegotiable, maintenanceIncluded, monthlyMaintenance, securityDeposit, availableFrom,
    subStep
  ]);

  const toggleAmenity = (a: string) =>
    setAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );

  const toggleTenant = (t: string) =>
    setTenantsPreferred((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

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
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
    setImageUploadError(null);
  };

  const parseAddressDetails = (value: string) => {
    const pincodeMatch = value.match(/\b\d{6}\b/);
    if (pincodeMatch) {
      setPincode((current) => current || pincodeMatch[0]);
    }

    const foundCity = CITIES.find((c) => value.toLowerCase().includes(c.toLowerCase()));
    if (foundCity) setCity(foundCity);

    setArea((current) => {
      if (current.trim()) return current;
      const segments = value.split(",").map((part) => part.trim()).filter(Boolean);
      return segments.length > 0 ? segments[0] : current;
    });
  };

  const handleAddressChange = (value: string) => {
    setAddress(value);
    if (value.length > 10) parseAddressDetails(value);
  };

  const handleAddressPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = event.clipboardData.getData("text");
    if (pastedText) {
      parseAddressDetails(pastedText);
    }
  };

  const handlePincodeChange = (value: string) => {
    setPincode(value.replace(/\D/g, "").slice(0, 6));
  };

  const pincodeTouched = pincode.length > 0;
  const pincodeError = pincodeTouched && !/^\d{6}$/.test(pincode);

  const isValidPhone = (v: string): boolean => {
    const digits = v.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 12;
  };

  const contactTouched = ownerContact.length > 0;
  const contactError = contactTouched && !isValidPhone(ownerContact);

  const canContinue = (): boolean => {
    if (subStep === 0) {
      return !!(
        address &&
        area &&
        city &&
        pincode &&
        !pincodeError &&
        country &&
        isValidPhone(ownerContact)
      );
    }
    if (subStep === 1) {
      const typeOk = propertyType !== "" && (propertyType !== "Other" || propertyTypeOther.trim() !== "");
      const sizeOk = unitSize !== "" && (unitSize !== "Other" || unitSizeOther.trim() !== "");
      return typeOk && sizeOk && furnishing !== "";
    }
    if (subStep === 2) {
      return !!(builtUpArea && builtUpUnits && totalFloors && bathrooms && balconies && floorLevel && mainDoorDirection);
    }
    if (subStep === 3) return true; // Amenities optional
    if (subStep === 4) {
      return tenantsPreferred.length > 0 && !!monthlyRent && !!securityDeposit && !!availableFrom;
    }
    return true;
  };

  const handleSkip = () => {
    if (subStep < 5) setSubStep((s) => s + 1);
    else handleSubmit();
  };

  const handleSubmit = () => {
    const finalAmenities = [...amenities];
    if (amenityOtherChecked && amenityOtherText.trim() !== "") {
      finalAmenities.push(amenityOtherText.trim());
    }

    const payload = {
      nickname, address, area, city, pincode, country,
      ownerName, ownerContact,
      propertyType, propertyTypeOther, unitSize, unitSizeOther, furnishing,
      builtUpArea, builtUpUnits, totalFloors,
      bedrooms: deriveBedroomsFromUnitSize(unitSize, unitSizeOther),
      bathrooms, balconies, floorLevel, mainDoorDirection,
      amenities: finalAmenities, tenantsPreferred, monthlyRent, rentNegotiable, maintenanceIncluded, monthlyMaintenance, securityDeposit, availableFrom,
      images: imageUrls, imageCount: imageUrls.length,
    };

    const newProp = addProperty({
      ...payload,
      status: "Active",
      uploadedBy: "owner",
    });

    try {
      setSessionItem("agreement_pending_property", newProp.id);
      removeSessionItem(AGREEMENT_PROPERTY_DRAFT_KEY);
    } catch {
      /* ignore */
    }

    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setLocation("/owner/agreements/generate");
    }, 1500);
  };

  const handleContinue = () => {
    if (subStep < 5) {
      setSubStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleSubmit();
    }
  };

  // ─── Render Sub-Steps ────────────────────────────────────────────────────────

  const renderStep0 = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="max-w-md">
        <div>
          <FieldLabel required>Phone Number</FieldLabel>
          <div className="flex bg-[#F5F7FA] border border-gray-200 rounded-sm overflow-hidden h-10">
            <div className="flex items-center gap-1.5 px-3 bg-white border-r border-gray-200">
              <span className="text-sm">🇮🇳</span>
              <ChevronDown size={14} className="text-gray-400" />
            </div>
            <Input
              value={ownerContact ? `+91 ${ownerContact.replace(/\D/g, "").slice(0, 10)}` : ""}
              disabled
              className="border-none bg-transparent h-full"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 mb-6 text-center">
        <h2 className="text-2xl font-medium text-gray-800">Property details</h2>
      </div>

      <div className="space-y-5">
        <div>
          <FieldLabel>Property Nickname</FieldLabel>
          <Input placeholder="Type here" value={nickname} onChange={(e) => setNickname(e.target.value)} className="h-10 rounded-sm border-gray-200 focus:border-primary/50" />
        </div>
        <div>
          <FieldLabel required>Address</FieldLabel>
          <textarea
            value={address}
            onChange={(e) => handleAddressChange(e.target.value)}
            onPaste={handleAddressPaste}
            placeholder="e.g. 201, Orchid Residency, Sector 76, Noida, 201301"
            className="w-full min-h-[5rem] rounded-sm border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-[#6C849D]/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <FieldLabel required>Area/Landmark</FieldLabel>
            <Input placeholder="Type here" value={area} onChange={(e) => setArea(e.target.value)} className="h-10 rounded-sm border-gray-200 focus:border-primary/50" />
          </div>
          <div>
            <FieldLabel required>City</FieldLabel>
            <SelectField value={city} onChange={setCity} options={CITIES} placeholder="Select" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <FieldLabel required>Pincode</FieldLabel>
            <Input
              placeholder="6-digit pincode"
              value={pincode}
              onChange={(e) => handlePincodeChange(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              className="h-10 rounded-sm border-gray-200 focus:border-primary/50"
            />
            {pincodeError && (
              <p className="text-xs text-red-500 mt-1">Enter a valid 6-digit pincode.</p>
            )}
          </div>
          <div>
            <FieldLabel required>Country</FieldLabel>
            <SelectField value={country} onChange={setCountry} options={COUNTRIES} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-8 text-center border-b pb-6">
        <h2 className="text-[22px] font-medium text-gray-800 mb-1">Tell us more about your property</h2>
        <p className="text-[13px] text-gray-400">Providing these details will boost your chances of finding a tenant</p>
      </div>
      <SkipBanner onSkip={handleSkip} />
      <div className="space-y-7">
        <div>
          <FieldLabel>Property Type</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((t) => (
              <ChipButton key={t} label={t} selected={propertyType === t} onClick={() => { setPropertyType(t); if (t !== "Other") setPropertyTypeOther(""); }} />
            ))}
          </div>
          {propertyType === "Other" && (
            <div className="mt-3"><Input placeholder="Type here" value={propertyTypeOther} onChange={(e) => setPropertyTypeOther(e.target.value)} className="h-10 rounded-sm" /></div>
          )}
        </div>

        <div>
          <FieldLabel>Unit Size</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {UNIT_SIZES.map((s) => (
              <ChipButton key={s} label={s} selected={unitSize === s} onClick={() => { setUnitSize(s); if (s !== "Other") setUnitSizeOther(""); }} />
            ))}
          </div>
          {unitSize === "Other" && (
            <div className="mt-3"><Input placeholder="Type here" value={unitSizeOther} onChange={(e) => setUnitSizeOther(e.target.value)} className="h-10 rounded-sm" /></div>
          )}
        </div>

        <div>
          <FieldLabel>Furnishing Status</FieldLabel>
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
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-8 text-center border-b pb-6">
        <h2 className="text-[22px] font-medium text-gray-800 mb-1">Tell us more about your property</h2>
        <p className="text-[13px] text-gray-400">Providing these details will boost your chances of finding a tenant</p>
      </div>
      <SkipBanner onSkip={handleSkip} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
        <div>
          <FieldLabel>Built Up Area</FieldLabel>
          <Input placeholder="Type here" value={builtUpArea} onChange={(e) => setBuiltUpArea(e.target.value)} type="number" className="h-10 rounded-sm border-gray-200 focus:border-primary/50" />
        </div>
        <div>
          <FieldLabel required>Units</FieldLabel>
          <SelectField value={builtUpUnits} onChange={setBuiltUpUnits} options={UNIT_OPTIONS} placeholder="Select" />
        </div>
        <div>
          <FieldLabel required>Total Floors</FieldLabel>
          <Input placeholder="Type here" value={totalFloors} onChange={(e) => setTotalFloors(e.target.value)} type="number" className="h-10 rounded-sm border-gray-200 focus:border-primary/50" />
        </div>
        <div>
          <FieldLabel required>Bathrooms</FieldLabel>
          <SelectField value={bathrooms} onChange={setBathrooms} options={BATHROOM_OPTIONS} placeholder="Select" />
        </div>
        <div>
          <FieldLabel required>Balconies</FieldLabel>
          <SelectField value={balconies} onChange={setBalconies} options={BALCONY_OPTIONS} placeholder="Select" />
        </div>
        <div>
          <FieldLabel required>Floor Level</FieldLabel>
          <Input placeholder="Type here" value={floorLevel} onChange={(e) => setFloorLevel(e.target.value)} type="number" className="h-10 rounded-sm border-gray-200 focus:border-primary/50" />
        </div>
        <div>
          <FieldLabel required>Direction of main door</FieldLabel>
          <SelectField value={mainDoorDirection} onChange={setMainDoorDirection} options={DIRECTION_OPTIONS} placeholder="Select" />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-8 text-center border-b pb-6">
        <h2 className="text-[22px] font-medium text-gray-800 mb-1">Tell us more about your property</h2>
        <p className="text-[13px] text-gray-400">Providing these details will boost your chances of finding a tenant</p>
      </div>
      <SkipBanner onSkip={handleSkip} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 max-w-lg mx-auto mb-10">
        <div className="space-y-4">
          {AMENITIES_LEFT.map((a) => (
            <AmenityCheck key={a} label={a} checked={amenities.includes(a)} onChange={(v) => toggleAmenity(a)} />
          ))}
        </div>
        <div className="space-y-4">
          {AMENITIES_RIGHT.map((a) => (
            <AmenityCheck key={a} label={a} checked={amenities.includes(a)} onChange={(v) => toggleAmenity(a)} />
          ))}
          <AmenityCheck label="Other (specify)" checked={amenityOtherChecked} onChange={setAmenityOtherChecked} />
        </div>
      </div>
      
      {amenityOtherChecked && (
        <div className="max-w-lg mx-auto animate-in fade-in slide-in-from-top-2 duration-200">
          <FieldLabel>Please specify your other amenities</FieldLabel>
          <Input 
            placeholder="E.g. Security Cameras, Internet, Solar Panels" 
            value={amenityOtherText} 
            onChange={(e) => setAmenityOtherText(e.target.value)} 
            className="h-11 rounded-xl border-gray-200 focus:border-primary/50 shadow-sm" 
          />
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-8 text-center border-b pb-6">
        <h2 className="text-[22px] font-medium text-gray-800 mb-1">Rental details for your property</h2>
      </div>
      <div className="space-y-6">
        <div>
          <FieldLabel required>Tenants Preferred</FieldLabel>
          <div className="flex items-center gap-6 flex-wrap mt-2">
            {["Family", "Bachelors - Male", "Bachelors - Female"].map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer group" onClick={(e) => { e.preventDefault(); toggleTenant(t); }}>
                <div className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors shadow-sm ${
                  tenantsPreferred.includes(t) ? "bg-primary border-primary" : "bg-white border-gray-400 group-hover:border-primary"
                }`}>
                  {tenantsPreferred.includes(t) && <Check size={12} strokeWidth={3} className="text-white" />}
                </div>
                <span className="text-[13px] text-gray-600">{t}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel required>Expected Monthly Rent</FieldLabel>
          <div className="flex items-center border border-gray-200 rounded-sm overflow-hidden w-full sm:w-[calc(50%-12px)]">
            <span className="px-3 text-sm text-gray-500 border-r border-gray-200 bg-gray-50 h-10 flex items-center">₹</span>
            <input type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} className="flex-1 h-10 px-3 text-sm focus:outline-none bg-white w-full" placeholder="Type here" />
            <span className="px-3 text-sm text-gray-500 border-l border-gray-200 bg-gray-50 h-10 flex items-center whitespace-nowrap">/month</span>
          </div>
        </div>

        <div className="flex items-center gap-6 pb-2">
          <label className="flex items-center gap-2 cursor-pointer group" onClick={(e) => { e.preventDefault(); setRentNegotiable(!rentNegotiable); }}>
            <div className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors shadow-sm ${rentNegotiable ? "bg-primary border-primary" : "bg-white border-gray-400 group-hover:border-primary"}`}>
              {rentNegotiable && <Check size={12} strokeWidth={3} className="text-white" />}
            </div>
            <span className="text-[13px] text-gray-600">Rent Negotiable</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group" onClick={(e) => { e.preventDefault(); setMaintenanceIncluded(!maintenanceIncluded); if (!maintenanceIncluded) setMonthlyMaintenance(""); }}>
            <div className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors shadow-sm ${maintenanceIncluded ? "bg-primary border-primary" : "bg-white border-gray-400 group-hover:border-primary"}`}>
              {maintenanceIncluded && <Check size={12} strokeWidth={3} className="text-white" />}
            </div>
            <span className="text-[13px] text-gray-600">Maintenance included</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <FieldLabel>Monthly Maintenance Amount</FieldLabel>
            <div className={`flex items-center border rounded-sm overflow-hidden transition-opacity ${maintenanceIncluded ? "opacity-40 pointer-events-none border-gray-200 bg-gray-50" : "border-gray-200"}`}>
              <span className="px-3 text-sm text-gray-500 border-r border-gray-200 bg-gray-50 h-10 flex items-center">₹</span>
              <input type="number" value={monthlyMaintenance} onChange={(e) => setMonthlyMaintenance(e.target.value)} disabled={maintenanceIncluded} placeholder="Type here" className="flex-1 h-10 px-3 text-sm focus:outline-none bg-transparent disabled:bg-transparent w-full" />
            </div>
          </div>
          <div>
            <FieldLabel required>Expected Security Deposit</FieldLabel>
            <div className="flex items-center border border-gray-200 rounded-sm overflow-hidden">
              <span className="px-3 text-sm text-gray-500 border-r border-gray-200 bg-gray-50 h-10 flex items-center">₹</span>
              <input type="number" value={securityDeposit} onChange={(e) => setSecurityDeposit(e.target.value)} placeholder="Type here" className="flex-1 h-10 px-3 text-sm focus:outline-none bg-white w-full" />
            </div>
          </div>
        </div>

        <div>
          <FieldLabel required>Available From</FieldLabel>
          <FlowDateInput
            variant="owner"
            className="sm:w-[200px]"
            min={availableFromMin}
            value={availableFrom}
            onChange={setAvailableFrom}
          />
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-8 text-center border-b pb-6">
        <h2 className="text-[22px] font-medium text-gray-800 mb-1">Upload property images</h2>
      </div>
      <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 mb-5">
        <p className="text-xs text-amber-700">
          Images are optional — you can add them later from the property details page.
        </p>
        <button
          type="button"
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
          </p>
          <ul className="space-y-1">
            {["Minimum 1 photos, maximum 5", "Show all rooms clearly with good lighting (daylight preferred)", "Clear and in focus"].map((g) => (
              <li key={g} className="flex items-start gap-2 text-xs text-gray-600">
                <Check size={12} className="text-green-600 mt-0.5 shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </div>

        {imageUrls.length === 0 ? (
          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-primary/40 rounded-xl bg-blue-50/40 flex flex-col items-center justify-center py-10 gap-3 hover:bg-blue-50 transition-colors" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
            <ImageIcon size={32} className="text-primary" />
            <p className="text-sm text-gray-700">Drag a <span className="text-primary font-medium">Image</span> to Upload</p>
            <Button size="sm" variant="outline" className="border-primary text-primary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>Select photos</Button>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {imageUrls.length < 5 && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square border-2 border-dashed border-primary/40 rounded-lg bg-blue-50/40 flex items-center justify-center hover:bg-blue-50 transition-colors"><Plus size={24} className="text-primary" /></button>
            )}
            {imageUrls.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                <img src={url} alt={`Property ${i + 1}`} className="w-full h-full object-cover" />
                <button onClick={() => removeImage(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/80"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
        {imageUploadError ? (
          <p className="text-sm text-red-600 mt-2">{imageUploadError}</p>
        ) : null}
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }} />
      </div>
    </div>
  );

  const handleBack = () => {
    if (subStep > 0) {
      setSubStep((s) => s - 1);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    setLocation("/owner/agreements/generate");
  };

  const handleClearFlow = () => {
    removeSessionItem(AGREEMENT_PROPERTY_DRAFT_KEY);
    setSubStep(0);
    setNickname("");
    setAddress("");
    setArea("");
    setCity("Hyderabad");
    setPincode("");
    setCountry("India");
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
    const storedName = getSessionItem("name");
    const storedPhone = getSessionItem("phone") || getSessionItem("contact");
    if (storedName) setOwnerName(storedName);
    if (storedPhone) setOwnerContact(storedPhone);
  };

  return (
    <OwnerLayout>
      <div className={`p-4 sm:p-8 max-w-5xl mx-auto w-full min-w-0 ${FLOW_STICKY_CONTENT_CLASS} sm:pb-8`}>
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-gray-600 font-medium hover:text-primary transition-colors"
          >
            <ArrowLeft size={15} />
            {subStep === 0
  ? "Back to Properties"
  : "Back"}
          </button>
          <FlowClearButton onClick={handleClearFlow} />
        </div>

        <ProgressBar subStep={subStep} />

        <div className="bg-white rounded-lg shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] p-6 sm:p-8 md:p-14 mx-auto max-w-[850px] mb-12 mt-6">
          {subStep === 0 && renderStep0()}
          {subStep === 1 && renderStep1()}
          {subStep === 2 && renderStep2()}
          {subStep === 3 && renderStep3()}
          {subStep === 4 && renderStep4()}
          {subStep === 5 && renderStep5()}

          {/* Desktop Continue */}
          <div className="mt-10 hidden sm:flex justify-center mb-10">
            <Button size="lg" onClick={handleContinue} disabled={!canContinue()} className="w-32 bg-primary hover:bg-primary/90 rounded-sm">
              {subStep === 5 ? "Submit" : "Continue \u2192"}
            </Button>
          </div>

        </div>

        {/* Sticky Mobile Continue */}
        <FlowStickyActionBar>
          <Button size="lg" onClick={handleContinue} disabled={!canContinue()} className="w-full bg-primary hover:bg-primary/90 rounded-[4px]">
            {subStep === 5 ? "Submit" : "Continue \u2192"}
          </Button>
        </FlowStickyActionBar>
      </div>

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
    </OwnerLayout>
  );
}
