'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, orderBy, query } from 'firebase/firestore';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Compass,
  Layers3,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  User,
} from 'lucide-react';

import DashboardHeader from '@/components/dashboard-header';
import LiveBatchThumbnail from '@/components/live-batches/live-batch-thumbnail';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string; examTypeId: string };
type Subject = { id: string; name: string; classId: string };
type LiveBatch = {
  id: string;
  title?: string;
  description?: string;
  examTypeId?: string;
  classId?: string;
  batchStartDate?: string;
  subjectIds?: string[];
  accessLevel?: 'free' | 'paid';
  publicationStatus?: 'draft' | 'published' | 'deleted';
  subscriptionAttached?: boolean;
  teacherName?: string;
  thumbnailUrl?: string;
  createdAt?: string;
};

export default function ExploreMyBatchesPage() {
  const firestore = useFirestore();

  const examTypesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null), [firestore]);
  const classesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null), [firestore]);
  const subjectsQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null), [firestore]);
  const batchesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'live_batches'), orderBy('createdAt', 'desc')) : null), [firestore]);

  const { data: examTypes, isLoading: examLoading } = useCollection<ExamType>(examTypesQ);
  const { data: classes, isLoading: classLoading } = useCollection<ClassItem>(classesQ);
  const { data: subjects, isLoading: subjectLoading } = useCollection<Subject>(subjectsQ);
  const { data: batches, isLoading: batchLoading } = useCollection<LiveBatch>(batchesQ);

  const [examTypeId, setExamTypeId] = useState('');
  const [classId, setClassId] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const loading = examLoading || classLoading || subjectLoading || batchLoading;

  const classNameById = useMemo(() => Object.fromEntries((classes || []).map((item) => [item.id, item.name])), [classes]);
  const examNameById = useMemo(() => Object.fromEntries((examTypes || []).map((item) => [item.id, item.name])), [examTypes]);
  const subjectNameById = useMemo(() => Object.fromEntries((subjects || []).map((item) => [item.id, item.name])), [subjects]);

  const filteredClasses = useMemo(() => (classes || []).filter((item) => item.examTypeId === examTypeId), [classes, examTypeId]);
  const filteredSubjects = useMemo(() => (subjects || []).filter((item) => item.classId === classId), [subjects, classId]);

  useEffect(() => {
    if (classId && !filteredClasses.some((item) => item.id === classId)) {
      setClassId('');
    }
  }, [filteredClasses, classId]);

  useEffect(() => {
    setSelectedSubjectIds((current) => current.filter((id) => filteredSubjects.some((subject) => subject.id === id)));
  }, [filteredSubjects]);

  const toggleSubject = (subjectId: string, checked: boolean) => {
    setSelectedSubjectIds((current) =>
      checked
        ? (current.includes(subjectId) ? current : [...current, subjectId])
        : current.filter((id) => id !== subjectId)
    );
  };

  const matchedBatches = useMemo(() => {
    if (!batches) return [];
    return batches
      .filter((batch) => batch.publicationStatus === 'published')
      .filter((batch) => batch.accessLevel !== 'paid' || batch.subscriptionAttached === true)
      .filter((batch) => !examTypeId || batch.examTypeId === examTypeId)
      .filter((batch) => !classId || batch.classId === classId)
      .filter((batch) => {
        if (selectedSubjectIds.length === 0) return true;
        const batchSubjectSet = new Set(batch.subjectIds || []);
        return selectedSubjectIds.every((id) => batchSubjectSet.has(id));
      });
  }, [batches, classId, examTypeId, selectedSubjectIds]);

  const hasActiveFilters = Boolean(examTypeId || classId || selectedSubjectIds.length > 0);
  const selectedExamLabel = examNameById[examTypeId] || 'Select exam';
  const selectedClassLabel = classNameById[classId] || 'Select curriculum';
  const selectedSubjectLabel = selectedSubjectIds.length > 0 ? `${selectedSubjectIds.length} subject filters` : 'All subjects';
  const activeFilterCount = Number(Boolean(examTypeId)) + Number(Boolean(classId)) + selectedSubjectIds.length;

  const formatBatchStartDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
  };

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Explore Batches" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <Card className="relative isolate overflow-hidden border-primary/35 bg-gradient-to-br from-sky-950/40 via-blue-950/40 to-indigo-950/45 shadow-[0_24px_54px_-34px_rgba(56,189,248,0.66)]">
            <div className="pointer-events-none absolute right-[-95px] top-[-95px] h-56 w-56 rounded-full bg-cyan-400/25 blur-3xl" />
            <CardContent className="relative p-5 md:p-7">
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-3">
                  <p className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Smart Batch Discovery
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Find Live Batches</h2>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Use the same exam, curriculum, and subject-combination logic teachers use while creating live batches.
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      Free + Paid
                    </Badge>
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      Teacher Verified
                    </Badge>
                  </div>
                </div>
                <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/35 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">How It Works</p>
                  <div className="space-y-2.5 text-xs text-slate-200/90">
                    <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
                      <Compass className="mt-0.5 h-4 w-4 text-cyan-300" />
                      Choose exam and curriculum for exact batch alignment.
                    </div>
                    <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
                      <Target className="mt-0.5 h-4 w-4 text-sky-300" />
                      Add subjects to narrow to your specific study scope.
                    </div>
                    <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
                      <TrendingUp className="mt-0.5 h-4 w-4 text-emerald-300" />
                      Join batches with the strongest fit for your goals.
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full border-border/70 bg-background/35 px-3 py-1.5 text-[12px]">
                {selectedExamLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-background/35 px-3 py-1.5 text-[12px]">
                {selectedClassLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full border-border/70 bg-background/35 px-3 py-1.5 text-[12px]">
                {selectedSubjectLabel}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full border border-border/70 bg-background/35 px-5"
                  onClick={() => {
                    setExamTypeId('');
                    setClassId('');
                    setSelectedSubjectIds([]);
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-cyan-300/45 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-5 font-semibold text-slate-950 shadow-[0_16px_34px_-14px_rgba(56,189,248,0.9)] transition-all duration-300 hover:-translate-y-[1px] hover:from-cyan-300 hover:via-sky-300 hover:to-blue-400"
                onClick={() => setShowFilters((current) => !current)}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
                <span className="ml-2 rounded-full border border-slate-950/10 bg-slate-950/10 px-2 py-0.5 text-[11px] text-slate-950/80">
                  {activeFilterCount}
                </span>
              </Button>
            </div>
          </div>

          {showFilters ? (
            <Card className="border-border/80 bg-gradient-to-b from-card/90 via-card/80 to-slate-950/25">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                  Search Filters
                </CardTitle>
                <CardDescription>Set exam, class, and subjects to get matching live batches.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {loading ? (
                  <Skeleton className="h-44 w-full" />
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-border/70 bg-slate-950/30 p-3.5">
                        <p className="text-[11px] uppercase tracking-[0.13em] text-cyan-200">Step 1 - Exam</p>
                        <Select value={examTypeId} onValueChange={setExamTypeId}>
                          <SelectTrigger className="mt-2 h-12 rounded-xl">
                            <SelectValue placeholder="Select exam" />
                          </SelectTrigger>
                          <SelectContent>
                            {(examTypes || []).map((exam) => (
                              <SelectItem key={exam.id} value={exam.id}>
                                {exam.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-slate-950/30 p-3.5">
                        <p className="text-[11px] uppercase tracking-[0.13em] text-sky-200">Step 2 - Curriculum</p>
                        <Select value={classId} onValueChange={setClassId} disabled={!examTypeId}>
                          <SelectTrigger className="mt-2 h-12 rounded-xl">
                            <SelectValue placeholder="Select curriculum/class" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredClasses.map((classItem) => (
                              <SelectItem key={classItem.id} value={classItem.id}>
                                {classItem.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'rounded-xl border p-4',
                        hasActiveFilters ? 'border-cyan-300/35 bg-cyan-500/10' : 'border-border/70 bg-slate-950/20'
                      )}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Current Selection</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-border/70 bg-background/35">{selectedExamLabel}</Badge>
                        <Badge variant="outline" className="border-border/70 bg-background/35">{selectedClassLabel}</Badge>
                        <Badge variant="outline" className="border-border/70 bg-background/35">{selectedSubjectLabel}</Badge>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">Subjects (optional)</p>
                        <Badge variant="outline" className="rounded-full">
                          {selectedSubjectIds.length} selected
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        {filteredSubjects.length === 0 ? (
                          <p className="text-sm text-muted-foreground md:col-span-3">
                            Select exam and curriculum to view subjects.
                          </p>
                        ) : (
                          filteredSubjects.map((subject) => (
                            <label
                              key={subject.id}
                              className="flex items-center gap-2 rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm transition hover:border-primary/40 hover:bg-primary/5"
                            >
                              <Checkbox checked={selectedSubjectIds.includes(subject.id)} onCheckedChange={(value) => toggleSubject(subject.id, !!value)} />
                              <span>{subject.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/70 bg-gradient-to-r from-slate-950/90 via-cyan-950/22 to-blue-950/16">
            <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Result Window</p>
                <p className="mt-1 text-lg font-semibold">{matchedBatches.length} batch{matchedBatches.length === 1 ? '' : 'es'} available</p>
                <p className="text-xs text-muted-foreground">
                  {hasActiveFilters
                    ? 'Use filters to keep recommendations focused and enrollment-ready.'
                    : 'Showing all published live batches. Open filters when you want to narrow the list.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-border/70 bg-background/35">{selectedExamLabel}</Badge>
                <Badge variant="outline" className="border-border/70 bg-background/35">{selectedClassLabel}</Badge>
                <Badge variant="outline" className="border-border/70 bg-background/35">{selectedSubjectLabel}</Badge>
              </div>
            </CardContent>
          </Card>

          {matchedBatches.length === 0 ? (
            <Card className="border-dashed border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-10 text-center">
                <BookOpen className="mx-auto mb-3 h-6 w-6 text-amber-300" />
                <p className="font-medium">{hasActiveFilters ? 'No batches found for selected filters' : 'No published batches available yet'}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasActiveFilters
                    ? 'Try changing exam, class, or selected subjects.'
                    : 'Please check again later after teachers publish batches.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {matchedBatches.map((batch) => (
                <Card key={batch.id} className="group overflow-hidden border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/88 to-blue-950/70 transition-all duration-300 hover:-translate-y-1 hover:border-primary/45 hover:shadow-[0_18px_36px_-20px_rgba(56,189,248,0.5)]">
                  <LiveBatchThumbnail
                    src={batch.thumbnailUrl}
                    alt={batch.title || 'Live Batch'}
                    title={batch.title || 'Untitled Live Batch'}
                    subtitle={`${examNameById[batch.examTypeId || ''] || 'Exam'} / ${classNameById[batch.classId || ''] || 'Curriculum'}`}
                  />
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={batch.accessLevel === 'paid' ? 'bg-rose-500 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-600'}>
                        {batch.accessLevel === 'paid' ? 'Paid Batch' : 'Free Batch'}
                      </Badge>
                      <Badge variant="outline" className="border-cyan-300/35 bg-cyan-500/10 text-cyan-100">
                        Published live batch
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <p className="line-clamp-2 font-semibold">{batch.title || 'Untitled Batch'}</p>
                      {batch.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{batch.description}</p> : null}
                    </div>

                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      {batch.teacherName ? `Teacher: ${batch.teacherName}` : 'Teacher: N/A'}
                    </p>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Layers3 className="h-3.5 w-3.5" />
                      {examNameById[batch.examTypeId || ''] || 'Exam'} - {classNameById[batch.classId || ''] || 'Curriculum'}
                    </p>
                    {formatBatchStartDate(batch.batchStartDate) ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Starts on {formatBatchStartDate(batch.batchStartDate)}
                      </p>
                    ) : null}
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      Subjects: {(batch.subjectIds || []).map((id) => subjectNameById[id]).filter(Boolean).join(', ') || 'N/A'}
                    </p>
                    <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-cyan-300/35 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-100">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Batch matches your current filter scope
                    </div>
                    <Button asChild size="sm" className="w-full rounded-full border border-cyan-300/40 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-400 font-semibold text-slate-950 hover:from-cyan-300 hover:via-sky-300 hover:to-blue-300">
                      <Link href={`/live-batches/${batch.id}`}>
                        Open Batch
                        <ArrowRight className="ml-2 h-4 w-4" />
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
