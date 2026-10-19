'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { collection, doc, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { setDocumentNonBlocking, useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, BookOpen, Clock3, Filter, LoaderCircle, PlayCircle, Sparkles, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  applyPremiumPracticeAttemptTopUp,
  buildPremiumPracticeSessionHref,
  formatPremiumPracticeAttemptActionButtonLabel,
  formatPremiumPracticeAttemptPricingRule,
  normalizePremiumPracticeTopicConfigs,
  resolvePremiumPracticeAttemptPricingRule,
  resolvePremiumPracticeAttemptUsage,
  type PremiumPracticeAttemptActionKind,
  type PremiumPracticeAttemptPaymentKind,
  type PremiumPracticeAttemptPricingMap,
  type PremiumPracticeTopicConfig,
  type PremiumPracticeSessionPurchase,
} from '@/lib/premium-practice-session';
import { ADMIN_PRACTICE_SESSION_ASSIGNMENT_SOURCE } from '@/lib/admin-practice-session-management';
import {
  buildDcamQuestionPricingBreakdown,
  type DcamQuestionPricingBreakdown,
  type DcamQuestionPricingProfile,
} from '@/lib/dcam-question-pricing';
import { type ScopedDifficultyPricingMap } from '@/lib/premium-pricing';
import {
  buildTeacherPremiumQuestionRowsFromQuestions,
  resolveTeacherPremiumQuestionAvailability,
} from '@/lib/teacher-premium-question-access';
import {
  isTeacherQuestionPurchaseActiveAt,
  type TeacherQuestionPurchasePublicScope,
} from '@/lib/teacher-question-purchase';
import {
  buildPracticeQuestionScopeEntries,
  type PracticeQuestionScopeAlignment,
  type PracticeQuestionScopeEntry,
} from '@/lib/practice-question-scope';
import { extractSubtopicPaths, normalizeSubtopicValue, splitSubtopicPath } from '@/lib/subtopic-paths';
import { DCAM_QUESTION_BANK_OWNER_ID } from '@/lib/teacher-authoring';
import { isPublicTeacherProfile } from '@/lib/teacher-approval';
import { sendSelfBellNotification } from '@/lib/client-notifications';
import { useToast } from '@/hooks/use-toast';
import { completeVerifiedPayment, createRazorpayOrder } from '@/app/actions';
import { mergeLegacyDifficultyCounts, QUESTION_DIFFICULTY } from '@/lib/question-difficulty';

type TeacherProfile = DcamQuestionPricingProfile & {
  id: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  roleId?: 'student' | 'teacher' | 'admin';
  status?: 'active' | 'blocked';
  teacherStatus?: 'pending' | 'approved' | 'rejected';
  teachingAssignments?: Array<{ examTypeId: string; classId: string; allSubjects?: boolean; subjectIds?: string[] }>;
  teachesClassIds?: string[];
  teachesExamTypeIds?: string[];
  teachesSubjectIds?: string[];
  premiumPracticeQuestionPrice?: number;
  premiumPracticeQuestionPriceByDifficulty?: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
  premiumPracticeQuestionPricingByScope?: ScopedDifficultyPricingMap;
  dcamPracticeQuestionPricingByScope?: ScopedDifficultyPricingMap;
  premiumPracticeAttemptPricingByScope?: PremiumPracticeAttemptPricingMap;
  publicTeacherQuestionPurchaseScopes?: TeacherQuestionPurchasePublicScope[];
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

type ExamType = { id: string; name?: string };
type ClassItem = { id: string; name?: string; examTypeId?: string };
type Subject = { id: string; name: string; classId: string };
type Topic = {
  id: string;
  name: string;
  subjectId: string;
  subtopics?: string[];
  subtopicPaths?: string[];
  subtopicCatalog?: string[];
};
type PracticeQuestion = {
  id: string;
  teacherId?: string;
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  topicId?: string;
  subtopics?: string[];
  questionType?: 'MCQ' | 'Numerical' | 'Text';
  difficultyLevel?: 'Easy' | 'Medium' | 'Hard';
  isPreviousYear?: boolean;
  previousYear?: string;
  accessLevel?: 'free' | 'paid';
  mockTestOnly?: boolean;
  alignments?: PracticeQuestionScopeAlignment[];
};
type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';
type QuestionSourceMode = 'all' | 'pyq';
type SubjectConfig = {
  questionType: 'All' | 'MCQ' | 'Numerical';
  difficultyLevel: DifficultyLevel;
  questionSource: QuestionSourceMode;
  previousYears: string[];
  count: number;
};
type PremiumPracticeSessionPurchaseRecord = PremiumPracticeSessionPurchase & {
  offerId?: string;
  offerPurchaseId?: string;
};

type PremiumPracticeDisplayTopicConfig = PremiumPracticeTopicConfig & {
  subjectName?: string;
  topicName?: string;
};

const DIFFICULTY_LEVELS: DifficultyLevel[] = [QUESTION_DIFFICULTY];
const PREVIOUS_YEAR_PATTERN = /^(19|20)\d{2}$/;
const FIRESTORE_ID_PATTERN = /^[A-Za-z0-9]{20}$/;

const normalizeQuestionIdList = (value: unknown): string[] => (
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
            .map((entry) => entry.trim())
        )
      )
    : []
);

const getPremiumPracticeIncludedQuestionCountFromRecord = (value?: {
  includedQuestionCount?: number;
  includedQuestionIds?: string[];
  questionCount?: number;
  includedTopicConfigs?: unknown;
  topicConfigs?: unknown;
} | null) => {
  const normalizedConfigs = normalizePremiumPracticeTopicConfigs(
    value?.includedTopicConfigs || value?.topicConfigs
  );
  const configuredCount = normalizedConfigs.reduce(
    (count, config) => count + Math.max(0, Number(config.count || 0)),
    0
  );
  const storedIdsCount = normalizeQuestionIdList(value?.includedQuestionIds).length;
  const storedCount = Math.max(0, Number(value?.includedQuestionCount ?? value?.questionCount ?? 0));
  return Math.max(storedCount, configuredCount, storedIdsCount);
};

const normalizePreviousYearValue = (value?: string) => {
  const year = String(value || '').trim();
  return PREVIOUS_YEAR_PATTERN.test(year) ? year : '';
};
const sortYearsDescending = (years: string[]) => {
  return Array.from(new Set(years.map((year) => normalizePreviousYearValue(year)).filter(Boolean)))
    .sort((a, b) => Number(b) - Number(a));
};
const normalizeSubtopicPathSegments = (segments: string[]) =>
  segments.map((segment) => String(segment || '').trim()).filter(Boolean);
const parseSubtopicPathSelection = (value?: string) =>
  normalizeSubtopicPathSegments(splitSubtopicPath(String(value || '')));
const serializeSubtopicPathSelection = (segments: string[]) =>
  normalizeSubtopicPathSegments(segments).join(' > ');
const getSubtopicPathKey = (segments: string[]) =>
  normalizeSubtopicPathSegments(segments)
    .map((segment) => normalizeSubtopicValue(segment))
    .join('>');
const normalizeSubtopicPathSelections = (values: string[] = []) => {
  const unique = new Map<string, string>();
  values.forEach((value) => {
    const parsed = parseSubtopicPathSelection(value);
    if (!parsed.length) return;
    const key = getSubtopicPathKey(parsed);
    if (!key || unique.has(key)) return;
    unique.set(key, serializeSubtopicPathSelection(parsed));
  });
  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
};
const subtopicPathStartsWith = (path: string[], prefix: string[]) => {
  const normalizedPath = normalizeSubtopicPathSegments(path);
  const normalizedPrefix = normalizeSubtopicPathSegments(prefix);
  if (!normalizedPrefix.length) return true;
  if (normalizedPath.length < normalizedPrefix.length) return false;
  return normalizedPrefix.every(
    (segment, index) => normalizeSubtopicValue(normalizedPath[index]) === normalizeSubtopicValue(segment)
  );
};
const matchesSelectedSubtopicPaths = (
  subtopics: string[] | undefined,
  selectedSubtopicPaths: string[] = []
) => {
  const normalizedSelections = normalizeSubtopicPathSelections(selectedSubtopicPaths);
  if (normalizedSelections.length === 0) return true;
  const questionPaths = extractSubtopicPaths(subtopics);
  if (questionPaths.length === 0) return false;
  return normalizedSelections.some((selection) => {
    const selectionPath = parseSubtopicPathSelection(selection);
    return questionPaths.some((questionPath) => subtopicPathStartsWith(questionPath, selectionPath));
  });
};
type PracticeTopicConfigSelection = {
  subjectId: string;
  topicId: string;
  subtopics: string[];
  questionType: 'All' | 'MCQ' | 'Numerical';
  difficultyLevel: DifficultyLevel;
  previousYearMode: QuestionSourceMode;
  previousYears: string[];
  count?: number;
};
const getChildSubtopicOptions = (pathPool: string[][], parentPath: string[]) => {
  const parentSegments = normalizeSubtopicPathSegments(parentPath);
  const options = new Map<string, string>();
  pathPool.forEach((path) => {
    const normalizedPath = normalizeSubtopicPathSegments(path);
    if (normalizedPath.length <= parentSegments.length) return;
    if (!subtopicPathStartsWith(normalizedPath, parentSegments)) return;
    const nextSegment = normalizedPath[parentSegments.length];
    const key = normalizeSubtopicValue(nextSegment);
    if (!key || options.has(key)) return;
    options.set(key, nextSegment);
  });
  return Array.from(options.values()).sort((a, b) => a.localeCompare(b));
};
const hasMatchingSubtopicPrefix = (pathPool: string[][], prefixPath: string[]) =>
  pathPool.some((path) => subtopicPathStartsWith(path, prefixPath));
const addSubtopicPathsToMap = (uniquePaths: Map<string, string[]>, subtopics?: string[] | null) => {
  extractSubtopicPaths(subtopics).forEach((path) => {
    const normalizedPath = normalizeSubtopicPathSegments(path);
    const key = getSubtopicPathKey(normalizedPath);
    if (!key || uniquePaths.has(key)) return;
    uniquePaths.set(key, normalizedPath);
  });
};
const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
};

const sanitizeScopeDisplayLabel = (value: unknown, id?: string) => {
  const label = String(value || '').trim();
  const normalizedId = String(id || '').trim();
  if (!label) return '';
  if (normalizedId && label === normalizedId) return '';
  if (FIRESTORE_ID_PATTERN.test(label) && (!normalizedId || label !== normalizedId)) return '';
  return label;
};

const normalizePremiumPracticeDisplayTopicConfigs = (value: unknown): PremiumPracticeDisplayTopicConfig[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map<PremiumPracticeDisplayTopicConfig | null>((item) => {
      const normalized = normalizePremiumPracticeTopicConfigs([item])[0];
      if (!normalized) return null;
      const raw = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        ...normalized,
        subjectName: sanitizeScopeDisplayLabel(raw.subjectName, normalized.subjectId),
        topicName: sanitizeScopeDisplayLabel(raw.topicName, normalized.topicId),
      };
    })
    .filter((item): item is PremiumPracticeDisplayTopicConfig => !!item);
};

const countQuestionIdsByDifficulty = (
  questionIds: string[],
  questionById: Map<string, PracticeQuestion>
) =>
  questionIds.reduce(
    (acc, questionId) => {
      const difficulty = questionById.get(questionId)?.difficultyLevel || 'Easy';
      if (difficulty === 'Medium') acc.Medium += 1;
      else if (difficulty === 'Hard') acc.Hard += 1;
      else acc.Easy += 1;
      return acc;
    },
    { Easy: 0, Medium: 0, Hard: 0 } as Record<DifficultyLevel, number>
  );

const isAdminAssignedPremiumPracticePurchase = (value?: {
  assignmentSource?: string;
} | null) => String(value?.assignmentSource || '').trim() === ADMIN_PRACTICE_SESSION_ASSIGNMENT_SOURCE;

const isReusablePremiumPracticePurchase = (value?: {
  offerId?: string;
  offerPurchaseId?: string;
  assignmentSource?: string;
} | null) =>
  isAdminAssignedPremiumPracticePurchase(value)
  || !!String(value?.offerId || '').trim()
  || !!String(value?.offerPurchaseId || '').trim();

export default function TeacherPracticeSetupPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams<{ teacherId: string }>();
  const searchParams = useSearchParams();
  const teacherId = typeof params?.teacherId === 'string' ? params.teacherId : '';

  const presetContext = searchParams.get('presetContext') || '';
  const shouldApplyPresetFilters = presetContext === 'practice_search';
  const presetExamTypeId = shouldApplyPresetFilters ? (searchParams.get('examTypeId') || '') : '';
  const presetClassId = shouldApplyPresetFilters ? (searchParams.get('classId') || '') : '';
  const presetExamTypeName = shouldApplyPresetFilters ? (searchParams.get('examTypeName') || '') : '';
  const presetClassName = shouldApplyPresetFilters ? (searchParams.get('className') || '') : '';
  const practiceMode = searchParams.get('practiceMode') === 'premium' ? 'premium' : 'regular';
  const isPremiumMode = practiceMode === 'premium';
  const premiumPurchaseIdParam = isPremiumMode ? (searchParams.get('premiumPurchaseId') || '') : '';
  const expectedAccessLevel: 'free' | 'paid' = isPremiumMode ? 'paid' : 'free';
  const initialSubjectIds = shouldApplyPresetFilters
    ? (searchParams.get('subjectIds') || '').split(',').filter(Boolean)
    : [];

  const [examTypeId, setExamTypeId] = useState(presetExamTypeId);
  const [classId, setClassId] = useState(presetClassId);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>(initialSubjectIds);
  const [subjectConfigById, setSubjectConfigById] = useState<Record<string, SubjectConfig>>({});
  const [selectedTopicIdsBySubject, setSelectedTopicIdsBySubject] = useState<Record<string, string[]>>({});
  const [selectedSubtopicPathsByTopicId, setSelectedSubtopicPathsByTopicId] = useState<Record<string, string[]>>({});
  const [subtopicDraftPathByTopicId, setSubtopicDraftPathByTopicId] = useState<Record<string, string[]>>({});
  const [topicCountById, setTopicCountById] = useState<Record<string, number>>({});
  const [shouldLoadPremiumPurchases, setShouldLoadPremiumPurchases] = useState(Boolean(isPremiumMode && premiumPurchaseIdParam));
  const hasSelectedExamAndClass = Boolean(examTypeId && classId);

  useEffect(() => {
    if (!isPremiumMode) {
      setShouldLoadPremiumPurchases(false);
      return;
    }
    if (premiumPurchaseIdParam) {
      setShouldLoadPremiumPurchases(true);
      return;
    }

    setShouldLoadPremiumPurchases(false);
    if (typeof window === 'undefined') return;

    const browserWindow = window as Window & typeof globalThis;
    if ('requestIdleCallback' in browserWindow) {
      const idleId = browserWindow.requestIdleCallback(() => setShouldLoadPremiumPurchases(true), { timeout: 1600 });
      return () => browserWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = globalThis.setTimeout(() => setShouldLoadPremiumPurchases(true), 900);
    return () => globalThis.clearTimeout(timeoutId);
  }, [isPremiumMode, premiumPurchaseIdParam]);

  const teacherRef = useMemoFirebase(() => (firestore && teacherId ? doc(firestore, 'users', teacherId) : null), [firestore, teacherId]);
  const examTypesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null), [firestore]);
  const classesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null), [firestore]);
  const subjectsQ = useMemoFirebase(
    () => (firestore && classId ? query(collection(firestore, 'subjects'), where('classId', '==', classId)) : null),
    [firestore, classId]
  );
  const topicsQ = useMemoFirebase(() => {
    if (!firestore || selectedSubjectIds.length === 0) return null;
    return selectedSubjectIds.length <= 30
      ? query(collection(firestore, 'topics'), where('subjectId', 'in', selectedSubjectIds))
      : query(collection(firestore, 'topics'));
  }, [firestore, selectedSubjectIds]);
  const teacherQuestionsQ = useMemoFirebase(
    () => {
      if (!firestore || !teacherId) return null;
      if (!hasSelectedExamAndClass) return null;
      return query(
        collection(firestore, 'practice_questions'),
        where('teacherId', '==', teacherId)
      );
    },
    [firestore, teacherId, hasSelectedExamAndClass]
  );
  const pricingOwner = useMemo(() => ({ id: DCAM_QUESTION_BANK_OWNER_ID }), []);
  const pricingOwnerQuestionsQ = useMemoFirebase(
    () => (
      firestore && isPremiumMode && pricingOwner?.id && teacherId !== pricingOwner.id && hasSelectedExamAndClass
        ? query(
            collection(firestore, 'practice_questions'),
            where('teacherId', '==', pricingOwner.id)
          )
        : null
    ),
    [firestore, isPremiumMode, pricingOwner?.id, teacherId, hasSelectedExamAndClass]
  );
  const premiumPurchasesQ = useMemoFirebase(
    () => (firestore && user?.uid && teacherId && isPremiumMode && shouldLoadPremiumPurchases
      ? query(collection(firestore, 'users', user.uid, 'premium_practice_session_purchases'), where('teacherId', '==', teacherId))
      : null),
    [firestore, user?.uid, teacherId, isPremiumMode, shouldLoadPremiumPurchases]
  );
  const premiumPurchaseRef = useMemoFirebase(
    () => (firestore && user?.uid && isPremiumMode && premiumPurchaseIdParam
      ? doc(firestore, 'users', user.uid, 'premium_practice_session_purchases', premiumPurchaseIdParam)
      : null),
    [firestore, user?.uid, isPremiumMode, premiumPurchaseIdParam]
  );

  const { data: teacher, isLoading: teacherLoading } = useDoc<TeacherProfile>(teacherRef);
  const { data: examTypes, isLoading: examTypesLoading } = useCollection<ExamType>(examTypesQ);
  const { data: classes, isLoading: classesLoading } = useCollection<ClassItem>(classesQ);
  const { data: subjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQ);
  const { data: topics, isLoading: topicsLoading } = useCollection<Topic>(topicsQ);
  const { data: teacherQuestionsRaw, isLoading: teacherQuestionsLoading } = useCollection<PracticeQuestion>(teacherQuestionsQ);
  const { data: pricingOwnerQuestionsRaw, isLoading: pricingOwnerQuestionsLoading } = useCollection<PracticeQuestion>(pricingOwnerQuestionsQ);
  const { data: premiumPurchases } = useCollection<PremiumPracticeSessionPurchaseRecord>(premiumPurchasesQ);
  const { data: premiumPurchaseFromParam } = useDoc<PremiumPracticeSessionPurchaseRecord>(premiumPurchaseRef);
  const [perQuestionTimeSecondsInput, setPerQuestionTimeSecondsInput] = useState<string>('');
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [hydratedPremiumPurchaseId, setHydratedPremiumPurchaseId] = useState('');
  const teacherQuestions = useMemo(
    () => (Array.isArray(teacherQuestionsRaw) ? teacherQuestionsRaw : []),
    [teacherQuestionsRaw]
  );
  const pricingOwnerQuestions = useMemo(
    () => (Array.isArray(pricingOwnerQuestionsRaw) ? pricingOwnerQuestionsRaw : []),
    [pricingOwnerQuestionsRaw]
  );
  const publicTeacherQuestionPurchaseScopes = useMemo(
    () => (
      Array.isArray(teacher?.publicTeacherQuestionPurchaseScopes)
        ? teacher.publicTeacherQuestionPurchaseScopes.filter((scope) => isTeacherQuestionPurchaseActiveAt(scope))
        : []
    ),
    [teacher?.publicTeacherQuestionPurchaseScopes]
  );
  const purchasedPaidQuestions = useMemo(() => {
    if (!isPremiumMode || !pricingOwner?.id) {
      return [] as PracticeQuestion[];
    }

    if (teacherId === pricingOwner.id) {
      return teacherQuestions
        .filter((question) => !question.mockTestOnly && (question.accessLevel || 'free') === 'paid');
    }

    if (publicTeacherQuestionPurchaseScopes.length === 0) {
      return [] as PracticeQuestion[];
    }

    const ownerQuestionPool = teacherId === pricingOwner.id ? teacherQuestions : pricingOwnerQuestions;
    const ownerPaidQuestions = ownerQuestionPool
      .filter((question) => !question.mockTestOnly && (question.accessLevel || 'free') === 'paid');
    if (ownerPaidQuestions.length === 0) return [] as PracticeQuestion[];

    const availability = resolveTeacherPremiumQuestionAvailability({
      rows: buildTeacherPremiumQuestionRowsFromQuestions(ownerPaidQuestions, { accessLevel: 'paid' }),
      purchases: publicTeacherQuestionPurchaseScopes as any,
      minimumStudentsRequired: 1,
      randomize: false,
    });

    const uniqueQuestions = new Map<string, PracticeQuestion>();
    availability.selectableRows.forEach((row) => {
      if (!row.question?.id || uniqueQuestions.has(row.question.id)) return;
      uniqueQuestions.set(row.question.id, row.question);
    });
    return Array.from(uniqueQuestions.values());
  }, [
    isPremiumMode,
    pricingOwner?.id,
    pricingOwnerQuestions,
    publicTeacherQuestionPurchaseScopes,
    teacherId,
    teacherQuestions,
  ]);
  const questions = useMemo(
    () => (isPremiumMode ? purchasedPaidQuestions : teacherQuestions),
    [isPremiumMode, purchasedPaidQuestions, teacherQuestions]
  );
  const questionsLoading =
    teacherQuestionsLoading
    || (isPremiumMode && teacherId !== pricingOwner?.id && pricingOwnerQuestionsLoading);

  const getPracticeQuestionScopeEntries = (question: PracticeQuestion) =>
    buildPracticeQuestionScopeEntries(question);
  const scopeEntryMatchesSelection = (
    entry: PracticeQuestionScopeEntry<PracticeQuestion>,
    scopeExamTypeId: string,
    scopeClassId: string,
    accessLevel: 'free' | 'paid'
  ) =>
    entry.examTypeId === scopeExamTypeId
    && entry.classId === scopeClassId
    && entry.accessLevel === accessLevel
    && !entry.mockTestOnly;
  const countUniqueQuestionsFromEntries = (entries: PracticeQuestionScopeEntry<PracticeQuestion>[]) =>
    new Set(entries.map((entry) => entry.sourceQuestionId)).size;

  const examNameById = useMemo(
    () => Object.fromEntries((examTypes || []).map((exam) => [exam.id, exam.name || exam.id])),
    [examTypes]
  );
  const classById = useMemo(
    () => Object.fromEntries((classes || []).map((classItem) => [classItem.id, classItem])),
    [classes]
  );
  const classNameById = useMemo(
    () => Object.fromEntries((classes || []).map((classItem) => [classItem.id, classItem.name || classItem.id])),
    [classes]
  );
  const premiumPurchasesForTeacher = useMemo(() => {
    if (!isPremiumMode) return [];
    const sourcePurchases = [...(premiumPurchases || [])];
    if (
      premiumPurchaseFromParam?.id
      && premiumPurchaseFromParam.teacherId === teacherId
      && !sourcePurchases.some((purchase) => purchase.id === premiumPurchaseFromParam.id)
    ) {
      sourcePurchases.push(premiumPurchaseFromParam);
    }
    return sourcePurchases
      .map((purchase) => ({
        ...purchase,
        id: purchase.id || '',
        topicConfigs: normalizePremiumPracticeDisplayTopicConfigs(purchase.topicConfigs),
      }))
      .filter((purchase) => purchase.id && purchase.status === 'paid')
      .sort((a, b) => {
        const aTime = toDate(a.updatedAt)?.getTime() || toDate(a.purchasedAt)?.getTime() || 0;
        const bTime = toDate(b.updatedAt)?.getTime() || toDate(b.purchasedAt)?.getTime() || 0;
        return bTime - aTime;
      });
  }, [isPremiumMode, premiumPurchaseFromParam, premiumPurchases, teacherId]);
  const selectedPremiumPurchase = useMemo(
    () => premiumPurchasesForTeacher.find((purchase) => purchase.id === premiumPurchaseIdParam) || null,
    [premiumPurchasesForTeacher, premiumPurchaseIdParam]
  );
  const visiblePremiumPurchasesForSelection = useMemo(
    () => (
      isPremiumMode && hasSelectedExamAndClass
        ? premiumPurchasesForTeacher.filter((purchase) =>
            purchase.examTypeId === examTypeId && purchase.classId === classId
          )
        : []
    ),
    [classId, examTypeId, hasSelectedExamAndClass, isPremiumMode, premiumPurchasesForTeacher]
  );

  const assignmentPairs = useMemo(() => {
    const unique = new Map<string, { examTypeId: string; classId: string }>();
    (teacher?.teachingAssignments || []).forEach((assignment) => {
      if (!assignment.examTypeId || !assignment.classId) return;
      const key = `${assignment.examTypeId}::${assignment.classId}`;
      if (!unique.has(key)) {
        unique.set(key, { examTypeId: assignment.examTypeId, classId: assignment.classId });
      }
    });
    return Array.from(unique.values());
  }, [teacher?.teachingAssignments]);

  const premiumQuestionPairs = useMemo(() => {
    if (!isPremiumMode) return [] as Array<{ examTypeId: string; classId: string }>;
    const unique = new Map<string, { examTypeId: string; classId: string }>();
    questions.forEach((question) => {
      getPracticeQuestionScopeEntries(question)
        .filter((entry) => entry.accessLevel === 'paid' && !entry.mockTestOnly)
        .forEach((entry) => {
          if (!entry.examTypeId || !entry.classId) return;
          unique.set(`${entry.examTypeId}__${entry.classId}`, {
            examTypeId: entry.examTypeId,
            classId: entry.classId,
          });
        });
    });
    return Array.from(unique.values());
  }, [isPremiumMode, questions]);

  const availableExamTypeIds = useMemo(() => {
    if (isPremiumMode) {
      const ids = new Set<string>(premiumQuestionPairs.map((pair) => pair.examTypeId));
      premiumPurchasesForTeacher.forEach((purchase) => {
        if (purchase.examTypeId) ids.add(purchase.examTypeId);
      });
      if (ids.size === 0) {
        (examTypes || []).forEach((exam) => ids.add(exam.id));
      }
      return ids;
    }
    const ids = new Set<string>(assignmentPairs.map((pair) => pair.examTypeId));
    (teacher?.teachesExamTypeIds || []).filter(Boolean).forEach((id) => ids.add(id));
    return ids;
  }, [assignmentPairs, examTypes, isPremiumMode, premiumPurchasesForTeacher, premiumQuestionPairs, teacher?.teachesExamTypeIds]);

  const availableExamTypes = useMemo(() => {
    if (!availableExamTypeIds.size) return [];
    return (examTypes || []).filter((exam) => availableExamTypeIds.has(exam.id));
  }, [examTypes, availableExamTypeIds]);

  const availableClasses = useMemo(() => {
    if (!examTypeId) return [];
    const allowedClassIds = new Set<string>();
    if (isPremiumMode) {
      premiumQuestionPairs
        .filter((pair) => pair.examTypeId === examTypeId)
        .forEach((pair) => allowedClassIds.add(pair.classId));
      premiumPurchasesForTeacher
        .filter((purchase) => purchase.examTypeId === examTypeId && purchase.classId)
        .forEach((purchase) => {
          const purchasedClassId = String(purchase.classId || '').trim();
          if (purchasedClassId) allowedClassIds.add(purchasedClassId);
        });
    } else {
      assignmentPairs
        .filter((pair) => pair.examTypeId === examTypeId)
        .forEach((pair) => allowedClassIds.add(pair.classId));
      (teacher?.teachesClassIds || []).forEach((legacyClassId) => {
        const classItem = classById[legacyClassId];
        if (classItem?.examTypeId === examTypeId) allowedClassIds.add(legacyClassId);
      });
    }
    if (isPremiumMode && allowedClassIds.size === 0) {
      return (classes || []).filter((classItem) => classItem.examTypeId === examTypeId);
    }
    return (classes || []).filter((classItem) => allowedClassIds.has(classItem.id));
  }, [examTypeId, assignmentPairs, teacher?.teachesClassIds, classById, classes, isPremiumMode, premiumPurchasesForTeacher, premiumQuestionPairs]);

  const selectedExamName = examNameById[examTypeId] || presetExamTypeName || '';
  const selectedClassName = classNameById[classId] || presetClassName || '';

  useEffect(() => {
    if (!selectedPremiumPurchase?.id) {
      setHydratedPremiumPurchaseId('');
      return;
    }
    if (hydratedPremiumPurchaseId === selectedPremiumPurchase.id) return;

    const purchaseTopicConfigs = normalizePremiumPracticeTopicConfigs(
      isReusablePremiumPracticePurchase(selectedPremiumPurchase)
        ? (selectedPremiumPurchase.includedTopicConfigs || selectedPremiumPurchase.topicConfigs)
        : selectedPremiumPurchase.topicConfigs
    );
    if (!selectedPremiumPurchase.examTypeId || !selectedPremiumPurchase.classId || purchaseTopicConfigs.length === 0) {
      return;
    }

    const subjectIds = Array.from(new Set(purchaseTopicConfigs.map((config) => config.subjectId)));
    const nextSubjectConfigById: Record<string, SubjectConfig> = {};
    const nextSelectedTopicIdsBySubject: Record<string, string[]> = {};
    const nextSelectedSubtopicPathsByTopicId: Record<string, string[]> = {};
    const nextTopicCountById: Record<string, number> = {};

    purchaseTopicConfigs.forEach((config) => {
      if (!nextSubjectConfigById[config.subjectId]) {
        nextSubjectConfigById[config.subjectId] = {
          questionType: config.questionType,
          difficultyLevel: 'Easy' as const,
          questionSource: config.previousYearMode,
          previousYears: config.previousYears,
          count: config.count,
        };
      }
      nextSelectedTopicIdsBySubject[config.subjectId] = Array.from(
        new Set([...(nextSelectedTopicIdsBySubject[config.subjectId] || []), config.topicId])
      );
      nextSelectedSubtopicPathsByTopicId[config.topicId] = config.subtopics;
      nextTopicCountById[config.topicId] = config.count;
    });

    setExamTypeId(selectedPremiumPurchase.examTypeId);
    setClassId(selectedPremiumPurchase.classId);
    setSelectedSubjectIds(subjectIds);
    setSubjectConfigById(nextSubjectConfigById);
    setSelectedTopicIdsBySubject(nextSelectedTopicIdsBySubject);
    setSelectedSubtopicPathsByTopicId(nextSelectedSubtopicPathsByTopicId);
    setSubtopicDraftPathByTopicId({});
    setTopicCountById(nextTopicCountById);
    setPerQuestionTimeSecondsInput(
      Number.isFinite(Number(selectedPremiumPurchase.perQuestionTimeSeconds)) && Number(selectedPremiumPurchase.perQuestionTimeSeconds) > 0
        ? String(Math.floor(Number(selectedPremiumPurchase.perQuestionTimeSeconds)))
        : ''
    );
    setHydratedPremiumPurchaseId(selectedPremiumPurchase.id);
  }, [selectedPremiumPurchase, hydratedPremiumPurchaseId]);

  useEffect(() => {
    if (examTypeId && !availableExamTypes.some((item) => item.id === examTypeId)) {
      setExamTypeId('');
      setClassId('');
    }
  }, [examTypeId, availableExamTypes]);

  useEffect(() => {
    if (!examTypeId) {
      if (classId) setClassId('');
      return;
    }
    if (classId && !availableClasses.some((item) => item.id === classId)) {
      setClassId('');
    }
  }, [examTypeId, classId, availableClasses]);

  const taughtSubjectIds = useMemo(() => {
    if (isPremiumMode) return null;
    const matchingAssignments = (teacher?.teachingAssignments || []).filter(
      (assignment) => assignment.examTypeId === examTypeId && assignment.classId === classId
    );
    if (matchingAssignments.some((assignment) => assignment.allSubjects)) return null;
    const fromAssignment = matchingAssignments.flatMap((assignment) => assignment.subjectIds || []);
    const fromLegacy = teacher?.teachesSubjectIds || [];
    const merged = Array.from(new Set([...fromAssignment, ...fromLegacy]));
    return merged.length > 0 ? merged : null;
  }, [teacher, examTypeId, classId, isPremiumMode]);

  const teacherScopedQuestionEntries = useMemo(() => {
    if (!examTypeId || !classId) return [];
    return (questions || []).flatMap((question) =>
      getPracticeQuestionScopeEntries(question).filter((entry) =>
        scopeEntryMatchesSelection(entry, examTypeId, classId, expectedAccessLevel)
      )
    );
  }, [questions, examTypeId, classId, expectedAccessLevel]);
  const teacherScopedQuestions = useMemo(() => {
    const unique = new Map<string, PracticeQuestion>();
    teacherScopedQuestionEntries.forEach((entry) => {
      if (!unique.has(entry.sourceQuestionId)) {
        unique.set(entry.sourceQuestionId, entry.sourceQuestion);
      }
    });
    return Array.from(unique.values());
  }, [teacherScopedQuestionEntries]);

  const visibleSubjects = useMemo(() => {
    const base = subjects || [];
    const taught = taughtSubjectIds ? base.filter((s) => taughtSubjectIds.includes(s.id)) : base;
    return taught.filter((s) => teacherScopedQuestionEntries.some((entry) => entry.subjectId === s.id));
  }, [subjects, taughtSubjectIds, teacherScopedQuestionEntries]);

  useEffect(() => {
    if (!examTypeId || !classId || subjectsLoading || questionsLoading) return;
    setSelectedSubjectIds((current) => current.filter((subjectId) => visibleSubjects.some((subject) => subject.id === subjectId)));
  }, [visibleSubjects, examTypeId, classId, subjectsLoading, questionsLoading]);

  const getPreferredDifficultyForSubject = (subjectId: string): DifficultyLevel => {
    let selectedLevel: DifficultyLevel = 'Easy';
    let highestCount = -1;
    DIFFICULTY_LEVELS.forEach((level) => {
      const currentCount = countUniqueQuestionsFromEntries(
        teacherScopedQuestionEntries
          .filter((entry) => entry.subjectId === subjectId)
      );
      if (currentCount > highestCount) {
        highestCount = currentCount;
        selectedLevel = level;
      }
    });
    return selectedLevel;
  };

  const getDefaultSubjectConfig = (subjectId?: string): SubjectConfig => ({
    questionType: 'All',
    difficultyLevel: 'Easy' as const,
    questionSource: 'all',
    previousYears: [],
    count: 1,
  });

  const matchesSourceAndYearFilter = (
    entry: PracticeQuestionScopeEntry<PracticeQuestion>,
    config: { questionSource?: QuestionSourceMode; previousYearMode?: QuestionSourceMode; previousYears?: string[] }
  ) => {
    const sourceMode = config.questionSource || config.previousYearMode || 'all';
    const previousYears = config.previousYears || [];
    if (sourceMode !== 'pyq') return true;
    const year = normalizePreviousYearValue(entry.previousYear);
    if (!entry.isPreviousYear || !year) return false;
    if (previousYears.length === 0) return true;
    return previousYears.includes(year);
  };
  const scopeEntryMatchesConfig = (
    entry: PracticeQuestionScopeEntry<PracticeQuestion>,
    config: PracticeTopicConfigSelection,
    selectedSubtopicPaths: string[] = config.subtopics || []
  ) => {
    if (entry.subjectId !== config.subjectId || entry.topicId !== config.topicId) return false;
    if (config.questionType !== 'All' && entry.questionType !== config.questionType) return false;
    
    if (selectedSubtopicPaths.length > 0 && !matchesSelectedSubtopicPaths(entry.subtopics, selectedSubtopicPaths)) return false;
    return matchesSourceAndYearFilter(entry, config);
  };

  const getAvailablePreviousYearsForSubject = (subjectId: string, config: SubjectConfig) => {
    const years = teacherScopedQuestionEntries
      .filter((entry) => entry.subjectId === subjectId)
      .filter((entry) => (config.questionType === 'All' ? true : entry.questionType === config.questionType))
      .map((entry) => (entry.isPreviousYear ? normalizePreviousYearValue(entry.previousYear) : ''))
      .filter(Boolean);
    return sortYearsDescending(years);
  };

  const sanitizeSelectedPreviousYears = (years: string[], availableYears: string[]) => {
    if (!years.length) return [];
    const available = new Set(availableYears);
    return sortYearsDescending(years.filter((year) => available.has(year)));
  };

  const getAvailableCountForSubject = (subjectId: string, config: SubjectConfig) => {
    return countUniqueQuestionsFromEntries(
      teacherScopedQuestionEntries
        .filter((entry) => entry.subjectId === subjectId)
        .filter((entry) => (config.questionType === 'All' ? true : entry.questionType === config.questionType))
        .filter((entry) => matchesSourceAndYearFilter(entry, config))
    );
  };

  const getAvailableCountForTopic = (
    subjectId: string,
    topicId: string,
    config: SubjectConfig,
    selectedSubtopicPaths: string[] = []
  ) => {
    return countUniqueQuestionsFromEntries(
      teacherScopedQuestionEntries.filter((entry) =>
        scopeEntryMatchesConfig(
          entry,
          {
            subjectId,
            topicId,
            subtopics: selectedSubtopicPaths,
            questionType: config.questionType,
            difficultyLevel: 'Easy' as const,
            previousYearMode: config.questionSource,
            previousYears: config.previousYears,
          },
          selectedSubtopicPaths
        )
      )
    );
  };

  const toggleSubject = (subjectId: string, checked: boolean) => {
    setSelectedSubjectIds((curr) => (checked ? Array.from(new Set([...curr, subjectId])) : curr.filter((id) => id !== subjectId)));
    setSubjectConfigById((curr) => {
      if (checked) {
        if (curr[subjectId]) return curr;
        return { ...curr, [subjectId]: getDefaultSubjectConfig(subjectId) };
      }
      const next = { ...curr };
      delete next[subjectId];
      return next;
    });
    setSelectedTopicIdsBySubject((curr) => {
      if (checked) return curr;
      const next = { ...curr };
      delete next[subjectId];
      return next;
    });
    setSelectedSubtopicPathsByTopicId((curr) => {
      if (checked) return curr;
      const next = { ...curr };
      const topicIdsToClear = new Set([
        ...(selectedTopicIdsBySubject[subjectId] || []),
        ...((topics || []).filter((topic) => topic.subjectId === subjectId).map((topic) => topic.id)),
      ]);
      topicIdsToClear.forEach((topicId) => {
        delete next[topicId];
      });
      return next;
    });
    setSubtopicDraftPathByTopicId((curr) => {
      if (checked) return curr;
      const next = { ...curr };
      const topicIdsToClear = new Set([
        ...(selectedTopicIdsBySubject[subjectId] || []),
        ...((topics || []).filter((topic) => topic.subjectId === subjectId).map((topic) => topic.id)),
      ]);
      topicIdsToClear.forEach((topicId) => {
        delete next[topicId];
      });
      return next;
    });
  };

  const toggleTopic = (subjectId: string, topicId: string, checked: boolean, config: SubjectConfig) => {
    setSelectedTopicIdsBySubject((curr) => {
      const current = curr[subjectId] || [];
      const nextForSubject = checked
        ? (current.includes(topicId) ? current : [...current, topicId])
        : current.filter((id) => id !== topicId);
      return { ...curr, [subjectId]: nextForSubject };
    });
    if (!checked) {
      setSelectedSubtopicPathsByTopicId((curr) => {
        if (!curr[topicId]) return curr;
        const next = { ...curr };
        delete next[topicId];
        return next;
      });
      setSubtopicDraftPathByTopicId((curr) => {
        if (!curr[topicId]) return curr;
        const next = { ...curr };
        delete next[topicId];
        return next;
      });
    }
    if (checked && !topicCountById[topicId]) {
      const max = getAvailableCountForTopic(subjectId, topicId, config, selectedSubtopicPathsByTopicId[topicId] || []);
      setTopicCountById((curr) => ({ ...curr, [topicId]: Math.min(10, Math.max(1, max)) }));
    }
  };

  const applyTopicSubtopicPathSelections = (
    subjectId: string,
    topicId: string,
    selectedPaths: string[],
    config: SubjectConfig
  ) => {
    const normalizedSelections = normalizeSubtopicPathSelections(selectedPaths);
    setSelectedSubtopicPathsByTopicId((curr) => ({ ...curr, [topicId]: normalizedSelections }));

    setSelectedTopicIdsBySubject((curr) => {
      const current = curr[subjectId] || [];
      if (current.includes(topicId)) return curr;
      return { ...curr, [subjectId]: [...current, topicId] };
    });

    const max = getAvailableCountForTopic(subjectId, topicId, config, normalizedSelections);
    setTopicCountById((curr) => {
      const current = Number(curr[topicId] ?? 0);
      const safeCurrent = Number.isFinite(current) ? Math.floor(current) : 0;
      const fallbackCount = max > 0 ? Math.min(10, Math.max(1, max)) : 0;
      const boundedCount = safeCurrent > 0
        ? Math.max(0, Math.min(safeCurrent, Math.max(0, max)))
        : fallbackCount;
      return { ...curr, [topicId]: boundedCount };
    });
  };

  const updateSubjectConfig = (subjectId: string, patch: Partial<SubjectConfig>) => {
    setSubjectConfigById((curr) => {
      const previous = curr[subjectId] || getDefaultSubjectConfig(subjectId);
      const merged = { ...previous, ...patch };
      const availableYears = getAvailablePreviousYearsForSubject(subjectId, merged);
      const next = {
        ...merged,
        previousYears: sanitizeSelectedPreviousYears(merged.previousYears || [], availableYears),
      };
      const max = getAvailableCountForSubject(subjectId, next);
      const boundedCount = Math.max(1, Math.min(Number(next.count || 1), Math.max(1, max)));
      return {
        ...curr,
        [subjectId]: { ...next, count: boundedCount },
      };
    });
    const mergedConfig = { ...(subjectConfigById[subjectId] || getDefaultSubjectConfig(subjectId)), ...patch };
    const mergedAvailableYears = getAvailablePreviousYearsForSubject(subjectId, mergedConfig);
    const nextConfig = {
      ...mergedConfig,
      previousYears: sanitizeSelectedPreviousYears(mergedConfig.previousYears || [], mergedAvailableYears),
    };
    const selectedTopicIds = selectedTopicIdsBySubject[subjectId] || [];
    if (selectedTopicIds.length > 0) {
      const sanitizedSubtopicPathsByTopicId: Record<string, string[]> = {};
      selectedTopicIds.forEach((topicId) => {
        const pathPool = getSubtopicPathPoolForTopic(subjectId, topicId, nextConfig);
        const currentSelections = normalizeSubtopicPathSelections(selectedSubtopicPathsByTopicId[topicId] || []);
        sanitizedSubtopicPathsByTopicId[topicId] = currentSelections.filter((selection) =>
          hasMatchingSubtopicPrefix(pathPool, parseSubtopicPathSelection(selection))
        );
      });

      setSelectedSubtopicPathsByTopicId((curr) => {
        let changed = false;
        const next = { ...curr };
        selectedTopicIds.forEach((topicId) => {
          const sanitizedSelections = sanitizedSubtopicPathsByTopicId[topicId] || [];
          const currentSelections = normalizeSubtopicPathSelections(curr[topicId] || []);
          const sameLength = sanitizedSelections.length === currentSelections.length;
          const sameValues = sameLength && sanitizedSelections.every((value, index) => value === currentSelections[index]);
          if (sameValues) return;
          next[topicId] = sanitizedSelections;
          changed = true;
        });
        return changed ? next : curr;
      });

      setTopicCountById((curr) => {
        const next = { ...curr };
        selectedTopicIds.forEach((topicId) => {
          const selectedSubtopicPaths = sanitizedSubtopicPathsByTopicId[topicId] || [];
          const max = getAvailableCountForTopic(subjectId, topicId, nextConfig, selectedSubtopicPaths);
          const current = Number(next[topicId] ?? 0);
          const safeCurrent = Number.isFinite(current) ? Math.floor(current) : 0;
          next[topicId] = Math.max(0, Math.min(safeCurrent, Math.max(0, max)));
        });
        return next;
      });
    }
  };

  const topicsBySubject = useMemo(() => {
    const map: Record<string, Topic[]> = {};
    (visibleSubjects || []).forEach((subject) => {
      map[subject.id] = (topics || []).filter((topic) => topic.subjectId === subject.id);
    });
    return map;
  }, [visibleSubjects, topics]);

  const getSubtopicPathPoolForTopic = (subjectId: string, topicId: string, _config: SubjectConfig) => {
    void _config;
    const uniquePaths = new Map<string, string[]>();
    const topicMeta = (topics || []).find((topic) => topic.id === topicId && topic.subjectId === subjectId);
    if (topicMeta) {
      addSubtopicPathsToMap(uniquePaths, [
        ...(topicMeta.subtopics || []),
        ...(topicMeta.subtopicPaths || []),
        ...(topicMeta.subtopicCatalog || []),
      ]);
    }
    teacherScopedQuestionEntries
      .filter((entry) => entry.subjectId === subjectId && entry.topicId === topicId)
      .forEach((entry) => {
        addSubtopicPathsToMap(uniquePaths, entry.subtopics);
      });
    return Array.from(uniquePaths.values()).sort((a, b) => a.join(' > ').localeCompare(b.join(' > ')));
  };
  const matchesPremiumTopicConfigQuestion = (
    question: PracticeQuestion,
    config: PracticeTopicConfigSelection,
    scope: { examTypeId?: string; classId?: string; accessLevel?: 'free' | 'paid' } = {}
  ) => {
    const scopeExamTypeId = scope.examTypeId || examTypeId;
    const scopeClassId = scope.classId || classId;
    const scopeAccessLevel = scope.accessLevel || expectedAccessLevel;
    if (!scopeExamTypeId || !scopeClassId) return false;
    return getPracticeQuestionScopeEntries(question).some((entry) =>
      scopeEntryMatchesSelection(entry, scopeExamTypeId, scopeClassId, scopeAccessLevel)
      && scopeEntryMatchesConfig(entry, config)
    );
  };
  const isOfferLinkedPremiumPurchase = isReusablePremiumPracticePurchase(selectedPremiumPurchase);
  const isAdminAssignedReusablePremiumPurchase = isAdminAssignedPremiumPracticePurchase(selectedPremiumPurchase);
  const selectedPremiumPurchaseMatchesCurrentScope = Boolean(
    selectedPremiumPurchase
    && selectedPremiumPurchase.examTypeId === examTypeId
    && selectedPremiumPurchase.classId === classId
  );
  const selectedPremiumPurchaseIncludedTopicConfigs = useMemo(() => {
    if (!selectedPremiumPurchaseMatchesCurrentScope || !selectedPremiumPurchase) return [] as PremiumPracticeDisplayTopicConfig[];
    if (isOfferLinkedPremiumPurchase) {
      const preservedIncludedConfigs = normalizePremiumPracticeDisplayTopicConfigs(selectedPremiumPurchase.includedTopicConfigs);
      if (preservedIncludedConfigs.length > 0) return preservedIncludedConfigs;
    }
    return normalizePremiumPracticeDisplayTopicConfigs(selectedPremiumPurchase.topicConfigs);
  }, [isOfferLinkedPremiumPurchase, selectedPremiumPurchase, selectedPremiumPurchaseMatchesCurrentScope]);
  const selectedPremiumPurchaseDisplayTopicConfigs = useMemo(() => {
    if (!selectedPremiumPurchase) return [] as PremiumPracticeDisplayTopicConfig[];
    if (isOfferLinkedPremiumPurchase) {
      const preservedIncludedConfigs = normalizePremiumPracticeDisplayTopicConfigs(selectedPremiumPurchase.includedTopicConfigs);
      if (preservedIncludedConfigs.length > 0) return preservedIncludedConfigs;
    }
    return normalizePremiumPracticeDisplayTopicConfigs(selectedPremiumPurchase.topicConfigs);
  }, [isOfferLinkedPremiumPurchase, selectedPremiumPurchase]);
  const premiumPracticeConfigSpecificity = (config: Pick<PremiumPracticeTopicConfig, 'questionType' | 'previousYearMode' | 'previousYears' | 'subtopics'>) => {
    const normalizedSubtopics = normalizeSubtopicPathSelections(config.subtopics || []);
    return (
      (normalizedSubtopics.length * 100)
      + (config.previousYearMode === 'pyq' ? 20 : 0)
      + ((config.previousYears || []).length * 5)
      + (config.questionType !== 'All' ? 1 : 0)
    );
  };

  const paidTeacherQuestions = useMemo(
    () => (
      (questions || [])
        .filter((question) =>
          getPracticeQuestionScopeEntries(question).some((entry) => entry.accessLevel === 'paid' && !entry.mockTestOnly)
        )
        .sort((left, right) => left.id.localeCompare(right.id))
    ),
    [questions]
  );
  const selectedPremiumPurchaseStoredIncludedQuestionIds = useMemo(
    () => normalizeQuestionIdList(selectedPremiumPurchase?.includedQuestionIds),
    [selectedPremiumPurchase?.includedQuestionIds]
  );
  const selectedPremiumPurchaseHistoricalIncludedQuestionIds = useMemo(
    () => (
      isOfferLinkedPremiumPurchase
        ? normalizeQuestionIdList(selectedPremiumPurchase?.questionIds)
        : []
    ),
    [isOfferLinkedPremiumPurchase, selectedPremiumPurchase?.questionIds]
  );
  const selectedPremiumPurchaseScopeQuestions = useMemo(() => {
    if (!isOfferLinkedPremiumPurchase || !selectedPremiumPurchase?.examTypeId || !selectedPremiumPurchase?.classId) {
      return [] as PracticeQuestion[];
    }
    return paidTeacherQuestions.filter(
      (question) => getPracticeQuestionScopeEntries(question).some((entry) =>
        scopeEntryMatchesSelection(
          entry,
          selectedPremiumPurchase.examTypeId || '',
          selectedPremiumPurchase.classId || '',
          'paid'
        )
      )
    );
  }, [
    isOfferLinkedPremiumPurchase,
    paidTeacherQuestions,
    selectedPremiumPurchase?.classId,
    selectedPremiumPurchase?.examTypeId,
  ]);
  const selectedPremiumPurchaseScopeQuestionById = useMemo(
    () => new Map(selectedPremiumPurchaseScopeQuestions.map((question) => [question.id, question])),
    [selectedPremiumPurchaseScopeQuestions]
  );
  const selectedPremiumPurchaseReusableQuestionIds = useMemo(() => {
    if (!isOfferLinkedPremiumPurchase) return [] as string[];
    const purchaseScope = {
      examTypeId: selectedPremiumPurchase?.examTypeId || '',
      classId: selectedPremiumPurchase?.classId || '',
      accessLevel: 'paid' as const,
    };

    const targetCount = Math.max(
      getPremiumPracticeIncludedQuestionCountFromRecord(selectedPremiumPurchase),
      selectedPremiumPurchaseStoredIncludedQuestionIds.length,
      selectedPremiumPurchaseHistoricalIncludedQuestionIds.length
    );
    if (targetCount <= 0 || selectedPremiumPurchaseScopeQuestions.length === 0) {
      return [] as string[];
    }

    const candidateQuestions = selectedPremiumPurchaseScopeQuestions.filter((question) => (
      selectedPremiumPurchaseDisplayTopicConfigs.length === 0
        ? true
        : selectedPremiumPurchaseDisplayTopicConfigs.some((config) =>
            matchesPremiumTopicConfigQuestion(question, config, purchaseScope)
          )
    ));
    if (candidateQuestions.length === 0) {
      return [] as string[];
    }

    const candidateQuestionIdSet = new Set(candidateQuestions.map((question) => question.id));
    const seedQuestionIds = [
      ...selectedPremiumPurchaseStoredIncludedQuestionIds,
      ...selectedPremiumPurchaseHistoricalIncludedQuestionIds.filter((questionId) =>
        !selectedPremiumPurchaseStoredIncludedQuestionIds.includes(questionId)
      ),
    ].filter((questionId) => candidateQuestionIdSet.has(questionId));
    const requiredCount = Math.max(targetCount, seedQuestionIds.length);

    if (selectedPremiumPurchaseDisplayTopicConfigs.length === 0) {
      return [
        ...seedQuestionIds,
        ...candidateQuestions
          .map((question) => question.id)
          .filter((questionId) => !seedQuestionIds.includes(questionId)),
      ].slice(0, requiredCount);
    }

    const includedSlots = selectedPremiumPurchaseDisplayTopicConfigs.flatMap((config, configIndex) => {
      const slotCount = Math.max(0, Math.floor(Number(config.count || 0)));
      return Array.from({ length: slotCount }, (_, slotIndex) => ({
        id: `${configIndex}:${slotIndex}`,
        config,
        specificity: premiumPracticeConfigSpecificity(config),
      }));
    });

    const candidateEntries = candidateQuestions
      .map((question) => {
        const matchingSlotIds = includedSlots
          .filter((slot) => matchesPremiumTopicConfigQuestion(question, slot.config, purchaseScope))
          .sort((left, right) => right.specificity - left.specificity || left.id.localeCompare(right.id))
          .map((slot) => slot.id);
        if (matchingSlotIds.length === 0) return null;
        return {
          questionId: question.id,
          matchingSlotIds,
        };
      })
      .filter((entry): entry is { questionId: string; matchingSlotIds: string[] } => !!entry);

    const candidateByQuestionId = new Map(candidateEntries.map((entry) => [entry.questionId, entry]));
    const slotToQuestionId = new Map<string, string>();
    const questionToSlotId = new Map<string, string>();

    const assignQuestionToSlot = (questionId: string, visitedSlotIds: Set<string>): boolean => {
      const candidate = candidateByQuestionId.get(questionId);
      if (!candidate) return false;

      for (const slotId of candidate.matchingSlotIds) {
        if (visitedSlotIds.has(slotId)) continue;
        visitedSlotIds.add(slotId);

        const assignedQuestionId = slotToQuestionId.get(slotId);
        if (!assignedQuestionId || assignQuestionToSlot(assignedQuestionId, visitedSlotIds)) {
          slotToQuestionId.set(slotId, questionId);
          questionToSlotId.set(questionId, slotId);
          return true;
        }
      }

      return false;
    };

    seedQuestionIds.forEach((questionId) => {
      assignQuestionToSlot(questionId, new Set<string>());
    });

    [...candidateEntries]
      .filter((entry) => !questionToSlotId.has(entry.questionId))
      .sort((left, right) => left.matchingSlotIds.length - right.matchingSlotIds.length || left.questionId.localeCompare(right.questionId))
      .forEach((candidate) => {
        assignQuestionToSlot(candidate.questionId, new Set<string>());
      });

    const assignedQuestionIds = [
      ...seedQuestionIds.filter((questionId) => questionToSlotId.has(questionId)),
      ...candidateQuestions
        .map((question) => question.id)
        .filter((questionId) => questionToSlotId.has(questionId) && !seedQuestionIds.includes(questionId)),
    ];

    return [
      ...assignedQuestionIds,
      ...seedQuestionIds.filter((questionId) => !assignedQuestionIds.includes(questionId)),
      ...candidateQuestions
        .map((question) => question.id)
        .filter((questionId) => !assignedQuestionIds.includes(questionId) && !seedQuestionIds.includes(questionId)),
    ].slice(0, requiredCount);
  }, [
    isOfferLinkedPremiumPurchase,
    matchesPremiumTopicConfigQuestion,
    premiumPracticeConfigSpecificity,
    selectedPremiumPurchase,
    selectedPremiumPurchaseDisplayTopicConfigs,
    selectedPremiumPurchaseHistoricalIncludedQuestionIds,
    selectedPremiumPurchaseScopeQuestions,
    selectedPremiumPurchaseStoredIncludedQuestionIds,
  ]);
  const selectedPremiumPurchaseReusableQuestionIdSet = useMemo(
    () => new Set(selectedPremiumPurchaseReusableQuestionIds),
    [selectedPremiumPurchaseReusableQuestionIds]
  );
  const selectedPremiumPurchaseReusableQuestionCount = selectedPremiumPurchaseReusableQuestionIds.length;
  const selectedPremiumPurchaseStoredIncludedQuestionIdsKey = selectedPremiumPurchaseStoredIncludedQuestionIds.join('|');
  const selectedPremiumPurchaseReusableQuestionIdsKey = selectedPremiumPurchaseReusableQuestionIds.join('|');
  const reusablePracticeOfferAllocationSyncRef = useRef('');
  useEffect(() => {
    if (
      !firestore
      || !user?.uid
      || !isOfferLinkedPremiumPurchase
      || !selectedPremiumPurchase?.id
      || selectedPremiumPurchaseReusableQuestionIds.length === 0
    ) {
      return;
    }

    const normalizedStoredCount = Math.max(0, Number(selectedPremiumPurchase?.includedQuestionCount || 0));
    const desiredCount = Math.max(normalizedStoredCount, selectedPremiumPurchaseReusableQuestionIds.length);
    const needsIdSync = selectedPremiumPurchaseStoredIncludedQuestionIdsKey !== selectedPremiumPurchaseReusableQuestionIdsKey;
    const needsCountSync = desiredCount !== normalizedStoredCount;
    if (!needsIdSync && !needsCountSync) {
      return;
    }

    const syncKey = `${selectedPremiumPurchase.id}__${selectedPremiumPurchaseReusableQuestionIdsKey}__${desiredCount}`;
    if (reusablePracticeOfferAllocationSyncRef.current === syncKey) {
      return;
    }
    reusablePracticeOfferAllocationSyncRef.current = syncKey;

    void setDocumentNonBlocking(
      doc(firestore, 'users', user.uid, 'premium_practice_session_purchases', selectedPremiumPurchase.id),
      {
        includedQuestionIds: selectedPremiumPurchaseReusableQuestionIds,
        ...(needsCountSync ? { includedQuestionCount: desiredCount } : {}),
      },
      { merge: true }
    );
  }, [
    firestore,
    isOfferLinkedPremiumPurchase,
    selectedPremiumPurchase?.id,
    selectedPremiumPurchase?.includedQuestionCount,
    selectedPremiumPurchaseReusableQuestionIds,
    selectedPremiumPurchaseReusableQuestionIdsKey,
    selectedPremiumPurchaseStoredIncludedQuestionIdsKey,
    user?.uid,
  ]);

  const normalizedTopicConfigs = useMemo(() => {
    const result: Array<{
      subjectId: string;
      topicId: string;
      subtopics: string[];
      questionType: 'All' | 'MCQ' | 'Numerical';
      difficultyLevel: DifficultyLevel;
      previousYearMode: QuestionSourceMode;
      previousYears: string[];
      count: number;
    }> = [];

    selectedSubjectIds.forEach((subjectId) => {
      const config = subjectConfigById[subjectId] || getDefaultSubjectConfig(subjectId);
      const selectedTopics = selectedTopicIdsBySubject[subjectId] || [];
      selectedTopics.forEach((topicId) => {
        const selectedSubtopicPaths = normalizeSubtopicPathSelections(selectedSubtopicPathsByTopicId[topicId] || []);
        const max = getAvailableCountForTopic(subjectId, topicId, config, selectedSubtopicPaths);
        if (max <= 0) return;
        const rawRequested = Number(topicCountById[topicId] ?? 0);
        const safeRequested = Number.isFinite(rawRequested) ? Math.floor(rawRequested) : 0;
        const requested = Math.max(0, Math.min(safeRequested, max));
        if (requested <= 0) return;
        result.push({
          subjectId,
          topicId,
          subtopics: selectedSubtopicPaths,
          questionType: config.questionType,
          difficultyLevel: 'Easy' as const,
          previousYearMode: config.questionSource,
          previousYears: config.previousYears,
          count: requested,
        });
      });
    });

    return result;
  }, [selectedSubjectIds, subjectConfigById, selectedTopicIdsBySubject, selectedSubtopicPathsByTopicId, topicCountById, teacherScopedQuestions]);

  const selectedCountSummary = useMemo(() => normalizedTopicConfigs.reduce((acc, item) => acc + item.count, 0), [normalizedTopicConfigs]);
  const resolvedRegularQuestionIds = useMemo(() => {
    if (isPremiumMode) return [] as string[];

    const usedQuestionIds = new Set<string>();
    const resolvedQuestionIds: string[] = [];
    const prioritizedConfigs = [...normalizedTopicConfigs]
      .sort((left, right) => premiumPracticeConfigSpecificity(right) - premiumPracticeConfigSpecificity(left));

    prioritizedConfigs.forEach((config) => {
      let remainingDemand = Math.max(0, Number(config.count || 0));
      if (remainingDemand <= 0) return;

      const candidateQuestionIds = teacherScopedQuestions
        .filter((question) =>
          !usedQuestionIds.has(question.id)
          && matchesPremiumTopicConfigQuestion(question, config, {
            examTypeId,
            classId,
            accessLevel: expectedAccessLevel,
          })
        )
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((question) => question.id);

      for (const questionId of candidateQuestionIds) {
        if (remainingDemand <= 0) break;
        usedQuestionIds.add(questionId);
        resolvedQuestionIds.push(questionId);
        remainingDemand -= 1;
      }
    });

    return resolvedQuestionIds;
  }, [
    classId,
    examTypeId,
    expectedAccessLevel,
    isPremiumMode,
    normalizedTopicConfigs,
    premiumPracticeConfigSpecificity,
    teacherScopedQuestions,
  ]);
  const existingPremiumQuestionIds = useMemo(
    () => normalizeQuestionIdList(selectedPremiumPurchase?.questionIds),
    [selectedPremiumPurchase?.questionIds]
  );
  const teacherScopedQuestionById = useMemo(
    () => new Map(teacherScopedQuestions.map((question) => [question.id, question])),
    [teacherScopedQuestions]
  );
  const resolvedPremiumQuestionIds = useMemo(() => {
    if (!isPremiumMode) return [] as string[];

    const prioritizedConfigs = [...normalizedTopicConfigs]
      .sort((left, right) => premiumPracticeConfigSpecificity(right) - premiumPracticeConfigSpecificity(left));

    if (isOfferLinkedPremiumPurchase) {
      const currentScopeReusableQuestionIds = selectedPremiumPurchaseMatchesCurrentScope
        ? selectedPremiumPurchaseReusableQuestionIds.filter((questionId) => teacherScopedQuestionById.has(questionId))
        : [];
      const currentScopeReusableQuestionIdSet = new Set(currentScopeReusableQuestionIds);
      const existingMatchingQuestionIds = existingPremiumQuestionIds.filter((questionId) => {
        const question = teacherScopedQuestionById.get(questionId);
        return question && prioritizedConfigs.some((config) => matchesPremiumTopicConfigQuestion(question, config));
      });
      const existingMatchingIncludedQuestionIds = existingMatchingQuestionIds.filter((questionId) =>
        currentScopeReusableQuestionIdSet.has(questionId)
      );
      const existingMatchingPaidQuestionIds = existingMatchingQuestionIds.filter((questionId) =>
        !currentScopeReusableQuestionIdSet.has(questionId)
      );
      const existingMatchingPaidQuestionIdSet = new Set(existingMatchingPaidQuestionIds);
      const usedIds = new Set<string>();
      const resolvedIds: string[] = [];

      prioritizedConfigs.forEach((config) => {
        let remainingDemand = Math.max(0, Number(config.count || 0));
        if (remainingDemand <= 0) return;

        const tryAddQuestionIds = (questionIds: string[]) => {
          for (const questionId of questionIds) {
            if (remainingDemand <= 0) break;
            if (usedIds.has(questionId)) continue;
            const question = teacherScopedQuestionById.get(questionId);
            if (!question || !matchesPremiumTopicConfigQuestion(question, config)) continue;
            usedIds.add(questionId);
            resolvedIds.push(questionId);
            remainingDemand -= 1;
          }
        };

        tryAddQuestionIds(existingMatchingIncludedQuestionIds);
        tryAddQuestionIds(currentScopeReusableQuestionIds);
        tryAddQuestionIds(existingMatchingPaidQuestionIds);

        const nextIds = teacherScopedQuestions
          .filter((question) =>
            !usedIds.has(question.id)
            && !currentScopeReusableQuestionIdSet.has(question.id)
            && !existingMatchingPaidQuestionIdSet.has(question.id)
            && matchesPremiumTopicConfigQuestion(question, config)
          )
          .sort((left, right) => left.id.localeCompare(right.id))
          .map((question) => question.id);

        tryAddQuestionIds(nextIds);
      });

      return resolvedIds;
    }

    const preservedIds = [...existingPremiumQuestionIds];
    const usedIds = new Set(preservedIds);
    const appendedIds: string[] = [];

    normalizedTopicConfigs.forEach((config) => {
      const preservedCountForConfig = preservedIds.reduce((count, questionId) => {
        const question = teacherScopedQuestionById.get(questionId);
        return count + (question && matchesPremiumTopicConfigQuestion(question, config) ? 1 : 0);
      }, 0);
      const requiredAdditionalCount = Math.max(0, config.count - preservedCountForConfig);
      if (requiredAdditionalCount <= 0) return;

      const nextIds = teacherScopedQuestions
        .filter((question) => !usedIds.has(question.id) && matchesPremiumTopicConfigQuestion(question, config))
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, requiredAdditionalCount)
        .map((question) => question.id);

      nextIds.forEach((questionId) => usedIds.add(questionId));
      appendedIds.push(...nextIds);
    });

    return [...preservedIds, ...appendedIds];
  }, [
    existingPremiumQuestionIds,
    isOfferLinkedPremiumPurchase,
    isPremiumMode,
    matchesPremiumTopicConfigQuestion,
    normalizedTopicConfigs,
    premiumPracticeConfigSpecificity,
    selectedPremiumPurchaseMatchesCurrentScope,
    selectedPremiumPurchaseReusableQuestionIds,
    teacherScopedQuestionById,
    teacherScopedQuestions,
  ]);
  const selectedSubtopicCount = useMemo(
    () => Object.values(selectedSubtopicPathsByTopicId).reduce((acc, list) => acc + list.length, 0),
    [selectedSubtopicPathsByTopicId]
  );
  const premiumPracticeAttemptRule = useMemo(
    () => resolvePremiumPracticeAttemptPricingRule({
      scopedPricingMap: teacher?.premiumPracticeAttemptPricingByScope,
      examTypeId,
      classId,
    }),
    [teacher?.premiumPracticeAttemptPricingByScope, examTypeId, classId]
  );
  const premiumAttemptUsageByPurchaseId = useMemo(() => {
    return Object.fromEntries(
      premiumPurchasesForTeacher.map((purchase) => {
        const purchaseId = purchase.id || '';
        const fallbackAttemptRule = resolvePremiumPracticeAttemptPricingRule({
          scopedPricingMap: teacher?.premiumPracticeAttemptPricingByScope,
          examTypeId: purchase.examTypeId,
          classId: purchase.classId,
        });
        const usage = resolvePremiumPracticeAttemptUsage({
          attemptPricing: purchase.attemptPricing || fallbackAttemptRule,
          attemptState: purchase.attemptState,
          purchasedAt: purchase.purchasedAt,
        });
        return [purchaseId, usage];
      })
    ) as Record<string, ReturnType<typeof resolvePremiumPracticeAttemptUsage>>;
  }, [premiumPurchasesForTeacher, teacher?.premiumPracticeAttemptPricingByScope]);
  const selectedQuestionCountByDifficulty = useMemo(() => {
    return normalizedTopicConfigs.reduce(
      (acc, item) => {
        acc[item.difficultyLevel] += item.count;
        return acc;
      },
      { Easy: 0, Medium: 0, Hard: 0 } as Record<DifficultyLevel, number>
    );
  }, [normalizedTopicConfigs]);
  const premiumQuestionPricingBreakdown = useMemo<DcamQuestionPricingBreakdown>(() => {
    return buildDcamQuestionPricingBreakdown({
      questionIds: resolvedPremiumQuestionIds,
      questionById: teacherScopedQuestionById,
      profile: teacher,
      mode: 'practice',
      examTypeId,
      classId,
    });
  }, [classId, examTypeId, resolvedPremiumQuestionIds, teacher, teacherScopedQuestionById]);
  const premiumPracticeQuestionPriceByDifficulty = premiumQuestionPricingBreakdown.averagePriceByDifficulty;
  const premiumAmountByDifficulty = premiumQuestionPricingBreakdown.amountByDifficulty;
  const hasAnyPremiumPracticePricing = useMemo(
    () => premiumQuestionPricingBreakdown.rows.some((row) => row.unitPrice > 0),
    [premiumQuestionPricingBreakdown.rows]
  );

  const perQuestionTimeSeconds = useMemo(() => {
    const trimmed = perQuestionTimeSecondsInput.trim();
    if (!trimmed) return null;
    const parsed = Math.floor(Number(trimmed));
    if (!Number.isFinite(parsed)) return null;
    return Math.max(5, Math.min(parsed, 3600));
  }, [perQuestionTimeSecondsInput]);
  const premiumPayableAmount = premiumQuestionPricingBreakdown.totalAmount;
  const averagePremiumQuestionPrice = useMemo(() => {
    if (resolvedPremiumQuestionIds.length <= 0) return 0;
    return Number((premiumPayableAmount / resolvedPremiumQuestionIds.length).toFixed(2));
  }, [premiumPayableAmount, resolvedPremiumQuestionIds.length]);
  const selectedPremiumPurchasePaidAmount = Number(selectedPremiumPurchase?.grossAmount || 0);
  const selectedPremiumPurchaseAttemptsPaidAmount = Number(selectedPremiumPurchase?.attemptsPaidAmount || 0);
  const selectedPremiumPurchaseQuestionCount = useMemo(() => {
    if (!selectedPremiumPurchase) return 0;
    if (isOfferLinkedPremiumPurchase) {
      return Math.max(
        getPremiumPracticeIncludedQuestionCountFromRecord(selectedPremiumPurchase),
        selectedPremiumPurchaseReusableQuestionCount
      );
    }
    return existingPremiumQuestionIds.length || Math.max(0, Number(selectedPremiumPurchase.questionCount || 0));
  }, [
    existingPremiumQuestionIds.length,
    isOfferLinkedPremiumPurchase,
    selectedPremiumPurchase,
    selectedPremiumPurchaseReusableQuestionCount,
  ]);
  const includedPremiumQuestionIds = useMemo(() => {
    if (!isPremiumMode || !isOfferLinkedPremiumPurchase || !selectedPremiumPurchaseMatchesCurrentScope) {
      return [] as string[];
    }
    if (selectedPremiumPurchaseReusableQuestionCount <= 0 || resolvedPremiumQuestionIds.length === 0) {
      return [] as string[];
    }
    return resolvedPremiumQuestionIds.filter((questionId) => selectedPremiumPurchaseReusableQuestionIdSet.has(questionId));
  }, [
    isOfferLinkedPremiumPurchase,
    isPremiumMode,
    resolvedPremiumQuestionIds,
    selectedPremiumPurchaseMatchesCurrentScope,
    selectedPremiumPurchaseReusableQuestionCount,
    selectedPremiumPurchaseReusableQuestionIdSet,
  ]);
  const includedPremiumQuestionCountByDifficulty = useMemo(
    () => countQuestionIdsByDifficulty(includedPremiumQuestionIds, teacherScopedQuestionById),
    [includedPremiumQuestionIds, teacherScopedQuestionById]
  );
  const premiumAdditionalQuestionIds = useMemo(() => {
    if (!isPremiumMode) return [] as string[];
    if (!selectedPremiumPurchase) return resolvedPremiumQuestionIds;
    if (isOfferLinkedPremiumPurchase) {
      const existingSavedQuestionIds = new Set(existingPremiumQuestionIds);
      return resolvedPremiumQuestionIds.filter(
        (questionId) =>
          !includedPremiumQuestionIds.includes(questionId)
          && !existingSavedQuestionIds.has(questionId)
      );
    }
    return resolvedPremiumQuestionIds.slice(selectedPremiumPurchaseQuestionCount);
  }, [
    existingPremiumQuestionIds,
    includedPremiumQuestionIds,
    isOfferLinkedPremiumPurchase,
    isPremiumMode,
    resolvedPremiumQuestionIds,
    selectedPremiumPurchase,
    selectedPremiumPurchaseQuestionCount,
  ]);
  const premiumAdditionalQuestionPricingBreakdown = useMemo<DcamQuestionPricingBreakdown>(() => {
    return buildDcamQuestionPricingBreakdown({
      questionIds: premiumAdditionalQuestionIds,
      questionById: teacherScopedQuestionById,
      profile: teacher,
      mode: 'practice',
      examTypeId,
      classId,
    });
  }, [classId, examTypeId, premiumAdditionalQuestionIds, teacher, teacherScopedQuestionById]);
  const premiumPricingMissing = isPremiumMode && (
    selectedPremiumPurchase
      ? premiumAdditionalQuestionPricingBreakdown.missingPricing
      : premiumQuestionPricingBreakdown.missingPricing
  );
  const selectedPremiumPurchaseAttemptUsage = selectedPremiumPurchase
    ? premiumAttemptUsageByPurchaseId[selectedPremiumPurchase.id || '']
    : null;
  const selectedPremiumPurchaseAttemptActionKind: PremiumPracticeAttemptActionKind =
    selectedPremiumPurchaseAttemptUsage?.isExhausted ? selectedPremiumPurchaseAttemptUsage.actionKind : 'none';
  const selectedPremiumPurchaseAttemptCharge = selectedPremiumPurchaseAttemptUsage?.isExhausted
    ? selectedPremiumPurchaseAttemptUsage.actionAmount
    : 0;
  const selectedPremiumPurchaseAttemptBlocked =
    !!selectedPremiumPurchase
    && !!selectedPremiumPurchaseAttemptUsage?.isExhausted
    && selectedPremiumPurchaseAttemptActionKind === 'none';
  const additionalPremiumPayableAmount = isPremiumMode
    ? premiumAdditionalQuestionPricingBreakdown.totalAmount
    : 0;
  const totalPremiumPayableNow = useMemo(() => {
    if (!isPremiumMode) return 0;
    if (!selectedPremiumPurchase) return premiumPayableAmount;
    return Number((additionalPremiumPayableAmount + selectedPremiumPurchaseAttemptCharge).toFixed(2));
  }, [additionalPremiumPayableAmount, isPremiumMode, premiumPayableAmount, selectedPremiumPurchase, selectedPremiumPurchaseAttemptCharge]);
  const isEditingPremiumPurchase = isPremiumMode && !!selectedPremiumPurchase;
  const cannotReducePremiumQuestionCount =
    isEditingPremiumPurchase
    && !isOfferLinkedPremiumPurchase
    && selectedCountSummary < selectedPremiumPurchaseQuestionCount;
  const premiumQuestionSelectionShortfall = isPremiumMode ? Math.max(0, selectedCountSummary - resolvedPremiumQuestionIds.length) : 0;
  const regularQuestionSelectionShortfall = !isPremiumMode ? Math.max(0, selectedCountSummary - resolvedRegularQuestionIds.length) : 0;
  const hasConfigToStart = normalizedTopicConfigs.length > 0 && selectedCountSummary > 0;
  const canStartPractice = hasConfigToStart && !isPaymentProcessing && regularQuestionSelectionShortfall === 0 && (
    !isPremiumMode || (!premiumPricingMissing
      && !cannotReducePremiumQuestionCount
      && premiumQuestionSelectionShortfall === 0
      && !selectedPremiumPurchaseAttemptBlocked
      && (selectedPremiumPurchase ? true : premiumPayableAmount > 0))
  );
  const hasCustomTimer = perQuestionTimeSeconds !== null;
  const selectedSubjectsCount = selectedSubjectIds.length;
  const actionSummaryText = cannotReducePremiumQuestionCount
    ? `Saved practice has ${selectedPremiumPurchaseQuestionCount} questions. Add more only.`
    : premiumQuestionSelectionShortfall > 0
      ? 'Reduce counts or adjust filters.'
      : regularQuestionSelectionShortfall > 0
        ? 'Reduce counts or adjust filters.'
      : selectedPremiumPurchaseAttemptBlocked
        ? 'No attempts available for this pack.'
        : premiumPricingMissing
          ? 'Premium price unavailable.'
          : canStartPractice
            ? (isPremiumMode
              ? `Ready: ${selectedCountSummary} questions - INR ${totalPremiumPayableNow.toLocaleString()}`
              : `Ready: ${selectedCountSummary} questions`)
            : 'Select topics and counts.';

  const selectPremiumPurchase = (purchaseId?: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (purchaseId) nextParams.set('premiumPurchaseId', purchaseId);
    else nextParams.delete('premiumPurchaseId');
    const nextQuery = nextParams.toString();
    router.replace(`/start-practice-session/${encodeURIComponent(teacherId)}${nextQuery ? `?${nextQuery}` : ''}`, { scroll: false });
  };

  useEffect(() => {
    if (!isPremiumMode || premiumPurchaseIdParam || !examTypeId || !classId) return;
    const matchingOfferPurchase = premiumPurchasesForTeacher.find((purchase) =>
      purchase.examTypeId === examTypeId
      && purchase.classId === classId
      && isReusablePremiumPracticePurchase(purchase)
    );
    if (!matchingOfferPurchase?.id) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('premiumPurchaseId', matchingOfferPurchase.id);
    const nextQuery = nextParams.toString();
    router.replace(`/start-practice-session/${encodeURIComponent(teacherId)}${nextQuery ? `?${nextQuery}` : ''}`, { scroll: false });
  }, [
    classId,
    examTypeId,
    isPremiumMode,
    premiumPurchaseIdParam,
    premiumPurchasesForTeacher,
    router,
    searchParams,
    teacherId,
  ]);

  const navigateToPracticeSession = (premiumPurchaseId?: string) => {
    const sessionParams = new URLSearchParams();
    sessionParams.set('topicConfigs', JSON.stringify(normalizedTopicConfigs));
    sessionParams.set('teacherId', teacherId);
    sessionParams.set('examTypeId', examTypeId);
    sessionParams.set('classId', classId);
    sessionParams.set('teacherQuestionMode', expectedAccessLevel);
    sessionParams.set('practiceMode', practiceMode);
    sessionParams.set('accessLevel', expectedAccessLevel);
    if (perQuestionTimeSeconds !== null) {
      sessionParams.set('timeLimit', String(perQuestionTimeSeconds));
    }
    if (selectedExamName) {
      sessionParams.set('examTypeName', selectedExamName);
    }
    if (selectedClassName) {
      sessionParams.set('className', selectedClassName);
    }
    if (!isPremiumMode && resolvedRegularQuestionIds.length > 0) {
      sessionParams.set('questionIds', resolvedRegularQuestionIds.join(','));
    }
    if (premiumPurchaseId) {
      sessionParams.set('premiumPurchaseId', premiumPurchaseId);
    }
    router.push(`/practice/session?${sessionParams.toString()}`);
  };

  const navigateToExistingPremiumPractice = (purchase: PremiumPracticeSessionPurchase) => {
    router.push(buildPremiumPracticeSessionHref({
      ...purchase,
      id: purchase.id,
      teacherId: purchase.teacherId || teacherId,
      examTypeId: purchase.examTypeId,
      examTypeName: purchase.examTypeName || examNameById[purchase.examTypeId || ''] || '',
      classId: purchase.classId,
      className: purchase.className || classNameById[purchase.classId || ''] || '',
      topicConfigs: normalizePremiumPracticeDisplayTopicConfigs(purchase.topicConfigs),
    }));
  };

  const persistPremiumPracticePurchase = async ({
    paymentMeta,
    questionAmountPaid = 0,
    attemptAmountPaid = 0,
    attemptActionKind = 'none',
    serverWriteOnly = false,
  }: {
    paymentMeta?: { paymentId: string; orderId: string; amount: number; paidAt: string };
    questionAmountPaid?: number;
    attemptAmountPaid?: number;
    attemptActionKind?: PremiumPracticeAttemptActionKind;
    serverWriteOnly?: boolean;
  } = {}) => {
    if (!firestore || !user) throw new Error('Please sign in to continue.');

    const purchaseId = selectedPremiumPurchase?.id || paymentMeta?.paymentId;
    if (!purchaseId) throw new Error('Premium purchase id is missing.');

    const purchasedAt = selectedPremiumPurchase?.purchasedAt || paymentMeta?.paidAt || new Date().toISOString();
    const purchaseScopeChanged =
      !!selectedPremiumPurchase
      && (selectedPremiumPurchase.examTypeId !== examTypeId || selectedPremiumPurchase.classId !== classId);
    const activeAttemptPricingSnapshot =
      selectedPremiumPurchase?.attemptPricing && !purchaseScopeChanged
        ? selectedPremiumPurchase.attemptPricing
        : premiumPracticeAttemptRule;
    const effectiveAttemptUsage = resolvePremiumPracticeAttemptUsage({
      attemptPricing: activeAttemptPricingSnapshot,
      attemptState: selectedPremiumPurchase?.attemptState,
      purchasedAt,
    });
    const nextAttemptState =
      attemptActionKind !== 'none'
        ? applyPremiumPracticeAttemptTopUp({
            attemptPricing: activeAttemptPricingSnapshot,
            attemptState: selectedPremiumPurchase?.attemptState,
            purchasedAt,
            kind: attemptActionKind,
          })
        : effectiveAttemptUsage.effectiveState;
    const nextQuestionGrossAmount = Number(
      ((selectedPremiumPurchase ? selectedPremiumPurchasePaidAmount : 0) + questionAmountPaid).toFixed(2)
    );
    const nextAttemptsPaidAmount = Number(
      ((selectedPremiumPurchase ? selectedPremiumPurchaseAttemptsPaidAmount : 0) + attemptAmountPaid).toFixed(2)
    );
    const nextTotalAmountPaid = Number((nextQuestionGrossAmount + nextAttemptsPaidAmount).toFixed(2));
    const existingHistory = Array.isArray(selectedPremiumPurchase?.paymentHistory)
      ? selectedPremiumPurchase.paymentHistory.filter((entry) => entry && typeof entry.paymentId === 'string')
      : [];
    const paymentKind: PremiumPracticeAttemptPaymentKind =
      questionAmountPaid > 0 && attemptAmountPaid > 0
        ? 'mixed_update'
        : questionAmountPaid > 0
          ? (selectedPremiumPurchase ? 'question_upgrade' : 'question_purchase')
        : attemptActionKind === 'total_recharge'
          ? 'total_recharge'
          : attemptActionKind === 'interval_attempt'
            ? 'interval_attempt'
            : selectedPremiumPurchase
              ? 'question_upgrade'
              : 'question_purchase';
    const nextHistory = paymentMeta
      ? [
          ...existingHistory,
          {
            paymentId: paymentMeta.paymentId,
            orderId: paymentMeta.orderId,
            amount: paymentMeta.amount,
            paidAt: paymentMeta.paidAt,
            kind: paymentKind,
            questionAmount: Number(questionAmountPaid.toFixed(2)),
            attemptAmount: Number(attemptAmountPaid.toFixed(2)),
            attemptCount:
              attemptActionKind === 'total_recharge'
                ? effectiveAttemptUsage.effectiveRule.maxTotalAttempts || undefined
                : attemptActionKind === 'interval_attempt'
                  ? 1
                  : undefined,
          },
        ]
      : existingHistory;
    const preservedIncludedTopicConfigs = isOfferLinkedPremiumPurchase
      ? normalizePremiumPracticeTopicConfigs(
          selectedPremiumPurchase?.includedTopicConfigs || selectedPremiumPurchaseIncludedTopicConfigs || selectedPremiumPurchase?.topicConfigs
        )
      : [];
    const preservedIncludedQuestionCount = isOfferLinkedPremiumPurchase
      ? Math.max(
          getPremiumPracticeIncludedQuestionCountFromRecord(selectedPremiumPurchase),
          selectedPremiumPurchaseReusableQuestionCount
        )
      : 0;
    const preservedIncludedQuestionIds = isOfferLinkedPremiumPurchase
      ? selectedPremiumPurchaseReusableQuestionIds
      : [];
    const preservedIncludedQuestionCountByDifficulty = isOfferLinkedPremiumPurchase
      ? (
          preservedIncludedQuestionIds.length > 0
            ? (() => {
                const counts = countQuestionIdsByDifficulty(preservedIncludedQuestionIds, selectedPremiumPurchaseScopeQuestionById);
                return mergeLegacyDifficultyCounts({
                  easy: counts.Easy,
                  medium: counts.Medium,
                  hard: counts.Hard,
                });
              })()
            : mergeLegacyDifficultyCounts(
                selectedPremiumPurchase?.includedQuestionCountByDifficulty
                || selectedPremiumPurchase?.questionCountByDifficulty
                || undefined
              )
        )
      : undefined;

    const writeTimestamp = paymentMeta ? paymentMeta.paidAt : serverTimestamp();
    const purchaseData = {
        id: purchaseId,
        studentId: user.uid,
        teacherId,
        teacherName: fullName,
        examTypeId,
        examTypeName: selectedExamName || '',
        classId,
        className: selectedClassName || '',
        practiceMode: 'premium',
        status: 'paid',
        questionCount: resolvedPremiumQuestionIds.length,
        questionCountByDifficulty: {
          easy: selectedQuestionCountByDifficulty.Easy,
          medium: selectedQuestionCountByDifficulty.Medium,
          hard: selectedQuestionCountByDifficulty.Hard,
        },
        perQuestionPrice: averagePremiumQuestionPrice,
        perQuestionPriceByDifficulty: premiumPracticeQuestionPriceByDifficulty,
        amountByDifficulty: premiumAmountByDifficulty,
        grossAmount: nextQuestionGrossAmount,
        attemptsPaidAmount: nextAttemptsPaidAmount,
        totalAmountPaid: nextTotalAmountPaid,
        currency: 'INR',
        topicConfigs: normalizedTopicConfigs,
        ...(isOfferLinkedPremiumPurchase
          ? {
              includedQuestionCount: preservedIncludedQuestionCount,
              includedQuestionIds: preservedIncludedQuestionIds,
              includedQuestionCountByDifficulty: preservedIncludedQuestionCountByDifficulty || {},
              includedTopicConfigs: preservedIncludedTopicConfigs,
            }
          : {}),
        questionIds: resolvedPremiumQuestionIds,
        perQuestionTimeSeconds: perQuestionTimeSeconds ?? null,
        attemptPricing: activeAttemptPricingSnapshot,
        attemptState: nextAttemptState,
        purchasedAt,
        updatedAt: writeTimestamp,
        ...(selectedPremiumPurchase?.createdAt ? {} : { createdAt: writeTimestamp }),
        ...(paymentMeta ? { lastPaymentId: paymentMeta.paymentId, paymentHistory: nextHistory } : {}),
      };

    if (!serverWriteOnly) {
      await setDoc(
        doc(firestore, 'users', user.uid, 'premium_practice_session_purchases', purchaseId),
        purchaseData,
      { merge: true }
    );
    }

    return { purchaseId, purchaseData };
  };

  const ensureRazorpayCheckout = () => {
    if (typeof window === 'undefined') return Promise.resolve(false);
    if (window.Razorpay) return Promise.resolve(true);

    const existingScript = document.getElementById('razorpay-checkout-js') as HTMLScriptElement | null;
    if (existingScript) {
      return new Promise<boolean>((resolve) => {
        const finish = () => resolve(Boolean(window.Razorpay));
        existingScript.addEventListener('load', finish, { once: true });
        existingScript.addEventListener('error', () => resolve(false), { once: true });
        window.setTimeout(finish, 3000);
      });
    }

    return new Promise<boolean>((resolve) => {
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-js';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(Boolean(window.Razorpay));
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const startPractice = async () => {
    if (!canStartPractice) return;
    if (!isPremiumMode) {
      navigateToPracticeSession();
      return;
    }

    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Sign-in required',
        description: 'Please sign in to continue with premium practice.',
      });
      return;
    }
    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      toast({
        variant: 'destructive',
        title: 'Payment setup missing',
        description: 'Razorpay key is not configured for this app.',
      });
      return;
    }
    const paymentGatewayReady = await ensureRazorpayCheckout();
    if (!paymentGatewayReady) {
      toast({
        variant: 'destructive',
        title: 'Payment gateway unavailable',
        description: 'Could not load Razorpay. Please refresh and try again.',
      });
      return;
    }
    if (premiumPricingMissing || premiumPayableAmount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Premium price not configured',
        description: 'Premium pricing is unavailable for one or more selected question groups right now.',
      });
      return;
    }
    if (cannotReducePremiumQuestionCount) {
      toast({
        variant: 'destructive',
        title: 'Question count cannot be reduced',
        description: `This paid practice already includes ${selectedPremiumPurchaseQuestionCount} questions. You can only add more questions to this purchase.`,
      });
      return;
    }
    if (premiumQuestionSelectionShortfall > 0) {
      toast({
        variant: 'destructive',
        title: 'Not enough new questions',
        description: `Only ${resolvedPremiumQuestionIds.length} questions can be locked for this saved practice right now. Add fewer new questions or adjust filters.`,
      });
      return;
    }
    if (selectedPremiumPurchaseAttemptBlocked) {
      toast({
        variant: 'destructive',
        title: 'Attempts exhausted',
        description: 'This premium practice pack does not have an attempt recharge option available right now.',
      });
      return;
    }

    if (selectedPremiumPurchase && additionalPremiumPayableAmount <= 0 && selectedPremiumPurchaseAttemptCharge <= 0) {
      setIsPaymentProcessing(true);
      try {
        const { purchaseId } = await persistPremiumPracticePurchase({
          questionAmountPaid: 0,
          attemptAmountPaid: 0,
          attemptActionKind: selectedPremiumPurchaseAttemptActionKind,
        });
        toast({
          title: 'Premium practice updated',
          description: selectedPremiumPurchaseAttemptActionKind === 'none'
            ? 'Your saved premium practice session has been refreshed.'
            : 'Attempts refreshed. Starting your premium practice session.',
        });
        navigateToPracticeSession(purchaseId);
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: error?.message || 'Could not update premium practice session.',
        });
      } finally {
        setIsPaymentProcessing(false);
      }
      return;
    }

    setIsPaymentProcessing(true);
    const questionAmountPayableNow = selectedPremiumPurchase ? additionalPremiumPayableAmount : premiumPayableAmount;
    const attemptAmountPayableNow = selectedPremiumPurchase ? selectedPremiumPurchaseAttemptCharge : 0;
    const payableNow = selectedPremiumPurchase ? totalPremiumPayableNow : premiumPayableAmount;
    const payableAttemptLabel = selectedPremiumPurchaseAttemptActionKind === 'total_recharge'
      ? 'full attempt recharge'
      : selectedPremiumPurchaseAttemptActionKind === 'interval_attempt'
        ? '1 instant attempt'
        : '';
    const orderResult = await createRazorpayOrder(payableNow);
    if (orderResult.error || !orderResult.orderId) {
      toast({
        variant: 'destructive',
        title: 'Payment initialization failed',
        description: orderResult.error || 'Could not create payment order.',
      });
      setIsPaymentProcessing(false);
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: Math.round(payableNow * 100),
      currency: 'INR',
      name: 'DCAM Classes',
      description: selectedPremiumPurchase
        ? (attemptAmountPayableNow > 0 && questionAmountPayableNow > 0
          ? `Premium practice upgrade + ${payableAttemptLabel}: ${selectedCountSummary} questions`
          : attemptAmountPayableNow > 0
            ? `Premium practice ${payableAttemptLabel}`
            : `Premium practice upgrade: ${selectedCountSummary} questions`)
        : `Premium practice: ${selectedCountSummary} questions (per-question pricing)`,
      order_id: orderResult.orderId,
      handler: async function (response: any) {
        const paymentId = String(response.razorpay_payment_id || '').trim();
        const razorpayOrderId = String(response.razorpay_order_id || '').trim();
        const razorpaySignature = String(response.razorpay_signature || '').trim();
        if (!paymentId || !razorpayOrderId || !razorpaySignature) {
          toast({
            variant: 'destructive',
            title: 'Payment verification failed',
            description: 'Payment completed, but verification details are missing.',
          });
          setIsPaymentProcessing(false);
          return;
        }
        try {
          const nowIso = new Date().toISOString();
          const { purchaseId, purchaseData } = await persistPremiumPracticePurchase({
            paymentMeta: {
              paymentId,
              orderId: razorpayOrderId,
              amount: payableNow,
              paidAt: nowIso,
            },
            questionAmountPaid: questionAmountPayableNow,
            attemptAmountPaid: attemptAmountPayableNow,
            attemptActionKind: selectedPremiumPurchaseAttemptActionKind,
            serverWriteOnly: true,
          });

          const idToken = await user.getIdToken(true);
          const completionResult = await completeVerifiedPayment({
            idToken,
            orderId: razorpayOrderId,
            paymentId,
            signature: razorpaySignature,
            grossAmount: payableNow,
            currency: 'INR',
            paymentData: {
              id: paymentId,
              userId: user.uid,
              userEmail: user.email || '',
              teacherId,
              linkedContentType: 'premium_practice_session',
              linkedContentId: purchaseId,
              status: 'paid',
              grossAmount: payableNow,
              currency: 'INR',
              razorpayOrderId,
              razorpayPaymentId: paymentId,
              premiumPracticePurchaseId: purchaseId,
              questionCount: resolvedPremiumQuestionIds.length,
              questionCountByDifficulty: {
                easy: selectedQuestionCountByDifficulty.Easy,
                medium: selectedQuestionCountByDifficulty.Medium,
                hard: selectedQuestionCountByDifficulty.Hard,
              },
              perQuestionPrice: averagePremiumQuestionPrice,
              perQuestionPriceByDifficulty: premiumPracticeQuestionPriceByDifficulty,
              amountByDifficulty: premiumAmountByDifficulty,
              sourcePaymentId: paymentId,
              previousGrossAmount: selectedPremiumPurchasePaidAmount,
              questionAmountPaid: questionAmountPayableNow,
              attemptAmountPaid: attemptAmountPayableNow,
              premiumPracticeAttemptActionKind: selectedPremiumPurchaseAttemptActionKind,
              previousAttemptsPaidAmount: selectedPremiumPurchaseAttemptsPaidAmount,
              purchasedAt: nowIso,
            },
            writes: [
              {
                path: `users/${user.uid}/premium_practice_session_purchases/${purchaseId}`,
                merge: true,
                data: purchaseData,
              },
            ],
            revenueSplit: {
              teacherId,
              linkedContentType: 'premium_practice_session',
              linkedContentId: purchaseId,
              saleType: 'premium_practice_session',
              purchasedAt: nowIso,
              userEmail: user.email || '',
              studentName: user.displayName || '',
              studentEmail: user.email || '',
              metadata: {
                questionCount: resolvedPremiumQuestionIds.length,
                questionCountByDifficulty: {
                  easy: selectedQuestionCountByDifficulty.Easy,
                  medium: selectedQuestionCountByDifficulty.Medium,
                  hard: selectedQuestionCountByDifficulty.Hard,
                },
                perQuestionPrice: averagePremiumQuestionPrice,
                perQuestionPriceByDifficulty: premiumPracticeQuestionPriceByDifficulty,
                amountByDifficulty: premiumAmountByDifficulty,
                sourcePaymentId: paymentId,
                premiumPracticePurchaseId: purchaseId,
                previousGrossAmount: selectedPremiumPurchasePaidAmount,
                questionAmountPaid: questionAmountPayableNow,
                attemptAmountPaid: attemptAmountPayableNow,
                premiumPracticeAttemptActionKind: selectedPremiumPurchaseAttemptActionKind,
                previousAttemptsPaidAmount: selectedPremiumPurchaseAttemptsPaidAmount,
                updatedQuestionPaidAmount: Number((selectedPremiumPurchasePaidAmount + questionAmountPayableNow).toFixed(2)),
                updatedAttemptsPaidAmount: Number((selectedPremiumPurchaseAttemptsPaidAmount + attemptAmountPayableNow).toFixed(2)),
                updatedTotalPaidAmount: Number((selectedPremiumPurchasePaidAmount + selectedPremiumPurchaseAttemptsPaidAmount + questionAmountPayableNow + attemptAmountPayableNow).toFixed(2)),
              },
            },
          });
          if (!completionResult.success) {
            throw new Error(completionResult.error || 'Could not complete the verified payment.');
          }

          await sendSelfBellNotification(user, {
            title: selectedPremiumPurchase
              ? 'Congratulations on upgrading your premium practice'
              : 'Congratulations on unlocking premium practice',
            message: selectedPremiumPurchase
              ? 'Your premium practice session has been upgraded and is ready to start.'
              : 'Your premium practice session is ready to start now.',
            href: `/start-practice-session/${encodeURIComponent(teacherId)}?premiumPurchaseId=${encodeURIComponent(purchaseId)}`,
            notificationType: 'premium_practice_purchased',
            dedupeKey: `premium-practice:${paymentId}`,
            contentType: 'premium_practice_session',
            contentId: purchaseId,
            teacherId,
            metadata: {
              premiumPracticePurchaseId: purchaseId,
              paymentId,
            },
          });

          toast({
            title: 'Payment successful',
            description: selectedPremiumPurchase
              ? 'Premium practice upgrade saved. Starting session.'
              : 'Starting premium practice session.',
          });
          if (purchaseId !== premiumPurchaseIdParam) {
            selectPremiumPurchase(purchaseId);
          }
          navigateToPracticeSession(purchaseId);
        } catch (error: any) {
          toast({
            variant: 'destructive',
            title: 'Payment recorded but setup failed',
            description: error?.message || 'Please contact support with your payment reference.',
          });
        } finally {
          setIsPaymentProcessing(false);
        }
      },
      prefill: {
        name: user.displayName || 'DCAM User',
        email: user.email || '',
        contact: user.phoneNumber || '',
      },
      notes: {
        teacherId,
        studentId: user.uid,
        practiceMode: 'premium',
        questionCount: String(selectedCountSummary),
        premiumPurchaseId: selectedPremiumPurchase?.id || '',
        perQuestionPriceByDifficulty: JSON.stringify(premiumPracticeQuestionPriceByDifficulty),
        amountByDifficulty: JSON.stringify(premiumAmountByDifficulty),
        questionAmountPayable: String(questionAmountPayableNow),
        attemptAmountPayable: String(attemptAmountPayableNow),
        premiumPracticeAttemptActionKind: selectedPremiumPurchaseAttemptActionKind,
      },
      modal: {
        ondismiss: () => {
          setIsPaymentProcessing(false);
        },
      },
      theme: {
        color: '#0ea5e9',
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response: any) {
      toast({
        variant: 'destructive',
        title: 'Payment failed',
        description: response?.error?.description || 'Payment was not completed.',
      });
      setIsPaymentProcessing(false);
    });
    rzp.open();
  };

  const fullName = `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim() || 'Teacher';
  const setupLoading = teacherLoading || examTypesLoading || classesLoading;
  const questionBankLoading = hasSelectedExamAndClass && questionsLoading;
  const loading = setupLoading || subjectsLoading || (selectedSubjectIds.length > 0 && topicsLoading);
  const isTeacherAvailable = teacher?.roleId === 'teacher' && isPublicTeacherProfile(teacher);

  const examBadge = selectedExamName || 'Select exam';
  const classBadge = selectedClassName || 'Select curriculum';
  const getChipButtonClass = (isActive: boolean) =>
    cn(
      'h-9 rounded-full px-4 font-medium transition-all duration-200',
      isActive
        ? 'border-primary/70 bg-primary text-primary-foreground shadow-[0_0_0_2px_hsl(var(--primary)/0.2)]'
        : 'border-border/80 bg-background/70 text-foreground hover:border-primary/40 hover:bg-primary/10'
    );

  if (!loading && !isTeacherAvailable) {
    return (
      <>
        <div className="flex flex-col h-full">
          <DashboardHeader title="Create Practice Session" />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <Card className="border-dashed">
              <CardContent className="p-10 text-center text-muted-foreground">
                Teacher profile not available.
              </CardContent>
            </Card>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      {isPremiumMode ? (
        <Script
          id="razorpay-checkout-js"
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
          onLoad={() => {
            if (!window.Razorpay) {
              toast({
                variant: 'destructive',
                title: 'Payment gateway unavailable',
                description: 'Could not load Razorpay. Refresh and try again.',
              });
            }
          }}
        />
      ) : null}
      <div className="flex flex-col h-full">
        <DashboardHeader title="Create Practice Session" />
        <main className="relative flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />
        <Card className="relative overflow-hidden border-primary/20 bg-card/95 shadow-lg shadow-primary/5">
          <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn(
                  'border-primary/30 bg-primary/10 text-primary',
                  isPremiumMode && 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                )}>
                  {isPremiumMode ? 'Premium builder' : 'Free builder'}
                </Badge>
                <Badge variant="outline" className="border-primary/25 bg-background/70">
                  {examBadge}
                </Badge>
                <Badge variant="outline" className="border-primary/25 bg-background/70">
                  {classBadge}
                </Badge>
                {isPremiumMode && selectedPremiumPurchase ? (
                  <Badge variant="outline" className="border-cyan-300/35 bg-cyan-500/10 text-cyan-100">
                    Saved access active
                  </Badge>
                ) : null}
              </div>
              <p className="text-xl font-semibold md:text-2xl">
                {isPremiumMode ? 'Premium Practice' : 'Free Practice'}
              </p>
            </div>
            <Button asChild variant="outline" className="w-full border-primary/35 bg-background/70 hover:bg-primary/10 sm:w-auto">
              <Link href="/dcam-practice-session"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
            </Button>
          </CardContent>
        </Card>

        {isPremiumMode && selectedPremiumPurchase ? (
          <Card className="border-cyan-300/20 bg-slate-950/80 shadow-lg shadow-cyan-950/20">
            <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-cyan-300/35 bg-cyan-500/10 text-cyan-100">
                    Active access
                  </Badge>
                  {selectedPremiumPurchase.examTypeName ? (
                    <Badge variant="outline" className="border-border/60 bg-background/60">
                      {selectedPremiumPurchase.examTypeName}
                    </Badge>
                  ) : null}
                  {selectedPremiumPurchase.className ? (
                    <Badge variant="outline" className="border-border/60 bg-background/60">
                      {selectedPremiumPurchase.className}
                    </Badge>
                  ) : null}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center sm:w-[440px]">
                  <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-3 py-2">
                    <p className="text-[11px] text-cyan-100/75">Included</p>
                    <p className="text-lg font-semibold text-white">{selectedPremiumPurchaseQuestionCount}</p>
                  </div>
                  <div className="rounded-lg border border-slate-700/80 bg-slate-950/70 px-3 py-2">
                    <p className="text-[11px] text-slate-300">Selected</p>
                    <p className="text-lg font-semibold text-white">{selectedCountSummary}</p>
                  </div>
                  <div className="rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 py-2">
                    <p className="text-[11px] text-amber-100/75">Pay now</p>
                    <p className="text-lg font-semibold text-white">INR {totalPremiumPayableNow.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-cyan-300/35 bg-background/60 text-cyan-100 hover:bg-cyan-500/10"
                onClick={() => selectPremiumPurchase()}
              >
                Use New Setup
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {isPremiumMode && !selectedPremiumPurchase && visiblePremiumPurchasesForSelection.length > 0 ? (
          <Card className="border-amber-300/20 bg-slate-950/70 shadow-lg shadow-amber-950/10">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <p className="font-semibold">Saved access for this setup</p>
                </div>
                <Badge variant="outline" className="border-amber-300/35 bg-amber-500/10 text-amber-100">
                  {visiblePremiumPurchasesForSelection.length} saved
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {visiblePremiumPurchasesForSelection.map((purchase) => {
                    const purchaseId = purchase.id || '';
                    const attemptUsage = premiumAttemptUsageByPurchaseId[purchaseId];
                    const attemptsLeftLabel = attemptUsage?.attemptsLeft === null ? 'Unlimited' : String(attemptUsage?.attemptsLeft ?? 0);
                    const isOfferBacked = isReusablePremiumPracticePurchase(purchase);
                    const hasSavedQuestionIds = Array.isArray(purchase.questionIds)
                      && purchase.questionIds.some((entry) => typeof entry === 'string' && entry.trim().length > 0);
                    const purchaseQuestionCount = isOfferBacked
                      ? getPremiumPracticeIncludedQuestionCountFromRecord(purchase)
                      : Math.max(0, Number(purchase.questionCount || 0));
                    const primaryLabel = isOfferBacked
                      ? 'Use'
                      : formatPremiumPracticeAttemptActionButtonLabel(attemptUsage, 'Continue');
                    return (
                      <div
                        key={purchaseId}
                        className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/65 p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-sm">{isOfferBacked ? 'Access Pack' : 'Saved Session'}</p>
                            {purchase.examTypeName ? (
                              <Badge variant="outline" className="border-cyan-300/30 bg-cyan-500/10 text-cyan-100">
                                {purchase.examTypeName}
                              </Badge>
                            ) : null}
                            {purchase.className ? (
                              <Badge variant="outline" className="border-sky-300/30 bg-sky-500/10 text-sky-100">
                                {purchase.className}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{purchaseQuestionCount} questions</span>
                            <span>Attempts: {attemptsLeftLabel}</span>
                            {Number(purchase.perQuestionTimeSeconds || 0) > 0 ? (
                              <span>{purchase.perQuestionTimeSeconds}s/Q</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-cyan-300/35 bg-background/70 text-cyan-100 hover:bg-cyan-500/10"
                            onClick={() => {
                              if (isOfferBacked || attemptUsage?.isExhausted) {
                                selectPremiumPurchase(purchaseId);
                                return;
                              }
                              navigateToExistingPremiumPractice(purchase);
                            }}
                            disabled={!isOfferBacked && attemptUsage?.isExhausted && attemptUsage.actionKind === 'none'}
                          >
                            {primaryLabel}
                          </Button>
                          {isOfferBacked && hasSavedQuestionIds ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-amber-300/35 bg-background/70 text-amber-100 hover:bg-amber-500/10"
                              onClick={() => navigateToExistingPremiumPractice(purchase)}
                              disabled={attemptUsage?.isExhausted && attemptUsage.actionKind === 'none'}
                            >
                              Start
                            </Button>
                          ) : !isOfferBacked ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-amber-100 hover:bg-amber-500/10 hover:text-amber-50"
                              onClick={() => selectPremiumPurchase(purchaseId)}
                            >
                              Edit
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-primary/20 bg-card/95 shadow-lg shadow-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              Exam & Curriculum
            </CardTitle>
            {shouldApplyPresetFilters ? (
              <Badge variant="outline" className="w-fit border-cyan-300/35 bg-cyan-500/10 text-cyan-100">
                Preset applied
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {setupLoading ? (
              <p className="text-sm text-muted-foreground">Loading exam and curriculum options...</p>
            ) : availableExamTypes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-amber-300/35 bg-amber-500/5 p-4 text-sm text-amber-100/90">
                Practice setup is not available for this question bank right now. Please try again shortly.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Exam</p>
                    <Select value={examTypeId} onValueChange={setExamTypeId}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select exam" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableExamTypes.map((exam) => (
                          <SelectItem key={exam.id} value={exam.id}>
                            {exam.name || exam.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Curriculum/Class</p>
                    <Select value={classId} onValueChange={setClassId} disabled={!examTypeId}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={examTypeId ? 'Select curriculum' : 'Select exam first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClasses.map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.name || classItem.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {!examTypeId || !classId ? (
                  <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                    Choose both to continue.
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-card/95 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Subjects & Filters
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/25">
                {selectedSubjectsCount} subject{selectedSubjectsCount === 1 ? '' : 's'}
              </Badge>
              <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/25">
                {selectedCountSummary} question{selectedCountSummary === 1 ? '' : 's'}
              </Badge>
              {selectedSubtopicCount > 0 ? (
                <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/25">
                  {selectedSubtopicCount} branch{selectedSubtopicCount === 1 ? '' : 'es'}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading practice setup...</p>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Subjects
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {visibleSubjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground md:col-span-3">
                        {!examTypeId || !classId
                          ? 'Choose exam and curriculum first.'
                          : questionBankLoading
                            ? isPremiumMode
                              ? 'Loading paid questions...'
                              : 'Loading free questions...'
                          : isPremiumMode
                            ? 'No paid questions found.'
                            : 'No free questions found.'}
                      </p>
                    ) : (
                      visibleSubjects.map((subject) => (
                        <label
                          key={subject.id}
                          className={cn(
                            'group flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-all duration-200 hover:border-primary/40 hover:bg-primary/5',
                            selectedSubjectIds.includes(subject.id) && 'border-primary/50 bg-primary/10 shadow-sm'
                          )}
                        >
                          <Checkbox checked={selectedSubjectIds.includes(subject.id)} onCheckedChange={(v) => toggleSubject(subject.id, !!v)} />
                          <span className="font-medium">{subject.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    Subject-wise Question Setup
                  </p>
                  {selectedSubjectIds.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-5 text-sm text-muted-foreground">
                      {!examTypeId || !classId
                        ? 'Choose exam and curriculum first.'
                        : 'Select a subject to configure topics.'}
                    </div>
                  ) : (
                    selectedSubjectIds.map((subjectId) => {
                      const subject = visibleSubjects.find((s) => s.id === subjectId);
                      if (!subject) return null;
                      const config = subjectConfigById[subjectId] || getDefaultSubjectConfig(subjectId);
                      const availableCount = getAvailableCountForSubject(subjectId, config);
                      const availablePyqYears = getAvailablePreviousYearsForSubject(subjectId, config);
                      const hasSpecificYearSelection = config.previousYears.length > 0;
                      const pyqYearSelectionLabel = hasSpecificYearSelection ? config.previousYears.join(', ') : 'All Years';
                      const subjectTopics = topicsBySubject[subjectId] || [];
                      const selectedTopicIds = selectedTopicIdsBySubject[subjectId] || [];
                      return (
                        <div key={subjectId} className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-4 space-y-4 shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-base">{subject.name}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              {config.questionSource === 'pyq' ? (
                                <Badge variant="outline" className="border-amber-400/45 bg-amber-500/10 text-amber-100">
                                  PYQ {pyqYearSelectionLabel}
                                </Badge>
                              ) : null}
                              <Badge variant="outline" className="border-primary/35 bg-background/60">
                                {selectedTopicIds.length} topic{selectedTopicIds.length === 1 ? '' : 's'} selected
                              </Badge>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Question Type</p>
                            <div className="flex flex-wrap gap-2">
                              {(['All', 'MCQ', 'Numerical'] as const).map((type) => (
                                <Button
                                  key={type}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className={getChipButtonClass(config.questionType === type)}
                                  onClick={() => updateSubjectConfig(subjectId, { questionType: type })}
                                >
                                  {type}
                                </Button>
                              ))}
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Question Source</p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className={getChipButtonClass(config.questionSource === 'all')}
                                onClick={() => updateSubjectConfig(subjectId, { questionSource: 'all' })}
                              >
                                All Questions
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className={getChipButtonClass(config.questionSource === 'pyq')}
                                onClick={() => updateSubjectConfig(subjectId, { questionSource: 'pyq' })}
                              >
                                Previous Year (PYQ)
                              </Button>
                            </div>
                          </div>
                          {config.questionSource === 'pyq' ? (
                            <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-500/5 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs text-amber-100/85">PYQ Year Filter</p>
                                <Badge variant="outline" className="border-amber-400/40 bg-background/50 text-amber-100">
                                  {availablePyqYears.length} year{availablePyqYears.length === 1 ? '' : 's'} available
                                </Badge>
                              </div>
                              {availablePyqYears.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  No previous-year questions found for this subject with the current question type filter.
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className={getChipButtonClass(!hasSpecificYearSelection)}
                                    onClick={() => updateSubjectConfig(subjectId, { questionSource: 'pyq', previousYears: [] })}
                                  >
                                    All Years
                                  </Button>
                                  {availablePyqYears.map((year) => {
                                    const selected = config.previousYears.includes(year);
                                    return (
                                      <label
                                        key={`${subjectId}-${year}`}
                                        className={cn(
                                          'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all',
                                          selected
                                            ? 'border-amber-400/45 bg-amber-500/15 text-amber-100'
                                            : 'border-border/70 bg-background/80 hover:border-amber-400/35 hover:bg-amber-500/10'
                                        )}
                                      >
                                        <Checkbox
                                          checked={selected}
                                          onCheckedChange={(checked) => {
                                            const selectedSet = new Set(config.previousYears);
                                            if (checked) selectedSet.add(year);
                                            else selectedSet.delete(year);
                                            updateSubjectConfig(subjectId, {
                                              questionSource: 'pyq',
                                              previousYears: sortYearsDescending(Array.from(selectedSet)),
                                            });
                                          }}
                                        />
                                        <span>{year}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                              {availablePyqYears.length > 0 ? (
                                <p className="text-[11px] text-muted-foreground">
                                  {hasSpecificYearSelection
                                    ? `Selected years: ${config.previousYears.join(', ')}`
                                    : 'Using questions from all available years.'}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="grid grid-cols-1 items-end gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Question Bank Count</p>
                              <Badge variant="outline" className="text-sm border-primary/35 bg-background/60">
                                {availableCount} available
                                {config.questionSource === 'pyq' ? ` | PYQ ${pyqYearSelectionLabel}` : ''}
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
                            <p className="text-xs text-muted-foreground">Topics and Subtopics</p>
                            {subjectTopics.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No topics found for this subject.</p>
                            ) : (
                              subjectTopics.map((topic) => {
                                const selectedSubtopicPaths = normalizeSubtopicPathSelections(
                                  selectedSubtopicPathsByTopicId[topic.id] || []
                                );
                                const topicPathPool = getSubtopicPathPoolForTopic(subjectId, topic.id, config);
                                const topicAvailableCount = getAvailableCountForTopic(
                                  subjectId,
                                  topic.id,
                                  config,
                                  selectedSubtopicPaths
                                );
                                const selected = selectedTopicIds.includes(topic.id);
                                const rawRequestedCount = Number(topicCountById[topic.id] ?? 0);
                                const requestedCount = Number.isFinite(rawRequestedCount)
                                  ? rawRequestedCount
                                  : Math.min(1, Math.max(0, topicAvailableCount));

                                const draftSubtopicPath = subtopicDraftPathByTopicId[topic.id] || [];
                                const levelOptionSets: string[][] = [];
                                let traversalParent: string[] = [];
                                while (true) {
                                  const levelOptions = getChildSubtopicOptions(topicPathPool, traversalParent);
                                  if (levelOptions.length === 0) break;
                                  levelOptionSets.push(levelOptions);
                                  const selectedAtLevel = String(draftSubtopicPath[levelOptionSets.length - 1] || '').trim();
                                  if (
                                    !selectedAtLevel
                                    || !levelOptions.some(
                                      (option) => normalizeSubtopicValue(option) === normalizeSubtopicValue(selectedAtLevel)
                                    )
                                  ) {
                                    break;
                                  }
                                  traversalParent = [...traversalParent, selectedAtLevel];
                                }
                                const normalizedDraftPath = normalizeSubtopicPathSegments(traversalParent);

                                return (
                                  <div
                                    key={topic.id}
                                    className={cn(
                                      'rounded-xl border p-3 transition-all duration-200',
                                      selected ? 'border-primary/40 bg-primary/10' : 'border-border/70 bg-background/60',
                                      topicAvailableCount <= 0 && 'opacity-60'
                                    )}
                                  >
                                    <div className="grid grid-cols-1 items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto_140px]">
                                      <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                          checked={selected}
                                          disabled={topicAvailableCount <= 0 && !selected}
                                          onCheckedChange={(v) => toggleTopic(subjectId, topic.id, !!v, config)}
                                        />
                                        <span className="font-medium">{topic.name}</span>
                                      </label>
                                      <Badge variant="outline" className="border-primary/35 bg-background/70">
                                        {topicAvailableCount} available
                                      </Badge>
                                      <Input
                                        type="number"
                                        value={requestedCount}
                                        disabled={!selected || topicAvailableCount <= 0}
                                        className="text-center font-medium"
                                        onChange={(e) => {
                                          const raw = e.target.value;
                                          if (!raw.trim()) {
                                            setTopicCountById((curr) => ({ ...curr, [topic.id]: 0 }));
                                            return;
                                          }
                                          const next = Number(raw);
                                          setTopicCountById((curr) => ({
                                            ...curr,
                                            [topic.id]: Number.isFinite(next) ? Math.floor(next) : 0,
                                          }));
                                        }}
                                      />
                                    </div>

                                    {topicPathPool.length > 0 ? (
                                      <div className="mt-3 space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <p className="text-[11px] font-medium uppercase tracking-wide text-primary/85">
                                            Nested Subtopic Filters (optional)
                                          </p>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className={getChipButtonClass(selectedSubtopicPaths.length === 0)}
                                            onClick={() => applyTopicSubtopicPathSelections(subjectId, topic.id, [], config)}
                                          >
                                            All subtopics in topic
                                          </Button>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">
                                          Choose a branch at any depth and add it. You can combine multiple branches.
                                        </p>
                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                          {levelOptionSets.map((levelOptions, levelIndex) => (
                                            <div key={`${topic.id}-subtopic-level-${levelIndex}`} className="space-y-1">
                                              <p className="text-[11px] text-muted-foreground">Level {levelIndex + 1}</p>
                                              <Select
                                                value={draftSubtopicPath[levelIndex] || '__no_selection__'}
                                                onValueChange={(value) => {
                                                  setSubtopicDraftPathByTopicId((curr) => {
                                                    const existing = [...(curr[topic.id] || [])];
                                                    const nextPath = existing.slice(0, levelIndex);
                                                    if (value !== '__no_selection__') {
                                                      nextPath[levelIndex] = value;
                                                    }
                                                    return { ...curr, [topic.id]: nextPath };
                                                  });
                                                }}
                                              >
                                                <SelectTrigger className="h-9">
                                                  <SelectValue
                                                    placeholder={levelIndex === 0 ? 'Select top-level subtopic' : 'Select child subtopic'}
                                                  />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="__no_selection__">
                                                    {levelIndex === 0 ? 'Select top-level subtopic' : 'Stop here (include all child subtopics)'}
                                                  </SelectItem>
                                                  {levelOptions.map((option) => (
                                                    <SelectItem key={`${topic.id}-level-${levelIndex}-${option}`} value={option}>
                                                      {option}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className={getChipButtonClass(false)}
                                            disabled={normalizedDraftPath.length === 0}
                                            onClick={() => {
                                              if (normalizedDraftPath.length === 0) return;
                                              const branchPath = serializeSubtopicPathSelection(normalizedDraftPath);
                                              const mergedPaths = normalizeSubtopicPathSelections([
                                                ...selectedSubtopicPaths,
                                                branchPath,
                                              ]);
                                              applyTopicSubtopicPathSelections(subjectId, topic.id, mergedPaths, config);
                                            }}
                                          >
                                            Add Selected Branch
                                          </Button>
                                          <p className="text-[11px] text-muted-foreground">
                                            Draft: {normalizedDraftPath.length > 0 ? serializeSubtopicPathSelection(normalizedDraftPath) : 'None'}
                                          </p>
                                        </div>
                                        {selectedSubtopicPaths.length > 0 ? (
                                          <div className="flex flex-wrap gap-2">
                                            {selectedSubtopicPaths.map((selectedPath) => {
                                              const branchAvailableCount = getAvailableCountForTopic(
                                                subjectId,
                                                topic.id,
                                                config,
                                                [selectedPath]
                                              );
                                              return (
                                                <button
                                                  key={`${topic.id}-selected-branch-${selectedPath}`}
                                                  type="button"
                                                  className="inline-flex items-center gap-2 rounded-full border border-primary/45 bg-primary/15 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/20"
                                                  onClick={() => {
                                                    const nextPaths = normalizeSubtopicPathSelections(
                                                      selectedSubtopicPaths.filter((path) => path !== selectedPath)
                                                    );
                                                    applyTopicSubtopicPathSelections(subjectId, topic.id, nextPaths, config);
                                                  }}
                                                >
                                                  <span>{selectedPath}</span>
                                                  <span className="text-primary/75">({branchAvailableCount})</span>
                                                  <span className="font-semibold">x</span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <p className="text-[11px] text-muted-foreground">
                                            All subtopics from this topic are currently included.
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="mt-3 text-[11px] text-muted-foreground">
                                        No subtopic hierarchy is available for this topic in the selected filters.
                                      </p>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className={cn('grid grid-cols-1 gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent p-4', isPremiumMode ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
                  <div className={cn('space-y-1', isPremiumMode ? 'md:col-span-2' : 'md:col-span-2')}>
                    <p className="text-xs text-muted-foreground">Per Question Time (seconds, optional)</p>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={5}
                      max={3600}
                      value={perQuestionTimeSecondsInput}
                      placeholder="Leave empty for untimed"
                      onChange={(e) => setPerQuestionTimeSecondsInput(e.target.value)}
                      onBlur={() => {
                        if (!perQuestionTimeSecondsInput.trim()) return;
                        const parsed = Math.floor(Number(perQuestionTimeSecondsInput));
                        if (!Number.isFinite(parsed)) {
                          setPerQuestionTimeSecondsInput('');
                          return;
                        }
                        setPerQuestionTimeSecondsInput(String(Math.max(5, Math.min(parsed, 3600))));
                      }}
                      className="w-full md:w-64 bg-background/80"
                    />
                    <p className="text-[11px] text-muted-foreground">Leave blank to run without per-question or overall test timer.</p>
                    <div className="pt-1">
                      <Badge variant={hasCustomTimer ? 'secondary' : 'outline'} className={cn('text-xs', hasCustomTimer && 'bg-primary/15 text-primary')}>
                        <Clock3 className="mr-1 h-3 w-3" />
                        {hasCustomTimer ? `${perQuestionTimeSeconds}s per question` : 'Untimed session'}
                      </Badge>
                    </div>
                    {isPremiumMode ? (
                      <div className="pt-1">
                        <Badge
                          variant={hasAnyPremiumPracticePricing ? 'secondary' : 'destructive'}
                          className={cn('text-xs', hasAnyPremiumPracticePricing && 'bg-amber-500/15 text-amber-100')}
                        >
                          {hasAnyPremiumPracticePricing
                            ? (isEditingPremiumPurchase
                              ? (isOfferLinkedPremiumPurchase
                                ? `Selection value: INR ${premiumPayableAmount.toLocaleString()} | Reusable questions: ${selectedPremiumPurchaseQuestionCount} | Covered now: ${includedPremiumQuestionIds.length} | Extra payable now: INR ${totalPremiumPayableNow.toLocaleString()}`
                                : `Selection value: INR ${premiumPayableAmount.toLocaleString()} | Included questions: ${selectedPremiumPurchaseQuestionCount} | Extra payable now: INR ${totalPremiumPayableNow.toLocaleString()}`)
                              : `Payable: INR ${premiumPayableAmount.toLocaleString()} | Calculated from the selected subject and PYQ mix.`)
                            : 'Premium per-question pricing is unavailable right now'}
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total Questions Selected</p>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-lg font-semibold text-primary">
                      {selectedCountSummary}
                    </div>
                  </div>
                  {isPremiumMode ? (
                  <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Reusable Questions</p>
                      <div className="flex h-12 min-w-20 items-center justify-center rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 text-lg font-semibold text-amber-100">
                        {selectedPremiumPurchaseQuestionCount}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {isEditingPremiumPurchase
                          ? (isOfferLinkedPremiumPurchase
                            ? 'Reusable in every practice session from this access pack.'
                            : 'Loaded from active premium purchase.')
                          : 'Create a new premium purchase or edit an existing one above.'}
                      </p>
                    </div>
                  ) : null}
                  {isPremiumMode && selectedPremiumPurchaseAttemptUsage ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Attempts Left</p>
                      <div className="flex h-12 min-w-24 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-3 text-lg font-semibold text-cyan-100">
                        {selectedPremiumPurchaseAttemptUsage.attemptsLeft === null ? 'Unlimited' : selectedPremiumPurchaseAttemptUsage.attemptsLeft}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedPremiumPurchaseAttemptUsage.ruleLabel}
                      </p>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-10 rounded-xl border border-primary/20 bg-background/85 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/65">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {actionSummaryText}
            </p>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" className="border-primary/35 bg-background/70 hover:bg-primary/10">
                <Link href="/dcam-practice-session">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Link>
              </Button>
              <Button
                onClick={startPractice}
                disabled={!canStartPractice}
                className="min-w-52 bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:translate-y-[-1px] hover:bg-primary/90"
              >
                {isPaymentProcessing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                {isPremiumMode
                  ? (isPaymentProcessing
                    ? 'Processing Payment...'
                    : (isEditingPremiumPurchase
                      ? (totalPremiumPayableNow > 0
                        ? (selectedPremiumPurchaseAttemptActionKind === 'total_recharge' && additionalPremiumPayableAmount <= 0
                          ? `Recharge for INR ${selectedPremiumPurchaseAttemptCharge.toLocaleString()}`
                          : selectedPremiumPurchaseAttemptActionKind === 'interval_attempt' && additionalPremiumPayableAmount <= 0
                            ? `Buy Attempt for INR ${selectedPremiumPurchaseAttemptCharge.toLocaleString()}`
                            : `Pay INR ${totalPremiumPayableNow.toLocaleString()} & Continue`)
                        : (selectedPremiumPurchaseAttemptActionKind === 'total_recharge'
                          ? 'Recharge & Start Premium Practice'
                          : selectedPremiumPurchaseAttemptActionKind === 'interval_attempt'
                            ? 'Unlock Attempt & Start'
                            : 'Start Practice Session'))
                      : `Pay INR ${premiumPayableAmount.toLocaleString()} & Start`))
                  : 'Start Practice Session'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        </main>
      </div>
    </>
  );
}


