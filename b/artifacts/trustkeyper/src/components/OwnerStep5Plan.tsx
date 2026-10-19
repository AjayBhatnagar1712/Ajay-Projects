import React from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { AuthStepHeading } from "@/components/auth/AuthStepHeading";
import { authMobileScrollPadClass } from "@/components/auth/authStyles";

interface OwnerStep5PlanProps {
  onSelectPlan: (plan: "diy" | "managed") => void;
}

export default function OwnerStep5Plan({ onSelectPlan }: OwnerStep5PlanProps) {
  return (
    <div className={`flex flex-col h-full max-w-md w-full mx-auto lg:max-w-4xl lg:mx-0 ${authMobileScrollPadClass}`}>
      <AuthStepHeading title="How would you like to set up your account?" />

      <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-0 mt-4 relative pb-10">
        
        {/* Do it Yourself Card */}
        <div className="w-full md:w-[400px] bg-[#E8F5EE] rounded-xl p-8 md:pr-16 md:mr-[-20px] relative z-0 flex flex-col items-center">
          <h2 className="text-2xl font-medium text-gray-700 mb-2">Do it Yourself</h2>
          <p className="text-sm font-semibold text-gray-600 mb-8 text-center">Fill your details online, manage showings</p>
          
          <ul className="space-y-4 mb-10 text-sm font-semibold text-gray-600 w-full max-w-[250px]">
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-gray-200/60 flex items-center justify-center shrink-0">
                <Check size={12} className="text-gray-500" />
              </div>
              Fill property details form
            </li>
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-gray-200/60 flex items-center justify-center shrink-0">
                <Check size={12} className="text-gray-500" />
              </div>
              Upload photos yourself
            </li>
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-gray-200/60 flex items-center justify-center shrink-0">
                <Check size={12} className="text-gray-500" />
              </div>
              Find your suitable tenant
            </li>
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-gray-200/60 flex items-center justify-center shrink-0">
                <Check size={12} className="text-gray-500" />
              </div>
              Manage tenant communication
            </li>
          </ul>

          <Button 
            className="w-32 bg-primary hover:bg-primary/90 rounded-md shadow-sm"
            onClick={() => onSelectPlan("diy")}
          >
            Choose plan
          </Button>
        </div>

        {/* End-to-End Managed Card */}
        <div className="w-full md:w-[420px] bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-8 relative z-10 flex flex-col items-center border border-gray-100 py-10">
          <div className="absolute top-6">
            <span className="text-[10px] font-semibold text-primary border border-primary/30 rounded-full px-4 py-1 uppercase tracking-wider bg-blue-50/50">
              Most Popular
            </span>
          </div>
          <h2 className="text-2xl font-medium text-gray-700 mt-8 mb-2">End-to-End Managed</h2>
          <p className="text-sm font-semibold text-gray-600 mb-8 text-center">Sit back while we handle it all!</p>
          
          <ul className="space-y-4 mb-10 text-sm font-semibold text-gray-600 w-full max-w-[250px]">
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Check size={12} className="text-gray-500" />
              </div>
              Fill all forms for you
            </li>
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Check size={12} className="text-gray-500" />
              </div>
              Professional photography
            </li>
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Check size={12} className="text-gray-500" />
              </div>
              Show property to tenants
            </li>
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Check size={12} className="text-gray-500" />
              </div>
              Maintain your property
            </li>
          </ul>

          <Button 
            className="w-32 bg-primary hover:bg-primary/90 rounded-md shadow-sm"
            onClick={() => onSelectPlan("managed")}
          >
            Choose plan
          </Button>
        </div>

      </div>
    </div>
  );
}
