import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { TrustKeyperLogo } from "@/components/brand";
import { TrustKeyperFooter } from "@/components/TrustKeyperFooter";
import { hasBankDetails, getBrokerProfile } from "@/lib/brokerProfile";
import { BROKER_PENDING_FLOWS_EVENT, getPendingFlowItems } from "@/lib/brokerPendingFlows";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { DocumentSubmissionNotificationHost } from "@/components/DocumentSubmissionNotificationHost";
import {
  getActiveSession,
  logout,
  restoreRememberedSessionFromLocalStorage,
} from "@/lib/auth";
import {
  LayoutDashboard,
  Building2,
  Users,
  Handshake,
  FileText,
  Settings,
  LogOut,
  Bell,
  Clock,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { id: "dashboards", label: "Dashboards", icon: LayoutDashboard, href: "/broker/dashboard" },
  { id: "properties", label: "Properties", icon: Building2, href: "/broker/properties" },
  { id: "tenants", label: "Tenants", icon: Users, href: "/broker/tenants" },
  { id: "deals", label: "Deals", icon: Handshake, href: "/broker/deals" },
  { id: "documents", label: "Documents", icon: FileText, href: "/broker/documents" },
];

const helpItems = [
  { id: "settings", label: "Settings", icon: Settings, href: "/broker/settings" },
  { id: "logout", label: "Logout", icon: LogOut, href: "/" },
];

function HeaderLogo() {
  return <TrustKeyperLogo variant="brand" size="header" />;
}

export function getBrokerName(): string {
  if (typeof window === "undefined") return "";
  const n = getBrokerProfile().name?.trim();
  return n || "Broker";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface BrokerLayoutProps {
  children: React.ReactNode;
}

export default function BrokerLayout({ children }: BrokerLayoutProps) {
  const [location, setLocation] = useLocation();
  const brokerName = getBrokerName();
  const initials = getInitials(brokerName);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingFlows, setPendingFlows] = useState(() =>
    typeof window !== "undefined" ? getPendingFlowItems() : [],
  );

  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSidebar();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [sidebarOpen]);

  useEffect(() => {
    const sync = () => setPendingFlows(getPendingFlowItems());
    sync();
    window.addEventListener(BROKER_PENDING_FLOWS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BROKER_PENDING_FLOWS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    restoreRememberedSessionFromLocalStorage();
    const session = getActiveSession();
    if (!session || session.role !== "broker") {
      sessionStorage.setItem("tk_pending_role", "broker");
      setLocation("/login");
      return;
    }
  }, [location, setLocation]);

  return (
    <div className="min-h-screen w-full bg-[#F5F7FA] flex flex-col">
      <DocumentSubmissionNotificationHost />
      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <header className="h-14 sm:h-[90px] bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-8 shrink-0 z-20 sticky top-0">
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
            aria-controls="mobile-sidebar"
          >
            <Menu size={20} />
          </button>
          <Link href="/broker/dashboard" className="block">
            <HeaderLogo />
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-full border border-gray-200 text-sm text-gray-600">
            <Clock size={14} />
            <span>IST</span>
          </div>
          <Link
            href="/broker/activity"
            aria-label="Activity and notifications"
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
          >
            <Bell size={17} />
            {pendingFlows.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" aria-hidden />
            )}
          </Link>
          <Link href="/broker/settings" className="relative hidden md:flex w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-gray-200 items-center justify-center text-gray-600 hover:bg-gray-50">
            <Settings size={17} />
            {!hasBankDetails() && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 border border-white" title="Complete your payment details" />
            )}
          </Link>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ── Mobile sidebar backdrop ─────────────────────────────────────── */}
        {sidebarOpen && (
          <div
            role="presentation"
            className="fixed inset-0 z-40 md:hidden bg-black/40"
            onClick={closeSidebar}
          />
        )}

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside
          id="mobile-sidebar"
          role="dialog"
          aria-label="Navigation menu"
          aria-modal="true"
          className={`
            fixed md:relative inset-y-0 left-0 z-50 md:z-auto
            w-64 bg-white border-r border-gray-200 px-4 py-6
            flex flex-col shrink-0 overflow-y-auto
            transition-transform duration-200 ease-in-out
            -translate-x-full md:translate-x-0
            ${sidebarOpen ? "translate-x-0 shadow-xl md:shadow-none" : ""}
          `}
        >
          {/* Close button — mobile only */}
          <button
            type="button"
            onClick={closeSidebar}
            aria-label="Close menu"
            className="md:hidden absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <X size={18} />
          </button>

          <div className="px-3 mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Broker's Portal
            </p>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 mb-6">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-primary flex items-center justify-center text-sm font-semibold">
              {initials}
            </div>
            <span className="text-sm font-medium text-gray-900 truncate">{brokerName}</span>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={closeSidebar}
                  className={`flex items-center gap-3 h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-primary"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 px-3 mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Help
            </p>
          </div>
          <nav className="flex flex-col gap-1">
            <AccountSwitcher onAfterSwitch={closeSidebar} />
            {helpItems.map((item) => {
              const Icon = item.icon;
              if (item.id === "logout") {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      logout();
                      closeSidebar();
                      setLocation("/");
                    }}
                    className="flex items-center gap-3 h-9 px-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 w-full text-left"
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              }
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={closeSidebar}
                  className="flex items-center gap-3 h-9 px-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <main className="flex-1 px-4 py-4 sm:px-8 sm:py-8 min-w-0">
          {children}
        </main>
      </div>

      <TrustKeyperFooter className="hidden md:block" />
    </div>
  );
}
