'use client';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardHeader from '@/components/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFirestore, useDoc, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { collection, doc, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  GraduationCap,
  IndianRupee,
  Layers3,
  Lock,
  PlayCircle,
  Sparkles,
  Target,
  UserRound,
} from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useToast } from '@/hooks/use-toast';
import { formatCourseDate, getCourseExpiryStatus } from '@/lib/course-expiry';
import { resolveCourseBasePrice, type CourseCoupon } from '@/lib/course-plan-pricing';
import { sendSelfBellNotification } from '@/lib/client-notifications';
import {
  buildCourseCurriculumSubjectGroups,
  type CourseCurriculumNode,
  type CourseCurriculumSection,
  type CourseCurriculumSubjectGroup,
  type OrderedCurriculumTestItem,
} from '@/lib/course-curriculum-tree';
import { useTeacherPremiumQuestionTestAccessMap } from '@/lib/teacher-premium-question-test-access';

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
  heading: string;
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
  description: string;
  outcomes?: string;
  introduction?: {
    youtubeUrl?: string;
    textBody?: string;
  };
  teacherId?: string;
  teacherName: string;
  price?: number;
  accessLevel?: 'free' | 'paid';
  subscriptionAttached?: boolean;
  publicationStatus?: 'draft' | 'published' | 'deleted';
  isCrashCourse?: boolean;
  expiryDate?: string | number | { seconds?: number; toDate?: () => Date };
  thumbnailUrl?: string;
  imageUrl?: string;
  classLevel: string;
  examTypeId?: string;
  classId?: string;
  subjectIds: string[];
  createdAt?: { toDate?: () => Date } | string;
  modules?: CourseModule[];
};

type ExamType = { id: string; name?: string };
type ClassItem = { id: string; name?: string };
type Subject = { id: string; name?: string };
type PurchasedCourse = {
  id: string;
  courseId?: string;
  purchasedAt?: string;
};

type SubscriptionPlan = {
  id: string;
  name?: string;
  price: number;
  billingInterval?: 'monthly' | 'yearly';
  paymentType?: 'one_time' | 'subscription';
  linkedContentType?: 'course' | 'mock_test' | 'live_batch';
  linkedContentId?: string;
  oneTimePrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  couponCode?: string | null;
  courseCoupons?: CourseCoupon[];
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

export default function CourseDetailPage() {
  const { courseId } = useParams() as { courseId: string };
  const firestore = useFirestore();
  const { user } = useUser();
  const { isTeacher } = useIsTeacher();
  const { toast } = useToast();

  const courseDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'courses', courseId);
  }, [firestore, courseId]);
  const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseDocRef);
  const inlineTestsQuery = useMemoFirebase(() => {
    if (!firestore || !courseId) return null;
    return query(
      collection(firestore, 'mock_tests'),
      where('isCourseOnly', '==', true),
      where('courseId', '==', courseId)
    );
  }, [firestore, courseId]);
  const { data: inlineTests } = useCollection<CourseInlineTest>(inlineTestsQuery);
  const examTypesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types')) : null), [firestore]);
  const classesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes')) : null), [firestore]);
  const subjectsQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects')) : null), [firestore]);
  const { data: examTypes } = useCollection<ExamType>(examTypesQuery);
  const { data: classes } = useCollection<ClassItem>(classesQuery);
  const { data: subjects } = useCollection<Subject>(subjectsQuery);
  const coursePlansQuery = useMemoFirebase(() => {
    if (!firestore || !courseId || course?.accessLevel !== 'paid') return null;
    return query(
      collection(firestore, 'subscription_plans'),
      where('linkedContentType', '==', 'course'),
      where('linkedContentId', '==', courseId)
    );
  }, [firestore, course?.accessLevel, courseId]);
  const { data: coursePlans, isLoading: areCoursePlansLoading } = useCollection<SubscriptionPlan>(coursePlansQuery);
  const purchasedCourseRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid, 'purchased_courses', courseId);
  }, [firestore, user?.uid, courseId]);
  const { data: purchasedCourse } = useDoc<PurchasedCourse>(purchasedCourseRef);

  const isLoading = isCourseLoading;
  const modules = course?.modules || [];
  const inlineCourseTests = inlineTests || [];
  const isCourseOwner = Boolean(isTeacher && user?.uid && course?.teacherId && user.uid === course.teacherId);
  const inlineTestMinimumStudentsRequiredById = useMemo(
    () => Object.fromEntries(inlineCourseTests.map((test) => [test.id, 1])),
    [inlineCourseTests]
  );
  const { accessMap: inlineTestAccessMap } = useTeacherPremiumQuestionTestAccessMap(
    firestore,
    inlineCourseTests,
    inlineTestMinimumStudentsRequiredById
  );
  const visibleInlineTests = useMemo(
    () => (
      isCourseOwner
        ? inlineCourseTests
        : inlineCourseTests.filter((test) => {
            const accessState = inlineTestAccessMap[test.id];
            return !accessState?.isProtected || accessState.isAccessible;
          })
    ),
    [inlineCourseTests, inlineTestAccessMap, isCourseOwner]
  );
  const placeholder = PlaceHolderImages.find(img => img.id === 'content-delivery');

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Course Details" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="space-y-6"><Skeleton className="h-64 w-full" /></div>
          </div>
        </main>
      </div>
    );
  }

  if (!course || course.publicationStatus === 'deleted') {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Course Not Found" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card>
            <CardHeader><CardTitle>Course Not Found</CardTitle></CardHeader>
            <CardContent><p>The course you are looking for does not exist or has been removed.</p></CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const expiryStatus = getCourseExpiryStatus(course.expiryDate);
  const expiryDateLabel = formatCourseDate(course.expiryDate);
  const isNormalCourse = !course.isCrashCourse;
  const showExpiringSoonWarning = isNormalCourse && expiryStatus.isExpiringSoon && !expiryStatus.isExpired;

  if (!isTeacher && expiryStatus.isExpired) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Course Expired" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Course Expired</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This course expired on {expiryDateLabel} and is no longer available.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!isTeacher && course.accessLevel === 'paid' && course.subscriptionAttached !== true) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Course Not Live Yet" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card>
            <CardHeader><CardTitle>Course Not Live Yet</CardTitle></CardHeader>
            <CardContent>
              <p>This paid course is not live yet. It will be available once the teacher attaches a subscription plan.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const examName = (examTypes || []).find((item) => item.id === course.examTypeId)?.name || '-';
  const className = (classes || []).find((item) => item.id === course.classId)?.name || course.classLevel || '-';
  const subjectNameById = Object.fromEntries((subjects || []).map((subject) => [subject.id, subject.name || 'Subject']));
  const subjectNames = (course.subjectIds || [])
    .map((id) => (subjects || []).find((subject) => subject.id === id)?.name || '')
    .filter(Boolean);
  const curriculumSubjectGroups = buildCourseCurriculumSubjectGroups(modules, visibleInlineTests, {
    subjectIds: course.subjectIds || [],
    subjectNameById,
  });
  const courseCreatedDate = (() => {
    const raw = course.createdAt;
    if (!raw) return '-';
    if (typeof raw === 'string') return new Date(raw).toLocaleDateString();
    if (typeof raw?.toDate === 'function') return raw.toDate().toLocaleDateString();
    return '-';
  })();
  const introductionTest = visibleInlineTests.find((test) => !test.chapterRef) || null;
  const moduleCount = modules.filter((m) => m.itemType !== 'chapter' && m.contentType !== 'chapter').length;
  const testCount = visibleInlineTests.length;
  const isFreeCourse = (course.accessLevel || 'free') === 'free';
  const isAddedToMyLearning = !!purchasedCourse;
  const hasCourseAccess = !!(isTeacher || isFreeCourse || purchasedCourse);
  const freePreviewModuleCount = modules.filter((item) => item.accessLevel === 'free' && item.itemType !== 'chapter' && item.contentType !== 'chapter').length;
  const freePreviewTestCount = visibleInlineTests.filter((item) => item.accessLevel === 'free').length;
  const validCoursePlans = (coursePlans || []).filter((plan) => Number.isFinite(Number(plan.price)) && Number(plan.price) >= 0);
  const featuredCoursePlan = validCoursePlans.length > 0
    ? validCoursePlans.reduce((selected, plan) => (
      resolveCourseBasePrice(plan) > resolveCourseBasePrice(selected) ? plan : selected
    ))
    : null;
  const publicCoursePrice = featuredCoursePlan ? resolveCourseBasePrice(featuredCoursePlan) : null;
  const purchaseCtaLabel = publicCoursePrice !== null
    ? `Unlock for Rs ${publicCoursePrice.toLocaleString()}`
    : 'Plan Not Attached Yet';

  const handleAddToMyLearning = async () => {
    if (!user?.uid || !purchasedCourseRef) return;
    try {
      await setDoc(
        purchasedCourseRef,
        {
          id: courseId,
          courseId,
          teacherId: course.teacherId || null,
          purchasedAt: new Date().toISOString(),
          source: 'course_overview',
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      await sendSelfBellNotification(user, {
        title: course.isCrashCourse
          ? 'Congratulations on adding the crash course'
          : 'Congratulations on adding the course',
        message: `${course.title || 'This course'} is now available in My Learning.`,
        href: `/courses/${courseId}/dive-in`,
        notificationType: 'course_enrolled',
        dedupeKey: `course-overview-enroll:${courseId}`,
        contentType: 'course',
        contentId: courseId,
        teacherId: course.teacherId || undefined,
        courseId,
        accessLevel: course.accessLevel || 'free',
      });
      toast({ title: 'Added to My Learning', description: 'This course is now available in your My Learning tab.' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed', description: 'Could not add this course right now.' });
    }
  };

  const getLessonTypeLabel = (contentType: CourseModule['contentType']) => {
    if (contentType === 'youtube') return 'Video lesson';
    if (contentType === 'pdf') return 'PDF lesson';
    if (contentType === 'word') return 'Word lesson';
    return 'Text lesson';
  };

  const renderCurriculumTest = (testItem: OrderedCurriculumTestItem, scope: 'chapter' | 'module' = 'chapter') => {
    const test = testItem.test;
    const isUnlocked = test.accessLevel === 'free' || hasCourseAccess;
    const totalQuestions = test.config?.questionIds?.length || 0;

    return (
      <div
        key={testItem.id}
        className={`rounded-xl border px-4 py-3 ${
          scope === 'module'
            ? 'border-indigo-300/20 bg-indigo-500/5'
            : 'border-sky-300/20 bg-sky-500/5'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{test.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {scope === 'module' ? 'Module test' : 'Chapter test'}
              {totalQuestions > 0 ? ` • ${totalQuestions} questions` : ''}
            </p>
          </div>
          <Badge
            variant="outline"
            className={isUnlocked ? 'border-cyan-300/35 bg-cyan-500/10 text-cyan-100' : 'border-rose-300/35 bg-rose-500/10 text-rose-100'}
          >
            {isUnlocked ? 'Available' : 'Locked'}
          </Badge>
        </div>
      </div>
    );
  };

  const renderCurriculumNode = (node: CourseCurriculumNode, depth = 0) => {
    const module = node.item.module as CourseModule;
    const isUnlocked = module.accessLevel === 'free' || hasCourseAccess;
    const hasChildren = node.children.length > 0;
    const isSubmodule = depth > 0;

    return (
      <div key={node.item.id} className={depth > 0 ? 'pl-4 md:pl-6' : ''}>
        <div className={`rounded-2xl border p-4 ${isUnlocked ? 'border-border/70 bg-slate-950/30' : 'border-rose-300/25 bg-rose-500/5'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-foreground">{module.heading || module.title}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {isSubmodule ? 'Submodule' : 'Module'} • {getLessonTypeLabel(module.contentType)}
              </p>
              {module.subHeading ? <p className="mt-2 text-sm text-muted-foreground">{module.subHeading}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={module.accessLevel === 'paid' ? 'border-rose-300/35 bg-rose-500/10 text-rose-100' : 'border-cyan-300/35 bg-cyan-500/10 text-cyan-100'}
              >
                {module.accessLevel === 'paid' ? 'Paid' : 'Free'}
              </Badge>
              {!isUnlocked ? (
                <Badge variant="outline" className="border-amber-300/35 bg-amber-500/10 text-amber-100">
                  <Lock className="mr-1 h-3 w-3" />
                  Unlock required
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="h-9 rounded-lg border-cyan-300/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20">
              <Link href={`/courses/${courseId}/dive-in#module-${module.id}`}>
                {isUnlocked ? 'Open in Dive In' : 'Preview in Dive In'}
              </Link>
            </Button>
          </div>

          {node.tests.length > 0 ? (
            <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-slate-950/35 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Tests in this module</p>
              {node.tests.map((testItem) => renderCurriculumTest(testItem, 'module'))}
            </div>
          ) : null}

          {hasChildren ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Submodules</p>
              {node.children.map((child) => renderCurriculumNode(child, depth + 1))}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <DashboardHeader title={course.title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-cyan-950/50 via-blue-950/45 to-indigo-950/55 p-6 md:p-8">
                <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="relative space-y-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-100">
                          <Sparkles className="h-3.5 w-3.5" />
                          {className}
                        </p>
                        <Badge
                          variant="outline"
                          className={(course.accessLevel || 'free') === 'paid'
                            ? 'border-rose-300/35 bg-rose-500/10 text-rose-100'
                            : 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100'}
                        >
                          {(course.accessLevel || 'free') === 'paid' ? 'Paid Course' : 'Free Course'}
                        </Badge>
                        {(course.accessLevel || 'free') === 'paid' && publicCoursePrice !== null ? (
                          <Badge variant="outline" className="border-amber-300/35 bg-amber-500/10 text-amber-100">
                            Price: Rs {publicCoursePrice.toLocaleString()}
                          </Badge>
                        ) : null}
                      </div>
                      <h1 className="mt-4 break-words text-3xl font-bold tracking-tight md:text-5xl">{course.title}</h1>
                      <p className="mt-2 break-words text-base text-muted-foreground md:text-lg">Course Author: {course.teacherName}</p>
                    </div>

                    <div className="w-full rounded-2xl border border-cyan-300/20 bg-slate-950/40 p-4 shadow-[0_12px_30px_-24px_rgba(56,189,248,0.9)] xl:max-w-sm">
                      <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/75">
                        {(course.accessLevel || 'free') === 'paid' ? 'Teacher Set Price' : 'Access'}
                      </p>
                      {(course.accessLevel || 'free') === 'paid' ? (
                        areCoursePlansLoading ? (
                          <p className="mt-3 text-sm text-muted-foreground">Loading teacher pricing...</p>
                        ) : publicCoursePrice !== null ? (
                          <>
                            <div className="mt-3 flex flex-wrap items-end gap-2">
                              <div className="inline-flex items-center gap-2 text-3xl font-semibold text-foreground md:text-4xl">
                                <IndianRupee className="h-7 w-7 text-amber-300" />
                                {publicCoursePrice.toLocaleString()}
                              </div>
                              <span className="pb-1 text-sm text-muted-foreground">
                                {featuredCoursePlan?.paymentType === 'subscription'
                                  ? `per ${featuredCoursePlan.billingInterval || 'plan'}`
                                  : 'one-time unlock'}
                              </span>
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">
                              This is the teacher&apos;s public course price. Coupon codes, if any, are applied only during checkout.
                            </p>
                          </>
                        ) : (
                          <p className="mt-3 text-sm text-muted-foreground">
                            The teacher has not attached a visible checkout price yet.
                          </p>
                        )
                      ) : (
                        <>
                          <p className="mt-3 text-3xl font-semibold text-emerald-100 md:text-4xl">Free</p>
                          <p className="mt-3 text-sm text-muted-foreground">
                            All published lessons and tests in this course are open immediately.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-slate-950/35 px-4 py-3 text-muted-foreground">
                      <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-cyan-100/70">
                        <Target className="h-4 w-4 text-cyan-300" />
                        Exam
                      </p>
                      <p className="mt-2 break-words text-base font-medium text-foreground">{examName}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-slate-950/35 px-4 py-3 text-muted-foreground">
                      <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-sky-100/70">
                        <GraduationCap className="h-4 w-4 text-sky-300" />
                        Curriculum
                      </p>
                      <p className="mt-2 break-words text-base font-medium text-foreground">{className}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-slate-950/35 px-4 py-3 text-muted-foreground">
                      <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-indigo-100/70">
                        <CalendarDays className="h-4 w-4 text-indigo-300" />
                        Created
                      </p>
                      <p className="mt-2 break-words text-base font-medium text-foreground">{courseCreatedDate}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-slate-950/35 px-4 py-3 text-muted-foreground">
                      <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-amber-100/70">
                        <CalendarDays className="h-4 w-4 text-amber-300" />
                        Expires
                      </p>
                      <p className="mt-2 break-words text-base font-medium text-foreground">{expiryDateLabel}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {subjectNames.length > 0 ? (
                      subjectNames.map((name) => (
                        <Badge key={name} variant="outline" className="border-cyan-300/30 bg-cyan-500/10 text-cyan-100">
                          {name}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="border-border/70 bg-muted/20 text-muted-foreground">
                        No subject tagged
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Card className="border-border/70 bg-card/90">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-cyan-300" />
                    About this course
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  <p className="leading-7">{course.description}</p>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/90">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-sky-300" />
                    Learning Outcomes
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {course.outcomes?.trim() ? (
                    <div className="whitespace-pre-wrap leading-7">{course.outcomes}</div>
                  ) : (
                    <p>No explicit outcomes added by author yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/90">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <PlayCircle className="h-5 w-5 text-cyan-300" />
                    Course Introduction
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Badge variant="outline" className="border-cyan-300/30 bg-cyan-500/10 text-cyan-100">
                    Always Free
                  </Badge>
                  {course.introduction?.youtubeUrl ? (
                    getYoutubeEmbedUrl(course.introduction.youtubeUrl) ? (
                      <div className="aspect-video w-full overflow-hidden rounded-xl border border-border/70 bg-black">
                        <iframe
                          src={getYoutubeEmbedUrl(course.introduction.youtubeUrl)!}
                          title={`${course.title} introduction`}
                          className="h-full w-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-destructive">Invalid introduction YouTube URL.</p>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">No introduction video added.</p>
                  )}
                  {course.introduction?.textBody ? (
                    <div className="whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/25 p-3 text-sm leading-7">
                      {course.introduction.textBody}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No introduction text added.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/90">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Layers3 className="h-5 w-5 text-cyan-300" />
                    Curriculum Preview
                  </CardTitle>
                  <CardDescription>
                    Students can see the exact chapter, module, submodule, and test structure before they start learning.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {curriculumSubjectGroups.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-slate-950/30 p-4 text-sm text-muted-foreground">
                      No curriculum items have been published for this course yet.
                    </div>
                  ) : (
                    curriculumSubjectGroups.map((group: CourseCurriculumSubjectGroup) => (
                      <div
                        key={group.key}
                        className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-slate-950/90 via-blue-950/20 to-slate-950/75 shadow-[0_18px_40px_-32px_rgba(34,211,238,0.6)]"
                      >
                        <div className="border-b border-cyan-300/15 bg-slate-950/50 px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/75">Subject</p>
                              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{group.title}</h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="border-cyan-300/25 bg-cyan-500/10 text-cyan-100">
                                {group.sections.length} {group.sections.length === 1 ? 'section' : 'sections'}
                              </Badge>
                              <Badge variant="outline" className="border-sky-300/25 bg-sky-500/10 text-sky-100">
                                {group.moduleCount} {group.moduleCount === 1 ? 'module' : 'modules'}
                              </Badge>
                              <Badge variant="outline" className="border-indigo-300/25 bg-indigo-500/10 text-indigo-100">
                                {group.testCount} {group.testCount === 1 ? 'test' : 'tests'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4 p-4">
                          {group.sections.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/70 bg-slate-950/30 p-4 text-sm text-muted-foreground">
                              No curriculum items are inside this subject yet.
                            </div>
                          ) : null}

                          {group.sections.map((section: CourseCurriculumSection) => (
                            <div
                              key={section.key}
                              className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-slate-900/80 via-blue-950/10 to-slate-950/65"
                            >
                              <div className="border-b border-border/60 bg-slate-950/35 px-4 py-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/75">Chapter</p>
                                <h4 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{section.title}</h4>
                                {section.description ? (
                                  <p className="mt-2 text-sm text-muted-foreground">{section.description}</p>
                                ) : null}
                              </div>
                              <div className="space-y-4 p-4">
                                {section.rootModules.length === 0 && section.chapterTests.length === 0 ? (
                                  <div className="rounded-xl border border-dashed border-border/70 bg-slate-950/30 p-4 text-sm text-muted-foreground">
                                    No modules or tests are inside this chapter yet.
                                  </div>
                                ) : null}

                                {section.rootModules.map((node) => renderCurriculumNode(node))}

                                {section.chapterTests.length > 0 ? (
                                  <div className="space-y-3 rounded-xl border border-border/60 bg-slate-950/35 p-3">
                                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Chapter tests</p>
                                    {section.chapterTests.map((testItem) => renderCurriculumTest(testItem, 'chapter'))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/90">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Layers3 className="h-5 w-5 text-indigo-300" />
                    Course Snapshot
                  </CardTitle>
                  <CardDescription>Quick overview of structure and tests.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-cyan-100/80">Modules</p>
                    <p className="mt-1 text-2xl font-semibold">{moduleCount}</p>
                  </div>
                  <div className="rounded-xl border border-sky-300/25 bg-sky-500/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-sky-100/80">Tests</p>
                    <p className="mt-1 text-2xl font-semibold">{testCount}</p>
                  </div>
                  <div className="rounded-xl border border-indigo-300/25 bg-indigo-500/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-indigo-100/80">Intro Test</p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold">{introductionTest?.title || 'Not added'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6 lg:col-span-1 lg:self-start">
              <Card className="overflow-hidden border-border/70 bg-card/95 shadow-[0_18px_44px_-28px_rgba(56,189,248,0.45)] lg:sticky lg:top-24">
                <div className="relative h-56 w-full">
                  <img
                    src={course.thumbnailUrl || course.imageUrl || placeholder?.imageUrl || 'https://picsum.photos/seed/course/600/400'}
                    alt={course.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-2">
                    <Badge
                      variant={(course.accessLevel || 'free') === 'paid' ? 'destructive' : 'default'}
                      className="max-w-full whitespace-normal break-words"
                    >
                      {(course.accessLevel || 'free') === 'paid' ? 'Paid Course' : 'Free Course'}
                    </Badge>
                    <p className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-xs text-white/90">
                      {moduleCount} modules
                    </p>
                  </div>
                </div>
                <CardContent className="space-y-4 p-5">
                  <div className="rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-500/10 via-slate-950/40 to-blue-500/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/75">
                      {(course.accessLevel || 'free') === 'paid' ? 'Course Price' : 'Course Access'}
                    </p>
                    {(course.accessLevel || 'free') === 'paid' ? (
                      areCoursePlansLoading ? (
                        <p className="mt-2 text-sm text-muted-foreground">Loading price...</p>
                      ) : publicCoursePrice !== null ? (
                        <>
                          <div className="mt-2 flex flex-wrap items-end gap-2">
                            <span className="text-3xl font-semibold text-foreground">Rs {publicCoursePrice.toLocaleString()}</span>
                            <span className="pb-1 text-xs text-muted-foreground">
                              {featuredCoursePlan?.paymentType === 'subscription'
                                ? `/${featuredCoursePlan.billingInterval || 'plan'}`
                                : 'one-time'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">Coupon discounts apply only after the student enters a valid code during checkout.</p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Teacher pricing not attached yet.</p>
                      )
                    ) : (
                      <p className="mt-2 text-2xl font-semibold text-emerald-100">Free</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-border/60 bg-slate-950/35 px-3 py-2.5 text-xs text-muted-foreground">
                    <p>
                      Expiry Date: <span className="font-medium text-foreground">{expiryDateLabel}</span>
                    </p>
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
                  {!isTeacher && isFreeCourse ? (
                    <Button
                      className={`h-11 w-full rounded-xl text-sm font-semibold ${
                        isAddedToMyLearning
                          ? 'border border-border/70 bg-muted/30 text-muted-foreground'
                          : 'border border-cyan-300/35 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 text-slate-950 shadow-[0_10px_24px_-12px_rgba(56,189,248,0.85)] hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400'
                      }`}
                      variant="default"
                      onClick={handleAddToMyLearning}
                      disabled={isAddedToMyLearning}
                    >
                      {isAddedToMyLearning ? 'Added to My Learning' : 'Add to My Learning'}
                    </Button>
                  ) : null}
                  {!isTeacher && !isFreeCourse ? (
                    hasCourseAccess ? (
                      <Button className="h-11 w-full rounded-xl border border-emerald-300/35 bg-emerald-500/15 text-emerald-100" disabled>
                        Course Access Active
                      </Button>
                    ) : featuredCoursePlan ? (
                      <Button
                        asChild
                        className="h-11 w-full rounded-xl border border-rose-300/45 bg-rose-600/85 text-white hover:bg-rose-600"
                      >
                        <Link href={`/checkout/${featuredCoursePlan.id}`}>{purchaseCtaLabel}</Link>
                      </Button>
                    ) : (
                      <Button className="h-11 w-full rounded-xl" disabled>
                        Plan Not Attached Yet
                      </Button>
                    )
                  ) : null}

                  <Button
                    asChild
                    className="group h-11 w-full rounded-xl border border-sky-300/35 bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-300 font-semibold text-slate-950 shadow-[0_10px_24px_-12px_rgba(59,130,246,0.9)] hover:from-blue-400 hover:via-sky-300 hover:to-cyan-200"
                  >
                    <Link href={`/courses/${courseId}/dive-in`}>
                      Dive In
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </Button>

                  <div className="space-y-3 border-t border-border/60 pt-4 text-sm text-muted-foreground">
                    {!isFreeCourse ? (
                      <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2.5 text-xs text-cyan-100">
                        Introduction is always open. Free preview content: {freePreviewModuleCount} lesson{freePreviewModuleCount === 1 ? '' : 's'} and {freePreviewTestCount} test{freePreviewTestCount === 1 ? '' : 's'}.
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-cyan-200" />
                      <span>Author: {course.teacherName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Layers3 className="h-4 w-4 text-sky-200" />
                      <span>
                        {moduleCount} modules and {testCount} tests
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-200" />
                      <span>Subjects: {subjectNames.length > 0 ? subjectNames.join(', ') : 'Not tagged'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
