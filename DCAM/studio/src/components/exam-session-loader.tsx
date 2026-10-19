'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CheckCircle2, FileText, Layers3, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';

export type ExamSessionLoaderPhase = 'config' | 'questions' | 'environment' | 'ready';

type ExamSessionLoaderProps = {
  title: string;
  subtitle: string;
  detail: string;
  phase: ExamSessionLoaderPhase;
  progress: number;
  questionCount?: number;
  assetCount?: number;
  modeLabel?: string;
};

const phaseOrder: ExamSessionLoaderPhase[] = ['config', 'questions', 'environment'];

const phaseMeta: Record<ExamSessionLoaderPhase, { label: string; description: string }> = {
  config: {
    label: 'Exam Config',
    description: 'Verifying rules, timing, and access before launch.',
  },
  questions: {
    label: 'Question Pack',
    description: 'Building your question set and preloading scans and solutions.',
  },
  environment: {
    label: 'Environment',
    description: 'Opening the exam shell so the first question appears ready.',
  },
  ready: {
    label: 'Ready',
    description: 'Everything is prepared. Starting now.',
  },
};

export default function ExamSessionLoader({
  title,
  subtitle,
  detail,
  phase,
  progress,
  questionCount = 0,
  assetCount = 0,
  modeLabel = 'Exam Session',
}: ExamSessionLoaderProps) {
  const normalizedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const activeIndex = phase === 'ready' ? phaseOrder.length : phaseOrder.indexOf(phase);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_38%),linear-gradient(180deg,#0f172a_0%,#111827_52%,#020617_100%)] px-4 py-10">
      <div className="absolute inset-0 opacity-60">
        <div className="absolute left-[-8rem] top-16 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-28 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-4xl overflow-hidden border border-cyan-300/15 bg-slate-950/85 shadow-[0_30px_90px_-35px_rgba(56,189,248,0.45)] backdrop-blur">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-blue-400 to-emerald-300" />
        <CardHeader className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900/95 to-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              {modeLabel}
            </div>
            <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-100">
              {normalizedProgress}% ready
            </Badge>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{title}</CardTitle>
            <CardDescription className="max-w-2xl text-base text-slate-300">{subtitle}</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-8 p-6 md:p-8">
          <div className="grid gap-4 md:grid-cols-3">
            {phaseOrder.map((currentPhase, index) => {
              const isComplete = index < activeIndex;
              const isActive = !isComplete && currentPhase === phase;
              return (
                <div
                  key={currentPhase}
                  className={cn(
                    'rounded-2xl border p-4 transition-all',
                    isComplete
                      ? 'border-emerald-300/25 bg-emerald-500/10'
                      : isActive
                        ? 'border-cyan-300/25 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(103,232,249,0.12)]'
                        : 'border-white/10 bg-white/5'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    ) : isActive ? (
                      <LoaderCircle className="h-5 w-5 animate-spin text-cyan-200" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border border-white/20" />
                    )}
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-100">
                      {phaseMeta[currentPhase].label}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{phaseMeta[currentPhase].description}</p>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-100">{detail}</span>
              <span className="text-slate-400">{normalizedProgress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-emerald-300 transition-[width] duration-300 ease-out"
                style={{ width: `${normalizedProgress}%` }}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3 text-cyan-100">
                <FileText className="h-5 w-5" />
                <p className="text-sm font-semibold uppercase tracking-[0.14em]">Questions</p>
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">{questionCount.toLocaleString()}</p>
              <p className="mt-1 text-sm text-slate-400">Prepared before the exam starts.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3 text-blue-100">
                <Layers3 className="h-5 w-5" />
                <p className="text-sm font-semibold uppercase tracking-[0.14em]">Media Assets</p>
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">{assetCount.toLocaleString()}</p>
              <p className="mt-1 text-sm text-slate-400">Question scans and solution images cached first.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3 text-emerald-100">
                <ShieldCheck className="h-5 w-5" />
                <p className="text-sm font-semibold uppercase tracking-[0.14em]">Launch Guard</p>
              </div>
              <p className="mt-3 text-lg font-semibold text-white">{phaseMeta[phase].label}</p>
              <p className="mt-1 text-sm text-slate-400">Students enter only after the session is ready.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
