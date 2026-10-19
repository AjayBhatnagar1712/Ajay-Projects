import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { Building2, FileSignature, Users } from "lucide-react";
import {
  BROKER_PENDING_FLOWS_EVENT,
  getPendingFlowItems,
  type PendingFlowItem,
  type PendingFlowKind,
} from "@/lib/brokerPendingFlows";

/** Single orange treatment for every pending-flow type (property, tenant, agreement). */
const ORANGE_BANNER = {
  panel: "bg-[#FEF2E8] border border-[#FAD7C1]",
  iconWrap: "bg-white border border-[#FAD7C1]",
  iconColor: "text-orange-600",
  halfFill: "bg-orange-400",
} as const;

function PendingIcon({ kind }: { kind: PendingFlowKind }) {
  const Icon = kind === "add_property" ? Building2 : kind === "add_tenant" ? Users : FileSignature;
  return (
    <div className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${ORANGE_BANNER.iconWrap}`}>
      <div className="relative w-7 h-7 rounded-full overflow-hidden flex items-center justify-center bg-white/90 ring-1 ring-orange-200/60">
        <div className={`absolute inset-y-0 left-0 w-1/2 ${ORANGE_BANNER.halfFill} opacity-85`} aria-hidden />
        <Icon size={13} className={`relative z-[1] ${ORANGE_BANNER.iconColor}`} strokeWidth={2.25} />
      </div>
    </div>
  );
}

function PendingRow({ item }: { item: PendingFlowItem }) {
  return (
    <div
      className={`flex items-center gap-3 sm:gap-4 rounded-[10px] px-4 py-3.5 sm:px-5 shadow-sm ${ORANGE_BANNER.panel}`}
      role="status"
    >
      <PendingIcon kind={item.kind} />
      <p className="flex-1 min-w-0 text-sm font-medium leading-snug text-orange-950">
        {item.title}
      </p>
      <Link
        href={item.continueHref}
        className="inline-flex items-center justify-center shrink-0 h-9 px-4 rounded-lg bg-white border border-primary text-primary text-sm font-semibold shadow-sm hover:bg-primary/5 transition-colors"
      >
        Continue
      </Link>
    </div>
  );
}

export default function BrokerPendingFlowBanners({
  className = "",
  role = "broker",
}: {
  className?: string;
  role?: "broker" | "owner";
}) {
  const [items, setItems] = useState<PendingFlowItem[]>(() =>
    typeof window !== "undefined" ? getPendingFlowItems(role) : [],
  );

  useEffect(() => {
    const sync = () => setItems(getPendingFlowItems(role));
    sync();
    window.addEventListener(BROKER_PENDING_FLOWS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BROKER_PENDING_FLOWS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [role]);

  if (items.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item) => (
        <PendingRow key={item.kind} item={item} />
      ))}
    </div>
  );
}
