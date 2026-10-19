'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardHeader from '@/components/dashboard-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useToast } from '@/hooks/use-toast';
import { formatCourseDate, getCourseExpiryStatus } from '@/lib/course-expiry';
import {
  buildCourseCurriculumSubjectGroups,
  type CourseCurriculumNode,
  type CourseCurriculumSection,
  type CourseCurriculumSubjectGroup,
  type OrderedCurriculumTestItem,
} from '@/lib/course-curriculum-tree';
import { useTeacherPremiumQuestionTestAccessMap } from '@/lib/teacher-premium-question-test-access';
import { pickCoursePlanForPublicDisplay } from '@/lib/course-plan-pricing';
import { sendSelfBellNotification } from '@/lib/client-notifications';
import { formatTestDurationLabel } from '@/lib/test-duration';
import { AlertTriangle, ArrowRight, BookOpen, CalendarDays, CheckCircle2, FileText, Lock, PlayCircle, Sparkles, Target, Youtube } from 'lucide-react';

type CourseModule = {
  id: string;
  sequenceOrder?: number;
  itemType?: 'module' | 'chapter';
  subjectId?: string;
  subjectName?: string;
  chapterKey?: string;
  chapterRef?: string;
  moduleKey?: string;
  parentModuleRef?: string;
  heading?: string;
  subHeading?: string;
  title: string;
  contentType: 'youtube' | 'pdf' | 'word' | 'text' | 'chapter';
  accessLevel: 'free' | 'paid';
  youtubeUrl?: string;
  textBody?: string;
  fileUrl?: string;
};

type CourseInlineTest = {
  id: string;
  sequenceOrder?: number;
  subjectId?: string;
  subjectName?: string;
  chapterRef?: string;
  parentModuleRef?: string;
  title: string;
  teacherId?: string;
  accessLevel: 'free' | 'paid';
  questionAccessLevel?: 'free' | 'paid';
  isCourseOnly?: boolean;
  courseId?: string;
  insertAfterModuleIndex?: number;
  config?: {
    questionIds?: string[];
    duration?: number;
    subjectConfigs?: Array<{ questionAccessLevel?: 'free' | 'paid' }>;
  };
};

type Course = {
  id: string;
  title: string;
  description?: string;
  teacherId?: string;
  teacherName: string;
  accessLevel?: 'free' | 'paid';
  subscriptionAttached?: boolean;
  isCrashCourse?: boolean;
  expiryDate?: string | number | { seconds?: number; toDate?: () => Date };
  examTypeId?: string;
  classId?: string;
  classLevel?: string;
  subjectIds?: string[];
  modules?: CourseModule[];
};

type CourseProgress = {
  completedModuleIds?: string[];
};

type PurchasedCourse = {
  id: string;
  courseId?: string;
  purchasedAt?: string;
};

type ExamType = { id: string; name?: string };
type ClassItem = { id: string; name?: string };
type Subject = { id: string; name?: string };
type SubscriptionPlan = {
  id: string;
  linkedContentType?: 'course' | 'mock_test' | 'live_batch';
  linkedContentId?: string;
  price?: number;
  oneTimePrice?: number;
};

const getYoutubeEmbedUrl = (url?: string) => {
  if (!url) return null;
  const buildEmbedUrl = (id: string) => {
    const params = new URLSearchParams({
      controls: '1',
      modestbranding: '1',
      rel: '0',
      playsinline: '1',
    });
    return `https://www.youtube.com/embed/${id}?${params.toString()}`;
  };
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? buildEmbedUrl(id) : null;
    }
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v');
      if (id) return buildEmbedUrl(id);
      const parts = parsed.pathname.split('/').filter(Boolean);
      const markerIndex = parts.findIndex((part) => ['live', 'embed', 'shorts'].includes(part));
      if (markerIndex !== -1 && parts[markerIndex + 1]) return buildEmbedUrl(parts[markerIndex + 1]);
    }
  } catch {
    return null;
  }
  return null;
};

export default function CourseDiveInPage() {
  const { courseId } = useParams() as { courseId: string };
  const firestore = useFirestore();
  const { user } = useUser();
  const { isTeacher } = useIsTeacher();
  const { toast } = useToast();

  const courseRef = useMemoFirebase(() => (firestore ? doc(firestore, 'courses', courseId) : null), [firestore, courseId]);
  const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseRef);

  const inlineTestsQuery = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return query(collection(firestore, 'mock_tests'), where('isCourseOnly', '==', true), where('courseId', '==', courseId));
  }, [firestore, courseId]);
  const { data: inlineTests, isLoading: areInlineTestsLoading } = useCollection<CourseInlineTest>(inlineTestsQuery);

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid, 'course_progress', courseId);
  }, [firestore, user?.uid, courseId]);
  const { data: progress } = useDoc<CourseProgress>(progressRef);

  const purchasedCourseRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid, 'purchased_courses', courseId);
  }, [firestore, user?.uid, courseId]);
  const { data: purchasedCourse } = useDoc<PurchasedCourse>(purchasedCourseRef);
  const coursePlansQuery = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return query(
      collection(firestore, 'subscription_plans'),
      where('linkedContentType', '==', 'course'),
      where('linkedContentId', '==', courseId)
    );
  }, [firestore, courseId]);
  const { data: coursePlans } = useCollection<SubscriptionPlan>(coursePlansQuery);

  const examTypesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types')) : null), [firestore]);
  const classesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes')) : null), [firestore]);
  const subjectsQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects')) : null), [firestore]);
  const { data: examTypes } = useCollection<ExamType>(examTypesQ);
  const { data: classes } = useCollection<ClassItem>(classesQ);
  const { data: subjects } = useCollection<Subject>(subjectsQ);

  const isLoading = isCourseLoading || areInlineTestsLoading;
  const modules = course?.modules || [];
  const tests = inlineTests || [];
  const isCourseOwner = Boolean(isTeacher && user?.uid && course?.teacherId && user.uid === course.teacherId);
  const inlineTestMinimumStudentsRequiredById = useMemo(
    () => Object.fromEntries(tests.map((test) => [test.id, 1])),
    [tests]
  );
  const { accessMap: inlineTestAccessMap } = useTeacherPremiumQuestionTestAccessMap(
    firestore,
    tests,
    inlineTestMinimumStudentsRequiredById
  );
  const visibleTests = useMemo(
    () => (
      isCourseOwner
        ? tests
        : tests.filter((test) => {
            const accessState = inlineTestAccessMap[test.id];
            return !accessState?.isProtected || accessState.isAccessible;
          })
    ),
    [inlineTestAccessMap, isCourseOwner, tests]
  );
  const isFreeCourse = (course?.accessLevel || 'free') === 'free';
  const hasPaidAccess = !!(course && (isTeacher || isFreeCourse || purchasedCourse));
  const expiryStatus = getCourseExpiryStatus(course?.expiryDate);
  const expiryDateLabel = formatCourseDate(course?.expiryDate);
  const isNormalCourse = !course?.isCrashCourse;
  const showExpiringSoonWarning = isNormalCourse && expiryStatus.isExpiringSoon && !expiryStatus.isExpired;
  const isAddedToMyLearning = !!purchasedCourse;
  const completedModuleIds = new Set(progress?.completedModuleIds || []);
  const examName = (examTypes || []).find((item) => item.id === course?.examTypeId)?.name || '-';
  const className = (classes || []).find((item) => item.id === course?.classId)?.name || course?.classLevel || '-';
  const subjectNameById = useMemo(
    () => Object.fromEntries((subjects || []).map((subject) => [subject.id, subject.name || 'Subject'])),
    [subjects]
  );
  const subjectNames = (course?.subjectIds || [])
    .map((id) => (subjects || []).find((item) => item.id === id)?.name || '')
    .filter(Boolean);
  const curriculumSubjectGroups = useMemo(
    () => buildCourseCurriculumSubjectGroups(modules, visibleTests, {
      subjectIds: course?.subjectIds || [],
      subjectNameById,
    }),
    [course?.subjectIds, modules, subjectNameById, visibleTests]
  );
  const flattenedCurriculumSections = useMemo(
    () => curriculumSubjectGroups.flatMap((group) => group.sections),
    [curriculumSubjectGroups]
  );

  const visibleModules = modules.filter((m) => m.contentType !== 'chapter' && m.itemType !== 'chapter');
  const unlockedModules = visibleModules.filter((m) => m.accessLevel === 'free' || hasPaidAccess);
  const completedVisible = visibleModules.filter((m) => completedModuleIds.has(m.id)).length;
  const completionPercent = visibleModules.length > 0 ? Math.round((completedVisible / visibleModules.length) * 100) : 0;
  const featuredCoursePlan = pickCoursePlanForPublicDisplay(coursePlans || []);
  const unlockCourseHref = featuredCoursePlan ? `/checkout/${featuredCoursePlan.id}` : null;
  const firstUnlockedModuleId =
    visibleModules.find((module) => module.accessLevel === 'free' || hasPaidAccess)?.id || null;
  const firstModuleId =
    firstUnlockedModuleId || flattenedCurriculumSections.find((section) => section.rootModules.length > 0)?.rootModules[0]?.item.module.id || null;

  const handleAddToMyLearning = async () => {
    if (!user?.uid || !purchasedCourseRef || !course) return;
    try {
      await setDoc(
        purchasedCourseRef,
        {
          id: courseId,
          courseId,
          teacherId: course.teacherId || null,
          purchasedAt: new Date().toISOString(),
          source: 'dive_in',
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      await sendSelfBellNotification(user, {
        title: 'Congratulations on enrolling in the course',
        message: `${course.title || 'This course'} is now available in My Learning.`,
        href: `/courses/${courseId}/dive-in`,
        notificationType: 'course_enrolled',
        dedupeKey: `course-enroll:${courseId}`,
        contentType: 'course',
        contentId: courseId,
        teacherId: course.teacherId || undefined,
        courseId,
        accessLevel: course.accessLevel || 'free',
      });
      toast({ title: 'Added to My Learning', description: 'This course is now available in your learning dashboard.' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed', description: 'Could not add this course right now.' });
    }
  };

  const handleToggleCompleted = async (moduleId: string) => {
    if (!user || !progressRef) return;
    const current = progress?.completedModuleIds || [];
    const isCompleted = current.includes(moduleId);
    const updated = isCompleted ? current.filter((id) => id !== moduleId) : [...current, moduleId];
    try {
      await setDocumentNonBlocking(
        progressRef,
        { courseId, completedModuleIds: updated, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch {
      toast({ variant: 'destructive', title: 'Update failed', description: 'Could not update progress.' });
    }
  };

  const renderTestCard = (testItem: OrderedCurriculumTestItem, scope: 'chapter' | 'module' = 'chapter') => {
    const test = testItem.test;
    const unlocked = test.accessLevel === 'free' || hasPaidAccess;
    const totalQuestions = test.config?.questionIds?.length || 0;
    const durationLabel = formatTestDurationLabel(test.config?.duration);

    return (
      <Card
        key={testItem.id}
        className={`overflow-hidden border-border/70 ${
          scope === 'module'
            ? 'bg-gradient-to-br from-slate-900/90 via-blue-950/20 to-slate-950/80'
            : 'bg-gradient-to-br from-slate-900/90 via-indigo-950/20 to-slate-950/80'
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-cyan-300" />
                {test.title}
              </CardTitle>
              <CardDescription>{scope === 'module' ? 'Submodule/Module test' : 'Chapter test'}</CardDescription>
            </div>
            <Badge
              variant="outline"
              className={test.accessLevel === 'paid' ? 'border-rose-300/45 bg-rose-500/15 text-rose-100' : 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100'}
            >
              {test.accessLevel === 'paid' ? 'Paid' : 'Free'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-sm text-muted-foreground">
            {totalQuestions} questions | {durationLabel}
          </p>
          {unlocked ? (
            <Button
              asChild
              className="group h-10 rounded-xl border border-cyan-300/35 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 font-semibold text-slate-950 shadow-[0_10px_24px_-14px_rgba(56,189,248,0.8)] hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400"
            >
              <Link href={`/test/${test.id}`}>
                Start Test
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-dashed border-rose-300/35 bg-rose-500/10 p-4 text-sm text-rose-100/95">
              <p className="flex items-center gap-2 font-medium">
                <Lock className="h-4 w-4" />
                Locked test
              </p>
              {!hasPaidAccess ? (
                unlockCourseHref ? (
                  <Button asChild size="sm" className="h-9 rounded-lg border border-rose-300/45 bg-rose-600/80 text-white hover:bg-rose-600">
                    <Link href={unlockCourseHref}>Unlock Course Access</Link>
                  </Button>
                ) : (
                  <Button size="sm" className="h-9 rounded-lg" disabled>
                    Plan Not Attached Yet
                  </Button>
                )
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderModuleNode = (section: CourseCurriculumSection, node: CourseCurriculumNode, depth = 0) => {
    const module = node.item.module as CourseModule;
    const unlocked = module.accessLevel === 'free' || hasPaidAccess;
    const isCompleted = completedModuleIds.has(module.id);
    const embedUrl = module.contentType === 'youtube' ? getYoutubeEmbedUrl(module.youtubeUrl) : null;
    const nextModuleId = section.nextModuleById[module.id];
    const hasChildren = node.children.length > 0;
    const levelLabel = depth === 0 ? 'Module' : 'Submodule';
    const toneClass = !unlocked
      ? 'border-rose-300/30 bg-rose-950/15'
      : depth > 0
        ? 'border-border/60 bg-slate-950/40'
        : 'border-border/70 bg-gradient-to-br from-slate-900/90 via-blue-950/15 to-slate-950/75';

    return (
      <div key={node.item.id} className={depth > 0 ? 'pl-4 md:pl-6' : ''}>
        <Card id={`module-${module.id}`} className={`overflow-hidden ${toneClass}`}>
          <CardHeader className={`pb-3 ${unlocked ? 'bg-slate-950/20' : 'bg-rose-950/15'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">
                  {levelLabel}
                </p>
                <CardTitle className="text-lg">{module.heading || module.title}</CardTitle>
                {module.subHeading ? <CardDescription>{module.subHeading}</CardDescription> : null}
              </div>
              <div className="flex gap-2">
                {isCompleted ? (
                  <Badge variant="outline" className="border-emerald-300/45 bg-emerald-500/15 text-emerald-100">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Done
                  </Badge>
                ) : null}
                <Badge
                  variant="outline"
                  className={module.accessLevel === 'paid' ? 'border-rose-300/45 bg-rose-500/15 text-rose-100' : 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100'}
                >
                  {module.accessLevel === 'paid' ? 'Paid' : 'Free'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {!unlocked ? (
              <div className="space-y-3 rounded-xl border border-dashed border-rose-300/35 bg-rose-500/10 p-4 text-sm text-rose-100/95">
                <p className="flex items-center gap-2 font-medium">
                  <Lock className="h-4 w-4" />
                  Locked module
                </p>
                <p>Complete course payment to continue this lesson.</p>
                {!hasPaidAccess ? (
                  unlockCourseHref ? (
                    <Button asChild size="sm" className="h-9 rounded-lg border border-rose-300/45 bg-rose-600/80 text-white hover:bg-rose-600">
                      <Link href={unlockCourseHref}>Unlock Course Access</Link>
                    </Button>
                  ) : (
                    <Button size="sm" className="h-9 rounded-lg" disabled>
                      Plan Not Attached Yet
                    </Button>
                  )
                ) : null}
              </div>
            ) : (
              <>
                {module.contentType === 'youtube' ? (
                  embedUrl ? (
                    <div className="aspect-video w-full overflow-hidden rounded-xl border border-border/70 bg-black shadow-[0_18px_34px_-18px_rgba(59,130,246,0.55)]">
                      <iframe
                        src={embedUrl}
                        title={module.title}
                        className="h-full w-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-destructive">Invalid YouTube URL.</p>
                  )
                ) : null}
                {module.contentType === 'text' ? (
                  <div className="rounded-xl border border-border/70 bg-muted/25 p-3 text-sm whitespace-pre-wrap leading-7">
                    {module.textBody || 'No text content.'}
                  </div>
                ) : null}
                {(module.contentType === 'pdf' || module.contentType === 'word') ? (
                  module.fileUrl ? (
                    <Button asChild variant="outline" size="sm" className="h-9 rounded-lg border-cyan-300/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20">
                      <a href={module.fileUrl} target="_blank" rel="noopener noreferrer">
                        Open {module.contentType === 'pdf' ? 'PDF' : 'Word File'}
                      </a>
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">No file attached.</p>
                  )
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className={`h-9 rounded-lg ${
                      isCompleted
                        ? 'border border-emerald-300/35 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25'
                        : 'border border-cyan-300/35 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 text-slate-950 hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400'
                    }`}
                    onClick={() => handleToggleCompleted(module.id)}
                  >
                    {isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
                  </Button>
                  {nextModuleId ? (
                    <Button asChild size="sm" variant="outline" className="h-9 rounded-lg border-sky-300/35 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20">
                      <a href={`#module-${nextModuleId}`}>
                        Next Module <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  ) : null}
                </div>
              </>
            )}

            {node.tests.length > 0 ? (
              <div className="space-y-3 rounded-xl border border-border/60 bg-slate-950/30 p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Tests in this module</p>
                {node.tests.map((testItem) => renderTestCard(testItem, 'module'))}
              </div>
            ) : null}

            {hasChildren ? (
              <div className="space-y-3 rounded-xl border border-border/60 bg-slate-950/25 p-3 md:p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Submodules</p>
                  <Badge variant="outline" className="border-border/70 bg-muted/10 text-muted-foreground">
                    {node.children.length} {node.children.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
                {node.children.map((child) => renderModuleNode(section, child, depth + 1))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Dive In" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Course Not Found" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card><CardContent className="p-6">Course was not found.</CardContent></Card>
        </main>
      </div>
    );
  }

  if (!isTeacher && expiryStatus.isExpired) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Course Expired" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card>
            <CardHeader><CardTitle>Course Expired</CardTitle></CardHeader>
            <CardContent>This course expired on {expiryDateLabel} and is no longer available.</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!isTeacher && course.accessLevel === 'paid' && course.subscriptionAttached !== true) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title={course.title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card>
            <CardHeader><CardTitle>Course Not Live Yet</CardTitle></CardHeader>
            <CardContent>This paid course is not live yet. It will be available after subscription linking.</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title={`Dive In - ${course.title}`} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-r from-slate-950 via-blue-950/60 to-cyan-950/55 p-6 md:p-8">
            <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-4">
                <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  Learning Workspace
                </p>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{course.title}</h1>
                <p className="max-w-3xl text-muted-foreground">{course.description || 'No course description added yet.'}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-cyan-300/35 bg-cyan-500/10 text-cyan-100">
                    Exam: {examName}
                  </Badge>
                  <Badge variant="outline" className="border-sky-300/35 bg-sky-500/10 text-sky-100">
                    Curriculum: {className}
                  </Badge>
                  <Badge variant="outline" className="border-amber-300/35 bg-amber-500/10 text-amber-100">
                    <CalendarDays className="mr-1 h-3.5 w-3.5" />
                    Expires: {expiryDateLabel}
                  </Badge>
                  {(subjectNames.length ? subjectNames : ['No subjects tagged']).map((name) => (
                    <Badge key={name} variant="outline" className="border-indigo-300/35 bg-indigo-500/10 text-indigo-100">
                      {name}
                    </Badge>
                  ))}
                </div>
                {showExpiringSoonWarning ? (
                  <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100">
                    <p className="inline-flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Expiring Soon
                    </p>
                    <p className="mt-1">
                      This course will expire in {expiryStatus.daysRemaining} day{expiryStatus.daysRemaining === 1 ? '' : 's'}.
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild variant="outline" className="h-10 rounded-xl border-border/70 bg-slate-950/30 text-foreground hover:bg-slate-900/50">
                    <Link href={`/courses/${courseId}`}>Back to Overview</Link>
                  </Button>
                  {firstModuleId ? (
                    <Button asChild className="group h-10 rounded-xl border border-cyan-300/35 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 text-slate-950 shadow-[0_10px_24px_-14px_rgba(56,189,248,0.85)] hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400">
                      <a href={`#module-${firstModuleId}`}>
                        Start Learning
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="w-full max-w-md space-y-3">
                <div className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-cyan-100">Course Progress</p>
                  <div className="mt-2 flex items-end justify-between">
                    <p className="text-3xl font-semibold">{completionPercent}%</p>
                    <p className="text-sm text-cyan-100/85">
                      {completedVisible}/{visibleModules.length} completed
                    </p>
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-slate-950/50">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 transition-all"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-border/70 bg-slate-950/35 p-2.5">
                    <p className="text-xs text-muted-foreground">Modules</p>
                    <p className="mt-1 text-lg font-semibold">{visibleModules.length}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-slate-950/35 p-2.5">
                    <p className="text-xs text-muted-foreground">Tests</p>
                    <p className="mt-1 text-lg font-semibold">{tests.length}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-slate-950/35 p-2.5">
                    <p className="text-xs text-muted-foreground">Unlocked</p>
                    <p className="mt-1 text-lg font-semibold">{unlockedModules.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-8 space-y-6">
              {curriculumSubjectGroups.length === 0 ? (
                <Card className="border-border/70 bg-slate-950/35">
                  <CardContent className="p-6 text-muted-foreground">No curriculum items found in this course yet.</CardContent>
                </Card>
              ) : (
                curriculumSubjectGroups.map((group: CourseCurriculumSubjectGroup) => (
                  <Card
                    key={group.key}
                    className="overflow-hidden border border-cyan-300/20 bg-gradient-to-br from-slate-950/90 via-blue-950/25 to-slate-950/80 shadow-[0_18px_40px_-32px_rgba(34,211,238,0.6)]"
                  >
                    <CardHeader className="border-b border-cyan-300/15 bg-slate-950/45">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-cyan-100/75">Subject</p>
                          <CardTitle className="text-2xl tracking-tight">{group.title}</CardTitle>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-cyan-300/30 bg-cyan-500/10 text-cyan-100">
                            {group.sections.length} {group.sections.length === 1 ? 'section' : 'sections'}
                          </Badge>
                          <Badge variant="outline" className="border-sky-300/30 bg-sky-500/10 text-sky-100">
                            {group.moduleCount} {group.moduleCount === 1 ? 'module' : 'modules'}
                          </Badge>
                          <Badge variant="outline" className="border-indigo-300/30 bg-indigo-500/10 text-indigo-100">
                            {group.testCount} {group.testCount === 1 ? 'test' : 'tests'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 md:p-5">
                      {group.sections.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                          No curriculum items in this subject yet.
                        </div>
                      ) : null}

                      {group.sections.map((section: CourseCurriculumSection) => (
                        <Card key={section.key} className="overflow-hidden border border-border/70 bg-gradient-to-br from-slate-900/80 via-blue-950/15 to-slate-950/65">
                          <CardHeader className="border-b border-border/60 bg-slate-950/35">
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">Chapter</p>
                            <CardTitle className="text-2xl tracking-tight">{section.title}</CardTitle>
                            {section.description ? <CardDescription>{section.description}</CardDescription> : null}
                          </CardHeader>
                          <CardContent className="space-y-4 p-4 md:p-5">
                            {section.rootModules.length === 0 && section.chapterTests.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                                No modules or tests in this chapter yet.
                              </div>
                            ) : null}

                            {section.rootModules.map((node) => renderModuleNode(section, node))}

                            {section.chapterTests.length > 0 ? (
                              <div className="space-y-3 rounded-xl border border-border/60 bg-slate-950/35 p-3">
                                <p className="text-xs uppercase tracking-wider text-muted-foreground">Chapter tests</p>
                                {section.chapterTests.map((testItem) => renderTestCard(testItem, 'chapter'))}
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <aside className="space-y-4 xl:col-span-4 xl:sticky xl:top-24 self-start">
              <Card className="border-border/70 bg-gradient-to-br from-slate-900/90 via-blue-950/20 to-slate-950/85">
                <CardHeader className="pb-3">
                  <CardTitle>Course Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Badge
                    variant="outline"
                    className={isFreeCourse ? 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100' : 'border-rose-300/45 bg-rose-500/15 text-rose-100'}
                  >
                    {isFreeCourse ? 'Free Course' : 'Premium Course'}
                  </Badge>
                  {isFreeCourse ? (
                    <Button
                      className={`h-11 w-full rounded-xl text-sm font-semibold ${
                        isAddedToMyLearning
                          ? 'border border-border/70 bg-muted/30 text-muted-foreground'
                          : 'border border-cyan-300/35 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 text-slate-950 shadow-[0_10px_24px_-14px_rgba(56,189,248,0.85)] hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400'
                      }`}
                      onClick={handleAddToMyLearning}
                      disabled={isAddedToMyLearning}
                    >
                      {isAddedToMyLearning ? 'Added to My Learning' : 'Add to My Learning'}
                    </Button>
                  ) : hasPaidAccess ? (
                    <Button className="h-11 w-full rounded-xl border border-emerald-300/35 bg-emerald-500/15 text-emerald-100" disabled>
                      Course Access Active
                    </Button>
                  ) : unlockCourseHref ? (
                    <Button asChild className="h-11 w-full rounded-xl border border-rose-300/45 bg-rose-600/85 text-white hover:bg-rose-600">
                      <Link href={unlockCourseHref}>Unlock Course Access</Link>
                    </Button>
                  ) : (
                    <Button className="h-11 w-full rounded-xl" disabled>
                      Plan Not Attached Yet
                    </Button>
                  )}
                  <Button asChild variant="outline" className="h-11 w-full rounded-xl border-border/70 bg-slate-950/30 hover:bg-slate-900/50">
                    <Link href={`/courses/${courseId}`}>Back to Course Overview</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-slate-900/80">
                <CardHeader className="pb-3">
                  <CardTitle>Instructor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{course.teacherName}</p>
                  <p className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-cyan-300" />
                    Exam Focus: {examName}
                  </p>
                  <p className="flex items-center gap-2">
                    <PlayCircle className="h-4 w-4 text-sky-300" />
                    Curriculum: {className}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-slate-900/80">
                <CardHeader className="pb-3">
                  <CardTitle>Quick Start</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Youtube className="h-4 w-4 text-cyan-300" />
                    Watch intro first if available.
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-sky-300" />
                    Mark modules complete to track progress.
                  </p>
                  <p className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-indigo-300" />
                    Attempt module tests after each chapter.
                  </p>
                </CardContent>
              </Card>
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}
