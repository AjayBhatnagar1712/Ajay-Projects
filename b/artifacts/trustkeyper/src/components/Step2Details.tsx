import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthSignupScreenFooter } from "@/components/auth/AuthSignupScreenFooter";
import { authMobileScrollPadClass, authPrimaryButtonClass } from "@/components/auth/authStyles";
import { ALL_ROLES, profileExistsAsync, type Role } from "@/lib/auth";

const Box = ("di" + "v") as "div";

interface Step2DetailsProps {
  details: { name: string; phone: string };
  setDetails: (details: { name: string; phone: string }) => void;
  onNext: () => void;
}

export default function Step2Details({ details, setDetails, onNext }: Step2DetailsProps) {
  const phoneDigits = details.phone.replace(/\D/g, "").slice(0, 10);
  const pending = sessionStorage.getItem("tk_pending_role");
  const signupRole = (pending && ALL_ROLES.includes(pending as Role) ? pending : "") as Role | "";
  const [duplicatePhone, setDuplicatePhone] = useState(false);

  useEffect(() => {
    if (signupRole === "" || phoneDigits.length !== 10) {
      setDuplicatePhone(false);
      return;
    }
    let cancelled = false;
    void profileExistsAsync(phoneDigits, signupRole).then((exists) => {
      if (!cancelled) setDuplicatePhone(exists);
    });
    return () => {
      cancelled = true;
    };
  }, [phoneDigits, signupRole]);

  const isComplete =
    details.name.trim().length > 0 &&
    phoneDigits.length === 10 &&
    signupRole !== "" &&
    !duplicatePhone;

  const persistRole = signupRole || undefined;

  const cta = (
    <Button size="lg" onClick={onNext} disabled={!isComplete} className={authPrimaryButtonClass}>
      Request OTP &rarr;
    </Button>
  );

  return (
    <Box className={`flex flex-col h-full max-w-md ${authMobileScrollPadClass}`}>
      <Box className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Lets know you better</h1>
      </Box>

      <Box className="space-y-6">
        <Box className="space-y-2">
          <Label htmlFor="name" className="text-gray-700">
            Your Name
          </Label>
          <Input
            id="name"
            placeholder="Type here"
            value={details.name}
            onChange={(e) => setDetails({ ...details, name: e.target.value })}
            className="bg-white"
          />
        </Box>
        <Box className="space-y-2">
          <Label htmlFor="phone" className="text-gray-700">
            Phone Number
          </Label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit number"
            value={phoneDigits}
            onChange={(e) =>
              setDetails({
                ...details,
                phone: e.target.value.replace(/\D/g, "").slice(0, 10),
              })
            }
            className="bg-white"
          />
          {duplicatePhone ? (
            <p className="text-sm text-destructive">An account already exists for this number.</p>
          ) : null}
        </Box>
      </Box>

      <AuthSignupScreenFooter cta={cta} persistRole={persistRole} />
    </Box>
  );
}
