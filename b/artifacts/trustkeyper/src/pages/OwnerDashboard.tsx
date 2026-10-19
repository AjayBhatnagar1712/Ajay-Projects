import React, { useEffect, useState } from "react";
import { ArrowRight, Check, Building2, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import OwnerLayout, { getOwnerName } from "@/components/OwnerLayout";
import { OwnerPropertyCard } from "@/components/owner/OwnerPropertyCard";
import { OwnerFlowButton } from "@/components/owner/OwnerFlowButton";
import { getProperties, getPropertyTitle, type Property } from "@/lib/properties";
import { PROPERTIES_UPDATED_EVENT } from "@/lib/propertyEditValidation";
import { getItem } from "@/lib/storageKeys";
import BrokerPendingFlowBanners from "@/components/BrokerPendingFlowBanners";
import { AgreementWaitingSignaturesPanel } from "@/components/agreements/AgreementWaitingSignaturesSection";

function filterOwnerProperties(all: Property[], ownerName: string): Property[] {
  const name = ownerName.replace("!", "").trim();
  return all.filter((p) => p.uploadedBy === "owner" || p.ownerName === name);
}

function formatActivityTime(createdAt: number): string {
  const d = new Date(createdAt);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function OwnerAddPropertySlot({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-lg border-2 border-dashed border-primary/25 overflow-hidden shadow-sm flex flex-col cursor-pointer hover:shadow-md hover:bg-primary/[0.04] transition-all text-left w-full"
    >
      <div className="relative h-48 bg-primary/[0.04] shrink-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm border border-primary/15 text-primary">
          <Plus size={26} strokeWidth={2.5} />
        </span>
      </div>
      <div className="p-3 sm:p-4 flex-1 flex flex-col items-center justify-center text-center min-h-[88px]">
        <p className="text-sm font-semibold text-primary">{label ?? "Add property"}</p>
      </div>
    </button>
  );
}

function getOwnerPendingPropertyDraft(): { title: string; href: string } | null {
  try {
    const raw = getItem("onboarding_data");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      subStep?: number;
      nickname?: string;
      address?: string;
      city?: string;
    };
    const subStep = typeof parsed.subStep === "number" ? parsed.subStep : 0;
    if (subStep >= 5) return null;
    const label = parsed.nickname || parsed.address || parsed.city || "your draft property";
    return {
      title: `You have an unfinished property listing for ${label}.`,
      href: "/owner/properties/add",
    };
  } catch {
    return null;
  }
}

export default function OwnerDashboard() {
  const [, setLocation] = useLocation();
  const ownerName = getOwnerName().replace("!", "").trim();
  const displayName = ownerName || "there";
  const [properties, setProperties] = useState<Property[]>([]);
  const [pendingDraft, setPendingDraft] = useState<ReturnType<typeof getOwnerPendingPropertyDraft>>(null);

  useEffect(() => {
    const refresh = () => {
      setProperties(filterOwnerProperties(getProperties(), ownerName));
      setPendingDraft(getOwnerPendingPropertyDraft());
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener(PROPERTIES_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(PROPERTIES_UPDATED_EVENT, refresh);
    };
  }, [ownerName]);

  const latestProperty = properties[0];
  const preview = properties.slice(0, 2);
  const showAddSlot = properties.length < 2;

  return (
    <OwnerLayout>
      <div className="p-6 sm:p-10 max-w-[1200px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <h1 className="text-[28px] font-semibold text-primary tracking-tight">
            Welcome, {displayName}!
          </h1>
          <OwnerFlowButton onClick={() => setLocation("/owner/properties/add")}>
            Add Property
          </OwnerFlowButton>
        </div>

        <BrokerPendingFlowBanners role="owner" className="mb-6" />

        <AgreementWaitingSignaturesPanel requesterRole="owner" className="mb-6" />

        {pendingDraft && (
          <section className="mb-8">
            <div className="flex items-center gap-3 sm:gap-4 rounded-[10px] px-4 py-3.5 sm:px-5 shadow-sm bg-[#FEF2E8] border border-[#FAD7C1]">
              <div className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm bg-white border border-[#FAD7C1]">
                <div className="relative w-7 h-7 rounded-full overflow-hidden flex items-center justify-center bg-white/90 ring-1 ring-orange-200/60">
                  <div className="absolute inset-y-0 left-0 w-1/2 bg-orange-400 opacity-85" aria-hidden />
                  <Building2 size={13} className="relative z-[1] text-orange-600" strokeWidth={2.25} />
                </div>
              </div>
              <p className="flex-1 min-w-0 text-sm font-medium leading-snug text-orange-950">
                {pendingDraft.title}
              </p>
              <Link
                href={pendingDraft.href}
                className="inline-flex items-center justify-center shrink-0 h-9 px-4 rounded-lg bg-white border border-primary text-primary text-sm font-semibold shadow-sm hover:bg-primary/5 transition-colors"
              >
                Continue
              </Link>
            </div>
          </section>
        )}

        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[18px] font-semibold text-gray-900">Your Properties</h2>
            <Link
              href="/owner/properties"
              className="text-[13px] font-semibold text-primary flex items-center gap-1 hover:underline"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.length === 0 ? (
              <OwnerAddPropertySlot
                onClick={() => setLocation("/owner/properties/add")}
                label="Add your first property"
              />
            ) : (
              <>
                {preview.map((property) => (
                  <OwnerPropertyCard
                    key={property.id}
                    property={property}
                    onClick={() => setLocation(`/owner/properties/${property.id}`)}
                  />
                ))}
                {showAddSlot && (
                  <OwnerAddPropertySlot onClick={() => setLocation("/owner/properties/add")} />
                )}
              </>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold text-gray-900 mb-6">Recent Activity</h2>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {latestProperty ? (
              <div className="px-6 sm:px-8 py-5 flex items-center gap-5 sm:gap-6 border-b border-gray-50">
                <span className="text-[13px] font-semibold text-gray-400 w-12 shrink-0 tabular-nums">
                  {formatActivityTime(latestProperty.createdAt)}
                </span>
                <div className="w-10 h-10 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
                  <Check size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-[15px]">
                    Your property is verified
                  </p>
                  <p className="text-[13px] text-gray-500 font-medium mt-0.5 truncate">
                    {latestProperty.nickname || getPropertyTitle(latestProperty)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-gray-500">
                Activity will appear here after you add a property.
              </div>
            )}
          </div>
        </section>
      </div>
    </OwnerLayout>
  );
}
