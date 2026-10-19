import React, { useEffect } from "react";
import { CheckCircle2, Copy, X } from "lucide-react";
import { BrokerFlowButton } from "@/components/broker/BrokerFlowButton";
import { BrokerOnboardShareChannelRow } from "@/components/broker/BrokerOnboardShareChannelRow";
import { toast } from "@/hooks/use-toast";
import { trackBrokerOnboardEvent } from "@/lib/brokerOnboardAnalytics";
import {
  copyBrokerOnboardLink,
  type BrokerOnboardLinkPayload,
} from "@/lib/brokerOnboardShareActions";

export function BrokerOnboardInvitationCreatedModal({
  open,
  tenantName,
  tenantPhone,
  link,
  token,
  onClose,
}: BrokerOnboardLinkPayload & {
  open: boolean;
  onClose: () => void;
}) {
  const shareContext = { tenantPhone, token };

  useEffect(() => {
    if (!open) return;
    trackBrokerOnboardEvent("link_generated", { tenantPhone, token });
  }, [open, tenantPhone, token]);

  const handleCopyLink = async () => {
    const copied = await copyBrokerOnboardLink(link, shareContext);
    if (copied) {
      toast({ description: "Link copied successfully" });
      return;
    }
    toast({
      title: "Copy failed",
      description: "Could not copy to clipboard.",
      variant: "destructive",
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="broker-invitation-created-title"
        className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 p-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="pr-8 mb-5">
          <h2
            id="broker-invitation-created-title"
            className="text-lg font-semibold text-gray-900 mb-2"
          >
            Invitation Created
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            The onboarding link has been generated successfully. Tenant can use this link to share
            their rental requirements.
          </p>
        </div>

        <div className="mb-5">
          <p className="text-sm text-gray-500 mb-4">Share this link via</p>
          <BrokerOnboardShareChannelRow
            tenantName={tenantName}
            tenantPhone={tenantPhone}
            link={link}
            token={token}
          />
        </div>

        <div className="mb-6">
          <p className="text-xs font-medium text-gray-500 mb-1.5">Page link</p>
          <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
            <p className="flex-1 min-w-0 px-3 py-2.5 text-xs text-gray-600 truncate">{link}</p>
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="shrink-0 h-full px-3 py-2.5 border-l border-gray-200 text-gray-500 hover:text-primary hover:bg-[#F5F9FC] transition-colors"
              aria-label="Copy link"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>

        <BrokerFlowButton type="button" className="w-full" onClick={onClose}>
          <CheckCircle2 size={16} /> Done
        </BrokerFlowButton>
      </div>
    </div>
  );
}
