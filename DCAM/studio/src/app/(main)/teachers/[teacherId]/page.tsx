'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { collection, doc, query, where } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, BookOpenText, LayoutTemplate, Sparkles, Star, Video } from 'lucide-react';
import { normalizeScopedDifficultyPricingMap, type ScopedDifficultyPricingMap } from '@/lib/premium-pricing';
import { isTeacherQuestionPurchaseActiveAt, type TeacherQuestionPurchasePublicScope } from '@/lib/teacher-question-purchase';
import { isPublicTeacherProfile } from '@/lib/teacher-approval';

type TeachingAssignment = {
  examTypeId: string;
  classId: string;
  allSubjects?: boolean;
  subjectIds?: string[];
};

type TeacherProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  roleId?: 'student' | 'teacher' | 'admin';
  status?: 'active' | 'blocked';
  teacherStatus?: 'pending' | 'approved' | 'rejected';
  platformRating?: number;
  rating?: number;
  totalRatings?: number;
  bio?: string;
  about?: string;
  teachingAssignments?: TeachingAssignment[];
  publicTeacherQuestionPurchaseScopes?: TeacherQuestionPurchasePublicScope[];
  premiumPracticeQuestionPricingByScope?: ScopedDifficultyPricingMap;
  dcamPracticeQuestionPricingByScope?: ScopedDifficultyPricingMap;
  premiumMockTestQuestionPricingByScope?: ScopedDifficultyPricingMap;
  dcamMockTestQuestionPricingByScope?: ScopedDifficultyPricingMap;
};

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string; examTypeId: string };
type Subject = { id: string; name: string; classId: string };

type Course = {
  id: string;
  title?: string;
  description?: string;
  teacherId?: string;
  accessLevel?: 'free' | 'paid';
  subscriptionAttached?: boolean;
  publicationStatus?: 'draft' | 'published' | 'deleted';
  examTypeId?: string;
  classId?: string;
  subjectIds?: string[];
  createdAt?: { toDate?: () => Date } | Date | string;
};

type LiveBatch = {
  id: string;
  title?: string;
  description?: string;
  teacherId?: string;
  accessLevel?: 'free' | 'paid';
  publicationStatus?: 'draft' | 'published';
  subscriptionAttached?: boolean;
  examTypeId?: string;
  classId?: string;
  subjectIds?: string[];
  createdAt?: { toDate?: () => Date } | Date | string;
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

export default function TeacherProfilePage() {
  const params = useParams<{ teacherId: string }>();
  const teacherId = typeof params?.teacherId === 'string' ? params.teacherId : '';
  const firestore = useFirestore();

  const teacherDocRef = useMemoFirebase(() => (firestore && teacherId ? doc(firestore, 'users', teacherId) : null), [firestore, teacherId]);
  const examTypesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types')) : null), [firestore]);
  const classesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes')) : null), [firestore]);
  const subjectsQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects')) : null), [firestore]);

  const freeCoursesQ = useMemoFirebase(
    () => (firestore && teacherId ? query(collection(firestore, 'courses'), where('teacherId', '==', teacherId), where('accessLevel', '==', 'free')) : null),
    [firestore, teacherId]
  );
  const paidLiveCoursesQ = useMemoFirebase(
    () =>
      firestore && teacherId
        ? query(
            collection(firestore, 'courses'),
            where('teacherId', '==', teacherId),
            where('accessLevel', '==', 'paid'),
            where('subscriptionAttached', '==', true)
          )
        : null,
    [firestore, teacherId]
  );
  const publishedBatchesQ = useMemoFirebase(
    () =>
      firestore && teacherId
        ? query(collection(firestore, 'live_batches'), where('teacherId', '==', teacherId), where('publicationStatus', '==', 'published'))
        : null,
    [firestore, teacherId]
  );

  const { data: teacher, isLoading: teacherLoading } = useDoc<TeacherProfile>(teacherDocRef);
  const { data: examTypes } = useCollection<ExamType>(examTypesQ);
  const { data: classes } = useCollection<ClassItem>(classesQ);
  const { data: subjects } = useCollection<Subject>(subjectsQ);
  const { data: freeCourses, isLoading: freeCoursesLoading } = useCollection<Course>(freeCoursesQ);
  const { data: paidLiveCourses, isLoading: paidCoursesLoading } = useCollection<Course>(paidLiveCoursesQ);
  const { data: publishedBatches, isLoading: batchesLoading } = useCollection<LiveBatch>(publishedBatchesQ);

  const examNameById = useMemo(() => Object.fromEntries((examTypes || []).map((e) => [e.id, e.name])), [examTypes]);
  const classNameById = useMemo(() => Object.fromEntries((classes || []).map((c) => [c.id, c.name])), [classes]);
  const subjectNameById = useMemo(() => Object.fromEntries((subjects || []).map((s) => [s.id, s.name])), [subjects]);

  const courses = useMemo(() => {
    const merged = [...(freeCourses || []), ...(paidLiveCourses || [])];
    const unique = Array.from(new Map(merged.map((course) => [course.id, course])).values());
    return unique
      .filter((course) => course.publicationStatus !== 'draft' && course.publicationStatus !== 'deleted')
      .sort((a, b) => {
        const ad = toDate(a.createdAt)?.getTime() || 0;
        const bd = toDate(b.createdAt)?.getTime() || 0;
        return bd - ad;
      });
  }, [freeCourses, paidLiveCourses]);

  const liveBatches = useMemo(
    () =>
      (publishedBatches || [])
        .filter((batch) => batch.accessLevel !== 'paid' || batch.subscriptionAttached === true)
        .sort((a, b) => {
          const ad = toDate(a.createdAt)?.getTime() || 0;
          const bd = toDate(b.createdAt)?.getTime() || 0;
          return bd - ad;
        }),
    [publishedBatches]
  );

  const loading = teacherLoading || freeCoursesLoading || paidCoursesLoading || batchesLoading;

  const fullName = `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim() || 'Teacher';
  const aboutText = teacher?.about || teacher?.bio || 'No teacher description added yet.';
  const rating = typeof teacher?.platformRating === 'number' ? teacher.platformRating : typeof teacher?.rating === 'number' ? teacher.rating : null;
  const activePaidQuestionScopes = useMemo(
    () => (
      Array.isArray(teacher?.publicTeacherQuestionPurchaseScopes)
        ? teacher.publicTeacherQuestionPurchaseScopes.filter((scope) => isTeacherQuestionPurchaseActiveAt(scope))
        : []
    ),
    [teacher?.publicTeacherQuestionPurchaseScopes]
  );
  const practicePricingRules = useMemo(
    () => normalizeScopedDifficultyPricingMap(
      teacher?.premiumPracticeQuestionPricingByScope || teacher?.dcamPracticeQuestionPricingByScope
    ),
    [teacher?.dcamPracticeQuestionPricingByScope, teacher?.premiumPracticeQuestionPricingByScope]
  );
  const customMockPricingRules = useMemo(
    () => normalizeScopedDifficultyPricingMap(
      teacher?.premiumMockTestQuestionPricingByScope || teacher?.dcamMockTestQuestionPricingByScope
    ),
    [teacher?.dcamMockTestQuestionPricingByScope, teacher?.premiumMockTestQuestionPricingByScope]
  );
  const hasTeacherPaidQuestionScopes = activePaidQuestionScopes.length > 0;
  const canBuildPracticeSession = hasTeacherPaidQuestionScopes && Object.keys(practicePricingRules).length > 0;
  const canBuildCustomMock = hasTeacherPaidQuestionScopes && Object.keys(customMockPricingRules).length > 0;
  const singleActivePaidScope = activePaidQuestionScopes.length === 1 ? activePaidQuestionScopes[0] : null;
  const singleActivePaidScopeQuery = useMemo(() => {
    if (!singleActivePaidScope) return '';
    const params = new URLSearchParams();
    if (singleActivePaidScope.examTypeId) params.set('examTypeId', singleActivePaidScope.examTypeId);
    if (singleActivePaidScope.examTypeName) params.set('examTypeName', singleActivePaidScope.examTypeName);
    if (singleActivePaidScope.classId) params.set('classId', singleActivePaidScope.classId);
    if (singleActivePaidScope.className) params.set('className', singleActivePaidScope.className);
    if (singleActivePaidScope.subjectId) params.set('subjectIds', singleActivePaidScope.subjectId);
    return params.toString();
  }, [singleActivePaidScope]);
  const practiceBuilderHref = useMemo(() => {
    const params = new URLSearchParams({ practiceMode: 'premium' });
    if (singleActivePaidScopeQuery) {
      params.set('presetContext', 'practice_search');
      const presetParams = new URLSearchParams(singleActivePaidScopeQuery);
      presetParams.forEach((value, key) => params.set(key, value));
    }
    return `/start-practice-session/${teacherId}?${params.toString()}`;
  }, [singleActivePaidScopeQuery, teacherId]);
  const customMockBuilderHref = useMemo(() => {
    const params = new URLSearchParams({ mode: 'premium', teacherId });
    if (singleActivePaidScopeQuery) {
      const presetParams = new URLSearchParams(singleActivePaidScopeQuery);
      presetParams.forEach((value, key) => params.set(key, value));
    }
    return `/custom-mock-tests/create?${params.toString()}`;
  }, [singleActivePaidScopeQuery, teacherId]);
  const studentBuilderHelperText = !hasTeacherPaidQuestionScopes
    ? 'Paid question access is not active yet for this teacher.'
    : 'Built from the teacher\'s active DCAM paid-question scopes.';
  const practiceBuilderDescription = canBuildPracticeSession
    ? 'Build a paid practice session from this teacher\'s purchased DCAM question bank.'
    : Object.keys(practicePricingRules).length === 0
      ? 'This teacher has not published practice-session pricing yet.'
      : studentBuilderHelperText;
  const customMockBuilderDescription = canBuildCustomMock
    ? 'Build a paid custom mock from this teacher\'s purchased DCAM question bank.'
    : Object.keys(customMockPricingRules).length === 0
      ? 'This teacher has not published custom-mock pricing yet.'
      : studentBuilderHelperText;

  const scope = useMemo(() => {
    if (!teacher?.teachingAssignments?.length) return [];
    const grouped = new Map<string, { examName: string; curricula: { className: string; subjectsLabel: string }[] }>();

    teacher.teachingAssignments.forEach((assignment) => {
      const examName = examNameById[assignment.examTypeId] || 'Exam';
      const className = classNameById[assignment.classId] || 'Curriculum';
      const classSubjects = (subjects || []).filter((subject) => subject.classId === assignment.classId);
      const subjectNames = assignment.allSubjects
        ? ['All Subjects']
        : (assignment.subjectIds || []).map((id) => subjectNameById[id]).filter(Boolean);
      const fallbackSubjects = assignment.allSubjects ? [] : classSubjects.map((subject) => subject.name);
      const finalSubjects = subjectNames.length > 0 ? subjectNames : fallbackSubjects;
      const subjectsLabel = finalSubjects.join(', ') || 'Subjects not specified';

      if (!grouped.has(examName)) {
        grouped.set(examName, { examName, curricula: [] });
      }

      const group = grouped.get(examName)!;
      const existingCurriculum = group.curricula.find((item) => item.className === className);

      if (!existingCurriculum) {
        group.curricula.push({ className, subjectsLabel });
        return;
      }

      if (existingCurriculum.subjectsLabel === subjectsLabel) return;

      const mergedSubjects = Array.from(
        new Set(
          `${existingCurriculum.subjectsLabel}, ${subjectsLabel}`
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        )
      );
      existingCurriculum.subjectsLabel = mergedSubjects.join(', ');
    });

    return Array.from(grouped.values()).sort((a, b) => a.examName.localeCompare(b.examName));
  }, [teacher, examNameById, classNameById, subjects, subjectNameById]);

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Teacher Profile" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : !teacher || teacher.roleId !== 'teacher' || !isPublicTeacherProfile(teacher) ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground">Teacher profile not found.</CardContent>
            </Card>
          ) : (
            <>
              <Card className="relative overflow-hidden border border-primary/30 bg-gradient-to-br from-sky-950/45 via-slate-950/90 to-indigo-950/45 shadow-[0_24px_60px_-36px_rgba(37,99,235,0.55)]">
                <div className="pointer-events-none absolute -top-16 right-10 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 left-10 h-44 w-44 rounded-full bg-indigo-400/10 blur-3xl" />
                <CardContent className="relative pt-6">
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start">
                      <Avatar className="h-24 w-24 ring-2 ring-primary/25 shadow-lg shadow-primary/20">
                        <AvatarImage src={teacher.photoURL} />
                        <AvatarFallback>{fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-3 flex-1">
                        <div>
                          <h2 className="text-3xl font-semibold tracking-tight">{fullName}</h2>
                          <p className="text-sm text-muted-foreground">DCAM Teacher</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10">
                            <Star className="h-3 w-3" />
                            {rating !== null ? `${rating.toFixed(1)} / 5` : 'New'}
                          </Badge>
                          {typeof teacher.totalRatings === 'number' ? (
                            <span className="text-xs text-muted-foreground">({teacher.totalRatings} ratings)</span>
                          ) : null}
                          <Badge variant="outline" className="rounded-full border-cyan-300/35 bg-cyan-500/10 text-cyan-100">
                            Active Mentor
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{aboutText}</p>
                        <div className="rounded-xl border border-primary/20 bg-background/45 px-3 py-2.5 text-xs text-muted-foreground">
                          Explore this teacher&apos;s published courses and live batches below.
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 md:min-w-[240px]">
                      <div className="rounded-xl border border-border/60 bg-background/55 px-3 py-2.5 text-center">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Courses</p>
                        <p className="mt-1 text-xl font-semibold">{courses.length}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/55 px-3 py-2.5 text-center">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Batches</p>
                        <p className="mt-1 text-xl font-semibold">{liveBatches.length}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {scope.length > 0 ? (
                <Card className="border border-border/70 bg-gradient-to-r from-slate-950/45 via-slate-900/30 to-slate-950/45">
                  <CardHeader className="pb-2">
                    <CardTitle>Teaching Scope</CardTitle>
                    <CardDescription>Exam, curriculum, and subject coverage this teacher actively teaches.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="max-h-[280px] overflow-y-auto pr-1">
                      <div className="grid gap-2.5 md:grid-cols-2">
                      {scope.map((item, index) => (
                        <div
                          key={`${item.examName}-${index}`}
                          className="rounded-xl border border-border/55 bg-background/25 px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-foreground">{item.examName}</span>
                            <span className="rounded-full border border-border/60 bg-background/35 px-2 py-0.5 text-[11px] text-muted-foreground">
                              {item.curricula.length} {item.curricula.length === 1 ? 'curriculum' : 'curricula'}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {item.curricula.map((curriculum) => (
                              <div key={`${item.examName}-${curriculum.className}`} className="text-xs leading-relaxed text-muted-foreground">
                                <span className="font-medium text-foreground">{curriculum.className}</span>
                                <span className="mx-2 text-muted-foreground/60">•</span>
                                <span>{curriculum.subjectsLabel}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card className={canBuildPracticeSession ? 'border border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/82 to-emerald-950/40' : 'border border-dashed border-border/70 bg-background/40'}>
                  <CardHeader className="pb-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="inline-flex items-center gap-2 text-2xl">
                        <Sparkles className="h-6 w-6 text-emerald-300" />
                        Practice Session
                      </CardTitle>
                      <Badge variant="outline" className="rounded-full border-emerald-300/35 bg-emerald-500/10 text-emerald-100">
                        {activePaidQuestionScopes.length} active scopes
                      </Badge>
                    </div>
                    <CardDescription className="text-sm leading-relaxed">
                      {practiceBuilderDescription}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
                      Student pricing comes from the teacher&apos;s Subscription settings and uses only their active paid question scope.
                    </div>
                    {canBuildPracticeSession ? (
                      <Link href={practiceBuilderHref} className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-100">
                        Build practice session
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/35 px-3 py-1.5 text-sm text-muted-foreground">
                        Not available yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className={canBuildCustomMock ? 'border border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/82 to-sky-950/40' : 'border border-dashed border-border/70 bg-background/40'}>
                  <CardHeader className="pb-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="inline-flex items-center gap-2 text-2xl">
                        <LayoutTemplate className="h-6 w-6 text-sky-300" />
                        Custom Mock Test
                      </CardTitle>
                      <Badge variant="outline" className="rounded-full border-sky-300/35 bg-sky-500/10 text-sky-100">
                        {activePaidQuestionScopes.length} active scopes
                      </Badge>
                    </div>
                    <CardDescription className="text-sm leading-relaxed">
                      {customMockBuilderDescription}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
                      Students use the teacher&apos;s custom-mock pricing and attempt rules saved in Subscription.
                    </div>
                    {canBuildCustomMock ? (
                      <Link href={customMockBuilderHref} className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100">
                        Build custom mock test
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/35 px-3 py-1.5 text-sm text-muted-foreground">
                        Not available yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Link href={`/teachers/${teacherId}/courses`} className="block h-full">
                  <Card className="group h-full border border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/82 to-cyan-950/45 transition hover:-translate-y-0.5 hover:border-cyan-300/45 hover:shadow-[0_20px_40px_-28px_rgba(56,189,248,0.55)]">
                    <CardHeader className="pb-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="inline-flex items-center gap-2 text-2xl">
                          <BookOpenText className="h-6 w-6 text-cyan-300" />
                          Courses
                        </CardTitle>
                        <Badge variant="outline" className="rounded-full border-cyan-300/35 bg-cyan-500/10 text-cyan-100">
                          {courses.length}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm leading-relaxed">
                        Browse structured learning programs, recorded lessons, and full course journeys published by this teacher.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100">
                        View courses
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <Link href={`/teachers/${teacherId}/live-batches`} className="block h-full">
                  <Card className="group h-full border border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/82 to-indigo-950/45 transition hover:-translate-y-0.5 hover:border-indigo-300/45 hover:shadow-[0_20px_40px_-28px_rgba(129,140,248,0.45)]">
                    <CardHeader className="pb-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="inline-flex items-center gap-2 text-2xl">
                          <Video className="h-6 w-6 text-cyan-300" />
                          Live Batches
                        </CardTitle>
                        <Badge variant="outline" className="rounded-full border-cyan-300/35 bg-cyan-500/10 text-cyan-100">
                          {liveBatches.length}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm leading-relaxed">
                        Join active classroom groups, scheduled live sessions, and batch-based learning from this teacher.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/30 bg-indigo-500/10 px-3 py-1.5 text-sm text-indigo-100">
                        View live batches
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
