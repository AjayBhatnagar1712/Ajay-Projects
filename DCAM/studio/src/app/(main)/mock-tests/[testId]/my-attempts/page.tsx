'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, doc, documentId, getDocs, orderBy, query, where } from 'firebase/firestore';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import DashboardHeader from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';

type MockTest = {
  id: string;
  title?: string;
  examTypeId?: string;
  classId?: string;
  config?: {
    questionIds?: string[];
    marksPerQuestion?: number;
    negativeMarksPerQuestion?: number;
  };
};

type PurchasedRecord = {
  id?: string;
  testId?: string;
  purchasedAt?: string;
};

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string };
type Subject = { id: string; name: string };

type QuestionMeta = {
  id: string;
  subjectId?: string;
  questionType?: 'MCQ' | 'Numerical' | 'Text';
  correctAnswer?: string;
  numericalAnswer?: number;
  textAnswer?: string;
};

type UserTestResult = {
  id: string;
  testId?: string;
  score?: number;
  timeTaken?: number;
  answers?: Record<string, unknown>;
  questionTimes?: Record<string, number>;
  submittedAt?: { toDate?: () => Date } | Date | string;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function normalizeAnswer(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function isAttempted(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  return String(value).trim() !== '';
}

function isAnswerCorrect(question: QuestionMeta, answer: unknown): boolean {
  if (!isAttempted(answer)) return false;
  if (question.questionType === 'Numerical') return Number(question.numericalAnswer) === Number(answer);
  if (question.questionType === 'Text') return normalizeAnswer(question.textAnswer) === normalizeAnswer(answer);
  return normalizeAnswer(question.correctAnswer) === normalizeAnswer(answer);
}

export default function StudentMyAttemptsPage() {
  const { testId } = useParams() as { testId: string };
  const firestore = useFirestore();
  const { user } = useUser();
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const testDocRef = useMemoFirebase(() => (firestore && testId ? doc(firestore, 'mock_tests', testId) : null), [firestore, testId]);
  const purchasedDocRef = useMemoFirebase(
    () => (firestore && user?.uid && testId ? doc(firestore, 'users', user.uid, 'purchased_mock_tests', testId) : null),
    [firestore, user?.uid, testId]
  );
  const resultsQ = useMemoFirebase(
    () => (firestore && user?.uid && testId ? query(collection(firestore, 'users', user.uid, 'test_results'), where('testId', '==', testId)) : null),
    [firestore, user?.uid, testId]
  );
  const subjectsQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null), [firestore]);
  const examTypesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null), [firestore]);
  const classesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null), [firestore]);

  const { data: test, isLoading: testLoading } = useDoc<MockTest>(testDocRef);
  const { data: purchased, isLoading: purchasedLoading } = useDoc<PurchasedRecord>(purchasedDocRef);
  const { data: results, isLoading: resultsLoading } = useCollection<UserTestResult>(resultsQ);
  const { data: subjects } = useCollection<Subject>(subjectsQ);
  const { data: examTypes } = useCollection<ExamType>(examTypesQ);
  const { data: classes } = useCollection<ClassItem>(classesQ);

  const subjectNameById = useMemo(() => Object.fromEntries((subjects || []).map((s) => [s.id, s.name])), [subjects]);
  const examNameById = useMemo(() => Object.fromEntries((examTypes || []).map((e) => [e.id, e.name])), [examTypes]);
  const classNameById = useMemo(() => Object.fromEntries((classes || []).map((c) => [c.id, c.name])), [classes]);

  const attempts = useMemo(() => {
    return (results || [])
      .map((item, index) => ({
        key: item.id || `${index}`,
        score: Number(item.score || 0),
        timeTaken: Number(item.timeTaken || 0),
        answers: (item.answers || {}) as Record<string, unknown>,
        questionTimes: (item.questionTimes || {}) as Record<string, number>,
        submittedAt: toDate(item.submittedAt),
      }))
      .sort((a, b) => (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0));
  }, [results]);

  const attemptStats = useMemo(() => {
    if (attempts.length === 0) {
      return { bestScore: 0, avgScore: 0, bestTime: 0 };
    }
    const bestScore = Math.max(...attempts.map((a) => a.score));
    const avgScore = Math.round((attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length) * 100) / 100;
    const validTimes = attempts.map((a) => a.timeTaken || 0).filter((n) => Number.isFinite(n));
    const bestTime = validTimes.length > 0 ? Math.min(...validTimes) : 0;
    return { bestScore, avgScore, bestTime };
  }, [attempts]);

  const loading = testLoading || purchasedLoading || resultsLoading;
  const canView = !!user?.uid && !!purchased;

  const buildQuestionMeta = async () => {
    const questionIds = test?.config?.questionIds || [];
    const metaById: Record<string, QuestionMeta> = {};
    for (let i = 0; i < questionIds.length; i += 30) {
      const chunk = questionIds.slice(i, i + 30);
      const qRef = query(collection(firestore, 'practice_questions'), where(documentId(), 'in', chunk));
      const qSnap = await getDocs(qRef);
      qSnap.forEach((docSnap) => {
        metaById[docSnap.id] = { ...(docSnap.data() as QuestionMeta), id: docSnap.id };
      });
    }
    return metaById;
  };

  const calculateSummary = (attempt: (typeof attempts)[number], questionMetaById: Record<string, QuestionMeta>) => {
    const questionIds = test?.config?.questionIds || [];
    let attempted = 0;
    let correct = 0;
    let incorrect = 0;
    questionIds.forEach((qid) => {
      const ans = attempt.answers[qid];
      if (!isAttempted(ans)) return;
      attempted += 1;
      const meta = questionMetaById[qid];
      if (meta && isAnswerCorrect(meta, ans)) correct += 1;
      else incorrect += 1;
    });
    const unattempted = Math.max(0, questionIds.length - attempted);
    return { attempted, correct, incorrect, unattempted };
  };

  const handleDownloadAttemptPdf = async (attempt: (typeof attempts)[number], index: number) => {
    if (!firestore || !test) return;
    setDownloadingKey(attempt.key);
    try {
      const questionIds = test.config?.questionIds || [];
      const questionMetaById = await buildQuestionMeta();
      const marksPerQuestion = Number(test.config?.marksPerQuestion || 4);
      const negativeMarks = Number(test.config?.negativeMarksPerQuestion || 1);
      const maxMarks = questionIds.length * marksPerQuestion;
      const summary = calculateSummary(attempt, questionMetaById);

      const pdf = new jsPDF('p', 'mm', 'a4');
      let y = 16;
      const writeLine = (text: string, gap = 7) => {
        if (y > 282) {
          pdf.addPage();
          y = 16;
        }
        pdf.text(text, 14, y);
        y += gap;
      };

      pdf.setFontSize(18);
      writeLine('Student Attempt Report', 9);
      pdf.setFontSize(12);
      writeLine(`Test: ${test.title || 'Untitled Mock Test'}`);
      writeLine(`Student: ${user?.displayName || user?.email || 'Student'}`);
      writeLine(`Attempt #: ${attempts.length - index}`);
      writeLine(`Submitted At: ${attempt.submittedAt ? format(attempt.submittedAt, 'PPP p') : 'N/A'}`);
      writeLine(`Exam: ${test.examTypeId ? (examNameById[test.examTypeId] || test.examTypeId) : 'N/A'}`);
      writeLine(`Curriculum: ${test.classId ? (classNameById[test.classId] || test.classId) : 'N/A'}`);
      writeLine(`Score: ${attempt.score} / ${maxMarks}`);
      writeLine(`Time Taken: ${attempt.timeTaken} min`);
      writeLine(`Correct: ${summary.correct} | Incorrect: ${summary.incorrect} | Unattempted: ${summary.unattempted}`);
      writeLine(`Marking: +${marksPerQuestion}, -${negativeMarks}`);

      y += 2;
      pdf.setFontSize(13);
      writeLine('Question-wise Analytics', 8);
      pdf.setFontSize(10);

      questionIds.forEach((qid, qIndex) => {
        const ans = attempt.answers[qid];
        const meta = questionMetaById[qid];
        const subject = meta?.subjectId ? (subjectNameById[meta.subjectId] || meta.subjectId) : 'N/A';
        const status = !isAttempted(ans) ? 'Unattempted' : (meta && isAnswerCorrect(meta, ans) ? 'Correct' : 'Incorrect');
        const timePerQuestion = attempt.questionTimes?.[qid];
        const timeLabel = Number.isFinite(Number(timePerQuestion)) ? `${Number(timePerQuestion)} sec` : 'N/A';
        writeLine(`Q${qIndex + 1}: ${status} | Subject: ${subject} | Time: ${timeLabel}`, 6);
      });

      if (!Object.keys(attempt.questionTimes || {}).length) {
        writeLine('Note: Time-per-question data is not available for this attempt.', 6);
      }

      const safeStudent = (user?.displayName || user?.email || 'student').replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`my-attempt-${testId}-${safeStudent}-${attempts.length - index}.pdf`);
    } finally {
      setDownloadingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="My Attempt History" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-4">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </main>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="My Attempt History" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card><CardContent className="p-6 text-muted-foreground">Add this test to My Practice first to view your attempt history.</CardContent></Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="My Attempt History" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <Card className="border-border/60 bg-gradient-to-r from-slate-900 via-slate-900/95 to-blue-950/80 shadow-2xl">
            <CardHeader>
              <CardTitle>{test?.title || 'Mock Test'}</CardTitle>
              <CardDescription>Total Attempts: {attempts.length}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-sky-200">Best Score</p>
                  <p className="mt-1 text-lg font-semibold">{attemptStats.bestScore}</p>
                </div>
                <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-indigo-200">Average Score</p>
                  <p className="mt-1 text-lg font-semibold">{attemptStats.avgScore}</p>
                </div>
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-200">Best Time</p>
                  <p className="mt-1 text-lg font-semibold">{attemptStats.bestTime} min</p>
                </div>
              </div>
              <Button asChild variant="outline" className="rounded-full border-slate-600/80 bg-slate-900/70 hover:bg-slate-800/80">
                <Link href={`/mock-tests/${testId}`}>Back to Test Details</Link>
              </Button>
            </CardContent>
          </Card>

          {attempts.length === 0 ? (
            <Card><CardContent className="p-6 text-muted-foreground">No attempts yet. Start the test to generate attempt history.</CardContent></Card>
          ) : (
            <Card className="border-border/70 bg-gradient-to-b from-slate-900/85 to-slate-950/70 shadow-xl">
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/80 text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Attempt</th>
                        <th className="px-3 py-2 font-medium">Submitted At</th>
                        <th className="px-3 py-2 font-medium">Marks</th>
                        <th className="px-3 py-2 font-medium">Time</th>
                        <th className="px-3 py-2 font-medium">Report</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attempts.map((attempt, index) => (
                        <tr key={attempt.key} className="border-b border-slate-800/70 hover:bg-slate-900/60">
                          <td className="px-3 py-2"><span className="rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 font-medium">#{attempts.length - index}</span></td>
                          <td className="px-3 py-2">{attempt.submittedAt ? format(attempt.submittedAt, 'PPP p') : 'N/A'}</td>
                          <td className="px-3 py-2"><span className="font-semibold text-sky-300">{attempt.score}</span></td>
                          <td className="px-3 py-2"><span className="font-medium text-emerald-300">{attempt.timeTaken} min</span></td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-full border-slate-600/80 bg-slate-900/70 hover:bg-slate-800/80"
                              disabled={downloadingKey === attempt.key}
                              onClick={() => handleDownloadAttemptPdf(attempt, index)}
                            >
                              {downloadingKey === attempt.key ? 'Generating...' : 'Download PDF'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
