import React from "react";
import { Copy, X } from "lucide-react";
import { BrokerOnboardShareChannelRow } from "@/components/broker/BrokerOnboardShareChannelRow";
import { BrokerFlowButton } from "@/components/broker/BrokerFlowButton";
import { toast } from "@/hooks/use-toast";
import {
  copyBrokerOnboardLink,
  type BrokerOnboardLinkPayload,
} from "@/lib/brokerOnboardShareActions";

export function BrokerOnboardShareModal({
  open,
  onClose,
  tenantName,
  tenantPhone,
  link,
  token,
  overlayClassName = "z-50",
  showCopyOption = true,
}: BrokerOnboardLinkPayload & {
  open: boolean;
  onClose: () => void;
  overlayClassName?: string;
  showCopyOption?: boolean;
}) {
  const shareContext = { tenantPhone, token };

  if (!open) return null;

  const handleCopyLink = async () => {
    const copied = await copyBrokerOnboardLink(link, shareContext);
    if (copied) {
      toast({ description: "Link copied successfully" });
      onClose();
      return;
    }
    toast({
      title: "Copy failed",
      description: "Could not copy to clipboard.",
      variant: "destructive",
    });
  };

  return (
    <div
      className={`fixed inset-0 flex items-end sm:items-center justify-center bg-black/40 p-4 ${overlayClassName}`}
      role="presentation"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md relative animate-in slide-in-from-bottom-4 fade-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="broker-onboard-share-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close share options"
        >
          <X size={18} />
        </button>
        <div className="p-6">
          <h3 id="broker-onboard-share-title" className="text-lg font-semibold text-gray-900 mb-1 pr-8">
            Share Via
          </h3>
          <p className="text-sm text-gray-500 mb-5">
            Choose how you want to send the onboarding link to {tenantName}.
          </p>
          <BrokerOnboardShareChannelRow
            tenantName={tenantName}
            tenantPhone={tenantPhone}
            link={link}
            token={token}
          />
          {showCopyOption ? (
            <BrokerFlowButton
              type="button"
              flowVariant="outline"
              className="w-full mt-6"
              onClick={() => void handleCopyLink()}
            >
              <Copy size={16} /> Copy Link
            </BrokerFlowButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
