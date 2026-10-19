import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Send } from "lucide-react";
import { FlowDateInput } from "@/components/flow/FlowDateInput";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { OwnerFlowButton } from "@/components/owner/OwnerFlowButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Property } from "@/lib/properties";
import { useToast } from "@/hooks/use-toast";
import {
  formatMemberContact,
  getPropertyInviteLabel,
  openWhatsAppInvite,
  sendOwnerTenantInvites,
} from "@/lib/ownerTenants";

type Step = "tenant" | "rental";

export interface InviteTenantsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  onSuccess: () => void;
}

export function InviteTenantsModal({
  open,
  onOpenChange,
  properties,
  onSuccess,
}: InviteTenantsModalProps) {
  const [step, setStep] = useState<Step>("tenant");
  const [propertyId, setPropertyId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [maintenanceIncluded, setMaintenanceIncluded] = useState(false);
  const [monthlyMaintenance, setMonthlyMaintenance] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === propertyId),
    [properties, propertyId],
  );

  useEffect(() => {
    if (!open) return;
    setStep("tenant");
    const first = properties[0];
    setPropertyId(first?.id ?? "");
    setTenantName("");
    setTenantPhone("");
    if (first) {
      setMonthlyRent(formatRentInput(first.monthlyRent || ""));
      setMaintenanceIncluded(!!first.maintenanceIncluded);
      setMonthlyMaintenance(formatRentInput(first.monthlyMaintenance || ""));
      setSecurityDeposit(formatRentInput(first.securityDeposit || ""));
    } else {
      setMonthlyRent("");
      setMaintenanceIncluded(false);
      setMonthlyMaintenance("");
      setSecurityDeposit("");
    }
    setStartDate("");
  }, [open, properties]);

  useEffect(() => {
    if (!selectedProperty) return;
    setMonthlyRent(formatRentInput(selectedProperty.monthlyRent || ""));
    setMaintenanceIncluded(!!selectedProperty.maintenanceIncluded);
    setMonthlyMaintenance(formatRentInput(selectedProperty.monthlyMaintenance || ""));
    setSecurityDeposit(formatRentInput(selectedProperty.securityDeposit || ""));
  }, [propertyId, selectedProperty?.id]);

  const propertyLabel = selectedProperty
    ? getPropertyInviteLabel(selectedProperty)
    : "";

  const canContinueTenant =
    !!propertyId &&
    tenantName.trim().length > 0 &&
    tenantPhone.replace(/\D/g, "").length === 10;

  const canSendInvite =
    !!propertyId &&
    canContinueTenant &&
    parseRent(monthlyRent).length > 0 &&
    parseRent(securityDeposit).length > 0 &&
    !!startDate &&
    (maintenanceIncluded || parseRent(monthlyMaintenance).length > 0);

  const modalTitle =
    step === "tenant" ? "Invite tenant" : "Confirm rental details for your property";

  const handleClose = (next: boolean) => {
    if (!next) onOpenChange(false);
  };

  const handleSendInvite = () => {
    if (!selectedProperty || !canSendInvite || saving) return;

    setSaving(true);
    const digits = tenantPhone.replace(/\D/g, "").slice(-10);
    const created = sendOwnerTenantInvites({
      propertyId: selectedProperty.id,
      propertyLabel,
      members: [
        {
          name: tenantName.trim(),
          phone: formatMemberContact(digits),
        },
      ],
      monthlyRent: parseRent(monthlyRent),
      maintenanceIncluded,
      monthlyMaintenance: parseRent(monthlyMaintenance),
      securityDeposit: parseRent(securityDeposit),
      startDate,
    });

    setSaving(false);
    const invite = created[0];
    if (invite) {
      openWhatsAppInvite(invite);
      toast({
        title: "Invite sent",
        description: "WhatsApp opened with your invitation message.",
      });
    }
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 gap-0">
        <h2 className="text-center text-lg font-semibold text-gray-900 mb-6 pr-8">
          {modalTitle}
        </h2>

        {step === "tenant" && (
          <div className="space-y-4">
            <PropertyField
              properties={properties}
              propertyId={propertyId}
              onPropertyIdChange={setPropertyId}
            />
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">
                Tenant name<span className="text-red-500">*</span>
              </Label>
              <Input
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className="h-10"
                placeholder="Full name"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">
                Phone Number<span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 shrink-0">+91</span>
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={tenantPhone}
                  onChange={(e) =>
                    setTenantPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  className="h-10 flex-1"
                  placeholder="10-digit number"
                  maxLength={10}
                />
              </div>
              {tenantPhone.length > 0 && tenantPhone.length < 10 ? (
                <p className="text-xs text-red-500 mt-1">Enter a valid 10-digit mobile number.</p>
              ) : null}
            </div>
            <div className="flex justify-center pt-4">
              <OwnerFlowButton
                type="button"
                disabled={!canContinueTenant || properties.length === 0}
                className="sm:min-w-[160px]"
                onClick={() => setStep("rental")}
              >
                Continue <ArrowRight size={16} />
              </OwnerFlowButton>
            </div>
          </div>
        )}

        {step === "rental" && (
          <div className="space-y-4">
            <PropertyField
              properties={properties}
              propertyId={propertyId}
              onPropertyIdChange={setPropertyId}
            />
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm text-gray-700">
              <span className="text-gray-500">Tenant: </span>
              <span className="font-medium">{tenantName.trim()}</span>
              <span className="text-gray-400 mx-2">·</span>
              <span className="font-medium">{formatMemberContact(tenantPhone)}</span>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">
                Monthly Rent<span className="text-red-500">*</span>
              </Label>
              <Input
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(formatRentInput(e.target.value))}
                className="h-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="maint-included"
                checked={maintenanceIncluded}
                onCheckedChange={(checked) => {
                  const on = checked === true;
                  setMaintenanceIncluded(on);
                  if (on) setMonthlyMaintenance("");
                }}
              />
              <label htmlFor="maint-included" className="text-sm text-gray-700 cursor-pointer">
                Maintenance included
              </label>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">
                Monthly Maintenance Amount
                {!maintenanceIncluded ? <span className="text-red-500">*</span> : null}
              </Label>
              <Input
                value={monthlyMaintenance}
                onChange={(e) => setMonthlyMaintenance(formatRentInput(e.target.value))}
                className={`h-10 ${maintenanceIncluded ? "opacity-40 bg-gray-50" : ""}`}
                disabled={maintenanceIncluded}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">
                Security Deposit<span className="text-red-500">*</span>
              </Label>
              <Input
                value={securityDeposit}
                onChange={(e) => setSecurityDeposit(formatRentInput(e.target.value))}
                className="h-10"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">
                Start Date<span className="text-red-500">*</span>
              </Label>
              <FlowDateInput
                variant="owner"
                value={startDate}
                onChange={setStartDate}
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-2 pt-4">
              <OwnerFlowButton
                type="button"
                flowVariant="outline"
                className="sm:min-w-[120px]"
                onClick={() => setStep("tenant")}
              >
                Back
              </OwnerFlowButton>
              <OwnerFlowButton
                type="button"
                disabled={!canSendInvite || saving}
                className="sm:min-w-[160px]"
                onClick={handleSendInvite}
              >
                <Send size={16} />
                {saving ? "Sending…" : "Send Invite"}
              </OwnerFlowButton>
            </div>
          </div>
        )}

        {properties.length === 0 && (
          <p className="text-sm text-amber-700 text-center mt-4">
            Add a property before inviting tenants.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function parseRent(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function formatRentInput(value: string): string {
  const n = parseRent(value);
  if (!n) return "";
  return `₹ ${Number(n).toLocaleString("en-IN")}`;
}

function PropertyField({
  properties,
  propertyId,
  onPropertyIdChange,
}: {
  properties: Property[];
  propertyId: string;
  onPropertyIdChange: (id: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-gray-500 mb-1.5 block">Property name</Label>
      <Select value={propertyId} onValueChange={onPropertyIdChange} disabled={properties.length === 0}>
        <SelectTrigger className="h-10 w-full">
          <SelectValue placeholder="Select property" />
        </SelectTrigger>
        <SelectContent>
          {properties.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {getPropertyInviteLabel(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
