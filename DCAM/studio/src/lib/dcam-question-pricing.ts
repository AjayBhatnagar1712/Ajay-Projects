import {
  resolveScopedDifficultyPricing,
  type PricingQuestionSource,
  type ResolvedDifficultyPricing,
  type ScopedDifficultyPricingMap,
} from '@/lib/premium-pricing';

export type DcamPricingDifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export type DcamQuestionPricingMode = 'practice' | 'mock';

export type DcamQuestionPricingProfile = {
  dcamTeacherQuestionPricingByScope?: ScopedDifficultyPricingMap;
  premiumPracticeQuestionPrice?: number;
  premiumPracticeQuestionPriceByDifficulty?: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
  premiumPracticeQuestionPricingByScope?: ScopedDifficultyPricingMap;
  dcamPracticeQuestionPricingByScope?: ScopedDifficultyPricingMap;
  premiumMockTestQuestionPrice?: number;
  premiumMockTestQuestionPriceByDifficulty?: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
  premiumMockTestQuestionPricingByScope?: ScopedDifficultyPricingMap;
  dcamMockTestQuestionPricingByScope?: ScopedDifficultyPricingMap;
};

export type DcamPricedQuestion = {
  id: string;
  subjectId?: string;
  topicId?: string;
  subtopics?: string[];
  difficultyLevel?: DcamPricingDifficultyLevel;
  isPreviousYear?: boolean;
};

export type DcamQuestionPricingBreakdownRow = {
  subjectId: string;
  questionSource: PricingQuestionSource;
  difficultyLevel: DcamPricingDifficultyLevel;
  count: number;
  unitPrice: number;
  amount: number;
};

export type DcamQuestionPricingBreakdown = {
  rows: DcamQuestionPricingBreakdownRow[];
  countByDifficulty: Record<DcamPricingDifficultyLevel, number>;
  amountByDifficulty: Record<'easy' | 'medium' | 'hard', number>;
  averagePriceByDifficulty: Record<'easy' | 'medium' | 'hard', number>;
  totalAmount: number;
  missingPricing: boolean;
};

const DIFFICULTY_KEY_BY_LEVEL: Record<DcamPricingDifficultyLevel, 'easy' | 'medium' | 'hard'> = {
  Easy: 'easy',
  Medium: 'medium',
  Hard: 'hard',
};

export const getPricingQuestionSourceFromSelection = (value?: string | null): PricingQuestionSource =>
  value === 'pyq' ? 'pyq' : 'standard';

export const getPricingDifficultyKey = (difficultyLevel: DcamPricingDifficultyLevel) =>
  DIFFICULTY_KEY_BY_LEVEL[difficultyLevel];

const getScopedPricingMapForMode = (
  profile: DcamQuestionPricingProfile | null | undefined,
  mode: DcamQuestionPricingMode
) => {
  if (!profile) return undefined;
  return mode === 'practice'
    ? (profile.dcamPracticeQuestionPricingByScope ?? profile.premiumPracticeQuestionPricingByScope)
    : (profile.dcamMockTestQuestionPricingByScope ?? profile.premiumMockTestQuestionPricingByScope);
};

const getGlobalPricingForMode = (
  profile: DcamQuestionPricingProfile | null | undefined,
  mode: DcamQuestionPricingMode
) => {
  if (!profile) return undefined;
  return mode === 'practice'
    ? profile.premiumPracticeQuestionPriceByDifficulty
    : profile.premiumMockTestQuestionPriceByDifficulty;
};

const getLegacyPricingForMode = (
  profile: DcamQuestionPricingProfile | null | undefined,
  mode: DcamQuestionPricingMode
) => {
  if (!profile) return undefined;
  return mode === 'practice'
    ? profile.premiumPracticeQuestionPrice
    : profile.premiumMockTestQuestionPrice;
};

export const resolveDcamQuestionPricing = ({
  profile,
  mode,
  examTypeId,
  classId,
  subjectId,
  topicId,
  subtopicPaths,
  questionSource,
}: {
  profile?: DcamQuestionPricingProfile | null;
  mode: DcamQuestionPricingMode;
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  topicId?: string;
  subtopicPaths?: string[];
  questionSource?: PricingQuestionSource;
}): ResolvedDifficultyPricing =>
  resolveScopedDifficultyPricing({
    legacyPrice: getLegacyPricingForMode(profile, mode),
    globalPricing: getGlobalPricingForMode(profile, mode),
    scopedPricingMap: getScopedPricingMapForMode(profile, mode),
    examTypeId,
    classId,
    subjectId,
    topicId,
    subtopicPaths,
    questionSource,
  });

export const buildDcamQuestionPricingBreakdown = ({
  questionIds,
  questionById,
  profile,
  mode,
  examTypeId,
  classId,
}: {
  questionIds: string[];
  questionById: Map<string, DcamPricedQuestion>;
  profile?: DcamQuestionPricingProfile | null;
  mode: DcamQuestionPricingMode;
  examTypeId?: string;
  classId?: string;
}): DcamQuestionPricingBreakdown => {
  const rowMap = new Map<string, DcamQuestionPricingBreakdownRow>();
  const countByDifficulty = { Easy: 0, Medium: 0, Hard: 0 } as Record<DcamPricingDifficultyLevel, number>;
  const amountByDifficulty = { easy: 0, medium: 0, hard: 0 };
  let missingPricing = false;

  questionIds.forEach((questionId) => {
    const question = questionById.get(questionId);
    const subjectId = String(question?.subjectId || '').trim();
    const difficultyLevel: DcamPricingDifficultyLevel = 'Easy';

    if (!subjectId) return;

    const questionSource = question?.isPreviousYear ? 'pyq' : 'standard';
    const resolvedPricing = resolveDcamQuestionPricing({
      profile,
      mode,
      examTypeId,
      classId,
      subjectId,
      topicId: question?.topicId,
      subtopicPaths: question?.subtopics,
      questionSource,
    });
    const difficultyKey = getPricingDifficultyKey(difficultyLevel);
    const unitPrice = resolvedPricing[difficultyKey];
    const rowKey = [subjectId, questionSource, difficultyLevel, String(unitPrice)].join('::');
    const existingRow = rowMap.get(rowKey);
    const nextCount = (existingRow?.count || 0) + 1;
    const nextAmount = Number((nextCount * unitPrice).toFixed(2));

    rowMap.set(rowKey, {
      subjectId,
      questionSource,
      difficultyLevel,
      count: nextCount,
      unitPrice,
      amount: nextAmount,
    });

    countByDifficulty[difficultyLevel] += 1;
    amountByDifficulty[difficultyKey] = Number((amountByDifficulty[difficultyKey] + unitPrice).toFixed(2));
    if (unitPrice <= 0) missingPricing = true;
  });

  const averagePriceByDifficulty = {
    easy: countByDifficulty.Easy > 0 ? Number((amountByDifficulty.easy / countByDifficulty.Easy).toFixed(2)) : 0,
    medium: countByDifficulty.Medium > 0 ? Number((amountByDifficulty.medium / countByDifficulty.Medium).toFixed(2)) : 0,
    hard: countByDifficulty.Hard > 0 ? Number((amountByDifficulty.hard / countByDifficulty.Hard).toFixed(2)) : 0,
  };

  return {
    rows: Array.from(rowMap.values()).sort((left, right) => {
      const sourceOrder = left.questionSource.localeCompare(right.questionSource);
      if (sourceOrder !== 0) return sourceOrder;
      const subjectOrder = left.subjectId.localeCompare(right.subjectId);
      if (subjectOrder !== 0) return subjectOrder;
      const difficultyOrder = left.difficultyLevel.localeCompare(right.difficultyLevel);
      if (difficultyOrder !== 0) return difficultyOrder;
      return left.unitPrice - right.unitPrice;
    }),
    countByDifficulty,
    amountByDifficulty,
    averagePriceByDifficulty,
    totalAmount: Number((amountByDifficulty.easy + amountByDifficulty.medium + amountByDifficulty.hard).toFixed(2)),
    missingPricing,
  };
};
