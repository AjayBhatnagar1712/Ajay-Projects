'use client';

import { doc } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import PublicEnquiryForm from '@/components/public-enquiry-form';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useIsTeacher } from '@/hooks/useIsTeacher';

type UserProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
};

export default function HelpPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const loading = isUserLoading || isAdminLoading || isTeacherLoading || isProfileLoading;
  const isStudent = !!user && !isAdmin && !isTeacher;
  const fullName = `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || user?.displayName || '';

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Help" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-4">
          <Skeleton className="h-[38rem] w-full rounded-[32px]" />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Help" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">Sign in to use student help.</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!isStudent) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Help" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">This help route is available for student accounts only.</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Help" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <PublicEnquiryForm
          enquiryType="student"
          source="student_help"
          backHref="/dashboard"
          backLabel="Back to dashboard"
          initialValues={{
            name: fullName,
            email: userProfile?.email || user.email || '',
            phoneNumber: userProfile?.phoneNumber || user.phoneNumber || '',
          }}
          authTokenProvider={async () => {
            return user.getIdToken(true);
          }}
        />
      </main>
    </div>
  );
}
