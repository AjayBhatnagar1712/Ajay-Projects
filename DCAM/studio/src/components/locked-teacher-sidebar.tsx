'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock3, LayoutDashboard, User2 } from 'lucide-react';
import { Logo } from '@/components/icons';
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useIsTeacher } from '@/hooks/useIsTeacher';

const lockedNavItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Profile', href: '/profile', icon: User2 },
];

export default function LockedTeacherSidebar() {
  const pathname = usePathname();
  const { teacherStatus } = useIsTeacher();
  const badgeLabel = teacherStatus === 'rejected' ? 'Rejected' : 'Pending Approval';

  return (
    <>
      <SidebarHeader className="px-4 pt-5 pb-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/25 via-primary/15 to-transparent text-primary shadow-[0_10px_30px_rgba(59,130,246,0.25)]">
            <Logo className="w-6 h-6" />
          </div>
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-[0.35em] text-primary/70">DCAM</p>
            <span className="font-headline text-lg font-semibold text-primary">Classes</span>
          </div>
        </Link>
      </SidebarHeader>
      <Separator className="bg-sidebar-border/60" />
      <SidebarContent className="px-3 py-4">
        <div className="mx-2 mb-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-amber-200" />
            <p className="text-sm font-semibold text-sidebar-foreground">Teacher access locked</p>
          </div>
          <Badge variant="secondary" className="mt-3">
            {badgeLabel}
          </Badge>
          <p className="mt-3 text-xs leading-5 text-sidebar-foreground/70">
            Your account will unlock after admin approval.
          </p>
        </div>

        <SidebarMenu className="space-y-1.5">
          {lockedNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href)}
                className="group h-11 gap-3 rounded-xl border border-transparent px-3 text-sm font-medium text-sidebar-foreground/80 transition-all duration-200 hover:border-primary/20 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground data-[active=true]:border-primary/35 data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:via-primary/10 data-[active=true]:to-transparent"
              >
                <Link href={item.href}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
