import { buildPricingScopeKey } from '@/lib/premium-pricing';

export type PremiumPracticeTopicConfig = {
  subjectId: string;
  topicId: string;
  subtopics: string[];
  questionBankSource?: 'student_plus_official' | 'teacher_official';
  questionType: 'All' | 'MCQ' | 'Numerical';
  difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  previousYearMode: 'all' | 'pyq';
  previousYears: string[];
  count: number;
};

export type PremiumPracticeQuestionCountByDifficulty = {
  easy?: number;
  medium?: number;
  hard?: number;
};

export type AttemptLimitMode = 'unlimited' | 'total' | 'interval';
export type AttemptIntervalUnit = 'day' | 'week' | 'month' | 'year';

export type PremiumPracticeAttemptPricingRule = {
  examTypeId?: string;
  classId?: string;
  mode?: AttemptLimitMode;
  maxTotalAttempts?: number | null;
  maxAttemptsPerInterval?: number | null;
  intervalValue?: number | null;
  intervalUnit?: AttemptIntervalUnit | null;
  rechargePrice?: number | null;
  intervalAttemptPrice?: number | null;
};

export type PremiumPracticeAttemptPricingMap = Record<string, PremiumPracticeAttemptPricingRule>;

export type PremiumPracticeAttemptState = {
  totalRemainingAttempts?: number | null;
  intervalWindowStartedAt?: string | null;
  intervalAttemptsUsed?: number | null;
  intervalExtraAttemptsPurchased?: number | null;
  attemptsConsumedTotal?: number | null;
  rechargeCount?: number | null;
  extraAttemptsPurchasedTotal?: number | null;
  lastAttemptAt?: string | null;
};

export type PremiumPracticeAttemptPaymentKind =
  | 'question_purchase'
  | 'question_upgrade'
  | 'total_recharge'
  | 'interval_attempt'
  | 'mixed_update';

export type PremiumPracticeAttemptActionKind = 'none' | 'total_recharge' | 'interval_attempt';

export type NormalizedPremiumPracticeAttemptPricingRule = {
  examTypeId: string;
  classId: string;
  mode: AttemptLimitMode;
  maxTotalAttempts: number | null;
  maxAttemptsPerInterval: number | null;
  intervalValue: number | null;
  intervalUnit: AttemptIntervalUnit | null;
  rechargePrice: number;
  intervalAttemptPrice: number;
};

export type NormalizedPremiumPracticeAttemptState = {
  totalRemainingAttempts: number | null;
  intervalWindowStartedAt: string | null;
  intervalAttemptsUsed: number;
  intervalExtraAttemptsPurchased: number;
  attemptsConsumedTotal: number;
  rechargeCount: number;
  extraAttemptsPurchasedTotal: number;
  lastAttemptAt: string | null;
};

export type PremiumPracticeAttemptUsage = {
  mode: AttemptLimitMode;
  attemptsLeft: number | null;
  isExhausted: boolean;
  ruleLabel: string;
  usageLabel: string;
  currentWindowLabel: string | null;
  actionKind: PremiumPracticeAttemptActionKind;
  actionAmount: number;
  actionLabel: string | null;
  effectiveRule: NormalizedPremiumPracticeAttemptPricingRule;
  effectiveState: NormalizedPremiumPracticeAttemptState;
};

export type PremiumPracticeSessionPurchase = {
  id?: string;
  studentId?: string;
  teacherId?: string;
  teacherName?: string;
  offerId?: string;
  offerPurchaseId?: string;
  assignmentSource?: string;
  assignedByAdminId?: string | null;
  assignedByAdminEmail?: string | null;
  examTypeId?: string;
  examTypeName?: string;
  classId?: string;
  className?: string;
  practiceMode?: 'premium';
  status?: 'paid' | 'failed';
  questionCount?: number;
  questionCountByDifficulty?: PremiumPracticeQuestionCountByDifficulty;
  perQuestionPrice?: number;
  perQuestionPriceByDifficulty?: PremiumPracticeQuestionCountByDifficulty;
  amountByDifficulty?: PremiumPracticeQuestionCountByDifficulty;
  grossAmount?: number;
  attemptsPaidAmount?: number;
  totalAmountPaid?: number;
  currency?: string;
  questionBankSource?: 'student_plus_official' | 'teacher_official';
  topicConfigs?: PremiumPracticeTopicConfig[];
  includedQuestionCount?: number;
  includedQuestionIds?: string[];
  includedQuestionCountByDifficulty?: PremiumPracticeQuestionCountByDifficulty;
  includedTopicConfigs?: PremiumPracticeTopicConfig[];
  questionIds?: string[];
  perQuestionTimeSeconds?: number | null;
  attemptPricing?: PremiumPracticeAttemptPricingRule;
  attemptState?: PremiumPracticeAttemptState;
  purchasedAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastPaymentId?: string;
  paymentHistory?: Array<{
    paymentId: string;
    orderId?: string;
    amount: number;
    paidAt: string;
    kind?: PremiumPracticeAttemptPaymentKind;
    questionAmount?: number;
    attemptAmount?: number;
    attemptCount?: number;
  }>;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
};

const normalizeCount = (value: unknown) => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeNonNegativeInt = (value: unknown, fallback: number | null = null) => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const normalizePositiveInt = (value: unknown, fallback: number | null = null) => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
};

const normalizeCurrencyValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return Number(fallback.toFixed(2));
  return Number(parsed.toFixed(2));
};

const normalizeAttemptDate = (value: unknown) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const addInterval = (base: Date, value: number, unit: AttemptIntervalUnit) => {
  const next = new Date(base);
  const amount = Math.max(1, Math.floor(Number(value) || 1));
  if (unit === 'day') next.setDate(next.getDate() + amount);
  if (unit === 'week') next.setDate(next.getDate() + amount * 7);
  if (unit === 'month') next.setMonth(next.getMonth() + amount);
  if (unit === 'year') next.setFullYear(next.getFullYear() + amount);
  return next;
};

const formatIntervalLabel = (value: number | null, unit: AttemptIntervalUnit | null) => {
  if (!value || !unit) return null;
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
};

const normalizeQuestionType = (value: unknown): PremiumPracticeTopicConfig['questionType'] => {
  if (value === 'MCQ' || value === 'Numerical') return value;
  return 'All';
};

const normalizeDifficultyLevel = (value: unknown): PremiumPracticeTopicConfig['difficultyLevel'] => {
  return 'Easy';
};

const normalizePreviousYearMode = (value: unknown): PremiumPracticeTopicConfig['previousYearMode'] =>
  value === 'pyq' ? 'pyq' : 'all';

const normalizeQuestionBankSource = (value: unknown): PremiumPracticeTopicConfig['questionBankSource'] =>
  value === 'teacher_official' ? 'teacher_official' : 'student_plus_official';

export const normalizePremiumPracticeTopicConfigs = (value: unknown): PremiumPracticeTopicConfig[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map<PremiumPracticeTopicConfig | null>((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const subjectId = String(raw.subjectId || '').trim();
      const topicId = String(raw.topicId || '').trim();
      const count = normalizeCount(raw.count);
      if (!subjectId || !topicId || count <= 0) return null;
      return {
        subjectId,
        topicId,
        subtopics: normalizeStringArray(raw.subtopics),
        questionBankSource: normalizeQuestionBankSource(raw.questionBankSource),
        questionType: normalizeQuestionType(raw.questionType),
        difficultyLevel: normalizeDifficultyLevel(raw.difficultyLevel),
        previousYearMode: normalizePreviousYearMode(raw.previousYearMode),
        previousYears: normalizeStringArray(raw.previousYears),
        count,
      };
    })
    .filter((item): item is PremiumPracticeTopicConfig => !!item);
};

export const normalizePremiumPracticeAttemptPricingRule = (
  value?: PremiumPracticeAttemptPricingRule | null
): NormalizedPremiumPracticeAttemptPricingRule => {
  const mode = value?.mode === 'total' || value?.mode === 'interval' ? value.mode : 'unlimited';
  const intervalUnit =
    typeof value?.intervalUnit === 'string' && ['day', 'week', 'month', 'year'].includes(value.intervalUnit)
      ? (value.intervalUnit as AttemptIntervalUnit)
      : null;

  return {
    examTypeId: String(value?.examTypeId || '').trim(),
    classId: String(value?.classId || '').trim(),
    mode,
    maxTotalAttempts: mode === 'total' ? normalizePositiveInt(value?.maxTotalAttempts, null) : null,
    maxAttemptsPerInterval: mode === 'interval' ? normalizePositiveInt(value?.maxAttemptsPerInterval, null) : null,
    intervalValue: mode === 'interval' ? normalizePositiveInt(value?.intervalValue, null) : null,
    intervalUnit: mode === 'interval' ? intervalUnit : null,
    rechargePrice: mode === 'total' ? normalizeCurrencyValue(value?.rechargePrice, 0) : 0,
    intervalAttemptPrice: mode === 'interval' ? normalizeCurrencyValue(value?.intervalAttemptPrice, 0) : 0,
  };
};

export const normalizePremiumPracticeAttemptPricingMap = (value: unknown): PremiumPracticeAttemptPricingMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<PremiumPracticeAttemptPricingMap>((acc, [rawKey, rawRule]) => {
    if (!rawRule || typeof rawRule !== 'object' || Array.isArray(rawRule)) return acc;

    const rule = rawRule as PremiumPracticeAttemptPricingRule;
    const [keyExamTypeId = '', keyClassId = ''] = String(rawKey).split('__');
    const normalizedRule = normalizePremiumPracticeAttemptPricingRule({
      ...rule,
      examTypeId: String(rule.examTypeId || keyExamTypeId || '').trim(),
      classId: String(rule.classId || keyClassId || '').trim(),
    });
    const key = buildPricingScopeKey(normalizedRule.examTypeId, normalizedRule.classId);
    if (!key) return acc;
    acc[key] = normalizedRule;
    return acc;
  }, {});
};

export const resolvePremiumPracticeAttemptPricingRule = ({
  scopedPricingMap,
  examTypeId,
  classId,
}: {
  scopedPricingMap?: PremiumPracticeAttemptPricingMap | unknown;
  examTypeId?: string;
  classId?: string;
}) => {
  const normalizedMap = normalizePremiumPracticeAttemptPricingMap(scopedPricingMap);
  const scopeKey = buildPricingScopeKey(examTypeId, classId);
  if (!scopeKey || !normalizedMap[scopeKey]) {
    return normalizePremiumPracticeAttemptPricingRule();
  }
  return normalizePremiumPracticeAttemptPricingRule(normalizedMap[scopeKey]);
};

export const normalizePremiumPracticeAttemptState = (
  value?: PremiumPracticeAttemptState | null
): NormalizedPremiumPracticeAttemptState => ({
  totalRemainingAttempts: normalizeNonNegativeInt(value?.totalRemainingAttempts, null),
  intervalWindowStartedAt: String(value?.intervalWindowStartedAt || '').trim() || null,
  intervalAttemptsUsed: normalizeNonNegativeInt(value?.intervalAttemptsUsed, 0) ?? 0,
  intervalExtraAttemptsPurchased: normalizeNonNegativeInt(value?.intervalExtraAttemptsPurchased, 0) ?? 0,
  attemptsConsumedTotal: normalizeNonNegativeInt(value?.attemptsConsumedTotal, 0) ?? 0,
  rechargeCount: normalizeNonNegativeInt(value?.rechargeCount, 0) ?? 0,
  extraAttemptsPurchasedTotal: normalizeNonNegativeInt(value?.extraAttemptsPurchasedTotal, 0) ?? 0,
  lastAttemptAt: String(value?.lastAttemptAt || '').trim() || null,
});

export const formatPremiumPracticeAttemptPricingRule = (
  value?: PremiumPracticeAttemptPricingRule | null
) => {
  const rule = normalizePremiumPracticeAttemptPricingRule(value);
  if (rule.mode === 'total' && rule.maxTotalAttempts) {
    return `${rule.maxTotalAttempts} total attempt${rule.maxTotalAttempts === 1 ? '' : 's'} | Recharge INR ${rule.rechargePrice.toLocaleString()}`;
  }
  if (rule.mode === 'interval' && rule.maxAttemptsPerInterval && rule.intervalValue && rule.intervalUnit) {
    const intervalLabel = formatIntervalLabel(rule.intervalValue, rule.intervalUnit) || 'interval';
    return `${rule.maxAttemptsPerInterval} attempt${rule.maxAttemptsPerInterval === 1 ? '' : 's'} per ${intervalLabel} | Extra attempt INR ${rule.intervalAttemptPrice.toLocaleString()}`;
  }
  return 'Unlimited attempts';
};

export const formatPremiumPracticeAttemptActionButtonLabel = (
  usage?: Pick<PremiumPracticeAttemptUsage, 'isExhausted' | 'actionKind' | 'actionAmount'> | null,
  defaultLabel = 'Continue Practice'
) => {
  if (!usage?.isExhausted) return defaultLabel;
  if (usage.actionKind === 'total_recharge') {
    return usage.actionAmount > 0
      ? `Recharge Attempts - INR ${usage.actionAmount.toLocaleString()}`
      : 'Recharge Attempts';
  }
  if (usage.actionKind === 'interval_attempt') {
    return usage.actionAmount > 0
      ? `Buy 1 Attempt - INR ${usage.actionAmount.toLocaleString()}`
      : 'Unlock 1 Attempt';
  }
  return 'Attempts Exhausted';
};

export const resolvePremiumPracticeAttemptUsage = ({
  attemptPricing,
  attemptState,
  purchasedAt,
  referenceDate,
}: {
  attemptPricing?: PremiumPracticeAttemptPricingRule | null;
  attemptState?: PremiumPracticeAttemptState | null;
  purchasedAt?: unknown;
  referenceDate?: Date;
}): PremiumPracticeAttemptUsage => {
  const effectiveRule = normalizePremiumPracticeAttemptPricingRule(attemptPricing);
  const normalizedState = normalizePremiumPracticeAttemptState(attemptState);
  const now = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date();

  if (effectiveRule.mode === 'total' && effectiveRule.maxTotalAttempts) {
    const attemptsLeft = normalizedState.totalRemainingAttempts ?? effectiveRule.maxTotalAttempts;
    const boundedAttemptsLeft = Math.max(0, attemptsLeft);
    return {
      mode: 'total',
      attemptsLeft: boundedAttemptsLeft,
      isExhausted: boundedAttemptsLeft <= 0,
      ruleLabel: `${effectiveRule.maxTotalAttempts} total attempt${effectiveRule.maxTotalAttempts === 1 ? '' : 's'}`,
      usageLabel: `${Math.max(0, effectiveRule.maxTotalAttempts - boundedAttemptsLeft)}/${effectiveRule.maxTotalAttempts} used`,
      currentWindowLabel: null,
      actionKind: boundedAttemptsLeft <= 0 ? 'total_recharge' : 'none',
      actionAmount: boundedAttemptsLeft <= 0 ? effectiveRule.rechargePrice : 0,
      actionLabel: boundedAttemptsLeft <= 0 ? `Recharge all ${effectiveRule.maxTotalAttempts} attempts` : null,
      effectiveRule,
      effectiveState: {
        ...normalizedState,
        totalRemainingAttempts: boundedAttemptsLeft,
      },
    };
  }

  if (
    effectiveRule.mode === 'interval'
    && effectiveRule.maxAttemptsPerInterval
    && effectiveRule.intervalValue
    && effectiveRule.intervalUnit
  ) {
    const baseDate = normalizeAttemptDate(normalizedState.intervalWindowStartedAt)
      || normalizeAttemptDate(purchasedAt)
      || now;
    let intervalWindowStartedAt = baseDate;
    let intervalAttemptsUsed = normalizedState.intervalAttemptsUsed;
    let intervalExtraAttemptsPurchased = normalizedState.intervalExtraAttemptsPurchased;

    while (addInterval(intervalWindowStartedAt, effectiveRule.intervalValue, effectiveRule.intervalUnit) <= now) {
      intervalWindowStartedAt = addInterval(intervalWindowStartedAt, effectiveRule.intervalValue, effectiveRule.intervalUnit);
      intervalAttemptsUsed = 0;
      intervalExtraAttemptsPurchased = 0;
    }

    const attemptsLeft = Math.max(0, effectiveRule.maxAttemptsPerInterval + intervalExtraAttemptsPurchased - intervalAttemptsUsed);
    const intervalLabel = formatIntervalLabel(effectiveRule.intervalValue, effectiveRule.intervalUnit);
    return {
      mode: 'interval',
      attemptsLeft,
      isExhausted: attemptsLeft <= 0,
      ruleLabel: `${effectiveRule.maxAttemptsPerInterval} attempt${effectiveRule.maxAttemptsPerInterval === 1 ? '' : 's'} per ${intervalLabel}`,
      usageLabel: `${intervalAttemptsUsed}/${effectiveRule.maxAttemptsPerInterval} used in current interval${intervalExtraAttemptsPurchased > 0 ? ` (+${intervalExtraAttemptsPurchased} bought)` : ''}`,
      currentWindowLabel: intervalLabel,
      actionKind: attemptsLeft <= 0 ? 'interval_attempt' : 'none',
      actionAmount: attemptsLeft <= 0 ? effectiveRule.intervalAttemptPrice : 0,
      actionLabel: attemptsLeft <= 0 ? (effectiveRule.intervalAttemptPrice > 0 ? 'Buy 1 instant attempt' : 'Unlock 1 instant attempt') : null,
      effectiveRule,
      effectiveState: {
        ...normalizedState,
        intervalWindowStartedAt: intervalWindowStartedAt.toISOString(),
        intervalAttemptsUsed,
        intervalExtraAttemptsPurchased,
      },
    };
  }

  return {
    mode: 'unlimited',
    attemptsLeft: null,
    isExhausted: false,
    ruleLabel: 'Unlimited attempts',
    usageLabel: 'Unlimited re-attempts available',
    currentWindowLabel: null,
    actionKind: 'none',
    actionAmount: 0,
    actionLabel: null,
    effectiveRule,
    effectiveState: normalizedState,
  };
};

export const applyPremiumPracticeAttemptTopUp = ({
  attemptPricing,
  attemptState,
  purchasedAt,
  kind,
  referenceDate,
}: {
  attemptPricing?: PremiumPracticeAttemptPricingRule | null;
  attemptState?: PremiumPracticeAttemptState | null;
  purchasedAt?: unknown;
  kind: PremiumPracticeAttemptActionKind;
  referenceDate?: Date;
}) => {
  const usage = resolvePremiumPracticeAttemptUsage({ attemptPricing, attemptState, purchasedAt, referenceDate });
  const nowIso = (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date()).toISOString();
  if (kind === 'total_recharge' && usage.effectiveRule.mode === 'total' && usage.effectiveRule.maxTotalAttempts) {
    return {
      ...usage.effectiveState,
      totalRemainingAttempts: usage.effectiveRule.maxTotalAttempts,
      rechargeCount: usage.effectiveState.rechargeCount + 1,
      lastAttemptAt: usage.effectiveState.lastAttemptAt,
      intervalWindowStartedAt: usage.effectiveState.intervalWindowStartedAt,
    } satisfies PremiumPracticeAttemptState;
  }
  if (kind === 'interval_attempt' && usage.effectiveRule.mode === 'interval') {
    return {
      ...usage.effectiveState,
      intervalWindowStartedAt: usage.effectiveState.intervalWindowStartedAt || nowIso,
      intervalExtraAttemptsPurchased: usage.effectiveState.intervalExtraAttemptsPurchased + 1,
      extraAttemptsPurchasedTotal: usage.effectiveState.extraAttemptsPurchasedTotal + 1,
    } satisfies PremiumPracticeAttemptState;
  }
  return usage.effectiveState satisfies PremiumPracticeAttemptState;
};

export const consumePremiumPracticeAttempt = ({
  attemptPricing,
  attemptState,
  purchasedAt,
  referenceDate,
}: {
  attemptPricing?: PremiumPracticeAttemptPricingRule | null;
  attemptState?: PremiumPracticeAttemptState | null;
  purchasedAt?: unknown;
  referenceDate?: Date;
}) => {
  const usage = resolvePremiumPracticeAttemptUsage({ attemptPricing, attemptState, purchasedAt, referenceDate });
  const nowIso = (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date()).toISOString();

  if (usage.mode === 'unlimited') {
    return {
      ok: true,
      nextState: {
        ...usage.effectiveState,
        attemptsConsumedTotal: usage.effectiveState.attemptsConsumedTotal + 1,
        lastAttemptAt: nowIso,
      } satisfies PremiumPracticeAttemptState,
      usage,
    };
  }

  if ((usage.attemptsLeft ?? 0) <= 0) {
    return {
      ok: false,
      nextState: usage.effectiveState satisfies PremiumPracticeAttemptState,
      usage,
    };
  }

  if (usage.mode === 'total') {
    return {
      ok: true,
      nextState: {
        ...usage.effectiveState,
        totalRemainingAttempts: Math.max(0, (usage.effectiveState.totalRemainingAttempts ?? 0) - 1),
        attemptsConsumedTotal: usage.effectiveState.attemptsConsumedTotal + 1,
        lastAttemptAt: nowIso,
      } satisfies PremiumPracticeAttemptState,
      usage,
    };
  }

  return {
    ok: true,
    nextState: {
      ...usage.effectiveState,
      intervalWindowStartedAt: usage.effectiveState.intervalWindowStartedAt || nowIso,
      intervalAttemptsUsed: usage.effectiveState.intervalAttemptsUsed + 1,
      attemptsConsumedTotal: usage.effectiveState.attemptsConsumedTotal + 1,
      lastAttemptAt: nowIso,
    } satisfies PremiumPracticeAttemptState,
    usage,
  };
};

export const buildPremiumPracticeSessionHref = (
  purchase: Pick<
    PremiumPracticeSessionPurchase,
    'id' | 'teacherId' | 'examTypeId' | 'examTypeName' | 'classId' | 'className' | 'topicConfigs' | 'perQuestionTimeSeconds' | 'questionBankSource'
  >
) => {
  const params = new URLSearchParams();
  params.set('practiceMode', 'premium');
  params.set('teacherQuestionMode', 'paid');
  params.set('accessLevel', 'paid');

  if (purchase.id) params.set('premiumPurchaseId', purchase.id);
  if (purchase.teacherId) params.set('teacherId', purchase.teacherId);
  if (purchase.examTypeId) params.set('examTypeId', purchase.examTypeId);
  if (purchase.classId) params.set('classId', purchase.classId);
  if (purchase.examTypeName) params.set('examTypeName', purchase.examTypeName);
  if (purchase.className) params.set('className', purchase.className);
  if (purchase.questionBankSource) params.set('questionBankSource', purchase.questionBankSource);

  const normalizedTopicConfigs = normalizePremiumPracticeTopicConfigs(purchase.topicConfigs);
  if (normalizedTopicConfigs.length > 0) {
    params.set('topicConfigs', JSON.stringify(normalizedTopicConfigs));
  }

  const perQuestionTimeSeconds = Number(purchase.perQuestionTimeSeconds);
  if (Number.isFinite(perQuestionTimeSeconds) && perQuestionTimeSeconds > 0) {
    params.set('timeLimit', String(Math.floor(perQuestionTimeSeconds)));
  }

  return `/practice/session?${params.toString()}`;
};
