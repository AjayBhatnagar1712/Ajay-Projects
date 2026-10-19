'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, doc, documentId, getDocs, orderBy, query, where } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import { getLiveBatchTestReportsVisibleAfter } from '@/lib/live-batch-test-access';

type MockTest = {
  id: string;
  title?: string;
  teacherId?: string;
  examTypeId?: string;
  classId?: string;
  isLiveBatchTest?: boolean;
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledEndTime?: string;
  accessStartTime?: string;
  accessEndTime?: string;
  startTime?: { toDate?: () => Date } | Date | string;
  accessWindowEndAt?: { toDate?: () => Date } | Date | string;
  accessWindowStartAt?: { toDate?: () => Date } | Date | string;
  config?: {
    questionIds?: string[];
    marksPerQuestion?: number;
    negativeMarksPerQuestion?: number;
  };
};

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string };
type Subject = { id: string; name: string };

type AttemptHistoryItem = {
  studentId?: string;
  studentName?: string;
  score?: number;
  timeTaken?: number;
  attemptedQuestions?: number;
  correctQuestions?: number;
  incorrectQuestions?: number;
  answers?: Record<string, unknown>;
  questionTimes?: Record<string, number>;
  submittedAt?: { toDate?: () => Date } | Date | string;
};

type TestAnalytics = {
  attemptHistory?: AttemptHistoryItem[];
};

type QuestionMeta = {
  id: string;
  subjectId?: string;
  questionType?: 'MCQ' | 'Numerical' | 'Text';
  correctAnswer?: string;
  numericalAnswer?: number;
  textAnswer?: string;
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

export default function MockTestAttemptHistoryPage() {
  const { testId } = useParams() as { testId: string };
  const firestore = useFirestore();
  const { user } = useUser();
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const testDocRef = useMemoFirebase(() => (firestore && testId ? doc(firestore, 'mock_tests', testId) : null), [firestore, testId]);
  const analyticsDocRef = useMemoFirebase(() => (firestore && testId ? doc(firestore, 'test_analytics', testId) : null), [firestore, testId]);
  const subjectsQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null), [firestore]);
  const examTypesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null), [firestore]);
  const classesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null), [firestore]);

  const { data: test, isLoading: testLoading } = useDoc<MockTest>(testDocRef);
  const { data: analytics, isLoading: analyticsLoading } = useDoc<TestAnalytics>(analyticsDocRef);
  const { data: subjects } = useCollection<Subject>(subjectsQ);
  const { data: examTypes } = useCollection<ExamType>(examTypesQ);
  const { data: classes } = useCollection<ClassItem>(classesQ);

  const subjectNameById = useMemo(() => Object.fromEntries((subjects || []).map((s) => [s.id, s.name])), [subjects]);
  const examNameById = useMemo(() => Object.fromEntries((examTypes || []).map((e) => [e.id, e.name])), [examTypes]);
  const classNameById = useMemo(() => Object.fromEntries((classes || []).map((c) => [c.id, c.name])), [classes]);

  const attempts = useMemo(() => {
    const source = Array.isArray(analytics?.attemptHistory) ? analytics.attemptHistory : [];
    return source
      .map((item, index) => ({
        key: `${item.studentId || item.studentName || 'student'}-${index}`,
        studentId: item.studentId || '',
        studentName: item.studentName || 'Student',
        score: Number(item.score || 0),
        timeTaken: Number(item.timeTaken || 0),
        attemptedQuestions: Number(item.attemptedQuestions || 0),
        correctQuestions: Number(item.correctQuestions || 0),
        incorrectQuestions: Number(item.incorrectQuestions || 0),
        answers: (item.answers || {}) as Record<string, unknown>,
        questionTimes: (item.questionTimes || {}) as Record<string, number>,
        submittedAt: toDate(item.submittedAt),
      }))
      .sort((a, b) => (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0));
  }, [analytics?.attemptHistory]);

  const byStudent = useMemo(() => {
    const groups = new Map<string, { studentName: string; attempts: typeof attempts; bestScore: number }>();
    attempts.forEach((item) => {
      const key = item.studentId || item.studentName;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { studentName: item.studentName, attempts: [item], bestScore: item.score });
      } else {
        existing.attempts.push(item);
        existing.bestScore = Math.max(existing.bestScore, item.score);
      }
    });
    return Array.from(groups.values()).sort((a, b) => b.bestScore - a.bestScore);
  }, [attempts]);

  const isTeacherOwner = isTeacher && !!user?.uid && !!test?.teacherId && user.uid === test.teacherId;
  const reportsVisibleAfter = useMemo(() => getLiveBatchTestReportsVisibleAfter(test), [test]);
  const reportsLockedUntilEnd =
    Boolean(test?.isLiveBatchTest && reportsVisibleAfter && new Date().getTime() < reportsVisibleAfter.getTime());
  const canView = isTeacherOwner && !reportsLockedUntilEnd;
  const loading = isTeacherLoading || testLoading || analyticsLoading;

  const handleDownloadAttemptPdf = async (attempt: (typeof attempts)[number]) => {
    if (!firestore || !test) return;
    setDownloadingKey(attempt.key);
    try {
      const questionIds = test.config?.questionIds || [];
      const questionMetaById: Record<string, QuestionMeta> = {};
      for (let i = 0; i < questionIds.length; i += 30) {
        const chunk = questionIds.slice(i, i + 30);
        const qRef = query(collection(firestore, 'practice_questions'), where(documentId(), 'in', chunk));
        const qSnap = await getDocs(qRef);
        qSnap.forEach((docSnap) => {
          questionMetaById[docSnap.id] = { ...(docSnap.data() as QuestionMeta), id: docSnap.id };
        });
      }

      const marksPerQuestion = Number(test.config?.marksPerQuestion || 4);
      const negativeMarks = Number(test.config?.negativeMarksPerQuestion || 1);
      let attemptedCount = 0;
      let correctCount = 0;
      let incorrectCount = 0;

      questionIds.forEach((qid) => {
        const answer = attempt.answers[qid];
        if (!isAttempted(answer)) return;
        attemptedCount += 1;
        const meta = questionMetaById[qid];
        if (meta && isAnswerCorrect(meta, answer)) correctCount += 1;
        else incorrectCount += 1;
      });

      const unattemptedCount = Math.max(0, questionIds.length - attemptedCount);
      const maxMarks = questionIds.length * marksPerQuestion;

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
      writeLine('Mock Test Attempt Report', 9);
      pdf.setFontSize(12);
      writeLine(`Test: ${test.title || 'Untitled Mock Test'}`);
      writeLine(`Student: ${attempt.studentName}`);
      writeLine(`Attempt Date: ${attempt.submittedAt ? format(attempt.submittedAt, 'PPP p') : 'N/A'}`);
      writeLine(`Exam: ${test.examTypeId ? (examNameById[test.examTypeId] || test.examTypeId) : 'N/A'}`);
      writeLine(`Curriculum: ${test.classId ? (classNameById[test.classId] || test.classId) : 'N/A'}`);
      writeLine(`Score: ${attempt.score} / ${maxMarks}`);
      writeLine(`Time Taken: ${attempt.timeTaken} min`);
      writeLine(`Questions: ${questionIds.length}`);
      writeLine(`Correct: ${correctCount} | Incorrect: ${incorrectCount} | Unattempted: ${unattemptedCount}`);
      writeLine(`Marking: +${marksPerQuestion}, -${negativeMarks}`);
      y += 2;
      pdf.setFontSize(13);
      writeLine('Question-wise Analytics', 8);
      pdf.setFontSize(10);

      questionIds.forEach((qid, index) => {
        const answer = attempt.answers[qid];
        const meta = questionMetaById[qid];
        const subject = meta?.subjectId ? (subjectNameById[meta.subjectId] || meta.subjectId) : 'N/A';
        const status = !isAttempted(answer) ? 'Unattempted' : (meta && isAnswerCorrect(meta, answer) ? 'Correct' : 'Incorrect');
        const timePerQuestion = attempt.questionTimes?.[qid];
        const timeLabel = Number.isFinite(Number(timePerQuestion)) ? `${Number(timePerQuestion)} sec` : 'N/A';
        writeLine(`Q${index + 1}: ${status} | Subject: ${subject} | Time: ${timeLabel}`, 6);
      });

      if (!Object.keys(attempt.questionTimes || {}).length) {
        writeLine('Note: Time-per-question data is not available for this attempt.', 6);
      }

      const safeStudent = attempt.studentName.replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`mock-test-${testId}-attempt-${safeStudent}.pdf`);
    } finally {
      setDownloadingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Attempt History" />
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
        <DashboardHeader title="Attempt History" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card>
            <CardContent className="p-6 text-muted-foreground">
              {isTeacherOwner && reportsLockedUntilEnd && reportsVisibleAfter
                ? `Reports will be available after the test window closes on ${format(reportsVisibleAfter, 'PPP p')}.`
                : 'Only the test author can view attempt history.'}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Attempt History" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Card className="border-border/60 bg-gradient-to-r from-slate-900 via-slate-900/95 to-blue-950/80 shadow-xl">
            <CardHeader>
              <CardTitle>{test?.title || 'Mock Test'}</CardTitle>
              <CardDescription>
                Students: {byStudent.length} | Attempts: {attempts.length}
              </CardDescription>
            </CardHeader>
          </Card>

          {byStudent.length === 0 ? (
            <Card><CardContent className="p-6 text-muted-foreground">No attempts available yet.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {byStudent.map((student, idx) => (
                <Card key={`${student.studentName}-${idx}`}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl">{student.studentName}</CardTitle>
                        <CardDescription>Attempts: {student.attempts.length}</CardDescription>
                      </div>
                      <Badge variant="secondary">Best Score: {student.bestScore}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="px-3 py-2 font-medium">Attempt</th>
                            <th className="px-3 py-2 font-medium">Submitted At</th>
                            <th className="px-3 py-2 font-medium">Marks</th>
                            <th className="px-3 py-2 font-medium">Time</th>
                            <th className="px-3 py-2 font-medium">Correct</th>
                            <th className="px-3 py-2 font-medium">Incorrect</th>
                            <th className="px-3 py-2 font-medium">Report</th>
                          </tr>
                        </thead>
                        <tbody>
                          {student.attempts.map((attempt, attemptIndex) => (
                            <tr key={attempt.key} className="border-b border-border/60">
                              <td className="px-3 py-2">#{student.attempts.length - attemptIndex}</td>
                              <td className="px-3 py-2">{attempt.submittedAt ? format(attempt.submittedAt, 'PPP p') : 'N/A'}</td>
                              <td className="px-3 py-2">{attempt.score}</td>
                              <td className="px-3 py-2">{attempt.timeTaken} min</td>
                              <td className="px-3 py-2">{attempt.correctQuestions}</td>
                              <td className="px-3 py-2">{attempt.incorrectQuestions}</td>
                              <td className="px-3 py-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={downloadingKey === attempt.key}
                                  onClick={() => handleDownloadAttemptPdf(attempt)}
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
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
