import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Bell,
  Clock,
  FileCheck,
  HandHeart,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  UserCircle,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { TrustKeyperLogo } from "@/components/brand";
import { TrustKeyperFooter } from "@/components/TrustKeyperFooter";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import {
  getActiveSession,
  logout,
  restoreRememberedSessionFromLocalStorage,
} from "@/lib/auth";
import { getTenantDisplayName } from "@/lib/tenantWorkspace";

const navItems = [
  { id: "dashboard", label: "Dashboards", icon: LayoutDashboard, href: "/tenant/dashboard" },
  { id: "rent", label: "Rent Payments", icon: Wallet, href: "/tenant/rent" },
  { id: "maintenance", label: "Repairs", icon: Wrench, href: "/tenant/maintenance" },
  { id: "documents", label: "Documents", icon: FileCheck, href: "/tenant/documents" },
  { id: "contact", label: "Contact", icon: HandHeart, href: "/tenant/contact" },
];

const helpItems = [
  { id: "settings", label: "Settings", icon: Settings, href: "/tenant/settings" },
  { id: "profile", label: "My Profile", icon: UserCircle, href: "/tenant/profile" },
  { id: "logout", label: "Logout", icon: LogOut, href: "/" },
];

interface TenantLayoutProps {
  children: React.ReactNode;
}

export default function TenantLayout({ children }: TenantLayoutProps) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const tenantName = getTenantDisplayName();
  const authCheckedRef = useRef(false);

  useEffect(() => {
    if (authCheckedRef.current) return;
    authCheckedRef.current = true;
    restoreRememberedSessionFromLocalStorage();
    const session = getActiveSession();
    if (!session || session.role !== "tenant") {
      sessionStorage.setItem("tk_pending_role", "tenant");
      setLocation("/login");
    }
  }, [setLocation]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [sidebarOpen]);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen w-full bg-[#F5F7FA] flex flex-col">
      <header className="h-14 sm:h-[90px] bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-8 shrink-0 z-20 sticky top-0 gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
            aria-controls="tenant-mobile-sidebar"
          >
            <Menu size={20} />
          </button>
          <Link href="/tenant/dashboard" className="block">
            <TrustKeyperLogo variant="brand" size="header" />
          </Link>
        </div>

        <div className="hidden md:flex flex-1 max-w-xl mx-4">
          <label className="relative w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              readOnly
              placeholder="Search properties, tenants, or tickets..."
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 bg-[#F8FAFC] text-sm text-gray-600"
              aria-label="Search"
            />
          </label>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-full border border-gray-200 text-sm text-gray-600">
            <Clock size={14} />
            <span>IST</span>
          </div>
          <button
            type="button"
            aria-label="Notifications"
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
          >
            <Bell size={18} />
          </button>
          <div
            className="hidden md:flex w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-900 items-center justify-center text-white text-xs font-semibold"
            aria-hidden
          >
            {tenantName.slice(0, 1).toUpperCase()}
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {sidebarOpen ? (
          <div
            role="presentation"
            className="fixed inset-0 z-40 md:hidden bg-black/40"
            onClick={closeSidebar}
          />
        ) : null}

        <aside
          id="tenant-mobile-sidebar"
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
          <button
            type="button"
            onClick={closeSidebar}
            aria-label="Close menu"
            className="md:hidden absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <X size={18} />
          </button>

          <div className="px-3 mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Menu</p>
          </div>

          <nav className="flex flex-col gap-1 mb-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location === item.href || location.startsWith(`${item.href}/`);
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

          <div className="px-3 mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Help</p>
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
              const active = location === item.href;
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

        <main className="flex-1 px-4 py-4 sm:px-8 sm:py-8 min-w-0">{children}</main>
      </div>

      <TrustKeyperFooter className="hidden md:block" />
    </div>
  );
}
