import React, { useMemo } from "react";
import { Share2 } from "lucide-react";
import { FaCommentSms, FaTelegram, FaWhatsapp } from "react-icons/fa6";
import { SiGmail } from "react-icons/si";
import { toast } from "@/hooks/use-toast";
import { trackBrokerOnboardEvent } from "@/lib/brokerOnboardAnalytics";
import {
  copyBrokerOnboardLink,
  type BrokerOnboardShareContext,
} from "@/lib/brokerOnboardShareActions";
import {
  buildBrokerTenantOnboardShareMessage,
  getBrokerTenantOnboardEmailHref,
  getBrokerTenantOnboardSmsHref,
  getBrokerTenantOnboardTelegramHref,
  getBrokerTenantOnboardWhatsAppHref,
} from "@/lib/brokerTenantOnboarding";

type ShareChannel = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
};

export function BrokerOnboardShareChannelRow({
  tenantName,
  tenantPhone,
  link,
  token,
}: {
  tenantName: string;
  tenantPhone: string;
  link: string;
  token: string;
}) {
  const shareContext: BrokerOnboardShareContext = useMemo(
    () => ({ tenantPhone, token }),
    [tenantPhone, token],
  );

  const shareText = useMemo(
    () => buildBrokerTenantOnboardShareMessage(tenantName, link),
    [tenantName, link],
  );

  const shareHrefs = useMemo(
    () => ({
      whatsApp: getBrokerTenantOnboardWhatsAppHref(tenantPhone, tenantName, link),
      email: getBrokerTenantOnboardEmailHref(tenantName, link),
      sms: getBrokerTenantOnboardSmsHref(tenantPhone, tenantName, link),
      telegram: getBrokerTenantOnboardTelegramHref(tenantName, link),
    }),
    [tenantName, tenantPhone, link],
  );

  const handleNativeShare = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "TrustKeyper tenant onboarding",
          text: shareText,
          url: link,
        });
        trackBrokerOnboardEvent("native_share_used", shareContext);
        return;
      } catch {
        /* user cancelled */
      }
    }
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

  const channels: ShareChannel[] = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: <FaWhatsapp className="w-6 h-6 text-[#25D366]" aria-hidden />,
      onClick: () => {
        trackBrokerOnboardEvent("whatsapp_shared", shareContext);
        window.open(shareHrefs.whatsApp, "_blank", "noopener,noreferrer");
      },
    },
    {
      id: "telegram",
      label: "Telegram",
      icon: <FaTelegram className="w-6 h-6 text-[#229ED9]" aria-hidden />,
      onClick: () => {
        trackBrokerOnboardEvent("telegram_shared", shareContext);
        window.open(shareHrefs.telegram, "_blank", "noopener,noreferrer");
      },
    },
    {
      id: "sms",
      label: "SMS",
      icon: <FaCommentSms className="w-6 h-6 text-primary" aria-hidden />,
      onClick: () => {
        trackBrokerOnboardEvent("sms_shared", shareContext);
        window.location.href = shareHrefs.sms;
      },
    },
    {
      id: "email",
      label: "Email",
      icon: <SiGmail className="w-6 h-6 text-[#EA4335]" aria-hidden />,
      onClick: () => {
        trackBrokerOnboardEvent("email_shared", shareContext);
        window.location.href = shareHrefs.email;
      },
    },
    {
      id: "native",
      label: "Share",
      icon: <Share2 className="w-5 h-5 text-gray-600" aria-hidden />,
      onClick: () => void handleNativeShare(),
    },
  ];

  return (
    <div className="flex items-start justify-between gap-2 sm:gap-3">
      {channels.map((channel) => (
        <button
          key={channel.id}
          type="button"
          onClick={channel.onClick}
          className="flex flex-col items-center gap-2 min-w-0 flex-1 group"
        >
          <span className="w-12 h-12 rounded-full bg-[#F5F9FC] border border-[#E2EAF2] flex items-center justify-center transition-colors group-hover:bg-white group-hover:border-primary/20">
            {channel.icon}
          </span>
          <span className="text-xs text-gray-600 font-medium truncate w-full text-center">
            {channel.label}
          </span>
        </button>
      ))}
    </div>
  );
}
