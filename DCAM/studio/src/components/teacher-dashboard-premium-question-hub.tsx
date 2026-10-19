'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { ArrowRight, LoaderCircle } from 'lucide-react';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { type DcamQuestionPricingProfile } from '@/lib/dcam-question-pricing';
import {
  buildPracticeQuestionScopeEntries,
  type PracticeQuestionScopeEntry,
  type PracticeQuestionScopeSource,
} from '@/lib/practice-question-scope';
import {
  buildPricingScopeKey,
  resolveScopedDifficultyPricing,
  type ResolvedDifficultyPricing,
  type ScopedDifficultyPricingMap,
} from '@/lib/premium-pricing';
import { extractSubtopicPaths, normalizeSubtopicValue, splitSubtopicPath } from '@/lib/subtopic-paths';
import {
  buildTeacherPremiumQuestionRows,
  resolveTeacherPremiumQuestionAvailability,
} from '@/lib/teacher-premium-question-access';
import {
  buildTeacherQuestionPurchaseCheckoutLink,
  type TeacherQuestionPurchaseCheckoutPayload,
  parseTeacherQuestionPurchaseCheckoutPayload,
  type TeacherQuestionPurchaseDoc,
} from '@/lib/teacher-question-purchase';
import { ALLOWED_TEACHER_AUTHOR_EMAIL, DCAM_QUESTION_BANK_LABEL } from '@/lib/teacher-authoring';

type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

type PricingOwnerProfile = DcamQuestionPricingProfile & {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  dcamTeacherQuestionPricingByScope?: ScopedDifficultyPricingMap;
};

type ExamType = {
  id: string;
  name?: string;
};

type ClassItem = {
  id: string;
  name?: string;
  examTypeId?: string;
};

type Subject = {
  id: string;
  name?: string;
  classId?: string;
};

type Topic = {
  id: string;
  name?: string;
  subjectId?: string;
};

type PracticeQuestion = PracticeQuestionScopeSource;

type QuestionInventorySummary = {
  standard: Record<DifficultyLevel, number>;
  pyq: Record<DifficultyLevel, number>;
};

type PurchaseRequestInputState = Record<DifficultyLevel, string>;

export type TeacherPremiumQuestionSelectionContext = {
  ownerId: string;
  ownerName: string;
  request: TeacherQuestionPurchaseCheckoutPayload;
  pricing: {
    regularPricing: ResolvedDifficultyPricing;
    pyqPricing: ResolvedDifficultyPricing;
    dailyRateAmount: number;
    totalAmount: number;
    totalQuestionCount: number;
    totalRegularQuestionCount: number;
    totalPyqQuestionCount: number;
  };
};

type TeacherDashboardPremiumQuestionHubProps = {
  purchaseLedgerUserId?: string;
  disableUrlPrefill?: boolean;
  prefillPayloadOverride?: TeacherQuestionPurchaseCheckoutPayload | null;
  lockScopeSelection?: boolean;
  primaryActionLabel?: string;
  primaryActionHelperText?: string;
  onPrimaryAction?: (context: TeacherPremiumQuestionSelectionContext) => Promise<void> | void;
  isPrimaryActionBusy?: boolean;
};

const DIFFICULTY_LEVELS: DifficultyLevel[] = ['Easy'];
const ALL_TOPICS_VALUE = '__all_topics__';
const ALL_SUBTOPICS_VALUE = '__all_subtopics__';

const createDifficultySetCounter = () => ({
  Easy: new Set<string>(),
  Medium: new Set<string>(),
  Hard: new Set<string>(),
});

const normalizeScopePath = (value?: string) => splitSubtopicPath(String(value || '')).join(' > ');

const formatSubtopicPath = (value?: string) => splitSubtopicPath(String(value || '')).join(' / ');

const matchesSelectedSubtopicPath = (subtopics: string[] | undefined, selectedPath: string) => {
  if (!selectedPath || selectedPath === ALL_SUBTOPICS_VALUE) return true;
  const target = splitSubtopicPath(selectedPath)
    .map((segment) => normalizeSubtopicValue(segment))
    .filter(Boolean);
  if (target.length === 0) return true;

  return extractSubtopicPaths(subtopics).some((path) => {
    if (path.length < target.length) return false;
    return target.every((segment, index) => normalizeSubtopicValue(path[index]) === segment);
  });
};

const getDifficultyPricingValue = (pricing: ResolvedDifficultyPricing, level: DifficultyLevel) => {
  const difficultyKey = level.toLowerCase() as keyof ResolvedDifficultyPricing;
  return Number(pricing[difficultyKey] || 0);
};

const RUPEE_SYMBOL = '\u20B9';
const formatRupeeAmount = (value: number) => `${RUPEE_SYMBOL}${value.toLocaleString('en-IN')}`;
const EMPTY_PURCHASE_REQUEST_INPUT: PurchaseRequestInputState = {
  Easy: '0',
  Medium: '0',
  Hard: '0',
};
const EMPTY_PURCHASE_REQUEST_COUNTS: Record<DifficultyLevel, number> = {
  Easy: 0,
  Medium: 0,
  Hard: 0,
};

const hasPositivePricing = (pricing: ResolvedDifficultyPricing) =>
  DIFFICULTY_LEVELS.some((level) => getDifficultyPricingValue(pricing, level) > 0);

const clampRequestedQuestionCount = (value: string, maxAvailable: number) => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return '0';
  return String(Math.min(parsed, Math.max(0, Math.floor(maxAvailable))));
};

const normalizeStudentPurchaseCount = (value: string) => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
};

const normalizePurchaseDayCount = (value: string) => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(parsed, 365);
};

const buildOwnerName = (owner?: PricingOwnerProfile | null) =>
  `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() || owner?.displayName || DCAM_QUESTION_BANK_LABEL;

const resolveRequestedQuestionCounts = (
  input: PurchaseRequestInputState,
  inventory: Record<DifficultyLevel, number>
) =>
  DIFFICULTY_LEVELS.reduce((acc, level) => {
    acc[level] = Number(clampRequestedQuestionCount(input[level], inventory[level]));
    return acc;
  }, { Easy: 0, Medium: 0, Hard: 0 } as Record<DifficultyLevel, number>);

const arePurchaseRequestInputsEqual = (
  left: PurchaseRequestInputState,
  right: PurchaseRequestInputState
) =>
  DIFFICULTY_LEVELS.every((level) => left[level] === right[level]);

function PricingComparisonTable({
  title,
  teacherPricing,
}: {
  title: string;
  teacherPricing: ResolvedDifficultyPricing;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/55">
      <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-semibold text-slate-50">{title}</p>
          <p className="text-xs text-muted-foreground">{RUPEE_SYMBOL} per question / day / student</p>
        </div>
        <Badge variant="outline" className="border-emerald-300/30 bg-emerald-500/10 text-emerald-100">
          For You
        </Badge>
      </div>

      <div className="grid gap-px bg-white/10 md:grid-cols-[0.8fr_1fr]">
        <div className="bg-slate-950/80 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Questions</div>
        <div className="bg-slate-950/80 px-4 py-3 text-sm font-medium text-emerald-100">For You</div>

        {DIFFICULTY_LEVELS.map((level) => (
          <div key={`${title}-${level}`} className="contents">
            <div className="bg-slate-950/65 px-4 py-4 text-sm font-semibold text-slate-200">
              Exam standard
            </div>
            <div className="bg-slate-950/45 px-4 py-4 text-lg font-semibold text-slate-50">
              {formatRupeeAmount(getDifficultyPricingValue(teacherPricing, level))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PurchaseRequestPanel({
  title,
  teacherPricing,
  inventory,
  input,
  onInputChange,
}: {
  title: string;
  teacherPricing: ResolvedDifficultyPricing;
  inventory: Record<DifficultyLevel, number>;
  input: PurchaseRequestInputState;
  onInputChange: (level: DifficultyLevel, value: string) => void;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-5">
      <div className="space-y-1">
        <p className="text-lg font-semibold text-slate-50">{title}</p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4">
        {DIFFICULTY_LEVELS.map((level) => {
          const availableCount = inventory[level];
          return (
            <div
              key={`${title}-${level}`}
              className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-100">Questions</p>
                <p className="text-xs text-muted-foreground">{availableCount} available</p>
              </div>
              <Input
                type="number"
                min={0}
                max={availableCount}
                step={1}
                value={input[level]}
                onChange={(event) => onInputChange(level, event.target.value)}
                disabled={availableCount === 0}
                className="mt-3 border-white/10 bg-slate-950/80"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {availableCount > 0
                  ? `Max ${availableCount}`
                  : 'Not available'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TeacherDashboardPremiumQuestionHub({
  purchaseLedgerUserId,
  disableUrlPrefill = false,
  prefillPayloadOverride = null,
  lockScopeSelection = false,
  primaryActionLabel = 'Continue to checkout',
  primaryActionHelperText = 'Continue to checkout to confirm your selection and complete the payment securely.',
  onPrimaryAction,
  isPrimaryActionBusy = false,
}: TeacherDashboardPremiumQuestionHubProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const [examTypeSelection, setExamTypeSelection] = useState('');
  const [classSelection, setClassSelection] = useState('');
  const [subjectSelection, setSubjectSelection] = useState('');
  const [topicSelection, setTopicSelection] = useState(ALL_TOPICS_VALUE);
  const [subtopicSelection, setSubtopicSelection] = useState(ALL_SUBTOPICS_VALUE);
  const [regularPurchaseInput, setRegularPurchaseInput] = useState<PurchaseRequestInputState>(EMPTY_PURCHASE_REQUEST_INPUT);
  const [pyqPurchaseInput, setPyqPurchaseInput] = useState<PurchaseRequestInputState>(EMPTY_PURCHASE_REQUEST_INPUT);
  const [studentCountInput, setStudentCountInput] = useState('1');
  const [purchaseDaysInput, setPurchaseDaysInput] = useState('30');
  const effectivePurchaseLedgerUserId = String(purchaseLedgerUserId || user?.uid || '').trim();
  const ownerQuery = useMemoFirebase(
    () => (
      firestore
        ? query(collection(firestore, 'users'), where('email', '==', ALLOWED_TEACHER_AUTHOR_EMAIL), limit(1))
        : null
    ),
    [firestore]
  );
  const examTypesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null),
    [firestore]
  );
  const classesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null),
    [firestore]
  );
  const subjectsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null),
    [firestore]
  );
  const topicsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'topics'), orderBy('name')) : null),
    [firestore]
  );

  const { data: ownerRowsRaw, isLoading: isOwnerLoading } = useCollection<PricingOwnerProfile>(ownerQuery);
  const owner = (ownerRowsRaw || [])[0] || null;

  const questionsQuery = useMemoFirebase(
    () => (
      firestore && owner?.id
        ? query(collection(firestore, 'practice_questions'), where('teacherId', '==', owner.id))
        : null
    ),
    [firestore, owner?.id]
  );
  const teacherPurchasesQuery = useMemoFirebase(
    () => (
      firestore && effectivePurchaseLedgerUserId
        ? query(collection(firestore, 'users', effectivePurchaseLedgerUserId, 'teacher_question_purchases'), orderBy('purchasedAt', 'desc'))
        : null
    ),
    [effectivePurchaseLedgerUserId, firestore]
  );

  const { data: examTypesRaw, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classesRaw, isLoading: areClassesLoading } = useCollection<ClassItem>(classesQuery);
  const { data: subjectsRaw, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: topicsRaw, isLoading: areTopicsLoading } = useCollection<Topic>(topicsQuery);
  const { data: ownerQuestionsRaw, isLoading: areQuestionsLoading } = useCollection<PracticeQuestion>(questionsQuery);
  const { data: teacherQuestionPurchasesData, isLoading: areTeacherQuestionPurchasesLoading } = useCollection<TeacherQuestionPurchaseDoc>(teacherPurchasesQuery);

  const examTypes = examTypesRaw || [];
  const classes = classesRaw || [];
  const subjects = subjectsRaw || [];
  const topics = topicsRaw || [];
  const ownerQuestions = ownerQuestionsRaw || [];

  const loading =
    isOwnerLoading
    || areExamTypesLoading
    || areClassesLoading
    || areSubjectsLoading
    || areTopicsLoading
    || (owner?.id ? areQuestionsLoading : false)
    || (effectivePurchaseLedgerUserId ? areTeacherQuestionPurchasesLoading : false);

  const prefillPayload = useMemo(
    () => prefillPayloadOverride || (disableUrlPrefill ? null : parseTeacherQuestionPurchaseCheckoutPayload(searchParams)),
    [disableUrlPrefill, prefillPayloadOverride, searchParams]
  );
  const isLockedScopeEditMode = Boolean(lockScopeSelection && prefillPayloadOverride);
  const minimumRegularPurchaseCounts = useMemo(
    () => (isLockedScopeEditMode
      ? {
          Easy: Number(prefillPayload?.regularCounts?.Easy || 0) + Number(prefillPayload?.regularCounts?.Medium || 0) + Number(prefillPayload?.regularCounts?.Hard || 0),
          Medium: 0,
          Hard: 0,
        }
      : EMPTY_PURCHASE_REQUEST_COUNTS),
    [isLockedScopeEditMode, prefillPayload]
  );
  const minimumPyqPurchaseCounts = useMemo(
    () => (isLockedScopeEditMode
      ? {
          Easy: Number(prefillPayload?.pyqCounts?.Easy || 0) + Number(prefillPayload?.pyqCounts?.Medium || 0) + Number(prefillPayload?.pyqCounts?.Hard || 0),
          Medium: 0,
          Hard: 0,
        }
      : EMPTY_PURCHASE_REQUEST_COUNTS),
    [isLockedScopeEditMode, prefillPayload]
  );
  const minimumStudentCount = useMemo(
    () => (isLockedScopeEditMode ? Number(prefillPayload?.studentsCount || 1) : 1),
    [isLockedScopeEditMode, prefillPayload]
  );
  const minimumPurchaseDays = useMemo(
    () => (isLockedScopeEditMode ? Number(prefillPayload?.daysCount || 1) : 1),
    [isLockedScopeEditMode, prefillPayload]
  );

  const paidQuestionEntries = useMemo<PracticeQuestionScopeEntry<PracticeQuestion>[]>(
    () =>
      ownerQuestions
        .flatMap((question) => buildPracticeQuestionScopeEntries(question))
        .filter((entry) => entry.accessLevel === 'paid' && !entry.mockTestOnly),
    [ownerQuestions]
  );

  const examTypeById = useMemo(
    () => new Map(examTypes.map((examType) => [examType.id, examType])),
    [examTypes]
  );
  const classById = useMemo(
    () => new Map(classes.map((classItem) => [classItem.id, classItem])),
    [classes]
  );
  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects]
  );
  const topicNameById = useMemo(
    () => Object.fromEntries(topics.map((topic) => [topic.id, topic.name || 'Untitled topic'])),
    [topics]
  );
  const examTypeNameById = useMemo(
    () => Object.fromEntries(examTypes.map((examType) => [examType.id, examType.name || 'Untitled exam'])),
    [examTypes]
  );
  const classNameById = useMemo(
    () => Object.fromEntries(classes.map((classItem) => [classItem.id, classItem.name || 'Untitled curriculum'])),
    [classes]
  );
  const subjectNameById = useMemo(
    () => Object.fromEntries(subjects.map((subject) => [subject.id, subject.name || 'Untitled subject'])),
    [subjects]
  );

  const availableExamTypes = useMemo(
    () => Array.from(new Set(paidQuestionEntries.map((entry) => entry.examTypeId)))
      .map((examTypeId) => examTypeById.get(examTypeId) || { id: examTypeId, name: examTypeNameById[examTypeId] || examTypeId })
      .sort((left, right) => (left.name || left.id).localeCompare(right.name || right.id)),
    [examTypeById, examTypeNameById, paidQuestionEntries]
  );
  const selectedExamTypeId = useMemo(() => {
    if (availableExamTypes.length === 0) return '';
    if (availableExamTypes.some((examType) => examType.id === examTypeSelection)) return examTypeSelection;
    return availableExamTypes[0].id;
  }, [availableExamTypes, examTypeSelection]);
  const availableClasses = useMemo(
    () => Array.from(
      new Set(
        paidQuestionEntries
          .filter((entry) => entry.examTypeId === selectedExamTypeId)
          .map((entry) => entry.classId)
      )
    )
      .map((classId) => classById.get(classId) || { id: classId, name: classNameById[classId] || classId, examTypeId: selectedExamTypeId })
      .sort((left, right) => (left.name || left.id).localeCompare(right.name || right.id)),
    [classById, classNameById, paidQuestionEntries, selectedExamTypeId]
  );
  const selectedClassId = useMemo(() => {
    if (availableClasses.length === 0) return '';
    if (availableClasses.some((classItem) => classItem.id === classSelection)) return classSelection;
    return availableClasses[0].id;
  }, [availableClasses, classSelection]);
  const availableSubjects = useMemo(
    () => Array.from(
      new Set(
        paidQuestionEntries
          .filter((entry) => entry.examTypeId === selectedExamTypeId && entry.classId === selectedClassId)
          .map((entry) => entry.subjectId)
      )
    )
      .map((subjectId) => subjectById.get(subjectId) || { id: subjectId, name: subjectNameById[subjectId] || subjectId, classId: selectedClassId })
      .sort((left, right) => (left.name || left.id).localeCompare(right.name || right.id)),
    [paidQuestionEntries, selectedClassId, selectedExamTypeId, subjectById, subjectNameById]
  );
  const selectedSubjectId = useMemo(() => {
    if (availableSubjects.length === 0) return '';
    if (availableSubjects.some((subject) => subject.id === subjectSelection)) return subjectSelection;
    return availableSubjects[0].id;
  }, [availableSubjects, subjectSelection]);

  const selectedScopeEntries = useMemo(
    () => paidQuestionEntries.filter((entry) =>
      entry.examTypeId === selectedExamTypeId
      && entry.classId === selectedClassId
      && entry.subjectId === selectedSubjectId
    ),
    [paidQuestionEntries, selectedClassId, selectedExamTypeId, selectedSubjectId]
  );

  const availableTopics = useMemo(
    () => Array.from(new Set(selectedScopeEntries.map((entry) => entry.topicId)))
      .map((topicId) => ({
        id: topicId,
        name: topicNameById[topicId] || 'Untitled topic',
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    [selectedScopeEntries, topicNameById]
  );
  const selectedTopicId = useMemo(() => {
    if (!selectedScopeEntries.length) return ALL_TOPICS_VALUE;
    if (topicSelection === ALL_TOPICS_VALUE) return topicSelection;
    if (availableTopics.some((topic) => topic.id === topicSelection)) return topicSelection;
    return ALL_TOPICS_VALUE;
  }, [availableTopics, selectedScopeEntries, topicSelection]);

  const topicFilteredEntries = useMemo(
    () => selectedScopeEntries.filter((entry) => selectedTopicId === ALL_TOPICS_VALUE || entry.topicId === selectedTopicId),
    [selectedScopeEntries, selectedTopicId]
  );

  const availableSubtopicPaths = useMemo(() => {
    const unique = new Map<string, string>();
    topicFilteredEntries.forEach((entry) => {
      extractSubtopicPaths(entry.subtopics).forEach((path) => {
        const normalizedPath = path.join(' > ');
        const key = path.map((segment) => normalizeSubtopicValue(segment)).join('>');
        if (!key || unique.has(key)) return;
        unique.set(key, normalizedPath);
      });
    });
    return Array.from(unique.values()).sort((left, right) => left.localeCompare(right));
  }, [topicFilteredEntries]);
  const selectedSubtopicPath = useMemo(() => {
    if (availableSubtopicPaths.length === 0) return ALL_SUBTOPICS_VALUE;
    if (subtopicSelection === ALL_SUBTOPICS_VALUE) return subtopicSelection;
    if (availableSubtopicPaths.includes(subtopicSelection)) return subtopicSelection;
    return ALL_SUBTOPICS_VALUE;
  }, [availableSubtopicPaths, subtopicSelection]);

  const visibleEntries = useMemo(
    () => topicFilteredEntries.filter((entry) => matchesSelectedSubtopicPath(entry.subtopics, selectedSubtopicPath)),
    [selectedSubtopicPath, topicFilteredEntries]
  );
  const selectedScopeRows = useMemo(
    () => buildTeacherPremiumQuestionRows(visibleEntries, { accessLevel: 'paid' }),
    [visibleEntries]
  );
  const selectedScopePurchaseAvailability = useMemo(
    () => resolveTeacherPremiumQuestionAvailability({
      rows: selectedScopeRows,
      purchases: teacherQuestionPurchasesData || [],
      minimumStudentsRequired: 1,
    }),
    [selectedScopeRows, teacherQuestionPurchasesData]
  );
  const currentReusableStockCount = selectedScopePurchaseAvailability.selectableRows.length;
  const activeMatchingPurchaseCount = selectedScopePurchaseAvailability.activeMatchingPurchases.length;
  const expiredMatchingPurchaseCount = selectedScopePurchaseAvailability.matchingPurchases.filter(
    (purchase) => !selectedScopePurchaseAvailability.activeMatchingPurchases.some((activePurchase) => activePurchase.id === purchase.id)
  ).length;
  const currentStockEndsAt = useMemo(() => {
    const activePurchases = selectedScopePurchaseAvailability.activeMatchingPurchases;
    if (activePurchases.length === 0) return '';
    return activePurchases
      .map((purchase) => String(purchase.accessEndsAt || '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))[0] || '';
  }, [selectedScopePurchaseAvailability.activeMatchingPurchases]);

  const questionInventorySummary = useMemo<QuestionInventorySummary>(() => {
    const standardSets = createDifficultySetCounter();
    const pyqSets = createDifficultySetCounter();

    visibleEntries.forEach((entry) => {
      const targetSets = entry.isPreviousYear ? pyqSets : standardSets;
      targetSets[entry.difficultyLevel].add(entry.sourceQuestionId);
    });

    return {
      standard: {
        Easy: standardSets.Easy.size,
        Medium: standardSets.Medium.size,
        Hard: standardSets.Hard.size,
      },
      pyq: {
        Easy: pyqSets.Easy.size,
        Medium: pyqSets.Medium.size,
        Hard: pyqSets.Hard.size,
      },
    };
  }, [visibleEntries]);

  const selectedQuestionCount = useMemo(
    () => new Set(visibleEntries.map((entry) => entry.sourceQuestionId)).size,
    [visibleEntries]
  );
  const selectedTopicCount = useMemo(
    () => new Set(visibleEntries.map((entry) => entry.topicId)).size,
    [visibleEntries]
  );
  const selectedBranchCount = useMemo(() => {
    const unique = new Set<string>();
    visibleEntries.forEach((entry) => {
      entry.subtopics.forEach((subtopicPath) => {
        const normalizedPath = normalizeScopePath(subtopicPath);
        if (normalizedPath) unique.add(normalizedPath.toLowerCase());
      });
    });
    return unique.size;
  }, [visibleEntries]);

  const teacherStandardPricing = useMemo(
    () => resolveScopedDifficultyPricing({
      scopedPricingMap: owner?.dcamTeacherQuestionPricingByScope,
      examTypeId: selectedExamTypeId,
      classId: selectedClassId,
      subjectId: selectedSubjectId,
      questionSource: 'standard',
    }),
    [owner?.dcamTeacherQuestionPricingByScope, selectedClassId, selectedExamTypeId, selectedSubjectId]
  );
  const teacherPyqPricing = useMemo(
    () => resolveScopedDifficultyPricing({
      scopedPricingMap: owner?.dcamTeacherQuestionPricingByScope,
      examTypeId: selectedExamTypeId,
      classId: selectedClassId,
      subjectId: selectedSubjectId,
      questionSource: 'pyq',
    }),
    [owner?.dcamTeacherQuestionPricingByScope, selectedClassId, selectedExamTypeId, selectedSubjectId]
  );
  const currentTeacherScopeKeyStandard = selectedExamTypeId && selectedClassId && selectedSubjectId
    ? buildPricingScopeKey(selectedExamTypeId, selectedClassId, selectedSubjectId, 'standard')
    : '';
  const currentTeacherScopeKeyPyq = selectedExamTypeId && selectedClassId && selectedSubjectId
    ? buildPricingScopeKey(selectedExamTypeId, selectedClassId, selectedSubjectId, 'pyq')
    : '';
  const hasTeacherPurchasePricing = Boolean(
    (currentTeacherScopeKeyStandard && owner?.dcamTeacherQuestionPricingByScope && currentTeacherScopeKeyStandard in owner.dcamTeacherQuestionPricingByScope)
    || (currentTeacherScopeKeyPyq && owner?.dcamTeacherQuestionPricingByScope && currentTeacherScopeKeyPyq in owner.dcamTeacherQuestionPricingByScope)
    || hasPositivePricing(teacherStandardPricing)
    || hasPositivePricing(teacherPyqPricing)
  );

  const selectedScopeLabel = [
    examTypeNameById[selectedExamTypeId],
    classNameById[selectedClassId],
    subjectNameById[selectedSubjectId],
  ].filter(Boolean).join(' / ');
  const selectedScopeDetailLabel = [
    selectedTopicId === ALL_TOPICS_VALUE ? 'All topics' : topicNameById[selectedTopicId],
    selectedSubtopicPath !== ALL_SUBTOPICS_VALUE ? formatSubtopicPath(selectedSubtopicPath) : '',
  ].filter(Boolean).join(' / ');

  useEffect(() => {
    if (!prefillPayload) return;
    setExamTypeSelection(prefillPayload.examTypeId);
    setClassSelection(prefillPayload.classId);
    setSubjectSelection(prefillPayload.subjectId);
    setTopicSelection(prefillPayload.topicId || ALL_TOPICS_VALUE);
    setSubtopicSelection(prefillPayload.subtopicPath || ALL_SUBTOPICS_VALUE);
    setRegularPurchaseInput({
      Easy: String((prefillPayload.regularCounts.Easy || 0) + (prefillPayload.regularCounts.Medium || 0) + (prefillPayload.regularCounts.Hard || 0)),
      Medium: '0',
      Hard: '0',
    });
    setPyqPurchaseInput({
      Easy: String((prefillPayload.pyqCounts.Easy || 0) + (prefillPayload.pyqCounts.Medium || 0) + (prefillPayload.pyqCounts.Hard || 0)),
      Medium: '0',
      Hard: '0',
    });
    setStudentCountInput(String(prefillPayload.studentsCount || 1));
    setPurchaseDaysInput(String(prefillPayload.daysCount || 1));
  }, [
    prefillPayload?.classId,
    prefillPayload?.daysCount,
    prefillPayload?.examTypeId,
    prefillPayload?.pyqCounts?.Easy,
    prefillPayload?.pyqCounts?.Hard,
    prefillPayload?.pyqCounts?.Medium,
    prefillPayload?.regularCounts?.Easy,
    prefillPayload?.regularCounts?.Hard,
    prefillPayload?.regularCounts?.Medium,
    prefillPayload?.studentsCount,
    prefillPayload?.subjectId,
    prefillPayload?.subtopicPath,
    prefillPayload?.topicId,
  ]);

  const effectiveQuestionInventorySummary = useMemo<QuestionInventorySummary>(() => ({
    standard: {
      Easy: Math.max(questionInventorySummary.standard.Easy, minimumRegularPurchaseCounts.Easy),
      Medium: Math.max(questionInventorySummary.standard.Medium, minimumRegularPurchaseCounts.Medium),
      Hard: Math.max(questionInventorySummary.standard.Hard, minimumRegularPurchaseCounts.Hard),
    },
    pyq: {
      Easy: Math.max(questionInventorySummary.pyq.Easy, minimumPyqPurchaseCounts.Easy),
      Medium: Math.max(questionInventorySummary.pyq.Medium, minimumPyqPurchaseCounts.Medium),
      Hard: Math.max(questionInventorySummary.pyq.Hard, minimumPyqPurchaseCounts.Hard),
    },
  }), [minimumPyqPurchaseCounts, minimumRegularPurchaseCounts, questionInventorySummary]);

  useEffect(() => {
    setRegularPurchaseInput((current) => {
      const next = {
        Easy: String(Math.max(
          minimumRegularPurchaseCounts.Easy,
          Number(clampRequestedQuestionCount(current.Easy, effectiveQuestionInventorySummary.standard.Easy))
        )),
        Medium: String(Math.max(
          minimumRegularPurchaseCounts.Medium,
          Number(clampRequestedQuestionCount(current.Medium, effectiveQuestionInventorySummary.standard.Medium))
        )),
        Hard: String(Math.max(
          minimumRegularPurchaseCounts.Hard,
          Number(clampRequestedQuestionCount(current.Hard, effectiveQuestionInventorySummary.standard.Hard))
        )),
      };
      return arePurchaseRequestInputsEqual(current, next) ? current : next;
    });
    setPyqPurchaseInput((current) => {
      const next = {
        Easy: String(Math.max(
          minimumPyqPurchaseCounts.Easy,
          Number(clampRequestedQuestionCount(current.Easy, effectiveQuestionInventorySummary.pyq.Easy))
        )),
        Medium: String(Math.max(
          minimumPyqPurchaseCounts.Medium,
          Number(clampRequestedQuestionCount(current.Medium, effectiveQuestionInventorySummary.pyq.Medium))
        )),
        Hard: String(Math.max(
          minimumPyqPurchaseCounts.Hard,
          Number(clampRequestedQuestionCount(current.Hard, effectiveQuestionInventorySummary.pyq.Hard))
        )),
      };
      return arePurchaseRequestInputsEqual(current, next) ? current : next;
    });
  }, [
    effectiveQuestionInventorySummary,
    minimumPyqPurchaseCounts,
    minimumRegularPurchaseCounts,
  ]);

  const resolvedRegularPurchaseCounts = useMemo(
    () => resolveRequestedQuestionCounts(regularPurchaseInput, effectiveQuestionInventorySummary.standard),
    [effectiveQuestionInventorySummary.standard, regularPurchaseInput]
  );
  const resolvedPyqPurchaseCounts = useMemo(
    () => resolveRequestedQuestionCounts(pyqPurchaseInput, effectiveQuestionInventorySummary.pyq),
    [effectiveQuestionInventorySummary.pyq, pyqPurchaseInput]
  );
  const totalRequestedQuestionCount = useMemo(
    () =>
      DIFFICULTY_LEVELS.reduce(
        (sum, level) => sum + resolvedRegularPurchaseCounts[level] + resolvedPyqPurchaseCounts[level],
        0
      ),
    [resolvedPyqPurchaseCounts, resolvedRegularPurchaseCounts]
  );
  const totalRequestedTeacherDailyRate = useMemo(
    () =>
      DIFFICULTY_LEVELS.reduce(
        (sum, level) =>
          sum
          + resolvedRegularPurchaseCounts[level] * getDifficultyPricingValue(teacherStandardPricing, level)
          + resolvedPyqPurchaseCounts[level] * getDifficultyPricingValue(teacherPyqPricing, level),
        0
      ),
    [resolvedPyqPurchaseCounts, resolvedRegularPurchaseCounts, teacherPyqPricing, teacherStandardPricing]
  );
  const normalizedStudentCount = useMemo(
    () => Math.max(minimumStudentCount, normalizeStudentPurchaseCount(studentCountInput)),
    [minimumStudentCount, studentCountInput]
  );
  const normalizedPurchaseDays = useMemo(
    () => Math.max(minimumPurchaseDays, normalizePurchaseDayCount(purchaseDaysInput)),
    [minimumPurchaseDays, purchaseDaysInput]
  );
  const totalRequestedTeacherAmountForDuration = useMemo(
    () => totalRequestedTeacherDailyRate * normalizedStudentCount * normalizedPurchaseDays,
    [normalizedPurchaseDays, normalizedStudentCount, totalRequestedTeacherDailyRate]
  );
  const hasPyqPaidQuestions = useMemo(
    () => DIFFICULTY_LEVELS.some((level) => questionInventorySummary.pyq[level] > 0),
    [questionInventorySummary.pyq]
  );
  const checkoutHref = useMemo(
    () => buildTeacherQuestionPurchaseCheckoutLink({
      examTypeId: selectedExamTypeId,
      examTypeName: examTypeNameById[selectedExamTypeId] || 'Exam',
      classId: selectedClassId,
      className: classNameById[selectedClassId] || 'Curriculum',
      subjectId: selectedSubjectId,
      subjectName: subjectNameById[selectedSubjectId] || 'Subject',
      topicId: selectedTopicId !== ALL_TOPICS_VALUE ? selectedTopicId : '',
      topicName: selectedTopicId !== ALL_TOPICS_VALUE ? (topicNameById[selectedTopicId] || '') : '',
      subtopicPath: selectedSubtopicPath !== ALL_SUBTOPICS_VALUE ? selectedSubtopicPath : '',
      subtopicLabel: selectedSubtopicPath !== ALL_SUBTOPICS_VALUE ? formatSubtopicPath(selectedSubtopicPath) : '',
      regularCounts: resolvedRegularPurchaseCounts,
      pyqCounts: resolvedPyqPurchaseCounts,
      studentsCount: normalizedStudentCount,
      daysCount: normalizedPurchaseDays,
    }),
    [
      classNameById,
      examTypeNameById,
      normalizedPurchaseDays,
      normalizedStudentCount,
      resolvedPyqPurchaseCounts,
      resolvedRegularPurchaseCounts,
      selectedClassId,
      selectedExamTypeId,
      selectedSubjectId,
      selectedSubtopicPath,
      selectedTopicId,
      subjectNameById,
      topicNameById,
    ]
  );
  const primaryActionContext = useMemo<TeacherPremiumQuestionSelectionContext | null>(() => {
    if (!owner?.id || !selectedExamTypeId || !selectedClassId || !selectedSubjectId) return null;

    return {
      ownerId: owner.id,
      ownerName: buildOwnerName(owner),
      request: {
        examTypeId: selectedExamTypeId,
        examTypeName: examTypeNameById[selectedExamTypeId] || 'Exam',
        classId: selectedClassId,
        className: classNameById[selectedClassId] || 'Curriculum',
        subjectId: selectedSubjectId,
        subjectName: subjectNameById[selectedSubjectId] || 'Subject',
        topicId: selectedTopicId !== ALL_TOPICS_VALUE ? selectedTopicId : '',
        topicName: selectedTopicId !== ALL_TOPICS_VALUE ? (topicNameById[selectedTopicId] || '') : '',
        subtopicPath: selectedSubtopicPath !== ALL_SUBTOPICS_VALUE ? selectedSubtopicPath : '',
        subtopicLabel: selectedSubtopicPath !== ALL_SUBTOPICS_VALUE ? formatSubtopicPath(selectedSubtopicPath) : '',
        regularCounts: resolvedRegularPurchaseCounts,
        pyqCounts: resolvedPyqPurchaseCounts,
        studentsCount: normalizedStudentCount,
        daysCount: normalizedPurchaseDays,
      },
      pricing: {
        regularPricing: teacherStandardPricing,
        pyqPricing: teacherPyqPricing,
        dailyRateAmount: totalRequestedTeacherDailyRate,
        totalAmount: totalRequestedTeacherAmountForDuration,
        totalQuestionCount: totalRequestedQuestionCount,
        totalRegularQuestionCount: DIFFICULTY_LEVELS.reduce((sum, level) => sum + resolvedRegularPurchaseCounts[level], 0),
        totalPyqQuestionCount: DIFFICULTY_LEVELS.reduce((sum, level) => sum + resolvedPyqPurchaseCounts[level], 0),
      },
    };
  }, [
    classNameById,
    normalizedPurchaseDays,
    normalizedStudentCount,
    owner,
    resolvedPyqPurchaseCounts,
    resolvedRegularPurchaseCounts,
    selectedClassId,
    selectedExamTypeId,
    selectedSubjectId,
    selectedSubtopicPath,
    selectedTopicId,
    subjectNameById,
    teacherPyqPricing,
    teacherStandardPricing,
    topicNameById,
    examTypeNameById,
    totalRequestedQuestionCount,
    totalRequestedTeacherAmountForDuration,
    totalRequestedTeacherDailyRate,
  ]);
  const canProceedToCheckout = Boolean(
    selectedExamTypeId
    && selectedClassId
    && selectedSubjectId
    && totalRequestedQuestionCount > 0
    && totalRequestedTeacherAmountForDuration > 0
    && (!onPrimaryAction || primaryActionContext)
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!owner) {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>Premium questions are not ready yet</CardTitle>
          <CardDescription>
            The shared DCAM paid-question bank is not available right now. Once it is published, teachers will be able to review the scope and purchase from here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px] border border-white/10 bg-card/70">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Question scope</CardTitle>
          <CardDescription>
            Select the exam, curriculum, subject, and optional topic filters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
              <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm font-medium">Exam</p>
                <Select value={selectedExamTypeId} onValueChange={setExamTypeSelection} disabled={lockScopeSelection}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select exam" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableExamTypes.map((examType) => (
                      <SelectItem key={examType.id} value={examType.id}>
                        {examType.name || 'Untitled exam'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm font-medium">Curriculum</p>
                <Select value={selectedClassId} onValueChange={setClassSelection} disabled={lockScopeSelection || !selectedExamTypeId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select curriculum" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses.map((classItem) => (
                      <SelectItem key={classItem.id} value={classItem.id}>
                        {classItem.name || 'Untitled curriculum'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm font-medium">Subject</p>
                <Select value={selectedSubjectId} onValueChange={setSubjectSelection} disabled={lockScopeSelection || !selectedClassId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name || 'Untitled subject'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm font-medium">Topic</p>
                <Select value={selectedTopicId} onValueChange={setTopicSelection} disabled={lockScopeSelection || !selectedSubjectId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="All topics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_TOPICS_VALUE}>All topics</SelectItem>
                    {availableTopics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm font-medium">Subtopic</p>
                <Select
                  value={selectedSubtopicPath}
                  onValueChange={setSubtopicSelection}
                  disabled={lockScopeSelection || !selectedSubjectId || availableSubtopicPaths.length === 0}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="All subtopics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_SUBTOPICS_VALUE}>All subtopics</SelectItem>
                    {availableSubtopicPaths.map((path) => (
                      <SelectItem key={path} value={path}>
                        {formatSubtopicPath(path)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Selected scope</p>
                <p className="mt-2 text-lg font-semibold text-slate-50">
                  {selectedScopeLabel || 'Choose exam, curriculum, and subject'}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedScopeDetailLabel || 'All topics'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Questions</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-50">{selectedQuestionCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Topics</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-50">{selectedTopicCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Subtopics</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-50">{selectedBranchCount}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Active stock now</p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">{currentReusableStockCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">Reusable paid questions currently active in this scope.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Active purchases</p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">{activeMatchingPurchaseCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">Top-up purchases in the same scope stack together here.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Renewable expired</p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">{expiredMatchingPurchaseCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">Expired packs can be renewed by buying the same scope again.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Current stock valid till</p>
                <p className="mt-2 text-sm font-semibold text-slate-50">
                  {currentStockEndsAt ? new Date(currentStockEndsAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No active stock'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">When all active packs expire, paid tests using this stock are removed until renewed.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border border-white/10 bg-card/70">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-xl">Pricing and request</CardTitle>
                <CardDescription className="text-sm">
                  Review the daily rate, then enter the question count, students, and days.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={hasTeacherPurchasePricing
                  ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-white/10 bg-white/5 text-slate-100'}
              >
                {hasTeacherPurchasePricing ? 'Pricing available' : 'Pricing pending'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <PricingComparisonTable
                title="Regular question pricing"
                teacherPricing={teacherStandardPricing}
              />
              {hasPyqPaidQuestions ? (
                <PricingComparisonTable
                  title="PYQ question pricing"
                  teacherPricing={teacherPyqPricing}
                />
              ) : null}
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-5 py-4 text-sm text-muted-foreground">
                {hasTeacherPurchasePricing
                  ? 'Daily teacher pricing is available for this scope.'
                  : 'Daily teacher pricing for this scope is not published yet.'}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <PurchaseRequestPanel
                title="Regular questions"
                teacherPricing={teacherStandardPricing}
                inventory={effectiveQuestionInventorySummary.standard}
                input={regularPurchaseInput}
                onInputChange={(level, value) =>
                  setRegularPurchaseInput((current) => ({
                    ...current,
                    [level]: String(
                      Math.max(
                        minimumRegularPurchaseCounts[level],
                        Number(clampRequestedQuestionCount(value, effectiveQuestionInventorySummary.standard[level]))
                      )
                    ),
                  }))
                }
              />

              <PurchaseRequestPanel
                title="PYQ questions"
                teacherPricing={teacherPyqPricing}
                inventory={effectiveQuestionInventorySummary.pyq}
                input={pyqPurchaseInput}
                onInputChange={(level, value) =>
                  setPyqPurchaseInput((current) => ({
                    ...current,
                    [level]: String(
                      Math.max(
                        minimumPyqPurchaseCounts[level],
                        Number(clampRequestedQuestionCount(value, effectiveQuestionInventorySummary.pyq[level]))
                      )
                    ),
                  }))
                }
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_260px]">
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Summary</p>
                <p className="mt-2 text-xl font-semibold text-slate-50">
                  {totalRequestedQuestionCount} questions selected
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Total amount = selected daily rate x students x days.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Access stays active for the selected number of days.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
                <label htmlFor="teacher-premium-student-count" className="text-sm font-medium text-slate-100">
                  Students
                </label>
                <Input
                  id="teacher-premium-student-count"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={studentCountInput}
                  onChange={(event) => setStudentCountInput(event.target.value)}
                  onBlur={() => setStudentCountInput(String(normalizedStudentCount))}
                  className="mt-3 h-12 rounded-2xl border-white/10 bg-slate-950/80 text-base"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
                <label htmlFor="teacher-premium-days-count" className="text-sm font-medium text-slate-100">
                  Number of days
                </label>
                <Input
                  id="teacher-premium-days-count"
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  inputMode="numeric"
                  value={purchaseDaysInput}
                  onChange={(event) => setPurchaseDaysInput(event.target.value)}
                  onBlur={() => setPurchaseDaysInput(String(normalizedPurchaseDays))}
                  className="mt-3 h-12 rounded-2xl border-white/10 bg-slate-950/80 text-base"
                />
                <p className="mt-2 text-xs text-muted-foreground">Enter the number of days from 1 to 365.</p>
              </div>

              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-5 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Estimated total</p>
                <p className="mt-2 text-sm text-emerald-100/80">
                  {formatRupeeAmount(totalRequestedTeacherDailyRate)} per day for 1 student
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-50">
                  {formatRupeeAmount(totalRequestedTeacherAmountForDuration)}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-[24px] border border-cyan-400/15 bg-[linear-gradient(135deg,rgba(8,47,73,0.28),rgba(15,23,42,0.92))] p-4 md:flex-row md:items-center md:justify-between">
              <p className="max-w-2xl text-sm text-slate-300">
                {primaryActionHelperText}
              </p>
              <Button
                type="button"
                disabled={!canProceedToCheckout || isPrimaryActionBusy}
                className="h-12 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-500 px-7 text-base font-semibold text-slate-950 shadow-[0_18px_34px_-18px_rgba(56,189,248,0.8)] transition-all duration-200 hover:-translate-y-[1px] hover:from-cyan-200 hover:via-sky-200 hover:to-blue-400 hover:shadow-[0_24px_40px_-18px_rgba(59,130,246,0.75)] disabled:bg-slate-700 disabled:text-slate-300 disabled:shadow-none"
                onClick={() => {
                  if (!canProceedToCheckout) return;
                  if (onPrimaryAction && primaryActionContext) {
                    void onPrimaryAction(primaryActionContext);
                    return;
                  }
                  router.push(checkoutHref);
                }}
              >
                {isPrimaryActionBusy ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    {primaryActionLabel}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
