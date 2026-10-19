import React, { useEffect, useMemo } from "react";
import { Copy, Share2, X } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import type { Property } from "@/lib/properties";
import { getPropertyTitle } from "@/lib/properties";
import { publishPropertyShare } from "@/lib/publicPropertyShare";
import {
  buildPropertyShareMessage,
  getPropertyShareUrl,
  getPropertyShareWhatsAppHref,
} from "@/lib/propertyShare";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

function bhkLabel(property: Property): string {
  const beds = property.bedrooms?.trim();
  const baths = property.bathrooms?.trim();
  if (beds && baths) return `${beds} BHK (${beds} Bed, ${baths} Bath)`;
  if (beds) return `${beds} BHK`;
  return property.unitSize || "—";
}

export function SharePropertyModal({
  property,
  open,
  onClose,
}: {
  property: Property;
  open: boolean;
  onClose: () => void;
}) {
  const shareText = useMemo(() => buildPropertyShareMessage(property), [property]);
  const shareUrl = useMemo(() => getPropertyShareUrl(property.id), [property.id]);
  const whatsAppHref = useMemo(() => getPropertyShareWhatsAppHref(property), [property]);

  useEffect(() => {
    if (!open) return;
    void publishPropertyShare(property);
  }, [open, property]);

  if (!open) return null;

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast({ title: "Copied", description: "Property details copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied", description: "Share link copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: getPropertyTitle(property),
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await copyShare();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
          aria-label="Close"
        >
          <X size={16} className="text-gray-600" />
        </button>
        <div className="p-6 pt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Share property</h3>
          <p className="text-sm text-gray-500 mb-4">
            Send a link with property details via WhatsApp or copy the link.
          </p>
          <div className="rounded-xl bg-[#F5F9FC] border border-[#E2EAF2] p-4 mb-4">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 font-medium">BHK</dt>
                <dd className="font-semibold text-gray-900 text-right">{bhkLabel(property)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 font-medium">Price</dt>
                <dd className="font-semibold text-gray-900 text-right">
                  {property.monthlyRent
                    ? `₹${Number(property.monthlyRent).toLocaleString("en-IN")}/mo`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 font-medium">Area</dt>
                <dd className="font-semibold text-gray-900 text-right">
                  {property.builtUpArea
                    ? `${property.builtUpArea} ${property.builtUpUnits || ""}`.trim()
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 break-all mb-4">
            {shareUrl}
          </div>
          <div className="flex flex-col gap-2">
            <a
              href={whatsAppHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-[4px] bg-[#25D366] text-white text-sm font-semibold hover:bg-[#20bd5a] transition-colors"
            >
              <FaWhatsapp className="w-5 h-5" aria-hidden />
              Share on WhatsApp
            </a>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" className="flex-1 gap-2 h-10 rounded-[4px]" onClick={() => void nativeShare()}>
                <Share2 size={16} /> Share
              </Button>
              <Button type="button" variant="outline" className="flex-1 gap-2 h-10 rounded-[4px]" onClick={() => void copyLink()}>
                <Copy size={16} /> Copy link
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
