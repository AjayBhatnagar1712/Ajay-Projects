'use client';
import { normalizeQuestionDifficulty } from '@/lib/question-difficulty';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import DashboardHeader from '@/components/dashboard-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useStorage, useUser } from '@/firebase';
import { collection, deleteDoc, deleteField, doc, documentId, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, BarChart3, Eye, EyeOff, LayoutGrid, LoaderCircle, Pencil, PlusCircle, RefreshCw, Save, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import MathText from '@/components/math-text';
import PdfQuestionExtractor from '@/components/pdf-question-extractor';
import {
  ALLOWED_TEACHER_AUTHOR_EMAIL,
  DCAM_PRACTICE_QUESTION_COUNTS,
  DCAM_PRACTICE_SUMMARY_DOC_ID,
  DCAM_QUESTION_BANK_LABEL,
  getTeacherAuthoringRestrictionCopy,
  isAllowedTeacherAuthorEmail,
  resolveDcamQuestionBankOwnerId,
} from '@/lib/teacher-authoring';
import {
  syncPracticeQuestionSummaryForBulkDelete,
  syncPracticeQuestionSummaryForBulkUpdate,
  syncPracticeQuestionSummaryForDelete,
  syncPracticeQuestionSummaryForUpdate,
} from '@/lib/practice-question-summary';

type PracticeQuestion = {
  id: string;
  questionTitle?: string;
  questionNumber?: number;
  questionText: string;
  solutionExplanation?: string;
  questionType: 'MCQ' | 'Numerical' | 'Text';
  options?: string[];
  mcqAnswerMode?: 'single' | 'multiple';
  correctAnswer?: string;
  correctAnswers?: string[];
  numericalAnswer?: number;
  numericalAnswerText?: string;
  textAnswer?: string;
  difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  isPreviousYear?: boolean;
  previousYear?: string;
  examTypeId: string;
  classId: string;
  subjectId: string;
  topicId: string;
  subtopics?: string[];
  alignments?: Array<{
    examTypeId: string;
    classId: string;
    subjectId: string;
    topicId?: string;
    subtopics?: string[];
    questionNumber?: number;
    questionTitle?: string;
    accessLevel?: 'free' | 'paid';
    mockTestOnly?: boolean;
    difficultyLevel?: 'Easy' | 'Medium' | 'Hard';
    isPreviousYear?: boolean;
    previousYear?: string;
  }>;
  accessLevel?: 'free' | 'paid';
  mockTestOnly?: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  explanationImageUrl?: string;
  explanationImageUrls?: string[];
  teacherId?: string;
};

type Class = { id: string; name: string; examTypeId: string };
type Subject = { id: string; name: string; classId: string };
type Topic = { id: string; name: string; subjectId: string };
type ExamType = { id: string; name: string };
type TeachingAssignment = { classId: string; subjectIds?: string[]; allSubjects?: boolean };
type UserProfile = {
  teachingAssignments?: TeachingAssignment[];
  teachesClassIds?: string[];
  teachesSubjectIds?: string[];
};
type PracticeSummaryDoc = {
  freeQuestionCount?: number;
  paidQuestionCount?: number;
  totalQuestionCount?: number;
  ownerTeacherId?: string;
};
type QuestionAlignment = NonNullable<PracticeQuestion['alignments']>[number];
type BulkEditState = {
  updateExamType: boolean;
  examTypeId: string;
  updateClass: boolean;
  classId: string;
  updateSubject: boolean;
  subjectId: string;
  updateTopic: boolean;
  topicId: string;
  updateSubtopics: boolean;
  subtopics: string[];
  subtopicInput: string;
  updatePreviousYearFlag: boolean;
  isPreviousYear: boolean;
  updatePreviousYearValue: boolean;
  previousYear: string;
};

const BULK_WRITE_CHUNK_SIZE = 400;

const createDefaultBulkEditState = (): BulkEditState => ({
  updateExamType: false,
  examTypeId: '',
  updateClass: false,
  classId: '',
  updateSubject: false,
  subjectId: '',
  updateTopic: false,
  topicId: '',
  updateSubtopics: false,
  subtopics: [],
  subtopicInput: '',
  updatePreviousYearFlag: false,
  isPreviousYear: false,
  updatePreviousYearValue: false,
  previousYear: '',
});

const toTextValue = (value: unknown): string => (
  typeof value === 'string' || typeof value === 'number' ? String(value) : ''
);

const toTrimmedString = (value: unknown): string => toTextValue(value).trim();

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => toTrimmedString(item)).filter(Boolean);
  }
  const single = toTrimmedString(value);
  return single ? [single] : [];
};

const toUniqueStringArray = (value: unknown): string[] => Array.from(new Set(toStringArray(value)));
const normalizeTeachingAssignments = (value: unknown): TeachingAssignment[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      classId: toTrimmedString(item.classId),
      subjectIds: toUniqueStringArray(item.subjectIds),
      allSubjects: !!item.allSubjects,
    }))
    .filter((item) => item.classId);
};

const toPositiveInteger = (value: unknown): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
};

const toFiniteNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeDifficultyLevelValue = (value: unknown): 'Easy' | 'Medium' | 'Hard' => {
  return 'Easy';
};

const normalizeQuestionTypeValue = (value: unknown): 'MCQ' | 'Numerical' | 'Text' => {
  if (value === 'MCQ' || value === 'Numerical') return value;
  return 'Text';
};

const normalizeAccessLevelValue = (value: unknown): 'free' | 'paid' => (value === 'paid' ? 'paid' : 'free');
const normalizeMcqAnswerModeValue = (value: unknown): 'single' | 'multiple' => (value === 'multiple' ? 'multiple' : 'single');
const isSupportedImageUrl = (value: string): boolean => /^(https?:\/\/|data:image\/|blob:)/i.test(value);
const isPersistedImageUrl = (value: string): boolean => /^https?:\/\//i.test(value);
const normalizeImageUrlList = (multiValue: unknown, singleValue?: unknown): string[] => {
  const values = [...toStringArray(multiValue), ...toStringArray(singleValue)]
    .map((item) => item.trim())
    .filter((item) => item && isSupportedImageUrl(item));
  return Array.from(new Set(values));
};

const normalizeSubtopicValue = (value: string) => value.trim().toLowerCase();
const splitSubtopicPath = (value: string): string[] => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return [];
  const delimiters = [/\s*>\s*/, /\s*->\s*/, /\s*\u2192\s*/, /\s*::\s*/, /\s*\/\s*/, /\s*\|\s*/];
  for (const delimiter of delimiters) {
    const pieces = trimmed.split(delimiter).map((item) => item.trim()).filter(Boolean);
    if (pieces.length > 1) return pieces;
  }
  return [trimmed];
};
const normalizeSubtopicPath = (value?: string): string => splitSubtopicPath(String(value || '')).join(' > ');
const normalizeSubtopics = (values?: unknown): string[] => {
  const byKey = new Map<string, string>();
  toStringArray(values).forEach((item) => {
    const normalized = normalizeSubtopicPath(item);
    if (!normalized) return;
    const key = normalizeSubtopicValue(normalized);
    if (byKey.has(key)) return;
    byKey.set(key, normalized);
  });
  return Array.from(byKey.values());
};
const normalizeQuestionAlignmentList = (value: unknown): QuestionAlignment[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      examTypeId: toTrimmedString(item.examTypeId),
      classId: toTrimmedString(item.classId),
      subjectId: toTrimmedString(item.subjectId),
      topicId: toTrimmedString(item.topicId),
      subtopics: normalizeSubtopics(item.subtopics),
      questionNumber: toPositiveInteger(item.questionNumber),
      questionTitle: toTrimmedString(item.questionTitle),
      accessLevel: normalizeAccessLevelValue(item.accessLevel),
      mockTestOnly: !!item.mockTestOnly,
      difficultyLevel: 'Easy' as const,
      isPreviousYear: !!item.isPreviousYear,
      previousYear: toTrimmedString(item.previousYear),
    }));
};
const sanitizePracticeQuestion = (question: PracticeQuestion): PracticeQuestion => {
  const raw = question as PracticeQuestion & Record<string, unknown>;
  const questionImages = normalizeImageUrlList(raw.imageUrls, raw.imageUrl);
  const explanationImages = normalizeImageUrlList(raw.explanationImageUrls, raw.explanationImageUrl);
  const correctAnswer = toTrimmedString(raw.correctAnswer);
  const correctAnswers = toUniqueStringArray(raw.correctAnswers);
  const options = toStringArray(raw.options);

  return {
    ...question,
    questionTitle: toTrimmedString(raw.questionTitle),
    questionNumber: toPositiveInteger(raw.questionNumber),
    questionText: toTextValue(raw.questionText),
    solutionExplanation: toTextValue(raw.solutionExplanation),
    questionType: normalizeQuestionTypeValue(raw.questionType),
    options,
    mcqAnswerMode: normalizeMcqAnswerModeValue(raw.mcqAnswerMode),
    correctAnswer,
    correctAnswers: correctAnswers.length > 0 ? correctAnswers : (correctAnswer ? [correctAnswer] : []),
    numericalAnswer: toFiniteNumber(raw.numericalAnswer),
    numericalAnswerText: toTrimmedString(raw.numericalAnswerText),
    textAnswer: toTextValue(raw.textAnswer),
    difficultyLevel: 'Easy' as const,
    isPreviousYear: !!raw.isPreviousYear,
    previousYear: toTrimmedString(raw.previousYear),
    examTypeId: toTrimmedString(raw.examTypeId),
    classId: toTrimmedString(raw.classId),
    subjectId: toTrimmedString(raw.subjectId),
    topicId: toTrimmedString(raw.topicId),
    subtopics: normalizeSubtopics(raw.subtopics),
    alignments: normalizeQuestionAlignmentList(raw.alignments),
    accessLevel: normalizeAccessLevelValue(raw.accessLevel),
    mockTestOnly: !!raw.mockTestOnly,
    imageUrls: questionImages,
    imageUrl: questionImages[0],
    explanationImageUrls: explanationImages,
    explanationImageUrl: explanationImages[0],
    teacherId: toTrimmedString(raw.teacherId),
  };
};

const uploadPracticeQuestionImage = async (
  storage: ReturnType<typeof useStorage>,
  teacherId: string,
  kind: 'question' | 'solution',
  dataUrl: string
): Promise<string> => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const contentType = blob.type || 'image/png';
  const extension = contentType.includes('jpeg') || contentType.includes('jpg')
    ? 'jpg'
    : contentType.includes('webp')
      ? 'webp'
      : 'png';
  const filePath = `content_files/${teacherId}/practice_questions/${kind}/${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`;
  const storageRef = ref(storage, filePath);
  const uploaded = await uploadBytes(storageRef, blob, { contentType });
  return getDownloadURL(uploaded.ref);
};

const persistPracticeQuestionImageUrls = async (
  storage: ReturnType<typeof useStorage>,
  teacherId: string,
  kind: 'question' | 'solution',
  multiValue: unknown,
  singleValue?: unknown
): Promise<string[]> => {
  const normalized = normalizeImageUrlList(multiValue, singleValue);
  if (normalized.length === 0) return [];

  const uploaded = await Promise.all(
    normalized.map(async (item) => {
      if (isPersistedImageUrl(item)) return item;
      if (!teacherId) {
        throw new Error('Teacher account missing for image upload.');
      }
      return uploadPracticeQuestionImage(storage, teacherId, kind, item);
    })
  );

  return Array.from(new Set(uploaded.map((item) => item.trim()).filter(Boolean)));
};

const isSubtopicPathWithinBranch = (candidate?: string, branch?: string): boolean => {
  const candidateSegments = splitSubtopicPath(String(candidate || '')).map((item) => normalizeSubtopicValue(item)).filter(Boolean);
  const branchSegments = splitSubtopicPath(String(branch || '')).map((item) => normalizeSubtopicValue(item)).filter(Boolean);
  if (branchSegments.length === 0) return false;
  if (candidateSegments.length < branchSegments.length) return false;
  return branchSegments.every((segment, index) => candidateSegments[index] === segment);
};
const getPrimarySubtopicForCategory = (subtopics?: string[]): string => {
  const normalized = normalizeSubtopics(subtopics);
  if (normalized.length === 0) return '';
  return [...normalized].sort((left, right) => {
    const depthDiff = splitSubtopicPath(right).length - splitSubtopicPath(left).length;
    if (depthDiff !== 0) return depthDiff;
    return left.localeCompare(right);
  })[0];
};
const normalizeQuestionTextValue = (value?: string) => String(value || '').trim().toLowerCase();
const QUESTION_NUMBER_REGEX = /(?:^|\b)question\s*#?\s*(\d+)\b/i;

const getQuestionNumber = (question: { questionNumber?: number; questionTitle?: string }): number => {
  const direct = Number(question.questionNumber ?? 0);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  const title = String(question.questionTitle || '').trim();
  if (!title) return 0;
  const match = title.match(QUESTION_NUMBER_REGEX) || title.match(/\b(\d+)\b/);
  const parsed = Number(match?.[1] || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
};

const buildQuestionTitle = (questionNumber: number): string => `Question ${Math.max(1, Math.floor(questionNumber || 1))}`;

const getDisplayQuestionTitle = (question: { questionNumber?: number; questionTitle?: string }): string => {
  const resolved = getQuestionNumber(question);
  if (resolved > 0) return buildQuestionTitle(resolved);
  const fallback = String(question.questionTitle || '').trim();
  return fallback || 'Untitled Question';
};

const getQuestionCategoryKey = (
  examTypeId?: string,
  classId?: string,
  subjectId?: string,
  topicId?: string,
  subtopics?: string[]
): string => {
  const exam = String(examTypeId || '').trim();
  const klass = String(classId || '').trim();
  const subject = String(subjectId || '').trim();
  const topic = String(topicId || '').trim();
  if (!exam || !klass || !subject || !topic) return '';
  const primarySubtopic = getPrimarySubtopicForCategory(subtopics) || '__no_subtopic__';
  return `${exam}::${klass}::${subject}::${topic}::${primarySubtopic}`;
};

const joinSubtopicPath = (parentPath: string, childLabel: string): string => {
  const parentSegments = splitSubtopicPath(parentPath);
  const childSegments = splitSubtopicPath(childLabel);
  return [...parentSegments, ...childSegments].join(' > ');
};

const isSameSubtopicPath = (left?: string, right?: string): boolean => (
  normalizeSubtopicValue(normalizeSubtopicPath(left || '')) === normalizeSubtopicValue(normalizeSubtopicPath(right || ''))
);

const stripSubtopicBranch = (values: string[] | undefined, branch: string): string[] => (
  normalizeSubtopics(values).filter((item) => !isSubtopicPathWithinBranch(item, branch))
);

type SubtopicHierarchyNode = {
  path: string;
  label: string;
  depth: number;
  explicit: boolean;
  children: SubtopicHierarchyNode[];
};

const buildSubtopicHierarchy = (paths?: string[]): SubtopicHierarchyNode[] => {
  const normalizedPaths = normalizeSubtopics(paths);
  const explicitKeys = new Set(normalizedPaths.map((item) => normalizeSubtopicValue(item)));
  const nodeMap = new Map<string, SubtopicHierarchyNode>();
  const roots: SubtopicHierarchyNode[] = [];

  normalizedPaths
    .sort((left, right) => {
      const depthDiff = splitSubtopicPath(left).length - splitSubtopicPath(right).length;
      if (depthDiff !== 0) return depthDiff;
      return left.localeCompare(right);
    })
    .forEach((fullPath) => {
      const segments = splitSubtopicPath(fullPath);
      segments.forEach((segment, index) => {
        const nodePath = segments.slice(0, index + 1).join(' > ');
        const nodeKey = normalizeSubtopicValue(nodePath);
        if (!nodeMap.has(nodeKey)) {
          const node: SubtopicHierarchyNode = {
            path: nodePath,
            label: segment,
            depth: index,
            explicit: false,
            children: [],
          };
          nodeMap.set(nodeKey, node);
          if (index === 0) {
            roots.push(node);
          } else {
            const parentPath = segments.slice(0, index).join(' > ');
            const parentNode = nodeMap.get(normalizeSubtopicValue(parentPath));
            if (parentNode && !parentNode.children.some((child) => isSameSubtopicPath(child.path, nodePath))) {
              parentNode.children.push(node);
            }
          }
        }
        const currentNode = nodeMap.get(nodeKey);
        if (currentNode && explicitKeys.has(nodeKey)) {
          currentNode.explicit = true;
        }
      });
    });

  const sortNodes = (nodes: SubtopicHierarchyNode[]) => {
    nodes.sort((left, right) => left.label.localeCompare(right.label));
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);
  return roots;
};

type CategorySelectionInput = {
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  topicId?: string;
  subtopics?: string[];
  questionNumber?: number;
  questionTitle?: string;
};

const getQuestionCategoryNumberPairs = (question: PracticeQuestion): Array<{ categoryKey: string; questionNumber: number }> => {
  const byKey = new Map<string, number>();
  const primaryCategoryKey = getQuestionCategoryKey(
    question.examTypeId,
    question.classId,
    question.subjectId,
    question.topicId,
    question.subtopics
  );
  const primaryNumber = getQuestionNumber(question);
  if (primaryCategoryKey) {
    byKey.set(primaryCategoryKey, Math.max(byKey.get(primaryCategoryKey) || 0, primaryNumber));
  }

  (question.alignments || []).forEach((alignment) => {
    const alignmentCategoryKey = getQuestionCategoryKey(
      alignment.examTypeId,
      alignment.classId,
      alignment.subjectId,
      alignment.topicId,
      alignment.subtopics
    );
    if (!alignmentCategoryKey) return;
    const alignmentNumber = getQuestionNumber({
      questionNumber: alignment.questionNumber,
      questionTitle: alignment.questionTitle,
    });
    const resolvedNumber = alignmentNumber > 0 ? alignmentNumber : primaryNumber;
    byKey.set(alignmentCategoryKey, Math.max(byKey.get(alignmentCategoryKey) || 0, resolvedNumber));
  });

  return Array.from(byKey.entries()).map(([categoryKey, questionNumber]) => ({
    categoryKey,
    questionNumber,
  }));
};

const buildCategoryQuestionNumberCounter = (questions: PracticeQuestion[]): Map<string, number> => {
  const counter = new Map<string, number>();
  questions.forEach((question) => {
    getQuestionCategoryNumberPairs(question).forEach(({ categoryKey, questionNumber }) => {
      if (!categoryKey || questionNumber <= 0) return;
      counter.set(categoryKey, Math.max(counter.get(categoryKey) || 0, questionNumber));
    });
  });
  return counter;
};

const computeQuestionNumberPlan = (
  questions: PracticeQuestion[],
  primarySelection: CategorySelectionInput,
  alignments: CategorySelectionInput[]
): {
  primaryCategoryKey: string;
  primaryQuestionNumber: number;
  alignmentQuestionNumbersByIndex: Record<number, number>;
} => {
  const counter = buildCategoryQuestionNumberCounter(questions);
  const reserveNumber = (categoryKey: string): number => {
    const nextValue = (counter.get(categoryKey) || 0) + 1;
    counter.set(categoryKey, nextValue);
    return nextValue;
  };

  const primaryCategoryKey = getQuestionCategoryKey(
    primarySelection.examTypeId,
    primarySelection.classId,
    primarySelection.subjectId,
    primarySelection.topicId,
    primarySelection.subtopics
  );
  const primaryQuestionNumber = primaryCategoryKey ? reserveNumber(primaryCategoryKey) : 1;
  const alignmentQuestionNumbersByIndex: Record<number, number> = {};

  alignments.forEach((alignment, index) => {
    const alignmentCategoryKey = getQuestionCategoryKey(
      alignment.examTypeId,
      alignment.classId,
      alignment.subjectId,
      alignment.topicId,
      alignment.subtopics
    );
    if (!alignmentCategoryKey) {
      alignmentQuestionNumbersByIndex[index] = 0;
      return;
    }
    alignmentQuestionNumbersByIndex[index] = reserveNumber(alignmentCategoryKey);
  });

  return {
    primaryCategoryKey,
    primaryQuestionNumber,
    alignmentQuestionNumbersByIndex,
  };
};

type QuestionCatalogEntry = {
  entryId: string;
  sourceQuestionId: string;
  sourceQuestion: PracticeQuestion;
  isAlignment: boolean;
  alignmentIndex: number;
  categoryKey: string;
  examTypeId: string;
  classId: string;
  subjectId: string;
  topicId: string;
  subtopics: string[];
  questionType: 'MCQ' | 'Numerical' | 'Text';
  difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  accessLevel: 'free' | 'paid';
  mockTestOnly: boolean;
  isPreviousYear: boolean;
  previousYear: string;
  questionNumber: number;
  questionTitle: string;
};

const buildQuestionCatalogEntries = (question: PracticeQuestion): QuestionCatalogEntry[] => {
  const entries: QuestionCatalogEntry[] = [];
  const usedCategoryKeys = new Set<string>();
  const primaryNumber = getQuestionNumber(question);

  const pushEntry = (params: {
    isAlignment: boolean;
    alignmentIndex: number;
    examTypeId?: string;
    classId?: string;
    subjectId?: string;
    topicId?: string;
    subtopics?: string[];
    questionNumber?: number;
    questionTitle?: string;
    difficultyLevel?: 'Easy' | 'Medium' | 'Hard';
    accessLevel?: 'free' | 'paid';
    mockTestOnly?: boolean;
    isPreviousYear?: boolean;
    previousYear?: string;
  }) => {
    const examTypeId = String(params.examTypeId || '').trim();
    const classId = String(params.classId || '').trim();
    const subjectId = String(params.subjectId || '').trim();
    const topicId = String(params.topicId || '').trim();
    if (!examTypeId || !classId || !subjectId || !topicId) return;

    const normalizedSubtopics = normalizeSubtopics(params.subtopics);
    const categoryKey = getQuestionCategoryKey(examTypeId, classId, subjectId, topicId, normalizedSubtopics);
    if (!categoryKey || usedCategoryKeys.has(categoryKey)) return;
    usedCategoryKeys.add(categoryKey);

    const explicitNumber = getQuestionNumber({
      questionNumber: params.questionNumber,
      questionTitle: params.questionTitle,
    });
    const resolvedQuestionNumber = explicitNumber > 0 ? explicitNumber : primaryNumber;
    const resolvedQuestionTitle = resolvedQuestionNumber > 0
      ? buildQuestionTitle(resolvedQuestionNumber)
      : getDisplayQuestionTitle({ questionTitle: params.questionTitle || question.questionTitle });

    entries.push({
      entryId: `${question.id}:${params.isAlignment ? `alignment-${params.alignmentIndex}` : 'primary'}`,
      sourceQuestionId: question.id,
      sourceQuestion: question,
      isAlignment: params.isAlignment,
      alignmentIndex: params.alignmentIndex,
      categoryKey,
      examTypeId,
      classId,
      subjectId,
      topicId,
      subtopics: normalizedSubtopics,
      questionType: question.questionType,
      difficultyLevel: 'Easy' as const,
      accessLevel: (params.accessLevel || question.accessLevel || 'free') === 'paid' ? 'paid' : 'free',
      mockTestOnly: !!(params.mockTestOnly ?? question.mockTestOnly),
      isPreviousYear: !!(params.isPreviousYear ?? question.isPreviousYear),
      previousYear: String(params.previousYear ?? question.previousYear ?? '').trim(),
      questionNumber: resolvedQuestionNumber,
      questionTitle: resolvedQuestionTitle,
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
    questionNumber: question.questionNumber,
    questionTitle: question.questionTitle,
    difficultyLevel: 'Easy' as const,
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
      questionNumber: alignment.questionNumber,
      questionTitle: alignment.questionTitle,
      difficultyLevel: 'Easy' as const,
      accessLevel: alignment.accessLevel,
      mockTestOnly: alignment.mockTestOnly,
      isPreviousYear: alignment.isPreviousYear,
      previousYear: alignment.previousYear,
    });
  });

  return entries;
};

const assignDynamicQuestionNumbers = (entries: QuestionCatalogEntry[]): QuestionCatalogEntry[] => {
  const categoryBuckets = new Map<string, QuestionCatalogEntry[]>();
  entries.forEach((entry) => {
    if (!categoryBuckets.has(entry.categoryKey)) {
      categoryBuckets.set(entry.categoryKey, []);
    }
    categoryBuckets.get(entry.categoryKey)!.push(entry);
  });

  const resolvedNumberByEntryId = new Map<string, number>();
  categoryBuckets.forEach((bucketEntries) => {
    const sorted = [...bucketEntries].sort((left, right) => {
      const leftNumber = left.questionNumber > 0 ? left.questionNumber : Number.MAX_SAFE_INTEGER;
      const rightNumber = right.questionNumber > 0 ? right.questionNumber : Number.MAX_SAFE_INTEGER;
      if (leftNumber !== rightNumber) return leftNumber - rightNumber;
      const bySource = left.sourceQuestionId.localeCompare(right.sourceQuestionId);
      if (bySource !== 0) return bySource;
      return left.entryId.localeCompare(right.entryId);
    });
    sorted.forEach((entry, index) => {
      resolvedNumberByEntryId.set(entry.entryId, index + 1);
    });
  });

  return entries.map((entry) => {
    const resolvedNumber = resolvedNumberByEntryId.get(entry.entryId) || (entry.questionNumber > 0 ? entry.questionNumber : 1);
    return {
      ...entry,
      questionNumber: resolvedNumber,
      questionTitle: buildQuestionTitle(resolvedNumber),
    };
  });
};

const MATH_TOOLBAR_TOKENS: Array<{ label: string; token: string }> = [
  { label: 'Divide', token: '\\div' },
  { label: 'Fraction', token: '\\frac{a}{b}' },
  { label: 'Root', token: '\\sqrt{}' },
  { label: 'Power', token: '^{}' },
  { label: 'Subscript', token: '_{}' },
  { label: 'Pi', token: '\\pi' },
  { label: 'Theta', token: '\\theta' },
  { label: 'Alpha', token: '\\alpha' },
  { label: 'Beta', token: '\\beta' },
  { label: 'Gamma', token: '\\gamma' },
  { label: 'Delta', token: '\\Delta' },
  { label: 'Infinity', token: '\\infty' },
  { label: 'Not Equal', token: '\\neq' },
  { label: 'Approx', token: '\\approx' },
  { label: 'Less/Equal', token: '\\le' },
  { label: 'Greater/Equal', token: '\\ge' },
  { label: 'Multiply', token: '\\times' },
  { label: 'Plus/Minus', token: '\\pm' },
  { label: 'Angle', token: '\\angle' },
  { label: 'Degree', token: '^{\\circ}' },
  { label: 'Integral', token: '\\int' },
  { label: 'Summation', token: '\\sum' },
  { label: 'Product', token: '\\prod' },
  { label: 'Belongs To', token: '\\in' },
  { label: 'Union', token: '\\cup' },
  { label: 'Intersection', token: '\\cap' },
  { label: 'Perpendicular', token: '\\perp' },
  { label: 'Parallel', token: '\\parallel' },
  { label: 'Arrow', token: '\\to' },
  { label: 'Therefore', token: '\\therefore' },
];

const getMathTokenCursorOffset = (token: string): number => {
  const emptyBraceIndex = token.indexOf('{}');
  if (emptyBraceIndex !== -1) return emptyBraceIndex + 1;
  const firstBraceIndex = token.indexOf('{');
  if (firstBraceIndex !== -1) return firstBraceIndex + 1;
  return token.length;
};

const insertTokenAtCursor = (
  currentValue: string,
  token: string,
  control: HTMLInputElement | HTMLTextAreaElement | null,
  applyNext: (nextValue: string) => void
) => {
  if (!control) {
    applyNext(`${currentValue}${token}`);
    return;
  }

  const start = control.selectionStart ?? currentValue.length;
  const end = control.selectionEnd ?? start;
  const nextValue = `${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`;
  applyNext(nextValue);

  requestAnimationFrame(() => {
    control.focus();
    const cursor = start + getMathTokenCursorOffset(token);
    control.setSelectionRange(cursor, cursor);
  });
};

function MathToolbar({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-xs font-medium text-foreground">Math Tool (insert at cursor)</p>
      <p className="text-xs text-muted-foreground">Wrap equation in <code>$...$</code>. Example: <code>{'$\\sqrt{\\frac{g}{x^2}}$'}</code></p>
      <div className="flex flex-wrap gap-2">
        {MATH_TOOLBAR_TOKENS.map((item) => (
          <Button key={item.label} type="button" size="sm" variant="outline" onClick={() => onInsert(item.token)}>
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function TeacherQuestionBankPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const router = useRouter();
  const { isTeacher, isQuestionUploader, isLoading: isTeacherLoading } = useIsTeacher();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { toast } = useToast();
  const canAccessQuestionUpload = isTeacher || isQuestionUploader;
  const canManageTeacherAuthoring = isAdmin || isQuestionUploader || isAllowedTeacherAuthorEmail(user?.email);
  const isTeacherAuthoringRestricted = isTeacher && !canManageTeacherAuthoring;
  const shouldUseTeachingProfileScope = isTeacher && !canManageTeacherAuthoring;
  const questionBankOwnerId = useMemo(
    () => resolveDcamQuestionBankOwnerId({
      userId: user?.uid,
      email: user?.email,
      isQuestionUploader,
    }),
    [isQuestionUploader, user?.email, user?.uid]
  );
  const isSharedDcamQuestionBank = isQuestionUploader || isAllowedTeacherAuthorEmail(user?.email);
  const questionSummaryRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'platform_settings', DCAM_PRACTICE_SUMMARY_DOC_ID) : null),
    [firestore]
  );
  const { data: questionSummary } = useDoc<PracticeSummaryDoc>(questionSummaryRef);
  const showTeacherAuthoringRestrictedToast = () => {
    toast({
      variant: 'destructive',
      title: 'Question editing disabled',
      description: getTeacherAuthoringRestrictionCopy(),
    });
  };

  const [selectedExamTypeId, setSelectedExamTypeId] = useState('all');
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [selectedTopicId, setSelectedTopicId] = useState('all');
  const [selectedSubtopic, setSelectedSubtopic] = useState('all');
  const [selectedQuestionType, setSelectedQuestionType] = useState<'all' | 'MCQ' | 'Numerical' | 'Text'>('all');
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<'all' | 'free' | 'paid'>('all');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<PracticeQuestion | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isBulkEditDialogOpen, setIsBulkEditDialogOpen] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkEditState, setBulkEditState] = useState<BulkEditState>(() => createDefaultBulkEditState());
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [shouldLoadInventory, setShouldLoadInventory] = useState(false);
  const [expandedExplanationQuestionIds, setExpandedExplanationQuestionIds] = useState<Set<string>>(new Set());
  const [expandedQuestionImageQuestionIds, setExpandedQuestionImageQuestionIds] = useState<Set<string>>(new Set());
  const editQuestionTextRef = useRef<HTMLTextAreaElement | null>(null);
  const [showEditQuestionMathTool, setShowEditQuestionMathTool] = useState(false);
  const [editQuestionImageFile, setEditQuestionImageFile] = useState<File | null>(null);
  const [editQuestionImagePage, setEditQuestionImagePage] = useState(1);
  const [editSubtopicInput, setEditSubtopicInput] = useState('');
  const [selectedEditSubtopicParent, setSelectedEditSubtopicParent] = useState('');
  const [editAlignmentSubtopicInputByIndex, setEditAlignmentSubtopicInputByIndex] = useState<Record<number, string>>({});
  const [editAlignmentSubtopicParentByIndex, setEditAlignmentSubtopicParentByIndex] = useState<Record<number, string>>({});

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);
  const teachingAssignments = useMemo(
    () => normalizeTeachingAssignments(userProfile?.teachingAssignments),
    [userProfile?.teachingAssignments]
  );
  const legacyTeachingClassIds = useMemo(
    () => toUniqueStringArray(userProfile?.teachesClassIds),
    [userProfile?.teachesClassIds]
  );
  const legacyTeachingSubjectIds = useMemo(
    () => toUniqueStringArray(userProfile?.teachesSubjectIds),
    [userProfile?.teachesSubjectIds]
  );
  const allowedClassIds = useMemo(
    () => shouldUseTeachingProfileScope ? Array.from(new Set([
      ...legacyTeachingClassIds,
      ...teachingAssignments.map((assignment) => assignment.classId).filter(Boolean),
    ])) : [],
    [shouldUseTeachingProfileScope, legacyTeachingClassIds, teachingAssignments]
  );
  const allowedSubjectIds = useMemo(
    () => shouldUseTeachingProfileScope ? Array.from(new Set([
      ...legacyTeachingSubjectIds,
      ...teachingAssignments.flatMap((assignment) => assignment.subjectIds || []).filter(Boolean),
    ])) : [],
    [shouldUseTeachingProfileScope, legacyTeachingSubjectIds, teachingAssignments]
  );
  const shouldUseScopedClassQuery = allowedClassIds.length > 0 && allowedClassIds.length <= 30;
  const shouldUseDirectSubjectQuery = allowedSubjectIds.length > 0 && allowedSubjectIds.length <= 30;
  const shouldUseClassScopedSubjectQuery = !shouldUseDirectSubjectQuery && allowedClassIds.length > 0 && allowedClassIds.length <= 30;

  const questionsQuery = useMemoFirebase(() => {
    if (!firestore || !questionBankOwnerId || !shouldLoadInventory) return null;
    return query(collection(firestore, 'practice_questions'), where('teacherId', '==', questionBankOwnerId));
  }, [firestore, questionBankOwnerId, shouldLoadInventory]);
  const classesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (shouldUseScopedClassQuery) {
      return query(collection(firestore, 'classes'), where(documentId(), 'in', allowedClassIds));
    }
    return query(collection(firestore, 'classes'), orderBy('name'));
  }, [firestore, shouldUseScopedClassQuery, allowedClassIds]);
  const subjectsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (shouldUseDirectSubjectQuery) {
      return query(collection(firestore, 'subjects'), where(documentId(), 'in', allowedSubjectIds));
    }
    if (shouldUseClassScopedSubjectQuery) {
      return query(collection(firestore, 'subjects'), where('classId', 'in', allowedClassIds));
    }
    return query(collection(firestore, 'subjects'), orderBy('name'));
  }, [firestore, shouldUseDirectSubjectQuery, allowedSubjectIds, shouldUseClassScopedSubjectQuery, allowedClassIds]);
  const examTypesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null, [firestore]);

  const { data: scopedQuestions, isLoading: areScopedQuestionsLoading, error: scopedQuestionsError } = useCollection<PracticeQuestion>(questionsQuery);
  const { data: classes, isLoading: areClassesLoading } = useCollection<Class>(classesQuery);
  const { data: subjects, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: examTypes, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const scopedTopicSubjectIds = useMemo(() => {
    if (allowedSubjectIds.length > 0) return allowedSubjectIds;
    if (!subjects?.length || allowedClassIds.length === 0) return [];
    return Array.from(new Set(
      subjects
        .filter((subject) => allowedClassIds.includes(subject.classId))
        .map((subject) => subject.id)
        .filter(Boolean)
    ));
  }, [allowedSubjectIds, subjects, allowedClassIds]);
  const shouldUseScopedTopicQuery = scopedTopicSubjectIds.length > 0 && scopedTopicSubjectIds.length <= 30;
  const shouldSuppressGlobalTopicQuery = allowedClassIds.length > 0 || allowedSubjectIds.length > 0;
  const topicsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (shouldUseScopedTopicQuery) {
      return query(collection(firestore, 'topics'), where('subjectId', 'in', scopedTopicSubjectIds));
    }
    if (shouldSuppressGlobalTopicQuery) return null;
    return query(collection(firestore, 'topics'), orderBy('name'));
  }, [firestore, shouldUseScopedTopicQuery, scopedTopicSubjectIds, shouldSuppressGlobalTopicQuery]);
  const { data: topics, isLoading: areTopicsLoading } = useCollection<Topic>(topicsQuery);

  const isAwaitingScopedTopics = shouldSuppressGlobalTopicQuery && !shouldUseScopedTopicQuery && areSubjectsLoading;
  const areFilterOptionsLoading = areClassesLoading || areSubjectsLoading || isAwaitingScopedTopics || areTopicsLoading || areExamTypesLoading;
  const isQuestionUploadAccessLoading = isTeacherLoading || isAdminLoading;
  const isInventoryLoading = isTeacherLoading || isAdminLoading || !shouldLoadInventory || areScopedQuestionsLoading;

  useEffect(() => {
    if (!questionBankOwnerId || !canAccessQuestionUpload || isTeacherLoading) {
      setShouldLoadInventory(false);
      return;
    }
    if (areFilterOptionsLoading) {
      setShouldLoadInventory(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShouldLoadInventory(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [questionBankOwnerId, canAccessQuestionUpload, isTeacherLoading, areFilterOptionsLoading]);

  const scopedClasses = useMemo(() => {
    const source = classes || [];
    return allowedClassIds.length > 0 ? source.filter((item) => allowedClassIds.includes(item.id)) : source;
  }, [classes, allowedClassIds]);

  const filteredClasses = useMemo(() => {
    if (selectedExamTypeId === 'all') return [];
    return scopedClasses.filter((item) => item.examTypeId === selectedExamTypeId);
  }, [scopedClasses, selectedExamTypeId]);

  const teacherScopedExamTypes = useMemo(() => {
    if (!classes || !examTypes) return examTypes || [];
    const examTypeIds = new Set(scopedClasses.map((item) => item.examTypeId));
    return examTypes.filter((item) => examTypeIds.has(item.id));
  }, [classes, examTypes, scopedClasses]);

  const filteredSubjects = useMemo(() => {
    const source = subjects || [];
    if (selectedClassId === 'all') return [];
    const classScoped = source.filter((item) => item.classId === selectedClassId);
    if (allowedSubjectIds.length === 0) return classScoped;
    return classScoped.filter((item) => allowedSubjectIds.includes(item.id));
  }, [subjects, selectedClassId, allowedSubjectIds]);

  const filteredTopics = useMemo(() => {
    const source = topics || [];
    if (selectedSubjectId === 'all') return [];
    return source.filter((item) => item.subjectId === selectedSubjectId);
  }, [topics, selectedSubjectId]);

  const examTypeMap = useMemo(() => Object.fromEntries((examTypes || []).map((item) => [item.id, item.name])), [examTypes]);
  const classMap = useMemo(() => Object.fromEntries((classes || []).map((item) => [item.id, item.name])), [classes]);
  const subjectMap = useMemo(() => Object.fromEntries((subjects || []).map((item) => [item.id, item.name])), [subjects]);
  const topicMap = useMemo(() => Object.fromEntries((topics || []).map((item) => [item.id, item.name])), [topics]);
  const classRecordById = useMemo(() => new Map((classes || []).map((item) => [item.id, item])), [classes]);
  const subjectRecordById = useMemo(() => new Map((subjects || []).map((item) => [item.id, item])), [subjects]);
  const topicRecordById = useMemo(() => new Map((topics || []).map((item) => [item.id, item])), [topics]);

  const teacherQuestions = useMemo(() => {
    const source = scopedQuestions || [];
    const sanitizedQuestions: PracticeQuestion[] = [];

    source.forEach((item) => {
      try {
        const sanitized = sanitizePracticeQuestion(item);
        if (sanitized.teacherId === questionBankOwnerId) {
          sanitizedQuestions.push(sanitized);
        }
      } catch (error) {
        console.error('Question bank: skipping malformed question document.', {
          questionId: item?.id,
          error,
        });
      }
    });

    return sanitizedQuestions;
  }, [scopedQuestions, questionBankOwnerId]);
  const selectedQuestionIdSet = useMemo(() => new Set(selectedQuestionIds), [selectedQuestionIds]);
  const selectedQuestions = useMemo(() => (
    teacherQuestions.filter((item) => selectedQuestionIdSet.has(item.id))
  ), [teacherQuestions, selectedQuestionIdSet]);

  const teacherQuestionEntries = useMemo(() => {
    const allEntries = teacherQuestions.flatMap((question) => {
      try {
        return buildQuestionCatalogEntries(question);
      } catch (error) {
        console.error('Question bank: skipping malformed question catalog entry.', {
          questionId: question.id,
          error,
        });
        return [] as QuestionCatalogEntry[];
      }
    });

    try {
      return assignDynamicQuestionNumbers(allEntries);
    } catch (error) {
      console.error('Question bank: failed to assign dynamic question numbers.', error);
      return [] as QuestionCatalogEntry[];
    }
  }, [teacherQuestions]);

  useEffect(() => {
    const availableQuestionIds = new Set(teacherQuestions.map((item) => item.id));
    setSelectedQuestionIds((previous) => previous.filter((id) => availableQuestionIds.has(id)));
  }, [teacherQuestions]);

  useEffect(() => {
    if (!isTeacherAuthoringRestricted) return;
    setSelectedQuestionIds([]);
    if (isBulkEditDialogOpen) setIsBulkEditDialogOpen(false);
    if (editingQuestion) setEditingQuestion(null);
  }, [editingQuestion, isBulkEditDialogOpen, isTeacherAuthoringRestricted]);

  useEffect(() => {
    if (!isTeacherAuthoringRestricted) return;
    router.replace('/dashboard');
  }, [isTeacherAuthoringRestricted, router]);

  const toggleExplanation = (questionId: string) => {
    setExpandedExplanationQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const toggleQuestionImages = (questionId: string) => {
    setExpandedQuestionImageQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const questionsAfterPrimaryFilters = useMemo(() => {
    return teacherQuestionEntries.filter((item) => {
      if (selectedExamTypeId !== 'all' && item.examTypeId !== selectedExamTypeId) return false;
      if (selectedClassId !== 'all' && item.classId !== selectedClassId) return false;
      if (selectedSubjectId !== 'all' && item.subjectId !== selectedSubjectId) return false;
      if (selectedTopicId !== 'all' && item.topicId !== selectedTopicId) return false;
      if (selectedQuestionType !== 'all' && item.questionType !== selectedQuestionType) return false;
      if (selectedAccessLevel !== 'all' && item.accessLevel !== selectedAccessLevel) return false;
      return true;
    });
  }, [teacherQuestionEntries, selectedExamTypeId, selectedClassId, selectedSubjectId, selectedTopicId, selectedQuestionType, selectedAccessLevel]);

  const availableSubtopics = useMemo(() => {
    if (selectedTopicId === 'all') return [];
    const map = new Map<string, string>();
    questionsAfterPrimaryFilters.forEach((item) => {
      normalizeSubtopics(item.subtopics).forEach((subtopicPath) => {
        const key = normalizeSubtopicValue(subtopicPath);
        if (!map.has(key)) {
          map.set(key, subtopicPath);
        }
      });
    });
    return Array.from(map.values()).sort((left, right) => {
      const depthDiff = splitSubtopicPath(left).length - splitSubtopicPath(right).length;
      if (depthDiff !== 0) return depthDiff;
      return left.localeCompare(right);
    });
  }, [questionsAfterPrimaryFilters, selectedTopicId]);

  useEffect(() => {
    if (selectedSubtopic === 'all') return;
    const exists = availableSubtopics.some((item) => normalizeSubtopicValue(item) === normalizeSubtopicValue(selectedSubtopic));
    if (!exists) {
      setSelectedSubtopic('all');
    }
  }, [availableSubtopics, selectedSubtopic]);

  const visibleQuestionEntries = useMemo(() => {
    if (selectedSubtopic === 'all') return questionsAfterPrimaryFilters;
    return questionsAfterPrimaryFilters.filter((item) =>
      normalizeSubtopics(item.subtopics).some((subtopicPath) =>
        isSubtopicPathWithinBranch(subtopicPath, selectedSubtopic)
      )
    );
  }, [questionsAfterPrimaryFilters, selectedSubtopic]);

  const sortedVisibleQuestions = useMemo(() => {
    return [...visibleQuestionEntries].sort((a, b) => {
      const byExam = (examTypeMap[a.examTypeId] || '').localeCompare(examTypeMap[b.examTypeId] || '');
      if (byExam !== 0) return byExam;
      const byClass = (classMap[a.classId] || '').localeCompare(classMap[b.classId] || '');
      if (byClass !== 0) return byClass;
      const bySubject = (subjectMap[a.subjectId] || '').localeCompare(subjectMap[b.subjectId] || '');
      if (bySubject !== 0) return bySubject;
      const byTopic = (topicMap[a.topicId] || '').localeCompare(topicMap[b.topicId] || '');
      if (byTopic !== 0) return byTopic;
      const byPrimarySubtopic = getPrimarySubtopicForCategory(a.subtopics).localeCompare(getPrimarySubtopicForCategory(b.subtopics));
      if (byPrimarySubtopic !== 0) return byPrimarySubtopic;
      const aNumber = a.questionNumber || Number.MAX_SAFE_INTEGER;
      const bNumber = b.questionNumber || Number.MAX_SAFE_INTEGER;
      const byQuestionNumber = aNumber - bNumber;
      if (byQuestionNumber !== 0) return byQuestionNumber;
      return a.entryId.localeCompare(b.entryId);
    });
  }, [visibleQuestionEntries, examTypeMap, classMap, subjectMap, topicMap]);
  const visibleQuestionIds = useMemo(() => (
    Array.from(new Set(sortedVisibleQuestions.map((entry) => entry.sourceQuestionId)))
  ), [sortedVisibleQuestions]);
  const visibleQuestionIdSet = useMemo(() => new Set(visibleQuestionIds), [visibleQuestionIds]);
  const summaryQuestionCount = useMemo(() => {
    const fallbackTotal = DCAM_PRACTICE_QUESTION_COUNTS.free + DCAM_PRACTICE_QUESTION_COUNTS.paid;
    const summaryTotal = Number(questionSummary?.totalQuestionCount);
    if (Number.isFinite(summaryTotal) && summaryTotal >= 0) return summaryTotal;

    const free = Number(questionSummary?.freeQuestionCount);
    const paid = Number(questionSummary?.paidQuestionCount);
    if (Number.isFinite(free) && Number.isFinite(paid) && free + paid >= 0) {
      return free + paid;
    }

    return fallbackTotal;
  }, [questionSummary?.freeQuestionCount, questionSummary?.paidQuestionCount, questionSummary?.totalQuestionCount]);
  const totalBankQuestionCount = isSharedDcamQuestionBank ? summaryQuestionCount : teacherQuestions.length;
  const areAllVisibleSelected = visibleQuestionIds.length > 0
    && visibleQuestionIds.every((id) => selectedQuestionIdSet.has(id));
  const selectedVisibleQuestionCount = visibleQuestionIds.filter((id) => selectedQuestionIdSet.has(id)).length;
  const selectedQuestionOrderById = useMemo(() => {
    const orderedIds = Array.from(new Set([
      ...sortedVisibleQuestions.map((entry) => entry.sourceQuestionId),
      ...teacherQuestions.map((question) => question.id),
    ]));
    return new Map(orderedIds.map((id, index) => [id, index]));
  }, [sortedVisibleQuestions, teacherQuestions]);
  const selectedQuestionsForProcessing = useMemo(() => (
    [...selectedQuestions].sort((left, right) => {
      const leftIndex = selectedQuestionOrderById.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = selectedQuestionOrderById.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      return left.id.localeCompare(right.id);
    })
  ), [selectedQuestions, selectedQuestionOrderById]);
  const toSortedSubtopicPaths = (values: string[]): string[] => (
    normalizeSubtopics(values).sort((left, right) => {
      const depthDiff = splitSubtopicPath(left).length - splitSubtopicPath(right).length;
      if (depthDiff !== 0) return depthDiff;
      return left.localeCompare(right);
    })
  );
  const getTopicSubtopicCatalog = (topicId?: string) => {
    if (!topicId) return [] as string[];
    const collected: string[] = [];
    teacherQuestions.forEach((question) => {
      if (question.topicId === topicId) {
        collected.push(...normalizeSubtopics(question.subtopics));
      }
      (question.alignments || []).forEach((alignment) => {
        if ((alignment.topicId || '') !== topicId) return;
        collected.push(...normalizeSubtopics(alignment.subtopics));
      });
    });
    return toSortedSubtopicPaths(collected);
  };

  const categorizedQuestions = useMemo(() => {
    const buckets = new Map<string, {
      key: string;
      examTypeId: string;
      classId: string;
      subjectId: string;
      topicId: string;
      subtopicPath: string;
      questions: QuestionCatalogEntry[];
    }>();

    sortedVisibleQuestions.forEach((question) => {
      const subtopicPath = getPrimarySubtopicForCategory(question.subtopics);
      const bucketKey = [
        question.examTypeId || '',
        question.classId || '',
        question.subjectId || '',
        question.topicId || '',
        subtopicPath || '__no_subtopic__',
      ].join('::');
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, {
          key: bucketKey,
          examTypeId: question.examTypeId,
          classId: question.classId,
          subjectId: question.subjectId,
          topicId: question.topicId,
          subtopicPath,
          questions: [],
        });
      }
      buckets.get(bucketKey)!.questions.push(question);
    });

    return Array.from(buckets.values()).sort((left, right) => {
      const byExam = (examTypeMap[left.examTypeId] || '').localeCompare(examTypeMap[right.examTypeId] || '');
      if (byExam !== 0) return byExam;
      const byClass = (classMap[left.classId] || '').localeCompare(classMap[right.classId] || '');
      if (byClass !== 0) return byClass;
      const bySubject = (subjectMap[left.subjectId] || '').localeCompare(subjectMap[right.subjectId] || '');
      if (bySubject !== 0) return bySubject;
      const byTopic = (topicMap[left.topicId] || '').localeCompare(topicMap[right.topicId] || '');
      if (byTopic !== 0) return byTopic;
      return left.subtopicPath.localeCompare(right.subtopicPath);
    });
  }, [sortedVisibleQuestions, examTypeMap, classMap, subjectMap, topicMap]);

  const activeFilterCount = useMemo(() => {
    return [
      selectedClassId !== 'all',
      selectedExamTypeId !== 'all',
      selectedSubjectId !== 'all',
      selectedTopicId !== 'all',
      selectedSubtopic !== 'all',
      selectedQuestionType !== 'all',
      selectedAccessLevel !== 'all',
    ].filter(Boolean).length;
  }, [
    selectedClassId,
    selectedExamTypeId,
    selectedSubjectId,
    selectedTopicId,
    selectedSubtopic,
    selectedQuestionType,
    selectedAccessLevel,
  ]);

  const resetFilters = () => {
    setSelectedClassId('all');
    setSelectedExamTypeId('all');
    setSelectedSubjectId('all');
    setSelectedTopicId('all');
    setSelectedSubtopic('all');
    setSelectedQuestionType('all');
    setSelectedAccessLevel('all');
  };

  const selectTriggerClassName = 'h-12 rounded-xl border-slate-400/30 bg-white/[0.04]';
  const bulkEditFilteredClasses = useMemo(() => {
    const source = classes || [];
    const teacherScoped = allowedClassIds.length > 0 ? source.filter((item) => allowedClassIds.includes(item.id)) : source;
    if (!bulkEditState.updateExamType || !bulkEditState.examTypeId) return teacherScoped;
    return teacherScoped.filter((item) => item.examTypeId === bulkEditState.examTypeId);
  }, [classes, allowedClassIds, bulkEditState.updateExamType, bulkEditState.examTypeId]);
  const bulkEditFilteredSubjects = useMemo(() => {
    const source = subjects || [];
    const teacherScoped = allowedSubjectIds.length > 0 ? source.filter((item) => allowedSubjectIds.includes(item.id)) : source;
    if (!bulkEditState.updateClass || !bulkEditState.classId) return teacherScoped;
    return teacherScoped.filter((item) => item.classId === bulkEditState.classId);
  }, [subjects, allowedSubjectIds, bulkEditState.updateClass, bulkEditState.classId]);
  const bulkEditFilteredTopics = useMemo(() => {
    const source = topics || [];
    if (!bulkEditState.updateSubject || !bulkEditState.subjectId) return source;
    return source.filter((item) => item.subjectId === bulkEditState.subjectId);
  }, [topics, bulkEditState.updateSubject, bulkEditState.subjectId]);
  const bulkResolvedTopicIdsForSubtopics = useMemo(() => {
    if (bulkEditState.updateTopic && bulkEditState.topicId) return [bulkEditState.topicId];
    return Array.from(new Set(selectedQuestionsForProcessing.map((question) => question.topicId).filter(Boolean)));
  }, [bulkEditState.updateTopic, bulkEditState.topicId, selectedQuestionsForProcessing]);
  const bulkSubtopicSuggestions = useMemo(() => (
    toSortedSubtopicPaths(
      bulkResolvedTopicIdsForSubtopics.flatMap((topicId) => getTopicSubtopicCatalog(topicId))
    )
  ), [bulkResolvedTopicIdsForSubtopics, teacherQuestions]);

  const isEditingImageOnlyQuestion = !!editingQuestion
    && normalizeQuestionTextValue(editingQuestion.questionText) === normalizeQuestionTextValue('Question attached as image');
  const editingQuestionImages = editingQuestion
    ? (editingQuestion.imageUrls && editingQuestion.imageUrls.length > 0
      ? editingQuestion.imageUrls
      : (editingQuestion.imageUrl ? [editingQuestion.imageUrl] : []))
    : [];

  const resetEditDialogTransientState = () => {
    setShowEditQuestionMathTool(false);
    setEditQuestionImageFile(null);
    setEditQuestionImagePage(1);
    setEditSubtopicInput('');
    setSelectedEditSubtopicParent('');
    setEditAlignmentSubtopicInputByIndex({});
    setEditAlignmentSubtopicParentByIndex({});
  };

  const closeEditDialog = () => {
    setEditingQuestion(null);
    resetEditDialogTransientState();
  };

  const createDefaultAlignment = (source?: PracticeQuestion): QuestionAlignment => ({
    examTypeId: '',
    classId: '',
    subjectId: '',
    topicId: '',
    subtopics: [],
    accessLevel: source?.accessLevel === 'paid' ? 'paid' : 'free',
    mockTestOnly: !!source?.mockTestOnly,
    difficultyLevel: 'Easy' as const,
    isPreviousYear: false,
    previousYear: '',
  });

  const editAllowedExamTypeIds = useMemo(() => {
    if (allowedClassIds.length === 0) return null;
    const ids = new Set(
      (classes || [])
        .filter((item) => allowedClassIds.includes(item.id))
        .map((item) => item.examTypeId)
    );
    return Array.from(ids);
  }, [classes, allowedClassIds]);

  const editScopedExamTypes = useMemo(() => {
    if (!editAllowedExamTypeIds) return examTypes || [];
    return (examTypes || []).filter((item) => editAllowedExamTypeIds.includes(item.id));
  }, [examTypes, editAllowedExamTypeIds]);

  const editFilteredClasses = useMemo(() => {
    if (!editingQuestion?.examTypeId) return [];
    const examScoped = (classes || []).filter((item) => item.examTypeId === editingQuestion.examTypeId);
    if (allowedClassIds.length === 0) return examScoped;
    return examScoped.filter((item) => allowedClassIds.includes(item.id));
  }, [classes, editingQuestion?.examTypeId, allowedClassIds]);

  const editFilteredSubjects = useMemo(() => {
    if (!editingQuestion?.classId) return [];
    const classScoped = (subjects || []).filter((item) => item.classId === editingQuestion.classId);
    if (allowedSubjectIds.length === 0) return classScoped;
    return classScoped.filter((item) => allowedSubjectIds.includes(item.id));
  }, [subjects, editingQuestion?.classId, allowedSubjectIds]);

  const editFilteredTopics = useMemo(() => {
    if (!editingQuestion?.subjectId) return [];
    return (topics || []).filter((item) => item.subjectId === editingQuestion.subjectId);
  }, [topics, editingQuestion?.subjectId]);

  const editTopicSubtopicCatalog = useMemo(() => (
    getTopicSubtopicCatalog(editingQuestion?.topicId || '')
  ), [teacherQuestions, editingQuestion?.topicId]);

  const editAvailableParentSubtopics = useMemo(() => (
    toSortedSubtopicPaths([
      ...normalizeSubtopics(editingQuestion?.subtopics),
      ...editTopicSubtopicCatalog,
    ])
  ), [editingQuestion?.subtopics, editTopicSubtopicCatalog]);

  const editSubtopicHierarchy = useMemo(() => (
    buildSubtopicHierarchy(editAvailableParentSubtopics)
  ), [editAvailableParentSubtopics]);

  const editSubtopicHierarchyPaths = useMemo(() => {
    const values: string[] = [];
    const walk = (nodes: SubtopicHierarchyNode[]) => {
      nodes.forEach((node) => {
        values.push(node.path);
        if (node.children.length > 0) walk(node.children);
      });
    };
    walk(editSubtopicHierarchy);
    return normalizeSubtopics(values);
  }, [editSubtopicHierarchy]);

  const editQuestionNumberPlan = useMemo(() => {
    if (!editingQuestion) return null;
    const existingWithoutCurrent = teacherQuestions.filter((item) => item.id !== editingQuestion.id);
    return computeQuestionNumberPlan(
      existingWithoutCurrent,
      {
        examTypeId: editingQuestion.examTypeId,
        classId: editingQuestion.classId,
        subjectId: editingQuestion.subjectId,
        topicId: editingQuestion.topicId,
        subtopics: normalizeSubtopics(editingQuestion.subtopics),
      },
      (editingQuestion.alignments || []).map((alignment) => ({
        examTypeId: alignment.examTypeId,
        classId: alignment.classId,
        subjectId: alignment.subjectId,
        topicId: alignment.topicId,
        subtopics: normalizeSubtopics(alignment.subtopics),
      }))
    );
  }, [editingQuestion, teacherQuestions]);

  const editPrimaryQuestionTitle = useMemo(() => {
    if (!editingQuestion) return '';
    const categoryKey = getQuestionCategoryKey(
      editingQuestion.examTypeId,
      editingQuestion.classId,
      editingQuestion.subjectId,
      editingQuestion.topicId,
      editingQuestion.subtopics
    );
    if (!categoryKey || !editQuestionNumberPlan) {
      return getDisplayQuestionTitle(editingQuestion);
    }
    return buildQuestionTitle(editQuestionNumberPlan.primaryQuestionNumber);
  }, [editingQuestion, editQuestionNumberPlan]);

  useEffect(() => {
    if (!selectedEditSubtopicParent) return;
    const parentStillExists = editSubtopicHierarchyPaths.some((item) => isSameSubtopicPath(item, selectedEditSubtopicParent));
    if (!parentStillExists) {
      setSelectedEditSubtopicParent('');
    }
  }, [selectedEditSubtopicParent, editSubtopicHierarchyPaths]);

  useEffect(() => {
    const alignments = editingQuestion?.alignments || [];
    setEditAlignmentSubtopicInputByIndex((prev) => {
      const next: Record<number, string> = {};
      alignments.forEach((_, index) => {
        if (prev[index]) next[index] = prev[index];
      });
      return next;
    });
    setEditAlignmentSubtopicParentByIndex((prev) => {
      const next: Record<number, string> = {};
      alignments.forEach((_, index) => {
        if (prev[index]) next[index] = prev[index];
      });
      return next;
    });
  }, [editingQuestion?.alignments]);

  const resetAlignmentSubtopicBuilder = (index: number) => {
    setEditAlignmentSubtopicInputByIndex((prev) => ({ ...prev, [index]: '' }));
    setEditAlignmentSubtopicParentByIndex((prev) => ({ ...prev, [index]: '' }));
  };

  const updateEditingQuestion = (updater: (previous: PracticeQuestion) => PracticeQuestion) => {
    setEditingQuestion((previous) => (previous ? updater(previous) : previous));
  };

  const updateEditAlignment = (index: number, updater: (current: QuestionAlignment) => QuestionAlignment) => {
    updateEditingQuestion((previous) => {
      const alignments = [...(previous.alignments || [])];
      const existing = alignments[index] || createDefaultAlignment(previous);
      alignments[index] = updater(existing);
      return { ...previous, alignments };
    });
  };

  const addEditSubtopic = () => {
    if (!editingQuestion || !editingQuestion.topicId) return;
    const childLabel = editSubtopicInput.trim();
    if (!childLabel) return;
    const next = normalizeSubtopicPath(
      selectedEditSubtopicParent
        ? joinSubtopicPath(selectedEditSubtopicParent, childLabel)
        : childLabel
    );
    if (!next) return;
    const current = normalizeSubtopics(editingQuestion.subtopics);
    if (current.some((item) => isSameSubtopicPath(item, next))) {
      setEditSubtopicInput('');
      return;
    }
    updateEditingQuestion((previous) => ({
      ...previous,
      subtopics: normalizeSubtopics([...(previous.subtopics || []), next]),
    }));
    setEditSubtopicInput('');
  };

  const removeEditSubtopic = (target: string) => {
    updateEditingQuestion((previous) => ({
      ...previous,
      subtopics: stripSubtopicBranch(previous.subtopics, target),
    }));
    setSelectedEditSubtopicParent((previous) => (
      previous && isSubtopicPathWithinBranch(previous, target) ? '' : previous
    ));
  };

  const renderEditSubtopicHierarchyNode = (node: SubtopicHierarchyNode) => {
    const selectedSubtopics = normalizeSubtopics(editingQuestion?.subtopics);
    const isCurrentParent = isSameSubtopicPath(selectedEditSubtopicParent, node.path);
    const isAddedForQuestion = selectedSubtopics.some((item) => isSameSubtopicPath(item, node.path));

    return (
      <div key={`edit-subtopic-${node.path}`} className="space-y-2" style={{ marginLeft: `${node.depth * 14}px` }}>
        <div className={`rounded-lg border p-2.5 ${isCurrentParent ? 'border-primary/50 bg-primary/10' : 'border-border/70 bg-white/[0.03]'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{node.label}</p>
              <p className="truncate text-[11px] text-muted-foreground">{node.path}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Badge variant={node.explicit ? 'secondary' : 'outline'} className="rounded-full text-[10px]">
                {node.explicit ? (isAddedForQuestion ? 'In this question' : 'Existing') : 'Branch'}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant={isCurrentParent ? 'default' : 'outline'}
                className={isCurrentParent ? 'h-8 rounded-lg px-2.5' : 'h-8 rounded-lg border-primary/35 bg-primary/10 px-2.5 text-primary hover:bg-primary/20'}
                onClick={() => {
                  setSelectedEditSubtopicParent(node.path);
                  setEditSubtopicInput('');
                }}
              >
                {isCurrentParent ? 'Adding here' : 'Add child'}
              </Button>
              {isAddedForQuestion ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-lg px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => removeEditSubtopic(node.path)}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        {node.children.length > 0 ? (
          <div className="space-y-2">
            {node.children.map((child) => renderEditSubtopicHierarchyNode(child))}
          </div>
        ) : null}
      </div>
    );
  };

  const reindexByRemovedIndex = (source: Record<number, string>, removedIndex: number): Record<number, string> => {
    const next: Record<number, string> = {};
    Object.entries(source).forEach(([key, value]) => {
      const parsed = Number(key);
      if (!Number.isFinite(parsed) || !value) return;
      if (parsed < removedIndex) next[parsed] = value;
      if (parsed > removedIndex) next[parsed - 1] = value;
    });
    return next;
  };

  const addEditAlignment = () => {
    if (!editingQuestion) return;
    updateEditingQuestion((previous) => ({
      ...previous,
      alignments: [...(previous.alignments || []), createDefaultAlignment(previous)],
    }));
  };

  const removeEditAlignment = (index: number) => {
    updateEditingQuestion((previous) => {
      const alignments = [...(previous.alignments || [])];
      alignments.splice(index, 1);
      return { ...previous, alignments };
    });
    setEditAlignmentSubtopicInputByIndex((previous) => reindexByRemovedIndex(previous, index));
    setEditAlignmentSubtopicParentByIndex((previous) => reindexByRemovedIndex(previous, index));
  };

  const addEditAlignmentSubtopic = (index: number, parentPathOverride?: string) => {
    if (!editingQuestion) return;
    const childLabel = (editAlignmentSubtopicInputByIndex[index] || '').trim();
    if (!childLabel) return;
    const parentPath = normalizeSubtopicPath(parentPathOverride ?? (editAlignmentSubtopicParentByIndex[index] || ''));
    const next = normalizeSubtopicPath(
      parentPath
        ? joinSubtopicPath(parentPath, childLabel)
        : childLabel
    );
    if (!next) return;
    updateEditAlignment(index, (current) => {
      const normalized = normalizeSubtopics(current.subtopics);
      if (normalized.some((item) => isSameSubtopicPath(item, next))) {
        return current;
      }
      return { ...current, subtopics: normalizeSubtopics([...(current.subtopics || []), next]) };
    });
    setEditAlignmentSubtopicInputByIndex((previous) => ({ ...previous, [index]: '' }));
  };

  const removeEditAlignmentSubtopic = (index: number, target: string) => {
    updateEditAlignment(index, (current) => ({
      ...current,
      subtopics: stripSubtopicBranch(current.subtopics, target),
    }));
    setEditAlignmentSubtopicParentByIndex((previous) => {
      const currentParent = previous[index] || '';
      if (!currentParent || !isSubtopicPathWithinBranch(currentParent, target)) return previous;
      return { ...previous, [index]: '' };
    });
  };

  const renderEditAlignmentSubtopicHierarchyNode = (
    index: number,
    node: SubtopicHierarchyNode,
    selectedAlignmentSubtopics: string[]
  ) => {
    const currentParent = editAlignmentSubtopicParentByIndex[index] || '';
    const isCurrentParent = isSameSubtopicPath(currentParent, node.path);
    const isAddedForAlignment = selectedAlignmentSubtopics.some((item) => isSameSubtopicPath(item, node.path));
    return (
      <div key={`edit-alignment-subtopic-${index}-${node.path}`} className="space-y-2" style={{ marginLeft: `${node.depth * 14}px` }}>
        <div className={`rounded-lg border p-2.5 ${isCurrentParent ? 'border-primary/50 bg-primary/10' : 'border-border/70 bg-white/[0.03]'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{node.label}</p>
              <p className="truncate text-[11px] text-muted-foreground">{node.path}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Badge variant={node.explicit ? 'secondary' : 'outline'} className="rounded-full text-[10px]">
                {node.explicit ? (isAddedForAlignment ? 'In this alignment' : 'Existing') : 'Branch'}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant={isCurrentParent ? 'default' : 'outline'}
                className={isCurrentParent ? 'h-8 rounded-lg px-2.5' : 'h-8 rounded-lg border-primary/35 bg-primary/10 px-2.5 text-primary hover:bg-primary/20'}
                onClick={() => {
                  setEditAlignmentSubtopicParentByIndex((previous) => ({ ...previous, [index]: node.path }));
                  setEditAlignmentSubtopicInputByIndex((previous) => ({ ...previous, [index]: '' }));
                }}
              >
                {isCurrentParent ? 'Adding here' : 'Add child'}
              </Button>
              {isAddedForAlignment ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-lg px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => removeEditAlignmentSubtopic(index, node.path)}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        {node.children.length > 0 ? (
          <div className="space-y-2">
            {node.children.map((child) => renderEditAlignmentSubtopicHierarchyNode(index, child, selectedAlignmentSubtopics))}
          </div>
        ) : null}
      </div>
    );
  };

  const openEditDialog = (question: PracticeQuestion) => {
    if (isTeacherAuthoringRestricted) {
      showTeacherAuthoringRestrictedToast();
      return;
    }
    const normalizedImages = question.imageUrls && question.imageUrls.length > 0
      ? [...question.imageUrls]
      : (question.imageUrl ? [question.imageUrl] : []);
    const resolvedQuestionNumber = getQuestionNumber(question);
    const normalizedAlignments: QuestionAlignment[] = (question.alignments || []).map((alignment): QuestionAlignment => ({
      ...alignment,
      examTypeId: alignment.examTypeId || '',
      classId: alignment.classId || '',
      subjectId: alignment.subjectId || '',
      topicId: alignment.topicId || question.topicId || '',
      subtopics: normalizeSubtopics(alignment.subtopics),
      accessLevel: alignment.accessLevel === 'paid' ? 'paid' : 'free',
      mockTestOnly: !!alignment.mockTestOnly,
      difficultyLevel: 'Easy' as const,
      isPreviousYear: !!alignment.isPreviousYear,
      previousYear: alignment.previousYear || '',
    }));
    setEditingQuestion({
      ...question,
      examTypeId: question.examTypeId || '',
      classId: question.classId || '',
      subjectId: question.subjectId || '',
      topicId: question.topicId || '',
      subtopics: normalizeSubtopics(question.subtopics),
      mockTestOnly: !!question.mockTestOnly,
      questionNumber: resolvedQuestionNumber > 0 ? resolvedQuestionNumber : question.questionNumber,
      questionTitle: getDisplayQuestionTitle(question),
      isPreviousYear: !!question.isPreviousYear,
      previousYear: question.previousYear || '',
      imageUrls: normalizedImages,
      options: question.options ? [...question.options] : [],
      correctAnswers: question.correctAnswers ? [...question.correctAnswers] : (question.correctAnswer ? [question.correctAnswer] : []),
      mcqAnswerMode: question.mcqAnswerMode || ((question.correctAnswers && question.correctAnswers.length > 1) ? 'multiple' : 'single'),
      alignments: normalizedAlignments,
    });
    resetEditDialogTransientState();
  };

  const handleEditOptionChange = (index: number, value: string) => {
    if (!editingQuestion || editingQuestion.questionType !== 'MCQ') return;
    const nextOptions = [...(editingQuestion.options || [])];
    const previous = nextOptions[index] || '';
    nextOptions[index] = value;
    let nextCorrectAnswer = editingQuestion.correctAnswer || '';
    let nextCorrectAnswers = [...(editingQuestion.correctAnswers || [])];

    if (previous && nextCorrectAnswer === previous) nextCorrectAnswer = value;
    if (previous && nextCorrectAnswers.includes(previous)) {
      nextCorrectAnswers = value
        ? Array.from(new Set(nextCorrectAnswers.map((item) => item === previous ? value : item)))
        : nextCorrectAnswers.filter((item) => item !== previous);
    }

    setEditingQuestion({
      ...editingQuestion,
      options: nextOptions,
      correctAnswer: nextCorrectAnswer,
      correctAnswers: nextCorrectAnswers,
    });
  };

  const toggleEditCorrectOption = (option: string) => {
    if (!editingQuestion || editingQuestion.questionType !== 'MCQ' || !option) return;
    const mode = editingQuestion.mcqAnswerMode || 'single';
    if (mode === 'multiple') {
      const current = Array.from(new Set(editingQuestion.correctAnswers || []));
      const next = current.includes(option) ? current.filter((item) => item !== option) : [...current, option];
      setEditingQuestion({ ...editingQuestion, correctAnswers: next, correctAnswer: next[0] || '' });
      return;
    }
    setEditingQuestion({ ...editingQuestion, correctAnswer: option, correctAnswers: [option] });
  };

  const insertMathIntoEditQuestionText = (token: string) => {
    if (!editingQuestion) return;
    const current = editingQuestion.questionText || '';
    insertTokenAtCursor(current, token, editQuestionTextRef.current, (next) => {
      setEditingQuestion((prev) => (prev ? { ...prev, questionText: next } : prev));
    });
  };

  const handleEditQuestionImageCropped = async (data: { imageUrl: string; extractedText?: string }) => {
    if (!editingQuestion) return;
    const imageUrl = String(data.imageUrl || '').trim();
    if (!imageUrl) return;

    const mediaOwnerId = user?.uid || '';
    if (!mediaOwnerId) {
      toast({
        variant: 'destructive',
        title: 'Account missing',
        description: 'Unable to upload the replacement image because the signed-in account could not be resolved.',
      });
      return;
    }

    try {
      const uploadedImageUrl = imageUrl.startsWith('data:image/')
        ? await uploadPracticeQuestionImage(storage, mediaOwnerId, 'question', imageUrl)
        : imageUrl;

      setEditingQuestion((previous) => (
        previous
          ? {
              ...previous,
              questionText: 'Question attached as image',
              imageUrls: [uploadedImageUrl],
              imageUrl: uploadedImageUrl,
            }
          : previous
      ));
      toast({
        title: 'Question image updated',
        description: 'Cropped question image uploaded and attached.',
      });
    } catch (error) {
      console.error('Failed to replace question image:', error);
      toast({
        variant: 'destructive',
        title: 'Image upload failed',
        description: 'Unable to upload the cropped question image. Please try again.',
      });
    }
  };

  const saveEditedQuestion = async () => {
    if (isTeacherAuthoringRestricted) {
      showTeacherAuthoringRestrictedToast();
      return;
    }
    if (!editingQuestion) return;
    const trimmedText = (editingQuestion.questionText || '').trim();
    const previousYear = String(editingQuestion.previousYear || '').trim();
    const questionOwnerId = editingQuestion.teacherId || questionBankOwnerId || '';
    const mediaOwnerId = user?.uid || '';
    const yearPattern = /^(19|20)\d{2}$/;
    if (!questionOwnerId) {
      toast({ variant: 'destructive', title: 'Question bank unavailable', description: 'The active question bank owner could not be resolved. Please sign in again.' });
      return;
    }
    if (trimmedText.length < 10) {
      toast({ variant: 'destructive', title: 'Question too short', description: 'Question text must be at least 10 characters.' });
      return;
    }
    if (editingQuestion.isPreviousYear && !yearPattern.test(previousYear)) {
      toast({ variant: 'destructive', title: 'Invalid previous year', description: 'Enter a valid 4-digit year like 2020.' });
      return;
    }
    if (!editingQuestion.examTypeId || !editingQuestion.classId || !editingQuestion.subjectId || !editingQuestion.topicId) {
      toast({ variant: 'destructive', title: 'Missing category', description: 'Exam, curriculum, subject, and topic are required.' });
      return;
    }
    const normalizedPrimarySubtopics = normalizeSubtopics(editingQuestion.subtopics);
    const normalizedAlignments: QuestionAlignment[] = (editingQuestion.alignments || []).map((alignment): QuestionAlignment => ({
      ...alignment,
      subtopics: normalizeSubtopics(alignment.subtopics),
      accessLevel: alignment.accessLevel === 'paid' ? 'paid' : 'free',
      mockTestOnly: !!alignment.mockTestOnly,
      isPreviousYear: !!alignment.isPreviousYear,
      previousYear: alignment.isPreviousYear ? String(alignment.previousYear || '').trim() : '',
      difficultyLevel: 'Easy' as const,
      examTypeId: String(alignment.examTypeId || '').trim(),
      classId: String(alignment.classId || '').trim(),
      subjectId: String(alignment.subjectId || '').trim(),
      topicId: String(alignment.topicId || '').trim(),
    }));

    const hasInvalidAlignmentYear = normalizedAlignments.some((alignment) => (
      alignment.isPreviousYear && !yearPattern.test(String(alignment.previousYear || '').trim())
    ));
    if (hasInvalidAlignmentYear) {
      toast({ variant: 'destructive', title: 'Invalid alignment year', description: 'Each previous-year alignment must have a valid 4-digit year.' });
      return;
    }

    const existingWithoutCurrent = teacherQuestions.filter((question) => question.id !== editingQuestion.id);
    const questionNumberPlan = computeQuestionNumberPlan(
      existingWithoutCurrent,
      {
        examTypeId: editingQuestion.examTypeId,
        classId: editingQuestion.classId,
        subjectId: editingQuestion.subjectId,
        topicId: editingQuestion.topicId,
        subtopics: normalizedPrimarySubtopics,
      },
      normalizedAlignments
    );
    const primaryCategoryKey = getQuestionCategoryKey(
      editingQuestion.examTypeId,
      editingQuestion.classId,
      editingQuestion.subjectId,
      editingQuestion.topicId,
      normalizedPrimarySubtopics
    );
    if (!primaryCategoryKey) return;
    const resolvedQuestionNumber = questionNumberPlan.primaryQuestionNumber > 0 ? questionNumberPlan.primaryQuestionNumber : 1;
    const resolvedQuestionTitle = buildQuestionTitle(resolvedQuestionNumber);
    const payload: any = {
      questionTitle: resolvedQuestionTitle,
      questionNumber: resolvedQuestionNumber,
      questionText: trimmedText,
      difficultyLevel: 'Easy' as const,
      accessLevel: editingQuestion.accessLevel || 'free',
      mockTestOnly: !!editingQuestion.mockTestOnly,
      isPreviousYear: !!editingQuestion.isPreviousYear,
      previousYear: editingQuestion.isPreviousYear ? previousYear : '',
      questionType: editingQuestion.questionType,
      mcqAnswerMode: editingQuestion.mcqAnswerMode || 'single',
      examTypeId: editingQuestion.examTypeId,
      classId: editingQuestion.classId,
      subjectId: editingQuestion.subjectId,
      topicId: editingQuestion.topicId,
      subtopics: normalizedPrimarySubtopics,
      teacherId: questionOwnerId,
    };

    const usedCategoryKeys = new Set<string>([primaryCategoryKey]);
    payload.alignments = normalizedAlignments
      .map((alignment, index) => {
        if (!alignment.examTypeId || !alignment.classId || !alignment.subjectId || !alignment.topicId) {
          return null;
        }
        const categoryKey = getQuestionCategoryKey(
          alignment.examTypeId,
          alignment.classId,
          alignment.subjectId,
          alignment.topicId,
          alignment.subtopics
        );
        if (!categoryKey || usedCategoryKeys.has(categoryKey)) return null;
        usedCategoryKeys.add(categoryKey);
        const alignmentQuestionNumber = questionNumberPlan.alignmentQuestionNumbersByIndex[index] || 0;
        return {
          ...alignment,
          ...(alignmentQuestionNumber > 0 ? {
            questionNumber: alignmentQuestionNumber,
            questionTitle: buildQuestionTitle(alignmentQuestionNumber),
          } : {}),
        };
      })
      .filter(Boolean);

    const isImageOnlyQuestion = normalizeQuestionTextValue(trimmedText) === normalizeQuestionTextValue('Question attached as image');
    if (isImageOnlyQuestion) {
      const normalizedImages = (editingQuestion.imageUrls && editingQuestion.imageUrls.length > 0
        ? editingQuestion.imageUrls
        : (editingQuestion.imageUrl ? [editingQuestion.imageUrl] : []))
        .map((item) => String(item || '').trim())
        .filter(Boolean);
      if (normalizedImages.length > 0) {
        payload.imageUrls = normalizedImages;
        payload.imageUrl = normalizedImages[0];
      } else {
        payload.imageUrl = deleteField();
        payload.imageUrls = deleteField();
      }
    } else {
      payload.imageUrl = deleteField();
      payload.imageUrls = deleteField();
    }

    if (editingQuestion.questionType === 'MCQ') {
      const normalizedOptions = (editingQuestion.options || []).map((item) => (item || '').trim()).filter(Boolean);
      if (normalizedOptions.length < 2) {
        toast({ variant: 'destructive', title: 'Invalid options', description: 'MCQ questions need at least two options.' });
        return;
      }
      payload.options = normalizedOptions;
      if ((editingQuestion.mcqAnswerMode || 'single') === 'multiple') {
        const selected = Array.from(new Set((editingQuestion.correctAnswers || []).filter((item) => normalizedOptions.includes(item))));
        if (selected.length < 2) {
          toast({ variant: 'destructive', title: 'Select answers', description: 'Multiple-correct MCQs need at least two correct options.' });
          return;
        }
        payload.correctAnswers = selected;
        payload.correctAnswer = selected[0];
      } else {
        const selected = (editingQuestion.correctAnswer || '').trim();
        if (!selected || !normalizedOptions.includes(selected)) {
          toast({ variant: 'destructive', title: 'Select answer', description: 'Choose one correct option before saving.' });
          return;
        }
        payload.correctAnswer = selected;
        payload.correctAnswers = [];
      }
    } else if (editingQuestion.questionType === 'Numerical') {
      if (editingQuestion.numericalAnswer === undefined || editingQuestion.numericalAnswer === null || Number.isNaN(Number(editingQuestion.numericalAnswer))) {
        toast({ variant: 'destructive', title: 'Invalid numerical answer', description: 'Enter a valid numerical answer before saving.' });
        return;
      }
      payload.numericalAnswer = Number(editingQuestion.numericalAnswer);
      payload.numericalAnswerText = String(editingQuestion.numericalAnswer ?? '').trim();
      payload.correctAnswer = '';
      payload.correctAnswers = [];
      payload.options = [];
    } else {
      const textAnswer = (editingQuestion.textAnswer || '').trim();
      if (!textAnswer) {
        toast({ variant: 'destructive', title: 'Missing text answer', description: 'Text-answer questions need an answer before saving.' });
        return;
      }
      payload.textAnswer = textAnswer;
      payload.correctAnswer = '';
      payload.correctAnswers = [];
      payload.options = [];
    }

    setIsSavingEdit(true);
    try {
      const persistedQuestionImages = isImageOnlyQuestion
        ? await persistPracticeQuestionImageUrls(
            storage,
            mediaOwnerId,
            'question',
            editingQuestion.imageUrls,
            editingQuestion.imageUrl
          )
        : [];
      const persistedExplanationImages = await persistPracticeQuestionImageUrls(
        storage,
        mediaOwnerId,
        'solution',
        editingQuestion.explanationImageUrls,
        editingQuestion.explanationImageUrl
      );

      if (persistedExplanationImages.length > 0) {
        payload.explanationImageUrls = persistedExplanationImages;
        payload.explanationImageUrl = persistedExplanationImages[0];
      } else if (normalizeImageUrlList(editingQuestion.explanationImageUrls, editingQuestion.explanationImageUrl).length > 0) {
        payload.explanationImageUrl = deleteField();
        payload.explanationImageUrls = deleteField();
      }
      if (isImageOnlyQuestion) {
        if (persistedQuestionImages.length > 0) {
          payload.imageUrls = persistedQuestionImages;
          payload.imageUrl = persistedQuestionImages[0];
        } else {
          payload.imageUrl = deleteField();
          payload.imageUrls = deleteField();
        }
      }

      await updateDoc(doc(firestore, 'practice_questions', editingQuestion.id), normalizeQuestionDifficulty(payload));
      await syncPracticeQuestionSummaryForUpdate(firestore, editingQuestion, payload);
      toast({ title: 'Question updated', description: 'Your changes have been saved.' });
      closeEditDialog();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: error?.message || 'Could not save this question right now.',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const deleteQuestion = async (question: PracticeQuestion) => {
    if (isTeacherAuthoringRestricted) {
      showTeacherAuthoringRestrictedToast();
      return;
    }
    if (!questionBankOwnerId || question.teacherId !== questionBankOwnerId) return;
    const confirmed = window.confirm('Delete this question permanently?');
    if (!confirmed) return;
    setDeletingQuestionId(question.id);
    try {
      await deleteDoc(doc(firestore, 'practice_questions', question.id));
      await syncPracticeQuestionSummaryForDelete(firestore, question);
      if (editingQuestion?.id === question.id) {
        closeEditDialog();
      }
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const toggleQuestionSelection = (questionId: string, checked?: boolean) => {
    if (isTeacherAuthoringRestricted) return;
    setSelectedQuestionIds((previous) => {
      const next = new Set(previous);
      const shouldSelect = typeof checked === 'boolean' ? checked : !next.has(questionId);
      if (shouldSelect) next.add(questionId);
      else next.delete(questionId);
      return Array.from(next);
    });
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    if (isTeacherAuthoringRestricted) return;
    setSelectedQuestionIds((previous) => {
      const next = new Set(previous);
      if (checked) {
        visibleQuestionIds.forEach((id) => next.add(id));
      } else {
        visibleQuestionIds.forEach((id) => next.delete(id));
      }
      return Array.from(next);
    });
  };

  const resetBulkEditDialog = () => {
    setBulkEditState(createDefaultBulkEditState());
    setIsBulkEditDialogOpen(false);
  };

  const openBulkEditDialog = () => {
    if (isTeacherAuthoringRestricted) {
      showTeacherAuthoringRestrictedToast();
      return;
    }
    if (selectedQuestionsForProcessing.length === 0) return;
    setBulkEditState(createDefaultBulkEditState());
    setIsBulkEditDialogOpen(true);
  };

  const addBulkSubtopic = () => {
    const nextPath = normalizeSubtopicPath(bulkEditState.subtopicInput);
    if (!nextPath) return;
    setBulkEditState((previous) => ({
      ...previous,
      subtopics: normalizeSubtopics([...(previous.subtopics || []), nextPath]),
      subtopicInput: '',
    }));
  };

  const removeBulkSubtopic = (target: string) => {
    setBulkEditState((previous) => ({
      ...previous,
      subtopics: previous.subtopics.filter((item) => !isSameSubtopicPath(item, target)),
    }));
  };

  const commitBulkQuestionUpdates = async (updates: Array<{ questionId: string; payload: Record<string, any> }>) => {
    for (let index = 0; index < updates.length; index += BULK_WRITE_CHUNK_SIZE) {
      const batch = writeBatch(firestore);
      updates.slice(index, index + BULK_WRITE_CHUNK_SIZE).forEach(({ questionId, payload }) => {
        batch.update(doc(firestore, 'practice_questions', questionId), normalizeQuestionDifficulty(payload));
      });
      await batch.commit();
    }
  };

  const commitBulkQuestionDeletes = async (questionIds: string[]) => {
    for (let index = 0; index < questionIds.length; index += BULK_WRITE_CHUNK_SIZE) {
      const batch = writeBatch(firestore);
      questionIds.slice(index, index + BULK_WRITE_CHUNK_SIZE).forEach((questionId) => {
        batch.delete(doc(firestore, 'practice_questions', questionId));
      });
      await batch.commit();
    }
  };

  const saveBulkEditedQuestions = async () => {
    if (isTeacherAuthoringRestricted) {
      showTeacherAuthoringRestrictedToast();
      return;
    }
    if (!user?.uid) {
      toast({ variant: 'destructive', title: 'Teacher account missing', description: 'Please sign in again before bulk editing questions.' });
      return;
    }
    if (selectedQuestionsForProcessing.length === 0) {
      toast({ variant: 'destructive', title: 'No questions selected', description: 'Select at least one question to bulk edit.' });
      return;
    }
    const hasAnyBulkChange = [
      bulkEditState.updateExamType,
      bulkEditState.updateClass,
      bulkEditState.updateSubject,
      bulkEditState.updateTopic,
      bulkEditState.updateSubtopics,
      bulkEditState.updatePreviousYearFlag,
      bulkEditState.updatePreviousYearValue,
    ].some(Boolean);
    if (!hasAnyBulkChange) {
      toast({ variant: 'destructive', title: 'No bulk changes selected', description: 'Turn on at least one bulk edit option before saving.' });
      return;
    }

    const yearPattern = /^(19|20)\d{2}$/;
    const remainingQuestions = teacherQuestions.filter((question) => !selectedQuestionIdSet.has(question.id));
    const categoryCounter = buildCategoryQuestionNumberCounter(remainingQuestions);
    const reserveQuestionNumber = (categoryKey: string): number => {
      const nextValue = (categoryCounter.get(categoryKey) || 0) + 1;
      categoryCounter.set(categoryKey, nextValue);
      return nextValue;
    };
    const updates: Array<{ questionId: string; payload: Record<string, any> }> = [];

    for (const question of selectedQuestionsForProcessing) {
      const nextExamTypeId = bulkEditState.updateExamType ? bulkEditState.examTypeId : question.examTypeId;
      const nextClassId = bulkEditState.updateClass ? bulkEditState.classId : question.classId;
      const nextSubjectId = bulkEditState.updateSubject ? bulkEditState.subjectId : question.subjectId;
      const nextTopicId = bulkEditState.updateTopic ? bulkEditState.topicId : question.topicId;
      const nextSubtopics = bulkEditState.updateSubtopics ? normalizeSubtopics(bulkEditState.subtopics) : normalizeSubtopics(question.subtopics);
      const nextIsPreviousYear = bulkEditState.updatePreviousYearFlag ? bulkEditState.isPreviousYear : !!question.isPreviousYear;
      const nextPreviousYear = nextIsPreviousYear
        ? (bulkEditState.updatePreviousYearValue ? bulkEditState.previousYear.trim() : String(question.previousYear || '').trim())
        : '';

      if (bulkEditState.updatePreviousYearValue && !nextIsPreviousYear) {
        toast({
          variant: 'destructive',
          title: 'Previous year status required',
          description: `Turn previous year status on before changing the PYQ year for ${getDisplayQuestionTitle(question)}.`,
        });
        return;
      }

      if (!nextExamTypeId || !nextClassId || !nextSubjectId || !nextTopicId) {
        toast({
          variant: 'destructive',
          title: 'Incomplete category update',
          description: `Could not resolve a full category for ${getDisplayQuestionTitle(question)}. Update exam, class, subject, and topic together.`,
        });
        return;
      }

      const nextClass = classRecordById.get(nextClassId);
      if (!nextClass || nextClass.examTypeId !== nextExamTypeId) {
        toast({
          variant: 'destructive',
          title: 'Invalid curriculum mapping',
          description: `The selected class does not belong to the selected exam for ${getDisplayQuestionTitle(question)}.`,
        });
        return;
      }

      const nextSubject = subjectRecordById.get(nextSubjectId);
      if (!nextSubject || nextSubject.classId !== nextClassId) {
        toast({
          variant: 'destructive',
          title: 'Invalid subject mapping',
          description: `The selected subject does not belong to the selected curriculum for ${getDisplayQuestionTitle(question)}.`,
        });
        return;
      }

      const nextTopic = topicRecordById.get(nextTopicId);
      if (!nextTopic || nextTopic.subjectId !== nextSubjectId) {
        toast({
          variant: 'destructive',
          title: 'Invalid topic mapping',
          description: `The selected topic does not belong to the selected subject for ${getDisplayQuestionTitle(question)}.`,
        });
        return;
      }

      if (nextIsPreviousYear && !yearPattern.test(nextPreviousYear)) {
        toast({
          variant: 'destructive',
          title: 'Invalid previous year',
          description: `Enter a valid 4-digit PYQ year for ${getDisplayQuestionTitle(question)}.`,
        });
        return;
      }

      const previousPrimaryCategoryKey = getQuestionCategoryKey(
        question.examTypeId,
        question.classId,
        question.subjectId,
        question.topicId,
        question.subtopics
      );
      const nextPrimaryCategoryKey = getQuestionCategoryKey(
        nextExamTypeId,
        nextClassId,
        nextSubjectId,
        nextTopicId,
        nextSubtopics
      );
      if (!nextPrimaryCategoryKey) {
        toast({
          variant: 'destructive',
          title: 'Invalid category',
          description: `Could not compute the next category for ${getDisplayQuestionTitle(question)}.`,
        });
        return;
      }

      const nextAlignments = normalizeQuestionAlignmentList(question.alignments)
        .filter((alignment) => alignment.examTypeId && alignment.classId && alignment.subjectId && alignment.topicId)
        .filter((alignment) => (
          getQuestionCategoryKey(
            alignment.examTypeId,
            alignment.classId,
            alignment.subjectId,
            alignment.topicId,
            alignment.subtopics
          ) !== nextPrimaryCategoryKey
        ));

      let nextQuestionNumber = getQuestionNumber(question);
      if (previousPrimaryCategoryKey !== nextPrimaryCategoryKey || nextQuestionNumber <= 0) {
        nextQuestionNumber = reserveQuestionNumber(nextPrimaryCategoryKey);
      }

      const payload: Record<string, any> = {
        examTypeId: nextExamTypeId,
        classId: nextClassId,
        subjectId: nextSubjectId,
        topicId: nextTopicId,
        subtopics: nextSubtopics,
        isPreviousYear: nextIsPreviousYear,
        previousYear: nextPreviousYear,
        questionNumber: nextQuestionNumber,
        questionTitle: buildQuestionTitle(nextQuestionNumber),
        alignments: nextAlignments,
        teacherId: question.teacherId || questionBankOwnerId || user.uid,
      };

      updates.push({ questionId: question.id, payload });

      const simulatedQuestion: PracticeQuestion = {
        ...question,
        ...payload,
        alignments: nextAlignments,
      };
      getQuestionCategoryNumberPairs(simulatedQuestion).forEach(({ categoryKey, questionNumber }) => {
        if (!categoryKey || questionNumber <= 0) return;
        categoryCounter.set(categoryKey, Math.max(categoryCounter.get(categoryKey) || 0, questionNumber));
      });
    }

    setIsBulkEditing(true);
    try {
      await commitBulkQuestionUpdates(updates);
      await syncPracticeQuestionSummaryForBulkUpdate(
        firestore,
        updates.flatMap(({ questionId, payload }) => {
          const previousQuestion = selectedQuestionsForProcessing.find((question) => question.id === questionId);
          return previousQuestion ? [{ previousQuestion, nextQuestionPatch: payload }] : [];
        })
      );
      toast({
        title: 'Bulk edit completed',
        description: `${updates.length} question${updates.length === 1 ? '' : 's'} updated successfully.`,
      });
      setSelectedQuestionIds([]);
      resetBulkEditDialog();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Bulk edit failed',
        description: error?.message || 'Could not update the selected questions right now.',
      });
    } finally {
      setIsBulkEditing(false);
    }
  };

  const deleteSelectedQuestions = async () => {
    if (isTeacherAuthoringRestricted) {
      showTeacherAuthoringRestrictedToast();
      return;
    }
    if (selectedQuestionsForProcessing.length === 0) {
      toast({ variant: 'destructive', title: 'No questions selected', description: 'Select at least one question to delete.' });
      return;
    }
    const confirmed = window.confirm(`Delete ${selectedQuestionsForProcessing.length} selected question(s) permanently?`);
    if (!confirmed) return;

    setIsBulkDeleting(true);
    try {
      const selectedIds = selectedQuestionsForProcessing.map((question) => question.id);
      await commitBulkQuestionDeletes(selectedIds);
      await syncPracticeQuestionSummaryForBulkDelete(firestore, selectedQuestionsForProcessing);
      if (editingQuestion && selectedQuestionIdSet.has(editingQuestion.id)) {
        closeEditDialog();
      }
      toast({
        title: 'Selected questions deleted',
        description: `${selectedIds.length} question${selectedIds.length === 1 ? '' : 's'} removed from the question bank.`,
      });
      setSelectedQuestionIds([]);
      resetBulkEditDialog();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Bulk delete failed',
        description: error?.message || 'Could not delete the selected questions right now.',
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  useEffect(() => {
    if (!isBulkEditDialogOpen || selectedQuestionsForProcessing.length > 0) return;
    resetBulkEditDialog();
  }, [isBulkEditDialogOpen, selectedQuestionsForProcessing.length]);

  if (isTeacherAuthoringRestricted) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="DCAM Question Bank" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="shadow-lg">
            <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Redirecting to dashboard...
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="DCAM Question Bank" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 grid gap-6">
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/70 shadow-[0_24px_80px_-42px_rgba(56,189,248,0.45)]">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-20 w-full bg-gradient-to-r from-primary/20 via-transparent to-transparent" />
          <CardContent className="relative grid gap-4 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <Badge className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                  {isQuestionUploader ? 'Question Upload Workspace' : 'Teacher Workspace'}
                </Badge>
                <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                  <Sparkles className="h-5 w-5 text-primary" />
                  DCAM Question Bank
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isTeacherAuthoringRestricted
                    ? 'Browse and review your uploaded questions in read-only mode.'
                    : isSharedDcamQuestionBank
                      ? `Manage, filter, and update the shared ${DCAM_QUESTION_BANK_LABEL} with category-wise control.`
                      : 'Manage, filter, and update your uploaded questions with category-wise control.'}
                </p>
              </div>
              {canManageTeacherAuthoring ? (
                <Button asChild variant="outline" className="h-11 rounded-xl border-primary/35 bg-primary/10 px-5 text-primary hover:bg-primary/20">
                  <Link href="/practice">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Add Question
                  </Link>
                </Button>
              ) : (
                <Badge variant="secondary" className="rounded-full px-3 py-1.5 text-xs">
                  Authorized Teacher: {ALLOWED_TEACHER_AUTHOR_EMAIL}
                </Badge>
              )}
            </div>
	            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
	              <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
	                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total Bank Questions</p>
	                <p className="mt-1 text-lg font-semibold text-foreground">{totalBankQuestionCount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    {isInventoryLoading ? 'cached summary while inventory loads' : 'live inventory loaded'}
                  </p>
	              </div>
              <div className="rounded-xl border border-border/70 bg-white/[0.05] p-3">
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"><SlidersHorizontal className="h-3.5 w-3.5" /> Current View</p>
                <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
                  {isInventoryLoading ? <LoaderCircle className="h-4 w-4 animate-spin text-primary" /> : null}
                  {isInventoryLoading ? 'Loading' : sortedVisibleQuestions.length.toLocaleString()}
                </p>
              </div>
	              <div className="rounded-xl border border-border/70 bg-white/[0.05] p-3">
	                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"><LayoutGrid className="h-3.5 w-3.5" /> Category Buckets</p>
	                <p className="mt-1 text-lg font-semibold text-foreground">{isInventoryLoading ? 'Loading' : categorizedQuestions.length.toLocaleString()}</p>
	              </div>
	            </div>
	            <div className="rounded-xl border border-border/70 bg-white/[0.04] p-3">
	              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Question Bank Scope</p>
	              <p className="mt-1 text-sm font-medium text-foreground break-all">{user?.email || 'Unknown account'}</p>
	              <p className="mt-1 text-xs text-muted-foreground">
	                {isSharedDcamQuestionBank
                    ? `This page shows the shared ${DCAM_QUESTION_BANK_LABEL}. Questions saved here use the DCAM bank owner.`
                    : 'This page shows questions from the active teacher question bank.'}
	              </p>
	            </div>
	          </CardContent>
	        </Card>

        {!canAccessQuestionUpload && !isQuestionUploadAccessLoading ? (
          <Card>
            <CardHeader>
              <CardTitle>Question Upload Access Required</CardTitle>
              <CardDescription>This page is only available for teachers and Question Upload accounts.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {isTeacherAuthoringRestricted ? (
          <Card className="border-amber-500/30 bg-amber-500/10">
            <CardHeader>
              <CardTitle className="text-amber-100">DCAM Question Bank Editing Is Disabled For This Teacher</CardTitle>
              <CardDescription className="text-amber-100/80">
                {getTeacherAuthoringRestrictionCopy()} Existing questions are still visible here and remain untouched.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card className="border-primary/20 bg-gradient-to-br from-primary/12 via-slate-800/35 to-slate-900/25 shadow-lg">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-3xl">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                  Filter Your Questions
                </CardTitle>
                <CardDescription className="mt-1">Select exam, curriculum, subject, topic, subtopic, question type, and access level to view the active question bank.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary">
                  {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}
                </Badge>
                {scopedQuestionsError ? (
                  <Badge variant="outline" className="rounded-full border-amber-400/40 bg-amber-500/10 text-amber-200">
                    Question sync issue
                  </Badge>
                ) : null}
                {areFilterOptionsLoading ? (
                  <Badge variant="outline" className="rounded-full border-border/70 bg-white/10 text-muted-foreground">
                    Syncing filters
                  </Badge>
                ) : null}
	                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl border-primary/35 bg-primary/10 px-3 text-primary hover:bg-primary/20"
                  onClick={resetFilters}
                  disabled={activeFilterCount === 0}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset Filters
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7">
            <div>
              <p className="mb-2 text-sm font-medium">Exam</p>
              <Select
                value={selectedExamTypeId}
                onValueChange={(value) => {
                  setSelectedExamTypeId(value);
                  setSelectedClassId('all');
                  setSelectedSubjectId('all');
                  setSelectedTopicId('all');
                  setSelectedSubtopic('all');
                }}
              >
                <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder="Select exam" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All exams</SelectItem>
                  {teacherScopedExamTypes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Curriculum</p>
              <Select
                value={selectedClassId}
                onValueChange={(value) => {
                  setSelectedClassId(value);
                  setSelectedSubjectId('all');
                  setSelectedTopicId('all');
                  setSelectedSubtopic('all');
                }}
                disabled={selectedExamTypeId === 'all'}
              >
                <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder={selectedExamTypeId === 'all' ? 'Select exam first' : 'Select curriculum'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All curricula</SelectItem>
                  {filteredClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Subject</p>
              <Select
                value={selectedSubjectId}
                onValueChange={(value) => {
                  setSelectedSubjectId(value);
                  setSelectedTopicId('all');
                  setSelectedSubtopic('all');
                }}
                disabled={selectedClassId === 'all'}
              >
                <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder={selectedClassId === 'all' ? 'Select curriculum first' : 'Select subject'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {filteredSubjects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Topic</p>
              <Select
                value={selectedTopicId}
                onValueChange={(value) => {
                  setSelectedTopicId(value);
                  setSelectedSubtopic('all');
                }}
                disabled={selectedSubjectId === 'all'}
              >
                <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder={selectedSubjectId === 'all' ? 'Select subject first' : 'Select topic'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All topics</SelectItem>
                  {filteredTopics.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Subtopic Branch</p>
              <Select value={selectedSubtopic} onValueChange={setSelectedSubtopic} disabled={selectedTopicId === 'all'}>
                <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder="Select subtopic" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subtopics</SelectItem>
                  {availableSubtopics.map((item) => (
                    <SelectItem key={item} value={item}>
                      {`${'-- '.repeat(Math.max(0, splitSubtopicPath(item).length - 1))}${item}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Question Type</p>
              <Select
                value={selectedQuestionType}
                onValueChange={(value) => {
                  setSelectedQuestionType(value as any);
                  setSelectedSubtopic('all');
                }}
              >
                <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="MCQ">MCQ</SelectItem>
                  <SelectItem value="Numerical">Numerical</SelectItem>
                  <SelectItem value="Text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Access Level</p>
              <Select value={selectedAccessLevel} onValueChange={(value) => setSelectedAccessLevel(value as 'all' | 'free' | 'paid')}>
                <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder="Select access level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-to-br from-slate-900/60 via-slate-800/35 to-slate-900/20 shadow-lg">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-3xl">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Uploaded Questions
                </CardTitle>
                <CardDescription className="mt-1">
                  {isInventoryLoading
                    ? `Loading live question inventory. Cached bank total: ${totalBankQuestionCount.toLocaleString()} question(s).`
                    : `${sortedVisibleQuestions.length.toLocaleString()} question(s) found with current filters.`}
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary">
                Live Inventory View
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {isTeacherAuthoringRestricted
                    ? 'Selection and edit controls are disabled for this teacher account.'
                    : selectedQuestionIds.length > 0
                    ? `${selectedQuestionIds.length} question${selectedQuestionIds.length === 1 ? '' : 's'} selected`
                    : 'Select questions to use bulk actions'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isTeacherAuthoringRestricted
                    ? 'You can still filter and review the inventory, but website-based edits are restricted.'
                    : 'Selection works on the real question document. If the same question appears in another category because of an alignment, it stays selected there too.'}
                </p>
              </div>
              {!isTeacherAuthoringRestricted ? (
                <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white/[0.04] px-3 py-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={areAllVisibleSelected}
                    onCheckedChange={(checked) => toggleSelectAllVisible(!!checked)}
                    disabled={visibleQuestionIds.length === 0}
                    className="rounded-full"
                  />
                  Select visible
                  <span className="text-foreground">{selectedVisibleQuestionCount}/{visibleQuestionIds.length}</span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setSelectedQuestionIds([])}
                  disabled={selectedQuestionIds.length === 0}
                >
                  Clear Selection
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-primary/35 bg-primary/10 text-primary hover:bg-primary/20"
                  onClick={openBulkEditDialog}
                  disabled={selectedQuestionIds.length === 0 || isBulkDeleting}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Bulk Edit
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="rounded-full bg-red-500/90 text-white hover:bg-red-500"
                  onClick={deleteSelectedQuestions}
                  disabled={selectedQuestionIds.length === 0 || isBulkEditing || isBulkDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isBulkDeleting ? 'Deleting...' : 'Delete Selected'}
                </Button>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isInventoryLoading && categorizedQuestions.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Category Boxes</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {categorizedQuestions.map((bucket) => (
                    <button
                      key={bucket.key}
                      type="button"
                      className="rounded-xl border border-border/70 bg-white/[0.04] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10 hover:shadow-[0_16px_34px_-24px_rgba(59,130,246,0.7)]"
                      onClick={() => {
                        setSelectedExamTypeId(bucket.examTypeId || 'all');
                        setSelectedClassId(bucket.classId || 'all');
                        setSelectedSubjectId(bucket.subjectId || 'all');
                        setSelectedTopicId(bucket.topicId || 'all');
                        setSelectedSubtopic(bucket.subtopicPath || 'all');
                      }}
                    >
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="rounded-full">{examTypeMap[bucket.examTypeId] || 'Unknown Exam'}</Badge>
                        <Badge variant="outline" className="rounded-full">{classMap[bucket.classId] || 'Unknown Curriculum'}</Badge>
                        <Badge variant="outline" className="rounded-full">{subjectMap[bucket.subjectId] || 'Unknown Subject'}</Badge>
                        <Badge variant="outline" className="rounded-full">{topicMap[bucket.topicId] || 'Unknown Topic'}</Badge>
                        <Badge variant="outline" className="rounded-full border-primary/40 bg-primary/10 text-primary">
                          {bucket.subtopicPath || 'No subtopic'}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {bucket.questions.length} question{bucket.questions.length === 1 ? '' : 's'} in this category
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {isInventoryLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
	            ) : sortedVisibleQuestions.length === 0 ? (
	              <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
	                {teacherQuestions.length === 0 ? (
	                  <>
	                    <p>No questions are available in the active question bank.</p>
	                    <p className="mt-2 text-xs">
	                      Current account: <span className="font-medium text-foreground">{user?.email || user?.uid || 'Unknown account'}</span>
	                    </p>
                      {scopedQuestionsError ? (
                        <p className="mt-2 text-xs text-destructive">
                          Teacher question data could not be loaded. Refresh and try again.
                        </p>
                      ) : null}
	                  </>
	                ) : (
	                  <p>No questions found for the selected categories.</p>
	                )}
	              </div>
	            ) : (
              sortedVisibleQuestions.map((entry) => {
                const question = entry.sourceQuestion;
                const selectedSet = new Set(
                  question.correctAnswers && question.correctAnswers.length > 0
                    ? question.correctAnswers
                    : (question.correctAnswer ? [question.correctAnswer] : [])
                );
                const answerLetters = (question.options || []).reduce<string[]>((acc, option, index) => {
                  if (selectedSet.has(option)) acc.push(String.fromCharCode(65 + index));
                  return acc;
                }, []);
                const explanationImages = question.explanationImageUrls && question.explanationImageUrls.length > 0
                  ? question.explanationImageUrls
                  : (question.explanationImageUrl ? [question.explanationImageUrl] : []);
                const questionImages = question.imageUrls && question.imageUrls.length > 0
                  ? question.imageUrls
                  : (question.imageUrl ? [question.imageUrl] : []);
                const hasExplanationText = !!(question.solutionExplanation || '').trim();
                const isExplanationExpanded = expandedExplanationQuestionIds.has(question.id);
                const hasQuestionImages = questionImages.length > 0;
                const isQuestionImagesExpanded = expandedQuestionImageQuestionIds.has(question.id);
                const isQuestionSelected = selectedQuestionIdSet.has(question.id);

                return (
                  <div
                    key={entry.entryId}
                    className={`relative rounded-xl border p-4 space-y-3 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.65)] ${
                      isQuestionSelected
                        ? 'border-primary/55 bg-primary/10 ring-1 ring-primary/30'
                        : 'border-border/70 bg-white/[0.03]'
                    }`}
                  >
                    {!isTeacherAuthoringRestricted ? (
                      <div className="absolute right-4 top-4 z-20 rounded-full border border-white/15 bg-slate-950/75 p-1.5 shadow-lg backdrop-blur-sm">
                        <Checkbox
                          checked={isQuestionSelected}
                          onCheckedChange={(checked) => toggleQuestionSelection(question.id, !!checked)}
                          aria-label={`Select ${entry.questionTitle || getDisplayQuestionTitle(question)}`}
                          className="h-5 w-5 rounded-full border-primary/50"
                        />
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 pr-10">
                      <Badge variant="outline" className="rounded-full">{examTypeMap[entry.examTypeId] || 'Unknown Exam'}</Badge>
                      <Badge variant="outline" className="rounded-full">{classMap[entry.classId] || 'Unknown Curriculum'}</Badge>
                      <Badge variant="outline" className="rounded-full">{subjectMap[entry.subjectId] || 'Unknown Subject'}</Badge>
                      <Badge variant="outline" className="rounded-full">{topicMap[entry.topicId] || 'Unknown Topic'}</Badge>
                      {normalizeSubtopics(entry.subtopics).map((subtopic) => (
                        <Badge key={`${entry.entryId}-subtopic-${subtopic}`} variant="outline" className="rounded-full border-primary/40 bg-primary/10 text-primary">
                          {subtopic}
                        </Badge>
                      ))}
                      <Badge variant="secondary" className="rounded-full">{entry.questionType}</Badge>
                      
                      <Badge variant={entry.accessLevel === 'paid' ? 'destructive' : 'secondary'} className="rounded-full">{entry.accessLevel === 'paid' ? 'Paid' : 'Free'}</Badge>
                      {entry.mockTestOnly ? <Badge variant="outline" className="rounded-full">Mock Test Only</Badge> : null}
                      {entry.isPreviousYear ? <Badge variant="outline" className="rounded-full">PYQ {entry.previousYear || ''}</Badge> : null}
                      {entry.isAlignment ? <Badge variant="outline" className="rounded-full border-primary/40 bg-primary/10 text-primary">Alignment Category</Badge> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {hasQuestionImages ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-primary/35 bg-primary/10 text-primary hover:bg-primary/20"
                            onClick={() => toggleQuestionImages(question.id)}
                          >
                            {isQuestionImagesExpanded ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                            {isQuestionImagesExpanded ? 'Hide Question Image' : 'Show Question Image'}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-primary/35 bg-primary/10 text-primary hover:bg-primary/20"
                          onClick={() => toggleExplanation(question.id)}
                        >
                          {isExplanationExpanded ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                          {isExplanationExpanded ? 'Hide Explanation Image' : 'Show Explanation Image'}
                        </Button>
                        {!isTeacherAuthoringRestricted ? (
                          <>
                            <Button type="button" variant="outline" size="sm" className="rounded-xl border-primary/35 bg-primary/10 text-primary hover:bg-primary/20" onClick={() => openEditDialog(question)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="rounded-xl bg-red-500/90 text-white hover:bg-red-500"
                              onClick={() => deleteQuestion(question)}
                              disabled={deletingQuestionId === question.id}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {deletingQuestionId === question.id ? 'Deleting...' : 'Delete'}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <p className="font-semibold">{entry.questionTitle || buildQuestionTitle(entry.questionNumber)}</p>
                    <MathText text={question.questionText} className="text-sm" />

                    {question.questionType === 'MCQ' && question.options ? (
                      <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm">
                        <p className="text-xs font-medium text-muted-foreground">MCQ Options</p>
                        {question.options.map((option, index) => (
                          <p key={`${question.id}-${index}`}>
                            {String.fromCharCode(65 + index)}. <MathText text={option} className="text-sm" /> {selectedSet.has(option) ? '(Correct)' : ''}
                          </p>
                        ))}
                        <p className="font-semibold">Answer: {answerLetters.length > 0 ? answerLetters.join(', ') : 'Not set'}</p>
                      </div>
                    ) : question.questionType === 'Numerical' ? (
                      <div className="space-y-1 rounded-md border bg-muted/20 p-3 text-sm">
                        <p className="text-xs font-medium text-muted-foreground">Numerical Answer</p>
                        <p className="font-semibold">
                          Answer:{' '}
                          <MathText
                            text={
                              question.numericalAnswerText && question.numericalAnswerText.trim()
                                ? question.numericalAnswerText
                                : (question.numericalAnswer ?? '-')
                            }
                            className="text-sm"
                          />
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1 rounded-md border bg-muted/20 p-3 text-sm">
                        <p className="text-xs font-medium text-muted-foreground">Reference Text Answer</p>
                        <p className="whitespace-pre-wrap"><MathText text={question.textAnswer || ''} className="text-sm" /></p>
                      </div>
                    )}

                    {isQuestionImagesExpanded && hasQuestionImages ? (
                      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                        <p className="text-xs font-medium text-muted-foreground">Uploaded Question Image</p>
                        <div className="flex flex-wrap gap-3">
                          {questionImages.map((url, index) => (
                            <a key={`${question.id}-question-image-${index}`} href={url} target="_blank" rel="noreferrer" className="block rounded-md border p-1 hover:border-primary">
                              <img
                                src={url}
                                alt={`Question image ${index + 1}`}
                                loading="lazy"
                                className="h-auto max-h-72 w-full rounded object-contain bg-background"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {isExplanationExpanded ? (
                      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                        <p className="text-xs font-medium text-muted-foreground">Uploaded Explanation</p>
                        {hasExplanationText ? (
                          <div className="rounded-md border bg-background p-3 text-sm whitespace-pre-wrap">
                            <MathText text={question.solutionExplanation || ''} className="text-sm" />
                          </div>
                        ) : null}
                        {explanationImages.length > 0 ? (
                          <div className="flex flex-wrap gap-3">
                            {explanationImages.map((url, index) => (
                              <a key={`${question.id}-explain-${index}`} href={url} target="_blank" rel="noreferrer" className="block rounded-md border p-1 hover:border-primary">
                                <img
                                  src={url}
                                  alt={`Explanation image ${index + 1}`}
                                  loading="lazy"
                                  className="h-auto max-h-64 w-full rounded object-contain bg-background"
                                />
                              </a>
                            ))}
                          </div>
                        ) : null}
                        {!hasExplanationText && explanationImages.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No explanation uploaded for this question.</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Dialog
          open={isBulkEditDialogOpen && !isTeacherAuthoringRestricted}
          onOpenChange={(open) => {
            if (open) {
              setIsBulkEditDialogOpen(true);
              return;
            }
            resetBulkEditDialog();
          }}
        >
          <DialogContent className="sm:max-w-4xl max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bulk Edit Selected Questions</DialogTitle>
              <DialogDescription>
                Apply the same category or previous-year changes to every selected question. Additional alignments stay unchanged unless they duplicate the new primary category.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-medium">
                  {selectedQuestionsForProcessing.length} question{selectedQuestionsForProcessing.length === 1 ? '' : 's'} selected for bulk edit
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedQuestionsForProcessing.slice(0, 6).map((question) => (
                    <Badge key={`bulk-selected-${question.id}`} variant="outline" className="rounded-full">
                      {getDisplayQuestionTitle(question)}
                    </Badge>
                  ))}
                  {selectedQuestionsForProcessing.length > 6 ? (
                    <Badge variant="outline" className="rounded-full">
                      +{selectedQuestionsForProcessing.length - 6} more
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-white/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Exam Type</p>
                      <p className="text-xs text-muted-foreground">Apply one exam type to all selected questions.</p>
                    </div>
                    <Switch
                      checked={bulkEditState.updateExamType}
                      onCheckedChange={(checked) => setBulkEditState((previous) => ({ ...previous, updateExamType: checked }))}
                    />
                  </div>
                  <Select
                    value={bulkEditState.examTypeId || undefined}
                    onValueChange={(value) => setBulkEditState((previous) => ({
                      ...previous,
                      examTypeId: value,
                      classId: '',
                      subjectId: '',
                      topicId: '',
                      subtopics: [],
                      subtopicInput: '',
                    }))}
                    disabled={!bulkEditState.updateExamType}
                  >
                    <SelectTrigger className={selectTriggerClassName}>
                      <SelectValue placeholder="Keep current exam type" />
                    </SelectTrigger>
                    <SelectContent>
                      {editScopedExamTypes.map((item) => (
                        <SelectItem key={`bulk-exam-${item.id}`} value={item.id}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-border/70 bg-white/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Curriculum</p>
                      <p className="text-xs text-muted-foreground">Choose the class/curriculum for all selected questions.</p>
                    </div>
                    <Switch
                      checked={bulkEditState.updateClass}
                      onCheckedChange={(checked) => setBulkEditState((previous) => ({ ...previous, updateClass: checked }))}
                    />
                  </div>
                  <Select
                    value={bulkEditState.classId || undefined}
                    onValueChange={(value) => setBulkEditState((previous) => ({
                      ...previous,
                      classId: value,
                      subjectId: '',
                      topicId: '',
                      subtopics: [],
                      subtopicInput: '',
                    }))}
                    disabled={!bulkEditState.updateClass}
                  >
                    <SelectTrigger className={selectTriggerClassName}>
                      <SelectValue placeholder="Keep current curriculum" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkEditFilteredClasses.map((item) => (
                        <SelectItem key={`bulk-class-${item.id}`} value={item.id}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-border/70 bg-white/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Subject</p>
                      <p className="text-xs text-muted-foreground">Choose one subject for all selected questions.</p>
                    </div>
                    <Switch
                      checked={bulkEditState.updateSubject}
                      onCheckedChange={(checked) => setBulkEditState((previous) => ({ ...previous, updateSubject: checked }))}
                    />
                  </div>
                  <Select
                    value={bulkEditState.subjectId || undefined}
                    onValueChange={(value) => setBulkEditState((previous) => ({
                      ...previous,
                      subjectId: value,
                      topicId: '',
                      subtopics: [],
                      subtopicInput: '',
                    }))}
                    disabled={!bulkEditState.updateSubject}
                  >
                    <SelectTrigger className={selectTriggerClassName}>
                      <SelectValue placeholder="Keep current subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkEditFilteredSubjects.map((item) => (
                        <SelectItem key={`bulk-subject-${item.id}`} value={item.id}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-border/70 bg-white/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Topic</p>
                      <p className="text-xs text-muted-foreground">Choose one topic for all selected questions.</p>
                    </div>
                    <Switch
                      checked={bulkEditState.updateTopic}
                      onCheckedChange={(checked) => setBulkEditState((previous) => ({ ...previous, updateTopic: checked }))}
                    />
                  </div>
                  <Select
                    value={bulkEditState.topicId || undefined}
                    onValueChange={(value) => setBulkEditState((previous) => ({
                      ...previous,
                      topicId: value,
                      subtopics: [],
                      subtopicInput: '',
                    }))}
                    disabled={!bulkEditState.updateTopic}
                  >
                    <SelectTrigger className={selectTriggerClassName}>
                      <SelectValue placeholder="Keep current topic" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkEditFilteredTopics.map((item) => (
                        <SelectItem key={`bulk-topic-${item.id}`} value={item.id}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-border/70 bg-white/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Previous Year Status</p>
                      <p className="text-xs text-muted-foreground">Set whether the selected questions are PYQ entries.</p>
                    </div>
                    <Switch
                      checked={bulkEditState.updatePreviousYearFlag}
                      onCheckedChange={(checked) => setBulkEditState((previous) => ({ ...previous, updatePreviousYearFlag: checked }))}
                    />
                  </div>
                  <Select
                    value={bulkEditState.isPreviousYear ? 'yes' : 'no'}
                    onValueChange={(value) => setBulkEditState((previous) => ({
                      ...previous,
                      isPreviousYear: value === 'yes',
                      updatePreviousYearValue: value === 'yes' ? true : previous.updatePreviousYearValue,
                      previousYear: value === 'no' ? '' : previous.previousYear,
                    }))}
                    disabled={!bulkEditState.updatePreviousYearFlag}
                  >
                    <SelectTrigger className={selectTriggerClassName}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-border/70 bg-white/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Previous Year Value</p>
                      <p className="text-xs text-muted-foreground">Use a 4-digit year like 2024.</p>
                    </div>
                    <Switch
                      checked={bulkEditState.updatePreviousYearValue}
                      onCheckedChange={(checked) => setBulkEditState((previous) => ({
                        ...previous,
                        updatePreviousYearValue: checked,
                        previousYear: checked ? previous.previousYear : '',
                      }))}
                      disabled={bulkEditState.updatePreviousYearFlag && !bulkEditState.isPreviousYear}
                    />
                  </div>
                  <Input
                    value={bulkEditState.previousYear}
                    onChange={(event) => setBulkEditState((previous) => ({ ...previous, previousYear: event.target.value }))}
                    placeholder="e.g. 2024"
                    disabled={!bulkEditState.updatePreviousYearValue || (bulkEditState.updatePreviousYearFlag && !bulkEditState.isPreviousYear)}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-white/[0.03] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Subtopics</p>
                    <p className="text-xs text-muted-foreground">Leave the list empty to clear subtopics on all selected questions.</p>
                  </div>
                  <Switch
                    checked={bulkEditState.updateSubtopics}
                    onCheckedChange={(checked) => setBulkEditState((previous) => ({ ...previous, updateSubtopics: checked }))}
                  />
                </div>
                <div className="flex flex-col gap-3 md:flex-row">
                  <Input
                    value={bulkEditState.subtopicInput}
                    onChange={(event) => setBulkEditState((previous) => ({ ...previous, subtopicInput: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      addBulkSubtopic();
                    }}
                    placeholder="Type subtopic path and press Enter"
                    disabled={!bulkEditState.updateSubtopics}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addBulkSubtopic}
                    disabled={!bulkEditState.updateSubtopics}
                  >
                    Add Subtopic
                  </Button>
                </div>
                {bulkSubtopicSuggestions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Suggestions</p>
                    <div className="flex flex-wrap gap-2">
                      {bulkSubtopicSuggestions.map((subtopic) => {
                        const alreadySelected = bulkEditState.subtopics.some((item) => isSameSubtopicPath(item, subtopic));
                        return (
                          <Button
                            key={`bulk-subtopic-suggestion-${subtopic}`}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            disabled={!bulkEditState.updateSubtopics || alreadySelected}
                            onClick={() => setBulkEditState((previous) => ({
                              ...previous,
                              subtopics: normalizeSubtopics([...(previous.subtopics || []), subtopic]),
                            }))}
                          >
                            {subtopic}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {bulkEditState.subtopics.length > 0 ? (
                    bulkEditState.subtopics.map((subtopic) => (
                      <Badge key={`bulk-selected-subtopic-${subtopic}`} variant="outline" className="rounded-full border-primary/40 bg-primary/10 text-primary">
                        {subtopic}
                        <button
                          type="button"
                          className="ml-2 text-xs text-primary/80 hover:text-primary"
                          onClick={() => removeBulkSubtopic(subtopic)}
                          disabled={!bulkEditState.updateSubtopics}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {bulkEditState.updateSubtopics
                        ? 'No subtopics selected. Saving will clear subtopics on the selected questions.'
                        : 'Turn on subtopic edit to replace or clear the selected questions\' subtopics.'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-border/70 bg-white/[0.04] hover:bg-white/[0.08]"
                  onClick={resetBulkEditDialog}
                >
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
                <Button
                  type="button"
                  className="rounded-xl bg-gradient-to-r from-primary via-blue-500 to-cyan-500 text-primary-foreground hover:from-primary/90 hover:via-blue-500/90 hover:to-cyan-500/90"
                  onClick={saveBulkEditedQuestions}
                  disabled={isBulkEditing || isBulkDeleting}
                >
                  {isBulkEditing ? <><Save className="mr-2 h-4 w-4" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Apply Bulk Edit</>}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!editingQuestion && !isTeacherAuthoringRestricted}
          onOpenChange={(open) => {
            if (open) return;
            closeEditDialog();
          }}
        >
          <DialogContent className="sm:max-w-6xl max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Question</DialogTitle>
              <DialogDescription>Update question content, mapping, subtopics, and alignments before saving.</DialogDescription>
            </DialogHeader>
            {editingQuestion ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm mb-2 font-medium">Question Number (Auto)</p>
                    <Input
                      value={editPrimaryQuestionTitle}
                      readOnly
                      disabled
                    />
                  </div>
                  <div>
                    <p className="text-sm mb-2 font-medium">Question Type</p>
                    <div className="rounded-md border px-3 py-2 text-sm">{editingQuestion.questionType}</div>
                  </div>
                  
                  <div>
                    <p className="text-sm mb-2 font-medium">Access Level</p>
                    <Select
                      value={editingQuestion.accessLevel || 'free'}
                      onValueChange={(value) => setEditingQuestion({ ...editingQuestion, accessLevel: value as 'free' | 'paid' })}
                    >
                      <SelectTrigger className={selectTriggerClassName}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-sm mb-2 font-medium">Mock Test Usage</p>
                    <Select
                      value={editingQuestion.mockTestOnly ? 'yes' : 'no'}
                      onValueChange={(value) => setEditingQuestion({ ...editingQuestion, mockTestOnly: value === 'yes' })}
                    >
                      <SelectTrigger className={selectTriggerClassName}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">Student Use + Official Mock Test</SelectItem>
                        <SelectItem value="yes">Teacher Official Mock Test</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-sm mb-2 font-medium">Previous Year Question</p>
                    <Select
                      value={editingQuestion.isPreviousYear ? 'yes' : 'no'}
                      onValueChange={(value) => setEditingQuestion({ ...editingQuestion, isPreviousYear: value === 'yes' })}
                    >
                      <SelectTrigger className={selectTriggerClassName}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editingQuestion.isPreviousYear ? (
                    <div>
                      <p className="text-sm mb-2 font-medium">Previous Year</p>
                      <Input
                        type="number"
                        value={editingQuestion.previousYear || ''}
                        onChange={(event) => setEditingQuestion({ ...editingQuestion, previousYear: event.target.value })}
                        placeholder="e.g., 2020"
                      />
                    </div>
                  ) : null}
                  <div>
                    <p className="text-sm mb-2 font-medium">Question for Exam Type</p>
                    <Select
                      value={editingQuestion.examTypeId || ''}
                      onValueChange={(value) => {
                        updateEditingQuestion((previous) => ({
                          ...previous,
                          examTypeId: value,
                          classId: '',
                          subjectId: '',
                          topicId: '',
                          subtopics: [],
                        }));
                        setSelectedEditSubtopicParent('');
                        setEditSubtopicInput('');
                      }}
                    >
                      <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder="Select exam type" /></SelectTrigger>
                      <SelectContent>
                        {editScopedExamTypes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-sm mb-2 font-medium">Curriculum/Class</p>
                    <Select
                      value={editingQuestion.classId || ''}
                      onValueChange={(value) => {
                        updateEditingQuestion((previous) => ({
                          ...previous,
                          classId: value,
                          subjectId: '',
                          topicId: '',
                          subtopics: [],
                        }));
                        setSelectedEditSubtopicParent('');
                        setEditSubtopicInput('');
                      }}
                      disabled={!editingQuestion.examTypeId}
                    >
                      <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>
                        {editFilteredClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-sm mb-2 font-medium">Subject</p>
                    <Select
                      value={editingQuestion.subjectId || ''}
                      onValueChange={(value) => {
                        updateEditingQuestion((previous) => ({
                          ...previous,
                          subjectId: value,
                          topicId: '',
                          subtopics: [],
                        }));
                        setSelectedEditSubtopicParent('');
                        setEditSubtopicInput('');
                      }}
                      disabled={!editingQuestion.classId}
                    >
                      <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {editFilteredSubjects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-sm mb-2 font-medium">Topic</p>
                    <Select
                      value={editingQuestion.topicId || ''}
                      onValueChange={(value) => {
                        updateEditingQuestion((previous) => ({ ...previous, topicId: value, subtopics: [] }));
                        setSelectedEditSubtopicParent('');
                        setEditSubtopicInput('');
                      }}
                      disabled={!editingQuestion.subjectId}
                    >
                      <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder="Select topic" /></SelectTrigger>
                      <SelectContent>
                        {editFilteredTopics.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border/70 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium">Subtopic Builder For {topicMap[editingQuestion.topicId] || 'Selected Topic'} (Optional)</p>
                  <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full border-primary/35 bg-primary/10 text-primary">
                        {selectedEditSubtopicParent ? `Parent: ${selectedEditSubtopicParent}` : 'Parent: Topic (Top-level)'}
                      </Badge>
                      {selectedEditSubtopicParent ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg px-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          onClick={() => {
                            setSelectedEditSubtopicParent('');
                            setEditSubtopicInput('');
                          }}
                        >
                          Switch to top-level
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                      <Input
                        className="h-11 rounded-xl border-slate-400/30 bg-white/[0.04]"
                        placeholder={selectedEditSubtopicParent ? `Type child subtopic under ${selectedEditSubtopicParent}` : 'Type top-level subtopic (e.g., Kinematics)'}
                        value={editSubtopicInput}
                        onChange={(event) => setEditSubtopicInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addEditSubtopic();
                          }
                        }}
                        disabled={!editingQuestion.topicId}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addEditSubtopic}
                        disabled={!editingQuestion.topicId}
                        className="h-11 rounded-xl border-primary/35 bg-primary/10 px-5 text-primary hover:bg-primary/20"
                      >
                        {selectedEditSubtopicParent ? 'Add Child Subtopic' : 'Add Top-level Subtopic'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Click "Add child" in the tree below to create nested levels for this question.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Visual Subtopic Tree</p>
                    {!editingQuestion.topicId ? (
                      <div className="rounded-lg border border-dashed border-border/60 bg-white/[0.02] p-3 text-sm text-muted-foreground">
                        Select a topic first to start building subtopics.
                      </div>
                    ) : editSubtopicHierarchy.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border/60 bg-white/[0.02] p-3 text-sm text-muted-foreground">
                        No subtopics yet. Start with a top-level subtopic above.
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-xl border border-border/70 bg-white/[0.02] p-3">
                        {editSubtopicHierarchy.map((node) => renderEditSubtopicHierarchyNode(node))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/12 via-slate-800/35 to-slate-900/25 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">Additional Alignments (Optional)</h3>
                      <p className="text-sm text-muted-foreground">Map this same question to additional exam/curriculum/subject/topic categories.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 rounded-xl border-primary/35 bg-primary/10 px-4 text-primary hover:bg-primary/20"
                      onClick={addEditAlignment}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Alignment
                    </Button>
                  </div>
                  {(editingQuestion.alignments || []).length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/70 bg-white/[0.03] p-3 text-sm text-muted-foreground">
                      No additional alignments yet. Click <span className="font-medium text-foreground">Add Alignment</span> to include this question in more categories.
                    </div>
                  ) : null}
                  {(editingQuestion.alignments || []).map((alignment, index) => {
                    const aExam = alignment.examTypeId || '';
                    const aClass = alignment.classId || '';
                    const aSubject = alignment.subjectId || '';
                    const aTopic = alignment.topicId || '';
                    const alignmentClassesBase = (classes || []).filter((item) => item.examTypeId === aExam);
                    const alignmentClasses = allowedClassIds.length > 0
                      ? alignmentClassesBase.filter((item) => allowedClassIds.includes(item.id))
                      : alignmentClassesBase;
                    const alignmentSubjectsBase = (subjects || []).filter((item) => item.classId === aClass);
                    const alignmentSubjects = allowedSubjectIds.length > 0
                      ? alignmentSubjectsBase.filter((item) => allowedSubjectIds.includes(item.id))
                      : alignmentSubjectsBase;
                    const alignmentTopics = (topics || []).filter((item) => item.subjectId === aSubject);
                    const alignmentSubtopics = normalizeSubtopics(alignment.subtopics);
                    const alignmentTopicSubtopicCatalog = getTopicSubtopicCatalog(aTopic);
                    const alignmentAvailableParentSubtopics = toSortedSubtopicPaths([
                      ...alignmentSubtopics,
                      ...alignmentTopicSubtopicCatalog,
                    ]);
                    const alignmentSubtopicHierarchy = buildSubtopicHierarchy(alignmentAvailableParentSubtopics);
                    const selectedAlignmentParent = editAlignmentSubtopicParentByIndex[index] || '';
                    const effectiveAlignmentParent = selectedAlignmentParent
                      && alignmentAvailableParentSubtopics.some((item) => isSameSubtopicPath(item, selectedAlignmentParent))
                        ? selectedAlignmentParent
                        : '';
                    const alignmentQuestionNumber = editQuestionNumberPlan?.alignmentQuestionNumbersByIndex[index] || 0;
                    const alignmentQuestionTitle = alignmentQuestionNumber > 0 ? buildQuestionTitle(alignmentQuestionNumber) : '';
                    return (
                      <div key={`edit-alignment-${index}`} className="space-y-4 rounded-xl border border-border/70 bg-white/[0.03] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary">
                            Alignment {index + 1}
                          </Badge>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-9 rounded-xl bg-red-500/90 px-4 text-white hover:bg-red-500"
                            onClick={() => removeEditAlignment(index)}
                          >
                            <X className="mr-2 h-4 w-4" /> Remove Alignment
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <div>
                            <p className="mb-2 text-sm font-medium">Exam Type</p>
                            <Select
                              value={alignment.examTypeId || ''}
                              onValueChange={(value) => {
                                updateEditAlignment(index, (current) => ({
                                  ...current,
                                  examTypeId: value,
                                  classId: '',
                                  subjectId: '',
                                  topicId: '',
                                  subtopics: [],
                                }));
                                resetAlignmentSubtopicBuilder(index);
                              }}
                            >
                              <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder="Select exam type" /></SelectTrigger>
                              <SelectContent>
                                {editScopedExamTypes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="mb-2 text-sm font-medium">Curriculum/Class</p>
                            <Select
                              value={alignment.classId || ''}
                              onValueChange={(value) => {
                                updateEditAlignment(index, (current) => ({
                                  ...current,
                                  classId: value,
                                  subjectId: '',
                                  topicId: '',
                                  subtopics: [],
                                }));
                                resetAlignmentSubtopicBuilder(index);
                              }}
                              disabled={!aExam}
                            >
                              <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder="Select class" /></SelectTrigger>
                              <SelectContent>
                                {alignmentClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="mb-2 text-sm font-medium">Subject</p>
                            <Select
                              value={alignment.subjectId || ''}
                              onValueChange={(value) => {
                                updateEditAlignment(index, (current) => ({
                                  ...current,
                                  subjectId: value,
                                  topicId: '',
                                  subtopics: [],
                                }));
                                resetAlignmentSubtopicBuilder(index);
                              }}
                              disabled={!aClass}
                            >
                              <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder="Select subject" /></SelectTrigger>
                              <SelectContent>
                                {alignmentSubjects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="mb-2 text-sm font-medium">Topic</p>
                            <Select
                              value={alignment.topicId || ''}
                              onValueChange={(value) => {
                                updateEditAlignment(index, (current) => ({ ...current, topicId: value, subtopics: [] }));
                                resetAlignmentSubtopicBuilder(index);
                              }}
                              disabled={!aSubject}
                            >
                              <SelectTrigger className={selectTriggerClassName}><SelectValue placeholder="Select topic" /></SelectTrigger>
                              <SelectContent>
                                {alignmentTopics.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <p className="mb-2 text-sm font-medium">Question Access</p>
                            <Select
                              value={alignment.accessLevel || 'free'}
                              onValueChange={(value) => updateEditAlignment(index, (current) => ({ ...current, accessLevel: value as 'free' | 'paid' }))}
                            >
                              <SelectTrigger className={selectTriggerClassName}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="free">Free</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="mb-2 text-sm font-medium">Mock Test Usage</p>
                            <Select
                              value={alignment.mockTestOnly ? 'yes' : 'no'}
                              onValueChange={(value) => updateEditAlignment(index, (current) => ({ ...current, mockTestOnly: value === 'yes' }))}
                            >
                              <SelectTrigger className={selectTriggerClassName}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no">Student Use + Official Mock Test</SelectItem>
                                <SelectItem value="yes">Teacher Official Mock Test</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="mb-2 text-sm font-medium">Previous Year Question</p>
                            <Select
                              value={alignment.isPreviousYear ? 'yes' : 'no'}
                              onValueChange={(value) => updateEditAlignment(index, (current) => ({ ...current, isPreviousYear: value === 'yes' }))}
                            >
                              <SelectTrigger className={selectTriggerClassName}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no">No</SelectItem>
                                <SelectItem value="yes">Yes</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="mb-2 text-sm font-medium">Previous Year</p>
                            <Input
                              type="number"
                              value={alignment.previousYear || ''}
                              onChange={(event) => updateEditAlignment(index, (current) => ({ ...current, previousYear: event.target.value }))}
                              placeholder="e.g., 2020"
                              disabled={!alignment.isPreviousYear}
                            />
                          </div>
                          <div>
                            <p className="mb-2 text-sm font-medium">Question Number (Auto)</p>
                            <Input value={alignmentQuestionTitle} readOnly disabled placeholder="Complete alignment setup first" />
                          </div>
                        </div>
                        <div className="space-y-3 rounded-xl border border-border/70 bg-white/[0.03] p-4">
                          <p className="text-sm font-medium">Subtopic Builder (Optional)</p>
                          <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="rounded-full border-primary/35 bg-primary/10 text-primary">
                                {effectiveAlignmentParent ? `Parent: ${effectiveAlignmentParent}` : 'Parent: Topic (Top-level)'}
                              </Badge>
                              {effectiveAlignmentParent ? (
                                <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => resetAlignmentSubtopicBuilder(index)}>
                                  Switch to top-level
                                </Button>
                              ) : null}
                            </div>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                              <Input
                                className="h-11 rounded-xl border-slate-400/30 bg-white/[0.04]"
                                placeholder={effectiveAlignmentParent ? `Type child subtopic under ${effectiveAlignmentParent}` : 'Type top-level subtopic (e.g., Kinematics)'}
                                value={editAlignmentSubtopicInputByIndex[index] || ''}
                                onChange={(event) => setEditAlignmentSubtopicInputByIndex((previous) => ({ ...previous, [index]: event.target.value }))}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    addEditAlignmentSubtopic(index, effectiveAlignmentParent);
                                  }
                                }}
                                disabled={!aTopic}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => addEditAlignmentSubtopic(index, effectiveAlignmentParent)}
                                disabled={!aTopic}
                                className="h-11 rounded-xl border-primary/35 bg-primary/10 px-5 text-primary hover:bg-primary/20"
                              >
                                {effectiveAlignmentParent ? 'Add Child Subtopic' : 'Add Top-level Subtopic'}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Visual Subtopic Tree</p>
                            {!aTopic ? (
                              <div className="rounded-lg border border-dashed border-border/60 bg-white/[0.02] p-3 text-sm text-muted-foreground">
                                Select an alignment topic first to start its subtopic hierarchy.
                              </div>
                            ) : alignmentSubtopicHierarchy.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-border/60 bg-white/[0.02] p-3 text-sm text-muted-foreground">
                                No subtopics yet for this alignment. Start with a top-level subtopic above.
                              </div>
                            ) : (
                              <div className="space-y-2 rounded-xl border border-border/70 bg-white/[0.02] p-3">
                                {alignmentSubtopicHierarchy.map((node) => renderEditAlignmentSubtopicHierarchyNode(index, node, alignmentSubtopics))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <p className="text-sm mb-2 font-medium">Question Text</p>
                  <Textarea
                    rows={5}
                    value={editingQuestion.questionText || ''}
                    onChange={(event) => setEditingQuestion({ ...editingQuestion, questionText: event.target.value })}
                    ref={editQuestionTextRef}
                  />
                </div>
                {!isEditingImageOnlyQuestion ? (
                  <div className="space-y-2">
                      <Button type="button" variant="outline" size="sm" className="rounded-xl border-primary/35 bg-primary/10 text-primary hover:bg-primary/20" onClick={() => setShowEditQuestionMathTool((prev) => !prev)}>
                        {showEditQuestionMathTool ? 'Hide Math Tool' : 'Use Math Tool'}
                      </Button>
                    {showEditQuestionMathTool ? (
                      <MathToolbar onInsert={insertMathIntoEditQuestionText} />
                    ) : null}
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Math Preview</p>
                      <MathText text={editingQuestion.questionText || ''} className="text-sm whitespace-pre-wrap" />
                    </div>
                  </div>
                ) : null}

                {isEditingImageOnlyQuestion ? (
                  <div className="space-y-3 rounded-md border p-3">
                    <p className="text-sm font-medium">Uploaded Question Image</p>
                    {editingQuestionImages.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {editingQuestionImages.map((url, index) => (
                          <a
                            key={`${editingQuestion.id}-edit-question-image-${index}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-md border p-1 hover:border-primary"
                          >
                            <img
                              src={url}
                              alt={`Question image ${index + 1}`}
                              loading="lazy"
                              className="h-auto max-h-72 w-full rounded object-contain bg-background"
                            />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No question image is attached.</p>
                    )}
                    <div className="rounded-md border p-3">
                      <p className="mb-2 text-sm font-medium">Replace Question Image</p>
                      <PdfQuestionExtractor
                        file={editQuestionImageFile}
                        onFileChange={setEditQuestionImageFile}
                        onImageCropped={handleEditQuestionImageCropped}
                        title="Replace Question Image"
                        description="Upload and crop to replace the current question image."
                        pageNumber={editQuestionImagePage}
                        onPageNumberChange={setEditQuestionImagePage}
                        accept="*/*"
                      />
                    </div>
                  </div>
                ) : null}
                {editingQuestion.questionType === 'MCQ' ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm mb-2 font-medium">Correct Answer Type</p>
                      <Select
                        value={editingQuestion.mcqAnswerMode || 'single'}
                        onValueChange={(value) => {
                          const mode = value as 'single' | 'multiple';
                          if (mode === 'single') {
                            const first = (editingQuestion.correctAnswers && editingQuestion.correctAnswers[0]) || editingQuestion.correctAnswer || '';
                            setEditingQuestion({ ...editingQuestion, mcqAnswerMode: mode, correctAnswer: first, correctAnswers: first ? [first] : [] });
                          } else {
                            const seed = editingQuestion.correctAnswer ? [editingQuestion.correctAnswer] : (editingQuestion.correctAnswers || []);
                            setEditingQuestion({ ...editingQuestion, mcqAnswerMode: mode, correctAnswers: Array.from(new Set(seed)) });
                          }
                        }}
                      >
                      <SelectTrigger className={selectTriggerClassName}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single Correct</SelectItem>
                          <SelectItem value="multiple">Multiple Correct</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(editingQuestion.options || []).map((option, index) => {
                      const mode = editingQuestion.mcqAnswerMode || 'single';
                      const selected = mode === 'multiple'
                        ? (editingQuestion.correctAnswers || []).includes(option)
                        : editingQuestion.correctAnswer === option;
                      return (
                        <div key={`${editingQuestion.id}-edit-option-${index}`} className="grid grid-cols-[1fr_auto] gap-2">
                          <Input
                            value={option || ''}
                            onChange={(event) => handleEditOptionChange(index, event.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + index)}`}
                          />
                          <Button
                            type="button"
                            variant={selected ? 'default' : 'outline'}
                            className={selected ? 'rounded-xl' : 'rounded-xl border-primary/35 bg-primary/10 text-primary hover:bg-primary/20'}
                            onClick={() => toggleEditCorrectOption(option)}
                            disabled={!option}
                          >
                            {selected ? 'Correct' : 'Mark Correct'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {editingQuestion.questionType === 'Numerical' ? (
                  <div>
                    <p className="text-sm mb-2 font-medium">Correct Numerical Answer</p>
                    <Input
                      type="number"
                      value={editingQuestion.numericalAnswer ?? ''}
                      onChange={(event) => setEditingQuestion({ ...editingQuestion, numericalAnswer: event.target.value === '' ? undefined : Number(event.target.value) })}
                    />
                  </div>
                ) : null}

                {editingQuestion.questionType === 'Text' ? (
                  <div>
                    <p className="text-sm mb-2 font-medium">Reference Text Answer</p>
                    <Textarea
                      rows={3}
                      value={editingQuestion.textAnswer || ''}
                      onChange={(event) => setEditingQuestion({ ...editingQuestion, textAnswer: event.target.value })}
                    />
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-border/70 bg-white/[0.04] hover:bg-white/[0.08]"
                    onClick={closeEditDialog}
                  >
                    <X className="mr-2 h-4 w-4" /> Cancel
                  </Button>
                  <Button type="button" className="rounded-xl bg-gradient-to-r from-primary via-blue-500 to-cyan-500 text-primary-foreground hover:from-primary/90 hover:via-blue-500/90 hover:to-cyan-500/90" onClick={saveEditedQuestion} disabled={isSavingEdit}>
                    {isSavingEdit ? <><Save className="mr-2 h-4 w-4" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
