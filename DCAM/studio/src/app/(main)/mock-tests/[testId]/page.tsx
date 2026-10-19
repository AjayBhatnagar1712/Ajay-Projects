'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { arrayUnion, collection, doc, orderBy, query, setDoc, where } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useIsSubscribed } from '@/hooks/useIsSubscribed';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, CalendarDays, Clock3, FileText, Trophy, UserRound } from 'lucide-react';
import { format } from 'date-fns';
import {
  getLiveBatchTestAttemptState,
  getLiveBatchTestReportsVisibleAfter,
  hasPaidLiveBatchTestTokenAccessAtStart,
  resolveLiveBatchTestSchedule,
} from '@/lib/live-batch-test-access';
import {
  buildTeacherPremiumQuestionTestBlockedReason,
  useTeacherPremiumQuestionTestAccessMap,
} from '@/lib/teacher-premium-question-test-access';
import { buildTestReminderActionKey } from '@/lib/bell-reminder-actions';
import type { LiveBatchEnrollmentLike, LiveBatchSessionLike } from '@/lib/live-batch-session-access';
import { formatTestDurationLabel } from '@/lib/test-duration';
import { fetchPracticeQuestionSubjectIdsByIds } from '@/lib/exam-question-loader';

type Subject = { id: string; name: string };
type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string; examTypeId?: string };
type PracticeQuestion = { id: string; subjectId?: string };
type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  linkedContentType?: 'course' | 'mock_test' | 'live_batch';
  linkedContentId?: string;
};
type TeacherProfile = {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  photoURL?: string;
};
type AttemptLimitMode = 'unlimited' | 'total' | 'interval';
type AttemptIntervalUnit = 'day' | 'week' | 'month' | 'year';
type AttemptLimitConfig = {
  mode: AttemptLimitMode;
  maxTotalAttempts: number | null;
  maxAttemptsPerInterval: number | null;
  intervalValue: number | null;
  intervalUnit: AttemptIntervalUnit | null;
};
type MockTest = {
  id: string;
  title?: string;
  teacherId?: string;
  examTypeId?: string;
  examTypeName?: string;
  examCategory?: string;
  classId?: string;
  accessLevel?: 'free' | 'paid';
  thumbnailUrl?: string;
  imageUrl?: string;
  createdAt?: { toDate?: () => Date } | Date | string;
  mockTestDescription?: string;
  mockTestOutcomes?: string;
  mockTestYoutubeUrl?: string;
  isLiveBatchTest?: boolean;
  liveBatchId?: string;
  isCourseOnly?: boolean;
  courseId?: string;
  availabilityMode?: 'single_day' | 'unlimited';
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledEndTime?: string;
  accessStartTime?: string;
  accessEndTime?: string;
  accessWindowStartAt?: { toDate?: () => Date } | Date | string;
  accessWindowEndAt?: { toDate?: () => Date } | Date | string;
  startTime?: { toDate?: () => Date } | Date | string;
  questionAccessLevel?: 'free' | 'paid';
  attemptLimit?: {
    mode?: AttemptLimitMode;
    maxTotalAttempts?: number | null;
    maxAttemptsPerInterval?: number | null;
    intervalValue?: number | null;
    intervalUnit?: AttemptIntervalUnit | null;
  };
  showLeaderboard?: boolean;
  config?: {
    duration?: number | null;
    questionIds?: string[];
    subjectConfigs?: Array<{ subjectId?: string; questionAccessLevel?: 'free' | 'paid' }>;
  };
};

type AttemptHistoryItem = {
  studentId?: string;
  studentName?: string;
  score?: number;
  timeTaken?: number;
  submittedAt?: { toDate?: () => Date } | Date | string;
};

type TestAnalytics = {
  attemptHistory?: AttemptHistoryItem[];
};

type LiveBatch = {
  id: string;
  accessLevel?: 'free' | 'paid';
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function getYoutubeEmbedUrl(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '').trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes('youtube.com')) {
      const idFromV = parsed.searchParams.get('v');
      if (idFromV) return `https://www.youtube.com/embed/${idFromV}`;
      const parts = parsed.pathname.split('/').filter(Boolean);
      const embedIdx = parts.findIndex((p) => p === 'embed');
      if (embedIdx !== -1 && parts[embedIdx + 1]) return `https://www.youtube.com/embed/${parts[embedIdx + 1]}`;
    }
    return null;
  } catch {
    return null;
  }
}

function subtractInterval(base: Date, value: number, unit: AttemptIntervalUnit): Date {
  const dt = new Date(base);
  const amount = Math.max(1, Math.floor(Number(value) || 1));
  if (unit === 'day') dt.setDate(dt.getDate() - amount);
  if (unit === 'week') dt.setDate(dt.getDate() - (amount * 7));
  if (unit === 'month') dt.setMonth(dt.getMonth() - amount);
  if (unit === 'year') dt.setFullYear(dt.getFullYear() - amount);
  return dt;
}

function formatAttemptLimit(config: AttemptLimitConfig): string {
  if (config.mode === 'total' && config.maxTotalAttempts) {
    return `${config.maxTotalAttempts} total attempt${config.maxTotalAttempts === 1 ? '' : 's'}`;
  }
  if (config.mode === 'interval' && config.maxAttemptsPerInterval && config.intervalValue && config.intervalUnit) {
    const intervalLabel = `${config.intervalValue} ${config.intervalUnit}${config.intervalValue === 1 ? '' : 's'}`;
    return `${config.maxAttemptsPerInterval} attempt${config.maxAttemptsPerInterval === 1 ? '' : 's'} per ${intervalLabel}`;
  }
  return 'Unlimited attempts';
}

export default function MockTestDetailsPage() {
  const { testId } = useParams() as { testId: string };
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { isSubscribed, subscriptionPlan, isLoading: subscriptionLoading } = useIsSubscribed();

  const [questionDerivedSubjectIds, setQuestionDerivedSubjectIds] = useState<string[]>([]);

  const testDocRef = useMemoFirebase(() => (firestore && testId ? doc(firestore, 'mock_tests', testId) : null), [firestore, testId]);
  const purchasedTestDocRef = useMemoFirebase(
    () => (firestore && user?.uid && testId ? doc(firestore, 'users', user.uid, 'purchased_mock_tests', testId) : null),
    [firestore, user?.uid, testId]
  );
  const analyticsDocRef = useMemoFirebase(() => (firestore && testId ? doc(firestore, 'test_analytics', testId) : null), [firestore, testId]);
  const subjectsQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null), [firestore]);
  const examTypesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null), [firestore]);
  const classesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null), [firestore]);
  const plansQ = useMemoFirebase(
    () => (firestore && testId ? query(collection(firestore, 'subscription_plans'), where('linkedContentType', '==', 'mock_test'), where('linkedContentId', '==', testId)) : null),
    [firestore, testId]
  );

  const { data: test, isLoading: testLoading } = useDoc<MockTest>(testDocRef);
  const { data: purchasedRecord, isLoading: purchasedRecordLoading } = useDoc<{ id?: string }>(purchasedTestDocRef);
  const { data: analytics } = useDoc<TestAnalytics>(analyticsDocRef);
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
  const teacherDocRef = useMemoFirebase(() => (firestore && test?.teacherId ? doc(firestore, 'users', test.teacherId) : null), [firestore, test?.teacherId]);
  const { data: teacher, isLoading: teacherLoading } = useDoc<TeacherProfile>(teacherDocRef);
  const { data: subjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQ);
  const { data: examTypes, isLoading: examTypesLoading } = useCollection<ExamType>(examTypesQ);
  const { data: classes, isLoading: classesLoading } = useCollection<ClassItem>(classesQ);
  const { data: plans, isLoading: plansLoading } = useCollection<SubscriptionPlan>(plansQ);
  const { data: liveBatch, isLoading: liveBatchLoading } = useDoc<LiveBatch>(liveBatchRef);
  const { data: liveBatchEnrollment, isLoading: liveBatchEnrollmentLoading } = useDoc<LiveBatchEnrollmentLike>(liveBatchEnrollmentRef);
  const { data: liveBatchSessions, isLoading: liveBatchSessionsLoading } = useCollection<LiveBatchSessionLike>(liveBatchSessionsQ);
  const teacherPremiumQuestionMinimumStudentsRequiredByTestId = useMemo(
    () => (test?.id ? { [test.id]: 1 } : {}),
    [test?.id]
  );
  const { accessMap: teacherPremiumQuestionAccessMap } = useTeacherPremiumQuestionTestAccessMap(
    firestore,
    test ? [test] : [],
    teacherPremiumQuestionMinimumStudentsRequiredByTestId
  );

  useEffect(() => {
    let cancelled = false;
    async function loadSubjectIdsFromQuestions() {
      if (!firestore || !test?.config?.questionIds || test.config.questionIds.length === 0) {
        setQuestionDerivedSubjectIds([]);
        return;
      }
      try {
        const found = await fetchPracticeQuestionSubjectIdsByIds(firestore, test.config.questionIds, `mock test detail ${test.id}`);
        if (!cancelled) setQuestionDerivedSubjectIds(found);
      } catch (error) {
        console.error('Failed to derive mock test subjects from questions:', error);
        if (!cancelled) setQuestionDerivedSubjectIds([]);
      }
    }
    void loadSubjectIdsFromQuestions();
    return () => { cancelled = true; };
  }, [firestore, test?.config?.questionIds, test?.id]);

  const loading = testLoading || teacherLoading || subjectsLoading || examTypesLoading || classesLoading || plansLoading || subscriptionLoading || purchasedRecordLoading || liveBatchLoading || liveBatchEnrollmentLoading || liveBatchSessionsLoading;
  const isTeacherOwner = Boolean(user?.uid && test?.teacherId && user.uid === test.teacherId);
  const teacherPremiumQuestionAccessState = test ? teacherPremiumQuestionAccessMap[test.id] : null;
  const teacherPremiumQuestionBlockedMessage = buildTeacherPremiumQuestionTestBlockedReason(teacherPremiumQuestionAccessState);
  const hasTeacherPremiumQuestionAccess =
    isTeacherOwner
    || !teacherPremiumQuestionAccessState?.isProtected
    || teacherPremiumQuestionAccessState.isAccessible;

  const subjectNameById = useMemo(() => Object.fromEntries((subjects || []).map((s) => [s.id, s.name])), [subjects]);
  const examById = useMemo(() => Object.fromEntries((examTypes || []).map((e) => [e.id, e.name])), [examTypes]);
  const classNameById = useMemo(() => Object.fromEntries((classes || []).map((c) => [c.id, c.name])), [classes]);
  const classExamByClassId = useMemo(() => Object.fromEntries((classes || []).map((c) => [c.id, c.examTypeId || ''])), [classes]);

  const subjectNames = useMemo(() => {
    const fromConfigIds = Array.from(new Set((test?.config?.subjectConfigs || []).map((s) => s.subjectId).filter(Boolean))) as string[];
    const finalIds = fromConfigIds.length > 0 ? fromConfigIds : questionDerivedSubjectIds;
    return finalIds.map((id) => subjectNameById[id]).filter(Boolean);
  }, [test?.config?.subjectConfigs, questionDerivedSubjectIds, subjectNameById]);

  const createdDate = toDate(test?.createdAt);
  const questionCount = test?.config?.questionIds?.length || 0;
  const durationLabel = formatTestDurationLabel(test?.config?.duration);
  const thumbnail = test?.thumbnailUrl || test?.imageUrl;
  const embedUrl = getYoutubeEmbedUrl(test?.mockTestYoutubeUrl);
  const authorName = `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim() || teacher?.displayName || 'Unknown Teacher';

  const resolvedExamTypeId = test?.examTypeId || (test?.classId ? classExamByClassId[test.classId] : '');
  const examLabel = (resolvedExamTypeId && examById[resolvedExamTypeId]) || test?.examTypeName || test?.examCategory || resolvedExamTypeId || 'N/A';
  const curriculumLabel = test?.classId ? (classNameById[test.classId] || test.classId) : 'N/A';

  const paidPlans = (plans || []).filter((p) => Number.isFinite(Number(p.price)));
  const lowestPlan = paidPlans.length > 0 ? paidPlans.reduce((min, p) => (Number(p.price) < Number(min.price) ? p : min)) : null;
  const isPaid = test?.accessLevel === 'paid';
  const isLiveBatchTest = Boolean(test?.isLiveBatchTest && test?.liveBatchId);
  const liveBatchSchedule = useMemo(() => resolveLiveBatchTestSchedule(test), [test]);
  const liveBatchAttemptState = useMemo(() => getLiveBatchTestAttemptState(test), [test]);
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
    : (!isPaid || !!purchasedRecord || (isSubscribed && subscriptionPlan?.examTypeId === resolvedExamTypeId)))
    && hasTeacherPremiumQuestionAccess;
  const isInMyPractice = Boolean(purchasedRecord);
  const attemptLimitConfig = useMemo<AttemptLimitConfig>(() => {
    const raw = test?.attemptLimit;
    const mode = raw?.mode || 'unlimited';
    return {
      mode: (mode === 'total' || mode === 'interval' ? mode : 'unlimited') as AttemptLimitMode,
      maxTotalAttempts: Number.isFinite(Number(raw?.maxTotalAttempts)) ? Number(raw?.maxTotalAttempts) : null,
      maxAttemptsPerInterval: Number.isFinite(Number(raw?.maxAttemptsPerInterval)) ? Number(raw?.maxAttemptsPerInterval) : null,
      intervalValue: Number.isFinite(Number(raw?.intervalValue)) ? Number(raw?.intervalValue) : null,
      intervalUnit: (typeof raw?.intervalUnit === 'string' && ['day', 'week', 'month', 'year'].includes(raw.intervalUnit))
        ? (raw.intervalUnit as AttemptIntervalUnit)
        : null,
    };
  }, [test?.attemptLimit]);
  const attemptLimitLabel = useMemo(() => formatAttemptLimit(attemptLimitConfig), [attemptLimitConfig]);
  const attemptUsage = useMemo(() => {
    if (!user?.uid) return null as null | { used: number; limit: number | null; remaining: number | null; label: string };
    const history = Array.isArray(analytics?.attemptHistory) ? analytics.attemptHistory : [];
    const userAttempts = history.filter((entry) => entry.studentId === user.uid);
    if (attemptLimitConfig.mode === 'total' && attemptLimitConfig.maxTotalAttempts) {
      const remaining = Math.max(0, attemptLimitConfig.maxTotalAttempts - userAttempts.length);
      return {
        used: userAttempts.length,
        limit: attemptLimitConfig.maxTotalAttempts,
        remaining,
        label: `${userAttempts.length}/${attemptLimitConfig.maxTotalAttempts} used. Remaining: ${remaining}.`,
      };
    }
    if (
      attemptLimitConfig.mode === 'interval'
      && attemptLimitConfig.maxAttemptsPerInterval
      && attemptLimitConfig.intervalValue
      && attemptLimitConfig.intervalUnit
    ) {
      const windowStart = subtractInterval(new Date(), attemptLimitConfig.intervalValue, attemptLimitConfig.intervalUnit);
      const usedInWindow = userAttempts.filter((entry) => {
        const attemptedAt = toDate(entry.submittedAt);
        return !!attemptedAt && attemptedAt.getTime() >= windowStart.getTime();
      }).length;
      const remaining = Math.max(0, attemptLimitConfig.maxAttemptsPerInterval - usedInWindow);
      return {
        used: usedInWindow,
        limit: attemptLimitConfig.maxAttemptsPerInterval,
        remaining,
        label: `${usedInWindow}/${attemptLimitConfig.maxAttemptsPerInterval} used in the current interval. Remaining: ${remaining}.`,
      };
    }
    return {
      used: userAttempts.length,
      limit: null,
      remaining: null,
      label: `${userAttempts.length} attempt${userAttempts.length === 1 ? '' : 's'} used.`,
    };
  }, [analytics?.attemptHistory, attemptLimitConfig, user?.uid]);
  const attemptsLeft = attemptUsage?.remaining ?? null;
  const isAttemptBlockedForUser = !isTeacherOwner && attemptsLeft !== null && attemptsLeft <= 0;
  const isAccessWindowConfigured = Boolean(liveBatchSchedule.accessStartAt && liveBatchSchedule.accessEndAt);
  const isBeforeAccessStart =
    liveBatchAttemptState === 'before_test_start' || liveBatchAttemptState === 'before_access_start';
  const isAfterAccessEnd =
    liveBatchAttemptState === 'after_access_end' || liveBatchAttemptState === 'after_test_end';
  const isAccessWindowBlockedForUser = !isTeacherOwner && (isBeforeAccessStart || isAfterAccessEnd);
  const availabilityLabel = useMemo(() => {
    if (test?.availabilityMode === 'unlimited') {
      return liveBatchSchedule.testStartAt
        ? `Available from ${format(liveBatchSchedule.testStartAt, 'PPP')} onwards`
        : 'No schedule configured';
    }
    if (isAccessWindowConfigured && liveBatchSchedule.accessStartAt && liveBatchSchedule.accessEndAt) {
      return `${format(liveBatchSchedule.accessStartAt, 'PPP p')} to ${format(liveBatchSchedule.accessEndAt, 'PPP p')}`;
    }
    if (liveBatchSchedule.testEndAt) {
      return `Open after ${liveBatchSchedule.testStartAt ? format(liveBatchSchedule.testStartAt, 'PPP p') : 'scheduled start'} until ${format(liveBatchSchedule.testEndAt, 'PPP p')}`;
    }
    if (liveBatchSchedule.testStartAt) {
      return test?.availabilityMode === 'single_day'
        ? `Available on ${format(liveBatchSchedule.testStartAt, 'PPP p')}`
        : `Open anytime after ${format(liveBatchSchedule.testStartAt, 'PPP p')}`;
    }
    return 'No schedule configured';
  }, [isAccessWindowConfigured, liveBatchSchedule.accessEndAt, liveBatchSchedule.accessStartAt, liveBatchSchedule.testEndAt, liveBatchSchedule.testStartAt, test?.availabilityMode]);
  const blockedMessage = useMemo(() => {
    if (liveBatchAttemptState === 'before_test_start' && liveBatchSchedule.testStartAt) {
      return test?.availabilityMode === 'unlimited'
        ? `This test will be available from ${format(liveBatchSchedule.testStartAt, 'PPP')}.`
        : `This test will be available from ${format(liveBatchSchedule.testStartAt, 'PPP p')}.`;
    }
    if (liveBatchAttemptState === 'before_access_start' && liveBatchSchedule.accessStartAt) {
      return `This test will start accepting entries on ${format(liveBatchSchedule.accessStartAt, 'PPP p')}.`;
    }
    if (liveBatchAttemptState === 'after_test_end' && liveBatchSchedule.testEndAt) {
      return `This test ended on ${format(liveBatchSchedule.testEndAt, 'PPP p')}.`;
    }
    if (liveBatchSchedule.accessEndAt) {
      return `Test access closed on ${format(liveBatchSchedule.accessEndAt, 'PPP p')}.`;
    }
    return 'This test is currently outside the allowed schedule.';
  }, [liveBatchAttemptState, liveBatchSchedule.accessEndAt, liveBatchSchedule.accessStartAt, liveBatchSchedule.testEndAt, liveBatchSchedule.testStartAt, test?.availabilityMode]);
  const reportsVisibleAfter = useMemo(() => getLiveBatchTestReportsVisibleAfter(test), [test]);
  const reportsLockedForTeacher =
    isTeacherOwner
    && !!test?.isLiveBatchTest
    && !!reportsVisibleAfter
    && new Date().getTime() < reportsVisibleAfter.getTime();

  const leaderboardRows = useMemo(() => {
    const source = Array.isArray(analytics?.attemptHistory) ? analytics.attemptHistory : [];
    const byStudent = new Map<string, { studentName: string; bestScore: number; bestTime: number; attempts: number; lastAttemptAt: Date | null }>();
    source.forEach((a) => {
      const key = String(a.studentId || a.studentName || 'unknown');
      const name = a.studentName || 'Student';
      const score = Number(a.score || 0);
      const time = Number(a.timeTaken || 0);
      const attemptedAt = toDate(a.submittedAt);
      const existing = byStudent.get(key);
      if (!existing) {
        byStudent.set(key, { studentName: name, bestScore: score, bestTime: time, attempts: 1, lastAttemptAt: attemptedAt });
        return;
      }
      const betterScore = score > existing.bestScore;
      const sameScoreBetterTime = score === existing.bestScore && time < existing.bestTime;
      byStudent.set(key, {
        studentName: existing.studentName || name,
        bestScore: betterScore ? score : existing.bestScore,
        bestTime: betterScore || sameScoreBetterTime ? time : existing.bestTime,
        attempts: existing.attempts + 1,
        lastAttemptAt: attemptedAt && (!existing.lastAttemptAt || attemptedAt.getTime() > existing.lastAttemptAt.getTime()) ? attemptedAt : existing.lastAttemptAt,
      });
    });
    return Array.from(byStudent.values())
      .sort((a, b) => (b.bestScore - a.bestScore) || (a.bestTime - b.bestTime))
      .slice(0, 20);
  }, [analytics?.attemptHistory]);
  const handleStartTestClick = async () => {
    if (!test) return;

    const nextHref = `/mock-tests/${test.id}/start`;

    if (!liveBatchEnrollmentRef) {
      router.push(nextHref);
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
      // Best-effort only. The student should still be able to continue.
    }

    router.push(nextHref);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Test Details" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Test Details" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card><CardContent className="p-6 text-muted-foreground">Test not found.</CardContent></Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Test Details" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-slate-900 via-slate-900/95 to-blue-950/90 shadow-2xl">
            {thumbnail ? (
              <div className="relative h-56 w-full overflow-hidden md:h-72">
                <img src={thumbnail} alt={test.title || 'Mock test thumbnail'} className="h-full w-full object-cover opacity-75" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(56,189,248,0.22),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(251,191,36,0.18),transparent_32%)]" />
              </div>
            ) : null}
            <CardContent className="space-y-4 p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                {lowestPlan ? <Badge variant="secondary" className="bg-amber-500/15 text-amber-100 border-amber-300/30">From Rs {Number(lowestPlan.price).toLocaleString()}</Badge> : null}
                <Badge variant="outline" className="border-cyan-300/30 bg-cyan-500/10 text-cyan-100">{examLabel}</Badge>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{test.title || 'Untitled Mock Test'}</h1>
              <div className="grid grid-cols-1 gap-3 text-sm text-slate-300 md:grid-cols-2 lg:grid-cols-4">
                <p className="inline-flex items-center gap-2"><UserRound className="h-4 w-4 text-cyan-300" />Author: {authorName}</p>
                <p className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-cyan-300" />Created: {createdDate ? format(createdDate, 'PPP') : 'N/A'}</p>
                <p className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-cyan-300" />Questions: {questionCount}</p>
                <p className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-cyan-300" />Duration: {durationLabel}</p>
                <p>Curriculum: {curriculumLabel}</p>
                <p className="md:col-span-2 lg:col-span-3">Attempt Limit: {attemptLimitLabel}</p>
                <p className="md:col-span-2 lg:col-span-3">
                  Test Availability:{' '}
                  {availabilityLabel}
                </p>
              </div>
              {isLiveBatchTest && !isTeacherOwner && !liveBatchEnrollment ? (
                <p className="text-sm text-amber-200/90">
                  Join this live batch first to access its scheduled tests.
                </p>
              ) : null}
              {isLiveBatchTest && !isTeacherOwner && isPaidLiveBatch && hasLiveBatchStarted && !hasLiveBatchTokenAccess ? (
                <p className="text-sm text-amber-200/90">
                  This test stayed available only for students who still had live-session credit when it opened.
                </p>
              ) : null}
              {!isTeacherOwner && teacherPremiumQuestionBlockedMessage ? (
                <p className="text-sm text-amber-200/90">
                  {teacherPremiumQuestionBlockedMessage}
                </p>
              ) : null}
              <div className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-[minmax(240px,auto)_1fr]">
                <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-cyan-100/80">Attempts Left</p>
                  <p className="mt-1 text-2xl font-semibold text-cyan-50">
                    {attemptsLeft === null ? 'Unlimited' : attemptsLeft}
                  </p>
                  {attemptUsage ? <p className="mt-1 text-xs text-cyan-100/85">{attemptUsage.label}</p> : <p className="mt-1 text-xs text-cyan-100/85">Sign in to see your personal attempt usage.</p>}
                </div>
                <div className="flex flex-wrap gap-3">
                  {isUnlocked ? (
                    isAccessWindowBlockedForUser ? (
                      <Button size="lg" disabled className="h-12 min-w-[190px] rounded-xl">
                        {isBeforeAccessStart ? 'Test Not Started Yet' : 'Test Access Closed'}
                      </Button>
                    ) : isAttemptBlockedForUser ? (
                      <Button size="lg" disabled className="h-12 min-w-[190px] rounded-xl">No Attempts Left</Button>
                    ) : (
                      <Button
                        size="lg"
                        className="h-12 min-w-[190px] rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-blue-900/40 hover:from-cyan-400 hover:to-blue-500"
                        onClick={() => {
                          void handleStartTestClick();
                        }}
                      >
                        Start Test <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )
                  ) : teacherPremiumQuestionBlockedMessage ? (
                    <Button size="lg" disabled className="h-12 min-w-[240px] rounded-xl">
                      Unavailable Until Renewed
                    </Button>
                  ) : isLiveBatchTest ? (
                    <Button asChild size="lg" variant="outline" className="h-12 min-w-[190px] rounded-xl border-slate-500/60 bg-slate-900/40 hover:bg-slate-800/60">
                      <Link href={`/live-batches/${test.liveBatchId}`}>Open Live Batch</Link>
                    </Button>
                  ) : lowestPlan ? (
                    <Button asChild size="lg" className="h-12 min-w-[190px] rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400">
                      <Link href={`/checkout/${lowestPlan.id}`}>Unlock for Rs {Number(lowestPlan.price).toLocaleString()}</Link>
                    </Button>
                  ) : (
                    <Button size="lg" disabled className="h-12 min-w-[190px] rounded-xl">Plan Not Attached Yet</Button>
                  )}
                  {isTeacherOwner ? (
                    reportsLockedForTeacher ? (
                      <Button variant="outline" size="lg" disabled className="h-12 rounded-xl border-slate-500/60 bg-slate-900/40">
                        {reportsVisibleAfter ? `Reports after ${format(reportsVisibleAfter, 'PPP p')}` : 'Reports locked'}
                      </Button>
                    ) : (
                      <Button asChild variant="outline" size="lg" className="h-12 rounded-xl border-slate-500/60 bg-slate-900/40 hover:bg-slate-800/60">
                        <Link href={`/mock-tests/${test.id}/attempt-history`}>View Attempt History</Link>
                      </Button>
                    )
                  ) : null}
                  {!isTeacherOwner && isInMyPractice ? (
                    <Button asChild variant="outline" size="lg" className="h-12 rounded-xl border-slate-500/60 bg-slate-900/40 hover:bg-slate-800/60">
                      <Link href={`/mock-tests/${test.id}/my-attempts`}>My Attempt History</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
              {isAccessWindowBlockedForUser ? (
                <p className="text-sm text-amber-200/90">
                  {blockedMessage}
                </p>
              ) : null}
              {isAttemptBlockedForUser ? (
                <p className="text-sm text-amber-200/90">
                  You have used all available attempts for this test. Please wait for the next interval (if configured) or contact the teacher.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-border/60 bg-gradient-to-br from-slate-900/60 to-blue-950/30 shadow-xl">
              <CardHeader><CardTitle>Mock Test Overview</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Description</p>
                  <p className="mt-1 whitespace-pre-wrap">{test.mockTestDescription || 'No description added.'}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Outcomes</p>
                  <p className="mt-1 whitespace-pre-wrap">{test.mockTestOutcomes || 'No outcomes added.'}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Explanation Video</p>
                  {embedUrl ? (
                    <div className="mt-2 aspect-video w-full overflow-hidden rounded-lg border">
                      <iframe
                        src={embedUrl}
                        title={`${test.title || 'Mock test'} explanation video`}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  ) : test.mockTestYoutubeUrl ? (
                    <a href={test.mockTestYoutubeUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-primary underline underline-offset-2">
                      {test.mockTestYoutubeUrl}
                    </a>
                  ) : (
                    <p className="mt-1">No video link added.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-gradient-to-b from-slate-900/70 to-slate-900/30 shadow-xl">
              <CardHeader><CardTitle>Test Snapshot</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Subjects Included</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {subjectNames.length > 0 ? subjectNames.map((name) => <Badge key={name} variant="outline">{name}</Badge>) : <p className="text-sm text-muted-foreground">N/A</p>}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Price</p>
                  <p className="mt-1 text-xl font-semibold">
                    {isLiveBatchTest
                      ? (isPaidLiveBatch ? 'Included in paid batch' : 'Included in batch')
                      : isPaid
                        ? (lowestPlan ? `Rs ${Number(lowestPlan.price).toLocaleString()}` : 'Not set')
                        : 'Free'}
                  </p>
                </div>
                <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/5 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Attempt Limit</p>
                  <p className="mt-1 text-sm font-medium">{attemptLimitLabel}</p>
                  {attemptUsage ? <p className="mt-1 text-xs text-muted-foreground">{attemptUsage.label}</p> : null}
                </div>
                <div className="rounded-lg border border-blue-400/25 bg-blue-500/5 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Availability</p>
                  <p className="mt-1 text-sm font-medium">
                    {availabilityLabel}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {test.showLeaderboard ? (
            <Card className="border-border/60 bg-gradient-to-r from-slate-900/80 to-blue-950/70 shadow-xl">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="inline-flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-400" /> Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboardRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attempts yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Rank</th>
                          <th className="px-3 py-2 font-medium">Student</th>
                          <th className="px-3 py-2 font-medium">Best Score</th>
                          <th className="px-3 py-2 font-medium">Best Time</th>
                          <th className="px-3 py-2 font-medium">Attempts</th>
                          <th className="px-3 py-2 font-medium">Last Attempt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardRows.map((row, idx) => (
                          <tr key={`${row.studentName}-${idx}`} className="border-b border-border/60">
                            <td className="px-3 py-2 font-semibold">#{idx + 1}</td>
                            <td className="px-3 py-2">{row.studentName}</td>
                            <td className="px-3 py-2">{row.bestScore}</td>
                            <td className="px-3 py-2">{row.bestTime} min</td>
                            <td className="px-3 py-2">{row.attempts}</td>
                            <td className="px-3 py-2">{row.lastAttemptAt ? format(row.lastAttemptAt, 'PPP p') : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
}
