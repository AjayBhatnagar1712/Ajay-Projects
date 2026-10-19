
'use client';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/icons';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from './ui/badge';
import { navItems } from '@/lib/nav-config';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useUser } from '@/firebase';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { isAllowedTeacherAuthorEmail } from '@/lib/teacher-authoring';

export default function MainSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { isTeacher, isExplicitStudent, isQuestionUploader, isLoading: isTeacherLoading } = useIsTeacher();
  const canManageTeacherAuthoring = isAdmin || isQuestionUploader || isAllowedTeacherAuthorEmail(user?.email);
  const [expandedMenuTitle, setExpandedMenuTitle] = useState<string | null>(null);
  const isRoleLoading = isAdminLoading || isTeacherLoading;
  const isTeacherRoute =
    pathname.startsWith('/practice')
    || pathname.startsWith('/courses')
    || pathname.startsWith('/mock-tests')
    || pathname.startsWith('/live-batches')
    || pathname.startsWith('/subscription')
    || pathname.startsWith('/curriculum')
    || pathname.startsWith('/content')
    || pathname.startsWith('/teacher/');
  const assumeTeacherDuringRoleLoading = isRoleLoading && !isExplicitStudent && isTeacherRoute;
  const effectiveIsTeacher = isTeacher || assumeTeacherDuringRoleLoading;
  const isTeacherAuthoringRestricted = effectiveIsTeacher && !isAdmin && !canManageTeacherAuthoring;
  const isQuestionUploadOnly = isQuestionUploader && !isAdmin;
  const isStudent = !isRoleLoading && !effectiveIsTeacher && !isAdmin && !isQuestionUploader;
  const showRoleSkeleton = isRoleLoading && !assumeTeacherDuringRoleLoading;
  const studentTourIdsByHref: Record<string, string> = {
    '/dashboard': 'dashboard-nav',
    '/my-learning': 'my-learning-nav',
    '/my-practice': 'my-practice-nav',
    '/my-batch': 'my-batch-nav',
    '/offers': 'offers-nav',
    '/chat': 'chat-nav',
    '/doubts': 'doubts-nav',
    '/notice-board': 'notice-board-nav',
  };

  const isHrefActive = (href: string) => {
    const [targetPath, queryString] = href.split('?');
    if (targetPath === '/mock-tests') {
      if (pathname !== '/mock-tests') return false;
      if (!queryString) return true;
      const params = new URLSearchParams(queryString);
      return Array.from(params.entries()).every(([key, value]) => searchParams.get(key) === value);
    }
    if (queryString) {
      if (pathname !== targetPath) return false;
      const params = new URLSearchParams(queryString);
      return Array.from(params.entries()).every(([key, value]) => searchParams.get(key) === value);
    }
    return pathname.startsWith(targetPath);
  };

  const isItemOrChildActive = (item: (typeof navItems)[number]) =>
    isHrefActive(item.href) || (!!item.children && item.children.some((child) => isHrefActive(child.href)));

  useEffect(() => {
    const activeParentWithChildren = navItems.find((item) => item.children?.length && isItemOrChildActive(item));
    setExpandedMenuTitle(activeParentWithChildren ? activeParentWithChildren.title : null);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (isRoleLoading || !effectiveIsTeacher || isAdmin || isQuestionUploadOnly) return;
    const teacherRoutes = [
      '/practice',
      '/courses',
      '/mock-tests',
      '/live-batches',
      '/subscription',
      '/teacher/premium-questions',
      '/teacher/question-purchases',
    ];
    teacherRoutes.forEach((route) => router.prefetch(route));
  }, [router, isRoleLoading, effectiveIsTeacher, isAdmin, isQuestionUploadOnly]);

  return (
    <>
      <SidebarHeader className="px-4 pt-5 pb-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/25 via-primary/15 to-transparent text-primary shadow-[0_10px_30px_rgba(59,130,246,0.25)]">
            <Logo className="w-6 h-6" />
          </div>
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-[0.35em] text-primary/70">DCAM</p>
            <span className="font-headline text-lg font-semibold text-primary">
              Classes
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <Separator className="bg-sidebar-border/60" />
      <SidebarContent className="bg-gradient-to-b from-sidebar/20 via-transparent to-sidebar/30">
        <SidebarMenu className="space-y-1.5 px-3 py-4">
          {isStudent ? (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/50">
              Student Workspace
            </p>
          ) : null}
          {isQuestionUploadOnly ? (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/50">
              Question Upload
            </p>
          ) : null}
          {showRoleSkeleton ? (
            <div className="p-2 space-y-2">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            navItems.map((item) => {
              const isAdminTeacherOnlyItem =
                item.href === '/practice' ||
                item.href.startsWith('/courses') ||
                item.href.startsWith('/mock-tests') ||
                item.href.startsWith('/live-batches') ||
                item.href === '/subscription';
              const hideRestrictedTeacherAuthoringItem =
                isTeacherAuthoringRestricted
                && (
                  item.href === '/practice'
                  || item.href.startsWith('/mock-tests')
                );
              const itemHref =
                isTeacherAuthoringRestricted && item.href === '/practice'
                  ? '/practice/bank'
                  : isTeacherAuthoringRestricted && item.href === '/mock-tests/create'
                    ? '/mock-tests?view=your'
                    : item.href;
              const visibleChildren =
                isTeacherAuthoringRestricted && item.href === '/mock-tests/create'
                  ? (item.children || []).filter((child) => child.href !== '/mock-tests/create')
                  : item.children;
              const displayTitle = isAdmin && item.href === '/curriculum' ? 'Manage Curriculum' : item.title;
              const studentTourId = studentTourIdsByHref[itemHref];

              if (isQuestionUploadOnly && item.href !== '/dashboard' && item.href !== '/practice') {
                  return null;
              }
              if (item.href.startsWith('/admin') && !isAdmin) {
                  return null;
              }
              if (item.href.startsWith('/teacher/') && (!effectiveIsTeacher || isAdmin)) {
                  return null;
              }
              if (hideRestrictedTeacherAuthoringItem) {
                  return null;
              }
              if (isAdmin && isAdminTeacherOnlyItem) {
                  return null;
              }
              if (!isStudent && (item.href === '/my-learning' || item.href === '/my-practice' || item.href === '/my-batch')) {
                  return null;
              }
              if (!isStudent && item.href === '/help') {
                  return null;
              }
              if (!isStudent && item.href === '/offers') {
                  return null;
              }
              if (
                isStudent
                && (
                  item.href === '/curriculum'
                  || item.href === '/practice'
                  || item.href.startsWith('/courses')
                  || item.href.startsWith('/mock-tests')
                  || item.href.startsWith('/live-batches')
                  || item.href === '/subscription'
                  || item.href.startsWith('/teacher/')
                  || item.href === '/wallet'
                )
              ) {
                  return null;
              }
              if (item.href.startsWith('/live-batches') && !effectiveIsTeacher && !isAdmin) {
                  return null;
              }
              if (item.href === '/wallet' && !effectiveIsTeacher && !isAdmin) {
                  return null;
              }
              return (
                <SidebarMenuItem
                  key={item.href}
                  onMouseEnter={() => {
                    if (item.children?.length) {
                      setExpandedMenuTitle(item.title);
                    } else {
                      setExpandedMenuTitle(null);
                    }
                  }}
                >
                  <SidebarMenuButton
                    asChild
                    isActive={isItemOrChildActive(item)}
                    tooltip={{ children: displayTitle }}
                    className="group h-11 gap-3 rounded-xl border border-transparent px-3 text-sm font-medium text-sidebar-foreground/80 transition-all duration-200 hover:-translate-y-[1px] hover:border-primary/20 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:shadow-[0_10px_24px_rgba(2,132,199,0.14)] data-[active=true]:border-primary/35 data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:via-primary/10 data-[active=true]:to-transparent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-[0_12px_28px_rgba(37,99,235,0.25)]"
                  >
                    <Link
                      href={itemHref}
                      data-student-tour={studentTourId}
                      onClick={() => {
                        if (!visibleChildren?.length) {
                          setExpandedMenuTitle(null);
                        }
                      }}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40 transition-all group-hover:border-primary/30 group-hover:bg-primary/10 group-data-[active=true]:border-primary/40 group-data-[active=true]:bg-primary/15">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span>{displayTitle}</span>
                      {isItemOrChildActive(item) ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_rgba(59,130,246,0.9)]" /> : null}
                      {item.label && <Badge variant="destructive" className="ml-auto">{item.label}</Badge>}
                    </Link>
                  </SidebarMenuButton>
                  {visibleChildren && visibleChildren.length > 0 && expandedMenuTitle === item.title ? (
                    <div className="ml-10 mt-1 space-y-1 border-l border-sidebar-border/50 pl-2">
                      {visibleChildren.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setExpandedMenuTitle(item.title)}
                          className={cn(
                            'block rounded-md px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                            isHrefActive(child.href) ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(59,130,246,0.22)]' : ''
                          )}
                        >
                          {child.title}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </SidebarMenuItem>
              )
            })
          )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        {/* Placeholder for future footer items, e.g., settings, logout */}
      </SidebarFooter>
    </>
  );
}
