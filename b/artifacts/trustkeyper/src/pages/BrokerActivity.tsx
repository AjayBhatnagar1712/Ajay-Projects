import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, FileCheck2, Building2, Users, UserCheck,
  Filter, Search, CheckCheck, Bell,
} from "lucide-react";
import BrokerLayout from "@/components/BrokerLayout";
import { FlowSegmentTabs } from "@/components/FlowSegmentTabs";
import BrokerPendingFlowBanners from "@/components/BrokerPendingFlowBanners";
import { getProperties, getPropertyTitle } from "@/lib/properties";
import { getTenants, timeAgo } from "@/lib/tenants";
import { getAgreements } from "@/lib/agreements";
import { getDocumentSubmissionNotifications } from "@/lib/documentSubmissionNotifications";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityType = "agreement" | "property" | "tenant";

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  time: number;
  read: boolean;
}

// ─── Icon + colour helpers ────────────────────────────────────────────────────

const TYPE_CFG: Record<ActivityType, {
  icon: React.ReactNode;
  bg: string;
  text: string;
  label: string;
  dotColor: string;
}> = {
  agreement: {
    icon: <FileCheck2 size={16} />,
    bg: "bg-primary/10",
    text: "text-primary",
    label: "Agreement",
    dotColor: "bg-primary",
  },
  property: {
    icon: <Building2 size={16} />,
    bg: "bg-amber-50",
    text: "text-amber-600",
    label: "Property",
    dotColor: "bg-amber-500",
  },
  tenant: {
    icon: <Users size={16} />,
    bg: "bg-green-50",
    text: "text-green-600",
    label: "Tenant",
    dotColor: "bg-green-500",
  },
};

function buildActivities(): ActivityItem[] {
  const properties = getProperties();
  const tenants = getTenants();
  const agreements = getAgreements();

  const items: ActivityItem[] = [
    ...agreements.map((a) => ({
      id: `agr-${a.id}`,
      type: "agreement" as ActivityType,
      title: `Agreement sent for ${a.propertyTitle}`,
      description: `Tenant ${a.tenantName} · Brokerage ₹${Number(a.brokerageAmount).toLocaleString("en-IN")}`,
      time: a.createdAt,
      read: false,
    })),
    ...properties.map((p) => ({
      id: `prop-${p.id}`,
      type: "property" as ActivityType,
      title: `Property added: ${getPropertyTitle(p)}`,
      description: `${p.city}, ${p.area} · ₹${Number(p.monthlyRent).toLocaleString("en-IN")}/mo`,
      time: p.createdAt,
      read: false,
    })),
    ...tenants.map((t) => ({
      id: `ten-${t.id}`,
      type: "tenant" as ActivityType,
      title: `Tenant registered: ${t.name}`,
      description: t.city
        ? `Looking in ${t.city}${t.localities?.length ? ` · ${t.localities[0]}` : ""}`
        : "Profile details added",
      time: t.createdAt,
      read: false,
    })),
    ...getDocumentSubmissionNotifications()
      .filter((row) => row.requesterRole === "broker" && row.status !== "archived")
      .map((row) => ({
        id: row.id,
        type: "agreement" as ActivityType,
        title: `Documents submitted: ${row.tenantName}`,
        description: row.propertyLabel
          ? `${row.propertyLabel} · Ready for agreement review`
          : "Ready for agreement review",
        time: row.submittedAt,
        read: row.status === "read" || row.status === "displayed",
      })),
    // Static system event always present
    {
      id: "sys-profile",
      type: "tenant" as ActivityType,
      title: "Your profile has been created",
      description: "Welcome to TrustKeyper Broker Portal",
      time: Date.now() - 60 * 60 * 1000,
      read: true,
    },
  ].sort((a, b) => b.time - a.time);

  return items;
}

// ─── Group by date ────────────────────────────────────────────────────────────

function groupByDate(items: ActivityItem[]): { label: string; items: ActivityItem[] }[] {
  const map = new Map<string, ActivityItem[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const item of items) {
    const d = new Date(item.time);
    d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = "Today";
    else if (d.getTime() === yesterday.getTime()) label = "Yesterday";
    else label = d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(item);
  }

  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

// ─── Single row ───────────────────────────────────────────────────────────────

function ActivityRow({ item }: { item: ActivityItem }) {
  const cfg = TYPE_CFG[item.type];
  const time = new Date(item.time);
  const timeStr = time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <div className={`flex items-start gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors relative ${!item.read ? "bg-blue-50/40" : ""}`}>
      {!item.read && (
        <span className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
      )}
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.text}`}>
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-sm font-semibold truncate ${item.read ? "text-gray-700" : "text-gray-900"}`}>
              {item.title}
            </p>
            {item.description && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{item.description}</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 shrink-0">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
              {cfg.label}
            </span>
            <span className="text-[11px] text-gray-400 whitespace-nowrap">{timeStr}</span>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-1">{timeAgo(item.time)}</p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { id: "all" | ActivityType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "agreement", label: "Agreements" },
  { id: "property", label: "Properties" },
  { id: "tenant", label: "Tenants" },
];

export default function BrokerActivity() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<"all" | ActivityType>("all");
  const [search, setSearch] = useState("");

  const allActivities = useMemo(() => buildActivities(), []);

  const filtered = useMemo(() => {
    let list = filter === "all" ? allActivities : allActivities.filter((a) => a.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allActivities, filter, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const unreadCount = allActivities.filter((a) => !a.read).length;

  return (
    <BrokerLayout>
      <BrokerPendingFlowBanners className="mb-5" />
      {/* ── Page header ── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setLocation("/broker/dashboard")}
          className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Recent Activity</h1>
            {unreadCount > 0 && (
              <span className="h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-semibold flex items-center">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5 hidden sm:block">A full log of everything happening in your portal</p>
        </div>
        <button className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          <CheckCheck size={13} /> <span className="hidden sm:inline">Mark all read</span>
        </button>
      </div>
      {/* ── Filter + Search bar ── */}
      <div className="flex items-center gap-2 sm:gap-3 mb-5 flex-wrap">
        <FlowSegmentTabs
          value={filter}
          onChange={(v) => setFilter(v)}
          options={FILTER_OPTIONS.map((opt) => ({
            value: opt.id,
            label: opt.label,
          }))}
        />

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activities…"
            className="w-full h-9 pl-8 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>
      {/* ── Activity list ── */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Bell size={24} className="text-gray-400" />
          </div>
          <p className="text-base font-semibold text-gray-700 mb-1">No activity yet</p>
          <p className="text-sm text-gray-400">Actions you take — adding properties, tenants, and agreements — will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {grouped.map((group, gi) => (
            <div key={group.label}>
              {/* Date separator */}
              <div className="flex items-center gap-3 px-6 py-2.5 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group.label}</span>
                <span className="text-xs text-gray-400">({group.items.length})</span>
              </div>
              {/* Rows */}
              <div className="divide-y divide-gray-100">
                {group.items.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </div>
              {gi < grouped.length - 1 && <div className="border-b border-gray-100" />}
            </div>
          ))}
        </div>
      )}
    </BrokerLayout>
  );
}
