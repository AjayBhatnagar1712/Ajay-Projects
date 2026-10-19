import { buildPricingScopeKey } from '@/lib/premium-pricing';

export type AttemptLimitMode = 'unlimited' | 'total' | 'interval';
export type AttemptIntervalUnit = 'day' | 'week' | 'month' | 'year';

export type PremiumCustomMockAttemptPricingRule = {
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

export type PremiumCustomMockAttemptPricingMap = Record<string, PremiumCustomMockAttemptPricingRule>;

export type PremiumCustomMockAttemptState = {
  totalRemainingAttempts?: number | null;
  intervalWindowStartedAt?: string | null;
  intervalAttemptsUsed?: number | null;
  intervalExtraAttemptsPurchased?: number | null;
  attemptsConsumedTotal?: number | null;
  rechargeCount?: number | null;
  extraAttemptsPurchasedTotal?: number | null;
  lastAttemptAt?: string | null;
};

export type PremiumCustomMockAttemptPaymentKind =
  | 'question_purchase'
  | 'question_upgrade'
  | 'total_recharge'
  | 'interval_attempt'
  | 'mixed_update';

export type PremiumCustomMockAttemptActionKind = 'none' | 'total_recharge' | 'interval_attempt';

export type NormalizedPremiumCustomMockAttemptPricingRule = {
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

export type NormalizedPremiumCustomMockAttemptState = {
  totalRemainingAttempts: number | null;
  intervalWindowStartedAt: string | null;
  intervalAttemptsUsed: number;
  intervalExtraAttemptsPurchased: number;
  attemptsConsumedTotal: number;
  rechargeCount: number;
  extraAttemptsPurchasedTotal: number;
  lastAttemptAt: string | null;
};

export type PremiumCustomMockAttemptUsage = {
  mode: AttemptLimitMode;
  attemptsLeft: number | null;
  isExhausted: boolean;
  ruleLabel: string;
  usageLabel: string;
  currentWindowLabel: string | null;
  actionKind: PremiumCustomMockAttemptActionKind;
  actionAmount: number;
  actionLabel: string | null;
  effectiveRule: NormalizedPremiumCustomMockAttemptPricingRule;
  effectiveState: NormalizedPremiumCustomMockAttemptState;
};

type LegacyAttemptLimit = {
  mode?: AttemptLimitMode;
  maxTotalAttempts?: number | null;
  maxAttemptsPerInterval?: number | null;
  intervalValue?: number | null;
  intervalUnit?: AttemptIntervalUnit | null;
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
  if (
    typeof value === 'object'
    && value !== null
    && 'toDate' in value
    && typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
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

export const normalizePremiumCustomMockAttemptPricingRule = (
  value?: PremiumCustomMockAttemptPricingRule | null
): NormalizedPremiumCustomMockAttemptPricingRule => {
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

export const normalizePremiumCustomMockAttemptPricingMap = (value: unknown): PremiumCustomMockAttemptPricingMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<PremiumCustomMockAttemptPricingMap>((acc, [rawKey, rawRule]) => {
    if (!rawRule || typeof rawRule !== 'object' || Array.isArray(rawRule)) return acc;

    const rule = rawRule as PremiumCustomMockAttemptPricingRule;
    const [keyExamTypeId = '', keyClassId = ''] = String(rawKey).split('__');
    const normalizedRule = normalizePremiumCustomMockAttemptPricingRule({
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

export const resolvePremiumCustomMockAttemptPricingRule = ({
  scopedPricingMap,
  examTypeId,
  classId,
}: {
  scopedPricingMap?: PremiumCustomMockAttemptPricingMap | unknown;
  examTypeId?: string;
  classId?: string;
}) => {
  const normalizedMap = normalizePremiumCustomMockAttemptPricingMap(scopedPricingMap);
  const scopeKey = buildPricingScopeKey(examTypeId, classId);
  if (!scopeKey || !normalizedMap[scopeKey]) {
    return normalizePremiumCustomMockAttemptPricingRule();
  }
  return normalizePremiumCustomMockAttemptPricingRule(normalizedMap[scopeKey]);
};

export const buildPremiumCustomMockAttemptRuleFromLegacyLimit = (value?: LegacyAttemptLimit | null) =>
  normalizePremiumCustomMockAttemptPricingRule({
    mode: value?.mode,
    maxTotalAttempts: value?.maxTotalAttempts,
    maxAttemptsPerInterval: value?.maxAttemptsPerInterval,
    intervalValue: value?.intervalValue,
    intervalUnit: value?.intervalUnit,
    rechargePrice: 0,
    intervalAttemptPrice: 0,
  });

export const normalizePremiumCustomMockAttemptState = (
  value?: PremiumCustomMockAttemptState | null
): NormalizedPremiumCustomMockAttemptState => ({
  totalRemainingAttempts: normalizeNonNegativeInt(value?.totalRemainingAttempts, null),
  intervalWindowStartedAt: String(value?.intervalWindowStartedAt || '').trim() || null,
  intervalAttemptsUsed: normalizeNonNegativeInt(value?.intervalAttemptsUsed, 0) ?? 0,
  intervalExtraAttemptsPurchased: normalizeNonNegativeInt(value?.intervalExtraAttemptsPurchased, 0) ?? 0,
  attemptsConsumedTotal: normalizeNonNegativeInt(value?.attemptsConsumedTotal, 0) ?? 0,
  rechargeCount: normalizeNonNegativeInt(value?.rechargeCount, 0) ?? 0,
  extraAttemptsPurchasedTotal: normalizeNonNegativeInt(value?.extraAttemptsPurchasedTotal, 0) ?? 0,
  lastAttemptAt: String(value?.lastAttemptAt || '').trim() || null,
});

export const formatPremiumCustomMockAttemptPricingRule = (
  value?: PremiumCustomMockAttemptPricingRule | null
) => {
  const rule = normalizePremiumCustomMockAttemptPricingRule(value);
  if (rule.mode === 'total' && rule.maxTotalAttempts) {
    return `${rule.maxTotalAttempts} total attempt${rule.maxTotalAttempts === 1 ? '' : 's'} | Recharge INR ${rule.rechargePrice.toLocaleString()}`;
  }
  if (rule.mode === 'interval' && rule.maxAttemptsPerInterval && rule.intervalValue && rule.intervalUnit) {
    const intervalLabel = formatIntervalLabel(rule.intervalValue, rule.intervalUnit) || 'interval';
    return `${rule.maxAttemptsPerInterval} attempt${rule.maxAttemptsPerInterval === 1 ? '' : 's'} per ${intervalLabel} | Extra attempt INR ${rule.intervalAttemptPrice.toLocaleString()}`;
  }
  return 'Unlimited attempts';
};

export const formatPremiumCustomMockAttemptActionButtonLabel = (
  usage?: Pick<PremiumCustomMockAttemptUsage, 'isExhausted' | 'actionKind' | 'actionAmount'> | null,
  defaultLabel = 'Start Premium Attempt'
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

export const resolvePremiumCustomMockAttemptUsage = ({
  attemptPricing,
  attemptState,
  purchasedAt,
  referenceDate,
}: {
  attemptPricing?: PremiumCustomMockAttemptPricingRule | null;
  attemptState?: PremiumCustomMockAttemptState | null;
  purchasedAt?: unknown;
  referenceDate?: Date;
}): PremiumCustomMockAttemptUsage => {
  const effectiveRule = normalizePremiumCustomMockAttemptPricingRule(attemptPricing);
  const normalizedState = normalizePremiumCustomMockAttemptState(attemptState);
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

export const applyPremiumCustomMockAttemptTopUp = ({
  attemptPricing,
  attemptState,
  purchasedAt,
  kind,
  referenceDate,
}: {
  attemptPricing?: PremiumCustomMockAttemptPricingRule | null;
  attemptState?: PremiumCustomMockAttemptState | null;
  purchasedAt?: unknown;
  kind: PremiumCustomMockAttemptActionKind;
  referenceDate?: Date;
}) => {
  const usage = resolvePremiumCustomMockAttemptUsage({ attemptPricing, attemptState, purchasedAt, referenceDate });
  const nowIso = (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date()).toISOString();
  if (kind === 'total_recharge' && usage.effectiveRule.mode === 'total' && usage.effectiveRule.maxTotalAttempts) {
    return {
      ...usage.effectiveState,
      totalRemainingAttempts: usage.effectiveRule.maxTotalAttempts,
      rechargeCount: usage.effectiveState.rechargeCount + 1,
      lastAttemptAt: usage.effectiveState.lastAttemptAt,
      intervalWindowStartedAt: usage.effectiveState.intervalWindowStartedAt,
    } satisfies PremiumCustomMockAttemptState;
  }
  if (kind === 'interval_attempt' && usage.effectiveRule.mode === 'interval') {
    return {
      ...usage.effectiveState,
      intervalWindowStartedAt: usage.effectiveState.intervalWindowStartedAt || nowIso,
      intervalExtraAttemptsPurchased: usage.effectiveState.intervalExtraAttemptsPurchased + 1,
      extraAttemptsPurchasedTotal: usage.effectiveState.extraAttemptsPurchasedTotal + 1,
    } satisfies PremiumCustomMockAttemptState;
  }
  return usage.effectiveState satisfies PremiumCustomMockAttemptState;
};

export const consumePremiumCustomMockAttempt = ({
  attemptPricing,
  attemptState,
  purchasedAt,
  referenceDate,
}: {
  attemptPricing?: PremiumCustomMockAttemptPricingRule | null;
  attemptState?: PremiumCustomMockAttemptState | null;
  purchasedAt?: unknown;
  referenceDate?: Date;
}) => {
  const usage = resolvePremiumCustomMockAttemptUsage({ attemptPricing, attemptState, purchasedAt, referenceDate });
  const nowIso = (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date()).toISOString();

  if (usage.mode === 'unlimited') {
    return {
      ok: true,
      nextState: {
        ...usage.effectiveState,
        attemptsConsumedTotal: usage.effectiveState.attemptsConsumedTotal + 1,
        lastAttemptAt: nowIso,
      } satisfies PremiumCustomMockAttemptState,
      usage,
    };
  }

  if ((usage.attemptsLeft ?? 0) <= 0) {
    return {
      ok: false,
      nextState: usage.effectiveState satisfies PremiumCustomMockAttemptState,
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
      } satisfies PremiumCustomMockAttemptState,
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
    } satisfies PremiumCustomMockAttemptState,
    usage,
  };
};
