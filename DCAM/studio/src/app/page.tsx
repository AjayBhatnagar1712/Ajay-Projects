import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  BookOpenText,
  CalendarCheck2,
  CheckCircle2,
  GraduationCap,
  LogIn,
  MessageSquareText,
  School,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus2,
  Users2,
} from 'lucide-react';
import { Logo } from '@/components/icons';
import JsonLd from '@/components/json-ld';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ContactDcamClassesCard from '@/components/contact-dcam-classes-card';
import HomeExamsSection from '@/components/home-exams-section';
import {
  buildCollectionPageStructuredData,
  buildFaqStructuredData,
  buildOrganizationStructuredData,
  buildPageMetadata,
  buildWebSiteStructuredData,
} from '@/lib/site-metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'DCAM Classes | Online Platform for Courses, Live Batches, Mock Tests, and Exam Preparation',
  description:
    'DCAM Classes is a professional exam preparation platform for JEE Main, NEET, engineering, medical, and other competitive exams where students discover teachers, join live batches, study courses, attempt mock tests, and practice daily.',
  path: '/',
  keywords: [
    'online exam preparation',
    'online coaching institute',
    'live batches',
    'online courses',
    'mock tests',
    'competitive exam preparation',
    'teacher platform',
    'student learning platform',
    'JEE preparation',
    'NEET preparation',
    'JEE Main online coaching',
    'NEET online coaching',
    'engineering entrance exam preparation',
    'medical entrance exam preparation',
  ],
});

const studentAudiencePoints = [
  'Find suitable teachers, courses, and live batches for your exam preparation from one place.',
  'Continue your preparation through live classes, courses, mock tests, practice, doubt support, and custom mocks in an organised way.',
  'Keep your progress, attempts, purchased learning, and important exam updates properly organised on one dashboard.',
];

const teacherAudiencePoints = [
  'Plan and manage courses, live batches, mock tests, practice, and student support from one organised dashboard.',
  'Structure every programme by exam, subject, chapter, topic, module, and assessment so students can follow the learning path clearly.',
  'Handle enrolments, academic communication, and learner progress professionally while building a trusted teaching presence online.',
];

const studentCapabilities = [
  {
    title: 'Discover Teachers for Your Exam Goal',
    description: 'Browse teachers on the platform and choose the right mentor according to your exam, subject needs, and preparation stage.',
    icon: Users2,
  },
  {
    title: 'Join Live Batches and Online Classes',
    description: 'Join teacher-led live batches and attend scheduled classes in a more organised and disciplined manner.',
    icon: CalendarCheck2,
  },
  {
    title: 'Start Daily Practice Sessions',
    description: 'Practise regularly with question banks that match your exam path, teacher context, and preparation level.',
    icon: BookOpenText,
  },
  {
    title: 'Attempt Teacher-Created Mock Tests',
    description: 'Attempt teacher-created mock tests, review your performance, and improve your score step by step.',
    icon: Trophy,
  },
  {
    title: 'Build Custom Mock Tests',
    description: 'Create your own custom mock by selecting the exam path, teacher context, and setup that suits your preparation.',
    icon: Sparkles,
  },
  {
    title: 'Continue Learning Across Courses',
    description: 'Continue your purchased courses, resume modules, and keep your course learning organised without breaking continuity.',
    icon: BookOpenText,
  },
  {
    title: 'Ask Doubts and Stay Supported',
    description: 'Ask doubts on time, clear confusion properly, and keep your preparation moving without unnecessary delay.',
    icon: MessageSquareText,
  },
  {
    title: 'Track Exam Bulletins and Deadlines',
    description: 'Stay updated with official notices, application dates, and deadline alerts from one place.',
    icon: BellRing,
  },
  {
    title: 'Monitor Your Learning Progress',
    description: 'Track attempts, activity, test history, and your full preparation progress through My Practice and My Batch.',
    icon: Users2,
  },
];

const teacherCapabilities = [
  {
    title: 'Create Courses and Study Plans',
    description: 'Create well-structured courses with lessons, modules, learning flow, and suitable access settings for different student needs.',
    icon: BookOpenText,
  },
  {
    title: 'Run Live Batches Smoothly',
    description: 'Schedule live classes, manage sessions, and keep batch delivery organised subject-wise and date-wise.',
    icon: CalendarCheck2,
  },
  {
    title: 'Publish Mock Tests and Practice',
    description: 'Publish mock tests, practice sets, and guided preparation options aligned to the exam and topic.',
    icon: Trophy,
  },
  {
    title: 'Plan Learning Access Clearly',
    description: 'Design clear learning plans and access options so students can choose the right academic support with confidence.',
    icon: ShieldCheck,
  },
  {
    title: 'Handle Student Activity in One Place',
    description: 'Monitor enrolments, attendance, performance, and learner activity without depending on multiple tools.',
    icon: Users2,
  },
  {
    title: 'Build a Strong Teaching Presence',
    description: 'Present your courses, batches, tests, and teaching approach clearly so students and parents can build confidence.',
    icon: School,
  },
  {
    title: 'Support Doubts and Important Updates',
    description: 'Respond to doubts, guide students at the right time, and keep them informed with important academic updates.',
    icon: MessageSquareText,
  },
  {
    title: 'Track Results and Student Follow-Up',
    description: 'Review attendance, performance, and engagement regularly so student follow-up becomes more meaningful.',
    icon: BellRing,
  },
  {
    title: 'Offer Advanced Practice Support',
    description: 'Offer advanced practice and custom mock support in a structured and student-friendly manner.',
    icon: Sparkles,
  },
];

const publicEntryPoints = [
  {
    title: 'Exam Preparation Platform',
    description: 'Understand how DCAM supports study plans with courses, batches, practice, progress tracking, and teacher discovery.',
    href: '/exam-preparation',
    icon: BookOpenText,
  },
  {
    title: 'Mock Test Series',
    description: 'See how students use teacher-created mock tests, custom mocks, and analysis reports to improve exam performance.',
    href: '/mock-test-series',
    icon: Trophy,
  },
  {
    title: 'Online Coaching Platform',
    description: 'Explore how teachers and coaching teams can deliver classes, content, tests, and communication from one platform.',
    href: '/online-coaching-platform',
    icon: School,
  },
  {
    title: 'Exam Bulletin',
    description: 'Learn how DCAM keeps students updated with important exam notices, application windows, and deadlines.',
    href: '/exam-bulletin',
    icon: BellRing,
  },
  {
    title: 'JEE Main Online Coaching',
    description: 'Explore how DCAM supports JEE Main preparation with online coaching workflows, PCM practice, and mock tests.',
    href: '/jee-main-online-coaching',
    icon: Trophy,
  },
  {
    title: 'NEET Online Coaching',
    description: 'See how DCAM supports NEET preparation with PCB learning workflows, mock tests, and structured revision support.',
    href: '/neet-online-coaching',
    icon: GraduationCap,
  },
  {
    title: 'Engineering & Medical Entrance Prep',
    description: 'Understand how engineering and medical entrance preparation fits into the full DCAM learning ecosystem.',
    href: '/engineering-and-medical-entrance-exam-preparation',
    icon: School,
  },
  {
    title: 'JEE & NEET Coaching Guide',
    description: 'Read a practical guide on choosing online vs offline coaching for JEE Main and NEET.',
    href: '/jee-neet-coaching-guide',
    icon: Sparkles,
  },
];

const homeFaqs = [
  {
    question: 'What is DCAM Classes used for?',
    answer:
      'DCAM Classes is used for online exam preparation, mock tests, live batches, structured courses, practice sessions, and teacher-led coaching delivery.',
  },
  {
    question: 'Who can use DCAM Classes?',
    answer:
      'Students can use DCAM to study, practise, attempt mock tests, and track preparation, while teachers can create courses, run live batches, publish tests, and manage learners.',
  },
  {
    question: 'Does DCAM Classes support custom mock tests and analysis?',
    answer:
      'Yes. Students can attempt teacher-created tests, build custom mocks, and review detailed analysis with solutions and performance breakdowns.',
  },
  {
    question: 'Can students use DCAM Classes for JEE Main and NEET preparation?',
    answer:
      'Yes. DCAM includes public preparation pages and platform workflows relevant to JEE Main, NEET, engineering, medical, and other competitive-exam journeys.',
  },
  {
    question: 'Can coaching institutes and individual teachers use DCAM?',
    answer:
      'Yes. DCAM supports individual teachers and coaching teams that want to deliver online classes, learning content, tests, notices, and student guidance from one place.',
  },
];

type StudentResult = {
  name: string;
  result: string;
  initials: string;
  tone: string;
};

type ResultGroup = {
  exam: string;
  results: StudentResult[];
};

const resultGroups: ResultGroup[] = [
  {
    exam: 'JEE Main',
    results: [
      { name: 'Blesson Emmanuel Somidi', result: '99.57%ile', initials: 'BS', tone: 'from-cyan-300 to-blue-500' },
      { name: 'Archisman Chakrabarti', result: '95.70%ile', initials: 'AC', tone: 'from-emerald-300 to-cyan-500' },
      { name: 'Vidit Goyal', result: '94.80%ile', initials: 'VG', tone: 'from-amber-300 to-orange-500' },
      { name: 'Luvya Suri', result: '93.91%ile', initials: 'LS', tone: 'from-sky-300 to-violet-500' },
      { name: 'Abhishek Dhyani', result: '88.70%ile', initials: 'AD', tone: 'from-rose-300 to-amber-500' },
    ],
  },
  {
    exam: 'CBSE Class XII',
    results: [
      { name: 'Archisman Chakrabarti', result: '96.00%', initials: 'AC', tone: 'from-emerald-300 to-cyan-500' },
      { name: 'Vidit Goyal', result: '94.20%', initials: 'VG', tone: 'from-amber-300 to-orange-500' },
      { name: 'Luvya Suri', result: '91.20%', initials: 'LS', tone: 'from-sky-300 to-violet-500' },
      { name: 'Kriti Verma', result: '91.00%', initials: 'KV', tone: 'from-fuchsia-300 to-rose-500' },
      { name: 'Ayushi Gautam', result: '87.40%', initials: 'AG', tone: 'from-lime-300 to-emerald-500' },
    ],
  },
  {
    exam: 'WBJEE 2026',
    results: [
      {
        name: 'Archisman Chakrabarti',
        result: 'GMR 798',
        initials: 'AC',
        tone: 'from-indigo-300 to-cyan-500',
      },
    ],
  },
  {
    exam: 'KIITEE',
    results: [
      { name: 'Samadrito Saha', result: '99.3068%ile', initials: 'SS', tone: 'from-yellow-300 to-amber-500' },
    ],
  },
];

function StudentResultsShowcase() {
  const marqueeGroups = [...resultGroups, ...resultGroups];

  return (
    <Card className="relative overflow-hidden rounded-[34px] border-cyan-300/16 bg-[linear-gradient(135deg,rgba(8,25,39,0.98),rgba(17,24,39,0.92)_48%,rgba(8,18,31,0.98))] text-white shadow-[0_34px_110px_-62px_rgba(34,211,238,0.58)] backdrop-blur-xl">
      <div className="absolute inset-y-0 left-0 w-1/3 bg-[radial-gradient(circle_at_left,rgba(34,211,238,0.22),transparent_66%)]" />
      <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_right,rgba(251,191,36,0.18),transparent_66%)]" />
      <CardContent className="relative space-y-4 p-5 sm:p-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
            <Trophy className="h-3.5 w-3.5 text-amber-200" />
            Results
          </div>
          <div className="flex max-w-full flex-wrap gap-2">
            {resultGroups.map((group) => (
              <span
                key={group.exam}
                className="rounded-full border border-cyan-300/18 bg-cyan-400/[0.06] px-3 py-1 text-xs font-medium text-cyan-50"
              >
                {group.exam}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-hidden py-1 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
          <div className="dcam-results-marquee flex w-max gap-4">
            {marqueeGroups.map((group, groupIndex) => (
              <div
                key={`${group.exam}-${groupIndex}`}
                className="flex min-w-max items-stretch gap-3 rounded-[28px] border border-white/10 bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                <div className="flex w-36 shrink-0 flex-col justify-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] px-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">{group.exam}</p>
                </div>
                {group.results.map((student) => (
                  <div
                    key={`${group.exam}-${groupIndex}-${student.name}`}
                    className="flex w-72 shrink-0 items-center gap-3 rounded-2xl border border-cyan-300/12 bg-slate-950/55 px-4 py-3"
                  >
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${student.tone} text-sm font-bold text-slate-950 shadow-[0_12px_30px_-18px_rgba(34,211,238,0.9)]`}>
                      {student.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{student.name}</p>
                      <p className="mt-0.5 text-xl font-semibold text-cyan-100">{student.result}</p>
                      <p className="text-xs leading-snug text-slate-300">{group.exam}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GooglePlayGlyph() {
  return (
    <svg viewBox="0 0 36 40" className="h-11 w-11 shrink-0 drop-shadow-[0_6px_16px_rgba(0,0,0,0.28)]" aria-hidden="true">
      <path d="M4 3.5L20.7 20L4 36.5V3.5Z" fill="#00D26A" />
      <path d="M4 3.5L26 16.4L20.7 20L4 3.5Z" fill="#00A8FF" />
      <path d="M4 36.5L20.7 20L26 23.6L4 36.5Z" fill="#FFB800" />
      <path d="M20.7 20L26 16.4L32.2 20L26 23.6L20.7 20Z" fill="#FF5A5F" />
    </svg>
  );
}

function ExamBulletinCard() {
  return (
    <Card className="rounded-3xl border-amber-300/35 bg-[linear-gradient(135deg,rgba(251,191,36,0.25),rgba(8,15,24,0.86)_55%)] text-white shadow-2xl shadow-black/45 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5">
      <CardHeader>
        <p className="inline-flex w-fit items-center rounded-full border border-amber-300/45 bg-amber-300/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/95">
          Live Tracker
        </p>
        <CardTitle className="mt-2 flex items-center gap-2 text-4xl text-amber-100">
          <BellRing className="h-6 w-6 text-amber-200" />
          Exam Bulletin
        </CardTitle>
        <CardDescription className="text-base text-amber-100/85">
          Stay updated with official exam notifications, application windows, and critical deadlines through one reliable bulletin view.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          asChild
          className="group h-12 w-full rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-200 font-semibold text-slate-950 shadow-[0_18px_40px_-20px_rgba(251,191,36,0.95)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105"
        >
          <Link href="/exam-bulletin">
            <span>Open Exam Bulletin</span>
            <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/10 transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function RootPage() {
  const brandWordClass = 'truncate font-headline text-3xl font-semibold leading-none tracking-tight text-white';
  const topSecondaryButtonClass =
    'h-11 rounded-2xl border border-white/15 bg-white/[0.05] px-4 text-slate-100 shadow-[0_16px_34px_-24px_rgba(15,23,42,0.95)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/55 hover:bg-cyan-500/10 hover:text-white';
  const topPrimaryButtonClass =
    'h-11 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-4 font-semibold text-slate-950 shadow-[0_20px_48px_-22px_rgba(56,189,248,1)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110';
  const primaryCtaClass =
    'group h-12 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-5 font-semibold text-slate-950 shadow-[0_18px_40px_-18px_rgba(56,189,248,0.95)] ring-1 ring-cyan-200/50 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110';
  const secondaryCtaClass =
    'group h-12 rounded-2xl border border-white/20 bg-white/[0.08] px-5 font-semibold text-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/55 hover:bg-cyan-500/10';
  const playStoreLink = 'https://drive.google.com/drive/folders/1w1IOu2-AEHqz5p1SvKfImPbo9x_y6fir?usp=drive_link';

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.16),_transparent_20%),radial-gradient(circle_at_50%_110%,_rgba(16,185,129,0.16),_transparent_24%),linear-gradient(180deg,_#04101b_0%,_#081827_40%,_#08131f_100%)] text-white">
      <JsonLd
        data={[
          buildOrganizationStructuredData(),
          buildWebSiteStructuredData(),
          buildCollectionPageStructuredData({
            title: 'DCAM Classes | Online Exam Preparation and Coaching Platform',
            description:
              'Public overview of DCAM Classes for courses, live batches, mock tests, daily practice, exam bulletins, and online coaching workflows.',
            path: '/',
          }),
          buildFaqStructuredData(homeFaqs),
        ]}
      />
      <div className="relative overflow-hidden">
        <div className="absolute -top-40 left-[-7rem] h-[28rem] w-[28rem] rounded-full bg-cyan-400/14 blur-3xl" />
        <div className="absolute top-24 right-[-6rem] h-[24rem] w-[24rem] rounded-full bg-blue-400/14 blur-3xl" />
        <div className="absolute top-[36rem] left-[8%] h-[20rem] w-[20rem] rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[10%] h-[24rem] w-[24rem] rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(56,189,248,0.08)_1px,transparent_1px)] [background-size:26px_26px] opacity-15" />
        <div className="absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),transparent)]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 md:pt-10">
          <header className="relative overflow-hidden rounded-[30px] border border-cyan-300/12 bg-[linear-gradient(135deg,rgba(7,46,67,0.72),rgba(8,19,31,0.92))] px-5 py-4 shadow-[0_30px_90px_-48px_rgba(34,211,238,0.7)] backdrop-blur-xl sm:px-6">
            <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.2),transparent_60%)]" />
            <div className="absolute left-1/3 top-0 h-px w-32 bg-cyan-300/40" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/" className="flex min-w-0 items-center gap-4">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <Logo className="h-9 w-9 text-cyan-300" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className={brandWordClass}>DCAM</p>
                  <p className={brandWordClass}>Classes</p>
                </div>
              </Link>
              <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:items-center">
                <Button asChild variant="ghost" className={topSecondaryButtonClass}>
                  <Link href="/login">
                    <LogIn className="h-4 w-4" />
                    Login
                  </Link>
                </Button>
                <Button asChild className={topPrimaryButtonClass}>
                  <Link href="/signup">
                    <UserPlus2 className="h-4 w-4" />
                    Signup
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          <section className="mt-10">
            <div className="mx-auto max-w-7xl space-y-4">
              <StudentResultsShowcase />
              <ContactDcamClassesCard />
              <ExamBulletinCard />
            </div>
          </section>

          <HomeExamsSection />

          <section className="mt-10">
            <div className="mx-auto max-w-7xl space-y-4">
              <Card className="rounded-[34px] border-white/10 bg-[linear-gradient(155deg,rgba(11,22,37,0.98),rgba(10,44,59,0.78)_45%,rgba(9,15,25,0.98))] text-white shadow-[0_38px_120px_-62px_rgba(15,118,110,0.9)] backdrop-blur-xl transition-all duration-200">
                <CardHeader className="border-b border-white/8 pb-6">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                    Students + Teachers
                  </div>
                  <h1 className="mt-4 text-3xl font-semibold leading-tight md:text-4xl">A platform for focused exam preparation and organised teaching</h1>
                  <CardDescription className="max-w-3xl text-base text-slate-200/80 md:text-lg xl:max-w-none xl:whitespace-nowrap">
                    DCAM brings student learning, teaching, testing, and academic planning together in one organised platform.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="relative overflow-hidden rounded-[30px] border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(6,182,212,0.16),rgba(15,23,42,0.48))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-300/12 blur-2xl" />
                      <div className="mb-4 flex items-center gap-3">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-500/10">
                          <GraduationCap className="h-5 w-5 text-cyan-200" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-100">For Students</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {studentAudiencePoints.map((point) => (
                          <div
                            key={point}
                            className="flex items-start gap-3 rounded-2xl border border-cyan-200/10 bg-slate-950/20 px-4 py-3.5"
                          >
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                            <p className="flex-1 text-[15px] leading-snug text-slate-100">{point}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-5 border-t border-cyan-300/20 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/90">
                          On DCAM, students can
                        </p>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          {studentCapabilities.map((feature) => {
                            const Icon = feature.icon;
                            return (
                              <div
                                key={feature.title}
                                className="group flex items-start gap-3 rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.03] px-4 py-3 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-300/35 hover:bg-cyan-400/[0.08] hover:shadow-[0_18px_34px_-24px_rgba(34,211,238,0.85)]"
                              >
                                <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-500/10 shadow-[0_10px_24px_-18px_rgba(34,211,238,0.9)] transition-all duration-200 group-hover:scale-105 group-hover:border-cyan-200/45 group-hover:bg-cyan-400/16">
                                  <Icon className="h-4 w-4 text-cyan-200" />
                                </div>
                                <div>
                                  <p className="text-[17px] font-semibold leading-snug text-white transition-all duration-200 group-hover:-translate-y-0.5 group-hover:text-cyan-100">
                                    {feature.title}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="relative overflow-hidden rounded-[30px] border border-emerald-300/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(15,23,42,0.48))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <div className="absolute -left-10 -top-10 h-28 w-28 rounded-full bg-emerald-300/12 blur-2xl" />
                      <div className="mb-4 flex items-center gap-3">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-500/10">
                          <School className="h-5 w-5 text-emerald-200" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-100">For Teachers</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {teacherAudiencePoints.map((point) => (
                          <div
                            key={point}
                            className="flex items-start gap-3 rounded-2xl border border-emerald-200/10 bg-slate-950/20 px-4 py-3.5"
                          >
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                            <p className="flex-1 text-[15px] leading-snug text-slate-100">{point}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-5 border-t border-emerald-300/20 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100/90">
                          On DCAM, teachers can
                        </p>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          {teacherCapabilities.map((feature) => {
                            const Icon = feature.icon;
                            return (
                              <div
                                key={feature.title}
                                className="group flex items-start gap-3 rounded-2xl border border-emerald-300/14 bg-emerald-400/[0.03] px-4 py-3 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300/35 hover:bg-emerald-400/[0.08] hover:shadow-[0_18px_34px_-24px_rgba(52,211,153,0.85)]"
                              >
                                <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-500/10 shadow-[0_10px_24px_-18px_rgba(52,211,153,0.9)] transition-all duration-200 group-hover:scale-105 group-hover:border-emerald-200/45 group-hover:bg-emerald-400/16">
                                  <Icon className="h-4 w-4 text-emerald-200" />
                                </div>
                                <div>
                                  <p className="text-[17px] font-semibold leading-snug text-white transition-all duration-200 group-hover:-translate-y-0.5 group-hover:text-emerald-100">
                                    {feature.title}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-cyan-300/18 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(16,185,129,0.14))] px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Users2 className="h-5 w-5 text-cyan-100" />
                      <p className="text-sm font-medium text-cyan-50">
                        One organised platform for courses, live batches, mock tests, doubt support, exam updates, student progress, and teaching delivery.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </section>

          <section className="mt-12">
            <Card className="rounded-[34px] border-white/10 bg-[linear-gradient(155deg,rgba(11,22,37,0.98),rgba(12,36,49,0.82)_45%,rgba(9,15,25,0.98))] text-white shadow-[0_34px_110px_-62px_rgba(34,211,238,0.5)]">
              <CardHeader>
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                  <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                  Explore DCAM
                </div>
                <CardTitle className="mt-4 text-3xl leading-tight md:text-4xl">Public guides for study, tests, coaching, and exam updates</CardTitle>
                <CardDescription className="max-w-3xl text-base text-slate-200/80 md:text-lg">
                  These pages explain the real platform experience in simple terms so students, parents, teachers, and institutes can understand what DCAM offers.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {publicEntryPoints.map((entry) => {
                  const Icon = entry.icon;

                  return (
                    <Link
                      key={entry.href}
                      href={entry.href}
                      className="group rounded-[26px] border border-cyan-300/14 bg-cyan-400/[0.04] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-300/35 hover:bg-cyan-400/[0.08] hover:shadow-[0_18px_34px_-24px_rgba(34,211,238,0.85)]"
                    >
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-500/10 text-cyan-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="mt-4 text-lg font-semibold text-white">{entry.title}</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-200/78">{entry.description}</p>
                      <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-100">
                        Read more
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </section>

          <section className="mt-12">
            <Card className="relative overflow-hidden rounded-[34px] border-cyan-300/14 bg-[linear-gradient(135deg,rgba(8,145,178,0.16),rgba(6,78,59,0.18),rgba(10,18,30,0.96)_60%)] text-white shadow-[0_34px_110px_-62px_rgba(34,211,238,0.7)] backdrop-blur-xl">
              <div className="absolute -left-16 top-10 h-36 w-36 rounded-full bg-cyan-300/12 blur-3xl" />
              <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-emerald-300/10 blur-3xl" />
              <CardContent className="relative flex flex-col items-start justify-between gap-6 p-6 sm:p-7 lg:flex-row lg:items-center">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                    Start On DCAM
                  </div>
                  <h3 className="mt-4 text-3xl font-semibold text-white">Ready to learn or teach on DCAM Classes?</h3>
                  <p className="mt-3 text-slate-200/78">
                    Create your account to start exam preparation as a student or launch your programs as a teacher on one professional platform.
                  </p>
                </div>
                <div className="w-full max-w-md lg:w-auto">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button asChild className={`flex-1 sm:flex-none ${primaryCtaClass}`}>
                      <Link href="/signup">
                        Get Started
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="secondary" className={`flex-1 sm:flex-none ${secondaryCtaClass}`}>
                      <Link href="/login">
                        Login
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="mt-5 flex justify-center">
            <a
              href={playStoreLink}
              target="_blank"
              rel="noreferrer"
              className="group flex w-full max-w-sm items-center justify-between gap-4 rounded-[26px] border border-white/12 bg-[linear-gradient(135deg,rgba(6,10,18,0.98),rgba(12,24,40,0.96))] px-5 py-4 text-left shadow-[0_26px_65px_-38px_rgba(0,0,0,0.85)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/45 hover:shadow-[0_30px_72px_-34px_rgba(34,211,238,0.4)]"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-2.5">
                  <GooglePlayGlyph />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55">Get it on</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-white">Google Play</p>
                </div>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/80 transition-all duration-200 group-hover:border-cyan-300/45 group-hover:text-cyan-200">
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </a>
          </section>

        </div>
      </div>
    </main>
  );
}
