import React from "react";
import { cn } from "@/lib/utils";
import houseDecor from "@assets/auth_corner_house_vector.png";

/** Bottom-right graphic from the TrustKeyper auth design (user-provided asset). */
export function AuthCornerDecor({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none select-none w-[min(92vw,360px)] h-[min(44vw,260px)] max-h-[48vh]",
        className,
      )}
      aria-hidden
    >
      <img
        src={houseDecor}
        alt=""
        className="h-full w-full object-contain object-bottom-right opacity-[0.62] contrast-110"
      />
    </div>
  );
}
