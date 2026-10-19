import React from "react";
import { useLocation } from "wouter";
import {
  Plus, UserPlus, FilePlus2, Check,
  IndianRupee, Building2, Users, ChevronRight,
  Clock, FileCheck2, ArrowUpRight,
} from "lucide-react";
import BrokerLayout, { getBrokerName } from "@/components/BrokerLayout";
import { BrokerDashboardHeaderActions, WelcomeEducationCarousel } from "@/components/broker";
import { BrokerFlowButton } from "@/components/broker/BrokerFlowButton";
import BrokerPendingFlowBanners from "@/components/BrokerPendingFlowBanners";
import { AgreementWaitingSignaturesPanel } from "@/components/agreements/AgreementWaitingSignaturesSection";
import { getProperties, getPropertyTitle } from "@/lib/properties";
import { getTenants, timeAgo } from "@/lib/tenants";
import { getAgreements } from "@/lib/agreements";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

function fmtINR(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

// ─── Welcome Dashboard (empty state) ──────────────────────────────────────────

function WelcomeDashboard({
  brokerName,
  onGenerateAgreement,
  onAddProperty,
  onAddTenant,
}: {
  brokerName: string;
  onGenerateAgreement: () => void;
  onAddProperty: () => void;
  onAddTenant: () => void;
}) {
  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <BrokerPendingFlowBanners className="mb-2" />
      <AgreementWaitingSignaturesPanel requesterRole="broker" className="mb-2" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
            Welcome, {brokerName} <span className="inline-block animate-wave">👋</span>
          </h1>
        </div>
        <BrokerDashboardHeaderActions
          onGenerateAgreement={onGenerateAgreement}
          onAddProperty={onAddProperty}
          onAddTenant={onAddTenant}
        />
      </div>

      <WelcomeEducationCarousel
        onGenerateAgreement={onGenerateAgreement}
        onAddProperty={onAddProperty}
        onAddTenant={onAddTenant}
      />

      <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
          <img
            src="/agreement-bg.png"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-[0.04] pointer-events-none select-none group-hover:opacity-[0.08] transition-opacity"
          />
          <div className="relative z-10 flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6 ring-8 ring-primary/5">
              <FilePlus2 size={24} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3 tracking-tight">Generate Rental Agreement</h3>
            <p className="text-gray-500 mb-8 leading-relaxed flex-grow">Generate rental agreements, collect documents, and complete digital signing, all in one place with TrustKeyper.</p>
            <button
              onClick={onGenerateAgreement}
              className="inline-flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all mt-auto w-fit"
            >
              <FilePlus2 size={16} /> Generate Agreement
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md transition-shadow group flex flex-col">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 mb-6 group-hover:bg-primary/10 group-hover:text-primary transition-colors ring-8 ring-gray-50 group-hover:ring-primary/5">
            <Plus size={24} />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3 tracking-tight">Add Your First Property</h3>
          <p className="text-gray-500 mb-8 leading-relaxed flex-grow">List and manage your property details to start renting seamlessly through TrustKeyper.</p>
          <button onClick={onAddProperty} className="inline-flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all mt-auto w-fit">
            <Plus size={16} /> Add Property
          </button>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md transition-shadow group flex flex-col">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 mb-6 group-hover:bg-accent/10 group-hover:text-accent transition-colors ring-8 ring-gray-50 group-hover:ring-accent/5">
            <UserPlus size={24} />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3 tracking-tight">Add Potential Tenants</h3>
          <p className="text-gray-500 mb-8 leading-relaxed flex-grow">Add tenant details, send invitations, and manage the rental process digitally through TrustKeyper.</p>
          <button onClick={onAddTenant} className="inline-flex items-center gap-2 text-accent font-semibold hover:gap-3 transition-all mt-auto w-fit">
            <UserPlus size={16} /> Add Tenant
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-6 tracking-tight">Recent Activity</h2>
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="flex items-center gap-5 px-6 py-4 hover:bg-gray-50 transition-colors">
            <span className="text-sm text-gray-400 font-mono w-14 shrink-0">22:40</span>
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
              <Check size={18} />
            </div>
            <span className="text-base font-medium text-gray-900">Your Profile has been created</span>
          </div>
          <div className="bg-gray-50 border-t border-gray-100 px-6 py-4">
            <button className="w-full text-center text-sm text-primary font-semibold hover:text-primary/80 transition-colors">View All Activity</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Deal Card ─────────────────────────────────────────────────────────────────

type DealCard = {
  id: string;
  propertyTitle: string;
  tenantName: string;
  monthlyRent: string;
  brokerageAmount: string;
  brokeragePaidBy: string;
  createdAt: number;
  stage: "lead" | "agreement" | "completed";
};

const STAGE_CFG = {
  lead: { label: "Lead", border: "border-l-primary", chip: "bg-blue-50 text-primary border-primary/20", dot: "bg-primary" },
  agreement: { label: "Agreement", border: "border-l-amber-500", chip: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  completed: { label: "Completed", border: "border-l-green-500", chip: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
} as const;

function DealCardItem({ card, onClick }: { card: DealCard; onClick?: () => void }) {
  const cfg = STAGE_CFG[card.stage];
  const initials = card.tenantName
    ? card.tenantName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "??";

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200 border-l-4 ${cfg.border} shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 p-5 cursor-pointer group`}
    >
      {/* Stage chip + arrow */}
      <div className="flex items-center justify-between mb-4">
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border ${cfg.chip} uppercase tracking-wider`}>{cfg.label}</span>
        <ArrowUpRight size={16} className="text-gray-300 group-hover:text-primary transition-colors" />
      </div>

      {/* Property */}
      <p className="text-base font-semibold text-gray-900 mb-2 truncate leading-tight">{card.propertyTitle || "—"}</p>

      {/* Tenant */}
      <div className="flex items-center gap-3 mb-5 bg-gray-50 rounded-lg p-2.5">
        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
          {initials}
        </div>
        <p className="text-sm text-gray-600 font-medium truncate">{card.tenantName ? `Tenant: ${card.tenantName}` : "Tenant TBD"}</p>
      </div>

      <div className="border-t border-gray-100 mb-4" />

      {/* Rent + Brokerage */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Monthly Rent</span>
          <p className="text-sm font-medium text-gray-700">{card.monthlyRent ? `${fmtINR(Number(card.monthlyRent))}` : "TBD"}</p>
        </div>
        {card.brokerageAmount && Number(card.brokerageAmount) > 0 && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-primary/60 font-semibold uppercase tracking-wider mb-0.5">Brokerage</span>
            <p className="text-sm font-semibold text-primary">{fmtINR(Number(card.brokerageAmount))}</p>
          </div>
        )}
      </div>

      {/* Time + Paid by */}
      <div className="flex items-end justify-between mt-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded-md">
          <Clock size={12} /> {timeAgo(card.createdAt)}
        </div>
        {card.brokeragePaidBy && (
          <div className="text-right">
            <p className="text-[10px] text-gray-400 font-medium leading-tight mb-0.5">Paid by</p>
            <p className="text-xs font-semibold text-gray-700">{card.brokeragePaidBy}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Active Dashboard ──────────────────────────────────────────────────────────

function ActiveDashboard({
  brokerName,
  onGenerateAgreement,
  onAddProperty,
  onAddTenant,
  onViewDeals,
  onViewDocuments,
  onViewActivity,
}: {
  brokerName: string;
  onGenerateAgreement: () => void;
  onAddProperty: () => void;
  onAddTenant: () => void;
  onViewDeals: () => void;
  onViewDocuments: () => void;
  onViewActivity: () => void;
}) {
  const properties = getProperties();
  const tenants = getTenants();
  const agreements = getAgreements();

  // Stats — earnings only count once the agreement is fully signed
  const totalEarned = agreements
    .filter((a) => a.status === "Signed")
    .reduce((s, a) => s + (Number(a.brokerageAmount) || 0), 0);
  const activePropertyCount = properties.filter((p) => p.status === "Active").length;
  const leadsInPipeline = tenants.length;

  // Pipeline cards
  const leadCards: DealCard[] = tenants.map((t) => ({
    id: t.id,
    propertyTitle: t.city ? `Looking in ${t.city}${t.localities?.length ? ` — ${t.localities[0]}` : ""}` : "Property search in progress",
    tenantName: t.name,
    monthlyRent: "",
    brokerageAmount: "",
    brokeragePaidBy: "",
    createdAt: t.createdAt,
    stage: "lead",
  }));

  const agreementCards: DealCard[] = agreements
    .filter((a) => a.status === "Sent")
    .map((a) => ({
      id: a.id,
      propertyTitle: a.propertyTitle,
      tenantName: a.tenantName,
      monthlyRent: a.monthlyRent,
      brokerageAmount: a.brokerageAmount,
      brokeragePaidBy: a.brokeragePaidBy,
      createdAt: a.createdAt,
      stage: "agreement",
    }));

  const completedCards: DealCard[] = agreements
    .filter((a) => a.status === "Signed")
    .map((a) => ({
      id: a.id,
      propertyTitle: a.propertyTitle,
      tenantName: a.tenantName,
      monthlyRent: a.monthlyRent,
      brokerageAmount: a.brokerageAmount,
      brokeragePaidBy: a.brokeragePaidBy,
      createdAt: a.createdAt,
      stage: "completed",
    }));

  const COLUMNS = [
    { stage: "lead" as const, label: "Lead", dot: "bg-primary", headerBg: "bg-blue-50", headerText: "text-primary", countBg: "bg-primary/15 text-primary", cards: leadCards },
    { stage: "agreement" as const, label: "Agreement", dot: "bg-amber-500", headerBg: "bg-amber-50", headerText: "text-amber-700", countBg: "bg-amber-100 text-amber-700", cards: agreementCards },
    { stage: "completed" as const, label: "Completed", dot: "bg-green-500", headerBg: "bg-green-50", headerText: "text-green-700", countBg: "bg-green-100 text-green-700", cards: completedCards },
  ];

  // Subtitle
  const inProgress = agreementCards.length;
  const newLeads = tenants.filter((t) => Date.now() - t.createdAt < 7 * 24 * 60 * 60 * 1000).length;
  const subtitle =
    inProgress > 0 && newLeads > 0
      ? `You have ${inProgress} deal${inProgress !== 1 ? "s" : ""} in progress and ${newLeads} new lead${newLeads !== 1 ? "s" : ""}`
      : inProgress > 0
        ? `You have ${inProgress} deal${inProgress !== 1 ? "s" : ""} in progress`
        : newLeads > 0
          ? `You have ${newLeads} new lead${newLeads !== 1 ? "s" : ""}`
          : `Welcome back, let's close some deals`;

  // Recent activity feed
  const recentActivity: { id: string; label: string; description?: string; time: number; type: "agreement" | "property" | "tenant" }[] = [
    ...agreements.map((a) => ({
      id: a.id,
      label: `Agreement sent for ${a.propertyTitle}`,
      description: a.tenantName ? `Tenant: ${a.tenantName}` : undefined,
      time: a.createdAt,
      type: "agreement" as const,
    })),
    ...properties.map((p) => ({
      id: p.id,
      label: `Property added: ${getPropertyTitle(p)}`,
      description: `${p.area}, ${p.city} · ₹${Number(p.monthlyRent).toLocaleString("en-IN")}/mo`,
      time: p.createdAt,
      type: "property" as const,
    })),
    ...tenants.map((t) => ({
      id: t.id,
      label: `Tenant registered: ${t.name}`,
      description: t.phone ? `+91 ${t.phone}` : undefined,
      time: t.createdAt,
      type: "tenant" as const,
    })),
  ]
    .sort((a, b) => b.time - a.time)
    .slice(0, 5);

  const activityIcon = (type: string) => {
    if (type === "agreement") return <FileCheck2 size={14} className="text-primary" />;
    if (type === "property") return <Building2 size={14} className="text-amber-500" />;
    return <Users size={14} className="text-accent" />;
  };

  const activityBg = (type: string) => {
    if (type === "agreement") return "bg-primary/10";
    if (type === "property") return "bg-amber-50";
    return "bg-accent/10";
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <BrokerPendingFlowBanners className="mb-2" />
      <AgreementWaitingSignaturesPanel requesterRole="broker" className="mb-2" />
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
            {getGreeting()}, {brokerName} 👋
          </h1>
          <p className="text-gray-500 mt-2 text-base">{subtitle}</p>
        </div>
        <BrokerDashboardHeaderActions
          onGenerateAgreement={onGenerateAgreement}
          onAddProperty={onAddProperty}
          onAddTenant={onAddTenant}
        />
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow group flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <IndianRupee size={24} className="text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Earned</p>
            <p className="text-3xl font-semibold text-gray-900 tracking-tight">{fmtINR(totalEarned)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow group flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Building2 size={24} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Active Properties</p>
            <p className="text-3xl font-semibold text-gray-900 tracking-tight">{activePropertyCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow group flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <Users size={24} className="text-orange-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Leads in Pipeline</p>
            <p className="text-3xl font-semibold text-gray-900 tracking-tight">{leadsInPipeline}</p>
          </div>
        </div>
      </div>

      {/* ── Deals Pipeline ── */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Deals Pipeline</h2>
          <BrokerFlowButton type="button" flowVariant="sm-ghost" onClick={onViewDeals} className="px-4">
            View All Deals <ChevronRight size={16} />
          </BrokerFlowButton>
        </div>

        {/* 3-column Kanban board */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {COLUMNS.map((col) => {
            const preview = col.cards.slice(0, 3);
            const remaining = col.cards.length - 3;
            return (
              <div key={col.stage} className="flex flex-col gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                {/* Column header */}
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${col.headerBg}`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dot} shadow-sm`} />
                    <span className={`text-sm font-semibold tracking-wide ${col.headerText}`}>{col.label}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-md ${col.countBg}`}>
                    {col.cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-3">
                  {preview.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 flex flex-col items-center justify-center text-gray-400 bg-white/50">
                      <FileCheck2 size={24} className="mb-2 opacity-20" />
                      <span className="text-sm font-medium">No deals here yet</span>
                    </div>
                  ) : (
                    preview.map((card) => (
                      <DealCardItem
                        key={card.id}
                        card={card}
                        onClick={col.stage !== "lead" ? onViewDocuments : undefined}
                      />
                    ))
                  )}
                </div>

                {/* View more */}
                {remaining > 0 && (
                  <BrokerFlowButton
                    type="button"
                    flowVariant="sm-outline"
                    onClick={onViewDeals}
                    className="w-full border-2 border-dashed border-gray-200 text-gray-500 hover:border-primary/30 hover:text-primary bg-white/50 hover:bg-white"
                  >
                    View {remaining} more deal{remaining !== 1 ? "s" : ""}
                  </BrokerFlowButton>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-6 tracking-tight">Recent Activity</h2>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {recentActivity.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                <Clock size={32} className="mb-3 opacity-20" />
                <span className="text-sm font-medium">No activity yet</span>
              </div>
            ) : (
              recentActivity.map((item) => (
                <div key={item.id} className="flex items-center gap-5 px-6 py-4 hover:bg-gray-50 transition-colors">
                  <span className="text-sm text-gray-400 font-mono w-14 shrink-0">
                    {new Date(item.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </span>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${activityBg(item.type)}`}>
                    {activityIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-base text-gray-800 font-medium block">{item.label}</span>
                    {item.description && <span className="text-xs text-gray-500 mt-0.5">{item.description}</span>}
                  </div>
                  <span className="text-sm text-gray-400 shrink-0 font-medium bg-gray-50 px-3 py-1 rounded-full">{timeAgo(item.time)}</span>
                </div>
              ))
            )}
          </div>
          {recentActivity.length > 0 && (
            <div className="bg-gray-50 border-t border-gray-100 px-6 py-4">
              <button onClick={onViewActivity} className="w-full text-center text-sm text-primary font-semibold hover:text-primary/80 transition-colors">
                View All Activity
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function BrokerDashboard() {
  const brokerName = getBrokerName();
  const [, setLocation] = useLocation();

  const goGenerateAgreement = () => setLocation("/broker/agreements/generate");
  const goAddProperty = () => setLocation("/broker/properties/add");
  const goAddTenant = () => setLocation("/broker/tenants/add");
  const goDeals = () => setLocation("/broker/deals");
  const goDocuments = () => setLocation("/broker/documents");
  const goActivity = () => setLocation("/broker/activity");

  const properties = getProperties();
  const tenants = getTenants();
  const agreements = getAgreements();
  const hasData = properties.length > 0 || tenants.length > 0 || agreements.length > 0;

  return (
    <BrokerLayout>
      {hasData ? (
        <ActiveDashboard
          brokerName={brokerName}
          onGenerateAgreement={goGenerateAgreement}
          onAddProperty={goAddProperty}
          onAddTenant={goAddTenant}
          onViewDeals={goDeals}
          onViewDocuments={goDocuments}
          onViewActivity={goActivity}
        />
      ) : (
        <WelcomeDashboard
          brokerName={brokerName}
          onGenerateAgreement={goGenerateAgreement}
          onAddProperty={goAddProperty}
          onAddTenant={goAddTenant}
        />
      )}
    </BrokerLayout>
  );
}
