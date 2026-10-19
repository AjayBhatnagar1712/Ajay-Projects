'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Crown, Sparkles } from 'lucide-react';
import {
  DCAM_PRACTICE_QUESTION_COUNTS,
  DCAM_PRACTICE_SUMMARY_DOC_ID,
  DCAM_QUESTION_BANK_LABEL,
  DCAM_QUESTION_BANK_OWNER_ID,
} from '@/lib/teacher-authoring';

type QuestionCounts = {
  free: number;
  paid: number;
};

type PracticeSummaryDoc = {
  freeQuestionCount?: number;
  paidQuestionCount?: number;
  ownerTeacherId?: string;
};

export default function CustomMockLaunchPage() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const [ownerTeacherId, setOwnerTeacherId] = useState(DCAM_QUESTION_BANK_OWNER_ID);
  const [questionCounts, setQuestionCounts] = useState<QuestionCounts>(DCAM_PRACTICE_QUESTION_COUNTS);

  useEffect(() => {
    if (!firestore) return;

    const unsubscribe = onSnapshot(
      doc(firestore, 'platform_settings', DCAM_PRACTICE_SUMMARY_DOC_ID),
      (summarySnapshot) => {
        if (!summarySnapshot.exists()) return;

        const summary = summarySnapshot.data() as PracticeSummaryDoc;
        const free = Number(summary.freeQuestionCount ?? DCAM_PRACTICE_QUESTION_COUNTS.free);
        const paid = Number(summary.paidQuestionCount ?? DCAM_PRACTICE_QUESTION_COUNTS.paid);
        const nextOwnerTeacherId = String(summary.ownerTeacherId || DCAM_QUESTION_BANK_OWNER_ID).trim();
        setQuestionCounts({
          free: Number.isFinite(free) ? Math.max(0, free) : DCAM_PRACTICE_QUESTION_COUNTS.free,
          paid: Number.isFinite(paid) ? Math.max(0, paid) : DCAM_PRACTICE_QUESTION_COUNTS.paid,
        });
        if (nextOwnerTeacherId) {
          setOwnerTeacherId(nextOwnerTeacherId);
        }
      },
      (error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Could not subscribe to cached custom mock summary.', error);
        }
      }
    );

    return unsubscribe;
  }, [firestore]);

  const freeQuestionCount = questionCounts.free;
  const paidQuestionCount = questionCounts.paid;

  const freeQuestionLabel = `${freeQuestionCount.toLocaleString()} questions`;
  const paidQuestionLabel = `${paidQuestionCount.toLocaleString()} questions`;

  const buildCreateHref = (mode: 'free' | 'premium') => {
    const params = new URLSearchParams({
      mode,
      teacherId: ownerTeacherId,
    });

    [
      'examTypeId',
      'examId',
      'exam',
      'examTypeName',
      'examName',
      'classId',
      'curriculumId',
      'class',
      'curriculum',
      'className',
      'curriculumName',
      'subjectIds',
      'subjectId',
      'subjects',
      'subject',
    ].forEach((key) => {
      const value = (searchParams.get(key) || '').trim();
      if (value) params.set(key, value);
    });

    return `/custom-mock-tests/create?${params.toString()}`;
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Custom Mock Test" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Card className="overflow-hidden border border-cyan-400/25 bg-gradient-to-b from-slate-900/95 via-slate-900/88 to-slate-950/78 shadow-[0_20px_50px_-25px_rgba(14,165,233,0.55)]">
            <CardHeader className="border-b border-border/60 bg-gradient-to-r from-cyan-950/35 via-blue-950/20 to-transparent">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                DCAM Custom Mock Builder
              </p>
              <CardTitle className="font-headline text-2xl md:text-4xl">Build Your Custom Mock</CardTitle>
              <CardDescription className="max-w-3xl text-sm md:text-base">
                Choose your mode, pick your exam and subjects, and create a mock that matches your preparation level.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 md:grid-cols-3">
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Powered By</p>
                <p className="mt-2 text-xl font-semibold">{DCAM_QUESTION_BANK_LABEL}</p>
                <p className="mt-1 text-sm text-muted-foreground">Curated for focused, exam-ready practice.</p>
              </div>
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Free Practice Pool</p>
                <p className="mt-2 text-xl font-semibold">{freeQuestionLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">Great for revision, speed work, and daily mocks.</p>
              </div>
              <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200">Premium Practice Pool</p>
                <p className="mt-2 text-xl font-semibold">{paidQuestionLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">Built for deeper challenge and high-intensity preparation.</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card className="overflow-hidden border border-emerald-300/25 bg-gradient-to-b from-emerald-950/35 via-slate-900/90 to-slate-950/80 shadow-[0_20px_50px_-30px_rgba(16,185,129,0.5)]">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <Badge className="border-emerald-300/35 bg-emerald-500/15 text-emerald-100">Free</Badge>
                  <Badge variant="outline" className="border-emerald-300/35 bg-emerald-500/10 text-emerald-100">
                    {freeQuestionLabel}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">Start a Free Custom Mock</CardTitle>
                <CardDescription>
                  Create a focused mock using free questions from the {DCAM_QUESTION_BANK_LABEL}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/8 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Best for quick revision and regular practice.</p>
                  <p className="mt-1">Choose your exam, curriculum, sections, and difficulty inside the next step.</p>
                </div>
                {freeQuestionCount > 0 ? (
                  <Button asChild className="h-11 w-full rounded-full border border-emerald-300/35 bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 font-semibold text-slate-950 transition-all hover:from-emerald-200 hover:via-teal-200 hover:to-cyan-200">
                    <Link href={buildCreateHref('free')} prefetch={false}>
                      Start Free Mock
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button className="h-11 w-full rounded-full" disabled>
                    Free mock coming soon
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden border border-amber-300/25 bg-gradient-to-b from-amber-950/35 via-slate-900/90 to-slate-950/80 shadow-[0_20px_50px_-30px_rgba(245,158,11,0.45)]">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <Badge className="border-amber-300/35 bg-amber-500/15 text-amber-100">Premium</Badge>
                  <Badge variant="outline" className="border-amber-300/35 bg-amber-500/10 text-amber-100">
                    {paidQuestionLabel}
                  </Badge>
                </div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Crown className="h-5 w-5 text-amber-300" />
                  Start a Premium Custom Mock
                </CardTitle>
                <CardDescription>
                  Unlock a stronger mock experience with premium questions from DCAM.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-amber-300/20 bg-amber-500/8 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Best for deeper practice and serious test preparation.</p>
                  <p className="mt-1">Ideal when you want a more challenging mock with stronger question depth.</p>
                </div>
                {paidQuestionCount > 0 ? (
                  <Button asChild className="h-11 w-full rounded-full border border-amber-300/35 bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-300 font-semibold text-slate-950 transition-all hover:from-amber-200 hover:via-orange-200 hover:to-yellow-200">
                    <Link href={buildCreateHref('premium')} prefetch={false}>
                      Start Premium Mock
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button className="h-11 w-full rounded-full" disabled>
                    Premium mock coming soon
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
