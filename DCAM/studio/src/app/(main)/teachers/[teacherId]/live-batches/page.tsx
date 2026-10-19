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
import { ArrowLeft, CalendarClock, Video, View } from 'lucide-react';
import { isPublicTeacherProfile } from '@/lib/teacher-approval';

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string };
type Subject = { id: string; name: string };
type TeacherProfile = {
  roleId?: 'student' | 'teacher' | 'admin';
  status?: 'active' | 'blocked';
  teacherStatus?: 'pending' | 'approved' | 'rejected';
};
type LiveBatch = {
  id: string;
  title?: string;
  description?: string;
  accessLevel?: 'free' | 'paid';
  publicationStatus?: 'draft' | 'published';
  subscriptionAttached?: boolean;
  examTypeId?: string;
  classId?: string;
  batchStartDate?: string;
  subjectIds?: string[];
  thumbnailUrl?: string;
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

function formatBatchStartDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

export default function TeacherLiveBatchesPage() {
  const params = useParams<{ teacherId: string }>();
  const teacherId = typeof params?.teacherId === 'string' ? params.teacherId : '';
  const firestore = useFirestore();

  const teacherRef = useMemoFirebase(() => (firestore && teacherId ? doc(firestore, 'users', teacherId) : null), [firestore, teacherId]);
  const examTypesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types')) : null), [firestore]);
  const classesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes')) : null), [firestore]);
  const subjectsQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects')) : null), [firestore]);
  const batchesQ = useMemoFirebase(
    () => (firestore && teacherId ? query(collection(firestore, 'live_batches'), where('teacherId', '==', teacherId), where('publicationStatus', '==', 'published')) : null),
    [firestore, teacherId]
  );

  const { data: teacher, isLoading: teacherLoading } = useDoc<TeacherProfile>(teacherRef);
  const { data: examTypes } = useCollection<ExamType>(examTypesQ);
  const { data: classes } = useCollection<ClassItem>(classesQ);
  const { data: subjects } = useCollection<Subject>(subjectsQ);
  const { data: batchesRaw, isLoading: batchesLoading } = useCollection<LiveBatch>(batchesQ);

  const examNameById = useMemo(() => Object.fromEntries((examTypes || []).map((e) => [e.id, e.name])), [examTypes]);
  const classNameById = useMemo(() => Object.fromEntries((classes || []).map((c) => [c.id, c.name])), [classes]);
  const subjectNameById = useMemo(() => Object.fromEntries((subjects || []).map((s) => [s.id, s.name])), [subjects]);

  const batches = useMemo(
    () =>
      (batchesRaw || [])
        .filter((batch) => batch.accessLevel !== 'paid' || batch.subscriptionAttached === true)
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)),
    [batchesRaw]
  );
  const loading = teacherLoading || batchesLoading;
  const isTeacherAvailable = teacher?.roleId === 'teacher' && isPublicTeacherProfile(teacher);

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Teacher Live Batches" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <Card className="overflow-hidden border-primary/30 bg-gradient-to-r from-sky-950/35 via-blue-950/25 to-indigo-950/35">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Teacher Profile</p>
                <h2 className="text-2xl font-semibold">Live Batches</h2>
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
          ) : batches.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center text-muted-foreground">No live batches available yet.</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {batches.map((batch) => (
                <Card key={batch.id} className="overflow-hidden border-border/70 bg-card/90">
                  <div className="h-36 w-full bg-muted">
                    {batch.thumbnailUrl ? (
                      <img src={batch.thumbnailUrl} alt={batch.title || 'Live Batch'} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No Thumbnail</div>
                    )}
                  </div>
                  <CardHeader>
                    <CardTitle className="line-clamp-2 flex items-start gap-2 text-lg">
                      <Video className="mt-0.5 h-4 w-4 text-primary" />
                      <span>{batch.title || 'Untitled Batch'}</span>
                    </CardTitle>
                    <CardDescription className="line-clamp-2">{batch.description || 'No description added.'}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={batch.accessLevel === 'paid' ? 'destructive' : 'default'}>
                        {batch.accessLevel === 'paid' ? 'Paid' : 'Free'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {examNameById[batch.examTypeId || ''] || 'Exam'} - {classNameById[batch.classId || ''] || 'Curriculum'}
                    </p>
                    {formatBatchStartDate(batch.batchStartDate) ? (
                      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Starts on {formatBatchStartDate(batch.batchStartDate)}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Subjects:{' '}
                      {(batch.subjectIds || [])
                        .map((id) => subjectNameById[id])
                        .filter(Boolean)
                        .join(', ') || 'N/A'}
                    </p>
                    <Button asChild variant="outline" size="sm" className="rounded-full">
                      <Link href={`/live-batches/${batch.id}`}>
                        <View className="mr-2 h-4 w-4" />
                        View Classroom
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
