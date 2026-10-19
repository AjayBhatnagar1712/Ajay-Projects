import React, { useEffect, useState } from "react";
import { Link2, Loader2, X } from "lucide-react";
import { BrokerFlowButton } from "@/components/broker/BrokerFlowButton";
import { AuthPhoneField } from "@/components/auth/AuthPhoneField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { BrokerOnboardLinkPayload } from "@/lib/brokerOnboardShareActions";
import {
  createBrokerTenantOnboardingInvite,
  findPendingInviteByPhone,
  getTenantPhoneConflict,
  isValidIndianMobile,
  tenantPhoneConflictMessage,
  type CreateBrokerOnboardInviteResult,
} from "@/lib/brokerTenantOnboarding";

type BrokerOnboardInviteError = Extract<CreateBrokerOnboardInviteResult, { ok: false }>["error"];

const INVITE_ERROR_MESSAGES: Record<BrokerOnboardInviteError, string> = {
  invalid_name: "Enter tenant full name",
  invalid_phone: "Enter a valid 10-digit mobile number",
  duplicate_tenant: "A tenant lead with this mobile number already exists.",
  duplicate_tenant_account:
    "This mobile number already has a tenant account. A phone number can only be a tenant once.",
  duplicate_invite: "An active onboarding link already exists for this number.",
  no_session: "Please sign in as a broker to generate onboarding links.",
  unauthorized: "Your session expired. Sign in again and retry.",
  server_error:
    "Could not register this link on the server. Try again in a moment — do not share a link until generation succeeds.",
  network: "Network error. Check your connection and try again.",
};

export function BrokerOnboardInviteModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (payload: BrokerOnboardLinkPayload) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ name: false, phone: false });
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const nameValid = name.trim().length >= 2;
  const phoneValid = isValidIndianMobile(phone);
  const canSubmit = nameValid && phoneValid && !loading && !duplicateWarning;

  const nameError = touched.name && !nameValid ? "Enter tenant full name" : null;
  const phoneError =
    touched.phone && !phoneValid ? "Enter a valid 10-digit mobile number" : null;

  useEffect(() => {
    if (!open) {
      setName("");
      setPhone("");
      setTouched({ name: false, phone: false });
      setDuplicateWarning(null);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!phoneValid) {
      setDuplicateWarning(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const conflict = await getTenantPhoneConflict(phone);
      if (cancelled) return;
      if (conflict) {
        setDuplicateWarning(tenantPhoneConflictMessage(conflict));
        return;
      }
      if (findPendingInviteByPhone(phone)) {
        setDuplicateWarning("An active onboarding link was already sent to this mobile number.");
        return;
      }
      setDuplicateWarning(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [phone, phoneValid]);

  const handleSubmit = async () => {
    setTouched({ name: true, phone: true });
    if (!canSubmit) return;

    setLoading(true);
    try {
      const result = await createBrokerTenantOnboardingInvite(name, phone);
      if (!result.ok) {
        const description = result.detail
          ? `${INVITE_ERROR_MESSAGES[result.error]} (${result.detail})`
          : INVITE_ERROR_MESSAGES[result.error];
        toast({
          title: "Could not generate link",
          description,
          variant: "destructive",
        });
        return;
      }

      onSuccess({
        tenantName: result.invite.tenantName,
        tenantPhone: result.invite.tenantPhone,
        link: result.link,
        token: result.invite.token,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="broker-onboard-invite-title"
        className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 p-6 animate-in fade-in zoom-in-95 duration-200"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h2 id="broker-onboard-invite-title" className="text-lg font-semibold text-gray-900 pr-8">
          Send Onboarding Link
        </h2>
        <p className="text-sm text-gray-500 mt-1 mb-5">
          Enter tenant&apos;s basic details to generate a personalized link.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="modal-onboard-name" className="text-gray-700">
              Tenant Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="modal-onboard-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              placeholder="Enter name"
              className={nameError ? "border-destructive" : undefined}
              aria-invalid={!!nameError}
            />
            {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
          </div>

          <AuthPhoneField
            id="modal-onboard-phone"
            value={phone}
            onChange={setPhone}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            helperText={undefined}
            errorText={phoneError}
          />

          {duplicateWarning ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              {duplicateWarning}
            </p>
          ) : null}

          <BrokerFlowButton
            type="button"
            className="w-full"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Link2 size={16} /> Generate Link
              </>
            )}
          </BrokerFlowButton>
        </div>
      </div>
    </div>
  );
}
