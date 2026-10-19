'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { mobileQuestionUploadNavItems, mobileStudentNavItems, mobileTeacherNavItems } from '@/lib/nav-config';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useUser } from '@/firebase';
import { isAllowedTeacherAuthorEmail } from '@/lib/teacher-authoring';

export default function BottomNav() {
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const { user } = useUser();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { isTeacher, isQuestionUploader, isPendingTeacher, isRejectedTeacher, isLoading: isTeacherLoading } = useIsTeacher();

  if (!isMobile || isAdminLoading || isTeacherLoading || isPendingTeacher || isRejectedTeacher) {
    return null;
  }

  const isQuestionUploadOnly = isQuestionUploader && !isAdmin;
  const isStudent = !isTeacher && !isAdmin && !isQuestionUploader;
  const isTeacherAuthoringRestricted = !isStudent && !isAdmin && !isQuestionUploader && !isAllowedTeacherAuthorEmail(user?.email);
  const navItems = (isQuestionUploadOnly ? mobileQuestionUploadNavItems : isStudent ? mobileStudentNavItems : mobileTeacherNavItems)
    .filter((item) => !(isTeacherAuthoringRestricted && item.href === '/practice'));

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-background border-t">
      <div className={cn('grid h-full max-w-lg mx-auto font-medium', navItems.length <= 2 ? 'grid-cols-2' : 'grid-cols-4')}>
        {navItems.map((item) => {
          const itemHref =
            isTeacherAuthoringRestricted && item.href === '/practice'
              ? '/practice/bank'
              : item.href;
          const isActive = pathname === itemHref || (itemHref !== '/dashboard' && pathname.startsWith(itemHref));
          return (
            <Link
              key={item.title}
              href={itemHref}
              className={cn(
                'inline-flex flex-col items-center justify-center px-5 hover:bg-muted',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className="w-5 h-5 mb-1" />
              <span className="text-xs">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
