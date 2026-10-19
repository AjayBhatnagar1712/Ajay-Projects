'use client';

import { useMemo } from 'react';
import { collection, query } from 'firebase/firestore';
import { BadgeCheck, RefreshCcw, Sparkles, Target } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type ExamTypeDoc = {
  id: string;
  name?: string;
};

type ExamMarketingContent = {
  headline: string;
  description: string;
  highlights: string[];
};

type ExamTheme = {
  cardClassName: string;
  badgeClassName: string;
  chipClassName: string;
  glowClassName: string;
};

const FALLBACK_EXAM_CONTENT: ExamMarketingContent = {
  headline: 'Structured Exam Preparation Programme',
  description:
    'Online classes, guided practice, mock tests, and performance support designed to strengthen preparation in a steady and organised manner.',
  highlights: [
    'Clear concept learning with teacher-led academic guidance',
    'Practice and mock tests aligned to exam requirements',
    'Regular performance review to support consistent improvement',
  ],
};

function getExamMarketingContent(examName: string): ExamMarketingContent {
  const normalized = examName.toLowerCase();

  if (normalized.includes('jee advanced')) {
    return {
      headline: 'JEE Advanced Mastery Programme',
      description:
        'Build deep conceptual strength in Physics, Chemistry, and Mathematics through rigorous problem solving, disciplined revision, and higher-order test practice.',
      highlights: [
        'Advanced-level PCM preparation with strong concept clarity and application',
        'Challenging problem practice for multi-step thinking, accuracy, and depth',
        'Test analysis focused on rank-oriented improvement and better attempt planning',
      ],
    };
  }

  if (normalized.includes('jee main')) {
    return {
      headline: 'JEE Main Performance Programme',
      description:
        'Strengthen PCM fundamentals, improve speed and accuracy, and prepare in a structured way for the current JEE Main pattern.',
      highlights: [
        'NCERT-backed concept coverage with chapter-wise PCM preparation',
        'Speed and accuracy practice for single-correct and numerical questions',
        'Mock-test review to improve marks, time management, and exam confidence',
      ],
    };
  }

  if (normalized.includes('jee')) {
    return {
      headline: 'JEE Preparation Programme',
      description:
        'Prepare for JEE in a disciplined way with concept clarity, practice support, and regular testing across Physics, Chemistry, and Mathematics.',
      highlights: [
        'Strong PCM foundation with chapter-wise learning support',
        'Consistent practice to improve question-solving confidence',
        'Mock tests and review for better exam readiness',
      ],
    };
  }

  if (normalized.includes('neet')) {
    return {
      headline: 'NEET Score Improvement Programme',
      description:
        'Strengthen Biology, Chemistry, and Physics through focused revision, daily practice, and disciplined test support for NEET preparation.',
      highlights: [
        'NCERT-focused Biology preparation with strong revision support',
        'Chapter-wise PCB practice for better accuracy and retention',
        'Mock-test review for attempt strategy, time use, and score improvement',
      ],
    };
  }

  if (normalized.includes('upsc')) {
    return {
      headline: 'UPSC Preparation Programme',
      description:
        'Build a steady preparation rhythm with concept clarity, current affairs linkage, answer-writing discipline, and regular test practice.',
      highlights: [
        'General Studies preparation with strong conceptual foundation',
        'Current affairs integration with subject understanding and analysis',
        'Answer-writing and test practice for disciplined preparation',
      ],
    };
  }

  if (normalized.includes('cuet')) {
    return {
      headline: 'CUET Preparation Programme',
      description:
        'Prepare in a structured way for domain subjects and aptitude sections with revision support, practice, and exam-oriented testing.',
      highlights: [
        'Domain subject preparation with concept clarity and revision focus',
        'Aptitude practice for speed, accuracy, and question selection',
        'Mock tests to strengthen confidence before the exam',
      ],
    };
  }

  if (normalized.includes('nda') || normalized.includes('cds') || normalized.includes('defence')) {
    return {
      headline: 'Defence Exam Preparation Programme',
      description:
        'Prepare in a disciplined manner for defence entrance exams with section-wise practice, revision planning, and regular test support.',
      highlights: [
        'Section-wise preparation with better command over fundamentals',
        'Practice for speed, accuracy, and decision-making under pressure',
        'Mock-test support aligned to actual exam expectations',
      ],
    };
  }

  return FALLBACK_EXAM_CONTENT;
}

function getExamTheme(examName: string): ExamTheme {
  const normalized = examName.toLowerCase();

  if (normalized.includes('jee advanced')) {
    return {
      cardClassName: 'border-cyan-300/22 bg-[linear-gradient(155deg,rgba(6,182,212,0.18),rgba(15,23,42,0.94)_58%,rgba(59,130,246,0.18))] shadow-[0_28px_70px_-46px_rgba(34,211,238,0.9)]',
      badgeClassName: 'border-cyan-300/35 bg-cyan-400/10 text-cyan-100',
      chipClassName: 'border-cyan-300/24 bg-cyan-500/10 text-cyan-50',
      glowClassName: 'bg-cyan-300/16',
    };
  }

  if (normalized.includes('jee main')) {
    return {
      cardClassName: 'border-amber-300/22 bg-[linear-gradient(155deg,rgba(245,158,11,0.16),rgba(15,23,42,0.94)_58%,rgba(251,191,36,0.14))] shadow-[0_28px_70px_-46px_rgba(251,191,36,0.82)]',
      badgeClassName: 'border-amber-300/35 bg-amber-300/10 text-amber-100',
      chipClassName: 'border-amber-300/24 bg-amber-500/10 text-amber-50',
      glowClassName: 'bg-amber-300/16',
    };
  }

  if (normalized.includes('jee')) {
    return {
      cardClassName: 'border-sky-300/22 bg-[linear-gradient(155deg,rgba(96,165,250,0.16),rgba(15,23,42,0.94)_58%,rgba(45,212,191,0.12))] shadow-[0_28px_70px_-46px_rgba(96,165,250,0.82)]',
      badgeClassName: 'border-sky-300/35 bg-sky-400/10 text-sky-100',
      chipClassName: 'border-sky-300/24 bg-sky-500/10 text-sky-50',
      glowClassName: 'bg-sky-300/16',
    };
  }

  if (normalized.includes('neet')) {
    return {
      cardClassName: 'border-emerald-300/22 bg-[linear-gradient(155deg,rgba(16,185,129,0.18),rgba(15,23,42,0.94)_58%,rgba(45,212,191,0.16))] shadow-[0_28px_70px_-46px_rgba(52,211,153,0.8)]',
      badgeClassName: 'border-emerald-300/35 bg-emerald-400/10 text-emerald-100',
      chipClassName: 'border-emerald-300/24 bg-emerald-500/10 text-emerald-50',
      glowClassName: 'bg-emerald-300/16',
    };
  }

  if (normalized.includes('upsc') || normalized.includes('nda') || normalized.includes('cds') || normalized.includes('defence')) {
    return {
      cardClassName: 'border-amber-300/22 bg-[linear-gradient(155deg,rgba(251,191,36,0.14),rgba(15,23,42,0.94)_58%,rgba(249,115,22,0.16))] shadow-[0_28px_70px_-46px_rgba(251,191,36,0.78)]',
      badgeClassName: 'border-amber-300/35 bg-amber-300/10 text-amber-100',
      chipClassName: 'border-amber-300/24 bg-amber-500/10 text-amber-50',
      glowClassName: 'bg-amber-300/14',
    };
  }

  if (normalized.includes('cuet')) {
    return {
      cardClassName: 'border-rose-300/22 bg-[linear-gradient(155deg,rgba(251,113,133,0.14),rgba(15,23,42,0.94)_58%,rgba(244,114,182,0.14))] shadow-[0_28px_70px_-46px_rgba(251,113,133,0.78)]',
      badgeClassName: 'border-rose-300/35 bg-rose-300/10 text-rose-100',
      chipClassName: 'border-rose-300/24 bg-rose-500/10 text-rose-50',
      glowClassName: 'bg-rose-300/14',
    };
  }

  return {
    cardClassName: 'border-sky-300/22 bg-[linear-gradient(155deg,rgba(96,165,250,0.16),rgba(15,23,42,0.94)_58%,rgba(45,212,191,0.12))] shadow-[0_28px_70px_-46px_rgba(96,165,250,0.82)]',
    badgeClassName: 'border-sky-300/35 bg-sky-400/10 text-sky-100',
    chipClassName: 'border-sky-300/24 bg-sky-500/10 text-sky-50',
    glowClassName: 'bg-sky-300/16',
  };
}

export default function HomeExamsSection() {
  const firestore = useFirestore();
  const examTypesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'exam_types')) : null),
    [firestore]
  );
  const { data: examTypes, isLoading, error } = useCollection<ExamTypeDoc>(examTypesQuery);

  const exams = useMemo(() => {
    return (examTypes || [])
      .map((item) => ({ id: item.id, name: item.name?.trim() || 'Exam Program' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [examTypes]);

  return (
    <section className="relative isolate mt-14">
      <div className="pointer-events-none absolute inset-x-4 -top-6 -bottom-6 rounded-[42px] bg-[linear-gradient(90deg,rgba(34,211,238,0.08),rgba(15,23,42,0.03),rgba(250,204,21,0.07))] blur-2xl" />
      <div className="pointer-events-none absolute inset-0 rounded-[40px] border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(14,116,144,0.06),rgba(8,15,26,0))]" />
      <Card className="relative overflow-hidden rounded-[36px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(10,22,35,0.98),rgba(14,32,46,0.96)_40%,rgba(10,18,30,0.98)_100%)] text-white shadow-[0_30px_90px_-56px_rgba(14,165,233,0.5)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(34,211,238,0.08),transparent_34%,transparent_66%,rgba(250,204,21,0.06))]" />
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/35 to-transparent" />
        <div className="pointer-events-none absolute left-10 top-10 h-28 w-28 rounded-full bg-cyan-300/6 blur-2xl" />
        <div className="pointer-events-none absolute bottom-10 right-10 h-28 w-28 rounded-full bg-amber-300/6 blur-2xl" />
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">
                <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                Exam Programmes
              </div>
              <CardTitle className="mt-4 text-3xl tracking-tight md:text-4xl">Online Exam Preparation Programs on DCAM Classes</CardTitle>
              <CardDescription className="mt-3 max-w-3xl text-base text-slate-200/80 md:text-lg">
                Explore the exam categories available on DCAM for online courses, live batches, guided practice, and mock-test preparation.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-64 w-full rounded-[28px] bg-white/10" />
              <Skeleton className="h-64 w-full rounded-[28px] bg-white/10" />
            </div>
          ) : error ? (
            <div className="rounded-[28px] border border-amber-300/35 bg-amber-400/10 p-5">
              <div className="mb-2 inline-flex items-center gap-2 text-amber-200">
                <RefreshCcw className="h-4 w-4" />
                Unable to load exams right now
              </div>
              <p className="text-sm text-slate-200/80">
                Please refresh the page. If the issue continues, check Firestore read access for `exam_types`.
              </p>
            </div>
          ) : exams.length > 0 ? (
            <div className="space-y-4">
              <Card className="rounded-[28px] border-cyan-300/16 bg-[linear-gradient(90deg,rgba(34,211,238,0.12),rgba(15,23,42,0.88),rgba(250,204,21,0.07))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-cyan-300" />
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-100">Supported Exams</p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                {exams.map((exam) => {
                  const marketing = getExamMarketingContent(exam.name);
                  const theme = getExamTheme(exam.name);
                  return (
                    <Card
                      key={exam.id}
                      className={`group relative overflow-hidden rounded-[30px] text-white backdrop-blur-lg transition-all duration-200 hover:-translate-y-1 ${theme.cardClassName}`}
                    >
                      <div className={`absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl ${theme.glowClassName}`} />
                      <CardContent className="relative space-y-4 p-5">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${theme.badgeClassName}`}>
                              <Sparkles className="h-3.5 w-3.5" />
                              {exam.name}
                            </div>
                            <div className={`hidden rounded-full border px-3 py-1 text-[11px] md:block ${theme.chipClassName}`}>
                              Preparation Track
                            </div>
                          </div>
                          <h3 className="text-3xl font-semibold tracking-tight text-white">{marketing.headline}</h3>
                          <p className="text-base leading-relaxed text-slate-100/82">{marketing.description}</p>
                        </div>

                        <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/18 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                          {marketing.highlights.map((point) => (
                            <div key={`${exam.id}-${point}`} className="flex items-start gap-2.5">
                              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-white/85" />
                              <p className="text-sm leading-snug text-slate-100/95">{point}</p>
                            </div>
                          ))}
                        </div>

                        <div className={`rounded-2xl border px-4 py-3 ${theme.chipClassName}`}>
                          <p className="text-sm leading-relaxed">
                            Available on DCAM through structured courses, live batches, guided practice, and exam-oriented mock tests.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
              <div className="mb-2 inline-flex items-center gap-2 text-cyan-200">
                <Target className="h-4 w-4" />
                New Exam Programs Launching
              </div>
              <p className="text-sm text-slate-200/80">
                Our team is actively onboarding new exam programs. Check back soon or create an account to stay updated first.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
