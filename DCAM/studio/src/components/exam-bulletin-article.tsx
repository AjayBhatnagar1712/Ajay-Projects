'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Logo } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type ExamOfficialLink,
  type ExamSection,
  type NoticeBoardResponse,
  type NoticeCategory,
  type NoticeItem,
  createNoticeSlug,
} from '@/lib/notice-board';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileText,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';

const CATEGORY_LABELS: Record<NoticeCategory, string> = {
  registration: 'Registration update',
  'admit-card': 'Admit card update',
  'answer-key': 'Answer key update',
  result: 'Result update',
  counselling: 'Counselling update',
  schedule: 'Schedule update',
  notice: 'Exam notice',
};

function formatDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

function getOfficialLinks(section: ExamSection): ExamOfficialLink[] {
  return section.officialLinks || [
    { id: 'notices', label: 'Official notices', url: section.officialInfoUrl },
    { id: 'registration', label: 'Registration portal', url: section.officialApplyUrl },
    { id: 'results', label: 'Result & scorecard', url: section.officialInfoUrl },
  ];
}

function ResourceIcon({ id }: { id: ExamOfficialLink['id'] }) {
  if (id === 'registration') return <FileCheck2 className="h-5 w-5" />;
  if (id === 'results') return <GraduationCap className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

export default function ExamBulletinArticle() {
  const params = useParams<{ examId: string; updateSlug: string }>();
  const examId = decodeURIComponent(params.examId || '');
  const updateSlug = decodeURIComponent(params.updateSlug || '');
  const [data, setData] = useState<NoticeBoardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/notice-board')
      .then(async (response) => {
        if (!response.ok) throw new Error('The bulletin could not be loaded.');
        return response.json() as Promise<NoticeBoardResponse>;
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((loadError: any) => {
        if (active) setError(loadError?.message || 'The bulletin could not be loaded.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const article = useMemo(() => {
    const section = data?.sections.find((candidate) => candidate.id === examId);
    const item = section?.updates.find(
      (candidate) => (candidate.slug || createNoticeSlug(candidate.title, candidate.publishedAt)) === updateSlug
    );
    return section && item ? { section, item } : null;
  }, [data, examId, updateSlug]);

  return (
    <main className="dark min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.2),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.14),_transparent_20%),linear-gradient(180deg,_#04101b_0%,_#081827_44%,_#08131f_100%)] text-white">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 md:pt-10">
      <header className="rounded-[30px] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(7,46,67,0.78),rgba(8,19,31,0.94))] px-5 py-4 shadow-[0_30px_90px_-48px_rgba(34,211,238,0.7)] backdrop-blur-xl sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-4 text-white">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300"><Logo className="h-9 w-9" /></span>
            <span><span className="block font-headline text-3xl font-semibold leading-none text-white">DCAM Classes</span><span className="mt-1 hidden text-sm text-slate-300 sm:block">Online exam preparation and coaching platform</span></span>
          </Link>
          <Button asChild variant="outline" className="h-11 rounded-2xl border-white/15 bg-white/[0.05] px-4 text-slate-100 hover:border-cyan-300/55 hover:bg-cyan-500/10 hover:text-white">
            <Link href="/exam-bulletin"><ArrowLeft className="h-4 w-4" /> All updates</Link>
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="py-12"><Skeleton className="h-8 w-40 bg-white/10" /><Skeleton className="mt-6 h-20 max-w-3xl bg-white/10" /><Skeleton className="mt-10 h-72 w-full bg-white/10" /></div>
      ) : error ? (
        <div className="mx-auto max-w-3xl py-20 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-rose-300" /><h1 className="mt-4 text-2xl font-bold text-white">Update unavailable</h1><p className="mt-2 text-slate-300">{error}</p></div>
      ) : !article ? (
        <div className="mx-auto max-w-3xl py-20 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
          <h1 className="mt-4 text-2xl font-bold text-white">This notice is no longer current</h1>
          <p className="mt-3 text-slate-300">DCAM automatically retires expired deadlines and completed exam-cycle stories.</p>
          <Button asChild className="mt-7 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 font-semibold text-slate-950 hover:brightness-110"><Link href="/exam-bulletin">View current bulletin <ArrowRight /></Link></Button>
        </div>
      ) : (
        <ArticleContent section={article.section} item={article.item} />
      )}
      </div>
    </main>
  );
}

function ArticleContent({ section, item }: { section: ExamSection; item: NoticeItem }) {
  const category = item.category || 'notice';
  const officialLinks = getOfficialLinks(section);

  return (
    <>
      <article>
        <header className="mt-10 rounded-[34px] border border-cyan-300/15 bg-[linear-gradient(155deg,rgba(11,22,37,0.98),rgba(10,44,59,0.82)_45%,rgba(9,15,25,0.98))] shadow-[0_38px_120px_-62px_rgba(15,118,110,0.9)]">
          <div className="px-6 py-8 md:px-8 md:py-10">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-cyan-100 hover:bg-cyan-400/10">{CATEGORY_LABELS[category]}</Badge>
              <span className="text-sm font-semibold text-cyan-200">{section.examName}</span>
              {item.publishedAt ? <span className="text-sm text-slate-300">Updated {formatDate(item.publishedAt)}</span> : null}
            </div>
            <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight text-white sm:text-4xl md:text-5xl">{item.title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-200/85 sm:text-lg">{item.summary}</p>
          </div>
        </header>

        <div className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:py-12">
          <div className="space-y-10">
            <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,18,32,0.98),rgba(17,24,39,0.95))] p-6 md:p-8">
              <p className="text-xs font-bold uppercase text-cyan-300">DCAM brief</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">What students should know</h2>
              <p className="mt-4 text-base leading-8 text-slate-200/85">
                This is a current {section.examName} {CATEGORY_LABELS[category].toLowerCase()} detected by the DCAM Exam Desk. Use this page as a clear starting point, but treat the exam authority&apos;s portal as the final source for dates, eligibility, documents, fees, and status.
              </p>
            </section>

            {item.formStartDate || item.formCloseDate || item.detectedDates.length > 0 ? (
              <section className="rounded-[30px] border border-cyan-300/15 bg-cyan-400/[0.04] p-6 md:p-8">
                <h2 className="text-xl font-semibold text-white">Important dates mentioned</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {item.formStartDate ? <DateBox label="Application starts" value={item.formStartDate} /> : null}
                  {item.formCloseDate ? <DateBox label="Application closes" value={item.formCloseDate} /> : null}
                  {!item.formStartDate && !item.formCloseDate ? item.detectedDates.slice(0, 4).map((date) => <DateBox key={date} label="Date mentioned" value={date} />) : null}
                </div>
              </section>
            ) : null}

            <section className="rounded-[30px] border border-white/10 bg-slate-950/35 p-6 md:p-8">
              <h2 className="text-2xl font-semibold text-white">Before you proceed</h2>
              <div className="mt-6 space-y-5">
                {[
                  ['Confirm the notice', 'Open the official notices page and match the announcement title or date.'],
                  ['Use the correct portal', 'Register, download documents, or check results only on the official authority website.'],
                  ['Keep proof', 'Save the confirmation page, application number, payment receipt, or scorecard for your records.'],
                ].map(([title, copy], index) => (
                  <div key={title} className="grid grid-cols-[2rem_1fr] gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-sm font-bold text-cyan-100">{index + 1}</span>
                    <div><h3 className="font-semibold text-white">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-300">{copy}</p></div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-[30px] border border-emerald-300/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(15,23,42,0.72))] p-5 shadow-xl shadow-black/20">
              <div className="flex items-center gap-2 text-sm font-bold text-white"><ShieldCheck className="h-5 w-5 text-emerald-300" /> Official resources</div>
              <p className="mt-2 text-xs leading-5 text-slate-300">These buttons leave DCAM only for the official exam authority.</p>
              <div className="mt-5 space-y-2">
                {officialLinks.map((officialLink) => (
                  <Button key={officialLink.id} asChild variant="outline" className="h-auto w-full justify-between rounded-2xl border-white/15 bg-white/[0.05] px-3 py-3 text-white hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-white">
                    <a href={officialLink.url} target="_blank" rel="noopener noreferrer">
                      <span className="flex items-center gap-2"><ResourceIcon id={officialLink.id} />{officialLink.label}</span><ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ))}
              </div>
              <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-slate-300">DCAM does not collect application fees or credentials on this bulletin page.</p>
            </div>
          </aside>
        </div>
      </article>
    </>
  );
}

function DateBox({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-cyan-300/15 bg-slate-950/35 p-4"><CalendarDays className="mt-0.5 h-5 w-5 text-cyan-300" /><div><p className="text-xs font-semibold uppercase text-slate-400">{label}</p><p className="mt-1 font-bold text-white">{value}</p></div></div>;
}
