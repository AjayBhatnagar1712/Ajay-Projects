'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { arrayUnion, collection, doc, getDoc, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import LiveBatchThumbnail from '@/components/live-batches/live-batch-thumbnail';
import ConductedSessionDatePicker from '@/components/live-batches/conducted-session-date-picker';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking } from '@/firebase';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  calculateLiveBatchSessionCoverage,
  getConductedLiveBatchSessionDateOptions,
  getLiveBatchPreviousSessionAccessKey,
  resolveLiveBatchSessions,
  type LiveBatchManualSessionUnlockHistoryItem,
  type LiveBatchSessionPurchaseHistoryItem,
} from '@/lib/live-batch-session-access';
import { buildMeetingReminderActionKey, buildTestReminderActionKey } from '@/lib/bell-reminder-actions';
import { buildSubjectSessionCountMap, normalizeSubjectSessionCount } from '@/lib/live-batch-subject-sessions';
import { sendSelfBellNotification } from '@/lib/client-notifications';
import { getLiveBatchTestTeacherQuestionAccessCheckAt } from '@/lib/live-batch-test-access';
import { useTeacherPremiumQuestionTestAccessMap } from '@/lib/teacher-premium-question-test-access';
import { cn } from '@/lib/utils';
import {
  Activity,
  BookOpenCheck,
  CalendarDays,
  CreditCard,
  Clock3,
  Download,
  ExternalLink,
  GraduationCap,
  History,
  Lock,
  ListChecks,
  PencilLine,
  Sparkles,
  Trophy,
  User2,
  Users,
  Video,
  LoaderCircle,
} from 'lucide-react';

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string };
type Subject = { id: string; name: string };

type LiveBatch = {
  id: string;
  title?: string;
  description?: string;
  outcomes?: string;
  explanationVideoUrl?: string;
  examTypeId?: string;
  classId?: string;
  batchStartDate?: string;
  subjectIds?: string[];
  subjectSchedules?: Array<{
    subjectId: string;
    daysOfWeek: string[];
    startTime: string;
    endTime: string;
    useDifferentTimingPerDay?: boolean;
    dayTimings?: Record<string, { startTime: string; endTime: string }>;
    sessionCount?: number;
    defaultZoomLink?: string;
  }>;
  accessLevel?: 'free' | 'paid';
  teacherId?: string;
  teacherName?: string;
  thumbnailUrl?: string;
  publicationStatus?: 'draft' | 'published' | 'deleted';
  totalSessions?: number;
  perSessionFee?: number;
  contentUnlockLeadMinutes?: number;
  scheduleVersion?: number;
};

type SessionItem = {
  id: string;
  type?: 'meeting' | 'previous_session' | 'holiday' | 'cancelled';
  batchId?: string;
  date?: string;
  holidayEndDate?: string;
  meetingTime?: string;
  meetingEndTime?: string;
  subjectId?: string;
  subjectName?: string;
  meetingTitle?: string;
  zoomLink?: string;
  previousSessionUrl?: string;
  notesFileUrl?: string;
  notesFileName?: string;
  notesFileType?: string;
  notesFileSize?: number;
  reason?: string;
  sessionLabel?: string;
  timingMode?: 'batch_default' | 'manual_override';
  scheduleVersion?: number;
  targetSessionId?: string;
};

type ScheduledBatchTest = {
  id: string;
  teacherId?: string;
  title?: string;
  liveBatchId?: string;
  questionAccessLevel?: 'free' | 'paid';
  availabilityMode?: 'single_day' | 'unlimited';
  scheduledDate?: string;
  scheduledTime?: string;
  accessStartTime?: string;
  accessEndTime?: string;
  accessWindowStartAt?: { toDate?: () => Date } | Date | string;
  accessWindowEndAt?: { toDate?: () => Date } | Date | string;
  startTime?: { toDate?: () => Date } | Date | string;
  publicationStatus?: 'draft' | 'published';
  config?: {
    questionIds?: string[];
    subjectConfigs?: Array<{ questionAccessLevel?: 'free' | 'paid' }>;
  };
};
type ResolvedScheduledBatchTest = ScheduledBatchTest & {
  resolvedDate: string;
  resolvedTime: string;
};

type EnrolledBatchRecord = {
  id: string;
  batchId?: string;
  enrolledAt?: string;
  paidAt?: string;
  sessionsPurchased?: number;
  sessionFee?: number;
  totalSessionsInBatch?: number;
  amountPaid?: number;
  sessionPurchaseHistory?: LiveBatchSessionPurchaseHistoryItem[];
  manualSessionUnlockHistory?: LiveBatchManualSessionUnlockHistoryItem[];
  adminSessionRemovalHistory?: unknown;
  hiddenFromMyBatch?: boolean;
  hiddenFromMyBatchAt?: string | null;
  adminAccessDisabled?: boolean;
  adminAccessDisabledAt?: string | null;
};

type PurchasedBatchRecord = {
  id: string;
  batchId?: string;
  liveBatchId?: string;
  purchasedAt?: string;
  paidAt?: string;
  sessionsPurchased?: number;
  sessionFee?: number;
  totalSessionsInBatch?: number;
  amountPaid?: number;
  sessionPurchaseHistory?: LiveBatchSessionPurchaseHistoryItem[];
  manualSessionUnlockHistory?: LiveBatchManualSessionUnlockHistoryItem[];
  adminSessionRemovalHistory?: unknown;
  adminAccessDisabled?: boolean;
  adminAccessDisabledAt?: string | null;
};

type SubscriptionPlan = {
  id: string;
  linkedContentType?: 'course' | 'mock_test' | 'live_batch' | null;
  linkedContentId?: string | null;
  createdByTeacherId?: string;
  price?: number;
  sessionFee?: number;
  totalSessions?: number;
  numberOfLiveClasses?: number;
};

type ClassroomTimelineItem = {
  key: string;
  kind: 'meeting' | 'test';
  source: 'scheduled_meeting' | 'test';
  dateTime: Date;
  date: string;
  time: string;
  endTime?: string;
  title: string;
  subjectLabel?: string;
  zoomLink?: string;
  sessionId?: string;
  testId?: string;
  publicationStatus?: 'draft' | 'published';
};
type SubjectTimingRow = {
  dayName: string;
  dayShort: string;
  startTime: string;
  endTime?: string;
};
type SubjectTimingCard = {
  key: string;
  subjectName: string;
  plannedSessions: number;
  completedSessions: number;
  remainingSessions: number;
  slotsPerWeek: number;
  daysLabel: string;
  startsAtLabel: string;
  endsAtLabel: string;
  usesDayWiseTiming: boolean;
  dayRows: SubjectTimingRow[];
};
type AttemptHistoryItem = {
  studentId?: string;
  studentName?: string;
  score?: number;
  timeTaken?: number;
  submittedAt?: unknown;
};
type TestAnalyticsDoc = {
  attemptHistory?: AttemptHistoryItem[];
};
type ClassroomLeaderboardRow = {
  studentId: string;
  studentName: string;
  bestScore: number;
  bestTime: number;
  attempts: number;
  lastAttemptAt: Date | null;
  rank: number;
};
type ClassroomLeaderboardRankGroup = {
  rank: number;
  score: number;
  entries: ClassroomLeaderboardRow[];
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const DEFAULT_CONTENT_UNLOCK_LEAD_MINUTES = 10;
const MAX_CONTENT_UNLOCK_LEAD_MINUTES = 180;
type LiveBatchClassroomPageProps = {
  classroomOnly?: boolean;
};

const pad2 = (value: number) => String(value).padStart(2, '0');
const toLocalYmd = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const toLocalHm = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
const normalizeContentUnlockLeadMinutes = (value?: unknown) => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_CONTENT_UNLOCK_LEAD_MINUTES;
  return Math.min(MAX_CONTENT_UNLOCK_LEAD_MINUTES, Math.max(0, parsed));
};
const formatContentUnlockLeadLabel = (minutes: number) => (minutes === 0 ? 'At scheduled time' : `${minutes} min early`);

const parseYmdToLocalDate = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const asDate = (value?: string | Date | { toDate?: () => Date }) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  if (typeof value === 'object' && value && typeof value.toDate === 'function') {
    const dt = value.toDate();
    return dt instanceof Date && !Number.isNaN(dt.getTime()) ? dt : null;
  }
  return null;
};

const formatYmdForDisplay = (value?: string) => {
  const date = parseYmdToLocalDate(value);
  if (!date) return value || 'N/A';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const deriveFileNameFromUrl = (value?: string) => {
  const trimmedValue = String(value || '').trim();
  if (!trimmedValue) return '';

  try {
    const parsedUrl = new URL(trimmedValue);
    const lastPathSegment = decodeURIComponent(parsedUrl.pathname.split('/').filter(Boolean).pop() || '');
    return lastPathSegment || '';
  } catch {
    const sanitizedValue = trimmedValue.split('?')[0]?.split('#')[0] || '';
    return decodeURIComponent(sanitizedValue.split('/').filter(Boolean).pop() || '');
  }
};

const toMinutes = (value?: string) => {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return (hours * 60) + minutes;
};

const formatMinutesForDisplay = (value: number) => {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const formatTimeForDisplay = (value?: string) => {
  const minutes = toMinutes(value);
  if (minutes === null) return value || 'Time TBA';
  return formatMinutesForDisplay(minutes);
};

const parseYmdHmToLocalDateTime = (dateValue?: string, timeValue?: string) => {
  const date = parseYmdToLocalDate(dateValue);
  if (!date) return null;
  const normalizedTime = (timeValue && /^\d{1,2}:\d{2}$/.test(timeValue)) ? timeValue : '23:59';
  const [hours, minutes] = normalizedTime.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const getScheduledTestDateTime = (test: ScheduledBatchTest) => {
  let dateValue = test.scheduledDate || '';
  let timeValue = test.scheduledTime || '';

  if ((!dateValue || !timeValue) && test.startTime && test.availabilityMode !== 'unlimited') {
    const parsed = asDate(test.startTime);
    if (parsed) {
      if (!dateValue) dateValue = toLocalYmd(parsed);
      if (!timeValue) timeValue = toLocalHm(parsed);
    }
  }

  return { date: dateValue, time: timeValue };
};

const getYoutubeEmbedUrl = (raw?: string) => {
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace('/', '').trim();
      return id ? `https://www.youtube.com/embed/${id}` : '';
    }
    if (url.hostname.includes('youtube.com')) {
      const id = url.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : '';
    }
  } catch {
    return '';
  }
  return '';
};

export default function LiveBatchClassroomPage({ classroomOnly = false }: LiveBatchClassroomPageProps = {}) {
  const params = useParams<{ batchId: string }>();
  const batchId = typeof params?.batchId === 'string' ? params.batchId : '';
  const router = useRouter();
  const { user } = useUser();
  const { isTeacher } = useIsTeacher();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isRestoringToMyBatch, setIsRestoringToMyBatch] = useState(false);
  const [hasEnrolledNow, setHasEnrolledNow] = useState(false);
  const [requestedSessionsForPurchase, setRequestedSessionsForPurchase] = useState(1);
  const [showTeacherActivity, setShowTeacherActivity] = useState(false);
  const [latestTestLeaderboardRows, setLatestTestLeaderboardRows] = useState<ClassroomLeaderboardRow[]>([]);
  const [isLoadingLatestTestLeaderboard, setIsLoadingLatestTestLeaderboard] = useState(false);
  const [unlockingPreviousSessionKey, setUnlockingPreviousSessionKey] = useState<string | null>(null);
  const [editingPreviousSession, setEditingPreviousSession] = useState<SessionItem | null>(null);
  const [previousSessionEditDate, setPreviousSessionEditDate] = useState('');
  const [previousSessionEditTitle, setPreviousSessionEditTitle] = useState('');
  const [previousSessionEditVideoUrl, setPreviousSessionEditVideoUrl] = useState('');
  const [previousSessionEditNotesUrl, setPreviousSessionEditNotesUrl] = useState('');
  const [isSavingPreviousSessionEdit, setIsSavingPreviousSessionEdit] = useState(false);

  const batchRef = useMemoFirebase(() => (firestore && batchId ? doc(firestore, 'live_batches', batchId) : null), [firestore, batchId]);
  const enrollmentRef = useMemoFirebase(
    () => (firestore && user?.uid && batchId ? doc(firestore, 'users', user.uid, 'enrolled_live_batches', batchId) : null),
    [firestore, user?.uid, batchId]
  );
  const purchasedBatchRef = useMemoFirebase(
    () => (firestore && user?.uid && batchId ? doc(firestore, 'users', user.uid, 'purchased_live_batches', batchId) : null),
    [firestore, user?.uid, batchId]
  );
  const examTypesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types')) : null), [firestore]);
  const classesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes')) : null), [firestore]);
  const subjectsQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects')) : null), [firestore]);
  const sessionsQ = useMemoFirebase(
    () => (firestore && batchId ? query(collection(firestore, 'live_batch_sessions'), where('batchId', '==', batchId)) : null),
    [firestore, batchId]
  );
  const testsQ = useMemoFirebase(
    () => (firestore && batchId ? query(collection(firestore, 'mock_tests'), where('liveBatchId', '==', batchId)) : null),
    [firestore, batchId]
  );
  const subscriptionPlansQ = useMemoFirebase(
    () =>
      firestore && batchId
        ? query(
            collection(firestore, 'subscription_plans'),
            where('linkedContentType', '==', 'live_batch'),
            where('linkedContentId', '==', batchId)
          )
        : null,
    [firestore, batchId]
  );

  const { data: batch, isLoading: batchLoading } = useDoc<LiveBatch>(batchRef);
  const { data: enrollmentRecord, isLoading: enrollmentLoading } = useDoc<EnrolledBatchRecord>(enrollmentRef);
  const { data: purchasedBatchRecord, isLoading: purchasedBatchLoading } = useDoc<PurchasedBatchRecord>(purchasedBatchRef);
  const { data: examTypes } = useCollection<ExamType>(examTypesQ);
  const { data: classes } = useCollection<ClassItem>(classesQ);
  const { data: subjects } = useCollection<Subject>(subjectsQ);
  const { data: sessionsData, isLoading: sessionsLoading } = useCollection<SessionItem>(sessionsQ);
  const { data: scheduledTestsData, isLoading: testsLoading } = useCollection<ScheduledBatchTest>(testsQ);
  const { data: linkedPlanData, isLoading: linkedPlanLoading } = useCollection<SubscriptionPlan>(subscriptionPlansQ);
  const sessions = useMemo(() => sessionsData || [], [sessionsData]);
  const scheduledTests = useMemo(() => scheduledTestsData || [], [scheduledTestsData]);
  const isOwnerTeacher = Boolean(isTeacher && user?.uid && batch?.teacherId && user.uid === batch.teacherId);
  const contentUnlockLeadMinutes = normalizeContentUnlockLeadMinutes(batch?.contentUnlockLeadMinutes);
  const contentUnlockLeadLabel = formatContentUnlockLeadLabel(contentUnlockLeadMinutes);
  const contentUnlockLeadMs = contentUnlockLeadMinutes * 60 * 1000;
  const scheduledTestMinimumStudentsRequiredById = useMemo(
    () => Object.fromEntries(scheduledTests.map((test) => [test.id, 1])),
    [scheduledTests]
  );
  const scheduledTestReferenceTimeById = useMemo(
    () => Object.fromEntries(
      scheduledTests.map((test) => [
        test.id,
        getLiveBatchTestTeacherQuestionAccessCheckAt({
          test,
          contentUnlockLeadMinutes,
          now: new Date(),
        }),
      ])
    ),
    [contentUnlockLeadMinutes, scheduledTests]
  );
  const { accessMap: scheduledBatchTestAccessMap } = useTeacherPremiumQuestionTestAccessMap(
    firestore,
    scheduledTests,
    scheduledTestMinimumStudentsRequiredById,
    scheduledTestReferenceTimeById
  );
  const effectiveEnrollmentRecord = useMemo<EnrolledBatchRecord | null>(() => {
    if (enrollmentRecord) return enrollmentRecord;
    if (!purchasedBatchRecord) return null;

    return {
      id: purchasedBatchRecord.id,
      batchId: purchasedBatchRecord.batchId || purchasedBatchRecord.liveBatchId || batchId,
      enrolledAt: purchasedBatchRecord.purchasedAt || purchasedBatchRecord.paidAt || '',
      paidAt: purchasedBatchRecord.paidAt || purchasedBatchRecord.purchasedAt || '',
      sessionsPurchased: purchasedBatchRecord.sessionsPurchased,
      sessionFee: purchasedBatchRecord.sessionFee,
      totalSessionsInBatch: purchasedBatchRecord.totalSessionsInBatch,
      amountPaid: purchasedBatchRecord.amountPaid,
      sessionPurchaseHistory: purchasedBatchRecord.sessionPurchaseHistory,
      adminSessionRemovalHistory: purchasedBatchRecord.adminSessionRemovalHistory,
      manualSessionUnlockHistory: purchasedBatchRecord.manualSessionUnlockHistory,
      hiddenFromMyBatch: false,
      hiddenFromMyBatchAt: null,
      adminAccessDisabled: purchasedBatchRecord.adminAccessDisabled,
      adminAccessDisabledAt: purchasedBatchRecord.adminAccessDisabledAt,
    };
  }, [batchId, enrollmentRecord, purchasedBatchRecord]);
  const todayYmd = useMemo(() => toLocalYmd(new Date()), []);
  const examNameById = useMemo(() => Object.fromEntries((examTypes || []).map((e) => [e.id, e.name])), [examTypes]);
  const classNameById = useMemo(() => Object.fromEntries((classes || []).map((c) => [c.id, c.name])), [classes]);
  const subjectNameById = useMemo(() => Object.fromEntries((subjects || []).map((s) => [s.id, s.name])), [subjects]);
  const subjectIdByNormalizedName = useMemo(() => {
    const map = new Map<string, string>();
    (subjects || []).forEach((subject) => {
      const key = subject.name?.trim().toLowerCase();
      if (!key || map.has(key)) return;
      map.set(key, subject.id);
    });
    return map;
  }, [subjects]);
  const getMeetingSubjectLabel = (session: SessionItem) => {
    if (session.subjectName) return session.subjectName;
    if (session.subjectId && subjectNameById[session.subjectId]) return subjectNameById[session.subjectId];
    return 'All Subjects';
  };
  const getResolvedMeetingTitle = (meetingTitle?: string, subjectLabel?: string) => {
    const normalizedTitle = (meetingTitle || '').trim();
    if (normalizedTitle && !['daily live session', 'live session'].includes(normalizedTitle.toLowerCase())) {
      return normalizedTitle;
    }
    const normalizedSubject = (subjectLabel || '').trim();
    return normalizedSubject ? `${normalizedSubject} Live Session` : 'Live Session';
  };

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        const keyA = `${a.date || ''} ${a.meetingTime || ''}`;
        const keyB = `${b.date || ''} ${b.meetingTime || ''}`;
        return keyA.localeCompare(keyB);
      }),
    [sessions]
  );
  const sessionResolution = useMemo(
    () => resolveLiveBatchSessions({ sessions: sortedSessions, batch }),
    [batch, sortedSessions]
  );
  const effectiveMeetingSessions = sessionResolution.effectiveMeetings;
  const upcomingMeetings = sessionResolution.upcomingMeetings;
  const conductedMeetingSessions = sessionResolution.conductedMeetings;
  const visiblePreviousSessions = sessionResolution.visiblePreviousSessions;
  const conductedPreviousSessionDateOptions = useMemo(
    () =>
      getConductedLiveBatchSessionDateOptions({
        sessions: sortedSessions,
        batch,
        now: new Date(),
        scheduleLookbackMonths: 6,
      }).map((option) => ({
        ...option,
        subjectName: option.subjectName || (option.subjectId ? (subjectNameById[option.subjectId] || option.subjectId) : ''),
      })),
    [batch, sortedSessions, subjectNameById]
  );
  const editingPreviousSessionSubjectId = useMemo(() => {
    if (!editingPreviousSession) return '';
    if (editingPreviousSession.subjectId) return editingPreviousSession.subjectId;
    const batchSubjectIds = batch?.subjectIds || [];
    return batchSubjectIds.length === 1 ? (batchSubjectIds[0] || '') : '';
  }, [batch?.subjectIds, editingPreviousSession]);
  const previousSessionEditDateOptions = useMemo(() => {
    const normalizedSubjectId = editingPreviousSessionSubjectId.trim();
    if (!normalizedSubjectId) return conductedPreviousSessionDateOptions;
    return conductedPreviousSessionDateOptions.filter((option) => (option.subjectId || '').trim() === normalizedSubjectId);
  }, [conductedPreviousSessionDateOptions, editingPreviousSessionSubjectId]);
  const selectedPreviousSessionEditDateOption = useMemo(
    () => previousSessionEditDateOptions.find((option) => option.date === previousSessionEditDate) || null,
    [previousSessionEditDate, previousSessionEditDateOptions]
  );

  const scheduledBatchTests = useMemo(
    () =>
      scheduledTests
        .map((test) => {
          const resolved = getScheduledTestDateTime(test);
          return {
            ...test,
            resolvedDate: resolved.date,
            resolvedTime: resolved.time,
          };
        })
        .sort((a, b) => `${a.resolvedDate || ''} ${a.resolvedTime || ''}`.localeCompare(`${b.resolvedDate || ''} ${b.resolvedTime || ''}`)),
    [scheduledTests]
  ) as ResolvedScheduledBatchTest[];
  const visibleScheduledBatchTests = useMemo(
    () => (
      isOwnerTeacher
        ? scheduledBatchTests
        : scheduledBatchTests.filter((test) => {
            const accessState = scheduledBatchTestAccessMap[test.id];
            return !accessState?.isProtected || accessState.isAccessible;
          })
    ),
    [isOwnerTeacher, scheduledBatchTests, scheduledBatchTestAccessMap]
  );
  const upcomingClassroomItems = useMemo(() => {
    const now = Date.now();
    const items: ClassroomTimelineItem[] = [];

    upcomingMeetings.forEach((meeting) => {
      const meetingDateTime = parseYmdHmToLocalDateTime(meeting.date, meeting.meetingTime);
      if (!meetingDateTime || meetingDateTime.getTime() < now) return;
      const subjectLabel = getMeetingSubjectLabel(meeting);
      items.push({
        key: `meeting-${meeting.id}`,
        kind: 'meeting',
        source: 'scheduled_meeting',
        dateTime: meetingDateTime,
        date: meeting.date || '',
        time: meeting.meetingTime || '',
        endTime: meeting.meetingEndTime || '',
        title: getResolvedMeetingTitle(meeting.meetingTitle, subjectLabel),
        subjectLabel,
        zoomLink: meeting.zoomLink,
        sessionId: meeting.id,
      });
    });

    visibleScheduledBatchTests.forEach((test) => {
      const testDateTime = parseYmdHmToLocalDateTime(test.resolvedDate, test.resolvedTime);
      if (!testDateTime || testDateTime.getTime() < now) return;
      if (!isTeacher && test.publicationStatus === 'draft') return;
      items.push({
        key: `test-${test.id}`,
        kind: 'test',
        source: 'test',
        dateTime: testDateTime,
        date: test.resolvedDate,
        time: test.resolvedTime,
        title: test.title || 'Live Batch Test',
        testId: test.id,
        publicationStatus: test.publicationStatus,
      });
    });

    return items.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()).slice(0, 16);
  }, [isTeacher, upcomingMeetings, visibleScheduledBatchTests]);

  const latestCompletedBatchTest = useMemo(() => {
    const nowMs = Date.now();
    return (
      visibleScheduledBatchTests
        .map((test) => ({
          test,
          dateTime: parseYmdHmToLocalDateTime(test.resolvedDate, test.resolvedTime),
        }))
        .filter(
          (item): item is { test: ResolvedScheduledBatchTest; dateTime: Date } =>
            !!item.dateTime && item.dateTime.getTime() <= nowMs && item.test.publicationStatus !== 'draft'
        )
        .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime())[0]?.test || null
    );
  }, [visibleScheduledBatchTests]);
  const nextScheduledClassroomItem = upcomingClassroomItems[0] || null;
  const teacherPastClassroomItems = useMemo(() => {
    if (!isOwnerTeacher) return [] as ClassroomTimelineItem[];

    const now = Date.now();
    const items: ClassroomTimelineItem[] = [];

    conductedMeetingSessions.forEach((session) => {
      if (session.dateTime.getTime() > now) return;
      const subjectLabel = session.subjectName || session.subjectId || 'Class';
      items.push({
        key: `past-meeting-${session.id}`,
        kind: 'meeting',
        source: 'scheduled_meeting',
        dateTime: session.dateTime,
        date: session.date || '',
        time: session.meetingTime || '',
        endTime: session.meetingEndTime || '',
        title: getResolvedMeetingTitle(session.meetingTitle, subjectLabel),
        subjectLabel,
        zoomLink: session.zoomLink,
        sessionId: session.sessionId || session.id,
      });
    });

    visibleScheduledBatchTests.forEach((test) => {
      const testDateTime = parseYmdHmToLocalDateTime(test.resolvedDate, test.resolvedTime);
      if (!testDateTime || testDateTime.getTime() > now) return;
      items.push({
        key: `past-test-${test.id}`,
        kind: 'test',
        source: 'test',
        dateTime: testDateTime,
        date: test.resolvedDate,
        time: test.resolvedTime,
        title: test.title || 'Live Batch Test',
        testId: test.id,
        publicationStatus: test.publicationStatus,
      });
    });

    return items.sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime()).slice(0, 16);
  }, [conductedMeetingSessions, isOwnerTeacher, visibleScheduledBatchTests]);

  const linkedLiveBatchPlan = useMemo(() => {
    const plans = linkedPlanData || [];
    if (plans.length === 0) return null;
    if (batch?.teacherId) {
      const teacherPlan = plans.find((plan) => !plan.createdByTeacherId || plan.createdByTeacherId === batch.teacherId);
      if (teacherPlan) return teacherPlan;
    }
    return plans[0];
  }, [linkedPlanData, batch?.teacherId]);
  const subjectSessionCountMap = useMemo(
    () =>
      buildSubjectSessionCountMap({
        subjectIds: batch?.subjectIds || [],
        subjectSchedules: batch?.subjectSchedules || [],
        fallbackTotalSessions: batch?.totalSessions ?? linkedLiveBatchPlan?.totalSessions ?? linkedLiveBatchPlan?.numberOfLiveClasses ?? 0,
      }),
    [batch?.subjectIds, batch?.subjectSchedules, batch?.totalSessions, linkedLiveBatchPlan?.numberOfLiveClasses, linkedLiveBatchPlan?.totalSessions]
  );
  const totalPlannedSessions = useMemo(
    () => Object.values(subjectSessionCountMap).reduce((sum, count) => sum + normalizeSubjectSessionCount(count), 0),
    [subjectSessionCountMap]
  );
  const resolvedTotalSessions = totalPlannedSessions > 0
    ? totalPlannedSessions
    : Number(batch?.totalSessions ?? linkedLiveBatchPlan?.totalSessions ?? linkedLiveBatchPlan?.numberOfLiveClasses ?? 0);

  const totalSessionsInBatch = Math.max(0, resolvedTotalSessions);
  const completedMeetingCountBySubjectId = useMemo(() => {
    const map: Record<string, number> = {};
    const batchSubjectIds = batch?.subjectIds || [];
    const fallbackSubjectId = batchSubjectIds.length === 1 ? (batchSubjectIds[0] || '') : '';

    conductedMeetingSessions.forEach((session) => {
      const directSubjectId = typeof session.subjectId === 'string' ? session.subjectId.trim() : '';
      const subjectNameKey = typeof session.subjectName === 'string' ? session.subjectName.trim().toLowerCase() : '';
      const resolvedSubjectId =
        directSubjectId
        || (subjectNameKey ? (subjectIdByNormalizedName.get(subjectNameKey) || '') : '')
        || fallbackSubjectId;
      if (!resolvedSubjectId) return;
      map[resolvedSubjectId] = (map[resolvedSubjectId] || 0) + 1;
    });

    return map;
  }, [batch?.subjectIds, conductedMeetingSessions, subjectIdByNormalizedName]);
  const conductedMeetingsInBatch = conductedMeetingSessions.length;
  const batchRemainingSessions = totalSessionsInBatch > 0
    ? Math.max(0, totalSessionsInBatch - conductedMeetingsInBatch)
    : 0;
  const perSessionFee = Math.max(
    0,
    Number(linkedLiveBatchPlan?.sessionFee ?? linkedLiveBatchPlan?.price ?? 0)
  );

  const normalizedRequestedSessions = Math.max(1, Math.floor(Number(requestedSessionsForPurchase || 1)));

  const liveBatchSessionCoverage = useMemo(
    () => calculateLiveBatchSessionCoverage({
      sessions: sortedSessions,
      batch,
          enrollment: effectiveEnrollmentRecord
        ? {
            paidAt: effectiveEnrollmentRecord.paidAt,
            enrolledAt: effectiveEnrollmentRecord.enrolledAt,
            sessionsPurchased: effectiveEnrollmentRecord.sessionsPurchased,
            sessionPurchaseHistory: effectiveEnrollmentRecord.sessionPurchaseHistory,
            adminSessionRemovalHistory: effectiveEnrollmentRecord.adminSessionRemovalHistory,
            manualSessionUnlockHistory: effectiveEnrollmentRecord.manualSessionUnlockHistory,
          }
        : null,
    }),
    [
      batch,
      effectiveEnrollmentRecord?.enrolledAt,
      effectiveEnrollmentRecord?.adminSessionRemovalHistory,
      effectiveEnrollmentRecord?.manualSessionUnlockHistory,
      effectiveEnrollmentRecord?.paidAt,
      effectiveEnrollmentRecord?.sessionPurchaseHistory,
      effectiveEnrollmentRecord?.sessionsPurchased,
      sortedSessions,
    ]
  );
  const purchasedSessions = liveBatchSessionCoverage.totalPurchasedSessions;
  const remainingPaidSessions = liveBatchSessionCoverage.remainingSessions;
  const consumedPaidSessions = liveBatchSessionCoverage.consumedSessions;
  const manuallyUnlockedPaidSessions = liveBatchSessionCoverage.manualUnlockConsumedSessions;
  const hasPaidTokenHistory = purchasedSessions > 0;
  const isAdminDisabledEnrollment = Boolean(effectiveEnrollmentRecord?.adminAccessDisabled);
  const recentConductedMeetings = useMemo(() => {
    return [...liveBatchSessionCoverage.coveredConductedMeetings].slice(-8).reverse();
  }, [liveBatchSessionCoverage.coveredConductedMeetings]);
  const maxPurchasableSessions = totalSessionsInBatch > 0 ? batchRemainingSessions : 0;
  const accessRecordLoading = enrollmentLoading || purchasedBatchLoading;
  const isEnrolledForAccess = Boolean(hasEnrolledNow || effectiveEnrollmentRecord);
  const hasClassroomAccessForViewer = Boolean(
    isTeacher
    || (!isAdminDisabledEnrollment && batch?.accessLevel === 'free' && isEnrolledForAccess)
    || (!isAdminDisabledEnrollment && batch?.accessLevel === 'paid' && isEnrolledForAccess && hasPaidTokenHistory)
  );

  useEffect(() => {
    setRequestedSessionsForPurchase((current) => {
      const cappedMax = maxPurchasableSessions > 0 ? maxPurchasableSessions : 1;
      return Math.max(1, Math.min(current, cappedMax));
    });
  }, [maxPurchasableSessions]);

  const invalidRequestedSessionMessage = useMemo(() => {
    if (totalSessionsInBatch <= 0) {
      return 'This live batch does not have total sessions configured yet. Please contact the teacher.';
    }
    if (maxPurchasableSessions <= 0) {
      return 'No sessions are left in this batch to purchase.';
    }
    if (normalizedRequestedSessions > maxPurchasableSessions) {
      return `Invalid input: you requested ${normalizedRequestedSessions} sessions, but only ${maxPurchasableSessions} sessions are left in this batch.`;
    }
    return '';
  }, [maxPurchasableSessions, normalizedRequestedSessions, totalSessionsInBatch]);
  const payableAmountForSelection = Number((normalizedRequestedSessions * perSessionFee).toFixed(2));

  const previousSessionTimeline = useMemo(
    () =>
      visiblePreviousSessions
        .sort((a, b) => `${b.date || ''} ${b.meetingTime || ''}`.localeCompare(`${a.date || ''} ${a.meetingTime || ''}`))
        .slice(0, 20),
    [visiblePreviousSessions]
  );
  const previousSessionMeetingByKey = useMemo(() => {
    const map = new Map<string, (typeof effectiveMeetingSessions)[number]>();
    effectiveMeetingSessions.forEach((session) => {
      if (!session.date) return;
      const subjectId = (session.subjectId || '').trim();
      const subjectNameKey = (session.subjectName || '').trim().toLowerCase();
      const meetingTime = (session.meetingTime || '').trim();

      const candidateKeys = [
        subjectId ? `${session.date}__subject-id__${subjectId}` : '',
        subjectNameKey ? `${session.date}__subject-name__${subjectNameKey}` : '',
        meetingTime ? `${session.date}__meeting-time__${meetingTime}` : '',
      ].filter(Boolean);

      candidateKeys.forEach((key) => {
        if (!map.has(key)) {
          map.set(key, session);
        }
      });
    });
    return map;
  }, [effectiveMeetingSessions]);
  const getMatchedMeetingForPreviousSession = (session: SessionItem) => {
    if (!session?.date) return null;
    const subjectId = (session.subjectId || '').trim();
    const subjectNameKey = (session.subjectName || '').trim().toLowerCase();
    const meetingTime = (session.meetingTime || '').trim();

    return (
      previousSessionMeetingByKey.get(`${session.date}__subject-id__${subjectId}`)
      || previousSessionMeetingByKey.get(`${session.date}__subject-name__${subjectNameKey}`)
      || previousSessionMeetingByKey.get(`${session.date}__meeting-time__${meetingTime}`)
      || null
    );
  };
  const getPreviousSessionDisplayTitle = (session: SessionItem) => {
    const subjectLabel =
      session.subjectName
      || (session.subjectId ? (subjectNameById[session.subjectId] || session.subjectId) : '')
      || 'Class';
    const explicitTitle = (session.sessionLabel || '').trim();
    if (explicitTitle) return getResolvedMeetingTitle(explicitTitle, subjectLabel);
    const matchedMeeting = getMatchedMeetingForPreviousSession(session);
    const matchedMeetingTitle = (matchedMeeting?.meetingTitle || '').trim();
    if (matchedMeetingTitle) return getResolvedMeetingTitle(matchedMeetingTitle, subjectLabel);
    return session.date ? `${subjectLabel} Session - ${session.date}` : `${subjectLabel} Session`;
  };
  const getPreviousSessionDisplayTimeWindow = (session: SessionItem) => {
    const matchedMeeting = getMatchedMeetingForPreviousSession(session);
    const startTime = (session.meetingTime || matchedMeeting?.meetingTime || '').trim();
    const endTime = (session.meetingEndTime || matchedMeeting?.meetingEndTime || '').trim();
    return {
      startTime,
      endTime: endTime || startTime,
    };
  };
  const getPreviousSessionDisplayTime = (session: SessionItem) => {
    return getPreviousSessionDisplayTimeWindow(session).startTime;
  };
  const getPreviousSessionDisplayEndTime = (session: SessionItem) => {
    return getPreviousSessionDisplayTimeWindow(session).endTime;
  };
  const getPreviousSessionDisplayTimeLabel = (session: SessionItem) => {
    const startTime = getPreviousSessionDisplayTime(session);
    const endTime = getPreviousSessionDisplayEndTime(session);
    if (!startTime) return '';

    const formattedStartTime = formatTimeForDisplay(startTime);
    if (!endTime || endTime === startTime) return formattedStartTime;
    return `${formattedStartTime} to ${formatTimeForDisplay(endTime)}`;
  };
  const getPreviousSessionAccessKey = (session: SessionItem) => {
    return getLiveBatchPreviousSessionAccessKey({
      date: session.date,
      subjectId: session.subjectId,
      subjectName: session.subjectName,
      meetingTime: getPreviousSessionDisplayTime(session),
    }, batch);
  };
  const openPreviousSessionEditor = (session: SessionItem) => {
    setEditingPreviousSession(session);
    setPreviousSessionEditDate(String(session.date || '').trim());
    setPreviousSessionEditTitle((session.sessionLabel || getPreviousSessionDisplayTitle(session)).trim());
    setPreviousSessionEditVideoUrl(String(session.previousSessionUrl || '').trim());
    setPreviousSessionEditNotesUrl(String(session.notesFileUrl || '').trim());
  };
  const closePreviousSessionEditor = () => {
    if (isSavingPreviousSessionEdit) return;
    setEditingPreviousSession(null);
    setPreviousSessionEditDate('');
    setPreviousSessionEditTitle('');
    setPreviousSessionEditVideoUrl('');
    setPreviousSessionEditNotesUrl('');
  };
  const handleSavePreviousSessionEdit = async () => {
    if (!firestore || !editingPreviousSession?.id) return;

    const nextDate = previousSessionEditDate.trim();
    const conductedDateOption = selectedPreviousSessionEditDateOption;
    if (!conductedDateOption || conductedDateOption.date !== nextDate) {
      toast({
        variant: 'destructive',
        title: 'Pick a conducted session date',
        description: 'Previous sessions can be moved only to completed dates from this live batch schedule.',
      });
      return;
    }

    const nextSubjectId = conductedDateOption.subjectId || editingPreviousSession.subjectId || '';
    const nextSubjectName =
      conductedDateOption.subjectName
      || (nextSubjectId ? (subjectNameById[nextSubjectId] || nextSubjectId) : '')
      || editingPreviousSession.subjectName
      || '';
    const nextMeetingTime = conductedDateOption.meetingTime || editingPreviousSession.meetingTime || '';
    const nextMeetingEndTime =
      conductedDateOption.meetingEndTime
      || editingPreviousSession.meetingEndTime
      || nextMeetingTime;
    const resolvedTitle =
      previousSessionEditTitle.trim()
      || conductedDateOption.meetingTitle?.trim()
      || getPreviousSessionDisplayTitle(editingPreviousSession);
    const nextVideoUrl = previousSessionEditVideoUrl.trim();
    const nextNotesUrl = previousSessionEditNotesUrl.trim();
    const currentNotesUrl = String(editingPreviousSession.notesFileUrl || '').trim();
    const nextNotesFileName = nextNotesUrl
      ? (
        nextNotesUrl === currentNotesUrl
          ? (editingPreviousSession.notesFileName || deriveFileNameFromUrl(nextNotesUrl) || 'Class Notes')
          : (deriveFileNameFromUrl(nextNotesUrl) || editingPreviousSession.notesFileName || 'Class Notes')
      )
      : null;

    setIsSavingPreviousSessionEdit(true);
    try {
      await updateDoc(doc(firestore, 'live_batch_sessions', editingPreviousSession.id), {
        date: nextDate,
        subjectId: nextSubjectId || null,
        subjectName: nextSubjectName || null,
        meetingTime: nextMeetingTime || null,
        meetingEndTime: nextMeetingEndTime || nextMeetingTime || null,
        sessionLabel: resolvedTitle,
        meetingTitle: resolvedTitle,
        previousSessionUrl: nextVideoUrl || null,
        notesFileUrl: nextNotesUrl || null,
        notesFileName: nextNotesFileName,
        notesFileType: nextNotesUrl && nextNotesUrl === currentNotesUrl ? (editingPreviousSession.notesFileType || null) : null,
        notesFileSize: nextNotesUrl && nextNotesUrl === currentNotesUrl ? (editingPreviousSession.notesFileSize ?? null) : null,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Previous session updated',
        description: 'The title, video link, and notes link were saved successfully.',
      });
      closePreviousSessionEditor();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error?.message || 'Could not update this previous session right now.',
      });
    } finally {
      setIsSavingPreviousSessionEdit(false);
    }
  };
  const canAccessPreviousSessionByCoverage = (session: SessionItem) => {
    if (isTeacher || !isPaidBatch || !isEnrolled) return true;
    if (!session?.date) return false;
    if (liveBatchSessionCoverage.purchases.length === 0) return false;

    const sessionId = String(session.id || '').trim();
    const sessionAccessKey = getPreviousSessionAccessKey(session);
    if (sessionId && liveBatchSessionCoverage.unlockedPreviousSessionIds.has(sessionId)) return true;
    if (liveBatchSessionCoverage.unlockedPreviousSessionAccessKeys.has(sessionAccessKey)) return true;

    const matchedMeeting = getMatchedMeetingForPreviousSession(session);
    if (matchedMeeting?.date) {
      const matchedMeetingKey = `${matchedMeeting.date} ${matchedMeeting.meetingTime || ''}`;
      if (matchedMeeting.id && liveBatchSessionCoverage.coveredMeetingIds.has(String(matchedMeeting.id))) return true;
      if (liveBatchSessionCoverage.coveredMeetingDateTimeKeys.has(matchedMeetingKey)) return true;

      const matchedMeetingTimeMinutes = toMinutes(matchedMeeting.meetingTime);
      if (matchedMeetingTimeMinutes !== null) {
        return liveBatchSessionCoverage.coveredConductedMeetings.some((meeting) =>
          meeting.date === matchedMeeting.date && toMinutes(meeting.meetingTime) === matchedMeetingTimeMinutes
        );
      }

      return liveBatchSessionCoverage.coveredMeetingDateKeys.has(matchedMeeting.date);
    }

    const meetingTimeMinutes = toMinutes(session.meetingTime);
    if (meetingTimeMinutes !== null) {
      return liveBatchSessionCoverage.coveredConductedMeetings.some((meeting) =>
        meeting.date === session.date && toMinutes(meeting.meetingTime) === meetingTimeMinutes
      );
    }

    return liveBatchSessionCoverage.coveredMeetingDateKeys.has(session.date);
  };

  const classroomLeaderboardRankGroups = useMemo(() => {
    const grouped = new Map<number, ClassroomLeaderboardRankGroup>();
    latestTestLeaderboardRows.forEach((row) => {
      const existing = grouped.get(row.rank);
      if (existing) {
        existing.entries.push(row);
        return;
      }
      grouped.set(row.rank, {
        rank: row.rank,
        score: row.bestScore,
        entries: [row],
      });
    });
    return Array.from(grouped.values()).sort((a, b) => a.rank - b.rank);
  }, [latestTestLeaderboardRows]);

  useEffect(() => {
    let cancelled = false;
    const loadLatestTestLeaderboard = async () => {
      if (!firestore || !classroomOnly || !hasClassroomAccessForViewer || !latestCompletedBatchTest?.id) {
        if (!cancelled) {
          setLatestTestLeaderboardRows((current) => (current.length === 0 ? current : []));
          setIsLoadingLatestTestLeaderboard(false);
        }
        return;
      }

      setIsLoadingLatestTestLeaderboard(true);
      try {
        const analyticsSnap = await getDoc(doc(firestore, 'test_analytics', latestCompletedBatchTest.id));
        const analytics = analyticsSnap.exists() ? (analyticsSnap.data() as TestAnalyticsDoc) : null;
        const source = Array.isArray(analytics?.attemptHistory) ? analytics.attemptHistory : [];
        const byStudent = new Map<
          string,
          Omit<ClassroomLeaderboardRow, 'rank'> & {
            bestAttemptAtMs: number;
          }
        >();

        source.forEach((item) => {
          const studentKey = String(item.studentId || item.studentName || 'student');
          const studentName = item.studentName || 'Student';
          const score = Number(item.score || 0);
          const timeTaken = Number(item.timeTaken || 0);
          const attemptAt = asDate(item.submittedAt as any) || null;
          const attemptAtMs = attemptAt ? attemptAt.getTime() : 0;
          const existing = byStudent.get(studentKey);
          if (!existing) {
            byStudent.set(studentKey, {
              studentId: item.studentId || '',
              studentName,
              bestScore: score,
              bestTime: timeTaken,
              attempts: 1,
              lastAttemptAt: attemptAt,
              bestAttemptAtMs: attemptAtMs,
            });
            return;
          }

          const betterScore = score > existing.bestScore;
          const sameScoreBetterTime = score === existing.bestScore && timeTaken < existing.bestTime;
          const betterAttemptForTie = score === existing.bestScore && timeTaken === existing.bestTime && attemptAtMs > existing.bestAttemptAtMs;

          byStudent.set(studentKey, {
            studentId: existing.studentId || item.studentId || '',
            studentName: existing.studentName || studentName,
            bestScore: betterScore ? score : existing.bestScore,
            bestTime: betterScore || sameScoreBetterTime ? timeTaken : existing.bestTime,
            attempts: existing.attempts + 1,
            lastAttemptAt:
              attemptAt && (!existing.lastAttemptAt || attemptAt.getTime() > existing.lastAttemptAt.getTime())
                ? attemptAt
                : existing.lastAttemptAt,
            bestAttemptAtMs:
              betterScore || sameScoreBetterTime || betterAttemptForTie
                ? attemptAtMs
                : existing.bestAttemptAtMs,
          });
        });

        const sortedRows = Array.from(byStudent.values())
          .sort((a, b) => {
            if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
            if (a.bestTime !== b.bestTime) return a.bestTime - b.bestTime;
            return b.bestAttemptAtMs - a.bestAttemptAtMs;
          })
          .slice(0, 30);

        let rankCounter = 0;
        let previousScore: number | null = null;
        const withRank: ClassroomLeaderboardRow[] = sortedRows.map((row, index) => {
          if (previousScore === null || row.bestScore !== previousScore) {
            rankCounter = index + 1;
            previousScore = row.bestScore;
          }
          return {
            studentId: row.studentId,
            studentName: row.studentName,
            bestScore: row.bestScore,
            bestTime: row.bestTime,
            attempts: row.attempts,
            lastAttemptAt: row.lastAttemptAt,
            rank: rankCounter,
          };
        });

        if (!cancelled) {
          setLatestTestLeaderboardRows(withRank);
        }
      } catch {
        if (!cancelled) {
          setLatestTestLeaderboardRows([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLatestTestLeaderboard(false);
        }
      }
    };

    loadLatestTestLeaderboard();
    return () => {
      cancelled = true;
    };
  }, [classroomOnly, firestore, hasClassroomAccessForViewer, latestCompletedBatchTest?.id]);

  const handleEnroll = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!firestore || !batchId || !batch) return;

    setIsEnrolling(true);
    try {
      await setDocumentNonBlocking(
        doc(firestore, 'users', user.uid, 'enrolled_live_batches', batchId),
        {
          batchId,
          title: batch.title || 'Live Batch',
          teacherId: batch.teacherId || '',
          teacherName: batch.teacherName || '',
          accessLevel: batch.accessLevel || 'free',
          enrolledAt: new Date().toISOString(),
          hiddenFromMyBatch: false,
          hiddenFromMyBatchAt: null,
          adminAccessDisabled: false,
          adminAccessDisabledAt: null,
        },
        { merge: true }
      );
      await sendSelfBellNotification(user, {
        title: 'Congratulations on joining the live batch',
        message: `${batch.title || 'This live batch'} is now available in My Batch.`,
        href: `/live-batches/${batchId}`,
        notificationType: 'live_batch_enrolled',
        dedupeKey: `live-batch-enroll:${batchId}`,
        contentType: 'live_batch',
        contentId: batchId,
        teacherId: batch.teacherId || undefined,
        batchId,
        liveBatchId: batchId,
        accessLevel: batch.accessLevel || 'free',
      });
      setHasEnrolledNow(true);
      toast({ title: 'Enrolled successfully', description: 'You can now enter the classroom and track sessions.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Enroll failed', description: error?.message || 'Could not enroll right now.' });
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleRestoreToMyBatch = async () => {
    if (!firestore || !user?.uid || !batchId || !enrollmentRecord) return;
    if (enrollmentRecord.adminAccessDisabled) {
      toast({
        variant: 'destructive',
        title: 'Batch access is disabled',
        description: 'An admin removed this batch access. Add-back is not available until tokens are reassigned.',
      });
      return;
    }

    setIsRestoringToMyBatch(true);
    try {
      await updateDoc(
        doc(firestore, 'users', user.uid, 'enrolled_live_batches', batchId),
        {
          hiddenFromMyBatch: false,
          hiddenFromMyBatchAt: null,
        }
      );
      toast({
        title: 'Added back to My Batch',
        description: 'This batch will appear again in your My Batch list.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not restore batch',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setIsRestoringToMyBatch(false);
    }
  };

  const handleUnlockPreviousSession = async (session: SessionItem) => {
    if (!firestore || !user?.uid || !batchId || !isPaidBatch || !isEnrolled) return;
    if (canAccessPreviousSessionByCoverage(session)) return;

    const sessionId = String(session.id || '').trim();
    const sessionAccessKey = getPreviousSessionAccessKey(session);
    setUnlockingPreviousSessionKey(sessionAccessKey);

    try {
      await runTransaction(firestore, async (transaction) => {
        const enrollmentDocRef = doc(firestore, 'users', user.uid, 'enrolled_live_batches', batchId);
        const enrollmentSnap = await transaction.get(enrollmentDocRef);
        if (!enrollmentSnap.exists()) {
          throw new Error('Enrollment record was not found.');
        }

        const liveEnrollment = enrollmentSnap.data() as EnrolledBatchRecord;
        const manualUnlockHistory = Array.isArray(liveEnrollment.manualSessionUnlockHistory)
          ? liveEnrollment.manualSessionUnlockHistory
          : [];

        const alreadyUnlocked = manualUnlockHistory.some((entry) =>
          (sessionId && String(entry?.sessionId || '').trim() === sessionId)
          || String(entry?.sessionAccessKey || '').trim() === sessionAccessKey
        );
        if (alreadyUnlocked) return;

        const liveCoverage = calculateLiveBatchSessionCoverage({
          sessions: sortedSessions,
          batch,
          enrollment: {
            paidAt: liveEnrollment.paidAt,
            enrolledAt: liveEnrollment.enrolledAt,
            sessionsPurchased: liveEnrollment.sessionsPurchased,
            sessionPurchaseHistory: liveEnrollment.sessionPurchaseHistory,
            adminSessionRemovalHistory: liveEnrollment.adminSessionRemovalHistory,
            manualSessionUnlockHistory: manualUnlockHistory,
          },
        });

        if (liveCoverage.remainingSessions <= 0) {
          throw new Error('No session tokens are left to unlock this previous class.');
        }

        const unlockEntry: LiveBatchManualSessionUnlockHistoryItem = {
          unlockedAt: new Date().toISOString(),
          sessionId: sessionId || undefined,
          sessionAccessKey,
          sessionLabel: getPreviousSessionDisplayTitle(session),
          meetingDate: session.date || '',
          meetingTime: getPreviousSessionDisplayTime(session) || '',
          subjectId: session.subjectId || '',
          subjectName: session.subjectName || '',
        };

        transaction.set(
          enrollmentDocRef,
          {
            manualSessionUnlockHistory: [...manualUnlockHistory, unlockEntry],
          },
          { merge: true }
        );
      });

      toast({
        title: 'Previous session unlocked',
        description: '1 session token was used to unlock this recording and notes.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not unlock session',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setUnlockingPreviousSessionKey((current) => (current === sessionAccessKey ? null : current));
    }
  };

  const handlePaidCheckout = () => {
    if (!batchId) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!linkedLiveBatchPlan?.id) {
      toast({
        variant: 'destructive',
        title: 'Plan not available',
        description: 'No subscription plan is attached to this batch yet. Please try again later.',
      });
      return;
    }
    if (perSessionFee <= 0) {
      toast({
        variant: 'destructive',
        title: 'Fee not configured',
        description: 'Per-session fee is not configured for this batch yet.',
      });
      return;
    }
    if (invalidRequestedSessionMessage) {
      toast({
        variant: 'destructive',
        title: 'Invalid session count',
        description: invalidRequestedSessionMessage,
      });
      return;
    }

    router.push(`/checkout/${linkedLiveBatchPlan.id}?sessions=${normalizedRequestedSessions}`);
  };

  const openClassroomHubPage = () => {
    const paidAccessBlocked = batch?.accessLevel === 'paid' && !isTeacher && !hasClassroomAccessForViewer;
    if (!batchId || paidAccessBlocked) return;
    router.push(`/live-batches/${batchId}/classroom`);
  };

  const openTeacherActivityPanel = () => {
    setShowTeacherActivity(true);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('teacher-activity-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  if (batchLoading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Classroom Details" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Skeleton className="h-72 w-full" />
        </main>
      </div>
    );
  }

  if (!batch || batch.publicationStatus === 'draft' || batch.publicationStatus === 'deleted') {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Classroom Details" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card>
            <CardContent className="p-6 text-muted-foreground">Classroom not found or not published.</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const isFree = batch.accessLevel === 'free';
  const isPaidBatch = batch.accessLevel === 'paid';
  const isEnrolled = isEnrolledForAccess;
  const canAccessClassroomHub = hasClassroomAccessForViewer;
  const isPaidSessionLocked = Boolean(!isTeacher && isPaidBatch && isEnrolled && remainingPaidSessions <= 0);
  const canShowRechargeOffer = Boolean(!isTeacher && isPaidBatch && isEnrolled && maxPurchasableSessions > 0);
  const canShowBuyMoreSessionsButton = Boolean(canShowRechargeOffer && !isPaidSessionLocked);
  const canEnterClassroomFromDetails = Boolean(!accessRecordLoading && isEnrolled && (!isPaidBatch || canAccessClassroomHub));
  const shouldShowPaidPurchasePanel = Boolean(
    !accessRecordLoading
    && !isTeacher
    && isPaidBatch
    && (!isEnrolled || isPaidSessionLocked || canShowRechargeOffer)
  );
  const subjectNames = (batch.subjectIds || []).map((id) => subjectNameById[id]).filter(Boolean);
  const explanationEmbedUrl = getYoutubeEmbedUrl(batch.explanationVideoUrl);
  const startDate = asDate(batch.batchStartDate);
  const classroomLoading = accessRecordLoading || sessionsLoading || testsLoading || (isPaidBatch && linkedPlanLoading);
  const heroPrimaryButtonClass = 'h-11 rounded-full border border-cyan-200/40 bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-300 px-6 font-semibold text-slate-950 shadow-[0_14px_32px_-18px_rgba(56,189,248,0.95)] transition-all duration-300 hover:-translate-y-0.5 hover:from-cyan-200 hover:via-sky-200 hover:to-blue-200 hover:shadow-[0_18px_38px_-18px_rgba(56,189,248,1)] focus-visible:ring-cyan-300/70';
  const heroSecondaryButtonClass = 'h-11 rounded-full border border-slate-500/45 bg-slate-900/55 px-6 font-semibold text-slate-100 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300/60 hover:bg-slate-800/80 hover:text-white';
  const heroPayButtonClass = 'h-11 rounded-full border border-emerald-200/45 bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 px-6 font-semibold text-slate-950 shadow-[0_14px_32px_-18px_rgba(16,185,129,0.95)] transition-all duration-300 hover:-translate-y-0.5 hover:from-emerald-200 hover:via-teal-200 hover:to-cyan-200 hover:shadow-[0_18px_38px_-18px_rgba(16,185,129,1)] focus-visible:ring-emerald-300/70 disabled:cursor-not-allowed disabled:opacity-60';
  const openRechargePanel = () => {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      document.getElementById('live-batch-recharge-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };
  const subjectTimingCards = (() => {
    const schedules = batch.subjectSchedules || [];

    return schedules
      .map((schedule, index) => {
        const activeDays = DAY_NAMES.filter((dayName) => (schedule.daysOfWeek || []).includes(dayName));
        const dayRows: SubjectTimingRow[] = [];
        activeDays.forEach((dayName) => {
          const daySpecificTiming = schedule.useDifferentTimingPerDay ? schedule.dayTimings?.[dayName] : undefined;
          const startTime = schedule.useDifferentTimingPerDay ? (daySpecificTiming?.startTime || '') : (schedule.startTime || '');
          const endTime = schedule.useDifferentTimingPerDay ? (daySpecificTiming?.endTime || '') : (schedule.endTime || '');
          if (!startTime) return;
          dayRows.push({
            dayName,
            dayShort: dayName.slice(0, 3),
            startTime,
            endTime,
          });
        });

        const startMinutes = dayRows.map((row) => toMinutes(row.startTime)).filter((value): value is number => value !== null);
        const endMinutes = dayRows
          .map((row) => toMinutes(row.endTime || row.startTime))
          .filter((value): value is number => value !== null);

        const firstStartMinute = startMinutes.length > 0 ? Math.min(...startMinutes) : null;
        const lastEndMinute = endMinutes.length > 0 ? Math.max(...endMinutes) : null;
        const plannedSessions = normalizeSubjectSessionCount(subjectSessionCountMap[schedule.subjectId]);
        const completedSessions = normalizeSubjectSessionCount(completedMeetingCountBySubjectId[schedule.subjectId]);
        const remainingSessions = Math.max(0, plannedSessions - completedSessions);

        return {
          key: `${schedule.subjectId || 'subject'}-${index}`,
          subjectName: subjectNameById[schedule.subjectId] || schedule.subjectId || `Subject ${index + 1}`,
          plannedSessions,
          completedSessions,
          remainingSessions,
          slotsPerWeek: dayRows.length,
          daysLabel: dayRows.length > 0 ? dayRows.map((row) => row.dayShort).join(' / ') : 'No day selected',
          startsAtLabel: firstStartMinute === null ? 'TBA' : formatMinutesForDisplay(firstStartMinute),
          endsAtLabel: lastEndMinute === null ? 'TBA' : formatMinutesForDisplay(lastEndMinute),
          usesDayWiseTiming: Boolean(schedule.useDifferentTimingPerDay),
          dayRows,
        };
      })
      .filter((card) => card.dayRows.length > 0);
  })();

  const weeklyTimingSummary = (() => {
    const activeDaySet = new Set<string>();
    let totalSlots = 0;

    subjectTimingCards.forEach((card) => {
      totalSlots += card.slotsPerWeek;
      card.dayRows.forEach((row) => activeDaySet.add(row.dayName));
    });

    return {
      subjectCount: subjectTimingCards.length,
      activeDays: activeDaySet.size,
      totalSlots,
      plannedSessions: totalPlannedSessions,
      completedSessions: conductedMeetingsInBatch,
      remainingSessions: batchRemainingSessions,
    };
  })();
  const formattedBatchStartLabel = startDate
    ? startDate.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    : 'Start date will be shared soon';
  const outcomeHighlights = (batch.outcomes || '')
    .split(/\r?\n+/)
    .map((item) => item.replace(/^[\s*+\-•]+/, '').trim())
    .filter(Boolean);
  const previewTimelineItems = upcomingClassroomItems.slice(0, 4);
  const upcomingMeetingCount = upcomingClassroomItems.filter((item) => item.kind === 'meeting').length;
  const upcomingTestCount = upcomingClassroomItems.filter((item) => item.kind === 'test').length;
  const visibleSubjectNames = subjectNames.slice(0, 6);
  const remainingSubjectCount = Math.max(0, subjectNames.length - visibleSubjectNames.length);
  const accessStateLabel = isTeacher
    ? 'Teacher mode'
    : accessRecordLoading
      ? (isFree ? 'Checking enrollment...' : 'Checking access...')
    : isFree
      ? (isEnrolled ? 'Free access active' : 'Free access after enrollment')
      : isEnrolled
        ? (isPaidSessionLocked ? 'History access only' : 'Paid access active')
        : 'Paid access after purchase';
  const heroLeadText = (batch.description || '').trim()
    || 'A structured live batch with teacher-led classes, subject-wise coverage, classroom updates, tests, recordings, and notes in one place.';
  const nextClassroomItemSummary = nextScheduledClassroomItem
    ? `${nextScheduledClassroomItem.kind === 'meeting' ? 'Next live class' : 'Next test'} on ${formatYmdForDisplay(nextScheduledClassroomItem.date)} at ${formatTimeForDisplay(nextScheduledClassroomItem.time)}.`
    : 'The next class or test will appear here as soon as the teacher publishes the schedule.';
  const classroomExperienceSteps = isTeacher
    ? [
        {
          title: 'Publish the plan',
          description: 'Keep subject timings, classes, and tests updated so students always see a clear roadmap.',
        },
        {
          title: 'Track delivery',
          description: 'Use classroom activity, history, and leaderboards to monitor how the batch is progressing.',
        },
        {
          title: 'Support students',
          description: 'Manage students, upload recordings, and refine the schedule from one control surface.',
        },
      ]
    : isPaidBatch
      ? [
          {
            title: 'Buy live-class credits',
            description: 'One credit pays for one completed live meeting. Mock tests do not consume credits.',
          },
          {
            title: 'Enter when access is live',
            description: `Meeting links unlock ${contentUnlockLeadLabel.toLowerCase()} before class starts.`,
          },
          {
            title: 'Revise after class',
            description: 'Return for tests, recordings, notes, and subject-wise progress whenever they are available.',
          },
        ]
      : [
          {
            title: 'Enroll once',
            description: 'Free batches need a one-time enrollment so they appear inside your personal workspace.',
          },
          {
            title: 'Follow the schedule',
            description: 'Open the classroom to see upcoming classes, tests, and teacher updates in time order.',
          },
          {
            title: 'Keep revising',
            description: 'Use the timetable, previous-session uploads, and classroom history to stay on track.',
          },
        ];
  const subjectSessionPlanItems = (batch?.subjectIds || Object.keys(subjectSessionCountMap)).map((subjectId, index) => {
    const plannedSessions = normalizeSubjectSessionCount(subjectSessionCountMap[subjectId]);
    const completedSessions = normalizeSubjectSessionCount(completedMeetingCountBySubjectId[subjectId]);

    return {
      subjectId,
      subjectName: subjectNameById[subjectId] || `Subject ${index + 1}`,
      plannedSessions,
      completedSessions,
      remainingSessions: Math.max(0, plannedSessions - completedSessions),
    };
  });
  const renderSubjectSessionPlanPanel = (options?: {
    compact?: boolean;
    showPaidSummary?: boolean;
    className?: string;
  }) => {
    const compact = options?.compact ?? false;
    const showPaidSummary = options?.showPaidSummary ?? false;

    return (
      <div className={cn('rounded-xl border border-white/10 bg-background/35', compact ? 'p-3 sm:p-4' : 'p-4', options?.className)}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Coverage by subject</p>
            <p className="text-xs text-muted-foreground">
              These numbers show how many live meetings are still planned for each subject in the batch roadmap.
            </p>
          </div>
          {showPaidSummary && !isTeacher && isPaidBatch ? (
            <div className="rounded-lg border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-right">
              <p className="text-[11px] uppercase tracking-wide text-emerald-200">Your sessions left</p>
              <p className="text-lg font-semibold text-emerald-50">{isEnrolled ? remainingPaidSessions : 0}</p>
            </div>
          ) : null}
        </div>
        {subjectSessionPlanItems.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-white/10 bg-background/20 p-3 text-sm text-muted-foreground">
            Subject-wise session counts are not configured yet.
          </div>
        ) : (
          <div className={cn('mt-4 grid gap-3', compact ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3')}>
            {subjectSessionPlanItems.map((item) => (
              <div key={`subject-session-${item.subjectId}`} className={cn('rounded-lg border border-white/10 bg-background/45', compact ? 'px-3 py-2.5' : 'px-4 py-3')}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.subjectName}</p>
                <p className={cn('mt-2 font-semibold', compact ? 'text-xl sm:text-2xl' : 'text-2xl')}>{item.remainingSessions}</p>
                <p className="text-xs text-muted-foreground">
                  {item.remainingSessions === 1 ? 'meeting left' : 'meetings left'}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {item.completedSessions} completed of {item.plannedSessions} planned
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  const recordNotificationAction = async (actionKey: string) => {
    if (!actionKey || !enrollmentRef) return;

    try {
      await setDoc(
        enrollmentRef,
        {
          notificationActionKeys: arrayUnion(actionKey),
          lastNotificationActionAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {
      // Best-effort only. Navigation should still continue if this write fails.
    }
  };
  const handleMeetingJoinClick = async (item: ClassroomTimelineItem) => {
    if (!item.zoomLink) return;

    const actionKey = buildMeetingReminderActionKey({
      batchId,
      sessionId: item.sessionId,
      date: item.date,
      meetingTime: item.time,
    });
    await recordNotificationAction(actionKey);
    window.open(item.zoomLink, '_blank', 'noopener,noreferrer');
  };
  const handleTestStartClick = async (item: ClassroomTimelineItem) => {
    if (!item.testId) return;

    const actionKey = buildTestReminderActionKey({
      testId: item.testId,
      scheduledDate: item.date,
      scheduledTime: item.time,
      startTime: item.dateTime,
    });
    await recordNotificationAction(actionKey);
    router.push(`/mock-tests/${item.testId}`);
  };
  const renderUpcomingTimelineItems = (items: ClassroomTimelineItem[], options?: { showUnlockHint?: boolean }) => {
    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
          No upcoming session or test is scheduled yet.
        </div>
      );
    }

    const nextMeetingItem = items.find((item) => item.kind === 'meeting') || null;
    const nextMeetingUnlockAt = nextMeetingItem
      ? new Date(nextMeetingItem.dateTime.getTime() - contentUnlockLeadMs)
      : null;
    const isNextMeetingLocked = Boolean(
      options?.showUnlockHint &&
      nextMeetingItem &&
      nextMeetingUnlockAt &&
      Date.now() < nextMeetingUnlockAt.getTime()
    );
    const isNextMeetingCreditLocked = Boolean(
      options?.showUnlockHint &&
      nextMeetingItem &&
      !isTeacher &&
      isPaidBatch &&
      isEnrolled &&
      remainingPaidSessions <= 0
    );

    return (
      <div className="space-y-3">
        {isNextMeetingCreditLocked ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-500/5 p-4 text-sm">
            <p className="font-medium text-rose-100">Your current token is exhausted, so new live-class joins stay locked.</p>
            <p className="mt-1 text-rose-100/80">
              You can still review only the recordings and notes from meetings that were already covered by your token.
            </p>
          </div>
        ) : null}
        {isNextMeetingLocked ? (
          <div className="rounded-lg border border-amber-300/30 bg-amber-500/5 p-4 text-sm">
            <p className="font-medium text-amber-100">Meeting links unlock shortly before class starts.</p>
            <p className="mt-1 text-amber-100/80">
              Unlock rule: {contentUnlockLeadLabel}. The next meeting link opens after {nextMeetingUnlockAt?.toLocaleString() || 'the unlock window starts'}.
            </p>
          </div>
        ) : null}
        {items.map((item, index) => {
          const meetingUnlockAt = item.kind === 'meeting' ? new Date(item.dateTime.getTime() - contentUnlockLeadMs) : null;
          const isMeetingLocked = Boolean(item.kind === 'meeting' && meetingUnlockAt && Date.now() < meetingUnlockAt.getTime());
          const isMeetingTokenLocked = Boolean(
            item.kind === 'meeting' &&
            !isTeacher &&
            isPaidBatch &&
            isEnrolled &&
            remainingPaidSessions <= 0
          );

          return (
            <div key={item.key} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/30 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/50 text-sm font-semibold text-cyan-100">
                  {index + 1}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        'w-fit',
                        item.kind === 'meeting'
                          ? 'border-cyan-300/35 bg-cyan-500/10 text-cyan-100'
                          : 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100'
                      )}
                    >
                      {item.kind === 'meeting' ? 'Live Class' : 'Test'}
                    </Badge>
                    {item.kind === 'test' && item.publicationStatus === 'draft' ? (
                      <Badge className="border-amber-300/35 bg-amber-500/20 text-amber-100">Draft</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatYmdForDisplay(item.date)} - {formatTimeForDisplay(item.time)}
                    {item.endTime ? ` to ${formatTimeForDisplay(item.endTime)}` : ''}
                  </p>
                  {item.subjectLabel ? (
                    <p className="text-xs text-cyan-100">Subject: {item.subjectLabel}</p>
                  ) : null}
                  {item.kind === 'meeting' ? (
                    <p className="text-xs text-muted-foreground">
                      {isMeetingLocked
                        ? `Join link unlocks ${contentUnlockLeadLabel.toLowerCase()} before class starts.`
                        : 'Meeting link is active now for this scheduled class.'}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.kind === 'meeting' ? (
                  isMeetingTokenLocked ? (
                    <Badge variant="outline" className="border-rose-300/35 bg-rose-500/10 text-rose-100">
                      <Lock className="mr-1 h-3.5 w-3.5" />
                      Join locked until you recharge
                    </Badge>
                  ) : item.zoomLink ? (
                    isMeetingLocked ? (
                      <Badge variant="outline" className="border-amber-300/35 bg-amber-500/10 text-amber-100">
                        Opens {meetingUnlockAt?.toLocaleString()}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="rounded-full"
                        onClick={() => {
                          void handleMeetingJoinClick(item);
                        }}
                      >
                        <>
                          <Video className="mr-1.5 h-3.5 w-3.5" />
                          Join Class
                        </>
                      </Button>
                    )
                  ) : (
                    <Badge variant="outline" className="border-border/70 bg-muted/20 text-muted-foreground">
                      Link will be shared soon
                    </Badge>
                  )
                ) : item.testId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      void handleTestStartClick(item);
                    }}
                  >
                    <>
                      <ListChecks className="mr-1.5 h-3.5 w-3.5" />
                      Start Test
                    </>
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  const renderTeacherPastTimelineItems = (items: ClassroomTimelineItem[]) => {
    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
          No completed classes or past tests yet.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/30 p-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'w-fit',
                    item.kind === 'meeting'
                      ? 'border-indigo-300/35 bg-indigo-500/10 text-indigo-100'
                      : 'border-amber-300/35 bg-amber-500/10 text-amber-100'
                  )}
                >
                  {item.kind === 'meeting' ? 'Past Class' : 'Past Test'}
                </Badge>
                {item.kind === 'test' && item.publicationStatus === 'draft' ? (
                  <Badge className="border-amber-300/35 bg-amber-500/20 text-amber-100">Draft</Badge>
                ) : null}
              </div>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatYmdForDisplay(item.date)} - {formatTimeForDisplay(item.time)}
                {item.endTime ? ` to ${formatTimeForDisplay(item.endTime)}` : ''}
              </p>
              {item.subjectLabel ? (
                <p className="text-xs text-indigo-100">Subject: {item.subjectLabel}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {item.kind === 'meeting' && item.zoomLink ? (
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link href={item.zoomLink} target="_blank">
                    <Video className="mr-1.5 h-3.5 w-3.5" />
                    Open Class Link
                  </Link>
                </Button>
              ) : null}
              {item.kind === 'test' && item.testId ? (
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link href={`/mock-tests/${item.testId}`}>
                    <ListChecks className="mr-1.5 h-3.5 w-3.5" />
                    Open Test
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  };
  const teacherActivityPanel = isOwnerTeacher && showTeacherActivity ? (
    <Card id="teacher-activity-panel" className="border-border/70 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-blue-950/50 shadow-xl">
      <CardHeader className="border-b border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="inline-flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-300" />
              Classroom Activity
            </CardTitle>
            <CardDescription className="mt-1">
              One place for your upcoming schedule and completed class or test history.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowTeacherActivity(false)}>
            Hide Activity
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/70 bg-background/30 p-4 space-y-3">
            <p className="text-sm font-semibold">Upcoming Sessions and Tests</p>
            {renderUpcomingTimelineItems(upcomingClassroomItems.slice(0, 8))}
          </div>

          <div className="rounded-xl border border-border/70 bg-background/30 p-4 space-y-3">
            <p className="text-sm font-semibold">Past Sessions and Tests</p>
            {renderTeacherPastTimelineItems(teacherPastClassroomItems)}
          </div>
        </div>
      </CardContent>
    </Card>
  ) : null;
  const previousSessionEditDialog = (
    <Dialog open={!!editingPreviousSession} onOpenChange={(open) => { if (!open) closePreviousSessionEditor(); }}>
      <DialogContent className="border-border/70 bg-slate-950/95 text-slate-100 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Previous Session</DialogTitle>
          <DialogDescription>
            Update the session date, title, replay link, and notes link from the classroom itself.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Session Date</label>
            <ConductedSessionDatePicker
              value={previousSessionEditDate}
              onChange={setPreviousSessionEditDate}
              options={previousSessionEditDateOptions}
              placeholder="Select conducted class date"
              disabled={previousSessionEditDateOptions.length === 0}
            />
            <p className="text-xs text-muted-foreground">
              Only completed dates from this batch schedule can be selected.
            </p>
            {previousSessionEditDate && !selectedPreviousSessionEditDateOption ? (
              <p className="text-xs text-amber-200">
                Current saved date is outside the conducted schedule. Pick a valid conducted date before saving.
              </p>
            ) : null}
          </div>
          {selectedPreviousSessionEditDateOption?.meetingTime ? (
            <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
              {formatYmdForDisplay(selectedPreviousSessionEditDateOption.date)}
              {' - '}
              {formatTimeForDisplay(selectedPreviousSessionEditDateOption.meetingTime)}
              {selectedPreviousSessionEditDateOption.meetingEndTime
                ? ` to ${formatTimeForDisplay(selectedPreviousSessionEditDateOption.meetingEndTime)}`
                : ''}
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="text-sm font-medium">Session Title</label>
            <Input
              value={previousSessionEditTitle}
              onChange={(event) => setPreviousSessionEditTitle(event.target.value)}
              placeholder="Mathematics Live Session"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Video Link</label>
            <Input
              value={previousSessionEditVideoUrl}
              onChange={(event) => setPreviousSessionEditVideoUrl(event.target.value)}
              placeholder="https://youtube.com/..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes Link</label>
            <Input
              value={previousSessionEditNotesUrl}
              onChange={(event) => setPreviousSessionEditNotesUrl(event.target.value)}
              placeholder="https://drive.google.com/... or any notes URL"
            />
            <p className="text-xs text-muted-foreground">
              Leave this empty if the session should not show a notes download button.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={closePreviousSessionEditor} disabled={isSavingPreviousSessionEdit}>
            Cancel
          </Button>
          <Button type="button" onClick={() => { void handleSavePreviousSessionEdit(); }} disabled={isSavingPreviousSessionEdit}>
            {isSavingPreviousSessionEdit ? (
              <>
                <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (classroomOnly) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Classroom Details" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
          <Card className="overflow-hidden border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_30%),linear-gradient(145deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92)_52%,rgba(30,41,59,0.84))]">
            <CardContent className="p-6 md:p-8">
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-3">
                  <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                    <Sparkles className="h-3.5 w-3.5" />
                    Classroom Hub
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{batch.title || 'Live Classroom'}</h2>
                  <p className="max-w-3xl text-sm leading-7 text-slate-200/85">
                    This screen is the operational view of the batch: upcoming classes, tests, recordings, subject coverage, and credit usage all stay linked here.
                  </p>
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-4 text-sm text-cyan-50">
                    {nextClassroomItemSummary}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200">Upcoming Classes</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{upcomingMeetingCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-200">Upcoming Tests</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{upcomingTestCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-indigo-200">Meetings Left</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{totalSessionsInBatch > 0 ? batchRemainingSessions : 'N/A'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-amber-200">
                      {!isTeacher && isPaidBatch ? 'Your Credits Left' : 'Access'}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {!isTeacher && isPaidBatch ? remainingPaidSessions : accessStateLabel}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-slate-950/90 via-blue-950/45 to-slate-900/90">
              <CardHeader className="border-b border-border/60">
                <CardTitle className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                  Classroom Timeline
                </CardTitle>
                <CardDescription>
                  Upcoming live classes and tests are shown in the order students will actually experience them.
                </CardDescription>
              </CardHeader>
            <CardContent className="pt-4">
              {!canAccessClassroomHub ? (
                isPaidBatch ? (
                  <div className="rounded-xl border border-dashed border-cyan-300/30 bg-cyan-500/5 p-5 space-y-3">
                    <p className="text-sm font-medium">
                      {isEnrolled
                        ? 'Your paid sessions are exhausted. Buy more sessions to unlock classroom access.'
                        : 'Select sessions to unlock classroom timeline.'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      One session means one live meeting. Tests are not counted in session usage.
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Per Session Fee</p>
                        <p className="text-sm font-semibold">INR {perSessionFee.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{isEnrolled ? 'Your Sessions Left' : 'Sessions Left in Batch'}</p>
                        <p className="text-sm font-semibold">{isEnrolled ? remainingPaidSessions : (totalSessionsInBatch > 0 ? batchRemainingSessions : 'Not set')}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="classroom-session-count" className="text-sm font-medium">Number of Sessions</label>
                      <Input
                        id="classroom-session-count"
                        type="number"
                        min={1}
                        max={Math.max(maxPurchasableSessions, 1)}
                        step={1}
                        value={normalizedRequestedSessions}
                        onChange={(event) => {
                          const parsed = Number(event.target.value);
                          if (!Number.isFinite(parsed)) {
                            setRequestedSessionsForPurchase(1);
                            return;
                          }
                          const cappedMax = maxPurchasableSessions > 0 ? maxPurchasableSessions : 1;
                          setRequestedSessionsForPurchase(Math.max(1, Math.min(Math.floor(parsed), cappedMax)));
                        }}
                      />
                      {!linkedLiveBatchPlan?.id ? (
                        <p className="text-xs text-amber-300">
                          Subscription plan is not attached yet. Please ask the teacher to attach a plan for this batch.
                        </p>
                      ) : invalidRequestedSessionMessage ? (
                        <p className="text-xs text-destructive">{invalidRequestedSessionMessage}</p>
                      ) : (
                        <p className="text-xs text-emerald-400">
                          Payable amount = {normalizedRequestedSessions} x INR {perSessionFee.toLocaleString()} = INR {payableAmountForSelection.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handlePaidCheckout}
                      disabled={!linkedLiveBatchPlan?.id || perSessionFee <= 0 || !!invalidRequestedSessionMessage}
                      className={heroPayButtonClass}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      {isEnrolled ? 'Pay for More Sessions' : 'Pay and Unlock Classroom'}
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-cyan-300/30 bg-cyan-500/5 p-5">
                    <p className="text-sm font-medium">Enroll to unlock classroom timeline.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Once enrolled, you can view the next class or test scheduled for this batch.
                    </p>
                    <Button onClick={handleEnroll} disabled={isEnrolling} className="mt-3 rounded-full">
                      {isEnrolling ? 'Enrolling...' : 'Enroll in Class'}
                    </Button>
                  </div>
                )
              ) : classroomLoading ? (
                <div className="grid grid-cols-1 gap-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <>
                  {nextScheduledClassroomItem ? (
                    <div className="mb-4 rounded-lg border border-cyan-300/20 bg-cyan-500/5 p-3 text-xs text-cyan-100">
                      Nearest item: {nextScheduledClassroomItem.title} on {formatYmdForDisplay(nextScheduledClassroomItem.date)} at {formatTimeForDisplay(nextScheduledClassroomItem.time)}.
                    </div>
                  ) : null}
                  {renderUpcomingTimelineItems(upcomingClassroomItems, { showUnlockHint: true })}
                  {canShowRechargeOffer ? (
                    <div id="live-batch-recharge-panel" className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-500/5 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-emerald-50">Recharge more sessions anytime</p>
                          <p className="mt-1 text-sm text-emerald-50/80">
                            Your access is active. You can still buy more live-class credits now while {maxPurchasableSessions} batch session{maxPurchasableSessions === 1 ? '' : 's'} remain available.
                          </p>
                        </div>
                        <Badge variant="outline" className="border-emerald-300/35 bg-emerald-500/10 text-emerald-100">
                          Current credits: {remainingPaidSessions}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Per Session Fee</p>
                          <p className="text-sm font-semibold">INR {perSessionFee.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Sessions Left In Batch</p>
                          <p className="text-sm font-semibold">{totalSessionsInBatch > 0 ? batchRemainingSessions : 'Not set'}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="classroom-topup-session-count" className="text-sm font-medium">Number of Sessions to Add</label>
                        <Input
                          id="classroom-topup-session-count"
                          type="number"
                          min={1}
                          max={Math.max(maxPurchasableSessions, 1)}
                          step={1}
                          value={normalizedRequestedSessions}
                          onChange={(event) => {
                            const parsed = Number(event.target.value);
                            if (!Number.isFinite(parsed)) {
                              setRequestedSessionsForPurchase(1);
                              return;
                            }
                            const cappedMax = maxPurchasableSessions > 0 ? maxPurchasableSessions : 1;
                            setRequestedSessionsForPurchase(Math.max(1, Math.min(Math.floor(parsed), cappedMax)));
                          }}
                        />
                        {!linkedLiveBatchPlan?.id ? (
                          <p className="text-xs text-amber-300">
                            Subscription plan is not attached yet. Please ask the teacher to attach a plan for this batch.
                          </p>
                        ) : invalidRequestedSessionMessage ? (
                          <p className="text-xs text-destructive">{invalidRequestedSessionMessage}</p>
                        ) : (
                          <p className="text-xs text-emerald-300">
                            Payable amount = {normalizedRequestedSessions} x INR {perSessionFee.toLocaleString()} = INR {payableAmountForSelection.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={handlePaidCheckout}
                        disabled={!linkedLiveBatchPlan?.id || perSessionFee <= 0 || !!invalidRequestedSessionMessage}
                        className={heroPayButtonClass}
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        Recharge More Sessions
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
              <div className="mt-4">
                {renderSubjectSessionPlanPanel({ compact: true, showPaidSummary: true })}
              </div>
            </CardContent>
          </Card>
          {canAccessClassroomHub ? (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card className="border-border/70 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-blue-950/50">
                <CardHeader className="border-b border-border/60">
                  <CardTitle className="inline-flex items-center gap-2 text-base">
                    <Trophy className="h-4 w-4 text-amber-300" />
                    Latest Test Leaderboard
                  </CardTitle>
                  <CardDescription>
                    Compare the latest completed batch test results. Matching scores share the same rank.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {latestCompletedBatchTest ? (
                    <div className="rounded-lg border border-border/60 bg-muted/15 p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">{latestCompletedBatchTest.title || 'Live Batch Test'}</p>
                      <p className="mt-1">
                        {formatYmdForDisplay(latestCompletedBatchTest.resolvedDate)} - {formatTimeForDisplay(latestCompletedBatchTest.resolvedTime)}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">
                      Leaderboard will appear after the first completed test.
                    </div>
                  )}
                  {isLoadingLatestTestLeaderboard || classroomLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : latestCompletedBatchTest && classroomLeaderboardRankGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No attempts submitted yet for the latest test.</p>
                  ) : (
                    <div className="space-y-2">
                      {classroomLeaderboardRankGroups.map((group) => (
                        <div key={`rank-${group.rank}`} className="rounded-lg border border-border/60 bg-background/40 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <Badge variant="outline" className="border-cyan-300/35 bg-cyan-500/10 text-cyan-100">
                              Rank #{group.rank}
                            </Badge>
                            <p className="text-xs text-muted-foreground">Score: {group.score}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {group.entries.map((entry, entryIndex) => (
                              <div key={`${group.rank}-${entry.studentId || entry.studentName}-${entryIndex}`} className="min-w-[170px] rounded-md border border-border/60 bg-muted/10 px-3 py-2">
                                <p className="text-sm font-medium">{entry.studentName || 'Student'}</p>
                                <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                                  <p>Score: <span className="font-semibold text-foreground">{entry.bestScore}</span></p>
                                  <p className="inline-flex items-center gap-1">
                                    <Clock3 className="h-3 w-3" />
                                    Time: {entry.bestTime > 0 ? `${entry.bestTime}s` : 'N/A'}
                                  </p>
                                  <p>Attempts: {entry.attempts}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

                <Card className="border-border/70 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-indigo-950/50">
                <CardHeader className="border-b border-border/60">
                  <CardTitle className="inline-flex items-center gap-2 text-base">
                    <History className="h-4 w-4 text-indigo-200" />
                    Recordings and Notes Library
                  </CardTitle>
                  <CardDescription>
                    A single archive for previous-session videos, notes, and uploaded supporting material.
                  </CardDescription>
                  {!isTeacher && isPaidBatch ? (
                    <p className="text-xs text-amber-200/90">
                      Covered dates unlock automatically. Any locked previous session can be unlocked with 1 current token when you still have balance left.
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="pt-4">
                  {classroomLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </div>
                  ) : previousSessionTimeline.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">
                      No previous session upload available yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {previousSessionTimeline.map((session) => {
                        const canOpenSession = canAccessPreviousSessionByCoverage(session);
                        const previousSessionAccessKey = getPreviousSessionAccessKey(session);
                        const canSpendTokenToUnlock = Boolean(
                          !canOpenSession &&
                          !isTeacher &&
                          isPaidBatch &&
                          isEnrolled &&
                          remainingPaidSessions > 0 &&
                          (session.previousSessionUrl || session.notesFileUrl)
                        );
                        const subjectLabel =
                          session.subjectName
                          || (session.subjectId ? (subjectNameById[session.subjectId] || session.subjectId) : '')
                          || 'General';

                        return (
                          <div key={`previous-session-${session.id}`} className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">{getPreviousSessionDisplayTitle(session)}</p>
                                <Badge variant="outline" className="border-indigo-300/35 bg-indigo-500/10 text-indigo-100">
                                  {subjectLabel}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatYmdForDisplay(session.date)}{getPreviousSessionDisplayTimeLabel(session) ? ` - ${getPreviousSessionDisplayTimeLabel(session)}` : ''}
                              </p>
                              {session.notesFileName ? (
                                <p className="text-xs text-muted-foreground">Notes: {session.notesFileName}</p>
                              ) : null}
                            </div>
                            {!canOpenSession && (session.previousSessionUrl || session.notesFileUrl) ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="w-fit border-rose-300/40 bg-rose-500/10 text-rose-100">
                                  <Lock className="mr-1 h-3.5 w-3.5" />
                                  Locked
                                </Badge>
                                {canSpendTokenToUnlock ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full border-cyan-300/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                                    onClick={() => handleUnlockPreviousSession(session)}
                                    disabled={unlockingPreviousSessionKey === previousSessionAccessKey}
                                  >
                                    {unlockingPreviousSessionKey === previousSessionAccessKey ? (
                                      <>
                                        <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                        Unlocking...
                                      </>
                                    ) : (
                                      <>
                                        <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                                        Unlock with 1 Token
                                      </>
                                    )}
                                  </Button>
                                ) : (
                                  <Badge variant="outline" className="w-fit border-border/70 bg-muted/20 text-muted-foreground">
                                    Recharge to unlock
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                {isOwnerTeacher ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full"
                                    onClick={() => openPreviousSessionEditor(session)}
                                  >
                                    <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                                    Edit Session
                                  </Button>
                                ) : null}
                                {session.previousSessionUrl ? (
                                  <Button asChild size="sm" variant="outline" className="rounded-full">
                                    <Link href={session.previousSessionUrl} target="_blank">
                                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                      Watch Video
                                    </Link>
                                  </Button>
                                ) : null}
                                {session.notesFileUrl ? (
                                  <Button asChild size="sm" variant="outline" className="rounded-full">
                                    <a href={session.notesFileUrl} target="_blank" rel="noopener noreferrer" download={session.notesFileName || true}>
                                      <Download className="mr-1.5 h-3.5 w-3.5" />
                                      Download Notes
                                    </a>
                                  </Button>
                                ) : null}
                                {!session.previousSessionUrl && !session.notesFileUrl ? (
                                  <Badge variant="outline" className="w-fit border-border/70 bg-muted/20 text-muted-foreground">
                                    Video and notes not added
                                  </Badge>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
                </Card>
              </div>
              {isOwnerTeacher ? (
                <Card className="border-border/70 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-violet-950/50">
                  <CardHeader className="border-b border-border/60">
                    <CardTitle className="inline-flex items-center gap-2 text-base">
                      <Activity className="h-4 w-4 text-violet-200" />
                      Past Sessions and Tests
                    </CardTitle>
                    <CardDescription>
                      Teacher-only history of completed live classes and finished tests.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {renderTeacherPastTimelineItems(teacherPastClassroomItems)}
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : null}
          {!isTeacher && isPaidBatch && isEnrolled ? (
              <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-base">Credit Usage Summary</CardTitle>
                <CardDescription>
                  These numbers track every token spent from this batch, including completed live meetings and any previous sessions you unlocked later. Tests stay excluded.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Sessions Added To Your Token</p>
                    <p className="text-lg font-semibold">{purchasedSessions}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Sessions Used From Your Token</p>
                    <p className="text-lg font-semibold">{consumedPaidSessions}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Sessions Left In Your Token</p>
                    <p className="text-lg font-semibold">{remainingPaidSessions}</p>
                  </div>
                </div>
                {manuallyUnlockedPaidSessions > 0 ? (
                  <p className="text-xs text-cyan-200/90">
                    Includes {manuallyUnlockedPaidSessions} token{manuallyUnlockedPaidSessions === 1 ? '' : 's'} used later to unlock locked previous-session recordings.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
          {previousSessionEditDialog}
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Classroom Details" />
      <main className="flex-1 space-y-5 overflow-y-auto p-3 sm:p-4 md:space-y-6 md:p-6 lg:p-8">
        {!classroomOnly ? (
          <>
            <Card className="relative overflow-hidden border-border/70 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.94)_44%,rgba(30,64,175,0.22)_100%)]">
              <CardContent className="relative p-0">
                <div className="absolute inset-0">
                  <LiveBatchThumbnail
                    src={batch.thumbnailUrl}
                    alt={batch.title || 'Classroom'}
                    title={batch.title || 'Live Classroom'}
                    subtitle={heroLeadText}
                    variant="hero"
                    decorative
                    className="h-full min-h-[540px] border-0 sm:min-h-[620px] lg:min-h-[720px]"
                    imageClassName="object-cover object-center opacity-95"
                  />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.18),rgba(2,6,23,0.62)_38%,rgba(2,6,23,0.9)_100%)]" />
                </div>
                <div className="relative space-y-4 p-4 sm:p-5 md:p-8">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                        <Sparkles className="h-3.5 w-3.5" />
                        Structured Live Batch
                      </p>
                      <div className="space-y-2">
                        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">{batch.title || 'Live Classroom'}</h2>
                        <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
                          {heroLeadText}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-start gap-2 lg:flex-col lg:items-end">
                      <Badge className={isFree ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100' : 'border-red-400/60 bg-red-500/20 text-red-100'}>
                        {isFree ? 'Free Batch' : 'Paid Batch'}
                      </Badge>
                      <Badge variant="outline" className="border-cyan-300/35 bg-cyan-500/10 text-cyan-100">
                        {accessStateLabel}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200">Teacher</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">{batch.teacherName || 'N/A'}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-sky-200">Exam Track</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">{examNameById[batch.examTypeId || ''] || 'Exam'} / {classNameById[batch.classId || ''] || 'Curriculum'}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-indigo-200">Batch Start</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">{formattedBatchStartLabel}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Subjects Included</p>
                    <div className="flex flex-wrap gap-2">
                      {visibleSubjectNames.length > 0 ? (
                        <>
                          {visibleSubjectNames.map((subjectName) => (
                            <Badge key={`hero-subject-${subjectName}`} variant="outline" className="border-cyan-300/35 bg-cyan-500/10 text-cyan-100">
                              {subjectName}
                            </Badge>
                          ))}
                          {remainingSubjectCount > 0 ? (
                            <Badge variant="outline" className="border-border/70 bg-muted/20 text-muted-foreground">
                              +{remainingSubjectCount} more
                            </Badge>
                          ) : null}
                        </>
                      ) : (
                        <Badge variant="outline" className="border-border/70 bg-muted/20 text-muted-foreground">
                          Subjects will appear once tagged by the teacher
                        </Badge>
                      )}
                    </div>
                  </div>
                  {renderSubjectSessionPlanPanel({ compact: true, showPaidSummary: true, className: 'border-white/10 bg-background/20' })}
                  {!isTeacher ? (
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        {isEnrolled ? (
                          <>
                            {canEnterClassroomFromDetails ? (
                              <Button onClick={openClassroomHubPage} className={`${heroPrimaryButtonClass} w-full sm:w-auto`}>
                                Enter Classroom
                              </Button>
                            ) : null}
                            {canShowBuyMoreSessionsButton ? (
                              <Button type="button" variant="outline" className={`${heroSecondaryButtonClass} w-full sm:w-auto`} onClick={openRechargePanel}>
                                Buy More Sessions
                              </Button>
                            ) : null}
                            {enrollmentRecord?.hiddenFromMyBatch && enrollmentRecord?.adminAccessDisabled !== true ? (
                              <Button
                                type="button"
                                variant="outline"
                                className={`${heroSecondaryButtonClass} w-full sm:w-auto`}
                                onClick={handleRestoreToMyBatch}
                                disabled={isRestoringToMyBatch}
                              >
                                {isRestoringToMyBatch ? (
                                  <>
                                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                    Adding back...
                                  </>
                                ) : (
                                  'Add Back to My Batch'
                                )}
                              </Button>
                            ) : null}
                          </>
                        ) : isFree ? (
                          <Button
                            onClick={handleEnroll}
                            disabled={isEnrolling || (!!user && accessRecordLoading)}
                            className={`${heroPrimaryButtonClass} w-full sm:w-auto`}
                          >
                            {isEnrolling ? 'Enrolling...' : (!!user && accessRecordLoading) ? 'Checking enrollment...' : 'Enroll in Class'}
                          </Button>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Select sessions below to pay and unlock classroom access.
                          </p>
                        )}
                      </div>
                      {isPaidSessionLocked ? (
                        <p className="text-xs text-amber-300">
                          Your current token is exhausted. You can still enter the classroom to review only the recordings and notes already covered by your token. New live-class joins stay locked until you recharge.
                        </p>
                      ) : canShowRechargeOffer ? (
                        <p className="text-xs text-cyan-200/90">
                          You still have active access, and you can recharge more sessions now while {maxPurchasableSessions} batch session{maxPurchasableSessions === 1 ? '' : 's'} are still available.
                        </p>
                      ) : null}

                      {!isFree && shouldShowPaidPurchasePanel ? (
                        <div id="live-batch-recharge-panel" className="rounded-lg border border-border/60 bg-black/20 p-3 space-y-2">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold">
                              {isEnrolled ? 'Recharge more live sessions' : 'Unlock classroom with live sessions'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {isEnrolled
                                ? 'Add more session credits now so you do not run out later. One session means one completed live meeting.'
                                : 'Choose how many live sessions you want to unlock. One session means one completed live meeting.'}
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            <p>Per session fee: <span className="font-semibold">INR {perSessionFee.toLocaleString()}</span></p>
                            <p>{isEnrolled ? 'Batch sessions left to purchase' : 'Sessions left in batch'}: <span className="font-semibold">{totalSessionsInBatch > 0 ? batchRemainingSessions : 'Not set'}</span></p>
                          </div>
                          <div className="space-y-1">
                            <label htmlFor="hero-session-count" className="text-xs text-muted-foreground">Select sessions you want to buy</label>
                            <Input
                              id="hero-session-count"
                              type="number"
                              min={1}
                              max={Math.max(maxPurchasableSessions, 1)}
                              step={1}
                              value={normalizedRequestedSessions}
                              onChange={(event) => {
                                const parsed = Number(event.target.value);
                                if (!Number.isFinite(parsed)) {
                                  setRequestedSessionsForPurchase(1);
                                  return;
                                }
                                const cappedMax = maxPurchasableSessions > 0 ? maxPurchasableSessions : 1;
                                setRequestedSessionsForPurchase(Math.max(1, Math.min(Math.floor(parsed), cappedMax)));
                              }}
                              className="max-w-xs"
                            />
                          </div>
                          {!linkedLiveBatchPlan?.id ? (
                            <p className="text-xs text-amber-300">
                              Subscription plan is not attached yet. Please ask the teacher to attach a plan for this batch.
                            </p>
                          ) : invalidRequestedSessionMessage ? (
                            <p className="text-xs text-destructive">{invalidRequestedSessionMessage}</p>
                          ) : (
                            <p className="text-xs text-emerald-300">
                              Payable amount = {normalizedRequestedSessions} x INR {perSessionFee.toLocaleString()} = INR {payableAmountForSelection.toLocaleString()}
                            </p>
                          )}
                          <Button
                            onClick={handlePaidCheckout}
                            disabled={!linkedLiveBatchPlan?.id || perSessionFee <= 0 || !!invalidRequestedSessionMessage}
                            className={`${heroPayButtonClass} h-10 px-5`}
                          >
                            <CreditCard className="mr-2 h-4 w-4" />
                            {isEnrolled ? 'Recharge More Sessions' : 'Pay and Unlock Classroom'}
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            One session means one live meeting. Mock tests do not reduce your session count.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {isOwnerTeacher ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={openTeacherActivityPanel} className={heroPrimaryButtonClass}>
                        <Activity className="mr-2 h-4 w-4" />
                        See Activity
                      </Button>
                      <Button asChild variant="outline" className={heroSecondaryButtonClass}>
                        <Link href={`/live-batches/${batchId}/students`}>
                          <Users className="mr-2 h-4 w-4" />
                          Manage Students
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className={heroSecondaryButtonClass}>
                        <Link href={`/live-batches/schedule/${batchId}`}>
                          <ListChecks className="mr-2 h-4 w-4" />
                          Manage Schedule
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-border/70 bg-gradient-to-br from-slate-950/90 via-slate-900/75 to-blue-950/45">
                <CardHeader className="border-b border-border/60">
                  <CardTitle className="inline-flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-cyan-300" />
                    Schedule Preview
                  </CardTitle>
                  <CardDescription>
                    A read-only preview of the next classes and tests. Join links appear only after classroom access is active.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Next on the roadmap</p>
                    <p className="mt-2 text-sm text-cyan-50">{nextClassroomItemSummary}</p>
                  </div>
                  {previewTimelineItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-6 text-sm text-muted-foreground">
                      No upcoming class or test has been scheduled yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {previewTimelineItems.map((item, index) => (
                        <div key={`preview-${item.key}`} className="rounded-2xl border border-border/70 bg-background/30 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/50 text-sm font-semibold text-cyan-100">
                                {index + 1}
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      item.kind === 'meeting'
                                        ? 'border-cyan-300/35 bg-cyan-500/10 text-cyan-100'
                                        : 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100'
                                    )}
                                  >
                                    {item.kind === 'meeting' ? 'Live Class' : 'Test'}
                                  </Badge>
                                  {item.subjectLabel ? (
                                    <Badge variant="outline" className="border-border/70 bg-background/35 text-muted-foreground">
                                      {item.subjectLabel}
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="text-sm font-semibold">{item.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatYmdForDisplay(item.date)} - {formatTimeForDisplay(item.time)}
                                  {item.endTime ? ` to ${formatTimeForDisplay(item.endTime)}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                              {item.kind === 'meeting' ? 'Join link opens inside classroom' : 'Opens from test area'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-gradient-to-br from-slate-950/90 via-slate-900/75 to-indigo-950/45">
                <CardHeader className="border-b border-border/60">
                  <CardTitle className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    How This Batch Works
                  </CardTitle>
                  <CardDescription>
                    The page below is organized to show what you will learn, what happens next, and how access actually works.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {classroomExperienceSteps.map((step, index) => (
                    <div key={`experience-step-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/10 text-sm font-semibold text-cyan-100">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{step.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-50/85">
                    All class and test timings shown here automatically follow the local time of the device being used.
                  </div>
                </CardContent>
              </Card>
            </div>

            {!isTeacher && isPaidBatch && isEnrolled ? (
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle className="text-lg">Your Credit Summary</CardTitle>
                <CardDescription>
                  This summary tracks every token spent from this batch, including completed live meetings and any previous sessions you unlocked later. Mock tests stay excluded.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Sessions Added To Your Token</p>
                      <p className="text-lg font-semibold">{purchasedSessions}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Sessions Used From Your Token</p>
                    <p className="text-lg font-semibold">{consumedPaidSessions}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Sessions Left In Your Token</p>
                    <p className="text-lg font-semibold">{remainingPaidSessions}</p>
                  </div>
                </div>
                {manuallyUnlockedPaidSessions > 0 ? (
                  <p className="text-xs text-cyan-300">
                    Includes {manuallyUnlockedPaidSessions} token{manuallyUnlockedPaidSessions === 1 ? '' : 's'} used later to unlock locked previous-session recordings.
                  </p>
                ) : null}
                  {recentConductedMeetings.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Meetings Counted Against Your Token</p>
                      <div className="space-y-2">
                        {recentConductedMeetings.map((meeting) => (
                          <div key={`covered-${meeting.id}`} className="rounded-md border border-border/60 bg-muted/10 p-2 text-sm">
                            <p className="font-medium">
                              {getResolvedMeetingTitle(meeting.meetingTitle, meeting.subjectName || meeting.subjectId || 'Class')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatYmdForDisplay(meeting.date)} - {formatTimeForDisplay(meeting.meetingTime)} - {meeting.subjectName || meeting.subjectId || 'Subject'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No completed live meeting has used your token yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {teacherActivityPanel}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card className="xl:col-span-2 border-border/70">
                <CardHeader>
                  <CardTitle>Why Join This Batch</CardTitle>
                  <CardDescription>
                    Use this section to understand the teacher promise, structure, and overall fit before entering the classroom.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{batch.description || 'No description provided yet.'}</p>
                </CardContent>
              </Card>
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>What You Will Gain</CardTitle>
                  <CardDescription>
                    Expected takeaways, outcomes, or end goals defined by the teacher for this batch.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {outcomeHighlights.length > 0 ? (
                    <div className="grid gap-3">
                      {outcomeHighlights.map((item, index) => (
                        <div key={`outcome-item-${index}`} className="rounded-xl border border-border/70 bg-muted/15 p-3 text-sm text-foreground">
                          {item}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{batch.outcomes || 'No outcome details provided yet.'}</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {batch.explanationVideoUrl ? (
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>Quick Preview Video</CardTitle>
                  <CardDescription>
                    A short preview from the teacher to help students understand the batch approach before joining.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {explanationEmbedUrl ? (
                    <div className="aspect-video w-full overflow-hidden rounded-lg border border-border/70">
                      <iframe
                        src={explanationEmbedUrl}
                        title="Batch explanation video"
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <Link href={batch.explanationVideoUrl} target="_blank" className="text-sm text-primary hover:underline">
                      Watch Preview Video
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}

        <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-slate-950/95 via-blue-950/40 to-slate-900/90">
          <CardHeader className="border-b border-border/60">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-cyan-300" />
                  Weekly Timetable by Subject
                </CardTitle>
                <CardDescription className="mt-1">
                  See exactly which subject runs on which day, with remaining planned meetings and timing details grouped together.
                </CardDescription>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-cyan-200">Subjects</p>
                  <p className="text-lg font-semibold">{weeklyTimingSummary.subjectCount}</p>
                </div>
                <div className="rounded-lg border border-blue-300/20 bg-blue-500/10 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-blue-200">Active Days</p>
                  <p className="text-lg font-semibold">{weeklyTimingSummary.activeDays}</p>
                </div>
                <div className="rounded-lg border border-indigo-300/20 bg-indigo-500/10 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-indigo-200">Weekly Slots</p>
                  <p className="text-lg font-semibold">{weeklyTimingSummary.totalSlots}</p>
                </div>
                <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-200">Meetings Left</p>
                  <p className="text-lg font-semibold">{weeklyTimingSummary.remainingSessions}</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {subjectTimingCards.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                Subject timings are not configured for this batch yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {subjectTimingCards.map((timingCard) => (
                  <div key={timingCard.key} className="rounded-xl border border-border/70 bg-slate-900/45 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold">{timingCard.subjectName}</p>
                        <p className="text-xs text-muted-foreground">{timingCard.daysLabel}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Badge variant="outline" className="border-cyan-300/30 bg-cyan-500/10 text-cyan-100">
                          {timingCard.slotsPerWeek} {timingCard.slotsPerWeek === 1 ? 'slot' : 'slots'} / week
                        </Badge>
                        <Badge variant="outline" className="border-emerald-300/30 bg-emerald-500/10 text-emerald-100">
                          {timingCard.remainingSessions} left / {timingCard.plannedSessions} planned
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-border/70 bg-background/30 text-xs text-muted-foreground">
                        Starts {timingCard.startsAtLabel}
                      </Badge>
                      <Badge variant="outline" className="border-border/70 bg-background/30 text-xs text-muted-foreground">
                        Ends {timingCard.endsAtLabel}
                      </Badge>
                      {timingCard.usesDayWiseTiming ? (
                        <Badge className="border-amber-300/35 bg-amber-500/20 text-amber-100">Day-wise timing</Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {timingCard.dayRows.map((row) => (
                        <div key={`${timingCard.key}-${row.dayName}`} className="rounded-lg border border-border/70 bg-background/30 px-3 py-2">
                          <p className="text-xs font-medium">{row.dayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeForDisplay(row.startTime)}{row.endTime ? ` - ${formatTimeForDisplay(row.endTime)}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isTeacher && isPaidBatch && isEnrolled ? (
              <div className="rounded-lg border border-emerald-300/25 bg-emerald-500/5 p-4 text-sm">
                <p className="font-medium text-emerald-100">Your sessions left: {remainingPaidSessions}</p>
                <p className="mt-1 text-emerald-100/80">
                  This decreases only after a live meeting is completed on or after your purchase date. Tests do not use session credits.
                </p>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">All timings are shown in your device local time format.</p>
          </CardContent>
        </Card>
        {previousSessionEditDialog}
      </main>
    </div>
  );
}
