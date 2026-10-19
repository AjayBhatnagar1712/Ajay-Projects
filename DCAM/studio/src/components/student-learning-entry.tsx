'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, GraduationCap, ClipboardCheck, Users, PlayCircle, Radio } from 'lucide-react';

export default function StudentLearningEntry() {
  const primaryCtaClass =
    'group h-11 w-full rounded-full border border-cyan-300/35 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-5 font-semibold text-slate-950 shadow-[0_12px_28px_-16px_rgba(56,189,248,0.9)] transition-all hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400 hover:shadow-[0_16px_34px_-16px_rgba(56,189,248,1)]';
  const secondaryCtaClass =
    'group h-11 w-full rounded-full border border-slate-500/60 bg-slate-900/70 px-5 font-medium text-slate-100 backdrop-blur-sm transition-all hover:border-cyan-300/60 hover:bg-cyan-500/10 hover:text-cyan-100';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/70 bg-gradient-to-br from-blue-500/10 via-background to-background">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
                <GraduationCap className="h-4 w-4" />
              </span>
              My Learning (Courses)
            </CardTitle>
            <CardDescription>
              My Learning is your course dashboard where purchased/enrolled courses are listed and continued.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className={primaryCtaClass}>
              <Link href="/my-learning" data-student-tour="my-learning-button">
                <span>Open My Learning</span>
                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-950/20 transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-gradient-to-br from-cyan-500/10 via-background to-background">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300">
                <ClipboardCheck className="h-4 w-4" />
              </span>
              Practice Test by Exam/Curriculum
            </CardTitle>
            <CardDescription>Explore DCAM Classes mock tests with exam, curriculum, and subject-based filtering.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Button asChild variant="outline" className={secondaryCtaClass}>
                <Link href="/mock-tests" data-student-tour="mock-tests-button">
                  <span>Search Mock Tests</span>
                  <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </Button>
              <Button asChild className={primaryCtaClass}>
                <Link href="/dcam-custom-mock" data-student-tour="custom-mock-button">
                  <span>Custom Mock Test</span>
                  <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-950/20 transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-gradient-to-r from-indigo-500/10 via-background to-background">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
              <Users className="h-4 w-4" />
            </span>
            Find Teachers
          </CardTitle>
          <CardDescription>
            Select exam, curriculum, and subjects to discover teachers on DCAM with matching teaching scope.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-300" />
            Compare teacher profiles, ratings, and fit for your preparation.
          </p>
          <div className="w-full sm:w-auto">
            <Button asChild className={primaryCtaClass}>
              <Link href="/find-teachers" data-student-tour="find-teachers-button">
                <span>Search Teachers</span>
                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-950/20 transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/70 bg-gradient-to-br from-emerald-500/10 via-background to-background">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                <PlayCircle className="h-4 w-4" />
              </span>
              Start Practice Session
            </CardTitle>
            <CardDescription>
              Launch focused practice from the DCAM Question Bank with free or premium question access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className={secondaryCtaClass}>
              <Link href="/dcam-practice-session" data-student-tour="practice-session-button">
                <span>Start Practice Session</span>
                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-gradient-to-br from-violet-500/10 via-background to-background">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/20 text-violet-300">
                <Radio className="h-4 w-4" />
              </span>
              Live Batches
            </CardTitle>
            <CardDescription>
              Search live batches from teachers and join scheduled sessions that match your exam and curriculum.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className={primaryCtaClass}>
              <Link href="/my-batch/explore" data-student-tour="live-batches-button">
                <span>Search Live Batches</span>
                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-950/20 transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
