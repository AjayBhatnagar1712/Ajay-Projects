import { useCallback, useEffect, useState } from "react";
import { Check, Info, Loader2, Mail, Pencil, Send } from "lucide-react";
import { useLocation } from "wouter";
import type { AgreementAwaitingSignaturesView } from "@/lib/agreementAwaitingSignatures";
import {
  buildAgreementAwaitingSignaturesView,
  formatAgreementSentTimestamp,
  firstUnsignedTenantPhone,
  isAgreementAwaitingSignatures,
} from "@/lib/agreementAwaitingSignatures";
import { getAgreements, type Agreement } from "@/lib/agreements";
import { buildAgreementEditDraft } from "@/components/agreements/AgreementDocumentList";
import { fetchAgreementSigningStatus, type AgreementSigningStatus } from "@/lib/ownerAgreementSigning";
import { setSessionItem } from "@/lib/storageKeys";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface AgreementSigningDetailsModalProps {
  open: boolean;
  view: AgreementAwaitingSignaturesView | null;
  onClose: () => void;
  onSendReminder?: () => void;
  sendingReminder?: boolean;
}

export function AgreementSigningDetailsModal({
  open,
  view,
  onClose,
  onSendReminder,
  sendingReminder,
}: AgreementSigningDetailsModalProps) {
  if (!view) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md rounded-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                <Mail size={20} />
              </div>
              <DialogTitle className="text-lg font-semibold text-gray-900 leading-tight">
                {view.title}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 max-h-[min(60vh,420px)] overflow-y-auto">
          {view.groups.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.parties.map((party) => (
                  <div
                    key={party.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {party.contactDisplay}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 flex items-center justify-center w-8 h-8 rounded-full",
                        party.signed ? "text-green-600 bg-green-50" : "text-primary bg-primary/10",
                      )}
                      aria-label={party.signed ? "Signed" : "Awaiting signature"}
                    >
                      {party.signed ? (
                        <Check size={18} strokeWidth={2.5} />
                      ) : (
                        <Loader2 size={18} className="animate-spin" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {onSendReminder ? (
          <div className="px-6 pb-6 pt-2 border-t border-gray-100">
            <Button
              type="button"
              className="w-full h-11 rounded-xl font-semibold gap-2"
              onClick={onSendReminder}
              disabled={sendingReminder}
            >
              <Send size={16} />
              {sendingReminder ? "Sending…" : "Send Reminder"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export interface AgreementWaitingSignatureBannerProps {
  view: AgreementAwaitingSignaturesView;
  sentLabel: string;
  onViewDetails: () => void;
  onEditAgreement: () => void;
}

export function AgreementWaitingSignatureBanner({
  view,
  sentLabel,
  onViewDetails,
  onEditAgreement,
}: AgreementWaitingSignatureBannerProps) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-[#FFF4ED] p-4 sm:p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 mb-3">{sentLabel}</p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-500 flex items-center justify-center shrink-0">
            <Mail size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-orange-600 leading-tight">
              {view.title}
            </h3>
            <p className="text-sm text-gray-600 mt-1">{view.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onViewDetails}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-white border-2 border-orange-400 text-orange-600 text-sm font-semibold hover:bg-orange-50 transition-colors"
          >
            <Info size={16} />
            View Details
          </button>
          <button
            type="button"
            onClick={onEditAgreement}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-white border-2 border-primary/30 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors"
          >
            <Pencil size={16} />
            Edit Agreement
          </button>
        </div>
      </div>
    </div>
  );
}

const AGREEMENTS_UPDATED_EVENT = "tk-agreements-updated";

export function broadcastAgreementsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AGREEMENTS_UPDATED_EVENT));
}

interface PendingAgreementItem {
  agreement: Agreement;
  status: AgreementSigningStatus;
  view: AgreementAwaitingSignaturesView;
}

export function AgreementWaitingSignaturesPanel({
  requesterRole,
  className = "",
}: {
  requesterRole: "owner" | "broker";
  className?: string;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [items, setItems] = useState<PendingAgreementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<AgreementAwaitingSignaturesView | null>(null);
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<AgreementSigningStatus | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  const generatePath =
    requesterRole === "owner" ? "/owner/agreements/generate" : "/broker/agreements/generate";

  const refresh = useCallback(async () => {
    const sentAgreements = getAgreements().filter((row) => row.status === "Sent");
    if (sentAgreements.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const results = await Promise.all(
      sentAgreements.map(async (agreement) => {
        const status = await fetchAgreementSigningStatus(agreement.id);
        if (!isAgreementAwaitingSignatures(agreement, status)) return null;
        const view = buildAgreementAwaitingSignaturesView(agreement, status);
        if (!view) return null;
        return { agreement, status, view };
      }),
    );

    setItems(
      results
        .filter((row): row is PendingAgreementItem => row !== null)
        .sort((a, b) => b.view.sentAt - a.view.sentAt),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(AGREEMENTS_UPDATED_EVENT, onUpdate);
    window.addEventListener("storage", onUpdate);
    window.addEventListener("focus", onUpdate);
    const interval = window.setInterval(onUpdate, 15000);
    return () => {
      window.removeEventListener(AGREEMENTS_UPDATED_EVENT, onUpdate);
      window.removeEventListener("storage", onUpdate);
      window.removeEventListener("focus", onUpdate);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const handleEditAgreement = (agreement: Agreement) => {
    try {
      window.sessionStorage.setItem("agreement_needs_resend", agreement.id);
    } catch {
      /* ignore */
    }
    setSessionItem("agreement_edit_draft", JSON.stringify(buildAgreementEditDraft(agreement)));
    setLocation(generatePath);
  };

  const handleSendReminder = async () => {
    if (!selectedAgreement || !selectedStatus) return;
    const tenantPhone = firstUnsignedTenantPhone(selectedAgreement, selectedStatus);
    if (!tenantPhone) {
      toast({
        title: "No pending tenant",
        description: "All tenants have already signed this agreement.",
      });
      return;
    }

    setSendingReminder(true);
    try {
      const message = encodeURIComponent(
        `Reminder: please review and sign the rental agreement for ${selectedAgreement.propertyTitle} on TrustKeyper.`,
      );
      window.open(`https://wa.me/91${tenantPhone}?text=${message}`, "_blank", "noopener,noreferrer");
      toast({
        title: "Reminder opened",
        description: "Share the reminder with your tenant on WhatsApp.",
      });
    } finally {
      setSendingReminder(false);
    }
  };

  if (loading || items.length === 0) return null;

  return (
    <section className={`space-y-3 ${className}`}>
      {items.map(({ agreement, status, view }) => (
        <AgreementWaitingSignatureBanner
          key={agreement.id}
          view={view}
          sentLabel={formatAgreementSentTimestamp(view.sentAt)}
          onViewDetails={() => {
            setSelectedAgreement(agreement);
            setSelectedStatus(status);
            setSelectedView(view);
          }}
          onEditAgreement={() => handleEditAgreement(agreement)}
        />
      ))}

      <AgreementSigningDetailsModal
        open={selectedView !== null}
        view={selectedView}
        onClose={() => {
          setSelectedView(null);
          setSelectedAgreement(null);
          setSelectedStatus(null);
        }}
        onSendReminder={handleSendReminder}
        sendingReminder={sendingReminder}
      />
    </section>
  );
}
