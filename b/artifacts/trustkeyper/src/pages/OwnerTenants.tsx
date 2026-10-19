import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, MessageCircle, Send, Trash2, Users, Utensils } from "lucide-react";
import { FaLinkedin, FaWhatsapp } from "react-icons/fa";
import { Link } from "wouter";
import OwnerLayout, { getOwnerName } from "@/components/OwnerLayout";
import { InviteTenantsModal } from "@/components/owner/InviteTenantsModal";
import { OwnerPageEmpty } from "@/components/owner/OwnerPageEmpty";
import { PropertyInquiryRow } from "@/components/property/PropertyInquiryRow";
import { FlowSegmentTabs } from "@/components/FlowSegmentTabs";
import { OwnerFlowButton } from "@/components/owner/OwnerFlowButton";
import { pullAccountFromCloud } from "@/lib/cloudSync";
import { getProperties, type Property } from "@/lib/properties";
import { getActiveSession } from "@/lib/storageKeys";
import {
  countRecordedInvites,
  deleteOwnerInvite,
  formatMemberContact,
  getOwnerInvites,
  getPropertyShareInquiries,
  getRecordedInviteStatus,
  getWhatsAppInviteHref,
  isInviteFromInquiry,
  OWNER_INQUIRIES_UPDATED_EVENT,
  OWNER_INVITES_UPDATED_EVENT,
  updateOwnerInviteStatus,
  type OwnerTenantInquiry,
  type OwnerTenantInvite,
  type RecordedInviteStatus,
} from "@/lib/ownerTenants";
import {
  documentUploadStatusLabel,
  TENANT_DOCUMENT_STATUS_UPDATED_EVENT,
} from "@/lib/tenantDocumentUploadStatus";
import { fetchRequesterDocumentUploadDetail, fetchRequesterDocumentUploadInvites } from "@/lib/agreementDocumentUpload";
import { AGREEMENT_DOCUMENT_UPLOAD_UPDATED_EVENT } from "@/lib/agreementDocumentUploadStore";
import { TenantSubmittedDocumentsModal } from "@/components/agreement/TenantSubmittedDocumentsModal";
import type { DocumentUploadInviteForUi } from "@/lib/agreementDocumentUploadSanitize";

const TABS = [
  { id: "inquiries", label: "Inquiries" },
  { id: "invites", label: "Invites" },
  { id: "active", label: "Active Tenants" },
] as const;

type TenantTab = (typeof TABS)[number]["id"];

function filterOwnerProperties(all: Property[], ownerName: string): Property[] {
  const name = ownerName.replace("!", "").trim();
  return all.filter((p) => p.uploadedBy === "owner" || p.ownerName === name);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function OutcomeBadge({ status }: { status: RecordedInviteStatus }) {
  const label = status === "accepted" ? "Accepted" : "Rejected";
  const className =
    status === "accepted"
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${className}`}
    >
      {label}
    </span>
  );
}

function LinkedInProfileLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary border border-primary/40 bg-white px-2.5 py-0.5 rounded-full hover:bg-primary/5 transition-colors shrink-0"
    >
      <FaLinkedin className="w-3 h-3 shrink-0 text-primary" aria-hidden />
      View profile
    </a>
  );
}

function InvitedTenantRow({
  invite,
  onUpdate,
}: {
  invite: OwnerTenantInvite;
  onUpdate: () => void;
}) {
  const [viewInvite, setViewInvite] = useState<DocumentUploadInviteForUi | null>(null);
  const fromInquiry = isInviteFromInquiry(invite);
  const recorded = getRecordedInviteStatus(invite);
  const whatsAppUrl = getWhatsAppInviteHref(invite);

  const handleMark = (status: RecordedInviteStatus) => {
    updateOwnerInviteStatus(invite.id, status);
    onUpdate();
  };

  const handleDelete = () => {
    if (!window.confirm(`Remove ${invite.name} from your tenant invites?`)) return;
    deleteOwnerInvite(invite.id);
    onUpdate();
  };

  return (
    <div className="rounded-lg bg-[#F3FBF6] border border-green-100/80 p-4 flex flex-col gap-4 min-w-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
          {getInitials(invite.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-[15px] truncate">{invite.name}</p>
            {recorded ? <OutcomeBadge status={recorded} /> : null}
            {invite.documentUploadStatus ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-50 text-violet-700 border border-violet-100">
                {documentUploadStatusLabel(invite.documentUploadStatus)}
              </span>
            ) : null}
            {fromInquiry && invite.linkedinUrl ? (
              <LinkedInProfileLink url={invite.linkedinUrl} />
            ) : null}
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{formatMemberContact(invite.phone)}</p>
          <p className="text-xs text-gray-500 mt-1 leading-snug">{invite.propertyLabel}</p>
          {fromInquiry && (invite.who || invite.food) ? (
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap mt-1">
              {invite.who ? (
                <span className="inline-flex items-center gap-1">
                  <Users size={12} className="opacity-70 shrink-0" />
                  {invite.who}
                </span>
              ) : null}
              {invite.food ? (
                <span className="inline-flex items-center gap-1">
                  <Utensils size={12} className="opacity-70 shrink-0" />
                  {invite.food}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${invite.name}`}
          className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 hover:bg-[#20bd5a] transition-colors shadow-sm"
        >
          <FaWhatsapp className="w-5 h-5" aria-hidden />
        </a>
      </div>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 pt-1 border-t border-green-100/60">
        {invite.documentUploadToken &&
        (invite.documentUploadStatus === "documents_submitted" ||
          invite.documentUploadStatus === "documents_in_progress") ? (
          <button
            type="button"
            onClick={() => {
              void fetchRequesterDocumentUploadDetail(invite.documentUploadToken ?? "").then((detail) => {
                if (detail.ok) setViewInvite(detail.invite);
              });
            }}
            className="h-10 px-3 rounded-[4px] text-sm font-semibold border border-primary/40 text-primary bg-white hover:bg-primary/5 transition-colors col-span-2 sm:col-span-1"
          >
            View tenant documents
          </button>
        ) : null}
        <button
          type="button"
          disabled={recorded === "accepted"}
          onClick={() => handleMark("accepted")}
          className="h-10 px-3 rounded-[4px] text-sm font-semibold border border-green-600 text-green-700 bg-white hover:bg-green-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          Mark Accepted
        </button>
        <button
          type="button"
          disabled={recorded === "rejected"}
          onClick={() => handleMark("rejected")}
          className="h-10 px-3 rounded-[4px] text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          Mark Rejected
        </button>
        <button
          type="button"
          onClick={handleDelete}
          aria-label={`Delete ${invite.name}`}
          className="h-10 px-3 rounded-[4px] text-sm font-semibold border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors inline-flex items-center justify-center gap-1.5 col-span-2 sm:col-span-1 sm:flex-initial"
        >
          <Trash2 size={16} className="shrink-0" aria-hidden />
          Delete
        </button>
      </div>

      {viewInvite ? (
        <TenantSubmittedDocumentsModal invite={viewInvite} onClose={() => setViewInvite(null)} />
      ) : null}
    </div>
  );
}

function PropertyInvitesCard({
  propertyLabel,
  invites,
  onUpdate,
}: {
  propertyLabel: string;
  invites: OwnerTenantInvite[];
  onUpdate: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-5 min-w-0">
      <h3 className="font-semibold text-gray-900 text-[15px] leading-snug mb-3">
        {propertyLabel}
      </h3>
      <div className="flex flex-col gap-3">
        {invites.map((inv) => (
          <InvitedTenantRow key={inv.id} invite={inv} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  );
}

export default function OwnerTenants() {
  const ownerName = getOwnerName();
  const [activeTab, setActiveTab] = useState<TenantTab>("inquiries");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invites, setInvites] = useState<OwnerTenantInvite[]>([]);
  const [inquiries, setInquiries] = useState<OwnerTenantInquiry[]>([]);

  const ownerProperties = useMemo(() => {
    return filterOwnerProperties(getProperties(), ownerName);
  }, [ownerName]);

  const reload = useCallback(() => {
    setInvites(getOwnerInvites());
    setInquiries(getPropertyShareInquiries());
  }, []);

  const reloadFromCloud = useCallback(async () => {
    const session = getActiveSession();
    if (session?.role === "owner") {
      await pullAccountFromCloud(session.phone, "owner");
      await fetchRequesterDocumentUploadInvites();
    }
    reload();
  }, [reload]);

  useEffect(() => {
    void reloadFromCloud();
  }, [reloadFromCloud]);

  useEffect(() => {
    const refresh = () => void reloadFromCloud();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener(OWNER_INVITES_UPDATED_EVENT, refresh);
    window.addEventListener(OWNER_INQUIRIES_UPDATED_EVENT, refresh);
    window.addEventListener(TENANT_DOCUMENT_STATUS_UPDATED_EVENT, refresh);
    window.addEventListener(AGREEMENT_DOCUMENT_UPLOAD_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(OWNER_INVITES_UPDATED_EVENT, refresh);
      window.removeEventListener(OWNER_INQUIRIES_UPDATED_EVENT, refresh);
      window.removeEventListener(TENANT_DOCUMENT_STATUS_UPDATED_EVENT, refresh);
      window.removeEventListener(AGREEMENT_DOCUMENT_UPLOAD_UPDATED_EVENT, refresh);
    };
  }, [reloadFromCloud]);

  const invitesByProperty = useMemo(() => {
    const map = new Map<string, OwnerTenantInvite[]>();
    for (const inv of invites) {
      const list = map.get(inv.propertyLabel) ?? [];
      list.push(inv);
      map.set(inv.propertyLabel, list);
    }
    return map;
  }, [invites]);

  const { accepted } = useMemo(() => countRecordedInvites(invites), [invites]);

  const tabLabel = (id: TenantTab) => {
    if (id === "inquiries") return `Inquiries (${inquiries.length})`;
    if (id === "invites") return `Invites (${invites.length})`;
    return `Active Tenants (${accepted})`;
  };

  return (
    <OwnerLayout>
      <div className="p-4 sm:p-8 max-w-6xl mx-auto w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <Link
            href="/owner/dashboard"
            className="flex items-center gap-2 text-primary font-semibold text-lg hover:underline w-fit"
          >
            <ChevronLeft size={20} /> Back to Dashboard
          </Link>
          <OwnerFlowButton onClick={() => setInviteOpen(true)} className="w-full sm:w-fit">
            <Send size={16} />
            Invite Tenant
          </OwnerFlowButton>
        </div>

        <FlowSegmentTabs
          value={activeTab}
          onChange={(value) => setActiveTab(value as TenantTab)}
          className="mb-6"
          options={TABS.map((t) => ({ value: t.id, label: tabLabel(t.id) }))}
        />

        {activeTab === "inquiries" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Inquiries</h2>
            {inquiries.length > 0 ? (
              <div className="flex flex-col gap-3">
                {inquiries.map((inq) => (
                  <PropertyInquiryRow
                    key={inq.id}
                    inquiry={inq}
                    recipientRole="owner"
                    onUpdate={reload}
                  />
                ))}
              </div>
            ) : (
              <OwnerPageEmpty
                icon={MessageCircle}
                title="No inquiries yet"
                description="When tenants express interest via your shared property link, they will appear here."
              />
            )}
          </div>
        )}

        {activeTab === "invites" && (
          <div className="space-y-6">
            {invites.length > 0 ? (
              <section>
                <div className="flex flex-col gap-4">
                  {Array.from(invitesByProperty.entries()).map(([label, group]) => (
                    <PropertyInvitesCard
                      key={label}
                      propertyLabel={label}
                      invites={group}
                      onUpdate={reload}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <OwnerPageEmpty
                icon={Users}
                title="No tenants yet"
                description="Invite a tenant and send them the rental details on WhatsApp, then mark Accepted or Rejected when you hear back."
              />
            )}
          </div>
        )}

        {activeTab === "active" && (
          <OwnerPageEmpty
            icon={Users}
            title={accepted === 0 ? "No active tenants" : "Active tenants"}
            description={
              accepted === 0
                ? "Use Mark Accepted on an invite after the tenant confirms on WhatsApp."
                : `${accepted} tenant${accepted === 1 ? "" : "s"} marked as accepted.`
            }
          />
        )}
      </div>

      <InviteTenantsModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        properties={ownerProperties}
        onSuccess={reload}
      />
    </OwnerLayout>
  );
}
