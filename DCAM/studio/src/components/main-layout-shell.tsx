'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import MainSidebar from '@/components/main-sidebar';
import LockedTeacherSidebar from '@/components/locked-teacher-sidebar';
import TeacherOfferLibrarySync from '@/components/teacher-offer-library-sync';
import StudentAssistant from '@/components/student-assistant';
import BottomNav from '@/components/bottom-nav';
import { RouteTransitionFallback } from '@/components/route-transition';
import { useUser } from '@/firebase';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useIsAdmin } from '@/hooks/useIsAdmin';

const LOCKED_TEACHER_ALLOWED_PATHS = new Set(['/dashboard', '/profile']);
const QUESTION_UPLOAD_ALLOWED_PATHS = ['/dashboard', '/practice'];

const isQuestionUploadAllowedPath = (pathname: string) =>
  QUESTION_UPLOAD_ALLOWED_PATHS.some((allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`));

export default function MainLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const { isQuestionUploader, isPendingTeacher, isRejectedTeacher, isLoading: isTeacherRoleLoading } = useIsTeacher();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const router = useRouter();
  const pathname = usePathname();
  const isRoleLoading = isTeacherRoleLoading || isAdminLoading;
  const isLockedTeacher = isPendingTeacher || isRejectedTeacher;
  const isQuestionUploadOnly = isQuestionUploader && !isAdmin;
  const isQuestionUploadRedirecting = !isRoleLoading && isQuestionUploadOnly && !isQuestionUploadAllowedPath(pathname);
  const isLockedTeacherRedirecting = !isRoleLoading && isLockedTeacher && !LOCKED_TEACHER_ALLOWED_PATHS.has(pathname);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (isRoleLoading || !isLockedTeacher) return;
    if (!LOCKED_TEACHER_ALLOWED_PATHS.has(pathname)) {
      router.replace('/dashboard');
    }
  }, [isLockedTeacher, isRoleLoading, pathname, router]);

  useEffect(() => {
    if (isRoleLoading || !isQuestionUploadOnly) return;
    if (!isQuestionUploadAllowedPath(pathname)) {
      router.replace('/practice');
    }
  }, [isQuestionUploadOnly, isRoleLoading, pathname, router]);

  if (isUserLoading || isRoleLoading) {
    return <RouteTransitionFallback message="Opening workspace" />;
  }

  if (!user) {
    return null;
  }

  const sharedStudentSync = isQuestionUploadOnly ? null : <TeacherOfferLibrarySync />;
  const studentAssistant = isQuestionUploadOnly ? null : <StudentAssistant />;

  if (isQuestionUploadRedirecting) {
    return <RouteTransitionFallback message="Opening question bank" />;
  }

  if (isLockedTeacher) {
    if (isLockedTeacherRedirecting) {
      return <RouteTransitionFallback message="Opening workspace" />;
    }

    return (
      <>
        {sharedStudentSync}
        {studentAssistant}
        <SidebarProvider>
          <Sidebar collapsible="icon">
            <LockedTeacherSidebar />
          </Sidebar>
          <SidebarInset>
            <div className="h-full">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </>
    );
  }

  if (pathname.startsWith('/chat/direct/') || pathname.startsWith('/practice/session')) {
    return (
      <>
        {sharedStudentSync}
        {studentAssistant}
        {children}
      </>
    );
  }

  return (
    <>
      {sharedStudentSync}
      {studentAssistant}
      <SidebarProvider>
        <Sidebar>
          <MainSidebar />
        </Sidebar>
        <SidebarInset>
          <div className="h-full pb-16 md:pb-0">{children}</div>
          <BottomNav />
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
