'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { arrayUnion, collection, doc, query, setDoc, where } from 'firebase/firestore';
import { format } from 'date-fns';
import DashboardHeader from '@/components/dashboard-header';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useIsSubscribed } from '@/hooks/useIsSubscribed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import {
  getLiveBatchTestAttemptState,
  hasPaidLiveBatchTestTokenAccessAtStart,
  resolveLiveBatchTestSchedule,
} from '@/lib/live-batch-test-access';
import {
  buildTeacherPremiumQuestionTestBlockedReason,
  useTeacherPremiumQuestionTestAccessMap,
} from '@/lib/teacher-premium-question-test-access';
import { buildTestReminderActionKey } from '@/lib/bell-reminder-actions';
import type { LiveBatchEnrollmentLike, LiveBatchSessionLike } from '@/lib/live-batch-session-access';
import { formatTestDurationLabel, hasTestTimeLimit } from '@/lib/test-duration';
import { startRouteTransition } from '@/components/route-transition';

type MockTest = {
  id: string;
  title?: string;
  teacherId?: string;
  accessLevel?: 'free' | 'paid';
  isLiveBatchTest?: boolean;
  liveBatchId?: string;
  isCourseOnly?: boolean;
  courseId?: string;
  examTypeId?: string;
  questionAccessLevel?: 'free' | 'paid';
  attemptRules?: string;
  attemptGuidance?: string;
  availabilityMode?: 'single_day' | 'unlimited';
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledEndTime?: string;
  accessStartTime?: string;
  accessEndTime?: string;
  accessWindowStartAt?: { toDate?: () => Date } | Date | string;
  accessWindowEndAt?: { toDate?: () => Date } | Date | string;
  startTime?: { toDate?: () => Date } | Date | string;
  config?: {
    duration?: number | null;
    questionIds?: string[];
    subjectConfigs?: Array<{ questionAccessLevel?: 'free' | 'paid' }>;
  };
};

type SubscriptionPlan = {
  id: string;
  price: number;
  linkedContentType?: 'course' | 'mock_test' | 'live_batch';
  linkedContentId?: string;
};
type PurchasedRecord = {
  id?: string;
  testId?: string;
  purchasedAt?: string;
};
type LiveBatch = {
  id: string;
  accessLevel?: 'free' | 'paid';
};

export default function MockTestStartPage() {
  const { testId } = useParams() as { testId: string };
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { isSubscribed, subscriptionPlan, isLoading: subscriptionLoading } = useIsSubscribed();
  const [isStartingExam, setIsStartingExam] = useState(false);

  const testDocRef = useMemoFirebase(
    () => (firestore && testId ? doc(firestore, 'mock_tests', testId) : null),
    [firestore, testId]
  );
  const plansQ = useMemoFirebase(
    () =>
      firestore && testId
        ? query(
            collection(firestore, 'subscription_plans'),
            where('linkedContentType', '==', 'mock_test'),
            where('linkedContentId', '==', testId)
          )
        : null,
    [firestore, testId]
  );
  const purchasedTestRef = useMemoFirebase(
    () => (firestore && user?.uid && testId ? doc(firestore, 'users', user.uid, 'purchased_mock_tests', testId) : null),
    [firestore, user?.uid, testId]
  );

  const { data: test, isLoading: testLoading } = useDoc<MockTest>(testDocRef);
  const { data: plans, isLoading: plansLoading } = useCollection<SubscriptionPlan>(plansQ);
  const { data: purchasedRecord, isLoading: purchasedRecordLoading } = useDoc<PurchasedRecord>(purchasedTestRef);
  const liveBatchRef = useMemoFirebase(
    () => (firestore && test?.liveBatchId ? doc(firestore, 'live_batches', test.liveBatchId) : null),
    [firestore, test?.liveBatchId]
  );
  const liveBatchEnrollmentRef = useMemoFirebase(
    () => (firestore && user?.uid && test?.liveBatchId ? doc(firestore, 'users', user.uid, 'enrolled_live_batches', test.liveBatchId) : null),
    [firestore, user?.uid, test?.liveBatchId]
  );
  const liveBatchSessionsQ = useMemoFirebase(
    () => (firestore && test?.liveBatchId ? query(collection(firestore, 'live_batch_sessions'), where('batchId', '==', test.liveBatchId)) : null),
    [firestore, test?.liveBatchId]
  );
  const { data: liveBatch, isLoading: liveBatchLoading } = useDoc<LiveBatch>(liveBatchRef);
  const { data: liveBatchEnrollment, isLoading: liveBatchEnrollmentLoading } = useDoc<LiveBatchEnrollmentLike>(liveBatchEnrollmentRef);
  const { data: liveBatchSessions, isLoading: liveBatchSessionsLoading } = useCollection<LiveBatchSessionLike>(liveBatchSessionsQ);
  const premiumAccessTestId = test?.id || '';
  const teacherPremiumQuestionMinimumStudentsRequiredByTestId = useMemo(
    () => (premiumAccessTestId ? { [premiumAccessTestId]: 1 } : {}),
    [premiumAccessTestId]
  );
  const { accessMap: teacherPremiumQuestionAccessMap } = useTeacherPremiumQuestionTestAccessMap(
    firestore,
    test ? [test] : [],
    teacherPremiumQuestionMinimumStudentsRequiredByTestId
  );

  const loading = testLoading || plansLoading || subscriptionLoading || purchasedRecordLoading || liveBatchLoading || liveBatchEnrollmentLoading || liveBatchSessionsLoading;
  const isPaid = test?.accessLevel === 'paid';
  const isTeacherOwner = Boolean(user?.uid && test?.teacherId && user.uid === test.teacherId);
  const teacherPremiumQuestionAccessState = test ? teacherPremiumQuestionAccessMap[test.id] : null;
  const teacherPremiumQuestionBlockedMessage = buildTeacherPremiumQuestionTestBlockedReason(teacherPremiumQuestionAccessState);
  const hasTeacherPremiumQuestionAccess =
    isTeacherOwner
    || !teacherPremiumQuestionAccessState?.isProtected
    || teacherPremiumQuestionAccessState.isAccessible;
  const liveBatchSchedule = useMemo(() => resolveLiveBatchTestSchedule(test), [test]);
  const liveBatchAttemptState = useMemo(() => getLiveBatchTestAttemptState(test), [test]);
  const isLiveBatchTest = Boolean(test?.isLiveBatchTest && test?.liveBatchId);
  const isPaidLiveBatch = isLiveBatchTest && (liveBatch?.accessLevel || 'free') === 'paid';
  const hasLiveBatchStarted =
    !!liveBatchSchedule.testStartAt && new Date().getTime() >= liveBatchSchedule.testStartAt.getTime();
  const hasLiveBatchTokenAccess = useMemo(() => {
    if (!isPaidLiveBatch) return true;
    if (!hasLiveBatchStarted) return true;
    return hasPaidLiveBatchTestTokenAccessAtStart({
      test,
      enrollment: liveBatchEnrollment,
      sessions: liveBatchSessions || [],
    });
  }, [hasLiveBatchStarted, isPaidLiveBatch, liveBatchEnrollment, liveBatchSessions, test]);
  const isActiveLiveBatchEnrollment = liveBatchEnrollment?.adminAccessDisabled !== true;
  const isUnlocked = (isLiveBatchTest
    ? Boolean(isTeacherOwner || (liveBatchEnrollment && isActiveLiveBatchEnrollment && (!isPaidLiveBatch || hasLiveBatchTokenAccess)))
    : (!isPaid || !!purchasedRecord || (isSubscribed && subscriptionPlan?.examTypeId === test?.examTypeId)))
    && hasTeacherPremiumQuestionAccess;
  const isBeforeWindowStart =
    liveBatchAttemptState === 'before_test_start' || liveBatchAttemptState === 'before_access_start';
  const isAfterWindowEnd =
    liveBatchAttemptState === 'after_access_end' || liveBatchAttemptState === 'after_test_end';
  const isWindowBlocked = !isTeacherOwner && (isBeforeWindowStart || isAfterWindowEnd);
  const durationLabel = formatTestDurationLabel(test?.config?.duration);
  const hasTimeLimit = hasTestTimeLimit(test?.config?.duration);
  const availabilityLabel = useMemo(() => {
    if (test?.availabilityMode === 'unlimited') {
      return liveBatchSchedule.testStartAt
        ? `Available from ${format(liveBatchSchedule.testStartAt, 'PPP')} onwards`
        : 'No schedule configured';
    }
    if (liveBatchSchedule.testStartAt && liveBatchSchedule.testEndAt) {
      return `${format(liveBatchSchedule.testStartAt, 'PPP p')} to ${format(liveBatchSchedule.testEndAt, 'PPP p')}`;
    }
    if (liveBatchSchedule.accessStartAt && liveBatchSchedule.accessEndAt) {
      return `${format(liveBatchSchedule.accessStartAt, 'PPP p')} to ${format(liveBatchSchedule.accessEndAt, 'PPP p')}`;
    }
    if (liveBatchSchedule.testEndAt) {
      return `Open after ${liveBatchSchedule.testStartAt ? format(liveBatchSchedule.testStartAt, 'PPP p') : 'scheduled start'} until ${format(liveBatchSchedule.testEndAt, 'PPP p')}`;
    }
    if (liveBatchSchedule.testStartAt) {
      return `Open anytime after ${format(liveBatchSchedule.testStartAt, 'PPP p')}`;
    }
    return 'No schedule configured';
  }, [liveBatchSchedule.accessEndAt, liveBatchSchedule.accessStartAt, liveBatchSchedule.testEndAt, liveBatchSchedule.testStartAt, test?.availabilityMode]);
  const blockedMessage = useMemo(() => {
    if (liveBatchAttemptState === 'before_test_start' && liveBatchSchedule.testStartAt) {
      return test?.availabilityMode === 'unlimited'
        ? `This test will open on ${format(liveBatchSchedule.testStartAt, 'PPP')}.`
        : `This test will open on ${format(liveBatchSchedule.testStartAt, 'PPP p')}.`;
    }
    if (liveBatchAttemptState === 'before_access_start' && liveBatchSchedule.accessStartAt) {
      return `This test will start accepting entries on ${format(liveBatchSchedule.accessStartAt, 'PPP p')}.`;
    }
    if (liveBatchAttemptState === 'after_test_end' && liveBatchSchedule.testEndAt) {
      return `This test ended on ${format(liveBatchSchedule.testEndAt, 'PPP p')}.`;
    }
    if (liveBatchSchedule.accessEndAt) {
      return `This test closed on ${format(liveBatchSchedule.accessEndAt, 'PPP p')}.`;
    }
    return 'This test is outside the allowed schedule.';
  }, [liveBatchAttemptState, liveBatchSchedule.accessEndAt, liveBatchSchedule.accessStartAt, liveBatchSchedule.testEndAt, liveBatchSchedule.testStartAt, test?.availabilityMode]);
  const lowestPlan = useMemo(() => {
    const valid = (plans || []).filter((p) => Number.isFinite(Number(p.price)));
    if (!valid.length) return null;
    return valid.reduce((min, p) => (Number(p.price) < Number(min.price) ? p : min));
  }, [plans]);
  const handleBeginExamClick = async () => {
    if (!test || isStartingExam) return;

    const nextHref = `/test/${test.id}`;
    setIsStartingExam(true);
    startRouteTransition({ label: 'Starting Exam', message: 'Preparing question paper' });
    const openExam = () => {
      if (typeof window !== 'undefined') {
        window.location.assign(nextHref);
        return;
      }
      router.push(nextHref);
    };

    if (!liveBatchEnrollmentRef) {
      openExam();
      return;
    }

    try {
      const actionKey = buildTestReminderActionKey({
        testId: test.id,
        scheduledDate: test.scheduledDate,
        scheduledTime: test.scheduledTime,
        startTime: liveBatchSchedule.testStartAt,
      });

      if (actionKey) {
        await setDoc(
          liveBatchEnrollmentRef,
          {
            notificationActionKeys: arrayUnion(actionKey),
            lastNotificationActionAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    } catch {
      // Best-effort only. Starting the exam should not be blocked by this write.
    }

    openExam();
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Before You Begin" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-4">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </main>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Before You Begin" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card>
            <CardContent className="p-6 text-muted-foreground">Mock test not found.</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Before You Begin" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Card className="border-border/70 bg-gradient-to-r from-slate-900/80 to-blue-950/70 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl">{test.title || 'Mock Test'}</CardTitle>
              <CardDescription>Read all instructions carefully before starting the exam.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold text-muted-foreground">Rules of Attempting</p>
                <p className="mt-2 whitespace-pre-wrap">{test.attemptRules?.trim() || 'No rules added by teacher.'}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold text-muted-foreground">Guidance of Attempting</p>
                <p className="mt-2 whitespace-pre-wrap">{test.attemptGuidance?.trim() || 'No guidance added by teacher.'}</p>
              </div>
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                <p className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  {hasTimeLimit
                    ? 'Once you click Begin Exam, timer and attempt tracking will start.'
                    : 'Once you click Begin Exam, attempt tracking will start. This test has no time limit.'}
                </p>
                <p className="mt-2">Duration: {durationLabel}</p>
                <p className="mt-2">Availability: {availabilityLabel}</p>
              </div>
              {isLiveBatchTest && !isTeacherOwner && !liveBatchEnrollment ? (
                <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                  Join this live batch first to access its scheduled tests.
                </div>
              ) : null}
              {isLiveBatchTest && !isTeacherOwner && isPaidLiveBatch && hasLiveBatchStarted && !hasLiveBatchTokenAccess ? (
                <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                  This test stayed available only for students who still had live-session credit when it opened.
                </div>
              ) : null}
              {!isTeacherOwner && teacherPremiumQuestionBlockedMessage ? (
                <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                  {teacherPremiumQuestionBlockedMessage}
                </div>
              ) : null}
              {isWindowBlocked ? (
                <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                  {blockedMessage}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                {isUnlocked ? (
                  isWindowBlocked ? (
                    <Button size="lg" disabled>
                      {isBeforeWindowStart ? 'Test Not Started Yet' : 'Test Access Closed'}
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      disabled={isStartingExam}
                      onClick={() => {
                        void handleBeginExamClick();
                      }}
                    >
                      {isStartingExam ? 'Starting Exam...' : 'Begin Exam'} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )
                ) : teacherPremiumQuestionBlockedMessage ? (
                  <Button size="lg" disabled>
                    Unavailable Until Renewed
                  </Button>
                ) : isLiveBatchTest ? (
                  <Button asChild size="lg" variant="outline">
                    <Link href={`/live-batches/${test.liveBatchId}`}>Open Live Batch</Link>
                  </Button>
                ) : lowestPlan ? (
                  <Button asChild size="lg">
                    <Link href={`/checkout/${lowestPlan.id}`}>Unlock for Rs {Number(lowestPlan.price).toLocaleString()}</Link>
                  </Button>
                ) : (
                  <Button size="lg" disabled>Plan Not Attached Yet</Button>
                )}
                <Button asChild variant="outline" size="lg">
                  <Link href={`/mock-tests/${test.id}`}>Back to Test Details</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
