'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardHeader from '@/components/dashboard-header';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, doc, where, updateDoc, getDocs } from 'firebase/firestore';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, ArrowRight, GraduationCap, Link2, PencilLine, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string; examTypeId?: string };
type Subject = { id: string; name: string; classId: string };
type Course = {
  id: string;
  title: string;
  description: string;
  teacherId?: string;
  teacherName: string;
  price?: number;
  accessLevel?: 'free' | 'paid';
  subscriptionAttached?: boolean;
  publicationStatus?: 'draft' | 'published' | 'deleted';
  thumbnailUrl?: string;
  imageUrl?: string;
  classLevel: string;
  classId?: string;
  examTypeId?: string;
  subjectIds?: string[];
  isCrashCourse?: boolean;
  modules?: Array<{ accessLevel: 'free' | 'paid' }>;
};

type CourseView = 'draft' | 'your' | 'waiting-subscription' | null;

type CourseCardProps = {
  course: Course;
  canContinueEditing?: boolean;
  canEditCourse?: boolean;
  showAttachSubscription?: boolean;
  canDeleteCourse?: boolean;
  isDeletingCourse?: boolean;
  onDeleteCourse?: (course: Course) => void;
};

function CourseCard({
  course,
  canContinueEditing,
  canEditCourse,
  showAttachSubscription,
  canDeleteCourse,
  isDeletingCourse,
  onDeleteCourse,
}: CourseCardProps) {
  const placeholder = PlaceHolderImages.find((img) => img.id === 'content-delivery');
  const accessLabel = course.accessLevel === 'paid' ? 'Premium Course' : 'Free Course';
  const isWaitingForSubscription = course.accessLevel === 'paid' && course.subscriptionAttached !== true;
  const accessBadgeClass = course.accessLevel === 'paid'
    ? 'border-rose-400/40 bg-rose-500/15 text-rose-100'
    : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100';

  return (
    <Card className="group flex max-w-sm flex-col overflow-hidden border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-blue-950/70 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-cyan-950/20">
      <div className="relative h-36 w-full overflow-hidden">
        <img
          src={course.thumbnailUrl || course.imageUrl || placeholder?.imageUrl || 'https://picsum.photos/seed/course/600/400'}
          alt={course.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          {course.isCrashCourse ? <Badge className="border-red-400/50 bg-red-500/20 text-red-100">Crash Course</Badge> : null}
          <Badge variant="secondary" className="bg-slate-800/90 text-slate-100">{course.classLevel}</Badge>
        </div>
      </div>
      <CardHeader className="space-y-2 pb-1">
        <div>
          <CardTitle className="font-headline text-xl leading-tight">{course.title}</CardTitle>
          <CardDescription className="mt-1 text-sm">by {course.teacherName}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-3 pb-4">
        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[38px]">{course.description}</p>
        <div className="flex items-center gap-2">
          <Badge className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${accessBadgeClass}`}>
            {accessLabel}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="border-t border-border/70 bg-slate-900/60 p-4">
        <div className="grid w-full gap-2">
          {showAttachSubscription && isWaitingForSubscription ? (
            <Button
              asChild
              className="h-10 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-900/30 hover:from-amber-400 hover:to-orange-400"
            >
              <a href={`/subscription?linkedContentType=course&linkedContentId=${course.id}`}>
                <Link2 className="mr-2 h-4 w-4" />
                Attach Subscription
              </a>
            </Button>
          ) : null}
          {canEditCourse ? (
            <Button
              asChild
              variant="outline"
              className="h-10 w-full rounded-xl border-slate-600/80 bg-slate-900/70 text-slate-100 hover:bg-slate-800/85 hover:text-white"
            >
              <Link href={`/courses/edit/${course.id}`}>
                <PencilLine className="mr-2 h-4 w-4" />
                {canContinueEditing ? 'Continue Editing' : 'Edit Course'}
              </Link>
            </Button>
          ) : null}
          {canDeleteCourse ? (
            <Button
              type="button"
              variant="destructive"
              className="h-10 w-full rounded-xl"
              onClick={() => onDeleteCourse?.(course)}
              disabled={!!isDeletingCourse}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeletingCourse ? 'Deleting...' : 'Delete Course'}
            </Button>
          ) : null}
          <Button
            asChild
            className="h-10 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-blue-900/30 hover:from-sky-400 hover:to-blue-400"
          >
            <Link href={`/courses/${course.id}`}>
              Open Course <ArrowRight className="ml-2" />
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default function CoursesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isTeacher, isExplicitStudent, isLoading: isTeacherLoading } = useIsTeacher();
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);

  const coursesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (isTeacherLoading) return null;
    if (isTeacher && user?.uid) {
      return query(collection(firestore, 'courses'), where('teacherId', '==', user.uid));
    }
    if (isExplicitStudent) {
      return query(collection(firestore, 'courses'), orderBy('createdAt', 'desc'));
    }
    return null;
  }, [firestore, isTeacher, isExplicitStudent, isTeacherLoading, user?.uid]);
  const examTypesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (isTeacherLoading || isTeacher || !isExplicitStudent) return null;
    return query(collection(firestore, 'exam_types'), orderBy('name'));
  }, [firestore, isTeacherLoading, isTeacher, isExplicitStudent]);
  const classesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (isTeacherLoading || isTeacher || !isExplicitStudent) return null;
    return query(collection(firestore, 'classes'), orderBy('name'));
  }, [firestore, isTeacherLoading, isTeacher, isExplicitStudent]);
  const subjectsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (isTeacherLoading || isTeacher || !isExplicitStudent) return null;
    return query(collection(firestore, 'subjects'), orderBy('name'));
  }, [firestore, isTeacherLoading, isTeacher, isExplicitStudent]);

  const { data: courses, isLoading: areCoursesLoading } = useCollection<Course>(coursesQuery);
  const { data: examTypes, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classes, isLoading: areClassesLoading } = useCollection<ClassItem>(classesQuery);
  const { data: subjects, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);

  const [selectedExamTypeId, setSelectedExamTypeId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [showOnlyCrash, setShowOnlyCrash] = useState(false);

  const isCourseDeleted = (course: Course) => course.publicationStatus === 'deleted';

  const filteredClasses = useMemo(() => {
    if (!classes || !selectedExamTypeId) return [];
    return classes.filter((c) => c.examTypeId === selectedExamTypeId);
  }, [classes, selectedExamTypeId]);

  const filteredSubjects = useMemo(() => {
    if (!subjects || !selectedClassId) return [];
    return subjects.filter((s) => s.classId === selectedClassId);
  }, [subjects, selectedClassId]);

  useEffect(() => {
    if (!examTypes || examTypes.length === 0) {
      setSelectedExamTypeId('');
      return;
    }
    if (!selectedExamTypeId || !examTypes.some((et) => et.id === selectedExamTypeId)) {
      setSelectedExamTypeId(examTypes[0].id);
    }
  }, [examTypes, selectedExamTypeId]);

  useEffect(() => {
    if (filteredClasses.length === 0) {
      setSelectedClassId('');
      return;
    }
    if (!selectedClassId || !filteredClasses.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(filteredClasses[0].id);
    }
  }, [filteredClasses, selectedClassId]);

  useEffect(() => {
    if (selectedSubjectId !== 'all' && !filteredSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId('all');
    }
  }, [filteredSubjects, selectedSubjectId]);

  const coursesByCurriculum = useMemo(() => {
    if (!courses || !selectedClassId) return [];
    return courses.filter((course) => course.classId === selectedClassId && !isCourseDeleted(course));
  }, [courses, selectedClassId]);

  const hasAnyCrashCourse = useMemo(() => coursesByCurriculum.some((course) => course.isCrashCourse), [coursesByCurriculum]);

  const visibleCourses = useMemo(() => {
    if (isTeacher) return (courses || []).filter((course) => !isCourseDeleted(course));
    const liveCourses = coursesByCurriculum.filter(
      (course) =>
        course.publicationStatus !== 'draft'
        && (course.accessLevel !== 'paid' || course.subscriptionAttached === true)
    );
    const bySubject = liveCourses.filter((course) => {
      if (selectedSubjectId === 'all') return true;
      return (course.subjectIds || []).includes(selectedSubjectId);
    });
    if (!showOnlyCrash) return bySubject;
    return bySubject.filter((course) => course.isCrashCourse);
  }, [coursesByCurriculum, selectedSubjectId, showOnlyCrash, isTeacher]);

  const rawView = searchParams.get('view');
  const view: CourseView =
    rawView === 'draft' || rawView === 'your' || rawView === 'waiting-subscription'
      ? rawView
      : null;
  const teacherCoursesForView = useMemo(() => {
    if (!isTeacher) return [];
    const ownCourses = (courses || []).filter((course) => course.teacherId === user?.uid && !isCourseDeleted(course));
    const isWaitingForSubscription = (course: Course) =>
      course.accessLevel === 'paid' && course.subscriptionAttached !== true;

    if (view === 'draft') {
      return ownCourses.filter((course) => course.publicationStatus === 'draft' && !isWaitingForSubscription(course));
    }

    if (view === 'your') {
      return ownCourses.filter(
        (course) => course.publicationStatus !== 'draft' && (course.accessLevel !== 'paid' || course.subscriptionAttached === true)
      );
    }

    if (view === 'waiting-subscription') {
      return ownCourses.filter((course) => isWaitingForSubscription(course));
    }

    return ownCourses;
  }, [courses, isTeacher, user, view]);

  const displayedCourses = isTeacher ? (view ? teacherCoursesForView : visibleCourses) : visibleCourses;
  const teacherCrashCourses = useMemo(
    () => (isTeacher && view === 'your' ? teacherCoursesForView.filter((course) => course.isCrashCourse) : []),
    [isTeacher, view, teacherCoursesForView]
  );
  const teacherRegularCourses = useMemo(
    () => (isTeacher && view === 'your' ? teacherCoursesForView.filter((course) => !course.isCrashCourse) : teacherCoursesForView),
    [isTeacher, view, teacherCoursesForView]
  );
  const teacherWaitingRegularCourses = useMemo(
    () => (isTeacher && view === 'waiting-subscription' ? teacherCoursesForView.filter((course) => !course.isCrashCourse) : []),
    [isTeacher, view, teacherCoursesForView]
  );
  const teacherWaitingCrashCourses = useMemo(
    () => (isTeacher && view === 'waiting-subscription' ? teacherCoursesForView.filter((course) => course.isCrashCourse) : []),
    [isTeacher, view, teacherCoursesForView]
  );
  const pageTitle = !isTeacher
    ? 'Explore Our Courses'
    : view === 'draft'
      ? 'Draft Courses'
      : view === 'your'
        ? 'Your Courses'
        : view === 'waiting-subscription'
          ? 'Waiting for Subscription'
          : 'Explore Our Courses';
  const showCreateCourseAction = isTeacher && !view;

  useEffect(() => {
    if (!hasAnyCrashCourse && showOnlyCrash) setShowOnlyCrash(false);
  }, [hasAnyCrashCourse, showOnlyCrash]);

  const isLoading = isTeacher
    ? (isTeacherLoading || areCoursesLoading)
    : (isTeacherLoading || areCoursesLoading || areExamTypesLoading || areClassesLoading || areSubjectsLoading);

  const handleDeleteCourse = async (course: Course) => {
    if (!firestore || !user?.uid) return;
    if (course.teacherId !== user.uid) {
      toast({
        variant: 'destructive',
        title: 'Delete Not Allowed',
        description: 'You can only delete courses created by your account.',
      });
      return;
    }
    const confirmed = window.confirm(`Remove "${course.title}" from your courses? Students will no longer see it.`);
    if (!confirmed) return;

    setDeletingCourseId(course.id);
    try {
      await updateDoc(doc(firestore, 'courses', course.id), {
        publicationStatus: 'deleted',
        deletedAt: new Date().toISOString(),
        deletedBy: user.uid,
      });

      try {
        const linkedPlansQuery = query(
          collection(firestore, 'subscription_plans'),
          where('linkedContentType', '==', 'course'),
          where('linkedContentId', '==', course.id)
        );
        const linkedPlansSnapshot = await getDocs(linkedPlansQuery);
        for (const planDoc of linkedPlansSnapshot.docs) {
          await updateDoc(doc(firestore, 'subscription_plans', planDoc.id), {
            linkedContentId: null,
            linkedContentType: null,
            status: 'archived',
            archivedAt: new Date().toISOString(),
          });
        }
      } catch {
        // Best-effort cleanup for linked plans.
      }

      toast({
        title: 'Course removed',
        description: 'The course was archived and hidden successfully.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error?.message || 'Could not remove this course.',
      });
    } finally {
      setDeletingCourseId(null);
    }
  };

  useEffect(() => {
    if (!isTeacherLoading && !isTeacher && isExplicitStudent) {
      router.replace('/my-learning');
    }
  }, [isTeacher, isExplicitStudent, isTeacherLoading, router]);

  if (!isTeacherLoading && !isTeacher && isExplicitStudent) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Courses" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="border-border/70">
            <CardContent className="p-6 text-muted-foreground">Redirecting to My Learning...</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Courses" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-headline text-2xl font-semibold">{pageTitle}</h2>
          {showCreateCourseAction && (
            <Button asChild>
              <Link href="/courses/create">
                <PlusCircle className="mr-2" /> Create New Course
              </Link>
            </Button>
          )}
        </div>

        {!isTeacher ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Choose Your Learning Path</CardTitle>
              <CardDescription>Start by selecting exam type, curriculum and subject.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select value={selectedExamTypeId} onValueChange={setSelectedExamTypeId}>
                  <SelectTrigger><SelectValue placeholder="Select exam type" /></SelectTrigger>
                  <SelectContent>
                    {(examTypes || []).map((examType) => (
                      <SelectItem key={examType.id} value={examType.id}>{examType.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={!selectedExamTypeId || filteredClasses.length === 0}>
                  <SelectTrigger><SelectValue placeholder="Select curriculum" /></SelectTrigger>
                  <SelectContent>
                    {filteredClasses.map((classItem) => (
                      <SelectItem key={classItem.id} value={classItem.id}>{classItem.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId} disabled={!selectedClassId || filteredSubjects.length === 0}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {filteredSubjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasAnyCrashCourse ? (
                <div className="flex items-center gap-2">
                  <Checkbox checked={showOnlyCrash} onCheckedChange={(v) => setShowOnlyCrash(!!v)} />
                  <p className="text-sm">Show Crash Courses Only</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {isLoading ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : displayedCourses.length > 0 ? (
          isTeacher && view === 'your' ? (
            <div className="space-y-8">
              {teacherRegularCourses.length > 0 ? (
                <div>
                  <h3 className="mb-4 text-lg font-semibold">Regular Courses</h3>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {teacherRegularCourses.map((course) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        canContinueEditing={course.publicationStatus === 'draft' && course.teacherId === user?.uid}
                        canEditCourse={course.teacherId === user?.uid}
                        showAttachSubscription={false}
                        canDeleteCourse={course.teacherId === user?.uid}
                        isDeletingCourse={deletingCourseId === course.id}
                        onDeleteCourse={handleDeleteCourse}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {teacherCrashCourses.length > 0 ? (
                <div>
                  <h3 className="mb-4 text-lg font-semibold">Crash Courses</h3>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {teacherCrashCourses.map((course) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        canContinueEditing={course.publicationStatus === 'draft' && course.teacherId === user?.uid}
                        canEditCourse={course.teacherId === user?.uid}
                        showAttachSubscription={false}
                        canDeleteCourse={course.teacherId === user?.uid}
                        isDeletingCourse={deletingCourseId === course.id}
                        onDeleteCourse={handleDeleteCourse}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : isTeacher && view === 'waiting-subscription' ? (
            <div className="space-y-8">
              {teacherWaitingRegularCourses.length > 0 ? (
                <div>
                  <h3 className="mb-4 text-lg font-semibold">Regular Courses Waiting for Subscription</h3>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {teacherWaitingRegularCourses.map((course) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        canContinueEditing={false}
                        canEditCourse={course.teacherId === user?.uid}
                        showAttachSubscription={course.teacherId === user?.uid}
                        canDeleteCourse={course.teacherId === user?.uid}
                        isDeletingCourse={deletingCourseId === course.id}
                        onDeleteCourse={handleDeleteCourse}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {teacherWaitingCrashCourses.length > 0 ? (
                <div>
                  <h3 className="mb-4 text-lg font-semibold">Crash Courses Waiting for Subscription</h3>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {teacherWaitingCrashCourses.map((course) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        canContinueEditing={false}
                        canEditCourse={course.teacherId === user?.uid}
                        showAttachSubscription={course.teacherId === user?.uid}
                        canDeleteCourse={course.teacherId === user?.uid}
                        isDeletingCourse={deletingCourseId === course.id}
                        onDeleteCourse={handleDeleteCourse}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {displayedCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  canContinueEditing={isTeacher && course.publicationStatus === 'draft' && course.teacherId === user?.uid}
                  canEditCourse={isTeacher && course.teacherId === user?.uid}
                  showAttachSubscription={view === 'waiting-subscription' && course.teacherId === user?.uid}
                  canDeleteCourse={isTeacher && course.teacherId === user?.uid}
                  isDeletingCourse={deletingCourseId === course.id}
                  onDeleteCourse={handleDeleteCourse}
                />
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 md:p-16 border-2 border-dashed rounded-lg bg-muted/50 h-full">
            <GraduationCap className="w-20 h-20 text-muted-foreground mb-4" />
            <h3 className="font-headline text-2xl font-semibold">No Courses Found</h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              {isTeacher ? 'Create the first course to get started.' : 'No courses match your current exam/curriculum/subject selection.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
