import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { TrustKeyperLogo } from "@/components/brand";
import { TrustKeyperFooter } from "@/components/TrustKeyperFooter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getOwnerProfile } from "@/lib/ownerProfile";
import { getProperties, getPropertyTitle } from "@/lib/properties";
import { getAgreements } from "@/lib/agreements";
import {
  getOwnerInvites,
  getRecordedInviteStatus,
  OWNER_INVITES_UPDATED_EVENT,
} from "@/lib/ownerTenants";
import {
  DOCUMENT_SUBMISSION_NOTIFICATION_EVENT,
  getDocumentSubmissionNotifications,
} from "@/lib/documentSubmissionNotifications";
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
  Wrench,
  FileSignature,
  LogOut,
  UserCircle,
  Bell,
  Clock,
  Menu,
  X,
  CheckCircle2,
  Wallet,
  Banknote,
} from "lucide-react";

const navItems = [
  { id: "dashboards", label: "Dashboards", icon: LayoutDashboard, href: "/owner/dashboard" },
  { id: "finances", label: "Finances", icon: Banknote, href: "/owner/finances" },
  { id: "payments", label: "Payment Setup", icon: Wallet, href: "/owner/payments" },
  { id: "properties", label: "Properties", icon: Building2, href: "/owner/properties" },
  { id: "tenants", label: "Tenants", icon: Users, href: "/owner/tenants" },
  { id: "maintenance", label: "Maintenance", icon: Wrench, href: "/owner/tickets" },
  { id: "agreement", label: "Agreement", icon: FileSignature, href: "/owner/agreements" },
];

const helpItems = [
  { id: "profile", label: "My Profile", icon: UserCircle, href: "/owner/profile" },
  { id: "logout", label: "Logout", icon: LogOut, href: "/" },
];

function HeaderLogo() {
  return <TrustKeyperLogo variant="brand" size="header" />;
}

export function getOwnerName(): string {
  if (typeof window === "undefined") return "Meena!";
  const n = getOwnerProfile().name;
  return n || "Meena!";
}

function getInitials(name: string): string {
  const parts = name.replace("!", "").trim().split(/\s+/);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface OwnerLayoutProps {
  children: React.ReactNode;
}

export default function OwnerLayout({ children }: OwnerLayoutProps) {
  const [location, setLocation] = useLocation();
  const ownerName = getOwnerName().replace("!", "").trim();
  const initials = getInitials(ownerName || "Owner");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationEpoch, setNotificationEpoch] = useState(0);
  useEffect(() => {
    const refresh = () => setNotificationEpoch((v) => v + 1);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener(OWNER_INVITES_UPDATED_EVENT, refresh);
    window.addEventListener(DOCUMENT_SUBMISSION_NOTIFICATION_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(OWNER_INVITES_UPDATED_EVENT, refresh);
      window.removeEventListener(DOCUMENT_SUBMISSION_NOTIFICATION_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    restoreRememberedSessionFromLocalStorage();
    const session = getActiveSession();
    if (!session || session.role !== "owner") {
      sessionStorage.setItem("tk_pending_role", "owner");
      setLocation("/login");
      return;
    }
  }, [location, setLocation]);

  const notifications = useMemo(() => {
    const ownerProfile = getOwnerProfile();
    const norm = (v: string) => v.replace("!", "").trim().toLowerCase();
    const ownerNameNorm = norm(ownerName);

    const propertyEvents = getProperties()
      .filter(
        (p) =>
          p.uploadedBy === "owner" ||
          (p.ownerName && norm(p.ownerName) === ownerNameNorm),
      )
      .map((p) => ({
        id: `property-${p.id}`,
        title: "Property added",
        desc: getPropertyTitle(p),
        time: p.createdAt ?? 0,
      }));

    const agreementEvents = getAgreements()
      .filter((a) => a.ownerName && norm(a.ownerName) === ownerNameNorm)
      .map((a) => ({
        id: `agreement-${a.id}`,
        title: "Agreement created",
        desc: `${a.propertyTitle} • ${a.tenantName}`,
        time: a.createdAt ?? 0,
      }));

    const accountEvent =
      ownerProfile.name && ownerProfile.phone
        ? [
            {
              id: "account-created",
              title: "Account created",
              desc: `${ownerProfile.name} • +91 ${ownerProfile.phone}`,
              time: 0,
            },
          ]
        : [];

    const inviteEvents = getOwnerInvites().flatMap((inv) => {
      const status = getRecordedInviteStatus(inv);
      if (status === "accepted" && inv.acceptedAt) {
        return [
          {
            id: `invite-accepted-${inv.id}`,
            title: "Tenant accepted invite",
            desc: `${inv.name} • ${inv.propertyLabel}`,
            time: inv.acceptedAt,
          },
        ];
      }
      if (status === "rejected" && inv.rejectedAt) {
        return [
          {
            id: `invite-rejected-${inv.id}`,
            title: "Tenant rejected invite",
            desc: `${inv.name} • ${inv.propertyLabel}`,
            time: inv.rejectedAt,
          },
        ];
      }
      return [];
    });

    const documentSubmissionEvents = getDocumentSubmissionNotifications()
      .filter((row) => row.requesterRole === "owner" && row.status !== "archived")
      .map((row) => ({
        id: row.id,
        title: "Documents Submitted",
        desc: `${row.tenantName} uploaded all requested documents`,
        time: row.submittedAt,
      }));

    return [
      ...documentSubmissionEvents,
      ...propertyEvents,
      ...agreementEvents,
      ...inviteEvents,
      ...accountEvent,
    ]
      .sort((a, b) => b.time - a.time)
      .slice(0, 12);
  }, [ownerName, notificationEpoch]);

  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSidebar();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [sidebarOpen]);

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
          <Link href="/owner/dashboard" className="block">
            <HeaderLogo />
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-full border border-gray-200 text-sm text-gray-600">
            <Clock size={14} />
            <span>IST</span>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Notifications"
                className="relative w-10 h-10 rounded-xl border border-gray-100 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50 focus:outline-none transition-all hover:border-gray-200 shadow-sm"
              >
                <Bell size={18} className="text-gray-500" />
                {notifications.length > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-[#EB5757] text-[10px] font-semibold text-white flex items-center justify-center border-2 border-white px-1">
                    {notifications.length}
                  </span>
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[360px] p-0 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-gray-100 z-50 overflow-hidden">
              <div className="flex items-center justify-between p-5 bg-[#F8FAFC] border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-lg">Notifications</h3>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500 text-center">
                    Real-time updates will appear here when you add properties or agreements.
                  </div>
                ) : (
                  notifications.map((item, idx) => (
                    <div key={item.id} className={`p-5 flex gap-4 hover:bg-gray-50 transition-colors ${idx < notifications.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0 border border-green-100 text-[#27AE60]">
                        <CheckCircle2 size={18} strokeWidth={2.5} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-[14px] mb-0.5">{item.title}</p>
                        <p className="text-[12px] text-gray-500 leading-relaxed font-medium truncate">{item.desc}</p>
                        <p className="text-[10px] text-gray-400 mt-2 font-semibold flex items-center gap-1.5">
                          <Clock size={10} />
                          {item.time ? new Date(item.time).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Recently"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Link href="/owner/profile" className="relative hidden md:flex w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-900 items-center justify-center text-white hover:bg-gray-800">
            <Users size={17} />
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
            <p className="text-[13px] text-gray-400 tracking-wide border-b border-gray-100 pb-2">
              Menu
            </p>
          </div>

          <nav className="flex flex-col gap-1 mb-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.startsWith(item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={closeSidebar}
                  className={`flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-primary"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon size={18} className={active ? "text-primary" : "text-gray-500"} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 mb-3">
            <p className="text-[13px] text-gray-400 tracking-wide border-b border-gray-100 pb-2">
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
                    className="flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 w-full text-left"
                  >
                    <Icon size={18} className="text-gray-500" />
                    {item.label}
                  </button>
                );
              }
              const active = location.startsWith(item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={closeSidebar}
                  className={`flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                    active ? "bg-blue-50 text-primary" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon size={18} className={active ? "text-primary" : "text-gray-500"} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>

      <TrustKeyperFooter className="hidden md:block" />
    </div>
  );
}
