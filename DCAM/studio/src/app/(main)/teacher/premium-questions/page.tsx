'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import DashboardHeader from '@/components/dashboard-header';
import TeacherDashboardPremiumQuestionHub from '@/components/teacher-dashboard-premium-question-hub';
import { Button } from '@/components/ui/button';

export default function TeacherPremiumQuestionsPage() {
  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Premium Questions" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-card/60 p-5 md:flex-row md:items-center md:justify-between">
            <p className="max-w-3xl text-sm text-muted-foreground">
              Choose a scope, review teacher pricing, enter the number of questions, students, and days, then continue to checkout for payment.
            </p>
            <Button asChild variant="outline" className="rounded-full border-white/10 bg-transparent px-5">
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>

          <TeacherDashboardPremiumQuestionHub />
        </div>
      </main>
    </div>
  );
}
