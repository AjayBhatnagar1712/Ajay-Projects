'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, query, type Firestore } from 'firebase/firestore';
import { fetchPracticeQuestionDocsByIds, readQuerySnapshotResilient } from '@/lib/exam-question-loader';
import {
  buildTeacherPremiumQuestionRowsFromQuestions,
  resolveTeacherPremiumQuestionAvailability,
} from '@/lib/teacher-premium-question-access';
import type { TeacherQuestionPurchaseDoc } from '@/lib/teacher-question-purchase';

type TestQuestionAccessLevel = 'free' | 'paid';

type TeacherPremiumQuestionProtectedTestSection = {
  questionAccessLevel?: TestQuestionAccessLevel | null;
};

type TeacherPremiumQuestionProtectedTestConfig = {
  questionIds?: string[] | null;
  subjectConfigs?: TeacherPremiumQuestionProtectedTestSection[] | null;
};

export type TeacherPremiumQuestionProtectedTest = {
  id: string;
  teacherId?: string | null;
  accessLevel?: TestQuestionAccessLevel | null;
  questionAccessLevel?: TestQuestionAccessLevel | null;
  config?: TeacherPremiumQuestionProtectedTestConfig | null;
};

type PremiumPracticeQuestionDocLike = {
  id: string;
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  topicId?: string;
  subtopics?: string[];
  accessLevel?: 'free' | 'paid';
  difficultyLevel?: 'Easy' | 'Medium' | 'Hard';
  questionType?: 'MCQ' | 'Numerical' | 'Text';
  teacherId?: string;
  alignments?: Array<{
    examTypeId?: string;
    classId?: string;
    subjectId?: string;
    difficultyLevel?: 'Easy' | 'Medium' | 'Hard';
  }>;
  isPreviousYear?: boolean;
};

export type TeacherPremiumQuestionTestAccessState = {
  testId: string;
  isProtected: boolean;
  isAccessible: boolean;
  requiredPaidQuestionCount: number;
  coveredPaidQuestionCount: number;
  minimumStudentsRequired: number;
  hasAnyMatchingPurchase: boolean;
  hasExpiredMatchingPurchase: boolean;
  hasStudentCoverageGap: boolean;
  missingQuestionIdsCount: number;
};

const normalizeQuestionIds = (value: unknown) =>
  Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  ));

const normalizeMinimumStudentsRequired = (value: unknown) =>
  Math.max(1, Math.floor(Number(value) || 1));

const testDeclaresPaidQuestionAccess = (test: TeacherPremiumQuestionProtectedTest) =>
  (test.questionAccessLevel || test.accessLevel) === 'paid'
  || (Array.isArray(test.config?.subjectConfigs)
    && test.config!.subjectConfigs!.some((section) => section?.questionAccessLevel === 'paid'));

const buildTeacherPremiumQuestionFallbackAccessState = (
  test: TeacherPremiumQuestionProtectedTest,
  minimumStudentsRequired: number
): TeacherPremiumQuestionTestAccessState => ({
  testId: test.id,
  isProtected: testDeclaresPaidQuestionAccess(test),
  isAccessible: !testDeclaresPaidQuestionAccess(test),
  requiredPaidQuestionCount: 0,
  coveredPaidQuestionCount: 0,
  minimumStudentsRequired,
  hasAnyMatchingPurchase: false,
  hasExpiredMatchingPurchase: false,
  hasStudentCoverageGap: false,
  missingQuestionIdsCount: 0,
});

const buildTeacherPremiumQuestionFallbackAccessMap = (
  tests: TeacherPremiumQuestionProtectedTest[],
  minimumStudentsRequiredByTestId: Record<string, number>
) =>
  Object.fromEntries(
    tests.map((test) => [
      test.id,
      buildTeacherPremiumQuestionFallbackAccessState(
        test,
        normalizeMinimumStudentsRequired(minimumStudentsRequiredByTestId[test.id])
      ),
    ])
  ) as Record<string, TeacherPremiumQuestionTestAccessState>;

const buildTeacherPremiumQuestionTestSignature = (
  tests: TeacherPremiumQuestionProtectedTest[],
  minimumStudentsRequiredByTestId: Record<string, number>,
  referenceTimeByTestId: Record<string, Date | null | undefined>
) =>
  tests
    .map((test) => {
      const questionIds = normalizeQuestionIds(test.config?.questionIds);
      const sectionAccessLevels = (Array.isArray(test.config?.subjectConfigs) ? test.config?.subjectConfigs : [])
        .map((section) => String(section?.questionAccessLevel || ''))
        .join(',');
      const referenceTime = referenceTimeByTestId[test.id];
      return [
        test.id,
        String(test.teacherId || ''),
        String(test.accessLevel || ''),
        String(test.questionAccessLevel || ''),
        sectionAccessLevels,
        questionIds.join(','),
        String(normalizeMinimumStudentsRequired(minimumStudentsRequiredByTestId[test.id])),
        referenceTime instanceof Date && !Number.isNaN(referenceTime.getTime()) ? referenceTime.toISOString() : '',
      ].join('|');
    })
    .join('||');

export async function resolveTeacherPremiumQuestionAccessMap(
  firestore: Firestore,
  tests: TeacherPremiumQuestionProtectedTest[],
  minimumStudentsRequiredByTestId: Record<string, number> = {},
  referenceTimeByTestId: Record<string, Date | null | undefined> = {}
): Promise<Record<string, TeacherPremiumQuestionTestAccessState>> {
  const normalizedTests = (tests || []).filter((test): test is TeacherPremiumQuestionProtectedTest =>
    !!test && typeof test === 'object' && typeof test.id === 'string' && test.id.trim().length > 0
  );
  if (normalizedTests.length === 0) return {};

  const allQuestionIds = Array.from(new Set(
    normalizedTests.flatMap((test) => normalizeQuestionIds(test.config?.questionIds))
  ));

  const questionDocs = await fetchPracticeQuestionDocsByIds(
    firestore,
    allQuestionIds,
    'teacher premium question test access'
  );
  const questionById = new Map<string, PremiumPracticeQuestionDocLike>();
  questionDocs.forEach((entry) => {
    questionById.set(entry.id, {
      id: entry.id,
      ...(entry.data as Record<string, unknown>),
    } as PremiumPracticeQuestionDocLike);
  });

  const teacherIds = Array.from(new Set(
    normalizedTests
      .map((test) => String(test.teacherId || '').trim())
      .filter(Boolean)
  ));

  const purchasesByTeacherId = new Map<string, TeacherQuestionPurchaseDoc[]>();
  await Promise.all(teacherIds.map(async (teacherId) => {
    const purchasesSnap = await readQuerySnapshotResilient(
      query(collection(firestore, 'users', teacherId, 'teacher_question_purchases')),
      `teacher question purchases ${teacherId}`
    );
    purchasesByTeacherId.set(
      teacherId,
      purchasesSnap.docs.map((docSnap) => ({ ...(docSnap.data() as TeacherQuestionPurchaseDoc), id: docSnap.id }))
    );
  }));

  return Object.fromEntries(
    normalizedTests.map((test) => {
      const minimumStudentsRequired = normalizeMinimumStudentsRequired(minimumStudentsRequiredByTestId[test.id]);
      const questionIds = normalizeQuestionIds(test.config?.questionIds);
      const resolvedQuestionDocs = questionIds
        .map((questionId) => questionById.get(questionId))
        .filter((question): question is PremiumPracticeQuestionDocLike => !!question);
      const missingQuestionIdsCount = Math.max(0, questionIds.length - resolvedQuestionDocs.length);
      const paidQuestions = resolvedQuestionDocs.filter((question) => question.accessLevel === 'paid');
      const paidRows = buildTeacherPremiumQuestionRowsFromQuestions(
        paidQuestions,
        { accessLevel: 'paid' }
      );
      const isProtected = paidRows.length > 0 || (missingQuestionIdsCount > 0 && testDeclaresPaidQuestionAccess(test));

      if (!isProtected) {
        return [
          test.id,
          {
            testId: test.id,
            isProtected: false,
            isAccessible: true,
            requiredPaidQuestionCount: 0,
            coveredPaidQuestionCount: 0,
            minimumStudentsRequired,
            hasAnyMatchingPurchase: false,
            hasExpiredMatchingPurchase: false,
            hasStudentCoverageGap: false,
            missingQuestionIdsCount,
          } satisfies TeacherPremiumQuestionTestAccessState,
        ];
      }

      const teacherId = String(test.teacherId || '').trim();
      const teacherPurchases = teacherId ? (purchasesByTeacherId.get(teacherId) || []) : [];
      const referenceTime = referenceTimeByTestId[test.id] instanceof Date
        && !Number.isNaN(referenceTimeByTestId[test.id]!.getTime())
        ? referenceTimeByTestId[test.id] as Date
        : new Date();
      const availability = resolveTeacherPremiumQuestionAvailability({
        rows: paidRows,
        purchases: teacherPurchases,
        minimumStudentsRequired,
        referenceTime,
      });
      const coveredPaidQuestionCount = availability.selectableRows.length;
      const requiredPaidQuestionCount = paidRows.length;

      return [
        test.id,
        {
          testId: test.id,
          isProtected: true,
          isAccessible: missingQuestionIdsCount === 0 && coveredPaidQuestionCount >= requiredPaidQuestionCount,
          requiredPaidQuestionCount,
          coveredPaidQuestionCount,
          minimumStudentsRequired,
          hasAnyMatchingPurchase: availability.hasAnyMatchingPurchase,
          hasExpiredMatchingPurchase: availability.hasExpiredMatchingPurchase,
          hasStudentCoverageGap: availability.hasStudentCoverageGap,
          missingQuestionIdsCount,
        } satisfies TeacherPremiumQuestionTestAccessState,
      ];
    })
  );
}

export const buildTeacherPremiumQuestionTestBlockedReason = (
  state?: TeacherPremiumQuestionTestAccessState | null
) => {
  if (!state?.isProtected || state.isAccessible) return '';
  if (state.missingQuestionIdsCount > 0) {
    return 'This test is unavailable because one or more linked paid questions are missing. Renew or rebuild the paid question scope to restore it.';
  }
  if (state.hasStudentCoverageGap) {
    return `This test is unavailable because the teacher's active paid question stock no longer covers ${state.minimumStudentsRequired} student${state.minimumStudentsRequired === 1 ? '' : 's'}. Buy the same scope again to increase the coverage.`;
  }
  if (state.hasExpiredMatchingPurchase) {
    return 'This test is unavailable because the teacher paid-question stock for this scope expired. Buy the same scope again to renew it.';
  }
  if (state.coveredPaidQuestionCount > 0 && state.coveredPaidQuestionCount < state.requiredPaidQuestionCount) {
    return `This test currently needs ${state.requiredPaidQuestionCount} paid questions, but only ${state.coveredPaidQuestionCount} are covered by the teacher's active stock. Buy the same scope again to restore the full test.`;
  }
  if (state.hasAnyMatchingPurchase) {
    return 'This test uses teacher premium questions that are no longer fully covered by the teacher\'s active stock.';
  }
  return 'This test uses teacher premium questions that are not currently available.';
};

export function useTeacherPremiumQuestionTestAccessMap(
  firestore: Firestore | null | undefined,
  tests: TeacherPremiumQuestionProtectedTest[],
  minimumStudentsRequiredByTestId: Record<string, number> = {},
  referenceTimeByTestId: Record<string, Date | null | undefined> = {}
) {
  const normalizedTests = useMemo(
    () => (tests || []).filter((test): test is TeacherPremiumQuestionProtectedTest =>
      !!test && typeof test === 'object' && typeof test.id === 'string' && test.id.trim().length > 0
    ),
    [tests]
  );
  const signature = useMemo(
    () => buildTeacherPremiumQuestionTestSignature(normalizedTests, minimumStudentsRequiredByTestId, referenceTimeByTestId),
    [minimumStudentsRequiredByTestId, normalizedTests, referenceTimeByTestId]
  );
  const fallbackMap = useMemo(
    () => buildTeacherPremiumQuestionFallbackAccessMap(normalizedTests, minimumStudentsRequiredByTestId),
    [minimumStudentsRequiredByTestId, normalizedTests]
  );
  const [accessMap, setAccessMap] = useState<Record<string, TeacherPremiumQuestionTestAccessState>>(fallbackMap);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!firestore || normalizedTests.length === 0) {
      setAccessMap(fallbackMap);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setAccessMap(fallbackMap);
    setIsLoading(true);

    void resolveTeacherPremiumQuestionAccessMap(firestore, normalizedTests, minimumStudentsRequiredByTestId, referenceTimeByTestId)
      .then((resolvedMap) => {
        if (cancelled) return;
        setAccessMap(resolvedMap);
      })
      .catch((error) => {
        console.error('Failed to resolve teacher premium question test access:', error);
        if (cancelled) return;
        setAccessMap(fallbackMap);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackMap, firestore, minimumStudentsRequiredByTestId, normalizedTests, referenceTimeByTestId, signature]);

  return { accessMap, isLoading };
}
