'use client';

import Link from 'next/link';
import DashboardHeader from '@/components/dashboard-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, BookOpen, Flame, GraduationCap, Layers3, Sparkles } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { getCourseExpiryStatus } from '@/lib/course-expiry';
import { pickCoursePlanForPublicDisplay, resolveCourseBasePrice } from '@/lib/course-plan-pricing';
import { isCourseVisibleToStudents } from '@/lib/course-assignment';

type PurchasedCourse = {
  id: string;
  courseId?: string;
  purchasedAt?: string;
};

type Course = {
  id: string;
  title?: string;
  description?: string;
  accessLevel?: 'free' | 'paid';
  publicationStatus?: 'draft' | 'published' | 'deleted' | string;
  subscriptionAttached?: boolean;
  isCrashCourse?: boolean;
  expiryDate?: string | number | { seconds?: number; toDate?: () => Date };
  examTypeId?: string;
  classId?: string;
  classLevel?: string;
  subjectIds?: string[];
};

type ExamType = {
  id: string;
  name: string;
};

type Subject = {
  id: string;
  name: string;
};

type SubscriptionPlan = {
  id: string;
  linkedContentType?: 'course' | 'mock_test' | 'live_batch';
  linkedContentId?: string;
  price?: number;
  oneTimePrice?: number;
};

export default function MyLearningPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const purchasedCoursesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'users', user.uid, 'purchased_courses'));
  }, [firestore, user?.uid]);

  const freeCoursesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'courses'), where('accessLevel', '==', 'free'));
  }, [firestore]);

  const livePaidCoursesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'courses'), where('subscriptionAttached', '==', true));
  }, [firestore]);
  const examTypesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'exam_types'));
  }, [firestore]);
  const subjectsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'subjects'));
  }, [firestore]);
  const coursePlansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'subscription_plans'), where('linkedContentType', '==', 'course'));
  }, [firestore]);

  const { data: purchased, isLoading: arePurchasedLoading } = useCollection<PurchasedCourse>(purchasedCoursesQuery);
  const { data: freeCourses, isLoading: areFreeCoursesLoading } = useCollection<Course>(freeCoursesQuery);
  const { data: livePaidCourses, isLoading: areLivePaidCoursesLoading } = useCollection<Course>(livePaidCoursesQuery);
  const { data: examTypes, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: subjects, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: coursePlans, isLoading: areCoursePlansLoading } = useCollection<SubscriptionPlan>(coursePlansQuery);

  const examNameById = useMemo(
    () =>
      (examTypes || []).reduce((acc, exam) => {
        acc[exam.id] = exam.name;
        return acc;
      }, {} as Record<string, string>),
    [examTypes]
  );

  const subjectNameById = useMemo(
    () =>
      (subjects || []).reduce((acc, subject) => {
        acc[subject.id] = subject.name;
        return acc;
      }, {} as Record<string, string>),
    [subjects]
  );

  const mergedCourses = useMemo(() => {
    const merged = [...(freeCourses || []), ...(livePaidCourses || [])];
    const byId = new Map<string, Course>();
    for (const course of merged) byId.set(course.id, course);
    return Array.from(byId.values()).filter(isCourseVisibleToStudents);
  }, [freeCourses, livePaidCourses]);

  const publicCoursePriceById = useMemo(() => {
    const plansByCourseId = new Map<string, SubscriptionPlan[]>();
    (coursePlans || []).forEach((plan) => {
      if (!plan.linkedContentId) return;
      const existingPlans = plansByCourseId.get(plan.linkedContentId) || [];
      existingPlans.push(plan);
      plansByCourseId.set(plan.linkedContentId, existingPlans);
    });

    return Array.from(plansByCourseId.entries()).reduce((acc, [courseId, plans]) => {
      const selectedPlan = pickCoursePlanForPublicDisplay(plans);
      if (selectedPlan) {
        acc[courseId] = resolveCourseBasePrice(selectedPlan);
      }
      return acc;
    }, {} as Record<string, number>);
  }, [coursePlans]);

  const purchasedCourses = useMemo(() => {
    if (!purchased) return [];

    const latestPurchaseByCourse = new Map<string, string>();
    purchased.forEach((record) => {
        const courseId = record.courseId || record.id;
        const purchasedAt = record.purchasedAt || '';
        const prev = latestPurchaseByCourse.get(courseId) || '';
        if (purchasedAt >= prev) latestPurchaseByCourse.set(courseId, purchasedAt);
      });

    if (latestPurchaseByCourse.size === 0) return [];

    const courseById = new Map<string, Course>();
    for (const course of mergedCourses) courseById.set(course.id, course);

    return Array.from(latestPurchaseByCourse.entries())
      .map(([courseId, purchasedAt]) => {
        const course = courseById.get(courseId);
        if (!course) return null;
        return {
          id: courseId,
          title: course?.title || 'Course',
          description: course?.description || '',
          accessLevel: course?.accessLevel || 'free',
          isCrashCourse: !!course?.isCrashCourse,
          expiryDate: course?.expiryDate,
          examTypeId: course?.examTypeId || '',
          classLevel: course?.classLevel || '',
          subjectIds: Array.isArray(course?.subjectIds) ? course.subjectIds : [],
          purchasedAt: purchasedAt || '',
        };
      })
      .filter((course): course is NonNullable<typeof course> => !!course)
      .filter((course) => !getCourseExpiryStatus(course.expiryDate).isExpired)
      .sort((a, b) => (b.purchasedAt || '').localeCompare(a.purchasedAt || ''));
  }, [purchased, mergedCourses]);

  const crashCourses = useMemo(
    () => purchasedCourses.filter((course) => !!course.isCrashCourse),
    [purchasedCourses]
  );

  const regularCourses = useMemo(
    () => purchasedCourses.filter((course) => !course.isCrashCourse),
    [purchasedCourses]
  );

  const loading =
    arePurchasedLoading ||
    areFreeCoursesLoading ||
    areLivePaidCoursesLoading ||
    areExamTypesLoading ||
    areSubjectsLoading ||
    areCoursePlansLoading;

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="My Learning" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="grid gap-6">
          <Card className="overflow-hidden border-border/70 bg-gradient-to-r from-sky-950/70 via-blue-950/40 to-indigo-950/60">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="space-y-3">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Learning Hub
                  </p>
                  <h2 className="text-2xl font-semibold md:text-3xl">Build Your Course Journey</h2>
                  <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                    My Learning is your course dashboard. Continue enrolled courses, track progress, and resume modules in one place.
                  </p>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Button
                      asChild
                      className="group h-10 rounded-full border border-cyan-300/35 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-4 font-medium text-slate-950 shadow-[0_10px_24px_-14px_rgba(56,189,248,0.9)] transition-all hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400"
                    >
                      <Link href="/teacher-marketplace">
                        Explore Courses
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="h-10 rounded-full border-red-300/35 bg-red-500/10 px-4 text-red-100 hover:bg-red-500/20"
                    >
                      <Link href="/crash-courses">
                        <Flame className="mr-2 h-4 w-4" />
                        View Crash Courses
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 md:w-[360px]">
                  <div className="rounded-xl border border-blue-300/20 bg-blue-500/10 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-blue-200">Track</p>
                    <p className="mt-1 text-sm font-semibold">Courses</p>
                  </div>
                  <div className="rounded-xl border border-indigo-300/20 bg-indigo-500/10 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-indigo-200">Purchased</p>
                    <p className="mt-1 text-sm font-semibold">{purchasedCourses.length}</p>
                  </div>
                  <div className="rounded-xl border border-sky-300/20 bg-sky-500/10 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-sky-200">Crash</p>
                    <p className="mt-1 text-sm font-semibold">{crashCourses.length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-4 lg:col-span-2">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-xl">Purchased Courses</CardTitle>
                  <CardDescription>Regular courses you have purchased or added.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Skeleton className="h-36 w-full" />
                      <Skeleton className="h-36 w-full" />
                    </div>
                  ) : regularCourses.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-8 text-center text-muted-foreground">
                      <GraduationCap className="mx-auto mb-3 h-6 w-6" />
                      <p className="font-medium">No regular course added yet.</p>
                      <p className="mt-1 text-sm">Add or purchase a course and it will appear here.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {regularCourses.map((course) => {
                        const resolvedExamName = examNameById[course.examTypeId || ''] || 'Exam not tagged';
                        const subjectNames = (course.subjectIds || [])
                          .map((subjectId) => subjectNameById[subjectId])
                          .filter(Boolean);
                        const visibleSubjectNames = subjectNames.slice(0, 2);
                        const moreSubjectsCount = Math.max(0, subjectNames.length - visibleSubjectNames.length);
                        const publicCoursePrice = publicCoursePriceById[course.id];
                        const hasPublicPaidPrice = course.accessLevel === 'paid' && Number.isFinite(publicCoursePrice) && publicCoursePrice > 0;

                        return (
                        <Card
                          key={course.id}
                          className="group overflow-hidden border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-blue-950/40 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/50 hover:shadow-[0_14px_34px_-22px_rgba(34,211,238,0.45)]"
                        >
                          <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400/80 via-sky-400/80 to-blue-500/80" />
                          <CardContent className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <p className="line-clamp-1 text-lg font-semibold">{course.title || 'Untitled Course'}</p>
                              <Badge className={course.accessLevel === 'paid' ? 'bg-rose-500/90 text-white' : 'bg-cyan-500/90 text-slate-950'}>
                                {course.accessLevel === 'paid' ? 'Paid' : 'Free'}
                              </Badge>
                            </div>

                            {course.description ? (
                              <p className="line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
                            ) : null}

                            <div className={`rounded-xl border px-3 py-2.5 ${course.accessLevel === 'paid' ? 'border-amber-300/25 bg-amber-500/10' : 'border-emerald-300/25 bg-emerald-500/10'}`}>
                              <p className={`text-[11px] uppercase tracking-[0.22em] ${course.accessLevel === 'paid' ? 'text-amber-100/80' : 'text-emerald-100/80'}`}>
                                {course.accessLevel === 'paid' ? 'Course Price' : 'Access'}
                              </p>
                              <p className={`mt-1 text-sm font-semibold ${course.accessLevel === 'paid' ? 'text-amber-100' : 'text-emerald-100'}`}>
                                {course.accessLevel === 'paid'
                                  ? hasPublicPaidPrice
                                    ? `INR ${publicCoursePrice.toLocaleString()}`
                                    : 'Price not attached'
                                  : 'Free'}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground">
                                <BookOpen className="h-3.5 w-3.5 text-cyan-300" />
                                <span className="line-clamp-1">{resolvedExamName}</span>
                              </div>
                              <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground">
                                <GraduationCap className="h-3.5 w-3.5 text-blue-300" />
                                <span className="line-clamp-1">{course.classLevel || 'Curriculum not tagged'}</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {visibleSubjectNames.length > 0 ? (
                                <>
                                  {visibleSubjectNames.map((subjectName) => (
                                    <Badge
                                      key={`${course.id}-${subjectName}`}
                                      variant="outline"
                                      className="border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
                                    >
                                      {subjectName}
                                    </Badge>
                                  ))}
                                  {moreSubjectsCount > 0 ? (
                                    <Badge variant="outline" className="border-border/70 bg-muted/20 text-muted-foreground">
                                      +{moreSubjectsCount} more
                                    </Badge>
                                  ) : null}
                                </>
                              ) : (
                                <Badge variant="outline" className="border-border/70 bg-muted/20 text-muted-foreground">
                                  Subject not tagged
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-3">
                              <Button
                                asChild
                                className="group/cta h-10 rounded-full border border-cyan-300/35 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-400 px-4 font-medium text-slate-950 shadow-[0_8px_20px_-10px_rgba(56,189,248,0.7)] transition-all hover:from-cyan-300 hover:via-sky-300 hover:to-blue-300 hover:shadow-[0_12px_24px_-10px_rgba(56,189,248,0.75)]"
                              >
                                <Link href={`/courses/${course.id}`}>
                                  <span>Open Course</span>
                                  <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-950/20 transition-transform group-hover/cta:translate-x-0.5">
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </span>
                                </Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-xl">Crash Courses</CardTitle>
                  <CardDescription>Purchased or free-added crash courses from your learning list.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Skeleton className="h-36 w-full" />
                      <Skeleton className="h-36 w-full" />
                    </div>
                  ) : crashCourses.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-8 text-center text-muted-foreground">
                      <GraduationCap className="mx-auto mb-3 h-6 w-6" />
                      <p className="font-medium">No crash course added yet.</p>
                      <p className="mt-1 text-sm">Crash courses you purchase or add will appear here.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {crashCourses.map((course) => {
                        const resolvedExamName = examNameById[course.examTypeId || ''] || 'Exam not tagged';
                        const subjectNames = (course.subjectIds || [])
                          .map((subjectId) => subjectNameById[subjectId])
                          .filter(Boolean);
                        const visibleSubjectNames = subjectNames.slice(0, 2);
                        const moreSubjectsCount = Math.max(0, subjectNames.length - visibleSubjectNames.length);
                        const publicCoursePrice = publicCoursePriceById[course.id];
                        const hasPublicPaidPrice = course.accessLevel === 'paid' && Number.isFinite(publicCoursePrice) && publicCoursePrice > 0;

                        return (
                        <Card
                          key={course.id}
                          className="group overflow-hidden border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-blue-950/40 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/50 hover:shadow-[0_14px_34px_-22px_rgba(34,211,238,0.45)]"
                        >
                          <div className="h-1.5 w-full bg-gradient-to-r from-rose-400/80 via-red-400/80 to-amber-500/80" />
                          <CardContent className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <p className="line-clamp-1 text-lg font-semibold">{course.title || 'Untitled Course'}</p>
                              <div className="flex items-center gap-1.5">
                                <Badge className="bg-red-500/90 text-white">Crash</Badge>
                                <Badge className={course.accessLevel === 'paid' ? 'bg-rose-500/90 text-white' : 'bg-cyan-500/90 text-slate-950'}>
                                  {course.accessLevel === 'paid' ? 'Paid' : 'Free'}
                                </Badge>
                              </div>
                            </div>

                            {course.description ? (
                              <p className="line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
                            ) : null}

                            <div className={`rounded-xl border px-3 py-2.5 ${course.accessLevel === 'paid' ? 'border-amber-300/25 bg-amber-500/10' : 'border-emerald-300/25 bg-emerald-500/10'}`}>
                              <p className={`text-[11px] uppercase tracking-[0.22em] ${course.accessLevel === 'paid' ? 'text-amber-100/80' : 'text-emerald-100/80'}`}>
                                {course.accessLevel === 'paid' ? 'Course Price' : 'Access'}
                              </p>
                              <p className={`mt-1 text-sm font-semibold ${course.accessLevel === 'paid' ? 'text-amber-100' : 'text-emerald-100'}`}>
                                {course.accessLevel === 'paid'
                                  ? hasPublicPaidPrice
                                    ? `INR ${publicCoursePrice.toLocaleString()}`
                                    : 'Price not attached'
                                  : 'Free'}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground">
                                <BookOpen className="h-3.5 w-3.5 text-cyan-300" />
                                <span className="line-clamp-1">{resolvedExamName}</span>
                              </div>
                              <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground">
                                <GraduationCap className="h-3.5 w-3.5 text-blue-300" />
                                <span className="line-clamp-1">{course.classLevel || 'Curriculum not tagged'}</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {visibleSubjectNames.length > 0 ? (
                                <>
                                  {visibleSubjectNames.map((subjectName) => (
                                    <Badge
                                      key={`${course.id}-${subjectName}`}
                                      variant="outline"
                                      className="border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
                                    >
                                      {subjectName}
                                    </Badge>
                                  ))}
                                  {moreSubjectsCount > 0 ? (
                                    <Badge variant="outline" className="border-border/70 bg-muted/20 text-muted-foreground">
                                      +{moreSubjectsCount} more
                                    </Badge>
                                  ) : null}
                                </>
                              ) : (
                                <Badge variant="outline" className="border-border/70 bg-muted/20 text-muted-foreground">
                                  Subject not tagged
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-3">
                              <Button
                                asChild
                                className="group/cta h-10 rounded-full border border-cyan-300/35 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-400 px-4 font-medium text-slate-950 shadow-[0_8px_20px_-10px_rgba(56,189,248,0.7)] transition-all hover:from-cyan-300 hover:via-sky-300 hover:to-blue-300 hover:shadow-[0_12px_24px_-10px_rgba(56,189,248,0.75)]"
                              >
                                <Link href={`/courses/${course.id}`}>
                                  <span>Open Course</span>
                                  <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-950/20 transition-transform group-hover/cta:translate-x-0.5">
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </span>
                                </Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-lg">Learning Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <BookOpen className="mt-0.5 h-4 w-4 text-primary" />
                  <p>Choose course combinations based on your exam and class goals.</p>
                </div>
                <div className="flex items-start gap-2">
                  <Layers3 className="mt-0.5 h-4 w-4 text-primary" />
                  <p>Finish modules in order for stronger conceptual progression.</p>
                </div>
                <div className="flex items-start gap-2">
                  <GraduationCap className="mt-0.5 h-4 w-4 text-primary" />
                  <p>Revisit completed lessons and tests for long-term retention.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
