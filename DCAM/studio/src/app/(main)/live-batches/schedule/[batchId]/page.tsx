'use client';

import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import DashboardHeader from '@/components/dashboard-header';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, addDocumentNonBlocking, useUser, useDoc, updateDocumentNonBlocking, useStorage, deleteDocumentNonBlocking } from '@/firebase';
import { collection, collectionGroup, query, orderBy, serverTimestamp, doc, where, deleteField, limit } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useState, useMemo, useEffect, useRef } from 'react';
import { AlertTriangle, ArrowRight, CalendarClock, CalendarDays, CheckCircle2, Clock3, FileText, Link2, LoaderCircle, Megaphone, PlusCircle, Save, ShieldCheck, Trash2, Upload, Video, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useParams, useRouter } from 'next/navigation';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import ConductedSessionDatePicker from '@/components/live-batches/conducted-session-date-picker';
import { isValidHttpUrl } from '@/lib/http-url';
import { buildPracticeQuestionScopeEntries, type PracticeQuestionScopeEntry } from '@/lib/practice-question-scope';
import { extractSubtopicPaths, normalizeSubtopicValue, splitSubtopicPath } from '@/lib/subtopic-paths';
import { formatTestDurationLabel } from '@/lib/test-duration';
import { ALLOWED_TEACHER_AUTHOR_EMAIL } from '@/lib/teacher-authoring';
import {
  type DifficultyLevel,
  isTeacherQuestionPurchaseActiveAt,
  type TeacherQuestionPurchaseDoc,
} from '@/lib/teacher-question-purchase';
import {
  findUpcomingLiveBatchMeetingMatch,
  getConductedLiveBatchSessionDateOptions,
  getLiveBatchSessionOccurrenceKey,
  getUpcomingLiveBatchMeetingSessions,
  resolveLiveBatchSessions,
} from '@/lib/live-batch-session-access';
import { getLiveBatchTestTeacherQuestionCoverageStartAt } from '@/lib/live-batch-test-access';
import { cn } from '@/lib/utils';
import { notifyLiveBatchStudents } from '@/lib/client-notifications';

type Question = {
  id: string;
  questionText: string;
  questionType?: 'MCQ' | 'Numerical' | 'Text';
  classId: string;
  subjectId: string;
  topicId: string;
  subtopics?: string[];
  accessLevel: 'free' | 'paid';
  mockTestOnly?: boolean;
  isPreviousYear?: boolean;
  previousYear?: string;
  examTypeId: string;
  difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  examLevel?: 'weak' | 'medium' | 'strong';
  alignments?: Array<{
    examTypeId: string;
    classId: string;
    subjectId: string;
    topicId?: string;
    subtopics?: string[];
    difficultyLevel?: 'Easy' | 'Medium' | 'Hard';
    accessLevel?: 'free' | 'paid';
    mockTestOnly?: boolean;
    isPreviousYear?: boolean;
    previousYear?: string;
  }>;
  teacherId?: string;
};
type Class = { id: string; name: string; examTypeId: string };
type Subject = { id: string; name: string; classId: string };
type Topic = { id: string; name: string; subjectId: string };
type ExamType = { id: string; name: string };
type TeachingAssignment = { classId: string; subjectIds?: string[]; allSubjects?: boolean };
type UserProfile = { teachingAssignments?: TeachingAssignment[] };
type DcamQuestionBankOwnerProfile = {
  id: string;
  email?: string;
};
type EnrolledBatchStudentRecord = {
  id: string;
  batchId?: string;
  teacherId?: string;
  sessionsPurchased?: number;
  enrolledAt?: unknown;
};
type PurchaseAvailabilityDialogState = {
  open: boolean;
  title: string;
  description: string;
};
type PurchasedQuestionCategory = 'regular' | 'pyq';
type CandidateQuestionRow = {
  id: string;
  question: Question;
  topicId: string;
  subtopics: string[];
  difficultyLevel: DifficultyLevel;
  category: PurchasedQuestionCategory;
};
type AvailableQuestionEntry = PracticeQuestionScopeEntry<Question>;
type ScheduledTestAvailabilityMode = 'single_day' | 'unlimited';
type AttemptLimitMode = 'unlimited' | 'total' | 'interval';
type AttemptIntervalUnit = 'day' | 'week' | 'month' | 'year';
type AttemptLimitConfig = {
  mode?: AttemptLimitMode;
  maxTotalAttempts?: number | null;
  maxAttemptsPerInterval?: number | null;
  intervalValue?: number | null;
  intervalUnit?: AttemptIntervalUnit | null;
};
type LiveBatchSubjectSchedule = {
  subjectId: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  useDifferentTimingPerDay?: boolean;
  dayTimings?: Record<string, { startTime: string; endTime: string }>;
  defaultZoomLink?: string;
};
type LiveBatch = {
  id: string;
  title: string;
  examTypeId: string;
  classId: string;
  batchStartDate?: string;
  subjectIds?: string[];
  teacherId: string;
  accessLevel?: 'free' | 'paid';
  contentUnlockLeadMinutes?: number;
  subjectSchedules?: LiveBatchSubjectSchedule[];
  scheduleVersion?: number;
};
type LiveBatchSession = {
  id: string;
  batchId: string;
  teacherId: string;
  type: 'meeting' | 'previous_session' | 'holiday' | 'cancelled';
  date?: string;
  holidayEndDate?: string;
  meetingTime?: string;
  meetingEndTime?: string;
  subjectId?: string;
  subjectName?: string;
  meetingTitle?: string;
  sessionLabel?: string;
  zoomMeetingId?: string;
  zoomMeetingPassword?: string;
  zoomLink?: string;
  previousSessionUrl?: string;
  notesFileUrl?: string;
  notesFileName?: string;
  notesFileType?: string;
  notesFileSize?: number;
  reason?: string;
  timingMode?: 'batch_default' | 'manual_override';
  scheduleVersion?: number;
  targetSessionId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};
type NoticeTargetPeriod = 'upcoming' | 'previous';
type TeacherNoticeTargetOption = {
  id: string;
  occurrenceKey: string;
  date: string;
  meetingTime: string;
  meetingEndTime: string;
  subjectId?: string;
  subjectName?: string;
  title: string;
  meetingTitle?: string;
  source: 'upcoming' | 'meeting' | 'previous_session' | 'meeting_and_previous_session';
  sessionId?: string;
  previousSessionId?: string;
  previousUploadCount: number;
};
type ScheduledLiveBatchTest = {
  id: string;
  title: string;
  liveBatchId?: string;
  teacherId?: string;
  publicationStatus?: 'draft' | 'published' | 'deleted';
  availabilityMode?: ScheduledTestAvailabilityMode;
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledEndTime?: string;
  accessStartTime?: string;
  accessEndTime?: string;
  attemptLimit?: AttemptLimitConfig;
  startTime?: { toDate?: () => Date } | Date | string;
  accessWindowStartAt?: { toDate?: () => Date } | Date | string;
  accessWindowEndAt?: { toDate?: () => Date } | Date | string;
  config?: { duration?: number | null };
};
type ScheduledTestDraft = {
  availabilityMode: ScheduledTestAvailabilityMode;
  scheduledDate: string;
  scheduledTime: string;
  scheduledEndTime: string;
  attemptLimitMode: AttemptLimitMode;
  maxTotalAttempts: number;
  maxAttemptsPerInterval: number;
  attemptIntervalValue: number;
  attemptIntervalUnit: AttemptIntervalUnit;
};
type UpcomingSessionSlot = {
  date: string;
  dayName: string;
  subjectId: string;
  subjectName: string;
  startTime: string;
  endTime: string;
  noticeType?: 'holiday' | 'cancelled';
  noticeText?: string;
};
type UpcomingSessionSlotGroup = {
  subjectId: string;
  subjectName: string;
  slots: UpcomingSessionSlot[];
};

type UpcomingSessionSlotBrowserProps = {
  title: string;
  description: string;
  groups: UpcomingSessionSlotGroup[];
  emptyDescription: string;
  activeSubjectId?: string;
  onUseForMeeting?: (slot: UpcomingSessionSlot) => void;
  onUseForTest?: (slot: UpcomingSessionSlot) => void;
  isMeetingSlotSelected?: (slot: UpcomingSessionSlot) => boolean;
  isTestSlotSelected?: (slot: UpcomingSessionSlot) => boolean;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const UPCOMING_SCHEDULE_WINDOW_DAYS = 7;
const MAX_PREVIOUS_SESSION_NOTE_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const DEFAULT_CONTENT_UNLOCK_LEAD_MINUTES = 10;
const MAX_CONTENT_UNLOCK_LEAD_MINUTES = 180;
const normalizeScopeOptionLabel = (value?: string | null) => String(value || '').trim().toLowerCase();
const toLocalYmd = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const normalizeContentUnlockLeadMinutes = (value?: unknown) => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_CONTENT_UNLOCK_LEAD_MINUTES;
  return Math.min(MAX_CONTENT_UNLOCK_LEAD_MINUTES, Math.max(0, parsed));
};
const formatContentUnlockLeadLabel = (minutes: number) => (minutes === 0 ? 'At start' : `${minutes} min`);
const getContentUnlockRuleText = (minutes: number) => {
  if (minutes === 0) {
    return 'Enrolled students will see scheduled content exactly at the scheduled time.';
  }
  return `Enrolled students will see scheduled content ${minutes} minute${minutes === 1 ? '' : 's'} before the scheduled time.`;
};
const parseYmdToLocalDate = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};
const expandYmdDateRange = (startValue?: string, endValue?: string) => {
  const startDate = parseYmdToLocalDate(startValue);
  if (!startDate) return [] as string[];
  const endDateParsed = parseYmdToLocalDate(endValue);
  const normalizedEndDate = !endDateParsed || endDateParsed.getTime() < startDate.getTime() ? startDate : endDateParsed;

  const dates: string[] = [];
  const cursor = new Date(startDate);
  while (cursor.getTime() <= normalizedEndDate.getTime()) {
    dates.push(toLocalYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};
const formatYmdRange = (startValue?: string, endValue?: string) => {
  if (!startValue) return 'N/A';
  if (!endValue || endValue === startValue) return startValue;
  return `${startValue} to ${endValue}`;
};
const parseTimeToMinutes = (value?: string) => {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return (hour * 60) + minute;
};
const addMinutesToTime = (value: string, minutesToAdd: number) => {
  const baseMinutes = parseTimeToMinutes(value);
  if (baseMinutes === null) return '';
  const normalizedAdd = Math.max(0, Math.floor(Number(minutesToAdd) || 0));
  const wrapped = (baseMinutes + normalizedAdd) % (24 * 60);
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};
const formatCoverageMomentLabel = (value?: Date | null) => {
  if (!value || Number.isNaN(value.getTime())) return 'the scheduled live time';
  return value.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};
const createEmptyMeetingDraft = () => ({
  date: '',
  meetingTime: '',
  meetingEndTime: '',
});
const createEmptyScheduledTestDraft = (): ScheduledTestDraft => ({
  availabilityMode: 'single_day',
  scheduledDate: '',
  scheduledTime: '',
  scheduledEndTime: '',
  attemptLimitMode: 'unlimited',
  maxTotalAttempts: 1,
  maxAttemptsPerInterval: 1,
  attemptIntervalValue: 1,
  attemptIntervalUnit: 'week',
});

const createOptionalTimeField = (message: string) =>
  z.string().trim().refine((value) => value === '' || /^\d{2}:\d{2}$/.test(value), message);

const resolveScheduledTestAvailabilityMode = (
  input?: Pick<ScheduledLiveBatchTest, 'availabilityMode' | 'scheduledEndTime' | 'accessStartTime' | 'accessEndTime'> | null
): ScheduledTestAvailabilityMode => {
  if (input?.availabilityMode === 'single_day' || input?.availabilityMode === 'unlimited') {
    return input.availabilityMode;
  }
  if (String(input?.scheduledEndTime || '').trim()) return 'single_day';
  if (String(input?.accessStartTime || '').trim() || String(input?.accessEndTime || '').trim()) return 'single_day';
  return 'unlimited';
};

const getScheduledTestDurationMinutes = (startValue?: string, endValue?: string) => {
  const startMinutes = parseTimeToMinutes(startValue);
  const endMinutes = parseTimeToMinutes(endValue);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null;
  return endMinutes - startMinutes;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const parsed = (value as { toDate: () => Date }).toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const getScheduledTestCompletedAt = (test: ScheduledLiveBatchTest): Date | null => {
  const availabilityMode = resolveScheduledTestAvailabilityMode(test);
  if (availabilityMode === 'unlimited') return null;

  const scheduledDate = String(test.scheduledDate || '').trim();
  const endTime = String(test.scheduledEndTime || test.scheduledTime || '').trim();
  if (scheduledDate) {
    if (endTime && /^\d{2}:\d{2}$/.test(endTime)) {
      return toDate(`${scheduledDate}T${endTime}:00`);
    }
    return toDate(`${scheduledDate}T23:59:59`);
  }

  const startAt = toDate(test.startTime);
  if (!startAt) return null;
  const durationMinutes = Math.max(0, Number(test.config?.duration || 0));
  if (durationMinutes > 0) {
    return new Date(startAt.getTime() + (durationMinutes * 60 * 1000));
  }
  return startAt;
};

const isScheduledTestCompleted = (test: ScheduledLiveBatchTest, now: Date) => {
  if (test.publicationStatus === 'deleted') return true;
  const completedAt = getScheduledTestCompletedAt(test);
  return completedAt ? completedAt.getTime() < now.getTime() : false;
};

const buildScheduledTestSummary = (input: {
  availabilityMode: ScheduledTestAvailabilityMode;
  scheduledDate: string;
  scheduledTime?: string;
  scheduledEndTime?: string;
}) => {
  if (input.availabilityMode === 'unlimited') {
    return `will appear on ${input.scheduledDate} and stay available until the teacher updates it`;
  }
  const parts = [`is scheduled on ${input.scheduledDate}`];
  if (input.scheduledTime && input.scheduledEndTime) {
    parts.push(`from ${input.scheduledTime} to ${input.scheduledEndTime}`);
    const durationMinutes = getScheduledTestDurationMinutes(input.scheduledTime, input.scheduledEndTime);
    if (durationMinutes !== null) {
      parts.push(`with ${durationMinutes} minute${durationMinutes === 1 ? '' : 's'} total time`);
    }
  } else if (input.scheduledTime) {
    parts.push(`starting at ${input.scheduledTime}`);
  }
  return parts.join(', ');
};

const scheduleModuleCards = [
  {
    id: 'meeting' as const,
    label: 'Schedule Meeting',
    description: 'Set class date, time, and meeting link.',
    helper: 'Meeting',
    icon: Video,
    accentClass: 'from-cyan-500/20 via-sky-500/10 to-transparent',
    iconClass: 'border-cyan-400/25 bg-cyan-500/15 text-cyan-100',
  },
  {
    id: 'previous' as const,
    label: 'Upload Previous Session',
    description: 'Add the replay link and notes for a completed class.',
    helper: 'Replay',
    icon: Link2,
    accentClass: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    iconClass: 'border-emerald-400/25 bg-emerald-500/15 text-emerald-100',
  },
  {
    id: 'test' as const,
    label: 'Schedule Test',
    description: 'Set timing, attempts, and question sections.',
    helper: 'Test',
    icon: CalendarClock,
    accentClass: 'from-violet-500/20 via-fuchsia-500/10 to-transparent',
    iconClass: 'border-violet-400/25 bg-violet-500/15 text-violet-100',
  },
] as const;

function UpcomingSessionSlotBrowser({
  title,
  description,
  groups,
  emptyDescription,
  activeSubjectId,
  onUseForMeeting,
  onUseForTest,
  isMeetingSlotSelected,
  isTestSlotSelected,
}: UpcomingSessionSlotBrowserProps) {
  const orderedGroups = useMemo(() => {
    if (!activeSubjectId) return groups;
    return [...groups].sort((a, b) => {
      const aActive = a.subjectId === activeSubjectId ? 1 : 0;
      const bActive = b.subjectId === activeSubjectId ? 1 : 0;
      return bActive - aActive;
    });
  }, [activeSubjectId, groups]);
  const hasAnySlots = orderedGroups.some((group) => group.slots.length > 0);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.62))] p-4 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.95)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="relative space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="w-fit rounded-full border-primary/35 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Upcoming session slots
            </Badge>
            <div className="space-y-1">
              <p className="text-base font-semibold">{title}</p>
              <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-background/45 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Subjects</p>
              <p className="mt-1 text-lg font-semibold">{orderedGroups.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-background/45 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Window</p>
              <p className="mt-1 text-lg font-semibold">Next 7 days</p>
            </div>
          </div>
        </div>
      {hasAnySlots ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {orderedGroups.map((group) => (
            <div
              key={group.subjectId}
              className={cn(
                'rounded-3xl border border-white/10 bg-background/45 p-4 backdrop-blur-sm transition-all',
                group.subjectId === activeSubjectId && 'border-primary/40 bg-primary/10 shadow-[0_18px_45px_-32px_rgba(59,130,246,0.8)]'
              )}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold">{group.subjectName}</p>
                    <Badge variant="outline" className="rounded-full border-white/10 bg-background/60 text-[11px] text-muted-foreground">
                      {group.slots.length} slot{group.slots.length === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {group.slots.length > 0
                      ? 'Tap a slot to auto-fill meeting or test timing.'
                      : 'No upcoming slot in the next 7 days'}
                  </p>
                </div>
                {group.subjectId === activeSubjectId ? (
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                    Selected subject
                  </span>
                ) : null}
              </div>
              {group.slots.length > 0 ? (
                <ScrollArea className="h-64">
                  <div className="space-y-2 pr-3">
                    {group.slots.map((slot, idx) => {
                      const timeLabel = slot.endTime ? `${slot.startTime} to ${slot.endTime}` : slot.startTime;
                      const meetingSelected = isMeetingSlotSelected?.(slot) ?? false;
                      const testSelected = isTestSlotSelected?.(slot) ?? false;
                      return (
                        <div
                          key={`${group.subjectId}-${slot.date}-${slot.startTime}-${idx}`}
                          className={cn(
                            'rounded-2xl border p-4 transition-all',
                            slot.noticeType ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/10 bg-background/60 hover:border-primary/25 hover:bg-background/70'
                          )}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">
                                  {slot.date} ({slot.dayName.slice(0, 3)})
                                </p>
                                {slot.noticeType ? (
                                  <Badge variant="outline" className="rounded-full border-amber-400/35 bg-amber-500/10 text-[11px] text-amber-200">
                                    Notice
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground">{timeLabel}</p>
                              {slot.noticeText ? (
                                <p className={cn('text-xs', slot.noticeType ? 'text-amber-200' : 'text-muted-foreground')}>
                                  {slot.noticeText}
                                </p>
                              ) : null}
                            </div>
                            {(onUseForMeeting || onUseForTest) ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {onUseForMeeting ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={meetingSelected ? 'default' : 'outline'}
                                    className={cn(
                                      'h-9 rounded-full px-4',
                                      !meetingSelected && 'border-white/15 bg-background/50 hover:border-cyan-400/35 hover:bg-cyan-500/10 hover:text-cyan-100',
                                      meetingSelected && 'border-cyan-400/40 bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/25'
                                    )}
                                    onClick={() => onUseForMeeting(slot)}
                                    disabled={Boolean(slot.noticeType)}
                                  >
                                    {meetingSelected ? 'Meeting Selected' : 'Use for Meeting'}
                                  </Button>
                                ) : null}
                                {onUseForTest ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={testSelected ? 'default' : 'outline'}
                                    className={cn(
                                      'h-9 rounded-full px-4',
                                      !testSelected && 'border-white/15 bg-background/50 hover:border-violet-400/35 hover:bg-violet-500/10 hover:text-violet-100',
                                      testSelected && 'border-violet-400/40 bg-violet-500/20 text-violet-50 hover:bg-violet-500/25'
                                    )}
                                    onClick={() => onUseForTest(slot)}
                                    disabled={Boolean(slot.noticeType)}
                                  >
                                    {testSelected ? 'Test Selected' : 'Use for Test'}
                                  </Button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-background/35 px-4 py-5 text-sm text-muted-foreground">
                  No scheduled timing is available for this subject in the next 7 days.
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/10 bg-background/40 p-5">
          <p className="text-sm text-muted-foreground">{emptyDescription}</p>
        </div>
      )}
      </div>
    </div>
  );
}

const meetingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date.'),
  meetingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a valid time.'),
  meetingEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a valid end time.'),
  subjectId: z.string().optional(),
  meetingTitle: z.string().min(2, 'Enter meeting title.'),
  zoomMeetingId: z.string().trim().optional(),
  zoomMeetingPassword: z.string().trim().optional(),
  zoomLink: z.string().trim().optional().refine((value) => !value || isValidHttpUrl(value), {
    message: 'Enter a valid Zoom link.',
  }),
}).superRefine((values, ctx) => {
  const startMinutes = parseTimeToMinutes(values.meetingTime);
  const endMinutes = parseTimeToMinutes(values.meetingEndTime);
  if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Session end time must be later than scheduled time.',
      path: ['meetingEndTime'],
    });
  }
});

const previousSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date.'),
  previousSessionUrl: z.string().url('Enter a valid URL.'),
  subjectId: z.string().optional(),
  sessionLabel: z.string().trim().min(2, 'Enter previous session title.'),
});

const MAX_FREE_DCAM_BANK_QUESTIONS_PER_TEST = 10;

const subjectConfigSchema = z.object({
  subjectId: z.string().min(1, 'Select a subject.'),
  subjectName: z.string(),
  topicId: z.string().optional().default(''),
  topicName: z.string().optional().default(''),
  subtopic: z.string().optional().default(''),
  subtopicPaths: z.array(z.string()).optional().default([]),
  questionAccessLevel: z.enum(['free', 'paid']).default('free'),
  questionType: z.enum(['All', 'MCQ', 'Numerical', 'Text']),
  difficultyLevel: z.enum(['All', 'Easy', 'Medium', 'Hard']),
  count: z.coerce.number().min(1, 'Must be > 0'),
});

const normalizeSubtopicPathSegments = (segments: string[]) =>
  segments.map((segment) => String(segment || '').trim()).filter(Boolean);

const serializeSubtopicPathSelection = (segments: string[]) =>
  normalizeSubtopicPathSegments(segments).join(' > ');

const parseSubtopicPathSelection = (value?: string) =>
  normalizeSubtopicPathSegments(splitSubtopicPath(String(value || '')));

const getSubtopicPathKey = (segments: string[]) =>
  normalizeSubtopicPathSegments(segments).map((segment) => normalizeSubtopicValue(segment)).join('>');

const normalizeSubtopicPathSelections = (
  subtopicPaths?: string[],
  legacySubtopic?: string,
) => {
  const unique = new Map<string, string>();

  (subtopicPaths || []).forEach((value) => {
    const segments = parseSubtopicPathSelection(value);
    if (!segments.length) return;
    const key = getSubtopicPathKey(segments);
    if (!key || unique.has(key)) return;
    unique.set(key, serializeSubtopicPathSelection(segments));
  });

  const legacySegments = normalizeSubtopicPathSegments([legacySubtopic || '']);
  if (legacySegments.length) {
    const key = getSubtopicPathKey(legacySegments);
    if (key && !unique.has(key)) unique.set(key, serializeSubtopicPathSelection(legacySegments));
  }

  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
};

const subtopicPathStartsWith = (path: string[], prefix: string[]) => {
  const normalizedPath = normalizeSubtopicPathSegments(path);
  const normalizedPrefix = normalizeSubtopicPathSegments(prefix);
  if (!normalizedPrefix.length) return true;
  if (normalizedPath.length < normalizedPrefix.length) return false;
  return normalizedPrefix.every((segment, index) => normalizeSubtopicValue(normalizedPath[index]) === normalizeSubtopicValue(segment));
};

const hasMatchingSubtopicPrefix = (pathPool: string[][], prefix: string[]) =>
  pathPool.some((path) => subtopicPathStartsWith(path, prefix));

const getChildSubtopicOptions = (pathPool: string[][], parentPath: string[]) => {
  const parentSegments = normalizeSubtopicPathSegments(parentPath);
  const options = new Map<string, string>();
  pathPool.forEach((path) => {
    const normalizedPath = normalizeSubtopicPathSegments(path);
    if (normalizedPath.length <= parentSegments.length) return;
    if (!subtopicPathStartsWith(normalizedPath, parentSegments)) return;
    const nextSegment = normalizedPath[parentSegments.length];
    const key = normalizeSubtopicValue(nextSegment);
    if (!key || options.has(key)) return;
    options.set(key, nextSegment);
  });
  return Array.from(options.values()).sort((a, b) => a.localeCompare(b));
};

const getSubtopicSelectionKey = (
  subtopicPaths?: string[],
  legacySubtopic?: string,
) =>
  normalizeSubtopicPathSelections(subtopicPaths, legacySubtopic)
    .map((value) => getSubtopicPathKey(parseSubtopicPathSelection(value)))
    .filter(Boolean)
    .sort()
    .join('|');

const getTeacherPurchaseQuotaForBucket = (
  purchase: TeacherQuestionPurchaseDoc,
  category: PurchasedQuestionCategory,
  difficulty: DifficultyLevel
) => {
  const counts = category === 'pyq' ? purchase.pyqCounts : purchase.regularCounts;
  return difficulty === 'Easy'
    ? ['Easy', 'Medium', 'Hard'].reduce((sum, level) => sum + Math.max(0, Number(counts?.[level as DifficultyLevel] || 0)), 0)
    : 0;
};

const buildEmptyPurchaseAvailabilityDialogState = (): PurchaseAvailabilityDialogState => ({
  open: false,
  title: '',
  description: '',
});

const createEmptySubjectConfig = (questionAccessLevel: 'free' | 'paid' = 'free') => ({
  subjectId: '',
  subjectName: '',
  topicId: '',
  topicName: '',
  subtopic: '',
  subtopicPaths: [] as string[],
  questionAccessLevel,
  questionType: 'All' as const,
  difficultyLevel: 'Easy' as const,
  count: 10,
});

const formSchema = z.object({
  availabilityMode: z.enum(['single_day', 'unlimited']),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date.'),
  scheduledTime: createOptionalTimeField('Pick a valid test start time.'),
  scheduledEndTime: createOptionalTimeField('Pick a valid test end time.'),
  title: z.string().min(5, 'Test title must be at least 5 characters long.'),
  marksPerQuestion: z.coerce.number().min(0, 'Marks cannot be negative.'),
  negativeMarksPerQuestion: z.coerce.number().min(0, 'Negative marks cannot be negative.'),
  examTypeId: z.string().min(1, 'Select an exam.'),
  classId: z.string().min(1, 'Select a curriculum/class.'),
  examLevel: z.enum(['All', 'weak', 'medium', 'strong']),
  attemptLimitMode: z.enum(['unlimited', 'total', 'interval']),
  maxTotalAttempts: z.coerce.number().int().min(1),
  maxAttemptsPerInterval: z.coerce.number().int().min(1),
  attemptIntervalValue: z.coerce.number().int().min(1),
  attemptIntervalUnit: z.enum(['day', 'week', 'month', 'year']),
  subjectConfigs: z.array(subjectConfigSchema).min(1, 'Please configure at least one subject.'),
}).superRefine((values, ctx) => {
  const seen = new Set<string>();
  values.subjectConfigs.forEach((item, index) => {
    const key = `${item.subjectId}__${item.topicId || ''}__${getSubtopicSelectionKey(item.subtopicPaths, item.subtopic)}__${item.questionAccessLevel}__${item.questionType}__${item.difficultyLevel}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate subject + topic + subtopic branch + question access + question type + difficulty selected.',
        path: ['subjectConfigs', index, 'difficultyLevel'],
      });
    }
    seen.add(key);
  });
  const totalFreeQuestionCount = values.subjectConfigs.reduce(
    (sum, item) => sum + (item.questionAccessLevel === 'free' ? Math.max(0, Number(item.count || 0)) : 0),
    0
  );
  if (totalFreeQuestionCount > MAX_FREE_DCAM_BANK_QUESTIONS_PER_TEST) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Free DCAM-bank sections can include up to ${MAX_FREE_DCAM_BANK_QUESTIONS_PER_TEST} questions in total for one test.`,
      path: ['subjectConfigs'],
    });
  }
  if (values.availabilityMode === 'single_day') {
    if (!values.scheduledTime.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pick a valid test start time.',
        path: ['scheduledTime'],
      });
    }
    if (!values.scheduledEndTime.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pick a valid test end time.',
        path: ['scheduledEndTime'],
      });
    }
    const scheduledStartMinutes = parseTimeToMinutes(values.scheduledTime);
    const scheduledEndMinutes = parseTimeToMinutes(values.scheduledEndTime);
    if (scheduledEndMinutes !== null && scheduledStartMinutes !== null && scheduledEndMinutes <= scheduledStartMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Test end time must be later than test start.',
        path: ['scheduledEndTime'],
      });
    }
  }
  if (values.attemptLimitMode === 'total' && values.maxTotalAttempts < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Total attempts must be at least 1.',
      path: ['maxTotalAttempts'],
    });
  }
  if (values.attemptLimitMode === 'interval') {
    if (values.maxAttemptsPerInterval < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Attempts per interval must be at least 1.',
        path: ['maxAttemptsPerInterval'],
      });
    }
    if (values.attemptIntervalValue < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Interval value must be at least 1.',
        path: ['attemptIntervalValue'],
      });
    }
  }
});

export default function CreateCustomTestPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();
  const params = useParams<{ batchId: string }>();
  const batchId = String(params?.batchId || '');
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeModule, setActiveModule] = useState<'meeting' | 'previous' | 'test'>('meeting');
  const [isSavingMeeting, setIsSavingMeeting] = useState(false);
  const [isSavingPrevious, setIsSavingPrevious] = useState(false);
  const [previousSessionNoteFile, setPreviousSessionNoteFile] = useState<File | null>(null);
  const [applyMeetingToAllSubjects, setApplyMeetingToAllSubjects] = useState(false);
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);
  const [isSavingCancel, setIsSavingCancel] = useState(false);
  const [holidayTargetPeriod, setHolidayTargetPeriod] = useState<NoticeTargetPeriod>('upcoming');
  const [holidaySessionId, setHolidaySessionId] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayEndDate, setHolidayEndDate] = useState('');
  const [holidayReason, setHolidayReason] = useState('');
  const [cancelTargetPeriod, setCancelTargetPeriod] = useState<NoticeTargetPeriod>('upcoming');
  const [cancelSessionId, setCancelSessionId] = useState('');
  const [cancelDate, setCancelDate] = useState('');
  const [cancelLabel, setCancelLabel] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [activeNoticePanel, setActiveNoticePanel] = useState<'holiday' | 'cancel' | null>(null);
  const [unlockLeadMinutesDraft, setUnlockLeadMinutesDraft] = useState(String(DEFAULT_CONTENT_UNLOCK_LEAD_MINUTES));
  const [isSavingUnlockLeadTime, setIsSavingUnlockLeadTime] = useState(false);
  const [subtopicDraftPathBySection, setSubtopicDraftPathBySection] = useState<Record<string, string[]>>({});
  const [meetingDrafts, setMeetingDrafts] = useState<Record<string, { date: string; meetingTime: string; meetingEndTime: string }>>({});
  const [testDrafts, setTestDrafts] = useState<Record<string, ScheduledTestDraft>>({});
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const [savingMeetingId, setSavingMeetingId] = useState<string | null>(null);
  const [savingTestId, setSavingTestId] = useState<string | null>(null);
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);
  const [testToDelete, setTestToDelete] = useState<ScheduledLiveBatchTest | null>(null);
  const [purchaseAvailabilityDialog, setPurchaseAvailabilityDialog] = useState<PurchaseAvailabilityDialogState>(
    buildEmptyPurchaseAvailabilityDialogState()
  );
  const previousSessionNoteInputRef = useRef<HTMLInputElement | null>(null);
  const previousMeetingSubjectIdRef = useRef('');
  const lastAppliedMeetingDefaultZoomLinkRef = useRef('');
  const previousSuggestedMeetingTitleRef = useRef('');
  const previousSessionSelectionRef = useRef('');
  const previousSessionAutoTitleRef = useRef('');
  const { isTeacher } = useIsTeacher();

  const classesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null, [firestore]);
  const subjectsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null, [firestore]);
  const topicsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'topics'), orderBy('name')) : null, [firestore]);
  const questionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'practice_questions')) : null, [firestore]);
  const examTypesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null, [firestore]);
  const dcamQuestionBankOwnerQuery = useMemoFirebase(
    () => (
      firestore
        ? query(collection(firestore, 'users'), where('email', '==', ALLOWED_TEACHER_AUTHOR_EMAIL), limit(1))
        : null
    ),
    [firestore]
  );
  const sessionsQuery = useMemoFirebase(
    () => (firestore && batchId ? query(collection(firestore, 'live_batch_sessions'), where('batchId', '==', batchId)) : null),
    [firestore, batchId]
  );
  const scheduledTestsQuery = useMemoFirebase(
    () => (firestore && batchId ? query(collection(firestore, 'mock_tests'), where('liveBatchId', '==', batchId)) : null),
    [firestore, batchId]
  );
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const liveBatchRef = useMemoFirebase(() => (firestore && batchId ? doc(firestore, 'live_batches', batchId) : null), [firestore, batchId]);
  const teacherQuestionPurchasesQuery = useMemoFirebase(
    () => (
      firestore && user?.uid
        ? query(collection(firestore, 'users', user.uid, 'teacher_question_purchases'), orderBy('purchasedAt', 'desc'))
        : null
    ),
    [firestore, user?.uid]
  );
  const batchEnrollmentsQuery = useMemoFirebase(
    () => (firestore && batchId ? query(collectionGroup(firestore, 'enrolled_live_batches'), where('batchId', '==', batchId)) : null),
    [firestore, batchId]
  );

  const { data: classes, isLoading: areClassesLoading } = useCollection<Class>(classesQuery);
  const { data: subjects, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: topics, isLoading: areTopicsLoading } = useCollection<Topic>(topicsQuery);
  const { data: allQuestions, isLoading: areQuestionsLoading } = useCollection<Question>(questionsQuery);
  const { data: examTypes, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: dcamQuestionBankOwnerRows, isLoading: isDcamQuestionBankOwnerLoading } = useCollection<DcamQuestionBankOwnerProfile>(dcamQuestionBankOwnerQuery);
  const { data: sessionsData, isLoading: areSessionsLoading } = useCollection<LiveBatchSession>(sessionsQuery);
  const { data: scheduledTestsData, isLoading: areScheduledTestsLoading } = useCollection<ScheduledLiveBatchTest>(scheduledTestsQuery);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);
  const { data: liveBatch, isLoading: isLiveBatchLoading } = useDoc<LiveBatch>(liveBatchRef);
  const { data: teacherQuestionPurchasesData, isLoading: areTeacherQuestionPurchasesLoading } = useCollection<TeacherQuestionPurchaseDoc>(teacherQuestionPurchasesQuery);
  const { data: batchEnrollmentsData, isLoading: areBatchEnrollmentsLoading } = useCollection<EnrolledBatchStudentRecord>(batchEnrollmentsQuery);
  const sessions = useMemo(() => sessionsData || [], [sessionsData]);
  const scheduledTests = useMemo(() => scheduledTestsData || [], [scheduledTestsData]);
  const dcamQuestionBankOwnerId = String(dcamQuestionBankOwnerRows?.[0]?.id || '').trim();
  const batchStartDateMin = liveBatch?.batchStartDate || undefined;
  const todayYmd = useMemo(() => toLocalYmd(new Date()), []);
  const defaultSectionQuestionAccessLevel: 'free' | 'paid' = 'free';

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowTimestamp(Date.now()), 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const teachingAssignments = userProfile?.teachingAssignments || [];
  const allowedClassIds = Array.from(new Set(teachingAssignments.map((assignment) => assignment.classId).filter(Boolean)));
  const allowedSubjectIds = Array.from(new Set(teachingAssignments.flatMap((assignment) => assignment.subjectIds || []).filter(Boolean)));
  const examTypeNameById = useMemo(() => Object.fromEntries((examTypes || []).map((item) => [item.id, item.name])), [examTypes]);
  const classById = useMemo(() => Object.fromEntries((classes || []).map((item) => [item.id, item])), [classes]);
  const classNameById = useMemo(() => Object.fromEntries((classes || []).map((item) => [item.id, item.name])), [classes]);
  const subjectById = useMemo(() => Object.fromEntries((subjects || []).map((item) => [item.id, item])), [subjects]);
  const subjectNameById = useMemo(() => Object.fromEntries((subjects || []).map((item) => [item.id, item.name])), [subjects]);
  const topicNameById = useMemo(() => Object.fromEntries((topics || []).map((item) => [item.id, item.name])), [topics]);

  const teacherQuestionClassIds = useMemo(() => {
    if (!isTeacher || !user?.uid) return [];
    const ids = new Set<string>();
    (allQuestions || []).forEach((q) => {
      if (q.teacherId !== user.uid) return;
      if (q.classId) ids.add(q.classId);
      (q.alignments || []).forEach((a) => {
        if (a.classId) ids.add(a.classId);
      });
    });
    return Array.from(ids);
  }, [allQuestions, isTeacher, user]);

  const teacherQuestionSubjectIdsByClass = useMemo(() => {
    if (!isTeacher || !user?.uid) return {} as Record<string, string[]>;
    const map: Record<string, Set<string>> = {};
    (allQuestions || []).forEach((q) => {
      if (q.teacherId !== user.uid) return;
      const directClass = q.classId;
      const directSubject = q.subjectId;
      if (directClass && directSubject) {
        if (!map[directClass]) map[directClass] = new Set<string>();
        map[directClass].add(directSubject);
      }
      (q.alignments || []).forEach((a) => {
        if (!a.classId || !a.subjectId) return;
        if (!map[a.classId]) map[a.classId] = new Set<string>();
        map[a.classId].add(a.subjectId);
      });
    });
    return Object.fromEntries(Object.entries(map).map(([classId, ids]) => [classId, Array.from(ids)]));
  }, [allQuestions, isTeacher, user]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      availabilityMode: 'single_day',
      scheduledDate: '',
      scheduledTime: '',
      scheduledEndTime: '',
      title: '',
      marksPerQuestion: 4,
      negativeMarksPerQuestion: 1,
      examTypeId: '',
      classId: '',
      examLevel: 'All',
      attemptLimitMode: 'unlimited',
      maxTotalAttempts: 1,
      maxAttemptsPerInterval: 1,
      attemptIntervalValue: 1,
      attemptIntervalUnit: 'week',
      subjectConfigs: [createEmptySubjectConfig(defaultSectionQuestionAccessLevel)],
    },
  });
  const meetingForm = useForm<z.infer<typeof meetingSchema>>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      date: '',
      meetingTime: '',
      meetingEndTime: '',
      subjectId: '',
      meetingTitle: 'Live Session',
      zoomMeetingId: '',
      zoomMeetingPassword: '',
      zoomLink: '',
    },
  });
  const previousSessionForm = useForm<z.infer<typeof previousSessionSchema>>({
    resolver: zodResolver(previousSessionSchema),
    defaultValues: {
      date: '',
      previousSessionUrl: '',
      subjectId: '',
      sessionLabel: '',
    },
  });

  const { control, watch, setValue, getValues } = form;
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'subjectConfigs',
  });
  const prevExamTypeRef = useRef<string>('');
  const prevClassRef = useRef<string>('');

  const selectedExamType = watch('examTypeId');
  const selectedClass = watch('classId');
  const watchedSubjectConfigs = watch('subjectConfigs');
  const sectionModeEnabled = true;
  const examLevelFilter = watch('examLevel');
  const testAvailabilityMode = watch('availabilityMode');
  const attemptLimitMode = watch('attemptLimitMode');
  const marksPerQuestion = Number(watch('marksPerQuestion') || 0);
  const totalRequestedQuestions = watchedSubjectConfigs.reduce((acc, curr) => acc + (Number(curr.count) || 0), 0);
  const totalMarks = totalRequestedQuestions * marksPerQuestion;
  const selectedMeetingDate = meetingForm.watch('date');
  const selectedMeetingTime = meetingForm.watch('meetingTime');
  const selectedMeetingSubjectId = meetingForm.watch('subjectId');
  const selectedPreviousSessionDate = previousSessionForm.watch('date');
  const selectedPreviousSessionSubjectId = previousSessionForm.watch('subjectId');
  const selectedTestDate = watch('scheduledDate');
  const selectedTestTime = watch('scheduledTime');
  const selectedTestEndTime = watch('scheduledEndTime');
  const contentUnlockLeadMinutes = normalizeContentUnlockLeadMinutes(liveBatch?.contentUnlockLeadMinutes);
  const selectedTestDurationMinutes = useMemo(
    () => (testAvailabilityMode === 'single_day' ? getScheduledTestDurationMinutes(selectedTestTime, selectedTestEndTime) : null),
    [selectedTestEndTime, selectedTestTime, testAvailabilityMode]
  );
  const scheduledTeacherQuestionCoveragePreviewAt = useMemo(
    () => getLiveBatchTestTeacherQuestionCoverageStartAt({
      availabilityMode: testAvailabilityMode,
      scheduledDate: selectedTestDate || undefined,
      scheduledTime: selectedTestTime || undefined,
      scheduledEndTime: selectedTestEndTime || undefined,
    }, contentUnlockLeadMinutes),
    [contentUnlockLeadMinutes, selectedTestDate, selectedTestEndTime, selectedTestTime, testAvailabilityMode]
  );
  const liveBatchTokenStudentCount = useMemo(
    () => Math.max(0, (batchEnrollmentsData || []).filter((record: any) => record?.adminAccessDisabled !== true).length),
    [batchEnrollmentsData]
  );
  const getEquivalentExamTypeIdSet = (examTypeId?: string) => {
    const normalizedExamTypeId = String(examTypeId || '').trim();
    if (!normalizedExamTypeId) return new Set<string>();
    const normalizedExamTypeName = normalizeScopeOptionLabel(examTypeNameById[normalizedExamTypeId] || normalizedExamTypeId);
    const ids = (examTypes || [])
      .filter((item) => normalizeScopeOptionLabel(item.name || item.id) === normalizedExamTypeName)
      .map((item) => item.id);
    return new Set<string>([normalizedExamTypeId, ...ids]);
  };
  const getEquivalentClassIdSet = (classId?: string, examTypeId?: string) => {
    const normalizedClassId = String(classId || '').trim();
    if (!normalizedClassId) return new Set<string>();
    const resolvedClass = classById[normalizedClassId];
    const normalizedClassName = normalizeScopeOptionLabel(resolvedClass?.name || normalizedClassId);
    const equivalentExamTypeIds = getEquivalentExamTypeIdSet(examTypeId || resolvedClass?.examTypeId);
    const ids = (classes || [])
      .filter((item) =>
        normalizeScopeOptionLabel(item.name || item.id) === normalizedClassName
        && (equivalentExamTypeIds.size === 0 || equivalentExamTypeIds.has(item.examTypeId))
      )
      .map((item) => item.id);
    return new Set<string>([normalizedClassId, ...ids]);
  };
  const getEquivalentSubjectIdSet = (subjectId?: string, classId?: string, examTypeId?: string) => {
    const normalizedSubjectId = String(subjectId || '').trim();
    if (!normalizedSubjectId) return new Set<string>();
    const resolvedSubject = subjectById[normalizedSubjectId];
    const normalizedSubjectName = normalizeScopeOptionLabel(resolvedSubject?.name || normalizedSubjectId);
    const equivalentClassIds = getEquivalentClassIdSet(classId || resolvedSubject?.classId, examTypeId);
    const ids = (subjects || [])
      .filter((item) =>
        normalizeScopeOptionLabel(item.name || item.id) === normalizedSubjectName
        && (equivalentClassIds.size === 0 || equivalentClassIds.has(item.classId))
      )
      .map((item) => item.id);
    return new Set<string>([normalizedSubjectId, ...ids]);
  };
  const selectedEquivalentExamTypeIds = useMemo(
    () => getEquivalentExamTypeIdSet(selectedExamType),
    [examTypes, examTypeNameById, selectedExamType]
  );
  const selectedEquivalentClassIds = useMemo(
    () => getEquivalentClassIdSet(selectedClass, selectedExamType),
    [classById, classes, examTypes, examTypeNameById, selectedClass, selectedExamType]
  );
  const batchScopedEquivalentSubjectIds = useMemo(() => {
    const ids = new Set<string>();
    (liveBatch?.subjectIds || []).forEach((subjectId) => {
      getEquivalentSubjectIdSet(
        subjectId,
        selectedClass || liveBatch?.classId,
        selectedExamType || liveBatch?.examTypeId
      ).forEach((candidateId) => ids.add(candidateId));
    });
    return ids;
  }, [
    classes,
    classById,
    examTypes,
    examTypeNameById,
    liveBatch?.classId,
    liveBatch?.examTypeId,
    liveBatch?.subjectIds,
    selectedClass,
    selectedExamType,
    subjectById,
    subjects,
  ]);
  const resolvedMeetingSubjectId = useMemo(() => {
    if (applyMeetingToAllSubjects) return '';
    if (selectedMeetingSubjectId) return selectedMeetingSubjectId;
    const batchSubjectIds = liveBatch?.subjectIds || [];
    return batchSubjectIds.length === 1 ? (batchSubjectIds[0] || '') : '';
  }, [applyMeetingToAllSubjects, liveBatch?.subjectIds, selectedMeetingSubjectId]);

  const getDayNameFromDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const dt = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return '';
    return DAY_NAMES[dt.getDay()];
  };

  const getPresetTimingForDate = (dateStr?: string, subjectId?: string) => {
    const dayName = getDayNameFromDate(dateStr);
    if (!dayName || !liveBatch?.subjectSchedules || liveBatch.subjectSchedules.length === 0) {
      return { startTime: '', endTime: '' };
    }

    const candidates: Array<{ startTime: string; endTime: string }> = [];
    liveBatch.subjectSchedules.forEach((schedule) => {
      if (subjectId && schedule.subjectId !== subjectId) return;
      if (!(schedule.daysOfWeek || []).includes(dayName)) return;
      if (schedule.useDifferentTimingPerDay) {
        const dayTiming = schedule.dayTimings?.[dayName];
        if (dayTiming?.startTime) candidates.push({ startTime: dayTiming.startTime, endTime: dayTiming.endTime || '' });
        return;
      }
      if (schedule.startTime) candidates.push({ startTime: schedule.startTime, endTime: schedule.endTime || '' });
    });

    if (candidates.length === 0) return { startTime: '', endTime: '' };
    return [...candidates].sort((a, b) => `${a.startTime}_${a.endTime}`.localeCompare(`${b.startTime}_${b.endTime}`))[0];
  };

  const getSubjectDefaultZoomLink = (subjectId?: string) => {
    const normalizedSubjectId = String(subjectId || '').trim();
    if (!normalizedSubjectId || !liveBatch?.subjectSchedules?.length) return '';
    const matchedSchedule = liveBatch.subjectSchedules.find((schedule) => schedule.subjectId === normalizedSubjectId);
    const candidate = matchedSchedule?.defaultZoomLink?.trim() || '';
    return candidate && isValidHttpUrl(candidate) ? candidate : '';
  };

  useEffect(() => {
    if (!liveBatch) return;
    if (liveBatch.examTypeId) {
      setValue('examTypeId', liveBatch.examTypeId);
      prevExamTypeRef.current = liveBatch.examTypeId;
    }
    if (liveBatch.classId) {
      setValue('classId', liveBatch.classId);
      prevClassRef.current = liveBatch.classId;
    }
    setUnlockLeadMinutesDraft(String(normalizeContentUnlockLeadMinutes(liveBatch.contentUnlockLeadMinutes)));
  }, [liveBatch?.examTypeId, liveBatch?.classId, liveBatch?.contentUnlockLeadMinutes, setValue]);

  useEffect(() => {
    const batchSubjectIds = liveBatch?.subjectIds || [];
    if (batchSubjectIds.length !== 1) return;
    const onlySubjectId = batchSubjectIds[0] || '';
    if (!onlySubjectId) return;
    if (meetingForm.getValues('subjectId') === onlySubjectId) return;
    meetingForm.setValue('subjectId', onlySubjectId, { shouldValidate: true });
  }, [liveBatch?.subjectIds, meetingForm]);

  useEffect(() => {
    const preset = getPresetTimingForDate(selectedMeetingDate, selectedMeetingSubjectId || undefined);
    if (!preset.startTime) return;
    meetingForm.setValue('meetingTime', preset.startTime, { shouldValidate: true });
    if (preset.endTime) {
      meetingForm.setValue('meetingEndTime', preset.endTime, { shouldValidate: true });
    }
  }, [selectedMeetingDate, selectedMeetingSubjectId, liveBatch, meetingForm]);

  useEffect(() => {
    if (applyMeetingToAllSubjects || !resolvedMeetingSubjectId) {
      previousMeetingSubjectIdRef.current = '';
      lastAppliedMeetingDefaultZoomLinkRef.current = '';
      return;
    }

    const defaultZoomLink = getSubjectDefaultZoomLink(resolvedMeetingSubjectId);
    const currentMeetingZoomLink = (meetingForm.getValues('zoomLink') || '').trim();
    const subjectChanged = previousMeetingSubjectIdRef.current !== resolvedMeetingSubjectId;

    if (subjectChanged || !currentMeetingZoomLink || currentMeetingZoomLink === lastAppliedMeetingDefaultZoomLinkRef.current) {
      meetingForm.setValue('zoomLink', defaultZoomLink, { shouldValidate: true });
    }

    previousMeetingSubjectIdRef.current = resolvedMeetingSubjectId;
    lastAppliedMeetingDefaultZoomLinkRef.current = defaultZoomLink;
  }, [applyMeetingToAllSubjects, liveBatch?.subjectSchedules, meetingForm, resolvedMeetingSubjectId]);

  useEffect(() => {
    const suggestedTitle = getSuggestedMeetingTitle(applyMeetingToAllSubjects ? '' : resolvedMeetingSubjectId);
    const currentTitle = (meetingForm.getValues('meetingTitle') || '').trim();
    const shouldReplaceTitle =
      !currentTitle
      || currentTitle === previousSuggestedMeetingTitleRef.current
      || ['daily live session', 'live session'].includes(currentTitle.toLowerCase());

    if (shouldReplaceTitle && currentTitle !== suggestedTitle) {
      meetingForm.setValue('meetingTitle', suggestedTitle, { shouldValidate: true });
    }

    previousSuggestedMeetingTitleRef.current = suggestedTitle;
  }, [applyMeetingToAllSubjects, meetingForm, resolvedMeetingSubjectId, subjects]);

  useEffect(() => {
    if (!applyMeetingToAllSubjects) return;
    const currentZoomLink = (meetingForm.getValues('zoomLink') || '').trim();
    if (!currentZoomLink) return;
    const selectedSubjectDefaultZoomLink = getSubjectDefaultZoomLink(selectedMeetingSubjectId || '');
    if (!selectedSubjectDefaultZoomLink || currentZoomLink !== selectedSubjectDefaultZoomLink) return;
    meetingForm.setValue('zoomLink', '', { shouldValidate: true });
  }, [applyMeetingToAllSubjects, liveBatch?.subjectSchedules, meetingForm, selectedMeetingSubjectId]);

  useEffect(() => {
    if (testAvailabilityMode !== 'single_day') return;
    const preset = getPresetTimingForDate(selectedTestDate);
    if (!preset.startTime) return;
    setValue('scheduledTime', preset.startTime, { shouldValidate: true });
    if (preset.endTime) {
      setValue('scheduledEndTime', preset.endTime, { shouldValidate: true });
    }
  }, [selectedTestDate, setValue, testAvailabilityMode]);

  useEffect(() => {
    const firstSubjectId = liveBatch?.subjectIds?.[0] || '';
    if (firstSubjectId && !meetingForm.getValues('subjectId')) {
      meetingForm.setValue('subjectId', firstSubjectId);
    }
  }, [liveBatch, meetingForm]);

  useEffect(() => {
    const firstSubjectId = liveBatch?.subjectIds?.[0] || '';
    if (firstSubjectId && !previousSessionForm.getValues('subjectId')) {
      previousSessionForm.setValue('subjectId', firstSubjectId);
    }
  }, [liveBatch, previousSessionForm]);

  useEffect(() => {
    const emptyConfig = createEmptySubjectConfig(defaultSectionQuestionAccessLevel);
    const currentConfigs = getValues('subjectConfigs') || [];
    const lockedClassId = liveBatch?.classId || '';

    if (selectedExamType !== prevExamTypeRef.current) {
      prevExamTypeRef.current = selectedExamType;
      if (lockedClassId) {
        if (getValues('classId') !== lockedClassId) {
          setValue('classId', lockedClassId);
        }
      } else if (getValues('classId')) {
        setValue('classId', '');
      }
      if (currentConfigs.length > 0) {
        replace([emptyConfig]);
        return;
      }
    }

    if (selectedClass !== prevClassRef.current) {
      prevClassRef.current = selectedClass;
      if (lockedClassId && selectedClass !== lockedClassId) {
        setValue('classId', lockedClassId);
        return;
      }
      if (currentConfigs.length > 0) {
        replace([emptyConfig]);
        return;
      }
    }

    if (currentConfigs.length === 0) {
      append(emptyConfig);
    }
  }, [selectedExamType, selectedClass, sectionModeEnabled, append, replace, setValue, getValues, liveBatch?.classId, defaultSectionQuestionAccessLevel]);

  const filteredClasses = useMemo(() => {
    if (!classes || !selectedExamType) return [];
    const examScoped = classes.filter((c) => c.examTypeId === selectedExamType);
    if (liveBatch?.classId) return examScoped.filter((c) => c.id === liveBatch.classId);
    if (!isTeacher) return examScoped;

    // Priority 1: explicit teacher assignment (intended source of truth).
    if (allowedClassIds.length > 0) {
      const assigned = examScoped.filter((c) => allowedClassIds.includes(c.id));
      if (assigned.length > 0) return assigned;
    }

    // Priority 2: teacher's own question bank coverage.
    const byOwnQuestionBank = examScoped.filter((c) => teacherQuestionClassIds.includes(c.id));
    if (byOwnQuestionBank.length > 0) return byOwnQuestionBank;

    // Priority 3: do not dead-end UI; allow exam-scoped classes.
    return examScoped;
  }, [classes, selectedExamType, isTeacher, allowedClassIds, teacherQuestionClassIds, liveBatch?.classId]);

  const filteredSubjects = useMemo(() => {
    if (!subjects || !selectedClass) return [];
    const classScoped = subjects.filter((s) => s.classId === selectedClass);
    const batchScoped = batchScopedEquivalentSubjectIds.size > 0
      ? classScoped.filter((s) => batchScopedEquivalentSubjectIds.has(s.id))
      : classScoped;
    if (!isTeacher) return classScoped;

    // Priority 1: explicit teacher assignment for subjects.
    if (allowedSubjectIds.length > 0) {
      const assignedSubjects = batchScoped.filter((s) => allowedSubjectIds.includes(s.id));
      if (assignedSubjects.length > 0) return assignedSubjects;
    }

    // Priority 2: teacher's own question bank subject coverage in this class.
    const byOwnQuestionBank = batchScoped.filter((s) =>
      (teacherQuestionSubjectIdsByClass[selectedClass] || []).includes(s.id)
    );
    if (byOwnQuestionBank.length > 0) return byOwnQuestionBank;

    // Priority 3: do not dead-end UI.
    return batchScoped;
  }, [subjects, selectedClass, isTeacher, allowedSubjectIds, teacherQuestionSubjectIdsByClass, batchScopedEquivalentSubjectIds]);
  const getSuggestedMeetingTitle = (subjectId?: string) => {
    const subjectLabel = (subjectId ? (subjectNameById[subjectId] || subjectId) : '').trim();
    return subjectLabel ? `${subjectLabel} Live Session` : 'Live Session';
  };
  const scheduleNoticesByDate = useMemo(() => {
    const byDate: Record<string, { type: 'holiday' | 'cancelled'; text: string }> = {};
    (sessions || []).forEach((session) => {
      if (!session?.date) return;
      if (session.type === 'holiday') {
        const startDate = session.date;
        const endDate = session.holidayEndDate || session.date;
        const holidayRangeLabel = formatYmdRange(startDate, endDate);
        const holidayText = `Holiday${holidayRangeLabel !== session.date ? ` (${holidayRangeLabel})` : ''}${session.reason ? ` - ${session.reason}` : ''}`;
        expandYmdDateRange(startDate, endDate).forEach((date) => {
          byDate[date] = { type: 'holiday', text: holidayText };
        });
        return;
      }
      if (session.type === 'cancelled' && !byDate[session.date]) {
        byDate[session.date] = {
          type: 'cancelled',
          text: `Cancelled${session.sessionLabel ? ` - ${session.sessionLabel}` : ''}${session.reason ? ` (${session.reason})` : ''}`,
        };
      }
    });
    return byDate;
  }, [sessions]);
  const upcomingSessionSlots = useMemo(() => {
    if (!liveBatch?.subjectSchedules || liveBatch.subjectSchedules.length === 0) return [] as UpcomingSessionSlot[];
    const windowStart = (() => {
      const today = parseYmdToLocalDate(todayYmd) || new Date();
      const batchStart = parseYmdToLocalDate(liveBatch.batchStartDate);
      if (!batchStart) return today;
      return batchStart.getTime() > today.getTime() ? batchStart : today;
    })();

    const generated: UpcomingSessionSlot[] = [];
    for (let offset = 0; offset < UPCOMING_SCHEDULE_WINDOW_DAYS; offset += 1) {
      const date = new Date(windowStart);
      date.setDate(windowStart.getDate() + offset);
      const dayName = DAY_NAMES[date.getDay()];
      const dateYmd = toLocalYmd(date);

      (liveBatch.subjectSchedules || []).forEach((schedule) => {
        if (!(schedule.daysOfWeek || []).includes(dayName)) return;
        const perDayTiming = schedule.useDifferentTimingPerDay ? schedule.dayTimings?.[dayName] : undefined;
        const startTime = schedule.useDifferentTimingPerDay ? (perDayTiming?.startTime || '') : (schedule.startTime || '');
        const endTime = schedule.useDifferentTimingPerDay ? (perDayTiming?.endTime || '') : (schedule.endTime || '');
        if (!startTime) return;
        const dateNotice = scheduleNoticesByDate[dateYmd];

        generated.push({
          date: dateYmd,
          dayName,
          subjectId: schedule.subjectId,
          subjectName: subjectNameById[schedule.subjectId] || schedule.subjectId || 'Subject',
          startTime,
          endTime,
          noticeType: dateNotice?.type,
          noticeText: dateNotice?.text,
        });
      });
    }

    return generated
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  }, [liveBatch?.batchStartDate, liveBatch?.subjectSchedules, scheduleNoticesByDate, subjectNameById, todayYmd]);
  const upcomingSessionSlotGroups = useMemo(() => {
    const slotsBySubject = new Map<string, UpcomingSessionSlot[]>();
    upcomingSessionSlots.forEach((slot) => {
      const current = slotsBySubject.get(slot.subjectId) || [];
      current.push(slot);
      slotsBySubject.set(slot.subjectId, current);
    });

    const orderedSubjectIds = Array.from(new Set([
      ...(liveBatch?.subjectIds || []).filter(Boolean),
      ...Array.from(slotsBySubject.keys()).filter(Boolean),
    ]));

    return orderedSubjectIds.map((subjectId) => {
      const slots = slotsBySubject.get(subjectId) || [];
      return {
        subjectId,
        subjectName: subjectNameById[subjectId] || slots[0]?.subjectName || subjectId || 'Subject',
        slots,
      };
    });
  }, [liveBatch?.subjectIds, subjectNameById, upcomingSessionSlots]);

  const matchesExamClass = (q: Question, examTypeId?: string, classId?: string) => {
    const equivalentExamTypeIds = getEquivalentExamTypeIdSet(examTypeId);
    const equivalentClassIds = getEquivalentClassIdSet(classId, examTypeId);
    const directMatch =
      (!examTypeId || equivalentExamTypeIds.has(q.examTypeId))
      && (!classId || equivalentClassIds.has(q.classId));
    if (directMatch) return true;
    return (q.alignments || []).some((a) =>
      (!examTypeId || equivalentExamTypeIds.has(a.examTypeId || ''))
      && (!classId || equivalentClassIds.has(a.classId || ''))
    );
  };

  const matchesSubjectInContext = (q: Question, subjectId: string, examTypeId?: string, classId?: string) => {
    const direct = q.subjectId === subjectId && matchesExamClass(q, examTypeId, classId);
    if (direct) return true;
    return (q.alignments || []).some((a) =>
      a.subjectId === subjectId
      && (!examTypeId || a.examTypeId === examTypeId)
      && (!classId || a.classId === classId)
    );
  };

  const matchesDifficultyInContext = (q: Question, difficulty: 'Easy' | 'Medium' | 'Hard' | 'All', examTypeId?: string, classId?: string) => true;

  const matchesQuestionType = (q: Question, questionType: 'All' | 'MCQ' | 'Numerical' | 'Text') => {
    if (questionType === 'All') return true;
    return (q.questionType || 'MCQ') === questionType;
  };
  const matchesQuestionAccessLevel = (q: Question, questionAccessLevel: 'free' | 'paid') =>
    q.accessLevel === questionAccessLevel;
  const matchesTopic = (q: Question, topicId?: string) => {
    if (!topicId) return true;
    return q.topicId === topicId;
  };
  const matchesSubtopic = (q: Question, subtopicPaths?: string[], legacySubtopic?: string) => {
    const normalizedSelections = normalizeSubtopicPathSelections(subtopicPaths, legacySubtopic);
    if (normalizedSelections.length === 0) return true;
    const questionPaths = extractSubtopicPaths(q.subtopics);
    if (questionPaths.length === 0) return false;
    const parsedSelections = normalizedSelections.map((value) => parseSubtopicPathSelection(value)).filter((segments) => segments.length > 0);
    if (parsedSelections.length === 0) return true;
    return parsedSelections.some((selectionPath) =>
      questionPaths.some((questionPath) => subtopicPathStartsWith(questionPath, selectionPath))
    );
  };

  const availableQuestions = useMemo(() => {
    return (allQuestions || []).filter((q) => {
      if (!dcamQuestionBankOwnerId) return false;
      if (q.teacherId !== dcamQuestionBankOwnerId) return false;
      if (!matchesExamClass(q, selectedExamType || undefined, selectedClass || undefined)) return false;
      if (examLevelFilter !== 'All' && q.examLevel !== examLevelFilter) return false;
      if (batchScopedEquivalentSubjectIds.size > 0) {
        const questionSubjectIds = [q.subjectId, ...(q.alignments || []).map((a) => a.subjectId)];
        if (!questionSubjectIds.some((id) => batchScopedEquivalentSubjectIds.has(String(id || '').trim()))) return false;
      }
      return true;
    });
  }, [allQuestions, selectedExamType, selectedClass, examLevelFilter, dcamQuestionBankOwnerId, batchScopedEquivalentSubjectIds, classes, classById, examTypes, examTypeNameById]);

  const availableQuestionEntries = useMemo(
    () =>
      availableQuestions
        .flatMap((question) => buildPracticeQuestionScopeEntries(question))
        .filter((entry) => {
          if (selectedExamType && entry.examTypeId !== selectedExamType) return false;
          if (selectedClass && entry.classId !== selectedClass) return false;
          return !entry.mockTestOnly;
        }),
    [availableQuestions, selectedClass, selectedExamType]
  );

  const matchesQuestionEntryTopic = (
    entry: AvailableQuestionEntry,
    topicId?: string
  ) => {
    if (!topicId) return true;
    return entry.topicId === topicId;
  };

  const matchesQuestionEntryType = (
    entry: AvailableQuestionEntry,
    questionType: 'All' | 'MCQ' | 'Numerical' | 'Text'
  ) => {
    if (questionType === 'All') return true;
    return entry.questionType === questionType;
  };

  const matchesQuestionEntryDifficulty = (
    entry: AvailableQuestionEntry,
    difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard'
  ) => {
    return true;
  };

  const matchesQuestionEntrySubtopic = (
    entry: AvailableQuestionEntry,
    subtopicPaths?: string[],
    legacySubtopic?: string
  ) => {
    const normalizedSelections = normalizeSubtopicPathSelections(subtopicPaths, legacySubtopic);
    if (normalizedSelections.length === 0) return true;
    if (!Array.isArray(entry.subtopics) || entry.subtopics.length === 0) return false;
    const parsedSelections = normalizedSelections.map((value) => parseSubtopicPathSelection(value)).filter((segments) => segments.length > 0);
    if (parsedSelections.length === 0) return true;
    return parsedSelections.some((selectionPath) =>
      entry.subtopics.some((questionPath) => subtopicPathStartsWith(parseSubtopicPathSelection(questionPath), selectionPath))
    );
  };

  const getFreeQuestionAllowanceForSection = (
    sectionIndex: number,
    configs: Array<z.infer<typeof subjectConfigSchema>> = watchedSubjectConfigs
  ) => {
    const otherFreeQuestionCount = configs.reduce((sum, cfg, idx) => {
      if (idx === sectionIndex) return sum;
      if (cfg.questionAccessLevel !== 'free') return sum;
      return sum + Math.max(0, Number(cfg.count || 0));
    }, 0);
    return Math.max(0, MAX_FREE_DCAM_BANK_QUESTIONS_PER_TEST - otherFreeQuestionCount);
  };

  const getCandidateQuestionRowsForConfig = (
    subjectId?: string,
    topicId?: string,
    subtopicPaths?: string[],
    legacySubtopic?: string,
    questionAccessLevel: 'free' | 'paid' = defaultSectionQuestionAccessLevel,
    questionType: 'All' | 'MCQ' | 'Numerical' | 'Text' = 'All',
    difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard' = 'All'
  ) => {
    if (!subjectId) return [] as CandidateQuestionRow[];
    const equivalentSubjectIds = getEquivalentSubjectIdSet(subjectId, selectedClass, selectedExamType);
    const unique = new Map<string, CandidateQuestionRow>();

    availableQuestionEntries
      .filter((entry) =>
        entry.accessLevel === questionAccessLevel
        && equivalentSubjectIds.has(entry.subjectId)
        && matchesQuestionEntryTopic(entry, topicId)
        && matchesQuestionEntrySubtopic(entry, subtopicPaths, legacySubtopic)
        && matchesQuestionEntryType(entry, questionType)
        && matchesQuestionEntryDifficulty(entry, difficultyLevel)
      )
      .forEach((entry) => {
        if (unique.has(entry.sourceQuestionId)) return;
        unique.set(entry.sourceQuestionId, {
          id: entry.sourceQuestionId,
          question: entry.sourceQuestion,
          topicId: entry.topicId,
          subtopics: entry.subtopics || [],
          difficultyLevel: 'Easy' as const,
          category: entry.isPreviousYear ? 'pyq' : 'regular',
        });
      });

    return Array.from(unique.values());
  };

  const purchaseCoversCandidateQuestion = (
    purchase: TeacherQuestionPurchaseDoc,
    subjectId: string,
    row: CandidateQuestionRow
  ) => {
    const equivalentExamTypeIds = getEquivalentExamTypeIdSet(selectedExamType);
    const equivalentClassIds = getEquivalentClassIdSet(selectedClass, selectedExamType);
    const equivalentSubjectIds = getEquivalentSubjectIdSet(subjectId, selectedClass, selectedExamType);
    if (selectedExamType && !equivalentExamTypeIds.has(purchase.examTypeId)) return false;
    if (selectedClass && !equivalentClassIds.has(purchase.classId)) return false;
    if (!equivalentSubjectIds.has(purchase.subjectId)) return false;
    if (purchase.topicId && purchase.topicId !== row.topicId) return false;
    const purchaseSubtopicPath = parseSubtopicPathSelection(String(purchase.subtopicPath || '').trim());
    if (purchaseSubtopicPath.length === 0) return true;
    if (!Array.isArray(row.subtopics) || row.subtopics.length === 0) return false;
    return row.subtopics.some((subtopicPath) =>
      subtopicPathStartsWith(parseSubtopicPathSelection(subtopicPath), purchaseSubtopicPath)
    );
  };

  const allocatePaidPurchasedQuestionRows = (
    subjectId: string,
    candidateRows: CandidateQuestionRow[],
    purchases: TeacherQuestionPurchaseDoc[],
    options?: { randomize?: boolean }
  ) => {
    const allocatedRows: CandidateQuestionRow[] = [];
    const randomize = !!options?.randomize;

    ([
      ['regular', 'Easy'],
      ['pyq', 'Easy'],
    ] as Array<[PurchasedQuestionCategory, DifficultyLevel]>).forEach(([category, difficulty]) => {
      const bucketRows = candidateRows.filter(
        (row) => row.category === category && row.difficultyLevel === difficulty
      );
      if (bucketRows.length === 0) return;

      const bucketPurchases = purchases
        .map((purchase) => ({
          purchase,
          remaining: getTeacherPurchaseQuotaForBucket(purchase, category, difficulty),
        }))
        .filter((entry) => entry.remaining > 0);
      if (bucketPurchases.length === 0) return;

      const candidateCoverage = bucketRows
        .map((row) => {
          const coveringPurchaseIds = bucketPurchases
            .filter(({ purchase }) => purchaseCoversCandidateQuestion(purchase, subjectId, row))
            .map(({ purchase }) => purchase.id);
          return {
            row,
            coveringPurchaseIds,
            sortSeed: randomize ? Math.random() : 0,
          };
        })
        .filter((entry) => entry.coveringPurchaseIds.length > 0);
      if (candidateCoverage.length === 0) return;

      const coverageCountByPurchaseId = new Map<string, number>();
      candidateCoverage.forEach((entry) => {
        entry.coveringPurchaseIds.forEach((purchaseId) => {
          coverageCountByPurchaseId.set(purchaseId, (coverageCountByPurchaseId.get(purchaseId) || 0) + 1);
        });
      });

      const remainingByPurchaseId = new Map<string, number>(
        bucketPurchases.map(({ purchase, remaining }) => [purchase.id, remaining])
      );

      candidateCoverage
        .sort((left, right) => {
          if (left.coveringPurchaseIds.length !== right.coveringPurchaseIds.length) {
            return left.coveringPurchaseIds.length - right.coveringPurchaseIds.length;
          }
          if (randomize && left.sortSeed !== right.sortSeed) {
            return left.sortSeed - right.sortSeed;
          }
          return left.row.id.localeCompare(right.row.id);
        })
        .forEach((entry) => {
          const availableCoveringPurchases = entry.coveringPurchaseIds
            .filter((purchaseId) => (remainingByPurchaseId.get(purchaseId) || 0) > 0)
            .sort((left, right) => {
              const leftCoverage = coverageCountByPurchaseId.get(left) || 0;
              const rightCoverage = coverageCountByPurchaseId.get(right) || 0;
              if (leftCoverage !== rightCoverage) return leftCoverage - rightCoverage;
              const leftRemaining = remainingByPurchaseId.get(left) || 0;
              const rightRemaining = remainingByPurchaseId.get(right) || 0;
              if (leftRemaining !== rightRemaining) return leftRemaining - rightRemaining;
              return left.localeCompare(right);
            });

          const selectedPurchaseId = availableCoveringPurchases[0];
          if (!selectedPurchaseId) return;

          remainingByPurchaseId.set(selectedPurchaseId, Math.max(0, (remainingByPurchaseId.get(selectedPurchaseId) || 0) - 1));
          allocatedRows.push(entry.row);
        });
    });

    return allocatedRows;
  };

  const getPaidPurchaseAvailabilityForConfig = (
    subjectId?: string,
    topicId?: string,
    subtopicPaths?: string[],
    legacySubtopic?: string,
    questionType: 'All' | 'MCQ' | 'Numerical' | 'Text' = 'All',
    difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard' = 'All',
    referenceTime: Date = scheduledTeacherQuestionCoveragePreviewAt || new Date()
  ) => {
    const candidateRows = getCandidateQuestionRowsForConfig(
      subjectId,
      topicId,
      subtopicPaths,
      legacySubtopic,
      'paid',
      questionType,
      difficultyLevel
    );
    if (!subjectId || candidateRows.length === 0) {
      return {
        candidateRows,
        selectableRows: [] as CandidateQuestionRow[],
        hasAnyMatchingPurchase: false,
        hasExpiredMatchingPurchase: false,
        hasStudentCoverageGap: false,
      };
    }

    const minimumStudentsRequired = Math.max(1, liveBatchTokenStudentCount);
    const matchingPurchases = (teacherQuestionPurchasesData || []).filter((purchase) => {
      if ((purchase.status || 'paid') !== 'paid') return false;
      return candidateRows.some((row) => purchaseCoversCandidateQuestion(purchase, subjectId, row));
    });
    const activeMatchingPurchases = matchingPurchases.filter((purchase) => isTeacherQuestionPurchaseActiveAt(purchase, referenceTime));
    const eligiblePurchases = activeMatchingPurchases.filter(
      (purchase) => Math.max(1, Number(purchase.studentsCount || 1)) >= minimumStudentsRequired
    );

    return {
      candidateRows,
      selectableRows: allocatePaidPurchasedQuestionRows(subjectId, candidateRows, eligiblePurchases),
      referenceTime,
      hasAnyMatchingPurchase: matchingPurchases.length > 0,
      hasExpiredMatchingPurchase: matchingPurchases.some((purchase) => !isTeacherQuestionPurchaseActiveAt(purchase, referenceTime)),
      hasStudentCoverageGap:
        liveBatchTokenStudentCount > 0
        && activeMatchingPurchases.length > 0
        && eligiblePurchases.length === 0,
    };
  };

  const getSubtopicPathPoolForConfig = (
    subjectId?: string,
    topicId?: string,
    questionAccessLevel: 'free' | 'paid' = defaultSectionQuestionAccessLevel
  ) => {
    if (!subjectId || !topicId) return [] as string[][];
    const equivalentSubjectIds = getEquivalentSubjectIdSet(subjectId, selectedClass, selectedExamType);
    const unique = new Map<string, string[]>();
    availableQuestionEntries
      .filter((entry) =>
        entry.accessLevel === questionAccessLevel
        && equivalentSubjectIds.has(entry.subjectId)
        && entry.topicId === topicId
      )
      .forEach((entry) => {
        (entry.subtopics || []).forEach((path) => {
          const normalizedPath = parseSubtopicPathSelection(path);
          const key = getSubtopicPathKey(normalizedPath);
          if (!key || unique.has(key)) return;
          unique.set(key, normalizedPath);
        });
      });

    return Array.from(unique.values()).sort((a, b) =>
      serializeSubtopicPathSelection(a).localeCompare(serializeSubtopicPathSelection(b))
    );
  };

  const getAvailableCountForConfig = (
    subjectId?: string,
    topicId?: string,
    subtopicPaths?: string[],
    legacySubtopic?: string,
    questionAccessLevel: 'free' | 'paid' = defaultSectionQuestionAccessLevel,
    questionType: 'All' | 'MCQ' | 'Numerical' | 'Text' = 'All',
    difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard' = 'All',
    sectionIndex?: number
  ) => {
    if (!subjectId) return 0;
    if (questionAccessLevel === 'paid') {
      return getPaidPurchaseAvailabilityForConfig(
        subjectId,
        topicId,
        subtopicPaths,
        legacySubtopic,
        questionType,
        difficultyLevel
      ).selectableRows.length;
    }

    const candidateCount = getCandidateQuestionRowsForConfig(
      subjectId,
      topicId,
      subtopicPaths,
      legacySubtopic,
      questionAccessLevel,
      questionType,
      difficultyLevel
    ).length;
    if (typeof sectionIndex !== 'number') return Math.min(candidateCount, MAX_FREE_DCAM_BANK_QUESTIONS_PER_TEST);
    return Math.min(candidateCount, getFreeQuestionAllowanceForSection(sectionIndex));
  };

  useEffect(() => {
    if (!watchedSubjectConfigs || watchedSubjectConfigs.length === 0) return;

    let hasChanges = false;
    let purchaseDialogCopy: { title: string; description: string } | null = null;
    const nextConfigs = watchedSubjectConfigs.map((config, index) => {
      let nextConfig = config;

      if (!nextConfig.subjectId) {
        if (nextConfig.questionAccessLevel === 'paid') {
          hasChanges = true;
          return {
            ...nextConfig,
            questionAccessLevel: 'free' as const,
          };
        }
        return nextConfig;
      }

      if (nextConfig.questionAccessLevel === 'paid') {
        const paidAvailability = getPaidPurchaseAvailabilityForConfig(
          nextConfig.subjectId,
          nextConfig.topicId,
          nextConfig.subtopicPaths,
          nextConfig.subtopic,
          nextConfig.questionType,
          nextConfig.difficultyLevel
        );
        if (paidAvailability.selectableRows.length === 0) {
          hasChanges = true;
          if (!purchaseDialogCopy) {
            purchaseDialogCopy = buildPaidQuestionPurchaseDialogCopy({
              subjectLabel: nextConfig.subjectName || subjectNameById[nextConfig.subjectId] || nextConfig.subjectId,
              topicLabel: nextConfig.topicId ? (nextConfig.topicName || topicNameById[nextConfig.topicId] || nextConfig.topicId) : '',
              sectionAvailability: paidAvailability,
            });
          }
          nextConfig = {
            ...nextConfig,
            questionAccessLevel: 'free' as const,
          };
        }
      }

      const availableCount = getAvailableCountForConfig(
        nextConfig.subjectId,
        nextConfig.topicId,
        nextConfig.subtopicPaths,
        nextConfig.subtopic,
        nextConfig.questionAccessLevel,
        nextConfig.questionType,
        nextConfig.difficultyLevel,
        index
      );
      const requestedCount = Math.max(1, Number(nextConfig.count || 1));
      if (availableCount > 0 && requestedCount > availableCount) {
        hasChanges = true;
        return {
          ...nextConfig,
          count: availableCount,
        };
      }
      return nextConfig;
    });

    if (hasChanges) {
      replace(nextConfigs);
    }
    if (purchaseDialogCopy) {
      openPurchaseAvailabilityDialog(purchaseDialogCopy);
    }
  }, [
    watchedSubjectConfigs,
    availableQuestionEntries,
    teacherQuestionPurchasesData,
    liveBatchTokenStudentCount,
    scheduledTeacherQuestionCoveragePreviewAt,
    subjectNameById,
    topicNameById,
    replace,
  ]);

  const meetingSchedules = useMemo(
    () => (sessions || []).filter((s) => s.type === 'meeting').sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    [sessions]
  );
  const sessionResolution = useMemo(
    () => resolveLiveBatchSessions({ sessions: sessions || [], batch: liveBatch }),
    [liveBatch, sessions]
  );
  const visiblePreviousSessionUploads = useMemo(
    () =>
      [...sessionResolution.visiblePreviousSessions].sort((left, right) => {
        const leftMs =
          parseYmdToLocalDate(left.date)?.getTime()
          ?? new Date(String(left.updatedAt || left.createdAt || 0)).getTime()
          ?? 0;
        const rightMs =
          parseYmdToLocalDate(right.date)?.getTime()
          ?? new Date(String(right.updatedAt || right.createdAt || 0)).getTime()
          ?? 0;
        return rightMs - leftMs;
      }),
    [sessionResolution.visiblePreviousSessions]
  );
  const conductedMeetingHistory = useMemo(
    () => [...sessionResolution.conductedMeetings].sort((left, right) => right.completionDateTime.getTime() - left.completionDateTime.getTime()),
    [sessionResolution.conductedMeetings]
  );
  const conductedPreviousSessionDateOptions = useMemo(
    () =>
      getConductedLiveBatchSessionDateOptions({
        sessions: sessions || [],
        batch: liveBatch,
        now: new Date(nowTimestamp),
        scheduleLookbackMonths: 6,
      }).map((option) => ({
        ...option,
        subjectName: option.subjectName || (option.subjectId ? (subjectNameById[option.subjectId] || option.subjectId) : ''),
      })),
    [liveBatch, nowTimestamp, sessions, subjectNameById]
  );
  const previousSessionUploadsByOccurrenceKey = useMemo(() => {
    const grouped = new Map<string, LiveBatchSession[]>();
    visiblePreviousSessionUploads.forEach((session) => {
      const occurrenceKey = getLiveBatchSessionOccurrenceKey(session, liveBatch);
      if (!occurrenceKey) return;
      const current = grouped.get(occurrenceKey) || [];
      current.push(session);
      grouped.set(occurrenceKey, current);
    });

    grouped.forEach((items, key) => {
      grouped.set(
        key,
        [...items].sort((left, right) => {
          const leftMs =
            new Date(String(left.updatedAt || left.createdAt || 0)).getTime()
            || parseYmdToLocalDate(left.date)?.getTime()
            || 0;
          const rightMs =
            new Date(String(right.updatedAt || right.createdAt || 0)).getTime()
            || parseYmdToLocalDate(right.date)?.getTime()
            || 0;
          return rightMs - leftMs;
        })
      );
    });

    return grouped;
  }, [liveBatch, visiblePreviousSessionUploads]);
  const hasMultipleBatchSubjects = (liveBatch?.subjectIds || []).length > 1;
  const resolvedPreviousSessionSubjectId = useMemo(() => {
    if (selectedPreviousSessionSubjectId) return selectedPreviousSessionSubjectId;
    const batchSubjectIds = liveBatch?.subjectIds || [];
    return batchSubjectIds.length === 1 ? (batchSubjectIds[0] || '') : '';
  }, [liveBatch?.subjectIds, selectedPreviousSessionSubjectId]);
  const previousSessionDatePickerOptions = useMemo(() => {
    const normalizedSubjectId = resolvedPreviousSessionSubjectId.trim();
    if (!normalizedSubjectId) return conductedPreviousSessionDateOptions;
    return conductedPreviousSessionDateOptions.filter((option) => (option.subjectId || '').trim() === normalizedSubjectId);
  }, [conductedPreviousSessionDateOptions, resolvedPreviousSessionSubjectId]);
  const selectedPreviousSessionDateOption = useMemo(
    () => previousSessionDatePickerOptions.find((option) => option.date === selectedPreviousSessionDate) || null,
    [previousSessionDatePickerOptions, selectedPreviousSessionDate]
  );
  const matchedMeetingForPreviousSession = useMemo(() => {
    if (!selectedPreviousSessionDate) return null;
    const normalizedSubjectId = resolvedPreviousSessionSubjectId.trim();
    return conductedMeetingHistory.find((meeting) => {
      if (meeting.date !== selectedPreviousSessionDate) return false;
      if (!normalizedSubjectId) return true;
      return (meeting.subjectId || '').trim() === normalizedSubjectId;
    }) || null;
  }, [conductedMeetingHistory, resolvedPreviousSessionSubjectId, selectedPreviousSessionDate]);
  const existingPreviousSessionForSelection = useMemo(() => {
    if (!selectedPreviousSessionDate) return null;
    if (hasMultipleBatchSubjects && !resolvedPreviousSessionSubjectId.trim()) return null;

    return visiblePreviousSessionUploads.find((session) => {
      if (session.date !== selectedPreviousSessionDate) return false;
      if (!resolvedPreviousSessionSubjectId.trim()) return true;
      return (session.subjectId || '').trim() === resolvedPreviousSessionSubjectId.trim();
    }) || null;
  }, [hasMultipleBatchSubjects, resolvedPreviousSessionSubjectId, selectedPreviousSessionDate, visiblePreviousSessionUploads]);
  const resolvedPreviousSessionTiming = useMemo(() => {
    const matchedStartTime = (
      matchedMeetingForPreviousSession?.meetingTime
      || selectedPreviousSessionDateOption?.meetingTime
      || existingPreviousSessionForSelection?.meetingTime
      || ''
    ).trim();
    const matchedEndTime = (
      matchedMeetingForPreviousSession?.meetingEndTime
      || selectedPreviousSessionDateOption?.meetingEndTime
      || existingPreviousSessionForSelection?.meetingEndTime
      || ''
    ).trim();
    if (matchedStartTime) {
      return {
        startTime: matchedStartTime,
        endTime: matchedEndTime || matchedStartTime,
      };
    }

    const presetTiming = getPresetTimingForDate(
      selectedPreviousSessionDate,
      resolvedPreviousSessionSubjectId || undefined
    );
    return {
      startTime: (presetTiming.startTime || '').trim(),
      endTime: (presetTiming.endTime || presetTiming.startTime || '').trim(),
    };
  }, [
    existingPreviousSessionForSelection?.meetingEndTime,
    existingPreviousSessionForSelection?.meetingTime,
    matchedMeetingForPreviousSession?.meetingEndTime,
    matchedMeetingForPreviousSession?.meetingTime,
    resolvedPreviousSessionSubjectId,
    selectedPreviousSessionDateOption?.meetingEndTime,
    selectedPreviousSessionDateOption?.meetingTime,
    selectedPreviousSessionDate,
  ]);
  const previousSessionAutoTitle = useMemo(() => {
    if (existingPreviousSessionForSelection?.sessionLabel?.trim()) return existingPreviousSessionForSelection.sessionLabel.trim();
    if (existingPreviousSessionForSelection?.meetingTitle?.trim()) return existingPreviousSessionForSelection.meetingTitle.trim();
    if (matchedMeetingForPreviousSession?.meetingTitle?.trim()) return matchedMeetingForPreviousSession.meetingTitle.trim();
    if (selectedPreviousSessionDateOption?.meetingTitle?.trim()) return selectedPreviousSessionDateOption.meetingTitle.trim();
    const subjectLabel = resolvedPreviousSessionSubjectId
      ? (subjectNameById[resolvedPreviousSessionSubjectId] || resolvedPreviousSessionSubjectId)
      : 'Class';
    return `${subjectLabel} Live Session`;
  }, [
    existingPreviousSessionForSelection?.meetingTitle,
    existingPreviousSessionForSelection?.sessionLabel,
    matchedMeetingForPreviousSession?.meetingTitle,
    resolvedPreviousSessionSubjectId,
    selectedPreviousSessionDateOption?.meetingTitle,
    selectedPreviousSessionDate,
    subjectNameById,
  ]);
  const upcomingMeetingSchedules = useMemo(
    () => getUpcomingLiveBatchMeetingSessions(meetingSchedules, { batch: liveBatch }),
    [liveBatch, meetingSchedules]
  );
  const upcomingNoticeTargetOptions = useMemo<TeacherNoticeTargetOption[]>(
    () =>
      upcomingMeetingSchedules.map((meeting) => ({
        id: meeting.id,
        occurrenceKey: meeting.meetingOccurrenceKey,
        date: meeting.date || '',
        meetingTime: meeting.meetingTime || '',
        meetingEndTime: meeting.meetingEndTime || meeting.meetingTime || '',
        subjectId: meeting.subjectId || '',
        subjectName: meeting.subjectName || '',
        title: meeting.meetingTitle || meeting.sessionLabel || `${meeting.subjectName || meeting.subjectId || 'Scheduled class'} Live Session`,
        meetingTitle: meeting.meetingTitle || meeting.sessionLabel || '',
        source: 'upcoming',
        sessionId: meeting.id,
        previousSessionId: '',
        previousUploadCount: (previousSessionUploadsByOccurrenceKey.get(meeting.meetingOccurrenceKey) || []).length,
      })),
    [previousSessionUploadsByOccurrenceKey, upcomingMeetingSchedules]
  );
  const previousNoticeTargetOptions = useMemo<TeacherNoticeTargetOption[]>(
    () =>
      conductedMeetingHistory.map((meeting) => ({
        id: meeting.meetingOccurrenceKey,
        occurrenceKey: meeting.meetingOccurrenceKey,
        date: meeting.date,
        meetingTime: meeting.meetingTime || '',
        meetingEndTime: meeting.meetingEndTime || meeting.meetingTime || '',
        subjectId: meeting.subjectId || '',
        subjectName: meeting.subjectName || '',
        title: meeting.meetingTitle || `${meeting.subjectName || meeting.subjectId || 'Past class'} Live Session`,
        meetingTitle: meeting.meetingTitle || '',
        source: meeting.source,
        sessionId: meeting.sessionId || '',
        previousSessionId: meeting.previousSessionId || '',
        previousUploadCount: (previousSessionUploadsByOccurrenceKey.get(meeting.meetingOccurrenceKey) || []).length,
      })),
    [conductedMeetingHistory, previousSessionUploadsByOccurrenceKey]
  );
  const selectedCancelledMeeting = useMemo(
    () => (
      cancelTargetPeriod === 'upcoming'
        ? upcomingNoticeTargetOptions.find((meeting) => meeting.id === cancelSessionId)
        : previousNoticeTargetOptions.find((meeting) => meeting.id === cancelSessionId)
    ) || null,
    [cancelSessionId, cancelTargetPeriod, previousNoticeTargetOptions, upcomingNoticeTargetOptions]
  );
  const selectedHolidayTarget = useMemo(
    () => (
      holidayTargetPeriod === 'upcoming'
        ? upcomingNoticeTargetOptions.find((meeting) => meeting.id === holidaySessionId)
        : previousNoticeTargetOptions.find((meeting) => meeting.id === holidaySessionId)
    ) || null,
    [holidaySessionId, holidayTargetPeriod, previousNoticeTargetOptions, upcomingNoticeTargetOptions]
  );
  const holidayOrCancelled = useMemo(
    () => (sessions || []).filter((s) => s.type === 'holiday' || s.type === 'cancelled').sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    [sessions]
  );
  const scheduledBatchTests = useMemo(
    () =>
      (scheduledTests || [])
        .filter((t) => t.liveBatchId === batchId && t.publicationStatus !== 'deleted')
        .sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || '')),
    [scheduledTests, batchId]
  );
  const completedScheduledBatchTests = useMemo(() => {
    const now = new Date(nowTimestamp);
    return scheduledBatchTests.filter((test) => isScheduledTestCompleted(test, now));
  }, [nowTimestamp, scheduledBatchTests]);
  const upcomingScheduledBatchTests = useMemo(
    () => {
      const now = new Date(nowTimestamp);
      return scheduledBatchTests.filter((test) => !isScheduledTestCompleted(test, now));
    },
    [nowTimestamp, scheduledBatchTests]
  );
  useEffect(() => {
    const nextMeetingDrafts: Record<string, { date: string; meetingTime: string; meetingEndTime: string }> = {};
    upcomingMeetingSchedules.forEach((meeting) => {
      const presetTiming = getPresetTimingForDate(meeting.date, meeting.subjectId);
      nextMeetingDrafts[meeting.id] = {
        date: meeting.date || '',
        meetingTime: meeting.meetingTime || '',
        meetingEndTime: meeting.meetingEndTime || presetTiming.endTime || '',
      };
    });
    setMeetingDrafts(nextMeetingDrafts);
  }, [upcomingMeetingSchedules, liveBatch]);

  useEffect(() => {
    const selectionKey = `${selectedPreviousSessionDate}::${resolvedPreviousSessionSubjectId}`;
    if (!selectedPreviousSessionDate) {
      previousSessionSelectionRef.current = '';
      previousSessionAutoTitleRef.current = '';
      return;
    }

    const selectionChanged = previousSessionSelectionRef.current !== selectionKey;
    const suggestedTitle = previousSessionAutoTitle || '';
    const currentTitle = (previousSessionForm.getValues('sessionLabel') || '').trim();
    const shouldReplaceTitle = selectionChanged || !currentTitle || currentTitle === previousSessionAutoTitleRef.current;

    if (shouldReplaceTitle) {
      previousSessionForm.setValue('sessionLabel', suggestedTitle, { shouldValidate: Boolean(suggestedTitle) });
    }

    if (selectionChanged) {
      previousSessionForm.setValue(
        'previousSessionUrl',
        existingPreviousSessionForSelection?.previousSessionUrl || '',
        { shouldValidate: Boolean(existingPreviousSessionForSelection?.previousSessionUrl) }
      );
    }

    previousSessionSelectionRef.current = selectionKey;
    previousSessionAutoTitleRef.current = suggestedTitle;
  }, [
    existingPreviousSessionForSelection?.id,
    existingPreviousSessionForSelection?.previousSessionUrl,
    previousSessionAutoTitle,
    previousSessionForm,
    resolvedPreviousSessionSubjectId,
    selectedPreviousSessionDate,
  ]);

  useEffect(() => {
    if (!selectedPreviousSessionDate) return;
    if (selectedPreviousSessionDateOption) return;
    previousSessionForm.setValue('date', '', { shouldValidate: true });
  }, [previousSessionForm, selectedPreviousSessionDate, selectedPreviousSessionDateOption]);

  useEffect(() => {
    setCancelSessionId('');
    setCancelDate('');
    setCancelLabel('');
  }, [cancelTargetPeriod]);

  useEffect(() => {
    if (!selectedCancelledMeeting) {
      setCancelDate('');
      setCancelLabel('');
      return;
    }

    setCancelDate(selectedCancelledMeeting.date || '');
    setCancelLabel(
      selectedCancelledMeeting.title
      || `${selectedCancelledMeeting.subjectName || selectedCancelledMeeting.subjectId || 'Scheduled class'} Live Session`
    );
  }, [selectedCancelledMeeting]);

  useEffect(() => {
    setHolidaySessionId('');
    if (holidayTargetPeriod === 'previous') {
      setHolidayDate('');
      setHolidayEndDate('');
    }
  }, [holidayTargetPeriod]);

  useEffect(() => {
    if (!selectedHolidayTarget) return;
    setHolidayDate(selectedHolidayTarget.date || '');
    setHolidayEndDate(selectedHolidayTarget.date || '');
  }, [selectedHolidayTarget]);

  useEffect(() => {
    const nextTestDrafts: Record<string, ScheduledTestDraft> = {};
    scheduledBatchTests.forEach((test) => {
      const rawAttemptMode = test.attemptLimit?.mode;
      const rawIntervalUnit = test.attemptLimit?.intervalUnit;
      const availabilityMode = resolveScheduledTestAvailabilityMode(test);
      const attemptLimitModeValue: AttemptLimitMode =
        rawAttemptMode === 'total' || rawAttemptMode === 'interval' ? rawAttemptMode : 'unlimited';
      const attemptIntervalUnitValue: AttemptIntervalUnit =
        rawIntervalUnit === 'day' || rawIntervalUnit === 'week' || rawIntervalUnit === 'month' || rawIntervalUnit === 'year'
          ? rawIntervalUnit
          : 'week';
      nextTestDrafts[test.id] = {
        availabilityMode,
        scheduledDate: test.scheduledDate || '',
        scheduledTime: test.scheduledTime || '',
        scheduledEndTime: test.scheduledEndTime || '',
        attemptLimitMode: attemptLimitModeValue,
        maxTotalAttempts: Number(test.attemptLimit?.maxTotalAttempts ?? 1),
        maxAttemptsPerInterval: Number(test.attemptLimit?.maxAttemptsPerInterval ?? 1),
        attemptIntervalValue: Number(test.attemptLimit?.intervalValue ?? 1),
        attemptIntervalUnit: attemptIntervalUnitValue,
      };
    });
    setTestDrafts(nextTestDrafts);
  }, [liveBatch, scheduledBatchTests]);

  const saveMeetingScheduleTime = async (sessionId: string) => {
    const draft = meetingDrafts[sessionId];
    if (!draft?.date || !draft?.meetingTime || !draft?.meetingEndTime) {
      toast({ variant: 'destructive', title: 'Missing values', description: 'Please set date, start time, and end time.' });
      return;
    }
    const meetingStartMinutes = parseTimeToMinutes(draft.meetingTime);
    const meetingEndMinutes = parseTimeToMinutes(draft.meetingEndTime);
    if (meetingStartMinutes === null || meetingEndMinutes === null || meetingEndMinutes <= meetingStartMinutes) {
      toast({ variant: 'destructive', title: 'Invalid time range', description: 'Session end time must be later than start time.' });
      return;
    }
    setSavingMeetingId(sessionId);
    try {
      await updateDocumentNonBlocking(doc(firestore, 'live_batch_sessions', sessionId), {
        date: draft.date,
        meetingTime: draft.meetingTime,
        meetingEndTime: draft.meetingEndTime,
        timingMode: 'manual_override',
        scheduleVersion: Math.max(0, Number(liveBatch?.scheduleVersion || 0)),
        updatedAt: serverTimestamp(),
      });
      const meeting = meetingSchedules.find((item) => item.id === sessionId);
      const batchTitle = liveBatch?.title || 'Your live batch';
      const meetingTitle = meeting?.meetingTitle || 'Live class';
      await sendStudentBatchNotification({
        title: 'Live Class Rescheduled',
        message: `${batchTitle}: "${meetingTitle}" is now scheduled on ${draft.date} from ${draft.meetingTime} to ${draft.meetingEndTime}.`,
        notificationType: 'live_batch_upcoming',
        eventDate: draft.date,
        eventTime: draft.meetingTime,
        eventEndTime: draft.meetingEndTime,
      });
      toast({ title: 'Meeting schedule updated', description: 'Date and time updated successfully.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: error?.message || 'Could not update meeting schedule.' });
    } finally {
      setSavingMeetingId(null);
    }
  };

  const saveTestScheduleTime = async (testId: string) => {
    const draft = testDrafts[testId];
    if (!draft?.scheduledDate) {
      toast({
        variant: 'destructive',
        title: 'Missing values',
        description: 'Please set the scheduled date first.',
      });
      return;
    }
    const durationMinutes = getScheduledTestDurationMinutes(draft.scheduledTime, draft.scheduledEndTime);
    if (draft.availabilityMode === 'single_day' && (!draft.scheduledTime || !draft.scheduledEndTime || durationMinutes === null)) {
      toast({
        variant: 'destructive',
        title: 'Invalid test timing',
        description: 'For single-day tests, set both start and end time and keep the end later than the start.',
      });
      return;
    }
    if (draft.attemptLimitMode === 'total' && Number(draft.maxTotalAttempts) < 1) {
      toast({
        variant: 'destructive',
        title: 'Invalid attempt limit',
        description: 'Maximum total attempts must be at least 1.',
      });
      return;
    }
    if (
      draft.attemptLimitMode === 'interval'
      && (Number(draft.maxAttemptsPerInterval) < 1 || Number(draft.attemptIntervalValue) < 1)
    ) {
      toast({
        variant: 'destructive',
        title: 'Invalid attempt limit',
        description: 'Attempts per interval and interval value must both be at least 1.',
      });
      return;
    }
    const scheduledStartAt = new Date(
      draft.availabilityMode === 'single_day'
        ? `${draft.scheduledDate}T${draft.scheduledTime}:00`
        : `${draft.scheduledDate}T00:00:00`
    );
    const attemptLimit: AttemptLimitConfig = {
      mode: draft.attemptLimitMode,
      maxTotalAttempts: draft.attemptLimitMode === 'total' ? Number(draft.maxTotalAttempts) : null,
      maxAttemptsPerInterval: draft.attemptLimitMode === 'interval' ? Number(draft.maxAttemptsPerInterval) : null,
      intervalValue: draft.attemptLimitMode === 'interval' ? Number(draft.attemptIntervalValue) : null,
      intervalUnit: draft.attemptLimitMode === 'interval' ? draft.attemptIntervalUnit : null,
    };
    setSavingTestId(testId);
    try {
      await updateDocumentNonBlocking(doc(firestore, 'mock_tests', testId), {
        availabilityMode: draft.availabilityMode,
        scheduledDate: draft.scheduledDate,
        scheduledTime: draft.availabilityMode === 'single_day' ? draft.scheduledTime : deleteField(),
        scheduledEndTime: draft.availabilityMode === 'single_day' ? draft.scheduledEndTime : deleteField(),
        accessStartTime: deleteField(),
        accessEndTime: deleteField(),
        accessWindowStartAt: deleteField(),
        accessWindowEndAt: deleteField(),
        startTime: scheduledStartAt,
        'config.duration': draft.availabilityMode === 'single_day' && durationMinutes !== null ? durationMinutes : deleteField(),
        attemptLimit,
        updatedAt: serverTimestamp(),
      });
      const scheduledTest = scheduledBatchTests.find((item) => item.id === testId);
      const isPublished = scheduledTest?.publicationStatus !== 'draft' && scheduledTest?.publicationStatus !== 'deleted';
      if (isPublished) {
        const batchTitle = liveBatch?.title || 'Your live batch';
        const testTitle = scheduledTest?.title || 'Live Batch Test';
        const timingSummary = buildScheduledTestSummary(draft);
        await sendStudentBatchNotification({
          title: 'Live Batch Test Scheduled',
          message: `${batchTitle}: "${testTitle}" ${timingSummary}.`,
          notificationType: 'live_batch_test_scheduled',
          href: `/mock-tests/${testId}`,
          eventDate: draft.scheduledDate,
          eventTime: draft.availabilityMode === 'single_day' ? draft.scheduledTime : undefined,
          eventEndTime: draft.availabilityMode === 'single_day' ? draft.scheduledEndTime || undefined : undefined,
        });
      }
      toast({
        title: 'Test schedule updated',
        description: 'Test timing and attempt limits updated successfully.',
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: error?.message || 'Could not update test schedule.' });
    } finally {
      setSavingTestId(null);
    }
  };

  const deleteScheduledTest = async () => {
    if (!firestore || !testToDelete?.id) return;
    setDeletingTestId(testToDelete.id);
    try {
      await updateDocumentNonBlocking(doc(firestore, 'mock_tests', testToDelete.id), {
        publicationStatus: 'deleted',
        deletedAt: new Date().toISOString(),
        deletedBy: user?.uid || null,
        updatedAt: serverTimestamp(),
      });
      setTestDrafts((prev) => {
        const next = { ...prev };
        delete next[testToDelete.id];
        return next;
      });
      toast({
        title: 'Test removed',
        description: `${testToDelete.title || 'This scheduled test'} has been removed from this batch.`,
      });
      setTestToDelete(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error?.message || 'Could not remove this scheduled test.',
      });
    } finally {
      setDeletingTestId(null);
    }
  };

  const saveContentUnlockLeadTime = async () => {
    if (!firestore || !batchId) return;
    const normalizedMinutes = unlockLeadMinutesDraft.trim() === ''
      ? normalizeContentUnlockLeadMinutes(liveBatch?.contentUnlockLeadMinutes)
      : normalizeContentUnlockLeadMinutes(unlockLeadMinutesDraft);
    setIsSavingUnlockLeadTime(true);
    try {
      await updateDocumentNonBlocking(doc(firestore, 'live_batches', batchId), {
        contentUnlockLeadMinutes: normalizedMinutes,
        updatedAt: serverTimestamp(),
      });
      setUnlockLeadMinutesDraft(String(normalizedMinutes));
      toast({
        title: 'Unlock timing updated',
        description: normalizedMinutes === 0
          ? 'Students will see scheduled content only at the scheduled time.'
          : `Students will see scheduled content ${normalizedMinutes} minute${normalizedMinutes === 1 ? '' : 's'} before the scheduled time.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error?.message || 'Could not update the content unlock timing.',
      });
    } finally {
      setIsSavingUnlockLeadTime(false);
    }
  };

  const applySlotToMeetingForm = (slot: UpcomingSessionSlot) => {
    if (slot.noticeType) return;
    meetingForm.setValue('date', slot.date, { shouldValidate: true });
    meetingForm.setValue('meetingTime', slot.startTime, { shouldValidate: true });
    if (slot.endTime) {
      meetingForm.setValue('meetingEndTime', slot.endTime, { shouldValidate: true });
    }
    if (!applyMeetingToAllSubjects && slot.subjectId) {
      meetingForm.setValue('subjectId', slot.subjectId, { shouldValidate: true });
    }
    setActiveModule('meeting');
  };

  const applySlotToTestForm = (slot: UpcomingSessionSlot) => {
    if (slot.noticeType) return;
    setValue('availabilityMode', 'single_day', { shouldValidate: true });
    setValue('scheduledDate', slot.date, { shouldValidate: true });
    setValue('scheduledTime', slot.startTime, { shouldValidate: true });
    setValue('scheduledEndTime', slot.endTime || '', { shouldValidate: true });
    setActiveModule('test');
  };

  const sendStudentBatchNotification = async (params: {
    title: string;
    message: string;
    notificationType: 'live_batch_upcoming' | 'live_batch_holiday' | 'live_batch_cancelled' | 'live_batch_test_scheduled';
    href?: string;
    eventDate?: string;
    eventEndDate?: string;
    eventTime?: string;
    eventEndTime?: string;
  }) => {
    if (!user || !batchId) return;

    await notifyLiveBatchStudents(user, {
      batchId,
      title: params.title,
      message: params.message,
      href: params.href || '/my-batch',
      notificationType: params.notificationType,
      dedupeKey: [
        params.notificationType,
        batchId,
        params.eventDate || '',
        params.eventEndDate || '',
        params.eventTime || '',
        params.eventEndTime || '',
        params.title,
      ].join('::'),
      eventDate: params.eventDate,
      eventEndDate: params.eventEndDate,
      eventTime: params.eventTime,
      eventEndTime: params.eventEndTime,
    });
  };

  const getPreviousSessionUploadsForOccurrence = (occurrenceKey?: string) => {
    if (!occurrenceKey) return [] as LiveBatchSession[];
    return previousSessionUploadsByOccurrenceKey.get(occurrenceKey) || [];
  };

  const deletePreviousSessionUploadsForOccurrence = async (occurrenceKey?: string) => {
    if (!firestore || !occurrenceKey) return 0;
    const matchingUploads = getPreviousSessionUploadsForOccurrence(occurrenceKey)
      .filter((session) => Boolean(session.id));
    if (matchingUploads.length === 0) return 0;

    await Promise.all(
      matchingUploads.map((session) =>
        deleteDocumentNonBlocking(doc(firestore, 'live_batch_sessions', session.id))
      )
    );
    return matchingUploads.length;
  };

  const declareHoliday = async () => {
    if (!user || !batchId) {
      toast({ variant: 'destructive', title: 'Missing values', description: 'Please pick the session or holiday date first.' });
      return;
    }
    if (holidayTargetPeriod === 'previous' && !selectedHolidayTarget) {
      toast({ variant: 'destructive', title: 'Missing class', description: 'Please choose the previous session to mark as holiday.' });
      return;
    }

    const resolvedHolidayDate = selectedHolidayTarget?.date || holidayDate;
    if (!resolvedHolidayDate) {
      toast({ variant: 'destructive', title: 'Missing values', description: 'Please pick a holiday date.' });
      return;
    }

    const finalHolidayEndDate = selectedHolidayTarget?.date || holidayEndDate || resolvedHolidayDate;
    if (finalHolidayEndDate < resolvedHolidayDate) {
      toast({ variant: 'destructive', title: 'Invalid range', description: 'Holiday end date cannot be before start date.' });
      return;
    }
    setIsSavingHoliday(true);
    try {
      const selectedTargetLabel = selectedHolidayTarget?.title || '';
      await addDocumentNonBlocking(collection(firestore, 'live_batch_sessions'), {
        batchId,
        teacherId: user.uid,
        type: 'holiday',
        date: resolvedHolidayDate,
        holidayEndDate: finalHolidayEndDate,
        meetingTime: selectedHolidayTarget?.meetingTime || null,
        meetingEndTime: selectedHolidayTarget?.meetingEndTime || null,
        subjectId: selectedHolidayTarget?.subjectId || null,
        subjectName: selectedHolidayTarget?.subjectName || null,
        meetingTitle: selectedTargetLabel || null,
        targetSessionId: selectedHolidayTarget?.sessionId || null,
        sessionLabel: selectedTargetLabel || null,
        reason: holidayReason || 'Holiday declared by teacher.',
        createdAt: serverTimestamp(),
      });

      const removedPreviousUploadCount = holidayTargetPeriod === 'previous'
        ? await deletePreviousSessionUploadsForOccurrence(selectedHolidayTarget?.occurrenceKey)
        : 0;
      const batchTitle = liveBatch?.title || 'Your live batch';
      const rangeLabel = formatYmdRange(resolvedHolidayDate, finalHolidayEndDate);
      const reasonLabel = holidayReason ? ` Reason: ${holidayReason}` : '';
      await sendStudentBatchNotification({
        title: 'Holiday Declared',
        message: selectedHolidayTarget
          ? `${batchTitle}: ${selectedTargetLabel || 'This class'} on ${resolvedHolidayDate} is now marked as holiday.${removedPreviousUploadCount > 0 ? ' Replay details were removed and student credits will reflect automatically.' : ''}${reasonLabel}`
          : `${batchTitle}: Holiday declared for ${rangeLabel}.${reasonLabel}`,
        notificationType: 'live_batch_holiday',
        eventDate: resolvedHolidayDate,
        eventEndDate: finalHolidayEndDate,
        eventTime: selectedHolidayTarget?.meetingTime || undefined,
        eventEndTime: selectedHolidayTarget?.meetingEndTime || undefined,
      });
      toast({
        title: 'Holiday declared',
        description: selectedHolidayTarget
          ? `${selectedTargetLabel || 'Selected class'} was marked as holiday.${removedPreviousUploadCount > 0 ? ' Uploaded replay details were removed.' : ''}`
          : `Holiday marked for ${formatYmdRange(resolvedHolidayDate, finalHolidayEndDate)}.`,
      });
      setHolidaySessionId('');
      setHolidayDate('');
      setHolidayEndDate('');
      setHolidayReason('');
      setActiveNoticePanel(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed', description: error?.message || 'Could not declare holiday.' });
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const cancelSession = async () => {
    if (!user || !batchId || !cancelSessionId) {
      toast({
        variant: 'destructive',
        title: 'Missing values',
        description: cancelTargetPeriod === 'previous'
          ? 'Please choose the previous session to cancel.'
          : 'Please choose the scheduled class to cancel.',
      });
      return;
    }
    setIsSavingCancel(true);
    try {
      const selectedMeeting = selectedCancelledMeeting;
      if (!selectedMeeting?.date) {
        toast({
          variant: 'destructive',
          title: 'Meeting not found',
          description: cancelTargetPeriod === 'previous'
            ? 'Please pick a completed class from the previous-session list.'
            : 'Please pick an upcoming class from the list.',
        });
        return;
      }

      const selectedSubjectLabel = selectedMeeting.subjectName || selectedMeeting.subjectId || 'Class';
      const resolvedSessionLabel =
        cancelLabel
        || selectedMeeting.title
        || `${selectedSubjectLabel} Live Session`;
      await addDocumentNonBlocking(collection(firestore, 'live_batch_sessions'), {
        batchId,
        teacherId: user.uid,
        type: 'cancelled',
        date: selectedMeeting.date,
        meetingTime: selectedMeeting.meetingTime || null,
        meetingEndTime: selectedMeeting.meetingEndTime || null,
        subjectId: selectedMeeting.subjectId || null,
        subjectName: selectedMeeting.subjectName || null,
        meetingTitle: selectedMeeting.title || null,
        targetSessionId: selectedMeeting.sessionId || null,
        sessionLabel: resolvedSessionLabel,
        reason: cancelReason || 'Session cancelled by teacher.',
        createdAt: serverTimestamp(),
      });
      const removedPreviousUploadCount = cancelTargetPeriod === 'previous'
        ? await deletePreviousSessionUploadsForOccurrence(selectedMeeting.occurrenceKey)
        : 0;
      const batchTitle = liveBatch?.title || 'Your live batch';
      const sessionName = resolvedSessionLabel || 'Scheduled class';
      const reasonLabel = cancelReason ? ` Reason: ${cancelReason}` : '';
      await sendStudentBatchNotification({
        title: 'Live Class Cancelled',
        message: cancelTargetPeriod === 'previous'
          ? `${batchTitle}: ${sessionName} from ${selectedMeeting.date} was cancelled after review.${removedPreviousUploadCount > 0 ? ' Replay details were removed and student credits will reflect automatically.' : ''}${reasonLabel}`
          : `${batchTitle}: ${sessionName} on ${selectedMeeting.date} was cancelled.${reasonLabel}`,
        notificationType: 'live_batch_cancelled',
        eventDate: selectedMeeting.date,
        eventTime: selectedMeeting.meetingTime || undefined,
        eventEndTime: selectedMeeting.meetingEndTime || undefined,
      });
      toast({
        title: 'Session cancelled',
        description: cancelTargetPeriod === 'previous'
          ? `The previous session was cancelled.${removedPreviousUploadCount > 0 ? ' Uploaded replay details were removed.' : ''}`
          : 'Cancellation notice has been saved.',
      });
      setCancelSessionId('');
      setCancelDate('');
      setCancelLabel('');
      setCancelReason('');
      setActiveNoticePanel(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed', description: error?.message || 'Could not cancel session.' });
    } finally {
      setIsSavingCancel(false);
    }
  };

  async function onSaveMeeting(values: z.infer<typeof meetingSchema>) {
    if (!user || !batchId) return;
    const batchSubjectIds = liveBatch?.subjectIds || [];
    if (!applyMeetingToAllSubjects && batchSubjectIds.length > 0 && !values.subjectId) {
      toast({ variant: 'destructive', title: 'Subject required', description: 'Please select a subject for this meeting.' });
      return;
    }
    setIsSavingMeeting(true);
    try {
      const nextSubjectDefaultZoomLink = (!applyMeetingToAllSubjects && resolvedMeetingSubjectId)
        ? (values.zoomLink || '').trim()
        : '';
      const storedSubjectDefaultZoomLink = resolvedMeetingSubjectId ? getSubjectDefaultZoomLink(resolvedMeetingSubjectId) : '';
      if (!applyMeetingToAllSubjects && resolvedMeetingSubjectId && nextSubjectDefaultZoomLink !== storedSubjectDefaultZoomLink) {
        const nextSubjectSchedules = (() => {
          const schedules = liveBatch?.subjectSchedules || [];
          let didUpdateExisting = false;
          const updatedSchedules = schedules.map((schedule) => {
            if (schedule.subjectId !== resolvedMeetingSubjectId) return schedule;
            didUpdateExisting = true;
            return {
              ...schedule,
              defaultZoomLink: nextSubjectDefaultZoomLink,
            };
          });
          if (didUpdateExisting) return updatedSchedules;
          return [
            ...updatedSchedules,
            {
              subjectId: resolvedMeetingSubjectId,
              daysOfWeek: [],
              startTime: '',
              endTime: '',
              defaultZoomLink: nextSubjectDefaultZoomLink,
            },
          ];
        })();

        await updateDocumentNonBlocking(doc(firestore, 'live_batches', batchId), {
          subjectSchedules: nextSubjectSchedules,
          updatedAt: new Date().toISOString(),
        });
      }

      const targets = applyMeetingToAllSubjects && batchSubjectIds.length > 0
        ? batchSubjectIds.map((id) => ({ id, name: subjectNameById[id] || '' }))
        : [{ id: values.subjectId || '', name: subjectNameById[values.subjectId || ''] || '' }];
      const commonZoomLink = (values.zoomLink || '').trim();
      const zoomMeetingId = (values.zoomMeetingId || '').trim();
      const zoomMeetingPassword = (values.zoomMeetingPassword || '').trim();
      const resolvedTargets = targets.map((target) => ({
        ...target,
        zoomLink:
          commonZoomLink
          || (
            !applyMeetingToAllSubjects && target.id === resolvedMeetingSubjectId
              ? nextSubjectDefaultZoomLink
              : getSubjectDefaultZoomLink(target.id)
          ),
      }));
      const missingZoomLinkTarget = resolvedTargets.find((target) => !target.zoomLink);
      if (missingZoomLinkTarget) {
        toast({
          variant: 'destructive',
          title: 'Missing class link',
          description: `Add a default class link for ${missingZoomLinkTarget.name || 'the selected subject'} or enter a Zoom link for this meeting.`,
        });
        return;
      }

      let updatedExistingMeetingCount = 0;
      const nowValue = new Date();
      for (const target of resolvedTargets) {
        const meetingPayload = {
          batchId,
          teacherId: user.uid,
          type: 'meeting',
          date: values.date,
          meetingTime: values.meetingTime,
          meetingEndTime: values.meetingEndTime,
          subjectId: target.id || null,
          subjectName: target.name || null,
          meetingTitle: values.meetingTitle,
          zoomMeetingId: zoomMeetingId || null,
          zoomMeetingPassword: zoomMeetingPassword || null,
          zoomLink: target.zoomLink,
          timingMode: 'manual_override',
          scheduleVersion: Math.max(0, Number(liveBatch?.scheduleVersion || 0)),
          updatedAt: serverTimestamp(),
        };

        const existingUpcomingMeeting = findUpcomingLiveBatchMeetingMatch(
          meetingSchedules,
          {
            date: values.date,
            subjectId: target.id || undefined,
            subjectName: target.name || undefined,
            meetingTitle: values.meetingTitle,
          },
          {
            now: nowValue,
            batch: liveBatch,
          },
        );

        if (existingUpcomingMeeting?.id) {
          updatedExistingMeetingCount += 1;
          await updateDocumentNonBlocking(doc(firestore, 'live_batch_sessions', existingUpcomingMeeting.id), meetingPayload);
          continue;
        }

        await addDocumentNonBlocking(collection(firestore, 'live_batch_sessions'), {
          ...meetingPayload,
          createdAt: serverTimestamp(),
        });
      }

      const batchTitle = liveBatch?.title || 'Your live batch';
      const subjectLabel =
        applyMeetingToAllSubjects && targets.length > 1
          ? 'all scheduled subjects'
          : (targets[0]?.name || 'selected subject');
      const isRescheduledMeeting = updatedExistingMeetingCount > 0;
      await sendStudentBatchNotification({
        title: isRescheduledMeeting ? 'Live Class Rescheduled' : 'Upcoming Live Class',
        message: `${batchTitle}: "${values.meetingTitle}" for ${subjectLabel} is now scheduled on ${values.date} from ${values.meetingTime} to ${values.meetingEndTime}.`,
        notificationType: 'live_batch_upcoming',
        eventDate: values.date,
        eventTime: values.meetingTime,
        eventEndTime: values.meetingEndTime,
      });

      toast({
        title: isRescheduledMeeting ? 'Meeting rescheduled' : 'Meeting scheduled',
        description: applyMeetingToAllSubjects && batchSubjectIds.length > 0
          ? `${isRescheduledMeeting ? 'Latest meeting time updated' : 'Meeting saved'} for all selected subjects on ${values.date} from ${values.meetingTime} to ${values.meetingEndTime}.`
          : `${isRescheduledMeeting ? 'Latest meeting time updated' : 'Meeting saved'} for ${values.date} from ${values.meetingTime} to ${values.meetingEndTime}.`,
      });
      meetingForm.reset({
        date: '',
        meetingTime: '',
        meetingEndTime: '',
        subjectId: values.subjectId || '',
        meetingTitle: getSuggestedMeetingTitle(applyMeetingToAllSubjects ? '' : (values.subjectId || '')),
        zoomMeetingId: '',
        zoomMeetingPassword: '',
        zoomLink: applyMeetingToAllSubjects ? '' : nextSubjectDefaultZoomLink,
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed', description: error?.message || 'Could not schedule meeting.' });
    } finally {
      setIsSavingMeeting(false);
    }
  }

  async function onSavePreviousSession(values: z.infer<typeof previousSessionSchema>) {
    if (!user || !batchId) return;
    const selectedSubjectId = (values.subjectId || '').trim();
    const resolvedSubjectId = selectedSubjectId || (((liveBatch?.subjectIds || []).length === 1) ? (liveBatch?.subjectIds?.[0] || '') : '');
    if ((liveBatch?.subjectIds || []).length > 1 && !selectedSubjectId) {
      toast({
        variant: 'destructive',
        title: 'Subject required',
        description: 'Select subject so students can view notes and lectures by subject.',
      });
      return;
    }
    const conductedDateOption = conductedPreviousSessionDateOptions.find((option) => (
      option.date === values.date
      && (!resolvedSubjectId || (option.subjectId || '').trim() === resolvedSubjectId)
    ));
    if (!conductedDateOption) {
      toast({
        variant: 'destructive',
        title: 'Pick a conducted session date',
        description: 'Previous sessions can be uploaded only for completed dates from this live batch schedule.',
      });
      return;
    }
    if (previousSessionNoteFile && !storage) {
      toast({
        variant: 'destructive',
        title: 'Storage unavailable',
        description: 'Could not upload class notes right now. Please retry.',
      });
      return;
    }
    setIsSavingPrevious(true);
    try {
      let notesPayload: {
        notesFileUrl?: string;
        notesFileName?: string;
        notesFileType?: string;
        notesFileSize?: number;
      } = {};

      if (previousSessionNoteFile) {
        const safeName = previousSessionNoteFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uploadRef = ref(storage!, `live_batch_session_notes/${user.uid}/${batchId}/${Date.now()}_${safeName}`);
        const uploaded = await uploadBytes(
          uploadRef,
          previousSessionNoteFile,
          previousSessionNoteFile.type ? { contentType: previousSessionNoteFile.type } : undefined
        );
        const notesFileUrl = await getDownloadURL(uploaded.ref);
        notesPayload = {
          notesFileUrl,
          notesFileName: previousSessionNoteFile.name,
          notesFileType: previousSessionNoteFile.type || undefined,
          notesFileSize: Number.isFinite(previousSessionNoteFile.size) ? previousSessionNoteFile.size : undefined,
        };
      }

      const matchedMeeting = matchedMeetingForPreviousSession;
      const matchedMeetingTitle = matchedMeeting?.meetingTitle?.trim() || '';
      const presetTiming = getPresetTimingForDate(values.date, resolvedSubjectId || undefined);
      const resolvedMeetingTime = (matchedMeeting?.meetingTime || conductedDateOption.meetingTime || presetTiming.startTime || '').trim();
      const resolvedMeetingEndTime = (
        matchedMeeting?.meetingEndTime
        || conductedDateOption.meetingEndTime
        || presetTiming.endTime
        || presetTiming.startTime
        || ''
      ).trim();
      const subjectLabel = resolvedSubjectId
        ? (subjectNameById[resolvedSubjectId] || resolvedSubjectId)
        : 'Class';
      const optionTitle = conductedDateOption.meetingTitle?.trim() || '';
      const sessionLabel = (values.sessionLabel || matchedMeetingTitle || optionTitle || `${subjectLabel} Live Session`).trim();
      const previousSessionPayload = {
        batchId,
        teacherId: user.uid,
        type: 'previous_session' as const,
        date: values.date,
        previousSessionUrl: values.previousSessionUrl,
        subjectId: resolvedSubjectId || null,
        subjectName: resolvedSubjectId ? (subjectNameById[resolvedSubjectId] || resolvedSubjectId) : null,
        sessionLabel,
        meetingTitle: sessionLabel,
        meetingTime: resolvedMeetingTime || null,
        meetingEndTime: resolvedMeetingEndTime || resolvedMeetingTime || null,
        ...notesPayload,
      };

      if (existingPreviousSessionForSelection?.id) {
        await updateDocumentNonBlocking(doc(firestore, 'live_batch_sessions', existingPreviousSessionForSelection.id), {
          ...previousSessionPayload,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDocumentNonBlocking(collection(firestore, 'live_batch_sessions'), {
          ...previousSessionPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      toast({
        title: existingPreviousSessionForSelection?.id ? 'Session updated' : previousSessionNoteFile ? 'Session saved' : 'URL saved',
        description: existingPreviousSessionForSelection?.id
          ? 'Previous session details updated successfully.'
          : previousSessionNoteFile
            ? 'Previous session URL and class notes added.'
            : 'Previous session URL added.',
      });
      previousSessionForm.reset({ date: '', previousSessionUrl: '', subjectId: selectedSubjectId || '', sessionLabel: '' });
      previousSessionSelectionRef.current = '';
      previousSessionAutoTitleRef.current = '';
      setPreviousSessionNoteFile(null);
      if (previousSessionNoteInputRef.current) previousSessionNoteInputRef.current.value = '';
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed', description: error?.message || 'Could not save previous session.' });
    } finally {
      setIsSavingPrevious(false);
    }
  }

  function onPreviousSessionNoteFileChange(file?: File | null) {
    if (!file) {
      setPreviousSessionNoteFile(null);
      return;
    }
    if (file.size > MAX_PREVIOUS_SESSION_NOTE_FILE_SIZE_BYTES) {
      setPreviousSessionNoteFile(null);
      if (previousSessionNoteInputRef.current) previousSessionNoteInputRef.current.value = '';
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Please upload a notes file smaller than 25MB.',
      });
      return;
    }
    setPreviousSessionNoteFile(file);
  }

  const openPurchaseAvailabilityDialog = (input: Omit<PurchaseAvailabilityDialogState, 'open'>) => {
    setPurchaseAvailabilityDialog({
      open: true,
      title: input.title,
      description: input.description,
    });
  };

  const buildPaidQuestionPurchaseDialogCopy = ({
    subjectLabel,
    topicLabel,
    sectionAvailability,
  }: {
    subjectLabel: string;
    topicLabel: string;
    sectionAvailability: ReturnType<typeof getPaidPurchaseAvailabilityForConfig>;
  }) => {
    if (sectionAvailability.hasStudentCoverageGap) {
      return {
        title: 'Buy paid questions for more students',
        description:
          liveBatchTokenStudentCount > 0
            ? `This batch currently has ${liveBatchTokenStudentCount} student token${liveBatchTokenStudentCount === 1 ? '' : 's'}. Your paid question purchase for ${subjectLabel}${topicLabel ? ` / ${topicLabel}` : ''} does not cover that many students at ${formatCoverageMomentLabel(sectionAvailability.referenceTime)}. Buy the same scope again for more students before the test goes live.`
            : `This paid question scope needs student coverage before you can use it in the live-batch test.`,
      };
    }

    if (sectionAvailability.hasExpiredMatchingPurchase) {
      return {
        title: 'Your paid question access has expired',
        description: `The paid question purchase for ${subjectLabel}${topicLabel ? ` / ${topicLabel}` : ''} will not stay active until ${formatCoverageMomentLabel(sectionAvailability.referenceTime)}. Renew the purchase before then to let this test go live.`,
      };
    }

    return {
      title: 'Buy paid questions for this scope',
      description: `No paid DCAM question purchase was found for ${subjectLabel}${topicLabel ? ` / ${topicLabel}` : ''} that stays active until ${formatCoverageMomentLabel(sectionAvailability.referenceTime)}. Purchase this scope first, then come back to schedule the paid test.`,
    };
  };

  async function onSubmit(values: z.infer<typeof formSchema>, saveAsDraft: boolean = false) {
    if (!user) return;
    if (isTeacher && allowedClassIds.length > 0 && !allowedClassIds.includes(values.classId)) {
      toast({ variant: 'destructive', title: 'Invalid Curriculum', description: 'You can only create tests for your assigned curricula.' });
      return;
    }
    const totalFreeQuestionCount = values.subjectConfigs.reduce(
      (sum, config) => sum + (config.questionAccessLevel === 'free' ? Math.max(0, Number(config.count || 0)) : 0),
      0
    );
    if (totalFreeQuestionCount > MAX_FREE_DCAM_BANK_QUESTIONS_PER_TEST) {
      toast({
        variant: 'destructive',
        title: 'Free question limit reached',
        description: `Free DCAM-bank tests can include up to ${MAX_FREE_DCAM_BANK_QUESTIONS_PER_TEST} questions in total.`,
      });
      return;
    }

    setIsSubmitting(true);

    const finalQuestionIds: string[] = [];
    const usedQuestionIds = new Set<string>();
    let selectionError = false;
    const prioritizedConfigs = [...values.subjectConfigs].sort((a, b) => {
      const specificity = (cfg: (typeof values.subjectConfigs)[number]) =>
        (cfg.topicId ? 1 : 0)
        + (getSubtopicSelectionKey(cfg.subtopicPaths, cfg.subtopic) ? 1 : 0)
        + (cfg.questionType === 'All' ? 0 : 1)
        + (cfg.difficultyLevel === 'All' ? 0 : 1);
      return specificity(b) - specificity(a);
    });

    for (const config of prioritizedConfigs) {
      const subjectLabel = config.subjectName || subjectNameById[config.subjectId] || config.subjectId;
      const topicLabel = config.topicId ? (topicNameById[config.topicId] || config.topicId) : 'All topics';
      const subtopicLabel = normalizeSubtopicPathSelections(config.subtopicPaths, config.subtopic).join(', ') || 'All subtopics';
      const subjectQuestions =
        config.questionAccessLevel === 'paid'
          ? getPaidPurchaseAvailabilityForConfig(
              config.subjectId,
              config.topicId,
              config.subtopicPaths,
              config.subtopic,
              config.questionType,
              config.difficultyLevel
            ).selectableRows
              .map((row) => row.question)
              .filter((question) => !usedQuestionIds.has(question.id))
          : getCandidateQuestionRowsForConfig(
              config.subjectId,
              config.topicId,
              config.subtopicPaths,
              config.subtopic,
              config.questionAccessLevel,
              config.questionType,
              config.difficultyLevel
            )
              .filter((row) => !usedQuestionIds.has(row.id))
              .slice(0, Math.max(0, MAX_FREE_DCAM_BANK_QUESTIONS_PER_TEST))
              .map((row) => row.question);

      if (config.questionAccessLevel === 'paid') {
        const paidAvailability = getPaidPurchaseAvailabilityForConfig(
          config.subjectId,
          config.topicId,
          config.subtopicPaths,
          config.subtopic,
          config.questionType,
          config.difficultyLevel
        );
        if (paidAvailability.selectableRows.length === 0) {
          openPurchaseAvailabilityDialog(
            buildPaidQuestionPurchaseDialogCopy({
              subjectLabel,
              topicLabel,
              sectionAvailability: paidAvailability,
            })
          );
          selectionError = true;
          break;
        }
      }
      if (subjectQuestions.length < config.count) {
        toast({
          variant: 'destructive',
          title: 'Not Enough Questions',
          description: `Subject "${subjectLabel}" / ${topicLabel} / ${subtopicLabel} (${config.questionAccessLevel}, ${config.questionType}, ${config.difficultyLevel}) has ${subjectQuestions.length} available questions, requested ${config.count}.`,
        });
        selectionError = true;
        break;
      }
      const shuffled = [...subjectQuestions].sort(() => 0.5 - Math.random());
      const selectedIds = shuffled.slice(0, config.count).map((q) => q.id);
      selectedIds.forEach((id) => usedQuestionIds.add(id));
      finalQuestionIds.push(...selectedIds);
    }

    if (selectionError || finalQuestionIds.length === 0) {
      setIsSubmitting(false);
      return;
    }

    if (!batchId || !liveBatch) {
      toast({
        variant: 'destructive',
        title: 'Missing Live Batch',
        description: 'Could not detect the live batch for this schedule page.',
      });
      setIsSubmitting(false);
      return;
    }

    const liveBatchAccessLevel = liveBatch.accessLevel || 'free';
    const shouldSaveAsDraft = saveAsDraft;
    const isLiveBatchSubscriptionAttached = true;
    const durationMinutes = getScheduledTestDurationMinutes(values.scheduledTime, values.scheduledEndTime);
    if (values.availabilityMode === 'single_day' && durationMinutes === null) {
      toast({
        variant: 'destructive',
        title: 'Invalid test timing',
        description: 'For a single-day test, choose both test start and test end and keep the end later than the start.',
      });
      setIsSubmitting(false);
      return;
    }
    const scheduledStartAt = new Date(
      values.availabilityMode === 'single_day'
        ? `${values.scheduledDate}T${values.scheduledTime}:00`
        : `${values.scheduledDate}T00:00:00`
    );
    const attemptLimit: AttemptLimitConfig = {
      mode: values.attemptLimitMode,
      maxTotalAttempts: values.attemptLimitMode === 'total' ? Number(values.maxTotalAttempts) : null,
      maxAttemptsPerInterval: values.attemptLimitMode === 'interval' ? Number(values.maxAttemptsPerInterval) : null,
      intervalValue: values.attemptLimitMode === 'interval' ? Number(values.attemptIntervalValue) : null,
      intervalUnit: values.attemptLimitMode === 'interval' ? values.attemptIntervalUnit : null,
    };

    try {
      const testRef = doc(collection(firestore, 'mock_tests'));
      await setDocumentNonBlocking(testRef, {
        id: testRef.id,
        teacherId: user.uid,
        title: values.title,
        accessLevel: liveBatchAccessLevel,
        questionSource: 'student_plus_official',
        publicationStatus: shouldSaveAsDraft ? 'draft' : 'published',
        subscriptionAttached: isLiveBatchSubscriptionAttached,
        startTime: scheduledStartAt,
        availabilityMode: values.availabilityMode,
        examTypeId: values.examTypeId,
        classId: values.classId,
        isCourseOnly: false,
        isLiveBatchTest: true,
        liveBatchId: batchId,
        teacherPremiumQuestionMinimumStudentsRequired: Math.max(1, liveBatchTokenStudentCount),
        teacherPremiumQuestionCoverageCheckAt: scheduledTeacherQuestionCoveragePreviewAt
          ? scheduledTeacherQuestionCoveragePreviewAt.toISOString()
          : null,
        teacherPremiumQuestionCoverageValidatedAt: new Date().toISOString(),
        scheduledDate: values.scheduledDate,
        ...(values.availabilityMode === 'single_day' && values.scheduledTime ? { scheduledTime: values.scheduledTime } : {}),
        ...(values.availabilityMode === 'single_day' && values.scheduledEndTime ? { scheduledEndTime: values.scheduledEndTime } : {}),
        attemptLimit,
          config: {
            questionIds: finalQuestionIds,
            ...(values.availabilityMode === 'single_day' && durationMinutes !== null ? { duration: durationMinutes } : {}),
            totalQuestions: totalRequestedQuestions,
            marksPerQuestion: values.marksPerQuestion,
            negativeMarksPerQuestion: values.negativeMarksPerQuestion,
            totalMarks,
            subjectConfigs: values.subjectConfigs.map(({ subjectId, topicId, subtopic, subtopicPaths, questionAccessLevel, questionType, difficultyLevel, count }) => ({
              subjectId,
              topicId: topicId || '',
              subtopic: subtopic || '',
              subtopicPaths: normalizeSubtopicPathSelections(subtopicPaths, subtopic),
              questionAccessLevel,
              questionType,
              difficultyLevel,
              numQuestions: count,
            })),
          },
          createdAt: serverTimestamp(),
        }, { merge: true });

      if (!shouldSaveAsDraft) {
        const batchTitle = liveBatch?.title || 'Your live batch';
        const timingSummary = buildScheduledTestSummary(values);
        await sendStudentBatchNotification({
          title: 'Live Batch Test Scheduled',
          message: `${batchTitle}: "${values.title}" ${timingSummary}.`,
          notificationType: 'live_batch_test_scheduled',
          href: `/mock-tests/${testRef.id}`,
          eventDate: values.scheduledDate,
          eventTime: values.availabilityMode === 'single_day' ? values.scheduledTime : undefined,
          eventEndTime: values.availabilityMode === 'single_day' ? values.scheduledEndTime || undefined : undefined,
        });
      }

      toast({
        title: shouldSaveAsDraft ? 'Test Saved as Draft' : 'Live-Batch Test Scheduled',
        description: shouldSaveAsDraft
          ? `${values.title} is saved as draft.`
          : `${values.title} ${buildScheduledTestSummary(values)}.`,
      });
      router.push(`/live-batches/schedule/${batchId}`);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLoading =
    areClassesLoading
    || areSubjectsLoading
    || areTopicsLoading
    || areQuestionsLoading
    || areExamTypesLoading
    || isLiveBatchLoading
    || areSessionsLoading
    || areScheduledTestsLoading
    || areTeacherQuestionPurchasesLoading
    || areBatchEnrollmentsLoading
    || isDcamQuestionBankOwnerLoading;
  const contentUnlockLeadLabel = formatContentUnlockLeadLabel(contentUnlockLeadMinutes);
  const contentUnlockRuleText = getContentUnlockRuleText(contentUnlockLeadMinutes);
  const scheduleInputClass = 'h-11 rounded-xl border-white/10 bg-background/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';
  const scheduleSelectClass = 'h-11 rounded-xl border-white/10 bg-background/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';
  const sectionBuilderInputClass = scheduleInputClass;
  const sectionBuilderSelectClass = scheduleSelectClass;
  const activeModuleCard = scheduleModuleCards.find((card) => card.id === activeModule) || scheduleModuleCards[0];
  const previousSessionFileSizeLabel = previousSessionNoteFile
    ? `${(previousSessionNoteFile.size / (1024 * 1024)).toFixed(2)} MB`
    : null;

  if (!isLoading && (!isTeacher || !liveBatch || liveBatch.teacherId !== user?.uid)) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Schedule Content" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card>
            <CardContent className="p-6 text-muted-foreground">This page is available only for the owner teacher of this live batch.</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Schedule Content" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <Card className="overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.12),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(15,23,42,0.72))] shadow-[0_40px_140px_-72px_rgba(56,189,248,0.45)]">
            <CardHeader className="gap-6 border-b border-white/10 pb-6">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-4">
                  <Badge variant="outline" className="w-fit rounded-full border-primary/35 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                    Live batch schedule
                  </Badge>
                  <div className="space-y-2">
                    <CardTitle className="font-headline text-3xl">Schedule Content</CardTitle>
                    <CardDescription className="max-w-2xl text-base text-muted-foreground/90">
                      Manage meetings, replays, and tests for this batch.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full border-white/10 bg-background/40 px-3 py-1 text-xs">
                      {liveBatch?.title || 'Live batch'}
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-white/10 bg-background/40 px-3 py-1 text-xs uppercase">
                      {(liveBatch?.accessLevel || 'free')} access
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full border-cyan-300/25 bg-cyan-500/10 px-4 text-cyan-50 hover:bg-cyan-500/15"
                      onClick={() => router.push(`/live-batches/${batchId}/classroom`)}
                    >
                      <Video className="mr-2 h-4 w-4" />
                      Enter Classroom
                    </Button>
                  </div>
                </div>
                  <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[480px]">
                    <div className="rounded-2xl border border-white/10 bg-background/45 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Modules</p>
                      <p className="mt-1 text-2xl font-semibold">{scheduleModuleCards.length}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Meeting, replay, and test.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-background/45 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Student visibility</p>
                      <p className="mt-1 text-2xl font-semibold">{contentUnlockLeadLabel}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {contentUnlockLeadMinutes === 0 ? 'Visible at start time.' : 'Visible before start time.'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-background/45 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Notices</p>
                      <p className="mt-1 text-2xl font-semibold">{holidayOrCancelled.length}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Holiday and cancellation updates.</p>
                    </div>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                    {scheduleModuleCards.map(({ id, label, description, helper, icon: Icon, accentClass, iconClass }) => {
                      const isActive = activeModule === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setActiveModule(id)}
                          className={cn(
                            'group relative overflow-hidden rounded-3xl border p-5 text-left transition-all',
                            isActive
                              ? 'border-primary/40 bg-background/70 shadow-[0_24px_70px_-40px_rgba(59,130,246,0.9)]'
                              : 'border-white/10 bg-background/40 hover:border-primary/20 hover:bg-background/55'
                          )}
                        >
                          <div className={cn('absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300', accentClass, isActive && 'opacity-100')} />
                          <div className="relative flex h-full flex-col gap-4">
                            <div className="flex items-start justify-between gap-3">
                              <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl border', isActive ? iconClass : 'border-white/10 bg-background/60 text-muted-foreground')}>
                                <Icon className="h-5 w-5" />
                              </span>
                              <span className={cn(
                                'rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
                                isActive ? 'border-primary/35 bg-primary/10 text-primary' : 'border-white/10 text-muted-foreground'
                              )}>
                                {isActive ? 'Current' : helper}
                              </span>
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-semibold">{label}</p>
                              <p className="text-sm text-muted-foreground">{description}</p>
                            </div>
                            <div className={cn(
                              'mt-auto inline-flex items-center gap-2 text-xs font-medium',
                              isActive ? 'text-primary' : 'text-muted-foreground'
                            )}>
                              <span>{isActive ? 'Current' : 'Open'}</span>
                              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-background/40 p-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="space-y-3">
                      <Badge variant="outline" className="w-fit rounded-full border-white/10 bg-background/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Current module
                      </Badge>
                      <div className="space-y-1">
                        <p className="text-lg font-semibold">{activeModuleCard.label}</p>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                          All changes below apply to this batch only.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-amber-400/30 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(245,158,11,0.05))] p-4 text-sm xl:max-w-xl">
                      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
                        <div>
                          <p className="inline-flex items-center gap-2 font-medium text-amber-200">
                            <ShieldCheck className="h-4 w-4" />
                            Student visibility
                          </p>
                          <p className="mt-2 text-amber-100/90">
                            {contentUnlockRuleText}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-background/30 p-3 xl:min-w-[260px]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100/80">Reveal before start</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Input
                              className="h-10 w-28 rounded-xl border-white/10 bg-background/65"
                              type="number"
                              min="0"
                              max={String(MAX_CONTENT_UNLOCK_LEAD_MINUTES)}
                              value={unlockLeadMinutesDraft}
                              onChange={(event) => setUnlockLeadMinutesDraft(event.target.value)}
                            />
                            <span className="text-xs text-amber-100/80">minutes</span>
                            <Button
                              type="button"
                              size="sm"
                              className="h-10 rounded-xl px-4"
                              onClick={saveContentUnlockLeadTime}
                              disabled={isSavingUnlockLeadTime}
                            >
                              {isSavingUnlockLeadTime ? 'Saving...' : 'Save'}
                            </Button>
                          </div>
                          <p className="mt-2 text-xs text-amber-100/70">Use `0` to reveal at start time.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-background/40 p-5 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.95)]">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                      <div className="space-y-2">
                        <Badge variant="outline" className="w-fit rounded-full border-white/10 bg-background/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Quick notices
                        </Badge>
                        <div className="space-y-1">
                          <h3 className="text-xl font-semibold">Holiday and cancellation notices</h3>
                          <p className="max-w-2xl text-sm text-muted-foreground">
                            Mark a holiday or cancel a class without changing the rest of the schedule.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-background/45 px-4 py-3 text-sm text-muted-foreground">
                        <Megaphone className="h-4 w-4 text-primary" />
                        <span>{holidayOrCancelled.length} recent notice{holidayOrCancelled.length === 1 ? '' : 's'}</span>
                      </div>
                    </div>

                    <div className="mt-5 space-y-4">
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setActiveNoticePanel((current) => (current === 'holiday' ? null : 'holiday'))}
                          className={cn(
                            'rounded-3xl border p-5 text-left transition-all',
                            activeNoticePanel === 'holiday'
                              ? 'border-emerald-400/30 bg-[linear-gradient(180deg,rgba(16,185,129,0.18),rgba(15,23,42,0.24))]'
                              : 'border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(15,23,42,0.14))] hover:border-emerald-400/25'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-lg font-semibold">Declare Holiday</p>
                              <p className="text-sm text-muted-foreground">
                                Block one date or a date range.
                              </p>
                            </div>
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/15 text-emerald-100">
                              <CalendarDays className="h-5 w-5" />
                            </span>
                          </div>
                          <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-100">
                            <span>{activeNoticePanel === 'holiday' ? 'Hide holiday form' : 'Open holiday form'}</span>
                            {activeNoticePanel === 'holiday' ? <X className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveNoticePanel((current) => (current === 'cancel' ? null : 'cancel'))}
                          className={cn(
                            'rounded-3xl border p-5 text-left transition-all',
                            activeNoticePanel === 'cancel'
                              ? 'border-rose-400/30 bg-[linear-gradient(180deg,rgba(244,63,94,0.18),rgba(15,23,42,0.24))]'
                              : 'border-rose-400/15 bg-[linear-gradient(180deg,rgba(244,63,94,0.08),rgba(15,23,42,0.14))] hover:border-rose-400/25'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-lg font-semibold">Cancel Scheduled Session</p>
                              <p className="text-sm text-muted-foreground">
                                Cancel an upcoming class or reverse a conducted one.
                              </p>
                            </div>
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-500/15 text-rose-100">
                              <AlertTriangle className="h-5 w-5" />
                            </span>
                          </div>
                          <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-rose-100">
                            <span>{activeNoticePanel === 'cancel' ? 'Hide cancellation form' : 'Open cancellation form'}</span>
                            {activeNoticePanel === 'cancel' ? <X className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                          </div>
                        </button>
                      </div>

                      {activeNoticePanel === 'holiday' ? (
                        <div className="rounded-3xl border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(15,23,42,0.2))] p-5 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-lg font-semibold">Declare Holiday</p>
                              <p className="text-sm text-muted-foreground">
                                Choose the session or date range to block.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
                              onClick={() => setActiveNoticePanel(null)}
                            >
                              <X className="h-4 w-4" />
                              <span className="sr-only">Close holiday form</span>
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Apply holiday to</label>
                            <RadioGroup
                              value={holidayTargetPeriod}
                              onValueChange={(value) => setHolidayTargetPeriod(value as NoticeTargetPeriod)}
                              className="grid gap-3 md:grid-cols-2"
                            >
                              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-background/40 px-4 py-3">
                                <RadioGroupItem value="upcoming" id="holiday-target-upcoming" />
                                <span className="text-sm font-medium">Upcoming session or date range</span>
                              </label>
                              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-background/40 px-4 py-3">
                                <RadioGroupItem value="previous" id="holiday-target-previous" />
                                <span className="text-sm font-medium">Previous conducted session</span>
                              </label>
                            </RadioGroup>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">
                              {holidayTargetPeriod === 'previous' ? 'Previous Conducted Session' : 'Upcoming Scheduled Class (optional)'}
                            </label>
                            <Select value={holidaySessionId} onValueChange={setHolidaySessionId}>
                              <SelectTrigger className={scheduleSelectClass}>
                                <SelectValue
                                  placeholder={
                                    holidayTargetPeriod === 'previous'
                                      ? 'Choose the conducted class to mark as holiday'
                                      : 'Choose an upcoming class to auto-fill the holiday date'
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {(holidayTargetPeriod === 'previous' ? previousNoticeTargetOptions : upcomingNoticeTargetOptions).map((meeting) => (
                                  <SelectItem key={`${holidayTargetPeriod}-${meeting.id}`} value={meeting.id}>
                                    {`${meeting.date || 'Date TBA'} ${meeting.meetingTime || ''}${meeting.subjectName ? ` • ${meeting.subjectName}` : ''}${meeting.title ? ` • ${meeting.title}` : ''}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {holidayTargetPeriod === 'previous' ? (
                              previousNoticeTargetOptions.length === 0 ? (
                                <p className="text-xs text-amber-200">No previous conducted class is available right now.</p>
                              ) : (
                                <p className="text-xs text-emerald-100/85">
                                  If that class has replay details uploaded, they will be removed and student credits will reflect automatically.
                                </p>
                              )
                            ) : upcomingNoticeTargetOptions.length === 0 ? (
                              <p className="text-xs text-amber-200">No upcoming class is scheduled right now. You can still declare a custom date-range holiday below.</p>
                            ) : (
                              <p className="text-xs text-emerald-100/85">Choose a class to auto-fill the holiday date, or leave it blank to block a custom date range.</p>
                            )}
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Start Date</label>
                              <Input
                                className={scheduleInputClass}
                                type="date"
                                min={batchStartDateMin}
                                value={holidayDate}
                                readOnly={Boolean(selectedHolidayTarget) || holidayTargetPeriod === 'previous'}
                                onChange={(e) => setHolidayDate(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">End Date</label>
                              <Input
                                className={scheduleInputClass}
                                type="date"
                                min={holidayDate || batchStartDateMin}
                                value={holidayEndDate}
                                readOnly={Boolean(selectedHolidayTarget) || holidayTargetPeriod === 'previous'}
                                onChange={(e) => setHolidayEndDate(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Reason (optional)</label>
                              <Input className={scheduleInputClass} value={holidayReason} onChange={(e) => setHolidayReason(e.target.value)} placeholder="Festival / emergency / break..." />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 rounded-xl border-emerald-400/20 bg-emerald-500/15 px-5 text-emerald-50 hover:bg-emerald-500/20"
                            onClick={declareHoliday}
                            disabled={isSavingHoliday || (holidayTargetPeriod === 'previous' && !holidaySessionId)}
                          >
                            {isSavingHoliday
                              ? 'Saving...'
                              : selectedHolidayTarget
                                ? `Declare Holiday (${selectedHolidayTarget.date})`
                                : `Declare Holiday${holidayDate ? ` (${formatYmdRange(holidayDate, holidayEndDate || holidayDate)})` : ''}`}
                          </Button>
                        </div>
                      ) : null}

                      {activeNoticePanel === 'cancel' ? (
                        <div className="rounded-3xl border border-rose-400/20 bg-[linear-gradient(180deg,rgba(244,63,94,0.16),rgba(15,23,42,0.2))] p-5 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-lg font-semibold">Cancel Scheduled Session</p>
                              <p className="text-sm text-muted-foreground">
                                Choose the class you want to cancel.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"
                              onClick={() => setActiveNoticePanel(null)}
                            >
                              <X className="h-4 w-4" />
                              <span className="sr-only">Close cancellation form</span>
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Cancel from</label>
                            <RadioGroup
                              value={cancelTargetPeriod}
                              onValueChange={(value) => setCancelTargetPeriod(value as NoticeTargetPeriod)}
                              className="grid gap-3 md:grid-cols-2"
                            >
                              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-background/40 px-4 py-3">
                                <RadioGroupItem value="upcoming" id="cancel-target-upcoming" />
                                <span className="text-sm font-medium">Upcoming scheduled class</span>
                              </label>
                              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-background/40 px-4 py-3">
                                <RadioGroupItem value="previous" id="cancel-target-previous" />
                                <span className="text-sm font-medium">Previous conducted session</span>
                              </label>
                            </RadioGroup>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">
                              {cancelTargetPeriod === 'previous' ? 'Previous Conducted Session' : 'Upcoming Scheduled Class'}
                            </label>
                            <Select value={cancelSessionId} onValueChange={setCancelSessionId}>
                              <SelectTrigger className={scheduleSelectClass}>
                                <SelectValue
                                  placeholder={
                                    cancelTargetPeriod === 'previous'
                                      ? 'Choose the conducted class to cancel'
                                      : 'Choose the live class to cancel'
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {(cancelTargetPeriod === 'previous' ? previousNoticeTargetOptions : upcomingNoticeTargetOptions).map((meeting) => (
                                  <SelectItem key={`${cancelTargetPeriod}-${meeting.id}`} value={meeting.id}>
                                    {`${meeting.date || 'Date TBA'} ${meeting.meetingTime || ''}${meeting.subjectName ? ` • ${meeting.subjectName}` : ''}${meeting.meetingTitle ? ` • ${meeting.meetingTitle}` : ''}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {cancelTargetPeriod === 'previous' ? (
                              previousNoticeTargetOptions.length === 0 ? (
                                <p className="text-xs text-amber-200">No previous conducted class is available to cancel right now.</p>
                              ) : (
                                <p className="text-xs text-rose-100/85">
                                  If replay details were uploaded for this class, they will be removed and the student credit balance will reflect automatically.
                                </p>
                              )
                            ) : upcomingNoticeTargetOptions.length === 0 ? (
                              <p className="text-xs text-amber-200">No upcoming scheduled live class is available to cancel right now.</p>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Date</label>
                              <Input className={scheduleInputClass} readOnly value={cancelDate} placeholder="Auto-filled from selected class" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">Session Label</label>
                              <Input className={scheduleInputClass} readOnly value={cancelLabel} placeholder="Auto-filled from selected class" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">Reason (optional)</label>
                            <Input className={scheduleInputClass} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Teacher unavailable / technical issue..." />
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            className="h-11 rounded-xl px-5"
                            onClick={cancelSession}
                            disabled={isSavingCancel || !cancelSessionId}
                          >
                            {isSavingCancel ? 'Saving...' : cancelTargetPeriod === 'previous' ? 'Cancel Previous Session' : 'Cancel Session'}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {holidayOrCancelled.length > 0 ? (
                      <div className="mt-5 rounded-3xl border border-white/10 bg-background/45 p-4">
                        <p className="mb-3 text-sm font-medium">Recent notices</p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {holidayOrCancelled.slice(0, 8).map((item) => (
                            <div key={item.id} className="rounded-2xl border border-white/10 bg-background/55 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'rounded-full text-[11px]',
                                    item.type === 'holiday'
                                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                                      : 'border-rose-400/30 bg-rose-500/10 text-rose-100'
                                  )}
                                >
                                  {item.type === 'holiday' ? 'Holiday' : 'Cancelled'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {item.type === 'holiday'
                                    ? formatYmdRange(item.date, item.holidayEndDate || item.date)
                                    : item.date || 'N/A'}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {item.type === 'holiday'
                                  ? item.reason || 'Holiday notice saved.'
                                  : item.sessionLabel || item.reason || 'Cancellation notice saved.'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {activeModule === 'meeting' ? (
                    <Form {...meetingForm}>
                      <form onSubmit={meetingForm.handleSubmit(onSaveMeeting)} className="space-y-4 rounded-3xl border border-white/10 bg-background/40 p-5 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.95)]">
                        <div className="space-y-1">
                          <Badge variant="outline" className="w-fit rounded-full border-white/10 bg-background/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Meeting
                          </Badge>
                          <h3 className="text-xl font-semibold">Schedule Meeting</h3>
                        </div>
                        <UpcomingSessionSlotBrowser
                          title="Next week slots"
                          description="Pick a slot to fill date and time quickly."
                          groups={upcomingSessionSlotGroups}
                          emptyDescription="No subject-day timing is available in the next 7 days. Add days and timings in batch setup to see slots."
                          activeSubjectId={applyMeetingToAllSubjects ? undefined : selectedMeetingSubjectId}
                          onUseForMeeting={applySlotToMeetingForm}
                          onUseForTest={applySlotToTestForm}
                          isMeetingSlotSelected={(slot) =>
                            !slot.noticeType
                            && slot.date === selectedMeetingDate
                            && slot.startTime === selectedMeetingTime
                            && (
                              applyMeetingToAllSubjects
                              || !selectedMeetingSubjectId
                              || slot.subjectId === selectedMeetingSubjectId
                            )
                          }
                          isTestSlotSelected={(slot) =>
                            !slot.noticeType
                            && slot.date === selectedTestDate
                            && slot.startTime === selectedTestTime
                          }
                        />
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <FormField control={meetingForm.control} name="date" render={({ field }) => (
                            <FormItem><FormLabel>Date</FormLabel><FormControl><Input className={scheduleInputClass} type="date" min={batchStartDateMin} {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={meetingForm.control} name="meetingTime" render={({ field }) => (
                            <FormItem><FormLabel>Scheduled Time</FormLabel><FormControl><Input className={scheduleInputClass} type="time" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={meetingForm.control} name="meetingEndTime" render={({ field }) => (
                            <FormItem><FormLabel>Session End Time</FormLabel><FormControl><Input className={scheduleInputClass} type="time" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          {(liveBatch?.subjectIds || []).length > 0 ? (
                            <FormField control={meetingForm.control} name="subjectId" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Subject</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ''} disabled={applyMeetingToAllSubjects}>
                                  <FormControl><SelectTrigger className={scheduleSelectClass}><SelectValue placeholder="Select subject" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    {(liveBatch?.subjectIds || []).map((subjectId) => (
                                      <SelectItem key={subjectId} value={subjectId}>
                                        {subjectNameById[subjectId] || subjectId}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                          ) : null}
                          <FormField control={meetingForm.control} name="meetingTitle" render={({ field }) => (
                            <FormItem><FormLabel>Meeting Title</FormLabel><FormControl><Input className={scheduleInputClass} {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={meetingForm.control} name="zoomMeetingId" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Zoom Meeting ID (optional)</FormLabel>
                              <FormControl><Input className={scheduleInputClass} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={meetingForm.control} name="zoomMeetingPassword" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Zoom Password (optional)</FormLabel>
                              <FormControl><Input className={scheduleInputClass} {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Start and end time are auto-filled from the selected slot. You can still edit them.
                        </p>
                        <FormField control={meetingForm.control} name="zoomLink" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Zoom Link</FormLabel>
                            <FormControl><Input className={scheduleInputClass} placeholder="https://zoom.us/j/..." {...field} /></FormControl>
                            <FormDescription>
                              {applyMeetingToAllSubjects
                                ? 'Leave blank to use each subject\'s saved link, or enter one link for all subjects.'
                                : resolvedMeetingSubjectId
                                  ? 'Prefilled from the selected subject link. Edit it if needed.'
                                  : 'Enter the meeting link here.'}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        {(liveBatch?.subjectIds || []).length > 1 ? (
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={applyMeetingToAllSubjects}
                              onChange={(e) => setApplyMeetingToAllSubjects(e.target.checked)}
                            />
                            Apply this meeting schedule to all selected subjects
                          </label>
                        ) : null}
                        <Button type="submit" className="h-11 rounded-xl px-5" disabled={isSavingMeeting}>
                          {isSavingMeeting ? (<><LoaderCircle className="mr-2 animate-spin" /> Saving...</>) : 'Save or Update Meeting'}
                        </Button>

                        <div className="rounded-3xl border border-white/10 bg-background/35 p-4 space-y-3">
                          <p className="text-sm font-medium">Upcoming Scheduled Meetings (Editable)</p>
                          {upcomingMeetingSchedules.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No upcoming meetings scheduled yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {upcomingMeetingSchedules.map((meeting) => (
                                <div key={meeting.id} className="rounded-2xl border border-white/10 bg-background/55 p-3">
                                  <div className="grid grid-cols-1 gap-2 md:grid-cols-5 items-end">
                                    <FormItem>
                                      <FormLabel>Date</FormLabel>
                                      <FormControl>
                                        <Input
                                          className={scheduleInputClass}
                                          type="date"
                                          min={batchStartDateMin}
                                          value={meetingDrafts[meeting.id]?.date || ''}
                                          onChange={(e) => setMeetingDrafts((prev) => ({ ...prev, [meeting.id]: { ...createEmptyMeetingDraft(), ...(prev[meeting.id] || {}), date: e.target.value } }))}
                                        />
                                      </FormControl>
                                    </FormItem>
                                    <FormItem>
                                      <FormLabel>Start Time</FormLabel>
                                      <FormControl>
                                        <Input
                                          className={scheduleInputClass}
                                          type="time"
                                          value={meetingDrafts[meeting.id]?.meetingTime || ''}
                                          onChange={(e) => setMeetingDrafts((prev) => ({ ...prev, [meeting.id]: { ...createEmptyMeetingDraft(), ...(prev[meeting.id] || {}), meetingTime: e.target.value } }))}
                                        />
                                      </FormControl>
                                    </FormItem>
                                    <FormItem>
                                      <FormLabel>End Time</FormLabel>
                                      <FormControl>
                                        <Input
                                          className={scheduleInputClass}
                                          type="time"
                                          value={meetingDrafts[meeting.id]?.meetingEndTime || ''}
                                          onChange={(e) => setMeetingDrafts((prev) => ({ ...prev, [meeting.id]: { ...createEmptyMeetingDraft(), ...(prev[meeting.id] || {}), meetingEndTime: e.target.value } }))}
                                        />
                                      </FormControl>
                                    </FormItem>
                                    <p className="text-xs text-muted-foreground md:col-span-1">
                                      {meeting.meetingTitle || 'Meeting'}
                                      {meeting.subjectName ? ` (${meeting.subjectName})` : ''}
                                    </p>
                                    <Button type="button" variant="outline" className="h-11 rounded-xl border-white/15 bg-background/60 px-5 hover:bg-background/75" onClick={() => saveMeetingScheduleTime(meeting.id)} disabled={savingMeetingId === meeting.id}>
                                      <Save className="mr-2 h-3.5 w-3.5" />
                                      {savingMeetingId === meeting.id ? 'Saving...' : 'Update Time'}
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </form>
                    </Form>
                  ) : null}

                  {activeModule === 'previous' ? (
                    <Form {...previousSessionForm}>
                      <form onSubmit={previousSessionForm.handleSubmit(onSavePreviousSession)} className="grid gap-4 xl:grid-cols-[0.95fr_1.45fr]">
                        <div className="rounded-3xl border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.18),rgba(15,23,42,0.32))] p-5">
                          <Badge variant="outline" className="rounded-full border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                            Replay
                          </Badge>
                          <h3 className="mt-4 text-2xl font-semibold">Upload Previous Session</h3>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Add the replay link and optional notes for one completed class.
                          </p>

                          <div className="mt-6 rounded-2xl border border-white/10 bg-background/40 p-4">
                            <p className="text-sm font-medium">Quick reminder</p>
                            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                              <li>Use one replay link and one optional file.</li>
                              <li>Any file up to 25 MB is allowed.</li>
                              <li>Saving the same class again updates the existing archive.</li>
                            </ul>
                          </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-background/45 p-5 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.95)]">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1">
                              <p className="text-lg font-semibold">Session details</p>
                              <p className="text-sm text-muted-foreground">Select the class, add the replay link, then attach notes if needed.</p>
                            </div>
                            <Badge variant="outline" className="w-fit rounded-full border-white/10 bg-background/45 px-3 py-1 text-xs">
                              {existingPreviousSessionForSelection?.id
                                ? 'Updating existing archive'
                                : previousSessionNoteFile
                                  ? '1 file attached'
                                  : 'Link only is allowed'}
                            </Badge>
                          </div>

                          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField control={previousSessionForm.control} name="date" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Date</FormLabel>
                                <FormControl>
                                  <ConductedSessionDatePicker
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={previousSessionDatePickerOptions}
                                    placeholder="Select conducted class date"
                                    disabled={previousSessionDatePickerOptions.length === 0}
                                    className={scheduleInputClass}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Only completed dates from this batch schedule can be selected.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={previousSessionForm.control} name="previousSessionUrl" render={({ field }) => (
                              <FormItem><FormLabel>Replay Link</FormLabel><FormControl><Input className={scheduleInputClass} placeholder="https://youtube.com/..." {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            {(liveBatch?.subjectIds || []).length > 0 ? (
                              <FormField
                                control={previousSessionForm.control}
                                name="subjectId"
                                render={({ field }) => (
                                  <FormItem className="md:col-span-2">
                                    <FormLabel>Subject</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                      <FormControl>
                                        <SelectTrigger className={scheduleSelectClass}>
                                          <SelectValue placeholder={(liveBatch?.subjectIds || []).length > 1 ? 'Select subject' : 'Subject'} />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {(liveBatch?.subjectIds || []).map((subjectId) => (
                                          <SelectItem key={subjectId} value={subjectId}>
                                            {subjectNameById[subjectId] || subjectId}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            ) : null}
                            <FormField
                              control={previousSessionForm.control}
                              name="sessionLabel"
                              render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                  <FormLabel>Session Title</FormLabel>
                                  <FormControl>
                                    <Input className={scheduleInputClass} placeholder="Auto-filled from the conducted class title" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="mt-4 rounded-2xl border border-white/10 bg-background/35 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Matched conducted class</p>
                              {existingPreviousSessionForSelection?.id ? (
                                <Badge variant="outline" className="border-emerald-400/25 bg-emerald-500/10 text-emerald-100">
                                  Existing archive found
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm font-medium">{previousSessionAutoTitle || 'Select date and subject to resolve the classroom title.'}</p>
                            {resolvedPreviousSessionTiming.startTime ? (
                              <p className="mt-1 text-xs text-emerald-100/85">
                                Session window: {resolvedPreviousSessionTiming.startTime}
                                {resolvedPreviousSessionTiming.endTime ? ` to ${resolvedPreviousSessionTiming.endTime}` : ''}
                              </p>
                            ) : null}
                            <p className="mt-1 text-xs text-muted-foreground">
                              Re-saving the same class updates the existing archive.
                            </p>
                          </div>

                          <div className="mt-5 rounded-3xl border border-dashed border-white/15 bg-background/35 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold">Notes file (optional)</p>
                                <p className="text-sm text-muted-foreground">Upload one file for this session.</p>
                              </div>
                              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-background/55 text-primary">
                                <Upload className="h-5 w-5" />
                              </span>
                            </div>
                            <FormItem className="mt-4">
                              <FormControl>
                                <Input
                                  ref={previousSessionNoteInputRef}
                                  className="h-14 cursor-pointer rounded-2xl border-dashed border-white/15 bg-background/60 file:mr-4 file:rounded-full file:border-0 file:bg-primary/15 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                                  type="file"
                                  accept="*/*"
                                  onChange={(event) => onPreviousSessionNoteFileChange(event.target.files?.[0] || null)}
                                />
                              </FormControl>
                              <FormDescription>Any file up to 25 MB.</FormDescription>
                            </FormItem>

                            {previousSessionNoteFile ? (
                              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-background/55 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <p className="flex items-center gap-2 text-sm font-medium">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <span className="truncate">{previousSessionNoteFile.name}</span>
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">{previousSessionFileSizeLabel}</p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 rounded-full border-white/15 bg-background/60 px-4"
                                  onClick={() => {
                                    setPreviousSessionNoteFile(null);
                                    if (previousSessionNoteInputRef.current) previousSessionNoteInputRef.current.value = '';
                                  }}
                                >
                                  Remove file
                                </Button>
                              </div>
                            ) : existingPreviousSessionForSelection?.notesFileName ? (
                              <p className="mt-4 text-xs text-muted-foreground">
                                Existing notes file: {existingPreviousSessionForSelection.notesFileName}. Upload a new file only if you want to replace it.
                              </p>
                            ) : (
                              <p className="mt-4 text-xs text-muted-foreground">No file selected. You can still save just the previous-session link.</p>
                            )}
                          </div>

                          <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-white/10 bg-background/35 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">Ready to publish the replay entry?</p>
                              <p className="text-sm text-muted-foreground">Students will be able to use this link as part of the batch learning history.</p>
                            </div>
                            <Button type="submit" className="h-11 rounded-xl px-5" disabled={isSavingPrevious}>
                              {isSavingPrevious ? (<><LoaderCircle className="mr-2 animate-spin" /> Saving...</>) : existingPreviousSessionForSelection?.id ? 'Update Session' : 'Save Session'}
                            </Button>
                          </div>
                        </div>
                      </form>
                    </Form>
                  ) : null}

                  {activeModule === 'test' ? (
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit((values) => onSubmit(values, false))} className="space-y-6">
                    <div className="rounded-3xl border border-violet-400/20 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.45))] p-5 shadow-[0_32px_100px_-60px_rgba(168,85,247,0.7)]">
                      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                        <div className="space-y-3">
                          <Badge variant="outline" className="w-fit rounded-full border-violet-400/25 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-100">
                            Test setup
                          </Badge>
                          <div className="space-y-2">
                            <h3 className="text-2xl font-semibold">Schedule Test</h3>
                            <p className="max-w-2xl text-sm text-muted-foreground">
                              Set timing, attempts, and question sections in one flow.
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[430px]">
                          <div className="rounded-2xl border border-white/10 bg-background/45 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Access level</p>
                            <p className="mt-1 text-lg font-semibold uppercase">{liveBatch?.accessLevel || 'free'}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Taken from this batch.</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-background/45 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Questions</p>
                            <p className="mt-1 text-lg font-semibold">{totalRequestedQuestions}</p>
                            <p className="mt-1 text-xs text-muted-foreground">From the sections below.</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-background/45 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Total marks</p>
                            <p className="mt-1 text-lg font-semibold">{totalMarks}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Calculated automatically.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-3xl border border-white/10 bg-background/40 p-5 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.95)]">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-1">
                          <Badge variant="outline" className="w-fit rounded-full border-white/10 bg-background/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Step 1
                          </Badge>
                          <h3 className="text-xl font-semibold">Schedule and timing</h3>
                        </div>
                        <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">
                          Students can see this test based on the current unlock timing.
                        </div>
                      </div>
                      <UpcomingSessionSlotBrowser
                        title="Next week slots"
                        description="Pick a slot for a single-day test, or choose unlimited days and set only the release date."
                        groups={upcomingSessionSlotGroups}
                        emptyDescription="No subject-day timing is available in the next 7 days. Add days and timings in batch setup to see slots."
                        onUseForTest={applySlotToTestForm}
                        isTestSlotSelected={(slot) =>
                          testAvailabilityMode === 'single_day'
                          && !slot.noticeType
                          && slot.date === selectedTestDate
                          && slot.startTime === selectedTestTime
                          && slot.endTime === selectedTestEndTime
                        }
                      />
                      <FormField
                        control={form.control}
                        name="availabilityMode"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <div className="space-y-1">
                              <FormLabel>How should this test stay available?</FormLabel>
                              <FormDescription>
                                Choose whether the test should stay only for the scheduled day or remain available without an end date.
                              </FormDescription>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              {([
                                {
                                  value: 'single_day',
                                  title: 'Single day',
                                  description: 'Ask for test start and test end time. The gap between them becomes the student timer.',
                                },
                                {
                                  value: 'unlimited',
                                  title: 'Unlimited days',
                                  description: 'Ask only for the release date. The test stays available until you change or remove it.',
                                },
                              ] as const).map((option) => {
                                const isActive = field.value === option.value;
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => field.onChange(option.value)}
                                    className={cn(
                                      'rounded-2xl border px-4 py-4 text-left transition-all',
                                      isActive
                                        ? 'border-cyan-300/40 bg-cyan-500/12 shadow-[0_18px_45px_-32px_rgba(56,189,248,0.85)]'
                                        : 'border-white/10 bg-background/55 hover:border-cyan-300/20 hover:bg-background/70'
                                    )}
                                  >
                                    <p className="text-sm font-semibold text-foreground">{option.title}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                                  </button>
                                );
                              })}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className={cn('grid grid-cols-1 gap-4', testAvailabilityMode === 'single_day' ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
                        <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Scheduled Date</FormLabel>
                            <FormControl><Input className={scheduleInputClass} type="date" min={batchStartDateMin} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        {testAvailabilityMode === 'single_day' ? (
                          <>
                            <FormField control={form.control} name="scheduledTime" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Test Start</FormLabel>
                                <FormControl><Input className={scheduleInputClass} type="time" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="scheduledEndTime" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Test End</FormLabel>
                                <FormControl><Input className={scheduleInputClass} type="time" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </>
                        ) : (
                          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                            Students will see this test from the scheduled date onward, with no closing date.
                          </div>
                        )}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-background/35 p-4 text-sm text-muted-foreground">
                        {testAvailabilityMode === 'single_day' ? (
                          selectedTestDurationMinutes !== null ? (
                            <p>
                              Test duration: <span className="font-semibold text-foreground">{formatTestDurationLabel(selectedTestDurationMinutes, { unit: 'long' })}</span>
                            </p>
                          ) : (
                            <p>Choose both start and end time. The gap becomes the student timer.</p>
                          )
                        ) : (
                          <p>This test opens on the selected date and stays available until you update it.</p>
                        )}
                      </div>
                      <FormField control={form.control} name="title" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Test Title</FormLabel>
                          <FormControl><Input className={scheduleInputClass} placeholder="e.g., Weekly PCM Mock - Class 12" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4 text-sm">
                        Access Level: <span className="font-semibold uppercase">{(liveBatch?.accessLevel || 'free')}</span> (inherited from live batch)
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField control={form.control} name="marksPerQuestion" render={({ field }) => (
                          <FormItem><FormLabel>Marks per Question</FormLabel><FormControl><Input className={scheduleInputClass} type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="negativeMarksPerQuestion" render={({ field }) => (
                          <FormItem><FormLabel>Negative Marking / Question</FormLabel><FormControl><Input className={scheduleInputClass} type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="space-y-3 rounded-3xl border border-white/10 bg-background/35 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-medium">Attempt Limit for Students</p>
                          <Badge variant="outline" className="rounded-full border-white/10 bg-background/45 text-[11px] text-muted-foreground">
                            {attemptLimitMode === 'unlimited' ? 'Flexible access' : 'Restricted retries'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="attemptLimitMode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Attempt Limit Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger className={scheduleSelectClass}><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="unlimited">Unlimited Attempts</SelectItem>
                                    <SelectItem value="total">Total Attempts</SelectItem>
                                    <SelectItem value="interval">Attempts Per Interval</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {attemptLimitMode === 'total' ? (
                            <FormField
                              control={form.control}
                              name="maxTotalAttempts"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Maximum Total Attempts</FormLabel>
                                  <FormControl><Input className={scheduleInputClass} type="number" min="1" {...field} value={field.value ?? ''} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ) : null}
                        </div>
                        {attemptLimitMode === 'interval' ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                              control={form.control}
                              name="maxAttemptsPerInterval"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Attempts Allowed</FormLabel>
                                  <FormControl><Input className={scheduleInputClass} type="number" min="1" {...field} value={field.value ?? ''} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="attemptIntervalValue"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Interval Count</FormLabel>
                                  <FormControl><Input className={scheduleInputClass} type="number" min="1" {...field} value={field.value ?? ''} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="attemptIntervalUnit"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Interval Unit</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className={scheduleSelectClass}><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      <SelectItem value="day">Day(s)</SelectItem>
                                      <SelectItem value="week">Week(s)</SelectItem>
                                      <SelectItem value="month">Month(s)</SelectItem>
                                      <SelectItem value="year">Year(s)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        ) : null}
                        {attemptLimitMode === 'unlimited' ? (
                          <p className="text-xs text-muted-foreground">Students can attempt this test any number of times while it stays available.</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-4 rounded-3xl border border-white/10 bg-background/40 p-5 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.95)]">
                        <div className="space-y-1">
                          <Badge variant="outline" className="w-fit rounded-full border-white/10 bg-background/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Step 2
                          </Badge>
                          <h3 className="text-xl font-semibold">Exam and class</h3>
                        </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <FormField control={form.control} name="examTypeId" render={({ field }) => (
                          <FormItem><FormLabel>Exam</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!!liveBatch?.examTypeId}><FormControl><SelectTrigger className={scheduleSelectClass}><SelectValue placeholder="Select exam" /></SelectTrigger></FormControl><SelectContent>{(examTypes || []).map((et) => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="classId" render={({ field }) => (
                          <FormItem><FormLabel>Curriculum/Class</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedExamType || !!liveBatch?.classId}><FormControl><SelectTrigger className={scheduleSelectClass}><SelectValue placeholder="Select curriculum/class" /></SelectTrigger></FormControl><SelectContent>{filteredClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="examLevel" render={({ field }) => (
                          <FormItem><FormLabel>Exam Difficulty Level</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className={scheduleSelectClass}><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="weak">Weak</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="strong">Strong</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                        )} />
                      </div>
                    </div>

                    <div className="space-y-4 rounded-3xl border border-white/10 bg-background/40 p-5 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.95)]">
                        <div className="space-y-1">
                          <Badge variant="outline" className="w-fit rounded-full border-white/10 bg-background/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Step 3
                          </Badge>
                          <h3 className="text-xl font-semibold">Question sections</h3>
                        </div>
                      <FormDescription>
                        Free uses up to 10 fixed DCAM-bank questions. Paid uses active purchased scope only.
                      </FormDescription>
                      <div className="space-y-3">
                        {fields.map((field, index) => {
                          const allConfigs = watchedSubjectConfigs || [];
                          const currentQuestionAccessLevel = watch(`subjectConfigs.${index}.questionAccessLevel`) || defaultSectionQuestionAccessLevel;
                          const currentSubjectId = watch(`subjectConfigs.${index}.subjectId`);
                          const currentEquivalentSubjectIds = getEquivalentSubjectIdSet(currentSubjectId, selectedClass, selectedExamType);
                          const currentTopicId = watch(`subjectConfigs.${index}.topicId`) || '';
                          const currentSubtopic = watch(`subjectConfigs.${index}.subtopic`) || '';
                          const currentSubtopicPaths = normalizeSubtopicPathSelections(
                            (watch(`subjectConfigs.${index}.subtopicPaths`) || []) as string[],
                            currentSubtopic
                          );
                          const currentQuestionType = watch(`subjectConfigs.${index}.questionType`) || 'All';
                          const currentDifficultyLevel = watch(`subjectConfigs.${index}.difficultyLevel`) || 'All';
                          const paidSectionAvailability = currentSubjectId
                            ? getPaidPurchaseAvailabilityForConfig(
                                currentSubjectId,
                                currentTopicId,
                                currentSubtopicPaths,
                                currentSubtopic,
                                currentQuestionType,
                                currentDifficultyLevel
                              )
                            : null;
                          const canSelectPaidForCurrentScope =
                            !!currentSubjectId && !!paidSectionAvailability && paidSectionAvailability.selectableRows.length > 0;
                          const canShowPaidForCurrentScope =
                            !!currentSubjectId && !!paidSectionAvailability && paidSectionAvailability.candidateRows.length > 0;
                          const topicOptions = Array.from(new Map(
                            availableQuestionEntries
                              .filter((entry) =>
                                currentSubjectId
                                && currentEquivalentSubjectIds.has(entry.subjectId)
                                && entry.accessLevel === currentQuestionAccessLevel
                                && !!entry.topicId
                              )
                              .map((entry) => [entry.topicId, { id: entry.topicId, name: topicNameById[entry.topicId] || entry.topicId }])
                          ).values()).sort((a, b) => a.name.localeCompare(b.name));
                          if (currentTopicId && !topicOptions.some((topic) => topic.id === currentTopicId)) {
                            topicOptions.unshift({ id: currentTopicId, name: topicNameById[currentTopicId] || currentTopicId });
                          }
                          const subtopicPathPoolMap = new Map<string, string[]>();
                          getSubtopicPathPoolForConfig(currentSubjectId, currentTopicId, currentQuestionAccessLevel).forEach((path) => {
                            const key = getSubtopicPathKey(path);
                            if (!key || subtopicPathPoolMap.has(key)) return;
                            subtopicPathPoolMap.set(key, path);
                          });
                          currentSubtopicPaths.forEach((selectedPath) => {
                            const parsed = parseSubtopicPathSelection(selectedPath);
                            const key = getSubtopicPathKey(parsed);
                            if (!key || subtopicPathPoolMap.has(key)) return;
                            subtopicPathPoolMap.set(key, parsed);
                          });
                          const subtopicPathPool = Array.from(subtopicPathPoolMap.values()).sort((a, b) =>
                            serializeSubtopicPathSelection(a).localeCompare(serializeSubtopicPathSelection(b))
                          );
                          const draftSubtopicPath = subtopicDraftPathBySection[field.id] || [];
                          const levelOptionSets: string[][] = [];
                          let traversalParent: string[] = [];
                          while (true) {
                            const levelOptions = getChildSubtopicOptions(subtopicPathPool, traversalParent);
                            if (levelOptions.length === 0) break;
                            levelOptionSets.push(levelOptions);
                            const selectedAtLevel = String(draftSubtopicPath[levelOptionSets.length - 1] || '').trim();
                            const matchingSelection = levelOptions.find(
                              (option) => normalizeSubtopicValue(option) === normalizeSubtopicValue(selectedAtLevel)
                            );
                            if (!matchingSelection) break;
                            traversalParent = [...traversalParent, matchingSelection];
                          }
                          const normalizedDraftPath = normalizeSubtopicPathSegments(traversalParent);
                          const availableCount = getAvailableCountForConfig(
                            currentSubjectId,
                            currentTopicId,
                            currentSubtopicPaths,
                            currentSubtopic,
                            currentQuestionAccessLevel,
                            currentQuestionType,
                            currentDifficultyLevel,
                            index
                          );
                          const hasSubjectSelection = Boolean(currentSubjectId);
                          const showNestedSubtopicStep = Boolean(currentTopicId) && subtopicPathPool.length > 0;
                          const bankCountHelperText =
                            currentQuestionAccessLevel === 'paid' && paidSectionAvailability?.hasStudentCoverageGap
                              ? `This batch has ${liveBatchTokenStudentCount} token student${liveBatchTokenStudentCount === 1 ? '' : 's'}. Buy this paid scope for more students before ${formatCoverageMomentLabel(paidSectionAvailability.referenceTime)}.`
                              : currentQuestionAccessLevel === 'paid' && paidSectionAvailability?.hasExpiredMatchingPurchase
                                ? `This paid purchase will be inactive by ${formatCoverageMomentLabel(paidSectionAvailability.referenceTime)}. Renew it to use paid questions here.`
                                : currentQuestionAccessLevel === 'paid' && !paidSectionAvailability?.hasAnyMatchingPurchase
                                  ? `Buy this paid scope first to use paid DCAM-bank questions here at ${formatCoverageMomentLabel(paidSectionAvailability?.referenceTime)}.`
                                  : currentQuestionAccessLevel === 'paid' && paidSectionAvailability?.referenceTime
                                    ? `Paid coverage is being checked for ${formatCoverageMomentLabel(paidSectionAvailability.referenceTime)}.`
                                  : !currentTopicId
                                    ? `Covers all topics for the selected ${currentQuestionAccessLevel} subject scope.`
                                    : currentSubtopicPaths.length > 0
                                      ? `Selected branch${currentSubtopicPaths.length === 1 ? '' : 'es'}: ${currentSubtopicPaths.join(', ')}`
                                      : showNestedSubtopicStep
                                        ? 'Covers the selected topic and all of its subtopics.'
                                        : 'Covers the selected topic.';
                          const hasDuplicateCombination = (
                            subjectId: string,
                            topicId: string,
                            subtopicPaths: string[],
                            questionAccessLevel: 'free' | 'paid',
                            questionType: 'All' | 'MCQ' | 'Numerical' | 'Text',
                            difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard'
                          ) => {
                            const candidateKey = `${subjectId}__${topicId || ''}__${getSubtopicSelectionKey(subtopicPaths)}__${questionAccessLevel}__${questionType}__${difficultyLevel}`;
                            return allConfigs.some((cfg, i) => {
                              if (i === index) return false;
                              const key = `${cfg.subjectId}__${cfg.topicId || ''}__${getSubtopicSelectionKey(cfg.subtopicPaths, cfg.subtopic)}__${cfg.questionAccessLevel || defaultSectionQuestionAccessLevel}__${cfg.questionType}__${cfg.difficultyLevel}`;
                              return key === candidateKey;
                            });
                          };
                          return (
                            <div
                              key={field.id}
                              className="space-y-4 rounded-2xl border border-slate-400/25 bg-gradient-to-br from-slate-950/65 via-slate-900/55 to-slate-950/35 p-4 shadow-[0_18px_50px_-40px_rgba(14,165,233,0.48)]"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="rounded-full border-cyan-300/35 bg-cyan-500/10 text-cyan-100">Section {index + 1}</Badge>
                                    <Badge variant="outline" className="rounded-full border-slate-300/30 bg-slate-800/65 text-slate-100">
                                      {currentQuestionAccessLevel === 'paid' ? `${availableCount} available to use` : `${availableCount} in bank`}
                                    </Badge>
                                    <Badge variant="outline" className={cn('rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]', currentQuestionAccessLevel === 'paid' ? 'border-rose-300/40 bg-rose-500/10 text-rose-100' : 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100')}>
                                      {currentQuestionAccessLevel === 'paid' ? 'Paid questions' : 'Free questions'}
                                    </Badge>
                                  </div>
                                  <p className="mt-2 text-sm text-slate-300/85">
                                    {hasSubjectSelection
                                      ? 'Choose the next filter to narrow this section.'
                                      : 'Start with subject, then choose free or paid question access.'}
                                  </p>
                                </div>
                                {fields.length > 1 ? (
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="h-10 w-10 rounded-xl"
                                    onClick={() => {
                                      setSubtopicDraftPathBySection((prev) => {
                                        const next = { ...prev };
                                        delete next[field.id];
                                        return next;
                                      });
                                      remove(index);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <FormField control={form.control} name={`subjectConfigs.${index}.subjectId`} render={({ field: subjectField }) => (
                                <FormItem>
                                  <FormLabel>Subject</FormLabel>
                                  <Select onValueChange={(value) => {
                                    if (hasDuplicateCombination(value, '', [], currentQuestionAccessLevel, currentQuestionType, currentDifficultyLevel)) {
                                      toast({
                                        variant: 'destructive',
                                        title: 'Duplicate section',
                                        description: 'This section already exists with the same question access, topic, subtopic branch, type, and difficulty.',
                                      });
                                      return;
                                    }
                                    subjectField.onChange(value);
                                    const subjectName = filteredSubjects.find((s) => s.id === value)?.name || '';
                                    setValue(`subjectConfigs.${index}.subjectName`, subjectName);
                                    setValue(`subjectConfigs.${index}.topicId`, '');
                                    setValue(`subjectConfigs.${index}.topicName`, '');
                                    setValue(`subjectConfigs.${index}.subtopic`, '');
                                    setValue(`subjectConfigs.${index}.subtopicPaths`, []);
                                    setSubtopicDraftPathBySection((prev) => ({ ...prev, [field.id]: [] }));
                                  }} value={subjectField.value} disabled={!selectedClass}>
                                    <FormControl><SelectTrigger className={sectionBuilderSelectClass}><SelectValue placeholder="Select subject" /></SelectTrigger></FormControl>
                                    <SelectContent>{filteredSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <FormField control={form.control} name={`subjectConfigs.${index}.questionAccessLevel`} render={({ field: questionAccessField }) => (
                                <FormItem>
                                  <FormLabel>Question Access</FormLabel>
                                  <Select onValueChange={(value: 'free' | 'paid') => {
                                    if (value === 'paid' && !canSelectPaidForCurrentScope) {
                                      const paidAvailability = getPaidPurchaseAvailabilityForConfig(
                                        currentSubjectId,
                                        currentTopicId,
                                        currentSubtopicPaths,
                                        currentSubtopic,
                                        currentQuestionType,
                                        currentDifficultyLevel
                                      );
                                      questionAccessField.onChange('free');
                                      openPurchaseAvailabilityDialog(
                                        buildPaidQuestionPurchaseDialogCopy({
                                          subjectLabel: currentSubjectId ? (subjectNameById[currentSubjectId] || currentSubjectId) : 'this subject',
                                          topicLabel: currentTopicId ? (topicNameById[currentTopicId] || currentTopicId) : '',
                                          sectionAvailability: paidAvailability,
                                        })
                                      );
                                      return;
                                    }
                                    if (!currentSubjectId) {
                                      questionAccessField.onChange('free');
                                      return;
                                    }
                                    if (hasDuplicateCombination(currentSubjectId, currentTopicId, currentSubtopicPaths, value, currentQuestionType, currentDifficultyLevel)) {
                                      toast({
                                        variant: 'destructive',
                                        title: 'Duplicate section',
                                        description: 'This section already exists with the same question access, topic, subtopic branch, type, and difficulty.',
                                      });
                                      return;
                                    }
                                    questionAccessField.onChange(value);
                                    setValue(`subjectConfigs.${index}.subtopic`, '');
                                    setValue(`subjectConfigs.${index}.subtopicPaths`, []);
                                    setSubtopicDraftPathBySection((prev) => ({ ...prev, [field.id]: [] }));
                                  }} value={currentSubjectId ? (questionAccessField.value || defaultSectionQuestionAccessLevel) : 'free'} disabled={!currentSubjectId}>
                                    <FormControl><SelectTrigger className={sectionBuilderSelectClass}><SelectValue placeholder={currentSubjectId ? 'Select access' : 'Select subject first'} /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      <SelectItem value="free">Free</SelectItem>
                                      {canShowPaidForCurrentScope ? <SelectItem value="paid">Paid</SelectItem> : null}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              </div>
                              {hasSubjectSelection ? (
                                <div className="space-y-4 rounded-2xl border border-white/10 bg-background/25 p-4">
                                  <div className="space-y-1">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100/85">Next</p>
                                    <p className="text-sm font-medium text-slate-100">Choose topic and filters for this section.</p>
                                  </div>
                                  <div className="grid grid-cols-1 gap-3">
                              <FormField control={form.control} name={`subjectConfigs.${index}.topicId`} render={({ field: topicField }) => (
                                <FormItem>
                                  <FormLabel>Topic</FormLabel>
                                  <Select onValueChange={(value) => {
                                    const normalizedTopicId = value === '__all_topics__' ? '' : value;
                                    if (currentSubjectId && hasDuplicateCombination(currentSubjectId, normalizedTopicId, [], currentQuestionAccessLevel, currentQuestionType, currentDifficultyLevel)) {
                                      toast({
                                        variant: 'destructive',
                                        title: 'Duplicate section',
                                        description: 'This section already exists with the same question access, topic, subtopic branch, type, and difficulty.',
                                      });
                                      return;
                                    }
                                    topicField.onChange(normalizedTopicId);
                                    setValue(`subjectConfigs.${index}.topicName`, topicNameById[normalizedTopicId] || '');
                                    setValue(`subjectConfigs.${index}.subtopic`, '');
                                    setValue(`subjectConfigs.${index}.subtopicPaths`, []);
                                    setSubtopicDraftPathBySection((prev) => ({ ...prev, [field.id]: [] }));
                                  }} value={topicField.value || '__all_topics__'} disabled={!currentSubjectId}>
                                    <FormControl><SelectTrigger className={sectionBuilderSelectClass}><SelectValue placeholder="All topics" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      <SelectItem value="__all_topics__">All topics</SelectItem>
                                      {topicOptions.map((topic) => <SelectItem key={topic.id} value={topic.id}>{topic.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )} />
                                  </div>
                              {showNestedSubtopicStep ? (
                                <div className="rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-500/10 via-slate-900/35 to-cyan-500/10 p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-semibold text-cyan-100">Subtopic Branch (Optional)</p>
                                      <p className="text-[11px] text-slate-300/85">
                                        Select the branch you want. Child subtopics are included automatically.
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={currentSubtopicPaths.length === 0 ? 'default' : 'outline'}
                                      className="h-9 rounded-full border-cyan-300/35 bg-cyan-500/20 px-4 text-cyan-50 hover:bg-cyan-500/30"
                                      onClick={() => {
                                        if (!currentSubjectId) return;
                                        if (hasDuplicateCombination(currentSubjectId, currentTopicId, [], currentQuestionAccessLevel, currentQuestionType, currentDifficultyLevel)) {
                                          toast({
                                            variant: 'destructive',
                                            title: 'Duplicate section',
                                            description: 'This section already exists with the same question access, topic, subtopic branch, type, and difficulty.',
                                          });
                                          return;
                                        }
                                        setValue(`subjectConfigs.${index}.subtopicPaths`, []);
                                        setValue(`subjectConfigs.${index}.subtopic`, '');
                                      }}
                                    >
                                      All subtopics in topic
                                    </Button>
                                  </div>

                                  <div className="mt-3 space-y-3">
                                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                        {levelOptionSets.map((levelOptions, levelIndex) => (
                                          <FormItem key={`${field.id}-level-${levelIndex}`}>
                                            <FormLabel>{`Subtopic Level ${levelIndex + 1}`}</FormLabel>
                                            <Select
                                              onValueChange={(value) => {
                                                setSubtopicDraftPathBySection((prev) => {
                                                  const existing = [...(prev[field.id] || [])];
                                                  const next = existing.slice(0, levelIndex);
                                                  if (value !== '__no_selection__') {
                                                    next[levelIndex] = value;
                                                  }
                                                  return { ...prev, [field.id]: next };
                                                });
                                              }}
                                              value={draftSubtopicPath[levelIndex] || '__no_selection__'}
                                            >
                                              <FormControl><SelectTrigger className={sectionBuilderSelectClass}><SelectValue placeholder={levelIndex === 0 ? 'Select top-level subtopic' : 'Select child subtopic'} /></SelectTrigger></FormControl>
                                              <SelectContent>
                                                <SelectItem value="__no_selection__">{levelIndex === 0 ? 'Select top-level subtopic' : 'Stop here (all child subtopics)'}</SelectItem>
                                                {levelOptions.map((option) => <SelectItem key={`${field.id}-level-${levelIndex}-${option}`} value={option}>{option}</SelectItem>)}
                                              </SelectContent>
                                            </Select>
                                          </FormItem>
                                        ))}
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          className="h-9 rounded-full bg-cyan-500 px-4 font-semibold text-slate-950 hover:bg-cyan-400"
                                          disabled={!currentSubjectId || normalizedDraftPath.length === 0}
                                          onClick={() => {
                                            if (!currentSubjectId || normalizedDraftPath.length === 0) return;
                                            const branchPath = serializeSubtopicPathSelection(normalizedDraftPath);
                                            const mergedPaths = normalizeSubtopicPathSelections([...currentSubtopicPaths, branchPath]);
                                            if (hasDuplicateCombination(currentSubjectId, currentTopicId, mergedPaths, currentQuestionAccessLevel, currentQuestionType, currentDifficultyLevel)) {
                                              toast({
                                                variant: 'destructive',
                                                title: 'Duplicate section',
                                                description: 'This section already exists with the same question access, topic, subtopic branch, type, and difficulty.',
                                              });
                                              return;
                                            }
                                            const firstPath = parseSubtopicPathSelection(mergedPaths[0] || '');
                                            setValue(`subjectConfigs.${index}.subtopicPaths`, mergedPaths);
                                            setValue(`subjectConfigs.${index}.subtopic`, firstPath[0] || '');
                                          }}
                                        >
                                          Add Selected Branch
                                        </Button>
                                        <p className="text-xs text-slate-300/85">
                                          Current draft: {normalizedDraftPath.length > 0 ? serializeSubtopicPathSelection(normalizedDraftPath) : 'No branch selected'}
                                        </p>
                                      </div>

                                      {currentSubtopicPaths.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                          {currentSubtopicPaths.map((selectedPath) => (
                                            <button
                                              key={`${field.id}-subtopic-path-${selectedPath}`}
                                              type="button"
                                              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-500/15 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-500/25"
                                              onClick={() => {
                                                if (!currentSubjectId) return;
                                                const nextPaths = normalizeSubtopicPathSelections(currentSubtopicPaths.filter((path) => path !== selectedPath));
                                                if (hasDuplicateCombination(currentSubjectId, currentTopicId, nextPaths, currentQuestionAccessLevel, currentQuestionType, currentDifficultyLevel)) {
                                                  toast({
                                                    variant: 'destructive',
                                                    title: 'Duplicate section',
                                                    description: 'This section already exists with the same question access, topic, subtopic branch, type, and difficulty.',
                                                  });
                                                  return;
                                                }
                                                const firstPath = parseSubtopicPathSelection(nextPaths[0] || '');
                                                setValue(`subjectConfigs.${index}.subtopicPaths`, nextPaths);
                                                setValue(`subjectConfigs.${index}.subtopic`, firstPath[0] || '');
                                              }}
                                            >
                                              <span>{selectedPath}</span>
                                              <span className="font-semibold">x</span>
                                            </button>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-slate-300/85">
                                          No branch selected yet. This section currently includes all subtopics under the selected topic.
                                        </p>
                                      )}
                                  </div>
                                </div>
                              ) : null}
                              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                <FormField control={form.control} name={`subjectConfigs.${index}.questionType`} render={({ field: typeField }) => (
                                  <FormItem><FormLabel>Question Type</FormLabel><Select onValueChange={(value: 'All' | 'MCQ' | 'Numerical' | 'Text') => {
                                    if (!currentSubjectId) {
                                      typeField.onChange(value);
                                      return;
                                    }
                                    if (hasDuplicateCombination(currentSubjectId, currentTopicId, currentSubtopicPaths, currentQuestionAccessLevel, value, currentDifficultyLevel)) {
                                      toast({
                                        variant: 'destructive',
                                        title: 'Duplicate section',
                                        description: 'This section already exists with the same question access, topic, subtopic branch, type, and difficulty.',
                                      });
                                      return;
                                    }
                                    typeField.onChange(value);
                                  }} value={typeField.value}><FormControl><SelectTrigger className={sectionBuilderSelectClass}><SelectValue placeholder="All types" /></SelectTrigger></FormControl><SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="MCQ">MCQ</SelectItem><SelectItem value="Numerical">Numerical</SelectItem><SelectItem value="Text">Text</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                
                              </div>
                              <div className="space-y-3 rounded-2xl border border-white/10 bg-background/20 p-4">
                                <div className="space-y-1">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100/85">Finish</p>
                                  <p className="text-sm font-medium text-slate-100">Set the question count for this section.</p>
                                </div>
                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                  <FormField control={form.control} name={`subjectConfigs.${index}.count`} render={({ field: countField }) => (
                                    <FormItem>
                                      <FormLabel>No. of Questions</FormLabel>
                                      <FormControl>
                                        <Input
                                          className={sectionBuilderInputClass}
                                          type="number"
                                          min="1"
                                          max={availableCount > 0 ? availableCount : undefined}
                                          {...countField}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )} />
                                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Available</p>
                                    <p className="mt-1 text-2xl font-semibold">{availableCount}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{bankCountHelperText}</p>
                                    {currentQuestionAccessLevel === 'free' ? (
                                      <p className="mt-2 text-xs text-cyan-100/85">
                                        Free DCAM-bank sections can use up to {MAX_FREE_DCAM_BANK_QUESTIONS_PER_TEST} questions in one test.
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                              </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      <Button type="button" variant="outline" className="h-11 rounded-full border-cyan-300/35 bg-cyan-500/10 px-5 font-semibold text-cyan-100 hover:bg-cyan-500/20" onClick={() => append(createEmptySubjectConfig(defaultSectionQuestionAccessLevel))}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Section
                      </Button>
                      <FormField control={form.control} name="subjectConfigs" render={() => <FormItem><FormMessage /></FormItem>} />
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-background/40 p-5 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.95)]">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-1">
                          <Badge variant="outline" className="w-fit rounded-full border-white/10 bg-background/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Final review
                          </Badge>
                          <h3 className="text-xl font-semibold">Test summary</h3>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-white/10 bg-background/55 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Questions</p>
                            <p className="mt-1 text-xl font-semibold">{totalRequestedQuestions}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-background/55 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Marks</p>
                            <p className="mt-1 text-xl font-semibold">{totalMarks}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-background/55 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Timing</p>
                            <p className="mt-1 text-xl font-semibold">
                              {testAvailabilityMode === 'single_day'
                                ? (selectedTestDurationMinutes !== null ? formatTestDurationLabel(selectedTestDurationMinutes) : 'Set start & end')
                                : 'Unlimited days'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 rounded-3xl border border-violet-400/20 bg-[linear-gradient(135deg,rgba(168,85,247,0.14),rgba(15,23,42,0.18))] p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-lg font-semibold">Ready to schedule this test?</p>
                        <p className="text-sm text-muted-foreground">Review the schedule mode, date, timing, filter scope, and question distribution before publishing this test.</p>
                      </div>
                      <Button type="submit" disabled={isSubmitting} size="lg" className="h-12 rounded-xl px-6">
                        {isSubmitting ? (<><LoaderCircle className="mr-2 animate-spin" /> Scheduling Test...</>) : 'Schedule Test'}
                      </Button>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-background/40 p-4 space-y-3 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.95)]">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Active Scheduled Tests</p>
                          <p className="text-xs text-muted-foreground">Edit or remove tests that are still active in this batch.</p>
                        </div>
                        <Badge variant="outline" className="w-fit rounded-full border-white/10 bg-background/45 text-[11px] text-muted-foreground">
                          {upcomingScheduledBatchTests.length} active
                        </Badge>
                      </div>
                      {upcomingScheduledBatchTests.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No active tests to edit right now.</p>
                      ) : (
                        <div className="space-y-2">
                          {upcomingScheduledBatchTests.map((test) => {
                            const draft = testDrafts[test.id] || createEmptyScheduledTestDraft();
                            return (
                              <div key={test.id} className="rounded-3xl border border-white/10 bg-background/55 p-4 space-y-4">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium">{test.title || 'Live Test'}</p>
                                  <p className="text-xs text-muted-foreground">ID: {test.id}</p>
                                </div>
                                <div className={cn('grid grid-cols-1 gap-2 items-end', draft.availabilityMode === 'single_day' ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
                                  <FormItem>
                                    <FormLabel>Mode</FormLabel>
                                    <Select
                                      value={draft.availabilityMode}
                                      onValueChange={(value) =>
                                        setTestDrafts((prev) => ({
                                          ...prev,
                                          [test.id]: {
                                            ...createEmptyScheduledTestDraft(),
                                            ...(prev[test.id] || {}),
                                            availabilityMode: value as ScheduledTestAvailabilityMode,
                                            scheduledTime: value === 'single_day' ? (prev[test.id]?.scheduledTime || '') : '',
                                            scheduledEndTime: value === 'single_day' ? (prev[test.id]?.scheduledEndTime || '') : '',
                                          },
                                        }))
                                      }
                                    >
                                      <FormControl><SelectTrigger className={scheduleSelectClass}><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        <SelectItem value="single_day">Single day</SelectItem>
                                        <SelectItem value="unlimited">Unlimited days</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                  <FormItem>
                                    <FormLabel>Date</FormLabel>
                                    <FormControl>
                                      <Input
                                        className={scheduleInputClass}
                                        type="date"
                                        min={batchStartDateMin}
                                        value={draft.scheduledDate}
                                        onChange={(e) =>
                                          setTestDrafts((prev) => ({
                                            ...prev,
                                            [test.id]: { ...createEmptyScheduledTestDraft(), ...(prev[test.id] || {}), scheduledDate: e.target.value },
                                          }))
                                        }
                                      />
                                    </FormControl>
                                  </FormItem>
                                  {draft.availabilityMode === 'single_day' ? (
                                    <>
                                      <FormItem>
                                        <FormLabel>Test Start</FormLabel>
                                        <FormControl>
                                          <Input
                                            className={scheduleInputClass}
                                            type="time"
                                            value={draft.scheduledTime}
                                            onChange={(e) =>
                                              setTestDrafts((prev) => ({
                                                ...prev,
                                                [test.id]: { ...createEmptyScheduledTestDraft(), ...(prev[test.id] || {}), scheduledTime: e.target.value },
                                              }))
                                            }
                                          />
                                        </FormControl>
                                      </FormItem>
                                      <FormItem>
                                        <FormLabel>Test End</FormLabel>
                                        <FormControl>
                                          <Input
                                            className={scheduleInputClass}
                                            type="time"
                                            value={draft.scheduledEndTime}
                                            onChange={(e) =>
                                              setTestDrafts((prev) => ({
                                                ...prev,
                                                [test.id]: { ...createEmptyScheduledTestDraft(), ...(prev[test.id] || {}), scheduledEndTime: e.target.value },
                                              }))
                                            }
                                          />
                                        </FormControl>
                                      </FormItem>
                                    </>
                                  ) : (
                                    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                                      This test will stay available from the selected date until you update it.
                                    </div>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                                  <FormItem>
                                    <FormLabel>Attempt Limit Type</FormLabel>
                                    <Select
                                      value={draft.attemptLimitMode}
                                      onValueChange={(value) =>
                                        setTestDrafts((prev) => ({
                                          ...prev,
                                          [test.id]: {
                                            ...createEmptyScheduledTestDraft(),
                                            ...(prev[test.id] || {}),
                                            attemptLimitMode: value as AttemptLimitMode,
                                          },
                                        }))
                                      }
                                    >
                                      <FormControl><SelectTrigger className={scheduleSelectClass}><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        <SelectItem value="unlimited">Unlimited</SelectItem>
                                        <SelectItem value="total">Total</SelectItem>
                                        <SelectItem value="interval">Interval</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                  {draft.attemptLimitMode === 'total' ? (
                                    <FormItem>
                                      <FormLabel>Max Total</FormLabel>
                                      <FormControl>
                                        <Input
                                          className={scheduleInputClass}
                                          type="number"
                                          min="1"
                                          value={draft.maxTotalAttempts}
                                          onChange={(e) =>
                                            setTestDrafts((prev) => ({
                                              ...prev,
                                              [test.id]: {
                                                ...createEmptyScheduledTestDraft(),
                                                ...(prev[test.id] || {}),
                                                maxTotalAttempts: Number(e.target.value || 1),
                                              },
                                            }))
                                          }
                                        />
                                      </FormControl>
                                    </FormItem>
                                  ) : null}
                                  {draft.attemptLimitMode === 'interval' ? (
                                    <>
                                      <FormItem>
                                        <FormLabel>Attempts</FormLabel>
                                        <FormControl>
                                          <Input
                                            className={scheduleInputClass}
                                            type="number"
                                            min="1"
                                            value={draft.maxAttemptsPerInterval}
                                            onChange={(e) =>
                                              setTestDrafts((prev) => ({
                                                ...prev,
                                                [test.id]: {
                                                  ...createEmptyScheduledTestDraft(),
                                                  ...(prev[test.id] || {}),
                                                  maxAttemptsPerInterval: Number(e.target.value || 1),
                                                },
                                              }))
                                            }
                                          />
                                        </FormControl>
                                      </FormItem>
                                      <FormItem>
                                        <FormLabel>Interval Count</FormLabel>
                                        <FormControl>
                                          <Input
                                            className={scheduleInputClass}
                                            type="number"
                                            min="1"
                                            value={draft.attemptIntervalValue}
                                            onChange={(e) =>
                                              setTestDrafts((prev) => ({
                                                ...prev,
                                                [test.id]: {
                                                  ...createEmptyScheduledTestDraft(),
                                                  ...(prev[test.id] || {}),
                                                  attemptIntervalValue: Number(e.target.value || 1),
                                                },
                                              }))
                                            }
                                          />
                                        </FormControl>
                                      </FormItem>
                                      <FormItem>
                                        <FormLabel>Interval Unit</FormLabel>
                                        <Select
                                          value={draft.attemptIntervalUnit}
                                          onValueChange={(value) =>
                                            setTestDrafts((prev) => ({
                                              ...prev,
                                              [test.id]: {
                                                ...createEmptyScheduledTestDraft(),
                                                ...(prev[test.id] || {}),
                                                attemptIntervalUnit: value as AttemptIntervalUnit,
                                              },
                                            }))
                                          }
                                        >
                                          <FormControl><SelectTrigger className={scheduleSelectClass}><SelectValue /></SelectTrigger></FormControl>
                                          <SelectContent>
                                            <SelectItem value="day">Day(s)</SelectItem>
                                            <SelectItem value="week">Week(s)</SelectItem>
                                            <SelectItem value="month">Month(s)</SelectItem>
                                            <SelectItem value="year">Year(s)</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </FormItem>
                                    </>
                                  ) : null}
                                  <Button type="button" variant="outline" className="h-11 rounded-xl border-white/15 bg-background/60 px-5 hover:bg-background/75" onClick={() => saveTestScheduleTime(test.id)} disabled={savingTestId === test.id || deletingTestId === test.id}>
                                    <Clock3 className="mr-2 h-3.5 w-3.5" />
                                    {savingTestId === test.id ? 'Saving...' : 'Update Test'}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-11 rounded-xl border-red-400/25 bg-red-500/10 px-5 text-red-100 hover:bg-red-500/20 hover:text-red-50"
                                    onClick={() => setTestToDelete(test)}
                                    disabled={savingTestId === test.id || deletingTestId === test.id}
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    {deletingTestId === test.id ? 'Deleting...' : 'Delete Test'}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                      </form>
                    </Form>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <AlertDialog
          open={purchaseAvailabilityDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setPurchaseAvailabilityDialog(buildEmptyPurchaseAvailabilityDialogState());
            }
          }}
        >
          <AlertDialogContent className="border-white/10 bg-slate-950 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>{purchaseAvailabilityDialog.title}</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-300">
                {purchaseAvailabilityDialog.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white">
                Close
              </AlertDialogCancel>
              <AlertDialogAction asChild className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                <Link href="/teacher/premium-questions">Buy More Questions</Link>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={!!testToDelete}
          onOpenChange={(open) => {
            if (!open && !deletingTestId) {
              setTestToDelete(null);
            }
          }}
        >
          <AlertDialogContent className="border-white/10 bg-slate-950 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this scheduled test?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-300">
                {testToDelete?.title || 'This test'} will be removed from the live batch schedule. Students will no longer see it in the batch test list.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel
                disabled={Boolean(deletingTestId)}
                className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteScheduledTest}
                disabled={Boolean(deletingTestId)}
                className="bg-red-500 text-white hover:bg-red-400"
              >
                {deletingTestId ? 'Deleting...' : 'Delete Test'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
