'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { collection, doc, query, where } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { isStandaloneMockTest } from '@/lib/mock-test-visibility';
import { formatTestDurationLabel } from '@/lib/test-duration';
import { isPublicTeacherProfile } from '@/lib/teacher-approval';

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string };
type TeacherProfile = {
  roleId?: 'student' | 'teacher' | 'admin';
  status?: 'active' | 'blocked';
  teacherStatus?: 'pending' | 'approved' | 'rejected';
};
type MockTest = {
  id: string;
  title?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  accessLevel?: 'free' | 'paid';
  publicationStatus?: 'draft' | 'published';
  isCourseOnly?: boolean;
  courseId?: string;
  examTypeId?: string;
  classId?: string;
  startTime?: { toDate?: () => Date } | Date | string;
  config?: { questionIds?: string[]; duration?: number | null };
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

export default function TeacherMockTestsPage() {
  const params = useParams<{ teacherId: string }>();
  const teacherId = typeof params?.teacherId === 'string' ? params.teacherId : '';
  const firestore = useFirestore();

  const teacherRef = useMemoFirebase(() => (firestore && teacherId ? doc(firestore, 'users', teacherId) : null), [firestore, teacherId]);
  const examTypesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types')) : null), [firestore]);
  const classesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes')) : null), [firestore]);
  const testsQ = useMemoFirebase(
    () => (firestore && teacherId ? query(collection(firestore, 'mock_tests'), where('teacherId', '==', teacherId), where('publicationStatus', '==', 'published')) : null),
    [firestore, teacherId]
  );

  const { data: teacher, isLoading: teacherLoading } = useDoc<TeacherProfile>(teacherRef);
  const { data: examTypes } = useCollection<ExamType>(examTypesQ);
  const { data: classes } = useCollection<ClassItem>(classesQ);
  const { data: testsRaw, isLoading: testsLoading } = useCollection<MockTest>(testsQ);

  const examNameById = useMemo(() => Object.fromEntries((examTypes || []).map((e) => [e.id, e.name])), [examTypes]);
  const classNameById = useMemo(() => Object.fromEntries((classes || []).map((c) => [c.id, c.name])), [classes]);

  const tests = useMemo(
    () =>
      (testsRaw || [])
        .filter((test) => isStandaloneMockTest(test))
        .sort((a, b) => (toDate(b.startTime)?.getTime() || 0) - (toDate(a.startTime)?.getTime() || 0)),
    [testsRaw]
  );
  const loading = teacherLoading || testsLoading;
  const isTeacherAvailable = teacher?.roleId === 'teacher' && isPublicTeacherProfile(teacher);

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Teacher Mock Tests" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <Card className="overflow-hidden border-primary/30 bg-gradient-to-r from-sky-950/35 via-blue-950/25 to-indigo-950/35">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Teacher Profile</p>
                <h2 className="text-2xl font-semibold">Published Mock Tests</h2>
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
          ) : tests.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center text-muted-foreground">No mock tests available yet.</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tests.map((test) => (
                <Card key={test.id} className="group relative flex flex-col overflow-hidden border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-blue-950/75 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-sky-400/50 hover:shadow-sky-950/40">
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(56,189,248,0.2),transparent_48%)]" />
                  </div>
                  {(test.thumbnailUrl || test.imageUrl) ? (
                    <div className="relative h-32 w-full overflow-hidden border-b border-border/60">
                      <img src={test.thumbnailUrl || test.imageUrl} alt={test.title || 'Mock test'} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                    </div>
                  ) : null}
                  <CardHeader className="relative space-y-2 pb-3">
                    <CardTitle className="line-clamp-2 text-2xl font-semibold leading-tight tracking-tight">{test.title || 'Untitled Test'}</CardTitle>
                    <CardDescription className="text-sm text-slate-300">
                      {(examNameById[test.examTypeId || ''] || 'Exam')} | {(classNameById[test.classId || ''] || 'Curriculum')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative space-y-3 pt-0">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-muted-foreground">
                        Questions
                        <p className="mt-1 text-sm font-semibold text-foreground">{test.config?.questionIds?.length || 0}</p>
                      </div>
                      <div className="rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-muted-foreground">
                        Duration
                        <p className="mt-1 text-sm font-semibold text-foreground">{formatTestDurationLabel(test.config?.duration)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge className={test.accessLevel === 'paid' ? 'border-red-400/60 bg-red-500/20 text-red-100' : 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'}>
                        {test.accessLevel === 'paid' ? 'Paid' : 'Free'}
                      </Badge>
                    </div>
                  </CardContent>
                  <CardFooter className="grid grid-cols-2 gap-2 pt-1">
                    <Button asChild variant="outline" className="rounded-full border-slate-600/80 bg-slate-900/75 hover:bg-slate-800/85">
                      <Link href={`/mock-tests/${test.id}`}>
                        View Test
                      </Link>
                    </Button>
                    <Button asChild className="rounded-full">
                      <Link href={`/mock-tests/${test.id}/start`}>
                        Start Test <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
