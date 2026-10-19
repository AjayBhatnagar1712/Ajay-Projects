import { splitSubtopicPath } from '@/lib/subtopic-paths';

export type DifficultyPricing = {
  easy?: number;
  medium?: number;
  hard?: number;
};

export type PricingQuestionSource = 'standard' | 'pyq';

export type ResolvedDifficultyPricing = {
  easy: number;
  medium: number;
  hard: number;
};

export type ScopedDifficultyPricingRule = DifficultyPricing & {
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  topicId?: string;
  subtopicPath?: string;
  questionSource?: PricingQuestionSource;
};

export type ScopedDifficultyPricingMap = Record<string, ScopedDifficultyPricingRule>;

const normalizeCurrencyValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed < 0) return Number(fallback.toFixed(2));
  return Number(parsed.toFixed(2));
};

const normalizeSubtopicScopePath = (value?: string | null) =>
  splitSubtopicPath(String(value || ''))
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(' > ');

export const normalizePricingQuestionSource = (value?: string | null): PricingQuestionSource =>
  value === 'pyq' ? 'pyq' : 'standard';

export const buildPricingScopeKey = (
  examTypeId?: string,
  classId?: string,
  subjectId?: string,
  topicIdOrQuestionSource?: string | PricingQuestionSource,
  subtopicPathOrQuestionSource?: string | PricingQuestionSource,
  questionSourceArg?: PricingQuestionSource
) => {
  const normalizedExamTypeId = String(examTypeId || '').trim();
  const normalizedClassId = String(classId || '').trim();
  if (!normalizedExamTypeId || !normalizedClassId) return '';
  const normalizedSubjectId = String(subjectId || '').trim();
  const rawFourth = String(topicIdOrQuestionSource || '').trim();
  const rawFifth = String(subtopicPathOrQuestionSource || '').trim();
  const rawSixth = String(questionSourceArg || '').trim();
  const isQuestionSourceToken = (value: string) => value === 'standard' || value === 'pyq';

  let normalizedTopicId = '';
  let normalizedSubtopicPath = '';
  let normalizedQuestionSource = '';

  if (normalizedSubjectId) {
    if (!rawFifth && !rawSixth && isQuestionSourceToken(rawFourth)) {
      normalizedQuestionSource = normalizePricingQuestionSource(rawFourth);
    } else {
      normalizedTopicId = rawFourth;
      if (!rawSixth && isQuestionSourceToken(rawFifth)) {
        normalizedQuestionSource = normalizePricingQuestionSource(rawFifth);
      } else {
        normalizedSubtopicPath = normalizeSubtopicScopePath(rawFifth);
        if (isQuestionSourceToken(rawSixth)) {
          normalizedQuestionSource = normalizePricingQuestionSource(rawSixth);
        }
      }
    }
  }

  const parts = [normalizedExamTypeId, normalizedClassId];
  if (normalizedSubjectId) parts.push(normalizedSubjectId);
  if (normalizedTopicId) parts.push(normalizedTopicId);
  if (normalizedSubtopicPath) parts.push(normalizedSubtopicPath);
  if (normalizedQuestionSource) parts.push(normalizedQuestionSource);
  return parts.join('__');
};

const parsePricingScopeKey = (rawKey?: string) => {
  const [keyExamTypeId = '', keyClassId = '', keySubjectId = '', ...rest] = String(rawKey || '').split('__');
  const remaining = [...rest];
  let questionSource: PricingQuestionSource | undefined;
  let topicId = '';
  let subtopicPath = '';

  if (remaining.length > 0) {
    const last = String(remaining[remaining.length - 1] || '').trim();
    if (last === 'standard' || last === 'pyq') {
      questionSource = normalizePricingQuestionSource(last);
      remaining.pop();
    }
  }

  if (remaining.length > 0) {
    topicId = String(remaining[0] || '').trim();
  }
  if (remaining.length > 1) {
    subtopicPath = normalizeSubtopicScopePath(String(remaining[1] || '').trim());
  }

  return {
    examTypeId: String(keyExamTypeId || '').trim(),
    classId: String(keyClassId || '').trim(),
    subjectId: String(keySubjectId || '').trim(),
    topicId,
    subtopicPath,
    questionSource,
  };
};

export const normalizeDifficultyPricing = (
  pricing: unknown,
  fallbackPrice: unknown = 0
): ResolvedDifficultyPricing => {
  const normalizedFallback = normalizeCurrencyValue(fallbackPrice, 0);
  const source =
    pricing && typeof pricing === 'object' && !Array.isArray(pricing)
      ? (pricing as DifficultyPricing)
      : {};

  return {
    easy: normalizeCurrencyValue(source.easy, normalizedFallback),
    medium: normalizeCurrencyValue(source.medium, normalizedFallback),
    hard: normalizeCurrencyValue(source.hard, normalizedFallback),
  };
};

export const normalizeScopedDifficultyPricingMap = (value: unknown): ScopedDifficultyPricingMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<ScopedDifficultyPricingMap>((acc, [rawKey, rawRule]) => {
    if (!rawRule || typeof rawRule !== 'object' || Array.isArray(rawRule)) return acc;

    const rule = rawRule as ScopedDifficultyPricingRule;
    const parsedKey = parsePricingScopeKey(rawKey);
    const examTypeId = String(rule.examTypeId || parsedKey.examTypeId || '').trim();
    const classId = String(rule.classId || parsedKey.classId || '').trim();
    const subjectId = String(rule.subjectId || parsedKey.subjectId || '').trim();
    const topicId = String(rule.topicId || parsedKey.topicId || '').trim();
    const subtopicPath = normalizeSubtopicScopePath(rule.subtopicPath || parsedKey.subtopicPath || '');
    const questionSource =
      subjectId && (rule.questionSource || parsedKey.questionSource)
        ? normalizePricingQuestionSource(rule.questionSource || parsedKey.questionSource)
        : undefined;
    const key = buildPricingScopeKey(examTypeId, classId, subjectId, topicId, subtopicPath, questionSource);

    if (!key) return acc;

    const normalizedRule = normalizeDifficultyPricing(rule, 0);
    acc[key] = {
      examTypeId,
      classId,
      ...(subjectId ? { subjectId } : {}),
      ...(topicId ? { topicId } : {}),
      ...(subtopicPath ? { subtopicPath } : {}),
      ...(questionSource ? { questionSource } : {}),
      ...normalizedRule,
    };
    return acc;
  }, {});
};

export const resolveScopedDifficultyPricing = ({
  legacyPrice,
  globalPricing,
  scopedPricingMap,
  examTypeId,
  classId,
  subjectId,
  topicId,
  subtopicPath,
  subtopicPaths,
  questionSource,
}: {
  legacyPrice?: unknown;
  globalPricing?: unknown;
  scopedPricingMap?: unknown;
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  topicId?: string;
  subtopicPath?: string;
  subtopicPaths?: string[];
  questionSource?: PricingQuestionSource;
}): ResolvedDifficultyPricing => {
  const fallbackPricing = normalizeDifficultyPricing(globalPricing, legacyPrice);
  const scopedPricing = normalizeScopedDifficultyPricingMap(scopedPricingMap);
  const normalizedExamTypeId = String(examTypeId || '').trim();
  const normalizedClassId = String(classId || '').trim();
  const normalizedSubjectId = String(subjectId || '').trim();
  const normalizedTopicId = String(topicId || '').trim();
  const normalizedSubtopicPaths = Array.from(
    new Set(
      [subtopicPath, ...(Array.isArray(subtopicPaths) ? subtopicPaths : [])]
        .map((value) => normalizeSubtopicScopePath(value))
        .filter(Boolean)
    )
  );
  const normalizedQuestionSource =
    normalizedSubjectId && questionSource ? normalizePricingQuestionSource(questionSource) : undefined;
  const subtopicPrefixes = Array.from(
    new Set(
      normalizedSubtopicPaths.flatMap((value) => {
        const segments = splitSubtopicPath(value).map((segment) => segment.trim()).filter(Boolean);
        return Array.from({ length: segments.length }, (_, index) =>
          segments.slice(0, segments.length - index).join(' > ')
        );
      })
    )
  );

  const scopeKeys = [
    ...subtopicPrefixes.flatMap((candidateSubtopicPath) => [
      buildPricingScopeKey(
        normalizedExamTypeId,
        normalizedClassId,
        normalizedSubjectId,
        normalizedTopicId,
        candidateSubtopicPath,
        normalizedQuestionSource
      ),
      buildPricingScopeKey(
        normalizedExamTypeId,
        normalizedClassId,
        normalizedSubjectId,
        normalizedTopicId,
        candidateSubtopicPath
      ),
    ]),
    buildPricingScopeKey(normalizedExamTypeId, normalizedClassId, normalizedSubjectId, normalizedTopicId, '', normalizedQuestionSource),
    buildPricingScopeKey(normalizedExamTypeId, normalizedClassId, normalizedSubjectId, normalizedTopicId),
    buildPricingScopeKey(normalizedExamTypeId, normalizedClassId, normalizedSubjectId, '', '', normalizedQuestionSource),
    buildPricingScopeKey(normalizedExamTypeId, normalizedClassId, normalizedSubjectId),
    buildPricingScopeKey(normalizedExamTypeId, normalizedClassId),
  ].filter(Boolean);

  const matchedScopeKey = scopeKeys.find((candidateKey) => !!scopedPricing[candidateKey]);
  if (!matchedScopeKey) return fallbackPricing;

  const scopedRule = scopedPricing[matchedScopeKey];
  return {
    easy: normalizeCurrencyValue(scopedRule.easy, fallbackPricing.easy),
    medium: normalizeCurrencyValue(scopedRule.medium, fallbackPricing.medium),
    hard: normalizeCurrencyValue(scopedRule.hard, fallbackPricing.hard),
  };
};
