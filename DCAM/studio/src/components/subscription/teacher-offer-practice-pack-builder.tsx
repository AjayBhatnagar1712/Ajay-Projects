'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, orderBy, query, where } from 'firebase/firestore';
import { CreditCard, Filter, Sparkles } from 'lucide-react';

import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import OfferQuestionCoverageSummary from '@/components/subscription/offer-question-coverage-summary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  buildPremiumCustomMockAttemptRuleFromLegacyLimit,
  formatPremiumCustomMockAttemptPricingRule,
  normalizePremiumCustomMockAttemptPricingRule,
  type AttemptIntervalUnit,
  type AttemptLimitMode,
  type PremiumCustomMockAttemptPricingMap,
} from '@/lib/premium-custom-mock';
import {
  formatPremiumPracticeAttemptPricingRule,
  resolvePremiumPracticeAttemptPricingRule,
  type PremiumPracticeAttemptPricingMap,
} from '@/lib/premium-practice-session';
import {
  buildPracticeQuestionScopeEntries,
  countUniquePracticeQuestions,
  type PracticeQuestionScopeEntry,
} from '@/lib/practice-question-scope';
import { buildPricingScopeKey, resolveScopedDifficultyPricing, type ScopedDifficultyPricingMap } from '@/lib/premium-pricing';
import { mergeLegacyDifficultyCounts, QUESTION_DIFFICULTY } from '@/lib/question-difficulty';
import {
  buildTeacherPremiumQuestionRows,
  resolveTeacherPremiumQuestionAvailability,
} from '@/lib/teacher-premium-question-access';
import { type TeacherQuestionPurchaseDoc } from '@/lib/teacher-question-purchase';
import type { TeacherOfferCustomMockPack, TeacherOfferPracticePack } from '@/lib/teacher-offers';
import { ALLOWED_TEACHER_AUTHOR_EMAIL } from '@/lib/teacher-authoring';
import { extractSubtopicPaths, normalizeSubtopicValue, splitSubtopicPath } from '@/lib/subtopic-paths';
import { cn } from '@/lib/utils';

type Subject = {
  id: string;
  name: string;
  classId: string;
};

type Topic = {
  id: string;
  name: string;
  subjectId: string;
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
  alignments?: Array<{
    examTypeId?: string;
    classId?: string;
    subjectId?: string;
    topicId?: string;
    subtopics?: string[];
    difficultyLevel?: 'Easy' | 'Medium' | 'Hard';
    accessLevel?: 'free' | 'paid';
    mockTestOnly?: boolean;
    isPreviousYear?: boolean;
    previousYear?: string;
  }>;
};

type TeacherProfile = {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  premiumPracticeQuestionPrice?: number;
  premiumPracticeQuestionPriceByDifficulty?: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
  premiumPracticeQuestionPricingByScope?: ScopedDifficultyPricingMap;
  premiumPracticeAttemptPricingByScope?: PremiumPracticeAttemptPricingMap;
  premiumMockTestQuestionPrice?: number;
  premiumMockTestQuestionPriceByDifficulty?: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
  premiumMockTestQuestionPricingByScope?: ScopedDifficultyPricingMap;
  premiumMockTestAttemptPricingByScope?: PremiumCustomMockAttemptPricingMap;
  premiumMockTestAttemptLimit?: {
    mode?: AttemptLimitMode;
    maxTotalAttempts?: number | null;
    maxAttemptsPerInterval?: number | null;
    intervalValue?: number | null;
    intervalUnit?: AttemptIntervalUnit | null;
  };
};

type PricingOwnerProfile = {
  id: string;
  email?: string;
};

type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';
type QuestionType = 'All' | 'MCQ' | 'Numerical';
type PreviousYearMode = 'all' | 'pyq';
type QuestionAccessLevel = 'free' | 'paid';
type QuestionBankSource = 'student_plus_official' | 'teacher_official';

const DEFAULT_QUESTION_BANK_SOURCE_OPTIONS: QuestionBankSource[] = ['student_plus_official', 'teacher_official'];

type SubjectConfig = {
  questionType: QuestionType;
  difficultyLevel: DifficultyLevel;
  questionSource: PreviousYearMode;
  previousYears: string[];
  count: number;
};

type NormalizedPracticeTopicConfig = {
  subjectId: string;
  topicId: string;
  subtopics: string[];
  questionBankSource: QuestionBankSource;
  questionType: QuestionType;
  difficultyLevel: DifficultyLevel;
  previousYearMode: PreviousYearMode;
  previousYears: string[];
  count: number;
};

type SharedTeacherOfferQuestionPackBuilderProps = {
  teacherId: string;
  examTypeId: string;
  examTypeName: string;
  classId: string;
  className: string;
  availableSubjects: Subject[];
  selectedSubjectIds: string[];
  resetToken: number;
  initialValue?: TeacherOfferPracticePack | TeacherOfferCustomMockPack | null;
  questionBankSourceOptions?: QuestionBankSource[];
};

type TeacherOfferPracticePackBuilderProps = SharedTeacherOfferQuestionPackBuilderProps & {
  variant?: 'practice';
  onChange: (value: TeacherOfferPracticePack | null) => void;
};

type TeacherOfferCustomMockPackBuilderProps = SharedTeacherOfferQuestionPackBuilderProps & {
  variant: 'custom_mock';
  onChange: (value: TeacherOfferCustomMockPack | null) => void;
};

const DIFFICULTY_LEVELS: DifficultyLevel[] = [QUESTION_DIFFICULTY];
const PREVIOUS_YEAR_PATTERN = /^(19|20)\d{2}$/;

const normalizePreviousYearValue = (value?: string) => {
  const year = String(value || '').trim();
  return PREVIOUS_YEAR_PATTERN.test(year) ? year : '';
};

const sortYearsDescending = (years: string[]) =>
  Array.from(new Set(years.map((year) => normalizePreviousYearValue(year)).filter(Boolean))).sort((a, b) => Number(b) - Number(a));

const normalizeSubtopicPathSegments = (segments: string[]) =>
  segments.map((segment) => String(segment || '').trim()).filter(Boolean);

const parseSubtopicPathSelection = (value?: string) => normalizeSubtopicPathSegments(splitSubtopicPath(String(value || '')));

const serializeSubtopicPathSelection = (segments: string[]) => normalizeSubtopicPathSegments(segments).join(' > ');

const getSubtopicPathKey = (segments: string[]) =>
  normalizeSubtopicPathSegments(segments).map((segment) => normalizeSubtopicValue(segment)).join('>');

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

const matchesSelectedSubtopicPaths = (subtopics: string[] | undefined, selectedSubtopicPaths: string[] = []) => {
  const normalizedSelections = normalizeSubtopicPathSelections(selectedSubtopicPaths);
  if (normalizedSelections.length === 0) return true;
  const questionPaths = extractSubtopicPaths(subtopics);
  if (questionPaths.length === 0) return false;
  return normalizedSelections.some((selection) => {
    const selectionPath = parseSubtopicPathSelection(selection);
    return questionPaths.some((questionPath) => subtopicPathStartsWith(questionPath, selectionPath));
  });
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

const matchesQuestionBankSource = ({ mockTestOnly }: { mockTestOnly?: boolean }, source: QuestionBankSource) =>
  source === 'teacher_official' ? !!mockTestOnly : !mockTestOnly;

const questionBankSourceLabel = (value: QuestionBankSource) =>
  value === 'teacher_official' ? 'Teacher Official Mock Test' : 'Student Use + Official Mock Test';

const normalizeQuestionBankSourceOption = (value: unknown): QuestionBankSource =>
  value === 'teacher_official' ? 'teacher_official' : 'student_plus_official';

const areStringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const areSubjectConfigMapsEqual = (
  left: Record<string, SubjectConfig>,
  right: Record<string, SubjectConfig>,
) => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (!areStringArraysEqual(leftKeys, rightKeys)) return false;
  return leftKeys.every((key) => {
    const leftValue = left[key];
    const rightValue = right[key];
    if (!rightValue) return false;
    return (
      leftValue.questionType === rightValue.questionType
      && leftValue.difficultyLevel === rightValue.difficultyLevel
      && leftValue.questionSource === rightValue.questionSource
      && leftValue.count === rightValue.count
      && areStringArraysEqual(leftValue.previousYears, rightValue.previousYears)
    );
  });
};

const areStringRecordArraysEqual = (
  left: Record<string, string[]>,
  right: Record<string, string[]>,
) => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (!areStringArraysEqual(leftKeys, rightKeys)) return false;
  return leftKeys.every((key) => areStringArraysEqual(left[key] || [], right[key] || []));
};

export default function TeacherOfferPracticePackBuilder({
  teacherId,
  examTypeId,
  examTypeName,
  classId,
  className,
  availableSubjects,
  selectedSubjectIds,
  resetToken,
  initialValue = null,
  questionBankSourceOptions = DEFAULT_QUESTION_BANK_SOURCE_OPTIONS,
  variant = 'practice',
  onChange,
}: TeacherOfferPracticePackBuilderProps | TeacherOfferCustomMockPackBuilderProps) {
  const firestore = useFirestore();
  const questionAccessLevel: QuestionAccessLevel = 'paid';
  const isCustomMockVariant = variant === 'custom_mock';
  const handlePracticePackChange = onChange as (value: TeacherOfferPracticePack | null) => void;
  const handleCustomMockPackChange = onChange as (value: TeacherOfferCustomMockPack | null) => void;

  const teacherRef = useMemoFirebase(() => (firestore && teacherId ? doc(firestore, 'users', teacherId) : null), [firestore, teacherId]);
  const pricingOwnerQuery = useMemoFirebase(
    () => (
      firestore
        ? query(collection(firestore, 'users'), where('email', '==', ALLOWED_TEACHER_AUTHOR_EMAIL), limit(1))
        : null
    ),
    [firestore]
  );
  const topicsQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'topics'), orderBy('name')) : null), [firestore]);
  const teacherPurchasesQuery = useMemoFirebase(
    () => (
      firestore && teacherId
        ? query(collection(firestore, 'users', teacherId, 'teacher_question_purchases'), orderBy('purchasedAt', 'desc'))
        : null
    ),
    [firestore, teacherId]
  );

  const { data: teacher } = useDoc<TeacherProfile>(teacherRef);
  const { data: pricingOwnerRowsRaw, isLoading: isPricingOwnerLoading } = useCollection<PricingOwnerProfile>(pricingOwnerQuery);
  const { data: topics, isLoading: areTopicsLoading } = useCollection<Topic>(topicsQuery);
  const pricingOwner = useMemo(
    () => (Array.isArray(pricingOwnerRowsRaw) ? pricingOwnerRowsRaw[0] || null : null),
    [pricingOwnerRowsRaw]
  );
  const questionsQuery = useMemoFirebase(
    () => (firestore && pricingOwner?.id ? query(collection(firestore, 'practice_questions'), where('teacherId', '==', pricingOwner.id)) : null),
    [firestore, pricingOwner?.id]
  );
  const { data: questionsRaw, isLoading: areQuestionsLoading } = useCollection<PracticeQuestion>(questionsQuery);
  const { data: teacherQuestionPurchasesRaw, isLoading: areTeacherQuestionPurchasesLoading } = useCollection<TeacherQuestionPurchaseDoc>(teacherPurchasesQuery);
  const questions = useMemo(
    () => (Array.isArray(questionsRaw) ? questionsRaw : []),
    [questionsRaw]
  );
  const teacherQuestionPurchases = useMemo(
    () => (Array.isArray(teacherQuestionPurchasesRaw) ? teacherQuestionPurchasesRaw : []),
    [teacherQuestionPurchasesRaw]
  );
  const paidTeacherQuestionPurchases = useMemo(
    () => teacherQuestionPurchases.filter((purchase) => (purchase.status || 'paid') === 'paid'),
    [teacherQuestionPurchases]
  );

  const normalizedQuestionBankSourceOptions = useMemo<QuestionBankSource[]>(() => {
    const normalizedOptions = Array.from(
      new Set((questionBankSourceOptions || []).map((value) => normalizeQuestionBankSourceOption(value))),
    );
    return normalizedOptions.length > 0 ? normalizedOptions : DEFAULT_QUESTION_BANK_SOURCE_OPTIONS;
  }, [questionBankSourceOptions]);
  const questionBankSourceOptionsKey = useMemo(
    () => normalizedQuestionBankSourceOptions.join('|'),
    [normalizedQuestionBankSourceOptions],
  );
  const resolvedQuestionBankSourceOptions = useMemo<QuestionBankSource[]>(
    () => (questionBankSourceOptionsKey
      ? (questionBankSourceOptionsKey.split('|').map((value) => normalizeQuestionBankSourceOption(value)) as QuestionBankSource[])
      : DEFAULT_QUESTION_BANK_SOURCE_OPTIONS),
    [questionBankSourceOptionsKey],
  );
  const primaryQuestionBankSourceOption = resolvedQuestionBankSourceOptions[0] || DEFAULT_QUESTION_BANK_SOURCE_OPTIONS[0];

  const [questionBankSource, setQuestionBankSource] = useState<QuestionBankSource>(
    resolvedQuestionBankSourceOptions[0] || 'student_plus_official',
  );
  const [subjectConfigById, setSubjectConfigById] = useState<Record<string, SubjectConfig>>({});
  const [selectedTopicIdsBySubject, setSelectedTopicIdsBySubject] = useState<Record<string, string[]>>({});
  const [selectedSubtopicPathsByTopicId, setSelectedSubtopicPathsByTopicId] = useState<Record<string, string[]>>({});
  const [subtopicDraftPathByTopicId, setSubtopicDraftPathByTopicId] = useState<Record<string, string[]>>({});
  const [topicCountById, setTopicCountById] = useState<Record<string, number>>({});
  const initialValueKey = useMemo(() => JSON.stringify(initialValue || null), [initialValue]);

  useEffect(() => {
    if (
      initialValue
      && (isPricingOwnerLoading || areTopicsLoading || areQuestionsLoading || areTeacherQuestionPurchasesLoading)
    ) {
      return;
    }

    const initialQuestionBankSource = normalizeQuestionBankSourceOption(initialValue?.questionBankSource);
    const resolvedInitialQuestionBankSource = resolvedQuestionBankSourceOptions.includes(initialQuestionBankSource)
      ? initialQuestionBankSource
      : primaryQuestionBankSourceOption;
    setQuestionBankSource(resolvedInitialQuestionBankSource);
    setSubtopicDraftPathByTopicId({});

    if (!initialValue) {
      setSubjectConfigById({});
      setSelectedTopicIdsBySubject({});
      setSelectedSubtopicPathsByTopicId({});
      setTopicCountById({});
      return;
    }

    const initialTopicConfigs = isCustomMockVariant
      ? (initialValue as TeacherOfferCustomMockPack).subjectConfigs || []
      : (initialValue as TeacherOfferPracticePack).topicConfigs || [];
    const nextSubjectConfigById: Record<string, SubjectConfig> = {};
    const nextSelectedTopicIdsBySubject: Record<string, string[]> = {};
    const nextSelectedSubtopicPathsByTopicId: Record<string, string[]> = {};
    const nextTopicCountById: Record<string, number> = {};

    initialTopicConfigs.forEach((config) => {
      const subjectId = String(config.subjectId || '').trim();
      const topicId = String(config.topicId || '').trim();
      if (!subjectId || !topicId) return;

      const questionType: QuestionType = config.questionType === 'MCQ' || config.questionType === 'Numerical'
        ? config.questionType
        : 'All';
      const difficultyLevel: DifficultyLevel = 'Easy';
      const questionSource: PreviousYearMode = isCustomMockVariant
        ? ((config as TeacherOfferCustomMockPack['subjectConfigs'][number]).questionSource === 'pyq' ? 'pyq' : 'all')
        : ((config as NonNullable<TeacherOfferPracticePack['topicConfigs']>[number]).previousYearMode === 'pyq' ? 'pyq' : 'all');
      const previousYears = sortYearsDescending(config.previousYears || []);
      const subtopicPaths = isCustomMockVariant
        ? normalizeSubtopicPathSelections([
            ...((config as TeacherOfferCustomMockPack['subjectConfigs'][number]).subtopicPaths || []),
            String((config as TeacherOfferCustomMockPack['subjectConfigs'][number]).subtopic || ''),
          ])
        : normalizeSubtopicPathSelections((config as NonNullable<TeacherOfferPracticePack['topicConfigs']>[number]).subtopics || []);

      nextSubjectConfigById[subjectId] = {
        questionType,
        difficultyLevel,
        questionSource,
        previousYears,
        count: Math.max(1, Number(config.count || 1)),
      };
      nextSelectedTopicIdsBySubject[subjectId] = Array.from(
        new Set([...(nextSelectedTopicIdsBySubject[subjectId] || []), topicId])
      );
      nextSelectedSubtopicPathsByTopicId[topicId] = subtopicPaths;
      nextTopicCountById[topicId] = Math.max(1, Number(config.count || 1));
    });

    setSubjectConfigById(nextSubjectConfigById);
    setSelectedTopicIdsBySubject(nextSelectedTopicIdsBySubject);
    setSelectedSubtopicPathsByTopicId(nextSelectedSubtopicPathsByTopicId);
    setTopicCountById(nextTopicCountById);
  }, [
    areQuestionsLoading,
    areTeacherQuestionPurchasesLoading,
    areTopicsLoading,
    initialValueKey,
    isCustomMockVariant,
    isPricingOwnerLoading,
    primaryQuestionBankSourceOption,
    questionBankSourceOptionsKey,
    resetToken,
    resolvedQuestionBankSourceOptions,
  ]);

  useEffect(() => {
    if (resolvedQuestionBankSourceOptions.includes(questionBankSource)) return;
    setQuestionBankSource(primaryQuestionBankSourceOption);
  }, [primaryQuestionBankSourceOption, questionBankSource, resolvedQuestionBankSourceOptions]);

  const teacherName = useMemo(() => {
    return `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim() || teacher?.displayName || 'Teacher';
  }, [teacher?.displayName, teacher?.firstName, teacher?.lastName]);

  const questionEntries = useMemo<PracticeQuestionScopeEntry<PracticeQuestion>[]>(() => {
    return (questions || []).flatMap((question) => buildPracticeQuestionScopeEntries(question));
  }, [questions]);

  const availableQuestionEntriesBySource = useMemo<Record<QuestionBankSource, PracticeQuestionScopeEntry<PracticeQuestion>[]>>(() => {
    const emptyResult: Record<QuestionBankSource, PracticeQuestionScopeEntry<PracticeQuestion>[]> = {
      student_plus_official: [],
      teacher_official: [],
    };
    if (!examTypeId || !classId || !pricingOwner?.id) return emptyResult;

    resolvedQuestionBankSourceOptions.forEach((source) => {
      const sourceEntries = questionEntries
        .filter((entry) => entry.teacherId === pricingOwner.id)
        .filter((entry) => entry.examTypeId === examTypeId && entry.classId === classId)
        .filter((entry) => entry.accessLevel === 'paid')
        .filter((entry) => matchesQuestionBankSource(entry, source));
      if (sourceEntries.length === 0) {
        emptyResult[source] = [];
        return;
      }

      const availability = resolveTeacherPremiumQuestionAvailability({
        rows: buildTeacherPremiumQuestionRows(sourceEntries),
        purchases: paidTeacherQuestionPurchases,
        minimumStudentsRequired: 1,
        randomize: false,
      });
      emptyResult[source] = availability.selectableRows.flatMap((row) =>
        row.entries.filter((entry) => matchesQuestionBankSource(entry, source))
      );
    });

    return emptyResult;
  }, [
    classId,
    examTypeId,
    paidTeacherQuestionPurchases,
    pricingOwner?.id,
    questionEntries,
    resolvedQuestionBankSourceOptions,
  ]);

  const scopedQuestionEntries = useMemo(
    () => availableQuestionEntriesBySource[questionBankSource] || [],
    [availableQuestionEntriesBySource, questionBankSource]
  );

  const examClassSelectedEntries = useMemo(() => {
    if (!examTypeId || !classId) return [];
    const selectedSet = new Set(selectedSubjectIds);
    return resolvedQuestionBankSourceOptions
      .flatMap((source) => availableQuestionEntriesBySource[source] || [])
      .filter((entry) => selectedSet.size === 0 || selectedSet.has(entry.subjectId));
  }, [availableQuestionEntriesBySource, examTypeId, classId, resolvedQuestionBankSourceOptions, selectedSubjectIds]);

  const visibleSubjects = useMemo(() => {
    const selectedSet = new Set(selectedSubjectIds);
    return availableSubjects
      .filter((subject) => selectedSet.has(subject.id))
      .filter((subject) => scopedQuestionEntries.some((entry) => entry.subjectId === subject.id));
  }, [availableSubjects, selectedSubjectIds, scopedQuestionEntries]);

  const subjectNameById = useMemo(
    () => Object.fromEntries(availableSubjects.map((subject) => [subject.id, subject.name])),
    [availableSubjects]
  );

  const topicNameById = useMemo(
    () => Object.fromEntries((topics || []).map((topic) => [topic.id, topic.name])),
    [topics]
  );

  const topicsBySubject = useMemo(() => {
    const map: Record<string, Topic[]> = {};
    visibleSubjects.forEach((subject) => {
      map[subject.id] = (topics || []).filter((topic) => topic.subjectId === subject.id);
    });
    return map;
  }, [topics, visibleSubjects]);

  useEffect(() => {
    if (!examTypeId || !classId || selectedSubjectIds.length === 0) return;
    if (visibleSubjects.length > 0) return;
    const preferredSources: QuestionBankSource[] = [
      questionBankSource,
      ...resolvedQuestionBankSourceOptions,
    ];
    const nextSource = preferredSources.find((source) =>
      examClassSelectedEntries.some((entry) => matchesQuestionBankSource(entry, source))
    );
    if (!nextSource || nextSource === questionBankSource) return;
    setQuestionBankSource(nextSource);
  }, [
    examTypeId,
    classId,
    selectedSubjectIds,
    visibleSubjects.length,
    examClassSelectedEntries,
    questionBankSource,
    resolvedQuestionBankSourceOptions,
  ]);

  useEffect(() => {
    const visibleSubjectIdSet = new Set(visibleSubjects.map((subject) => subject.id));
    setSubjectConfigById((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([subjectId]) => visibleSubjectIdSet.has(subjectId)),
      );
      return areSubjectConfigMapsEqual(current, next) ? current : next;
    });
    setSelectedTopicIdsBySubject((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([subjectId]) => visibleSubjectIdSet.has(subjectId)),
      );
      return areStringRecordArraysEqual(current, next) ? current : next;
    });
  }, [visibleSubjects]);

  const getPreferredDifficultyForSubject = (subjectId: string): DifficultyLevel => {
    let selectedLevel: DifficultyLevel = 'Easy';
    let highestCount = -1;
    DIFFICULTY_LEVELS.forEach((level) => {
      const currentCount = countUniquePracticeQuestions(
        scopedQuestionEntries
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

  useEffect(() => {
    setSubjectConfigById((current) => {
      const next = { ...current };
      let changed = false;
      visibleSubjects.forEach((subject) => {
        if (!next[subject.id]) {
          next[subject.id] = getDefaultSubjectConfig(subject.id);
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [visibleSubjects]);

  const getAvailablePreviousYearsForSubject = (subjectId: string, config: SubjectConfig) => {
    const years = scopedQuestionEntries
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

  const getAvailableCountForSubject = (subjectId: string, config: SubjectConfig) =>
    countUniquePracticeQuestions(
      scopedQuestionEntries
        .filter((entry) => entry.subjectId === subjectId)
        .filter((entry) => (config.questionType === 'All' ? true : entry.questionType === config.questionType))
        .filter((entry) => {
          if (config.questionSource !== 'pyq') return true;
          const year = normalizePreviousYearValue(entry.previousYear);
          if (!entry.isPreviousYear || !year) return false;
          if (config.previousYears.length === 0) return true;
          return config.previousYears.includes(year);
        })
    );

  const getAvailableCountForTopic = (
    subjectId: string,
    topicId: string,
    config: SubjectConfig,
    selectedSubtopicPaths: string[] = []
  ) =>
    countUniquePracticeQuestions(
      scopedQuestionEntries
        .filter((entry) => entry.subjectId === subjectId && entry.topicId === topicId)
        .filter((entry) => (config.questionType === 'All' ? true : entry.questionType === config.questionType))
        .filter((entry) => {
          if (config.questionSource !== 'pyq') return true;
          const year = normalizePreviousYearValue(entry.previousYear);
          if (!entry.isPreviousYear || !year) return false;
          if (config.previousYears.length === 0) return true;
          return config.previousYears.includes(year);
        })
        .filter((entry) => matchesSelectedSubtopicPaths(entry.subtopics, selectedSubtopicPaths))
    );

  const getSubtopicPathPoolForTopic = (subjectId: string, topicId: string, config: SubjectConfig) => {
    const uniquePaths = new Map<string, string[]>();
    scopedQuestionEntries
      .filter((entry) => entry.subjectId === subjectId && entry.topicId === topicId)
      .filter((entry) => (config.questionType === 'All' ? true : entry.questionType === config.questionType))
      .filter((entry) => {
        if (config.questionSource !== 'pyq') return true;
        const year = normalizePreviousYearValue(entry.previousYear);
        if (!entry.isPreviousYear || !year) return false;
        if (config.previousYears.length === 0) return true;
        return config.previousYears.includes(year);
      })
      .forEach((entry) => {
        extractSubtopicPaths(entry.subtopics).forEach((path) => {
          const normalizedPath = normalizeSubtopicPathSegments(path);
          const key = getSubtopicPathKey(normalizedPath);
          if (!key || uniquePaths.has(key)) return;
          uniquePaths.set(key, normalizedPath);
        });
      });
    return Array.from(uniquePaths.values()).sort((left, right) => left.join(' > ').localeCompare(right.join(' > ')));
  };

  const updateSubjectConfig = (subjectId: string, patch: Partial<SubjectConfig>) => {
    setSubjectConfigById((current) => {
      const previous = current[subjectId] || getDefaultSubjectConfig(subjectId);
      const merged = { ...previous, ...patch };
      const availableYears = getAvailablePreviousYearsForSubject(subjectId, merged);
      const next = {
        ...merged,
        previousYears: sanitizeSelectedPreviousYears(merged.previousYears || [], availableYears),
      };
      const max = getAvailableCountForSubject(subjectId, next);
      return {
        ...current,
        [subjectId]: {
          ...next,
          count: Math.max(1, Math.min(Number(next.count || 1), Math.max(1, max))),
        },
      };
    });
  };

  const toggleTopic = (subjectId: string, topicId: string, checked: boolean, config: SubjectConfig) => {
    setSelectedTopicIdsBySubject((current) => {
      const subjectTopicIds = current[subjectId] || [];
      const nextForSubject = checked
        ? (subjectTopicIds.includes(topicId) ? subjectTopicIds : [...subjectTopicIds, topicId])
        : subjectTopicIds.filter((value) => value !== topicId);
      return { ...current, [subjectId]: nextForSubject };
    });

    if (!checked) {
      setSelectedSubtopicPathsByTopicId((current) => {
        const next = { ...current };
        delete next[topicId];
        return next;
      });
      setSubtopicDraftPathByTopicId((current) => {
        const next = { ...current };
        delete next[topicId];
        return next;
      });
      return;
    }

    if (!topicCountById[topicId]) {
      const max = getAvailableCountForTopic(subjectId, topicId, config, selectedSubtopicPathsByTopicId[topicId] || []);
      setTopicCountById((current) => ({ ...current, [topicId]: Math.min(10, Math.max(1, max)) }));
    }
  };

  const applyTopicSubtopicPathSelections = (
    subjectId: string,
    topicId: string,
    selectedPaths: string[],
    config: SubjectConfig
  ) => {
    const normalizedSelections = normalizeSubtopicPathSelections(selectedPaths);
    setSelectedSubtopicPathsByTopicId((current) => ({ ...current, [topicId]: normalizedSelections }));
    setSelectedTopicIdsBySubject((current) => {
      const subjectTopicIds = current[subjectId] || [];
      if (subjectTopicIds.includes(topicId)) return current;
      return { ...current, [subjectId]: [...subjectTopicIds, topicId] };
    });
    const max = getAvailableCountForTopic(subjectId, topicId, config, normalizedSelections);
    setTopicCountById((current) => {
      const currentCount = Number(current[topicId] ?? 0);
      const safeCurrent = Number.isFinite(currentCount) ? Math.floor(currentCount) : 0;
      const fallbackCount = max > 0 ? Math.min(10, Math.max(1, max)) : 0;
      const boundedCount = safeCurrent > 0 ? Math.max(0, Math.min(safeCurrent, Math.max(0, max))) : fallbackCount;
      return { ...current, [topicId]: boundedCount };
    });
  };

  const normalizedTopicConfigs = useMemo<NormalizedPracticeTopicConfig[]>(() => {
    const result: NormalizedPracticeTopicConfig[] = [];
    visibleSubjects.forEach((subject) => {
      const subjectId = subject.id;
      const config = subjectConfigById[subjectId] || getDefaultSubjectConfig(subjectId);
      const selectedTopicIds = selectedTopicIdsBySubject[subjectId] || [];
      selectedTopicIds.forEach((topicId) => {
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
          questionBankSource,
          questionType: config.questionType,
          difficultyLevel: 'Easy' as const,
          previousYearMode: config.questionSource,
          previousYears: config.previousYears,
          count: requested,
        });
      });
    });
    return result;
  }, [visibleSubjects, subjectConfigById, selectedTopicIdsBySubject, selectedSubtopicPathsByTopicId, topicCountById, questionBankSource]);

  const selectedQuestionCount = useMemo(
    () => normalizedTopicConfigs.reduce((sum, config) => sum + config.count, 0),
    [normalizedTopicConfigs]
  );

  const selectedQuestionCountByDifficulty = useMemo(
    () => mergeLegacyDifficultyCounts({
      easy: normalizedTopicConfigs.reduce((sum, config) => sum + config.count, 0),
    }),
    [normalizedTopicConfigs]
  );

  const selectedSubtopicCount = useMemo(
    () => Object.values(selectedSubtopicPathsByTopicId).reduce((sum, values) => sum + values.length, 0),
    [selectedSubtopicPathsByTopicId]
  );

  const perQuestionTimeSeconds = null;

  const premiumPracticeQuestionPriceByDifficulty = useMemo(() => {
    return resolveScopedDifficultyPricing({
      legacyPrice: teacher?.premiumPracticeQuestionPrice,
      globalPricing: teacher?.premiumPracticeQuestionPriceByDifficulty,
      scopedPricingMap: teacher?.premiumPracticeQuestionPricingByScope,
      examTypeId,
      classId,
    });
  }, [
    teacher?.premiumPracticeQuestionPrice,
    teacher?.premiumPracticeQuestionPriceByDifficulty,
    teacher?.premiumPracticeQuestionPricingByScope,
    examTypeId,
    classId,
  ]);

  const premiumPracticeAttemptRule = useMemo(
    () => resolvePremiumPracticeAttemptPricingRule({
      scopedPricingMap: teacher?.premiumPracticeAttemptPricingByScope,
      examTypeId,
      classId,
    }),
    [teacher?.premiumPracticeAttemptPricingByScope, examTypeId, classId]
  );

  const premiumMockQuestionPriceByDifficulty = useMemo(() => {
    return resolveScopedDifficultyPricing({
      legacyPrice: teacher?.premiumMockTestQuestionPrice,
      globalPricing: teacher?.premiumMockTestQuestionPriceByDifficulty,
      scopedPricingMap: teacher?.premiumMockTestQuestionPricingByScope,
      examTypeId,
      classId,
    });
  }, [
    teacher?.premiumMockTestQuestionPrice,
    teacher?.premiumMockTestQuestionPriceByDifficulty,
    teacher?.premiumMockTestQuestionPricingByScope,
    examTypeId,
    classId,
  ]);

  const premiumMockAttemptRule = useMemo(() => {
    const scopeKey = buildPricingScopeKey(examTypeId, classId);
    if (scopeKey && teacher?.premiumMockTestAttemptPricingByScope?.[scopeKey]) {
      return normalizePremiumCustomMockAttemptPricingRule(teacher.premiumMockTestAttemptPricingByScope[scopeKey]);
    }
    return buildPremiumCustomMockAttemptRuleFromLegacyLimit(teacher?.premiumMockTestAttemptLimit);
  }, [
    teacher?.premiumMockTestAttemptLimit,
    teacher?.premiumMockTestAttemptPricingByScope,
    examTypeId,
    classId,
  ]);

  const resolvedQuestionPriceByDifficulty = isCustomMockVariant
    ? premiumMockQuestionPriceByDifficulty
    : premiumPracticeQuestionPriceByDifficulty;

  const estimatedPaidAmount = useMemo(() => {
    return Number(
      (
        selectedQuestionCountByDifficulty.easy * resolvedQuestionPriceByDifficulty.easy
        + selectedQuestionCountByDifficulty.medium * resolvedQuestionPriceByDifficulty.medium
        + selectedQuestionCountByDifficulty.hard * resolvedQuestionPriceByDifficulty.hard
      ).toFixed(2)
    );
  }, [resolvedQuestionPriceByDifficulty, selectedQuestionCountByDifficulty]);

  useEffect(() => {
    if (!examTypeId || !classId || normalizedTopicConfigs.length === 0) {
      if (isCustomMockVariant) handleCustomMockPackChange(null);
      else handlePracticePackChange(null);
      return;
    }

    const subjectConfigs = visibleSubjects
      .map((subject) => {
        const selectedTopics = normalizedTopicConfigs.filter((config) => config.subjectId === subject.id);
        if (selectedTopics.length === 0) return null;
        const subjectConfig = subjectConfigById[subject.id] || getDefaultSubjectConfig(subject.id);
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          questionType: subjectConfig.questionType,
          difficultyLevel: 'Easy' as const,
          questionSource: subjectConfig.questionSource,
          previousYears: subjectConfig.previousYears,
          count: selectedTopics.reduce((sum, config) => sum + config.count, 0),
          selectedTopicCount: selectedTopics.length,
        };
      })
      .filter((config): config is NonNullable<typeof config> => !!config);

    if (isCustomMockVariant) {
      handleCustomMockPackChange({
        title: `${examTypeName || 'Exam'} ${className || 'Class'} Premium Custom Mock Access`,
        questionAccessLevel,
        questionBankSource,
        duration: null,
        marksPerQuestion: null,
        negativeMarksPerQuestion: null,
        perQuestionPriceByDifficulty: premiumMockQuestionPriceByDifficulty,
        amountByDifficulty: {
          easy: Number((selectedQuestionCountByDifficulty.easy * premiumMockQuestionPriceByDifficulty.easy).toFixed(2)),
          medium: Number((selectedQuestionCountByDifficulty.medium * premiumMockQuestionPriceByDifficulty.medium).toFixed(2)),
          hard: Number((selectedQuestionCountByDifficulty.hard * premiumMockQuestionPriceByDifficulty.hard).toFixed(2)),
        },
        attemptPricing: premiumMockAttemptRule,
        estimatedAmount: estimatedPaidAmount,
        totalQuestions: selectedQuestionCount,
        totalMarks: null,
        subjectConfigs: normalizedTopicConfigs.map((config) => ({
          subjectId: config.subjectId,
          subjectName: subjectNameById[config.subjectId] || 'Subject',
          topicId: config.topicId,
          topicName: topicNameById[config.topicId] || 'Topic',
          subtopic: parseSubtopicPathSelection(config.subtopics[0] || '')[0] || '',
          subtopicPaths: config.subtopics,
          questionSource: config.previousYearMode,
          previousYears: config.previousYears,
          randomizePerAttempt: false,
          questionType: config.questionType,
          difficultyLevel: 'Easy' as const,
          count: config.count,
        })),
      });
      return;
    }

    handlePracticePackChange({
      title: `${examTypeName || 'Practice'} ${className || 'Pack'} Practice Pack`,
      questionAccessLevel,
      questionBankSource,
      perQuestionTimeSeconds,
      perQuestionPriceByDifficulty: premiumPracticeQuestionPriceByDifficulty,
      attemptPricing: premiumPracticeAttemptRule,
      estimatedAmount: estimatedPaidAmount,
      totalQuestions: selectedQuestionCount,
      questionCountByDifficulty: selectedQuestionCountByDifficulty,
      subjectConfigs,
      topicConfigs: normalizedTopicConfigs.map((config) => ({
        subjectId: config.subjectId,
        subjectName: subjectNameById[config.subjectId] || 'Subject',
        topicId: config.topicId,
        topicName: topicNameById[config.topicId] || 'Topic',
        subtopics: config.subtopics,
        questionBankSource: config.questionBankSource,
        questionType: config.questionType,
        difficultyLevel: 'Easy' as const,
        previousYearMode: config.previousYearMode,
        previousYears: config.previousYears,
        count: config.count,
      })),
    });
  }, [
    className,
    examTypeId,
    classId,
    examTypeName,
    estimatedPaidAmount,
    handleCustomMockPackChange,
    handlePracticePackChange,
    isCustomMockVariant,
    questionAccessLevel,
    questionBankSource,
    normalizedTopicConfigs,
    premiumMockAttemptRule,
    premiumMockQuestionPriceByDifficulty,
    premiumPracticeAttemptRule,
    premiumPracticeQuestionPriceByDifficulty,
    selectedQuestionCount,
    selectedQuestionCountByDifficulty,
    subjectConfigById,
    subjectNameById,
    topicNameById,
    visibleSubjects,
  ]);

  const isLoading = isPricingOwnerLoading || areTopicsLoading || areQuestionsLoading || areTeacherQuestionPurchasesLoading;
  return (
    <Card className="border-border/70 bg-card/75">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              {isCustomMockVariant ? <CreditCard className="h-5 w-5 text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}
              {isCustomMockVariant ? 'Premium Custom Mock Builder' : 'Practice Session Builder'}
            </CardTitle>
            <CardDescription>
              {isCustomMockVariant
                ? 'Use the same question-allotment flow to save prepaid custom-mock coverage by exam, curriculum, subjects, topic branches, and question counts.'
                : 'Configure a teacher practice session blueprint using exam, curriculum, subjects, topic branches, and requested question counts.'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {visibleSubjects.length} subject{visibleSubjects.length === 1 ? '' : 's'}
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {selectedQuestionCount} question{selectedQuestionCount === 1 ? '' : 's'}
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {selectedSubtopicCount} branch{selectedSubtopicCount === 1 ? '' : 'es'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!examTypeId || !classId ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
            Select exam and curriculum in the offer basics section first.
          </div>
        ) : selectedSubjectIds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
            {isCustomMockVariant
              ? 'Select one or more subjects above to unlock the premium custom mock builder.'
              : 'Select one or more subjects above to unlock the practice-session builder.'}
          </div>
        ) : isLoading ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
            {isCustomMockVariant
              ? 'Loading teacher paid question bank for premium custom mock setup...'
              : 'Loading teacher question bank for practice-session setup...'}
          </div>
        ) : visibleSubjects.length === 0 ? (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Question Access</Label>
                <div className="flex h-10 items-center rounded-md border border-border bg-background px-3 text-sm font-medium">
                  Paid Questions Only
                </div>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Question Bank Source</Label>
                    <Select value={questionBankSource} onValueChange={(value) => setQuestionBankSource(value as QuestionBankSource)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {resolvedQuestionBankSourceOptions.map((value) => (
                          <SelectItem key={value} value={value}>
                            {questionBankSourceLabel(value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
              {isCustomMockVariant
                ? 'No matching paid custom-mock questions are available for the selected exam, curriculum, and question-bank source.'
                : 'No matching practice questions are available for the selected exam, curriculum, access level, and question-bank source.'}
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Question Access</Label>
                <div className="flex h-10 items-center rounded-md border border-border bg-background px-3 text-sm font-medium">
                  Paid Questions Only
                </div>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Question Bank Source</Label>
                <Select value={questionBankSource} onValueChange={(value) => setQuestionBankSource(value as QuestionBankSource)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resolvedQuestionBankSourceOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {questionBankSourceLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Subject-wise Question Setup
              </p>
              {visibleSubjects.map((subject) => {
                const config = subjectConfigById[subject.id] || getDefaultSubjectConfig(subject.id);
                const availableCount = getAvailableCountForSubject(subject.id, config);
                const availablePyqYears = getAvailablePreviousYearsForSubject(subject.id, config);
                const hasSpecificYearSelection = config.previousYears.length > 0;
                const pyqYearSelectionLabel = hasSpecificYearSelection ? config.previousYears.join(', ') : 'All Years';
                const subjectTopics = topicsBySubject[subject.id] || [];
                const selectedTopicIds = selectedTopicIdsBySubject[subject.id] || [];

                return (
                  <div key={subject.id} className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-4 space-y-4 shadow-sm">
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
                            className={cn(
                              'h-9 rounded-full px-4 font-medium',
                              config.questionType === type
                                ? 'border-primary/70 bg-primary text-primary-foreground'
                                : 'border-border/80 bg-background/70 hover:border-primary/40 hover:bg-primary/10'
                            )}
                            onClick={() => updateSubjectConfig(subject.id, { questionType: type })}
                          >
                            {type}
                          </Button>
                        ))}
                      </div>
                    </div>

                    

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Question History Filter</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={cn(
                            'h-9 rounded-full px-4 font-medium',
                            config.questionSource === 'all'
                              ? 'border-primary/70 bg-primary text-primary-foreground'
                              : 'border-border/80 bg-background/70 hover:border-primary/40 hover:bg-primary/10'
                          )}
                          onClick={() => updateSubjectConfig(subject.id, { questionSource: 'all' })}
                        >
                          All Questions
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={cn(
                            'h-9 rounded-full px-4 font-medium',
                            config.questionSource === 'pyq'
                              ? 'border-primary/70 bg-primary text-primary-foreground'
                              : 'border-border/80 bg-background/70 hover:border-primary/40 hover:bg-primary/10'
                          )}
                          onClick={() => updateSubjectConfig(subject.id, { questionSource: 'pyq' })}
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
                            No previous-year questions match this subject with the current access, source, and type filters.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={cn(
                                'h-9 rounded-full px-4 font-medium',
                                !hasSpecificYearSelection
                                  ? 'border-primary/70 bg-primary text-primary-foreground'
                                  : 'border-border/80 bg-background/70 hover:border-primary/40 hover:bg-primary/10'
                              )}
                              onClick={() => updateSubjectConfig(subject.id, { questionSource: 'pyq', previousYears: [] })}
                            >
                              All Years
                            </Button>
                            {availablePyqYears.map((year) => {
                              const selected = config.previousYears.includes(year);
                              return (
                                <label
                                  key={`${subject.id}-${year}`}
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
                                      updateSubjectConfig(subject.id, {
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
                      </div>
                    ) : null}

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Question Bank Count</p>
                      <Badge variant="outline" className="text-sm border-primary/35 bg-background/60">
                        {availableCount} available
                      </Badge>
                    </div>

                    <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
                      <p className="text-xs text-muted-foreground">Topics and Subtopics</p>
                      {subjectTopics.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No topics found for this subject.</p>
                      ) : (
                        subjectTopics.map((topic) => {
                          const selectedSubtopicPaths = normalizeSubtopicPathSelections(selectedSubtopicPathsByTopicId[topic.id] || []);
                          const topicPathPool = getSubtopicPathPoolForTopic(subject.id, topic.id, config);
                          const topicAvailableCount = getAvailableCountForTopic(subject.id, topic.id, config, selectedSubtopicPaths);
                          const selected = selectedTopicIds.includes(topic.id);
                          const storedTopicCount = topicCountById[topic.id];
                          const requestedCount = Number.isFinite(Number(storedTopicCount))
                            ? Number(storedTopicCount)
                            : (selected ? Math.min(10, Math.max(1, topicAvailableCount)) : 0);
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
                              || !levelOptions.some((option) => normalizeSubtopicValue(option) === normalizeSubtopicValue(selectedAtLevel))
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
                                <div
                                  role="button"
                                  tabIndex={topicAvailableCount <= 0 && !selected ? -1 : 0}
                                  aria-disabled={topicAvailableCount <= 0 && !selected}
                                  className="flex items-center gap-2 text-left text-sm"
                                  onClick={() => {
                                    if (topicAvailableCount <= 0 && !selected) return;
                                    toggleTopic(subject.id, topic.id, !selected, config);
                                  }}
                                  onKeyDown={(event) => {
                                    if (topicAvailableCount <= 0 && !selected) return;
                                    if (event.key !== 'Enter' && event.key !== ' ') return;
                                    event.preventDefault();
                                    toggleTopic(subject.id, topic.id, !selected, config);
                                  }}
                                >
                                  <Checkbox
                                    checked={selected}
                                    disabled={topicAvailableCount <= 0 && !selected}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                    }}
                                    onCheckedChange={(value) => toggleTopic(subject.id, topic.id, !!value, config)}
                                  />
                                  <span className="font-medium">{topic.name}</span>
                                </div>
                                <Badge variant="outline" className="border-primary/35 bg-background/70">
                                  {topicAvailableCount} available
                                </Badge>
                                <Input
                                  type="number"
                                  value={requestedCount}
                                  disabled={!selected || topicAvailableCount <= 0}
                                  className="text-center font-medium"
                                  onFocus={() => {
                                    if (!selected && topicAvailableCount > 0) {
                                      toggleTopic(subject.id, topic.id, true, config);
                                    }
                                  }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                  }}
                                  onChange={(event) => {
                                    const raw = event.target.value;
                                    if (!raw.trim()) {
                                      setTopicCountById((current) => ({ ...current, [topic.id]: 0 }));
                                      return;
                                    }
                                    const next = Number(raw);
                                    setTopicCountById((current) => ({
                                      ...current,
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
                                      className="h-9 rounded-full px-4 font-medium"
                                      onClick={() => applyTopicSubtopicPathSelections(subject.id, topic.id, [], config)}
                                    >
                                      All subtopics in topic
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                    {levelOptionSets.map((levelOptions, levelIndex) => (
                                      <div key={`${topic.id}-subtopic-level-${levelIndex}`} className="space-y-1">
                                        <p className="text-[11px] text-muted-foreground">Level {levelIndex + 1}</p>
                                        <Select
                                          value={draftSubtopicPath[levelIndex] || '__no_selection__'}
                                          onValueChange={(value) => {
                                            setSubtopicDraftPathByTopicId((current) => {
                                              const existing = [...(current[topic.id] || [])];
                                              const nextPath = existing.slice(0, levelIndex);
                                              if (value !== '__no_selection__') {
                                                nextPath[levelIndex] = value;
                                              }
                                              return { ...current, [topic.id]: nextPath };
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
                                              <SelectItem key={`${topic.id}-${levelIndex}-${option}`} value={option}>
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
                                      className="h-9 rounded-full px-4 font-medium"
                                      disabled={normalizedDraftPath.length === 0}
                                      onClick={() => {
                                        if (normalizedDraftPath.length === 0) return;
                                        const branchPath = serializeSubtopicPathSelection(normalizedDraftPath);
                                        const mergedPaths = normalizeSubtopicPathSelections([...selectedSubtopicPaths, branchPath]);
                                        applyTopicSubtopicPathSelections(subject.id, topic.id, mergedPaths, config);
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
                                        const branchAvailableCount = getAvailableCountForTopic(subject.id, topic.id, config, [selectedPath]);
                                        return (
                                          <button
                                            key={`${topic.id}-${selectedPath}`}
                                            type="button"
                                            className="inline-flex items-center gap-2 rounded-full border border-primary/45 bg-primary/15 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/20"
                                            onClick={() => {
                                              const nextPaths = normalizeSubtopicPathSelections(
                                                selectedSubtopicPaths.filter((path) => path !== selectedPath)
                                              );
                                              applyTopicSubtopicPathSelections(subject.id, topic.id, nextPaths, config);
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
                                  No subtopic hierarchy is available for this topic with the current filter combination.
                                </p>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedQuestionCount > 0 ? (
              <Card className="group relative overflow-hidden border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-cyan-950/75 shadow-xl">
                <CardContent className="relative space-y-3 pt-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="line-clamp-2 text-lg font-semibold leading-tight tracking-tight">
                        {isCustomMockVariant ? 'Premium Custom Mock Access' : 'Premium Practice Pack'}
                      </p>
                      <Badge
                        variant="outline"
                        className="border-cyan-300/45 bg-cyan-500/10 text-cyan-100"
                      >
                        {isCustomMockVariant ? 'Paid Custom Mock' : 'Paid Practice'}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-slate-100">Teacher: {teacherName}</p>
                    <p className="text-xs text-slate-300">
                      {isCustomMockVariant
                        ? `Offer custom-mock coverage for ${examTypeName || 'Exam'} / ${className || 'Curriculum'}`
                        : `Offer practice preview for ${examTypeName || 'Exam'} / ${className || 'Curriculum'}`}
                    </p>
                    <p className="text-[11px] text-cyan-100/80">
                      {isCustomMockVariant
                        ? 'Students can open the premium custom mock builder later and use these included question counts without paying again.'
                        : 'Inherits the paid practice pricing and attempt rules from subscription settings for this scope.'}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {examTypeName ? <Badge variant="outline" className="border-cyan-300/45 bg-cyan-500/10 text-cyan-100">{examTypeName}</Badge> : null}
                      {className ? <Badge variant="outline" className="border-sky-300/45 bg-sky-500/10 text-sky-100">{className}</Badge> : null}
                      <Badge variant="outline" className="border-amber-300/45 bg-amber-500/10 text-amber-100">
                        {questionBankSourceLabel(questionBankSource)}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-muted-foreground">
                      Questions
                      <p className="mt-1 text-sm font-semibold text-foreground">{selectedQuestionCount}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-muted-foreground">
                      Question Bank
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {questionBankSource === 'teacher_official' ? 'Teacher Official' : 'Student + Official'}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300">
                    {isCustomMockVariant
                      ? `Attempt rule after build: ${formatPremiumCustomMockAttemptPricingRule(premiumMockAttemptRule)}`
                      : `Attempt rule: ${formatPremiumPracticeAttemptPricingRule(premiumPracticeAttemptRule)}`}
                  </p>

                  <OfferQuestionCoverageSummary
                    title="Included Coverage"
                    accent={isCustomMockVariant ? 'cyan' : 'amber'}
                    variant="embedded"
                    examTypeName={examTypeName}
                    curriculumName={className}
                    totalQuestions={selectedQuestionCount}
                    rows={normalizedTopicConfigs.map((config, index) => ({
                      id: `${config.subjectId}-${config.topicId}-${index}`,
                      subjectName: subjectNameById[config.subjectId] || 'Subject',
                      topicName: topicNameById[config.topicId] || 'Topic',
                      subtopicPaths: config.subtopics,
                      count: config.count,
                    }))}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
                {isCustomMockVariant
                  ? 'Select topics and question counts to generate the premium custom mock coverage preview.'
                  : 'Select topics and question counts to generate the practice-session pack and its paid-card preview.'}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
