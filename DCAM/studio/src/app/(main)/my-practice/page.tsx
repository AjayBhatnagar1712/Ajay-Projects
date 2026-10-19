'use client';

import Link from 'next/link';
import DashboardHeader from '@/components/dashboard-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Crown, Rocket, ShieldCheck, Sparkles, Target, SlidersHorizontal, PlayCircle } from 'lucide-react';
import { FirebaseClientProvider, FirebaseContext, setDocumentNonBlocking, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isStandaloneMockTest } from '@/lib/mock-test-visibility';
import {
  buildPremiumPracticeSessionHref,
  formatPremiumPracticeAttemptActionButtonLabel,
  resolvePremiumPracticeAttemptUsage,
  type PremiumPracticeSessionPurchase,
} from '@/lib/premium-practice-session';
import {
  buildPremiumCustomMockAttemptRuleFromLegacyLimit,
  formatPremiumCustomMockAttemptActionButtonLabel,
  resolvePremiumCustomMockAttemptUsage,
  type PremiumCustomMockAttemptPricingRule,
  type PremiumCustomMockAttemptState,
} from '@/lib/premium-custom-mock';
import { ADMIN_CUSTOM_MOCK_ASSIGNMENT_SOURCE } from '@/lib/admin-custom-mock-management';
import { ADMIN_PRACTICE_SESSION_ASSIGNMENT_SOURCE } from '@/lib/admin-practice-session-management';
import { formatTestDurationLabel } from '@/lib/test-duration';
import { countTeacherOfferSelections, type TeacherOffer, type TeacherOfferCustomMockPack, type TeacherOfferMockTest, type TeacherOfferPracticePack } from '@/lib/teacher-offers';
import { mergeLegacyDifficultyCounts, QUESTION_DIFFICULTY } from '@/lib/question-difficulty';

type PurchasedMockTest = {
  id: string;
  testId?: string;
  purchasedAt?: string;
};

type MockTest = {
  id: string;
  title?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  accessLevel?: 'free' | 'paid';
  isCourseOnly?: boolean;
  courseId?: string;
  config?: { questionIds?: string[]; duration?: number | null };
  startTime?: { toDate: () => Date };
};

type StudentCustomMockTest = {
  id: string;
  title?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  accessLevel?: 'free' | 'paid';
  createdAt?: { toDate: () => Date };
  attemptLimit?: {
    mode?: 'unlimited' | 'total' | 'interval';
    maxTotalAttempts?: number | null;
    maxAttemptsPerInterval?: number | null;
    intervalValue?: number | null;
    intervalUnit?: 'day' | 'week' | 'month' | 'year' | null;
  };
  attemptPricing?: PremiumCustomMockAttemptPricingRule | null;
  attemptState?: PremiumCustomMockAttemptState | null;
  purchasedAt?: unknown;
  config?: {
    questionIds?: string[];
    duration?: number | null;
    subjectConfigs?: Array<{
      subjectId?: string;
      topicId?: string;
      subtopic?: string;
      subtopicPaths?: string[];
      numQuestions?: number;
    }>;
  };
  teacherName?: string;
  examTypeName?: string;
  className?: string;
  createdFromTeacherId?: string;
  premiumCombinationKey?: string;
  premiumFeaturePurchaseId?: string;
  offerPurchaseId?: string;
  includedQuestionCount?: number;
  includedQuestionIds?: string[];
  includedSubjectConfigs?: TeacherOfferCustomMockPack['subjectConfigs'];
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
  questionBankSource?: 'student_plus_official' | 'teacher_official';
  duration?: number | null;
  marksPerQuestion?: number | null;
  negativeMarksPerQuestion?: number | null;
  attemptPricing?: PremiumCustomMockAttemptPricingRule | null;
  subjectConfigs?: TeacherOfferCustomMockPack['subjectConfigs'];
  includedQuestionCount?: number;
  includedQuestionIds?: string[];
  includedQuestionCountByDifficulty?: { easy?: number; medium?: number; hard?: number };
  includedSubjectConfigs?: TeacherOfferCustomMockPack['subjectConfigs'];
  assignmentSource?: string;
  mergedPurchaseIds?: string[];
};

type TeacherOfferPurchase = {
  id: string;
  offerId?: string;
  teacherOfferId?: string;
  teacherId?: string;
  teacherName?: string;
  status?: 'paid' | 'failed';
  currency?: string;
  grossAmount?: number;
  totalAmountPaid?: number;
  pricePaid?: number;
  amountPaid?: number;
  purchasedAt?: unknown;
  updatedAt?: unknown;
  premiumPracticePurchaseId?: string;
  premiumMockFeaturePurchaseId?: string;
  offerSnapshot?: TeacherOffer | null;
  offer?: TeacherOffer | null;
  teacherOffer?: TeacherOffer | null;
  teacherOfferSnapshot?: TeacherOffer | null;
  mockTests?: TeacherOfferMockTest[];
  premiumPracticePack?: TeacherOfferPracticePack | null;
  premiumCustomMockPack?: TeacherOfferCustomMockPack | null;
  examTypeId?: string;
  examTypeName?: string;
  classId?: string;
  className?: string;
};

type LookupSubject = {
  id: string;
  name?: string;
};

type LookupTopic = {
  id: string;
  name?: string;
};

type PremiumCustomMockScopeDetail = {
  examTypeName?: string;
  className?: string;
  subject: string;
  topics: string[];
  topicOverflowCount: number;
  subtopics: string[];
  subtopicOverflowCount: number;
  questionCount: number;
};

type PremiumPracticeScopeDetail = {
  examTypeName?: string;
  className?: string;
  subject: string;
  topics: string[];
  topicOverflowCount: number;
  subtopics: string[];
  subtopicOverflowCount: number;
  questionCount: number;
};

type CustomMockScopeConfigLike = Array<{
  subjectId?: string;
  subjectName?: string;
  topicId?: string;
  topicName?: string;
  subtopic?: string;
  subtopicPaths?: string[];
  count?: number;
  numQuestions?: number;
}>;

type PremiumCustomMockAccessCard = {
  id: string;
  teacherId: string;
  teacherName?: string;
  premiumFeaturePurchaseId?: string;
  premiumFeaturePurchaseIds?: string[];
  examTypeId: string;
  examTypeName?: string;
  classId: string;
  className?: string;
  premiumCombinationKey: string;
  title: string;
  offerTitle?: string;
  paidAt?: unknown;
  amount?: number;
  questionCount: number;
  usedQuestionCount: number;
  remainingQuestionCount: number;
  linkedMockCount: number;
  currency?: string;
  sourceLabel: string;
  isOfferBacked: boolean;
  isAdminAssigned: boolean;
  scopeDetails: PremiumCustomMockScopeDetail[];
  includedQuestionIds: string[];
  includedScopeConfigs: CustomMockScopeConfigLike;
};

type AttemptLimitMode = 'unlimited' | 'total' | 'interval';
type AttemptIntervalUnit = 'day' | 'week' | 'month' | 'year';
type NormalizedAttemptLimit = {
  mode: AttemptLimitMode;
  maxTotalAttempts: number | null;
  maxAttemptsPerInterval: number | null;
  intervalValue: number | null;
  intervalUnit: AttemptIntervalUnit | null;
};
type CustomAttemptUsage = {
  mode: AttemptLimitMode;
  usedTotal: number;
  usedInCurrentInterval: number | null;
  remaining: number | null;
  ruleLabel: string;
  usageLabel: string;
  intervalLabel: string | null;
  actionKind?: 'none' | 'total_recharge' | 'interval_attempt';
  actionLabel?: string | null;
  actionAmount?: number;
  isExhausted?: boolean;
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

const subtractInterval = (base: Date, value: number, unit: AttemptIntervalUnit) => {
  const next = new Date(base);
  const amount = Math.max(1, Math.floor(Number(value) || 1));
  if (unit === 'day') next.setDate(next.getDate() - amount);
  if (unit === 'week') next.setDate(next.getDate() - amount * 7);
  if (unit === 'month') next.setMonth(next.getMonth() - amount);
  if (unit === 'year') next.setFullYear(next.getFullYear() - amount);
  return next;
};

const normalizeAttemptLimit = (value?: StudentCustomMockTest['attemptLimit']): NormalizedAttemptLimit => {
  const mode = value?.mode === 'total' || value?.mode === 'interval' ? value.mode : 'unlimited';
  const maxTotalAttempts = Number(value?.maxTotalAttempts);
  const maxAttemptsPerInterval = Number(value?.maxAttemptsPerInterval);
  const intervalValue = Number(value?.intervalValue);
  const intervalUnit =
    typeof value?.intervalUnit === 'string' && ['day', 'week', 'month', 'year'].includes(value.intervalUnit)
      ? (value.intervalUnit as AttemptIntervalUnit)
      : null;
  return {
    mode,
    maxTotalAttempts: mode === 'total' && Number.isFinite(maxTotalAttempts) && maxTotalAttempts >= 1 ? Math.floor(maxTotalAttempts) : null,
    maxAttemptsPerInterval:
      mode === 'interval' && Number.isFinite(maxAttemptsPerInterval) && maxAttemptsPerInterval >= 1
        ? Math.floor(maxAttemptsPerInterval)
        : null,
    intervalValue: mode === 'interval' && Number.isFinite(intervalValue) && intervalValue >= 1 ? Math.floor(intervalValue) : null,
    intervalUnit: mode === 'interval' ? intervalUnit : null,
  };
};

const buildCustomAttemptUsage = (attemptLimit: NormalizedAttemptLimit, attemptDates: Date[]): CustomAttemptUsage => {
  const usedTotal = attemptDates.length;
  if (attemptLimit.mode === 'total' && attemptLimit.maxTotalAttempts) {
    const remaining = Math.max(0, attemptLimit.maxTotalAttempts - usedTotal);
    return {
      mode: 'total',
      usedTotal,
      usedInCurrentInterval: null,
      remaining,
      ruleLabel: `${attemptLimit.maxTotalAttempts} total attempt${attemptLimit.maxTotalAttempts === 1 ? '' : 's'}`,
      usageLabel: `${usedTotal}/${attemptLimit.maxTotalAttempts} used`,
      intervalLabel: null,
    };
  }
  if (
    attemptLimit.mode === 'interval'
    && attemptLimit.maxAttemptsPerInterval
    && attemptLimit.intervalValue
    && attemptLimit.intervalUnit
  ) {
    const intervalLabel = `${attemptLimit.intervalValue} ${attemptLimit.intervalUnit}${attemptLimit.intervalValue === 1 ? '' : 's'}`;
    const windowStart = subtractInterval(new Date(), attemptLimit.intervalValue, attemptLimit.intervalUnit);
    const usedInCurrentInterval = attemptDates.filter((dt) => dt.getTime() >= windowStart.getTime()).length;
    const remaining = Math.max(0, attemptLimit.maxAttemptsPerInterval - usedInCurrentInterval);
    return {
      mode: 'interval',
      usedTotal,
      usedInCurrentInterval,
      remaining,
      ruleLabel: `${attemptLimit.maxAttemptsPerInterval} attempt${attemptLimit.maxAttemptsPerInterval === 1 ? '' : 's'} per ${intervalLabel}`,
      usageLabel: `${usedInCurrentInterval}/${attemptLimit.maxAttemptsPerInterval} used in current interval`,
      intervalLabel,
    };
  }
  return {
    mode: 'unlimited',
    usedTotal,
    usedInCurrentInterval: null,
    remaining: null,
    ruleLabel: 'Unlimited attempts',
    usageLabel: `${usedTotal} used`,
    intervalLabel: null,
  };
};

const buildPremiumCombinationKey = (examTypeId?: string, classId?: string) => {
  const normalizedExamTypeId = String(examTypeId || '').trim();
  const normalizedClassId = String(classId || '').trim();
  return normalizedExamTypeId && normalizedClassId ? `${normalizedExamTypeId}__${normalizedClassId}` : '';
};

const getConsumedIncludedQuestionCountFromSavedTest = (value?: {
  includedQuestionCount?: number;
  includedQuestionIds?: string[];
  config?: { questionIds?: string[]; duration?: number | null };
} | null) => {
  const storedIncludedQuestionIds = Array.isArray(value?.includedQuestionIds)
    ? Array.from(
        new Set(
          value.includedQuestionIds
            .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
            .map((entry) => entry.trim())
        )
      )
    : [];
  if (storedIncludedQuestionIds.length > 0) return storedIncludedQuestionIds.length;
  const storedIncludedCount = Math.max(0, Number(value?.includedQuestionCount || 0));
  const savedQuestionCount = Array.isArray(value?.config?.questionIds)
    ? value.config?.questionIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).length
    : 0;

  if (storedIncludedCount <= 0) return 0;
  if (savedQuestionCount <= 0) return storedIncludedCount;
  return Math.min(storedIncludedCount, savedQuestionCount);
};

const isTeacherOfferLike = (value: unknown): value is TeacherOffer => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as TeacherOffer;
  return (
    Array.isArray(candidate.mockTests)
    || Array.isArray(candidate.courses)
    || Array.isArray(candidate.liveBatches)
    || !!candidate.premiumPracticePack
    || !!candidate.premiumCustomMockPack
  );
};

const resolveTeacherOfferFromPurchase = (
  purchase: TeacherOfferPurchase,
  teacherOfferById: Record<string, TeacherOffer>
) => {
  const embeddedCandidates = [
    purchase.offerSnapshot,
    purchase.offer,
    purchase.teacherOffer,
    purchase.teacherOfferSnapshot,
  ];
  const embeddedOffer = embeddedCandidates.find((candidate) => isTeacherOfferLike(candidate));
  if (embeddedOffer) return embeddedOffer;
  if (isTeacherOfferLike(purchase)) return purchase;
  const offerId = String(purchase.offerId || purchase.teacherOfferId || '').trim();
  return offerId ? teacherOfferById[offerId] || null : null;
};

const resolveTeacherOfferPaymentAmount = (
  offer: TeacherOffer,
  purchase: TeacherOfferPurchase,
  packEstimatedAmount: number
) => {
  if (packEstimatedAmount > 0) return packEstimatedAmount;
  const totalSelections = countTeacherOfferSelections(offer).totalSelections;
  if (totalSelections === 1) {
    const purchaseAmount = Number(
      purchase.totalAmountPaid
      ?? purchase.grossAmount
      ?? purchase.amountPaid
      ?? purchase.pricePaid
      ?? offer.price
      ?? 0
    );
    return Number.isFinite(purchaseAmount) && purchaseAmount > 0 ? purchaseAmount : 0;
  }
  return 0;
};

const buildOfferPracticePurchaseId = (purchaseId: string) => `offer_${purchaseId}_premium_practice`;
const buildOfferPremiumMockFeatureId = (purchaseId: string) => `offer_${purchaseId}_premium_custom_mock`;
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
const getPremiumCustomMockIncludedQuestionCountFromRecord = (value?: {
  includedQuestionCount?: number;
  includedQuestionIds?: string[];
  questionCount?: number;
  includedSubjectConfigs?: Array<{ count?: number; numQuestions?: number }>;
  subjectConfigs?: Array<{ count?: number; numQuestions?: number }>;
} | null) => {
  const configs = Array.isArray(value?.includedSubjectConfigs)
    ? value.includedSubjectConfigs
    : Array.isArray(value?.subjectConfigs)
      ? value.subjectConfigs
      : [];
  const configuredCount = configs.reduce(
    (count, config) => count + Math.max(0, Number(config?.count ?? config?.numQuestions ?? 0)),
    0
  );
  const storedIdsCount = Array.isArray(value?.includedQuestionIds)
    ? value.includedQuestionIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).length
    : 0;
  const storedCount = Math.max(0, Number(value?.includedQuestionCount ?? value?.questionCount ?? 0));
  return Math.max(storedCount, configuredCount, storedIdsCount);
};

const getPremiumPracticeIncludedQuestionCountFromRecord = (value?: {
  includedQuestionCount?: number;
  includedQuestionIds?: string[];
  questionCount?: number;
  includedTopicConfigs?: PremiumPracticeSessionPurchase['includedTopicConfigs'];
  topicConfigs?: PremiumPracticeSessionPurchase['topicConfigs'];
} | null) => {
  const configs = Array.isArray(value?.includedTopicConfigs)
    ? value.includedTopicConfigs
    : Array.isArray(value?.topicConfigs)
      ? value.topicConfigs
      : [];
  const configuredCount = configs.reduce(
    (count, config) => count + Math.max(0, Number(config?.count || 0)),
    0
  );
  const storedIdsCount = Array.isArray(value?.includedQuestionIds)
    ? value.includedQuestionIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).length
    : 0;
  const storedCount = Math.max(0, Number(value?.includedQuestionCount ?? value?.questionCount ?? 0));
  return Math.max(storedCount, configuredCount, storedIdsCount);
};

const isAdminAssignedPremiumPracticeRecord = (value?: {
  assignmentSource?: string;
} | null) => String(value?.assignmentSource || '').trim() === ADMIN_PRACTICE_SESSION_ASSIGNMENT_SOURCE;

const isReusablePremiumPracticeRecord = (value?: {
  offerId?: string;
  offerPurchaseId?: string;
  assignmentSource?: string;
} | null) =>
  isAdminAssignedPremiumPracticeRecord(value)
  || !!String(value?.offerId || '').trim()
  || !!String(value?.offerPurchaseId || '').trim();

const normalizeCustomMockQuestionIdList = (value: unknown): string[] => (
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

const getMergedCustomMockScopeConfigKey = (config?: {
  subjectId?: string;
  topicId?: string;
  subtopic?: string;
  subtopicPaths?: string[];
  questionType?: string;
  difficultyLevel?: string;
  questionSource?: string;
  previousYears?: string[];
}) => {
  const subjectId = String(config?.subjectId || '').trim();
  const topicId = String(config?.topicId || '').trim();
  const normalizedSubtopicPaths = Array.isArray(config?.subtopicPaths)
    ? config!.subtopicPaths!.map((entry) => String(entry || '').trim()).filter(Boolean).sort()
    : [];
  const explicitSubtopic = String(config?.subtopic || '').trim();
  const subtopicKey = [...normalizedSubtopicPaths, ...(explicitSubtopic ? [explicitSubtopic] : [])].join('|');
  const questionType = String(config?.questionType || 'All').trim() || 'All';
  const difficultyLevel = String(config?.difficultyLevel || 'All').trim() || 'All';
  const questionSource = String(config?.questionSource || 'all').trim() || 'all';
  const previousYears = Array.isArray(config?.previousYears)
    ? config!.previousYears!.map((entry) => String(entry || '').trim()).filter(Boolean).sort()
    : [];
  return [subjectId, topicId, subtopicKey, questionType, difficultyLevel, questionSource, previousYears.join('|')].join('__');
};

const mergeCustomMockScopeConfigs = (configs?: CustomMockScopeConfigLike) => {
  const merged = new Map<string, NonNullable<CustomMockScopeConfigLike>[number]>();
  (configs || []).forEach((config) => {
    const subjectId = String(config?.subjectId || '').trim();
    if (!subjectId) return;
    const key = getMergedCustomMockScopeConfigKey(config);
    const nextCount = Math.max(0, Number(config?.count ?? config?.numQuestions ?? 0));
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
        ...config,
        count: nextCount,
        numQuestions: nextCount,
      });
      return;
    }
    const mergedCount = Math.max(
      Math.max(0, Number(current.count ?? current.numQuestions ?? 0)),
      nextCount
    );
    merged.set(key, {
      ...current,
      ...config,
      count: mergedCount,
      numQuestions: mergedCount,
    });
  });
  return Array.from(merged.values());
};

const getCustomMockScopeConfigSetKey = (configs?: CustomMockScopeConfigLike) => {
  const keys = (configs || [])
    .map((config) => getMergedCustomMockScopeConfigKey(config))
    .filter(Boolean)
    .sort();
  return keys.join('||');
};

const getCustomMockScopeConfigLikeQuestionCount = (configs?: CustomMockScopeConfigLike) =>
  (configs || []).reduce((count, config) => count + Math.max(0, Number(config?.count ?? config?.numQuestions ?? 0)), 0);

const buildPremiumCustomMockScopeDetails = (
  configs?: CustomMockScopeConfigLike,
  options?: {
    examTypeName?: string;
    className?: string;
    subjectNameById?: Record<string, string>;
    topicNameById?: Record<string, string>;
  }
) => {
  if (!Array.isArray(configs) || configs.length === 0) return [] as PremiumCustomMockScopeDetail[];

  const grouped = new Map<
    string,
    {
      examTypeName?: string;
      className?: string;
      subject: string;
      topics: Set<string>;
      subtopics: Set<string>;
      questionCount: number;
    }
  >();

  configs.forEach((config) => {
    const subjectId = String(config?.subjectId || '').trim();
    const topicId = String(config?.topicId || '').trim();
    const subject = String(config?.subjectName || '').trim()
      || options?.subjectNameById?.[subjectId]
      || 'Selected subject';
    const topic = String(config?.topicName || '').trim()
      || options?.topicNameById?.[topicId]
      || 'All topics';
    const explicitSubtopic = String(config?.subtopic || '').trim();
    const subtopicPaths = Array.isArray(config?.subtopicPaths)
      ? config.subtopicPaths.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
    const allSubtopics = [
      ...subtopicPaths,
      ...(explicitSubtopic ? [explicitSubtopic] : []),
    ];

    const groupKey = [
      String(options?.examTypeName || '').trim() || 'Not tagged',
      String(options?.className || '').trim() || 'Not tagged',
      subject,
    ].join('__');

    const current = grouped.get(groupKey) || {
      examTypeName: String(options?.examTypeName || '').trim() || 'Not tagged',
      className: String(options?.className || '').trim() || 'Not tagged',
      subject,
      topics: new Set<string>(),
      subtopics: new Set<string>(),
      questionCount: 0,
    };

    current.topics.add(topic);
    allSubtopics.forEach((entry) => current.subtopics.add(entry));
    current.questionCount += Math.max(0, Number(config?.count ?? config?.numQuestions ?? 0));
    grouped.set(groupKey, current);
  });

  return Array.from(grouped.values())
    .map((entry) => {
      const topics = Array.from(entry.topics);
      const subtopics = Array.from(entry.subtopics);
      return {
        examTypeName: entry.examTypeName,
        className: entry.className,
        subject: entry.subject,
        topics: topics.slice(0, 3),
        topicOverflowCount: Math.max(0, topics.length - 3),
        subtopics: subtopics.slice(0, 3),
        subtopicOverflowCount: Math.max(0, subtopics.length - 3),
        questionCount: entry.questionCount,
      };
    })
    .slice(0, 4);
};

const buildPremiumPracticeScopeDetails = (
  configs?: PremiumPracticeSessionPurchase['topicConfigs'],
  options?: {
    examTypeName?: string;
    className?: string;
    subjectNameById?: Record<string, string>;
    topicNameById?: Record<string, string>;
  }
) => {
  if (!Array.isArray(configs) || configs.length === 0) return [] as PremiumPracticeScopeDetail[];

  const grouped = new Map<
    string,
    {
      examTypeName?: string;
      className?: string;
      subject: string;
      topics: Set<string>;
      subtopics: Set<string>;
      questionCount: number;
    }
  >();

  configs.forEach((config) => {
    const subjectId = String(config?.subjectId || '').trim();
    const topicId = String(config?.topicId || '').trim();
    const subject = options?.subjectNameById?.[subjectId] || 'Selected subject';
    const topic = options?.topicNameById?.[topicId] || 'All topics';
    const subtopics = Array.isArray(config?.subtopics)
      ? config.subtopics.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];

    const groupKey = [
      String(options?.examTypeName || '').trim() || 'Not tagged',
      String(options?.className || '').trim() || 'Not tagged',
      subject,
    ].join('__');

    const current = grouped.get(groupKey) || {
      examTypeName: String(options?.examTypeName || '').trim() || 'Not tagged',
      className: String(options?.className || '').trim() || 'Not tagged',
      subject,
      topics: new Set<string>(),
      subtopics: new Set<string>(),
      questionCount: 0,
    };

    current.topics.add(topic);
    subtopics.forEach((entry) => current.subtopics.add(entry));
    current.questionCount += Math.max(0, Number(config?.count || 0));
    grouped.set(groupKey, current);
  });

  return Array.from(grouped.values()).map((entry) => {
    const topics = Array.from(entry.topics);
    const subtopics = Array.from(entry.subtopics);
    return {
      examTypeName: entry.examTypeName,
      className: entry.className,
      subject: entry.subject,
      topics: topics.slice(0, 3),
      topicOverflowCount: Math.max(0, topics.length - 3),
      subtopics: subtopics.slice(0, 3),
      subtopicOverflowCount: Math.max(0, subtopics.length - 3),
      questionCount: entry.questionCount,
    };
  });
};

function MyPracticePageContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [customAttemptUsageByTestId, setCustomAttemptUsageByTestId] = useState<Record<string, CustomAttemptUsage>>({});
  const syncedOfferPurchaseKeysRef = useRef<Set<string>>(new Set());

  const purchasedTestsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'users', user.uid, 'purchased_mock_tests'), orderBy('purchasedAt', 'desc'));
  }, [firestore, user?.uid]);

  const testsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'mock_tests'), orderBy('startTime', 'desc'));
  }, [firestore]);

  const customTestsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'users', user.uid, 'custom_tests'), orderBy('createdAt', 'desc'));
  }, [firestore, user?.uid]);
  const premiumPracticePurchasesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'users', user.uid, 'premium_practice_session_purchases'), orderBy('purchasedAt', 'desc'));
  }, [firestore, user?.uid]);
  const premiumMockFeaturePurchasesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'users', user.uid, 'premium_mock_feature_purchases'), orderBy('paidAt', 'desc'));
  }, [firestore, user?.uid]);
  const purchasedTeacherOffersQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'users', user.uid, 'purchased_teacher_offers'), orderBy('purchasedAt', 'desc'));
  }, [firestore, user?.uid]);
  const teacherOfferPurchasesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'users', user.uid, 'teacher_offer_purchases'), orderBy('purchasedAt', 'desc'));
  }, [firestore, user?.uid]);
  const teacherOffersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'teacher_offers'), where('status', '==', 'active')) : null),
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

  const { data: purchased, isLoading: arePurchasedLoading } = useCollection<PurchasedMockTest>(purchasedTestsQuery);
  const { data: tests, isLoading: areTestsLoading } = useCollection<MockTest>(testsQuery);
  const { data: customTests, isLoading: areCustomTestsLoading } = useCollection<StudentCustomMockTest>(customTestsQuery);
  const { data: premiumPracticePurchases, isLoading: arePremiumPracticePurchasesLoading } = useCollection<PremiumPracticeSessionPurchase>(premiumPracticePurchasesQuery);
  const { data: premiumMockFeaturePurchases, isLoading: arePremiumMockFeaturePurchasesLoading } = useCollection<PremiumMockFeaturePurchase>(premiumMockFeaturePurchasesQuery);
  const { data: purchasedTeacherOffers, isLoading: arePurchasedTeacherOffersLoading } = useCollection<TeacherOfferPurchase>(purchasedTeacherOffersQuery);
  const { data: teacherOfferPurchases, isLoading: areTeacherOfferPurchasesLoading } = useCollection<TeacherOfferPurchase>(teacherOfferPurchasesQuery);
  const { data: teacherOffers, isLoading: areTeacherOffersLoading } = useCollection<TeacherOffer>(teacherOffersQuery);
  const { data: subjects } = useCollection<LookupSubject>(subjectsQuery);
  const { data: topics } = useCollection<LookupTopic>(topicsQuery);

  const purchasedTests = useMemo(() => {
    if (!purchased || !tests) return [];

    const latestPurchaseByTest = new Map<string, string>();
    purchased.forEach((record) => {
        const testId = record.testId || record.id;
        const purchasedAt = record.purchasedAt || '';
        const prev = latestPurchaseByTest.get(testId) || '';
        if (purchasedAt >= prev) latestPurchaseByTest.set(testId, purchasedAt);
      });

    if (latestPurchaseByTest.size === 0) return [];

    return tests
      .filter((test) => latestPurchaseByTest.has(test.id) && isStandaloneMockTest(test))
      .map((test) => ({
        ...test,
        purchasedAt: latestPurchaseByTest.get(test.id) || '',
      }))
      .sort((a, b) => (b.purchasedAt || '').localeCompare(a.purchasedAt || ''));
  }, [purchased, tests]);

  const teacherOfferById = useMemo(
    () => Object.fromEntries((teacherOffers || []).map((offer) => [String(offer.id || '').trim(), offer]).filter((entry) => entry[0])),
    [teacherOffers]
  );
  const mergedTeacherOfferPurchases = useMemo(() => {
    const merged = [...(purchasedTeacherOffers || []), ...(teacherOfferPurchases || [])]
      .map((purchase) => ({ ...purchase, id: String(purchase.id || '').trim() }))
      .filter((purchase) => purchase.id && purchase.status !== 'failed');
    const deduped = new Map<string, TeacherOfferPurchase>();
    merged.forEach((purchase) => {
      const offerKey = String(purchase.offerId || purchase.teacherOfferId || '').trim();
      const dedupeKey = `${offerKey}::${purchase.id}`;
      deduped.set(dedupeKey, purchase);
    });
    return Array.from(deduped.values()).sort((a, b) => {
      const aTime = toDate(a.updatedAt)?.getTime() || toDate(a.purchasedAt)?.getTime() || 0;
      const bTime = toDate(b.updatedAt)?.getTime() || toDate(b.purchasedAt)?.getTime() || 0;
      return bTime - aTime;
    });
  }, [purchasedTeacherOffers, teacherOfferPurchases]);
  const teacherOfferPurchaseById = useMemo(
    () => Object.fromEntries(mergedTeacherOfferPurchases.map((purchase) => [purchase.id, purchase])),
    [mergedTeacherOfferPurchases]
  );
  const subjectNameById = useMemo(
    () => Object.fromEntries((subjects || []).map((subject) => [String(subject.id || '').trim(), String(subject.name || '').trim()]).filter((entry) => entry[0] && entry[1])),
    [subjects]
  );
  const topicNameById = useMemo(
    () => Object.fromEntries((topics || []).map((topic) => [String(topic.id || '').trim(), String(topic.name || '').trim()]).filter((entry) => entry[0] && entry[1])),
    [topics]
  );

  const loading = arePurchasedLoading || areTestsLoading || arePurchasedTeacherOffersLoading || areTeacherOfferPurchasesLoading || areTeacherOffersLoading;
  const customTestsLoading = areCustomTestsLoading || arePremiumMockFeaturePurchasesLoading || arePurchasedTeacherOffersLoading || areTeacherOfferPurchasesLoading || areTeacherOffersLoading;
  const studentCreatedFreeTests = useMemo(
    () => (customTests || []).filter((test) => (test.accessLevel || 'free') === 'free'),
    [customTests]
  );
  const studentCreatedPaidTests = useMemo(
    () => (customTests || []).filter((test) => (test.accessLevel || 'free') === 'paid'),
    [customTests]
  );
  const premiumPracticePurchaseCards = useMemo(() => {
    return (premiumPracticePurchases || [])
      .map((purchase) => ({ ...purchase, id: purchase.id || '' }))
      .filter((purchase) => purchase.id && purchase.status === 'paid' && purchase.teacherId)
      .sort((a, b) => {
        const aTime = toDate(a.updatedAt)?.getTime() || toDate(a.purchasedAt)?.getTime() || 0;
        const bTime = toDate(b.updatedAt)?.getTime() || toDate(b.purchasedAt)?.getTime() || 0;
        return bTime - aTime;
      });
  }, [premiumPracticePurchases]);
  const premiumPracticePurchasesLoading = arePremiumPracticePurchasesLoading || arePurchasedTeacherOffersLoading || areTeacherOfferPurchasesLoading || areTeacherOffersLoading;
  const premiumPracticeAttemptUsageByPurchaseId = useMemo(() => {
    return Object.fromEntries(
      premiumPracticePurchaseCards.map((purchase) => {
        const purchaseId = purchase.id || '';
        return [
          purchaseId,
          resolvePremiumPracticeAttemptUsage({
            attemptPricing: purchase.attemptPricing,
            attemptState: purchase.attemptState,
            purchasedAt: purchase.purchasedAt,
          }),
        ];
      })
    ) as Record<string, ReturnType<typeof resolvePremiumPracticeAttemptUsage>>;
  }, [premiumPracticePurchaseCards]);

  useEffect(() => {
    if (!firestore || !user?.uid || !customTests || customTests.length === 0) {
      setCustomAttemptUsageByTestId({});
      return;
    }
    let isCancelled = false;
    const loadUsage = async () => {
      const usageEntries = await Promise.all(
        customTests.map(async (test) => {
          if (test.attemptPricing || test.attemptState) {
            const usage = resolvePremiumCustomMockAttemptUsage({
              attemptPricing: test.attemptPricing || buildPremiumCustomMockAttemptRuleFromLegacyLimit(test.attemptLimit),
              attemptState: test.attemptState,
              purchasedAt: test.purchasedAt || test.createdAt,
            });
            return [test.id, {
              mode: usage.mode,
              usedTotal: usage.effectiveState.attemptsConsumedTotal,
              usedInCurrentInterval: usage.mode === 'interval' ? usage.effectiveState.intervalAttemptsUsed : null,
              remaining: usage.attemptsLeft,
              ruleLabel: usage.ruleLabel,
              usageLabel: usage.usageLabel,
              intervalLabel: usage.currentWindowLabel,
              actionKind: usage.actionKind,
              actionLabel: usage.actionLabel,
              actionAmount: usage.actionAmount,
              isExhausted: usage.isExhausted,
            } satisfies CustomAttemptUsage] as const;
          }

          const attemptsSnapshot = await getDocs(collection(firestore, 'users', user.uid, 'custom_tests', test.id, 'attempts'));
          const attemptDates = attemptsSnapshot.docs
            .map((docSnap) => toDate((docSnap.data() as { submittedAt?: unknown }).submittedAt))
            .filter((value): value is Date => !!value);
          const normalizedAttemptLimit = normalizeAttemptLimit(test.attemptLimit);
          return [test.id, buildCustomAttemptUsage(normalizedAttemptLimit, attemptDates)] as const;
        })
      );
      if (isCancelled) return;
      setCustomAttemptUsageByTestId(Object.fromEntries(usageEntries));
    };
    loadUsage().catch(() => {
      if (isCancelled) return;
      setCustomAttemptUsageByTestId({});
    });
    return () => {
      isCancelled = true;
    };
  }, [firestore, user?.uid, customTests]);

  useEffect(() => {
    if (!firestore || !user?.uid || mergedTeacherOfferPurchases.length === 0) {
      return;
    }

    let isCancelled = false;

    const materializeOfferEntitlements = async () => {
      for (const purchase of mergedTeacherOfferPurchases) {
        if (isCancelled) return;

        const syncKey = `${purchase.id}::${String(purchase.updatedAt || purchase.purchasedAt || '')}`;
        if (syncedOfferPurchaseKeysRef.current.has(syncKey)) continue;

        const offer = resolveTeacherOfferFromPurchase(purchase, teacherOfferById);
        const teacherId = String(purchase.teacherId || offer?.createdByTeacherId || '').trim();
        if (!offer || !teacherId) continue;

        const purchasedAtIso = (toDate(purchase.updatedAt) || toDate(purchase.purchasedAt) || new Date()).toISOString();
        const currency = String(purchase.currency || offer.currency || 'INR').trim() || 'INR';
        const offerId = String(offer.id || purchase.offerId || purchase.teacherOfferId || '').trim();

        for (const mockTest of offer.mockTests || []) {
          const mockTestId = String(mockTest?.id || '').trim();
          if (!mockTestId) continue;
          const purchasedMockTestRef = doc(firestore, 'users', user.uid, 'purchased_mock_tests', mockTestId);
          const purchasedMockTestSnap = await getDoc(purchasedMockTestRef);
          if (!purchasedMockTestSnap.exists()) {
            await setDocumentNonBlocking(
              purchasedMockTestRef,
              {
                id: mockTestId,
                testId: mockTestId,
                teacherId,
                offerId: offerId || null,
                offerPurchaseId: purchase.id,
                purchasedAt: purchasedAtIso,
              },
              { merge: true }
            );
          }
        }

        const premiumPracticePack = offer.premiumPracticePack;
        if (premiumPracticePack && Number(premiumPracticePack.totalQuestions || 0) > 0) {
          const practicePurchaseId = String(
            purchase.premiumPracticePurchaseId || buildOfferPracticePurchaseId(purchase.id)
          ).trim();
          const practicePurchaseRef = doc(firestore, 'users', user.uid, 'premium_practice_session_purchases', practicePurchaseId);
          const practicePurchaseSnap = await getDoc(practicePurchaseRef);
          const normalizedTopicConfigs = (premiumPracticePack.topicConfigs || [])
            .map((config) => ({
              subjectId: String(config.subjectId || '').trim(),
              topicId: String(config.topicId || '').trim(),
              subtopics: Array.isArray(config.subtopics) ? config.subtopics.map((value) => String(value || '').trim()).filter(Boolean) : [],
              questionBankSource: config.questionBankSource === 'teacher_official' ? 'teacher_official' : 'student_plus_official',
              questionType: config.questionType === 'MCQ' || config.questionType === 'Numerical' ? config.questionType : 'All',
              difficultyLevel: QUESTION_DIFFICULTY,
              previousYearMode: config.previousYearMode === 'pyq' ? 'pyq' : 'all',
              previousYears: Array.isArray(config.previousYears) ? config.previousYears.map((value) => String(value || '').trim()).filter(Boolean) : [],
              count: Math.max(0, Number(config.count || 0)),
            }))
            .filter((config) => config.subjectId && config.topicId && config.count > 0);
          const practiceAmount = resolveTeacherOfferPaymentAmount(
            offer,
            purchase,
            Number(premiumPracticePack.estimatedAmount || 0)
          );
          const existingPracticePurchase = practicePurchaseSnap.exists()
            ? (practicePurchaseSnap.data() as {
                includedQuestionCount?: number;
                includedTopicConfigs?: unknown;
                offerId?: string;
                offerPurchaseId?: string;
              })
            : null;

          if (!practicePurchaseSnap.exists()) {
            await setDocumentNonBlocking(
              practicePurchaseRef,
              {
                id: practicePurchaseId,
                studentId: user.uid,
                teacherId,
                teacherName: purchase.teacherName || '',
                examTypeId: String(offer.examTypeId || purchase.examTypeId || '').trim(),
                examTypeName: String(offer.examTypeName || purchase.examTypeName || '').trim(),
                classId: String(offer.classId || purchase.classId || '').trim(),
                className: String(offer.className || purchase.className || '').trim(),
                practiceMode: 'premium',
                status: 'paid',
                questionCount: Math.max(0, Number(premiumPracticePack.totalQuestions || 0)),
                questionCountByDifficulty: mergeLegacyDifficultyCounts(premiumPracticePack.questionCountByDifficulty),
                includedQuestionCount: Math.max(0, Number(premiumPracticePack.totalQuestions || 0)),
                includedQuestionCountByDifficulty: mergeLegacyDifficultyCounts(premiumPracticePack.questionCountByDifficulty),
                perQuestionPriceByDifficulty: premiumPracticePack.perQuestionPriceByDifficulty || {},
                grossAmount: practiceAmount,
                attemptsPaidAmount: 0,
                totalAmountPaid: practiceAmount,
                currency,
                questionBankSource: premiumPracticePack.questionBankSource || 'student_plus_official',
                topicConfigs: normalizedTopicConfigs,
                includedTopicConfigs: normalizedTopicConfigs,
                perQuestionTimeSeconds: Number(premiumPracticePack.perQuestionTimeSeconds || 0) > 0
                  ? Math.floor(Number(premiumPracticePack.perQuestionTimeSeconds || 0))
                  : null,
                attemptPricing: premiumPracticePack.attemptPricing || null,
                purchasedAt: purchasedAtIso,
                createdAt: purchasedAtIso,
                updatedAt: purchasedAtIso,
                offerId: offerId || null,
                offerPurchaseId: purchase.id,
              },
              { merge: true }
            );
          } else {
            const hasIncludedQuestionCount =
              Number(existingPracticePurchase?.includedQuestionCount || 0)
              >= Math.max(0, Number(premiumPracticePack.totalQuestions || 0));
            const hasIncludedTopicConfigs =
              Array.isArray(existingPracticePurchase?.includedTopicConfigs)
              && existingPracticePurchase!.includedTopicConfigs.length > 0;
            const hasOfferLinkage =
              !!String(existingPracticePurchase?.offerId || '').trim()
              || !!String(existingPracticePurchase?.offerPurchaseId || '').trim();

            if (!hasIncludedQuestionCount || !hasIncludedTopicConfigs || !hasOfferLinkage) {
              await setDocumentNonBlocking(
                practicePurchaseRef,
                {
                  questionCount: Math.max(0, Number(premiumPracticePack.totalQuestions || 0)),
                  includedQuestionCount: Math.max(0, Number(premiumPracticePack.totalQuestions || 0)),
                  includedQuestionCountByDifficulty: mergeLegacyDifficultyCounts(premiumPracticePack.questionCountByDifficulty),
                  includedTopicConfigs: normalizedTopicConfigs,
                  offerId: offerId || null,
                  offerPurchaseId: purchase.id,
                },
                { merge: true }
              );
            }
          }
        }

        const premiumCustomMockPack = offer.premiumCustomMockPack;
        if (premiumCustomMockPack && Number(premiumCustomMockPack.totalQuestions || 0) > 0) {
          const premiumMockFeatureId = String(
            purchase.premiumMockFeaturePurchaseId || buildOfferPremiumMockFeatureId(purchase.id)
          ).trim();
          const premiumMockFeatureRef = doc(firestore, 'users', user.uid, 'premium_mock_feature_purchases', premiumMockFeatureId);
          const premiumMockFeatureSnap = await getDoc(premiumMockFeatureRef);
          const premiumCustomMockIncludedQuestionCountByDifficulty = mergeLegacyDifficultyCounts({
            easy: (premiumCustomMockPack.subjectConfigs || []).reduce(
              (sum, config) => sum + Math.max(0, Number(config.count || 0)),
              0
            ),
          });
          if (!premiumMockFeatureSnap.exists()) {
            const premiumCombinationKey = buildPremiumCombinationKey(
              offer.examTypeId || purchase.examTypeId,
              offer.classId || purchase.classId
            );
            const premiumMockAmount = resolveTeacherOfferPaymentAmount(
              offer,
              purchase,
              Number(premiumCustomMockPack.estimatedAmount || 0)
            );
            await setDocumentNonBlocking(
              premiumMockFeatureRef,
              {
                id: premiumMockFeatureId,
                teacherId,
                teacherName: purchase.teacherName || '',
                examTypeId: String(offer.examTypeId || purchase.examTypeId || '').trim(),
                examTypeName: String(offer.examTypeName || purchase.examTypeName || '').trim(),
                classId: String(offer.classId || purchase.classId || '').trim(),
                className: String(offer.className || purchase.className || '').trim(),
                premiumCombinationKey,
                premiumCustomMockTestId: '',
                testTitle: String(premiumCustomMockPack.title || offer.title || 'Premium Custom Mock Access').trim(),
                amount: premiumMockAmount,
                questionCount: Math.max(0, Number(premiumCustomMockPack.totalQuestions || 0)),
                includedQuestionCount: Math.max(0, Number(premiumCustomMockPack.totalQuestions || 0)),
                includedQuestionCountByDifficulty: premiumCustomMockIncludedQuestionCountByDifficulty,
                questionAmountPaid: premiumMockAmount,
                attemptAmountPaid: 0,
                currency,
                questionBankSource: premiumCustomMockPack.questionBankSource || 'student_plus_official',
                duration: Number(premiumCustomMockPack.duration || 0) > 0 ? Number(premiumCustomMockPack.duration || 0) : null,
                marksPerQuestion: Number(premiumCustomMockPack.marksPerQuestion || 0) > 0 ? Number(premiumCustomMockPack.marksPerQuestion || 0) : null,
                negativeMarksPerQuestion: Number(premiumCustomMockPack.negativeMarksPerQuestion || 0) >= 0
                  ? Number(premiumCustomMockPack.negativeMarksPerQuestion || 0)
                  : null,
                attemptPricing: premiumCustomMockPack.attemptPricing || null,
                subjectConfigs: premiumCustomMockPack.subjectConfigs || [],
                includedSubjectConfigs: premiumCustomMockPack.subjectConfigs || [],
                paidAt: purchasedAtIso,
                createdAt: purchasedAtIso,
                updatedAt: purchasedAtIso,
                status: 'paid',
                offerId: offerId || null,
                offerPurchaseId: purchase.id,
              },
              { merge: true }
            );
          } else {
            const existingPremiumFeaturePurchase = premiumMockFeatureSnap.data() as PremiumMockFeaturePurchase | undefined;
            const hasIncludedQuestionCount =
              getPremiumCustomMockIncludedQuestionCountFromRecord(existingPremiumFeaturePurchase)
              >= Math.max(0, Number(premiumCustomMockPack.totalQuestions || 0));
            const hasIncludedSubjectConfigs =
              Array.isArray(existingPremiumFeaturePurchase?.includedSubjectConfigs)
              && existingPremiumFeaturePurchase!.includedSubjectConfigs!.length > 0;
            const hasOfferLinkage = isOfferBackedPremiumFeatureRecord(existingPremiumFeaturePurchase);
            if (!hasIncludedQuestionCount || !hasIncludedSubjectConfigs || !hasOfferLinkage) {
              await setDocumentNonBlocking(
                premiumMockFeatureRef,
                {
                  questionCount: Math.max(0, Number(premiumCustomMockPack.totalQuestions || 0)),
                  includedQuestionCount: Math.max(0, Number(premiumCustomMockPack.totalQuestions || 0)),
                  includedQuestionCountByDifficulty: premiumCustomMockIncludedQuestionCountByDifficulty,
                  includedSubjectConfigs: premiumCustomMockPack.subjectConfigs || [],
                  offerId: offerId || null,
                  offerPurchaseId: purchase.id,
                },
                { merge: true }
              );
            }
          }
        }

        syncedOfferPurchaseKeysRef.current.add(syncKey);
      }
    };

    materializeOfferEntitlements().catch(() => {
      // Leave the UI on direct purchases if offer hydration fails.
    });

    return () => {
      isCancelled = true;
    };
  }, [firestore, mergedTeacherOfferPurchases, teacherOfferById, user?.uid]);

  const premiumCustomMockAccessCards = useMemo(() => {
    const purchaseCards = (premiumMockFeaturePurchases || [])
      .map((purchase) => ({
        ...purchase,
        id: String(purchase.id || '').trim(),
        offerPurchaseId: resolveOfferPurchaseIdFromPremiumFeatureRecord(purchase),
        premiumCombinationKey: String(
          purchase.premiumCombinationKey
          || buildPremiumCombinationKey(purchase.examTypeId, purchase.classId)
        ).trim(),
      }))
      .filter((purchase) => purchase.id && purchase.status === 'paid' && purchase.teacherId)
      .sort((a, b) => {
        const aTime = toDate(a.updatedAt)?.getTime() || toDate(a.paidAt)?.getTime() || toDate(a.purchasedAt)?.getTime() || 0;
        const bTime = toDate(b.updatedAt)?.getTime() || toDate(b.paidAt)?.getTime() || toDate(b.purchasedAt)?.getTime() || 0;
        return bTime - aTime;
      })
      .map((purchase) => {
        const isOfferBacked = isOfferBackedPremiumFeatureRecord(purchase);
        const isAdminAssigned = isAdminAssignedPremiumFeatureRecord(purchase);
        const linkedOfferPurchase = purchase.offerPurchaseId
          ? teacherOfferPurchaseById[purchase.offerPurchaseId]
          : undefined;
        const linkedOffer = linkedOfferPurchase
          ? resolveTeacherOfferFromPurchase(linkedOfferPurchase, teacherOfferById)
          : null;
        const linkedTests = studentCreatedPaidTests.filter((test) => {
          const testPremiumFeaturePurchaseId = String(test.premiumFeaturePurchaseId || '').trim();
          const testOfferPurchaseId = String(test.offerPurchaseId || '').trim();
          return (
            testPremiumFeaturePurchaseId === purchase.id
            || (!!purchase.offerPurchaseId && testOfferPurchaseId === purchase.offerPurchaseId)
          );
        });
        const includedScopeConfigs =
          Array.isArray(purchase.includedSubjectConfigs) && purchase.includedSubjectConfigs.length > 0
            ? purchase.includedSubjectConfigs
            : linkedOffer?.premiumCustomMockPack?.subjectConfigs || [];
        const normalizedIncludedQuestionIds = normalizeCustomMockQuestionIdList(purchase.includedQuestionIds);
        const questionCount = Math.max(
          0,
          getPremiumCustomMockIncludedQuestionCountFromRecord(purchase)
        );
        const consumedIncludedQuestionCount = Array.from(
          new Set(
            linkedTests.flatMap((test) => {
              const explicitIncludedIds = Array.isArray(test.includedQuestionIds)
                ? test.includedQuestionIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
                : [];
              if (explicitIncludedIds.length > 0) return explicitIncludedIds.map((entry) => entry.trim());
              const consumedCount = getConsumedIncludedQuestionCountFromSavedTest(test);
              const savedIds = Array.isArray(test.config?.questionIds)
                ? test.config.questionIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
                : [];
              return savedIds.slice(0, consumedCount);
            })
          )
        ).length;
        const linkedMockCount = linkedTests.length;
        const usedQuestionCount = isOfferBacked ? linkedMockCount : consumedIncludedQuestionCount;
        const remainingQuestionCount = isOfferBacked
          ? questionCount
          : Math.max(0, questionCount - consumedIncludedQuestionCount);
        return {
          id: purchase.id || '',
          teacherId: String(purchase.teacherId || '').trim(),
          teacherName: String(purchase.teacherName || '').trim(),
          premiumFeaturePurchaseId: purchase.id || '',
          examTypeId: String(purchase.examTypeId || '').trim(),
          examTypeName: purchase.examTypeName || '',
          classId: String(purchase.classId || '').trim(),
          className: purchase.className || '',
          premiumCombinationKey: String(purchase.premiumCombinationKey || '').trim(),
          title: (
            isAdminAssigned
              ? 'Custom Mock Test'
              : (
                String(linkedOffer?.title || '').trim()
            || String(purchase.testTitle || '').trim()
            || 'Premium Custom Mock Access'
              )
          ),
          offerTitle: String(linkedOffer?.title || '').trim() || undefined,
          paidAt: purchase.updatedAt || purchase.paidAt || purchase.purchasedAt || purchase.createdAt,
          amount: Number(purchase.amount ?? purchase.questionAmountPaid ?? 0),
          questionCount,
          usedQuestionCount,
          remainingQuestionCount,
          linkedMockCount,
          currency: purchase.currency || 'INR',
          sourceLabel: isAdminAssigned ? 'Custom mock access' : isOfferBacked ? 'From purchased offer' : 'Premium access unlocked',
          isOfferBacked,
          isAdminAssigned,
          premiumFeaturePurchaseIds: purchase.id ? [purchase.id] : [],
          includedQuestionIds: normalizedIncludedQuestionIds,
          includedScopeConfigs: includedScopeConfigs,
          scopeDetails: buildPremiumCustomMockScopeDetails(
            includedScopeConfigs,
            {
              examTypeName: purchase.examTypeName || '',
              className: purchase.className || '',
              subjectNameById,
              topicNameById,
            }
          ),
        } satisfies PremiumCustomMockAccessCard;
      })
      .filter((card) => card.questionCount > 0);

    const groupedAdminCards = Array.from(
      purchaseCards
        .filter((card) => card.isAdminAssigned)
        .reduce((map, card) => {
          const scopeSetKey = getCustomMockScopeConfigSetKey(card.includedScopeConfigs);
          const key = [
            String(card.teacherId || '').trim(),
            String(card.examTypeId || '').trim(),
            String(card.classId || '').trim(),
            scopeSetKey || `purchase:${String(card.premiumFeaturePurchaseId || card.id || '').trim()}`,
          ].join('__');
          const existing = map.get(key) || [];
          existing.push(card);
          map.set(key, existing);
          return map;
        }, new Map<string, PremiumCustomMockAccessCard[]>())
        .values()
    )
      .map((cards) => {
        const sortedCards = [...cards].sort((a, b) => {
          const aTime = toDate(a.paidAt)?.getTime() || 0;
          const bTime = toDate(b.paidAt)?.getTime() || 0;
          return bTime - aTime;
        });
        const firstCard = sortedCards[0];
        const mergedIncludedQuestionIds = Array.from(
          new Set(
            sortedCards.flatMap((card) => card.includedQuestionIds || [])
          )
        );
        const mergedScopeConfigs = mergeCustomMockScopeConfigs(
          sortedCards.flatMap((card) => card.includedScopeConfigs || [])
        );
        const mergedQuestionCount = mergedIncludedQuestionIds.length > 0
          ? mergedIncludedQuestionIds.length
          : Math.max(
              getCustomMockScopeConfigLikeQuestionCount(mergedScopeConfigs),
              ...sortedCards.map((card) => Math.max(0, Number(card.questionCount || 0)))
            );
        const adjustedMergedScopeConfigs = (
          mergedIncludedQuestionIds.length > 0 && mergedScopeConfigs.length === 1
            ? mergedScopeConfigs.map((config) => ({
                ...config,
                count: mergedQuestionCount,
                numQuestions: mergedQuestionCount,
              }))
            : mergedScopeConfigs
        );
        const mergedScopeDetails = buildPremiumCustomMockScopeDetails(
          adjustedMergedScopeConfigs,
          {
            examTypeName: firstCard.examTypeName || '',
            className: firstCard.className || '',
            subjectNameById,
            topicNameById,
          }
        );
        const linkedMockCount = sortedCards.reduce((sum, card) => sum + Math.max(0, Number(card.linkedMockCount || 0)), 0);
        const mergedPurchaseIds = Array.from(
          new Set(
            sortedCards.flatMap((card) => card.premiumFeaturePurchaseIds || (card.premiumFeaturePurchaseId ? [card.premiumFeaturePurchaseId] : []))
          )
        );

        return {
          ...firstCard,
          id: `admin__${firstCard.teacherId}__${firstCard.examTypeId}__${firstCard.classId}__${getCustomMockScopeConfigSetKey(adjustedMergedScopeConfigs) || mergedPurchaseIds.join('|') || firstCard.premiumFeaturePurchaseId || firstCard.id}`,
          title: 'Custom Mock Test',
          sourceLabel: 'Custom mock access',
          questionCount: mergedQuestionCount,
          usedQuestionCount: linkedMockCount,
          remainingQuestionCount: mergedQuestionCount,
          linkedMockCount,
          premiumFeaturePurchaseId: firstCard.premiumFeaturePurchaseId,
          premiumFeaturePurchaseIds: mergedPurchaseIds,
          includedQuestionIds: mergedIncludedQuestionIds,
          includedScopeConfigs: adjustedMergedScopeConfigs,
          scopeDetails: mergedScopeDetails,
        } satisfies PremiumCustomMockAccessCard;
      })
      .filter((card) => card.questionCount > 0);

    const groupedByTeacher = new Map<string, PremiumCustomMockAccessCard[]>();
    purchaseCards
      .filter((card) => !card.isAdminAssigned)
      .forEach((card) => {
      const key = String(card.teacherId || '').trim();
      if (!key) return;
      const existing = groupedByTeacher.get(key) || [];
      existing.push(card);
      groupedByTeacher.set(key, existing);
    });

    const groupedTeacherCards = Array.from(groupedByTeacher.values()).map((teacherCards) => {
      const firstCard = teacherCards[0];
      const scopeMap = new Map<string, {
        examTypeName?: string;
        className?: string;
        subject: string;
        topics: Set<string>;
        subtopics: Set<string>;
        questionCount: number;
      }>();

      teacherCards.flatMap((card) => card.scopeDetails).forEach((scope) => {
        const examTypeName = String(scope.examTypeName || '').trim() || 'Not tagged';
        const className = String(scope.className || '').trim() || 'Not tagged';
        const subject = String(scope.subject || '').trim() || 'Selected subject';
        const scopeKey = [examTypeName, className, subject].join('__');
        const current = scopeMap.get(scopeKey) || {
          examTypeName,
          className,
          subject,
          topics: new Set<string>(),
          subtopics: new Set<string>(),
          questionCount: 0,
        };
        scope.topics.forEach((topic) => current.topics.add(topic));
        scope.subtopics.forEach((subtopic) => current.subtopics.add(subtopic));
        current.questionCount += Math.max(0, Number(scope.questionCount || 0));
        scopeMap.set(scopeKey, current);
      });

      const mergedScopeDetails: PremiumCustomMockScopeDetail[] = Array.from(scopeMap.values()).map((scope) => {
        const topics = Array.from(scope.topics);
        const subtopics = Array.from(scope.subtopics);
        return {
          examTypeName: scope.examTypeName,
          className: scope.className,
          subject: scope.subject,
          topics: topics.slice(0, 3),
          topicOverflowCount: Math.max(0, topics.length - 3),
          subtopics: subtopics.slice(0, 3),
          subtopicOverflowCount: Math.max(0, subtopics.length - 3),
          questionCount: scope.questionCount,
        };
      });

      const questionCount = teacherCards.reduce((sum, card) => sum + card.questionCount, 0);
      const linkedMockCount = teacherCards.reduce((sum, card) => sum + card.linkedMockCount, 0);
      const isOfferBacked = teacherCards.every((card) => card.isOfferBacked);
      const usedQuestionCount = isOfferBacked
        ? linkedMockCount
        : teacherCards.reduce((sum, card) => sum + card.usedQuestionCount, 0);
      const remainingQuestionCount = isOfferBacked
        ? questionCount
        : Math.max(0, questionCount - usedQuestionCount);

      return {
        ...firstCard,
        id: `teacher__${firstCard.teacherId}`,
        premiumFeaturePurchaseId: undefined,
        title: 'Purchased Custom Mock Questions',
        offerTitle: teacherCards.length === 1 ? firstCard.offerTitle : undefined,
        questionCount,
        usedQuestionCount,
        remainingQuestionCount,
        linkedMockCount,
        sourceLabel: isOfferBacked ? 'From purchased offer' : 'Purchased premium balance',
        isOfferBacked,
        isAdminAssigned: false,
        scopeDetails: mergedScopeDetails,
      } satisfies PremiumCustomMockAccessCard;
    }).filter((card) => card.questionCount > 0);

    return [...groupedAdminCards, ...groupedTeacherCards];
  }, [
    premiumMockFeaturePurchases,
    studentCreatedPaidTests,
    teacherOfferById,
    teacherOfferPurchaseById,
    subjectNameById,
    topicNameById,
  ]);

  const heroPrimaryButtonClass =
    'h-12 rounded-full px-6 font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 shadow-[0_14px_30px_-16px_rgba(56,189,248,0.9)] transition-all hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400 hover:shadow-[0_18px_36px_-16px_rgba(56,189,248,1)]';
  const heroSecondaryButtonClass =
    'h-12 rounded-full px-6 border border-slate-500/60 bg-slate-900/70 text-slate-100 backdrop-blur-sm transition-all hover:border-cyan-300/60 hover:bg-cyan-500/10 hover:text-cyan-100';
  const cardPrimaryButtonClass =
    'h-10 rounded-full border border-cyan-300/35 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-400 px-4 font-medium text-slate-950 shadow-[0_10px_24px_-12px_rgba(56,189,248,0.85)] transition-all hover:from-cyan-300 hover:via-sky-300 hover:to-blue-300 hover:shadow-[0_14px_30px_-12px_rgba(56,189,248,0.95)]';
  const cardSecondaryButtonClass =
    'h-10 rounded-full border border-slate-600/80 bg-slate-900/75 text-slate-100 transition-all hover:border-cyan-300/50 hover:bg-cyan-500/10 hover:text-cyan-100';

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="My Practice" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="grid gap-6">
          <Card className="overflow-hidden border-border/70 bg-gradient-to-r from-sky-950/70 via-blue-950/40 to-indigo-950/60">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="space-y-3">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Performance Lab
                  </p>
                  <h2 className="text-2xl font-semibold md:text-3xl">Train Smarter. Score Higher. Stay Exam Ready.</h2>
                  <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                    Build a winning routine with exam-matched mocks, timed attempts, and custom practice designed around your real syllabus.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button asChild size="lg" className={heroPrimaryButtonClass}>
                      <Link href="/mock-tests">
                        Explore Exams <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className={heroSecondaryButtonClass}>
                      <Link href="/dcam-practice-session">
                        Start Practice Session <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className={heroSecondaryButtonClass}>
                      <Link href="/dcam-custom-mock">
                        Custom Mock Test <SlidersHorizontal className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 md:w-[360px]">
                  <div className="rounded-xl border border-blue-300/20 bg-blue-500/10 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-blue-200">Goal</p>
                    <p className="mt-1 text-sm font-semibold">Rank-Level Accuracy</p>
                  </div>
                  <div className="rounded-xl border border-indigo-300/20 bg-indigo-500/10 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-indigo-200">Unlocked</p>
                    <p className="mt-1 text-sm font-semibold">{purchasedTests.length}</p>
                  </div>
                  <div className="rounded-xl border border-sky-300/20 bg-sky-500/10 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-sky-200">Format</p>
                    <p className="mt-1 text-sm font-semibold">Exam Simulation</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-border/70 bg-gradient-to-b from-slate-900/70 to-slate-950/70 shadow-xl lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-xl">Your Premium Test Library</CardTitle>
                <CardDescription>Open your unlocked mock tests from one place.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-36 w-full" />
                    <Skeleton className="h-36 w-full" />
                  </div>
                ) : purchasedTests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-8 text-center text-muted-foreground">
                    <Target className="mx-auto mb-3 h-6 w-6" />
                    <p className="font-medium">No premium mock tests yet.</p>
                    <p className="mt-1 text-sm">Your unlocked tests will appear here.</p>
                    <div className="mt-4 flex justify-center">
                      <Button asChild className={cardPrimaryButtonClass}>
                        <Link href="/mock-tests">
                          Explore Premium Mocks <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {purchasedTests.map((test) => (
                      <Card key={test.id} className="group relative overflow-hidden border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-blue-950/75 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-sky-400/50 hover:shadow-sky-950/40">
                        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(56,189,248,0.2),transparent_48%)]" />
                        </div>
                        {(test.thumbnailUrl || test.imageUrl) ? (
                          <div className="relative h-32 w-full overflow-hidden border-b border-border/60">
                            <img src={test.thumbnailUrl || test.imageUrl} alt={test.title || 'Mock test'} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                          </div>
                        ) : null}
                        <CardContent className="relative pt-5 space-y-3">
                          <div className="space-y-2">
                            <p className="line-clamp-2 text-2xl font-semibold leading-tight tracking-tight">{test.title || 'Untitled Mock Test'}</p>
                            <p className="text-xs text-slate-300">
                              Unlocked on: {test.purchasedAt ? new Date(test.purchasedAt).toLocaleString() : 'N/A'}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-muted-foreground">
                              Questions
                              <p className="mt-1 text-sm font-semibold text-foreground">{test.config?.questionIds?.length || 0}</p>
                            </div>
                            <div className="rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-muted-foreground">
                              Duration
                              <p className="mt-1 text-sm font-semibold text-foreground">{formatTestDurationLabel(test.config?.duration)}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <Badge className={test.accessLevel === 'paid' ? 'border-red-400/60 bg-red-500/20 text-red-100' : 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'}>
                              {test.accessLevel === 'paid' ? 'Paid' : 'Free'}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Button asChild variant="outline" className={cardSecondaryButtonClass}>
                              <Link href={`/mock-tests/${test.id}`}>
                                View Test
                              </Link>
                            </Button>
                            <Button asChild variant="outline" className={cardSecondaryButtonClass}>
                              <Link href={`/mock-tests/${test.id}/my-attempts`}>
                                Attempt History
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          <Card className="border-border/70 bg-gradient-to-b from-slate-900/70 via-slate-950/80 to-cyan-950/30 shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl">Reusable Practice Access</CardTitle>
              <CardDescription>
                Review your reusable practice scope here, then open the builder to create or update premium practice sessions with those questions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {premiumPracticePurchasesLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : premiumPracticePurchaseCards.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-8 text-center text-muted-foreground">
                  <Crown className="mx-auto mb-3 h-6 w-6" />
                  <p className="font-medium">No reusable practice access found yet.</p>
                  <p className="mt-1 text-sm">Purchased or admin-assigned premium practice access will appear here.</p>
                  <div className="mt-4 flex justify-center">
                    <Button asChild className={cardPrimaryButtonClass}>
                      <Link href="/dcam-practice-session">
                        Explore Premium Practice <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 justify-items-start md:grid-cols-2 xl:grid-cols-3">
                  {premiumPracticePurchaseCards.map((purchase) => {
                    const purchaseId = purchase.id || '';
                    const editHref = `/start-practice-session/${encodeURIComponent(purchase.teacherId || '')}?practiceMode=premium&premiumPurchaseId=${encodeURIComponent(purchaseId)}`;
                    const attemptUsage = premiumPracticeAttemptUsageByPurchaseId[purchaseId];
                    const isReusableAccess = isReusablePremiumPracticeRecord(purchase);
                    const isAdminAssigned = isAdminAssignedPremiumPracticeRecord(purchase);
                    const scopeDetails = buildPremiumPracticeScopeDetails(
                      (isReusableAccess && Array.isArray(purchase.includedTopicConfigs) && purchase.includedTopicConfigs.length > 0)
                        ? purchase.includedTopicConfigs
                        : purchase.topicConfigs,
                      {
                        examTypeName: purchase.examTypeName || '',
                        className: purchase.className || '',
                        subjectNameById,
                        topicNameById,
                      }
                    );
                    const hasTopicConfigs = Array.isArray(purchase.topicConfigs) && purchase.topicConfigs.length > 0;
                    const hasLimitedAttempts = attemptUsage?.attemptsLeft !== null;
                    const primaryHref = isReusableAccess
                      ? editHref
                      : (!hasTopicConfigs || attemptUsage?.isExhausted ? editHref : buildPremiumPracticeSessionHref(purchase));
                    const attemptsLeftLabel = hasLimitedAttempts ? String(attemptUsage?.attemptsLeft ?? 0) : '';
                    const primaryLabel = isReusableAccess
                      ? 'Open Practice Builder'
                      : (hasTopicConfigs
                        ? formatPremiumPracticeAttemptActionButtonLabel(attemptUsage, 'Continue Practice')
                        : 'Open Practice Setup');
                    const includedQuestionCount = Math.max(
                      isReusableAccess
                        ? getPremiumPracticeIncludedQuestionCountFromRecord(purchase)
                        : Math.max(0, Number(purchase.questionCount ?? 0))
                    );
                    const timePerQuestionLabel = Number(purchase.perQuestionTimeSeconds || 0) > 0
                      ? `${Math.floor(Number(purchase.perQuestionTimeSeconds || 0))} sec / question`
                      : 'No timer';
                    return (
                      <Card key={purchaseId} className="group relative w-full max-w-sm overflow-hidden border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-cyan-950/75 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:shadow-cyan-950/40">
                        <CardContent className="relative space-y-4 pt-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {isReusableAccess ? (
                              <Badge variant="outline" className="border-cyan-300/45 bg-cyan-500/10 text-cyan-100">
                                {isAdminAssigned ? 'Practice access' : 'From purchased offer'}
                              </Badge>
                            ) : null}
                            {purchase.teacherName ? (
                              <Badge variant="outline" className="border-slate-600/80 bg-slate-900/75 text-slate-200">
                                {purchase.teacherName}
                              </Badge>
                            ) : null}
                            {hasLimitedAttempts ? (
                              <Badge variant="outline" className="border-emerald-300/35 bg-emerald-500/10 text-emerald-100">
                                {attemptsLeftLabel} attempts left
                              </Badge>
                            ) : null}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Exam</p>
                              <p className="mt-1 text-base font-semibold text-white">{purchase.examTypeName || 'Selected exam'}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Curriculum</p>
                              <p className="mt-1 text-base font-semibold text-white">{purchase.className || 'Selected curriculum'}</p>
                            </div>
                            <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">
                                {isReusableAccess ? 'Reusable Questions' : 'Questions'}
                              </p>
                              <p className="mt-1 text-base font-semibold text-white">{includedQuestionCount}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Time / question</p>
                              <p className="mt-1 text-base font-semibold text-white">{timePerQuestionLabel}</p>
                            </div>
                          </div>

                          {scopeDetails.length > 0 ? (
                            <div className="space-y-2">
                              {scopeDetails.map((scope) => (
                                <div
                                  key={`${purchaseId}-${scope.subject}-${scope.topics.join('|')}-${scope.subtopics.join('|')}`}
                                  className="rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-2">
                                      <div>
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Subject</p>
                                        <p className="truncate text-base font-semibold text-white">{scope.subject}</p>
                                      </div>
                                      <div>
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Topic</p>
                                        <p className="text-sm text-slate-200">
                                          {scope.topics.join(', ')}{scope.topicOverflowCount > 0 ? ` +${scope.topicOverflowCount} more` : ''}
                                        </p>
                                      </div>
                                      {scope.subtopics.length > 0 ? (
                                        <div>
                                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Subtopic</p>
                                          <p className="text-sm text-slate-300">
                                            {scope.subtopics.join(', ')}{scope.subtopicOverflowCount > 0 ? ` +${scope.subtopicOverflowCount} more` : ''}
                                          </p>
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-right">
                                      <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Questions</p>
                                      <p className="mt-1 text-lg font-semibold text-white">{scope.questionCount}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <div className="grid grid-cols-1 gap-2">
                            {attemptUsage?.isExhausted && attemptUsage.actionKind === 'none' ? (
                              <Button className={cardPrimaryButtonClass} disabled>
                                Attempts Exhausted <PlayCircle className="ml-2 h-4 w-4" />
                              </Button>
                            ) : (
                              <Button asChild className={cardPrimaryButtonClass}>
                                <Link href={primaryHref}>
                                  {primaryLabel} <PlayCircle className="ml-2 h-4 w-4" />
                                </Link>
                              </Button>
                            )}
                            {!isReusableAccess ? (
                              <Button asChild variant="outline" className={cardSecondaryButtonClass}>
                                <Link href={editHref}>
                                  Edit and Add Questions
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="customized-paid-tests" className="border-border/70 bg-gradient-to-b from-slate-900/70 via-slate-950/80 to-amber-950/30 shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl">Premium Custom Mocks</CardTitle>
              <CardDescription>
                Use your reusable questions to create premium custom mocks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {premiumCustomMockAccessCards.length > 0 ? (
                <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {premiumCustomMockAccessCards.map((card) => {
                    const paidAt = toDate(card.paidAt);
                    const createParams = new URLSearchParams({
                      mode: 'premium',
                      teacherId: card.teacherId,
                    });
                    if (card.premiumFeaturePurchaseId) {
                      createParams.set('premiumFeaturePurchaseId', card.premiumFeaturePurchaseId);
                    }
                    if (Array.isArray(card.premiumFeaturePurchaseIds) && card.premiumFeaturePurchaseIds.length > 0) {
                      createParams.set('premiumFeaturePurchaseIds', card.premiumFeaturePurchaseIds.join(','));
                    }
                    if (card.examTypeId) {
                      createParams.set('examTypeId', card.examTypeId);
                    }
                    if (card.examTypeName) {
                      createParams.set('examTypeName', card.examTypeName);
                    }
                    if (card.classId) {
                      createParams.set('classId', card.classId);
                    }
                    if (card.className) {
                      createParams.set('className', card.className);
                    }
                    const startHref = `/custom-mock-tests/create?${createParams.toString()}`;
                    const libraryParams = new URLSearchParams();
                    if (card.premiumFeaturePurchaseId) {
                      libraryParams.set('premiumFeaturePurchaseId', card.premiumFeaturePurchaseId);
                    }
                    if (Array.isArray(card.premiumFeaturePurchaseIds) && card.premiumFeaturePurchaseIds.length > 0) {
                      libraryParams.set('premiumFeaturePurchaseIds', card.premiumFeaturePurchaseIds.join(','));
                    }
                    if (card.examTypeId) {
                      libraryParams.set('examTypeId', card.examTypeId);
                    }
                    if (card.classId) {
                      libraryParams.set('classId', card.classId);
                    }
                    if (card.examTypeName) {
                      libraryParams.set('examTypeName', card.examTypeName);
                    }
                    if (card.className) {
                      libraryParams.set('className', card.className);
                    }
                    const libraryHref = `/premium-mock-test/${encodeURIComponent(card.teacherId)}${libraryParams.toString() ? `?${libraryParams.toString()}` : ''}`;
                    const usedPercent = !card.isOfferBacked && card.questionCount > 0
                      ? Math.min(100, Math.round((card.usedQuestionCount / card.questionCount) * 100))
                      : 0;
                    return (
                      <Card key={card.id} className="overflow-hidden border-emerald-300/20 bg-gradient-to-b from-slate-900/95 via-slate-900/88 to-emerald-950/35 shadow-[0_20px_46px_-28px_rgba(16,185,129,0.55)]">
                        <CardContent className="space-y-3 pt-5">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="border-emerald-300/45 bg-emerald-500/15 text-emerald-100">
                                    {card.sourceLabel}
                                  </Badge>
                                  {card.teacherName ? (
                                    <Badge variant="outline" className="border-slate-600/80 bg-slate-900/75 text-slate-200">
                                      {card.teacherName}
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="line-clamp-2 text-xl font-semibold leading-tight tracking-tight text-white">
                                  {card.title}
                                </p>
                                <p className="text-sm text-emerald-100/85">
                                  {card.isAdminAssigned
                                    ? 'Use the same reusable questions across multiple premium mocks.'
                                    : card.isOfferBacked
                                    ? 'Use the same purchased questions across multiple premium mocks.'
                                    : 'Questions saved from your purchases.'}
                                </p>
                              </div>
                              <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-right">
                                <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/70">
                                  {card.isOfferBacked ? 'Reusable' : 'Remaining'}
                                </p>
                                <p className="mt-1 text-3xl font-semibold text-emerald-50">
                                  {card.isOfferBacked ? card.questionCount : card.remainingQuestionCount}
                                </p>
                              </div>
                            </div>
                            {card.scopeDetails.length > 0 ? (
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/75">
                                Where You Can Use These Questions
                              </p>
                            ) : null}
                            {card.scopeDetails.length > 0 ? (
                              <div className="grid gap-2 md:grid-cols-2">
                                {card.scopeDetails.map((scope) => (
                                  <div key={`${card.id}-${scope.examTypeName}-${scope.className}-${scope.subject}`} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/75">Questions</p>
                                      <p className="text-xs text-emerald-100/80">{scope.questionCount} questions</p>
                                    </div>
                                    <p className="mt-3 text-xs text-slate-300">Exam: {scope.examTypeName || 'Not tagged'}</p>
                                    <p className="mt-1 text-xs text-slate-300">Curriculum: {scope.className || 'Not tagged'}</p>
                                    <p className="mt-1 text-xs text-slate-300">Subject: {scope.subject}</p>
                                    <p className="mt-2 text-xs text-slate-300">
                                      Topic: {scope.topics.join(', ')}{scope.topicOverflowCount > 0 ? ` +${scope.topicOverflowCount} more` : ''}
                                    </p>
                                    {scope.subtopics.length > 0 ? (
                                      <p className="mt-1 text-xs text-slate-300">
                                        Subtopic: {scope.subtopics.join(', ')}{scope.subtopicOverflowCount > 0 ? ` +${scope.subtopicOverflowCount} more` : ''}
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <p className="font-medium text-white">
                                  {card.isOfferBacked ? 'Reusable access' : 'Used so far'}
                                </p>
                                <p className="text-cyan-50/85">
                                  {card.isOfferBacked
                                    ? `${card.questionCount} question${card.questionCount === 1 ? '' : 's'} included`
                                    : `${card.usedQuestionCount} of ${card.questionCount} used`}
                                </p>
                              </div>
                              {card.isOfferBacked ? (
                                <p className="mt-3 text-xs text-slate-300">
                                  Reusable in {card.linkedMockCount} premium mock{card.linkedMockCount === 1 ? '' : 's'} already linked to this purchase.
                                </p>
                              ) : (
                                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800/90">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 transition-all"
                                    style={{ width: `${usedPercent}%` }}
                                  />
                                </div>
                              )}
                              <p className="mt-2 text-xs text-slate-300">
                                {paidAt ? `Purchased on ${paidAt.toLocaleDateString()}` : 'Premium mock access saved'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-muted-foreground">
                              {card.isOfferBacked ? 'Created Mocks' : 'Used'}
                              <p className="mt-1 text-sm font-semibold text-foreground">
                                {card.isOfferBacked ? card.linkedMockCount : card.usedQuestionCount}
                              </p>
                            </div>
                            <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-emerald-100/85">
                              {card.isOfferBacked ? 'Reusable Questions' : 'Left'}
                              <p className="mt-1 text-sm font-semibold text-emerald-50">
                                {card.isOfferBacked ? card.questionCount : card.remainingQuestionCount}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Button
                              asChild
                              className="h-10 rounded-full border border-emerald-300/35 bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 px-4 font-medium text-slate-950 shadow-[0_10px_24px_-12px_rgba(45,212,191,0.8)] transition-all hover:from-emerald-200 hover:via-teal-200 hover:to-cyan-200"
                            >
                              <Link href={startHref}>
                                Create Premium Mock <Rocket className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                            <Button asChild variant="outline" className={cardSecondaryButtonClass}>
                              <Link href={libraryHref}>
                                Open Mock Library
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : null}
              {customTestsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-36 w-full" />
                </div>
              ) : studentCreatedPaidTests.length === 0 && premiumCustomMockAccessCards.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-8 text-center text-muted-foreground">
                  <Crown className="mx-auto mb-3 h-6 w-6" />
                  <p className="font-medium">No premium customized mocks created yet.</p>
                  <p className="mt-1 text-sm">Create your first premium custom mock to begin focused high-impact practice.</p>
                  <div className="mt-4 flex justify-center">
                    <Button asChild className={cardPrimaryButtonClass}>
                      <Link href="/dcam-custom-mock">
                        Create Premium Custom Mock <Rocket className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : studentCreatedPaidTests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-8 text-center text-muted-foreground">
                  <Crown className="mx-auto mb-3 h-6 w-6" />
                  <p className="font-medium">Premium custom-mock access is ready.</p>
                  <p className="mt-1 text-sm">Use your purchased balance card above to build the next premium custom mock.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {studentCreatedPaidTests.map((test) => (
                    (() => {
                      const usage = customAttemptUsageByTestId[test.id];
                      const hasLimitedAttempts = !!usage && usage.mode !== 'unlimited';
                      const attemptsLeftLabel = usage ? (usage.remaining === null ? 'Unlimited' : String(usage.remaining)) : '-';
                      const savedScopeDetails = buildPremiumCustomMockScopeDetails(
                        Array.isArray(test.config?.subjectConfigs) && test.config.subjectConfigs.length > 0
                          ? test.config.subjectConfigs
                          : test.includedSubjectConfigs,
                        {
                          examTypeName: test.examTypeName || '',
                          className: test.className || '',
                          subjectNameById,
                          topicNameById,
                        }
                      );
                      const premiumPrimaryHref = usage?.isExhausted
                        ? `/custom-mock-tests/create?editTestId=${encodeURIComponent(test.id)}&mode=premium`
                        : `/test/${test.id}?type=custom`;
                      const premiumPrimaryLabel = formatPremiumCustomMockAttemptActionButtonLabel({
                        isExhausted: !!usage?.isExhausted,
                        actionKind: usage?.actionKind || 'none',
                        actionAmount: usage?.actionAmount || 0,
                      }, 'Start Attempt');
                      return (
                        <Card key={test.id} className="group relative overflow-hidden border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-amber-950/75 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/55 hover:shadow-amber-950/45">
                          {(test.thumbnailUrl || test.imageUrl) ? (
                            <div className="relative h-32 w-full overflow-hidden border-b border-border/60">
                              <img src={test.thumbnailUrl || test.imageUrl} alt={test.title || 'Paid custom mock test'} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                            </div>
                          ) : null}
                          <CardContent className="relative space-y-4 pt-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="border-amber-300/45 bg-amber-500/10 text-amber-50">
                                    Premium Custom Mock
                                  </Badge>
                                  {test.examTypeName ? (
                                    <Badge variant="outline" className="border-cyan-300/45 bg-cyan-500/10 text-cyan-100">
                                      {test.examTypeName}
                                    </Badge>
                                  ) : null}
                                  {test.className ? (
                                    <Badge variant="outline" className="border-sky-300/45 bg-sky-500/10 text-sky-100">
                                      {test.className}
                                    </Badge>
                                  ) : null}
                                  {hasLimitedAttempts ? (
                                    <Badge variant="outline" className="border-emerald-300/40 bg-emerald-500/10 text-emerald-100">
                                      {attemptsLeftLabel} left
                                    </Badge>
                                  ) : null}
                                </div>
                                <div className="space-y-1">
                                  <p className="line-clamp-2 text-2xl font-semibold leading-tight tracking-tight text-white">
                                    {test.title || 'Untitled Mock'}
                                  </p>
                                  <p className="text-sm text-slate-300">
                                    {savedScopeDetails.length > 0
                                      ? 'Your selected subjects and topics for this premium custom mock.'
                                      : 'Premium custom mock ready to start.'}
                                  </p>
                                </div>
                              </div>

                              <div className="grid min-w-[220px] grid-cols-2 gap-2 text-xs sm:min-w-[260px]">
                                <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/75">Questions</p>
                                  <p className="mt-2 text-2xl font-semibold text-white">{test.config?.questionIds?.length || 0}</p>
                                </div>
                                <div className="rounded-xl border border-slate-700/80 bg-slate-900/75 px-4 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Duration</p>
                                  <p className="mt-2 text-2xl font-semibold text-white">{formatTestDurationLabel(test.config?.duration)}</p>
                                </div>
                              </div>
                            </div>

                            {savedScopeDetails.length > 0 ? (
                              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/75">
                                  Covered In This Mock
                                </p>
                                <div className="mt-3 grid gap-3">
                                  {savedScopeDetails.map((scope) => (
                                    <div
                                      key={`${test.id}-${scope.subject}-${scope.topics.join('|')}-${scope.subtopics.join('|')}`}
                                      className="rounded-xl border border-white/8 bg-slate-900/55 p-3"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-base font-semibold text-white">{scope.subject}</p>
                                        <Badge variant="outline" className="border-amber-300/35 bg-amber-500/10 text-amber-50">
                                          {scope.questionCount} questions
                                        </Badge>
                                      </div>
                                      <p className="mt-2 text-sm text-slate-300">
                                        Topic: {scope.topics.join(', ')}{scope.topicOverflowCount > 0 ? ` +${scope.topicOverflowCount} more` : ''}
                                      </p>
                                      {scope.subtopics.length > 0 ? (
                                        <p className="mt-1 text-sm text-slate-400">
                                          Subtopic: {scope.subtopics.join(', ')}{scope.subtopicOverflowCount > 0 ? ` +${scope.subtopicOverflowCount} more` : ''}
                                        </p>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {usage?.isExhausted ? (
                              <p className="text-xs text-amber-100/85">
                                {usage.actionLabel
                                  ? (usage.actionAmount && usage.actionAmount > 0
                                    ? `${usage.actionLabel} for INR ${usage.actionAmount.toLocaleString()} to continue with the same saved question set.`
                                    : `${usage.actionLabel} to continue with the same saved question set.`)
                                  : 'Attempts are exhausted for this premium custom mock.'}
                              </p>
                            ) : null}

                            <div className="grid grid-cols-1 gap-2">
                              <Button asChild className={cardPrimaryButtonClass}>
                                <Link href={premiumPrimaryHref}>
                                  {premiumPrimaryLabel}
                                </Link>
                              </Button>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <Button asChild variant="outline" className={cardSecondaryButtonClass}>
                                  <Link href={`/my-practice/custom-tests/${test.id}/attempt-history`}>
                                    Attempt History
                                  </Link>
                                </Button>
                                <Button asChild variant="outline" className={cardSecondaryButtonClass}>
                                  <Link href={`/custom-mock-tests/create?editTestId=${encodeURIComponent(test.id)}&mode=premium`}>
                                    Refine Test Blueprint
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-gradient-to-b from-slate-900/70 to-slate-950/70 shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl">Free Custom Mocks</CardTitle>
              <CardDescription>Create and run free custom mocks from the DCAM Question Bank.</CardDescription>
            </CardHeader>
            <CardContent>
              {customTestsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-36 w-full" />
                </div>
              ) : studentCreatedFreeTests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-8 text-center text-muted-foreground">
                  <Target className="mx-auto mb-3 h-6 w-6" />
                  <p className="font-medium">No free custom mocks created yet.</p>
                  <p className="mt-1 text-sm">Start with a free custom mock to test your preparation strategy and identify weak areas.</p>
                  <div className="mt-4 flex justify-center">
                    <Button asChild variant="outline" className={cardSecondaryButtonClass}>
                      <Link href="/dcam-custom-mock">
                        Create Free Custom Mock
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {studentCreatedFreeTests.map((test) => (
                    <Card key={test.id} className="group relative overflow-hidden border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-blue-950/75 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-sky-400/50 hover:shadow-sky-950/40">
                      {(test.thumbnailUrl || test.imageUrl) ? (
                        <div className="relative h-32 w-full overflow-hidden border-b border-border/60">
                          <img src={test.thumbnailUrl || test.imageUrl} alt={test.title || 'Custom mock test'} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                        </div>
                      ) : null}
                      <CardContent className="relative pt-5 space-y-3">
                        <div className="space-y-2">
                          <p className="line-clamp-2 text-2xl font-semibold leading-tight tracking-tight">{test.title || 'Untitled Mock'}</p>
                          <p className="text-xs text-slate-300">
                            Created: {test.createdAt?.toDate ? test.createdAt.toDate().toLocaleString() : 'N/A'}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-muted-foreground">
                            Questions
                            <p className="mt-1 text-sm font-semibold text-foreground">{test.config?.questionIds?.length || 0}</p>
                          </div>
                          <div className="rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-muted-foreground">
                            Duration
                            <p className="mt-1 text-sm font-semibold text-foreground">{formatTestDurationLabel(test.config?.duration)}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Button asChild variant="outline" className={cardSecondaryButtonClass}>
                            <Link href={`/my-practice/custom-tests/${test.id}/attempt-history`}>
                              Attempt History
                            </Link>
                          </Button>
                          <Button asChild className={cardPrimaryButtonClass}>
                            <Link href={`/test/${test.id}?type=custom`}>
                              Start Attempt
                            </Link>
                          </Button>
                          <Button asChild variant="outline" className={`sm:col-span-2 ${cardSecondaryButtonClass}`}>
                            <Link href={`/custom-mock-tests/create?editTestId=${encodeURIComponent(test.id)}`}>
                              Edit Test Strategy
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function MyPracticePage() {
  const firebaseContext = useContext(FirebaseContext);

  if (firebaseContext === undefined) {
    return (
      <FirebaseClientProvider>
        <MyPracticePageContent />
      </FirebaseClientProvider>
    );
  }

  return <MyPracticePageContent />;
}
