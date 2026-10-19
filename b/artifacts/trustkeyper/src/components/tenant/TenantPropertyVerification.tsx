import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPhoneField } from "@/components/auth/AuthPhoneField";
import { setTenantShareSession, type TenantShareSession } from "@/lib/tenantShareSession";
import { cn } from "@/lib/utils";

export function TenantPropertyVerification({
  propertyId,
  onVerified,
  onCancel,
}: {
  propertyId: string;
  onVerified: (session: TenantShareSession) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ name: false, phone: false });
  const [error, setError] = useState<string | null>(null);

  const nameValid = name.trim().length >= 2;
  const phoneValid = phone.replace(/\D/g, "").length === 10;
  const canContinue = nameValid && phoneValid && !loading;

  const nameError = touched.name && !nameValid ? "Enter your full name" : null;
  const phoneError =
    touched.phone && !phoneValid ? "Enter a valid 10-digit mobile number" : null;

  const handleContinue = () => {
    setTouched({ name: true, phone: true });
    if (!canContinue) return;

    setError(null);
    setLoading(true);
    const session: TenantShareSession = {
      propertyId,
      name: name.trim(),
      phone: `+91${phone.replace(/\D/g, "").slice(-10)}`,
      verifiedAt: Date.now(),
    };
    setTenantShareSession(session);
    window.setTimeout(() => {
      setLoading(false);
      onVerified(session);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-300">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-share-verify-title"
      >
        <div className="p-6 sm:p-8">
          <h2
            id="tenant-share-verify-title"
            className="text-xl font-semibold text-gray-900 text-center mb-1"
          >
            Welcome to TrustKeyper
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            Before viewing property details, verify your information.
          </p>

          <div className="space-y-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="tenant-share-name" className="text-gray-700">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tenant-share-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                placeholder="Enter full name"
                className={cn("h-10", nameError && "border-destructive")}
                aria-invalid={!!nameError}
              />
              {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
            </div>
            <AuthPhoneField
              id="tenant-share-phone"
              value={phone}
              onChange={setPhone}
              helperText={undefined}
              errorText={phoneError ?? (error && !phoneError ? error : null)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="w-full h-11 rounded-[4px] font-semibold"
              disabled={!canContinue}
              onClick={handleContinue}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" /> Continuing…
                </>
              ) : (
                "Continue"
              )}
            </Button>
            {onCancel ? (
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-[4px] font-semibold"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
