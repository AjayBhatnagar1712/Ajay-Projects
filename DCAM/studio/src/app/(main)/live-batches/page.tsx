'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { BookOpenCheck, CalendarClock, CalendarDays, GraduationCap, ListChecks, PencilLine, Sparkles, Trash2, View } from 'lucide-react';
import { resolveLiveBatchSessions } from '@/lib/live-batch-session-access';
import { sumSubjectSessionCounts } from '@/lib/live-batch-subject-sessions';

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string; examTypeId: string };
type Subject = { id: string; name: string; classId: string };
type SubscriptionPlan = {
  id: string;
  linkedContentType?: 'course' | 'mock_test' | 'live_batch';
  linkedContentId?: string;
  createdByTeacherId?: string;
  price?: number;
  billingInterval?: 'monthly' | 'yearly';
};
type LiveBatch = {
  id: string;
  title: string;
  description?: string;
  examTypeId: string;
  classId: string;
  batchStartDate?: string;
  subjectIds: string[];
  accessLevel: 'free' | 'paid';
  publicationStatus?: 'draft' | 'published' | 'deleted';
  subscriptionAttached?: boolean;
  teacherId: string;
  thumbnailUrl?: string;
  createdAt?: { toDate?: () => Date } | string;
  totalSessions?: number;
  subjectSchedules?: Array<{
    subjectId?: string | null;
    sessionCount?: unknown;
  }>;
};

type LiveBatchSession = {
  id: string;
  batchId?: string;
  teacherId?: string;
  type?: 'meeting' | 'previous_session' | 'holiday' | 'cancelled';
  date?: string;
  meetingTime?: string;
  meetingEndTime?: string;
};

export default function LiveBatchesPage() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [liveBatchSessions, setLiveBatchSessions] = useState<LiveBatchSession[]>([]);
  const [isLoadingLiveBatchSessions, setIsLoadingLiveBatchSessions] = useState(true);

  const examTypesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null), [firestore]);
  const classesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null), [firestore]);
  const subjectsQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null), [firestore]);
  const teacherBatchesQ = useMemoFirebase(
    () => (firestore && user?.uid ? query(collection(firestore, 'live_batches'), where('teacherId', '==', user.uid)) : null),
    [firestore, user?.uid]
  );
  const subscriptionPlansQ = useMemoFirebase(
    () =>
      firestore && user?.uid
        ? query(
            collection(firestore, 'subscription_plans'),
            where('createdByTeacherId', '==', user.uid),
            where('linkedContentType', '==', 'live_batch')
          )
        : null,
    [firestore, user?.uid]
  );
  const { data: examTypes, isLoading: examLoading } = useCollection<ExamType>(examTypesQ);
  const { data: classes, isLoading: classLoading } = useCollection<ClassItem>(classesQ);
  const { data: subjects, isLoading: subjectLoading } = useCollection<Subject>(subjectsQ);
  const { data: batches, isLoading: batchesLoading } = useCollection<LiveBatch>(teacherBatchesQ);
  const { data: subscriptionPlans, isLoading: plansLoading } = useCollection<SubscriptionPlan>(subscriptionPlansQ);

  const examNameById = useMemo(() => Object.fromEntries((examTypes || []).map((e) => [e.id, e.name])), [examTypes]);
  const classNameById = useMemo(() => Object.fromEntries((classes || []).map((c) => [c.id, c.name])), [classes]);
  const subjectNameById = useMemo(() => Object.fromEntries((subjects || []).map((s) => [s.id, s.name])), [subjects]);
  const loading = isTeacherLoading || examLoading || classLoading || subjectLoading || batchesLoading || plansLoading || isLoadingLiveBatchSessions;
  const view = searchParams.get('view') || 'your';

  const sortedBatches = useMemo(() => {
    const parse = (value: LiveBatch['createdAt']) => {
      if (!value) return 0;
      if (typeof value === 'string') {
        const parsed = new Date(value).getTime();
        return Number.isNaN(parsed) ? 0 : parsed;
      }
      if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
        return value.toDate().getTime();
      }
      return 0;
    };
    return [...(batches || [])].sort((a, b) => parse(b.createdAt) - parse(a.createdAt));
  }, [batches]);

  useEffect(() => {
    let cancelled = false;

    const loadLiveBatchSessions = async () => {
      if (!firestore || !user?.uid) {
        if (!cancelled) {
          setLiveBatchSessions([]);
          setIsLoadingLiveBatchSessions(false);
        }
        return;
      }

      if (batchesLoading) {
        if (!cancelled) {
          setIsLoadingLiveBatchSessions(true);
        }
        return;
      }

      const batchIds = Array.from(
        new Set((batches || []).map((batch) => String(batch.id || '').trim()).filter(Boolean))
      );

      if (batchIds.length === 0) {
        if (!cancelled) {
          setLiveBatchSessions([]);
          setIsLoadingLiveBatchSessions(false);
        }
        return;
      }

      if (!cancelled) {
        setIsLoadingLiveBatchSessions(true);
      }

      try {
        const loadedSessions = new Map<string, LiveBatchSession>();

        for (let startIndex = 0; startIndex < batchIds.length; startIndex += 10) {
          const batchIdChunk = batchIds.slice(startIndex, startIndex + 10);
          const snapshot = await getDocs(
            query(collection(firestore, 'live_batch_sessions'), where('batchId', 'in', batchIdChunk))
          );

          snapshot.forEach((sessionDoc) => {
            loadedSessions.set(sessionDoc.id, {
              id: sessionDoc.id,
              ...(sessionDoc.data() as Omit<LiveBatchSession, 'id'>),
            });
          });
        }

        if (!cancelled) {
          setLiveBatchSessions(Array.from(loadedSessions.values()));
        }
      } catch {
        if (!cancelled) {
          setLiveBatchSessions([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLiveBatchSessions(false);
        }
      }
    };

    void loadLiveBatchSessions();

    return () => {
      cancelled = true;
    };
  }, [batches, batchesLoading, firestore, user?.uid]);

  const formatCreatedAt = (value: LiveBatch['createdAt']) => {
    if (!value) return '';
    if (typeof value === 'string') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
    }
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
      return value.toDate().toLocaleDateString();
    }
    return '';
  };

  const formatBatchStartDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
  };

  const planByLiveBatchId = useMemo(() => {
    const map = new Map<string, SubscriptionPlan>();
    (subscriptionPlans || []).forEach((plan) => {
      if (plan.linkedContentId) map.set(plan.linkedContentId, plan);
    });
    return map;
  }, [subscriptionPlans]);
  const sessionsByBatchId = useMemo(() => {
    const map = new Map<string, LiveBatchSession[]>();
    (liveBatchSessions || []).forEach((session) => {
      const batchId = String(session.batchId || '').trim();
      if (!batchId) return;
      const existingSessions = map.get(batchId);
      if (existingSessions) {
        existingSessions.push(session);
        return;
      }
      map.set(batchId, [session]);
    });
    return map;
  }, [liveBatchSessions]);
  const batchSessionSummaryByBatchId = useMemo(() => {
    const map = new Map<string, { plannedSessions: number; conductedSessions: number; remainingSessions: number | null }>();

    (batches || []).forEach((batch) => {
      const plannedSessions = Math.max(
        0,
        sumSubjectSessionCounts({
          subjectIds: batch.subjectIds || [],
          subjectSchedules: batch.subjectSchedules || [],
          fallbackTotalSessions: batch.totalSessions,
        })
      );
      const conductedSessions = resolveLiveBatchSessions({
        sessions: sessionsByBatchId.get(batch.id) || [],
        batch,
      }).conductedMeetings.length;
      const remainingSessions = plannedSessions > 0 ? Math.max(0, plannedSessions - conductedSessions) : null;

      map.set(batch.id, {
        plannedSessions,
        conductedSessions,
        remainingSessions,
      });
    });

    return map;
  }, [batches, sessionsByBatchId]);

  useEffect(() => {
    setSelectedBatchIds([]);
  }, [view]);

  useEffect(() => {
    if (loading) return;
    if (!isTeacher) {
      router.replace('/my-batch');
    }
  }, [isTeacher, loading, router]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Live Batches" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (!isTeacher) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Live Batches" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card>
            <CardContent className="p-6 text-muted-foreground">This page is available only for teacher accounts.</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const visibleBatches = sortedBatches.filter((batch) => {
    if (batch.publicationStatus === 'deleted') return false;
    if (view === 'waiting-subscription') return batch.accessLevel === 'paid' && batch.subscriptionAttached !== true;
    if (view === 'your') return batch.publicationStatus !== 'draft' && (batch.accessLevel !== 'paid' || batch.subscriptionAttached === true);
    return true;
  });

  const listTitle = view === 'waiting-subscription' ? 'Waiting for Subscription' : 'Your Live Batches';
  const publishedCount = sortedBatches.filter((batch) => batch.publicationStatus !== 'draft' && batch.publicationStatus !== 'deleted' && (batch.accessLevel !== 'paid' || batch.subscriptionAttached === true)).length;
  const waitingCount = sortedBatches.filter((batch) => batch.publicationStatus !== 'deleted' && batch.accessLevel === 'paid' && batch.subscriptionAttached !== true).length;
  const selectedSet = new Set(selectedBatchIds);
  const areAllVisibleSelected = visibleBatches.length > 0 && visibleBatches.every((batch) => selectedSet.has(batch.id));

  const toggleBatchSelection = (batchId: string, checked: boolean) => {
    setSelectedBatchIds((current) => {
      if (checked) return current.includes(batchId) ? current : [...current, batchId];
      return current.filter((id) => id !== batchId);
    });
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedBatchIds([]);
      return;
    }
    setSelectedBatchIds(visibleBatches.map((batch) => batch.id));
  };

  const handleDeleteByIds = async (batchIds: string[]) => {
    if (batchIds.length === 0 || !firestore) return;
    const label = batchIds.length === 1 ? 'this live batch' : `${batchIds.length} live batches`;
    const confirmed = window.confirm(`Delete ${label} permanently? This action cannot be undone.`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const idsSet = new Set(batchIds);
      const planIdsToArchive = (subscriptionPlans || [])
        .filter((plan) => plan.linkedContentId && idsSet.has(plan.linkedContentId))
        .map((plan) => plan.id);

      let archivedBatches = 0;
      let failedBatches = 0;

      for (const id of batchIds) {
        try {
          await updateDoc(doc(firestore, 'live_batches', id), {
            publicationStatus: 'deleted',
            deletedAt: new Date().toISOString(),
            deletedBy: user?.uid || null,
          });
          archivedBatches += 1;
        } catch {
          failedBatches += 1;
        }
      }

      for (const planId of planIdsToArchive) {
        try {
          await updateDoc(doc(firestore, 'subscription_plans', planId), {
            linkedContentId: null,
            linkedContentType: null,
            status: 'archived',
            archivedAt: new Date().toISOString(),
          });
        } catch {
          // plan archive best-effort
        }
      }

      setSelectedBatchIds([]);
      if (archivedBatches > 0) {
        toast({
          title: 'Live batches removed',
          description:
            failedBatches > 0
              ? `${archivedBatches} batch(es) archived. ${failedBatches} failed due to permissions.`
              : `${archivedBatches} batch(es) archived successfully.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Delete failed',
          description: 'No selected live batch could be removed due to permission restrictions.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error?.message || 'Could not delete selected live batches.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSelected = async () => handleDeleteByIds(selectedBatchIds);

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Live Batches" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
        <Card className="overflow-hidden border-border/70 bg-gradient-to-r from-slate-900/80 via-blue-950/60 to-slate-900/80">
          <CardContent className="p-6 md:p-7">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-blue-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Live Learning Hub
                </p>
                <h2 className="text-2xl font-semibold md:text-3xl">Manage Live Batches</h2>
                <p className="text-sm text-muted-foreground md:text-base">View and manage all your live batches with clear status.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:min-w-[300px]">
                <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
                  <p className="text-xs text-blue-200">Published</p>
                  <p className="text-xl font-semibold">{publishedCount}</p>
                </div>
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
                  <p className="text-xs text-amber-200">Waiting Subscription</p>
                  <p className="text-xl font-semibold">{waitingCount}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={view === 'your' ? 'default' : 'ghost'}
                  className="rounded-full"
                  onClick={() => router.push('/live-batches?view=your')}
                >
                  Your Live Batches
                </Button>
                <Button
                  type="button"
                  variant={view === 'waiting-subscription' ? 'default' : 'ghost'}
                  className="rounded-full"
                  onClick={() => router.push('/live-batches?view=waiting-subscription')}
                >
                  Waiting for Subscription
                </Button>
              </div>
              <Button type="button" variant="default" className="rounded-full" onClick={() => router.push('/live-batches/create')}>
                Create Live Batch
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90 backdrop-blur-sm">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{listTitle}</CardTitle>
                <CardDescription>
                  {view === 'waiting-subscription' ? 'Paid live batches without attached subscription plan.' : 'Published batches that are live for students.'}
                </CardDescription>
              </div>
              {view === 'your' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={areAllVisibleSelected} onCheckedChange={(v) => toggleSelectAllVisible(!!v)} />
                    Select All
                  </label>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="rounded-full px-4 shadow-lg shadow-red-950/40"
                    disabled={selectedBatchIds.length === 0 || isDeleting}
                    onClick={handleDeleteSelected}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {isDeleting ? 'Deleting...' : `Delete Selected (${selectedBatchIds.length})`}
                  </Button>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleBatches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-10 text-center">
                <p className="text-base font-medium">No live batches found</p>
                <p className="mt-1 text-sm text-muted-foreground">Create a new live batch to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleBatches.map((batch) => {
                  const linkedPlan = planByLiveBatchId.get(batch.id);
                  const startDateLabel = formatBatchStartDate(batch.batchStartDate);
                  const subjectNames = (batch.subjectIds || []).map((id) => subjectNameById[id]).filter(Boolean);
                  const batchSessionSummary = batchSessionSummaryByBatchId.get(batch.id);
                  const totalSessionsInBatch = batchSessionSummary?.plannedSessions ?? Math.max(0, Number(batch.totalSessions ?? 0));
                  const conductedSessions = batchSessionSummary?.conductedSessions ?? 0;
                  const sessionsLeft = batchSessionSummary?.remainingSessions ?? (totalSessionsInBatch > 0 ? Math.max(0, totalSessionsInBatch - conductedSessions) : null);
                  return (
                    <Card
                      key={batch.id}
                      className="group relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-slate-950/95 transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/40 hover:shadow-[0_24px_50px_-24px_rgba(37,99,235,0.75)]"
                    >
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-blue-500/8 to-transparent" />
                      <div className="relative h-48 w-full bg-muted/50">
                        {view === 'your' ? (
                          <div className="absolute right-3 top-3 z-20 rounded-xl border border-white/20 bg-slate-950/70 p-1.5 shadow-lg backdrop-blur-sm">
                            <Checkbox
                              checked={selectedSet.has(batch.id)}
                              onCheckedChange={(v) => toggleBatchSelection(batch.id, !!v)}
                            />
                          </div>
                        ) : null}
                        {batch.thumbnailUrl ? (
                          <img src={batch.thumbnailUrl} alt={batch.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        ) : (
                          <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.16),transparent_42%),radial-gradient(circle_at_80%_10%,rgba(56,189,248,0.16),transparent_36%)] flex items-center justify-center text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                            No Thumbnail
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                        <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
                          <Badge
                            variant={batch.accessLevel === 'paid' ? 'destructive' : 'secondary'}
                            className={
                              batch.accessLevel === 'paid'
                                ? 'shrink-0 rounded-full border border-red-300/30 bg-red-500/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide'
                                : 'shrink-0 rounded-full border border-emerald-300/50 bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100'
                            }
                          >
                            {batch.accessLevel === 'paid' ? 'Paid Batch' : 'Free Access'}
                          </Badge>
                          <div className="flex flex-col items-end gap-1.5">
                            {batch.accessLevel === 'paid' && linkedPlan?.price !== undefined ? (
                              <Badge variant="secondary" className="rounded-full border border-blue-200/25 bg-slate-950/80 px-2.5 py-1 text-[11px]">
                                INR {Number(linkedPlan.price).toLocaleString()}
                                {linkedPlan.billingInterval ? ` / ${linkedPlan.billingInterval}` : ''}
                              </Badge>
                            ) : null}
                            {sessionsLeft !== null ? (
                              <Badge variant="secondary" className="rounded-full border border-emerald-300/35 bg-emerald-500/20 px-2.5 py-1 text-[11px] text-emerald-100">
                                {sessionsLeft} session{sessionsLeft === 1 ? '' : 's'} left
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <CardContent className="space-y-3 pt-4">
                        <div className="space-y-2">
                          <p className="text-xl font-semibold leading-tight line-clamp-2 text-white/95">{batch.title}</p>
                          {batch.description ? <p className="text-sm text-muted-foreground line-clamp-2">{batch.description}</p> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="rounded-full border border-blue-300/20 bg-blue-500/10 px-2.5 py-0.5 text-[11px]">
                            {subjectNames.length} Subject{subjectNames.length === 1 ? '' : 's'}
                          </Badge>
                          {startDateLabel ? (
                            <Badge variant="secondary" className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-0.5 text-[11px]">
                              Starts {startDateLabel}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="space-y-1.5 rounded-xl border border-white/10 bg-slate-900/70 p-3">
                          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <GraduationCap className="h-3.5 w-3.5" />
                            {examNameById[batch.examTypeId] || 'Exam'} - {classNameById[batch.classId] || 'Curriculum'}
                          </p>
                          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <BookOpenCheck className="h-3.5 w-3.5" />
                            {subjectNames.join(', ') || 'N/A'}
                          </p>
                          {formatCreatedAt(batch.createdAt) ? (
                            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CalendarDays className="h-3.5 w-3.5" />
                              Created on {formatCreatedAt(batch.createdAt)}
                            </p>
                          ) : null}
                          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <ListChecks className="h-3.5 w-3.5" />
                            Sessions left: {sessionsLeft !== null ? `${sessionsLeft} of ${totalSessionsInBatch}` : 'Not set'}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-10 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-950/60 transition-all hover:bg-blue-500"
                            onClick={() => router.push(`/live-batches/${batch.id}`)}
                          >
                            <View className="mr-1.5 h-3.5 w-3.5" />
                            View Classroom
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-10 rounded-xl border-slate-600 bg-slate-900/70 hover:border-blue-400/50 hover:bg-blue-500/10"
                            onClick={() => router.push(`/live-batches/edit/${batch.id}`)}
                          >
                            <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                            Edit Batch
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-10 rounded-xl border-slate-600 bg-slate-900/70 hover:border-blue-400/50 hover:bg-blue-500/10 sm:col-span-2"
                            onClick={() => router.push(`/live-batches/schedule/${batch.id}`)}
                          >
                            <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                            Schedule Content
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
      </main>
    </div>
  );
}
