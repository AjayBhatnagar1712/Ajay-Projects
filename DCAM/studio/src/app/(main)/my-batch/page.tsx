'use client';

import Link from 'next/link';
import DashboardHeader from '@/components/dashboard-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, orderBy, query, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCheck,
  Compass,
  GraduationCap,
  Layers3,
  LoaderCircle,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type EnrolledLiveBatch = {
  id: string;
  batchId?: string;
  title?: string;
  teacherId?: string;
  teacherName?: string;
  accessLevel?: 'free' | 'paid';
  enrolledAt?: string;
  hiddenFromMyBatch?: boolean;
  hiddenFromMyBatchAt?: string | null;
};

type PurchasedLiveBatch = {
  id: string;
  batchId?: string;
  liveBatchId?: string;
  teacherId?: string;
  teacherName?: string;
  accessLevel?: 'free' | 'paid';
  purchasedAt?: string;
  sessionsPurchased?: number;
};

type LiveBatch = {
  id: string;
  title?: string;
  description?: string;
  examTypeId?: string;
  classId?: string;
  batchStartDate?: string;
  subjectIds?: string[];
  accessLevel?: 'free' | 'paid';
  subscriptionAttached?: boolean;
  publicationStatus?: 'draft' | 'published' | 'deleted';
  teacherId?: string;
  teacherName?: string;
};

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string };
type Subject = { id: string; name: string };

type MyLiveBatchCard = {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  accessLevel: 'free' | 'paid';
  examTypeId: string;
  classId: string;
  batchStartDate: string;
  subjectIds: string[];
  enrolledAt: string;
};

export default function MyBatchPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRemovingSelected, setIsRemovingSelected] = useState(false);

  const enrolledLiveBatchesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'users', user.uid, 'enrolled_live_batches'), orderBy('enrolledAt', 'desc'));
  }, [firestore, user?.uid]);
  const purchasedLiveBatchesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'users', user.uid, 'purchased_live_batches'), orderBy('purchasedAt', 'desc'));
  }, [firestore, user?.uid]);
  const liveBatchesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'live_batches')) : null), [firestore]);
  const examTypesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types')) : null), [firestore]);
  const classesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes')) : null), [firestore]);
  const subjectsQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects')) : null), [firestore]);

  const { data: enrolledLiveBatches = [], isLoading: areEnrolledLiveBatchesLoading } = useCollection<EnrolledLiveBatch>(enrolledLiveBatchesQuery);
  const { data: purchasedLiveBatches = [], isLoading: arePurchasedLiveBatchesLoading } = useCollection<PurchasedLiveBatch>(purchasedLiveBatchesQuery);
  const { data: allLiveBatches = [], isLoading: areLiveBatchesLoading } = useCollection<LiveBatch>(liveBatchesQuery);
  const { data: examTypes = [], isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classes = [], isLoading: areClassesLoading } = useCollection<ClassItem>(classesQuery);
  const { data: subjects = [], isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);

  const examNameById = useMemo(() => Object.fromEntries((examTypes || []).map((exam) => [exam.id, exam.name])), [examTypes]);
  const classNameById = useMemo(() => Object.fromEntries((classes || []).map((item) => [item.id, item.name])), [classes]);
  const subjectNameById = useMemo(() => Object.fromEntries((subjects || []).map((item) => [item.id, item.name])), [subjects]);
  const liveBatchById = useMemo(() => Object.fromEntries((allLiveBatches || []).map((batch) => [batch.id, batch])), [allLiveBatches]);

  const studentBatchAccessRecords = useMemo(() => {
    const enrolledByBatchId = new Map<string, EnrolledLiveBatch>();
    (enrolledLiveBatches || []).forEach((record) => {
      const resolvedBatchId = String(record.batchId || record.id || '').trim();
      if (!resolvedBatchId) return;
      enrolledByBatchId.set(resolvedBatchId, record);
    });

    const purchasedByBatchId = new Map<string, PurchasedLiveBatch>();
    (purchasedLiveBatches || []).forEach((record) => {
      const resolvedBatchId = String(record.batchId || record.liveBatchId || record.id || '').trim();
      if (!resolvedBatchId) return;
      purchasedByBatchId.set(resolvedBatchId, record);
    });

    return Array.from(new Set([...enrolledByBatchId.keys(), ...purchasedByBatchId.keys()]))
      .map((batchId) => {
        const enrolledRecord = enrolledByBatchId.get(batchId) || null;
        const purchasedRecord = purchasedByBatchId.get(batchId) || null;
        const sortDate = String(enrolledRecord?.enrolledAt || purchasedRecord?.purchasedAt || '').trim();

        return {
          batchId,
          enrolledRecord,
          purchasedRecord,
          sortDate,
        };
      })
      .sort((left, right) => right.sortDate.localeCompare(left.sortDate));
  }, [enrolledLiveBatches, purchasedLiveBatches]);

  const myLiveBatches = useMemo(() => {
    return studentBatchAccessRecords
      .map(({ batchId, enrolledRecord, purchasedRecord }) => {
        if (enrolledRecord?.hiddenFromMyBatch === true) return null;
        const resolvedBatchId = batchId;
        if (!resolvedBatchId) return null;
        const batch = liveBatchById[resolvedBatchId];
        if (!batch || batch.publicationStatus !== 'published') return null;
        return {
          id: resolvedBatchId,
          title: batch.title || enrolledRecord?.title || 'Live Batch',
          description: batch.description || '',
          teacherId: batch.teacherId || enrolledRecord?.teacherId || purchasedRecord?.teacherId || '',
          teacherName: batch.teacherName || enrolledRecord?.teacherName || purchasedRecord?.teacherName || 'N/A',
          accessLevel: batch.accessLevel || enrolledRecord?.accessLevel || purchasedRecord?.accessLevel || 'paid',
          examTypeId: batch.examTypeId || '',
          classId: batch.classId || '',
          batchStartDate: batch.batchStartDate || '',
          subjectIds: batch.subjectIds || [],
          enrolledAt: enrolledRecord?.enrolledAt || purchasedRecord?.purchasedAt || '',
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.enrolledAt || '').localeCompare(a?.enrolledAt || '')) as MyLiveBatchCard[];
  }, [liveBatchById, studentBatchAccessRecords]);

  const loading =
    areEnrolledLiveBatchesLoading
    || arePurchasedLiveBatchesLoading
    || areLiveBatchesLoading
    || areExamTypesLoading
    || areClassesLoading
    || areSubjectsLoading;

  const formatBatchStartDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
  };

  const formatEnrolledDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
  };

  useEffect(() => {
    setSelectedBatchIds((current) => {
      const visibleIds = new Set(myLiveBatches.map((batch) => batch.id));
      return current.filter((batchId) => visibleIds.has(batchId));
    });
  }, [myLiveBatches]);

  const totalBatchCount = myLiveBatches.length;
  const paidBatchCount = myLiveBatches.filter((batch) => batch.accessLevel === 'paid').length;
  const freeBatchCount = totalBatchCount - paidBatchCount;
  const upcomingBatchCount = myLiveBatches.filter((batch) => {
    if (!batch.batchStartDate) return false;
    const start = new Date(batch.batchStartDate);
    if (Number.isNaN(start.getTime())) return false;
    return start.getTime() >= new Date().setHours(0, 0, 0, 0);
  }).length;
  const selectedBatches = myLiveBatches.filter((batch) => selectedBatchIds.includes(batch.id));
  const areAllVisibleBatchesSelected = totalBatchCount > 0 && selectedBatchIds.length === totalBatchCount;

  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedBatchIds([]);
      return;
    }
    setSelectionMode(true);
  };

  const toggleBatchSelection = (batchId: string) => {
    setSelectedBatchIds((current) =>
      current.includes(batchId) ? current.filter((id) => id !== batchId) : [...current, batchId]
    );
  };

  const handleSelectAllToggle = () => {
    if (areAllVisibleBatchesSelected) {
      setSelectedBatchIds([]);
      return;
    }
    setSelectedBatchIds(myLiveBatches.map((batch) => batch.id));
  };

  const handleRemoveSelected = async () => {
    if (!firestore || !user?.uid || selectedBatchIds.length === 0 || isRemovingSelected) return;

    setIsRemovingSelected(true);
    try {
      const hiddenAt = new Date().toISOString();
      await Promise.all(
        selectedBatchIds.map((batchId) => {
          const selectedBatch = selectedBatches.find((batch) => batch.id === batchId);
          return setDoc(
            doc(firestore, 'users', user.uid, 'enrolled_live_batches', batchId),
            {
              id: batchId,
              batchId,
              title: selectedBatch?.title || 'Live Batch',
              teacherId: selectedBatch?.teacherId || '',
              teacherName: selectedBatch?.teacherName || '',
              accessLevel: selectedBatch?.accessLevel || 'free',
              enrolledAt: selectedBatch?.enrolledAt || hiddenAt,
              hiddenFromMyBatch: true,
              hiddenFromMyBatchAt: hiddenAt,
            },
            { merge: true }
          );
        })
      );
      toast({
        title: selectedBatchIds.length === 1 ? 'Batch removed from My Batch' : 'Selected batches removed',
        description:
          selectedBatchIds.length === 1
            ? `"${selectedBatches[0]?.title || 'Batch'}" is now hidden from this list.`
            : `${selectedBatchIds.length} batches are now hidden from this list.`,
      });
      setSelectedBatchIds([]);
      setSelectionMode(false);
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not update My Batch',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setIsRemovingSelected(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="My Batch" />
      <main className="flex-1 overflow-y-auto p-4 md:p-5 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.45fr_0.95fr]">
            <Card className="overflow-hidden rounded-[28px] border-white/10 bg-[linear-gradient(135deg,rgba(8,47,73,0.96),rgba(15,23,42,0.98)_45%,rgba(49,46,129,0.94))] shadow-[0_30px_80px_-50px_rgba(56,189,248,0.45)]">
              <CardContent className="p-5 md:p-6 lg:p-7">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-4">
                      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100">
                        <Sparkles className="h-3.5 w-3.5" />
                        Student Workspace
                      </div>
                      <div className="space-y-2.5">
                        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-white md:text-3xl">
                          Your live learning hub, organized for quick action.
                        </h2>
                        <p className="max-w-2xl text-sm leading-6 text-slate-300">
                          Review active batches, jump into the right classroom faster, and keep this page focused by selecting the batches you want to hide.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          asChild
                          size="lg"
                          className="group h-10 rounded-full border border-cyan-200/20 bg-[linear-gradient(135deg,rgba(103,232,249,1),rgba(59,130,246,0.95))] px-5 text-sm font-semibold text-slate-950 shadow-[0_16px_34px_-24px_rgba(56,189,248,0.9)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_40px_-24px_rgba(56,189,248,1)]"
                        >
                          <Link href="/my-batch/explore">
                            Explore Batches
                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={toggleSelectionMode}
                          className="h-10 rounded-full border-white/15 bg-white/5 px-5 text-sm font-semibold text-slate-100 hover:bg-white/10 hover:text-white"
                        >
                          {selectionMode ? 'Exit Selection' : 'Select Batches'}
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:w-[280px]">
                      <div className="rounded-[20px] border border-cyan-300/15 bg-white/[0.06] p-3.5">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Live Batches</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{totalBatchCount}</p>
                      </div>
                      <div className="rounded-[20px] border border-rose-300/15 bg-white/[0.06] p-3.5">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Paid Access</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{paidBatchCount}</p>
                      </div>
                      <div className="rounded-[20px] border border-emerald-300/15 bg-white/[0.06] p-3.5">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Free Access</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{freeBatchCount}</p>
                      </div>
                      <div className="rounded-[20px] border border-indigo-300/15 bg-white/[0.06] p-3.5">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Upcoming</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{upcomingBatchCount}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.92))] shadow-[0_24px_72px_-46px_rgba(59,130,246,0.35)]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-xl text-white">
                  <Compass className="h-4.5 w-4.5 text-cyan-300" />
                  Organize My Batch
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Select one or more batches first, then remove them from this view in one step.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5">
                <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3.5">
                  <p className="text-sm font-semibold text-white">Current status</p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-400">
                    {selectionMode
                      ? selectedBatchIds.length > 0
                        ? `${selectedBatchIds.length} batch${selectedBatchIds.length === 1 ? '' : 'es'} selected. Remove them when you are ready.`
                        : 'Selection mode is on. Tap the cards you want to remove from this page.'
                      : 'Open any batch normally, or switch to selection mode to manage this list.'}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={toggleSelectionMode}
                    className="h-10 rounded-2xl border-white/15 bg-white/5 text-sm font-semibold text-slate-100 hover:bg-white/10 hover:text-white"
                  >
                    {selectionMode ? (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Cancel Selection
                      </>
                    ) : (
                      <>
                        <CheckCheck className="mr-2 h-4 w-4" />
                        Start Selection
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSelectAllToggle}
                    disabled={!selectionMode || totalBatchCount === 0}
                    className="h-10 rounded-2xl border-white/15 bg-white/5 text-sm font-semibold text-slate-100 hover:bg-white/10 hover:text-white"
                  >
                    {areAllVisibleBatchesSelected ? 'Clear All' : 'Select All'}
                  </Button>
                </div>

                <div className="rounded-[20px] border border-rose-400/20 bg-rose-500/10 p-3.5">
                  <p className="text-sm font-semibold text-white">Remove selected batches</p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-300">
                    This keeps My Batch tidy. The action only hides selected batches here and does not delete access history.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={selectedBatchIds.length === 0 || isRemovingSelected}
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="mt-3 h-10 w-full rounded-2xl border-rose-300/20 bg-rose-500/10 text-sm font-semibold text-rose-100 hover:border-rose-300/35 hover:bg-rose-500/15 hover:text-white"
                  >
                    {isRemovingSelected ? (
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Remove Selected
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.9))] shadow-[0_28px_78px_-54px_rgba(59,130,246,0.35)]">
            <CardHeader className="gap-3 border-b border-white/8 pb-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-xl text-white">My Live Batches</CardTitle>
                  <CardDescription className="text-slate-400">
                    Every batch card shows the key details needed to decide what to open or hide.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                    {totalBatchCount} total
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-slate-300">
                    {selectedBatchIds.length} selected
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              {selectionMode ? (
                <div className="mb-4 flex flex-col gap-3 rounded-[20px] border border-cyan-300/15 bg-cyan-300/10 p-3.5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-cyan-50">Selection mode active</p>
                    <p className="mt-1 text-sm text-cyan-100/80">
                      Tap any card or checkbox to choose batches, then use the remove action in the panel above.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSelectAllToggle}
                      className="h-9 rounded-full border-cyan-200/20 bg-white/5 px-4 text-sm text-cyan-50 hover:bg-white/10"
                    >
                      {areAllVisibleBatchesSelected ? 'Clear All' : 'Select All'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={toggleSelectionMode}
                      className="h-9 rounded-full border-white/15 bg-white/5 px-4 text-sm text-slate-100 hover:bg-white/10"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : null}

              {loading ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  <Skeleton className="h-[290px] w-full rounded-[24px]" />
                  <Skeleton className="h-[290px] w-full rounded-[24px]" />
                  <Skeleton className="h-[290px] w-full rounded-[24px]" />
                </div>
              ) : myLiveBatches.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
                  <Layers3 className="mx-auto h-7 w-7 text-slate-500" />
                  <p className="mt-3 text-base font-semibold text-white">No live batches visible yet.</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Explore available live batches and build your learning dashboard here.
                  </p>
                  <Button
                    asChild
                    className="mt-4 h-10 rounded-full border border-cyan-200/20 bg-[linear-gradient(135deg,rgba(103,232,249,1),rgba(59,130,246,0.95))] px-5 text-sm font-semibold text-slate-950"
                  >
                    <Link href="/my-batch/explore">Explore Batches</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  {myLiveBatches.map((batch) => {
                    const formattedStartDate = formatBatchStartDate(batch.batchStartDate);
                    const formattedEnrolledDate = formatEnrolledDate(batch.enrolledAt);
                    const subjectNames = (batch.subjectIds || []).map((id) => subjectNameById[id]).filter(Boolean);
                    const visibleSubjects = subjectNames.slice(0, 3);
                    const remainingSubjects = Math.max(0, subjectNames.length - visibleSubjects.length);
                    const isSelected = selectedBatchIds.includes(batch.id);

                    return (
                      <Card
                        key={batch.id}
                        onClick={selectionMode ? () => toggleBatchSelection(batch.id) : undefined}
                        className={cn(
                          'group overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.9)_52%,rgba(8,47,73,0.6))] shadow-[0_20px_60px_-48px_rgba(59,130,246,0.4)] transition-all duration-300',
                          selectionMode ? 'cursor-pointer hover:-translate-y-1 hover:border-cyan-300/30' : 'hover:-translate-y-1 hover:border-cyan-300/25',
                          isSelected ? 'border-cyan-300/45 shadow-[0_28px_80px_-44px_rgba(34,211,238,0.6)] ring-1 ring-cyan-300/35' : ''
                        )}
                      >
                        <div
                          className={cn(
                            'relative border-b border-white/8 p-4',
                            batch.accessLevel === 'paid'
                              ? 'bg-[linear-gradient(135deg,rgba(76,5,25,0.85),rgba(91,33,182,0.35),rgba(15,23,42,0.9))]'
                              : 'bg-[linear-gradient(135deg,rgba(8,47,73,0.9),rgba(30,64,175,0.35),rgba(15,23,42,0.9))]'
                          )}
                        >
                          <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_42%)]" />
                          <div className="relative flex items-start justify-between gap-4">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  className={cn(
                                    'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]',
                                    batch.accessLevel === 'paid'
                                      ? 'border-rose-300/25 bg-rose-400/15 text-rose-50 hover:bg-rose-400/15'
                                      : 'border-emerald-300/25 bg-emerald-400/15 text-emerald-50 hover:bg-emerald-400/15'
                                  )}
                                >
                                  {batch.accessLevel === 'paid' ? 'Paid Batch' : 'Free Batch'}
                                </Badge>
                                {formattedEnrolledDate ? (
                                  <span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
                                    Joined {formattedEnrolledDate}
                                  </span>
                                ) : null}
                              </div>
                              <div className="space-y-1.5">
                                <h3 className="line-clamp-2 text-xl font-semibold tracking-tight text-white">
                                  {batch.title}
                                </h3>
                                <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-100">
                                  <CalendarClock className="h-3.5 w-3.5 text-cyan-200" />
                                  {formattedStartDate ? `Starts ${formattedStartDate}` : 'Start date not set'}
                                </p>
                              </div>
                            </div>

                            {selectionMode ? (
                              <div
                                className={cn(
                                  'rounded-xl border border-white/10 bg-slate-950/45 p-2 backdrop-blur-sm transition-colors',
                                  isSelected ? 'border-cyan-300/30 bg-cyan-300/15' : ''
                                )}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleBatchSelection(batch.id)}
                                  aria-label={`Select ${batch.title}`}
                                  className="h-5 w-5 rounded-md border-white/40 data-[state=checked]:border-cyan-300 data-[state=checked]:bg-cyan-300 data-[state=checked]:text-slate-950"
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <CardContent className="space-y-4 p-4">
                          <p className="line-clamp-3 min-h-[64px] text-sm leading-6 text-slate-300">
                            {batch.description || 'Open this batch to see the live schedule, classroom access, and the latest study updates.'}
                          </p>

                          <div className="grid gap-2.5">
                            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-300">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-cyan-300" />
                                <span className="line-clamp-1">Teacher: {batch.teacherName}</span>
                              </div>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-300">
                              <div className="flex items-center gap-2">
                                <GraduationCap className="h-4 w-4 text-blue-300" />
                                <span className="line-clamp-1">
                                  {examNameById[batch.examTypeId] || 'Exam'} - {classNameById[batch.classId] || 'Curriculum'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Subjects</p>
                            <div className="flex flex-wrap gap-2">
                              {visibleSubjects.length > 0 ? (
                                <>
                                  {visibleSubjects.map((subjectName) => (
                                    <Badge
                                      key={`${batch.id}-${subjectName}`}
                                      variant="outline"
                                      className="rounded-full border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-100"
                                    >
                                      {subjectName}
                                    </Badge>
                                  ))}
                                  {remainingSubjects > 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="rounded-full border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300"
                                    >
                                      +{remainingSubjects} more
                                    </Badge>
                                  ) : null}
                                </>
                              ) : (
                                <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300">
                                  Not tagged
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2.5">
                            <Button
                              asChild
                              className="group h-10 rounded-full border border-cyan-200/20 bg-[linear-gradient(135deg,rgba(103,232,249,1),rgba(59,130,246,0.95))] text-sm font-semibold text-slate-950 shadow-[0_16px_34px_-24px_rgba(56,189,248,0.88)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_40px_-24px_rgba(56,189,248,1)]"
                            >
                              <Link href={`/live-batches/${batch.id}`} onClick={(event) => event.stopPropagation()}>
                                Open Classroom
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                              </Link>
                            </Button>
                            {selectionMode ? (
                              <div
                                className={cn(
                                  'rounded-xl border px-3.5 py-2.5 text-sm',
                                  isSelected
                                    ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-50'
                                    : 'border-white/10 bg-white/[0.04] text-slate-300'
                                )}
                              >
                                {isSelected ? 'Selected for removal from My Batch.' : 'Tap this card to select it for removal.'}
                              </div>
                            ) : null}
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
      </main>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="border-white/10 bg-slate-950 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedBatchIds.length === 1 ? 'Remove selected batch?' : 'Remove selected batches?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              {selectedBatchIds.length === 1
                ? `This will hide "${selectedBatches[0]?.title || 'this batch'}" from My Batch. Purchase history and enrollment records will stay intact.`
                : `This will hide ${selectedBatchIds.length} selected batches from My Batch. Purchase history and enrollment records will stay intact.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel disabled={isRemovingSelected} className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveSelected}
              disabled={isRemovingSelected}
              className="bg-rose-500 text-white hover:bg-rose-400"
            >
              {isRemovingSelected ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
