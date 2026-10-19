import {
  buildPracticeQuestionScopeEntries,
  type PracticeQuestionScopeEntry,
  type PracticeQuestionScopeSource,
} from '@/lib/practice-question-scope';
import {
  normalizePremiumPracticeTopicConfigs,
  type PremiumPracticeAttemptPricingRule,
  type PremiumPracticeTopicConfig,
} from '@/lib/premium-practice-session';
import { normalizeSubtopicValue, splitSubtopicPath } from '@/lib/subtopic-paths';
import { DCAM_QUESTION_BANK_LABEL } from '@/lib/teacher-authoring';

export const ADMIN_PRACTICE_SESSION_ASSIGNMENT_SOURCE = 'admin_practice_session';
export const ADMIN_PRACTICE_SESSION_DEFAULT_TITLE = 'Practice Session Access';

export type AdminPracticeSessionQuestion = PracticeQuestionScopeSource & {
  accessLevel?: 'free' | 'paid';
  mockTestOnly?: boolean;
  teacherId?: string;
  questionType?: 'MCQ' | 'Numerical' | 'Text';
  difficultyLevel?: 'Easy' | 'Medium' | 'Hard';
};

export type AdminPracticeSessionQuestionScopeIndex<
  TQuestion extends AdminPracticeSessionQuestion = AdminPracticeSessionQuestion,
> = {
  questions: TQuestion[];
  questionById: Map<string, TQuestion>;
  entriesByQuestionId: Map<string, PracticeQuestionScopeEntry<TQuestion>[]>;
};

type BuildAdminPracticeSessionQuestionScopeIndexInput<
  TQuestion extends AdminPracticeSessionQuestion,
> = {
  questions: TQuestion[];
  teacherId?: string;
  accessLevel?: 'free' | 'paid';
};

type ResolveAvailableQuestionIdsInput<TQuestion extends AdminPracticeSessionQuestion> = {
  index: AdminPracticeSessionQuestionScopeIndex<TQuestion>;
  examTypeId: string;
  classId: string;
  config: PremiumPracticeTopicConfig;
  excludedQuestionIds?: Set<string>;
};

type SelectReusableQuestionIdsInput<TQuestion extends AdminPracticeSessionQuestion> = {
  index: AdminPracticeSessionQuestionScopeIndex<TQuestion>;
  examTypeId: string;
  classId: string;
  configs: PremiumPracticeTopicConfig[];
  seedQuestionIds?: string[];
};

type BuildAdminPracticeSessionPurchasePayloadInput = {
  id: string;
  studentId: string;
  teacherId: string;
  teacherName?: string;
  examTypeId: string;
  examTypeName?: string;
  classId: string;
  className?: string;
  questionBankSource?: 'student_plus_official' | 'teacher_official';
  configs: PremiumPracticeTopicConfig[];
  includedQuestionIds: string[];
  includedQuestionCountByDifficulty?: { easy?: number; medium?: number; hard?: number };
  attemptPricing?: PremiumPracticeAttemptPricingRule | null;
  perQuestionTimeSeconds?: number | null;
  assignedByAdminId?: string;
  assignedByAdminEmail?: string;
  assignedAt?: string;
};

const PREVIOUS_YEAR_PATTERN = /^(19|20)\d{2}$/;

const normalizePreviousYearValue = (value?: string) => {
  const year = String(value || '').trim();
  return PREVIOUS_YEAR_PATTERN.test(year) ? year : '';
};

const normalizePreviousYearList = (value?: string[]) =>
  Array.from(
    new Set(
      (value || [])
        .map((entry) => normalizePreviousYearValue(entry))
        .filter(Boolean),
    ),
  ).sort((left, right) => Number(right) - Number(left));

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

export const normalizeAdminPracticeSessionSubtopicPathSelections = (values: string[] = []) => {
  const unique = new Map<string, string>();
  values.forEach((value) => {
    const parsed = parseSubtopicPathSelection(value);
    if (!parsed.length) return;
    const key = getSubtopicPathKey(parsed);
    if (!key || unique.has(key)) return;
    unique.set(key, serializeSubtopicPathSelection(parsed));
  });
  return Array.from(unique.values()).sort((left, right) => left.localeCompare(right));
};

const subtopicPathStartsWith = (path: string[], prefix: string[]) => {
  const normalizedPath = normalizeSubtopicPathSegments(path);
  const normalizedPrefix = normalizeSubtopicPathSegments(prefix);
  if (!normalizedPrefix.length) return true;
  if (normalizedPath.length < normalizedPrefix.length) return false;
  return normalizedPrefix.every(
    (segment, index) => normalizeSubtopicValue(normalizedPath[index]) === normalizeSubtopicValue(segment),
  );
};

const matchesQuestionBankSource = (
  entry: Pick<PracticeQuestionScopeEntry, 'mockTestOnly'>,
  source: 'student_plus_official' | 'teacher_official',
) => (source === 'teacher_official' ? !!entry.mockTestOnly : !entry.mockTestOnly);

export const normalizeAdminPracticeSessionTopicConfigs = (
  configs?: Array<Partial<PremiumPracticeTopicConfig> | null>,
) => normalizePremiumPracticeTopicConfigs(
  (configs || []).map((config) => ({
    subjectId: String(config?.subjectId || '').trim(),
    topicId: String(config?.topicId || '').trim(),
    subtopics: normalizeAdminPracticeSessionSubtopicPathSelections(
      Array.isArray(config?.subtopics)
        ? config.subtopics.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [],
    ),
    questionBankSource: config?.questionBankSource === 'teacher_official' ? 'teacher_official' : 'student_plus_official',
    questionType: config?.questionType === 'MCQ' || config?.questionType === 'Numerical' ? config.questionType : 'All',
    difficultyLevel: 'Easy' as const,
    previousYearMode: config?.previousYearMode === 'pyq' ? 'pyq' : 'all',
    previousYears: normalizePreviousYearList(config?.previousYears),
    count: Math.max(0, Number(config?.count || 0)),
  })),
);

const matchesConfigEntry = <TQuestion extends AdminPracticeSessionQuestion>(
  entry: PracticeQuestionScopeEntry<TQuestion>,
  config: PremiumPracticeTopicConfig,
  examTypeId: string,
  classId: string,
) => {
  if (entry.examTypeId !== examTypeId || entry.classId !== classId) return false;
  if (entry.subjectId !== config.subjectId || entry.topicId !== config.topicId) return false;
  if (!matchesQuestionBankSource(entry, config.questionBankSource || 'student_plus_official')) return false;
  if (config.questionType !== 'All' && entry.questionType !== config.questionType) return false;
  

  if (config.previousYearMode === 'pyq') {
    if (!entry.isPreviousYear || !entry.previousYear) return false;
    const selectedYears = normalizePreviousYearList(config.previousYears || []);
    if (selectedYears.length > 0 && !selectedYears.includes(entry.previousYear)) return false;
  }

  const selectedSubtopicPaths = normalizeAdminPracticeSessionSubtopicPathSelections(config.subtopics || []);
  if (selectedSubtopicPaths.length === 0) return true;
  if (!entry.subtopics || entry.subtopics.length === 0) return false;

  return selectedSubtopicPaths.some((selection) => {
    const selectionPath = parseSubtopicPathSelection(selection);
    return subtopicPathStartsWith(entry.subtopics, selectionPath);
  });
};

const practiceConfigSpecificity = (
  config: Pick<PremiumPracticeTopicConfig, 'questionType' | 'previousYearMode' | 'previousYears' | 'subtopics'>,
) => {
  const normalizedSubtopics = normalizeAdminPracticeSessionSubtopicPathSelections(config.subtopics || []);
  return (
    normalizedSubtopics.length * 100
    + (config.previousYearMode === 'pyq' ? 20 : 0)
    + (config.previousYears || []).length * 5
    + (config.questionType !== 'All' ? 1 : 0)
  );
};

export const buildAdminPracticeSessionQuestionScopeIndex = <
  TQuestion extends AdminPracticeSessionQuestion,
>({
  questions,
  teacherId,
  accessLevel = 'paid',
}: BuildAdminPracticeSessionQuestionScopeIndexInput<TQuestion>): AdminPracticeSessionQuestionScopeIndex<TQuestion> => {
  const filteredQuestions = (questions || []).filter((question) => {
    if (!question?.id) return false;
    if (teacherId && String(question.teacherId || '').trim() !== teacherId) return false;
    return (question.accessLevel || 'free') === accessLevel;
  });

  const questionById = new Map<string, TQuestion>();
  const entriesByQuestionId = new Map<string, PracticeQuestionScopeEntry<TQuestion>[]>();

  filteredQuestions.forEach((question) => {
    questionById.set(question.id, question);
    entriesByQuestionId.set(question.id, buildPracticeQuestionScopeEntries(question));
  });

  return {
    questions: filteredQuestions,
    questionById,
    entriesByQuestionId,
  };
};

export const getAdminPracticeSessionAvailableQuestionIds = <
  TQuestion extends AdminPracticeSessionQuestion,
>({
  index,
  examTypeId,
  classId,
  config,
  excludedQuestionIds,
}: ResolveAvailableQuestionIdsInput<TQuestion>) => {
  const normalizedConfigs = normalizeAdminPracticeSessionTopicConfigs([config]);
  const normalizedConfig = normalizedConfigs[0];
  if (!normalizedConfig || !examTypeId || !classId) return [] as string[];

  return index.questions
    .filter((question) => {
      if ((excludedQuestionIds || new Set<string>()).has(question.id)) return false;
      const entries = index.entriesByQuestionId.get(question.id) || [];
      return entries.some((entry) => matchesConfigEntry(entry, normalizedConfig, examTypeId, classId));
    })
    .map((question) => question.id)
    .sort((left, right) => left.localeCompare(right));
};

export const getAdminPracticeSessionAvailableQuestionCount = <
  TQuestion extends AdminPracticeSessionQuestion,
>(
  input: ResolveAvailableQuestionIdsInput<TQuestion>,
) => getAdminPracticeSessionAvailableQuestionIds(input).length;

export const countAdminPracticeSessionQuestionIdsByDifficulty = <
  TQuestion extends AdminPracticeSessionQuestion,
>(
  questionIds: string[],
  questionById: Map<string, TQuestion>,
) =>
  questionIds.reduce(
    (acc, questionId) => {
      const difficultyLevel = questionById.get(questionId)?.difficultyLevel;
      if (difficultyLevel === 'Medium') acc.medium += 1;
      else if (difficultyLevel === 'Hard') acc.hard += 1;
      else acc.easy += 1;
      return acc;
    },
    { easy: 0, medium: 0, hard: 0 },
  );

export const selectAdminPracticeSessionReusableQuestionIds = <
  TQuestion extends AdminPracticeSessionQuestion,
>({
  index,
  examTypeId,
  classId,
  configs,
  seedQuestionIds = [],
}: SelectReusableQuestionIdsInput<TQuestion>) => {
  const normalizedConfigs = normalizeAdminPracticeSessionTopicConfigs(configs);
  const slots = normalizedConfigs.flatMap((config, configIndex) =>
    Array.from({ length: Math.max(0, Math.floor(Number(config.count || 0))) }, (_, slotIndex) => ({
      id: `${configIndex}:${slotIndex}`,
      config,
      configIndex,
      specificity: practiceConfigSpecificity(config),
    })),
  );

  if (!examTypeId || !classId || slots.length === 0) {
    return {
      selectedQuestionIds: [] as string[],
      insufficientConfigs: [] as Array<{
        indexPosition: number;
        config: PremiumPracticeTopicConfig;
        requestedCount: number;
        availableCount: number;
      }>,
    };
  }

  const candidateEntries = index.questions
    .map((question) => {
      const questionEntries = index.entriesByQuestionId.get(question.id) || [];
      const matchingSlotIds = slots
        .filter((slot) =>
          questionEntries.some((entry) => matchesConfigEntry(entry, slot.config, examTypeId, classId)),
        )
        .sort(
          (left, right) =>
            right.specificity - left.specificity
            || left.configIndex - right.configIndex
            || left.id.localeCompare(right.id),
        )
        .map((slot) => slot.id);

      if (matchingSlotIds.length === 0) return null;
      return {
        questionId: question.id,
        matchingSlotIds,
      };
    })
    .filter((entry): entry is { questionId: string; matchingSlotIds: string[] } => !!entry)
    .sort((left, right) => left.questionId.localeCompare(right.questionId));

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

  seedQuestionIds
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .forEach((questionId) => {
      assignQuestionToSlot(questionId, new Set<string>());
    });

  candidateEntries
    .filter((entry) => !questionToSlotId.has(entry.questionId))
    .sort(
      (left, right) =>
        left.matchingSlotIds.length - right.matchingSlotIds.length
        || left.questionId.localeCompare(right.questionId),
    )
    .forEach((candidate) => {
      assignQuestionToSlot(candidate.questionId, new Set<string>());
    });

  const selectedQuestionIds = [
    ...seedQuestionIds.filter((questionId) => questionToSlotId.has(questionId)),
    ...candidateEntries
      .map((entry) => entry.questionId)
      .filter((questionId) => questionToSlotId.has(questionId) && !seedQuestionIds.includes(questionId)),
  ];

  const assignedCountByConfigIndex = new Map<number, number>();
  Array.from(slotToQuestionId.keys()).forEach((slotId) => {
    const configIndex = Number(String(slotId).split(':')[0] || -1);
    if (configIndex < 0) return;
    assignedCountByConfigIndex.set(configIndex, (assignedCountByConfigIndex.get(configIndex) || 0) + 1);
  });

  const insufficientConfigs = normalizedConfigs.reduce<Array<{
    indexPosition: number;
    config: PremiumPracticeTopicConfig;
    requestedCount: number;
    availableCount: number;
  }>>((result, config, indexPosition) => {
    const assignedCount = assignedCountByConfigIndex.get(indexPosition) || 0;
    if (assignedCount >= config.count) return result;
    result.push({
      indexPosition,
      config,
      requestedCount: config.count,
      availableCount: assignedCount,
    });
    return result;
  }, []);

  return {
    selectedQuestionIds,
    insufficientConfigs,
  };
};

export const buildAdminPracticeSessionPurchasePayload = ({
  id,
  studentId,
  teacherId,
  teacherName,
  examTypeId,
  examTypeName,
  classId,
  className,
  questionBankSource = 'student_plus_official',
  configs,
  includedQuestionIds,
  includedQuestionCountByDifficulty,
  attemptPricing = null,
  perQuestionTimeSeconds = null,
  assignedByAdminId,
  assignedByAdminEmail,
  assignedAt,
}: BuildAdminPracticeSessionPurchasePayloadInput) => {
  const timestamp = assignedAt || new Date().toISOString();
  const normalizedConfigs = normalizeAdminPracticeSessionTopicConfigs(configs);
  const totalQuestions = includedQuestionIds.length;

  return {
    id,
    studentId,
    teacherId,
    teacherName: String(teacherName || '').trim() || DCAM_QUESTION_BANK_LABEL,
    examTypeId,
    examTypeName: String(examTypeName || '').trim(),
    classId,
    className: String(className || '').trim(),
    practiceMode: 'premium',
    status: 'paid',
    questionCount: totalQuestions,
    questionCountByDifficulty: includedQuestionCountByDifficulty || { easy: 0, medium: 0, hard: 0 },
    includedQuestionCount: totalQuestions,
    includedQuestionIds,
    includedQuestionCountByDifficulty: includedQuestionCountByDifficulty || { easy: 0, medium: 0, hard: 0 },
    grossAmount: 0,
    attemptsPaidAmount: 0,
    totalAmountPaid: 0,
    currency: 'INR',
    questionBankSource,
    topicConfigs: normalizedConfigs,
    includedTopicConfigs: normalizedConfigs,
    perQuestionTimeSeconds:
      Number(perQuestionTimeSeconds || 0) > 0 ? Math.floor(Number(perQuestionTimeSeconds || 0)) : null,
    attemptPricing,
    purchasedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    assignmentSource: ADMIN_PRACTICE_SESSION_ASSIGNMENT_SOURCE,
    assignedByAdminId: String(assignedByAdminId || '').trim() || null,
    assignedByAdminEmail: String(assignedByAdminEmail || '').trim() || null,
  };
};
