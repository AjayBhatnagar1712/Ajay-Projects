import {
  buildPracticeQuestionScopeEntries,
  type PracticeQuestionScopeEntry,
  type PracticeQuestionScopeSource,
} from '@/lib/practice-question-scope';
import { normalizeSubtopicValue, splitSubtopicPath } from '@/lib/subtopic-paths';
import {
  getTeacherQuestionPurchaseResolvedDaysCount,
  type DifficultyLevel,
  type TeacherQuestionPurchaseCheckoutPayload,
  type TeacherQuestionPurchaseDoc,
  isTeacherQuestionPurchaseActiveAt,
} from '@/lib/teacher-question-purchase';

export type TeacherPurchasedQuestionCategory = 'regular' | 'pyq';
export type TeacherQuestionTypeSelection = 'All' | 'MCQ' | 'Numerical' | 'Text';
export type TeacherDifficultySelection = 'All' | DifficultyLevel;

export type TeacherPremiumQuestionRow<TQuestion extends PracticeQuestionScopeSource = PracticeQuestionScopeSource> = {
  id: string;
  question: TQuestion;
  teacherId: string;
  questionType: 'MCQ' | 'Numerical' | 'Text';
  difficultyLevel: DifficultyLevel;
  category: TeacherPurchasedQuestionCategory;
  entries: PracticeQuestionScopeEntry<TQuestion>[];
};

export type TeacherPremiumQuestionRowFilter = {
  teacherId?: string;
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  topicId?: string;
  subtopicPaths?: string[];
  legacySubtopic?: string;
  accessLevel?: 'free' | 'paid';
  questionType?: TeacherQuestionTypeSelection;
  difficultyLevel?: TeacherDifficultySelection;
};

export type TeacherPremiumQuestionAvailability<TQuestion extends PracticeQuestionScopeSource = PracticeQuestionScopeSource> = {
  rows: TeacherPremiumQuestionRow<TQuestion>[];
  matchingPurchases: TeacherQuestionPurchaseDoc[];
  activeMatchingPurchases: TeacherQuestionPurchaseDoc[];
  eligiblePurchases: TeacherQuestionPurchaseDoc[];
  selectableRows: TeacherPremiumQuestionRow<TQuestion>[];
  hasAnyMatchingPurchase: boolean;
  hasExpiredMatchingPurchase: boolean;
  hasStudentCoverageGap: boolean;
};

const PURCHASE_BUCKETS: Array<[TeacherPurchasedQuestionCategory, DifficultyLevel]> = [
  ['regular', 'Easy'],
  ['pyq', 'Easy'],
];

const normalizePathSegments = (segments: string[]) =>
  segments
    .map((segment) => String(segment || '').trim())
    .filter(Boolean);

const parseSubtopicPathSelection = (value?: string) =>
  normalizePathSegments(splitSubtopicPath(String(value || '')));

const getSubtopicPathKey = (segments: string[]) =>
  normalizePathSegments(segments)
    .map((segment) => normalizeSubtopicValue(segment))
    .filter(Boolean)
    .join('>');

const pathStartsWith = (path: string[], prefix: string[]) => {
  const normalizedPath = normalizePathSegments(path);
  const normalizedPrefix = normalizePathSegments(prefix);
  if (normalizedPrefix.length === 0) return true;
  if (normalizedPath.length < normalizedPrefix.length) return false;
  return normalizedPrefix.every(
    (segment, index) => normalizeSubtopicValue(normalizedPath[index]) === normalizeSubtopicValue(segment)
  );
};

export const normalizeTeacherQuestionPurchaseScopePath = (value?: string) =>
  parseSubtopicPathSelection(value).join(' > ');

export const normalizeTeacherQuestionPurchaseScopeSelections = (
  subtopicPaths?: string[],
  legacySubtopic?: string
) => {
  const unique = new Map<string, string>();
  [...(Array.isArray(subtopicPaths) ? subtopicPaths : []), ...(legacySubtopic ? [legacySubtopic] : [])]
    .map((value) => parseSubtopicPathSelection(value))
    .filter((segments) => segments.length > 0)
    .forEach((segments) => {
      const key = getSubtopicPathKey(segments);
      if (!key || unique.has(key)) return;
      unique.set(key, segments.join(' > '));
    });
  return Array.from(unique.values()).sort((left, right) => left.localeCompare(right));
};

const matchesSubtopicSelections = (entrySubtopics: string[], selectedSubtopicPaths: string[]) => {
  if (selectedSubtopicPaths.length === 0) return true;
  if (!Array.isArray(entrySubtopics) || entrySubtopics.length === 0) return false;

  const parsedSelections = selectedSubtopicPaths
    .map((value) => parseSubtopicPathSelection(value))
    .filter((segments) => segments.length > 0);
  if (parsedSelections.length === 0) return true;

  return parsedSelections.some((selectionPath) =>
    entrySubtopics.some((subtopicPath) => pathStartsWith(parseSubtopicPathSelection(subtopicPath), selectionPath))
  );
};

const matchesRowFilterEntry = (
  entry: PracticeQuestionScopeEntry,
  filter: TeacherPremiumQuestionRowFilter
) => {
  if (filter.teacherId && entry.teacherId !== filter.teacherId) return false;
  if (filter.examTypeId && entry.examTypeId !== filter.examTypeId) return false;
  if (filter.classId && entry.classId !== filter.classId) return false;
  if (filter.subjectId && entry.subjectId !== filter.subjectId) return false;
  if (filter.topicId && entry.topicId !== filter.topicId) return false;
  if (filter.accessLevel && entry.accessLevel !== filter.accessLevel) return false;
  if (filter.questionType && filter.questionType !== 'All' && entry.questionType !== filter.questionType) return false;
  

  const normalizedSubtopicSelections = normalizeTeacherQuestionPurchaseScopeSelections(
    filter.subtopicPaths,
    filter.legacySubtopic
  );
  if (!matchesSubtopicSelections(entry.subtopics || [], normalizedSubtopicSelections)) return false;
  return true;
};

export const buildTeacherPremiumQuestionRows = <
  TQuestion extends PracticeQuestionScopeSource = PracticeQuestionScopeSource,
>(
  entries: PracticeQuestionScopeEntry<TQuestion>[],
  filter: TeacherPremiumQuestionRowFilter = {}
) => {
  const rowsById = new Map<string, TeacherPremiumQuestionRow<TQuestion>>();

  entries.forEach((entry) => {
    if (!matchesRowFilterEntry(entry, filter)) return;

    const existing = rowsById.get(entry.sourceQuestionId);
    if (existing) {
      if (!existing.entries.some((candidate) => candidate.entryId === entry.entryId)) {
        existing.entries.push(entry);
      }
      return;
    }

    rowsById.set(entry.sourceQuestionId, {
      id: entry.sourceQuestionId,
      question: entry.sourceQuestion,
      teacherId: entry.teacherId,
      questionType: entry.questionType,
      difficultyLevel: 'Easy' as const,
      category: entry.isPreviousYear ? 'pyq' : 'regular',
      entries: [entry],
    });
  });

  return Array.from(rowsById.values());
};

export const buildTeacherPremiumQuestionRowsFromQuestions = <
  TQuestion extends PracticeQuestionScopeSource = PracticeQuestionScopeSource,
>(
  questions: TQuestion[],
  filter: TeacherPremiumQuestionRowFilter = {}
) => buildTeacherPremiumQuestionRows(
  (questions || []).flatMap((question) => buildPracticeQuestionScopeEntries(question)),
  filter
);

export const getTeacherPurchaseQuotaForBucket = (
  purchase: TeacherQuestionPurchaseDoc,
  category: TeacherPurchasedQuestionCategory,
  difficulty: DifficultyLevel
) => {
  const counts = category === 'pyq' ? purchase.pyqCounts : purchase.regularCounts;
  // Existing purchases retain their full quantity after the difficulty buckets merge.
  return difficulty === 'Easy'
    ? ['Easy', 'Medium', 'Hard'].reduce((sum, level) => sum + Math.max(0, Number(counts?.[level as DifficultyLevel] || 0)), 0)
    : 0;
};

export const teacherPurchaseMatchesScope = (
  purchase: Pick<
    TeacherQuestionPurchaseCheckoutPayload,
    'examTypeId' | 'classId' | 'subjectId' | 'topicId' | 'subtopicPath'
  >,
  scope: Pick<
    TeacherQuestionPurchaseCheckoutPayload,
    'examTypeId' | 'classId' | 'subjectId' | 'topicId' | 'subtopicPath'
  >
) => {
  if (purchase.examTypeId !== scope.examTypeId) return false;
  if (purchase.classId !== scope.classId) return false;
  if (purchase.subjectId !== scope.subjectId) return false;
  if (String(purchase.topicId || '').trim() !== String(scope.topicId || '').trim()) return false;
  return normalizeTeacherQuestionPurchaseScopePath(purchase.subtopicPath) === normalizeTeacherQuestionPurchaseScopePath(scope.subtopicPath);
};

export const buildTeacherQuestionPurchaseRenewParams = (purchase: TeacherQuestionPurchaseDoc) => ({
  examTypeId: purchase.examTypeId,
  examTypeName: purchase.examTypeName,
  classId: purchase.classId,
  className: purchase.className,
  subjectId: purchase.subjectId,
  subjectName: purchase.subjectName,
  topicId: purchase.topicId || '',
  topicName: purchase.topicName || '',
  subtopicPath: purchase.subtopicPath || '',
  subtopicLabel: purchase.subtopicLabel || '',
  regularCounts: purchase.regularCounts,
  pyqCounts: purchase.pyqCounts,
  studentsCount: purchase.studentsCount,
  daysCount: getTeacherQuestionPurchaseResolvedDaysCount(purchase),
});

export const purchaseCoversTeacherPremiumRow = (
  purchase: TeacherQuestionPurchaseDoc,
  row: TeacherPremiumQuestionRow
) => {
  const purchaseSubtopicPath = parseSubtopicPathSelection(String(purchase.subtopicPath || '').trim());

  return row.entries.some((entry) => {
    if (entry.accessLevel !== 'paid') return false;
    if (purchase.teacherId && entry.teacherId && purchase.teacherId !== entry.teacherId) return false;
    if (entry.examTypeId !== purchase.examTypeId) return false;
    if (entry.classId !== purchase.classId) return false;
    if (entry.subjectId !== purchase.subjectId) return false;
    if (purchase.topicId && entry.topicId !== purchase.topicId) return false;
    if (purchaseSubtopicPath.length === 0) return true;
    return (entry.subtopics || []).some((subtopicPath) =>
      pathStartsWith(parseSubtopicPathSelection(subtopicPath), purchaseSubtopicPath)
    );
  });
};

export const allocateTeacherPremiumQuestionRows = <
  TQuestion extends PracticeQuestionScopeSource = PracticeQuestionScopeSource,
>(
  rows: TeacherPremiumQuestionRow<TQuestion>[],
  purchases: TeacherQuestionPurchaseDoc[],
  options?: { randomize?: boolean }
) => {
  const allocatedRows: TeacherPremiumQuestionRow<TQuestion>[] = [];
  const randomize = !!options?.randomize;

  PURCHASE_BUCKETS.forEach(([category, difficulty]) => {
    const bucketRows = rows.filter(
      (row) => row.category === category && row.difficultyLevel === difficulty
    );
    if (bucketRows.length === 0) return;

    const bucketPurchases = purchases
      .map((purchase) => ({
        purchase,
        remaining: getTeacherPurchaseQuotaForBucket(purchase, category, difficulty),
      }))
      .filter((entry) => entry.remaining > 0);
    if (bucketPurchases.length === 0) return;

    const rowCoverage = bucketRows
      .map((row) => {
        const coveringPurchaseIds = bucketPurchases
          .filter(({ purchase }) => purchaseCoversTeacherPremiumRow(purchase, row))
          .map(({ purchase }) => purchase.id);
        return {
          row,
          coveringPurchaseIds,
          sortSeed: randomize ? Math.random() : 0,
        };
      })
      .filter((entry) => entry.coveringPurchaseIds.length > 0);
    if (rowCoverage.length === 0) return;

    const coverageCountByPurchaseId = new Map<string, number>();
    rowCoverage.forEach((entry) => {
      entry.coveringPurchaseIds.forEach((purchaseId) => {
        coverageCountByPurchaseId.set(purchaseId, (coverageCountByPurchaseId.get(purchaseId) || 0) + 1);
      });
    });

    const remainingByPurchaseId = new Map<string, number>(
      bucketPurchases.map(({ purchase, remaining }) => [purchase.id, remaining])
    );

    rowCoverage
      .sort((left, right) => {
        if (left.coveringPurchaseIds.length !== right.coveringPurchaseIds.length) {
          return left.coveringPurchaseIds.length - right.coveringPurchaseIds.length;
        }
        if (randomize && left.sortSeed !== right.sortSeed) {
          return left.sortSeed - right.sortSeed;
        }
        return left.row.id.localeCompare(right.row.id);
      })
      .forEach((entry) => {
        const availablePurchaseIds = entry.coveringPurchaseIds
          .filter((purchaseId) => (remainingByPurchaseId.get(purchaseId) || 0) > 0)
          .sort((left, right) => {
            const leftCoverage = coverageCountByPurchaseId.get(left) || 0;
            const rightCoverage = coverageCountByPurchaseId.get(right) || 0;
            if (leftCoverage !== rightCoverage) return leftCoverage - rightCoverage;

            const leftRemaining = remainingByPurchaseId.get(left) || 0;
            const rightRemaining = remainingByPurchaseId.get(right) || 0;
            if (leftRemaining !== rightRemaining) return leftRemaining - rightRemaining;

            return left.localeCompare(right);
          });

        const selectedPurchaseId = availablePurchaseIds[0];
        if (!selectedPurchaseId) return;

        remainingByPurchaseId.set(
          selectedPurchaseId,
          Math.max(0, (remainingByPurchaseId.get(selectedPurchaseId) || 0) - 1)
        );
        allocatedRows.push(entry.row);
      });
  });

  return allocatedRows;
};

export const resolveTeacherPremiumQuestionAvailability = <
  TQuestion extends PracticeQuestionScopeSource = PracticeQuestionScopeSource,
>({
  rows,
  purchases,
  minimumStudentsRequired = 1,
  randomize = false,
  referenceTime = new Date(),
}: {
  rows: TeacherPremiumQuestionRow<TQuestion>[];
  purchases: TeacherQuestionPurchaseDoc[];
  minimumStudentsRequired?: number;
  randomize?: boolean;
  referenceTime?: Date;
}): TeacherPremiumQuestionAvailability<TQuestion> => {
  const matchingPurchases = (purchases || []).filter((purchase) => {
    if ((purchase.status || 'paid') !== 'paid') return false;
    return rows.some((row) => purchaseCoversTeacherPremiumRow(purchase, row));
  });
  const activeMatchingPurchases = matchingPurchases.filter((purchase) => isTeacherQuestionPurchaseActiveAt(purchase, referenceTime));
  const eligiblePurchases = activeMatchingPurchases.filter(
    (purchase) => Math.max(1, Number(purchase.studentsCount || 1)) >= Math.max(1, minimumStudentsRequired)
  );

  return {
    rows,
    matchingPurchases,
    activeMatchingPurchases,
    eligiblePurchases,
    selectableRows: allocateTeacherPremiumQuestionRows(rows, eligiblePurchases, { randomize }),
    hasAnyMatchingPurchase: matchingPurchases.length > 0,
    hasExpiredMatchingPurchase: matchingPurchases.some((purchase) => !isTeacherQuestionPurchaseActiveAt(purchase, referenceTime)),
    hasStudentCoverageGap:
      minimumStudentsRequired > 0
      && activeMatchingPurchases.length > 0
      && eligiblePurchases.length === 0,
  };
};
