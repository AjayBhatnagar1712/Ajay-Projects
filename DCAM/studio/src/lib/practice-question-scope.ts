import { normalizeSubtopicValue, splitSubtopicPath } from '@/lib/subtopic-paths';
import { QUESTION_DIFFICULTY } from '@/lib/question-difficulty';

type ScopeDifficultyLevel = 'Easy' | 'Medium' | 'Hard';
type ScopeQuestionType = 'MCQ' | 'Numerical' | 'Text';
type ScopeAccessLevel = 'free' | 'paid';

export type PracticeQuestionScopeAlignment = {
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  topicId?: string;
  subtopics?: string[];
  difficultyLevel?: ScopeDifficultyLevel;
  accessLevel?: ScopeAccessLevel;
  mockTestOnly?: boolean;
  isPreviousYear?: boolean;
  previousYear?: string;
};

export type PracticeQuestionScopeSource = {
  id: string;
  teacherId?: string;
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  topicId?: string;
  subtopics?: string[];
  questionType?: ScopeQuestionType;
  difficultyLevel?: ScopeDifficultyLevel;
  accessLevel?: ScopeAccessLevel;
  mockTestOnly?: boolean;
  isPreviousYear?: boolean;
  previousYear?: string;
  alignments?: PracticeQuestionScopeAlignment[];
};

export type PracticeQuestionScopeEntry<TQuestion extends PracticeQuestionScopeSource = PracticeQuestionScopeSource> = {
  entryId: string;
  sourceQuestionId: string;
  sourceQuestion: TQuestion;
  isAlignment: boolean;
  alignmentIndex: number;
  teacherId: string;
  examTypeId: string;
  classId: string;
  subjectId: string;
  topicId: string;
  subtopics: string[];
  questionType: ScopeQuestionType;
  difficultyLevel: ScopeDifficultyLevel;
  accessLevel: ScopeAccessLevel;
  mockTestOnly: boolean;
  isPreviousYear: boolean;
  previousYear: string;
};

const normalizeSubtopicPaths = (values?: string[]) => {
  const unique = new Map<string, string>();
  (values || []).forEach((value) => {
    const segments = splitSubtopicPath(String(value || '')).map((segment) => segment.trim()).filter(Boolean);
    if (segments.length === 0) return;
    const normalized = segments.join(' > ');
    const key = segments.map((segment) => normalizeSubtopicValue(segment)).join('>');
    if (!key || unique.has(key)) return;
    unique.set(key, normalized);
  });
  return Array.from(unique.values()).sort((left, right) => left.localeCompare(right));
};

const getScopeEntryKey = (
  examTypeId: string,
  classId: string,
  subjectId: string,
  topicId: string,
  subtopics: string[],
  questionType: ScopeQuestionType,
  difficultyLevel: ScopeDifficultyLevel,
  accessLevel: ScopeAccessLevel,
  mockTestOnly: boolean,
  isPreviousYear: boolean,
  previousYear: string
) => [
  examTypeId,
  classId,
  subjectId,
  topicId,
  ...subtopics,
  questionType,
  difficultyLevel,
  accessLevel,
  mockTestOnly ? 'mock-only' : 'student-plus',
  isPreviousYear ? 'pyq' : 'standard',
  previousYear,
].join('::');

export const countUniquePracticeQuestions = <TQuestion extends PracticeQuestionScopeSource>(
  entries: PracticeQuestionScopeEntry<TQuestion>[]
) => new Set(entries.map((entry) => entry.sourceQuestionId)).size;

export const buildPracticeQuestionScopeEntries = <TQuestion extends PracticeQuestionScopeSource>(
  question: TQuestion
): PracticeQuestionScopeEntry<TQuestion>[] => {
  const entries: PracticeQuestionScopeEntry<TQuestion>[] = [];
  const seenEntryKeys = new Set<string>();

  const pushEntry = (params: {
    isAlignment: boolean;
    alignmentIndex: number;
    examTypeId?: string;
    classId?: string;
    subjectId?: string;
    topicId?: string;
    subtopics?: string[];
    difficultyLevel?: ScopeDifficultyLevel;
    accessLevel?: ScopeAccessLevel;
    mockTestOnly?: boolean;
    isPreviousYear?: boolean;
    previousYear?: string;
  }) => {
    const examTypeId = String(params.examTypeId || '').trim();
    const classId = String(params.classId || '').trim();
    const subjectId = String(params.subjectId || '').trim();
    const topicId = String(params.topicId || '').trim();
    if (!examTypeId || !classId || !subjectId || !topicId) return;

    const subtopics = normalizeSubtopicPaths(params.subtopics);
    const questionType = question.questionType === 'Numerical' || question.questionType === 'Text' ? question.questionType : 'MCQ';
    const difficultyLevel: ScopeDifficultyLevel = QUESTION_DIFFICULTY;
    const accessLevel = (params.accessLevel || question.accessLevel || 'free') === 'paid' ? 'paid' : 'free';
    const mockTestOnly = !!(params.mockTestOnly ?? question.mockTestOnly);
    const isPreviousYear = !!(params.isPreviousYear ?? question.isPreviousYear);
    const previousYear = String(params.previousYear ?? question.previousYear ?? '').trim();
    const entryKey = getScopeEntryKey(
      examTypeId,
      classId,
      subjectId,
      topicId,
      subtopics,
      questionType,
      difficultyLevel,
      accessLevel,
      mockTestOnly,
      isPreviousYear,
      previousYear
    );
    if (!entryKey || seenEntryKeys.has(entryKey)) return;
    seenEntryKeys.add(entryKey);

    entries.push({
      entryId: `${question.id}:${params.isAlignment ? `alignment-${params.alignmentIndex}` : 'primary'}`,
      sourceQuestionId: question.id,
      sourceQuestion: question,
      isAlignment: params.isAlignment,
      alignmentIndex: params.alignmentIndex,
      teacherId: String(question.teacherId || '').trim(),
      examTypeId,
      classId,
      subjectId,
      topicId,
      subtopics,
      questionType,
      difficultyLevel,
      accessLevel,
      mockTestOnly,
      isPreviousYear,
      previousYear,
    });
  };

  pushEntry({
    isAlignment: false,
    alignmentIndex: -1,
    examTypeId: question.examTypeId,
    classId: question.classId,
    subjectId: question.subjectId,
    topicId: question.topicId,
    subtopics: question.subtopics,
    difficultyLevel: question.difficultyLevel,
    accessLevel: question.accessLevel,
    mockTestOnly: question.mockTestOnly,
    isPreviousYear: question.isPreviousYear,
    previousYear: question.previousYear,
  });

  (question.alignments || []).forEach((alignment, index) => {
    pushEntry({
      isAlignment: true,
      alignmentIndex: index,
      examTypeId: alignment.examTypeId,
      classId: alignment.classId,
      subjectId: alignment.subjectId,
      topicId: alignment.topicId,
      subtopics: alignment.subtopics,
      difficultyLevel: alignment.difficultyLevel,
      accessLevel: alignment.accessLevel,
      mockTestOnly: alignment.mockTestOnly,
      isPreviousYear: alignment.isPreviousYear,
      previousYear: alignment.previousYear,
    });
  });

  return entries;
};
