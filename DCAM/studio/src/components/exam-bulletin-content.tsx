'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import DashboardHeader from '@/components/dashboard-header';
import { Logo } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/firebase';
import {
  type ExamOfficialLink,
  type NoticeCategory,
  type NoticeItem,
  type NoticeBoardResponse,
  NOTICE_BOARD_LOCAL_STORAGE_KEY,
  getNoticeArticlePath,
  getNoticeBoardDateKey,
  isNoticeBoardFreshForToday,
} from '@/lib/notice-board';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileText,
  GraduationCap,
  LogIn,
  RefreshCw,
  ShieldCheck,
  UserPlus2,
} from 'lucide-react';

type ExamBulletinContentProps = {
  mode: 'app' | 'public';
};

const CATEGORY_LABELS: Record<NoticeCategory, string> = {
  registration: 'Registration',
  'admit-card': 'Admit card',
  'answer-key': 'Answer key',
  result: 'Result',
  counselling: 'Counselling',
  schedule: 'Schedule',
  notice: 'Notice',
};

function formatDate(value?: string, includeTime = false) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(parsed);
}

function readStoredNoticeBoard(): NoticeBoardResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(NOTICE_BOARD_LOCAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NoticeBoardResponse) : null;
  } catch {
    return null;
  }
}

function persistNoticeBoard(value: NoticeBoardResponse) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NOTICE_BOARD_LOCAL_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage is optional; the bulletin still works from network state.
  }
}

async function parseNoticeBoardResponse(response: Response): Promise<NoticeBoardResponse> {
  const text = await response.text();
  try {
    return JSON.parse(text) as NoticeBoardResponse;
  } catch {
    throw new Error(response.ok ? 'The exam bulletin response was not valid JSON.' : text);
  }
}

function officialLinksFor(section: {
  officialLinks?: ExamOfficialLink[];
  officialInfoUrl: string;
  officialApplyUrl: string;
}) {
  return section.officialLinks || [
    { id: 'notices' as const, label: 'Official notices', url: section.officialInfoUrl },
    { id: 'registration' as const, label: 'Registration portal', url: section.officialApplyUrl },
    { id: 'results' as const, label: 'Result & scorecard', url: section.officialInfoUrl },
  ];
}

function UpdateCard({ examId, item }: { examId: string; item: NoticeItem }) {
  const category = item.category || 'notice';

  return (
    <Card className="group rounded-lg border-border/80 bg-card shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <CardContent className="flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline" className="rounded-md border-primary/25 bg-primary/5 text-primary">
            {CATEGORY_LABELS[category]}
          </Badge>
          {item.publishedAt ? (
            <span className="text-xs font-medium text-muted-foreground">{formatDate(item.publishedAt)}</span>
          ) : null}
        </div>

        <h3 className="mt-4 text-lg font-semibold leading-7 text-card-foreground">{item.title}</h3>
        {item.summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.summary}</p> : null}

        {item.formStartDate || item.formCloseDate ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {item.formStartDate ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <CalendarDays className="h-3.5 w-3.5" /> Opens {item.formStartDate}
              </span>
            ) : null}
            {item.formCloseDate ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-700 dark:text-rose-300">
                <CalendarDays className="h-3.5 w-3.5" /> Closes {item.formCloseDate}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto pt-6">
          <Button asChild variant="ghost" className="h-9 justify-start px-0 font-semibold text-primary hover:bg-transparent hover:text-primary/80">
            <Link href={getNoticeArticlePath(examId, item)}>
              Read on DCAM <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PublicHeader() {
  return (
    <header className="rounded-[30px] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(7,46,67,0.78),rgba(8,19,31,0.94))] px-5 py-4 shadow-[0_30px_90px_-48px_rgba(34,211,238,0.7)] backdrop-blur-xl sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-4 text-white">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300"><Logo className="h-9 w-9" /></span>
          <span>
            <span className="block font-headline text-3xl font-semibold leading-none text-white">DCAM Classes</span>
            <span className="mt-1 hidden text-sm text-slate-300 sm:block">Online exam preparation and coaching platform</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="hidden h-11 rounded-2xl border border-white/15 bg-white/[0.05] px-4 text-slate-100 hover:border-cyan-300/55 hover:bg-cyan-500/10 hover:text-white sm:inline-flex">
            <Link href="/login"><LogIn className="h-4 w-4" /> Login</Link>
          </Button>
          <Button asChild className="h-11 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-4 font-semibold text-slate-950 hover:brightness-110">
            <Link href="/signup"><UserPlus2 className="h-4 w-4" /> Signup</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function PublicHero() {
  return (
    <section className="mt-10 overflow-hidden rounded-[34px] border border-cyan-300/15 bg-[linear-gradient(155deg,rgba(11,22,37,0.98),rgba(10,44,59,0.82)_45%,rgba(9,15,25,0.98))] text-white shadow-[0_38px_120px_-62px_rgba(15,118,110,0.9)]">
      <div className="grid gap-8 px-6 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold uppercase text-slate-100"><BellRing className="h-4 w-4 text-cyan-200" /> Exam Desk</div>
          <h1 className="mt-5 text-3xl font-semibold leading-tight text-white sm:text-5xl">DCAM Exam Bulletin</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200/85 sm:text-lg">
            Timely registration, admit card, answer key, result, and counselling updates. Read every brief on DCAM, then continue only through official exam portals.
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.05] p-5 text-sm leading-6 text-slate-200">
          <p className="font-semibold text-white">No coaching-site redirects</p>
          <p className="mt-1">External reports help detect an update. Your reading page stays on DCAM and action links go to the official authority.</p>
        </div>
      </div>
    </section>
  );
}

function BulletinBody({ data, error, isLoading }: { data: NoticeBoardResponse | null; error: string | null; isLoading: boolean }) {
  const openSections = useMemo(() => (data?.sections || []).filter((section) => section.updates.length > 0), [data]);
  const totalUpdates = useMemo(() => openSections.reduce((total, section) => total + section.updates.length, 0), [openSections]);

  return (
    <div className="space-y-10">
      <section className="grid overflow-hidden rounded-lg border bg-card shadow-sm sm:grid-cols-3">
        <div className="border-b p-5 sm:border-b-0 sm:border-r"><p className="text-xs font-semibold uppercase text-muted-foreground">Active briefs</p><p className="mt-2 text-2xl font-bold">{isLoading ? '...' : totalUpdates}</p></div>
        <div className="border-b p-5 sm:border-b-0 sm:border-r"><p className="text-xs font-semibold uppercase text-muted-foreground">Last checked</p><p className="mt-2 text-sm font-semibold">{formatDate(data?.fetchedAt, true) || 'Checking now'}</p></div>
        <div className="p-5"><p className="text-xs font-semibold uppercase text-muted-foreground">Link policy</p><p className="mt-2 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Official portals only</p></div>
      </section>

      {error ? <div className="flex items-start gap-3 rounded-lg border border-destructive/35 bg-destructive/5 p-4 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div> : null}

      {!isLoading && openSections.length > 0 ? (
        <nav aria-label="Exam sections" className="flex flex-wrap gap-2 border-b pb-5">
          {openSections.map((section) => <Button key={section.id} asChild variant="outline" size="sm" className="rounded-md bg-card"><a href={`#section-${section.id}`}>{section.examName}</a></Button>)}
        </nav>
      ) : null}

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-64 w-full rounded-lg" />)}</div>
      ) : openSections.length === 0 ? (
        <section className="rounded-lg border bg-card px-6 py-14 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
          <h2 className="mt-4 text-xl font-semibold">No current action needed</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">There are no fresh, actionable exam notices in today&apos;s freshness window. Completed registrations and expired exam-cycle stories are automatically removed.</p>
        </section>
      ) : (
        openSections.map((section) => (
          <section key={section.id} id={`section-${section.id}`} className="scroll-mt-24 border-t pt-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-xs font-semibold uppercase text-primary">{section.updates.length} current update{section.updates.length === 1 ? '' : 's'}</p><h2 className="mt-1 text-2xl font-bold">{section.examName}</h2></div>
              <div className="flex flex-wrap gap-2">
                {officialLinksFor(section).map((officialLink) => (
                  <Button key={officialLink.id} asChild variant="outline" size="sm" className="rounded-md bg-card">
                    <a href={officialLink.url} target="_blank" rel="noopener noreferrer">
                      {officialLink.id === 'registration' ? <FileCheck2 /> : officialLink.id === 'results' ? <GraduationCap /> : <FileText />}
                      {officialLink.label} <ExternalLink />
                    </a>
                  </Button>
                ))}
              </div>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2">{section.updates.map((item) => <UpdateCard key={`${section.id}-${item.slug || item.link}`} examId={section.id} item={item} />)}</div>
          </section>
        ))
      )}

      <div className="flex items-center gap-2 border-t pt-5 text-xs leading-5 text-muted-foreground"><RefreshCw className="h-3.5 w-3.5 shrink-0" />The DCAM Exam Desk refreshes automatically. Always confirm dates and eligibility on the linked official portal.</div>
    </div>
  );
}

export default function ExamBulletinContent({ mode }: ExamBulletinContentProps) {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const [data, setData] = useState<NoticeBoardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'public' && !isUserLoading && user) router.replace('/notice-board');
  }, [isUserLoading, mode, router, user]);

  useEffect(() => {
    let active = true;
    const stored = readStoredNoticeBoard();
    if (stored && isNoticeBoardFreshForToday(stored)) {
      setData(stored);
      setError(stored.error || null);
      setIsLoading(false);
      return () => { active = false; };
    }

    const load = async () => {
      if (stored) setData(stored);
      try {
        const response = await fetch('/api/notice-board');
        const json = await parseNoticeBoardResponse(response);
        if (!active) return;
        setData(json);
        setError(json.error || null);
        if (json.cacheDate === getNoticeBoardDateKey()) persistNoticeBoard(json);
      } catch (loadError: any) {
        if (active) setError(loadError?.message || 'Could not load the daily exam bulletin.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, []);

  if (mode === 'public') {
    return (
      <main className="dark min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.2),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.14),_transparent_20%),linear-gradient(180deg,_#04101b_0%,_#081827_44%,_#08131f_100%)] text-white">
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 md:pt-10">
          <PublicHeader />
          <PublicHero />
          <div className="py-10 md:py-12"><BulletinBody data={data} error={error} isLoading={isLoading} /></div>
        </div>
      </main>
    );
  }

  return <div className="flex h-full flex-col"><DashboardHeader title="Exam Bulletin" /><main className="flex-1 overflow-y-auto bg-muted/25 p-4 md:p-6 lg:p-8"><BulletinBody data={data} error={error} isLoading={isLoading} /></main></div>;
}
