'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { collection, orderBy, query, where } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { isStandaloneMockTest } from '@/lib/mock-test-visibility';

type SaleRecord = {
  id: string;
  teacherId: string;
  studentId: string;
  studentName?: string;
  linkedContentType?: string | null;
  linkedContentId?: string | null;
  saleType?: string;
  planName?: string;
  grossAmount?: number;
  adminCommissionPercent?: number;
  adminCommissionAmount?: number;
  teacherPayoutAmount?: number;
  purchasedAt?: string;
  status?: 'paid' | 'failed' | 'refunded';
};

type Course = { id: string; title: string };
type MockTest = { id: string; title: string; isCourseOnly?: boolean; courseId?: string };

export default function TeacherPurchasesPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const salesQuery = useMemoFirebase(
    () => (firestore && user?.uid ? query(collection(firestore, 'users', user.uid, 'sales'), orderBy('purchasedAt', 'desc')) : null),
    [firestore, user]
  );
  const coursesQuery = useMemoFirebase(
    () => (firestore && user?.uid ? query(collection(firestore, 'courses'), where('teacherId', '==', user.uid)) : null),
    [firestore, user]
  );
  const testsQuery = useMemoFirebase(
    () => (firestore && user?.uid ? query(collection(firestore, 'mock_tests'), where('teacherId', '==', user.uid)) : null),
    [firestore, user]
  );

  const { data: sales, isLoading: areSalesLoading } = useCollection<SaleRecord>(salesQuery);
  const { data: courses, isLoading: areCoursesLoading } = useCollection<Course>(coursesQuery);
  const { data: tests, isLoading: areTestsLoading } = useCollection<MockTest>(testsQuery);

  const courseMap = useMemo(
    () => (courses || []).reduce((acc, c) => ({ ...acc, [c.id]: c.title }), {} as Record<string, string>),
    [courses]
  );
  const testMap = useMemo(
    () =>
      (tests || [])
        .filter((test) => isStandaloneMockTest(test))
        .reduce((acc, t) => ({ ...acc, [t.id]: t.title }), {} as Record<string, string>),
    [tests]
  );

  const rows = useMemo(
    () =>
      (sales || []).map((sale) => {
        const contentTitle =
          sale.linkedContentType === 'course'
            ? courseMap[sale.linkedContentId || ''] || sale.planName || 'Course Purchase'
            : sale.linkedContentType === 'mock_test'
              ? testMap[sale.linkedContentId || ''] || sale.planName || 'Mock Test Purchase'
              : sale.linkedContentType === 'premium_practice_session'
                ? sale.planName || 'Premium Practice Session'
                : sale.linkedContentType === 'premium_custom_mock_test'
                  ? sale.planName || 'Premium Custom Mock Test'
              : sale.planName || 'Purchase';
        const contentTypeLabel =
          sale.linkedContentType === 'mock_test'
            ? 'Test'
            : sale.linkedContentType === 'premium_practice_session'
              ? 'Practice'
              : sale.linkedContentType === 'premium_custom_mock_test'
                ? 'Custom Mock'
                : sale.linkedContentType === 'live_batch'
                  ? 'Live Batch'
                  : 'Course';
        return {
          ...sale,
          contentTitle,
          contentTypeLabel,
        };
      }),
    [sales, courseMap, testMap]
  );

  const loading = areSalesLoading || areCoursesLoading || areTestsLoading;

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Student Purchases" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex justify-between items-center">
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
              </Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Students Purchased Your Content</CardTitle>
              <CardDescription>Course/Test purchases with purchase date and amount.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No purchases found yet.</p>
              ) : (
                <div className="space-y-3">
                  {rows.map((row) => (
                    <div key={row.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <p className="font-medium">{row.studentName || 'Student'}</p>
                        <Badge variant="secondary">{row.contentTypeLabel}</Badge>
                      </div>
                      <p className="text-sm mt-1">{row.contentTitle}</p>
                      <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-4">
                        <span>Purchased: {row.purchasedAt ? new Date(row.purchasedAt).toLocaleString() : 'N/A'}</span>
                        <span>Student Paid: Rs. {typeof row.grossAmount === 'number' ? row.grossAmount.toFixed(2) : '0.00'}</span>
                        <span>Admin Cut: Rs. {typeof row.adminCommissionAmount === 'number' ? row.adminCommissionAmount.toFixed(2) : '0.00'} ({Number(row.adminCommissionPercent || 0).toFixed(2)}%)</span>
                        <span className="font-semibold text-emerald-600">Your Earning: Rs. {typeof row.teacherPayoutAmount === 'number' ? row.teacherPayoutAmount.toFixed(2) : '0.00'}</span>
                        <span>Status: {row.status || 'paid'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
