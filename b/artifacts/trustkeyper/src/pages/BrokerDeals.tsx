import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Plus, Search,
  Eye, Phone, IndianRupee, ChevronRight,
  Building2, Users, Clock, ArrowUpRight,
  Briefcase,
} from "lucide-react";
import BrokerLayout from "@/components/BrokerLayout";
import { BrokerFlowButton } from "@/components/broker/BrokerFlowButton";
import { FlowSegmentTabs } from "@/components/FlowSegmentTabs";
import { getProperties, getPropertyTitle } from "@/lib/properties";
import { getTenants, timeAgo } from "@/lib/tenants";
import { getAgreements } from "@/lib/agreements";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function fmtLakh(n: number): string {
  if (n === 0) return "₹0";
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
}

type Stage = "lead" | "agreement" | "completed";

interface Deal {
  id: string;
  stage: Stage;
  propertyTitle: string;
  tenantName: string;
  tenantContact?: string;
  monthlyRent: string;
  brokerageAmount: string;
  brokeragePaidBy: string;
  updatedAt: number;
}

// ─── Stage config ──────────────────────────────────────────────────────────────

const STAGE_CFG: Record<Stage, { label: string; dot: string; border: string; headerBg: string; headerText: string; countBg: string; countText: string; chip: string }> = {
  lead: {
    label: "Lead", dot: "bg-primary",
    border: "border-l-primary",
    headerBg: "bg-blue-50", headerText: "text-primary",
    countBg: "bg-primary/15", countText: "text-primary",
    chip: "bg-blue-50 text-primary border-primary/20",
  },
  agreement: {
    label: "Agreement", dot: "bg-amber-500",
    border: "border-l-amber-500",
    headerBg: "bg-amber-50", headerText: "text-amber-700",
    countBg: "bg-amber-100", countText: "text-amber-700",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
  },
  completed: {
    label: "Completed", dot: "bg-green-500",
    border: "border-l-green-500",
    headerBg: "bg-green-50", headerText: "text-green-700",
    countBg: "bg-green-100", countText: "text-green-700",
    chip: "bg-green-50 text-green-700 border-green-200",
  },
};

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function KanbanCard({ deal }: { deal: Deal }) {
  const cfg = STAGE_CFG[deal.stage];
  const initials = deal.tenantName
    ? deal.tenantName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "??";

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${cfg.border} shadow-sm hover:shadow-md transition-shadow p-4 cursor-pointer group`}>
      {/* Top row: stage chip + arrow */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.chip}`}>
          {cfg.label}
        </span>
        <ArrowUpRight size={13} className="text-gray-300 group-hover:text-primary transition-colors" />
      </div>

      {/* Property name */}
      <p className="text-sm font-semibold text-gray-900 mb-1 truncate leading-tight">
        {deal.propertyTitle || "—"}
      </p>

      {/* Tenant row */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-semibold shrink-0">
          {initials}
        </div>
        <p className="text-xs text-gray-500 truncate">
          {deal.tenantName ? `Tenant: ${deal.tenantName}` : "Tenant TBD"}
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 mb-3" />

      {/* Rent + Brokerage */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500">
          {deal.monthlyRent ? `${fmtINR(Number(deal.monthlyRent))}/mo` : "Rent TBD"}
        </p>
        {deal.brokerageAmount && Number(deal.brokerageAmount) > 0 && (
          <p className="text-sm font-semibold text-primary">{fmtINR(Number(deal.brokerageAmount))}</p>
        )}
      </div>

      {/* Paid by + time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[11px] text-gray-400">
          <Clock size={10} />
          {timeAgo(deal.updatedAt)}
        </div>
        {deal.brokeragePaidBy && (
          <div className="text-right">
            <p className="text-[9px] text-gray-400 leading-tight">Brokerage paid by</p>
            <p className="text-[11px] font-semibold text-gray-600">{deal.brokeragePaidBy}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({ stage, deals }: { stage: Stage; deals: Deal[] }) {
  const cfg = STAGE_CFG[stage];
  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl mb-4 ${cfg.headerBg}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className={`text-sm font-semibold ${cfg.headerText}`}>{cfg.label}</span>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${cfg.countBg} ${cfg.countText}`}>
          {deals.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {deals.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-xl py-10 text-center text-xs text-gray-400">
            No deals here yet
          </div>
        ) : (
          deals.map((d) => <KanbanCard key={d.id} deal={d} />)
        )}
      </div>
    </div>
  );
}

// ─── Table Row ─────────────────────────────────────────────────────────────────

function TenantAvatar({ name }: { name: string }) {
  const initials = name
    ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  return (
    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
      {initials}
    </div>
  );
}

function StatusPill({ stage }: { stage: Stage }) {
  const cfg = STAGE_CFG[stage];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function TableRow({ deal }: { deal: Deal }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-5 py-4">
        <p className="text-sm font-semibold text-gray-900">{deal.propertyTitle || "—"}</p>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <TenantAvatar name={deal.tenantName} />
          <span className="text-sm text-gray-700">{deal.tenantName || "—"}</span>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className="text-sm text-gray-700">
          {deal.monthlyRent ? fmtINR(Number(deal.monthlyRent)) : "—"}
        </span>
      </td>
      <td className="px-4 py-4">
        <StatusPill stage={deal.stage} />
      </td>
      <td className="px-4 py-4">
        <span className="text-sm font-semibold text-primary">
          {deal.brokerageAmount && Number(deal.brokerageAmount) > 0
            ? fmtINR(Number(deal.brokerageAmount))
            : "—"}
        </span>
      </td>
      <td className="px-4 py-4">
        <span className="text-sm text-gray-600">{deal.brokeragePaidBy || "—"}</span>
      </td>
      <td className="px-4 py-4">
        <span className="text-xs text-gray-400">{timeAgo(deal.updatedAt)}</span>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-primary bg-blue-50 hover:bg-primary hover:text-white transition-colors" title="View">
            <Eye size={14} />
          </button>
          {deal.tenantContact && (
            <a href={`tel:${deal.tenantContact}`} className="w-8 h-8 rounded-lg flex items-center justify-center text-primary bg-blue-50 hover:bg-primary hover:text-white transition-colors" title="Call">
              <Phone size={14} />
            </a>
          )}
          {!deal.tenantContact && (
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-primary bg-blue-50 hover:bg-primary hover:text-white transition-colors" title="Call">
              <Phone size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
        <Briefcase size={30} className="text-primary" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">No deals yet</h3>
      <p className="text-sm text-gray-400 max-w-xs">
        Add a property, register a tenant, or generate an agreement to start tracking deals.
      </p>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function BrokerDeals() {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");

  // Build deals list from all data sources
  const rawDeals = useMemo<Deal[]>(() => {
    const tenants = getTenants();
    const agreements = getAgreements();

    const leadDeals: Deal[] = tenants.map((t) => ({
      id: t.id,
      stage: "lead",
      propertyTitle: t.city
        ? `Searching in ${t.city}${t.localities?.length ? ` — ${t.localities[0]}` : ""}`
        : "Property search in progress",
      tenantName: t.name,
      tenantContact: t.phone,
      monthlyRent: "",
      brokerageAmount: "",
      brokeragePaidBy: "",
      updatedAt: t.createdAt,
    }));

    const agrDeals: Deal[] = agreements
      .filter((a) => a.status === "Sent")
      .map((a) => ({
        id: a.id,
        stage: "agreement",
        propertyTitle: a.propertyTitle,
        tenantName: a.tenantName,
        tenantContact: a.tenantContact,
        monthlyRent: a.monthlyRent,
        brokerageAmount: a.brokerageAmount,
        brokeragePaidBy: a.brokeragePaidBy,
        updatedAt: a.createdAt,
      }));

    const completedDeals: Deal[] = agreements
      .filter((a) => a.status === "Signed")
      .map((a) => ({
        id: a.id,
        stage: "completed",
        propertyTitle: a.propertyTitle,
        tenantName: a.tenantName,
        tenantContact: a.tenantContact,
        monthlyRent: a.monthlyRent,
        brokerageAmount: a.brokerageAmount,
        brokeragePaidBy: a.brokeragePaidBy,
        updatedAt: a.createdAt,
      }));

    return [...leadDeals, ...agrDeals, ...completedDeals].sort((a, b) => b.updatedAt - a.updatedAt);
  }, []);

  const hasData = rawDeals.length > 0;

  const filtered = useMemo(() => {
    if (!search.trim()) return rawDeals;
    const q = search.toLowerCase();
    return rawDeals.filter(
      (d) =>
        d.propertyTitle.toLowerCase().includes(q) ||
        d.tenantName.toLowerCase().includes(q)
    );
  }, [rawDeals, search]);

  // Stats — earnings only accrue once the deal is fully signed (Completed stage)
  const totalEarnings = rawDeals
    .filter((d) => d.stage === "completed")
    .reduce((s, d) => s + (Number(d.brokerageAmount) || 0), 0);
  const totalCount = rawDeals.length;

  const byStage = (stage: Stage) => filtered.filter((d) => d.stage === stage);

  return (
    <BrokerLayout>
      {/* ── Header row ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
          Deals <span className="text-gray-400 font-semibold text-lg sm:text-xl">({totalCount})</span>
        </h1>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <FlowSegmentTabs
            value={view}
            onChange={(v) => setView(v)}
            options={[
              { value: "kanban", label: "Board" },
              { value: "table", label: "Table" },
            ]}
          />
          <BrokerFlowButton
            type="button"
            flowVariant="sm-primary"
            onClick={() => setLocation("/broker/agreements/generate")}
            className="px-3 sm:px-4 text-xs sm:text-sm"
          >
            <Plus size={14} /> <span className="hidden sm:inline">Generate Rent Agreement</span><span className="sm:hidden">Agreement</span>
          </BrokerFlowButton>
        </div>
      </div>
      {/* ── Earnings banner ── */}
      {hasData && (
        <div className="flex items-center gap-4 relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-[#1a35c4] mb-6 px-6 py-8 sm:inline-flex sm:pr-8 sm:pl-8">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/5" />
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <IndianRupee size={18} className="text-white" />
          </div>
          <div className="relative">
            <p className="text-xs font-medium text-white/70 uppercase tracking-wider mb-0.5">Total Commission Earned</p>
            <p className="text-3xl font-extrabold text-white tracking-tight leading-none">{fmtLakh(totalEarnings)}</p>
          </div>
        </div>
      )}
      {/* ── Search ── */}
      <div className="relative mb-6 mt-0">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search property or tenant…"
          className="w-full max-w-sm h-10 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>
      {!hasData ? (
        <EmptyState />
      ) : view === "kanban" ? (
        /* ── Kanban — horizontal scroll on mobile, 3-col on desktop ── */
        <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
          {(["lead", "agreement", "completed"] as Stage[]).map((stage) => (
            <div key={stage} className="min-w-[280px] md:min-w-0 flex-shrink-0 md:flex-shrink">
              <KanbanColumn stage={stage} deals={byStage(stage)} />
            </div>
          ))}
        </div>
      ) : (
        /* ── Table — horizontal scroll on mobile ── */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Property", "Tenant", "Rent", "Status", "Brokerage", "Paid By", "Updated", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-sm text-gray-400">
                    No deals match your search
                  </td>
                </tr>
              ) : (
                filtered.map((d) => <TableRow key={d.id} deal={d} />)
              )}
            </tbody>
          </table>
        </div>
      )}
    </BrokerLayout>
  );
}
