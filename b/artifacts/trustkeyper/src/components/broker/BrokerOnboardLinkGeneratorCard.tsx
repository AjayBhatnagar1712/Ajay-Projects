import React, { useState } from "react";
import { Link2, User } from "lucide-react";
import { BrokerFlowButton } from "@/components/broker/BrokerFlowButton";
import { BrokerOnboardInviteModal } from "@/components/broker/BrokerOnboardInviteModal";
import type { BrokerOnboardLinkPayload } from "@/lib/brokerOnboardShareActions";

export function BrokerOnboardLinkGeneratorCard({
  onSuccess,
}: {
  onSuccess: (payload: BrokerOnboardLinkPayload) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Link2 size={22} aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Generate link</h2>
            <p className="text-sm text-gray-500">
              Send an onboarding link to the tenant — they&apos;ll fill in their rental requirements
              themselves.
            </p>
          </div>
          <BrokerFlowButton
            type="button"
            flowVariant="outline"
            className="w-full sm:w-fit shrink-0"
            onClick={() => setModalOpen(true)}
          >
            Generate Link
          </BrokerFlowButton>
        </div>
      </div>

      <BrokerOnboardInviteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={onSuccess}
      />
    </>
  );
}

export function AddManuallySectionHeader() {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
        <User size={18} aria-hidden />
      </div>
      <div>
        <h2 className="text-base font-semibold text-gray-900">Add manually</h2>
        <p className="text-sm text-gray-500">Enter tenant details yourself on TrustKeyper.</p>
      </div>
    </div>
  );
}
