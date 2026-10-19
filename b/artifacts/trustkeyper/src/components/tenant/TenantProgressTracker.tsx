import { Check, FileText, Hourglass, Scale } from "lucide-react";
import type { TenantProgressStep } from "@/lib/tenantWorkspace";
import { cn } from "@/lib/utils";

const STEP_ICONS: Record<string, typeof FileText> = {
  documents: FileText,
  agreement: Scale,
  review: Hourglass,
};

export interface TenantProgressTrackerProps {
  steps: TenantProgressStep[];
}

export function TenantProgressTracker({ steps }: TenantProgressTrackerProps) {
  return (
    <div className="rounded-2xl border border-[#D9EAF8] bg-[#F3F9FE] px-4 py-5 sm:px-8 sm:py-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[step.id] ?? FileText;
          const isLast = index === steps.length - 1;
          return (
            <div key={step.id} className="flex items-start gap-0 sm:flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className={cn(
                    "w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 border",
                    step.state === "complete" && "bg-green-500 border-green-500 text-white",
                    step.state === "current" &&
                      step.id === "review" &&
                      "bg-white border-gray-200 text-gray-400",
                    step.state === "current" &&
                      step.id !== "review" &&
                      "bg-[#E8F4FC] border-primary text-primary",
                    step.state === "upcoming" && "bg-white border-gray-200 text-gray-400",
                  )}
                >
                  {step.state === "complete" ? (
                    <Check size={18} strokeWidth={2.5} />
                  ) : (
                    <Icon size={18} />
                  )}
                </div>
                <p
                  className={cn(
                    "text-xs sm:text-sm font-semibold text-center mt-2 leading-snug max-w-[120px]",
                    step.state === "current" && step.id === "review" && "text-gray-500",
                    step.state === "current" && step.id !== "review" && "text-primary",
                    step.state === "complete" && "text-gray-700",
                    step.state === "upcoming" && "text-gray-400",
                  )}
                >
                  {step.label}
                </p>
              </div>
              {!isLast ? (
                <div
                  className={cn(
                    "hidden sm:block h-0.5 flex-1 mt-5 mx-1 rounded-full min-w-[24px]",
                    step.state === "complete" ? "bg-primary/40" : "bg-gray-200",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
