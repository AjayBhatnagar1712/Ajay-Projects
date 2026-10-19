import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AuthPhoneField } from "@/components/auth/AuthPhoneField";
import { AuthTextField } from "@/components/auth/AuthTextField";
import { AuthSignupScreenFooter } from "@/components/auth/AuthSignupScreenFooter";
import { AuthStepHeading } from "@/components/auth/AuthStepHeading";
import { authMobileScrollPadClass, authPrimaryButtonClass } from "@/components/auth/authStyles";
import { profileExistsAsync } from "@/lib/auth";

interface OwnerStep3DetailsProps {
  details: { name: string; phone: string };
  setDetails: (details: { name: string; phone: string }) => void;
  onNext: () => void;
}

export default function OwnerStep3Details({ details, setDetails, onNext }: OwnerStep3DetailsProps) {
  const [, setLocation] = useLocation();
  const digits = details.phone.replace(/\D/g, "").slice(0, 10);
  const [duplicateOwnerPhone, setDuplicateOwnerPhone] = useState(false);

  useEffect(() => {
    if (digits.length !== 10) {
      setDuplicateOwnerPhone(false);
      return;
    }
    let cancelled = false;
    void profileExistsAsync(digits, "owner").then((exists) => {
      if (!cancelled) setDuplicateOwnerPhone(exists);
    });
    return () => {
      cancelled = true;
    };
  }, [digits]);

  const isComplete = details.name.trim().length > 0 && digits.length === 10 && !duplicateOwnerPhone;

  const cta = (
    <Button size="lg" onClick={onNext} disabled={!isComplete} className={authPrimaryButtonClass}>
      Send OTP & Register &rarr;
    </Button>
  );

  return (
    <div className={`flex flex-col h-full max-w-md w-full mx-auto lg:max-w-2xl lg:mx-0 ${authMobileScrollPadClass}`}>
      <AuthStepHeading title="Let's know you better" />

      <div className="space-y-6 max-w-md">
        <AuthTextField
          id="name"
          label="Your Name"
          value={details.name}
          onChange={(name) => setDetails({ ...details, name })}
        />
        <AuthPhoneField
          id="phone"
          value={digits}
          onChange={(phone) => setDetails({ ...details, phone })}
          helperText={duplicateOwnerPhone ? undefined : "We'll send an OTP to verify"}
        />
        {duplicateOwnerPhone ? (
          <p className="text-sm text-destructive">
            Account exists.{" "}
            <button
              type="button"
              onClick={() => setLocation("/login")}
              className="font-medium underline underline-offset-2 hover:text-destructive/80"
            >
              Log in instead?
            </button>
          </p>
        ) : null}
      </div>

      <AuthSignupScreenFooter cta={cta} linkType="none" persistRole="owner" />
    </div>
  );
}
