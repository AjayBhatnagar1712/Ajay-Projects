// Keep the legacy storage key for existing pricing and purchase document compatibility.
// It is a single exam-standard bucket, not an Easy/Medium/Hard classification.
export const QUESTION_DIFFICULTY = 'Easy' as const;
export const QUESTION_DIFFICULTY_LABEL = 'Standard' as const;

export type LegacyDifficultyCountMap = {
  easy?: unknown;
  medium?: unknown;
  hard?: unknown;
};

const normalizeCount = (value: unknown) => {
  const parsed = Math.max(0, Math.floor(Number(value || 0)));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function mergeLegacyDifficultyCounts(value?: LegacyDifficultyCountMap | null) {
  return {
    easy: normalizeCount(value?.easy) + normalizeCount(value?.medium) + normalizeCount(value?.hard),
    medium: 0,
    hard: 0,
  };
}

export function normalizeQuestionDifficulty<T extends { difficultyLevel?: unknown; alignments?: any[] }>(question: T): T {
  return {
    ...question,
    difficultyLevel: QUESTION_DIFFICULTY,
    ...(Array.isArray(question.alignments)
      ? { alignments: question.alignments.map((alignment) => ({ ...alignment, difficultyLevel: QUESTION_DIFFICULTY })) }
      : {}),
  };
}
