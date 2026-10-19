import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, Loader2, User, X } from "lucide-react";
import { FlowChipButton } from "@/components/FlowChipButton";
import { TrustKeyperFooter } from "@/components/TrustKeyperFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authPrimaryButtonClass } from "@/components/auth/authStyles";
import {
  submitTenantOnboardRequirements,
  type TenantOnboardSubmitPayload,
} from "@/lib/publicBrokerTenantOnboard";
import {
  getTenantOnboardDraft,
  setTenantOnboardDraft,
  type TenantBrokerOnboardSession,
} from "@/lib/tenantBrokerOnboardSession";
import {
  BACHELOR_GENDERS,
  FOOD_PREFERENCES,
  MOVE_IN_TIMELINES,
  OCCUPANCY_TYPES,
  ONBOARD_PROPERTY_TYPES,
  ROOMMATE_GENDERS,
  SHARING_PREFERENCES,
  validateTenantOnboardL1,
  validateTenantOnboardL2,
  type BachelorGender,
  type MoveInTimeline,
  type OnboardFoodPreference,
  type OnboardOccupancyType,
  type OnboardPropertyType,
  type OnboardSharingPreference,
  type RoommateGender,
  type TenantOnboardL1Draft,
  type TenantOnboardL2Draft,
} from "@/lib/tenantOnboardRequirements";
import { CITY_LOCALITIES } from "@/lib/tenants";
import { getTenantAccountProfile, saveTenantAccountProfile, saveTenantRentalPreferences } from "@/lib/tenantProfile";
import { cn } from "@/lib/utils";

type Step = 1 | 2;

type DraftShape = TenantOnboardL1Draft &
  TenantOnboardL2Draft & {
    step: Step;
  };

export function TenantOnboardRequirementFlow({
  session,
  onDone,
}: {
  session: TenantBrokerOnboardSession;
  onDone: () => void;
}) {
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [moveInTimeline, setMoveInTimeline] = useState<MoveInTimeline | "">("");
  const [occupancyType, setOccupancyType] = useState<OnboardOccupancyType | "">("");
  const [occupancyOther, setOccupancyOther] = useState("");
  const [bachelorGender, setBachelorGender] = useState<BachelorGender | "">("");
  const [foodPreference, setFoodPreference] = useState<OnboardFoodPreference | "">("");
  const [city, setCity] = useState("Hyderabad");
  const [localities, setLocalities] = useState<string[]>([]);
  const [sharingPreference, setSharingPreference] = useState<OnboardSharingPreference | "">("");
  const [roommateGender, setRoommateGender] = useState<RoommateGender | "">("");
  const [propertyType, setPropertyType] = useState<OnboardPropertyType | "">("");
  const [propertyTypeOther, setPropertyTypeOther] = useState("");
  const [localityInput, setLocalityInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [brokerName, setBrokerName] = useState(session.brokerName);
  const [stepTouched, setStepTouched] = useState(false);

  const phoneDigits = session.phone.replace(/\D/g, "").slice(-10);

  const l1Draft = useMemo(
    (): TenantOnboardL1Draft => ({
      linkedinUrl,
      moveInTimeline,
      occupancyType,
      occupancyOther,
      bachelorGender,
      foodPreference,
    }),
    [linkedinUrl, moveInTimeline, occupancyType, occupancyOther, bachelorGender, foodPreference],
  );

  const l2Draft = useMemo(
    (): TenantOnboardL2Draft => ({
      city,
      localities,
      sharingPreference,
      roommateGender,
      propertyType,
      propertyTypeOther,
    }),
    [city, localities, sharingPreference, roommateGender, propertyType, propertyTypeOther],
  );

  const step1Error = useMemo(() => validateTenantOnboardL1(l1Draft), [l1Draft]);
  const step2Error = useMemo(() => validateTenantOnboardL2(l2Draft), [l2Draft]);
  const step1Valid = step1Error === null;
  const step2Valid = step2Error === null;

  useEffect(() => {
    const draft = getTenantOnboardDraft<DraftShape>(session.token);
    if (!draft) return;
    if (draft.step === 1 || draft.step === 2) setStep(draft.step);
    if (typeof draft.linkedinUrl === "string") setLinkedinUrl(draft.linkedinUrl);
    if (draft.moveInTimeline) setMoveInTimeline(draft.moveInTimeline);
    if (draft.occupancyType) setOccupancyType(draft.occupancyType);
    if (typeof draft.occupancyOther === "string") setOccupancyOther(draft.occupancyOther);
    if (draft.bachelorGender) setBachelorGender(draft.bachelorGender);
    if (draft.foodPreference) setFoodPreference(draft.foodPreference);
    if (typeof draft.city === "string") setCity(draft.city);
    if (Array.isArray(draft.localities)) setLocalities(draft.localities);
    if (draft.sharingPreference) setSharingPreference(draft.sharingPreference);
    if (draft.roommateGender) setRoommateGender(draft.roommateGender);
    if (draft.propertyType) setPropertyType(draft.propertyType);
    if (typeof draft.propertyTypeOther === "string") setPropertyTypeOther(draft.propertyTypeOther);
  }, [session.token]);

  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      setTenantOnboardDraft(session.token, {
        step,
        linkedinUrl,
        moveInTimeline,
        occupancyType,
        occupancyOther,
        bachelorGender,
        foodPreference,
        city,
        localities,
        sharingPreference,
        roommateGender,
        propertyType,
        propertyTypeOther,
      });
    }, 400);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [
    session.token,
    step,
    linkedinUrl,
    moveInTimeline,
    occupancyType,
    occupancyOther,
    bachelorGender,
    foodPreference,
    city,
    localities,
    sharingPreference,
    roommateGender,
    propertyType,
    propertyTypeOther,
  ]);

  const addLocality = (loc: string) => {
    if (!loc || localities.includes(loc) || localities.length >= 4) return;
    setLocalities([...localities, loc]);
    setLocalityInput("");
  };

  const removeLocality = (loc: string) => {
    setLocalities(localities.filter((l) => l !== loc));
  };

  const availableLocalities = (CITY_LOCALITIES[city] ?? []).filter((l) => !localities.includes(l));

  const buildPayload = (): TenantOnboardSubmitPayload => ({
    name: session.name.trim(),
    phone: `+91${phoneDigits}`,
    linkedinUrl: linkedinUrl.trim(),
    occupancyFrom: moveInTimeline,
    who: occupancyType,
    whoOther: occupancyType === "Other" ? occupancyOther.trim() : undefined,
    identify: occupancyType === "Bachelor" && bachelorGender ? [bachelorGender] : undefined,
    food: foodPreference,
    city,
    localities,
    propertyType,
    propertyTypeOther: propertyType === "Other" ? propertyTypeOther.trim() : undefined,
    sharing: sharingPreference,
    roommate:
      sharingPreference === "Double Sharing" || sharingPreference === "Triple Sharing"
        ? roommateGender
          ? [roommateGender]
          : undefined
        : undefined,
    detailsComplete: true,
  });

  const handleSubmit = async () => {
    setStepTouched(true);
    if (!step2Valid) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitTenantOnboardRequirements(session.token, buildPayload());
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      saveTenantRentalPreferences(`+91${phoneDigits}`, {
        occupancyType: occupancyType === "Other" ? occupancyOther.trim() : occupancyType,
        occupancyOther: occupancyType === "Other" ? occupancyOther.trim() : undefined,
        moveInTimeline,
        foodPreference,
        sharingPreference,
        roommatePreference: roommateGender || undefined,
        propertyType: propertyType === "Other" ? propertyTypeOther.trim() : propertyType,
        city,
        localities,
      });
      const currentProfile = getTenantAccountProfile();
      saveTenantAccountProfile({
        ...currentProfile,
        name: session.name.trim() || currentProfile.name,
        phone: phoneDigits,
        gender: bachelorGender || currentProfile.gender,
      });
      setBrokerName(result.brokerName);
      setSuccessOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueStep1 = () => {
    setStepTouched(true);
    if (!step1Valid) return;
    setStep(2);
    setStepTouched(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA] relative">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between">
        {step === 2 ? (
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setStepTouched(false);
            }}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft size={16} /> Go back
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm text-gray-400">
            <ChevronLeft size={16} /> Go back
          </span>
        )}
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
          <User size={18} />
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <span
              className={cn("h-1.5 flex-1 rounded-full", step >= 1 ? "bg-primary" : "bg-gray-200")}
            />
            <span
              className={cn("h-1.5 flex-1 rounded-full", step >= 2 ? "bg-primary" : "bg-gray-200")}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6">
              {step === 1
                ? "Tell us a bit about yourself"
                : "Tell us more about what you are looking for"}
            </h1>

            {step === 1 ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="onboard-linkedin" className="text-gray-700">
                    LinkedIn Profile <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="onboard-linkedin"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700">
                    When do you need a house? <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {MOVE_IN_TIMELINES.map((opt) => (
                      <FlowChipButton
                        key={opt}
                        label={opt}
                        selected={moveInTimeline === opt}
                        onClick={() => setMoveInTimeline(opt)}
                        className="w-full text-xs sm:text-sm whitespace-normal h-auto min-h-[42px]"
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700">
                    Who will be staying in the property?{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {OCCUPANCY_TYPES.map((opt) => (
                      <FlowChipButton
                        key={opt}
                        label={opt}
                        selected={occupancyType === opt}
                        onClick={() => {
                          setOccupancyType(opt);
                          if (opt !== "Bachelor") setBachelorGender("");
                          if (opt !== "Other") setOccupancyOther("");
                        }}
                        className="text-xs sm:text-sm whitespace-normal h-auto min-h-[42px]"
                      />
                    ))}
                  </div>
                </div>

                {occupancyType === "Bachelor" ? (
                  <div className="space-y-2">
                    <Label className="text-gray-700">
                      Gender <span className="text-destructive">*</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {BACHELOR_GENDERS.map((opt) => (
                        <FlowChipButton
                          key={opt}
                          label={opt}
                          selected={bachelorGender === opt}
                          onClick={() => setBachelorGender(opt)}
                          className="w-full"
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {occupancyType === "Other" ? (
                  <div className="space-y-2">
                    <Label htmlFor="onboard-occupancy-other" className="text-gray-700">
                      Please specify <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="onboard-occupancy-other"
                      value={occupancyOther}
                      onChange={(e) => setOccupancyOther(e.target.value)}
                      placeholder="Describe who will be staying"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label className="text-gray-700">
                    Food Preference <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {FOOD_PREFERENCES.map((opt) => (
                      <FlowChipButton
                        key={opt}
                        label={opt}
                        selected={foodPreference === opt}
                        onClick={() => setFoodPreference(opt)}
                        className="w-full text-xs sm:text-sm"
                      />
                    ))}
                  </div>
                </div>

                {stepTouched && step1Error ? (
                  <p className="text-sm text-destructive text-center">{step1Error}</p>
                ) : null}

                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    className={authPrimaryButtonClass}
                    disabled={!step1Valid}
                    onClick={handleContinueStep1}
                  >
                    Continue <ArrowRight size={16} className="ml-1" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-gray-700">
                    Preferred Area / Locality{" "}
                    <span className="text-gray-400 text-xs">(Up to 4)</span>
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select
                      value={city}
                      onValueChange={(v) => {
                        setCity(v);
                        setLocalities([]);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(CITY_LOCALITIES).map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex-1 min-h-9 rounded-md border border-input bg-white px-2 py-1 flex flex-wrap gap-2 items-center">
                      {localities.map((l) => (
                        <span
                          key={l}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-primary text-xs border border-blue-100"
                        >
                          {l}
                          <button type="button" onClick={() => removeLocality(l)} aria-label={`Remove ${l}`}>
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      <input
                        list="tenant-onboard-localities"
                        value={localityInput}
                        onChange={(e) => setLocalityInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addLocality(localityInput.trim());
                          }
                        }}
                        onBlur={() => localityInput && addLocality(localityInput.trim())}
                        placeholder={
                          localities.length >= 4 ? "Max 4 selected" : "Search locality and press Enter"
                        }
                        disabled={localities.length >= 4}
                        className="flex-1 min-w-[140px] bg-transparent text-sm outline-none"
                      />
                      <datalist id="tenant-onboard-localities">
                        {availableLocalities.map((l) => (
                          <option key={l} value={l} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700">
                    Sharing Preference <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SHARING_PREFERENCES.map((opt) => (
                      <FlowChipButton
                        key={opt}
                        label={opt}
                        selected={sharingPreference === opt}
                        onClick={() => {
                          setSharingPreference(opt);
                          if (opt !== "Double Sharing" && opt !== "Triple Sharing") {
                            setRoommateGender("");
                          }
                        }}
                        className="text-xs sm:text-sm whitespace-normal h-auto min-h-[42px]"
                      />
                    ))}
                  </div>
                </div>

                {sharingPreference === "Double Sharing" || sharingPreference === "Triple Sharing" ? (
                  <div className="space-y-2">
                    <Label className="text-gray-700">
                      Preferred Roommate Gender <span className="text-destructive">*</span>
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {ROOMMATE_GENDERS.map((opt) => (
                        <FlowChipButton
                          key={opt}
                          label={opt}
                          selected={roommateGender === opt}
                          onClick={() => setRoommateGender(opt)}
                          className="w-full text-xs sm:text-sm"
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label className="text-gray-700">
                    Type of Property <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ONBOARD_PROPERTY_TYPES.map((opt) => (
                      <FlowChipButton
                        key={opt}
                        label={opt}
                        selected={propertyType === opt}
                        onClick={() => {
                          setPropertyType(opt);
                          if (opt !== "Other") setPropertyTypeOther("");
                        }}
                        className="text-xs sm:text-sm whitespace-normal h-auto min-h-[42px]"
                      />
                    ))}
                  </div>
                </div>

                {propertyType === "Other" ? (
                  <div className="space-y-2">
                    <Label htmlFor="onboard-property-other" className="text-gray-700">
                      Please specify property type <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="onboard-property-other"
                      value={propertyTypeOther}
                      onChange={(e) => setPropertyTypeOther(e.target.value)}
                      placeholder="Describe the property type you are looking for"
                    />
                  </div>
                ) : null}

                {stepTouched && step2Error ? (
                  <p className="text-sm text-destructive text-center">{step2Error}</p>
                ) : null}
                {submitError ? (
                  <p className="text-sm text-destructive text-center">{submitError}</p>
                ) : null}

                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    className={authPrimaryButtonClass}
                    disabled={!step2Valid || submitting}
                    onClick={() => void handleSubmit()}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" /> Submitting…
                      </>
                    ) : (
                      "Share Details"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <TrustKeyperFooter />

      {successOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full p-8 text-center animate-in zoom-in-95 fade-in duration-300"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tenant-onboard-success-title"
          >
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 id="tenant-onboard-success-title" className="text-lg font-semibold text-gray-900 mb-2">
              Requirements Submitted Successfully
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Your rental requirements have been shared with the broker
              {brokerName ? ` (${brokerName})` : ""}. You will be contacted shortly with properties
              that match your needs.
            </p>
            <Button type="button" className={cn(authPrimaryButtonClass, "w-full")} onClick={onDone}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
