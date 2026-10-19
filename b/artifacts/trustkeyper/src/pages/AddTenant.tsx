import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  FileText,
  X,
} from "lucide-react";
import BrokerLayout from "@/components/BrokerLayout";
import { BrokerFlowButton } from "@/components/broker/BrokerFlowButton";
import { BrokerOnboardInvitationCreatedModal } from "@/components/broker/BrokerOnboardInvitationCreatedModal";
import {
  AddManuallySectionHeader,
  BrokerOnboardLinkGeneratorCard,
} from "@/components/broker/BrokerOnboardLinkGeneratorCard";
import { FlowChipButton } from "@/components/FlowChipButton";
import { FlowDateInput } from "@/components/flow/FlowDateInput";
import {
  FLOW_STICKY_CONTENT_CLASS,
  FlowStickyActionBar,
} from "@/components/FlowStickyActionBar";
import { Input } from "@/components/ui/input";
import { todayLocalDateInputMin } from "@/lib/dateInput";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { broadcastBrokerPendingFlowsUpdated } from "@/lib/brokerPendingFlows";
import {
  addTenant,
  getTenantById,
  updateTenant,
  CITY_LOCALITIES,
  type Identify,
  type PropertyType,
  type Sharing,
  type Roommate,
} from "@/lib/tenants";
import {
  getTenantPhoneConflict,
  tenantPhoneConflictMessage,
} from "@/lib/tenantPhoneRules";
import { getSessionItem, removeSessionItem, setSessionItem } from "@/lib/storageKeys";
import type { BrokerOnboardLinkPayload } from "@/lib/brokerOnboardShareActions";

type Step = 1 | 2;

const PROPERTY_TYPES: PropertyType[] = [
  "Apartment",
  "House",
  "Studio",
  "Villa",
  "PG/Hostel",
  "Other",
];
const SHARING_OPTIONS: Sharing[] = ["Single", "Double", "Triple", "Entire Property"];

export default function AddTenant() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftPausedRef = useRef(false);
  const editId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("edit")
      : null;

  // wizard step
  const [step, setStep] = useState<Step>(1);

  // Step 1 — Tenant L1
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [occupancyFrom, setOccupancyFrom] = useState("");
  const [who, setWho] = useState<"Family" | "Bachelor" | "">("");
  const [identify, setIdentify] = useState<Identify[]>([]);
  const [food, setFood] = useState<"Veg" | "Non-Veg" | "">("");

  // Step 2 — Location & Property Preference
  const [city, setCity] = useState<string>("Hyderabad");
  const [localities, setLocalities] = useState<string[]>([]);
  const [propertyType, setPropertyType] = useState<PropertyType | "">("");
  const [sharing, setSharing] = useState<Sharing | "">("");
  const [roommate, setRoommate] = useState<Roommate[]>([]);
  const [localityInput, setLocalityInput] = useState("");
  const [phoneConflictWarning, setPhoneConflictWarning] = useState<string | null>(null);

  // Success modal
  const [successOpen, setSuccessOpen] = useState(false);
  const [invitationCreatedPayload, setInvitationCreatedPayload] =
    useState<BrokerOnboardLinkPayload | null>(null);

  useEffect(() => {
    if (!editId || typeof window === "undefined") return;
    const tenant = getTenantById(editId);
    if (!tenant) return;
    draftPausedRef.current = true;
    setName(tenant.name);
    setPhone(tenant.phone.replace(/\D/g, "").slice(-10));
    setOccupancyFrom(tenant.occupancyFrom ?? "");
    setWho(tenant.who === "Family" || tenant.who === "Bachelor" ? tenant.who : "");
    setIdentify(
      (tenant.identify ?? []).filter((value): value is Identify => value === "Male" || value === "Female"),
    );
    setFood(tenant.food === "Veg" || tenant.food === "Non-Veg" ? tenant.food : "");
    setCity(tenant.city ?? "Hyderabad");
    setLocalities(tenant.localities ?? []);
    setPropertyType(
      tenant.propertyType === "Apartment" ||
        tenant.propertyType === "House" ||
        tenant.propertyType === "Studio" ||
        tenant.propertyType === "Villa" ||
        tenant.propertyType === "PG/Hostel" ||
        tenant.propertyType === "Other"
        ? tenant.propertyType
        : "",
    );
    setSharing(
      tenant.sharing === "Single" ||
        tenant.sharing === "Double" ||
        tenant.sharing === "Triple" ||
        tenant.sharing === "Entire Property"
        ? tenant.sharing
        : "",
    );
    setRoommate(
      (tenant.roommate ?? []).filter(
        (value): value is Roommate => value === "Male" || value === "Female" || value === "Anyone",
      ),
    );
    setStep(tenant.detailsComplete ? 2 : 1);
  }, [editId]);

  useEffect(() => {
    if (typeof window === "undefined" || editId) return;
    try {
      const raw = getSessionItem("add_tenant_draft");
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (d.step === 1 || d.step === 2) setStep(d.step as Step);
      if (typeof d.name === "string") setName(d.name);
      if (typeof d.phone === "string") setPhone(d.phone);
      if (typeof d.occupancyFrom === "string") setOccupancyFrom(d.occupancyFrom);
      if (d.who === "Family" || d.who === "Bachelor") setWho(d.who);
      if (Array.isArray(d.identify)) setIdentify(d.identify as Identify[]);
      if (d.food === "Veg" || d.food === "Non-Veg") setFood(d.food);
      if (typeof d.city === "string" && d.city) setCity(d.city);
      if (Array.isArray(d.localities)) setLocalities(d.localities as string[]);
      if (d.propertyType) setPropertyType(d.propertyType as PropertyType);
      if (d.sharing) setSharing(d.sharing as Sharing);
      if (Array.isArray(d.roommate)) setRoommate(d.roommate as Roommate[]);
    } catch {
      /* ignore */
    }
  }, [editId]);

  useEffect(() => {
    if (typeof window === "undefined" || draftPausedRef.current) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        setSessionItem(
          "add_tenant_draft",
          JSON.stringify({
            v: 1,
            step,
            name,
            phone,
            occupancyFrom,
            who,
            identify,
            food,
            city,
            localities,
            propertyType,
            sharing,
            roommate,
          }),
        );
        broadcastBrokerPendingFlowsUpdated();
      } catch {
        /* ignore */
      }
    }, 450);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [
    step,
    name,
    phone,
    occupancyFrom,
    who,
    identify,
    food,
    city,
    localities,
    propertyType,
    sharing,
    roommate,
  ]);

  const handleClearTenantForm = () => {
    draftPausedRef.current = false;
    try {
      removeSessionItem("add_tenant_draft");
    } catch {
      /* ignore */
    }
    setStep(1);
    setName("");
    setPhone("");
    setOccupancyFrom("");
    setWho("");
    setIdentify([]);
    setFood("");
    setCity("Hyderabad");
    setLocalities([]);
    setPropertyType("");
    setSharing("");
    setRoommate([]);
    setLocalityInput("");
    setSuccessOpen(false);
    broadcastBrokerPendingFlowsUpdated();
  };

  const step1Valid = useMemo(() => {
    if (
      name.trim().length === 0 ||
      phone.trim().length !== 10 ||
      !occupancyFrom ||
      !who ||
      !food ||
      phoneConflictWarning
    )
      return false;
    if (who === "Bachelor" && identify.length === 0) return false;
    return true;
  }, [name, phone, occupancyFrom, who, identify, food, phoneConflictWarning]);

  useEffect(() => {
    if (phone.trim().length !== 10) {
      setPhoneConflictWarning(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const conflict = await getTenantPhoneConflict(phone, { excludeTenantId: editId ?? undefined });
      if (cancelled) return;
      setPhoneConflictWarning(conflict ? tenantPhoneConflictMessage(conflict) : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [phone, editId]);

  const step2Valid = useMemo(() => {
    if (localities.length === 0) return false;
    if (!propertyType) return false;
    if (!sharing) return false;
    if (sharing !== "Entire Property" && roommate.length === 0) return false;
    return true;
  }, [localities, propertyType, sharing, roommate]);

  const handleStep1Continue = () => {
    if (!step1Valid) return;
    setStep(2);
  };

  const persistTenant = async (complete: boolean) => {
    if (!editId) {
      const conflict = await getTenantPhoneConflict(phone);
      if (conflict) {
        toast({
          description: tenantPhoneConflictMessage(conflict),
          variant: "destructive",
        });
        return;
      }
    } else {
      const conflict = await getTenantPhoneConflict(phone, { excludeTenantId: editId });
      if (conflict) {
        toast({
          description: tenantPhoneConflictMessage(conflict),
          variant: "destructive",
        });
        return;
      }
    }

    draftPausedRef.current = true;
    const payload = {
      name,
      phone: `+91${phone}`,
      occupancyFrom,
      who: who as "Family" | "Bachelor",
      identify: who === "Bachelor" ? identify : undefined,
      food: food as "Veg" | "Non-Veg",
      city: complete ? city : undefined,
      localities: complete ? localities : undefined,
      propertyType: complete ? (propertyType as PropertyType) : undefined,
      sharing: complete ? (sharing as Sharing) : undefined,
      roommate: complete && sharing !== "Entire Property" ? roommate : undefined,
      detailsComplete: complete,
    };

    if (editId) {
      updateTenant(editId, payload);
    } else {
      addTenant({ ...payload, source: "manual" });
    }

    try {
      removeSessionItem("add_tenant_draft");
    } catch {
      /* ignore */
    }
    broadcastBrokerPendingFlowsUpdated();
    toast({
      description: editId ? "Tenant lead updated." : "Tenant added successfully!",
    });
    if (editId) {
      setLocation("/broker/tenants");
      return;
    }
    setSuccessOpen(true);
  };

  const handleSaveDetails = () => {
    if (!step2Valid) return;
    void persistTenant(true);
  };

  const handleSkipSave = () => {
    void persistTenant(false);
  };

  const toggleIdentify = (v: Identify) => {
    setIdentify((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  };

  const toggleRoommate = (v: Roommate) => {
    setRoommate((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  };

  const addLocality = (loc: string) => {
    if (!loc) return;
    if (localities.includes(loc)) return;
    if (localities.length >= 4) {
      toast({ description: "You can choose up to 4 localities" });
      return;
    }
    setLocalities([...localities, loc]);
    setLocalityInput("");
  };

  const removeLocality = (loc: string) => {
    setLocalities(localities.filter((l) => l !== loc));
  };

  const availableLocalities = (CITY_LOCALITIES[city] ?? []).filter(
    (l) => !localities.includes(l),
  );

  return (
    <BrokerLayout>
      <div className={`max-w-3xl mx-auto ${FLOW_STICKY_CONTENT_CLASS}`}>
        {step === 1 ? (
          editId ? (
            <Link
              href="/broker/tenants"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft size={16} /> Back to Tenants
            </Link>
          ) : (
            <Link
              href="/broker/dashboard"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>
          )
        ) : (
          <button
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft size={16} /> Back
          </button>
        )}

        <div className="flex items-center justify-between gap-3 mb-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            {editId ? "Edit Tenant Lead" : "Add Tenant"}
          </h1>
          {!editId ? (
            <button
              type="button"
              onClick={handleClearTenantForm}
              className="text-xs font-semibold text-primary border-0 bg-transparent shadow-none px-2 py-1.5 rounded-lg hover:bg-primary/10 transition-colors shrink-0"
            >
              Clear
            </button>
          ) : null}
        </div>

        {step === 1 && (
          <>
            {!editId ? (
              <BrokerOnboardLinkGeneratorCard onSuccess={setInvitationCreatedPayload} />
            ) : null}

            {!editId ? <AddManuallySectionHeader /> : null}

            {editId ? (
              <>
                <h2 className="text-base font-semibold text-gray-900 mb-1">Tenant details</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Update the tenant&apos;s basic information.
                </p>
              </>
            ) : null}

            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="t-name" className="text-gray-700">
                    Tenant&apos;s Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="t-name"
                    placeholder="Enter full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-phone" className="text-gray-700">
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-3 rounded-md border border-input bg-gray-50 text-sm text-gray-700"
                    >
                      🇮🇳 +91 <ChevronDown size={14} />
                    </button>
                    <Input
                      id="t-phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10-digit number"
                      value={phone}
                      onChange={(e) =>
                        setPhone(
                          e.target.value.replace(/\D/g, "").slice(0, 10),
                        )
                      }
                      className="flex-1"
                    />
                  </div>
                  {phoneConflictWarning ? (
                    <p className="text-sm text-destructive">{phoneConflictWarning}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2 max-w-sm">
                <Label htmlFor="t-occ" className="text-gray-700">
                  Occupancy From <span className="text-destructive">*</span>
                </Label>
                <FlowDateInput
                  id="t-occ"
                  min={todayLocalDateInputMin()}
                  value={occupancyFrom}
                  onChange={setOccupancyFrom}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-700">
                  Who will be staying in the property?{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["Family", "Bachelor"] as const).map((opt) => (
                    <FlowChipButton
                      key={opt}
                      label={opt === "Family" ? "👨‍👩‍👧 Family" : "🧑 Bachelor"}
                      selected={who === opt}
                      onClick={() => {
                        setWho(opt);
                        if (opt === "Family") setIdentify([]);
                      }}
                      className="w-full"
                    />
                  ))}
                </div>
              </div>

              {who === "Bachelor" && (
                <div className="space-y-2">
                  <Label className="text-gray-700">
                    How do you identify?{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex items-center gap-6">
                    {(["Male", "Female"] as const).map((opt) => (
                      <label
                        key={opt}
                        className="inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={identify.includes(opt)}
                          onCheckedChange={() => toggleIdentify(opt)}
                        />
                        <span className="text-sm text-gray-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-gray-700">
                  Food Preference <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["Veg", "Non-Veg"] as const).map((opt) => (
                    <FlowChipButton
                      key={opt}
                      label={opt === "Veg" ? "🟢 Veg" : "🔴 Non-Veg"}
                      selected={food === opt}
                      onClick={() => setFood(opt)}
                      className="w-full"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Step 1 CTA — desktop */}
            <div className="hidden sm:flex justify-center mt-8">
              <BrokerFlowButton
                type="button"
                onClick={handleStep1Continue}
                disabled={!step1Valid}
                className="sm:min-w-[160px]"
              >
                Continue <ArrowRight size={16} />
              </BrokerFlowButton>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Location & property preference</h2>
            <p className="text-sm text-gray-500 mb-4">Optional details to help match the right property.</p>

            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
              {/* Locality */}
              <div className="space-y-2">
                <Label className="text-gray-700">
                  Area / Locality{" "}
                  <span className="text-gray-400 text-xs">(Upto 4)</span>
                  <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={city}
                    onValueChange={(v) => {
                      setCity(v);
                      setLocalities([]);
                    }}
                  >
                    <SelectTrigger className="w-36">
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
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-primary text-xs"
                      >
                        {l}
                        <button
                          type="button"
                          onClick={() => removeLocality(l)}
                          className="hover:text-primary/70"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <input
                      list="locality-options"
                      value={localityInput}
                      onChange={(e) => setLocalityInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addLocality(localityInput.trim());
                        }
                      }}
                      onBlur={() =>
                        localityInput && addLocality(localityInput.trim())
                      }
                      placeholder={
                        localities.length >= 4
                          ? "Max 4 selected"
                          : "Type and press Enter"
                      }
                      disabled={localities.length >= 4}
                      className="flex-1 min-w-[140px] bg-transparent text-sm outline-none"
                    />
                    <datalist id="locality-options">
                      {availableLocalities.map((l) => (
                        <option key={l} value={l} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Property Type */}
              <div className="space-y-2">
                <Label className="text-gray-700">
                  Property Type <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {PROPERTY_TYPES.map((p) => (
                    <FlowChipButton
                      key={p}
                      label={p}
                      selected={propertyType === p}
                      onClick={() => setPropertyType(p)}
                      className="px-2 text-xs sm:text-sm"
                    />
                  ))}
                </div>
              </div>

              {/* Sharing */}
              <div className="space-y-2">
                <Label className="text-gray-700">
                  Sharing Preferences{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SHARING_OPTIONS.map((s) => (
                    <FlowChipButton
                      key={s}
                      label={s === "Entire Property" ? "Entire Property (No sharing)" : s}
                      selected={sharing === s}
                      onClick={() => {
                        setSharing(s);
                        if (s === "Entire Property") setRoommate([]);
                      }}
                      className="px-2 text-xs sm:text-sm whitespace-normal h-auto min-h-[42px]"
                    />
                  ))}
                </div>
              </div>

              {/* Roommate preferences */}
              {sharing && sharing !== "Entire Property" && (
                <div className="space-y-2">
                  <Label className="text-gray-700">
                    Roommate preferences{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex items-center gap-6 flex-wrap">
                    {(
                      [
                        { v: "Male", label: "Male" },
                        { v: "Female", label: "Female" },
                        { v: "Anyone", label: "Anyone (No Preference)" },
                      ] as { v: Roommate; label: string }[]
                    ).map((opt) => (
                      <label
                        key={opt.v}
                        className="inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={roommate.includes(opt.v)}
                          onCheckedChange={() => toggleRoommate(opt.v)}
                        />
                        <span className="text-sm text-gray-700">
                          {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2 CTA — desktop */}
            <div className="hidden sm:flex justify-center gap-3 mt-6">
              <BrokerFlowButton
                type="button"
                flowVariant="outline"
                onClick={handleSkipSave}
                className="sm:min-w-[160px]"
              >
                Skip and Save details
              </BrokerFlowButton>
              <BrokerFlowButton
                type="button"
                onClick={handleSaveDetails}
                disabled={!step2Valid}
                className="sm:min-w-[160px]"
              >
                Save Details
              </BrokerFlowButton>
            </div>
          </>
        )}
      </div>

      {step === 1 && (
        <FlowStickyActionBar>
          <BrokerFlowButton
            type="button"
            onClick={handleStep1Continue}
            disabled={!step1Valid}
            className="w-full"
          >
            Continue <ArrowRight size={16} />
          </BrokerFlowButton>
        </FlowStickyActionBar>
      )}
      {step === 2 && (
        <FlowStickyActionBar innerClassName="flex gap-3">
          <BrokerFlowButton
            type="button"
            flowVariant="outline"
            onClick={handleSkipSave}
            className="flex-1"
          >
            Skip
          </BrokerFlowButton>
          <BrokerFlowButton
            type="button"
            onClick={handleSaveDetails}
            disabled={!step2Valid}
            className="flex-1"
          >
            Save Details
          </BrokerFlowButton>
        </FlowStickyActionBar>
      )}

      {/* Success modal */}
      <Dialog
        open={successOpen}
        onOpenChange={(o) => {
          setSuccessOpen(o);
          if (!o) setLocation("/broker/tenants");
        }}
      >
        <DialogContent className="sm:max-w-md p-0 [&>button]:hidden">
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/15 mx-auto mb-4 flex items-center justify-center">
              <CheckCircle2 size={36} className="text-accent" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              Tenant Profile Created!
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              The tenant details have been saved successfully.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <BrokerFlowButton
                type="button"
                flowVariant="outline"
                onClick={() => {
                  setSuccessOpen(false);
                  setLocation("/broker/tenants");
                }}
              >
                Skip for now
              </BrokerFlowButton>
              <BrokerFlowButton
                type="button"
                onClick={() => {
                  setSuccessOpen(false);
                  setLocation("/broker/agreements/generate");
                }}
              >
                <FileText size={16} />
                Generate Agreement
              </BrokerFlowButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {invitationCreatedPayload && !editId ? (
        <BrokerOnboardInvitationCreatedModal
          open
          {...invitationCreatedPayload}
          onClose={() => setInvitationCreatedPayload(null)}
        />
      ) : null}
    </BrokerLayout>
  );
}
