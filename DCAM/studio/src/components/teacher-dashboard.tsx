'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, Crown } from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type CourseDoc = {
  id: string;
  teacherId?: string;
  accessLevel?: 'free' | 'paid';
  publicationStatus?: 'draft' | 'published' | 'deleted';
  subscriptionAttached?: boolean;
};

type LiveBatchDoc = {
  id: string;
  teacherId?: string;
  accessLevel?: 'free' | 'paid';
  publicationStatus?: 'draft' | 'published' | 'deleted';
  subscriptionAttached?: boolean;
};

function InsightMetric({
  title,
  total,
  free,
  paid,
  helper,
}: {
  title: string;
  total: number;
  free: number;
  paid: number;
  helper?: string;
}) {
  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-semibold leading-none">{total}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Free: {free}</Badge>
          <Badge variant="destructive">Paid: {paid}</Badge>
        </div>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}

function PremiumQuestionPurchaseEntry() {
  return (
    <Card className="overflow-hidden border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,47,73,0.16),rgba(15,23,42,0.96)_55%,rgba(2,6,23,0.98))] shadow-[0_24px_70px_-42px_rgba(14,165,233,0.55)]">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-primary/35 bg-primary/10 text-primary">
            <Crown className="mr-1 h-3.5 w-3.5" />
            Premium Questions
          </Badge>
          <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-100">
            Opens on a new page
          </Badge>
        </div>
        <div className="space-y-2">
          <CardTitle className="text-2xl">Purchase paid DCAM question bank questions</CardTitle>
          <CardDescription className="max-w-3xl text-sm md:text-base">
            Open a separate page built for teachers. Choose the scope, review the pricing, enter the question count, and continue to checkout for payment.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/80">Scope</p>
            <p className="mt-2 font-medium text-slate-50">Choose exam and subject</p>
            <p className="mt-1 text-sm text-muted-foreground">Pick exam, curriculum, subject, topic, and subtopic only if needed.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/80">Pricing</p>
            <p className="mt-2 font-medium text-slate-50">Review paid questions</p>
            <p className="mt-1 text-sm text-muted-foreground">See counts, topic coverage, and teacher pricing in one place.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/80">Checkout</p>
            <p className="mt-2 font-medium text-slate-50">Pay and track purchases</p>
            <p className="mt-1 text-sm text-muted-foreground">Proceed to checkout, pay in Razorpay, and review the result in Your Purchases.</p>
          </div>
        </div>

        <Button asChild className="rounded-full font-semibold">
          <Link href="/teacher/premium-questions">
            Open question purchase page
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function TeacherDashboard() {
  const firestore = useFirestore();
  const { user } = useUser();
  const teacherId = user?.uid || '';

  const coursesQ = useMemoFirebase(
    () => (firestore && teacherId ? query(collection(firestore, 'courses'), where('teacherId', '==', teacherId)) : null),
    [firestore, teacherId]
  );
  const liveBatchesQ = useMemoFirebase(
    () => (firestore && teacherId ? query(collection(firestore, 'live_batches'), where('teacherId', '==', teacherId)) : null),
    [firestore, teacherId]
  );

  const { data: courses, isLoading: areCoursesLoading } = useCollection<CourseDoc>(coursesQ);
  const { data: liveBatches, isLoading: areLiveBatchesLoading } = useCollection<LiveBatchDoc>(liveBatchesQ);
  const loading = areCoursesLoading || areLiveBatchesLoading;

  const courseStats = useMemo(() => {
    const source = (courses || []).filter((course) => course.publicationStatus !== 'deleted');
    const free = source.filter((course) => (course.accessLevel || 'free') !== 'paid').length;
    const paid = source.filter((course) => (course.accessLevel || 'free') === 'paid').length;
    const waitingSubscription = source.filter(
      (course) => (course.accessLevel || 'free') === 'paid' && course.subscriptionAttached !== true
    ).length;
    const draft = source.filter((course) => course.publicationStatus === 'draft').length;
    return {
      total: source.length,
      free,
      paid,
      waitingSubscription,
      draft,
    };
  }, [courses]);

  const liveBatchStats = useMemo(() => {
    const source = (liveBatches || []).filter((batch) => batch.publicationStatus !== 'deleted');
    const free = source.filter((batch) => (batch.accessLevel || 'free') !== 'paid').length;
    const paid = source.filter((batch) => (batch.accessLevel || 'free') === 'paid').length;
    const waitingSubscription = source.filter(
      (batch) => (batch.accessLevel || 'free') === 'paid' && batch.subscriptionAttached !== true
    ).length;
    const draft = source.filter((batch) => batch.publicationStatus === 'draft').length;
    return {
      total: source.length,
      free,
      paid,
      waitingSubscription,
      draft,
    };
  }, [liveBatches]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PremiumQuestionPurchaseEntry />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={`teacher-dashboard-skeleton-${index}`} className="h-36 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PremiumQuestionPurchaseEntry />
      <div className="grid gap-4 sm:grid-cols-2">
        <InsightMetric
          title="Courses"
          total={courseStats.total}
          free={courseStats.free}
          paid={courseStats.paid}
          helper={`Draft: ${courseStats.draft} | Waiting subscription: ${courseStats.waitingSubscription}`}
        />
        <InsightMetric
          title="Live Batches"
          total={liveBatchStats.total}
          free={liveBatchStats.free}
          paid={liveBatchStats.paid}
          helper={`Draft: ${liveBatchStats.draft} | Waiting subscription: ${liveBatchStats.waitingSubscription}`}
        />
      </div>
    </div>
  );
}
