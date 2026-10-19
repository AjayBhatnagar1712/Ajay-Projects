import Link from 'next/link';
import { ArrowRight, CheckCircle2, GraduationCap, School, Sparkles } from 'lucide-react';
import { Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Feature = {
  title: string;
  description: string;
};

type AudienceBlock = {
  title: string;
  description: string;
  points: string[];
};

type FaqItem = {
  question: string;
  answer: string;
};

type RelatedLink = {
  href: string;
  label: string;
  description: string;
};

type CtaLink = {
  href: string;
  label: string;
  tone?: 'primary' | 'secondary' | 'outline';
};

type PublicMarketingPageProps = {
  badge: string;
  title: string;
  description: string;
  highlights: string[];
  featuresTitle: string;
  featuresDescription: string;
  features: Feature[];
  audiences: AudienceBlock[];
  faqs: FaqItem[];
  headerActions?: CtaLink[];
  primaryCta: CtaLink;
  secondaryCta: CtaLink;
  tertiaryCta?: CtaLink;
  footerActions?: CtaLink[];
  relatedLinks: RelatedLink[];
};

export default function PublicMarketingPage({
  badge,
  title,
  description,
  highlights,
  featuresTitle,
  featuresDescription,
  features,
  audiences,
  faqs,
  headerActions,
  primaryCta,
  secondaryCta,
  tertiaryCta,
  footerActions,
  relatedLinks,
}: PublicMarketingPageProps) {
  const resolvedHeaderActions = headerActions && headerActions.length > 0
    ? headerActions
    : [
        { href: '/login', label: 'Login', tone: 'outline' as const },
        { href: '/signup', label: 'Signup', tone: 'primary' as const },
      ];
  const heroActions = [primaryCta, secondaryCta, tertiaryCta].filter((action): action is CtaLink => !!action);
  const resolvedFooterActions = footerActions && footerActions.length > 0 ? footerActions : heroActions;

  const getHeaderButtonClassName = (tone: CtaLink['tone']) => {
    switch (tone) {
      case 'primary':
        return 'h-11 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-4 font-semibold text-slate-950 hover:brightness-110';
      case 'secondary':
        return 'h-11 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 text-cyan-100 hover:border-cyan-200/55 hover:bg-cyan-400/16';
      case 'outline':
      default:
        return 'h-11 rounded-2xl border border-white/15 bg-white/[0.05] px-4 text-slate-100 hover:border-cyan-300/55 hover:bg-cyan-500/10';
    }
  };

  const getSectionButtonClassName = (tone: CtaLink['tone']) => {
    switch (tone) {
      case 'primary':
        return 'h-12 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-5 font-semibold text-slate-950 hover:brightness-110';
      case 'secondary':
        return 'h-12 rounded-2xl border border-cyan-300/28 bg-cyan-400/10 px-5 font-semibold text-cyan-50 hover:border-cyan-200/55 hover:bg-cyan-400/16';
      case 'outline':
      default:
        return 'h-12 rounded-2xl border border-white/20 bg-white/[0.08] px-5 font-semibold text-white hover:border-cyan-300/55 hover:bg-cyan-500/10';
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.2),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.14),_transparent_20%),linear-gradient(180deg,_#04101b_0%,_#081827_44%,_#08131f_100%)] text-white">
      <div className="relative overflow-hidden">
        <div className="absolute -top-40 left-[-7rem] h-[28rem] w-[28rem] rounded-full bg-cyan-400/14 blur-3xl" />
        <div className="absolute top-24 right-[-6rem] h-[24rem] w-[24rem] rounded-full bg-blue-400/12 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(56,189,248,0.08)_1px,transparent_1px)] [background-size:26px_26px] opacity-15" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 md:pt-10">
          <header className="rounded-[30px] border border-cyan-300/12 bg-[linear-gradient(135deg,rgba(7,46,67,0.72),rgba(8,19,31,0.92))] px-5 py-4 shadow-[0_30px_90px_-48px_rgba(34,211,238,0.7)] backdrop-blur-xl sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/" className="flex min-w-0 items-center gap-4">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/8">
                  <Logo className="h-9 w-9 text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <p className="font-headline text-3xl font-semibold leading-none tracking-tight text-white">DCAM Classes</p>
                  <p className="mt-1 text-sm text-slate-300">Online exam preparation and coaching platform</p>
                </div>
              </Link>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                {resolvedHeaderActions.map((action) => (
                  <Button
                    key={`${action.href}_${action.label}`}
                    asChild
                    variant="ghost"
                    className={cn('w-full sm:w-auto', getHeaderButtonClassName(action.tone))}
                  >
                    <Link href={action.href}>{action.label}</Link>
                  </Button>
                ))}
              </div>
            </div>
          </header>

          <section className="mt-10">
            <Card className="rounded-[34px] border-white/10 bg-[linear-gradient(155deg,rgba(11,22,37,0.98),rgba(10,44,59,0.78)_45%,rgba(9,15,25,0.98))] text-white shadow-[0_38px_120px_-62px_rgba(15,118,110,0.9)] backdrop-blur-xl">
              <CardHeader className="border-b border-white/8 pb-6">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                  <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                  {badge}
                </div>
                <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight md:text-5xl">{title}</h1>
                <CardDescription className="max-w-3xl text-base leading-relaxed text-slate-200/80 md:text-lg">
                  {description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="grid gap-3 md:grid-cols-3">
                  {highlights.map((highlight) => (
                    <div
                      key={highlight}
                      className="flex items-start gap-3 rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.04] px-4 py-4"
                    >
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                      <p className="text-sm leading-relaxed text-slate-100">{highlight}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {heroActions.map((action) => (
                    <Button
                      key={`${action.href}_${action.label}`}
                      asChild
                      variant={action.tone === 'primary' ? 'default' : 'secondary'}
                      className={getSectionButtonClassName(action.tone)}
                    >
                      <Link href={action.href}>
                        {action.label}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="rounded-[30px] border-cyan-300/18 bg-[linear-gradient(180deg,rgba(10,22,35,0.98),rgba(14,32,46,0.96)_40%,rgba(10,18,30,0.98)_100%)] text-white">
              <CardHeader>
                <CardTitle className="text-3xl">{featuresTitle}</CardTitle>
                <CardDescription className="text-base text-slate-200/78">{featuresDescription}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.03] px-4 py-4"
                  >
                    <p className="text-lg font-semibold text-white">{feature.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-200/78">{feature.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[30px] border-amber-300/24 bg-[linear-gradient(180deg,rgba(251,191,36,0.16),rgba(15,23,42,0.92))] text-white">
              <CardHeader>
                <CardTitle className="text-3xl">Explore More</CardTitle>
                <CardDescription className="text-base text-amber-100/85">
                  These public pages help students, parents, teachers, and institutes understand the full learning ecosystem on DCAM.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {relatedLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-2xl border border-amber-300/24 bg-black/15 px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-amber-200/45"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-semibold text-white">{item.label}</p>
                      <ArrowRight className="h-4 w-4 text-amber-200" />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-amber-100/80">{item.description}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="mt-12 grid gap-6 lg:grid-cols-2">
            {audiences.map((audience, index) => {
              const isStudent = index === 0;
              const Icon = isStudent ? GraduationCap : School;
              const accentBorder = isStudent ? 'border-cyan-300/20' : 'border-emerald-300/20';
              const accentBackground = isStudent
                ? 'bg-[linear-gradient(180deg,rgba(6,182,212,0.16),rgba(15,23,42,0.48))]'
                : 'bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(15,23,42,0.48))]';
              const iconClasses = isStudent
                ? 'border-cyan-300/30 bg-cyan-500/10 text-cyan-200'
                : 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200';
              const checkClasses = isStudent ? 'text-cyan-300' : 'text-emerald-300';

              return (
                <Card key={audience.title} className={`rounded-[30px] ${accentBorder} ${accentBackground} text-white`}>
                  <CardHeader>
                    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${iconClasses}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-3xl">{audience.title}</CardTitle>
                    <CardDescription className="text-base text-slate-200/80">{audience.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {audience.points.map((point) => (
                      <div
                        key={point}
                        className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3.5"
                      >
                        <CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${checkClasses}`} />
                        <p className="text-sm leading-relaxed text-slate-100">{point}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <section className="mt-12">
            <Card className="rounded-[30px] border-white/10 bg-[linear-gradient(180deg,rgba(12,18,32,0.98),rgba(17,24,39,0.95))] text-white">
              <CardHeader>
                <CardTitle className="text-3xl">Frequently Asked Questions</CardTitle>
                <CardDescription className="text-base text-slate-200/78">
                  Clear question-and-answer content helps visitors understand the platform more accurately before they choose what to explore next.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {faqs.map((item) => (
                  <div key={item.question} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                    <p className="text-lg font-semibold text-white">{item.question}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-200/78">{item.answer}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="mt-12">
            <Card className="rounded-[34px] border-cyan-300/14 bg-[linear-gradient(135deg,rgba(8,145,178,0.16),rgba(6,78,59,0.18),rgba(10,18,30,0.96)_60%)] text-white">
              <CardContent className="flex flex-col gap-6 p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                    Start On DCAM
                  </div>
                  <h2 className="mt-4 text-3xl font-semibold text-white">Ready to study, teach, or launch your exam workflow?</h2>
                  <p className="mt-3 text-slate-200/78">
                    Join DCAM Classes to access structured courses, live batches, mock tests, practice sessions, and coaching delivery tools in one place.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {resolvedFooterActions.map((action) => (
                    <Button
                      key={`${action.href}_${action.label}`}
                      asChild
                      variant={action.tone === 'primary' ? 'default' : 'secondary'}
                      className={getSectionButtonClassName(action.tone)}
                    >
                      <Link href={action.href}>
                        {action.label}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
