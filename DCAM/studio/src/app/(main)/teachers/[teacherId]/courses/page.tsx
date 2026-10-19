'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { collection, doc, query, where } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRight, BookOpenText } from 'lucide-react';
import { isPublicTeacherProfile } from '@/lib/teacher-approval';

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string };
type TeacherProfile = {
  roleId?: 'student' | 'teacher' | 'admin';
  status?: 'active' | 'blocked';
  teacherStatus?: 'pending' | 'approved' | 'rejected';
};
type Course = {
  id: string;
  title?: string;
  description?: string;
  accessLevel?: 'free' | 'paid';
  publicationStatus?: 'draft' | 'published' | 'deleted';
  subscriptionAttached?: boolean;
  examTypeId?: string;
  classId?: string;
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

export default function TeacherCoursesPage() {
  const params = useParams<{ teacherId: string }>();
  const teacherId = typeof params?.teacherId === 'string' ? params.teacherId : '';
  const firestore = useFirestore();

  const teacherRef = useMemoFirebase(() => (firestore && teacherId ? doc(firestore, 'users', teacherId) : null), [firestore, teacherId]);
  const examTypesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types')) : null), [firestore]);
  const classesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes')) : null), [firestore]);
  const freeCoursesQ = useMemoFirebase(
    () => (firestore && teacherId ? query(collection(firestore, 'courses'), where('teacherId', '==', teacherId), where('accessLevel', '==', 'free')) : null),
    [firestore, teacherId]
  );
  const paidCoursesQ = useMemoFirebase(
    () =>
      firestore && teacherId
        ? query(collection(firestore, 'courses'), where('teacherId', '==', teacherId), where('accessLevel', '==', 'paid'), where('subscriptionAttached', '==', true))
        : null,
    [firestore, teacherId]
  );

  const { data: teacher, isLoading: teacherLoading } = useDoc<TeacherProfile>(teacherRef);
  const { data: examTypes } = useCollection<ExamType>(examTypesQ);
  const { data: classes } = useCollection<ClassItem>(classesQ);
  const { data: freeCourses, isLoading: freeLoading } = useCollection<Course>(freeCoursesQ);
  const { data: paidCourses, isLoading: paidLoading } = useCollection<Course>(paidCoursesQ);

  const examNameById = useMemo(() => Object.fromEntries((examTypes || []).map((e) => [e.id, e.name])), [examTypes]);
  const classNameById = useMemo(() => Object.fromEntries((classes || []).map((c) => [c.id, c.name])), [classes]);

  const courses = useMemo(() => {
    const merged = [...(freeCourses || []), ...(paidCourses || [])];
    const unique = Array.from(new Map(merged.map((course) => [course.id, course])).values());
    return unique
      .filter((course) => course.publicationStatus !== 'draft' && course.publicationStatus !== 'deleted')
      .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
  }, [freeCourses, paidCourses]);

  const loading = teacherLoading || freeLoading || paidLoading;
  const isTeacherAvailable = teacher?.roleId === 'teacher' && isPublicTeacherProfile(teacher);

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Teacher Courses" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <Card className="overflow-hidden border-primary/30 bg-gradient-to-r from-sky-950/35 via-blue-950/25 to-indigo-950/35">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Teacher Profile</p>
                <h2 className="text-2xl font-semibold">Published Courses</h2>
              </div>
              <Button asChild variant="outline">
                <Link href={`/teachers/${teacherId}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Profile
                </Link>
              </Button>
            </CardContent>
          </Card>

          {loading ? (
            <Skeleton className="h-60 w-full" />
          ) : !isTeacherAvailable ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center text-muted-foreground">Teacher profile not available.</CardContent>
            </Card>
          ) : courses.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center text-muted-foreground">No courses available yet.</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {courses.map((course) => (
                <Card key={course.id} className="border-border/70 bg-card/90">
                  <CardHeader>
                    <CardTitle className="line-clamp-2 flex items-start gap-2 text-lg">
                      <BookOpenText className="mt-0.5 h-4 w-4 text-primary" />
                      <span>{course.title || 'Untitled Course'}</span>
                    </CardTitle>
                    <CardDescription className="line-clamp-2">{course.description || 'No description added.'}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={course.accessLevel === 'paid' ? 'destructive' : 'default'}>
                        {course.accessLevel === 'paid' ? 'Paid' : 'Free'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {examNameById[course.examTypeId || ''] || 'Exam'} - {classNameById[course.classId || ''] || 'Curriculum'}
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/courses/${course.id}`}>
                        View Course <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
