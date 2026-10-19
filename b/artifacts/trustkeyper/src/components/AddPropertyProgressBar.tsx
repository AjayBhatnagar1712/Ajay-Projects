import React from "react";
import { Check, Home, Wallet, ImageIcon } from "lucide-react";

/** Step progress for broker add-property flows (subStep 0–5). */
export function AddPropertyProgressBar({ subStep }: { subStep: number }) {
  const steps = [
    { label: "Property Details", Icon: Home },
    { label: "Rental Details", Icon: Wallet },
    { label: "Upload Image", Icon: ImageIcon },
  ];

  const majorStep = subStep <= 3 ? 0 : subStep === 4 ? 1 : 2;

  const lineFill = (i: number): number => {
    if (i === 0) {
      if (subStep >= 4) return 100;
      return (subStep / 4) * 100;
    }
    if (i === 1) return subStep >= 5 ? 100 : 0;
    return 0;
  };

  return (
    <div className="w-full overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1 scroll-smooth snap-x snap-mandatory [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300">
      <div className="flex items-start justify-center gap-0 mb-6 min-w-[min(100%,520px)] w-max mx-auto snap-center">
        {steps.map((s, i) => {
          const done = majorStep > i;
          const active = majorStep === i;
          const Icon = s.Icon;
          return (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center w-[88px] sm:w-32 shrink-0 snap-center">
                <Icon size={22} className={active || done ? "text-primary mb-1" : "text-gray-400 mb-1"} />
                <span
                  className={`text-[10px] sm:text-[11px] font-medium mb-2 text-center leading-tight px-0.5 ${
                    active || done ? "text-primary" : "text-gray-400"
                  }`}
                >
                  {s.label}
                </span>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    done || active
                      ? "bg-primary text-white"
                      : "bg-white border-2 border-gray-300 text-gray-400"
                  }`}
                >
                  {done ? <Check size={14} /> : i + 1}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 min-w-[24px] max-w-[48px] mt-12 mx-0.5 sm:mx-1 bg-gray-200 h-0.5 relative overflow-hidden rounded-full shrink">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary transition-all duration-500 ease-in-out"
                    style={{ width: `${lineFill(i)}%` }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
