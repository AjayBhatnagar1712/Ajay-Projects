import type { PremiumCustomMockAttemptPricingRule } from '@/lib/premium-custom-mock';
import { buildPracticeQuestionScopeEntries, type PracticeQuestionScopeEntry, type PracticeQuestionScopeSource } from '@/lib/practice-question-scope';
import { normalizeSubtopicValue, splitSubtopicPath } from '@/lib/subtopic-paths';
import type { TeacherOfferCustomMockSectionConfig } from '@/lib/teacher-offers';
import { DCAM_QUESTION_BANK_LABEL } from '@/lib/teacher-authoring';

export const ADMIN_CUSTOM_MOCK_ASSIGNMENT_SOURCE = 'admin_custom_mock';
export const ADMIN_CUSTOM_MOCK_DEFAULT_TITLE = 'Admin Assigned Custom Mock Questions';

export type AdminCustomMockQuestion = PracticeQuestionScopeSource & {
  accessLevel?: 'free' | 'paid';
  mockTestOnly?: boolean;
  questionType?: 'MCQ' | 'Numerical' | 'Text';
  difficultyLevel?: 'Easy' | 'Medium' | 'Hard';
  teacherId?: string;
};

export type AdminCustomMockScopeConfig = TeacherOfferCustomMockSectionConfig & {
  topicId?: string;
  topicName?: string;
  subtopic?: string;
  subtopicPaths?: string[];
  questionSource?: 'all' | 'pyq';
  previousYears?: string[];
  randomizePerAttempt?: boolean;
};

export type AdminCustomMockQuestionScopeIndex<TQuestion extends AdminCustomMockQuestion = AdminCustomMockQuestion> = {
  questions: TQuestion[];
  questionById: Map<string, TQuestion>;
  entriesByQuestionId: Map<string, PracticeQuestionScopeEntry<TQuestion>[]>;
};

type BuildAdminCustomMockQuestionScopeIndexInput<TQuestion extends AdminCustomMockQuestion> = {
  questions: TQuestion[];
  teacherId?: string;
  accessLevel?: 'free' | 'paid';
  questionBankSource?: 'student_plus_official' | 'teacher_official';
};

type ResolveAvailableQuestionIdsInput<TQuestion extends AdminCustomMockQuestion> = {
  index: AdminCustomMockQuestionScopeIndex<TQuestion>;
  examTypeId: string;
  classId: string;
  config: AdminCustomMockScopeConfig;
  excludedQuestionIds?: Set<string>;
};

type SelectReusableQuestionIdsInput<TQuestion extends AdminCustomMockQuestion> = {
  index: AdminCustomMockQuestionScopeIndex<TQuestion>;
  examTypeId: string;
  classId: string;
  configs: AdminCustomMockScopeConfig[];
};

type BuildAdminCustomMockPurchasePayloadInput = {
  id: string;
  studentId: string;
  teacherId: string;
  teacherName?: string;
  examTypeId: string;
  examTypeName?: string;
  classId: string;
  className?: string;
  title?: string;
  questionBankSource?: 'student_plus_official' | 'teacher_official';
  configs: AdminCustomMockScopeConfig[];
  includedQuestionIds: string[];
  includedQuestionCountByDifficulty?: { easy?: number; medium?: number; hard?: number };
  attemptPricing?: PremiumCustomMockAttemptPricingRule | null;
  assignedByAdminId?: string;
  assignedByAdminEmail?: string;
  assignedAt?: string;
};

const PREVIOUS_YEAR_PATTERN = /^(19|20)\d{2}$/;

const isStudentPlusOfficialQuestion = (question: AdminCustomMockQuestion) => question.mockTestOnly !== true;
const matchesQuestionBankSource = (
  question: AdminCustomMockQuestion,
  source: 'student_plus_official' | 'teacher_official'
) => (source === 'teacher_official' ? !!question.mockTestOnly : isStudentPlusOfficialQuestion(question));

const normalizePreviousYearValue = (value?: string) => {
  const year = String(value || '').trim();
  return PREVIOUS_YEAR_PATTERN.test(year) ? year : '';
};

const normalizePreviousYearList = (value?: string[]) => Array.from(
  new Set(
    (value || [])
      .map((entry) => normalizePreviousYearValue(entry))
      .filter(Boolean)
  )
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

export const normalizeAdminCustomMockSubtopicPathSelections = (
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

  const normalizedLegacy = String(legacySubtopic || '').trim();
  if (normalizedLegacy) {
    const parsed = parseSubtopicPathSelection(normalizedLegacy);
    const key = getSubtopicPathKey(parsed);
    if (key && !unique.has(key)) {
      unique.set(key, serializeSubtopicPathSelection(parsed));
    }
  }

  return Array.from(unique.values()).sort((left, right) => left.localeCompare(right));
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

export const adminCustomMockConfigSpecificity = (
  config: Pick<AdminCustomMockScopeConfig, 'topicId' | 'subtopicPaths' | 'questionType' | 'questionSource' | 'previousYears' | 'difficultyLevel'>
) => {
  const normalizedSubtopicPaths = normalizeAdminCustomMockSubtopicPathSelections(config.subtopicPaths || []);
  return (
    (config.topicId ? 1000 : 0)
    + (normalizedSubtopicPaths.length * 100)
    + (config.questionSource === 'pyq' ? 20 : 0)
    + ((config.previousYears || []).length * 5)
    + (config.difficultyLevel !== 'All' ? 2 : 0)
    + (config.questionType !== 'All' ? 1 : 0)
  );
};

const normalizeAdminCustomMockScopeConfig = (
  config?: Partial<AdminCustomMockScopeConfig> | null
): AdminCustomMockScopeConfig | null => {
  const subjectId = String(config?.subjectId || '').trim();
  const count = Math.max(0, Number(config?.count || 0));
  if (!subjectId || count <= 0) return null;

  const rawQuestionType = String(config?.questionType || 'All').trim();
  const rawDifficultyLevel = String(config?.difficultyLevel || 'All').trim();

  return {
    subjectId,
    subjectName: String(config?.subjectName || '').trim(),
    topicId: String(config?.topicId || '').trim(),
    topicName: String(config?.topicName || '').trim(),
    subtopic: String(config?.subtopic || '').trim(),
    subtopicPaths: normalizeAdminCustomMockSubtopicPathSelections(config?.subtopicPaths, config?.subtopic),
    questionSource: config?.questionSource === 'pyq' ? 'pyq' : 'all',
    previousYears: normalizePreviousYearList(config?.previousYears),
    randomizePerAttempt: !!config?.randomizePerAttempt,
    questionType:
      rawQuestionType === 'MCQ' || rawQuestionType === 'Numerical' || rawQuestionType === 'Text'
        ? rawQuestionType
        : 'All',
    difficultyLevel:
      'Easy' as const,
    count,
  };
};

export const normalizeAdminCustomMockScopeConfigs = (configs?: Array<Partial<AdminCustomMockScopeConfig> | null>) =>
  (configs || [])
    .map((config) => normalizeAdminCustomMockScopeConfig(config))
    .filter((config): config is AdminCustomMockScopeConfig => !!config);

const matchesConfigEntry = <TQuestion extends AdminCustomMockQuestion>(
  entry: PracticeQuestionScopeEntry<TQuestion>,
  config: AdminCustomMockScopeConfig,
  examTypeId: string,
  classId: string
) => {
  if (entry.examTypeId !== examTypeId || entry.classId !== classId) return false;
  if (entry.subjectId !== config.subjectId) return false;
  if (config.topicId && entry.topicId !== config.topicId) return false;
  if (config.questionType && config.questionType !== 'All' && entry.questionType !== config.questionType) return false;
  

  const questionSource = config.questionSource === 'pyq' ? 'pyq' : 'all';
  if (questionSource === 'pyq') {
    if (!entry.isPreviousYear || !entry.previousYear) return false;
    const selectedYears = normalizePreviousYearList(config.previousYears || []);
    if (selectedYears.length > 0 && !selectedYears.includes(entry.previousYear)) return false;
  }

  const selectedSubtopicPaths = normalizeAdminCustomMockSubtopicPathSelections(config.subtopicPaths, config.subtopic);
  if (selectedSubtopicPaths.length === 0) return true;
  if (!entry.subtopics || entry.subtopics.length === 0) return false;

  return selectedSubtopicPaths.some((selection) => {
    const selectionPath = parseSubtopicPathSelection(selection);
    return subtopicPathStartsWith(entry.subtopics, selectionPath);
  });
};

export const buildAdminCustomMockQuestionScopeIndex = <TQuestion extends AdminCustomMockQuestion>({
  questions,
  teacherId,
  accessLevel = 'paid',
  questionBankSource = 'student_plus_official',
}: BuildAdminCustomMockQuestionScopeIndexInput<TQuestion>): AdminCustomMockQuestionScopeIndex<TQuestion> => {
  const filteredQuestions = (questions || []).filter((question) => {
    if (!question?.id) return false;
    if (teacherId && String(question.teacherId || '').trim() !== teacherId) return false;
    if ((question.accessLevel || 'free') !== accessLevel) return false;
    return matchesQuestionBankSource(question, questionBankSource);
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

export const getAdminCustomMockAvailableQuestionIds = <TQuestion extends AdminCustomMockQuestion>({
  index,
  examTypeId,
  classId,
  config,
  excludedQuestionIds,
}: ResolveAvailableQuestionIdsInput<TQuestion>) => {
  const normalizedConfig = normalizeAdminCustomMockScopeConfig(config);
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

export const getAdminCustomMockAvailableQuestionCount = <TQuestion extends AdminCustomMockQuestion>(
  input: ResolveAvailableQuestionIdsInput<TQuestion>
) => getAdminCustomMockAvailableQuestionIds(input).length;

export const getAdminCustomMockSubtopicPathPool = <TQuestion extends AdminCustomMockQuestion>({
  index,
  examTypeId,
  classId,
  subjectId,
  topicId,
}: {
  index: AdminCustomMockQuestionScopeIndex<TQuestion>;
  examTypeId: string;
  classId: string;
  subjectId?: string;
  topicId?: string;
}) => {
  const normalizedSubjectId = String(subjectId || '').trim();
  const normalizedTopicId = String(topicId || '').trim();
  if (!normalizedSubjectId || !normalizedTopicId) return [] as string[][];

  const uniquePaths = new Map<string, string[]>();

  index.questions.forEach((question) => {
    const entries = index.entriesByQuestionId.get(question.id) || [];
    const matchingEntries = entries.filter((entry) =>
      entry.examTypeId === examTypeId
      && entry.classId === classId
      && entry.subjectId === normalizedSubjectId
      && entry.topicId === normalizedTopicId
    );

    matchingEntries.forEach((entry) => {
      const normalizedPath = normalizeSubtopicPathSegments(entry.subtopics || []);
      if (!normalizedPath.length) return;
      const key = getSubtopicPathKey(normalizedPath);
      if (!key || uniquePaths.has(key)) return;
      uniquePaths.set(key, normalizedPath);
    });
  });

  return Array.from(uniquePaths.values()).sort((left, right) => left.join(' > ').localeCompare(right.join(' > ')));
};

export const selectAdminCustomMockReusableQuestionIds = <TQuestion extends AdminCustomMockQuestion>({
  index,
  examTypeId,
  classId,
  configs,
}: SelectReusableQuestionIdsInput<TQuestion>) => {
  const normalizedConfigs = normalizeAdminCustomMockScopeConfigs(configs);
  const prioritizedConfigs = normalizedConfigs
    .map((config, indexPosition) => ({
      config,
      indexPosition,
      specificity: adminCustomMockConfigSpecificity(config),
    }))
    .sort((left, right) => right.specificity - left.specificity || left.indexPosition - right.indexPosition);

  const selectedQuestionIds: string[] = [];
  const usedQuestionIds = new Set<string>();
  const insufficientConfigs: Array<{
    indexPosition: number;
    config: AdminCustomMockScopeConfig;
    requestedCount: number;
    availableCount: number;
  }> = [];

  prioritizedConfigs.forEach(({ config, indexPosition }) => {
    const availableQuestionIds = getAdminCustomMockAvailableQuestionIds({
      index,
      examTypeId,
      classId,
      config,
      excludedQuestionIds: usedQuestionIds,
    });

    if (availableQuestionIds.length < config.count) {
      insufficientConfigs.push({
        indexPosition,
        config,
        requestedCount: config.count,
        availableCount: availableQuestionIds.length,
      });
      return;
    }

    const nextQuestionIds = availableQuestionIds.slice(0, config.count);
    nextQuestionIds.forEach((questionId) => {
      usedQuestionIds.add(questionId);
      selectedQuestionIds.push(questionId);
    });
  });

  return {
    selectedQuestionIds,
    insufficientConfigs,
  };
};

export const countAdminCustomMockQuestionIdsByDifficulty = <TQuestion extends AdminCustomMockQuestion>(
  questionIds: string[],
  questionById: Map<string, TQuestion>
) =>
  questionIds.reduce(
    (acc, questionId) => {
      const difficultyLevel = questionById.get(questionId)?.difficultyLevel;
      if (difficultyLevel === 'Medium') acc.medium += 1;
      else if (difficultyLevel === 'Hard') acc.hard += 1;
      else acc.easy += 1;
      return acc;
    },
    { easy: 0, medium: 0, hard: 0 }
  );

export const buildAdminCustomMockPurchasePayload = ({
  id,
  studentId,
  teacherId,
  teacherName,
  examTypeId,
  examTypeName,
  classId,
  className,
  title,
  questionBankSource = 'student_plus_official',
  configs,
  includedQuestionIds,
  includedQuestionCountByDifficulty,
  attemptPricing = null,
  assignedByAdminId,
  assignedByAdminEmail,
  assignedAt,
}: BuildAdminCustomMockPurchasePayloadInput) => {
  const timestamp = assignedAt || new Date().toISOString();
  const normalizedConfigs = normalizeAdminCustomMockScopeConfigs(configs);
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
    premiumCombinationKey: `${teacherId}__${examTypeId}__${classId}`,
    premiumCustomMockTestId: '',
    testTitle: String(title || '').trim() || ADMIN_CUSTOM_MOCK_DEFAULT_TITLE,
    amount: 0,
    questionCount: totalQuestions,
    includedQuestionCount: totalQuestions,
    includedQuestionIds,
    includedQuestionCountByDifficulty: includedQuestionCountByDifficulty || { easy: 0, medium: 0, hard: 0 },
    questionAmountPaid: 0,
    attemptAmountPaid: 0,
    currency: 'INR',
    questionBankSource,
    duration: null,
    marksPerQuestion: null,
    negativeMarksPerQuestion: null,
    attemptPricing,
    subjectConfigs: normalizedConfigs,
    includedSubjectConfigs: normalizedConfigs,
    paidAt: timestamp,
    purchasedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'paid',
    assignmentSource: ADMIN_CUSTOM_MOCK_ASSIGNMENT_SOURCE,
    assignedByAdminId: String(assignedByAdminId || '').trim() || null,
    assignedByAdminEmail: String(assignedByAdminEmail || '').trim() || null,
  };
};
