'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardHeader from '@/components/dashboard-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useIsTeacher } from '@/hooks/useIsTeacher';

export default function LiveClassesPage() {
  const router = useRouter();
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const isLoading = isTeacherLoading || isAdminLoading;

  useEffect(() => {
    if (isLoading) return;
    if (isTeacher || isAdmin) {
      router.replace('/live-batches?view=your');
      return;
    }
    router.replace('/my-batch/explore');
  }, [isAdmin, isLoading, isTeacher, router]);

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Live Batches" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-3">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-48 w-full" />
        </div>
      </main>
    </div>
  );
}
