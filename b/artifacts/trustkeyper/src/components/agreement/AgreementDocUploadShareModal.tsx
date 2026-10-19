import React from "react";
import { Copy, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { BrokerFlowButton } from "@/components/broker/BrokerFlowButton";
import { AgreementDocUploadShareChannelRow } from "@/components/agreement/AgreementDocUploadShareChannelRow";

export type AgreementDocUploadSharePayload = {
  tenantName: string;
  tenantPhone: string;
  link: string;
  token: string;
};

export function AgreementDocUploadShareModal({
  open,
  onClose,
  tenantName,
  tenantPhone,
  link,
}: AgreementDocUploadSharePayload & { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ description: "Link copied successfully" });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/40 p-4 z-50"
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
        aria-labelledby="agreement-doc-upload-share-title"
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
          <h3 id="agreement-doc-upload-share-title" className="text-lg font-semibold text-gray-900 mb-1 pr-8">
            Share Via
          </h3>
          <p className="text-sm text-gray-500 mb-5">
            Send the document upload link to {tenantName}.
          </p>
          <AgreementDocUploadShareChannelRow
            tenantName={tenantName}
            tenantPhone={tenantPhone}
            link={link}
          />
          <BrokerFlowButton
            type="button"
            flowVariant="outline"
            className="w-full mt-6"
            onClick={() => void handleCopyLink()}
          >
            <Copy size={16} /> Copy Link
          </BrokerFlowButton>
        </div>
      </div>
    </div>
  );
}
