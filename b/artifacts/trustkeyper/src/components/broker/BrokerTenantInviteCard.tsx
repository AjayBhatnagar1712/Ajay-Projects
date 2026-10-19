import React, { useState } from "react";
import { Copy, Eye, Send } from "lucide-react";
import { BrokerFlowButton } from "@/components/broker/BrokerFlowButton";
import { BrokerOnboardShareModal } from "@/components/broker/BrokerOnboardShareModal";
import { BrokerTenantInviteStatusBadge } from "@/components/broker/BrokerTenantInviteStatusBadge";
import { toast } from "@/hooks/use-toast";
import { copyBrokerOnboardLink } from "@/lib/brokerOnboardShareActions";
import {
  formatInviteDate,
  formatTenantPhoneDisplay,
  getBrokerTenantOnboardWhatsAppHref,
  getInviteResolvedStatus,
  type BrokerTenantOnboardingInvite,
} from "@/lib/brokerTenantOnboarding";

export function BrokerTenantInviteCard({
  invite,
}: {
  invite: BrokerTenantOnboardingInvite;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const status = getInviteResolvedStatus(invite);
  const link = invite.inviteLink;
  const shareContext = { tenantPhone: invite.tenantPhone, token: invite.token };

  const handleCopy = async () => {
    const copied = await copyBrokerOnboardLink(link, shareContext);
    if (copied) {
      toast({ description: "Invite link copied." });
      return;
    }
    toast({
      title: "Copy failed",
      description: "Could not copy to clipboard.",
      variant: "destructive",
    });
  };

  const handleResend = () => {
    if (status === "expired") {
      toast({
        title: "Link expired",
        description: "Generate a new onboarding link for this tenant.",
        variant: "destructive",
      });
      return;
    }
    const href = getBrokerTenantOnboardWhatsAppHref(
      invite.tenantPhone,
      invite.tenantName,
      link,
    );
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-semibold text-gray-900">{invite.tenantName}</p>
              <BrokerTenantInviteStatusBadge status={status} />
            </div>
            <p className="text-sm text-gray-500">{formatTenantPhoneDisplay(invite.tenantPhone)}</p>
            <p className="text-xs text-gray-400 mt-1">
              Invited {formatInviteDate(invite.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <BrokerFlowButton
            type="button"
            flowVariant="outline"
            className="text-xs h-9 px-3"
            onClick={() => setShareOpen(true)}
          >
            <Eye size={14} /> View Invite
          </BrokerFlowButton>
          <BrokerFlowButton
            type="button"
            flowVariant="outline"
            className="text-xs h-9 px-3"
            onClick={() => void handleCopy()}
          >
            <Copy size={14} /> Copy Link
          </BrokerFlowButton>
          <BrokerFlowButton
            type="button"
            flowVariant="outline"
            className="text-xs h-9 px-3"
            onClick={handleResend}
            disabled={status === "expired" || status === "converted"}
          >
            <Send size={14} /> Resend Invite
          </BrokerFlowButton>
        </div>
      </div>

      <BrokerOnboardShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        tenantName={invite.tenantName}
        tenantPhone={invite.tenantPhone}
        link={link}
        token={invite.token}
      />
    </>
  );
}
