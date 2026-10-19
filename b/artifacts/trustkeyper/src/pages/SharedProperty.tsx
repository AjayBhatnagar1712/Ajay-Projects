import React, { useCallback, useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Building2, Loader2 } from "lucide-react";
import { TrustKeyperLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { PropertyPublicCard, PropertyPublicCardSkeleton } from "@/components/tenant/PropertyPublicCard";
import { SharedPropertyLandingBackdrop } from "@/components/tenant/SharedPropertyLandingBackdrop";
import { TenantPropertyVerification } from "@/components/tenant/TenantPropertyVerification";
import { toast } from "@/hooks/use-toast";
import { getPropertyTitle, type Property } from "@/lib/properties";
import { createPropertyShareInquiry } from "@/lib/ownerTenants";
import {
  fetchSharedProperty,
  getPropertyShareLabel,
  submitPropertyShareInquiry,
  type SharedPropertyPayload,
} from "@/lib/publicPropertyShare";
import type { PropertyShareSource } from "@/lib/propertyShareView";
import {
  getTenantShareResponse,
  getTenantShareSession,
  setTenantShareResponse,
  type TenantShareSession,
} from "@/lib/tenantShareSession";

type PagePhase =
  | "loading"
  | "not_found"
  | "unavailable"
  | "verify"
  | "property"
  | "not_interested_thanks";

function isPropertyShareable(property: Property): boolean {
  return property.status === "Active";
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6">
      <Loader2 size={32} className="animate-spin text-primary mb-4" />
      <p className="text-sm text-gray-500">Loading property link…</p>
    </div>
  );
}

export default function SharedProperty() {
  const [, params] = useRoute("/share/property/:id");
  const propertyId = params?.id ?? "";

  const [phase, setPhase] = useState<PagePhase>("loading");
  const [sharePayload, setSharePayload] = useState<SharedPropertyPayload | null>(null);
  const [session, setSession] = useState<TenantShareSession | null>(null);
  const [response, setResponse] = useState<ReturnType<typeof getTenantShareResponse>>(null);
  const [ctaLoading, setCtaLoading] = useState(false);
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);

  const property = sharePayload?.property ?? null;
  const sharedBy: PropertyShareSource = sharePayload?.sharedBy ?? "owner";
  const maskOwnerDetails = sharePayload?.maskOwnerDetails ?? false;

  const bootstrap = useCallback(async () => {
    if (!propertyId) {
      setPhase("not_found");
      return;
    }

    setPhase("loading");
    const payload = await fetchSharedProperty(propertyId);

    if (!payload?.property) {
      setSharePayload(null);
      setPhase("not_found");
      return;
    }

    if (!isPropertyShareable(payload.property)) {
      setSharePayload(payload);
      setPhase("unavailable");
      return;
    }

    setSharePayload(payload);
    const savedSession = getTenantShareSession(propertyId);
    const savedResponse = getTenantShareResponse(propertyId);
    setSession(savedSession);
    setResponse(savedResponse);

    if (!savedSession) {
      setPhase("verify");
      return;
    }

    if (savedResponse === "not_interested") {
      setPhase("property");
      return;
    }

    setPhase("property");
  }, [propertyId]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const handleVerified = (verified: TenantShareSession) => {
    setCardLoading(true);
    setSession(verified);
    const savedResponse = getTenantShareResponse(propertyId);
    setResponse(savedResponse);
    window.setTimeout(() => {
      setCardLoading(false);
      setPhase("property");
    }, 400);
  };

  const handleInterested = async () => {
    if (!property || !session) return;
    setCtaError(null);
    setCtaLoading(true);
    try {
      const label = getPropertyShareLabel(property);
      const apiResult = await submitPropertyShareInquiry({
        propertyId: property.id,
        name: session.name,
        phone: session.phone,
        propertyLabel: label,
        sharedBy,
      });

      let isDuplicate = apiResult.isDuplicate;
      if (!apiResult.ok) {
        const local = createPropertyShareInquiry({
          name: session.name,
          phone: session.phone,
          propertyId: property.id,
          propertyLabel: label,
          sharedBy,
        });
        isDuplicate = local.isDuplicate;
      }

      setTenantShareResponse(property.id, "interested");
      setResponse("interested");
      toast({
        title: isDuplicate ? "Already submitted" : "Interest shared",
        description: isDuplicate
          ? "You have already expressed interest in this property."
          : "Your interest has been shared successfully.",
      });
    } catch {
      setCtaError("Something went wrong. Please check your connection and try again.");
    } finally {
      setCtaLoading(false);
    }
  };

  const handleNotInterested = () => {
    if (!property || !session) return;
    setCtaError(null);
    setCtaLoading(true);
    try {
      setTenantShareResponse(property.id, "not_interested");
      setResponse("not_interested");
      setPhase("not_interested_thanks");
    } catch {
      setCtaError("Something went wrong. Please try again.");
    } finally {
      setCtaLoading(false);
    }
  };

  const pageShell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-center px-4 sticky top-0 z-10">
        <TrustKeyperLogo variant="brand" size="header" />
      </header>
      <main className="max-w-lg mx-auto p-4 pb-8">{children}</main>
    </div>
  );

  if (phase === "loading") {
    return <LoadingScreen />;
  }

  if (phase === "not_found") {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6 text-center">
        <Building2 size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium">Property not found</p>
        <p className="text-sm text-gray-400 mt-1 max-w-sm">
          This link may be invalid, expired, or the property may have been removed.
        </p>
      </div>
    );
  }

  if (phase === "unavailable") {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6 text-center">
        <Building2 size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium">This property is no longer available</p>
        <p className="text-sm text-gray-400 mt-1 max-w-sm">
          {property ? getPropertyTitle(property) : "The listing"} may have been rented or is no longer
          accepting inquiries.
        </p>
      </div>
    );
  }

  if (phase === "verify" && property) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 blur-md scale-[1.02] pointer-events-none select-none" aria-hidden>
          <SharedPropertyLandingBackdrop />
        </div>
        <div className="absolute inset-0 bg-black/45 pointer-events-none" aria-hidden />
        <TenantPropertyVerification
          propertyId={property.id}
          onVerified={handleVerified}
          onCancel={() => window.history.back()}
        />
      </div>
    );
  }

  return (
    <>
      {(phase === "property" || phase === "not_interested_thanks") && property && session
        ? pageShell(
            <>
              {ctaError ? (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {ctaError}
                </div>
              ) : null}
              {cardLoading ? (
                <PropertyPublicCardSkeleton />
              ) : (
                <PropertyPublicCard
                  property={property}
                  maskOwnerDetails={maskOwnerDetails}
                  response={response}
                  ctaLoading={ctaLoading}
                  onInterested={() => void handleInterested()}
                  onNotInterested={handleNotInterested}
                />
              )}
              <p className="text-center text-xs text-gray-400 mt-6">Shared via TrustKeyper</p>
            </>,
          )
        : null}

      {phase === "not_interested_thanks" && !ctaLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <p className="text-lg font-semibold text-gray-900 mb-2">Thank you for your response.</p>
            <p className="text-sm text-gray-500 mb-6">We&apos;ve recorded your preference.</p>
            <Button
              type="button"
              className="w-full h-11 rounded-[4px] font-semibold"
              onClick={() => setPhase("property")}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
