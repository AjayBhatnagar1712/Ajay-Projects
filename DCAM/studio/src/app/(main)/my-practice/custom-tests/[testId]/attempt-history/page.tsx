'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type CustomTest = {
  id: string;
  title?: string;
};

type AttemptRecord = {
  id: string;
  score?: number;
  timeTaken?: number;
  attemptedQuestions?: number;
  correctQuestions?: number;
  incorrectQuestions?: number;
  submittedAt?: { toDate: () => Date };
};

export default function CustomTestAttemptHistoryPage() {
  const params = useParams<{ testId: string }>();
  const testId = typeof params?.testId === 'string' ? params.testId : '';
  const { user } = useUser();
  const firestore = useFirestore();

  const testRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid || !testId) return null;
    return doc(firestore, 'users', user.uid, 'custom_tests', testId);
  }, [firestore, user?.uid, testId]);

  const attemptsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid || !testId) return null;
    return query(collection(firestore, 'users', user.uid, 'custom_tests', testId, 'attempts'), orderBy('submittedAt', 'desc'));
  }, [firestore, user?.uid, testId]);

  const { data: testData, isLoading: isTestLoading } = useDoc<CustomTest>(testRef);
  const { data: attempts, isLoading: areAttemptsLoading } = useCollection<AttemptRecord>(attemptsQuery);

  const loading = isTestLoading || areAttemptsLoading;
  const totalAttempts = attempts?.length || 0;
  const bestScore = useMemo(() => {
    if (!attempts || attempts.length === 0) return 0;
    return Math.max(...attempts.map((item) => Number(item.score || 0)));
  }, [attempts]);

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Custom Mock Attempt History" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{testData?.title || 'Custom Mock Test'}</CardTitle>
            <CardDescription>Total Attempts: {totalAttempts} | Best Score: {bestScore}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : !attempts || attempts.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                No attempts yet. Start the test to generate attempt history.
              </div>
            ) : (
              <div className="space-y-3">
                {attempts.map((attempt, index) => (
                  <div key={attempt.id} className="rounded-md border p-4 text-sm">
                    <p className="font-semibold">Attempt #{attempts.length - index}</p>
                    <p className="text-muted-foreground">
                      Submitted: {attempt.submittedAt?.toDate ? attempt.submittedAt.toDate().toLocaleString() : 'N/A'}
                    </p>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>Score: <span className="font-medium">{attempt.score ?? 0}</span></div>
                      <div>Time: <span className="font-medium">{attempt.timeTaken ?? 0} min</span></div>
                      <div>Correct: <span className="font-medium">{attempt.correctQuestions ?? 0}</span></div>
                      <div>Incorrect: <span className="font-medium">{attempt.incorrectQuestions ?? 0}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/test/${testId}?type=custom`}>Start Test</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/my-practice">Back to My Practice</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

