import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BellRing, GraduationCap, School, Sparkles } from 'lucide-react';
import JsonLd from '@/components/json-ld';
import { Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleAuthHandler } from '@/components/auth/google-auth-handler';
import {
  buildOrganizationStructuredData,
  buildPageMetadata,
  buildWebPageStructuredData,
} from '@/lib/site-metadata';

const title = 'Signup | DCAM Classes';
const description = 'Choose your DCAM Classes account type and sign up to start courses, practice, mock tests, and exam preparation.';

export const metadata: Metadata = buildPageMetadata({
  title,
  description,
  path: '/signup',
  keywords: [
    'dcam classes signup',
    'student signup',
    'teacher signup',
    'online coaching signup',
    'exam preparation signup',
  ],
});

export default function SignupChoicePage() {
  const roleButtonClass =
    'group h-auto w-full justify-start overflow-hidden whitespace-normal rounded-2xl border border-white/15 bg-white/5 px-3 py-4 text-left text-white transition-all hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-500/10 sm:px-4';
  const secondaryRoleButtonClass =
    'group h-auto w-full justify-start overflow-hidden whitespace-normal rounded-2xl border border-white/15 bg-white/5 px-3 py-4 text-left text-white transition-all hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-emerald-500/10 sm:px-4';
  const backButtonClass =
    'h-11 w-full rounded-xl border border-white/15 bg-white/5 text-slate-100 transition-all hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-cyan-500/10 hover:text-white';

  return (
    <>
      <JsonLd
        data={[
          buildOrganizationStructuredData(),
          buildWebPageStructuredData({
            title,
            description,
            path: '/signup',
          }),
        ]}
      />
      <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.2),_transparent_55%),_linear-gradient(180deg,_#0b0f14_0%,_#0f141b_45%,_#111822_100%)] text-white">
        <div className="relative overflow-hidden">
          <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="absolute top-40 -right-24 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-sky-400/15 blur-3xl" />

          <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1fr_1.05fr]">
            <div className="hidden rounded-3xl border border-cyan-300/20 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur lg:block">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-1 text-sm text-cyan-100">
                <Sparkles className="h-4 w-4" />
                Start with the right role
              </p>
              <h1 className="text-4xl font-semibold leading-tight text-white">Build your exam journey on DCAM Classes.</h1>
              <p className="mt-4 text-base text-slate-200/80">
                Choose Student to begin learning and practice. Choose Teacher to publish your content, tests, and live batches.
              </p>
              <div className="mt-6 space-y-3">
                <Link
                  href="/exam-bulletin"
                  className="flex items-center justify-between rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-amber-100 transition-all hover:border-amber-300/60 hover:bg-amber-400/20"
                >
                  <span className="inline-flex items-center gap-2 font-medium">
                    <BellRing className="h-4 w-4" />
                    Check Exam Bulletin
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200/80">
                  You can always switch workflows later from your dashboard.
                </div>
              </div>
            </div>

            <Card className="w-full max-w-2xl justify-self-center overflow-hidden rounded-3xl border-white/15 bg-[linear-gradient(165deg,rgba(255,255,255,0.18),rgba(255,255,255,0.07))] text-white shadow-2xl shadow-black/45 backdrop-blur-xl">
              <CardHeader className="px-4 pb-4 pt-6 text-center sm:px-6">
                <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                  <Logo className="h-9 w-9 text-cyan-300" />
                  <span className="break-words font-headline text-2xl font-semibold tracking-tight sm:text-3xl">
                    DCAM Classes
                  </span>
                </div>
                <CardTitle className="break-words text-2xl text-white sm:text-3xl">Choose Registration Role</CardTitle>
                <CardDescription className="text-sm text-slate-200/80 sm:text-base">
                  Select your role to continue setup.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-4 pb-6 sm:px-6">
                <Button asChild className={roleButtonClass}>
                  <Link
                    href="/student-registration"
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 sm:items-center sm:gap-4"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-400/15 text-cyan-200">
                      <GraduationCap className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block text-base font-semibold leading-tight">Student</span>
                      <span className="mt-1 block w-full max-w-full whitespace-normal break-words text-xs leading-relaxed text-slate-300">
                        Join classes, practice daily, and track progress.
                      </span>
                    </span>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 self-center text-cyan-200 transition-transform group-hover:translate-x-0.5 sm:mt-0" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" className={secondaryRoleButtonClass}>
                  <Link
                    href="/teacher-registration"
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 sm:items-center sm:gap-4"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/35 bg-emerald-400/15 text-emerald-200">
                      <School className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block text-base font-semibold leading-tight">Teacher</span>
                      <span className="mt-1 block w-full max-w-full whitespace-normal break-words text-xs leading-relaxed text-slate-300">
                        Create courses, tests, and guide student batches.
                      </span>
                    </span>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 self-center text-emerald-200 transition-transform group-hover:translate-x-0.5 sm:mt-0" />
                  </Link>
                </Button>
                <div className="pt-2">
                  <GoogleAuthHandler ctaMode="signup" />
                </div>
                <Button asChild variant="ghost" className={backButtonClass}>
                  <Link href="/">
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
