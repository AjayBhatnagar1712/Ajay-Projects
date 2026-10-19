'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import DashboardHeader from '@/components/dashboard-header';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking, useUser, useDoc, useStorage } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, where, limit } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { CreditCard, LoaderCircle, PlusCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import Script from 'next/script';
import { completeVerifiedPayment, createRazorpayOrder, finalizePaymentRevenueSplit, findRecoverablePremiumCustomMockPayments, verifyRazorpayPayment } from '@/app/actions';
import { sendSelfBellNotification } from '@/lib/client-notifications';
import { cn } from '@/lib/utils';
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
import { extractSubtopicPaths, normalizeSubtopicValue, splitSubtopicPath } from '@/lib/subtopic-paths';
import { buildPracticeQuestionScopeEntries, type PracticeQuestionScopeEntry } from '@/lib/practice-question-scope';
import { ADMIN_CUSTOM_MOCK_ASSIGNMENT_SOURCE } from '@/lib/admin-custom-mock-management';
import { DCAM_QUESTION_BANK_LABEL, DCAM_QUESTION_BANK_OWNER_ID } from '@/lib/teacher-authoring';
import { mergeLegacyDifficultyCounts, QUESTION_DIFFICULTY } from '@/lib/question-difficulty';
import {
  applyPremiumCustomMockAttemptTopUp,
  buildPremiumCustomMockAttemptRuleFromLegacyLimit,
  formatPremiumCustomMockAttemptPricingRule,
  normalizePremiumCustomMockAttemptPricingRule,
  resolvePremiumCustomMockAttemptUsage,
  type AttemptIntervalUnit,
  type AttemptLimitMode,
  type PremiumCustomMockAttemptActionKind,
  type PremiumCustomMockAttemptPaymentKind,
  type PremiumCustomMockAttemptPricingMap,
  type PremiumCustomMockAttemptPricingRule,
  type PremiumCustomMockAttemptState,
} from '@/lib/premium-custom-mock';

type Question = {
  id: string;
  questionText: string;
  questionType?: 'MCQ' | 'Numerical' | 'Text';
  classId: string;
  subjectId: string;
  topicId: string;
  subtopics?: string[];
  accessLevel: 'free' | 'paid';
  mockTestOnly?: boolean;
  isPreviousYear?: boolean;
  previousYear?: string;
  examTypeId: string;
  difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  examLevel?: 'weak' | 'medium' | 'strong';
  alignments?: Array<{
    examTypeId: string;
    classId: string;
    subjectId: string;
    topicId?: string;
    subtopics?: string[];
    difficultyLevel?: 'Easy' | 'Medium' | 'Hard';
    accessLevel?: 'free' | 'paid';
    mockTestOnly?: boolean;
    isPreviousYear?: boolean;
    previousYear?: string;
  }>;
  teacherId?: string;
};
type Class = { id: string; name: string; examTypeId: string };
type Subject = { id: string; name: string; classId: string };
type Topic = {
  id: string;
  name: string;
  subjectId: string;
  subtopics?: string[];
  subtopicPaths?: string[];
  subtopicCatalog?: string[];
};
type ExamType = { id: string; name: string };
type TeachingAssignment = { examTypeId?: string; classId: string; subjectIds?: string[]; allSubjects?: boolean };
type TeacherProfile = { teachingAssignments?: TeachingAssignment[] };
type PremiumDifficultyPricing = {
  easy?: number;
  medium?: number;
  hard?: number;
};
type TeacherPricingProfile = TeacherProfile & DcamQuestionPricingProfile & {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  premiumMockTestQuestionPrice?: number;
  premiumMockTestQuestionPriceByDifficulty?: PremiumDifficultyPricing;
  premiumMockTestQuestionPricingByScope?: ScopedDifficultyPricingMap;
  dcamMockTestQuestionPricingByScope?: ScopedDifficultyPricingMap;
  premiumMockTestAttemptPricingByScope?: PremiumCustomMockAttemptPricingMap;
  premiumMockTestAttemptLimit?: {
    mode?: AttemptLimitMode;
    maxTotalAttempts?: number | null;
    maxAttemptsPerInterval?: number | null;
    intervalValue?: number | null;
    intervalUnit?: AttemptIntervalUnit | null;
  };
  publicTeacherQuestionPurchaseScopes?: TeacherQuestionPurchasePublicScope[];
};
type RecoverablePremiumCustomMockPayment = {
  paymentId: string;
  orderId: string;
  amount: number;
  paidAt: string;
  teacherId: string;
  examTypeId: string;
  classId: string;
  questionAmountPaid: number;
  attemptAmountPaid: number;
  attemptActionKind: PremiumCustomMockAttemptActionKind;
};
type PremiumMockFeaturePurchase = {
  id?: string;
  teacherId?: string;
  teacherName?: string;
  examTypeId?: string;
  examTypeName?: string;
  classId?: string;
  className?: string;
  premiumCombinationKey?: string;
  premiumCustomMockTestId?: string;
  testTitle?: string;
  amount?: number;
  questionCount?: number;
  questionAmountPaid?: number;
  attemptAmountPaid?: number;
  currency?: string;
  paidAt?: string;
  purchasedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  status?: 'paid' | 'failed';
  offerId?: string;
  offerPurchaseId?: string;
  assignmentSource?: string;
  questionBankSource?: 'student_plus_official' | 'teacher_official';
  duration?: number | null;
  marksPerQuestion?: number | null;
  negativeMarksPerQuestion?: number | null;
  attemptPricing?: PremiumCustomMockAttemptPricingRule | null;
  subjectConfigs?: Array<{
    subjectId?: string;
    subjectName?: string;
    topicId?: string;
    topicName?: string;
    subtopic?: string;
    subtopicPaths?: string[];
    questionSource?: 'all' | 'pyq';
    previousYears?: string[];
    randomizePerAttempt?: boolean;
    questionType?: 'All' | 'MCQ' | 'Numerical' | 'Text';
    difficultyLevel?: 'All' | 'Easy' | 'Medium' | 'Hard';
    count?: number;
    numQuestions?: number;
  }>;
  includedQuestionCount?: number;
  includedQuestionIds?: string[];
  includedQuestionCountByDifficulty?: { easy?: number; medium?: number; hard?: number };
  includedSubjectConfigs?: Array<{
    subjectId?: string;
    subjectName?: string;
    topicId?: string;
    topicName?: string;
    subtopic?: string;
    subtopicPaths?: string[];
    questionSource?: 'all' | 'pyq';
    previousYears?: string[];
    randomizePerAttempt?: boolean;
    questionType?: 'All' | 'MCQ' | 'Numerical' | 'Text';
    difficultyLevel?: 'All' | 'Easy' | 'Medium' | 'Hard';
      count?: number;
      numQuestions?: number;
  }>;
  mergedPurchaseIds?: string[];
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

const DIFFICULTY_LEVELS = [QUESTION_DIFFICULTY] as const;
const DEFAULT_ATTEMPT_LIMIT = {
  mode: 'unlimited' as AttemptLimitMode,
  maxTotalAttempts: null as number | null,
  maxAttemptsPerInterval: null as number | null,
  intervalValue: null as number | null,
  intervalUnit: null as AttemptIntervalUnit | null,
};

const PREVIOUS_YEAR_PATTERN = /^(19|20)\d{2}$/;
const normalizePreviousYearValue = (value?: string) => {
  const year = String(value || '').trim();
  return PREVIOUS_YEAR_PATTERN.test(year) ? year : '';
};
const normalizePreviousYearList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => normalizePreviousYearValue(String(item || '')))
        .filter(Boolean)
    )
  ).sort((a, b) => Number(b) - Number(a));
};
const normalizeQuestionSource = (value?: string): 'all' | 'pyq' => (value === 'pyq' ? 'pyq' : 'all');
const getPreviousYearKey = (years: string[]) => normalizePreviousYearList(years).join('|');
const normalizeSubtopicPathSegments = (segments: string[]) =>
  segments.map((segment) => String(segment || '').trim()).filter(Boolean);
const serializeSubtopicPathSelection = (segments: string[]) =>
  normalizeSubtopicPathSegments(segments).join(' > ');
const parseSubtopicPathSelection = (value?: string) =>
  normalizeSubtopicPathSegments(splitSubtopicPath(String(value || '')));
const getSubtopicPathKey = (segments: string[]) =>
  normalizeSubtopicPathSegments(segments).map((segment) => normalizeSubtopicValue(segment)).join('>');
const normalizeSubtopicPathSelections = (
  subtopicPaths?: string[],
  legacySubtopic?: string
) => {
  const unique = new Map<string, string>();
  (subtopicPaths || []).forEach((value) => {
    const parsed = parseSubtopicPathSelection(value);
    if (!parsed.length) return;
    const key = getSubtopicPathKey(parsed);
    if (!key || unique.has(key)) return;
    unique.set(key, serializeSubtopicPathSelection(parsed));
  });
  const legacy = String(legacySubtopic || '').trim();
  if (legacy) {
    const parsed = parseSubtopicPathSelection(legacy);
    const key = getSubtopicPathKey(parsed);
    if (key && !unique.has(key)) {
      unique.set(key, serializeSubtopicPathSelection(parsed));
    }
  }
  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
};
const getSubtopicSelectionKey = (subtopicPaths?: string[], legacySubtopic?: string) =>
  normalizeSubtopicPathSelections(subtopicPaths, legacySubtopic)
    .map((value) => getSubtopicPathKey(parseSubtopicPathSelection(value)))
    .filter(Boolean)
    .sort()
    .join('|');
const subtopicPathStartsWith = (path: string[], prefix: string[]) => {
  const normalizedPath = normalizeSubtopicPathSegments(path);
  const normalizedPrefix = normalizeSubtopicPathSegments(prefix);
  if (!normalizedPrefix.length) return true;
  if (normalizedPath.length < normalizedPrefix.length) return false;
  return normalizedPrefix.every(
    (segment, index) => normalizeSubtopicValue(normalizedPath[index]) === normalizeSubtopicValue(segment)
  );
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
const getFirstParamValue = (params: URLSearchParams, keys: string[]) => {
  for (const key of keys) {
    const value = (params.get(key) || '').trim();
    if (value) return value;
  }
  return '';
};
const isStudentPlusOfficialQuestion = (question: Question) => question.mockTestOnly !== true;
const matchesQuestionBankSource = (
  question: Question,
  source: 'student_plus_official' | 'teacher_official'
) => (source === 'teacher_official' ? !!question.mockTestOnly : isStudentPlusOfficialQuestion(question));
type PremiumCustomMockScopeConfig = {
  subjectId: string;
  subjectName?: string;
  topicId: string;
  topicName?: string;
  subtopic: string;
  subtopicPaths: string[];
  questionSource: 'all' | 'pyq';
  previousYears: string[];
  questionType: 'All' | 'MCQ' | 'Numerical' | 'Text';
  difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard';
  count: number;
};
const normalizePremiumCustomMockScopeConfigs = (value: unknown): PremiumCustomMockScopeConfig[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map<PremiumCustomMockScopeConfig | null>((item) => {
      if (!item || typeof item !== 'object') return null;
      const config = item as Record<string, unknown>;
      const count = Math.floor(Number(config.numQuestions ?? config.count ?? 0));
      const rawQuestionType = config.questionType;
      return {
        subjectId: String(config.subjectId || '').trim(),
        subjectName: String(config.subjectName || '').trim(),
        topicId: String(config.topicId || '').trim(),
        topicName: String(config.topicName || '').trim(),
        subtopic: String(config.subtopic || '').trim(),
        subtopicPaths: normalizeSubtopicPathSelections(
          Array.isArray(config.subtopicPaths) ? config.subtopicPaths.map((entry) => String(entry || '')) : [],
          String(config.subtopic || '').trim()
        ),
        questionSource: normalizeQuestionSource(String(config.questionSource || 'all')),
        previousYears: normalizePreviousYearList(Array.isArray(config.previousYears) ? config.previousYears : []),
        questionType:
          rawQuestionType === 'MCQ' || rawQuestionType === 'Numerical' || rawQuestionType === 'Text'
            ? rawQuestionType
            : 'All',
        difficultyLevel:
          QUESTION_DIFFICULTY,
        count: Number.isFinite(count) && count > 0 ? count : 0,
      };
    })
    .filter((config): config is PremiumCustomMockScopeConfig => !!config && !!config.subjectId && config.count > 0);
};
const getPremiumCustomMockScopeConfigQuestionCount = (configs: PremiumCustomMockScopeConfig[]) =>
  configs.reduce((count, config) => count + Math.max(0, Number(config.count || 0)), 0);
const getPremiumCustomMockIncludedQuestionCountFromRecord = (value?: {
  includedQuestionCount?: number;
  includedQuestionIds?: string[];
  questionCount?: number;
  includedSubjectConfigs?: unknown;
  subjectConfigs?: unknown;
} | null) => {
  const normalizedConfigs = normalizePremiumCustomMockScopeConfigs(
    value?.includedSubjectConfigs || value?.subjectConfigs
  );
  const configuredCount = getPremiumCustomMockScopeConfigQuestionCount(normalizedConfigs);
  const storedIdsCount = Array.isArray(value?.includedQuestionIds)
    ? value.includedQuestionIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).length
    : 0;
  const storedCount = Math.max(0, Number(value?.includedQuestionCount ?? value?.questionCount ?? 0));
  return Math.max(storedCount, configuredCount, storedIdsCount);
};
const premiumCustomMockConfigSpecificity = (
  config: Pick<PremiumCustomMockScopeConfig, 'topicId' | 'subtopicPaths' | 'questionType' | 'questionSource' | 'previousYears' | 'difficultyLevel'>
) => {
  const normalizedSubtopicPaths = normalizeSubtopicPathSelections(config.subtopicPaths || []);
  return (
    (config.topicId ? 1000 : 0)
    + (normalizedSubtopicPaths.length * 100)
    + (config.questionSource === 'pyq' ? 20 : 0)
    + ((config.previousYears || []).length * 5)
    + (config.difficultyLevel !== 'All' ? 2 : 0)
    + (config.questionType !== 'All' ? 1 : 0)
  );
};
const selectedCustomMockScopeFitsIncludedScope = (
  selectedConfig: Pick<PremiumCustomMockScopeConfig, 'subjectId' | 'topicId' | 'subtopicPaths' | 'questionType' | 'questionSource' | 'previousYears' | 'difficultyLevel'>,
  includedConfig: Pick<PremiumCustomMockScopeConfig, 'subjectId' | 'topicId' | 'subtopicPaths' | 'questionType' | 'questionSource' | 'previousYears' | 'difficultyLevel'>
) => {
  if (includedConfig.subjectId !== selectedConfig.subjectId) return false;
  if (includedConfig.topicId && includedConfig.topicId !== selectedConfig.topicId) return false;
  if (includedConfig.questionType !== 'All' && includedConfig.questionType !== selectedConfig.questionType) return false;
  

  if (includedConfig.questionSource === 'pyq') {
    if (selectedConfig.questionSource !== 'pyq') return false;
    const includedYears = normalizePreviousYearList(includedConfig.previousYears || []);
    const selectedYears = normalizePreviousYearList(selectedConfig.previousYears || []);
    if (includedYears.length > 0) {
      if (selectedYears.length === 0) return false;
      if (!selectedYears.every((year) => includedYears.includes(year))) return false;
    }
  }

  const includedSubtopicPaths = normalizeSubtopicPathSelections(includedConfig.subtopicPaths || []);
  const selectedSubtopicPaths = normalizeSubtopicPathSelections(selectedConfig.subtopicPaths || []);
  if (includedSubtopicPaths.length === 0) return true;
  if (selectedSubtopicPaths.length === 0) return false;

  return selectedSubtopicPaths.every((selection) => {
    const selectionPath = parseSubtopicPathSelection(selection);
    return includedSubtopicPaths.some((includedSelection) =>
      subtopicPathStartsWith(selectionPath, parseSubtopicPathSelection(includedSelection))
    );
  });
};
type CustomTestDoc = {
  id?: string;
  title?: string;
  duration?: number;
  examTypeId?: string;
  classId?: string;
  accessLevel?: 'free' | 'paid';
  examLevel?: 'weak' | 'medium' | 'strong';
  thumbnailUrl?: string;
  imageUrl?: string;
  teacherName?: string;
  examTypeName?: string;
  className?: string;
  questionCountByDifficulty?: { easy?: number; medium?: number; hard?: number };
  perQuestionPriceByDifficulty?: { easy?: number; medium?: number; hard?: number };
  amountByDifficulty?: { easy?: number; medium?: number; hard?: number };
  grossAmount?: number;
  attemptsPaidAmount?: number;
  totalAmountPaid?: number;
  purchasedAt?: string;
  offerId?: string;
  offerPurchaseId?: string;
  premiumFeaturePurchaseId?: string;
  premiumFeaturePurchaseIds?: string[];
  includedQuestionCount?: number;
  includedQuestionIds?: string[];
  includedQuestionCountByDifficulty?: { easy?: number; medium?: number; hard?: number };
  includedSubjectConfigs?: Array<{
    subjectId?: string;
    topicId?: string;
    subtopic?: string;
    subtopicPaths?: string[];
    questionType?: 'All' | 'MCQ' | 'Numerical' | 'Text';
    difficultyLevel?: 'All' | 'Easy' | 'Medium' | 'Hard';
    questionSource?: 'all' | 'pyq';
    previousYears?: string[];
    count?: number;
    numQuestions?: number;
  }>;
  lastPaymentId?: string;
  paymentHistory?: Array<{
    paymentId: string;
    orderId?: string;
    amount: number;
    paidAt: string;
    kind?: PremiumCustomMockAttemptPaymentKind;
    questionAmount?: number;
    attemptAmount?: number;
    attemptCount?: number;
  }>;
  attemptPricing?: PremiumCustomMockAttemptPricingRule;
  attemptState?: PremiumCustomMockAttemptState;
  createdAt?: { toDate?: () => Date } | Date | string | null;
  createdFromTeacherId?: string;
  premiumCombinationKey?: string;
  config?: {
    questionIds?: string[];
    duration?: number;
    marksPerQuestion?: number;
    negativeMarksPerQuestion?: number;
    subjectConfigs?: Array<{
      subjectId?: string;
      topicId?: string;
      subtopic?: string;
      subtopicPaths?: string[];
      questionType?: 'All' | 'MCQ' | 'Numerical' | 'Text';
      difficultyLevel?: 'All' | 'Easy' | 'Medium' | 'Hard';
      questionSource?: 'all' | 'pyq';
      previousYearMode?: 'all' | 'pyq';
      previousYears?: string[];
      randomizePerAttempt?: boolean;
      count?: number;
      numQuestions?: number;
    }>;
  };
};

const asDate = (value?: { toDate?: () => Date } | Date | string | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    try {
      const parsed = value.toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

const PREMIUM_OFFER_FEATURE_SUFFIX = '_premium_custom_mock';
const inferOfferPurchaseIdFromPremiumMockFeatureId = (value?: string) => {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith('offer_') || !normalized.endsWith(PREMIUM_OFFER_FEATURE_SUFFIX)) return '';
  return normalized.slice('offer_'.length, normalized.length - PREMIUM_OFFER_FEATURE_SUFFIX.length).trim();
};
const resolveOfferPurchaseIdFromPremiumFeatureRecord = (value?: {
  id?: string;
  offerPurchaseId?: string;
} | null) => String(value?.offerPurchaseId || '').trim() || inferOfferPurchaseIdFromPremiumMockFeatureId(value?.id);
const isAdminAssignedPremiumFeatureRecord = (value?: {
  assignmentSource?: string;
} | null) => String(value?.assignmentSource || '').trim() === ADMIN_CUSTOM_MOCK_ASSIGNMENT_SOURCE;
const isOfferBackedPremiumFeatureRecord = (value?: {
  id?: string;
  offerId?: string;
  offerPurchaseId?: string;
  assignmentSource?: string;
} | null) =>
  isAdminAssignedPremiumFeatureRecord(value)
  ||
  !!String(value?.offerId || '').trim()
  || !!resolveOfferPurchaseIdFromPremiumFeatureRecord(value);

const EMPTY_STRING_SET = new Set<string>();
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

const normalizePurchaseIdList = (value: unknown): string[] => (
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

const getMergedPremiumCustomMockScopeKey = (config: PremiumCustomMockScopeConfig) => [
  config.subjectId,
  config.topicId || '',
  getSubtopicSelectionKey(config.subtopicPaths, config.subtopic),
  config.questionType,
  config.difficultyLevel,
  config.questionSource || 'all',
  getPreviousYearKey(config.previousYears || []),
].join('__');

const mergePremiumCustomMockScopeConfigs = (configs: PremiumCustomMockScopeConfig[]) => {
  const merged = new Map<string, PremiumCustomMockScopeConfig>();
  configs.forEach((config) => {
    const key = getMergedPremiumCustomMockScopeKey(config);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...config, count: Math.max(0, Number(config.count || 0)) });
      return;
    }
    merged.set(key, {
      ...current,
      ...config,
      count: Math.max(
        Math.max(0, Number(current.count || 0)),
        Math.max(0, Number(config.count || 0))
      ),
    });
  });
  return Array.from(merged.values());
};

const getPremiumCustomMockScopeConfigSetKey = (configs: PremiumCustomMockScopeConfig[]) => (
  configs
    .map((config) => getMergedPremiumCustomMockScopeKey(config))
    .filter(Boolean)
    .sort()
    .join('||')
);

const mergeAdminAssignedPremiumFeaturePurchases = (
  purchases: PremiumMockFeaturePurchase[],
  preferredPurchaseId?: string
): PremiumMockFeaturePurchase | null => {
  if (!Array.isArray(purchases) || purchases.length === 0) return null;

  const sortedPurchases = [...purchases]
    .map((purchase) => ({
      ...purchase,
      id: String(purchase.id || '').trim(),
      teacherId: String(purchase.teacherId || '').trim(),
      examTypeId: String(purchase.examTypeId || '').trim(),
      classId: String(purchase.classId || '').trim(),
      offerPurchaseId: resolveOfferPurchaseIdFromPremiumFeatureRecord(purchase),
      questionCount: getPremiumCustomMockIncludedQuestionCountFromRecord(purchase),
      includedQuestionCount: getPremiumCustomMockIncludedQuestionCountFromRecord(purchase),
    }))
    .filter((purchase) => !!purchase.id && purchase.status === 'paid' && isAdminAssignedPremiumFeatureRecord(purchase))
    .sort((left, right) => {
      const leftTime =
        asDate(left.updatedAt as { toDate?: () => Date } | Date | string | null)?.getTime()
        || asDate(left.paidAt)?.getTime()
        || asDate(left.purchasedAt as { toDate?: () => Date } | Date | string | null)?.getTime()
        || asDate(left.createdAt as { toDate?: () => Date } | Date | string | null)?.getTime()
        || 0;
      const rightTime =
        asDate(right.updatedAt as { toDate?: () => Date } | Date | string | null)?.getTime()
        || asDate(right.paidAt)?.getTime()
        || asDate(right.purchasedAt as { toDate?: () => Date } | Date | string | null)?.getTime()
        || asDate(right.createdAt as { toDate?: () => Date } | Date | string | null)?.getTime()
        || 0;
      return rightTime - leftTime;
    });

  if (sortedPurchases.length === 0) return null;

  const primaryPurchase = sortedPurchases.find((purchase) => purchase.id === String(preferredPurchaseId || '').trim()) || sortedPurchases[0];
  const mergedPurchaseIds = sortedPurchases.map((purchase) => purchase.id!).filter(Boolean);
  const mergedIncludedQuestionIds = Array.from(
    new Set(
      sortedPurchases.flatMap((purchase) => normalizeQuestionIdList(purchase.includedQuestionIds))
    )
  );
  const mergedIncludedSubjectConfigs = mergePremiumCustomMockScopeConfigs(
    sortedPurchases.flatMap((purchase) =>
      normalizePremiumCustomMockScopeConfigs(
        purchase.includedSubjectConfigs || purchase.subjectConfigs
      )
    )
  );
  const mergedConfiguredCount = getPremiumCustomMockScopeConfigQuestionCount(mergedIncludedSubjectConfigs);
  const mergedStoredCount = Math.max(
    ...sortedPurchases.map((purchase) => getPremiumCustomMockIncludedQuestionCountFromRecord(purchase)),
    0
  );
  const mergedQuestionCount = mergedIncludedQuestionIds.length > 0
    ? mergedIncludedQuestionIds.length
    : Math.max(mergedStoredCount, mergedConfiguredCount);
  const adjustedMergedIncludedSubjectConfigs = (
    mergedIncludedQuestionIds.length > 0 && mergedIncludedSubjectConfigs.length === 1
      ? mergedIncludedSubjectConfigs.map((config) => ({
          ...config,
          count: mergedQuestionCount,
        }))
      : mergedIncludedSubjectConfigs
  );

  return {
    ...primaryPurchase,
    id: primaryPurchase.id,
    questionCount: mergedQuestionCount,
    includedQuestionCount: mergedQuestionCount,
    includedQuestionIds: mergedIncludedQuestionIds,
    includedSubjectConfigs: adjustedMergedIncludedSubjectConfigs,
    subjectConfigs: adjustedMergedIncludedSubjectConfigs,
    mergedPurchaseIds,
  };
};

const getIncludedQuestionIdsFromSavedCustomTest = (value?: {
  includedQuestionIds?: string[];
  includedQuestionCount?: number;
  config?: { questionIds?: string[] };
} | null) => {
  const storedIds = normalizeQuestionIdList(value?.includedQuestionIds);
  if (storedIds.length > 0) return storedIds;

  const storedIncludedCount = Math.max(0, Number(value?.includedQuestionCount || 0));
  if (storedIncludedCount <= 0) return [];

  const savedQuestionIds = Array.isArray(value?.config?.questionIds)
    ? value.config.questionIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
  return savedQuestionIds.slice(0, storedIncludedCount);
};

const getConsumedIncludedQuestionCountFromSavedCustomTest = (value?: {
  includedQuestionCount?: number;
  includedQuestionIds?: string[];
  config?: { questionIds?: string[] };
} | null) => {
  const storedIncludedQuestionIds = getIncludedQuestionIdsFromSavedCustomTest(value);
  if (storedIncludedQuestionIds.length > 0) return storedIncludedQuestionIds.length;
  const storedIncludedCount = Math.max(0, Number(value?.includedQuestionCount || 0));
  const savedQuestionCount = Array.isArray(value?.config?.questionIds)
    ? value?.config?.questionIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).length
    : 0;

  if (storedIncludedCount <= 0) return 0;
  if (savedQuestionCount <= 0) return storedIncludedCount;
  return Math.min(storedIncludedCount, savedQuestionCount);
};
const countQuestionIdsByDifficulty = (
  questionIds: string[],
  questionById: Map<string, Question>
) =>
  questionIds.reduce(
    (acc, questionId) => {
      const difficulty = questionById.get(questionId)?.difficultyLevel || 'Easy';
      if (difficulty === 'Medium') acc.Medium += 1;
      else if (difficulty === 'Hard') acc.Hard += 1;
      else acc.Easy += 1;
      return acc;
    },
    { Easy: 0, Medium: 0, Hard: 0 }
  );

const sanitizePremiumPaymentHistoryEntry = (entry: {
  paymentId: string;
  orderId?: string;
  amount: number;
  paidAt: string;
  kind?: PremiumCustomMockAttemptPaymentKind;
  questionAmount?: number;
  attemptAmount?: number;
  attemptCount?: number;
}) => ({
  paymentId: entry.paymentId,
  ...(entry.orderId ? { orderId: entry.orderId } : {}),
  amount: entry.amount,
  paidAt: entry.paidAt,
  ...(entry.kind ? { kind: entry.kind } : {}),
  ...(Number.isFinite(entry.questionAmount) ? { questionAmount: entry.questionAmount } : {}),
  ...(Number.isFinite(entry.attemptAmount) ? { attemptAmount: entry.attemptAmount } : {}),
  ...(Number.isFinite(entry.attemptCount) ? { attemptCount: entry.attemptCount } : {}),
});

const subjectConfigSchema = z.object({
  subjectId: z.string().min(1, 'Select a subject.'),
  subjectName: z.string(),
  topicId: z.string().optional().default(''),
  topicName: z.string().optional().default(''),
  subtopic: z.string().optional().default(''),
  subtopicPaths: z.array(z.string()).optional().default([]),
  questionSource: z.enum(['all', 'pyq']).default('all'),
  previousYears: z.array(z.string()).optional().default([]),
  randomizePerAttempt: z.boolean().optional().default(false),
  questionType: z.enum(['All', 'MCQ', 'Numerical', 'Text']),
  difficultyLevel: z.enum(['All', 'Easy', 'Medium', 'Hard']),
  count: z.coerce.number().min(1, 'Must be > 0'),
});

const formSchema = z.object({
  title: z.string().min(5, 'Test title must be at least 5 characters long.'),
  duration: z.coerce.number().min(1, 'Duration must be at least 1 minute.'),
  marksPerQuestion: z.coerce.number().min(0, 'Marks cannot be negative.'),
  negativeMarksPerQuestion: z.coerce.number().min(0, 'Negative marks cannot be negative.'),
  examTypeId: z.string().min(1, 'Select an exam.'),
  classId: z.string().min(1, 'Select a curriculum/class.'),
  examLevel: z.enum(['weak', 'medium', 'strong']),
  subjectConfigs: z.array(subjectConfigSchema).min(1, 'Please configure at least one subject.'),
}).superRefine((values, ctx) => {
  const seen = new Set<string>();
  values.subjectConfigs.forEach((item, index) => {
    const key = `${item.subjectId}__${item.topicId || ''}__${getSubtopicSelectionKey(item.subtopicPaths, item.subtopic)}__${item.questionType}__${item.difficultyLevel}__${item.questionSource || 'all'}__${getPreviousYearKey(item.previousYears || [])}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate section selected with same subject/topic/subtopic/type/difficulty/source/year filter.',
        path: ['subjectConfigs', index, 'difficultyLevel'],
      });
    }
    seen.add(key);
  });
});

export default function CreateCustomTestPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const parsedSearchParams = useMemo(() => new URLSearchParams(searchParamsKey), [searchParamsKey]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [subtopicDraftPathBySection, setSubtopicDraftPathBySection] = useState<Record<string, string[]>>({});
  const [recoverablePremiumPayments, setRecoverablePremiumPayments] = useState<RecoverablePremiumCustomMockPayment[]>([]);
  const [isRecoverablePremiumPaymentsLoading, setIsRecoverablePremiumPaymentsLoading] = useState(false);
  const [recoveringPaymentId, setRecoveringPaymentId] = useState('');
  const isTeacher = false;
  const editTestId = useMemo(() => (parsedSearchParams.get('editTestId') || '').trim(), [parsedSearchParams]);
  const isEditMode = editTestId.length > 0;
  const sourceTeacherId = useMemo(() => (parsedSearchParams.get('teacherId') || '').trim(), [parsedSearchParams]);
  const mode = useMemo(() => (parsedSearchParams.get('mode') || 'free').trim().toLowerCase(), [parsedSearchParams]);
  const premiumFeaturePurchaseId = useMemo(() => (parsedSearchParams.get('premiumFeaturePurchaseId') || '').trim(), [parsedSearchParams]);
  const premiumFeaturePurchaseIdsParam = useMemo(() => (parsedSearchParams.get('premiumFeaturePurchaseIds') || '').trim(), [parsedSearchParams]);
  const presetExamTypeId = useMemo(() => getFirstParamValue(parsedSearchParams, ['examTypeId', 'examId', 'exam']), [parsedSearchParams]);
  const presetExamTypeName = useMemo(() => getFirstParamValue(parsedSearchParams, ['examTypeName', 'examName']), [parsedSearchParams]);
  const presetClassId = useMemo(() => getFirstParamValue(parsedSearchParams, ['classId', 'curriculumId', 'class', 'curriculum']), [parsedSearchParams]);
  const presetClassName = useMemo(() => getFirstParamValue(parsedSearchParams, ['className', 'curriculumName']), [parsedSearchParams]);
  const hasSetupContext = useMemo(
    () => !!sourceTeacherId,
    [sourceTeacherId]
  );
  const presetSubjectIdsRaw = useMemo(
    () => getFirstParamValue(parsedSearchParams, ['subjectIds', 'subjectId', 'subjects', 'subject']),
    [parsedSearchParams]
  );
  const presetSubjectIds = useMemo(() => presetSubjectIdsRaw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean), [presetSubjectIdsRaw]);

  const customTestRef = useMemoFirebase(
    () => (firestore && user?.uid && editTestId ? doc(firestore, 'users', user.uid, 'custom_tests', editTestId) : null),
    [firestore, user?.uid, editTestId]
  );
  const { data: existingCustomTest, isLoading: isExistingCustomTestLoading } = useDoc<CustomTestDoc>(customTestRef);
  const resolvedPremiumFeaturePurchaseId = useMemo(
    () => premiumFeaturePurchaseId || String(existingCustomTest?.premiumFeaturePurchaseId || '').trim(),
    [existingCustomTest?.premiumFeaturePurchaseId, premiumFeaturePurchaseId]
  );
  const requestedPremiumFeaturePurchaseIds = useMemo(() => {
    const fromParams = premiumFeaturePurchaseIdsParam
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (fromParams.length > 0) {
      return Array.from(new Set(fromParams));
    }
    return normalizePurchaseIdList(existingCustomTest?.premiumFeaturePurchaseIds);
  }, [existingCustomTest?.premiumFeaturePurchaseIds, premiumFeaturePurchaseIdsParam]);
  const premiumFeaturePurchaseRef = useMemoFirebase(
    () => (
      firestore && user?.uid && resolvedPremiumFeaturePurchaseId
        ? doc(firestore, 'users', user.uid, 'premium_mock_feature_purchases', resolvedPremiumFeaturePurchaseId)
        : null
    ),
    [firestore, resolvedPremiumFeaturePurchaseId, user?.uid]
  );
  const premiumFeaturePurchaseByTestQuery = useMemoFirebase(
    () => (
      firestore && user?.uid && editTestId
        ? query(
            collection(firestore, 'users', user.uid, 'premium_mock_feature_purchases'),
            where('premiumCustomMockTestId', '==', editTestId),
            limit(1)
          )
        : null
    ),
    [editTestId, firestore, user?.uid]
  );
  const { data: premiumFeaturePurchase, isLoading: isPremiumFeaturePurchaseLoading } = useDoc<PremiumMockFeaturePurchase>(premiumFeaturePurchaseRef);
  const { data: premiumFeaturePurchaseByTest, isLoading: isPremiumFeaturePurchaseByTestLoading } = useCollection<PremiumMockFeaturePurchase>(premiumFeaturePurchaseByTestQuery);

  const effectiveTeacherId = useMemo(
    () => sourceTeacherId || existingCustomTest?.createdFromTeacherId || '',
    [sourceTeacherId, existingCustomTest?.createdFromTeacherId]
  );
  const isPremiumMode = useMemo(
    () => mode === 'premium' || existingCustomTest?.accessLevel === 'paid',
    [mode, existingCustomTest?.accessLevel]
  );
  const premiumFeaturePurchasesByTeacherQuery = useMemoFirebase(
    () => (
      firestore && user?.uid && isPremiumMode && effectiveTeacherId
        ? query(
            collection(firestore, 'users', user.uid, 'premium_mock_feature_purchases'),
            where('teacherId', '==', effectiveTeacherId)
          )
        : null
    ),
    [effectiveTeacherId, firestore, isPremiumMode, user?.uid]
  );
  const {
    data: premiumFeaturePurchasesByTeacher,
    isLoading: isPremiumFeaturePurchasesByTeacherLoading,
  } = useCollection<PremiumMockFeaturePurchase>(premiumFeaturePurchasesByTeacherQuery);
  const shouldRedirectToSetup = !isEditMode && !hasSetupContext;
  const targetAccessLevel = isPremiumMode ? 'paid' : 'free';

  const classesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null, [firestore]);
  const subjectsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null, [firestore]);
  const examTypesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null, [firestore]);
  const teacherDocRef = useMemoFirebase(() => (firestore && effectiveTeacherId ? doc(firestore, 'users', effectiveTeacherId) : null), [firestore, effectiveTeacherId]);

  const { data: classes, isLoading: areClassesLoading } = useCollection<Class>(classesQuery);
  const { data: subjects, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: examTypes, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: teacherProfile, isLoading: isTeacherProfileLoading } = useDoc<TeacherPricingProfile>(teacherDocRef);
  const customTestsByTeacherQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid || !effectiveTeacherId) return null;
    return query(
      collection(firestore, 'users', user.uid, 'custom_tests'),
      where('createdFromTeacherId', '==', effectiveTeacherId)
    );
  }, [firestore, user?.uid, effectiveTeacherId]);
  const { data: customTestsByTeacher, isLoading: areCustomTestsByTeacherLoading } = useCollection<CustomTestDoc>(customTestsByTeacherQuery);
  const defaultDifficultyLevel = QUESTION_DIFFICULTY;
  const pricingOwner = useMemo(() => ({ id: DCAM_QUESTION_BANK_OWNER_ID }), []);
  const publicTeacherQuestionPurchaseScopes = useMemo(
    () => (
      Array.isArray(teacherProfile?.publicTeacherQuestionPurchaseScopes)
        ? teacherProfile.publicTeacherQuestionPurchaseScopes.filter((scope) => isTeacherQuestionPurchaseActiveAt(scope))
        : []
    ),
    [teacherProfile?.publicTeacherQuestionPurchaseScopes]
  );

  const teachingAssignments = useMemo(() => teacherProfile?.teachingAssignments || [], [teacherProfile?.teachingAssignments]);
  const assignmentContexts = useMemo(() => {
    const classExamTypeIdById = new Map((classes || []).map((classItem) => [classItem.id, classItem.examTypeId]));
    return teachingAssignments
      .map((assignment) => {
        const classId = String(assignment.classId || '').trim();
        if (!classId) return null;
        const examTypeId = String(assignment.examTypeId || classExamTypeIdById.get(classId) || '').trim();
        if (!examTypeId) return null;
        return {
          examTypeId,
          classId,
          allSubjects: !!assignment.allSubjects,
          subjectIds: Array.from(new Set((assignment.subjectIds || []).filter(Boolean))),
        };
      })
      .filter((item): item is { examTypeId: string; classId: string; allSubjects: boolean; subjectIds: string[] } => !!item);
  }, [teachingAssignments, classes]);
  const allowedClassIds = useMemo(
    () => Array.from(new Set(teachingAssignments.map((assignment) => assignment.classId).filter(Boolean))),
    [teachingAssignments]
  );
  const defaultSectionConfig = useMemo(
    () => ({
      subjectId: '',
      subjectName: '',
      topicId: '',
      topicName: '',
      subtopic: '',
      subtopicPaths: [] as string[],
      questionSource: 'all' as const,
      previousYears: [] as string[],
      randomizePerAttempt: false,
      questionType: 'All' as const,
      difficultyLevel: 'Easy' as const,
      count: 10,
    }),
    [defaultDifficultyLevel]
  );
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      duration: 60,
      marksPerQuestion: 4,
      negativeMarksPerQuestion: 1,
      examTypeId: '',
      classId: '',
      examLevel: 'medium',
      subjectConfigs: [defaultSectionConfig],
    },
  });

  const { control, watch, setValue, getValues } = form;
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'subjectConfigs',
  });
  const prevExamTypeRef = useRef<string>('');
  const prevClassRef = useRef<string>('');
  const hasSeededPresetRef = useRef(false);
  const hasSeededEditRef = useRef(false);
  const queuedRecoveryPaymentRef = useRef<RecoverablePremiumCustomMockPayment | null>(null);

  const selectedExamType = watch('examTypeId');
  const selectedClass = watch('classId');
  const watchedSubjectConfigs = watch('subjectConfigs');
  const watchedSubjectConfigsKey = JSON.stringify(
    watchedSubjectConfigs.map((cfg) => ({
      subjectId: cfg.subjectId || '',
      topicId: cfg.topicId || '',
      subtopic: cfg.subtopic || '',
      subtopicPaths: normalizeSubtopicPathSelections(cfg.subtopicPaths, cfg.subtopic),
      questionSource: normalizeQuestionSource(cfg.questionSource),
      previousYears: normalizePreviousYearList(cfg.previousYears || []),
      questionType: cfg.questionType || 'All',
      difficultyLevel: 'Easy' as const,
      count: Number(cfg.count || 0),
      randomizePerAttempt: !!cfg.randomizePerAttempt,
    }))
  );
  const effectiveExamTypeId = selectedExamType || '';
  const effectiveClassId = selectedClass || '';
  const requestedPremiumFeatureExamTypeId = effectiveExamTypeId || presetExamTypeId || '';
  const requestedPremiumFeatureClassId = effectiveClassId || presetClassId || '';
  const presetSubjectIdsInEffectiveClass = useMemo(() => {
    if (!effectiveClassId) return [];
    if (!subjects || subjects.length === 0) return presetSubjectIds;
    const classSubjectIds = new Set(
      subjects
        .filter((subject) => subject.classId === effectiveClassId)
        .map((subject) => subject.id)
    );
    return presetSubjectIds.filter((id) => classSubjectIds.has(id));
  }, [presetSubjectIds, subjects, effectiveClassId]);
  const selectedTopicSubjectIds = useMemo(() => Array.from(new Set([
    ...presetSubjectIdsInEffectiveClass,
    ...(watchedSubjectConfigs || []).map((cfg) => String(cfg.subjectId || '').trim()),
  ].filter(Boolean))), [presetSubjectIdsInEffectiveClass, watchedSubjectConfigsKey]);
  const selectedTopicSubjectIdsKey = selectedTopicSubjectIds.join('|');
  const topicsQuery = useMemoFirebase(
    () => {
      if (!firestore || selectedTopicSubjectIds.length === 0) return null;
      if (selectedTopicSubjectIds.length <= 30) {
        return query(collection(firestore, 'topics'), where('subjectId', 'in', selectedTopicSubjectIds));
      }
      return query(collection(firestore, 'topics'));
    },
    [firestore, selectedTopicSubjectIdsKey]
  );
  const { data: topicsRaw } = useCollection<Topic>(topicsQuery);
  const topics = useMemo(
    () => (Array.isArray(topicsRaw) ? [...topicsRaw].sort((a, b) => (a.name || '').localeCompare(b.name || '')) : []),
    [topicsRaw]
  );
  const sectionModeEnabled = true;
  const marksPerQuestion = Number(watch('marksPerQuestion') || 0);
  const totalRequestedQuestions = watchedSubjectConfigs.reduce((acc, curr) => acc + (Number(curr.count) || 0), 0);
  const totalMarks = totalRequestedQuestions * marksPerQuestion;
  const premiumMockTestAttemptRule = useMemo(() => {
    const scopeKey = effectiveExamTypeId && effectiveClassId ? `${effectiveExamTypeId}__${effectiveClassId}` : '';
    if (scopeKey && teacherProfile?.premiumMockTestAttemptPricingByScope?.[scopeKey]) {
      return normalizePremiumCustomMockAttemptPricingRule(teacherProfile.premiumMockTestAttemptPricingByScope[scopeKey]);
    }
    return buildPremiumCustomMockAttemptRuleFromLegacyLimit(teacherProfile?.premiumMockTestAttemptLimit);
  }, [
    teacherProfile?.premiumMockTestAttemptPricingByScope,
    teacherProfile?.premiumMockTestAttemptLimit,
    effectiveExamTypeId,
    effectiveClassId,
  ]);
  const teacherFullName = useMemo(
    () => `${teacherProfile?.firstName || ''} ${teacherProfile?.lastName || ''}`.trim() || teacherProfile?.displayName || 'Teacher',
    [teacherProfile?.displayName, teacherProfile?.firstName, teacherProfile?.lastName]
  );
  const selectedExamTypeName = useMemo(
    () => (examTypes || []).find((item) => item.id === effectiveExamTypeId)?.name || presetExamTypeName || '',
    [examTypes, effectiveExamTypeId, presetExamTypeName]
  );
  const selectedClassName = useMemo(
    () => (classes || []).find((item) => item.id === effectiveClassId)?.name || presetClassName || '',
    [classes, effectiveClassId, presetClassName]
  );
  const subjectNameById = useMemo(
    () => Object.fromEntries((subjects || []).map((subject) => [subject.id, subject.name || subject.id])),
    [subjects]
  );
  const premiumFeaturePurchaseFromEdit = useMemo(
    () => (premiumFeaturePurchaseByTest || []).find((purchase) => String(purchase.id || '').trim()) || null,
    [premiumFeaturePurchaseByTest]
  );
  const normalizedPremiumFeaturePurchasesByTeacher = useMemo(
    () => (premiumFeaturePurchasesByTeacher || [])
      .map((purchase) => ({
        ...purchase,
        id: String(purchase.id || '').trim(),
        teacherId: String(purchase.teacherId || '').trim(),
        examTypeId: String(purchase.examTypeId || '').trim(),
        classId: String(purchase.classId || '').trim(),
        offerId: String(purchase.offerId || '').trim(),
        offerPurchaseId: resolveOfferPurchaseIdFromPremiumFeatureRecord(purchase),
        questionCount: getPremiumCustomMockIncludedQuestionCountFromRecord(purchase),
        includedQuestionCount: getPremiumCustomMockIncludedQuestionCountFromRecord(purchase),
      }))
      .filter((purchase) => !!purchase.id && purchase.status === 'paid' && purchase.questionCount > 0),
    [premiumFeaturePurchasesByTeacher]
  );
  const matchedPremiumFeaturePurchaseByScope = useMemo(() => {
    if (!isPremiumMode || isEditMode || premiumFeaturePurchase?.id) return null;

    const eligiblePurchases = normalizedPremiumFeaturePurchasesByTeacher
      .filter((purchase) => {
        if (!purchase.id) return false;
        if (effectiveTeacherId && purchase.teacherId && purchase.teacherId !== effectiveTeacherId) return false;
        if (requestedPremiumFeatureExamTypeId && purchase.examTypeId !== requestedPremiumFeatureExamTypeId) return false;
        if (requestedPremiumFeatureClassId && purchase.classId !== requestedPremiumFeatureClassId) return false;
        return true;
      })
      .sort((left, right) => {
        const leftTime =
          asDate(left.paidAt)?.getTime()
          || asDate(left.purchasedAt as { toDate?: () => Date } | Date | string | null)?.getTime()
          || asDate(left.createdAt as { toDate?: () => Date } | Date | string | null)?.getTime()
          || 0;
        const rightTime =
          asDate(right.paidAt)?.getTime()
          || asDate(right.purchasedAt as { toDate?: () => Date } | Date | string | null)?.getTime()
          || asDate(right.createdAt as { toDate?: () => Date } | Date | string | null)?.getTime()
          || 0;
        return rightTime - leftTime;
      });

    if (eligiblePurchases.length === 0) return null;
    if (!requestedPremiumFeatureExamTypeId && !requestedPremiumFeatureClassId && eligiblePurchases.length > 1) {
      return null;
    }

    return eligiblePurchases.find((purchase) => purchase.offerId || purchase.offerPurchaseId) || eligiblePurchases[0] || null;
  }, [
    effectiveTeacherId,
    isEditMode,
    isPremiumMode,
    premiumFeaturePurchase?.id,
    normalizedPremiumFeaturePurchasesByTeacher,
    requestedPremiumFeatureClassId,
    requestedPremiumFeatureExamTypeId,
  ]);
  const linkedPremiumFeaturePurchaseSource = isEditMode
    ? (premiumFeaturePurchase || premiumFeaturePurchaseFromEdit)
    : (premiumFeaturePurchase || matchedPremiumFeaturePurchaseByScope);
  const mergedAdminAssignedPremiumFeaturePurchase = useMemo(() => {
    if (!isPremiumMode || !effectiveTeacherId) return null;

    const requestedIdSet = new Set(requestedPremiumFeaturePurchaseIds);
    if (requestedIdSet.size > 0) {
      const requestedAdminPurchases = normalizedPremiumFeaturePurchasesByTeacher.filter((purchase) =>
        requestedIdSet.has(purchase.id || '') && isAdminAssignedPremiumFeatureRecord(purchase)
      );
      return mergeAdminAssignedPremiumFeaturePurchases(
        requestedAdminPurchases,
        resolvedPremiumFeaturePurchaseId || requestedPremiumFeaturePurchaseIds[0]
      );
    }

    const basePurchase = linkedPremiumFeaturePurchaseSource;
    if (!basePurchase?.id || !isAdminAssignedPremiumFeatureRecord(basePurchase)) return null;
    const baseScopeSetKey = getPremiumCustomMockScopeConfigSetKey(
      normalizePremiumCustomMockScopeConfigs(
        basePurchase.includedSubjectConfigs || basePurchase.subjectConfigs
      )
    );
    if (!baseScopeSetKey) {
      return mergeAdminAssignedPremiumFeaturePurchases([basePurchase], basePurchase.id);
    }

    const siblingAdminPurchases = normalizedPremiumFeaturePurchasesByTeacher.filter((purchase) =>
      isAdminAssignedPremiumFeatureRecord(purchase)
      && purchase.teacherId === String(basePurchase.teacherId || '').trim()
      && purchase.examTypeId === String(basePurchase.examTypeId || '').trim()
      && purchase.classId === String(basePurchase.classId || '').trim()
      && getPremiumCustomMockScopeConfigSetKey(
        normalizePremiumCustomMockScopeConfigs(
          purchase.includedSubjectConfigs || purchase.subjectConfigs
        )
      ) === baseScopeSetKey
    );

    return mergeAdminAssignedPremiumFeaturePurchases(
      siblingAdminPurchases.length > 0 ? siblingAdminPurchases : [basePurchase],
      basePurchase.id
    );
  }, [
    effectiveTeacherId,
    isPremiumMode,
    linkedPremiumFeaturePurchaseSource,
    normalizedPremiumFeaturePurchasesByTeacher,
    requestedPremiumFeaturePurchaseIds,
    resolvedPremiumFeaturePurchaseId,
  ]);
  const linkedPremiumFeaturePurchase = useMemo(() => {
    const sourcePurchase = mergedAdminAssignedPremiumFeaturePurchase || linkedPremiumFeaturePurchaseSource;
    if (!isPremiumMode || !sourcePurchase?.id) return null;
    if (sourcePurchase.status !== 'paid') return null;
    if (
      effectiveTeacherId
      && sourcePurchase.teacherId
      && sourcePurchase.teacherId !== effectiveTeacherId
    ) {
      return null;
    }
    return {
      ...sourcePurchase,
      id: String(sourcePurchase.id || '').trim(),
      offerPurchaseId: resolveOfferPurchaseIdFromPremiumFeatureRecord(sourcePurchase),
      questionCount: getPremiumCustomMockIncludedQuestionCountFromRecord(sourcePurchase),
      includedQuestionCount: getPremiumCustomMockIncludedQuestionCountFromRecord(sourcePurchase),
      questionAmountPaid: Number(
        ((sourcePurchase.questionAmountPaid ?? sourcePurchase.amount ?? 0) || 0).toFixed(2)
      ),
      attemptAmountPaid: Number((sourcePurchase.attemptAmountPaid || 0).toFixed(2)),
      mergedPurchaseIds: normalizePurchaseIdList(
        sourcePurchase.mergedPurchaseIds
        || [String(sourcePurchase.id || '').trim()]
      ),
    };
  }, [effectiveTeacherId, isPremiumMode, linkedPremiumFeaturePurchaseSource, mergedAdminAssignedPremiumFeaturePurchase]);
  const premiumQuestionBankSource = linkedPremiumFeaturePurchase?.questionBankSource === 'teacher_official'
    ? 'teacher_official'
    : 'student_plus_official';
  const shouldUseTeacherPurchasedPremiumQuestionBank = Boolean(
    isPremiumMode
    && effectiveTeacherId
    && premiumQuestionBankSource !== 'teacher_official'
  );
  const shouldLoadQuestionBank = Boolean(
    effectiveTeacherId
    && effectiveExamTypeId
    && effectiveClassId
    && selectedTopicSubjectIds.length > 0
  );
  const pricingOwnerQuestionsQuery = useMemoFirebase(
    () => (
      firestore
      && shouldUseTeacherPurchasedPremiumQuestionBank
      && shouldLoadQuestionBank
      && publicTeacherQuestionPurchaseScopes.length > 0
        ? query(
            collection(firestore, 'practice_questions'),
            where('teacherId', '==', pricingOwner.id),
            where('accessLevel', '==', 'paid')
          )
        : null
    ),
    [
      firestore,
      pricingOwner.id,
      publicTeacherQuestionPurchaseScopes.length,
      shouldLoadQuestionBank,
      shouldUseTeacherPurchasedPremiumQuestionBank,
    ]
  );
  const { data: pricingOwnerQuestionsRaw } = useCollection<Question>(pricingOwnerQuestionsQuery);
  const pricingOwnerQuestions = useMemo(
    () => (Array.isArray(pricingOwnerQuestionsRaw) ? pricingOwnerQuestionsRaw : []),
    [pricingOwnerQuestionsRaw]
  );
  const teacherPurchasedPremiumQuestions = useMemo(() => {
    if (!shouldUseTeacherPurchasedPremiumQuestionBank || !pricingOwner?.id || publicTeacherQuestionPurchaseScopes.length === 0) {
      return [] as Question[];
    }

    const ownerPaidQuestions = pricingOwnerQuestions.filter((question) => (
      (question.accessLevel || 'free') === 'paid'
      && matchesQuestionBankSource(question, premiumQuestionBankSource)
    ));
    if (ownerPaidQuestions.length === 0) return [] as Question[];

    const availability = resolveTeacherPremiumQuestionAvailability({
      rows: buildTeacherPremiumQuestionRowsFromQuestions(ownerPaidQuestions, { accessLevel: 'paid' }),
      purchases: publicTeacherQuestionPurchaseScopes as any,
      minimumStudentsRequired: 1,
      randomize: false,
    });

    const uniqueQuestions = new Map<string, Question>();
    availability.selectableRows.forEach((row) => {
      if (!row.question?.id || uniqueQuestions.has(row.question.id)) return;
      uniqueQuestions.set(row.question.id, row.question);
    });
    return Array.from(uniqueQuestions.values());
  }, [
    premiumQuestionBankSource,
    pricingOwner?.id,
    pricingOwnerQuestions,
    publicTeacherQuestionPurchaseScopes,
    shouldUseTeacherPurchasedPremiumQuestionBank,
  ]);
  const questionsQuery = useMemoFirebase(
    () => (
      firestore
      && !shouldUseTeacherPurchasedPremiumQuestionBank
      && shouldLoadQuestionBank
        ? query(
            collection(firestore, 'practice_questions'),
            where('teacherId', '==', effectiveTeacherId),
            where('accessLevel', '==', targetAccessLevel)
          )
        : null
    ),
    [
      effectiveTeacherId,
      firestore,
      shouldLoadQuestionBank,
      shouldUseTeacherPurchasedPremiumQuestionBank,
      targetAccessLevel,
    ]
  );
  const { data: allQuestionsRaw } = useCollection<Question>(questionsQuery);
  const allQuestions = useMemo(
    () => (Array.isArray(allQuestionsRaw) ? allQuestionsRaw : []),
    [allQuestionsRaw]
  );
  const linkedPremiumFeaturePurchaseIds = useMemo(
    () => normalizePurchaseIdList(
      linkedPremiumFeaturePurchase?.mergedPurchaseIds
      || (linkedPremiumFeaturePurchase?.id ? [linkedPremiumFeaturePurchase.id] : [])
    ),
    [linkedPremiumFeaturePurchase?.id, linkedPremiumFeaturePurchase?.mergedPurchaseIds]
  );
  const isMergedAdminAssignedPremiumFeaturePurchase = Boolean(
    isAdminAssignedPremiumFeatureRecord(linkedPremiumFeaturePurchase)
    && linkedPremiumFeaturePurchaseIds.length > 1
  );
  const linkedPremiumFeatureOfferPurchaseId = useMemo(
    () => (
      resolveOfferPurchaseIdFromPremiumFeatureRecord(linkedPremiumFeaturePurchase)
      || String(existingCustomTest?.offerPurchaseId || '').trim()
    ),
    [existingCustomTest?.offerPurchaseId, linkedPremiumFeaturePurchase]
  );
  const isOfferBackedPremiumFeaturePurchase = !!(
    isOfferBackedPremiumFeatureRecord(linkedPremiumFeaturePurchase)
    || (existingCustomTest && (String(existingCustomTest.offerId || '').trim() || String(existingCustomTest.offerPurchaseId || '').trim()))
  );
  const linkedPremiumFeatureScopeExamTypeId = String(
    linkedPremiumFeaturePurchase?.examTypeId
    || existingCustomTest?.examTypeId
    || ''
  ).trim();
  const linkedPremiumFeatureScopeClassId = String(
    linkedPremiumFeaturePurchase?.classId
    || existingCustomTest?.classId
    || ''
  ).trim();
  const linkedPremiumFeaturePurchaseMatchesCurrentScope = Boolean(
    isOfferBackedPremiumFeaturePurchase
    && effectiveExamTypeId
    && effectiveClassId
    && (
      linkedPremiumFeaturePurchase
        ? linkedPremiumFeaturePurchase.examTypeId === effectiveExamTypeId && linkedPremiumFeaturePurchase.classId === effectiveClassId
        : existingCustomTest?.examTypeId === effectiveExamTypeId && existingCustomTest?.classId === effectiveClassId
    )
  );
  const linkedPremiumFeatureIncludedSubjectConfigs = useMemo(
    () => normalizePremiumCustomMockScopeConfigs(
      linkedPremiumFeaturePurchase?.includedSubjectConfigs
      || linkedPremiumFeaturePurchase?.subjectConfigs
      || existingCustomTest?.includedSubjectConfigs
    ),
    [
      existingCustomTest?.includedSubjectConfigs,
      linkedPremiumFeaturePurchase,
    ]
  );
  const linkedOfferBackedCreatedTests = useMemo(() => {
    if (!isOfferBackedPremiumFeaturePurchase || !linkedPremiumFeaturePurchase?.id) return [] as CustomTestDoc[];

    const currentEditTestId = String(editTestId || '').trim();
    const linkedOfferPurchaseId = linkedPremiumFeatureOfferPurchaseId;
    const linkedPremiumFeaturePurchaseIdSet = new Set(
      linkedPremiumFeaturePurchaseIds.length > 0
        ? linkedPremiumFeaturePurchaseIds
        : normalizePurchaseIdList(existingCustomTest?.premiumFeaturePurchaseIds)
    );

    return (customTestsByTeacher || []).filter((test) => {
      const testId = String(test.id || '').trim();
      if (!testId || (currentEditTestId && testId === currentEditTestId)) return false;
      if (String(test.accessLevel || '').trim().toLowerCase() !== 'paid') return false;

      const testPremiumFeaturePurchaseId = String(test.premiumFeaturePurchaseId || '').trim();
      const testOfferPurchaseId = String(test.offerPurchaseId || '').trim();
      const testPremiumFeaturePurchaseIds = new Set(normalizePurchaseIdList(test.premiumFeaturePurchaseIds));

      return (
        linkedPremiumFeaturePurchaseIdSet.has(testPremiumFeaturePurchaseId)
        || Array.from(testPremiumFeaturePurchaseIds).some((purchaseId) => linkedPremiumFeaturePurchaseIdSet.has(purchaseId))
        || (!!linkedOfferPurchaseId && testOfferPurchaseId === linkedOfferPurchaseId)
      );
    });
  }, [
    customTestsByTeacher,
    editTestId,
    existingCustomTest?.premiumFeaturePurchaseIds,
    isOfferBackedPremiumFeaturePurchase,
    linkedPremiumFeatureOfferPurchaseId,
    linkedPremiumFeaturePurchase,
    linkedPremiumFeaturePurchaseIds,
  ]);
  const linkedPremiumFeatureHistoricalIncludedQuestionIds = useMemo(
    () => Array.from(
      new Set(
        linkedOfferBackedCreatedTests.flatMap((test) => getIncludedQuestionIdsFromSavedCustomTest(test))
      )
    ),
    [linkedOfferBackedCreatedTests]
  );
  const linkedPremiumFeatureStoredIncludedQuestionIds = useMemo(
    () => normalizeQuestionIdList(linkedPremiumFeaturePurchase?.includedQuestionIds),
    [linkedPremiumFeaturePurchase?.includedQuestionIds]
  );
  const linkedPremiumFeaturePurchasedQuestionCount = Math.max(
    getPremiumCustomMockIncludedQuestionCountFromRecord(linkedPremiumFeaturePurchase),
    getPremiumCustomMockIncludedQuestionCountFromRecord(existingCustomTest)
  );
  // Keep the full bank visible in the builder. Offer-backed purchases now unlock
  // a reusable set of included questions that can be used across multiple mocks.
  const offerConsumedQuestionIdsToExclude = EMPTY_STRING_SET;
  const linkedPremiumFeatureScopeSummary = useMemo(() => {
    const grouped = new Map<string, { label: string; count: number }>();

    linkedPremiumFeatureIncludedSubjectConfigs.forEach((config) => {
      const subjectLabel = config.subjectName || subjectNameById[config.subjectId] || 'Subject';
      const topicLabel = config.topicName || (config.topicId ? 'Selected topic' : 'All topics');
      const firstSubtopicPath = normalizeSubtopicPathSelections(config.subtopicPaths, config.subtopic)[0] || '';
      const subtopicLabel = firstSubtopicPath || '';
      const label = [subjectLabel, topicLabel, subtopicLabel].filter(Boolean).join(' / ');
      const key = label.toLowerCase();
      const count = Math.max(0, Number(config.count || 0));
      const current = grouped.get(key);
      if (current) {
        current.count += count;
        return;
      }
      grouped.set(key, { label, count });
    });

    return Array.from(grouped.values())
      .filter((entry) => entry.count > 0)
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }, [linkedPremiumFeatureIncludedSubjectConfigs, subjectNameById]);
  const linkedPremiumFeatureScopeExamTypeName = useMemo(
    () => (examTypes || []).find((item) => item.id === linkedPremiumFeatureScopeExamTypeId)?.name || presetExamTypeName || '',
    [examTypes, linkedPremiumFeatureScopeExamTypeId, presetExamTypeName]
  );
  const linkedPremiumFeatureScopeClassName = useMemo(
    () => (classes || []).find((item) => item.id === linkedPremiumFeatureScopeClassId)?.name || presetClassName || '',
    [classes, linkedPremiumFeatureScopeClassId, presetClassName]
  );
  const includedOfferSubjectConfigCount = linkedPremiumFeatureIncludedSubjectConfigs.length;
  useEffect(() => {
    if (!isPremiumMode || isEditMode || !user?.uid || !effectiveTeacherId || !effectiveExamTypeId || !effectiveClassId) {
      setRecoverablePremiumPayments([]);
      setIsRecoverablePremiumPaymentsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsRecoverablePremiumPaymentsLoading(true);

    (async () => {
      try {
        const idToken = await user.getIdToken();
        const result = await findRecoverablePremiumCustomMockPayments({
          idToken,
          teacherId: effectiveTeacherId,
          examTypeId: effectiveExamTypeId,
          classId: effectiveClassId,
          limit: 5,
        });

        if (isCancelled) return;

        if (!result.success) {
          setRecoverablePremiumPayments([]);
          return;
        }

        setRecoverablePremiumPayments(
          (result.payments || []).map((payment) => ({
            ...payment,
            attemptActionKind: (payment.attemptActionKind || 'none') as PremiumCustomMockAttemptActionKind,
          }))
        );
      } catch {
        if (!isCancelled) {
          setRecoverablePremiumPayments([]);
        }
      } finally {
        if (!isCancelled) {
          setIsRecoverablePremiumPaymentsLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [user, isPremiumMode, isEditMode, effectiveTeacherId, effectiveExamTypeId, effectiveClassId]);
  const existingPremiumQuestionIds = useMemo(
    () => (
      isPremiumMode && isEditMode && Array.isArray(existingCustomTest?.config?.questionIds)
        ? existingCustomTest.config.questionIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : []
    ),
    [existingCustomTest?.config?.questionIds, isEditMode, isPremiumMode]
  );

  useEffect(() => {
    if (!shouldRedirectToSetup) return;
    router.replace('/dcam-custom-mock');
  }, [router, shouldRedirectToSetup]);

  useEffect(() => {
    if (isEditMode) return;
    if (hasSeededPresetRef.current) return;
    if (!presetExamTypeId && !presetClassId && presetSubjectIds.length === 0) return;
    const seededConfigs = (presetSubjectIds.length > 0 ? presetSubjectIds : ['']).map((subjectId) => {
      const subjectName = (subjects || []).find((item) => item.id === subjectId)?.name || '';
      return {
        subjectId,
        subjectName,
        topicId: '',
        topicName: '',
        subtopic: '',
        subtopicPaths: [] as string[],
        questionSource: 'all' as const,
        previousYears: [] as string[],
        randomizePerAttempt: false,
        questionType: 'All' as const,
        difficultyLevel: 'Easy' as const,
        count: 10,
      };
    });

    if (presetExamTypeId) {
      prevExamTypeRef.current = presetExamTypeId;
      setValue('examTypeId', presetExamTypeId);
    }
    if (presetClassId) {
      prevClassRef.current = presetClassId;
      setValue('classId', presetClassId);
    }
    replace(seededConfigs);
    hasSeededPresetRef.current = true;
  }, [isEditMode, presetExamTypeId, presetClassId, presetSubjectIds, setValue, replace, subjects, defaultDifficultyLevel]);

  useEffect(() => {
    if (!isEditMode || hasSeededEditRef.current || !existingCustomTest) return;
    const subjectConfigs = (existingCustomTest.config?.subjectConfigs || []).map((cfg) => {
      const subjectId = cfg.subjectId || '';
      const normalizedStoredSubtopicPaths = normalizeSubtopicPathSelections(cfg.subtopicPaths, cfg.subtopic);
      const firstStoredSubtopicPath = parseSubtopicPathSelection(normalizedStoredSubtopicPaths[0] || '');
      return {
        subjectId,
        subjectName: (subjects || []).find((item) => item.id === subjectId)?.name || '',
        topicId: cfg.topicId || '',
        topicName: '',
        subtopic: firstStoredSubtopicPath[0] || '',
        subtopicPaths: normalizedStoredSubtopicPaths,
        questionSource: normalizeQuestionSource(cfg.questionSource || cfg.previousYearMode || 'all'),
        previousYears: normalizePreviousYearList(cfg.previousYears || []),
        randomizePerAttempt: isPremiumMode ? false : !!cfg.randomizePerAttempt,
        questionType: (cfg.questionType || 'All') as 'All' | 'MCQ' | 'Numerical' | 'Text',
        difficultyLevel: 'Easy' as const,
        count: Number(cfg.numQuestions || cfg.count || 1),
      };
    });

    const normalizedConfigs =
      subjectConfigs.length > 0
        ? subjectConfigs
        : [{ subjectId: '', subjectName: '', topicId: '', topicName: '', subtopic: '', subtopicPaths: [] as string[], questionSource: 'all' as const, previousYears: [] as string[], randomizePerAttempt: false, questionType: 'All' as const, difficultyLevel: 'Easy' as const, count: 10 }];

    const examTypeId = existingCustomTest.examTypeId || '';
    const classId = existingCustomTest.classId || '';
    if (examTypeId) {
      setValue('examTypeId', examTypeId);
      prevExamTypeRef.current = examTypeId;
    }
    if (classId) {
      setValue('classId', classId);
      prevClassRef.current = classId;
    }
    setValue('title', existingCustomTest.title || '');
    setValue('duration', Number(existingCustomTest.duration || 60));
    setValue('marksPerQuestion', Number(existingCustomTest.config?.marksPerQuestion || 4));
    setValue('negativeMarksPerQuestion', Number(existingCustomTest.config?.negativeMarksPerQuestion || 1));
    setValue('examLevel', (existingCustomTest.examLevel || 'medium') as 'weak' | 'medium' | 'strong');
    replace(normalizedConfigs);

    hasSeededEditRef.current = true;
  }, [isEditMode, existingCustomTest, subjects, replace, setValue, isPremiumMode, defaultDifficultyLevel]);

  useEffect(() => {
    if (isEditMode) return;
    const emptyConfig = { subjectId: '', subjectName: '', topicId: '', topicName: '', subtopic: '', subtopicPaths: [] as string[], questionSource: 'all' as const, previousYears: [] as string[], randomizePerAttempt: false, questionType: 'All' as const, difficultyLevel: 'Easy' as const, count: 10 };
    const currentConfigs = getValues('subjectConfigs') || [];

    if (selectedExamType !== prevExamTypeRef.current) {
      prevExamTypeRef.current = selectedExamType;
      if (getValues('classId')) {
        setValue('classId', '');
      }
      if (currentConfigs.length > 0) {
        replace([emptyConfig]);
        return;
      }
    }

    if (selectedClass !== prevClassRef.current) {
      prevClassRef.current = selectedClass;
      if (currentConfigs.length > 0) {
        replace([emptyConfig]);
        return;
      }
    }

    if (currentConfigs.length === 0) {
      append(emptyConfig);
    }
  }, [selectedExamType, selectedClass, sectionModeEnabled, append, replace, setValue, getValues, defaultDifficultyLevel, isEditMode]);

  const extractQuestionContexts = (question: Question) => {
    const contexts: Array<{ examTypeId?: string; classId?: string; subjectId?: string }> = [
      { examTypeId: question.examTypeId, classId: question.classId, subjectId: question.subjectId },
      ...(question.alignments || []).map((alignment) => ({
        examTypeId: alignment.examTypeId,
        classId: alignment.classId,
        subjectId: alignment.subjectId,
      })),
    ];
    return contexts.filter((item) => item.examTypeId && item.classId);
  };

  const scopedQuestionsByTeacherAndAccess = useMemo(() => {
    if (shouldUseTeacherPurchasedPremiumQuestionBank) {
      return teacherPurchasedPremiumQuestions.filter((question) => question.accessLevel === targetAccessLevel);
    }
    return allQuestions.filter((question) => {
      if (question.accessLevel !== targetAccessLevel) return false;
      if (!matchesQuestionBankSource(question, premiumQuestionBankSource)) return false;
      if (effectiveTeacherId && question.teacherId !== effectiveTeacherId) return false;
      return true;
    });
  }, [
    allQuestions,
    effectiveTeacherId,
    premiumQuestionBankSource,
    shouldUseTeacherPurchasedPremiumQuestionBank,
    targetAccessLevel,
    teacherPurchasedPremiumQuestions,
  ]);
  const scopedQuestionById = useMemo(
    () => new Map(scopedQuestionsByTeacherAndAccess.map((question) => [question.id, question])),
    [scopedQuestionsByTeacherAndAccess]
  );
  const scopedQuestionScopeEntriesById = useMemo(
    () => new Map(
      scopedQuestionsByTeacherAndAccess.map((question) => [
        question.id,
        buildPracticeQuestionScopeEntries(question),
      ])
    ),
    [scopedQuestionsByTeacherAndAccess]
  );

  const teacherScopedExamTypes = useMemo(() => {
    const allowedExamIds = new Set<string>();
    scopedQuestionsByTeacherAndAccess.forEach((question) => {
      extractQuestionContexts(question).forEach((context) => {
        if (context.examTypeId) allowedExamIds.add(context.examTypeId);
      });
    });
    if (!shouldUseTeacherPurchasedPremiumQuestionBank) {
      assignmentContexts.forEach((context) => {
        allowedExamIds.add(context.examTypeId);
      });
    }
    if (allowedExamIds.size === 0) {
      return examTypes || [];
    }
    return (examTypes || []).filter((examType) => allowedExamIds.has(examType.id));
  }, [examTypes, scopedQuestionsByTeacherAndAccess, assignmentContexts, shouldUseTeacherPurchasedPremiumQuestionBank]);

  const examOptions = useMemo(() => {
    const map = new Map<string, ExamType>();
    teacherScopedExamTypes.forEach((exam) => map.set(exam.id, exam));
    const fallbackExamId = selectedExamType || (!isPremiumMode ? presetExamTypeId : '');
    if (fallbackExamId && !map.has(fallbackExamId)) {
      const fromMaster = (examTypes || []).find((exam) => exam.id === fallbackExamId);
      map.set(fallbackExamId, fromMaster || { id: fallbackExamId, name: presetExamTypeName || 'Selected exam' });
    }
    return Array.from(map.values());
  }, [teacherScopedExamTypes, selectedExamType, isPremiumMode, presetExamTypeId, examTypes, presetExamTypeName]);

  const filteredClasses = useMemo(() => {
    if (!classes || !effectiveExamTypeId) return [];
    const allowedClassIdsByQuestionBank = new Set<string>();
    scopedQuestionsByTeacherAndAccess.forEach((question) => {
      extractQuestionContexts(question).forEach((context) => {
        if (context.examTypeId === effectiveExamTypeId && context.classId) {
          allowedClassIdsByQuestionBank.add(context.classId);
        }
      });
    });
    const allowedClassIdsByAssignment = shouldUseTeacherPurchasedPremiumQuestionBank
      ? new Set<string>()
      : new Set(
          assignmentContexts
            .filter((context) => context.examTypeId === effectiveExamTypeId)
            .map((context) => context.classId)
        );
    if (allowedClassIdsByQuestionBank.size === 0 && allowedClassIdsByAssignment.size === 0) {
      return classes.filter((classItem) => classItem.examTypeId === effectiveExamTypeId);
    }
    return classes.filter(
      (classItem) =>
        classItem.examTypeId === effectiveExamTypeId
        && (allowedClassIdsByQuestionBank.has(classItem.id) || allowedClassIdsByAssignment.has(classItem.id))
    );
  }, [classes, effectiveExamTypeId, scopedQuestionsByTeacherAndAccess, assignmentContexts, shouldUseTeacherPurchasedPremiumQuestionBank]);

  const classOptions = useMemo(() => {
    const map = new Map<string, Class>();
    filteredClasses.forEach((classItem) => map.set(classItem.id, classItem));
    const fallbackClassId = selectedClass || (!isPremiumMode ? presetClassId : '');
    if (fallbackClassId && !map.has(fallbackClassId)) {
      const fromMaster = (classes || []).find((classItem) => classItem.id === fallbackClassId);
      map.set(
        fallbackClassId,
        fromMaster || { id: fallbackClassId, name: presetClassName || 'Selected curriculum', examTypeId: selectedExamType || presetExamTypeId }
      );
    }
    return Array.from(map.values());
  }, [filteredClasses, selectedClass, isPremiumMode, presetClassId, classes, presetClassName, selectedExamType, presetExamTypeId]);

  const filteredSubjects = useMemo(() => {
    if (!subjects || !effectiveClassId || !effectiveExamTypeId) return [];
    const allowedSubjectIdsByQuestionBank = new Set<string>();
    scopedQuestionsByTeacherAndAccess.forEach((question) => {
      extractQuestionContexts(question).forEach((context) => {
        if (
          context.examTypeId === effectiveExamTypeId &&
          context.classId === effectiveClassId &&
          context.subjectId
        ) {
          allowedSubjectIdsByQuestionBank.add(context.subjectId);
        }
      });
    });
    const matchingAssignments = shouldUseTeacherPurchasedPremiumQuestionBank
      ? []
      : assignmentContexts.filter(
          (context) => context.examTypeId === effectiveExamTypeId && context.classId === effectiveClassId
        );
    const allowAllSubjectsFromAssignment = !shouldUseTeacherPurchasedPremiumQuestionBank
      && matchingAssignments.some((context) => context.allSubjects);
    const allowedSubjectIdsByAssignment = new Set<string>();
    matchingAssignments.forEach((context) => {
      context.subjectIds.forEach((subjectId) => allowedSubjectIdsByAssignment.add(subjectId));
    });
    if (
      allowedSubjectIdsByQuestionBank.size === 0
      && !allowAllSubjectsFromAssignment
      && allowedSubjectIdsByAssignment.size === 0
    ) {
      return subjects.filter((subject) => subject.classId === effectiveClassId);
    }
    return subjects.filter((subject) => {
      if (subject.classId !== effectiveClassId) return false;
      if (allowAllSubjectsFromAssignment) return true;
      return allowedSubjectIdsByQuestionBank.has(subject.id) || allowedSubjectIdsByAssignment.has(subject.id);
    });
  }, [subjects, effectiveClassId, effectiveExamTypeId, scopedQuestionsByTeacherAndAccess, assignmentContexts, shouldUseTeacherPurchasedPremiumQuestionBank]);

  const subjectOptionsForSections = useMemo(() => {
    const map = new Map<string, Subject>();
    filteredSubjects.forEach((subject) => map.set(subject.id, subject));

    const idsToInclude = new Set<string>(presetSubjectIdsInEffectiveClass);
    watchedSubjectConfigs.forEach((cfg) => {
      if (cfg.subjectId) idsToInclude.add(cfg.subjectId);
    });

    idsToInclude.forEach((subjectId) => {
      if (!subjectId || map.has(subjectId)) return;
      const fromMaster = (subjects || []).find((subject) => subject.id === subjectId);
      if (!fromMaster) return;
      if (effectiveClassId && fromMaster.classId !== effectiveClassId) return;
      map.set(subjectId, fromMaster);
    });

    return Array.from(map.values());
  }, [filteredSubjects, presetSubjectIdsInEffectiveClass, watchedSubjectConfigsKey, subjects, effectiveClassId]);

  const matchesExamClass = (q: Question, examTypeId?: string, classId?: string) => {
    const directMatch = (!examTypeId || q.examTypeId === examTypeId) && (!classId || q.classId === classId);
    if (directMatch) return true;
    return (q.alignments || []).some((a) => (!examTypeId || a.examTypeId === examTypeId) && (!classId || a.classId === classId));
  };

  const matchesSubjectInContext = (q: Question, subjectId: string, examTypeId?: string, classId?: string) => {
    const direct = q.subjectId === subjectId && matchesExamClass(q, examTypeId, classId);
    if (direct) return true;
    return (q.alignments || []).some((a) =>
      a.subjectId === subjectId
      && (!examTypeId || a.examTypeId === examTypeId)
      && (!classId || a.classId === classId)
    );
  };

  const availableQuestions = useMemo(() => {
    return scopedQuestionsByTeacherAndAccess.filter((q) => {
      if (!matchesExamClass(q, selectedExamType || undefined, selectedClass || undefined)) return false;
      return true;
    });
  }, [scopedQuestionsByTeacherAndAccess, selectedExamType, selectedClass]);
  const availableQuestionById = useMemo(
    () => new Map(availableQuestions.map((question) => [question.id, question])),
    [availableQuestions]
  );
  const createdTestsInCurrentMode = useMemo(() => {
    return (customTestsByTeacher || [])
      .filter((test) => !!test.id && (test.accessLevel || 'free') === targetAccessLevel)
      .sort((a, b) => {
        const aTime = asDate(a.createdAt)?.getTime() || 0;
        const bTime = asDate(b.createdAt)?.getTime() || 0;
        return bTime - aTime;
      });
  }, [customTestsByTeacher, targetAccessLevel]);

  const buildNormalizedBuilderScopeConfig = useCallback((
    subjectId?: string,
    topicId?: string,
    subtopicPaths?: string[],
    legacySubtopic?: string,
    questionType: 'All' | 'MCQ' | 'Numerical' | 'Text' = 'All',
    difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard' = 'All',
    questionSource: 'all' | 'pyq' = 'all',
    selectedPreviousYears: string[] = []
  ): PremiumCustomMockScopeConfig | null => {
    const normalizedSubjectId = String(subjectId || '').trim();
    if (!normalizedSubjectId) return null;
    return {
      subjectId: normalizedSubjectId,
      topicId: String(topicId || '').trim(),
      subtopic: String(legacySubtopic || '').trim(),
      subtopicPaths: normalizeSubtopicPathSelections(subtopicPaths, legacySubtopic),
      questionSource: normalizeQuestionSource(questionSource),
      previousYears: normalizePreviousYearList(selectedPreviousYears || []),
      questionType,
      difficultyLevel,
      count: 1,
    };
  }, []);

  function doesQuestionScopeEntryMatchCustomMockScope(
    entry: PracticeQuestionScopeEntry<Question>,
    config: Pick<PremiumCustomMockScopeConfig, 'subjectId' | 'topicId' | 'subtopic' | 'subtopicPaths' | 'questionType' | 'questionSource' | 'previousYears' | 'difficultyLevel'>,
    examTypeId: string,
    classId: string
  ) {
    if (entry.examTypeId !== examTypeId || entry.classId !== classId) return false;
    if (entry.subjectId !== String(config.subjectId || '').trim()) return false;
    if (config.topicId && entry.topicId !== config.topicId) return false;
    if (config.questionType && config.questionType !== 'All' && entry.questionType !== config.questionType) return false;
    

    const questionSource = config.questionSource === 'pyq' ? 'pyq' : 'all';
    if (questionSource === 'pyq') {
      if (!entry.isPreviousYear || !entry.previousYear) return false;
      const selectedYears = normalizePreviousYearList(config.previousYears || []);
      if (selectedYears.length > 0 && !selectedYears.includes(entry.previousYear)) return false;
    }

    const selectedSubtopicPaths = normalizeSubtopicPathSelections(config.subtopicPaths, config.subtopic);
    if (selectedSubtopicPaths.length === 0) return true;
    const entrySubtopicPaths = extractSubtopicPaths(entry.subtopics);
    if (entrySubtopicPaths.length === 0) return false;

    return selectedSubtopicPaths.some((selection) => {
      const selectionPath = parseSubtopicPathSelection(selection);
      return entrySubtopicPaths.some((entryPath) => subtopicPathStartsWith(entryPath, selectionPath));
    });
  }

  function doesQuestionMatchPremiumCustomMockScope(
    question: Question,
    config: Pick<PremiumCustomMockScopeConfig, 'subjectId' | 'topicId' | 'subtopic' | 'subtopicPaths' | 'questionType' | 'questionSource' | 'previousYears' | 'difficultyLevel'>,
    examTypeId: string,
    classId: string
  ) {
    const entries = scopedQuestionScopeEntriesById.get(question.id) || [];
    return entries.some((entry) => doesQuestionScopeEntryMatchCustomMockScope(entry, config, examTypeId, classId));
  }

  const getAvailableCountForConfig = (
    subjectId?: string,
    topicId?: string,
    subtopicPaths?: string[],
    legacySubtopic?: string,
    questionType: 'All' | 'MCQ' | 'Numerical' | 'Text' = 'All',
    difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard' = 'All',
    questionSource: 'all' | 'pyq' = 'all',
    selectedPreviousYears: string[] = [],
    excludedQuestionIds: Set<string> = EMPTY_STRING_SET
  ) => {
    const normalizedConfig = buildNormalizedBuilderScopeConfig(
      subjectId,
      topicId,
      subtopicPaths,
      legacySubtopic,
      questionType,
      difficultyLevel,
      questionSource,
      selectedPreviousYears
    );
    if (!normalizedConfig || !effectiveExamTypeId || !effectiveClassId) return 0;
    return availableQuestions.filter((question) =>
      !excludedQuestionIds.has(question.id)
      && doesQuestionMatchPremiumCustomMockScope(question, normalizedConfig, effectiveExamTypeId, effectiveClassId)
    ).length;
  };

  const getAvailablePyqYearsForConfig = (
    subjectId?: string,
    topicId?: string,
    subtopicPaths?: string[],
    legacySubtopic?: string,
    questionType: 'All' | 'MCQ' | 'Numerical' | 'Text' = 'All',
    difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard' = 'All',
    excludedQuestionIds: Set<string> = EMPTY_STRING_SET
  ) => {
    const normalizedConfig = buildNormalizedBuilderScopeConfig(
      subjectId,
      topicId,
      subtopicPaths,
      legacySubtopic,
      questionType,
      difficultyLevel,
      'pyq',
      []
    );
    if (!normalizedConfig || !effectiveExamTypeId || !effectiveClassId) return [];

    const years = availableQuestions
      .flatMap((question) => {
        if (excludedQuestionIds.has(question.id)) return [] as string[];
        const entries = scopedQuestionScopeEntriesById.get(question.id) || [];
        return entries
          .filter((entry) => doesQuestionScopeEntryMatchCustomMockScope(entry, normalizedConfig, effectiveExamTypeId, effectiveClassId))
          .map((entry) => normalizePreviousYearValue(entry.previousYear))
          .filter(Boolean);
      });
    return Array.from(new Set(years)).sort((a, b) => Number(b) - Number(a));
  };

  const getSubtopicPathPoolForConfig = (
    subjectId?: string,
    topicId?: string,
    _questionType: 'All' | 'MCQ' | 'Numerical' | 'Text' = 'All',
    _difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard' = 'All',
    _questionSource: 'all' | 'pyq' = 'all',
    _selectedPreviousYears: string[] = [],
    excludedQuestionIds: Set<string> = EMPTY_STRING_SET
  ) => {
    void _questionType;
    void _difficultyLevel;
    void _questionSource;
    void _selectedPreviousYears;
    const normalizedConfig = buildNormalizedBuilderScopeConfig(
      subjectId,
      topicId,
      [],
      '',
      'All',
      'All',
      'all',
      []
    );
    if (!normalizedConfig || !normalizedConfig.topicId || !effectiveExamTypeId || !effectiveClassId) return [] as string[][];
    const uniquePaths = new Map<string, string[]>();
    const topicMeta = (topics || []).find(
      (topic) => topic.id === normalizedConfig.topicId && topic.subjectId === normalizedConfig.subjectId
    );
    if (topicMeta) {
      addSubtopicPathsToMap(uniquePaths, [
        ...(topicMeta.subtopics || []),
        ...(topicMeta.subtopicPaths || []),
        ...(topicMeta.subtopicCatalog || []),
      ]);
    }
    availableQuestions
      .filter((question) =>
        !excludedQuestionIds.has(question.id)
        && doesQuestionMatchPremiumCustomMockScope(question, normalizedConfig, effectiveExamTypeId, effectiveClassId)
      )
      .forEach((question) => {
        const entries = scopedQuestionScopeEntriesById.get(question.id) || [];
        entries
          .filter((entry) => doesQuestionScopeEntryMatchCustomMockScope(entry, normalizedConfig, effectiveExamTypeId, effectiveClassId))
          .forEach((entry) => {
            addSubtopicPathsToMap(uniquePaths, entry.subtopics);
          });
      });
    return Array.from(uniquePaths.values()).sort((a, b) => a.join(' > ').localeCompare(b.join(' > ')));
  };

  useEffect(() => {
    if (!watchedSubjectConfigs || watchedSubjectConfigs.length === 0) return;
    let hasChanges = false;
    const nextConfigs = watchedSubjectConfigs.map((cfg) => {
      if (!cfg.subjectId) return cfg;
      const availablePyqYears = getAvailablePyqYearsForConfig(
        cfg.subjectId,
        cfg.topicId,
        cfg.subtopicPaths,
        cfg.subtopic,
        cfg.questionType,
        cfg.difficultyLevel,
        offerConsumedQuestionIdsToExclude
      );
      const normalizedSelectedYears = normalizePreviousYearList(cfg.previousYears || []);
      const sanitizedYears = cfg.questionSource === 'pyq'
        ? normalizedSelectedYears.filter((year) => availablePyqYears.includes(year))
        : [];
      const previousYearsChanged = getPreviousYearKey(sanitizedYears) !== getPreviousYearKey(normalizedSelectedYears);
      const normalizedSubtopicPaths = normalizeSubtopicPathSelections(cfg.subtopicPaths, cfg.subtopic);
      const subtopicPathPool = getSubtopicPathPoolForConfig(
        cfg.subjectId,
        cfg.topicId,
        cfg.questionType,
        cfg.difficultyLevel,
        cfg.questionSource,
        sanitizedYears,
        offerConsumedQuestionIdsToExclude
      );
      const sanitizedSubtopicPaths = normalizedSubtopicPaths.filter((selection) =>
        hasMatchingSubtopicPrefix(subtopicPathPool, parseSubtopicPathSelection(selection))
      );
      const subtopicPathsChanged = getSubtopicSelectionKey(sanitizedSubtopicPaths) !== getSubtopicSelectionKey(normalizedSubtopicPaths);
      const firstPath = parseSubtopicPathSelection(sanitizedSubtopicPaths[0] || '');
      const nextConfigBase = (previousYearsChanged || subtopicPathsChanged)
        ? {
          ...cfg,
          previousYears: sanitizedYears,
          subtopicPaths: sanitizedSubtopicPaths,
          subtopic: firstPath[0] || '',
        }
        : cfg;
      if (previousYearsChanged || subtopicPathsChanged) {
        hasChanges = true;
      }
      const availableCount = getAvailableCountForConfig(
        cfg.subjectId,
        cfg.topicId,
        sanitizedSubtopicPaths,
        firstPath[0] || '',
        cfg.questionType,
        cfg.difficultyLevel,
        cfg.questionSource,
        sanitizedYears,
        offerConsumedQuestionIdsToExclude
      );
      if (availableCount <= 0) return nextConfigBase;
      const requestedCount = Number(cfg.count || 0);
      if (!Number.isFinite(requestedCount)) return nextConfigBase;
      if (requestedCount > availableCount) {
        hasChanges = true;
        return { ...nextConfigBase, count: availableCount };
      }
      return nextConfigBase;
    });
    if (hasChanges) {
      replace(nextConfigs);
    }
  }, [watchedSubjectConfigsKey, availableQuestions, selectedExamType, selectedClass, offerConsumedQuestionIdsToExclude, replace]);

  const countExceedingBankConfig = useMemo(() => {
    return watchedSubjectConfigs.find((cfg) => {
      if (!cfg.subjectId) return false;
      const normalizedSubtopicPaths = normalizeSubtopicPathSelections(cfg.subtopicPaths, cfg.subtopic);
      const firstPath = parseSubtopicPathSelection(normalizedSubtopicPaths[0] || '');
      const availableCount = getAvailableCountForConfig(
        cfg.subjectId,
        cfg.topicId,
        normalizedSubtopicPaths,
        firstPath[0] || '',
        cfg.questionType,
        cfg.difficultyLevel,
        cfg.questionSource,
        cfg.previousYears,
        offerConsumedQuestionIdsToExclude
      );
      const requestedCount = Number(cfg.count || 0);
      if (!Number.isFinite(requestedCount)) return false;
      return requestedCount > availableCount;
    }) || null;
  }, [watchedSubjectConfigsKey, availableQuestions, selectedExamType, selectedClass, offerConsumedQuestionIdsToExclude]);
  const matchesQuestionScopeEntryForCustomMock = useCallback((
    entry: PracticeQuestionScopeEntry<Question>,
    config: Pick<PremiumCustomMockScopeConfig, 'subjectId' | 'topicId' | 'subtopic' | 'subtopicPaths' | 'questionType' | 'questionSource' | 'previousYears' | 'difficultyLevel'>,
    examTypeId: string,
    classId: string
  ) => doesQuestionScopeEntryMatchCustomMockScope(entry, config, examTypeId, classId), []);
  const matchesBuilderConfigQuestion = useCallback((
    question: Question,
    config: (typeof watchedSubjectConfigs)[number],
    examTypeId: string,
    classId: string
  ) => {
    return doesQuestionMatchPremiumCustomMockScope(question, {
      subjectId: String(config.subjectId || '').trim(),
      topicId: String(config.topicId || '').trim(),
      subtopic: String(config.subtopic || '').trim(),
      subtopicPaths: normalizeSubtopicPathSelections(config.subtopicPaths, config.subtopic),
      questionSource: normalizeQuestionSource(config.questionSource || 'all'),
      previousYears: normalizePreviousYearList(config.previousYears || []),
      questionType: (config.questionType || 'All') as 'All' | 'MCQ' | 'Numerical' | 'Text',
      difficultyLevel: 'Easy' as const,
    }, examTypeId, classId);
  }, [defaultDifficultyLevel, scopedQuestionScopeEntriesById]);
  const matchesPremiumCustomMockScopeQuestion = useCallback((
    question: Question,
    config: PremiumCustomMockScopeConfig,
    examTypeId: string,
    classId: string
  ) => (
    doesQuestionMatchPremiumCustomMockScope(question, {
      subjectId: String(config.subjectId || '').trim(),
      topicId: String(config.topicId || '').trim(),
      subtopic: String(config.subtopic || '').trim(),
      subtopicPaths: normalizeSubtopicPathSelections(config.subtopicPaths, config.subtopic),
      questionSource: normalizeQuestionSource(config.questionSource || 'all'),
      previousYears: normalizePreviousYearList(config.previousYears || []),
      questionType: (config.questionType || 'All') as 'All' | 'MCQ' | 'Numerical' | 'Text',
      difficultyLevel: 'Easy' as const,
    }, examTypeId, classId)
  ), [defaultDifficultyLevel, scopedQuestionScopeEntriesById]);
  const linkedPremiumFeatureScopeQuestions = useMemo(() => {
    if (!linkedPremiumFeatureScopeExamTypeId || !linkedPremiumFeatureScopeClassId) return [] as Question[];
    return scopedQuestionsByTeacherAndAccess
      .filter((question) => matchesExamClass(question, linkedPremiumFeatureScopeExamTypeId, linkedPremiumFeatureScopeClassId))
      .sort((left, right) => left.id.localeCompare(right.id));
  }, [
    linkedPremiumFeatureScopeClassId,
    linkedPremiumFeatureScopeExamTypeId,
    scopedQuestionsByTeacherAndAccess,
  ]);
  const linkedPremiumFeatureReusableQuestionIds = useMemo(() => {
    if (!isOfferBackedPremiumFeaturePurchase) return [] as string[];

    const targetCount = Math.max(
      linkedPremiumFeaturePurchasedQuestionCount,
      linkedPremiumFeatureStoredIncludedQuestionIds.length,
      linkedPremiumFeatureHistoricalIncludedQuestionIds.length
    );
    if (targetCount <= 0 || linkedPremiumFeatureScopeQuestions.length === 0) {
      return [] as string[];
    }

    const candidateQuestions = linkedPremiumFeatureScopeQuestions.filter((question) => (
      linkedPremiumFeatureIncludedSubjectConfigs.length === 0
        ? true
        : linkedPremiumFeatureIncludedSubjectConfigs.some((config) =>
            matchesPremiumCustomMockScopeQuestion(
              question,
              config,
              linkedPremiumFeatureScopeExamTypeId,
              linkedPremiumFeatureScopeClassId
            )
          )
    ));
    if (candidateQuestions.length === 0) {
      return [] as string[];
    }

    const candidateQuestionIdSet = new Set(candidateQuestions.map((question) => question.id));
    const seedQuestionIds = [
      ...linkedPremiumFeatureStoredIncludedQuestionIds,
      ...linkedPremiumFeatureHistoricalIncludedQuestionIds.filter((questionId) =>
        !linkedPremiumFeatureStoredIncludedQuestionIds.includes(questionId)
      ),
    ].filter((questionId) => candidateQuestionIdSet.has(questionId));
    const requiredCount = Math.max(targetCount, seedQuestionIds.length);

    if (linkedPremiumFeatureIncludedSubjectConfigs.length === 0) {
      return [
        ...seedQuestionIds,
        ...candidateQuestions
          .map((question) => question.id)
          .filter((questionId) => !seedQuestionIds.includes(questionId)),
      ].slice(0, requiredCount);
    }

    const includedSlots = linkedPremiumFeatureIncludedSubjectConfigs.flatMap((config, configIndex) => {
      const slotCount = Math.max(0, Math.floor(Number(config.count || 0)));
      return Array.from({ length: slotCount }, (_, slotIndex) => ({
        id: `${configIndex}:${slotIndex}`,
        config,
        specificity: premiumCustomMockConfigSpecificity(config),
      }));
    });

    const candidateEntries = candidateQuestions
      .map((question) => {
        const matchingSlotIds = includedSlots
          .filter((slot) => matchesPremiumCustomMockScopeQuestion(
            question,
            slot.config,
            linkedPremiumFeatureScopeExamTypeId,
            linkedPremiumFeatureScopeClassId
          ))
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
    isOfferBackedPremiumFeaturePurchase,
    linkedPremiumFeatureHistoricalIncludedQuestionIds,
    linkedPremiumFeatureIncludedSubjectConfigs,
    linkedPremiumFeaturePurchasedQuestionCount,
    linkedPremiumFeatureScopeClassId,
    linkedPremiumFeatureScopeExamTypeId,
    linkedPremiumFeatureScopeQuestions,
    linkedPremiumFeatureStoredIncludedQuestionIds,
    matchesPremiumCustomMockScopeQuestion,
  ]);
  const linkedPremiumFeatureReusableQuestionIdSet = useMemo(
    () => new Set(linkedPremiumFeatureReusableQuestionIds),
    [linkedPremiumFeatureReusableQuestionIds]
  );
  const linkedPremiumFeatureReusableQuestionCount = linkedPremiumFeatureReusableQuestionIds.length;
  const linkedPremiumFeatureLinkedMockCount = linkedOfferBackedCreatedTests.length + (
    isEditMode && isOfferBackedPremiumFeaturePurchase && editTestId ? 1 : 0
  );
  const includedOfferQuestionCountBySubjectId = useMemo(() => {
    const subjectIds = Array.from(
      new Set(
        linkedPremiumFeatureIncludedSubjectConfigs
          .map((config) => String(config.subjectId || '').trim())
          .filter(Boolean)
      )
    );
    return subjectIds.reduce<Record<string, number>>((acc, subjectId) => {
      acc[subjectId] = linkedPremiumFeatureReusableQuestionIds.reduce((count, questionId) => {
        const question = scopedQuestionById.get(questionId);
        return count + (
          question && matchesSubjectInContext(
            question,
            subjectId,
            linkedPremiumFeatureScopeExamTypeId,
            linkedPremiumFeatureScopeClassId
          )
            ? 1
            : 0
        );
      }, 0);
      return acc;
    }, {});
  }, [
    linkedPremiumFeatureIncludedSubjectConfigs,
    linkedPremiumFeatureReusableQuestionIds,
    linkedPremiumFeatureScopeClassId,
    linkedPremiumFeatureScopeExamTypeId,
    scopedQuestionById,
  ]);
  const linkedPremiumFeatureStoredIncludedQuestionIdsKey = linkedPremiumFeatureStoredIncludedQuestionIds.join('|');
  const linkedPremiumFeatureReusableQuestionIdsKey = linkedPremiumFeatureReusableQuestionIds.join('|');
  const reusableOfferAllocationSyncRef = useRef('');
  useEffect(() => {
    if (
      !firestore
      || !user?.uid
      || !isOfferBackedPremiumFeaturePurchase
      || isMergedAdminAssignedPremiumFeaturePurchase
      || !linkedPremiumFeaturePurchase?.id
      || linkedPremiumFeatureReusableQuestionIds.length === 0
    ) {
      return;
    }

    const normalizedStoredCount = Math.max(0, Number(linkedPremiumFeaturePurchase?.includedQuestionCount || 0));
    const desiredCount = Math.max(normalizedStoredCount, linkedPremiumFeatureReusableQuestionIds.length);
    const needsIdSync = linkedPremiumFeatureStoredIncludedQuestionIdsKey !== linkedPremiumFeatureReusableQuestionIdsKey;
    const needsCountSync = desiredCount !== normalizedStoredCount;
    if (!needsIdSync && !needsCountSync) {
      return;
    }

    const syncKey = `${linkedPremiumFeaturePurchase.id}__${linkedPremiumFeatureReusableQuestionIdsKey}__${desiredCount}`;
    if (reusableOfferAllocationSyncRef.current === syncKey) {
      return;
    }
    reusableOfferAllocationSyncRef.current = syncKey;

    void setDocumentNonBlocking(
      doc(firestore, 'users', user.uid, 'premium_mock_feature_purchases', linkedPremiumFeaturePurchase.id),
      {
        includedQuestionIds: linkedPremiumFeatureReusableQuestionIds,
        ...(needsCountSync ? { includedQuestionCount: desiredCount } : {}),
      },
      { merge: true }
    );
  }, [
    firestore,
    isOfferBackedPremiumFeaturePurchase,
    linkedPremiumFeaturePurchase?.id,
    linkedPremiumFeaturePurchase?.includedQuestionCount,
    linkedPremiumFeatureReusableQuestionIds,
    linkedPremiumFeatureReusableQuestionIdsKey,
    linkedPremiumFeatureStoredIncludedQuestionIdsKey,
    isMergedAdminAssignedPremiumFeaturePurchase,
    user?.uid,
  ]);
  const resolvedPremiumQuestionIds = useMemo(() => {
    if (!isPremiumMode) return [] as string[];
    const preservedIds = [...existingPremiumQuestionIds];
    const usedIds = new Set(preservedIds);
    const appendedIds: string[] = [];
    const prioritizedConfigs = watchedSubjectConfigs
      .map((config, index) => ({
        config,
        index,
        specificity: premiumCustomMockConfigSpecificity({
          topicId: String(config.topicId || '').trim(),
          subtopicPaths: normalizeSubtopicPathSelections(config.subtopicPaths, config.subtopic),
          questionType: (config.questionType || 'All') as 'All' | 'MCQ' | 'Numerical' | 'Text',
          questionSource: normalizeQuestionSource(config.questionSource || 'all'),
          previousYears: normalizePreviousYearList(config.previousYears || []),
          difficultyLevel: 'Easy' as const,
        }),
      }))
      .sort((left, right) => right.specificity - left.specificity || left.index - right.index)
      .map((entry) => entry.config);

    prioritizedConfigs.forEach((config) => {
      if (!config.subjectId) return;
      const requestedCount = Number(config.count || 0);
      if (!Number.isFinite(requestedCount) || requestedCount <= 0) return;

      const preservedCountForConfig = preservedIds.reduce((count, questionId) => {
        const question = availableQuestionById.get(questionId);
        return count + (question && matchesBuilderConfigQuestion(question, config, effectiveExamTypeId, effectiveClassId) ? 1 : 0);
      }, 0);
      const requiredAdditionalCount = Math.max(0, requestedCount - preservedCountForConfig);
      if (requiredAdditionalCount <= 0) return;

      const nextIds = availableQuestions
        .filter((question) =>
          !usedIds.has(question.id)
          && matchesBuilderConfigQuestion(question, config, effectiveExamTypeId, effectiveClassId)
        )
        .sort((left, right) => {
          const leftIncludedRank = linkedPremiumFeaturePurchaseMatchesCurrentScope && linkedPremiumFeatureReusableQuestionIdSet.has(left.id) ? 0 : 1;
          const rightIncludedRank = linkedPremiumFeaturePurchaseMatchesCurrentScope && linkedPremiumFeatureReusableQuestionIdSet.has(right.id) ? 0 : 1;
          return leftIncludedRank - rightIncludedRank || left.id.localeCompare(right.id);
        })
        .slice(0, requiredAdditionalCount)
        .map((question) => question.id);

      nextIds.forEach((questionId) => usedIds.add(questionId));
      appendedIds.push(...nextIds);
    });

    return [...preservedIds, ...appendedIds];
  }, [
    availableQuestionById,
    availableQuestions,
    effectiveClassId,
    effectiveExamTypeId,
    existingPremiumQuestionIds,
    defaultDifficultyLevel,
    isPremiumMode,
    linkedPremiumFeaturePurchaseMatchesCurrentScope,
    linkedPremiumFeatureReusableQuestionIdSet,
    matchesBuilderConfigQuestion,
    watchedSubjectConfigsKey,
  ]);
  const existingPremiumAttemptUsage = useMemo(() => {
    if (!isPremiumMode || !isEditMode || !existingCustomTest) return null;
    return resolvePremiumCustomMockAttemptUsage({
      attemptPricing: existingCustomTest.attemptPricing || premiumMockTestAttemptRule,
      attemptState: existingCustomTest.attemptState,
      purchasedAt: existingCustomTest.purchasedAt || existingCustomTest.createdAt,
    });
  }, [existingCustomTest, isEditMode, isPremiumMode, premiumMockTestAttemptRule]);
  const existingPremiumQuestionCount = existingPremiumQuestionIds.length;
  const linkedPremiumFeatureQuestionCount = Math.max(0, Number(linkedPremiumFeaturePurchase?.questionCount || 0));
  const includedPremiumQuestionCount = isOfferBackedPremiumFeaturePurchase
    ? linkedPremiumFeatureReusableQuestionCount
    : (isEditMode ? existingPremiumQuestionCount : linkedPremiumFeatureQuestionCount);
  const existingPremiumQuestionAmount = Number(existingCustomTest?.grossAmount || 0);
  const existingPremiumAttemptsPaidAmount = Number(existingCustomTest?.attemptsPaidAmount || 0);
  const linkedPremiumFeatureIncludedQuestionCountByDifficulty = useMemo(() => {
    if (!isOfferBackedPremiumFeaturePurchase) {
      return linkedPremiumFeaturePurchaseMatchesCurrentScope
        ? mergeLegacyDifficultyCounts(
            linkedPremiumFeaturePurchase?.includedQuestionCountByDifficulty
            || existingCustomTest?.includedQuestionCountByDifficulty
            || undefined
          )
        : undefined;
    }
    if (linkedPremiumFeatureReusableQuestionIds.length > 0) {
      const reusableCountByDifficulty = countQuestionIdsByDifficulty(linkedPremiumFeatureReusableQuestionIds, scopedQuestionById);
      return mergeLegacyDifficultyCounts({
        easy: reusableCountByDifficulty.Easy,
        medium: reusableCountByDifficulty.Medium,
        hard: reusableCountByDifficulty.Hard,
      });
    }
    return mergeLegacyDifficultyCounts(
      linkedPremiumFeaturePurchase?.includedQuestionCountByDifficulty
      || existingCustomTest?.includedQuestionCountByDifficulty
      || undefined
    );
  }, [
    existingCustomTest?.includedQuestionCountByDifficulty,
    isOfferBackedPremiumFeaturePurchase,
    linkedPremiumFeaturePurchase?.includedQuestionCountByDifficulty,
    linkedPremiumFeaturePurchaseMatchesCurrentScope,
    linkedPremiumFeatureReusableQuestionIds,
    scopedQuestionById,
  ]);
  const premiumResolvedQuestionCountByDifficulty = useMemo(() => {
    return countQuestionIdsByDifficulty(resolvedPremiumQuestionIds, availableQuestionById);
  }, [availableQuestionById, resolvedPremiumQuestionIds]);
  const includedPremiumQuestionIds = useMemo(() => {
    if (!isPremiumMode || !isOfferBackedPremiumFeaturePurchase || !linkedPremiumFeaturePurchaseMatchesCurrentScope) {
      return [] as string[];
    }
    if (linkedPremiumFeatureReusableQuestionCount <= 0 || resolvedPremiumQuestionIds.length === 0) {
      return [] as string[];
    }
    return resolvedPremiumQuestionIds.filter((questionId) => linkedPremiumFeatureReusableQuestionIdSet.has(questionId));
  }, [
    isOfferBackedPremiumFeaturePurchase,
    isPremiumMode,
    linkedPremiumFeaturePurchaseMatchesCurrentScope,
    linkedPremiumFeatureReusableQuestionCount,
    linkedPremiumFeatureReusableQuestionIdSet,
    resolvedPremiumQuestionIds,
  ]);
  const offerIncludedCoverageBySection = useMemo(() => {
    if (!isPremiumMode || !isOfferBackedPremiumFeaturePurchase || includedPremiumQuestionIds.length === 0) {
      return {} as Record<number, number>;
    }

    const sectionCoverage: Record<number, number> = {};
    const unassignedIncludedIds = new Set(includedPremiumQuestionIds);
    const prioritizedSections = watchedSubjectConfigs
      .map((config, index) => {
        const subjectId = String(config.subjectId || '').trim();
        const requestedCount = Math.max(0, Number(config.count || 0));
        if (!subjectId || requestedCount <= 0) return null;

        const normalizedConfig = {
          subjectId,
          topicId: String(config.topicId || '').trim(),
          subtopic: String(config.subtopic || '').trim(),
          subtopicPaths: normalizeSubtopicPathSelections(config.subtopicPaths, config.subtopic),
          questionSource: normalizeQuestionSource(config.questionSource || 'all'),
          previousYears: normalizePreviousYearList(config.previousYears || []),
          questionType: (config.questionType || 'All') as 'All' | 'MCQ' | 'Numerical' | 'Text',
          difficultyLevel: 'Easy' as const,
          count: requestedCount,
        };

        return {
          index,
          requestedCount,
          config: normalizedConfig,
          specificity: premiumCustomMockConfigSpecificity(normalizedConfig),
        };
      })
      .filter((section): section is {
        index: number;
        requestedCount: number;
        config: {
          subjectId: string;
          topicId: string;
          subtopic: string;
          subtopicPaths: string[];
          questionSource: 'all' | 'pyq';
          previousYears: string[];
          questionType: 'All' | 'MCQ' | 'Numerical' | 'Text';
          difficultyLevel: 'Easy';
          count: number;
        };
        specificity: number;
      } => !!section)
      .sort((left, right) => right.specificity - left.specificity || left.index - right.index);

    prioritizedSections.forEach((section) => {
      let coveredCount = 0;

      for (const questionId of includedPremiumQuestionIds) {
        if (coveredCount >= section.requestedCount) break;
        if (!unassignedIncludedIds.has(questionId)) continue;

        const question = availableQuestionById.get(questionId);
        if (!question) continue;
        if (!matchesPremiumCustomMockScopeQuestion(question, section.config, effectiveExamTypeId, effectiveClassId)) continue;

        unassignedIncludedIds.delete(questionId);
        coveredCount += 1;
      }

      if (coveredCount > 0) {
        sectionCoverage[section.index] = coveredCount;
      }
    });

    return sectionCoverage;
  }, [
    availableQuestionById,
    defaultDifficultyLevel,
    effectiveClassId,
    effectiveExamTypeId,
    includedPremiumQuestionIds,
    isOfferBackedPremiumFeaturePurchase,
    isPremiumMode,
    matchesPremiumCustomMockScopeQuestion,
    watchedSubjectConfigs,
  ]);
  const visibleIncludedPremiumQuestionCount = isOfferBackedPremiumFeaturePurchase
    ? includedPremiumQuestionIds.length
    : includedPremiumQuestionCount;
  const hasIncludedPremiumCoverage = visibleIncludedPremiumQuestionCount > 0;
  const premiumAdditionalQuestionIds = useMemo(
    () => (
      !isPremiumMode
        ? []
        : isOfferBackedPremiumFeaturePurchase
          ? resolvedPremiumQuestionIds.filter((questionId) => !includedPremiumQuestionIds.includes(questionId))
          : resolvedPremiumQuestionIds.slice(includedPremiumQuestionCount)
    ),
    [
      includedPremiumQuestionCount,
      includedPremiumQuestionIds,
      isOfferBackedPremiumFeaturePurchase,
      isPremiumMode,
      resolvedPremiumQuestionIds,
    ]
  );
  const billablePremiumAdditionalQuestionIds = useMemo(
    () => (
      !isEditMode
        ? premiumAdditionalQuestionIds
        : premiumAdditionalQuestionIds.filter((questionId) => !existingPremiumQuestionIds.includes(questionId))
    ),
    [existingPremiumQuestionIds, isEditMode, premiumAdditionalQuestionIds]
  );
  const includedPremiumQuestionCountByDifficulty = useMemo(() => {
    if (!isOfferBackedPremiumFeaturePurchase || !linkedPremiumFeaturePurchaseMatchesCurrentScope) {
      return { Easy: 0, Medium: 0, Hard: 0 };
    }
    return countQuestionIdsByDifficulty(includedPremiumQuestionIds, availableQuestionById);
  }, [
    availableQuestionById,
    includedPremiumQuestionIds,
    isOfferBackedPremiumFeaturePurchase,
    linkedPremiumFeaturePurchaseMatchesCurrentScope,
  ]);
  const derivedIncludedPremiumQuestionCountByDifficulty = useMemo(() => {
    return mergeLegacyDifficultyCounts({
      easy: linkedPremiumFeatureIncludedSubjectConfigs.reduce(
        (sum, config) => sum + Math.max(0, Number(config.count || 0)),
        0
      ),
    });
  }, [linkedPremiumFeatureIncludedSubjectConfigs]);
  const premiumQuestionPricingBreakdown = useMemo<DcamQuestionPricingBreakdown>(() => {
    return buildDcamQuestionPricingBreakdown({
      questionIds: resolvedPremiumQuestionIds,
      questionById: availableQuestionById,
      profile: teacherProfile,
      mode: 'mock',
      examTypeId: effectiveExamTypeId,
      classId: effectiveClassId,
    });
  }, [availableQuestionById, effectiveClassId, effectiveExamTypeId, resolvedPremiumQuestionIds, teacherProfile]);
  const premiumMockTestQuestionPriceByDifficulty = premiumQuestionPricingBreakdown.averagePriceByDifficulty;
  const premiumMockAmountByDifficulty = premiumQuestionPricingBreakdown.amountByDifficulty;
  const premiumMockTotalAmount = premiumQuestionPricingBreakdown.totalAmount;
  const premiumAdditionalQuestionPricingBreakdown = useMemo<DcamQuestionPricingBreakdown>(() => {
    return buildDcamQuestionPricingBreakdown({
      questionIds: billablePremiumAdditionalQuestionIds,
      questionById: availableQuestionById,
      profile: teacherProfile,
      mode: 'mock',
      examTypeId: effectiveExamTypeId,
      classId: effectiveClassId,
    });
  }, [availableQuestionById, billablePremiumAdditionalQuestionIds, effectiveClassId, effectiveExamTypeId, teacherProfile]);
  const premiumAdditionalQuestionCountByDifficulty = premiumAdditionalQuestionPricingBreakdown.countByDifficulty;
  const premiumMissingPriceForSelection = premiumQuestionPricingBreakdown.missingPricing;
  const additionalPremiumQuestionPayableAmount = isPremiumMode
    ? premiumAdditionalQuestionPricingBreakdown.totalAmount
    : 0;
  const premiumPricingDisplayBreakdown = hasIncludedPremiumCoverage
    ? premiumAdditionalQuestionPricingBreakdown
    : premiumQuestionPricingBreakdown;
  const premiumMockAttemptActionKind: PremiumCustomMockAttemptActionKind =
    existingPremiumAttemptUsage?.isExhausted ? existingPremiumAttemptUsage.actionKind : 'none';
  const premiumMockAttemptCharge = existingPremiumAttemptUsage?.isExhausted ? existingPremiumAttemptUsage.actionAmount : 0;
  const premiumMockAttemptBlocked = !!existingPremiumAttemptUsage?.isExhausted && premiumMockAttemptActionKind === 'none';
  const totalPremiumPayableNow = useMemo(() => {
    if (!isPremiumMode) return 0;
    return Number((additionalPremiumQuestionPayableAmount + (isEditMode && existingCustomTest ? premiumMockAttemptCharge : 0)).toFixed(2));
  }, [
    additionalPremiumQuestionPayableAmount,
    existingCustomTest,
    isEditMode,
    isPremiumMode,
    premiumMockAttemptCharge,
  ]);
  const cannotReducePremiumQuestionCount =
    isPremiumMode
    && !isOfferBackedPremiumFeaturePurchase
    && includedPremiumQuestionCount > 0
    && totalRequestedQuestions < includedPremiumQuestionCount;
  const effectivePremiumMissingPriceForSelection = hasIncludedPremiumCoverage
    ? premiumAdditionalQuestionPricingBreakdown.missingPricing
    : premiumMissingPriceForSelection;
  const premiumPreservedQuestionMismatchCount = useMemo(() => {
    if (!isPremiumMode || !isEditMode || existingPremiumQuestionIds.length === 0) return 0;
    return existingPremiumQuestionIds.reduce((count, questionId) => {
      const question = availableQuestionById.get(questionId);
      if (!question) return count + 1;
      const matchesAnyConfig = watchedSubjectConfigs.some((config) =>
        !!config.subjectId && matchesBuilderConfigQuestion(question, config, effectiveExamTypeId, effectiveClassId)
      );
      return count + (matchesAnyConfig ? 0 : 1);
    }, 0);
  }, [
    availableQuestionById,
    effectiveClassId,
    effectiveExamTypeId,
    existingPremiumQuestionIds,
    isEditMode,
    isPremiumMode,
    matchesBuilderConfigQuestion,
    watchedSubjectConfigsKey,
  ]);
  const premiumQuestionSelectionShortfall = isPremiumMode
    ? Math.max(0, totalRequestedQuestions - resolvedPremiumQuestionIds.length)
    : 0;
  const premiumEditStructureConflict = isPremiumMode && isEditMode && resolvedPremiumQuestionIds.length > totalRequestedQuestions;

  const handleThumbnailChange = (file?: File) => {
    if (!file) {
      setThumbnailFile(null);
      return;
    }
    const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
    if (!isJpeg) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Only JPEG/JPG thumbnail files are allowed.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Please upload a thumbnail smaller than 5MB.' });
      return;
    }
    setThumbnailFile(file);
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const normalizedValues = {
      ...values,
      examTypeId: values.examTypeId,
      classId: values.classId,
      subjectConfigs: values.subjectConfigs.map((cfg) => ({
        ...cfg,
        randomizePerAttempt: isPremiumMode ? false : !!cfg.randomizePerAttempt,
        subtopicPaths: normalizeSubtopicPathSelections(cfg.subtopicPaths, cfg.subtopic),
        subtopic: parseSubtopicPathSelection(
          normalizeSubtopicPathSelections(cfg.subtopicPaths, cfg.subtopic)[0] || ''
        )[0] || '',
        questionSource: normalizeQuestionSource(cfg.questionSource),
        previousYears: normalizePreviousYearList(cfg.previousYears || []),
      })),
    };
    const normalizedTotalRequestedQuestions = normalizedValues.subjectConfigs.reduce(
      (acc, cfg) => acc + Math.max(0, Number(cfg.count || 0)),
      0
    );
    const normalizedTotalMarks = normalizedTotalRequestedQuestions * Number(normalizedValues.marksPerQuestion || 0);
    if (!user) return;
    if (isTeacher && allowedClassIds.length > 0 && !allowedClassIds.includes(normalizedValues.classId)) {
      toast({ variant: 'destructive', title: 'Invalid Curriculum', description: 'You can only create tests for your assigned curricula.' });
      return;
    }
    const overLimitConfig = normalizedValues.subjectConfigs.find((cfg) => {
      if (!cfg.subjectId) return false;
      const firstPath = parseSubtopicPathSelection((cfg.subtopicPaths || [])[0] || '');
      const availableCount = getAvailableCountForConfig(
        cfg.subjectId,
        cfg.topicId,
        cfg.subtopicPaths,
        firstPath[0] || '',
        cfg.questionType,
        cfg.difficultyLevel,
        cfg.questionSource,
        cfg.previousYears,
        offerConsumedQuestionIdsToExclude
      );
      return Number(cfg.count || 0) > availableCount;
    });
    if (overLimitConfig) {
      const overLimitFirstPath = parseSubtopicPathSelection((overLimitConfig.subtopicPaths || [])[0] || '');
      const availableCount = getAvailableCountForConfig(
        overLimitConfig.subjectId,
        overLimitConfig.topicId,
        overLimitConfig.subtopicPaths,
        overLimitFirstPath[0] || '',
        overLimitConfig.questionType,
        overLimitConfig.difficultyLevel,
        overLimitConfig.questionSource,
        overLimitConfig.previousYears,
        offerConsumedQuestionIdsToExclude
      );
      toast({
        variant: 'destructive',
        title: 'Question count exceeds bank',
        description: `Requested questions cannot be greater than Bank Count. Available: ${availableCount}.`,
      });
      return;
    }
    if (isPremiumMode) {
      if (cannotReducePremiumQuestionCount) {
        toast({
          variant: 'destructive',
          title: 'Question count cannot be reduced',
          description: `This premium custom mock access already includes ${includedPremiumQuestionCount} questions. You can only add more questions above that included count.`,
        });
        return;
      }
      if (premiumPreservedQuestionMismatchCount > 0) {
        toast({
          variant: 'destructive',
          title: 'Keep previously purchased questions',
          description: 'Paid custom mock edits cannot replace earlier purchased questions. Keep the existing blueprint intact and only add new sections or question counts.',
        });
        return;
      }
      if (premiumEditStructureConflict) {
        toast({
          variant: 'destructive',
          title: 'Edit would replace old questions',
          description: 'This change would reshuffle previously purchased questions. Keep the existing sections and only add new questions.',
        });
        return;
      }
      if (premiumQuestionSelectionShortfall > 0) {
        toast({
          variant: 'destructive',
          title: 'Not enough new questions',
          description: `Only ${resolvedPremiumQuestionIds.length} questions can be locked with the current blueprint. Reduce the increase or widen your filters.`,
        });
        return;
      }
      if (premiumMockAttemptBlocked) {
        toast({
          variant: 'destructive',
          title: 'Attempts exhausted',
          description: 'This premium custom mock has no recharge price configured yet. Ask the teacher to update custom mock attempt pricing.',
        });
        return;
      }
      const allowedSubjectIdsForClass = new Set(
        (subjects || [])
          .filter((subject) => subject.classId === normalizedValues.classId)
          .map((subject) => subject.id)
      );
      const hasSubjectOutsideCurriculum = normalizedValues.subjectConfigs.some(
        (cfg) => !cfg.subjectId || !allowedSubjectIdsForClass.has(cfg.subjectId)
      );
      if (hasSubjectOutsideCurriculum) {
        toast({
          variant: 'destructive',
          title: 'Invalid subject for curriculum',
          description: 'Selected subject must belong to the selected curriculum.',
        });
        return;
      }
      if (effectivePremiumMissingPriceForSelection) {
        toast({
          variant: 'destructive',
          title: 'Premium pricing not configured',
          description: hasIncludedPremiumCoverage
            ? 'Teacher has not set paid pricing for one or more additional question groups added above your included question count.'
            : 'Teacher has not set per-question price for one or more selected question groups.',
        });
        return;
      }
    }

    setIsSubmitting(true);
    const recoveryPayment = queuedRecoveryPaymentRef.current;
    const isRecoveryFlow = isPremiumMode && !isEditMode && !!recoveryPayment;

    const finalQuestionIds: string[] = [];
    let selectionError = false;
    if (isPremiumMode && (isEditMode || !!linkedPremiumFeaturePurchase)) {
      finalQuestionIds.push(...resolvedPremiumQuestionIds);
    } else {
      const usedQuestionIds = new Set<string>();
      const prioritizedConfigs = [...normalizedValues.subjectConfigs].sort((a, b) => {
        const specificity = (cfg: (typeof values.subjectConfigs)[number]) =>
          (cfg.questionType === 'All' ? 0 : 1)
          + (cfg.difficultyLevel === 'All' ? 0 : 1)
          + (getSubtopicSelectionKey(cfg.subtopicPaths, cfg.subtopic) ? 1 : 0)
          + (cfg.questionSource === 'pyq' ? 1 : 0)
          + ((cfg.previousYears || []).length > 0 ? 1 : 0);
        return specificity(b) - specificity(a);
      });

      for (const config of prioritizedConfigs) {
        const normalizedConfigPaths = normalizeSubtopicPathSelections(config.subtopicPaths, config.subtopic);
        const configFirstPath = parseSubtopicPathSelection(normalizedConfigPaths[0] || '');
        const normalizedConfig = {
          subjectId: String(config.subjectId || '').trim(),
          topicId: String(config.topicId || '').trim(),
          subtopic: configFirstPath[0] || '',
          subtopicPaths: normalizedConfigPaths,
          questionSource: normalizeQuestionSource(config.questionSource || 'all'),
          previousYears: normalizePreviousYearList(config.previousYears || []),
          questionType: (config.questionType || 'All') as 'All' | 'MCQ' | 'Numerical' | 'Text',
          difficultyLevel: 'Easy' as const,
        };
        const subjectQuestions = availableQuestions.filter((q) =>
          doesQuestionMatchPremiumCustomMockScope(
            q,
            normalizedConfig,
            normalizedValues.examTypeId,
            normalizedValues.classId
          )
          && !usedQuestionIds.has(q.id)
        );
        if (subjectQuestions.length < config.count) {
          const pyqLabel = config.questionSource === 'pyq'
            ? ` / PYQ ${normalizePreviousYearList(config.previousYears || []).join(', ') || 'All Years'}`
            : '';
          toast({
            variant: 'destructive',
            title: 'Not Enough Questions',
            description: `Subject "${config.subjectName}" (${config.topicName || 'All topics'} / ${(normalizedConfigPaths.length > 0 ? normalizedConfigPaths.join(', ') : 'All subtopics')} / ${config.questionType} / ${config.difficultyLevel}${pyqLabel}) has ${subjectQuestions.length} available questions, requested ${config.count}.`,
          });
          selectionError = true;
          break;
        }
        const shuffled = [...subjectQuestions].sort(() => 0.5 - Math.random());
        const selectedIds = shuffled.slice(0, config.count).map((q) => q.id);
        selectedIds.forEach((id) => usedQuestionIds.add(id));
        finalQuestionIds.push(...selectedIds);
      }
    }

    if (selectionError || finalQuestionIds.length === 0) {
      queuedRecoveryPaymentRef.current = null;
      setRecoveringPaymentId('');
      setIsSubmitting(false);
      return;
    }
    const normalizedPremiumCombinationKey =
      isPremiumMode && effectiveTeacherId && normalizedValues.examTypeId && normalizedValues.classId
        ? `${effectiveTeacherId}__${normalizedValues.examTypeId}__${normalizedValues.classId}`
        : null;
    const questionAmountPayableNow = isPremiumMode ? additionalPremiumQuestionPayableAmount : 0;
    const attemptAmountPayableNow = isPremiumMode && isEditMode && existingCustomTest ? premiumMockAttemptCharge : 0;
    const payableNow = isPremiumMode
      ? totalPremiumPayableNow
      : 0;

    const persistCustomTest = async ({
      paymentMeta,
      questionAmountPaid = 0,
      attemptAmountPaid = 0,
      attemptActionKind = 'none',
    }: {
      paymentMeta?: { paymentId: string; orderId: string; amount: number; paidAt: string };
      questionAmountPaid?: number;
      attemptAmountPaid?: number;
      attemptActionKind?: PremiumCustomMockAttemptActionKind;
    } = {}) => {
      let thumbnailUrl = existingCustomTest?.thumbnailUrl || existingCustomTest?.imageUrl || '';
      if (thumbnailFile) {
        const safeName = thumbnailFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uploadRef = ref(storage, `course_thumbnails/${user.uid}/mock_tests/${Date.now()}_${safeName}`);
        const uploaded = await uploadBytes(uploadRef, thumbnailFile, { contentType: thumbnailFile.type });
        thumbnailUrl = await getDownloadURL(uploaded.ref);
      }

      const customTestsRef = collection(firestore, 'users', user.uid, 'custom_tests');
      let savedCustomTestId = editTestId || '';
      const purchasedAt = existingCustomTest?.purchasedAt || paymentMeta?.paidAt || new Date().toISOString();
      const baseQuestionPaidAmount = isEditMode
        ? existingPremiumQuestionAmount
        : Number(linkedPremiumFeaturePurchase?.questionAmountPaid || 0);
      const baseAttemptPaidAmount = isEditMode
        ? existingPremiumAttemptsPaidAmount
        : Number(linkedPremiumFeaturePurchase?.attemptAmountPaid || 0);
      const activeAttemptPricingSnapshot = isPremiumMode
        ? normalizePremiumCustomMockAttemptPricingRule(
          isEditMode && existingCustomTest?.attemptPricing
            ? existingCustomTest.attemptPricing
            : (linkedPremiumFeaturePurchase?.attemptPricing || premiumMockTestAttemptRule)
        )
        : null;
      const effectiveAttemptUsage = isPremiumMode && activeAttemptPricingSnapshot
        ? resolvePremiumCustomMockAttemptUsage({
          attemptPricing: activeAttemptPricingSnapshot,
          attemptState: existingCustomTest?.attemptState,
          purchasedAt,
        })
        : null;
      const nextAttemptState = isPremiumMode && activeAttemptPricingSnapshot
        ? (
          attemptActionKind !== 'none'
            ? applyPremiumCustomMockAttemptTopUp({
              attemptPricing: activeAttemptPricingSnapshot,
              attemptState: existingCustomTest?.attemptState,
              purchasedAt,
              kind: attemptActionKind,
            })
            : effectiveAttemptUsage?.effectiveState
        )
        : null;
      const nextQuestionGrossAmount = isPremiumMode
        ? Number(((baseQuestionPaidAmount + questionAmountPaid)).toFixed(2))
        : 0;
      const nextAttemptsPaidAmount = isPremiumMode
        ? Number(((baseAttemptPaidAmount + attemptAmountPaid)).toFixed(2))
        : 0;
      const nextTotalAmountPaid = Number((nextQuestionGrossAmount + nextAttemptsPaidAmount).toFixed(2));
      const existingHistory = Array.isArray(existingCustomTest?.paymentHistory)
        ? existingCustomTest.paymentHistory
          .filter((entry) => entry && typeof entry.paymentId === 'string')
          .map((entry) => sanitizePremiumPaymentHistoryEntry({
            paymentId: entry.paymentId,
            orderId: entry.orderId,
            amount: Number(entry.amount || 0),
            paidAt: entry.paidAt || '',
            kind: entry.kind,
            questionAmount: typeof entry.questionAmount === 'number' ? entry.questionAmount : undefined,
            attemptAmount: typeof entry.attemptAmount === 'number' ? entry.attemptAmount : undefined,
            attemptCount: typeof entry.attemptCount === 'number' ? entry.attemptCount : undefined,
          }))
        : [];
      const paymentKind: PremiumCustomMockAttemptPaymentKind =
        questionAmountPaid > 0 && attemptAmountPaid > 0
          ? 'mixed_update'
          : questionAmountPaid > 0
            ? (isEditMode ? 'question_upgrade' : 'question_purchase')
            : attemptActionKind === 'total_recharge'
              ? 'total_recharge'
              : attemptActionKind === 'interval_attempt'
                ? 'interval_attempt'
                : isEditMode
                  ? 'question_upgrade'
                  : 'question_purchase';
      const nextHistory = paymentMeta
        ? [
          ...existingHistory,
          sanitizePremiumPaymentHistoryEntry({
            paymentId: paymentMeta.paymentId,
            orderId: paymentMeta.orderId,
            amount: paymentMeta.amount,
            paidAt: paymentMeta.paidAt,
            kind: paymentKind,
            questionAmount: Number(questionAmountPaid.toFixed(2)),
            attemptAmount: Number(attemptAmountPaid.toFixed(2)),
            attemptCount:
              attemptActionKind === 'total_recharge'
                ? activeAttemptPricingSnapshot?.maxTotalAttempts || undefined
                : attemptActionKind === 'interval_attempt'
                  ? 1
                  : undefined,
          }),
        ]
        : existingHistory;
      const preservedIncludedSubjectConfigs = isOfferBackedPremiumFeaturePurchase
        ? linkedPremiumFeatureIncludedSubjectConfigs
        : [];
      const preservedIncludedQuestionCount = isOfferBackedPremiumFeaturePurchase
        ? Math.max(0, visibleIncludedPremiumQuestionCount)
        : 0;
      const payload: Record<string, any> = {
        studentId: user.uid,
        createdByTeacher: false,
        createdFromTeacherId: effectiveTeacherId || null,
        teacherId: effectiveTeacherId || null,
        teacherName: teacherFullName,
        title: normalizedValues.title,
        accessLevel: targetAccessLevel,
        questionAccessLevel: targetAccessLevel,
        questionSource: linkedPremiumFeaturePurchase?.questionBankSource || 'student_plus_official',
        attemptLimit: isPremiumMode && activeAttemptPricingSnapshot
          ? {
            mode: activeAttemptPricingSnapshot.mode,
            maxTotalAttempts: activeAttemptPricingSnapshot.maxTotalAttempts,
            maxAttemptsPerInterval: activeAttemptPricingSnapshot.maxAttemptsPerInterval,
            intervalValue: activeAttemptPricingSnapshot.intervalValue,
            intervalUnit: activeAttemptPricingSnapshot.intervalUnit,
          }
          : { ...DEFAULT_ATTEMPT_LIMIT },
        examTypeId: normalizedValues.examTypeId,
        examTypeName: selectedExamTypeName || '',
        classId: normalizedValues.classId,
        className: selectedClassName || '',
        examLevel: normalizedValues.examLevel,
        premiumCombinationKey: normalizedPremiumCombinationKey,
        thumbnailUrl,
        imageUrl: thumbnailUrl,
        showLeaderboard: false,
        updatedAt: serverTimestamp(),
        config: {
          questionIds: finalQuestionIds,
          duration: normalizedValues.duration,
          totalQuestions: normalizedTotalRequestedQuestions,
          marksPerQuestion: normalizedValues.marksPerQuestion,
          negativeMarksPerQuestion: normalizedValues.negativeMarksPerQuestion,
          totalMarks: normalizedTotalMarks,
          subjectConfigs: normalizedValues.subjectConfigs.map(({ subjectId, topicId, subtopic, subtopicPaths, questionType, questionSource, previousYears, randomizePerAttempt, count }) => ({
            subjectId,
            topicId: topicId || '',
            subtopic: subtopic || '',
            subtopicPaths: normalizeSubtopicPathSelections(subtopicPaths, subtopic),
            questionType,
            difficultyLevel: QUESTION_DIFFICULTY,
            questionSource: questionSource || 'all',
            previousYearMode: questionSource || 'all',
            previousYears: normalizePreviousYearList(previousYears || []),
            randomizePerAttempt: !!randomizePerAttempt,
            numQuestions: count,
          })),
        },
      };

      if (!isEditMode) {
        payload.createdAt = serverTimestamp();
      }

      if (isPremiumMode) {
        payload.paymentStatus = 'paid';
        payload.purchasedAt = purchasedAt;
        payload.premiumFeaturePurchaseId = linkedPremiumFeaturePurchase?.id || existingCustomTest?.premiumFeaturePurchaseId || null;
        payload.premiumFeaturePurchaseIds = normalizePurchaseIdList(
          linkedPremiumFeaturePurchase?.mergedPurchaseIds
          || existingCustomTest?.premiumFeaturePurchaseIds
          || (linkedPremiumFeaturePurchase?.id ? [linkedPremiumFeaturePurchase.id] : [])
        );
        payload.questionCountByDifficulty = {
          easy: premiumResolvedQuestionCountByDifficulty.Easy,
          medium: premiumResolvedQuestionCountByDifficulty.Medium,
          hard: premiumResolvedQuestionCountByDifficulty.Hard,
        };
        payload.perQuestionPriceByDifficulty = premiumMockTestQuestionPriceByDifficulty;
        payload.amountByDifficulty = premiumMockAmountByDifficulty;
        payload.grossAmount = nextQuestionGrossAmount;
        payload.attemptsPaidAmount = nextAttemptsPaidAmount;
        payload.totalAmountPaid = nextTotalAmountPaid;
        payload.attemptPricing = activeAttemptPricingSnapshot;
        payload.attemptState = nextAttemptState;
        if (isOfferBackedPremiumFeaturePurchase) {
          payload.offerId = String(linkedPremiumFeaturePurchase?.offerId || existingCustomTest?.offerId || '').trim() || null;
          payload.offerPurchaseId = linkedPremiumFeatureOfferPurchaseId || null;
          payload.includedQuestionCount = preservedIncludedQuestionCount;
          payload.includedQuestionIds = includedPremiumQuestionIds;
          payload.includedQuestionCountByDifficulty = {
            easy: includedPremiumQuestionCountByDifficulty.Easy,
            medium: includedPremiumQuestionCountByDifficulty.Medium,
            hard: includedPremiumQuestionCountByDifficulty.Hard,
          };
          payload.includedSubjectConfigs = preservedIncludedSubjectConfigs;
        }
        if (paymentMeta) {
          payload.payment = {
            paymentId: paymentMeta.paymentId,
            amount: paymentMeta.amount,
            currency: 'INR',
            paidAt: paymentMeta.paidAt,
            ...(paymentMeta.orderId ? { orderId: paymentMeta.orderId } : {}),
          };
          payload.lastPaymentId = paymentMeta.paymentId;
          payload.paymentHistory = nextHistory;
        }
      }

      if (isEditMode && editTestId) {
        await updateDocumentNonBlocking(doc(firestore, 'users', user.uid, 'custom_tests', editTestId), payload);
      } else {
        const createdDoc = await addDocumentNonBlocking(customTestsRef, payload);
        if (createdDoc?.id) {
          savedCustomTestId = createdDoc.id;
        }
      }

      if (linkedPremiumFeaturePurchase?.id && !isMergedAdminAssignedPremiumFeaturePurchase) {
        const preservedPurchaseAmount = Number(
          (
            linkedPremiumFeaturePurchase.amount
            ?? linkedPremiumFeaturePurchase.questionAmountPaid
            ?? 0
          ) || 0
        );
        const preservedPurchaseQuestionAmount = Number(
          (
            linkedPremiumFeaturePurchase.questionAmountPaid
            ?? linkedPremiumFeaturePurchase.amount
            ?? 0
          ) || 0
        );
        const preservedPurchaseAttemptAmount = Number(linkedPremiumFeaturePurchase.attemptAmountPaid || 0);
        await setDocumentNonBlocking(
          doc(firestore, 'users', user.uid, 'premium_mock_feature_purchases', linkedPremiumFeaturePurchase.id),
          {
            id: linkedPremiumFeaturePurchase.id,
            teacherId: effectiveTeacherId || linkedPremiumFeaturePurchase.teacherId || '',
            teacherName: teacherFullName,
            examTypeId: normalizedValues.examTypeId,
            examTypeName: selectedExamTypeName || '',
            classId: normalizedValues.classId,
            className: selectedClassName || '',
            premiumCombinationKey: normalizedPremiumCombinationKey,
            premiumCustomMockTestId: isOfferBackedPremiumFeaturePurchase ? '' : (savedCustomTestId || ''),
            testTitle: isOfferBackedPremiumFeaturePurchase
              ? (String(linkedPremiumFeaturePurchase.testTitle || '').trim() || normalizedValues.title)
              : normalizedValues.title,
            amount: isOfferBackedPremiumFeaturePurchase ? preservedPurchaseAmount : nextTotalAmountPaid,
            questionCount: isOfferBackedPremiumFeaturePurchase ? linkedPremiumFeaturePurchasedQuestionCount : finalQuestionIds.length,
            questionAmountPaid: isOfferBackedPremiumFeaturePurchase ? preservedPurchaseQuestionAmount : nextQuestionGrossAmount,
            attemptAmountPaid: isOfferBackedPremiumFeaturePurchase ? preservedPurchaseAttemptAmount : nextAttemptsPaidAmount,
            currency: linkedPremiumFeaturePurchase.currency || 'INR',
            paidAt: linkedPremiumFeaturePurchase.paidAt || purchasedAt,
            updatedAt: serverTimestamp(),
            status: 'paid',
            ...(paymentMeta ? { serverVerifiedPaymentId: paymentMeta.paymentId } : {}),
            ...(isOfferBackedPremiumFeaturePurchase
              ? {
                  offerId: String(linkedPremiumFeaturePurchase.offerId || '').trim() || null,
                  offerPurchaseId: linkedPremiumFeatureOfferPurchaseId || null,
                  includedQuestionCount: Math.max(
                    linkedPremiumFeaturePurchasedQuestionCount,
                    linkedPremiumFeatureReusableQuestionIds.length
                  ),
                  includedQuestionIds: linkedPremiumFeatureReusableQuestionIds,
                  includedQuestionCountByDifficulty:
                    linkedPremiumFeatureIncludedQuestionCountByDifficulty
                    || derivedIncludedPremiumQuestionCountByDifficulty,
                  includedSubjectConfigs: preservedIncludedSubjectConfigs,
                }
              : {}),
          },
          { merge: true }
        );
      }

      if (paymentMeta) {
        await setDocumentNonBlocking(
          doc(firestore, 'payments', paymentMeta.paymentId),
          {
            id: paymentMeta.paymentId,
            type: 'premium_custom_mock_test',
            status: 'paid',
            userId: user.uid,
            userEmail: user.email || '',
            teacherId: effectiveTeacherId || '',
            linkedContentType: 'premium_custom_mock_test',
            linkedContentId: savedCustomTestId || normalizedPremiumCombinationKey,
            examTypeId: normalizedValues.examTypeId,
            classId: normalizedValues.classId,
            premiumCombinationKey: normalizedPremiumCombinationKey,
            testTitle: normalizedValues.title,
            grossAmount: paymentMeta.amount,
            currency: 'INR',
            razorpayOrderId: paymentMeta.orderId,
            razorpayPaymentId: paymentMeta.paymentId,
            premiumCustomMockTestId: savedCustomTestId || '',
            questionCount: finalQuestionIds.length,
            questionCountByDifficulty: {
              easy: premiumResolvedQuestionCountByDifficulty.Easy,
              medium: premiumResolvedQuestionCountByDifficulty.Medium,
              hard: premiumResolvedQuestionCountByDifficulty.Hard,
            },
            perQuestionPriceByDifficulty: premiumMockTestQuestionPriceByDifficulty,
            amountByDifficulty: premiumMockAmountByDifficulty,
            questionAmountPaid: Number(questionAmountPaid.toFixed(2)),
            attemptAmountPaid: Number(attemptAmountPaid.toFixed(2)),
            premiumCustomMockAttemptActionKind: attemptActionKind,
            previousGrossAmount: isEditMode ? existingPremiumQuestionAmount : 0,
            previousAttemptsPaidAmount: isEditMode ? existingPremiumAttemptsPaidAmount : 0,
            purchasedAt: paymentMeta.paidAt,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );

        const idToken = await user.getIdToken(true);
        const splitResult = await finalizePaymentRevenueSplit({
          idToken,
          paymentId: paymentMeta.paymentId,
          teacherId: effectiveTeacherId || null,
          linkedContentType: 'premium_custom_mock_test',
          linkedContentId: savedCustomTestId || normalizedPremiumCombinationKey,
          saleType: 'premium_custom_mock_test',
          grossAmount: paymentMeta.amount,
          currency: 'INR',
          purchasedAt: paymentMeta.paidAt,
          userEmail: user.email || '',
          studentName: user.displayName || '',
          studentEmail: user.email || '',
          metadata: {
            examTypeId: normalizedValues.examTypeId,
            classId: normalizedValues.classId,
            premiumCombinationKey: normalizedPremiumCombinationKey,
            testTitle: normalizedValues.title,
            sourcePaymentId: paymentMeta.paymentId,
            premiumCustomMockTestId: savedCustomTestId || '',
            previousGrossAmount: isEditMode ? existingPremiumQuestionAmount : 0,
            previousAttemptsPaidAmount: isEditMode ? existingPremiumAttemptsPaidAmount : 0,
            questionAmountPaid: Number(questionAmountPaid.toFixed(2)),
            attemptAmountPaid: Number(attemptAmountPaid.toFixed(2)),
            premiumCustomMockAttemptActionKind: attemptActionKind,
            updatedQuestionPaidAmount: nextQuestionGrossAmount,
            updatedAttemptsPaidAmount: nextAttemptsPaidAmount,
            updatedTotalPaidAmount: nextTotalAmountPaid,
            questionCount: finalQuestionIds.length,
            questionCountByDifficulty: {
              easy: premiumResolvedQuestionCountByDifficulty.Easy,
              medium: premiumResolvedQuestionCountByDifficulty.Medium,
              hard: premiumResolvedQuestionCountByDifficulty.Hard,
            },
            perQuestionPriceByDifficulty: premiumMockTestQuestionPriceByDifficulty,
            amountByDifficulty: premiumMockAmountByDifficulty,
          },
        });
        if (!splitResult.success) {
          throw new Error(splitResult.error || 'Could not credit revenue split.');
        }

        if (!linkedPremiumFeaturePurchase?.id) {
          await setDocumentNonBlocking(
            doc(firestore, 'users', user.uid, 'premium_mock_feature_purchases', paymentMeta.paymentId),
            {
              id: paymentMeta.paymentId,
              teacherId: effectiveTeacherId || '',
              examTypeId: normalizedValues.examTypeId,
              classId: normalizedValues.classId,
              amount: paymentMeta.amount,
              currency: 'INR',
              status: 'paid',
              testTitle: normalizedValues.title,
              premiumCombinationKey: normalizedPremiumCombinationKey,
              premiumCustomMockTestId: savedCustomTestId || '',
              questionAmountPaid: Number(questionAmountPaid.toFixed(2)),
              attemptAmountPaid: Number(attemptAmountPaid.toFixed(2)),
              premiumCustomMockAttemptActionKind: attemptActionKind,
              paidAt: paymentMeta.paidAt,
              createdAt: serverTimestamp(),
              serverVerifiedPaymentId: paymentMeta.paymentId,
            },
            { merge: true }
          );
        }
      }

      if (!isTeacher && ((!isEditMode && !!savedCustomTestId) || !!paymentMeta)) {
        await sendSelfBellNotification(user, {
          title: paymentMeta
            ? (isEditMode
              ? 'Congratulations on upgrading your premium custom mock'
              : 'Congratulations on unlocking your premium custom mock')
            : 'Congratulations on creating your custom mock',
          message: paymentMeta
            ? `${normalizedValues.title} is now ready in My Practice.`
            : `${normalizedValues.title} has been added to My Practice.`,
          href: '/my-practice',
          notificationType: paymentMeta ? 'premium_custom_mock_purchased' : 'custom_mock_created',
          dedupeKey: paymentMeta
            ? `premium-custom-mock:${paymentMeta.paymentId}`
            : `custom-mock:${savedCustomTestId}`,
          contentType: paymentMeta ? 'premium_custom_mock_test' : 'custom_mock_test',
          contentId: savedCustomTestId || normalizedPremiumCombinationKey || undefined,
          teacherId: effectiveTeacherId || undefined,
          accessLevel: targetAccessLevel || undefined,
          metadata: {
            customMockTestId: savedCustomTestId || null,
            paymentId: paymentMeta?.paymentId || null,
          },
        });
      }

      return savedCustomTestId;
    };

    try {
      if (isPremiumMode) {
        if (!Number.isFinite(payableNow) || payableNow < 0) {
          queuedRecoveryPaymentRef.current = null;
          setRecoveringPaymentId('');
          toast({
            variant: 'destructive',
            title: 'Invalid payable amount',
            description: 'Premium payable amount is invalid.',
          });
          setIsSubmitting(false);
          return;
        }

        if (!isEditMode && payableNow <= 0 && !linkedPremiumFeaturePurchase) {
          queuedRecoveryPaymentRef.current = null;
          setRecoveringPaymentId('');
          toast({
            variant: 'destructive',
            title: 'Invalid payable amount',
            description: 'Premium amount must be greater than zero.',
          });
          setIsSubmitting(false);
          return;
        }

        if (!isEditMode && linkedPremiumFeaturePurchase && payableNow <= 0) {
          await persistCustomTest({
            questionAmountPaid: 0,
            attemptAmountPaid: 0,
            attemptActionKind: 'none',
          });
          queuedRecoveryPaymentRef.current = null;
          setRecoveringPaymentId('');
          toast({
            title: 'Premium Mock Test Created',
            description: `${normalizedValues.title} was created from your included teacher-offer access without extra charge.`,
          });
          router.push('/my-practice');
          return;
        }

        if (isEditMode && payableNow <= 0) {
          await persistCustomTest({
            questionAmountPaid: 0,
            attemptAmountPaid: 0,
            attemptActionKind: premiumMockAttemptActionKind,
          });
          queuedRecoveryPaymentRef.current = null;
          setRecoveringPaymentId('');
          toast({
            title: 'Premium mock updated',
            description: premiumMockAttemptActionKind === 'none'
              ? `${normalizedValues.title} saved with the same purchased questions and attempts preserved.`
              : 'Attempts refreshed and premium mock updated without extra charge.',
          });
          router.push('/my-practice');
          return;
        }

        if (isRecoveryFlow && recoveryPayment) {
          const recoveredQuestionAmount = Number((
            recoveryPayment.questionAmountPaid > 0
              ? recoveryPayment.questionAmountPaid
              : Math.max(0, recoveryPayment.amount - recoveryPayment.attemptAmountPaid)
          ).toFixed(2));
          const recoveredAttemptAmount = Number((recoveryPayment.attemptAmountPaid || 0).toFixed(2));
          const recoveredTotalAmount = Number((recoveredQuestionAmount + recoveredAttemptAmount).toFixed(2));

          if (Math.abs(recoveredTotalAmount - payableNow) > 0.01) {
            queuedRecoveryPaymentRef.current = null;
            setRecoveringPaymentId('');
            toast({
              variant: 'destructive',
              title: 'Recovery amount mismatch',
              description: 'The current premium mock configuration does not match the successful payment. Keep the same scope and question count, then try recovery again.',
            });
            setIsSubmitting(false);
            return;
          }

          try {
            await persistCustomTest({
              paymentMeta: {
                paymentId: recoveryPayment.paymentId,
                orderId: recoveryPayment.orderId,
                amount: recoveryPayment.amount,
                paidAt: recoveryPayment.paidAt,
              },
              questionAmountPaid: recoveredQuestionAmount,
              attemptAmountPaid: recoveredAttemptAmount,
              attemptActionKind: recoveryPayment.attemptActionKind || premiumMockAttemptActionKind,
            });
            setRecoverablePremiumPayments((current) =>
              current.filter((payment) => payment.paymentId !== recoveryPayment.paymentId)
            );
            toast({
              title: 'Premium payment recovered',
              description: `${normalizedValues.title} was restored from the earlier successful payment.`,
            });
          } catch (error: any) {
            toast({
              variant: 'destructive',
              title: 'Recovery failed',
              description: error?.message || 'The paid premium mock could not be restored yet.',
            });
          } finally {
            queuedRecoveryPaymentRef.current = null;
            setRecoveringPaymentId('');
            setIsSubmitting(false);
          }
          return;
        }

        if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
          queuedRecoveryPaymentRef.current = null;
          setRecoveringPaymentId('');
          toast({
            variant: 'destructive',
            title: 'Razorpay not configured',
            description: 'Missing NEXT_PUBLIC_RAZORPAY_KEY_ID in environment.',
          });
          setIsSubmitting(false);
          return;
        }

        if (typeof window === 'undefined' || !window.Razorpay) {
          queuedRecoveryPaymentRef.current = null;
          setRecoveringPaymentId('');
          toast({
            variant: 'destructive',
            title: 'Payment SDK unavailable',
            description: 'Razorpay SDK is not loaded. Refresh and try again.',
          });
          setIsSubmitting(false);
          return;
        }

        const orderResult = await createRazorpayOrder(payableNow);
        if (orderResult.error || !orderResult.orderId) {
          queuedRecoveryPaymentRef.current = null;
          setRecoveringPaymentId('');
          toast({
            variant: 'destructive',
            title: 'Payment initialization failed',
            description: orderResult.error || 'Could not create payment order.',
          });
          setIsSubmitting(false);
          return;
        }

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: Math.round(payableNow * 100),
          currency: 'INR',
          name: 'DCAM Classes',
          description: isEditMode
            ? (
              attemptAmountPayableNow > 0 && questionAmountPayableNow > 0
                ? `Premium custom mock upgrade + attempt recharge: ${normalizedValues.title}`
                : attemptAmountPayableNow > 0
                  ? `Premium custom mock attempt recharge: ${normalizedValues.title}`
                  : `Premium custom mock question upgrade: ${normalizedValues.title}`
            )
            : `Premium Mock Test: ${normalizedValues.title}`,
          order_id: orderResult.orderId,
          handler: async (response: any) => {
            const verificationResult = await verifyRazorpayPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            if (!verificationResult.verified) {
              queuedRecoveryPaymentRef.current = null;
              setRecoveringPaymentId('');
              toast({
                variant: 'destructive',
                title: 'Payment verification failed',
                description: verificationResult.error || 'Could not verify payment.',
              });
              setIsSubmitting(false);
              return;
            }

            try {
              const paymentId = String(response.razorpay_payment_id || '').trim();
              const razorpayOrderId = String(response.razorpay_order_id || '').trim();
              const razorpaySignature = String(response.razorpay_signature || '').trim();
              if (!paymentId || !razorpayOrderId || !razorpaySignature) {
                throw new Error('Payment response is missing verification details.');
              }
              const idToken = await user.getIdToken(true);
              const verifiedPaymentResult = await completeVerifiedPayment({
                idToken,
                orderId: razorpayOrderId,
                paymentId,
                signature: razorpaySignature,
                grossAmount: payableNow,
                currency: 'INR',
                paymentData: {
                  id: paymentId,
                  type: 'premium_custom_mock_test',
                  status: 'paid',
                  userId: user.uid,
                  userEmail: user.email || '',
                  teacherId: effectiveTeacherId || '',
                  linkedContentType: 'premium_custom_mock_test',
                  linkedContentId: normalizedPremiumCombinationKey,
                  examTypeId: normalizedValues.examTypeId,
                  classId: normalizedValues.classId,
                  premiumCombinationKey: normalizedPremiumCombinationKey,
                  testTitle: normalizedValues.title,
                  grossAmount: payableNow,
                  currency: 'INR',
                  razorpayOrderId,
                  razorpayPaymentId: paymentId,
                  purchasedAt: new Date().toISOString(),
                },
              });
              if (!verifiedPaymentResult.success) {
                throw new Error(verifiedPaymentResult.error || 'Could not record the verified payment.');
              }

              await persistCustomTest({
                paymentMeta: {
                  paymentId,
                  orderId: razorpayOrderId,
                  amount: payableNow,
                  paidAt: new Date().toISOString(),
                },
                questionAmountPaid: questionAmountPayableNow,
                attemptAmountPaid: attemptAmountPayableNow,
                attemptActionKind: premiumMockAttemptActionKind,
              });
              toast({
                title: isEditMode ? 'Premium Mock Test Updated' : 'Premium Mock Test Created',
                description: isEditMode
                  ? `${normalizedValues.title} saved after payment of INR ${payableNow.toLocaleString()}.`
                  : `${normalizedValues.title} created after payment of INR ${payableNow.toLocaleString()}. Open My Practice to attempt.`,
              });
              router.push('/my-practice');
            } catch (error: any) {
              queuedRecoveryPaymentRef.current = null;
              setRecoveringPaymentId('');
              toast({
                variant: 'destructive',
                title: 'Save failed after payment',
                description: error?.message || 'Payment succeeded, but saving test failed. Contact support.',
              });
            } finally {
              queuedRecoveryPaymentRef.current = null;
              setRecoveringPaymentId('');
              setIsSubmitting(false);
            }
          },
          prefill: {
            name: user.displayName || 'DCAM Student',
            email: user.email || '',
            contact: user.phoneNumber || '',
          },
          notes: {
            source: 'premium_custom_mock_test',
            userId: user.uid,
            teacherId: effectiveTeacherId || '',
            examTypeId: normalizedValues.examTypeId,
            classId: normalizedValues.classId,
            customMockTestId: editTestId || '',
            questionAmountPayable: String(questionAmountPayableNow),
            attemptAmountPayable: String(attemptAmountPayableNow),
            premiumCustomMockAttemptActionKind: premiumMockAttemptActionKind,
          },
          theme: {
            color: '#0ea5e9',
          },
          modal: {
            ondismiss: () => {
              queuedRecoveryPaymentRef.current = null;
              setRecoveringPaymentId('');
              setIsSubmitting(false);
            },
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.on('payment.failed', (response: any) => {
          queuedRecoveryPaymentRef.current = null;
          setRecoveringPaymentId('');
          toast({
            variant: 'destructive',
            title: 'Payment failed',
            description: response?.error?.description || 'Payment was not completed.',
          });
          setIsSubmitting(false);
        });
        razorpay.open();
        return;
      }

      await persistCustomTest();

      toast({
        title: isEditMode ? 'Mock Test Updated' : 'Mock Test Created',
        description: isEditMode
          ? `${normalizedValues.title} updated with ${normalizedTotalRequestedQuestions} questions and ${normalizedTotalMarks} total marks.`
          : `${normalizedValues.title} saved with ${normalizedTotalRequestedQuestions} questions and ${normalizedTotalMarks} total marks. Open My Practice to attempt.`,
      });
      router.push('/my-practice');
    } catch (error: any) {
      queuedRecoveryPaymentRef.current = null;
      setRecoveringPaymentId('');
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: error?.message || 'An unexpected error occurred.',
      });
    } finally {
      if (!isPremiumMode) {
        queuedRecoveryPaymentRef.current = null;
        setRecoveringPaymentId('');
      }
      if (!isPremiumMode) {
        setIsSubmitting(false);
      }
    }
  }

  const isLoading =
    areClassesLoading ||
    areSubjectsLoading ||
    areExamTypesLoading ||
    (isPremiumMode && isTeacherProfileLoading) ||
    isPremiumFeaturePurchaseLoading ||
    isPremiumFeaturePurchaseByTestLoading ||
    isPremiumFeaturePurchasesByTeacherLoading ||
    (isEditMode && isExistingCustomTestLoading);
  const isPremiumCreateFlow = isPremiumMode && !isEditMode;
  const isSubmitDisabled =
    isSubmitting
    || !!countExceedingBankConfig
    || (isPremiumMode && effectivePremiumMissingPriceForSelection)
    || (isPremiumCreateFlow && !linkedPremiumFeaturePurchase && premiumMockTotalAmount <= 0)
    || (isPremiumMode && cannotReducePremiumQuestionCount)
    || (isPremiumMode && premiumPreservedQuestionMismatchCount > 0)
    || (isPremiumMode && premiumEditStructureConflict)
    || (isPremiumMode && premiumQuestionSelectionShortfall > 0)
    || (isPremiumMode && premiumMockAttemptBlocked);
  const sectionCardClass = 'space-y-4 rounded-2xl border border-border/70 bg-gradient-to-b from-slate-900/80 to-slate-950/65 p-4 md:p-5';
  const createButtonClass = isPremiumCreateFlow
    ? (
      linkedPremiumFeaturePurchase && totalPremiumPayableNow <= 0
        ? 'h-11 rounded-full border border-emerald-300/35 bg-gradient-to-r from-emerald-200 via-teal-200 to-cyan-200 px-6 font-semibold text-slate-950 shadow-[0_14px_30px_-16px_rgba(16,185,129,0.85)] transition-all hover:from-emerald-100 hover:via-teal-100 hover:to-cyan-100'
        : 'h-11 rounded-full border border-amber-300/35 bg-gradient-to-r from-amber-200 via-orange-300 to-yellow-300 px-6 font-semibold text-slate-950 shadow-[0_14px_30px_-16px_rgba(251,191,36,0.9)] transition-all hover:from-amber-100 hover:via-orange-200 hover:to-yellow-200'
    )
    : 'h-11 rounded-full border border-cyan-300/35 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-6 font-semibold text-slate-950 shadow-[0_12px_26px_-14px_rgba(56,189,248,0.9)] transition-all hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400';
  const teacherCardPrimaryButtonClass =
    'h-9 rounded-full border border-cyan-300/35 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-3.5 text-sm font-semibold text-slate-950 shadow-[0_10px_24px_-12px_rgba(56,189,248,0.8)] transition-all hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400';
  const teacherCardSecondaryButtonClass =
    'h-9 rounded-full border border-slate-600/80 bg-slate-900/70 px-3.5 text-sm font-semibold text-slate-100 transition-all hover:border-cyan-300/45 hover:bg-cyan-500/10 hover:text-cyan-100';
  const handleRecoverPaidPremiumMock = async (payment: RecoverablePremiumCustomMockPayment) => {
    if (isSubmitting) return;
    const isValid = await form.trigger();
    if (!isValid) return;
    queuedRecoveryPaymentRef.current = payment;
    setRecoveringPaymentId(payment.paymentId);
    await form.handleSubmit(onSubmit)();
  };

  if (shouldRedirectToSetup) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Custom Mock Test" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="shadow-lg">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Redirecting to custom mock setup...
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const handleDeleteMockTest = async () => {
    if (!isEditMode || !editTestId || !firestore || !user?.uid) return;
    const confirmed = window.confirm('Permanently delete this self-created mock test? This cannot be undone.');
    if (!confirmed) return;
    try {
      await deleteDocumentNonBlocking(doc(firestore, 'users', user.uid, 'custom_tests', editTestId));
      router.push('/my-practice');
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete this mock test.' });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <DashboardHeader title={isEditMode ? (isPremiumMode ? 'Edit Premium Self Created Mock Test' : 'Edit Self Created Mock Test') : (isPremiumMode ? 'Create Premium Mock Test' : 'Create Your Own Mock Test')} />
      <main className="relative flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_36%),radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_30%)] p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Card className="overflow-hidden border border-cyan-400/25 bg-gradient-to-b from-slate-900/95 via-slate-900/88 to-slate-950/78 shadow-[0_20px_50px_-25px_rgba(14,165,233,0.55)]">
            <CardHeader className="border-b border-border/60 bg-gradient-to-r from-cyan-950/35 via-blue-950/20 to-transparent">
              <p className="inline-flex w-fit rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-100">
                {isPremiumMode ? 'Premium Mock Builder' : 'Free Mock Builder'}
              </p>
              <CardTitle className="font-headline text-2xl">Mock Test Builder</CardTitle>
              <CardDescription>
                Select exam and curriculum first, then build your test sections from the {DCAM_QUESTION_BANK_LABEL}&apos;s {targetAccessLevel} question bank.
              </CardDescription>
              {sourceTeacherId ? (
                <p className="text-sm text-muted-foreground">
                  Building from the {DCAM_QUESTION_BANK_LABEL}.
                </p>
              ) : null}
                {isPremiumMode && effectivePremiumMissingPriceForSelection ? (
                <p className="text-sm text-amber-200">
                  Premium pricing is missing for one or more selected question groups for this DCAM question bank setup.
                </p>
              ) : null}
              {countExceedingBankConfig ? (
                <p className="text-sm text-amber-200">
                  Requested questions in one or more sections are greater than Bank Count. Reduce question count to continue.
                </p>
              ) : null}
              {isPremiumMode && isEditMode ? (
                <p className="text-sm text-cyan-100/85">
                  This premium mock keeps the same purchased questions on every re-attempt. You can only add more questions on edit; already purchased questions stay locked in place.
                </p>
              ) : null}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4 py-2">
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/8 p-4">
                    <div className="flex items-center gap-3 text-cyan-100">
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                      <p className="text-base font-semibold">
                        {isPremiumMode ? 'Loading paid custom mock builder...' : 'Loading free custom mock builder...'}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {isPremiumMode
                        ? `Counting paid questions from the ${DCAM_QUESTION_BANK_LABEL} and setting up your premium test canvas.`
                        : `Opening the ${DCAM_QUESTION_BANK_LABEL} and arranging your free test builder.`}
                    </p>
                    <p className="mt-1 text-xs text-cyan-100/80">
                      Sharp questions are stretching before they enter your mock.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                  <Skeleton className="h-72 w-full" />
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((values) => onSubmit(values))} className="space-y-8">
                    {isPremiumMode && isOfferBackedPremiumFeaturePurchase && linkedPremiumFeaturePurchase && linkedPremiumFeaturePurchasedQuestionCount > 0 ? (
                      <div className="rounded-2xl border border-emerald-300/25 bg-gradient-to-r from-emerald-500/10 via-slate-900/55 to-cyan-500/10 p-4 md:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <p className="inline-flex w-fit rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100">
                              Purchased Premium Coverage
                            </p>
                            <div>
                              <h3 className="text-lg font-semibold">Use your purchased mock questions first</h3>
                              <p className="text-sm text-muted-foreground">
                                {linkedPremiumFeaturePurchaseMatchesCurrentScope
                                  ? 'Bank Count below still shows the full question bank. Your purchased question set stays reusable in every premium mock for this scope, and only questions outside that purchased set are charged.'
                                  : `You still have a purchased reusable question set for ${linkedPremiumFeatureScopeExamTypeName || 'the purchased exam'} / ${linkedPremiumFeatureScopeClassName || 'the purchased curriculum'}. Bank Count still shows the full bank below; switch back to that exam and curriculum to use this purchased set here.`}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                            <div className="rounded-xl border border-emerald-300/25 bg-slate-950/55 p-3">
                              <p className="text-[11px] uppercase tracking-wide text-emerald-100/80">Reusable Every Mock</p>
                              <p className="mt-1 text-2xl font-semibold">{linkedPremiumFeatureReusableQuestionCount}</p>
                            </div>
                            <div className="rounded-xl border border-amber-300/25 bg-slate-950/55 p-3">
                              <p className="text-[11px] uppercase tracking-wide text-amber-100/80">Created Mocks</p>
                              <p className="mt-1 text-2xl font-semibold">{linkedPremiumFeatureLinkedMockCount}</p>
                            </div>
                            <div className="rounded-xl border border-cyan-300/25 bg-slate-950/55 p-3">
                              <p className="text-[11px] uppercase tracking-wide text-cyan-100/80">Selected now</p>
                              <p className="mt-1 text-2xl font-semibold text-emerald-100">{totalRequestedQuestions}</p>
                            </div>
                          </div>
                        </div>
                        {linkedPremiumFeatureScopeSummary.length > 0 ? (
                          <div className="mt-4 space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100/85">
                              Included Scope
                            </p>
                            <div className="grid gap-2 md:grid-cols-2">
                              {linkedPremiumFeatureScopeSummary.map((scope) => (
                                <div key={scope.label} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-slate-950/45 px-3 py-2 text-sm">
                                  <p className="min-w-0 flex-1 text-slate-200">{scope.label}</p>
                                  <span className="shrink-0 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
                                    {scope.count} Qs
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {linkedPremiumFeatureLinkedMockCount > 0 ? (
                          <p className="mt-3 text-xs text-amber-100/85">
                            The same purchased question set can be reused across all {linkedPremiumFeatureLinkedMockCount} active premium mock{linkedPremiumFeatureLinkedMockCount === 1 ? '' : 's'} linked to this access.
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className={sectionCardClass}>
                      <h3 className="text-lg font-semibold">Step 1: Test Details</h3>
                      <FormField control={form.control} name="title" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Test Title</FormLabel>
                          <FormControl><Input placeholder="e.g., Weekly PCM Mock - Class 12" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormItem>
                        <FormLabel>Thumbnail (JPEG only)</FormLabel>
                        <FormControl>
                          <Input type="file" accept=".jpg,.jpeg,image/jpeg" onChange={(e) => handleThumbnailChange(e.target.files?.[0])} />
                        </FormControl>
                        <FormDescription>Optional. Upload `.jpg` or `.jpeg` only (max 5MB).</FormDescription>
                      </FormItem>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name="duration" render={({ field }) => (
                          <FormItem><FormLabel>Total Time (minutes)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="marksPerQuestion" render={({ field }) => (
                          <FormItem><FormLabel>Marks per Question</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="negativeMarksPerQuestion" render={({ field }) => (
                          <FormItem><FormLabel>Negative Marking / Question</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                    </div>

                    <div className={sectionCardClass}>
                      <h3 className="text-lg font-semibold">Step 2: Exam, Curriculum, and Filters</h3>
                      <FormDescription>
                        {isPremiumMode
                          ? (isEditMode
                            ? 'Paid custom mock edits keep the same exam, curriculum, and purchased question set. Adjust the blueprint only to add more questions.'
                            : `Select your exam and curriculum first, then configure premium sections from the paid ${DCAM_QUESTION_BANK_LABEL}.`)
                          : `Choose your exam, curriculum, and subjects from the ${DCAM_QUESTION_BANK_LABEL}. You can adjust everything here before building the test.`}
                      </FormDescription>
                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
                        <FormField control={form.control} name="examTypeId" render={({ field }) => (
                          <FormItem><FormLabel>Exam</FormLabel><Select onValueChange={field.onChange} value={field.value || ''} disabled={isPremiumMode && isEditMode}><FormControl><SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger></FormControl><SelectContent>{examOptions.map((et) => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="classId" render={({ field }) => (
                          <FormItem><FormLabel>Curriculum/Class</FormLabel><Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedExamType || (isPremiumMode && isEditMode)}><FormControl><SelectTrigger><SelectValue placeholder="Select curriculum/class" /></SelectTrigger></FormControl><SelectContent>{classOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="examLevel" render={({ field }) => (
                          <FormItem><FormLabel>Exam Difficulty Level</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="weak">Weak</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="strong">Strong</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                        )} />
                      </div>
                    </div>

                    <div className={sectionCardClass}>
                      <h3 className="text-lg font-semibold">Step 3: Section-Wise Question Distribution</h3>
                      <FormDescription>
                        Add one or more sections. For each section choose subject, source (All/PYQ), topic, optional nested subtopic branches, question type and question count.
                      </FormDescription>
                      <div className="space-y-3">
                        {fields.map((field, index) => {
                          const allConfigs = watch('subjectConfigs') || [];
                          const includedOfferCoverageForSection = offerIncludedCoverageBySection[index] || 0;
                          const isOfferCoveredSection = includedOfferCoverageForSection > 0;
                          const currentSubjectId = watch(`subjectConfigs.${index}.subjectId`);
                          const includedOfferQuestionCountForSubject = currentSubjectId
                            ? (includedOfferQuestionCountBySubjectId[currentSubjectId] || 0)
                            : 0;
                          const showOfferBalanceForSection = includedOfferQuestionCountForSubject > 0;
                          const currentTopicId = watch(`subjectConfigs.${index}.topicId`) || '';
                          const currentSubtopicId = watch(`subjectConfigs.${index}.subtopic`) || '';
                          const currentSubtopicPaths = normalizeSubtopicPathSelections(
                            (watch(`subjectConfigs.${index}.subtopicPaths`) || []) as string[],
                            currentSubtopicId
                          );
                          const currentQuestionType = watch(`subjectConfigs.${index}.questionType`) || 'All';
                          const currentDifficultyLevel = watch(`subjectConfigs.${index}.difficultyLevel`) || defaultDifficultyLevel;
                          const currentQuestionSource = normalizeQuestionSource(watch(`subjectConfigs.${index}.questionSource`) || 'all');
                          const currentPreviousYears = normalizePreviousYearList(watch(`subjectConfigs.${index}.previousYears`) || []);
                          const topicOptions = (topics || []).filter((t) => t.subjectId === currentSubjectId);
                          const subtopicPathPool = getSubtopicPathPoolForConfig(
                            currentSubjectId,
                            currentTopicId,
                            currentQuestionType,
                            currentDifficultyLevel,
                            currentQuestionSource,
                            currentPreviousYears,
                            offerConsumedQuestionIdsToExclude
                          );
                          const draftSubtopicPath = subtopicDraftPathBySection[field.id] || [];
                          const levelOptionSets: string[][] = [];
                          let traversalParent: string[] = [];
                          while (true) {
                            const levelOptions = getChildSubtopicOptions(subtopicPathPool, traversalParent);
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
                          const availablePyqYears = getAvailablePyqYearsForConfig(
                            currentSubjectId,
                            currentTopicId,
                            currentSubtopicPaths,
                            currentSubtopicId,
                            currentQuestionType,
                            currentDifficultyLevel,
                            offerConsumedQuestionIdsToExclude
                          );
                          const availableCount = getAvailableCountForConfig(
                            currentSubjectId,
                            currentTopicId,
                            currentSubtopicPaths,
                            currentSubtopicId,
                            currentQuestionType,
                            currentDifficultyLevel,
                            currentQuestionSource,
                            currentPreviousYears,
                            offerConsumedQuestionIdsToExclude
                          );
                          const hasDuplicateCombination = (
                            subjectId: string,
                            topicId: string,
                            subtopicPaths: string[],
                            questionType: 'All' | 'MCQ' | 'Numerical' | 'Text',
                            difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard',
                            questionSource: 'all' | 'pyq',
                            previousYears: string[]
                          ) => {
                            const candidateKey = `${subjectId}__${topicId || ''}__${getSubtopicSelectionKey(subtopicPaths)}__${questionType}__${difficultyLevel}__${questionSource}__${getPreviousYearKey(previousYears)}`;
                            return allConfigs.some((cfg, i) => {
                              if (i === index) return false;
                              const key = `${cfg.subjectId}__${cfg.topicId || ''}__${getSubtopicSelectionKey(cfg.subtopicPaths, cfg.subtopic)}__${cfg.questionType}__${cfg.difficultyLevel}__${cfg.questionSource || 'all'}__${getPreviousYearKey(cfg.previousYears || [])}`;
                              return key === candidateKey;
                            });
                          };
                          const applySubtopicPathSelection = (draftPath: string[]) => {
                            if (!currentSubjectId) return;
                            const normalizedPath = normalizeSubtopicPathSegments(draftPath);
                            const nextPaths = normalizedPath.length > 0
                              ? normalizeSubtopicPathSelections([
                                  ...currentSubtopicPaths.filter((path) => {
                                    const existingPath = parseSubtopicPathSelection(path);
                                    return !subtopicPathStartsWith(existingPath, normalizedPath)
                                      && !subtopicPathStartsWith(normalizedPath, existingPath);
                                  }),
                                  serializeSubtopicPathSelection(normalizedPath),
                                ])
                              : [];
                            if (hasDuplicateCombination(
                              currentSubjectId,
                              currentTopicId,
                              nextPaths,
                              currentQuestionType,
                              currentDifficultyLevel,
                              currentQuestionSource,
                              currentPreviousYears
                            )) {
                              toast({
                                variant: 'destructive',
                                title: 'Duplicate section',
                                description: 'This section already exists with the same filters.',
                              });
                              return;
                            }
                            const firstPath = parseSubtopicPathSelection(nextPaths[0] || '');
                            setValue(`subjectConfigs.${index}.subtopicPaths`, nextPaths);
                            setValue(`subjectConfigs.${index}.subtopic`, firstPath[0] || '');
                            setValue(`subjectConfigs.${index}.previousYears`, []);
                          };
                          return (
                            <div key={field.id} className="space-y-3 rounded-xl border border-border/70 bg-slate-950/40 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                              {showOfferBalanceForSection ? (
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-300/25 bg-cyan-500/10 px-3 py-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">Included via offer</p>
                                  <p className="text-xs text-cyan-50/85">
                                    Reusable purchased questions in this subject: {includedOfferQuestionCountForSubject}. {isOfferCoveredSection
                                      ? `Bank Count below still shows the full subject bank. Current filters are currently selecting ${includedOfferCoverageForSection} purchased question${includedOfferCoverageForSection === 1 ? '' : 's'} from your reusable set.`
                                      : (linkedPremiumFeaturePurchaseMatchesCurrentScope
                                        ? 'Bank Count below still shows the full subject bank, but current filters are outside your purchased reusable set. This section will use paid questions unless you switch back to the included topic/filter.'
                                        : `Select ${linkedPremiumFeatureScopeExamTypeName || 'the purchased exam'} / ${linkedPremiumFeatureScopeClassName || 'the purchased curriculum'} to use this purchased set here.`)}
                                  </p>
                                </div>
                              ) : null}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
                                <FormField control={form.control} name={`subjectConfigs.${index}.subjectId`} render={({ field: subjectField }) => (
                                  <FormItem><FormLabel>Subject</FormLabel><Select onValueChange={(value) => {
                                    if (hasDuplicateCombination(value, '', [], currentQuestionType, currentDifficultyLevel, 'all', [])) {
                                      toast({
                                        variant: 'destructive',
                                        title: 'Duplicate section',
                                        description: 'This section already exists with the same filters.',
                                      });
                                      return;
                                    }
                                    subjectField.onChange(value);
                                    const subjectName = subjectOptionsForSections.find((s) => s.id === value)?.name || '';
                                    setValue(`subjectConfigs.${index}.subjectName`, subjectName);
                                    setValue(`subjectConfigs.${index}.topicId`, '');
                                    setValue(`subjectConfigs.${index}.topicName`, '');
                                    setValue(`subjectConfigs.${index}.subtopic`, '');
                                    setValue(`subjectConfigs.${index}.subtopicPaths`, []);
                                    setValue(`subjectConfigs.${index}.questionSource`, 'all');
                                    setValue(`subjectConfigs.${index}.previousYears`, []);
                                    setSubtopicDraftPathBySection((prev) => ({ ...prev, [field.id]: [] }));
                                  }} value={subjectField.value || ''} disabled={!effectiveClassId}><FormControl><SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger></FormControl><SelectContent>{subjectOptionsForSections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name={`subjectConfigs.${index}.questionSource`} render={({ field: sourceField }) => (
                                  <FormItem>
                                    <FormLabel>Question Source</FormLabel>
                                    <Select
                                      onValueChange={(value: 'all' | 'pyq') => {
                                        if (!currentSubjectId) {
                                          sourceField.onChange(value);
                                          setValue(`subjectConfigs.${index}.previousYears`, []);
                                          return;
                                        }
                                        if (hasDuplicateCombination(currentSubjectId, currentTopicId, currentSubtopicPaths, currentQuestionType, currentDifficultyLevel, value, [])) {
                                          toast({
                                            variant: 'destructive',
                                            title: 'Duplicate section',
                                            description: 'This section already exists with the same filters.',
                                          });
                                          return;
                                        }
                                        sourceField.onChange(value);
                                        setValue(`subjectConfigs.${index}.previousYears`, []);
                                      }}
                                      value={sourceField.value || 'all'}
                                      disabled={!currentSubjectId}
                                    >
                                      <FormControl><SelectTrigger><SelectValue placeholder="All Questions" /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        <SelectItem value="all">All Questions</SelectItem>
                                        <SelectItem value="pyq">Previous Year (PYQ)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={form.control} name={`subjectConfigs.${index}.topicId`} render={({ field: topicField }) => (
                                  <FormItem><FormLabel>Topic</FormLabel><Select onValueChange={(value) => {
                                    const normalizedTopicId = value === '__all_topics__' ? '' : value;
                                    if (!currentSubjectId) {
                                      topicField.onChange(normalizedTopicId);
                                      return;
                                    }
                                    if (hasDuplicateCombination(currentSubjectId, normalizedTopicId, [], currentQuestionType, currentDifficultyLevel, currentQuestionSource, currentPreviousYears)) {
                                      toast({
                                        variant: 'destructive',
                                        title: 'Duplicate section',
                                        description: 'This section already exists with the same filters.',
                                      });
                                      return;
                                    }
                                    topicField.onChange(normalizedTopicId);
                                    const topicName = topicOptions.find((t) => t.id === normalizedTopicId)?.name || '';
                                    setValue(`subjectConfigs.${index}.topicName`, topicName);
                                    setValue(`subjectConfigs.${index}.subtopic`, '');
                                    setValue(`subjectConfigs.${index}.subtopicPaths`, []);
                                    setValue(`subjectConfigs.${index}.previousYears`, []);
                                    setSubtopicDraftPathBySection((prev) => ({ ...prev, [field.id]: [] }));
                                  }} value={topicField.value || '__all_topics__'} disabled={!currentSubjectId}><FormControl><SelectTrigger><SelectValue placeholder="All topics" /></SelectTrigger></FormControl><SelectContent><SelectItem value="__all_topics__">All topics</SelectItem>{topicOptions.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name={`subjectConfigs.${index}.questionType`} render={({ field: typeField }) => (
                                  <FormItem><FormLabel>Question Type</FormLabel><Select onValueChange={(value: 'All' | 'MCQ' | 'Numerical' | 'Text') => {
                                    if (!currentSubjectId) {
                                      typeField.onChange(value);
                                      return;
                                    }
                                    if (hasDuplicateCombination(currentSubjectId, currentTopicId, currentSubtopicPaths, value, currentDifficultyLevel, currentQuestionSource, currentPreviousYears)) {
                                      toast({
                                        variant: 'destructive',
                                        title: 'Duplicate section',
                                        description: 'This section already exists with the same filters.',
                                      });
                                      return;
                                    }
                                    typeField.onChange(value);
                                    setValue(`subjectConfigs.${index}.previousYears`, []);
                                  }} value={typeField.value}><FormControl><SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger></FormControl><SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="MCQ">MCQ</SelectItem><SelectItem value="Numerical">Numerical</SelectItem><SelectItem value="Text">Text</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                
                              </div>
                              {currentTopicId ? (
                                <div className="rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-500/10 via-slate-900/30 to-cyan-500/10 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-semibold text-cyan-100">Nested Subtopic Filters (optional)</p>
                                      <p className="text-[11px] text-muted-foreground">Select branches at any depth. Each branch includes all child subtopics.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={currentSubtopicPaths.length === 0 ? 'default' : 'outline'}
                                      className="h-8 rounded-full"
                                      onClick={() => {
                                        if (!currentSubjectId) return;
                                        if (hasDuplicateCombination(currentSubjectId, currentTopicId, [], currentQuestionType, currentDifficultyLevel, currentQuestionSource, currentPreviousYears)) {
                                          toast({
                                            variant: 'destructive',
                                            title: 'Duplicate section',
                                            description: 'This section already exists with the same filters.',
                                          });
                                          return;
                                        }
                                        setValue(`subjectConfigs.${index}.subtopicPaths`, []);
                                        setValue(`subjectConfigs.${index}.subtopic`, '');
                                        setValue(`subjectConfigs.${index}.previousYears`, []);
                                      }}
                                    >
                                      All subtopics in topic
                                    </Button>
                                  </div>
                                  {subtopicPathPool.length === 0 ? (
                                    <p className="mt-2 text-xs text-muted-foreground">No nested subtopics available for this topic under current filters.</p>
                                  ) : (
                                    <div className="mt-3 space-y-3">
                                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                        {levelOptionSets.map((levelOptions, levelIndex) => (
                                          <FormItem key={`${field.id}-level-${levelIndex}`}>
                                            <FormLabel>{`Subtopic Level ${levelIndex + 1}`}</FormLabel>
                                            <Select
                                              onValueChange={(value) => {
                                                const nextPath = [...draftSubtopicPath].slice(0, levelIndex);
                                                if (value !== '__no_selection__') {
                                                  nextPath[levelIndex] = value;
                                                }
                                                setSubtopicDraftPathBySection((prev) => ({ ...prev, [field.id]: nextPath }));
                                                applySubtopicPathSelection(nextPath);
                                              }}
                                              value={draftSubtopicPath[levelIndex] || '__no_selection__'}
                                            >
                                              <FormControl><SelectTrigger><SelectValue placeholder={levelIndex === 0 ? 'Select top-level subtopic' : 'Select child subtopic'} /></SelectTrigger></FormControl>
                                              <SelectContent>
                                                <SelectItem value="__no_selection__">{levelIndex === 0 ? 'Select top-level subtopic' : 'Stop here (all child subtopics)'}</SelectItem>
                                                {levelOptions.map((option) => (
                                                  <SelectItem key={`${field.id}-level-${levelIndex}-${option}`} value={option}>{option}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </FormItem>
                                        ))}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          className="h-8 rounded-full"
                                          disabled={normalizedDraftPath.length === 0}
                                          onClick={() => {
                                            if (!currentSubjectId || normalizedDraftPath.length === 0) return;
                                            const branchPath = serializeSubtopicPathSelection(normalizedDraftPath);
                                            const mergedPaths = normalizeSubtopicPathSelections([...currentSubtopicPaths, branchPath]);
                                            if (hasDuplicateCombination(currentSubjectId, currentTopicId, mergedPaths, currentQuestionType, currentDifficultyLevel, currentQuestionSource, currentPreviousYears)) {
                                              toast({
                                                variant: 'destructive',
                                                title: 'Duplicate section',
                                                description: 'This section already exists with the same filters.',
                                              });
                                              return;
                                            }
                                            const firstPath = parseSubtopicPathSelection(mergedPaths[0] || '');
                                            setValue(`subjectConfigs.${index}.subtopicPaths`, mergedPaths);
                                            setValue(`subjectConfigs.${index}.subtopic`, firstPath[0] || '');
                                            setValue(`subjectConfigs.${index}.previousYears`, []);
                                          }}
                                        >
                                          Add Selected Branch
                                        </Button>
                                        <p className="text-xs text-muted-foreground">
                                          Draft: {normalizedDraftPath.length > 0 ? serializeSubtopicPathSelection(normalizedDraftPath) : 'None'}
                                        </p>
                                      </div>
                                      {currentSubtopicPaths.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                          {currentSubtopicPaths.map((selectedPath) => (
                                            <button
                                              key={`${field.id}-subtopic-path-${selectedPath}`}
                                              type="button"
                                              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-500/15 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-500/25"
                                              onClick={() => {
                                                if (!currentSubjectId) return;
                                                const nextPaths = normalizeSubtopicPathSelections(currentSubtopicPaths.filter((path) => path !== selectedPath));
                                                if (hasDuplicateCombination(currentSubjectId, currentTopicId, nextPaths, currentQuestionType, currentDifficultyLevel, currentQuestionSource, currentPreviousYears)) {
                                                  toast({
                                                    variant: 'destructive',
                                                    title: 'Duplicate section',
                                                    description: 'This section already exists with the same filters.',
                                                  });
                                                  return;
                                                }
                                                const firstPath = parseSubtopicPathSelection(nextPaths[0] || '');
                                                setValue(`subjectConfigs.${index}.subtopicPaths`, nextPaths);
                                                setValue(`subjectConfigs.${index}.subtopic`, firstPath[0] || '');
                                                setValue(`subjectConfigs.${index}.previousYears`, []);
                                              }}
                                            >
                                              <span>{selectedPath}</span>
                                              <span className="font-semibold">x</span>
                                            </button>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground">No subtopic branch selected. This section currently includes all subtopics from this topic.</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                              {currentQuestionSource === 'pyq' ? (
                                <div className="rounded-lg border border-amber-300/30 bg-amber-500/5 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-amber-100">PYQ Year Filter</p>
                                    <p className="text-xs text-muted-foreground">
                                      {availablePyqYears.length > 0
                                        ? (currentPreviousYears.length > 0 ? `Selected: ${currentPreviousYears.join(', ')}` : 'Selected: All Years')
                                        : 'No PYQ years available'}
                                    </p>
                                  </div>
                                  {availablePyqYears.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={currentPreviousYears.length === 0 ? 'default' : 'outline'}
                                        className={currentPreviousYears.length === 0 ? 'h-8 rounded-full' : 'h-8 rounded-full'}
                                        onClick={() => setValue(`subjectConfigs.${index}.previousYears`, [])}
                                      >
                                        All Years
                                      </Button>
                                      {availablePyqYears.map((year) => {
                                        const selectedYear = currentPreviousYears.includes(year);
                                        return (
                                          <label
                                            key={`${field.id}-pyq-${year}`}
                                            className={cn(
                                              'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all',
                                              selectedYear
                                                ? 'border-amber-400/45 bg-amber-500/15 text-amber-100'
                                                : 'border-border/70 bg-background/80 hover:border-amber-400/35 hover:bg-amber-500/10'
                                            )}
                                          >
                                            <Checkbox
                                              checked={selectedYear}
                                              onCheckedChange={(checked: boolean) => {
                                                const nextSelected = new Set(currentPreviousYears);
                                                if (checked) nextSelected.add(year);
                                                else nextSelected.delete(year);
                                                const normalizedYears = normalizePreviousYearList(Array.from(nextSelected));
                                                if (hasDuplicateCombination(currentSubjectId, currentTopicId, currentSubtopicPaths, currentQuestionType, currentDifficultyLevel, 'pyq', normalizedYears)) {
                                                  toast({
                                                    variant: 'destructive',
                                                    title: 'Duplicate section',
                                                    description: 'This section already exists with the same filters.',
                                                  });
                                                  return;
                                                }
                                                setValue(`subjectConfigs.${index}.previousYears`, normalizedYears);
                                              }}
                                            />
                                            <span>{year}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      Change topic/subtopic branches/question type or switch to All Questions.
                                    </p>
                                  )}
                                </div>
                              ) : null}
                              <div
                                className={cn(
                                  'grid grid-cols-1 items-end gap-2 md:grid-cols-2',
                                  isPremiumMode
                                    ? 'lg:grid-cols-[minmax(190px,1fr)_minmax(140px,180px)_auto]'
                                    : 'lg:grid-cols-[minmax(190px,1fr)_minmax(220px,1fr)_minmax(140px,180px)_auto]'
                                )}
                              >
                                <FormField control={form.control} name={`subjectConfigs.${index}.count`} render={({ field: countField }) => (
                                  <FormItem>
                                    <FormLabel>No. of Questions</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min="1"
                                        max={availableCount > 0 ? availableCount : undefined}
                                        value={countField.value}
                                        onChange={(event) => {
                                          const rawValue = event.target.value;
                                          const parsed = Number(rawValue);
                                          if (!Number.isFinite(parsed)) {
                                            countField.onChange(rawValue);
                                            return;
                                          }
                                          const minimum = 1;
                                          const upperBound = availableCount > 0 ? availableCount : parsed;
                                          const normalized = Math.min(Math.max(parsed, minimum), upperBound);
                                          countField.onChange(normalized);
                                        }}
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      {showOfferBalanceForSection
                                        ? `Bank count: ${availableCount} | Reusable purchased questions in subject: ${includedOfferQuestionCountForSubject}${isOfferCoveredSection ? ` | Covered now by current filters: ${includedOfferCoverageForSection}` : ''}`
                                        : `Max available: ${availableCount}`}
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                {!isPremiumMode ? (
                                  <FormField control={form.control} name={`subjectConfigs.${index}.randomizePerAttempt`} render={({ field: randomField }) => (
                                    <FormItem className="rounded-lg border border-border/70 bg-slate-900/70 p-2.5">
                                      <div className="flex items-center justify-between gap-2">
                                        <FormLabel className="m-0 text-xs">Random Each Attempt</FormLabel>
                                        <FormControl>
                                          <Switch checked={!!randomField.value} onCheckedChange={randomField.onChange} />
                                        </FormControl>
                                      </div>
                                    </FormItem>
                                  )} />
                                ) : null}
                                <div className="min-w-0 rounded-lg border border-border/70 bg-slate-900/75 p-2.5 text-sm">
                                  <p className="font-medium">Bank Count</p>
                                  <p>{availableCount}</p>
                                  {showOfferBalanceForSection ? (
                                    <p className="text-[11px] text-cyan-100/80">
                                      Reusable purchased questions: {includedOfferQuestionCountForSubject}
                                    </p>
                                  ) : null}
                                  {isOfferCoveredSection ? (
                                    <p className="text-[11px] text-emerald-100/80">
                                      Covered now by filters: {includedOfferCoverageForSection}
                                    </p>
                                  ) : null}
                                  {currentQuestionSource === 'pyq' ? (
                                    <p className="text-[11px] text-muted-foreground">
                                      PYQ {currentPreviousYears.length > 0 ? currentPreviousYears.join(', ') : 'All Years'}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex lg:justify-end">
                                  {fields.length > 1 ? (
                                    <Button type="button" variant="destructive" size="icon" className="rounded-full" onClick={() => remove(index)}><X className="h-4 w-4" /></Button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <Button type="button" variant="outline" className="h-10 rounded-full border-cyan-300/35 bg-cyan-500/10 px-4 font-semibold text-cyan-100 hover:bg-cyan-500/20" onClick={() => append({ subjectId: '', subjectName: '', topicId: '', topicName: '', subtopic: '', subtopicPaths: [], questionSource: 'all', previousYears: [], randomizePerAttempt: false, questionType: 'All', difficultyLevel: 'Easy' as const, count: 10 })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Section
                      </Button>
                      <FormField control={form.control} name="subjectConfigs" render={() => <FormItem><FormMessage /></FormItem>} />
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-slate-900/80 to-slate-950/65 p-4 md:p-5">
                      <h3 className="text-lg font-semibold">Step 4: Review & Finalize</h3>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
                        <div className="rounded-xl border border-border/70 bg-background/50 p-3.5">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Questions</p>
                          <p className="mt-1 text-xl font-semibold">{totalRequestedQuestions}</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/50 p-3.5">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Marks</p>
                          <p className="mt-1 text-xl font-semibold">{totalMarks}</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/50 p-3.5">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Time</p>
                          <p className="mt-1 text-xl font-semibold">{watch('duration')} min</p>
                        </div>
                      </div>
                      {isPremiumMode ? (
                        <div className="mt-4 rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-amber-100">Premium Pricing Breakdown</p>
                            <p className="text-sm text-amber-100/90">
                              {totalPremiumPayableNow > 0
                                ? <>Payable now: <span className="font-semibold">INR {totalPremiumPayableNow.toLocaleString()}</span></>
                                : hasIncludedPremiumCoverage
                                  ? 'Included counts cover this build. No extra payment needed.'
                                  : isEditMode
                                    ? 'No extra payment needed for this update.'
                                    : 'Add question count to see payable amount.'}
                            </p>
                          </div>
                          <div className="mt-3 space-y-2">
                            {premiumPricingDisplayBreakdown.rows.length > 0 ? (
                              premiumPricingDisplayBreakdown.rows.map((row, index) => (
                                <div key={`${row.subjectId}-${row.questionSource}-${row.difficultyLevel}-${index}`} className="rounded-md border border-amber-300/25 bg-amber-500/10 p-2.5 text-sm">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-medium text-amber-100">
                                      {subjectNameById[row.subjectId] || 'Subject'} • {row.questionSource === 'pyq' ? 'PYQ' : 'Regular'}
                                    </p>
                                    <p className="text-amber-100/90">INR {row.amount.toLocaleString()}</p>
                                  </div>
                                  <p className="text-muted-foreground">
                                    {row.count} question{row.count === 1 ? '' : 's'} x INR {row.unitPrice}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-md border border-amber-300/25 bg-amber-500/10 p-2.5 text-sm text-muted-foreground">
                                Add sections to see the payable pricing mix.
                              </div>
                            )}
                          </div>
                          {includedPremiumQuestionCount > 0 ? (
                            <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                              <div className="rounded-md border border-cyan-300/25 bg-cyan-500/10 p-2.5">
                                <p className="font-medium">Included Questions</p>
                                <p className="text-muted-foreground">
                                  {isOfferBackedPremiumFeaturePurchase
                                    ? `${visibleIncludedPremiumQuestionCount} of ${includedPremiumQuestionCount} offer questions currently covered`
                                    : `${visibleIncludedPremiumQuestionCount} questions covered`}
                                </p>
                              </div>
                              <div className="rounded-md border border-cyan-300/25 bg-cyan-500/10 p-2.5">
                                <p className="font-medium">Extra Question Charge</p>
                                <p className="text-muted-foreground">INR {additionalPremiumQuestionPayableAmount.toLocaleString()}</p>
                              </div>
                              <div className="rounded-md border border-cyan-300/25 bg-cyan-500/10 p-2.5">
                                <p className="font-medium">Attempt Access</p>
                                <p className="text-muted-foreground">{formatPremiumCustomMockAttemptPricingRule((existingCustomTest?.attemptPricing || linkedPremiumFeaturePurchase?.attemptPricing || premiumMockTestAttemptRule))}</p>
                              </div>
                            </div>
                          ) : null}
                          {isOfferBackedPremiumFeaturePurchase && includedOfferSubjectConfigCount > 0 ? (
                            <p className="mt-2 text-xs text-cyan-100/85">
                              Purchased coverage is applied only to sections that match the included subject/topic scope. Any other section is treated as a normal premium paid selection.
                            </p>
                          ) : null}
                          {isEditMode && existingPremiumAttemptUsage?.isExhausted ? (
                            <p className="mt-2 text-xs text-amber-100/85">
                              {existingPremiumAttemptUsage.actionLabel
                                ? (existingPremiumAttemptUsage.actionAmount > 0
                                  ? `${existingPremiumAttemptUsage.actionLabel} for INR ${existingPremiumAttemptUsage.actionAmount.toLocaleString()} to continue with the same saved question set.`
                                  : `${existingPremiumAttemptUsage.actionLabel} to continue with the same saved question set.`)
                                : 'Attempts are exhausted for this premium custom mock.'}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs text-muted-foreground">
                            Payment is collected first. Premium mock changes save only after successful payment verification, and your purchased attempts remain unchanged unless you recharge them explicitly.
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-slate-900/50 p-3">
                      {isEditMode ? (
                        <Button type="button" variant="destructive" className="h-11 rounded-full px-5 font-semibold" onClick={handleDeleteMockTest} disabled={isSubmitting}>
                          Delete Mock Test Permanently
                        </Button>
                      ) : null}
                      <Button type="submit" disabled={isSubmitDisabled} size="lg" className={createButtonClass}>
                        {isSubmitting ? (
                          <>
                            <LoaderCircle className="mr-2 animate-spin" />
                            {isPremiumCreateFlow ? 'Processing Payment...' : isEditMode ? 'Updating...' : 'Creating Test...'}
                          </>
                        ) : (
                          isEditMode
                            ? (isPremiumMode
                              ? (totalPremiumPayableNow > 0
                                ? `Pay INR ${totalPremiumPayableNow.toLocaleString()} & Update Premium Mock`
                                : 'Update Premium Mock Test')
                              : 'Update Mock Test')
                            : isPremiumCreateFlow
                              ? (totalPremiumPayableNow > 0
                                ? `Pay INR ${totalPremiumPayableNow.toLocaleString()} & Create Premium Mock Test`
                                : (includedPremiumQuestionCount > 0
                                  ? 'Create Premium Mock Test'
                                  : 'Configure Premium Mock Test'))
                              : 'Create Mock Test'
                        )}
                        {isPremiumCreateFlow && !isSubmitting ? <CreditCard className="ml-2 h-4 w-4" /> : null}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
          {isPremiumCreateFlow && effectiveTeacherId && (isRecoverablePremiumPaymentsLoading || recoverablePremiumPayments.length > 0) ? (
            <Card className="mt-6 overflow-hidden border border-emerald-400/25 bg-gradient-to-b from-emerald-950/30 via-slate-900/90 to-slate-950/85 shadow-[0_20px_44px_-28px_rgba(16,185,129,0.65)]">
              <CardHeader className="border-b border-border/60">
                <p className="inline-flex w-fit rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100">
                  Payment Recovery
                </p>
                <CardTitle className="font-headline text-xl">Recover Successful Premium Payments</CardTitle>
                <CardDescription>
                  If Razorpay captured a premium custom-mock payment but the website failed before saving, restore it here without paying again.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isRecoverablePremiumPaymentsLoading ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                  </div>
                ) : (
                  recoverablePremiumPayments.map((payment) => {
                    const paymentAmountMatches = Math.abs(payment.amount - totalPremiumPayableNow) <= 0.01;
                    return (
                      <div key={payment.paymentId} className="rounded-2xl border border-emerald-300/20 bg-emerald-500/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-semibold text-emerald-50">Captured payment: INR {payment.amount.toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground">
                              Paid at {new Date(payment.paidAt).toLocaleString()} | Payment ID: {payment.paymentId}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Current builder payable: INR {totalPremiumPayableNow.toLocaleString()}.
                              {paymentAmountMatches ? ' This matches the successful payment.' : ' Match the builder amount to the captured payment before recovery.'}
                            </p>
                          </div>
                          <Button
                            type="button"
                            className="h-10 rounded-full border border-emerald-300/35 bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 px-4 font-semibold text-slate-950 shadow-[0_10px_24px_-12px_rgba(45,212,191,0.75)] transition-all hover:from-emerald-200 hover:via-teal-200 hover:to-cyan-200"
                            onClick={() => handleRecoverPaidPremiumMock(payment)}
                            disabled={isSubmitting || recoveringPaymentId === payment.paymentId}
                          >
                            {recoveringPaymentId === payment.paymentId ? (
                              <>
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                Recovering...
                              </>
                            ) : 'Recover Paid Mock'}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ) : null}
          {effectiveTeacherId ? (
            <Card className="mt-6 overflow-hidden border border-blue-400/25 bg-gradient-to-b from-blue-950/35 via-slate-900/90 to-slate-950/80 shadow-[0_22px_50px_-28px_rgba(37,99,235,0.65)]">
              <CardHeader className="border-b border-border/60">
                <p className="inline-flex w-fit rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-100">
                  DCAM Question Bank Library
                </p>
                <CardTitle className="font-headline text-xl">
                  {isPremiumMode ? `Your Premium Custom Mocks From ${DCAM_QUESTION_BANK_LABEL}` : `Your Free Custom Mocks From ${DCAM_QUESTION_BANK_LABEL}`}
                </CardTitle>
                <CardDescription>
                  These are the tests you created using the {DCAM_QUESTION_BANK_LABEL}&apos;s {targetAccessLevel} question bank.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {areCustomTestsByTeacherLoading ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Skeleton className="h-36 w-full" />
                    <Skeleton className="h-36 w-full" />
                  </div>
                ) : createdTestsInCurrentMode.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center text-muted-foreground">
                    {isPremiumMode
                      ? `No premium custom mock test created from the ${DCAM_QUESTION_BANK_LABEL} yet.`
                      : `No free custom mock test created from the ${DCAM_QUESTION_BANK_LABEL} yet.`}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {createdTestsInCurrentMode.map((test) => {
                      const testId = test.id || '';
                      if (!testId) return null;
                      const createdOn = asDate(test.createdAt);
                      return (
                        <Card key={testId} className="group border border-blue-300/20 bg-gradient-to-br from-slate-900/95 via-blue-950/35 to-slate-950/90 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/45">
                          <CardContent className="space-y-2.5 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <p className="min-w-0 flex-1 truncate text-base font-semibold leading-snug">{test.title || 'Untitled Mock Test'}</p>
                              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isPremiumMode ? 'border-amber-300/40 bg-amber-500/15 text-amber-100' : 'border-emerald-300/40 bg-emerald-500/15 text-emerald-100'}`}>
                                {isPremiumMode ? 'Premium' : 'Free'}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Created: {createdOn ? createdOn.toLocaleString() : 'N/A'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Questions: {test.config?.questionIds?.length || 0} | Duration: {test.config?.duration || 0} min
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <Button type="button" variant="outline" className={teacherCardSecondaryButtonClass} onClick={() => router.push(`/my-practice/custom-tests/${testId}/attempt-history`)}>
                                Attempt History
                              </Button>
                              <Button type="button" className={teacherCardPrimaryButtonClass} onClick={() => router.push(`/test/${testId}?type=custom`)}>
                                Start Test
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className={`${teacherCardSecondaryButtonClass} sm:col-span-2`}
                                onClick={() => router.push(`/custom-mock-tests/create?editTestId=${encodeURIComponent(testId)}&mode=${isPremiumMode ? 'premium' : 'free'}`)}
                              >
                                Edit Mock Test
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
}
