import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  MessageCircle,
  Plus,
  User,
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
  Building2,
  Users as UsersIcon,
  Utensils,
  Pencil,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import BrokerLayout from "@/components/BrokerLayout";
import { FlowSegmentTabs } from "@/components/FlowSegmentTabs";
import { BrokerFlowButton } from "@/components/broker/BrokerFlowButton";
import { OwnerPageEmpty } from "@/components/owner/OwnerPageEmpty";
import { BrokerTenantInviteCard } from "@/components/broker/BrokerTenantInviteCard";
import { PropertyInquiryRow } from "@/components/property/PropertyInquiryRow";
import { pullAccountFromCloud } from "@/lib/cloudSync";
import {
  BROKER_ONBOARDING_INVITES_UPDATED_EVENT,
  getBrokerOnboardingInvitesForBroker,
  getInviteResolvedStatus,
  type BrokerTenantOnboardingInvite,
} from "@/lib/brokerTenantOnboarding";
import { isActiveInviteStatus } from "@/lib/brokerTenantInviteStatus";
import {
  formatMoveInDisplay,
  formatOccupancyDisplay,
  formatPropertyTypeDisplay,
} from "@/lib/tenantOnboardRequirements";
import {
  BROKER_INQUIRIES_UPDATED_EVENT,
  getBrokerPropertyShareInquiries,
  type OwnerTenantInquiry,
} from "@/lib/ownerTenants";
import { getActiveSession } from "@/lib/storageKeys";
import {
  getBrokerTenantWhatsAppHref,
  getTenants,
  timeAgo,
  type LeadStatus,
  type Tenant,
} from "@/lib/tenants";
import { documentUploadStatusLabel, TENANT_DOCUMENT_STATUS_UPDATED_EVENT } from "@/lib/tenantDocumentUploadStatus";
import {
  fetchRequesterDocumentUploadDetail,
  fetchRequesterDocumentUploadInvites,
} from "@/lib/agreementDocumentUpload";
import { AGREEMENT_DOCUMENT_UPLOAD_UPDATED_EVENT } from "@/lib/agreementDocumentUploadStore";
import { TenantSubmittedDocumentsModal } from "@/components/agreement/TenantSubmittedDocumentsModal";
import type { DocumentUploadInviteForUi } from "@/lib/agreementDocumentUploadSanitize";

const TABS = [
  { id: "invites", label: "Invites" },
  { id: "inquiries", label: "Inquiries" },
  { id: "all", label: "All Leads" },
  { id: "new", label: "New" },
] as const;

type BrokerTenantTab = (typeof TABS)[number]["id"];

function getInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? "?";
}

function formatDate(d?: string): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function leadStatusLabel(t: Tenant): LeadStatus {
  return t.leadStatus ?? "New Lead";
}

function TenantCard({ t, onEdit }: { t: Tenant; onEdit: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [viewInvite, setViewInvite] = useState<DocumentUploadInviteForUi | null>(null);
  const whatsAppUrl = getBrokerTenantWhatsAppHref(t);

  const summaryChips: { icon: React.ReactNode; label: string }[] = [];
  if (t.who)
    summaryChips.push({
      icon: <UsersIcon size={12} />,
      label: formatOccupancyDisplay(t.who, t.whoOther),
    });
  if (t.food) summaryChips.push({ icon: <Utensils size={12} />, label: t.food });
  if (t.occupancyFrom)
    summaryChips.push({
      icon: <Calendar size={12} />,
      label: formatMoveInDisplay(t.occupancyFrom),
    });
  if (t.localities?.length)
    summaryChips.push({
      icon: <MapPin size={12} />,
      label: `${t.city ?? ""} · ${t.localities.slice(0, 2).join(", ")}${
        t.localities.length > 2 ? ` +${t.localities.length - 2}` : ""
      }`,
    });
  if (t.propertyType)
    summaryChips.push({
      icon: <Building2 size={12} />,
      label: formatPropertyTypeDisplay(t.propertyType, t.propertyTypeOther),
    });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-primary flex items-center justify-center text-base font-semibold shrink-0">
            {getInitial(t.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900">{t.name}</p>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-primary text-xs font-medium">
                {leadStatusLabel(t)}
              </span>
              {t.detailsComplete ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Profile Complete
                </span>
              ) : null}
              {t.documentUploadStatus ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-medium">
                  {documentUploadStatusLabel(t.documentUploadStatus)}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-gray-500">{t.phone}</p>
            {t.documentUploadSubmittedAt ? (
              <p className="text-xs text-gray-500 mt-1">
                Documents submitted {formatDate(new Date(t.documentUploadSubmittedAt).toISOString())}
              </p>
            ) : null}
          </div>
        </div>
        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${t.name}`}
          className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 hover:bg-[#20bd5a] transition-colors shadow-sm"
        >
          <FaWhatsapp className="w-5 h-5" aria-hidden />
        </a>
      </div>

      {summaryChips.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 ml-14">
          {summaryChips.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs"
            >
              {c.icon} {c.label}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-4 ml-14 rounded-lg border border-gray-100 bg-gray-50/60 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <DetailRow label="Move-in timeline" value={formatMoveInDisplay(t.occupancyFrom)} />
          <DetailRow label="Budget" value="—" />
          {t.linkedinUrl ? <DetailRow label="LinkedIn" value={t.linkedinUrl} /> : null}
          <DetailRow label="Staying as" value={formatOccupancyDisplay(t.who, t.whoOther)} />
          {t.identify && t.identify.length > 0 && (
            <DetailRow label="Gender" value={t.identify.join(", ")} />
          )}
          <DetailRow label="Food preference" value={t.food ?? "—"} />
          {t.detailsComplete ? (
            <>
              <DetailRow label="City" value={t.city ?? "—"} />
              <DetailRow label="Localities" value={t.localities?.join(", ") ?? "—"} />
              <DetailRow
                label="Property type"
                value={formatPropertyTypeDisplay(t.propertyType, t.propertyTypeOther)}
              />
              <DetailRow label="Sharing" value={t.sharing ?? "—"} />
              {t.roommate && t.roommate.length > 0 && (
                <DetailRow label="Roommate preference" value={t.roommate.join(", ")} />
              )}
            </>
          ) : (
            <DetailRow label="Preferences" value="L2 details not added yet" />
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 flex-wrap gap-3">
        <p className="text-xs text-gray-500">
          {t.submittedAt
            ? `Submitted ${formatDate(new Date(t.submittedAt).toISOString())}`
            : `Added ${timeAgo(t.createdAt)}`}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {t.documentUploadToken &&
          (t.documentUploadStatus === "documents_submitted" ||
            t.documentUploadStatus === "documents_in_progress") ? (
            <BrokerFlowButton
              type="button"
              flowVariant="sm-outline"
              onClick={() => {
                void fetchRequesterDocumentUploadDetail(t.documentUploadToken ?? "").then((detail) => {
                  if (detail.ok) setViewInvite(detail.invite);
                });
              }}
            >
              View tenant documents
            </BrokerFlowButton>
          ) : null}
          <BrokerFlowButton
            type="button"
            flowVariant="sm-ghost"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? (
              <>
                Hide details <ChevronUp size={14} />
              </>
            ) : (
              <>
                View details <ChevronDown size={14} />
              </>
            )}
          </BrokerFlowButton>
          <BrokerFlowButton
            type="button"
            flowVariant="sm-outline"
            onClick={() => onEdit(t.id)}
          >
            <Pencil size={14} /> Edit details
          </BrokerFlowButton>
        </div>
      </div>

      {viewInvite ? (
        <TenantSubmittedDocumentsModal invite={viewInvite} onClose={() => setViewInvite(null)} />
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-gray-900">{value}</p>
    </div>
  );
}

export default function BrokerTenants() {
  const initialTab = (() => {
    if (typeof window === "undefined") return "invites" as BrokerTenantTab;
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "invites" || tab === "inquiries" || tab === "all" || tab === "new") {
      return tab;
    }
    return "invites";
  })();

  const [active, setActive] = useState<BrokerTenantTab>(initialTab);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [inquiries, setInquiries] = useState<OwnerTenantInquiry[]>([]);
  const [invites, setInvites] = useState<BrokerTenantOnboardingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  const reload = useCallback(() => {
    const session = getActiveSession();
    setTenants(getTenants());
    setInquiries(getBrokerPropertyShareInquiries());
    setInvites(
      session?.role === "broker"
        ? getBrokerOnboardingInvitesForBroker(session.phone).filter((inv) =>
            isActiveInviteStatus(getInviteResolvedStatus(inv)),
          )
        : [],
    );
  }, []);

  const reloadFromCloud = useCallback(async () => {
    setLoading(true);
    const session = getActiveSession();
    if (session?.role === "broker") {
      await pullAccountFromCloud(session.phone, "broker");
      await fetchRequesterDocumentUploadInvites();
    }
    reload();
    setLoading(false);
  }, [reload]);

  useEffect(() => {
    void reloadFromCloud();
  }, [reloadFromCloud]);

  useEffect(() => {
    const refresh = () => void reloadFromCloud();
    window.addEventListener("focus", refresh);
    window.addEventListener(BROKER_INQUIRIES_UPDATED_EVENT, refresh);
    window.addEventListener(BROKER_ONBOARDING_INVITES_UPDATED_EVENT, refresh);
    window.addEventListener(TENANT_DOCUMENT_STATUS_UPDATED_EVENT, refresh);
    window.addEventListener(AGREEMENT_DOCUMENT_UPLOAD_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(BROKER_INQUIRIES_UPDATED_EVENT, refresh);
      window.removeEventListener(BROKER_ONBOARDING_INVITES_UPDATED_EVENT, refresh);
      window.removeEventListener(TENANT_DOCUMENT_STATUS_UPDATED_EVENT, refresh);
      window.removeEventListener(AGREEMENT_DOCUMENT_UPLOAD_UPDATED_EVENT, refresh);
    };
  }, [reloadFromCloud]);

  const counts = {
    invites: invites.length,
    all: tenants.length,
    new: tenants.filter((t) => leadStatusLabel(t) === "New Lead").length,
    inquiries: inquiries.length,
  };

  const tabLabel = (id: BrokerTenantTab) => {
    if (id === "invites") return `Invites (${counts.invites})`;
    if (id === "inquiries") return `Inquiries (${counts.inquiries})`;
    if (id === "all") return `All Leads (${counts.all})`;
    return `New (${counts.new})`;
  };

  const visibleTenants = tenants.filter((t) => {
    if (active === "all") return true;
    if (active === "new") return leadStatusLabel(t) === "New Lead";
    return false;
  });

  return (
    <BrokerLayout>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Tenant Leads</h1>
        <BrokerFlowButton onClick={() => setLocation("/broker/tenants/add")} className="w-full sm:w-fit">
          <Plus size={16} /> Add Tenant
        </BrokerFlowButton>
      </div>

      <FlowSegmentTabs
        value={active}
        onChange={(value) => setActive(value as BrokerTenantTab)}
        className="mb-8"
        options={TABS.map((t) => ({ value: t.id, label: tabLabel(t.id) }))}
      />

      {active === "invites" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Tenant Invitations</h2>
          <p className="text-sm text-gray-500 -mt-2">
            Track onboarding links you have sent to prospective tenants.
          </p>
          {loading ? (
            <div className="space-y-3">
              {[0, 1].map((key) => (
                <div
                  key={key}
                  className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse"
                >
                  <div className="h-4 w-40 bg-gray-100 rounded mb-2" />
                  <div className="h-3 w-28 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : invites.length > 0 ? (
            <div className="flex flex-col gap-3">
              {invites.map((invite) => (
                <BrokerTenantInviteCard key={invite.id} invite={invite} />
              ))}
            </div>
          ) : (
            <OwnerPageEmpty
              icon={User}
              title="No tenant invitations have been sent yet."
              description="Generate an onboarding link when adding a tenant to start tracking invite status."
              action={
                <BrokerFlowButton onClick={() => setLocation("/broker/tenants/add")}>
                  <Plus size={16} /> Invite Tenant
                </BrokerFlowButton>
              }
            />
          )}
        </div>
      )}

      {active === "inquiries" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Property Inquiries</h2>
          <p className="text-sm text-gray-500 -mt-2">
            Tenants who expressed interest via your shared property links.
          </p>
          {inquiries.length > 0 ? (
            <div className="flex flex-col gap-3">
              {inquiries.map((inq) => (
                <PropertyInquiryRow
                  key={inq.id}
                  inquiry={inq}
                  recipientRole="broker"
                  onUpdate={reload}
                />
              ))}
            </div>
          ) : (
            <OwnerPageEmpty
              icon={MessageCircle}
              title="No inquiries yet"
              description="Share a property link via WhatsApp. When tenants express interest, they will appear here."
            />
          )}
        </div>
      )}

      {active !== "inquiries" && active !== "invites" && (
        <>
          {visibleTenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-gray-400 mb-4">
                <User size={28} />
              </div>
              <p className="text-gray-500 font-medium mb-1">No leads yet</p>
              <p className="text-sm text-gray-400">
                Start by onboarding tenants on TrustKeyper
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleTenants.map((t) => (
                <TenantCard
                  key={t.id}
                  t={t}
                  onEdit={(id) => setLocation(`/broker/tenants/add?edit=${id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </BrokerLayout>
  );
}
