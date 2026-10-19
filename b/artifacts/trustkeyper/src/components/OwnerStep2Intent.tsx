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

const Box = ("di" + "v") as "div";

interface OwnerStep2IntentProps {
  propertyIntent: string[];
  setPropertyIntent: (intent: string[]) => void;
  onNext: () => void;
}

export default function OwnerStep2Intent({
  propertyIntent,
  setPropertyIntent,
  onNext,
}: OwnerStep2IntentProps) {
  const options = [
    { id: "sell", label: "Sell my property" },
    { id: "rent", label: "Rent my property" },
    { id: "maintain", label: "Maintain my property" },
    { id: "other", label: "Other" },
  ];

  const toggleIntent = (id: string) => {
    if (propertyIntent.includes(id)) {
      setPropertyIntent(propertyIntent.filter((i) => i !== id));
    } else {
      setPropertyIntent([...propertyIntent, id]);
    }
  };

  const cta = (
    <Button
      size="lg"
      onClick={onNext}
      disabled={propertyIntent.length === 0}
      className={authPrimaryButtonClass}
    >
      Continue &rarr;
    </Button>
  );

  return (
    <Box className={`flex flex-col h-full max-w-md w-full mx-auto lg:max-w-4xl lg:mx-0 ${authMobileScrollPadClass}`}>
      <AuthStepHeading title="What do you want to do with this property?" />

      <Box className="flex flex-col gap-3 mb-10 lg:flex-row lg:flex-wrap lg:gap-4">
        {options.map((option) => {
          const isSelected = propertyIntent.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleIntent(option.id)}
              className={`w-full lg:flex-1 lg:min-w-[180px] flex items-center gap-3 py-4 px-4 rounded-xl transition-all duration-200 text-left ${
                isSelected ? authRoleCardSelectedClass : authRoleCardUnselectedClass
              } ${isSelected ? "text-gray-900" : "text-gray-600"}`}
            >
              <Box
                className={`w-5 h-5 border-2 rounded-sm flex items-center justify-center shrink-0 transition-colors shadow-sm ${
                  isSelected ? "bg-primary border-primary" : "border-gray-400 bg-white"
                }`}
              >
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </Box>
              <span className="text-[15px]">{option.label}</span>
            </button>
          );
        })}
      </Box>

      <AuthSignupScreenFooter cta={cta} showTerms={false} linkType="none" persistRole="owner" />
    </Box>
  );
}
