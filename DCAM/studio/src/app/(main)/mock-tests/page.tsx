'use client';

import DashboardHeader from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Compass, Filter, Info, Layers, Lock, PencilLine, PlusCircle, RotateCcw, Search, SlidersHorizontal, Sparkles, Target, Trash2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { collection, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useIsSubscribed } from '@/hooks/useIsSubscribed';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useToast } from '@/hooks/use-toast';
import { isStandaloneMockTest } from '@/lib/mock-test-visibility';
import { cn } from '@/lib/utils';
import { ALLOWED_TEACHER_AUTHOR_EMAIL, getTeacherAuthoringRestrictionCopy, isAllowedTeacherAuthorEmail } from '@/lib/teacher-authoring';
import {
  getLiveBatchTestAttemptState,
  hasPaidLiveBatchTestTokenAccessAtStart,
  resolveLiveBatchTestSchedule,
} from '@/lib/live-batch-test-access';
import type { LiveBatchEnrollmentLike, LiveBatchSessionLike } from '@/lib/live-batch-session-access';
import { formatTestDurationLabel } from '@/lib/test-duration';

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string; examTypeId: string };
type Subject = { id: string; name: string; classId: string };
type UserProfile = {
  id: string;
  email?: string;
  roleId?: 'student' | 'teacher' | 'admin';
  status?: 'active' | 'blocked';
};
type MockTestSubjectConfig = {
  subjectId: string;
  questionType: '' | 'All' | 'MCQ' | 'Numerical' | 'Text';
  difficultyLevel: '' | 'All' | 'Easy' | 'Medium' | 'Hard';
};
type OfficialTest = {
  id: string;
  title: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  startTime: { toDate: () => Date };
  examTypeId: string;
  classId?: string;
  examLevel?: 'All' | 'weak' | 'medium' | 'strong';
  teacherId?: string;
  isCourseOnly?: boolean;
  courseId?: string;
  accessLevel: 'free' | 'paid';
  publicationStatus?: 'draft' | 'published' | 'deleted';
  subscriptionAttached?: boolean;
  isLiveBatchTest?: boolean;
  liveBatchId?: string;
  availabilityMode?: 'single_day' | 'unlimited';
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledEndTime?: string;
  accessStartTime?: string;
  accessEndTime?: string;
  accessWindowEndAt?: { toDate?: () => Date } | Date | string;
  accessWindowStartAt?: { toDate?: () => Date } | Date | string;
  config: { questionIds: string[]; duration?: number | null; subjectConfigs?: MockTestSubjectConfig[] };
};
type LiveBatch = {
  id: string;
  accessLevel?: 'free' | 'paid';
};
const ALL_SUBJECTS_VALUE = '__all_subjects__';
const ALL_SUBJECTS_LABEL = 'All subjects';
const DCAM_CLASSES_MOCK_TEST_LABEL = 'DCAM Classes Mock Tests';

const normalizeText = (value?: string) => (value || '').trim().toLowerCase();
const isAllSubjectsToken = (value?: string) => {
  const normalized = normalizeText(value);
  return (
    normalized === normalizeText(ALL_SUBJECTS_VALUE) ||
    normalized === 'all' ||
    normalized === 'all_subjects' ||
    normalized === 'all subjects'
  );
};

const formatSubjectSelectionLabel = (selectedSubjectIds: string[], subjectNameById: Record<string, string>) => {
  if (selectedSubjectIds.length === 0) return ALL_SUBJECTS_LABEL;
  if (selectedSubjectIds.length === 1) return subjectNameById[selectedSubjectIds[0]] || '1 subject selected';
  return `${selectedSubjectIds.length} subjects selected`;
};

const toDateSafe = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

export default function MockTestsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isTeacher, isExplicitStudent, isLoading: isTeacherLoading } = useIsTeacher();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const canManageTeacherAuthoring = isAdmin || isAllowedTeacherAuthorEmail(user?.email);
  const isTeacherAuthoringRestricted = isTeacher && !isAdminLoading && !canManageTeacherAuthoring;
  const isStudent = !isTeacherLoading && !isAdminLoading && isExplicitStudent;
  const { isSubscribed, subscriptionPlan, isLoading: isSubscribedLoading } = useIsSubscribed();
  const rolesResolved = !isTeacherLoading && !isAdminLoading;

  const examTypesQ = useMemoFirebase(() => {
    if (!firestore || !rolesResolved || !isStudent) return null;
    return query(collection(firestore, 'exam_types'), orderBy('name'));
  }, [firestore, rolesResolved, isStudent]);
  const studentTeachersQ = useMemoFirebase(() => {
    if (!firestore || !rolesResolved || !isStudent) return null;
    return query(collection(firestore, 'users'), where('roleId', '==', 'teacher'));
  }, [firestore, rolesResolved, isStudent]);
  const classesQ = useMemoFirebase(() => {
    if (!firestore || !rolesResolved || !isStudent) return null;
    return query(collection(firestore, 'classes'), orderBy('name'));
  }, [firestore, rolesResolved, isStudent]);
  const subjectsQ = useMemoFirebase(() => {
    if (!firestore || !rolesResolved || !isStudent) return null;
    return query(collection(firestore, 'subjects'), orderBy('name'));
  }, [firestore, rolesResolved, isStudent]);
  const liveBatchesQ = useMemoFirebase(() => {
    if (!firestore || !rolesResolved || !isStudent) return null;
    return query(collection(firestore, 'live_batches'));
  }, [firestore, rolesResolved, isStudent]);
  const enrolledLiveBatchesQ = useMemoFirebase(() => {
    if (!firestore || !rolesResolved || !isStudent || !user?.uid) return null;
    return query(collection(firestore, 'users', user.uid, 'enrolled_live_batches'));
  }, [firestore, rolesResolved, isStudent, user?.uid]);
  const liveBatchSessionsQ = useMemoFirebase(() => {
    if (!firestore || !rolesResolved || !isStudent) return null;
    return query(collection(firestore, 'live_batch_sessions'));
  }, [firestore, rolesResolved, isStudent]);

  const { data: studentTeachers, isLoading: studentTeachersLoading } = useCollection<UserProfile>(studentTeachersQ);
  const ownerTeacher = useMemo(() => {
    const normalizedOwnerEmail = ALLOWED_TEACHER_AUTHOR_EMAIL.trim().toLowerCase();
    const matchedTeachers = (studentTeachers || []).filter(
      (profile) => (profile.email || '').trim().toLowerCase() === normalizedOwnerEmail
    );
    return matchedTeachers.find((profile) => profile.status !== 'blocked') || matchedTeachers[0] || null;
  }, [studentTeachers]);
  const ownerTeacherId = ownerTeacher?.id || '';
  const testsQ = useMemoFirebase(() => {
    if (!firestore) return null;
    if (!rolesResolved) return null;
    if (isTeacher && !isAdmin && user?.uid) {
      return query(collection(firestore, 'mock_tests'), where('teacherId', '==', user.uid));
    }
    if (isStudent) {
      if (!ownerTeacherId) return null;
      return query(collection(firestore, 'mock_tests'), where('teacherId', '==', ownerTeacherId));
    }
    if (isAdmin) {
      return query(collection(firestore, 'mock_tests'), orderBy('startTime', 'desc'));
    }
    return null;
  }, [firestore, rolesResolved, isTeacher, isAdmin, isStudent, user?.uid, ownerTeacherId]);
  const { data: examTypes, isLoading: examLoading } = useCollection<ExamType>(examTypesQ);
  const { data: classes, isLoading: classLoading } = useCollection<ClassItem>(classesQ);
  const { data: subjects, isLoading: subjectLoading } = useCollection<Subject>(subjectsQ);
  const { data: tests, isLoading: testsLoading } = useCollection<OfficialTest>(testsQ);
  const { data: liveBatches, isLoading: liveBatchesLoading } = useCollection<LiveBatch>(liveBatchesQ);
  const { data: enrolledLiveBatches, isLoading: enrolledLiveBatchesLoading } = useCollection<LiveBatchEnrollmentLike>(enrolledLiveBatchesQ);
  const { data: liveBatchSessions, isLoading: liveBatchSessionsLoading } = useCollection<LiveBatchSessionLike>(liveBatchSessionsQ);

  const [examId, setExamId] = useState('');
  const [classId, setClassId] = useState('');
  const [examLevel, setExamLevel] = useState<'' | 'All' | 'weak' | 'medium' | 'strong'>('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [applied, setApplied] = useState<{ examId: string; classId: string; examLevel: 'All' | 'weak' | 'medium' | 'strong'; subjectIds: string[] } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const view = searchParams.get('view');

  useEffect(() => {
    if (!isTeacherAuthoringRestricted) return;
    setSelectedTestIds([]);
    setIsDeleteDialogOpen(false);
  }, [isTeacherAuthoringRestricted]);

  const filteredClasses = useMemo(
    () => (examId ? (classes || []).filter((c) => c.examTypeId === examId) : []),
    [classes, examId]
  );
  const filteredSubjects = useMemo(
    () => (classId ? (subjects || []).filter((s) => s.classId === classId) : []),
    [subjects, classId]
  );
  const examNameById = useMemo(() => Object.fromEntries((examTypes || []).map((e) => [e.id, e.name])), [examTypes]);
  const classNameById = useMemo(() => Object.fromEntries((classes || []).map((c) => [c.id, c.name])), [classes]);
  const subjectNameById = useMemo(() => Object.fromEntries((subjects || []).map((s) => [s.id, s.name])), [subjects]);
  const subjectIdByNameKey = useMemo(
    () =>
      Object.fromEntries(
        (subjects || [])
          .filter((s) => !!s.name)
          .map((s) => [normalizeText(s.name), s.id])
      ),
    [subjects]
  );
  const examTypeOptions = useMemo(() => examTypes || [], [examTypes]);

  useEffect(() => {
    if (!filteredClasses.length) return setClassId('');
    if (classId && !filteredClasses.some((c) => c.id === classId)) setClassId('');
  }, [filteredClasses, classId]);

  useEffect(() => {
    setSelectedSubjectIds((current) => current.filter((id) => filteredSubjects.some((subject) => subject.id === id)));
  }, [filteredSubjects]);

  const liveBatchById = useMemo(
    () => Object.fromEntries((liveBatches || []).map((batch) => [batch.id, batch])),
    [liveBatches]
  );
  const enrolledLiveBatchById = useMemo(
    () =>
      Object.fromEntries(
        (enrolledLiveBatches || [])
          .filter((record: any) => record?.adminAccessDisabled !== true)
          .map((record: any) => [record.id, record])
      ),
    [enrolledLiveBatches]
  ) as Record<string, LiveBatchEnrollmentLike>;
  const liveBatchSessionsByBatchId = useMemo(() => {
    const grouped: Record<string, LiveBatchSessionLike[]> = {};
    (liveBatchSessions || []).forEach((session: any) => {
      const batchId = String(session.batchId || '').trim();
      if (!batchId) return;
      if (!grouped[batchId]) grouped[batchId] = [];
      grouped[batchId].push(session);
    });
    return grouped;
  }, [liveBatchSessions]);

  const studentVisibleTests = useMemo(() => {
    const now = new Date();
    const published = (tests || []).filter(
      (t) =>
        isStandaloneMockTest(t) &&
        t.publicationStatus !== 'draft' &&
        t.publicationStatus !== 'deleted' &&
        !(t.accessLevel === 'paid' && t.subscriptionAttached !== true && !t.isLiveBatchTest)
    );
    return published.filter((t) => {
      if (t.isLiveBatchTest) {
        const liveBatchId = String(t.liveBatchId || '').trim();
        if (!liveBatchId) return false;
        const enrollment = enrolledLiveBatchById[liveBatchId];
        if (!enrollment) return false;

        const accessState = getLiveBatchTestAttemptState(t, now);
        if (accessState === 'after_access_end' || accessState === 'after_test_end') return false;

        const resolvedSchedule = resolveLiveBatchTestSchedule(t);
        const hasStarted = !!resolvedSchedule.testStartAt && now.getTime() >= resolvedSchedule.testStartAt.getTime();
        const isPaidLiveBatch = (liveBatchById[liveBatchId]?.accessLevel || 'free') === 'paid';
        if (isPaidLiveBatch && hasStarted) {
          const hasTokenAccess = hasPaidLiveBatchTestTokenAccessAtStart({
            test: t,
            enrollment,
            sessions: liveBatchSessionsByBatchId[liveBatchId] || [],
          });
          if (!hasTokenAccess) return false;
        }
      }
      if (!applied) return true;
      const selectedExamName = examNameById[applied.examId];
      const selectedClassName = classNameById[applied.classId];
      const matchesExam = t.examTypeId === applied.examId || normalizeText(t.examTypeId) === normalizeText(selectedExamName);
      const matchesClass = t.classId === applied.classId || normalizeText(t.classId) === normalizeText(selectedClassName);
      if (!matchesExam || !matchesClass) return false;
      const level = normalizeText(t.examLevel || 'medium');
      if (applied.examLevel !== 'All' && level !== applied.examLevel) return false;
      const cfg = t.config?.subjectConfigs || [];
      if (applied.subjectIds.length === 0) return true;
      if (cfg.some((c) => isAllSubjectsToken(c.subjectId))) return true;
      const configuredSubjectIds = new Set(
        cfg
          .map((c) => subjectIdByNameKey[normalizeText(c.subjectId)] || c.subjectId)
          .filter(Boolean)
      );
      return applied.subjectIds.every((subjectId) => configuredSubjectIds.has(subjectId));
    }).sort((a, b) => {
      const aDate = resolveLiveBatchTestSchedule(a).testStartAt || toDateSafe(a.startTime);
      const bDate = resolveLiveBatchTestSchedule(b).testStartAt || toDateSafe(b.startTime);
      return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
    });
  }, [tests, applied, examNameById, classNameById, subjectIdByNameKey, enrolledLiveBatchById, liveBatchById, liveBatchSessionsByBatchId]);

  const loading = isStudent
    ? (isTeacherLoading || isAdminLoading || isSubscribedLoading || studentTeachersLoading || examLoading || classLoading || subjectLoading || testsLoading || liveBatchesLoading || enrolledLiveBatchesLoading || liveBatchSessionsLoading)
    : (isTeacherLoading || isAdminLoading || testsLoading);

  const teacherTests = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const base = (tests || []).filter((t) => {
      if (!isStandaloneMockTest(t)) return false;
      if (t.isLiveBatchTest) {
        if (t.availabilityMode === 'unlimited') {
          const startAt = resolveLiveBatchTestSchedule(t).testStartAt;
          if (!startAt || format(startAt, 'yyyy-MM-dd') > todayKey) return false;
        } else if (t.scheduledDate !== todayKey) {
          return false;
        }
      }
      if (t.publicationStatus === 'deleted') return false;
      return true;
    });

    const isWaitingForSubscription = (t: OfficialTest) => t.accessLevel === 'paid' && t.subscriptionAttached !== true;
    const isOwnedByCurrentUser = (t: OfficialTest) => isAdmin || t.teacherId === user?.uid;

    if (view === 'waiting-subscription') {
      return base.filter((t) => isOwnedByCurrentUser(t) && isWaitingForSubscription(t));
    }

    if (view === 'draft') {
      return base.filter((t) => isOwnedByCurrentUser(t) && t.publicationStatus === 'draft' && !isWaitingForSubscription(t));
    }

    if (view === 'your') {
      return base.filter((t) => isOwnedByCurrentUser(t) && t.publicationStatus !== 'draft' && !isWaitingForSubscription(t));
    }

    return base.filter((t) => t.publicationStatus !== 'draft' || isAdmin || t.teacherId === user?.uid);
  }, [tests, isAdmin, user?.uid, view]);

  const deletableTeacherTests = useMemo(
    () => teacherTests.filter((t) => isAdmin || t.teacherId === user?.uid),
    [teacherTests, isAdmin, user?.uid]
  );

  const examDifficultyLabel = examLevel || 'All';
  const selectedSubjectLabel = formatSubjectSelectionLabel(selectedSubjectIds, subjectNameById);
  const selectedExamName = examId ? examNameById[examId] || 'Selected exam' : '';
  const selectedClassName = classId ? classNameById[classId] || 'Selected curriculum' : '';
  const currentFilterSignature = JSON.stringify({
    examId,
    classId,
    examLevel: examDifficultyLabel,
    subjectIds: [...selectedSubjectIds].sort(),
  });
  const appliedFilterSignature = applied
    ? JSON.stringify({
        examId: applied.examId,
        classId: applied.classId,
        examLevel: applied.examLevel,
        subjectIds: [...applied.subjectIds].sort(),
      })
    : '';
  const hasConfiguredDraftFilters =
    Boolean(examId)
    || Boolean(classId)
    || Boolean(examLevel && examLevel !== 'All')
    || selectedSubjectIds.length > 0;
  const hasPendingFilterChanges = applied ? currentFilterSignature !== appliedFilterSignature : hasConfiguredDraftFilters;
  const selectedExamLabel = examId ? (examNameById[examId] || 'Selected exam') : 'All exams';
  const selectedClassLabel = classId ? (classNameById[classId] || 'Selected curriculum') : 'All curricula';
  const activeFilterCount =
    Number(Boolean(examId))
    + Number(Boolean(classId))
    + Number(Boolean(examLevel && examLevel !== 'All'))
    + Number(selectedSubjectIds.length > 0);
  const appliedSubjectLabel = applied
    ? formatSubjectSelectionLabel(applied.subjectIds, subjectNameById)
    : 'All subjects';
  const canSearch =
    !!examId &&
    !!classId;
  const searchGuidance = useMemo(() => {
    if (!examId) {
      return {
        tone: 'info' as const,
        title: 'Start with exam selection',
        description: 'Choose your exam first to unlock the right curriculum and subject options.',
      };
    }
    if (filteredClasses.length === 0) {
      return {
        tone: 'warning' as const,
        title: 'Curriculum is not available yet',
        description: `Curriculum setup for ${selectedExamName || 'this exam'} is still being prepared on DCAM Classes.`,
      };
    }
    if (!classId) {
      return {
        tone: 'warning' as const,
        title: 'Choose your curriculum next',
        description: 'Select a curriculum to load the available subjects for this mock-test search.',
      };
    }
    if (filteredSubjects.length === 0) {
      return {
        tone: 'warning' as const,
        title: 'Subjects are being prepared',
        description: 'No subjects are mapped for this curriculum yet. You can still search all DCAM Classes mock tests in this track.',
      };
    }
    if (selectedSubjectIds.length === 0) {
      return {
        tone: 'info' as const,
        title: 'No subject filter selected',
        description: 'Search will include all DCAM Classes mock tests available under this curriculum.',
      };
    }
    return {
      tone: 'success' as const,
      title: 'Filters are ready',
      description: `${selectedSubjectIds.length} subject filter${selectedSubjectIds.length > 1 ? 's are' : ' is'} selected. Click search to refresh your mock-test list.`,
    };
  }, [examId, filteredClasses.length, classId, filteredSubjects.length, selectedSubjectIds.length, selectedExamName]);
  const sectionGuideSteps = [
    {
      title: 'Choose exam',
      description: 'Set your exam and curriculum to unlock the right mock-test pool.',
      icon: Compass,
    },
    {
      title: 'Choose subject',
      description: 'Pick a subject after curriculum selection to refine your results naturally.',
      icon: Layers,
    },
    {
      title: 'Start your test',
      description: 'Open the best-fit DCAM Classes mock test and begin your attempt.',
      icon: TrendingUp,
    },
  ];
  const toggleSubject = (subjectId: string, checked: boolean) => {
    setSelectedSubjectIds((current) =>
      checked ? (current.includes(subjectId) ? current : [...current, subjectId]) : current.filter((id) => id !== subjectId)
    );
  };

  const applySearchFilters = () => {
    setApplied({
      examId,
      classId,
      examLevel: (examLevel || 'All') as 'All' | 'weak' | 'medium' | 'strong',
      subjectIds: [...selectedSubjectIds],
    });
  };

  const resetFilters = () => {
    setExamId('');
    setClassId('');
    setExamLevel('');
    setSelectedSubjectIds([]);
    setApplied(null);
  };

  if (isStudent) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title={DCAM_CLASSES_MOCK_TEST_LABEL} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
          <Card className="relative isolate overflow-hidden border-sky-300/25 bg-gradient-to-br from-slate-950 via-blue-950/60 to-indigo-950/55 shadow-[0_26px_60px_-34px_rgba(56,189,248,0.62)]">
            <div className="pointer-events-none absolute right-[-90px] top-[-85px] h-56 w-56 rounded-full bg-cyan-400/30 blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-90px] left-[-80px] h-56 w-56 rounded-full bg-blue-500/25 blur-3xl" />
            <CardContent className="relative p-6 md:p-8">
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    DCAM Classes Library
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight md:text-3xl xl:text-[2rem]">Explore DCAM Classes Mock Tests</h2>
                  <p className="max-w-3xl text-sm leading-relaxed text-slate-200/90 md:text-base">
                    Browse official DCAM Classes mock tests and use exam, curriculum, and optional subject filters to find the right test quickly.
                  </p>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <div className="rounded-xl border border-sky-300/25 bg-sky-500/[0.1] p-3">
                      <p className="text-[11px] uppercase tracking-wide text-sky-200">Filter</p>
                      <p className="mt-1 text-sm font-semibold">Exam + Curriculum</p>
                    </div>
                    <div className="rounded-xl border border-indigo-300/25 bg-indigo-500/[0.12] p-3">
                      <p className="text-[11px] uppercase tracking-wide text-indigo-200">Source</p>
                      <p className="mt-1 text-sm font-semibold">DCAM Classes</p>
                    </div>
                    <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/[0.1] p-3">
                      <p className="text-[11px] uppercase tracking-wide text-cyan-200">Goal</p>
                      <p className="mt-1 text-sm font-semibold">Exam Readiness</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-sky-300/20 bg-slate-900/50 p-4 sm:p-5">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-sky-200">How It Works</p>
                  <div className="space-y-3">
                    {sectionGuideSteps.map((step, index) => {
                      const StepIcon = step.icon;
                      return (
                        <div key={step.title} className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-3">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-200/55 bg-cyan-500/18 text-xs font-semibold text-cyan-100">
                            {index + 1}
                          </span>
                          <div className="space-y-1">
                            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                              <StepIcon className="h-3.5 w-3.5 text-slate-300" />
                              {step.title}
                            </p>
                            <p className="text-xs leading-relaxed text-slate-300/95">{step.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full border-border/70 bg-background/35 px-3 py-1.5 text-[12px]">
                {selectedExamLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-background/35 px-3 py-1.5 text-[12px]">
                {selectedClassLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-background/35 px-3 py-1.5 text-[12px]">
                {examDifficultyLabel} level
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-background/35 px-3 py-1.5 text-[12px]">
                {selectedSubjectLabel}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {(hasConfiguredDraftFilters || applied) ? (
                <Button type="button" variant="outline" onClick={resetFilters} className="h-11 rounded-full border-border/70 bg-background/35 px-5">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-cyan-300/45 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-5 font-semibold text-slate-950 shadow-[0_16px_34px_-14px_rgba(56,189,248,0.9)] transition-all duration-300 hover:-translate-y-[1px] hover:from-cyan-300 hover:via-sky-300 hover:to-blue-400"
                onClick={() => setShowFilters((current) => !current)}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
                <span className="ml-2 rounded-full border border-slate-950/10 bg-slate-950/10 px-2 py-0.5 text-[11px] text-slate-950/80">
                  {activeFilterCount}
                </span>
              </Button>
            </div>
          </div>

          {showFilters ? (
          <Card className="border-border/70 bg-gradient-to-b from-slate-900/70 via-slate-900/40 to-slate-950/25 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.9)]">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-xl md:text-2xl">
                <Filter className="h-5 w-5" />
                Search Filters
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed text-muted-foreground/95">Choose exam and curriculum, then optionally narrow results by subject and level.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-slate-950/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.13em] text-sky-200">Exam</p>
                  <Select value={examId} onValueChange={setExamId}>
                    <SelectTrigger className="mt-2 h-11 rounded-xl border-border/70 bg-background/40">
                      <SelectValue placeholder="Select exam" />
                    </SelectTrigger>
                    <SelectContent>{examTypeOptions.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="rounded-xl border border-border/70 bg-slate-950/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.13em] text-indigo-200">Curriculum</p>
                  <Select value={classId} onValueChange={setClassId} disabled={!examId}>
                    <SelectTrigger className="mt-2 h-11 rounded-xl border-border/70 bg-background/40">
                      <SelectValue placeholder={examId && filteredClasses.length === 0 ? 'No curriculum available for this exam' : 'Select curriculum/class'} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredClasses.length > 0 ? (
                        filteredClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                      ) : (
                        <SelectItem value="__no_curriculum__" disabled>
                          Curriculum will appear here once it is available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-xl border border-border/70 bg-slate-900/55 p-4 md:col-span-2">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold">Subjects (optional)</p>
                    <Badge variant="outline" className="rounded-full border-cyan-300/30 bg-cyan-500/10 text-cyan-100">
                      {selectedSubjectIds.length} selected
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    {filteredSubjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground md:col-span-3">
                        {!examId
                          ? 'Select an exam first to unlock curriculum and subject options.'
                          : filteredClasses.length === 0
                            ? 'This exam has no curriculum configured yet. Subjects will appear after curriculum is added.'
                            : !classId
                              ? 'Choose your curriculum to load available subjects.'
                              : 'No subjects are mapped for this curriculum yet.'}
                      </p>
                    ) : (
                      filteredSubjects.map((subject) => (
                        <label
                          key={subject.id}
                          className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/45 px-3 py-2 text-sm transition hover:border-cyan-300/40 hover:bg-cyan-500/10"
                        >
                          <Checkbox
                            checked={selectedSubjectIds.includes(subject.id)}
                            onCheckedChange={(checked) => toggleSubject(subject.id, !!checked)}
                          />
                          <span>{subject.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-3.5 md:col-span-2 xl:col-span-1',
                    searchGuidance.tone === 'success'
                      ? 'border-emerald-300/35 bg-emerald-500/10'
                      : searchGuidance.tone === 'warning'
                        ? 'border-amber-300/35 bg-amber-500/10'
                        : 'border-cyan-300/35 bg-cyan-500/10'
                  )}
                >
                  {searchGuidance.tone === 'success' ? (
                    <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 text-emerald-300" />
                  ) : searchGuidance.tone === 'warning' ? (
                    <AlertTriangle className="mt-0.5 h-4.5 w-4.5 text-amber-300" />
                  ) : (
                    <Info className="mt-0.5 h-4.5 w-4.5 text-cyan-300" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">{searchGuidance.title}</p>
                    <p className="text-sm text-muted-foreground">{searchGuidance.description}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/[0.08] p-4">
                  <p className="text-[11px] uppercase tracking-[0.13em] text-cyan-200">Test Level</p>
                  <Select value={examLevel} onValueChange={(v) => setExamLevel(v as typeof examLevel)}>
                    <SelectTrigger className="mt-2 h-11 rounded-xl border-border/70 bg-background/40">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="weak">Weak</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="strong">Strong</SelectItem></SelectContent>
                  </Select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Keep this on <span className="font-medium text-foreground">All</span> to see every matching DCAM Classes mock test level.
                  </p>
                </div>
              </div>

              <div className={cn(
                'rounded-xl border p-4',
                hasPendingFilterChanges
                  ? 'border-cyan-300/40 bg-cyan-500/10'
                  : 'border-emerald-300/35 bg-emerald-500/10'
              )}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Current Selection</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-border/70 bg-background/35">{selectedExamLabel}</Badge>
                  <Badge variant="outline" className="border-border/70 bg-background/35">{selectedClassLabel}</Badge>
                  <Badge variant="outline" className="border-border/70 bg-background/35">{selectedSubjectLabel}</Badge>
                  <Badge variant="outline" className="border-border/70 bg-background/35">{examDifficultyLabel} level</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {hasPendingFilterChanges ? 'You changed filters. Click search to refresh test results.' : 'Results are synced with your current filter selection.'}
                </p>
              </div>
              {examId && filteredClasses.length === 0 ? (
                <div className="rounded-xl border border-amber-300/35 bg-gradient-to-r from-amber-500/15 via-amber-500/8 to-transparent p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 rounded-full border border-amber-300/40 bg-amber-500/15 p-1.5">
                      <Info className="h-3.5 w-3.5 text-amber-100" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-100">This exam track is opening soon on DCAM</p>
                      <p className="mt-0.5 text-xs text-amber-100/85">
                        Curriculum setup for this exam is in progress. Select another exam now, or check back shortly for fresh mock paths.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
              {classId && filteredSubjects.length === 0 ? (
                <div className="rounded-xl border border-amber-300/35 bg-gradient-to-r from-amber-500/15 via-amber-500/8 to-transparent p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 rounded-full border border-amber-300/40 bg-amber-500/15 p-1.5">
                      <Info className="h-3.5 w-3.5 text-amber-100" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-100">Subjects for this curriculum are being prepared</p>
                      <p className="mt-0.5 text-xs text-amber-100/85">
                        Subject-level mock setup is currently updating. Try another curriculum for instant practice, or revisit soon.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={resetFilters} className="h-11 rounded-full border-border/70 bg-background/35 px-5">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
                <Button
                  type="button"
                  className="h-11 rounded-full border border-cyan-300/40 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-400 px-6 font-semibold text-slate-950 shadow-[0_12px_28px_-12px_rgba(56,189,248,0.82)] transition-all duration-300 hover:translate-y-[-1px] hover:from-cyan-300 hover:via-sky-300 hover:to-blue-300 hover:shadow-[0_16px_30px_-12px_rgba(56,189,248,0.9)]"
                  onClick={applySearchFilters}
                  disabled={!canSearch}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Search DCAM Classes Mock Tests
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {canSearch
                  ? `Ready to search${selectedExamName ? ` in ${selectedExamName}` : ''}${selectedClassName ? ` / ${selectedClassName}` : ''}.`
                  : examId && filteredClasses.length === 0
                    ? 'Search unlocks after a curriculum is available for the selected exam.'
                    : 'Search unlocks after selecting both exam and curriculum.'}
              </p>
            </CardContent>
          </Card>
          ) : null}

          <Card className="border-border/70 bg-gradient-to-r from-slate-950/90 via-cyan-950/24 to-blue-950/16">
            <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Result Window</p>
                <p className="mt-1 text-lg font-semibold">
                  {studentVisibleTests.length} {studentVisibleTests.length === 1 ? 'DCAM Classes Mock Test' : 'DCAM Classes Mock Tests'} {applied ? 'matched' : 'available'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {applied
                    ? 'Results match your latest exam, curriculum, subject, and level filters.'
                    : `Showing all ${DCAM_CLASSES_MOCK_TEST_LABEL.toLowerCase()} available to you. Open filters when you want to narrow the list.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-border/70 bg-background/35">{applied ? (examNameById[applied.examId] || 'Exam') : 'All exams'}</Badge>
                <Badge variant="outline" className="border-border/70 bg-background/35">{applied ? (classNameById[applied.classId] || 'Curriculum') : 'All curricula'}</Badge>
                <Badge variant="outline" className="border-border/70 bg-background/35">{applied ? `${applied.examLevel} level` : 'All levels'}</Badge>
                <Badge variant="outline" className="border-border/70 bg-background/35">{applied ? appliedSubjectLabel : 'All subjects'}</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {!loading && studentVisibleTests.length === 0 ? (
              <Card className="col-span-full border-dashed">
                <CardContent className="space-y-3 p-10 text-center text-muted-foreground">
                  <Target className="mx-auto h-6 w-6" />
                  <p className="text-sm">
                    {applied
                      ? `No matching ${DCAM_CLASSES_MOCK_TEST_LABEL.toLowerCase()} were found for this configuration.`
                      : ownerTeacherId
                        ? `No ${DCAM_CLASSES_MOCK_TEST_LABEL.toLowerCase()} are available yet.`
                        : `${DCAM_CLASSES_MOCK_TEST_LABEL} are getting ready.`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {applied
                      ? 'Try different subjects or clear filters to discover more options.'
                      : ownerTeacherId
                        ? `Please check again later as new ${DCAM_CLASSES_MOCK_TEST_LABEL.toLowerCase()} are published.`
                        : 'Please try again shortly while the DCAM Classes test library is being prepared.'}
                  </p>
                  <div className="flex justify-center">
                    <Button type="button" variant="outline" className="rounded-full" onClick={resetFilters}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {applied ? 'Clear All Filters' : 'Reset Filters'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            {loading ? <><Skeleton className="h-52 w-full" /><Skeleton className="h-52 w-full" /></> : null}
            {studentVisibleTests.map((t) => {
              const paid = t.accessLevel === 'paid';
              const unlocked = t.isLiveBatchTest ? true : (!paid || (isSubscribed && subscriptionPlan?.examTypeId === t.examTypeId));
              const liveBatchSchedule = resolveLiveBatchTestSchedule(t);
              const startDate = liveBatchSchedule.testStartAt || toDateSafe(t.startTime);
              const accessEndDate = liveBatchSchedule.availabilityEndAt;
              const upcoming = startDate ? startDate > new Date() : false;
              const accessClosed = accessEndDate ? accessEndDate.getTime() < Date.now() : false;
              const subjectsText =
                Array.from(
                  new Set(
                    (t.config.subjectConfigs || [])
                      .map((c) => {
                        if (isAllSubjectsToken(c.subjectId)) return ALL_SUBJECTS_LABEL;
                        return subjectNameById[c.subjectId] || c.subjectId || '';
                      })
                      .filter(Boolean)
                  )
                ).join(', ') || 'N/A';
              const thumb = t.thumbnailUrl || t.imageUrl;
              const statusLabel = upcoming && startDate
                ? `Starts ${formatDistanceToNow(startDate, { addSuffix: true })}`
                : (accessClosed ? 'Access Closed' : 'Ready to Start');
              return (
                <Card key={t.id} className="group relative flex flex-col overflow-hidden border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/88 to-blue-950/78 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-sky-300/55 hover:shadow-[0_20px_42px_-24px_rgba(34,211,238,0.55)]">
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(56,189,248,0.2),transparent_48%)]" />
                  </div>

                  {thumb ? (
                    <div className="relative h-32 w-full overflow-hidden border-b border-border/60">
                      <img src={thumb} alt={t.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                    </div>
                  ) : null}

                  <CardHeader className="relative space-y-2 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-cyan-300/35 bg-cyan-500/10 text-cyan-100">
                        DCAM Classes
                      </Badge>
                      <Badge className={paid ? 'border-rose-300/45 bg-rose-500/15 text-rose-100' : 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100'}>
                        {paid ? 'Premium' : 'Free'}
                      </Badge>
                    </div>
                    <CardTitle className="line-clamp-2 text-xl font-semibold leading-tight tracking-tight">{t.title}</CardTitle>
                    <CardDescription className="text-sm text-slate-300">
                      {(examNameById[t.examTypeId] || 'General')} | {startDate ? format(startDate, 'PPP p') : 'Schedule pending'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="relative space-y-3 pt-0">
                    <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-cyan-300/35 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-100">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {statusLabel}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-muted-foreground">
                        Questions
                        <p className="mt-1 text-sm font-semibold text-foreground">{t.config.questionIds?.length || 0}</p>
                      </div>
                      <div className="rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-muted-foreground">
                        Duration
                        <p className="mt-1 text-sm font-semibold text-foreground">{formatTestDurationLabel(t.config.duration)}</p>
                      </div>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">Subjects: {subjectsText}</p>
                  </CardContent>

                  <CardFooter className="grid grid-cols-2 gap-2 pt-1">
                    {unlocked ? (
                      <>
                        <Button asChild variant="outline" className="rounded-full border-slate-600/80 bg-slate-900/75 hover:bg-slate-800/85" disabled={upcoming}>
                          <Link href={`/mock-tests/${t.id}`}>View Test</Link>
                        </Button>
                        <Button asChild className="rounded-full border border-cyan-300/40 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-400 font-semibold text-slate-950 hover:from-cyan-300 hover:via-sky-300 hover:to-blue-300" disabled={upcoming || accessClosed}>
                          <Link href={`/mock-tests/${t.id}/start`}>
                            {upcoming && startDate
                              ? `Starts ${formatDistanceToNow(startDate, { addSuffix: true })}`
                              : accessClosed
                                ? 'Access Closed'
                                : 'Start Test'}
                            {!upcoming && !accessClosed ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                          </Link>
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button asChild variant="outline" className="rounded-full border-slate-600/80 bg-slate-900/75 hover:bg-slate-800/85">
                          <Link href={`/mock-tests/${t.id}`}>View Test</Link>
                        </Button>
                        <Button asChild variant="secondary" className="rounded-full border border-amber-300/45 bg-amber-500/12 text-amber-100 hover:bg-amber-500/20">
                          <Link href="/subscription"><Lock className="mr-2 h-4 w-4" />Subscribe</Link>
                        </Button>
                      </>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  const toggleSelectTest = (testId: string) => {
    if (isTeacherAuthoringRestricted) return;
    setSelectedTestIds((prev) => (prev.includes(testId) ? prev.filter((id) => id !== testId) : [...prev, testId]));
  };

  const clearSelection = () => setSelectedTestIds([]);

  const handleDeleteSelected = async () => {
    if (isTeacherAuthoringRestricted) {
      toast({
        variant: 'destructive',
        title: 'Mock test editing disabled',
        description: getTeacherAuthoringRestrictionCopy(),
      });
      return;
    }
    if (!firestore || selectedTestIds.length === 0) return;
    setIsDeleting(true);
    try {
      const selectedSet = new Set(selectedTestIds);
      const selectedTests = deletableTeacherTests.filter((t) => selectedSet.has(t.id));
      let archivedCount = 0;
      let failedCount = 0;

      for (const test of selectedTests) {
        const testRef = doc(firestore, 'mock_tests', test.id);
        try {
          await updateDoc(testRef, {
            publicationStatus: 'deleted',
            deletedAt: new Date().toISOString(),
            deletedBy: user?.uid || null,
          });
          archivedCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      const linkedPlanIds: string[] = [];
      for (const test of selectedTests) {
        const plansQ = query(
          collection(firestore, 'subscription_plans'),
          where('linkedContentType', '==', 'mock_test'),
          where('linkedContentId', '==', test.id)
        );
        const plansSnap = await getDocs(plansQ);
        plansSnap.forEach((planDoc) => linkedPlanIds.push(planDoc.id));
      }

      for (const planId of linkedPlanIds) {
        try {
          await updateDoc(doc(firestore, 'subscription_plans', planId), {
            linkedContentId: null,
            linkedContentType: null,
            status: 'archived',
            archivedAt: new Date().toISOString(),
          });
        } catch {
          // Plan archival is best-effort.
        }
      }

      if (archivedCount > 0) {
        toast({
          title: 'Mock tests removed',
          description:
            failedCount > 0
              ? `${archivedCount} test(s) archived and hidden. ${failedCount} failed due to permissions.`
              : `${archivedCount} test(s) archived and hidden successfully.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Delete failed',
          description: 'No selected tests could be removed due to permission restrictions.',
        });
      }
      clearSelection();
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error?.message || 'Could not delete selected tests.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="DCAM Mock Tests" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-headline text-2xl font-semibold">Available DCAM Mock Tests</h2>
          <div className="flex gap-2">
            {!isTeacherAuthoringRestricted && selectedTestIds.length > 0 ? (
              <>
                <Button variant="outline" onClick={clearSelection}>
                  Clear ({selectedTestIds.length})
                </Button>
                <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected
                </Button>
              </>
            ) : null}
            {!isTeacherAuthoringRestricted ? (
              <Button asChild variant="outline"><Link href="/mock-tests/create"><PlusCircle className="mr-2 h-4 w-4" />Create DCAM Mock Test</Link></Button>
            ) : (
              <Badge variant="secondary" className="px-3 py-2">
                Authorized Teacher: {ALLOWED_TEACHER_AUTHOR_EMAIL}
              </Badge>
            )}
          </div>
        </div>
        {isTeacherAuthoringRestricted ? (
          <Card className="mb-6 border-amber-500/30 bg-amber-500/10">
            <CardHeader>
              <CardTitle className="text-amber-100">DCAM Mock Test Editing Is Disabled For This Teacher</CardTitle>
              <CardDescription className="text-amber-100/80">
                {getTeacherAuthoringRestrictionCopy()} Existing mock tests remain visible here and stay untouched.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {loading ? <><Skeleton className="h-52 w-full" /><Skeleton className="h-52 w-full" /></> : null}
          {!loading && teacherTests.length === 0 ? <Card className="col-span-full p-8 text-center border-dashed"><p className="text-muted-foreground">No tests available.</p></Card> : null}
          {teacherTests.map((t) => {
            const startDate = toDateSafe(t.startTime);
            return (
              <Card key={t.id} className="group relative flex flex-col overflow-hidden border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-blue-950/75 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-sky-400/50 hover:shadow-sky-950/40">
              {!isTeacherAuthoringRestricted && (isAdmin || t.teacherId === user?.uid) ? (
                <label className="absolute right-3 top-3 z-20 inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-500/70 bg-slate-950/85 px-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedTestIds.includes(t.id)}
                    onChange={() => toggleSelectTest(t.id)}
                    className="h-3.5 w-3.5 accent-sky-500"
                  />
                  <span>Select</span>
                </label>
              ) : null}
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(56,189,248,0.2),transparent_48%)]" />
              </div>

              {(t.thumbnailUrl || t.imageUrl) ? (
                <div className="relative h-32 w-full overflow-hidden border-b border-border/60">
                  <img src={t.thumbnailUrl || t.imageUrl} alt={t.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                </div>
              ) : null}

              <CardHeader className="relative space-y-2 pb-3">
                <CardTitle className="line-clamp-2 text-2xl font-semibold leading-tight tracking-tight">{t.title}</CardTitle>
                <CardDescription className="text-sm text-slate-300">
                  {startDate ? format(startDate, 'PPP p') : 'Schedule pending'}
                </CardDescription>
              </CardHeader>

              <CardContent className="relative space-y-3 pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-muted-foreground">
                    Questions
                    <p className="mt-1 text-sm font-semibold text-foreground">{t.config.questionIds?.length || 0}</p>
                  </div>
                  <div className="rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-muted-foreground">
                    Duration
                    <p className="mt-1 text-sm font-semibold text-foreground">{formatTestDurationLabel(t.config.duration)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Badge className={t.accessLevel === 'paid' ? 'border-red-400/60 bg-red-500/20 text-red-100' : 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'}>
                    {t.accessLevel === 'paid' ? 'Paid' : 'Free'}
                  </Badge>
                </div>
              </CardContent>

              <CardFooter className={cn('gap-2 pt-1', isTeacherAuthoringRestricted ? 'grid grid-cols-1' : 'grid grid-cols-2')}>
                {!isTeacherAuthoringRestricted ? (
                  <Button asChild variant="outline" className="rounded-full border-slate-600/80 bg-slate-900/75 hover:bg-slate-800/85">
                    <Link href={`/mock-tests/edit/${t.id}`}><PencilLine className="mr-2 h-4 w-4" />Edit</Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline" className="rounded-full border-slate-600/80 bg-slate-900/75 hover:bg-slate-800/85">
                  <Link href={`/mock-tests/${t.id}`}>View Test</Link>
                </Button>
              </CardFooter>
              </Card>
            );
          })}
        </div>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete selected mock tests?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {selectedTestIds.length} selected test(s) and linked subscription plans.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSelected} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
