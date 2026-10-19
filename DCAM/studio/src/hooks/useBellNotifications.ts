'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, collectionGroup, deleteDoc, doc, documentId, getDocs, query, where, writeBatch } from 'firebase/firestore';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import {
  buildMeetingReminderActionKey,
  buildTestReminderActionKey,
  normalizeReminderActionKeys,
} from '@/lib/bell-reminder-actions';
import {
  buildPersistentBellNotification,
  type BellNotificationItem,
  type StoredNotification,
  formatScheduledMoment,
} from '@/lib/notifications';
import { syncBellNotificationsToApp } from '@/lib/app-bridge';
import {
  calculateLiveBatchSessionCoverage,
  parseYmdHmToLocalDateTime,
  type LiveBatchEnrollmentLike,
} from '@/lib/live-batch-session-access';
import {
  hasPaidLiveBatchTestTokenAccessAtStart,
  getLiveBatchTestTeacherQuestionAccessCheckAt,
  resolveLiveBatchTestSchedule,
} from '@/lib/live-batch-test-access';
import {
  buildTeacherPremiumQuestionTestBlockedReason,
  useTeacherPremiumQuestionTestAccessMap,
} from '@/lib/teacher-premium-question-test-access';

type LiveBatchSchedule = {
  subjectId?: string;
  subjectName?: string;
  daysOfWeek?: string[];
  startTime?: string;
  endTime?: string;
  useDifferentTimingPerDay?: boolean;
  dayTimings?: Record<string, { startTime: string; endTime: string }>;
};

type TeacherLiveBatch = {
  id: string;
  title?: string;
  teacherId?: string;
  publicationStatus?: string;
  accessLevel?: 'free' | 'paid';
  contentUnlockLeadMinutes?: number;
  subjectSchedules?: LiveBatchSchedule[];
};

type TeacherLiveBatchSession = {
  id: string;
  batchId?: string;
  type?: string;
  date?: string;
  holidayEndDate?: string;
  subjectId?: string;
  subjectName?: string;
  meetingTime?: string;
  meetingEndTime?: string;
  meetingTitle?: string;
};

type StudentEnrollment = LiveBatchEnrollmentLike & {
  id: string;
  batchId?: string;
  accessLevel?: 'free' | 'paid';
  teacherId?: string;
  notificationActionKeys?: string[];
};

type StudentLiveBatchTest = {
  id: string;
  title?: string;
  teacherId?: string;
  liveBatchId?: string;
  isLiveBatchTest?: boolean;
  accessLevel?: 'free' | 'paid';
  questionAccessLevel?: 'free' | 'paid';
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledEndTime?: string;
  accessStartTime?: string;
  accessEndTime?: string;
  accessWindowStartAt?: unknown;
  accessWindowEndAt?: unknown;
  startTime?: unknown;
  publicationStatus?: 'draft' | 'published' | 'deleted';
  config?: {
    questionIds?: string[];
    subjectConfigs?: Array<{ questionAccessLevel?: 'free' | 'paid' }>;
  };
};

type ReminderMoment = {
  key: string;
  atMs: number;
  minutesBeforeStart?: number;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const CLOCK_TICK_MS = 30 * 1000;
const DEFAULT_CONTENT_UNLOCK_LEAD_MINUTES = 10;
const MAX_CONTENT_UNLOCK_LEAD_MINUTES = 180;
const TEACHER_SCHEDULE_WINDOW_MS = 2 * 60 * 60 * 1000;
const TEACHER_SCHEDULE_OFFSETS_MS = [120, 90, 60, 30].map((minutes) => minutes * 60 * 1000);
const TEACHER_START_REMINDER_WINDOW_MS = 10 * 60 * 1000;
const STUDENT_REMINDER_OFFSETS_MINUTES = [10, 5, 1] as const;

const toYmd = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseYmd = (value?: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const expandYmdRange = (startValue?: string | null, endValue?: string | null) => {
  const start = parseYmd(startValue);
  const end = parseYmd(endValue || startValue);
  if (!start || !end) return [] as string[];

  const dates: string[] = [];
  const cursor = new Date(start);
  const endMs = end.getTime();
  while (cursor.getTime() <= endMs) {
    dates.push(toYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const chunkItems = <T,>(items: T[], size = 10) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const normalizeContentUnlockLeadMinutes = (value?: unknown) => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_CONTENT_UNLOCK_LEAD_MINUTES;
  return Math.min(MAX_CONTENT_UNLOCK_LEAD_MINUTES, Math.max(0, parsed));
};

const buildReminderMoments = (startAtMs: number, visibleAtMs: number) => {
  const momentsByTime = new Map<number, ReminderMoment>();

  if (Number.isFinite(visibleAtMs) && visibleAtMs < startAtMs) {
    momentsByTime.set(visibleAtMs, {
      key: 'available',
      atMs: visibleAtMs,
    });
  }

  STUDENT_REMINDER_OFFSETS_MINUTES.forEach((minutesBeforeStart) => {
    const atMs = startAtMs - (minutesBeforeStart * 60 * 1000);
    if (atMs >= startAtMs || momentsByTime.has(atMs)) return;
    momentsByTime.set(atMs, {
      key: `${minutesBeforeStart}m`,
      atMs,
      minutesBeforeStart,
    });
  });

  return Array.from(momentsByTime.values()).sort((a, b) => b.atMs - a.atMs);
};

const formatLeadTimeLabel = (minutes: number) => {
  if (minutes === 120) return '2 hours';
  if (minutes === 60) return '1 hour';
  return `${minutes} minutes`;
};

const formatTeacherAccessMoment = (value?: Date | null) => {
  if (!value || Number.isNaN(value.getTime())) return 'the scheduled live time';
  return value.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const buildStudentReminderCopy = (params: {
  kind: 'meeting' | 'test';
  moment: ReminderMoment;
  titleLabel: string;
  batchTitle: string;
}) => {
  if (params.moment.key === 'available') {
    return params.kind === 'meeting'
      ? {
          title: 'Classroom link is live',
          message: `${params.titleLabel} is now visible inside ${params.batchTitle}. Open the classroom and join right on time.`,
        }
      : {
          title: 'Your test is now visible',
          message: `${params.titleLabel} is now visible inside ${params.batchTitle}. Open the classroom and get exam-ready.`,
        };
  }

  const minuteLabel = `${params.moment.minutesBeforeStart} minute${params.moment.minutesBeforeStart === 1 ? '' : 's'}`;
  return params.kind === 'meeting'
    ? {
        title: `Class starts in ${minuteLabel}`,
        message: `${params.titleLabel} begins in ${minuteLabel}. Open ${params.batchTitle} and be ready to join on time.`,
      }
    : {
        title: `Test starts in ${minuteLabel}`,
        message: `${params.titleLabel} begins in ${minuteLabel}. Open ${params.batchTitle} and be ready to start strong.`,
      };
};

export function useBellNotifications() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [studentLiveBatches, setStudentLiveBatches] = useState<TeacherLiveBatch[]>([]);
  const [studentLiveBatchSessions, setStudentLiveBatchSessions] = useState<TeacherLiveBatchSession[]>([]);
  const [studentLiveBatchTests, setStudentLiveBatchTests] = useState<StudentLiveBatchTest[]>([]);
  const [studentBellDataLoading, setStudentBellDataLoading] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, CLOCK_TICK_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const notificationsQuery = useMemoFirebase(
    () => (firestore && user?.uid ? query(collection(firestore, 'notifications'), where('recipientId', '==', user.uid)) : null),
    [firestore, user?.uid]
  );
  const teacherBatchesQuery = useMemoFirebase(
    () => (firestore && user?.uid && isTeacher ? query(collection(firestore, 'live_batches'), where('teacherId', '==', user.uid)) : null),
    [firestore, isTeacher, user?.uid]
  );
  const teacherSessionsQuery = useMemoFirebase(
    () => (firestore && user?.uid && isTeacher ? query(collection(firestore, 'live_batch_sessions'), where('teacherId', '==', user.uid)) : null),
    [firestore, isTeacher, user?.uid]
  );
  const teacherTestsQuery = useMemoFirebase(
    () => (firestore && user?.uid && isTeacher ? query(collection(firestore, 'mock_tests'), where('teacherId', '==', user.uid)) : null),
    [firestore, isTeacher, user?.uid]
  );
  const teacherBatchEnrollmentsQuery = useMemoFirebase(
    () => (firestore && user?.uid && isTeacher ? query(collectionGroup(firestore, 'enrolled_live_batches'), where('teacherId', '==', user.uid)) : null),
    [firestore, isTeacher, user?.uid]
  );
  const studentEnrollmentsQuery = useMemoFirebase(
    () => (firestore && user?.uid && !isTeacher ? query(collection(firestore, 'users', user.uid, 'enrolled_live_batches')) : null),
    [firestore, isTeacher, user?.uid]
  );

  const { data: storedNotificationDocs = [], isLoading: notificationsLoading } = useCollection<StoredNotification>(notificationsQuery);
  const { data: teacherBatches = [], isLoading: teacherBatchesLoading } = useCollection<TeacherLiveBatch>(teacherBatchesQuery);
  const { data: teacherSessions = [], isLoading: teacherSessionsLoading } = useCollection<TeacherLiveBatchSession>(teacherSessionsQuery);
  const { data: teacherTests = [], isLoading: teacherTestsLoading } = useCollection<StudentLiveBatchTest>(teacherTestsQuery);
  const { data: teacherBatchEnrollments = [], isLoading: teacherBatchEnrollmentsLoading } = useCollection<StudentEnrollment>(teacherBatchEnrollmentsQuery);
  const { data: studentBatchEnrollments = [], isLoading: studentEnrollmentsLoading } = useCollection<StudentEnrollment>(studentEnrollmentsQuery);
  const teacherBatchById = useMemo(
    () => new Map((teacherBatches || []).filter((batch) => !!batch?.id).map((batch) => [String(batch.id), batch])),
    [teacherBatches]
  );
  const teacherLiveBatchTests = useMemo(
    () => (teacherTests || []).filter((test) => !!String(test.liveBatchId || '').trim() && test.isLiveBatchTest !== false),
    [teacherTests]
  );
  const teacherBatchTokenCountByBatchId = useMemo(() => {
    const map = new Map<string, number>();
    (teacherBatchEnrollments || []).forEach((enrollment) => {
      if (enrollment?.adminAccessDisabled === true) return;
      const batchId = String(enrollment.batchId || enrollment.id || '').trim();
      if (!batchId) return;
      map.set(batchId, (map.get(batchId) || 0) + 1);
    });
    return map;
  }, [teacherBatchEnrollments]);
  const teacherPremiumQuestionMinimumStudentsRequiredByTestId = useMemo(
    () => Object.fromEntries(
      teacherLiveBatchTests.map((test) => {
        const batchId = String(test.liveBatchId || '').trim();
        return [test.id, Math.max(1, teacherBatchTokenCountByBatchId.get(batchId) || 1)];
      })
    ),
    [teacherBatchTokenCountByBatchId, teacherLiveBatchTests]
  );
  const teacherPremiumQuestionReferenceTimeByTestId = useMemo(() => {
    const nowDate = new Date(nowMs);
    return Object.fromEntries(
      teacherLiveBatchTests.map((test) => {
        const batch = teacherBatchById.get(String(test.liveBatchId || '').trim());
        return [
          test.id,
          getLiveBatchTestTeacherQuestionAccessCheckAt({
            test,
            contentUnlockLeadMinutes: batch?.contentUnlockLeadMinutes,
            now: nowDate,
          }),
        ];
      })
    );
  }, [nowMs, teacherBatchById, teacherLiveBatchTests]);
  const { accessMap: teacherLiveBatchTestAccessMap } = useTeacherPremiumQuestionTestAccessMap(
    firestore,
    teacherLiveBatchTests,
    teacherPremiumQuestionMinimumStudentsRequiredByTestId,
    teacherPremiumQuestionReferenceTimeByTestId
  );

  const studentBatchIds = useMemo(
    () =>
      Array.from(
        new Set(
          (studentBatchEnrollments || [])
            .filter((enrollment) => enrollment?.adminAccessDisabled !== true)
            .map((enrollment) => String(enrollment.batchId || enrollment.id || '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [studentBatchEnrollments]
  );
  const studentBatchIdsKey = useMemo(
    () => studentBatchIds.join('|'),
    [studentBatchIds]
  );
  const studentBellRefreshKey = useMemo(
    () => Math.floor(nowMs / 60000),
    [nowMs]
  );

  useEffect(() => {
    setDismissedNotificationIds([]);
  }, [user?.uid]);

  useEffect(() => {
    if (!firestore || !user?.uid || isTeacher || studentBatchIds.length === 0) {
      setStudentLiveBatches([]);
      setStudentLiveBatchSessions([]);
      setStudentLiveBatchTests([]);
      setStudentBellDataLoading(false);
      return;
    }

    let isCancelled = false;
    setStudentBellDataLoading(true);

    const loadStudentBellData = async () => {
      try {
        const loadedBatches: TeacherLiveBatch[] = [];
        const loadedSessions: TeacherLiveBatchSession[] = [];
        const loadedTests: StudentLiveBatchTest[] = [];

        for (const batchIdChunk of chunkItems(studentBatchIds, 10)) {
          const [batchSnap, sessionSnap, testSnap] = await Promise.all([
            getDocs(query(collection(firestore, 'live_batches'), where(documentId(), 'in', batchIdChunk))),
            getDocs(query(collection(firestore, 'live_batch_sessions'), where('batchId', 'in', batchIdChunk))),
            getDocs(query(collection(firestore, 'mock_tests'), where('liveBatchId', 'in', batchIdChunk))),
          ]);

          batchSnap.docs.forEach((docSnap) => {
            loadedBatches.push({
              ...(docSnap.data() as Omit<TeacherLiveBatch, 'id'>),
              id: docSnap.id,
            });
          });
          sessionSnap.docs.forEach((docSnap) => {
            loadedSessions.push({
              ...(docSnap.data() as Omit<TeacherLiveBatchSession, 'id'>),
              id: docSnap.id,
            });
          });
          testSnap.docs.forEach((docSnap) => {
            loadedTests.push({
              ...(docSnap.data() as Omit<StudentLiveBatchTest, 'id'>),
              id: docSnap.id,
            });
          });
        }

        if (isCancelled) return;

        setStudentLiveBatches(loadedBatches);
        setStudentLiveBatchSessions(loadedSessions);
        setStudentLiveBatchTests(loadedTests);
      } catch {
        if (isCancelled) return;
        setStudentLiveBatches([]);
        setStudentLiveBatchSessions([]);
        setStudentLiveBatchTests([]);
      } finally {
        if (!isCancelled) {
          setStudentBellDataLoading(false);
        }
      }
    };

    loadStudentBellData();

    return () => {
      isCancelled = true;
    };
  }, [firestore, isTeacher, studentBatchIdsKey, studentBatchIds, studentBellRefreshKey, user?.uid]);

  const rawNotifications = useMemo(() => {
    const persistedItems = (storedNotificationDocs || []).map((notification) => buildPersistentBellNotification(notification));

    if (isTeacher) {
      const scheduleSuppressedKeys = new Set<string>();
      const meetingsByKey = new Set<string>();
      const syntheticItems = new Map<string, BellNotificationItem>();
      const batchTitleById = new Map<string, string>();

      (teacherBatches || []).forEach((batch) => {
        if (!batch?.id) return;
        batchTitleById.set(batch.id, String(batch.title || '').trim() || 'Live batch');
      });

      (teacherSessions || []).forEach((session) => {
        const batchId = String(session.batchId || '').trim();
        const date = String(session.date || '').trim();
        if (!batchId || !date) return;

        if (session.type === 'holiday') {
          expandYmdRange(date, session.holidayEndDate).forEach((ymd) => {
            scheduleSuppressedKeys.add(`${batchId}::${ymd}`);
          });
          return;
        }

        if (session.type === 'cancelled') {
          scheduleSuppressedKeys.add(`${batchId}::${date}`);
          return;
        }

        if (session.type === 'meeting') {
          const subjectId = String(session.subjectId || '').trim();
          meetingsByKey.add(`${batchId}::${date}::${subjectId}`);
        }
      });

      (teacherBatches || []).forEach((batch) => {
        const batchId = String(batch.id || '').trim();
        if (!batchId || batch.publicationStatus === 'deleted' || batch.publicationStatus === 'draft') return;

        const unlockLeadMs = normalizeContentUnlockLeadMinutes(batch.contentUnlockLeadMinutes) * 60 * 1000;

        (batch.subjectSchedules || []).forEach((schedule) => {
          const subjectId = String(schedule.subjectId || '').trim();
          const subjectLabel = String(schedule.subjectName || subjectId || 'the next class').trim() || 'the next class';

          for (let offset = 0; offset <= 1; offset += 1) {
            const candidateDate = new Date(nowMs);
            candidateDate.setHours(0, 0, 0, 0);
            candidateDate.setDate(candidateDate.getDate() + offset);

            const dayName = DAY_NAMES[candidateDate.getDay()];
            if (!(schedule.daysOfWeek || []).includes(dayName)) continue;

            const dayTiming = schedule.useDifferentTimingPerDay ? schedule.dayTimings?.[dayName] : undefined;
            const startTime = schedule.useDifferentTimingPerDay ? (dayTiming?.startTime || '') : (schedule.startTime || '');
            if (!startTime) continue;

            const dateKey = toYmd(candidateDate);
            const slotStartAt = parseYmdHmToLocalDateTime(dateKey, startTime);
            if (!slotStartAt) continue;

            const slotStartMs = slotStartAt.getTime();
            const linkVisibleAtMs = slotStartMs - unlockLeadMs;
            if (slotStartMs <= nowMs || linkVisibleAtMs <= nowMs || nowMs < linkVisibleAtMs - TEACHER_SCHEDULE_WINDOW_MS) continue;
            if (scheduleSuppressedKeys.has(`${batchId}::${dateKey}`)) continue;
            if (meetingsByKey.has(`${batchId}::${dateKey}::${subjectId}`)) continue;

            TEACHER_SCHEDULE_OFFSETS_MS.forEach((offsetMs) => {
              const reminderAtMs = linkVisibleAtMs - offsetMs;
              if (reminderAtMs > nowMs || nowMs >= linkVisibleAtMs) return;

              const leadMinutes = Math.round(offsetMs / 60000);
              const reminderId = `teacher-schedule:${batchId}:${dateKey}:${subjectId || 'all'}:${leadMinutes}`;
              syntheticItems.set(reminderId, {
                id: reminderId,
                title: `Classroom opens in ${formatLeadTimeLabel(leadMinutes)}`,
                message: `${batchTitleById.get(batchId) || 'Live batch'} still has no meeting scheduled for ${subjectLabel} at ${formatScheduledMoment(dateKey, startTime)}. Publish it now so students see the link on time.`,
                href: `/live-batches/schedule/${batchId}`,
                notificationType: 'teacher_schedule_class_reminder',
                createdAtMs: reminderAtMs,
                isRead: false,
                isPersistent: false,
                keepUntilAction: true,
              });
            });
          }
        });
      });

      (teacherSessions || []).forEach((session) => {
        if (session.type !== 'meeting') return;

        const batchId = String(session.batchId || '').trim();
        const startAt = parseYmdHmToLocalDateTime(session.date, session.meetingTime);
        if (!batchId || !startAt) return;

        const startMs = startAt.getTime();
        if (startMs <= nowMs || startMs > nowMs + TEACHER_START_REMINDER_WINDOW_MS) return;

        const reminderId = `teacher-start:${batchId}:${session.id}:${session.date || ''}:${session.meetingTime || ''}`;
        syntheticItems.set(reminderId, {
          id: reminderId,
          title: 'Start your live class',
          message: `${session.meetingTitle || 'Live class'} begins at ${formatScheduledMoment(session.date, session.meetingTime)}. Open the schedule and go live now.`,
          href: `/live-batches/schedule/${batchId}`,
          notificationType: 'teacher_start_class_reminder',
          createdAtMs: Math.max(nowMs, startMs - TEACHER_START_REMINDER_WINDOW_MS),
          isRead: false,
          isPersistent: false,
          keepUntilAction: true,
        });
      });

      (teacherLiveBatchTests || []).forEach((test) => {
        const batchId = String(test.liveBatchId || '').trim();
        if (!batchId || test.publicationStatus === 'draft' || test.publicationStatus === 'deleted') return;

        const accessState = teacherLiveBatchTestAccessMap[test.id];
        if (!accessState?.isProtected || accessState.isAccessible) return;

        const checkAt = teacherPremiumQuestionReferenceTimeByTestId[test.id];
        const needsCoverageByFutureMoment =
          checkAt instanceof Date
          && !Number.isNaN(checkAt.getTime())
          && checkAt.getTime() > nowMs;
        const testTitle = String(test.title || '').trim() || 'Live batch test';
        const batchTitle = batchTitleById.get(batchId) || 'Live batch';
        const reminderId = `teacher-paid-question-renewal:${batchId}:${test.id}`;
        const blockedReason = buildTeacherPremiumQuestionTestBlockedReason(accessState);

        syntheticItems.set(reminderId, {
          id: reminderId,
          title: needsCoverageByFutureMoment
            ? 'Renew paid questions before test goes live'
            : 'Paid question coverage needed now',
          message: needsCoverageByFutureMoment
            ? `${batchTitle}: ${testTitle} needs valid paid-question coverage by ${formatTeacherAccessMoment(checkAt)}. ${blockedReason}`
            : `${batchTitle}: ${testTitle} is currently blocked because its paid-question coverage is no longer valid. ${blockedReason}`,
          href: `/live-batches/schedule/${batchId}`,
          notificationType: 'teacher_paid_question_renewal_reminder',
          createdAtMs: nowMs,
          isRead: false,
          isPersistent: false,
          keepUntilAction: true,
        });
      });

      return [...persistedItems, ...Array.from(syntheticItems.values())].sort((a, b) => b.createdAtMs - a.createdAtMs);
    }

    const batchById = new Map<string, TeacherLiveBatch>();
    const sessionsByBatchId = new Map<string, TeacherLiveBatchSession[]>();
    const testsByBatchId = new Map<string, StudentLiveBatchTest[]>();
    const syntheticItems = new Map<string, BellNotificationItem>();

    (studentLiveBatches || []).forEach((batch) => {
      if (!batch?.id) return;
      batchById.set(batch.id, batch);
    });

    (studentLiveBatchSessions || []).forEach((session) => {
      const batchId = String(session.batchId || '').trim();
      if (!batchId) return;
      const current = sessionsByBatchId.get(batchId) || [];
      current.push(session);
      sessionsByBatchId.set(batchId, current);
    });

    (studentLiveBatchTests || []).forEach((test) => {
      const batchId = String(test.liveBatchId || '').trim();
      if (!batchId) return;
      const current = testsByBatchId.get(batchId) || [];
      current.push(test);
      testsByBatchId.set(batchId, current);
    });

    (studentBatchEnrollments || [])
      .filter((enrollment) => enrollment?.adminAccessDisabled !== true)
      .forEach((enrollment) => {
      const batchId = String(enrollment.batchId || enrollment.id || '').trim();
      if (!batchId) return;

      const batch = batchById.get(batchId);
      if (!batch || batch.publicationStatus === 'deleted' || batch.publicationStatus === 'draft') return;

      const batchTitle = String(batch.title || 'your live batch').trim() || 'your live batch';
      const batchSessions = sessionsByBatchId.get(batchId) || [];
      const batchTests = testsByBatchId.get(batchId) || [];
      const actionKeys = new Set(normalizeReminderActionKeys(enrollment.notificationActionKeys));
      const isPaidBatch = (batch.accessLevel || enrollment.accessLevel || 'free') === 'paid';
      const coverage = isPaidBatch
        ? calculateLiveBatchSessionCoverage({
            sessions: batchSessions,
            enrollment,
            now: new Date(nowMs),
          })
        : null;
      const hasMeetingTokenNow = !isPaidBatch || (coverage?.remainingSessions ?? 0) > 0;
      const unlockLeadMs = normalizeContentUnlockLeadMinutes(batch.contentUnlockLeadMinutes) * 60 * 1000;
      const suppressedDates = new Set<string>();

      batchSessions.forEach((session) => {
        const date = String(session.date || '').trim();
        if (!date) return;

        if (session.type === 'holiday') {
          expandYmdRange(date, session.holidayEndDate).forEach((ymd) => {
            suppressedDates.add(ymd);
          });
          return;
        }

        if (session.type === 'cancelled') {
          suppressedDates.add(date);
        }
      });

      batchSessions
        .filter((session) => session.type === 'meeting')
        .forEach((session) => {
          const startAt = parseYmdHmToLocalDateTime(session.date, session.meetingTime);
          const meetingDate = String(session.date || '').trim();
          if (!startAt || !meetingDate || suppressedDates.has(meetingDate)) return;

          const startAtMs = startAt.getTime();
          if (startAtMs <= nowMs) return;
          if (isPaidBatch && !hasMeetingTokenNow) return;

          const meetingActionKey = buildMeetingReminderActionKey({
            batchId,
            sessionId: session.id,
            date: session.date,
            meetingTime: session.meetingTime,
            subjectId: session.subjectId,
          });
          if (meetingActionKey && actionKeys.has(meetingActionKey)) return;

          const subjectLabel = String(session.subjectName || session.subjectId || '').trim();
          const meetingTitle = String(session.meetingTitle || '').trim() || (subjectLabel ? `${subjectLabel} Live Class` : 'Live class');
          const visibleAtMs = startAtMs - unlockLeadMs;

          buildReminderMoments(startAtMs, visibleAtMs).forEach((moment) => {
            if (moment.atMs > nowMs || nowMs >= startAtMs) return;

            const copy = buildStudentReminderCopy({
              kind: 'meeting',
              moment,
              titleLabel: meetingTitle,
              batchTitle,
            });
            const reminderId = `student-meeting:${batchId}:${session.id}:${moment.key}`;

            syntheticItems.set(reminderId, {
              id: reminderId,
              title: copy.title,
              message: copy.message,
              href: `/live-batches/${batchId}/classroom`,
              notificationType: 'live_batch_upcoming',
              createdAtMs: moment.atMs,
              isRead: false,
              isPersistent: false,
              keepUntilAction: true,
            });
          });
        });

      batchTests.forEach((test) => {
        if (test.publicationStatus === 'draft' || test.publicationStatus === 'deleted') return;

        const schedule = resolveLiveBatchTestSchedule(test);
        const startAt = schedule.testStartAt;
        if (!startAt) return;

        const startAtMs = startAt.getTime();
        if (startAtMs <= nowMs) return;
        if (isPaidBatch && !hasPaidLiveBatchTestTokenAccessAtStart({ test, enrollment, sessions: batchSessions })) return;

        const testActionKey = buildTestReminderActionKey({
          testId: test.id,
          scheduledDate: test.scheduledDate,
          scheduledTime: test.scheduledTime,
          startTime: startAt,
        });
        if (testActionKey && actionKeys.has(testActionKey)) return;

        const testTitle = String(test.title || '').trim() || 'Live batch test';
        const visibleAtMs = startAtMs - unlockLeadMs;

        buildReminderMoments(startAtMs, visibleAtMs).forEach((moment) => {
          if (moment.atMs > nowMs || nowMs >= startAtMs) return;

          const copy = buildStudentReminderCopy({
            kind: 'test',
            moment,
            titleLabel: testTitle,
            batchTitle,
          });
          const reminderId = `student-test:${batchId}:${test.id}:${moment.key}`;

          syntheticItems.set(reminderId, {
            id: reminderId,
            title: copy.title,
            message: copy.message,
            href: `/live-batches/${batchId}/classroom`,
            notificationType: 'live_batch_test_scheduled',
            createdAtMs: moment.atMs,
            isRead: false,
            isPersistent: false,
            keepUntilAction: true,
          });
        });
      });
      });

    return [...persistedItems, ...Array.from(syntheticItems.values())].sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [
    isTeacher,
    nowMs,
    storedNotificationDocs,
    studentBatchEnrollments,
    studentLiveBatchSessions,
    studentLiveBatchTests,
    studentLiveBatches,
    teacherBatches,
    teacherLiveBatchTests,
    teacherLiveBatchTestAccessMap,
    teacherPremiumQuestionReferenceTimeByTestId,
    teacherSessions,
  ]);

  const dismissedNotificationIdSet = useMemo(
    () => new Set(dismissedNotificationIds),
    [dismissedNotificationIds]
  );
  const notifications = useMemo(
    () => rawNotifications.filter((notification) => notification.keepUntilAction || (!notification.isRead && !dismissedNotificationIdSet.has(notification.id))),
    [dismissedNotificationIdSet, rawNotifications]
  );
  const unreadCount = useMemo(
    () => notifications.length,
    [notifications]
  );
  const isLoading = useMemo(
    () =>
      notificationsLoading
      || isTeacherLoading
      || (isTeacher && (teacherBatchesLoading || teacherSessionsLoading || teacherTestsLoading || teacherBatchEnrollmentsLoading))
      || (!isTeacher && (studentEnrollmentsLoading || studentBellDataLoading)),
    [
      isTeacher,
      isTeacherLoading,
      notificationsLoading,
      studentBellDataLoading,
      studentEnrollmentsLoading,
      teacherBatchEnrollmentsLoading,
      teacherBatchesLoading,
      teacherSessionsLoading,
      teacherTestsLoading,
    ]
  );
  const appBellSyncPayloadKey = useMemo(
    () => (isLoading
      ? ''
      : JSON.stringify({
          userId: user?.uid || null,
          notifications: notifications.map((notification) => ({
            id: notification.id,
            title: notification.title,
            message: notification.message,
            href: notification.href || '',
            createdAtMs: notification.createdAtMs,
            notificationType: notification.notificationType,
            keepUntilAction: notification.keepUntilAction === true,
          })),
        })),
    [isLoading, notifications, user?.uid]
  );

  useEffect(() => {
    if (isLoading || !appBellSyncPayloadKey) return;

    syncBellNotificationsToApp({
      userId: user?.uid || null,
      notifications,
    });
  }, [appBellSyncPayloadKey, isLoading, notifications, user?.uid]);

  const addDismissedNotificationIds = (notificationIds: string[]) => {
    setDismissedNotificationIds((current) => {
      const next = new Set(current);
      notificationIds.forEach((notificationId) => {
        if (notificationId) {
          next.add(notificationId);
        }
      });
      return Array.from(next);
    });
  };
  const removeDismissedNotificationIds = (notificationIds: string[]) => {
    if (notificationIds.length === 0) return;
    setDismissedNotificationIds((current) => current.filter((notificationId) => !notificationIds.includes(notificationId)));
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!firestore || !notificationId) return false;

    const target = rawNotifications.find((notification) => notification.id === notificationId);
    if (!target) return false;
    if (target.keepUntilAction) return true;
    if (!target.isPersistent) {
      addDismissedNotificationIds([notificationId]);
      return true;
    }
    if (target.isRead) return true;

    try {
      addDismissedNotificationIds([notificationId]);
      await deleteDoc(doc(firestore, 'notifications', notificationId));
      return true;
    } catch {
      removeDismissedNotificationIds([notificationId]);
      return false;
    }
  };

  const markAllNotificationsRead = async () => {
    if (!firestore) return false;
    const visibleSyntheticIds = notifications
      .filter((notification) => !notification.isPersistent && !notification.keepUntilAction)
      .map((notification) => notification.id);
    if (visibleSyntheticIds.length > 0) {
      addDismissedNotificationIds(visibleSyntheticIds);
    }

    const unreadPersistentIds = notifications
      .filter((notification) => notification.isPersistent && !notification.keepUntilAction)
      .map((notification) => notification.id);
    if (unreadPersistentIds.length === 0) return true;

    try {
      addDismissedNotificationIds(unreadPersistentIds);
      const batch = writeBatch(firestore);
      unreadPersistentIds.forEach((notificationId) => {
        batch.delete(doc(firestore, 'notifications', notificationId));
      });
      await batch.commit();
      return true;
    } catch {
      removeDismissedNotificationIds(unreadPersistentIds);
      return false;
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markNotificationRead,
    markAllNotificationsRead,
  };
}
