import React from "react";
import { Button } from "@/components/ui/button";
import { AuthSignupScreenFooter } from "@/components/auth/AuthSignupScreenFooter";
import { AuthStepHeading } from "@/components/auth/AuthStepHeading";
import {
  authMobileScrollPadClass,
  authPrimaryButtonClass,
  authRoleCardSelectedClass,
  authRoleCardUnselectedClass,
} from "@/components/auth/authStyles";

interface OwnerStep1PropertiesProps {
  propertiesCount: string;
  setPropertiesCount: (count: string) => void;
  onNext: () => void;
}

export default function OwnerStep1Properties({
  propertiesCount,
  setPropertiesCount,
  onNext,
}: OwnerStep1PropertiesProps) {
  const options = ["01", "02-10", "10+"];

  const cta = (
    <Button size="lg" onClick={onNext} disabled={!propertiesCount} className={authPrimaryButtonClass}>
      Continue &rarr;
    </Button>
  );

  return (
    <div className={`flex flex-col h-full max-w-md w-full mx-auto lg:max-w-2xl lg:mx-0 ${authMobileScrollPadClass}`}>
      <AuthStepHeading title="How many properties do you own?" />

      <div className="flex flex-col gap-3 mb-6 lg:flex-row lg:flex-wrap lg:gap-4">
        {options.map((option) => {
          const isSelected = propertiesCount === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setPropertiesCount(option)}
              className={`w-full lg:flex-1 lg:min-w-[120px] py-4 px-6 text-center rounded-xl transition-all duration-200 ${
                isSelected ? authRoleCardSelectedClass : authRoleCardUnselectedClass
              } ${isSelected ? "text-gray-900" : "text-gray-600"}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      <AuthSignupScreenFooter cta={cta} showTerms={false} linkType="none" persistRole="owner" />
    </div>
  );
}
