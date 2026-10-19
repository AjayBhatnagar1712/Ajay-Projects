'use client';

import Link from 'next/link';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StudentLearningEntry from '@/components/student-learning-entry';

type UserProfile = {
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'trialing';
};

function FeePaymentReminder() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading } = useDoc<UserProfile>(userDocRef);

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (userProfile?.subscriptionStatus === 'past_due') {
    return (
      <Card className="bg-destructive/10 border-destructive">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <CardTitle className="text-destructive">Payment Due</CardTitle>
            <CardDescription className="text-destructive/80">
              Your subscription payment is past due. Please update your payment method to restore access.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button asChild variant="destructive">
            <Link href="/subscription">
              <CreditCard className="mr-2" /> Pay Now
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}

export default function StudentDashboard() {
  return (
    <div className="space-y-6">
      <StudentLearningEntry />
      <FeePaymentReminder />
    </div>
  );
}
