/**
 * Admin portal shell — session guard, sidebar navigation, header, and logout.
 */
import React, { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Building2, FileText, LayoutDashboard, LogOut, MessageSquare, Users } from "lucide-react";
import { TrustKeyperLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ADMIN_PRIMARY, getAdminSession, requireAdminSession } from "@/lib/adminAuth";
import { logout } from "@/lib/auth";

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface AdminNavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/properties", label: "Properties", icon: Building2 },
  { href: "/admin/agreements", label: "Agreements", icon: FileText },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
];

/**
 * Wraps admin pages with sidebar layout and enforces admin session on mount.
 */
export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const session = getAdminSession();

  useEffect(() => {
    requireAdminSession(setLocation);
  }, [setLocation]);

  const handleLogout = () => {
    logout();
    setLocation("/admin/login");
  };

  if (!session) {
    return null;
  }

  return (
    <SidebarProvider>
      <div
        className="flex min-h-svh w-full"
        style={
          {
            "--sidebar-primary": "211 65% 33%",
            "--sidebar-primary-foreground": "0 0% 100%",
          } as React.CSSProperties
        }
      >
        <Sidebar>
          <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
            <Link href="/admin/dashboard" className="flex items-center gap-2">
              <TrustKeyperLogo size="header" />
            </Link>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Admin Portal
            </p>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === href || location.startsWith(`${href}/`)}
                      >
                        <Link href={href}>
                          <Icon />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-4">
            <p className="truncate text-xs text-muted-foreground">+91 {session.phone}</p>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-white px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-6" />
            <h1 className="flex-1 text-lg font-semibold text-gray-900">Admin Portal</h1>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
              style={{ borderColor: `${ADMIN_PRIMARY}33`, color: ADMIN_PRIMARY }}
            >
              <LogOut size={16} />
              Log out
            </Button>
          </header>

          <main className="flex-1 bg-[#F5F7FA] p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
