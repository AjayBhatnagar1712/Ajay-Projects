

'use client';

import Link from 'next/link';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, buttonVariants } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import DashboardHeader from '@/components/dashboard-header';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, useUser, useDoc, useStorage } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, where, documentId, getDocs } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useState, useMemo, useEffect, useRef, FC, type ReactNode } from 'react';
import { LoaderCircle, ClipboardList, PlusCircle, CheckCircle, Lock, Edit2, Trash2, Rocket, X, Sparkles, ShieldCheck, UploadCloud, FolderTree, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import MathText from '@/components/math-text';
import dynamic from 'next/dynamic';
import { getTeacherAuthoringRestrictionCopy, isAllowedTeacherAuthorEmail, resolveDcamQuestionBankOwnerId } from '@/lib/teacher-authoring';
import {
  syncPracticeQuestionSummaryForCreate,
  syncPracticeQuestionSummaryForDelete,
  syncPracticeQuestionSummaryForUpdate,
} from '@/lib/practice-question-summary';

const PdfQuestionExtractor = dynamic(() => import('@/components/pdf-question-extractor'), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full" />,
});

const baseSchema = z.object({
    questionTitle: z.string().max(120, 'Question name must be at most 120 characters.').optional().default(''),
    questionText: z.string().min(10, 'Question must be at least 10 characters.'),
    solutionExplanation: z.string().optional(),
    imageUrls: z.array(z.string().url()).optional(),
    explanationImageUrls: z.array(z.string().url()).optional(),
    classId: z.string().min(1, 'Class is required.'),
    subjectId: z.string().min(1, 'Subject is required.'),
    topicId: z.string().min(1, 'Topic is required.'),
    subtopics: z.array(z.string().trim().min(1, 'Subtopic cannot be empty.').max(80, 'Subtopic is too long.')).optional().default([]),
    difficultyLevel: z.enum(['Easy', 'Medium', 'Hard']).default('Easy'),
    accessLevel: z.enum(['free', 'paid']),
    mockTestOnly: z.boolean().default(false),
    isPreviousYear: z.boolean().default(false),
    previousYear: z.string().optional(),
    examTypeId: z.string().min(1, 'Exam Type is required.'),
    alignments: z.array(z.object({
        examTypeId: z.string().min(1, 'Select exam type.'),
        classId: z.string().min(1, 'Select curriculum/class.'),
        subjectId: z.string().min(1, 'Select subject.'),
        topicId: z.string().min(1, 'Select topic.'),
        subtopics: z.array(z.string().trim().min(1, 'Subtopic cannot be empty.').max(80, 'Subtopic is too long.')).optional().default([]),
        accessLevel: z.enum(['free', 'paid']).default('free'),
        mockTestOnly: z.boolean().default(false),
        difficultyLevel: z.enum(['Easy', 'Medium', 'Hard']).default('Easy'),
        isPreviousYear: z.boolean().default(false),
        previousYear: z.string().optional(),
    })).optional(),
});

const mcqSchema = baseSchema.extend({
    questionType: z.literal('MCQ'),
    options: z.array(z.string().min(1, "Option cannot be empty.")).min(2, "Provide at least 2 options.").max(8, "Maximum 8 options are supported."),
    mcqAnswerMode: z.enum(['single', 'multiple']).default('single'),
    correctAnswer: z.string().optional(),
    correctAnswers: z.array(z.string()).optional(),
});

const numericalSchema = baseSchema.extend({
    questionType: z.literal('Numerical'),
    numericalAnswer: z.coerce.number({ required_error: 'A numerical answer is required.' }),
    numericalAnswerText: z.string().optional(),
});

const textSchema = baseSchema.extend({
    questionType: z.literal('Text'),
    textAnswer: z.string().min(1, 'A reference text answer is required.'),
});

const questionSchema = z.discriminatedUnion("questionType", [
    mcqSchema,
    numericalSchema,
    textSchema
]).superRefine((data, ctx) => {
    const yearPattern = /^(19|20)\d{2}$/;
    if (data.isPreviousYear) {
        const year = (data.previousYear || '').trim();
        if (!yearPattern.test(year)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Enter a valid year (e.g., 2020).",
                path: ['previousYear'],
            });
        }
    }
    (data.alignments || []).forEach((alignment, index) => {
        if (!alignment.isPreviousYear) return;
        const year = (alignment.previousYear || '').trim();
        if (!yearPattern.test(year)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Enter a valid year (e.g., 2020).",
                path: ['alignments', index, 'previousYear'],
            });
        }
    });

    if (data.questionType === 'MCQ') {
        const mode = data.mcqAnswerMode || 'single';
        if (mode === 'single') {
            if (!data.correctAnswer) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Please select one correct answer.",
                    path: ['correctAnswer'],
                });
            } else if (data.options && !data.options.includes(data.correctAnswer)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Correct answer must match one of the options.",
                    path: ['correctAnswer'],
                });
            }
        } else {
            const selected = Array.from(new Set(data.correctAnswers || []));
            if (selected.length < 2) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Select at least 2 correct options for multiple-correct MCQ.",
                    path: ['correctAnswers'],
                });
            }
            if (data.options && selected.some((option) => !data.options?.includes(option))) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Selected correct options must match the options list.",
                    path: ['correctAnswers'],
                });
            }
        }
    }
});

const QUESTION_FORM_DEFAULT_VALUES: z.infer<typeof questionSchema> = {
  questionType: 'MCQ',
  questionTitle: '',
  questionText: '',
  solutionExplanation: '',
  options: ['', '', '', ''],
  mcqAnswerMode: 'single',
  correctAnswer: '',
  correctAnswers: [],
  classId: '',
  subjectId: '',
  topicId: '',
  subtopics: [],
  difficultyLevel: 'Easy' as const,
  accessLevel: 'free',
  mockTestOnly: false,
  isPreviousYear: false,
  previousYear: '',
  examTypeId: '',
  alignments: [],
  imageUrls: [],
  explanationImageUrls: [],
};

const IMAGE_ONLY_QUESTION_TEXT = 'Question attached as image';

const buildNextQuestionFormValues = (values: z.infer<typeof questionSchema>) => {
  const shared = {
    ...values,
    questionTitle: '',
    questionText: '',
    solutionExplanation: '',
    imageUrls: [],
    explanationImageUrls: [],
  };

  if (values.questionType === 'MCQ') {
    const optionCount = Math.max(2, Math.min(8, values.options?.length || 4));
    const isImageOnlyQuestion = String(values.questionText || '').trim().toLowerCase() === IMAGE_ONLY_QUESTION_TEXT.toLowerCase();
    return {
      ...shared,
      options: Array.from({ length: optionCount }, (_, index) => (
        isImageOnlyQuestion ? values.options?.[index] || '' : ''
      )),
      correctAnswer: '',
      correctAnswers: [],
    };
  }

  if (values.questionType === 'Numerical') {
    return {
      ...shared,
      numericalAnswer: undefined as any,
      numericalAnswerText: '',
    };
  }

  return {
    ...shared,
    textAnswer: '',
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

const isSupportedPracticeQuestionImageUrl = (value: string): boolean => /^(https?:\/\/|data:image\/|blob:)/i.test(value);
const isPersistedPracticeQuestionImageUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const normalizePracticeQuestionImageUrls = (multiValue: unknown, singleValue?: unknown): string[] => {
  const fromMulti = Array.isArray(multiValue) ? multiValue : (multiValue ? [multiValue] : []);
  const values = [...fromMulti, ...(singleValue ? [singleValue] : [])]
    .map((item) => String(item || '').trim())
    .filter((item) => item && isSupportedPracticeQuestionImageUrl(item));
  return Array.from(new Set(values));
};

const getPersistedPracticeQuestionImageUrls = (multiValue: unknown, singleValue?: unknown): string[] => (
  normalizePracticeQuestionImageUrls(multiValue, singleValue)
    .filter(isPersistedPracticeQuestionImageUrl)
);

const persistPracticeQuestionImageUrls = async (
  storage: ReturnType<typeof useStorage>,
  teacherId: string,
  kind: 'question' | 'solution',
  multiValue: unknown,
  singleValue?: unknown
): Promise<string[]> => {
  const normalized = normalizePracticeQuestionImageUrls(multiValue, singleValue);
  if (normalized.length === 0) return [];

  const uploaded = await Promise.all(
    normalized.map(async (item) => {
      if (isPersistedPracticeQuestionImageUrl(item)) return item;
      if (!teacherId) {
        throw new Error('Teacher account missing for image upload.');
      }
      return uploadPracticeQuestionImage(storage, teacherId, kind, item);
    })
  );

  return Array.from(new Set(uploaded.map((item) => item.trim()).filter(Boolean)));
};

const practiceQuizSchema = z.object({
    topicsConfig: z.array(z.object({
        topicId: z.string(),
        topicName: z.string(),
        count: z.coerce.number().min(1, "Must be > 0"),
    })).min(1, 'Please select at least one topic.'),
    difficultyLevel: z.string().optional(),
    accessLevel: z.enum(['free', 'paid']),
    timeLimitPerQuestion: z.coerce.number().int().positive({ message: "Time limit must be a positive number." }).optional().or(z.literal('')),
});

const TopicPracticeFormSchema = z.object({
    timeLimit: z.coerce.number().int().positive().optional().or(z.literal('')),
});

type PracticeQuestion = {
  id: string;
  questionTitle?: string;
  questionNumber?: number;
  questionText: string;
  solutionExplanation?: string;
  difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  examLevel?: 'weak' | 'medium' | 'strong';
  examTypeId: string,
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
    difficultyLevel: 'Easy' | 'Medium' | 'Hard';
    isPreviousYear?: boolean;
    previousYear?: string;
  }>;
  imageUrl?: string;
  imageUrls?: string[];
  explanationImageUrl?: string;
  explanationImageUrls?: string[];
  questionType: 'MCQ' | 'Numerical' | 'Text';
  options?: string[];
  mcqAnswerMode?: 'single' | 'multiple';
  correctAnswer?: string;
  correctAnswers?: string[];
  numericalAnswer?: number;
  numericalAnswerText?: string;
  textAnswer?: string;
  accessLevel: 'free' | 'paid';
  mockTestOnly?: boolean;
  isPreviousYear?: boolean;
  previousYear?: string;
  tags?: string[];
  teacherId?: string;
  categoryKeys?: string[];
  questionFingerprint?: string;
};
type Class = { id: string; name: string; examTypeId: string; };
type Subject = { id: string; name: string; classId: string; };
type Topic = {
  id: string;
  name: string;
  subjectId: string;
  subtopics?: string[];
  subtopicPaths?: string[];
  subtopicCatalog?: string[];
};
type ExamType = { id: string; name: string; };
type TeachingAssignment = { classId: string; subjectIds?: string[]; allSubjects?: boolean };
type UserProfile = {
  teachingAssignments?: TeachingAssignment[];
  teachesClassIds?: string[];
  teachesSubjectIds?: string[];
};
type ExtractedQuestionDraft = {
  rawText: string;
  questionText: string;
  options: string[];
  correctAnswer?: string;
  correctAnswers?: string[];
  numericalAnswer?: number;
  textAnswer?: string;
};

const PRACTICE_QUESTION_CATALOG_CACHE = new Map<string, PracticeQuestion[]>();

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

function MathTextPreview({ text }: { text: string }) {
  const source = (text || '').trim();
  if (!source) return null;

  return (
    <div className="math-preview rounded-md border bg-background p-3 text-sm font-normal">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Math Preview</p>
      <div className="whitespace-pre-wrap break-words">
        <MathText text={source} />
      </div>
    </div>
  );
}

function normalizeForFingerprint(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

function hashFingerprintValue(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildImageCollectionFingerprint(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return '';
  const normalized = value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (normalized.length === 0) return '';
  return normalized.map((item) => hashFingerprintValue(item)).join('|');
}

const QUESTION_NUMBER_REGEX = /(?:^|\b)question\s*#?\s*(\d+)\b/i;

function getQuestionNumber(question: { questionNumber?: number; questionTitle?: string }): number {
  const direct = Number(question.questionNumber ?? 0);
  if (Number.isFinite(direct) && direct > 0) {
    return Math.floor(direct);
  }
  const title = String(question.questionTitle || '').trim();
  if (!title) return 0;
  const match = title.match(QUESTION_NUMBER_REGEX) || title.match(/\b(\d+)\b/);
  const parsed = Number(match?.[1] || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function buildQuestionTitle(questionNumber: number): string {
  return `Question ${Math.max(1, Math.floor(questionNumber || 1))}`;
}

function getDisplayQuestionTitle(question: { questionNumber?: number; questionTitle?: string }): string {
  const resolved = getQuestionNumber(question);
  if (resolved > 0) return buildQuestionTitle(resolved);
  const fallback = String(question.questionTitle || '').trim();
  return fallback || 'Untitled Question';
}

function getPrimarySubtopicForCategory(subtopics?: string[]): string {
  const normalized = normalizeSubtopics(subtopics);
  if (normalized.length === 0) return '';
  return [...normalized].sort((left, right) => {
    const depthDiff = splitSubtopicPath(right).length - splitSubtopicPath(left).length;
    if (depthDiff !== 0) return depthDiff;
    return left.localeCompare(right);
  })[0];
}

function getQuestionCategoryKey(
  examTypeId?: string,
  classId?: string,
  subjectId?: string,
  topicId?: string,
  subtopics?: string[]
): string {
  const exam = String(examTypeId || '').trim();
  const klass = String(classId || '').trim();
  const subject = String(subjectId || '').trim();
  const topic = String(topicId || '').trim();
  if (!exam || !klass || !subject || !topic) return '';
  const primarySubtopic = getPrimarySubtopicForCategory(subtopics) || '__no_subtopic__';
  return `${exam}::${klass}::${subject}::${topic}::${primarySubtopic}`;
}

function getNextQuestionNumberForCategory(
  questions: PracticeQuestion[],
  examTypeId?: string,
  classId?: string,
  subjectId?: string,
  topicId?: string,
  subtopics?: string[]
): number {
  const categoryKey = getQuestionCategoryKey(examTypeId, classId, subjectId, topicId, subtopics);
  if (!categoryKey) return 1;
  let maxNumber = 0;
  questions.forEach((question) => {
    getQuestionCategoryNumberPairs(question).forEach((entry) => {
      if (entry.categoryKey !== categoryKey) return;
      maxNumber = Math.max(maxNumber, entry.questionNumber);
    });
  });
  return maxNumber + 1;
}

type CategorySelectionInput = {
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  topicId?: string;
  subtopics?: string[];
  questionNumber?: number;
  questionTitle?: string;
};

function getQuestionCategoryNumberPairs(question: PracticeQuestion): Array<{ categoryKey: string; questionNumber: number }> {
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
}

function buildCategoryQuestionNumberCounter(questions: PracticeQuestion[]): Map<string, number> {
  const counter = new Map<string, number>();
  questions.forEach((question) => {
    getQuestionCategoryNumberPairs(question).forEach(({ categoryKey, questionNumber }) => {
      if (!categoryKey || questionNumber <= 0) return;
      counter.set(categoryKey, Math.max(counter.get(categoryKey) || 0, questionNumber));
    });
  });
  return counter;
}

function computeQuestionNumberPlan(
  questions: PracticeQuestion[],
  primarySelection: CategorySelectionInput,
  alignments: CategorySelectionInput[]
): {
  primaryCategoryKey: string;
  primaryQuestionNumber: number;
  alignmentQuestionNumbersByIndex: Record<number, number>;
} {
  const counter = buildCategoryQuestionNumberCounter(questions);
  const reservedByCategoryKey = new Map<string, number>();
  const reserveNumber = (categoryKey: string): number => {
    if (!categoryKey) return 0;
    if (reservedByCategoryKey.has(categoryKey)) {
      return reservedByCategoryKey.get(categoryKey)!;
    }
    const nextNumber = (counter.get(categoryKey) || 0) + 1;
    counter.set(categoryKey, nextNumber);
    reservedByCategoryKey.set(categoryKey, nextNumber);
    return nextNumber;
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
}

function getCategoryKeysForSelection(
  primarySelection: CategorySelectionInput,
  alignments: CategorySelectionInput[] = []
): string[] {
  const keys = [
    getQuestionCategoryKey(
      primarySelection.examTypeId,
      primarySelection.classId,
      primarySelection.subjectId,
      primarySelection.topicId,
      primarySelection.subtopics
    ),
    ...alignments.map((alignment) => getQuestionCategoryKey(
      alignment.examTypeId,
      alignment.classId,
      alignment.subjectId,
      alignment.topicId,
      alignment.subtopics
    )),
  ].filter(Boolean);

  return Array.from(new Set(keys));
}

function getTopicIdsForSelection(
  primarySelection: CategorySelectionInput,
  alignments: CategorySelectionInput[] = []
): string[] {
  const topicIds = [
    primarySelection.topicId,
    ...alignments.map((alignment) => alignment.topicId),
  ]
    .map((topicId) => String(topicId || '').trim())
    .filter(Boolean);

  return Array.from(new Set(topicIds));
}

function chunkFirestoreInValues<T>(values: T[], chunkSize = 30): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

function splitSubtopicPath(value: string): string[] {
  const trimmed = String(value || '').trim();
  if (!trimmed) return [];
  const delimiters = [/\s*>\s*/, /\s*->\s*/, /\s*\u2192\s*/, /\s*::\s*/, /\s*\/\s*/, /\s*\|\s*/];
  for (const delimiter of delimiters) {
    const pieces = trimmed.split(delimiter).map((item) => item.trim()).filter(Boolean);
    if (pieces.length > 1) return pieces;
  }
  return [trimmed];
}

function normalizeSubtopicPath(value?: string): string {
  const normalized = splitSubtopicPath(String(value || ''));
  return normalized.join(' > ');
}

function joinSubtopicPath(parentPath: string, childLabel: string): string {
  const parentSegments = splitSubtopicPath(parentPath);
  const childSegments = splitSubtopicPath(childLabel);
  return [...parentSegments, ...childSegments].join(' > ');
}

function isSameSubtopicPath(left?: string, right?: string): boolean {
  return normalizeForFingerprint(normalizeSubtopicPath(left)) === normalizeForFingerprint(normalizeSubtopicPath(right));
}

function isSubtopicPathWithinBranch(candidate?: string, branch?: string): boolean {
  const candidateSegments = splitSubtopicPath(String(candidate || '')).map((item) => normalizeForFingerprint(item)).filter(Boolean);
  const branchSegments = splitSubtopicPath(String(branch || '')).map((item) => normalizeForFingerprint(item)).filter(Boolean);
  if (branchSegments.length === 0) return false;
  if (candidateSegments.length < branchSegments.length) return false;
  return branchSegments.every((segment, index) => candidateSegments[index] === segment);
}

function stripSubtopicBranch(values: string[] | undefined, branch: string): string[] {
  return normalizeSubtopics(values).filter((item) => !isSubtopicPathWithinBranch(item, branch));
}

function normalizeSubtopics(values?: string[]): string[] {
  const byKey = new Map<string, string>();
  (values || []).forEach((item) => {
    const normalized = normalizeSubtopicPath(item);
    const key = normalizeForFingerprint(normalized);
    if (!normalized || byKey.has(key)) return;
    byKey.set(key, normalized);
  });
  return Array.from(byKey.values());
}

type SubtopicHierarchyNode = {
  path: string;
  label: string;
  depth: number;
  explicit: boolean;
  children: SubtopicHierarchyNode[];
};

function buildSubtopicHierarchy(paths?: string[]): SubtopicHierarchyNode[] {
  const normalizedPaths = normalizeSubtopics(paths);
  const explicitKeys = new Set(normalizedPaths.map((item) => normalizeForFingerprint(item)));
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
        const nodeKey = normalizeForFingerprint(nodePath);
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
            const parentNode = nodeMap.get(normalizeForFingerprint(parentPath));
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
}

function buildQuestionFingerprint(question: {
  teacherId?: string;
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  topicId?: string;
  questionType?: string;
  questionText?: string;
  options?: string[];
  mcqAnswerMode?: 'single' | 'multiple';
  correctAnswer?: string;
  correctAnswers?: string[];
  numericalAnswer?: number;
  numericalAnswerText?: string;
  textAnswer?: string;
  isPreviousYear?: boolean;
  previousYear?: string;
  imageUrls?: string[];
  imageUrl?: string;
}): string {
  const normalizedQuestionText = normalizeForFingerprint(question.questionText);
  const isImageOnlyQuestion = normalizedQuestionText === normalizeForFingerprint('Question attached as image');
  const imageFingerprint = isImageOnlyQuestion
    ? buildImageCollectionFingerprint(
        Array.isArray(question.imageUrls) && question.imageUrls.length > 0
          ? question.imageUrls
          : (question.imageUrl ? [question.imageUrl] : [])
      )
    : '';
  return [
    normalizeForFingerprint(question.teacherId),
    normalizeForFingerprint(question.examTypeId),
    normalizeForFingerprint(question.classId),
    normalizeForFingerprint(question.subjectId),
    normalizeForFingerprint(question.topicId),
    normalizeForFingerprint(question.questionType),
    normalizedQuestionText,
    imageFingerprint,
    normalizeForFingerprint((question.options || []).join('|')),
    normalizeForFingerprint(question.mcqAnswerMode || 'single'),
    normalizeForFingerprint(question.correctAnswer),
    normalizeForFingerprint((question.correctAnswers || []).join('|')),
    normalizeForFingerprint(question.numericalAnswer),
    normalizeForFingerprint(question.numericalAnswerText),
    normalizeForFingerprint(question.textAnswer),
    normalizeForFingerprint(question.isPreviousYear ? 'yes' : 'no'),
    normalizeForFingerprint(question.previousYear),
  ].join('::');
}

function parseOptionKey(value: string, maxOptions: number): string | null {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  const maxIndex = Math.max(2, Math.min(8, maxOptions));
  const letters = Array.from({ length: maxIndex }, (_, index) => String.fromCharCode(65 + index));
  const numbers = Array.from({ length: maxIndex }, (_, index) => String(index + 1));
  if (letters.includes(normalized)) return normalized;
  if (numbers.includes(normalized)) return String.fromCharCode(64 + Number(normalized));
  return null;
}

function buildExtractedDraft(rawText: string, questionType: 'MCQ' | 'Numerical' | 'Text', mcqOptionCount: number = 4): ExtractedQuestionDraft {
  const normalized = (rawText || '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n+/g, '\n').trim();
  const draft: ExtractedQuestionDraft = {
    rawText: normalized,
    questionText: '',
    options: [],
  };

  if (!normalized) return draft;

  if (questionType === 'MCQ') {
    const optionCount = Math.max(2, Math.min(8, mcqOptionCount || 4));
    const collapsed = normalized.replace(/\n/g, ' ');
    const markerRegex = /(?:^|\s)([A-Ha-h1-8])[\).:\-]\s*/g;
    const matches: Array<{ start: number; end: number }> = [];
    let markerMatch: RegExpExecArray | null;
    while ((markerMatch = markerRegex.exec(collapsed)) !== null) {
      matches.push({ start: markerMatch.index, end: markerRegex.lastIndex });
    }

    const answerMatch = collapsed.match(/(?:^|\b)(?:ans|answer|correct answer)\s*[:\-]\s*([^\n]+)/i);
    const answerChunk = answerMatch?.[1]?.trim();

    if (matches.length >= 2) {
      draft.questionText = collapsed.slice(0, matches[0].start).trim();
      draft.options = matches.slice(0, optionCount).map((match, index) => {
        const nextStart = index < matches.length - 1 ? matches[index + 1].start : collapsed.length;
        return collapsed.slice(match.end, nextStart).replace(/(?:^|\s)(?:ans|answer|correct answer)\s*[:\-].*$/i, '').trim();
      }).filter(Boolean).slice(0, optionCount);
    } else {
      const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
      draft.questionText = lines[0] || '';
      draft.options = lines.slice(1, optionCount + 1);
    }

    if (answerChunk) {
      const key = parseOptionKey(answerChunk.split(/\s+/)[0] || '', optionCount);
      if (key) {
        const index = key.charCodeAt(0) - 65;
        if (index >= 0 && index < draft.options.length) {
          draft.correctAnswer = draft.options[index];
          draft.correctAnswers = [draft.options[index]];
        }
      } else {
        const exact = draft.options.find((option) => option.toLowerCase() === answerChunk.toLowerCase());
        if (exact) {
          draft.correctAnswer = exact;
          draft.correctAnswers = [exact];
        }
      }
    }

    if (!draft.questionText) draft.questionText = collapsed;
    return draft;
  }

  if (questionType === 'Numerical') {
    const collapsed = normalized.replace(/\n/g, ' ');
    const answerMatch = collapsed.match(/(?:^|\b)(?:ans|answer|correct answer)\s*[:\-]?\s*([-+]?\d+(?:\.\d+)?)/i);
    draft.questionText = collapsed.replace(/(?:^|\b)(?:ans|answer|correct answer)\s*[:\-]?.*$/i, '').trim() || collapsed;
    if (answerMatch?.[1]) draft.numericalAnswer = Number(answerMatch[1]);
    return draft;
  }

  const collapsed = normalized.replace(/\n/g, ' ');
  const textMatch = collapsed.match(/(?:^|\b)(?:ans|answer|reference answer)\s*[:\-]\s*(.*)$/i);
  draft.questionText = collapsed.replace(/(?:^|\b)(?:ans|answer|reference answer)\s*[:\-]\s*.*$/i, '').trim() || collapsed;
  draft.textAnswer = textMatch?.[1]?.trim();
  return draft;
}

function extractMcqOptionsOnly(rawText: string, optionCount: number): { options: string[]; correctAnswer?: string; correctAnswers?: string[] } {
  const normalized = (rawText || '').replace(/\r/g, '\n').trim();
  if (!normalized) return { options: [] };

  const collapsed = normalized.replace(/\n+/g, ' ').replace(/[ \t]+/g, ' ');
  const markerRegex = /(?:^|\s)([A-Ha-h1-8])[\).:\-]\s*/g;
  const matches: Array<{ start: number; end: number }> = [];
  let markerMatch: RegExpExecArray | null;
  while ((markerMatch = markerRegex.exec(collapsed)) !== null) {
    matches.push({ start: markerMatch.index, end: markerRegex.lastIndex });
  }

  let options: string[] = [];
  if (matches.length >= 2) {
    options = matches.slice(0, optionCount).map((match, index) => {
      const nextStart = index < matches.length - 1 ? matches[index + 1].start : collapsed.length;
      return collapsed.slice(match.end, nextStart).replace(/(?:^|\s)(?:ans|answer|correct answer)\s*[:\-].*$/i, '').trim();
    }).filter(Boolean).slice(0, optionCount);
  } else {
    options = normalized.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, optionCount);
  }

  const answerMatch = collapsed.match(/(?:^|\b)(?:ans|answer|correct answer)\s*[:\-]\s*([^\n]+)/i);
  let correctAnswer: string | undefined;
  if (answerMatch?.[1]) {
    const answerChunk = answerMatch[1].trim();
    const key = parseOptionKey(answerChunk.split(/\s+/)[0] || '', optionCount);
    if (key) {
      const idx = key.charCodeAt(0) - 65;
      if (idx >= 0 && idx < options.length) correctAnswer = options[idx];
    } else {
      const exact = options.find((opt) => opt.toLowerCase() === answerChunk.toLowerCase());
      if (exact) correctAnswer = exact;
    }
  }

  return { options, correctAnswer, correctAnswers: correctAnswer ? [correctAnswer] : [] };
}


function QuestionItem({ question, topicMap, classMap, examTypeMap, canManage, isUnlocked, onEdit, onDelete }: { question: PracticeQuestion; topicMap: Record<string, string>; classMap: Record<string, string>; examTypeMap: Record<string, string>; canManage: boolean; isUnlocked: boolean; onEdit: (question: PracticeQuestion) => void, onDelete: (questionId: string) => void }) {

  const isLocked = !isUnlocked;
  const selectedCorrectOptions = new Set(
    (question.correctAnswers && question.correctAnswers.length > 0)
      ? question.correctAnswers
      : (question.correctAnswer ? [question.correctAnswer] : [])
  );

  return (
    <AccordionItem value={question.id}>
      <div className="flex items-center">
        <AccordionTrigger className="flex-1" disabled={isLocked}>
          <div className="flex-1 text-left">
            <p className="font-semibold">{getDisplayQuestionTitle(question)}</p>
            <p className="text-sm text-muted-foreground line-clamp-2">{question.questionText}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline">{classMap[question.classId] || 'Unknown Class'}</Badge>
              <Badge variant="outline">{examTypeMap[question.examTypeId] || 'Unknown Exam'}</Badge>
              <Badge variant="outline">{topicMap[question.topicId] || 'Unknown Topic'}</Badge>
              
              <Badge variant="secondary">{question.questionType}</Badge>
              {question.accessLevel === 'free' ? <Badge variant="secondary">Free</Badge> : <Badge variant="destructive">Paid</Badge>}
              {question.mockTestOnly ? <Badge variant="outline">Mock Test Only</Badge> : null}
              {question.isPreviousYear ? <Badge variant="outline">PYQ {question.previousYear || ''}</Badge> : null}
              {(question.subtopics || []).map((subtopic) => (
                <Badge key={`${question.id}-subtopic-${subtopic}`} variant="outline" className="border-primary/40 text-primary">
                  {subtopic}
                </Badge>
              ))}
              {question.tags?.map(tag => (
                <Badge key={tag} variant="outline" className='border-amber-500 text-amber-500'>{tag}</Badge>
              ))}
            </div>
          </div>
        </AccordionTrigger>
        {isLocked && <Lock className="h-4 w-4 mr-4 text-muted-foreground" />}
        {canManage && (
          <div className="flex items-center gap-1 pr-2">
            <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit(question); }}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(question.id); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>
      <AccordionContent>
        {isLocked ? (
            <div className="text-center text-muted-foreground py-4">
                <Lock className="mx-auto h-6 w-6 mb-2"/>
                <p>This is a premium question. <Link href="/subscription" className="text-primary hover:underline">Subscribe</Link> to view the answer.</p>
            </div>
        ) : (
          <>
            {canManage ? (
              <>
                {question.imageUrls && question.imageUrls.length > 0 && (
                  <div className="my-4 space-y-2">
                      <p className="font-semibold text-sm text-muted-foreground">Question Image(s):</p>
                      <div className="flex flex-col gap-2">
                          {question.imageUrls.map((url, index) => (
                              <div key={index} className="p-2 border rounded-md flex justify-center bg-muted/50">
                                  <img
                                      src={url}
                                      alt={`Question image ${index + 1}`}
                                      loading="lazy"
                                      className="h-auto max-h-[750px] w-full rounded-md object-contain"
                                  />
                              </div>
                          ))}
                      </div>
                  </div>
                )}
                {question.explanationImageUrls && question.explanationImageUrls.length > 0 && (
                  <div className="my-4 space-y-2">
                    <p className="font-semibold text-sm text-muted-foreground">Explanation Image(s):</p>
                    <div className="flex flex-col gap-2">
                      {question.explanationImageUrls.map((url, index) => (
                          <div key={index} className="p-2 border rounded-md flex justify-center bg-muted/50">
                            <img
                              src={url}
                              alt={`Explanation image ${index + 1}`}
                              loading="lazy"
                              className="h-auto max-h-[750px] w-full rounded-md object-contain"
                            />
                          </div>
                      ))}
                    </div>
                  </div>
                )}
                {question.solutionExplanation ? (
                  <div className="my-4 space-y-2">
                    <p className="font-semibold text-sm text-muted-foreground">Solution Explanation:</p>
                    <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                      {question.solutionExplanation}
                    </div>
                  </div>
                ) : null}
                {question.questionType === 'MCQ' && question.options ? (
                  <div className="prose prose-sm max-w-none text-card-foreground/90 bg-primary/5 p-4 rounded-md space-y-2">
                    <p className="font-semibold text-primary">Options:</p>
                    <ul className='list-disc pl-5 space-y-1'>
                      {question.options.map((option, index) => (
                        <li key={index} className={cn(selectedCorrectOptions.has(option) && "font-bold text-primary")}>
                          {option}
                          {selectedCorrectOptions.has(option) && <CheckCircle className="inline-block ml-2 h-4 w-4" />}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : question.questionType === 'Numerical' ? (
                  <div className="prose prose-sm max-w-none text-card-foreground/90 bg-primary/5 p-4 rounded-md space-y-2">
                    <p className="font-semibold text-primary">Correct Answer:</p>
                    <MathText text={question.numericalAnswerText || question.numericalAnswer} className="font-bold text-2xl" />
                  </div>
                ) : question.questionType === 'Text' ? (
                  <div className="prose prose-sm max-w-none text-card-foreground/90 bg-primary/5 p-4 rounded-md space-y-2">
                    <p className="font-semibold text-primary">Reference Text Answer:</p>
                    <MathText text={question.textAnswer} className="font-medium whitespace-pre-wrap" />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                <p>To see the answer, start a practice session for this topic.</p>
              </div>
            )}
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

const EditQuestionForm: FC<{
  questionToEdit: PracticeQuestion,
  classes: Class[],
  subjects: Subject[],
  topics: Topic[],
  examTypes: ExamType[],
  currentUserId?: string,
  questionBankOwnerId?: string,
  allowedClassIds?: string[],
  allowedSubjectIds?: string[],
  onFinished: () => void,
}> = ({ questionToEdit, classes, subjects, topics, examTypes, currentUserId, questionBankOwnerId, allowedClassIds = [], allowedSubjectIds = [], onFinished }) => {
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCreatingTopic, setIsCreatingTopic] = useState(false);
    const editQuestionTextRef = useRef<HTMLTextAreaElement | null>(null);
    const editOptionInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const editNumericalAnswerRef = useRef<HTMLInputElement | null>(null);
    const editTextAnswerRef = useRef<HTMLTextAreaElement | null>(null);
    const [openOptionMathToolByIndex, setOpenOptionMathToolByIndex] = useState<Record<number, boolean>>({});
    const [showNumericalAnswerMathTool, setShowNumericalAnswerMathTool] = useState(false);
    const [showTextAnswerMathTool, setShowTextAnswerMathTool] = useState(false);
    const [alignmentSubtopicInputByIndex, setAlignmentSubtopicInputByIndex] = useState<Record<number, string>>({});

    const form = useForm<z.infer<typeof questionSchema>>({
        resolver: zodResolver(questionSchema),
    });

  useEffect(() => {
      if (!questionToEdit || !subjects || !classes) return;
      const initialTopic = topics?.find(t => t.id === questionToEdit.topicId);
      const initialSubject =
        subjects.find(s => s.id === questionToEdit.subjectId)
        || subjects.find(s => s.id === initialTopic?.subjectId);
      const initialClass =
        classes.find(c => c.id === questionToEdit.classId)
        || classes.find(c => c.id === initialSubject?.classId);
      const initialExamTypeId = questionToEdit.examTypeId || initialClass?.examTypeId || '';
      const normalizedAlignments = (questionToEdit.alignments || []).map((a) => ({
        ...a,
        topicId: a.topicId || questionToEdit.topicId || '',
        subtopics: normalizeSubtopics(a.subtopics),
        accessLevel: a.accessLevel || questionToEdit.accessLevel || 'free',
        mockTestOnly: !!a.mockTestOnly,
        difficultyLevel: 'Easy' as const,
        isPreviousYear: !!a.isPreviousYear,
        previousYear: a.previousYear || '',
      }));
      form.reset({
        ...questionToEdit,
        questionTitle: getDisplayQuestionTitle(questionToEdit),
        subtopics: normalizeSubtopics(questionToEdit.subtopics),
        numericalAnswerText:
          questionToEdit.numericalAnswerText
          || (questionToEdit.numericalAnswer !== undefined && questionToEdit.numericalAnswer !== null
            ? String(questionToEdit.numericalAnswer)
            : ''),
        accessLevel: questionToEdit.accessLevel || 'free',
        mockTestOnly: !!questionToEdit.mockTestOnly,
        isPreviousYear: !!questionToEdit.isPreviousYear,
        previousYear: questionToEdit.previousYear || '',
        mcqAnswerMode: (questionToEdit as any).mcqAnswerMode || ((questionToEdit as any).correctAnswers?.length ? 'multiple' : 'single'),
        correctAnswers: (questionToEdit as any).correctAnswers || ((questionToEdit as any).correctAnswer ? [(questionToEdit as any).correctAnswer] : []),
        alignments: normalizedAlignments,
        examTypeId: initialExamTypeId,
        classId: questionToEdit.classId || initialClass?.id || '',
        subjectId: questionToEdit.subjectId || initialSubject?.id || '',
        topicId: questionToEdit.topicId || ''
      } as any);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questionToEdit]);

    const { fields: optionFields } = useFieldArray({ control: form.control as any, name: "options" as never });
    const { fields: alignmentFields, append: appendAlignment, remove: removeAlignment } = useFieldArray({ control: form.control as any, name: "alignments" as never });
    
    const { watch, setValue } = form;
    const questionType = watch('questionType');
    const mcqAnswerMode = (watch('mcqAnswerMode') || 'single') as 'single' | 'multiple';
    const selectedCorrectAnswer = watch('correctAnswer');
    const selectedCorrectAnswers = (watch('correctAnswers') || []) as string[];
    const selectedExamType = watch('examTypeId');
    const selectedClass = watch('classId');
    const selectedSubject = watch('subjectId');
    const selectedTopic = watch('topicId');
    const selectedIsPreviousYear = watch('isPreviousYear');
    const selectedSubtopics = (watch('subtopics') || []) as string[];
    const [subtopicInput, setSubtopicInput] = useState('');
    const isClassificationReady = !!selectedExamType && !!selectedClass && !!selectedSubject && !!selectedTopic;

    const addSubtopic = () => {
      const next = subtopicInput.trim();
      if (!next) return;
      if (selectedSubtopics.some((item) => item.toLowerCase() === next.toLowerCase())) {
        setSubtopicInput('');
        return;
      }
      setValue('subtopics', [...selectedSubtopics, next], { shouldDirty: true, shouldValidate: true });
      setSubtopicInput('');
    };

    const removeSubtopic = (target: string) => {
      setValue(
        'subtopics',
        selectedSubtopics.filter((item) => item !== target),
        { shouldDirty: true, shouldValidate: true }
      );
    };

    const addAlignmentSubtopic = (index: number) => {
        const next = normalizeSubtopicPath((alignmentSubtopicInputByIndex[index] || '').trim());
        if (!next) return;
        const current = normalizeSubtopics((form.getValues(`alignments.${index}.subtopics` as const) || []) as string[]);
        if (current.some((item) => isSameSubtopicPath(item, next))) {
            setAlignmentSubtopicInputByIndex((prev) => ({ ...prev, [index]: '' }));
            return;
        }
        setValue(`alignments.${index}.subtopics` as const, normalizeSubtopics([...current, next]) as any, { shouldDirty: true, shouldValidate: true });
        setAlignmentSubtopicInputByIndex((prev) => ({ ...prev, [index]: '' }));
    };

    const removeAlignmentSubtopic = (index: number, target: string) => {
      const current = normalizeSubtopics((form.getValues(`alignments.${index}.subtopics` as const) || []) as string[]);
      setValue(
          `alignments.${index}.subtopics` as const,
          stripSubtopicBranch(current, target) as any,
          { shouldDirty: true, shouldValidate: true }
        );
    };

    const insertMathIntoEditQuestionText = (token: string) => {
      const current = form.getValues('questionText') || '';
      insertTokenAtCursor(current, token, editQuestionTextRef.current, (next) => {
        setValue('questionText', next, { shouldDirty: true, shouldValidate: true });
      });
    };

    const syncCorrectAnswersOnEditOptionChange = (previousValue: string, nextValue: string) => {
      if (mcqAnswerMode === 'multiple') {
        const current = Array.from(new Set(selectedCorrectAnswers || []));
        if (previousValue && current.includes(previousValue)) {
          const next = nextValue
            ? current.map((value) => (value === previousValue ? nextValue : value))
            : current.filter((value) => value !== previousValue);
          setValue('correctAnswers', Array.from(new Set(next)) as any, { shouldDirty: true, shouldValidate: true });
        }
      } else if (selectedCorrectAnswer === previousValue) {
        setValue('correctAnswer', nextValue || '', { shouldDirty: true, shouldValidate: true });
      }
    };

    const insertMathIntoEditOption = (index: number, token: string) => {
      const currentOptions = (form.getValues('options') || []) as string[];
      const previousValue = currentOptions[index] || '';
      insertTokenAtCursor(previousValue, token, editOptionInputRefs.current[index], (nextValue) => {
        setValue(`options.${index}` as any, nextValue, { shouldDirty: true, shouldValidate: true });
        syncCorrectAnswersOnEditOptionChange(previousValue, nextValue);
      });
    };

    const insertMathIntoEditNumericalAnswer = (token: string) => {
      const current = String(form.getValues('numericalAnswer') ?? '');
      insertTokenAtCursor(current, token, editNumericalAnswerRef.current, (nextValue) => {
        setValue('numericalAnswer', nextValue as any, { shouldDirty: true, shouldValidate: true });
        setValue('numericalAnswerText', nextValue as any, { shouldDirty: true });
      });
    };

    const insertMathIntoEditTextAnswer = (token: string) => {
      const current = form.getValues('textAnswer') || '';
      insertTokenAtCursor(current, token, editTextAnswerRef.current, (nextValue) => {
        setValue('textAnswer', nextValue as any, { shouldDirty: true, shouldValidate: true });
      });
    };

    const filteredClasses = useMemo(() => {
        if (!selectedExamType || !classes) return [];
        return classes
          .filter(c => c.examTypeId === selectedExamType)
          .sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedExamType, classes]);
    
    const filteredSubjects = useMemo(() => {
        if (!selectedClass || !subjects) return [];
        const classScoped = subjects.filter(subject => subject.classId === selectedClass);
        if (!allowedSubjectIds || allowedSubjectIds.length === 0) return classScoped;
        return classScoped
          .filter((subject) => allowedSubjectIds.includes(subject.id))
          .sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedClass, subjects, allowedSubjectIds]);

    const allowedExamTypeIds = useMemo(() => {
        if (!allowedClassIds || allowedClassIds.length === 0) return null;
        return Array.from(new Set((classes || []).filter((c) => allowedClassIds.includes(c.id)).map((c) => c.examTypeId)));
    }, [classes, allowedClassIds]);

    const teacherScopedExamTypes = useMemo(() => {
        if (!allowedExamTypeIds) return examTypes || [];
        return (examTypes || []).filter((et) => allowedExamTypeIds.includes(et.id));
    }, [examTypes, allowedExamTypeIds]);

    const filteredTopics = useMemo(() => {
        if (!selectedSubject || !topics) return [];
        return topics
          .filter(topic => topic.subjectId === selectedSubject)
          .sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedSubject, topics]);

    useEffect(() => {
      setValue('classId', '');
      setValue('subjectId', '');
      setValue('topicId', '');
    }, [selectedExamType, setValue]);

    useEffect(() => {
        setValue('subjectId', '');
        setValue('topicId', '');
    }, [selectedClass, setValue]);
    
    useEffect(() => {
        setValue('topicId', '');
    }, [selectedSubject, setValue]);

    useEffect(() => {
      setOpenOptionMathToolByIndex({});
      setShowNumericalAnswerMathTool(false);
      setShowTextAnswerMathTool(false);
    }, [questionType]);

    useEffect(() => {
      setOpenOptionMathToolByIndex((prev) => {
        const next: Record<number, boolean> = {};
        optionFields.forEach((_, index) => {
          if (prev[index]) next[index] = true;
        });
        return next;
      });
    }, [optionFields]);

    useEffect(() => {
      setAlignmentSubtopicInputByIndex((prev) => {
        const next: Record<number, string> = {};
        alignmentFields.forEach((_, index) => {
          if (prev[index]) next[index] = prev[index];
        });
        return next;
      });
    }, [alignmentFields]);

    const handleCreateTopic = async () => {
        if (!selectedSubject || isCreatingTopic) return;
        const name = window.prompt('Enter new topic name');
        const trimmedName = (name || '').trim();
        if (!trimmedName) return;
        try {
            setIsCreatingTopic(true);
            const created = await addDocumentNonBlocking(collection(firestore, 'topics'), {
                name: trimmedName,
                subjectId: selectedSubject,
                teacherId: questionBankOwnerId || currentUserId || null,
            });
            const createdId = (created as any)?.id;
            if (createdId) {
                setValue('topicId', createdId);
            }
            toast({ title: 'Topic created', description: `"${trimmedName}" has been added.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Topic creation failed', description: error?.message || 'Could not create topic.' });
        } finally {
            setIsCreatingTopic(false);
        }
    };

    const onSubmit = async (values: z.infer<typeof questionSchema>) => {
        setIsSubmitting(true);
        const questionRef = doc(firestore, 'practice_questions', questionToEdit.id);

        try {
            const dataToUpdate: any = { ...values };
            if (dataToUpdate.questionType === 'MCQ') {
                dataToUpdate.mcqAnswerMode = dataToUpdate.mcqAnswerMode || 'single';
                if (dataToUpdate.mcqAnswerMode === 'multiple') {
                    const selected = Array.from(new Set((dataToUpdate.correctAnswers || []).filter(Boolean)));
                    dataToUpdate.correctAnswers = selected;
                    dataToUpdate.correctAnswer = selected[0] || '';
                } else {
                    dataToUpdate.correctAnswers = [];
                }
                dataToUpdate.numericalAnswerText = '';
            } else if (dataToUpdate.questionType === 'Numerical') {
                dataToUpdate.numericalAnswerText = String((values as any).numericalAnswerText ?? (values as any).numericalAnswer ?? '').trim();
            } else {
                dataToUpdate.numericalAnswerText = '';
            }
            dataToUpdate.isPreviousYear = !!values.isPreviousYear;
            dataToUpdate.mockTestOnly = !!values.mockTestOnly;
            dataToUpdate.subtopics = normalizeSubtopics(values.subtopics);
            dataToUpdate.previousYear = values.isPreviousYear ? String(values.previousYear || '').trim() : '';
            dataToUpdate.alignments = (values.alignments || [])
              .filter((item) => item.examTypeId && item.classId && item.subjectId && item.topicId)
              .map((item) => ({
                ...item,
                subtopics: normalizeSubtopics(item.subtopics),
                accessLevel: item.accessLevel === 'paid' ? 'paid' : 'free',
                mockTestOnly: !!item.mockTestOnly,
                isPreviousYear: !!item.isPreviousYear,
                previousYear: item.isPreviousYear ? String(item.previousYear || '').trim() : '',
              }));

            const questionOwnerId = questionToEdit.teacherId || questionBankOwnerId || currentUserId || '';
            const mediaOwnerId = currentUserId || '';
            const persistedQuestionImages = await persistPracticeQuestionImageUrls(
              storage,
              mediaOwnerId,
              'question',
              values.imageUrls,
              questionToEdit.imageUrl
            );
            const persistedExplanationImages = await persistPracticeQuestionImageUrls(
              storage,
              mediaOwnerId,
              'solution',
              values.explanationImageUrls,
              questionToEdit.explanationImageUrl
            );

            dataToUpdate.teacherId = questionOwnerId || null;
            dataToUpdate.imageUrls = persistedQuestionImages;
            if (persistedQuestionImages.length > 0) {
              dataToUpdate.imageUrl = persistedQuestionImages[0];
            }
            dataToUpdate.explanationImageUrls = persistedExplanationImages;
            if (persistedExplanationImages.length > 0) {
              dataToUpdate.explanationImageUrl = persistedExplanationImages[0];
            }

            const fixedQuestionNumber = getQuestionNumber(questionToEdit);
            if (fixedQuestionNumber > 0) {
              dataToUpdate.questionNumber = fixedQuestionNumber;
              dataToUpdate.questionTitle = buildQuestionTitle(fixedQuestionNumber);
            } else {
              dataToUpdate.questionTitle = getDisplayQuestionTitle(questionToEdit);
            }
            dataToUpdate.categoryKeys = getCategoryKeysForSelection(
              {
                examTypeId: dataToUpdate.examTypeId,
                classId: dataToUpdate.classId,
                subjectId: dataToUpdate.subjectId,
                topicId: dataToUpdate.topicId,
                subtopics: dataToUpdate.subtopics,
              },
              dataToUpdate.alignments
            );
            dataToUpdate.questionFingerprint = buildQuestionFingerprint(dataToUpdate);

            const updatedQuestion = await updateDocumentNonBlocking(questionRef, dataToUpdate);
            if (updatedQuestion === null) {
              throw new Error('The practice question could not be saved.');
            }
            await syncPracticeQuestionSummaryForUpdate(firestore, questionToEdit, dataToUpdate);

            toast({
              title: 'Question Updated!',
              description: 'The practice question has been successfully updated.',
            });
            onFinished();
        } catch (error: any) {
            console.error('Practice question update failed:', error);
            toast({
              variant: 'destructive',
              title: 'Question update failed',
              description: error?.message || 'The practice question could not be updated.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormItem className="space-y-2">
                        <FormLabel>Question Type</FormLabel>
                        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                            {questionType === 'MCQ' ? 'Multiple Choice' : questionType === 'Numerical' ? 'Numerical Answer' : 'Text Answer'}
                        </div>
                        <FormDescription>Question type cannot be changed during edit.</FormDescription>
                    </FormItem>
                </div>
                <FormField control={form.control} name="questionTitle" render={({ field }) => (<FormItem><FormLabel>Question Number (Auto)</FormLabel><FormControl><Input {...field} value={field.value || getDisplayQuestionTitle(questionToEdit)} readOnly disabled /></FormControl><FormDescription>This is auto-generated and cannot be edited manually.</FormDescription><FormMessage /></FormItem>)} />
                <MathToolbar onInsert={insertMathIntoEditQuestionText} />
                <FormField control={form.control} name="questionText" render={({ field }) => (<FormItem><FormLabel>Question Text</FormLabel><FormControl><Textarea placeholder="e.g., What is the formula for..." {...field} ref={(el) => { editQuestionTextRef.current = el; field.ref(el); }} rows={4} /></FormControl><MathTextPreview text={field.value || ''} /><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="solutionExplanation" render={({ field }) => (<FormItem><FormLabel>Solution Explanation (Optional)</FormLabel><FormControl><Textarea placeholder="Add step-by-step explanation for students..." {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />

                <div className="space-y-2">
                    <FormLabel>Explanation Images (Optional)</FormLabel>
                    <div className="flex flex-col gap-4">
                        {form.watch('explanationImageUrls')?.map((url, index) => (
                            <div key={index} className="relative group">
                                <img
                                    src={url}
                                    alt={`Explanation image ${index + 1}`}
                                    loading="lazy"
                                    className="h-auto max-h-[260px] w-full max-w-[420px] rounded-md border object-contain bg-background"
                                />
                                <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                                    onClick={() => {
                                        const currentUrls = form.getValues('explanationImageUrls') || [];
                                        form.setValue('explanationImageUrls', currentUrls.filter((_, i) => i !== index));
                                    }}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                {questionType === 'MCQ' && (
                    <div className="space-y-4">
                        <FormLabel>Options & Correct Answer</FormLabel>
                        <FormField
                          control={form.control}
                          name="mcqAnswerMode"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <FormLabel>Correct Answer Type</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  className="flex gap-6"
                                  value={field.value || 'single'}
                                  onValueChange={(value) => {
                                    field.onChange(value);
                                    if (value === 'single') {
                                      const fromMulti = (selectedCorrectAnswers && selectedCorrectAnswers[0]) || '';
                                      setValue('correctAnswer', fromMulti || selectedCorrectAnswer || '');
                                      setValue('correctAnswers', []);
                                    } else {
                                      const first = selectedCorrectAnswer ? [selectedCorrectAnswer] : [];
                                      setValue('correctAnswers', first as any);
                                      setValue('correctAnswer', '');
                                    }
                                  }}
                                >
                                  <FormItem className="flex items-center gap-2 space-y-0">
                                    <FormControl><RadioGroupItem value="single" /></FormControl>
                                    <FormLabel className="font-normal">Single Correct</FormLabel>
                                  </FormItem>
                                  <FormItem className="flex items-center gap-2 space-y-0">
                                    <FormControl><RadioGroupItem value="multiple" /></FormControl>
                                    <FormLabel className="font-normal">Multiple Correct</FormLabel>
                                  </FormItem>
                                </RadioGroup>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {optionFields.map((item, index) => (
                            <FormField
                              key={item.id}
                              control={form.control}
                              name={`options.${index}`}
                              render={({ field: optionField }) => {
                                const value = optionField.value || '';
                                const isSelected = mcqAnswerMode === 'multiple'
                                  ? selectedCorrectAnswers.includes(value)
                                  : selectedCorrectAnswer === value;
                                const isMathToolOpen = !!openOptionMathToolByIndex[index];
                                return (
                                  <FormItem className={cn("space-y-2 rounded-md border p-4", isSelected ? "border-primary bg-primary/5" : "")}>
                                    <div className="flex items-center gap-2">
                                      <Input
                                        {...optionField}
                                        placeholder={`Option ${index + 1}`}
                                        className="border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                                        ref={(el) => {
                                          editOptionInputRefs.current[index] = el;
                                          optionField.ref(el);
                                        }}
                                        onChange={(event) => {
                                          const nextValue = event.target.value;
                                          const previousValue = optionField.value || '';
                                          optionField.onChange(nextValue);
                                          syncCorrectAnswersOnEditOptionChange(previousValue, nextValue);
                                        }}
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={isSelected ? "default" : "outline"}
                                        disabled={!value}
                                        onClick={() => {
                                          if (!value) return;
                                          if (mcqAnswerMode === 'multiple') {
                                            const current = Array.from(new Set(selectedCorrectAnswers || []));
                                            const next = current.includes(value)
                                              ? current.filter((item) => item !== value)
                                              : [...current, value];
                                            setValue('correctAnswers', next as any, { shouldValidate: true, shouldDirty: true });
                                          } else {
                                            setValue('correctAnswer', value, { shouldValidate: true, shouldDirty: true });
                                          }
                                        }}
                                      >
                                        {isSelected ? "Correct" : "Mark Correct"}
                                      </Button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setOpenOptionMathToolByIndex((prev) => ({ ...prev, [index]: !prev[index] }));
                                        }}
                                      >
                                        {isMathToolOpen ? 'Hide Math Tool' : 'Use Math Tool'}
                                      </Button>
                                    </div>
                                    {isMathToolOpen ? (
                                      <MathToolbar onInsert={(token) => insertMathIntoEditOption(index, token)} />
                                    ) : null}
                                    {value ? (
                                      <div className="math-preview rounded-md border bg-background px-3 py-2">
                                        <p className="mb-1 text-xs font-medium text-muted-foreground">Math Preview</p>
                                        <MathText text={value} className="text-sm" />
                                      </div>
                                    ) : null}
                                  </FormItem>
                                );
                              }}
                            />
                          ))}
                        </div>
                        {mcqAnswerMode === 'single' ? (
                          <FormField control={form.control} name="correctAnswer" render={() => <FormMessage />} />
                        ) : (
                          <FormField control={form.control} name="correctAnswers" render={() => <FormMessage />} />
                        )}
                    </div>
                )}
                {questionType === 'Numerical' && (
                  <FormField
                    control={form.control}
                    name="numericalAnswer"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Correct Numerical Answer</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="e.g., 42"
                            {...field}
                            value={field.value ?? ''}
                            ref={(el) => {
                              editNumericalAnswerRef.current = el;
                              field.ref(el);
                            }}
                            onChange={(event) => {
                              const raw = event.target.value;
                              field.onChange(raw as any);
                              setValue('numericalAnswerText', raw as any, { shouldDirty: true });
                            }}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowNumericalAnswerMathTool((prev) => !prev)}
                        >
                          {showNumericalAnswerMathTool ? 'Hide Math Tool' : 'Use Math Tool'}
                        </Button>
                        {showNumericalAnswerMathTool ? (
                          <MathToolbar onInsert={insertMathIntoEditNumericalAnswer} />
                        ) : null}
                        <MathTextPreview text={String((form.watch('numericalAnswerText') || field.value || '') as string)} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {questionType === 'Text' && (
                  <FormField
                    control={form.control}
                    name="textAnswer"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Reference Text Answer</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add the expected text answer or key points..."
                            {...field}
                            rows={3}
                            ref={(el) => {
                              editTextAnswerRef.current = el;
                              field.ref(el);
                            }}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowTextAnswerMathTool((prev) => !prev)}
                        >
                          {showTextAnswerMathTool ? 'Hide Math Tool' : 'Use Math Tool'}
                        </Button>
                        {showTextAnswerMathTool ? (
                          <MathToolbar onInsert={insertMathIntoEditTextAnswer} />
                        ) : null}
                        <MathTextPreview text={field.value || ''} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <FormField control={form.control} name="examTypeId" render={({ field }) => (
                        <FormItem><FormLabel>Question for Exam Type</FormLabel>
                            <Select onValueChange={(value) => {
                                field.onChange(value);
                                form.setValue('classId', '');
                                form.setValue('subjectId', '');
                                form.setValue('topicId', '');
                            }} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select an exam type" /></SelectTrigger></FormControl>
                                <SelectContent>{examTypes?.map(et => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="classId" render={({ field }) => (
                        <FormItem><FormLabel>Class</FormLabel>
                            <Select onValueChange={(value) => {
                                field.onChange(value);
                                form.setValue('subjectId', '');
                                form.setValue('topicId', '');
                            }} value={field.value} disabled={!selectedExamType}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger></FormControl>
                                <SelectContent>{filteredClasses?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="subjectId" render={({ field }) => (
                        <FormItem><FormLabel>Subject</FormLabel>
                            <Select onValueChange={(value) => {
                                field.onChange(value);
                                form.setValue('topicId', '');
                            }} value={field.value} disabled={!selectedClass}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger></FormControl>
                                <SelectContent>{filteredSubjects.map(subject => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="topicId" render={({ field }) => (
                        <FormItem>
                            <div className="flex items-center justify-between">
                                <FormLabel>Topic</FormLabel>
                                <Button type="button" variant="outline" size="sm" onClick={handleCreateTopic} disabled={!selectedSubject || isCreatingTopic}>
                                    {isCreatingTopic ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                    Create Topic
                                </Button>
                            </div>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!selectedSubject}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a topic" /></SelectTrigger></FormControl>
                                <SelectContent>{filteredTopics.map(topic => <SelectItem key={topic.id} value={topic.id}>{topic.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField
                      control={form.control}
                      name="subtopics"
                      render={() => (
                        <FormItem className="md:col-span-3">
                          <FormLabel>Subtopics (Optional)</FormLabel>
                          <div className="flex gap-2">
                            <Input
                              placeholder="e.g., Relative motion"
                              value={subtopicInput}
                              onChange={(event) => setSubtopicInput(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  addSubtopic();
                                }
                              }}
                            />
                            <Button type="button" variant="outline" onClick={addSubtopic}>Add</Button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedSubtopics.map((item) => (
                              <Badge key={item} variant="secondary" className="flex items-center gap-1">
                                {item}
                                <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => removeSubtopic(item)}>
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                          <FormDescription>Add one or more subtopics for better question tagging.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField control={form.control} name="accessLevel" render={({ field }) => (
                        <FormItem><FormLabel>Access Level</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select access" /></SelectTrigger></FormControl><SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="mockTestOnly" render={({ field }) => (
                        <FormItem><FormLabel>Mock Test Usage</FormLabel><Select onValueChange={(value) => field.onChange(value === 'yes')} value={field.value ? 'yes' : 'no'}><FormControl><SelectTrigger><SelectValue placeholder="Select usage" /></SelectTrigger></FormControl><SelectContent><SelectItem value="no">Student Use + Official Mock Test</SelectItem><SelectItem value="yes">Teacher Official Mock Test</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="isPreviousYear" render={({ field }) => (
                        <FormItem><FormLabel>Previous Year Question</FormLabel><Select onValueChange={(value) => field.onChange(value === 'yes')} value={field.value ? 'yes' : 'no'}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="no">No</SelectItem><SelectItem value="yes">Yes</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    {selectedIsPreviousYear ? (
                        <FormField control={form.control} name="previousYear" render={({ field }) => (
                            <FormItem><FormLabel>Previous Year</FormLabel><FormControl><Input type="number" placeholder="e.g., 2020" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                    ) : null}
                </div>

                <div className="space-y-3 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <FormLabel>Additional Alignments (Optional)</FormLabel>
                            <FormDescription>Map this same question to other exam/curriculum/subject combinations.</FormDescription>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => appendAlignment({
                            examTypeId: '',
                            classId: '',
                            subjectId: '',
                            topicId: '',
                            subtopics: [],
                            accessLevel: form.getValues('accessLevel') || 'free',
                            mockTestOnly: !!form.getValues('mockTestOnly'),
                            difficultyLevel: 'Easy' as const,
                            isPreviousYear: false,
                            previousYear: '',
                          } as any)}
                        >
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Alignment
                        </Button>
                    </div>
                    {alignmentFields.map((alignment, index) => {
                        const aExam = form.watch(`alignments.${index}.examTypeId` as const);
                        const aClass = form.watch(`alignments.${index}.classId` as const);
                        const aSubject = form.watch(`alignments.${index}.subjectId` as const);
                        const alignmentClassesBase = (classes || []).filter((c) => c.examTypeId === aExam);
                        const alignmentClasses = (allowedClassIds && allowedClassIds.length > 0)
                          ? alignmentClassesBase.filter((c) => allowedClassIds.includes(c.id))
                          : alignmentClassesBase;
                        const alignmentSubjectsBase = (subjects || []).filter((s) => s.classId === aClass);
                        const alignmentSubjects = (allowedSubjectIds && allowedSubjectIds.length > 0)
                          ? alignmentSubjectsBase.filter((s) => allowedSubjectIds.includes(s.id))
                          : alignmentSubjectsBase;
                        const alignmentTopics = (topics || []).filter((t) => t.subjectId === aSubject);
                        const alignmentSubtopics = normalizeSubtopics((form.watch(`alignments.${index}.subtopics` as const) || []) as string[]);
                        const alignmentIsPreviousYear = !!form.watch(`alignments.${index}.isPreviousYear` as const);
                        return (
                            <div key={alignment.id} className="space-y-3 rounded-md border p-3">
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-5 xl:grid-cols-9 items-end">
                                <FormField control={form.control} name={`alignments.${index}.examTypeId` as const} render={({ field }) => (
                                    <FormItem><FormLabel>Exam</FormLabel><Select onValueChange={(value) => { field.onChange(value); form.setValue(`alignments.${index}.classId` as const, ''); form.setValue(`alignments.${index}.subjectId` as const, ''); form.setValue(`alignments.${index}.topicId` as const, ''); form.setValue(`alignments.${index}.subtopics` as const, [] as any); }} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger></FormControl><SelectContent>{teacherScopedExamTypes.map((et) => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name={`alignments.${index}.classId` as const} render={({ field }) => (
                                    <FormItem><FormLabel>Curriculum</FormLabel><Select onValueChange={(value) => { field.onChange(value); form.setValue(`alignments.${index}.subjectId` as const, ''); form.setValue(`alignments.${index}.topicId` as const, ''); form.setValue(`alignments.${index}.subtopics` as const, [] as any); }} value={field.value} disabled={!aExam}><FormControl><SelectTrigger><SelectValue placeholder="Select curriculum" /></SelectTrigger></FormControl><SelectContent>{alignmentClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name={`alignments.${index}.subjectId` as const} render={({ field }) => (
                                    <FormItem><FormLabel>Subject</FormLabel><Select onValueChange={(value) => { field.onChange(value); form.setValue(`alignments.${index}.topicId` as const, ''); form.setValue(`alignments.${index}.subtopics` as const, [] as any); }} value={field.value} disabled={!aClass}><FormControl><SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger></FormControl><SelectContent>{alignmentSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name={`alignments.${index}.topicId` as const} render={({ field }) => (
                                    <FormItem><FormLabel>Topic</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!aSubject}><FormControl><SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger></FormControl><SelectContent>{alignmentTopics.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                
                                <FormField control={form.control} name={`alignments.${index}.accessLevel` as const} render={({ field }) => (
                                    <FormItem><FormLabel>Access</FormLabel><Select onValueChange={field.onChange} value={field.value || 'free'}><FormControl><SelectTrigger><SelectValue placeholder="Access" /></SelectTrigger></FormControl><SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name={`alignments.${index}.mockTestOnly` as const} render={({ field }) => (
                                    <FormItem><FormLabel>Mock Usage</FormLabel><Select onValueChange={(value) => field.onChange(value === 'yes')} value={field.value ? 'yes' : 'no'}><FormControl><SelectTrigger><SelectValue placeholder="Select usage" /></SelectTrigger></FormControl><SelectContent><SelectItem value="no">Student Use + Official Mock Test</SelectItem><SelectItem value="yes">Teacher Official Mock Test</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name={`alignments.${index}.isPreviousYear` as const} render={({ field }) => (
                                    <FormItem><FormLabel>PYQ</FormLabel><Select onValueChange={(value) => field.onChange(value === 'yes')} value={field.value ? 'yes' : 'no'}><FormControl><SelectTrigger><SelectValue placeholder="PYQ" /></SelectTrigger></FormControl><SelectContent><SelectItem value="no">No</SelectItem><SelectItem value="yes">Yes</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name={`alignments.${index}.previousYear` as const} render={({ field }) => (
                                    <FormItem><FormLabel>Year</FormLabel><FormControl><Input type="number" placeholder="e.g., 2020" {...field} value={field.value || ''} disabled={!alignmentIsPreviousYear} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <Button type="button" variant="destructive" size="icon" onClick={() => removeAlignment(index)} className="h-10 w-10"><X className="h-4 w-4" /></Button>
                                </div>
                                <div className="space-y-2">
                                    <FormLabel>Subtopics (Optional)</FormLabel>
                                    <div className="flex flex-wrap gap-2">
                                      <Input
                                        placeholder="e.g., Relative motion"
                                        value={alignmentSubtopicInputByIndex[index] || ''}
                                        onChange={(event) => setAlignmentSubtopicInputByIndex((prev) => ({ ...prev, [index]: event.target.value }))}
                                        onKeyDown={(event) => {
                                          if (event.key === 'Enter') {
                                            event.preventDefault();
                                            addAlignmentSubtopic(index);
                                          }
                                        }}
                                        disabled={!aSubject}
                                      />
                                      <Button type="button" variant="outline" onClick={() => addAlignmentSubtopic(index)} disabled={!aSubject}>Add</Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {alignmentSubtopics.map((item) => (
                                        <Badge key={`${alignment.id}-subtopic-${item}`} variant="secondary" className="flex items-center gap-1">
                                          {item}
                                          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => removeAlignmentSubtopic(index, item)}>
                                            <X className="h-3 w-3" />
                                          </button>
                                        </Badge>
                                      ))}
                                    </div>
                                    <FormDescription>Add topic-specific subtopics for this alignment.</FormDescription>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? (<><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : ('Save Changes')}</Button>
            </form>
        </Form>
    );
}

const StartTopicPracticeForm: FC<{ topic: Topic, isSubscribed: boolean }> = ({ topic, isSubscribed }) => {
    const router = useRouter();
    const form = useForm<z.infer<typeof TopicPracticeFormSchema>>({
      resolver: zodResolver(TopicPracticeFormSchema),
      defaultValues: {
        timeLimit: '',
      }
    });
  
    const onSubmit = (values: z.infer<typeof TopicPracticeFormSchema>) => {
      const params = new URLSearchParams();
      params.append('topicId', topic.id);
      if (values.timeLimit) {
        params.append('timeLimit', values.timeLimit.toString());
      }
      if (!isSubscribed) {
        params.append('accessLevel', 'free');
      }
      router.push(`/practice/session?${params.toString()}`);
    };
  
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 rounded-lg bg-muted/50 p-4">
            <FormField control={form.control} name="timeLimit" render={({ field }) => (
                <FormItem><FormLabel className="text-xs">Time/Question (s)</FormLabel><FormControl><Input type="number" placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" size="sm" className="w-full">
                <Rocket className="mr-2 h-4 w-4" /> Start Practice
            </Button>
        </form>
      </Form>
    );
}

const StartPracticeForm: FC<{
  curriculumTree: any[],
  isSubscribed: boolean,
}> = ({ curriculumTree, isSubscribed }) => {
    const router = useRouter();
    const form = useForm<z.infer<typeof practiceQuizSchema>>({
        resolver: zodResolver(practiceQuizSchema),
        defaultValues: {
            topicsConfig: [],
            difficultyLevel: 'Easy' as const,
            accessLevel: 'free',
            timeLimitPerQuestion: '',
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "topicsConfig"
    });

    function onSubmit(values: z.infer<typeof practiceQuizSchema>) {
        const params = new URLSearchParams();
        const topicsParam = values.topicsConfig.map(tc => `${tc.topicId}:${tc.count}`).join(',');
        params.append('topics', topicsParam);
        
        if (values.difficultyLevel) {
            params.append('difficultyLevel', values.difficultyLevel);
        }
        params.append('accessLevel', values.accessLevel);
        if (values.timeLimitPerQuestion) {
            params.append('timeLimit', values.timeLimitPerQuestion.toString());
        }

        router.push(`/practice/session?${params.toString()}`);
    }
    
    const handleTopicToggle = (topic: { id: string; name: string }, isChecked: boolean) => {
        const index = fields.findIndex(field => field.topicId === topic.id);
        if (isChecked && index === -1) {
            append({ topicId: topic.id, topicName: topic.name, count: 5 });
        } else if (!isChecked && index !== -1) {
            remove(index);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="text-base font-semibold">Filters</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      <FormField control={form.control} name="accessLevel" render={({ field }) => (
                          <FormItem><FormLabel>Access Level</FormLabel><FormControl>
                              <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex pt-2">
                                  <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="free" /></FormControl><FormLabel className="font-normal">Free</FormLabel></FormItem>
                                  <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="paid" disabled={!isSubscribed} /></FormControl><FormLabel className={cn("font-normal", !isSubscribed && "text-muted-foreground")}>Paid {!isSubscribed && "(Pro)"}</FormLabel></FormItem>
                              </RadioGroup>
                          </FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="timeLimitPerQuestion" render={({ field }) => (
                          <FormItem><FormLabel>Time/Question (s)</FormLabel><FormControl><Input type="number" placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                  </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-base font-semibold">Select Topics</Label>
                    <FormDescription>Choose one or more topics for your practice session.</FormDescription>
                    <Card>
                        <CardContent className='p-4 max-h-96 overflow-y-auto'>
                            <Accordion type="multiple" className="w-full">
                                {curriculumTree.map(et => (
                                <AccordionItem value={et.id} key={et.id}>
                                    <AccordionTrigger>{et.name}</AccordionTrigger>
                                    <AccordionContent>
                                    <Accordion type="multiple" className="w-full pl-4">
                                        {et.classes.map((c:any) => (
                                        <AccordionItem value={c.id} key={c.id}>
                                            <AccordionTrigger>{c.name}</AccordionTrigger>
                                            <AccordionContent>
                                            <Accordion type="multiple" className="w-full pl-4" defaultValue={c.subjects.map((s:any) => s.id)}>
                                                {c.subjects.map((s:any) => (
                                                <AccordionItem value={s.id} key={s.id}>
                                                    <AccordionTrigger>{s.name}</AccordionTrigger>
                                                    <AccordionContent className='pl-4'>
                                                        <div className="space-y-2">
                                                            {s.topics.map((t:any) => (
                                                                <div key={t.id} className="flex items-center space-x-2">
                                                                    <Checkbox id={`practice-${t.id}`} onCheckedChange={(checked) => handleTopicToggle(t, !!checked)} checked={fields.some(f => f.topicId === t.id)}/>
                                                                    <label htmlFor={`practice-${t.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t.name}</label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                                ))}
                                            </Accordion>
                                            </AccordionContent>
                                        </AccordionItem>
                                        ))}
                                    </Accordion>
                                    </AccordionContent>
                                </AccordionItem>
                                ))}
                            </Accordion>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    <Label className="text-base font-semibold">Selected Topics & Question Count</Label>
                    {fields.length > 0 ? (
                        <Card>
                        <CardContent className="p-4 space-y-4 max-h-60 overflow-y-auto">
                            {fields.map((field, index) => (
                            <div key={field.id} className="flex items-center justify-between gap-4 p-2 rounded-md bg-muted/50">
                                <span className="font-medium text-sm flex-1">{field.topicName}</span>
                                <div className="flex items-center gap-2">
                                <Label htmlFor={`topicsConfig.${index}.count`} className="text-sm">Questions:</Label>
                                <FormField
                                    control={form.control}
                                    name={`topicsConfig.${index}.count`}
                                    render={({ field: countField }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input
                                                id={`topicsConfig.${index}.count`}
                                                type="number"
                                                min="1"
                                                className="w-20 h-8"
                                                {...countField}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(index)}>
                                <X className="h-4 w-4" />
                                </Button>
                            </div>
                            ))}
                        </CardContent>
                        <CardFooter>
                            <p className="text-sm text-muted-foreground">
                            Total questions: {form.watch('topicsConfig').reduce((acc, curr) => acc + (Number(curr.count) || 0), 0)}
                            </p>
                        </CardFooter>
                        </Card>
                    ) : (
                        <div className="text-sm text-muted-foreground text-center p-4 border border-dashed rounded-md">
                        Select topics from the curriculum above.
                        </div>
                    )}
                    <FormField
                        control={form.control}
                        name="topicsConfig"
                        render={() => (
                        <FormItem>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>


                <Button type="submit"><Rocket className="mr-2 h-4 w-4" /> Start Practice Session</Button>
            </form>
        </Form>
    );
};

const TeacherView = ({
    form,
    onSubmit,
    isTopicOptionsLoading,
    isQuestionBankLoading,
    isSubmitting,
    isTeacher,
    topicMap,
    classMap,
    examTypeMap,
    setEditingQuestion,
    handleDeleteRequest,
    classes,
    subjects,
    topics,
    examTypes,
    currentUserId,
    questionBankOwnerId,
    allQuestions,
    existingTeacherQuestions,
    subtopicCatalogQuestions,
    isSubtopicCatalogLoading,
    allowedClassIds,
    allowedSubjectIds,
    isBankOnlyView,
    formResetSignal,
    clearQuestionContentSignal,
    onResetFields,
}: any) => {
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    const [isCreatingTopic, setIsCreatingTopic] = useState(false);
    const questionTextRef = useRef<HTMLTextAreaElement | null>(null);
    const mcqOptionInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const numericalAnswerRef = useRef<HTMLInputElement | null>(null);
    const textAnswerRef = useRef<HTMLTextAreaElement | null>(null);
    const { control, watch, setValue } = form;
    const { fields: alignmentFields, append: appendAlignment, remove: removeAlignment } = useFieldArray({ control, name: "alignments" as never });
    const questionType = watch('questionType');
    const selectedExamType = watch('examTypeId');
    const selectedClass = watch('classId');
    const selectedSubject = watch('subjectId');
    const selectedTopic = watch('topicId');
    const selectedIsPreviousYear = watch('isPreviousYear');
    const selectedSubtopics = (watch('subtopics') || []) as string[];
    const watchedAlignments = (watch('alignments') || []) as CategorySelectionInput[];
    const mcqAnswerMode = (watch('mcqAnswerMode') || 'single') as 'single' | 'multiple';
    const selectedCorrectAnswer = watch('correctAnswer');
    const selectedCorrectAnswers = (watch('correctAnswers') || []) as string[];
    const [subtopicInput, setSubtopicInput] = useState('');
    const [selectedSubtopicParent, setSelectedSubtopicParent] = useState('');
    const [isDeletingTopic, setIsDeletingTopic] = useState(false);
    const watchedQuestionText = (watch('questionText') || '').trim();
    const watchedImageUrls = (watch('imageUrls') || []) as string[];
    const watchedExplanationImageUrls = (watch('explanationImageUrls') || []) as string[];
    const watchedOptions = watch('options');
    const [mcqOptionCount, setMcqOptionCount] = useState(4);
    const [questionPdfFile, setQuestionPdfFile] = useState<File | null>(null);
    const [questionPdfPage, setQuestionPdfPage] = useState(1);
    const [extractedQuestionText, setExtractedQuestionText] = useState('');
    const [questionUploadMode, setQuestionUploadMode] = useState<'ocr' | 'image'>('ocr');
    const hasUploadedQuestionImage = questionUploadMode === 'image' && watchedImageUrls.length > 0;
    const [mcqOptionsPdfFile, setMcqOptionsPdfFile] = useState<File | null>(null);
    const [mcqOptionsPdfPage, setMcqOptionsPdfPage] = useState(1);
    const [solutionAttachFile, setSolutionAttachFile] = useState<File | null>(null);
    const [solutionAttachPage, setSolutionAttachPage] = useState(1);
    const [openCreateOptionMathToolByIndex, setOpenCreateOptionMathToolByIndex] = useState<Record<number, boolean>>({});
    const [showCreateNumericalAnswerMathTool, setShowCreateNumericalAnswerMathTool] = useState(false);
    const [showCreateTextAnswerMathTool, setShowCreateTextAnswerMathTool] = useState(false);
    const [alignmentSubtopicInputByIndex, setAlignmentSubtopicInputByIndex] = useState<Record<number, string>>({});
    const [alignmentSubtopicParentByIndex, setAlignmentSubtopicParentByIndex] = useState<Record<number, string>>({});
    const isClassificationReady = !!selectedExamType && !!selectedClass && !!selectedSubject && !!selectedTopic;
    const questionCategoryKey = useMemo(
      () => getQuestionCategoryKey(selectedExamType, selectedClass, selectedSubject, selectedTopic, selectedSubtopics),
      [selectedExamType, selectedClass, selectedSubject, selectedTopic, selectedSubtopics]
    );
    const questionNumberPlan = useMemo(() => {
      return computeQuestionNumberPlan(
        (existingTeacherQuestions || []).filter((item: PracticeQuestion) => item.teacherId === questionBankOwnerId),
        {
          examTypeId: selectedExamType,
          classId: selectedClass,
          subjectId: selectedSubject,
          topicId: selectedTopic,
          subtopics: selectedSubtopics,
        },
        watchedAlignments
      );
    }, [
      existingTeacherQuestions,
      questionBankOwnerId,
      selectedExamType,
      selectedClass,
      selectedSubject,
      selectedTopic,
      selectedSubtopics,
      watchedAlignments,
    ]);
    const nextQuestionNumber = questionNumberPlan.primaryQuestionNumber;
    const alignmentQuestionNumbersByIndex = questionNumberPlan.alignmentQuestionNumbersByIndex;
    const autoQuestionTitle = questionCategoryKey ? buildQuestionTitle(nextQuestionNumber) : '';
    const getTopicSubtopicCatalog = (topicId?: string) => {
      if (!topicId) return [] as string[];
      const collected: string[] = [];
      const selectedTopicMeta = (topics || []).find((topic: Topic) => topic.id === topicId);
      if (selectedTopicMeta) {
        collected.push(
          ...normalizeSubtopics([
            ...(selectedTopicMeta.subtopics || []),
            ...(selectedTopicMeta.subtopicPaths || []),
            ...(selectedTopicMeta.subtopicCatalog || []),
          ])
        );
      }
      const questionMap = new Map<string, PracticeQuestion>();
      [...(existingTeacherQuestions || []), ...(subtopicCatalogQuestions || [])].forEach((question: PracticeQuestion) => {
        if (!question?.id) return;
        if (questionBankOwnerId && question.teacherId !== questionBankOwnerId) return;
        questionMap.set(question.id, question);
      });
      Array.from(questionMap.values()).forEach((question: PracticeQuestion) => {
        if (question.topicId === topicId) {
          collected.push(...normalizeSubtopics(question.subtopics));
        }
        (question.alignments || []).forEach((alignment) => {
          if ((alignment.topicId || '') !== topicId) return;
          collected.push(...normalizeSubtopics(alignment.subtopics));
        });
      });
      return normalizeSubtopics(collected).sort((left, right) => {
        const depthDiff = splitSubtopicPath(left).length - splitSubtopicPath(right).length;
        if (depthDiff !== 0) return depthDiff;
        return left.localeCompare(right);
      });
    };

    const topicSubtopicCatalog = useMemo(() => {
      return getTopicSubtopicCatalog(selectedTopic);
    }, [existingTeacherQuestions, questionBankOwnerId, selectedTopic, subtopicCatalogQuestions, topics]);
    const availableParentSubtopics = useMemo(() => {
      return normalizeSubtopics([...(selectedSubtopics || []), ...topicSubtopicCatalog]).sort((left, right) => {
        const depthDiff = splitSubtopicPath(left).length - splitSubtopicPath(right).length;
        if (depthDiff !== 0) return depthDiff;
        return left.localeCompare(right);
      });
    }, [selectedSubtopics, topicSubtopicCatalog]);
    const selectedTopicQuestionCount = useMemo(() => {
      if (!selectedTopic) return 0;
      return (allQuestions || []).reduce((total: number, question: PracticeQuestion) => {
        const usedInPrimary = question.topicId === selectedTopic;
        const usedInAlignments = (question.alignments || []).some((alignment) => (alignment.topicId || '') === selectedTopic);
        return total + ((usedInPrimary || usedInAlignments) ? 1 : 0);
      }, 0);
    }, [allQuestions, selectedTopic]);
    const setupMilestones = useMemo(() => ([
      { key: 'exam', label: 'Exam', done: !!selectedExamType },
      { key: 'curriculum', label: 'Curriculum', done: !!selectedClass },
      { key: 'subject', label: 'Subject', done: !!selectedSubject },
      { key: 'topic', label: 'Topic', done: !!selectedTopic },
    ]), [selectedExamType, selectedClass, selectedSubject, selectedTopic]);
    const completedSetupMilestones = setupMilestones.filter((step) => step.done).length;
    const setupCompletionPercentage = Math.round((completedSetupMilestones / setupMilestones.length) * 100);
    const totalAttachedMediaCount = watchedImageUrls.length + watchedExplanationImageUrls.length;
    const subtopicHierarchy = useMemo(() => buildSubtopicHierarchy(availableParentSubtopics), [availableParentSubtopics]);
    const subtopicHierarchyPaths = useMemo(() => {
      const values: string[] = [];
      const walk = (nodes: SubtopicHierarchyNode[]) => {
        nodes.forEach((node) => {
          values.push(node.path);
          if (node.children.length > 0) {
            walk(node.children);
          }
        });
      };
      walk(subtopicHierarchy);
      return normalizeSubtopics(values);
    }, [subtopicHierarchy]);

    const addSubtopic = () => {
        const childLabel = subtopicInput.trim();
        if (!childLabel) return;
        const next = normalizeSubtopicPath(
          selectedSubtopicParent
            ? joinSubtopicPath(selectedSubtopicParent, childLabel)
            : childLabel
        );
        if (!next) return;
        if (selectedSubtopics.some((item) => isSameSubtopicPath(item, next))) {
            setSubtopicInput('');
            return;
        }
        setValue('subtopics', normalizeSubtopics([...selectedSubtopics, next]), { shouldDirty: true, shouldValidate: true });
        setSubtopicInput('');
    };

    const selectExistingSubtopic = (target: string) => {
        const next = normalizeSubtopicPath(target);
        if (!next || selectedSubtopics.some((item) => isSameSubtopicPath(item, next))) return;
        setValue('subtopics', normalizeSubtopics([...selectedSubtopics, next]), { shouldDirty: true, shouldValidate: true });
    };

    const removeSubtopic = (target: string) => {
        setValue('subtopics', stripSubtopicBranch(selectedSubtopics, target), { shouldDirty: true, shouldValidate: true });
    };

    const renderSubtopicHierarchyNode = (node: SubtopicHierarchyNode): ReactNode => {
      const isCurrentParent = isSameSubtopicPath(selectedSubtopicParent, node.path);
      const isAddedForCurrentQuestion = selectedSubtopics.some((item) => isSameSubtopicPath(item, node.path));

      return (
        <div key={`subtopic-node-${node.path}`} className="space-y-2" style={{ marginLeft: `${node.depth * 14}px` }}>
          <div className={cn(
            "rounded-lg border p-2.5",
            isCurrentParent ? "border-primary/50 bg-primary/10" : "border-border/70 bg-white/[0.03]"
          )}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{node.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{node.path}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {node.explicit ? (
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    {isAddedForCurrentQuestion ? 'In this question' : 'Existing'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    Branch
                  </Badge>
                )}
                {!isAddedForCurrentQuestion ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 rounded-lg px-2.5"
                    onClick={() => selectExistingSubtopic(node.path)}
                  >
                    Select
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant={isCurrentParent ? 'default' : 'outline'}
                  className={isCurrentParent ? 'h-8 rounded-lg px-2.5' : 'h-8 rounded-lg border-primary/35 bg-primary/10 px-2.5 text-primary hover:bg-primary/20'}
                  onClick={() => {
                    setSelectedSubtopicParent(node.path);
                    setSubtopicInput('');
                  }}
                >
                  {isCurrentParent ? 'Adding here' : 'Add child'}
                </Button>
                {isAddedForCurrentQuestion ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-lg px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeSubtopic(node.path)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          {node.children.length > 0 ? (
            <div className="space-y-2">
              {node.children.map((child) => renderSubtopicHierarchyNode(child))}
            </div>
          ) : null}
        </div>
      );
    };

    const addAlignmentSubtopic = (index: number, parentPathOverride?: string) => {
        const childLabel = (alignmentSubtopicInputByIndex[index] || '').trim();
        if (!childLabel) return;
        const parentPath = normalizeSubtopicPath(parentPathOverride ?? (alignmentSubtopicParentByIndex[index] || ''));
        const next = normalizeSubtopicPath(
          parentPath
            ? joinSubtopicPath(parentPath, childLabel)
            : childLabel
        );
        if (!next) return;
        const current = normalizeSubtopics((form.getValues(`alignments.${index}.subtopics` as const) || []) as string[]);
        if (current.some((item) => isSameSubtopicPath(item, next))) {
            setAlignmentSubtopicInputByIndex((prev) => ({ ...prev, [index]: '' }));
            return;
        }
        setValue(`alignments.${index}.subtopics` as const, normalizeSubtopics([...current, next]) as any, { shouldDirty: true, shouldValidate: true });
        setAlignmentSubtopicInputByIndex((prev) => ({ ...prev, [index]: '' }));
    };

    const selectExistingAlignmentSubtopic = (index: number, target: string) => {
        const next = normalizeSubtopicPath(target);
        if (!next) return;
        const current = normalizeSubtopics((form.getValues(`alignments.${index}.subtopics` as const) || []) as string[]);
        if (current.some((item) => isSameSubtopicPath(item, next))) return;
        setValue(`alignments.${index}.subtopics` as const, normalizeSubtopics([...current, next]) as any, { shouldDirty: true, shouldValidate: true });
    };

    const removeAlignmentSubtopic = (index: number, target: string) => {
        const current = normalizeSubtopics((form.getValues(`alignments.${index}.subtopics` as const) || []) as string[]);
        setValue(
          `alignments.${index}.subtopics` as const,
          stripSubtopicBranch(current, target) as any,
          { shouldDirty: true, shouldValidate: true }
        );
        setAlignmentSubtopicParentByIndex((prev) => {
          const currentParent = prev[index] || '';
          if (!currentParent || !isSubtopicPathWithinBranch(currentParent, target)) return prev;
          return { ...prev, [index]: '' };
        });
    };

    const renderAlignmentSubtopicHierarchyNode = (
      index: number,
      node: SubtopicHierarchyNode,
      selectedAlignmentSubtopics: string[]
    ): ReactNode => {
      const currentParent = alignmentSubtopicParentByIndex[index] || '';
      const isCurrentParent = isSameSubtopicPath(currentParent, node.path);
      const isAddedForAlignment = selectedAlignmentSubtopics.some((item) => isSameSubtopicPath(item, node.path));

      return (
        <div key={`alignment-subtopic-node-${index}-${node.path}`} className="space-y-2" style={{ marginLeft: `${node.depth * 14}px` }}>
          <div className={cn(
            "rounded-lg border p-2.5",
            isCurrentParent ? "border-primary/50 bg-primary/10" : "border-border/70 bg-white/[0.03]"
          )}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{node.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{node.path}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {node.explicit ? (
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    {isAddedForAlignment ? 'In this alignment' : 'Existing'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    Branch
                  </Badge>
                )}
                {!isAddedForAlignment ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 rounded-lg px-2.5"
                    onClick={() => selectExistingAlignmentSubtopic(index, node.path)}
                  >
                    Select
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant={isCurrentParent ? 'default' : 'outline'}
                  className={isCurrentParent ? 'h-8 rounded-lg px-2.5' : 'h-8 rounded-lg border-primary/35 bg-primary/10 px-2.5 text-primary hover:bg-primary/20'}
                  onClick={() => {
                    setAlignmentSubtopicParentByIndex((prev) => ({ ...prev, [index]: node.path }));
                    setAlignmentSubtopicInputByIndex((prev) => ({ ...prev, [index]: '' }));
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
                    onClick={() => removeAlignmentSubtopic(index, node.path)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          {node.children.length > 0 ? (
            <div className="space-y-2">
              {node.children.map((child) => renderAlignmentSubtopicHierarchyNode(index, child, selectedAlignmentSubtopics))}
            </div>
          ) : null}
        </div>
      );
    };

    const insertMathIntoQuestionText = (token: string) => {
        const current = form.getValues('questionText') || '';
        insertTokenAtCursor(current, token, questionTextRef.current, (next) => {
            setValue('questionText', next, { shouldDirty: true, shouldValidate: true });
        });
    };

    const syncCorrectAnswersOnCreateOptionChange = (previousValue: string, nextValue: string) => {
        if (mcqAnswerMode === 'multiple') {
            const current = Array.from(new Set(selectedCorrectAnswers || []));
            if (previousValue && current.includes(previousValue)) {
                const next = nextValue
                    ? current.map((value) => (value === previousValue ? nextValue : value))
                    : current.filter((value) => value !== previousValue);
                setValue('correctAnswers', Array.from(new Set(next)) as any, { shouldValidate: true, shouldDirty: true });
            }
        } else if (selectedCorrectAnswer === previousValue) {
            setValue('correctAnswer', nextValue || '', { shouldValidate: true, shouldDirty: true });
        }
    };

    const insertMathIntoCreateOption = (index: number, token: string) => {
        const currentOptions = (form.getValues('options') || []) as string[];
        const previousValue = currentOptions[index] || '';
        insertTokenAtCursor(previousValue, token, mcqOptionInputRefs.current[index], (nextValue) => {
            setValue(`options.${index}` as any, nextValue, { shouldDirty: true, shouldValidate: true });
            syncCorrectAnswersOnCreateOptionChange(previousValue, nextValue);
        });
    };

    const insertMathIntoCreateNumericalAnswer = (token: string) => {
        const current = String(form.getValues('numericalAnswer') ?? '');
        insertTokenAtCursor(current, token, numericalAnswerRef.current, (nextValue) => {
            setValue('numericalAnswer', nextValue as any, { shouldDirty: true, shouldValidate: true });
            setValue('numericalAnswerText', nextValue as any, { shouldDirty: true });
        });
    };

    const insertMathIntoCreateTextAnswer = (token: string) => {
        const current = form.getValues('textAnswer') || '';
        insertTokenAtCursor(current, token, textAnswerRef.current, (nextValue) => {
            setValue('textAnswer', nextValue as any, { shouldDirty: true, shouldValidate: true });
        });
    };

    const filteredClasses = useMemo(() => {
        if (!selectedExamType || !classes) return [];
        const examScoped = classes.filter((c: any) => c.examTypeId === selectedExamType);
        if (!allowedClassIds || allowedClassIds.length === 0) {
          return examScoped.sort((a: any, b: any) => a.name.localeCompare(b.name));
        }
        return examScoped
          .filter((c: any) => allowedClassIds.includes(c.id))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
    }, [selectedExamType, classes, allowedClassIds]);

    const filteredSubjects = useMemo(() => {
        if (!selectedClass || !subjects) return [];
        const classScoped = subjects.filter((subject: any) => subject.classId === selectedClass);
        if (!allowedSubjectIds || allowedSubjectIds.length === 0) {
          return classScoped.sort((a: any, b: any) => a.name.localeCompare(b.name));
        }
        return classScoped
          .filter((subject: any) => allowedSubjectIds.includes(subject.id))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
    }, [selectedClass, subjects, allowedSubjectIds]);

    const allowedExamTypeIds = useMemo(() => {
        if (!allowedClassIds || allowedClassIds.length === 0) return null;
        return Array.from(new Set((classes || []).filter((c: any) => allowedClassIds.includes(c.id)).map((c: any) => c.examTypeId)));
    }, [classes, allowedClassIds]);

    const teacherScopedExamTypes = useMemo(() => {
        if (!allowedExamTypeIds) return examTypes || [];
        return (examTypes || []).filter((et: any) => allowedExamTypeIds.includes(et.id));
    }, [examTypes, allowedExamTypeIds]);

    const filteredTopics = useMemo(() => {
        if (!selectedSubject || !topics) return [];
        return topics
          .filter((topic: any) => topic.subjectId === selectedSubject)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
    }, [selectedSubject, topics]);
    const selectedTopicName = useMemo(
      () => (filteredTopics || []).find((topic: any) => topic.id === selectedTopic)?.name || '',
      [filteredTopics, selectedTopic]
    );

    useEffect(() => {
        setValue('classId', '');
        setValue('subjectId', '');
        setValue('topicId', '');
    }, [selectedExamType, setValue]);

    useEffect(() => {
        setValue('subjectId', '');
        setValue('topicId', '');
    }, [selectedClass, setValue]);

    useEffect(() => {
        setValue('topicId', '');
        setValue('subtopics', [] as any);
    }, [selectedSubject, setValue]);

    useEffect(() => {
      setSelectedSubtopicParent('');
    }, [selectedTopic]);

    useEffect(() => {
      setSubtopicInput('');
      setValue('subtopics', [] as any, { shouldDirty: true, shouldValidate: true });
    }, [selectedTopic, setValue]);

    useEffect(() => {
      if (!selectedSubtopicParent) return;
      const parentStillExists = subtopicHierarchyPaths.some((item) => isSameSubtopicPath(item, selectedSubtopicParent));
      if (!parentStillExists) {
        setSelectedSubtopicParent('');
      }
    }, [subtopicHierarchyPaths, selectedSubtopicParent]);

    useEffect(() => {
        if (!formResetSignal) return;
        setMcqOptionCount(4);
        setQuestionPdfFile(null);
        setQuestionPdfPage(1);
        setExtractedQuestionText('');
        setQuestionUploadMode('ocr');
        setMcqOptionsPdfFile(null);
        setMcqOptionsPdfPage(1);
        setSolutionAttachFile(null);
        setSolutionAttachPage(1);
        setSubtopicInput('');
        setSelectedSubtopicParent('');
    }, [formResetSignal]);

    useEffect(() => {
        if (!clearQuestionContentSignal) return;
        setExtractedQuestionText('');
    }, [clearQuestionContentSignal]);

    useEffect(() => {
      setValue('questionTitle', autoQuestionTitle, { shouldDirty: false, shouldValidate: false });
    }, [autoQuestionTitle, setValue]);

    useEffect(() => {
        setOpenCreateOptionMathToolByIndex({});
        setShowCreateNumericalAnswerMathTool(false);
        setShowCreateTextAnswerMathTool(false);
    }, [questionType]);

    useEffect(() => {
        setOpenCreateOptionMathToolByIndex((prev) => {
            const next: Record<number, boolean> = {};
            for (let index = 0; index < mcqOptionCount; index += 1) {
                if (prev[index]) next[index] = true;
            }
            return next;
        });
    }, [mcqOptionCount]);

    useEffect(() => {
      setAlignmentSubtopicInputByIndex((prev) => {
        const next: Record<number, string> = {};
        alignmentFields.forEach((_, index) => {
          if (prev[index]) next[index] = prev[index];
        });
        return next;
      });
    }, [alignmentFields]);

    useEffect(() => {
      setAlignmentSubtopicParentByIndex((prev) => {
        const next: Record<number, string> = {};
        alignmentFields.forEach((_, index) => {
          if (prev[index]) next[index] = prev[index];
        });
        return next;
      });
    }, [alignmentFields]);

    useEffect(() => {
        if (questionType !== 'MCQ') return;
        const targetCount = Math.max(2, Math.min(8, mcqOptionCount || 4));
        const currentOptions = Array.isArray(watchedOptions) ? watchedOptions : [];
        if (currentOptions.length === targetCount) return;

        const resizedOptions = Array.from({ length: targetCount }, (_, index) => currentOptions[index] || '');
        setValue('options', resizedOptions as any);
        if (!resizedOptions.includes(selectedCorrectAnswer || '')) {
            setValue('correctAnswer', '');
        }
        if (mcqAnswerMode === 'multiple') {
            const next = (selectedCorrectAnswers || []).filter((value) => resizedOptions.includes(value));
            if (next.length !== (selectedCorrectAnswers || []).length) {
                setValue('correctAnswers', next as any);
            }
        }
    }, [questionType, mcqOptionCount, watchedOptions, selectedCorrectAnswer, selectedCorrectAnswers, mcqAnswerMode, setValue]);

    useEffect(() => {
        // Keep validation satisfied when image-only upload is used and text input is hidden.
        if (!hasUploadedQuestionImage) return;
        if (watchedQuestionText) return;
        setValue('questionText', 'Question attached as image', { shouldDirty: true, shouldValidate: true });
    }, [hasUploadedQuestionImage, watchedQuestionText, setValue]);

    const applyExtractedDraftToForm = (draft: ExtractedQuestionDraft) => {
        if (!draft.rawText) return;
        if (draft.questionText) setValue('questionText', draft.questionText);

        if (questionType === 'MCQ') {
            const normalizedOptions = Array.from({ length: mcqOptionCount }, (_, index) => draft.options[index] || '');
            setValue('options', normalizedOptions as any);
            if (draft.correctAnswer && normalizedOptions.includes(draft.correctAnswer)) {
                if (mcqAnswerMode === 'multiple') {
                    setValue('correctAnswers', [draft.correctAnswer] as any);
                } else {
                    setValue('correctAnswer', draft.correctAnswer);
                    setValue('correctAnswers', [] as any);
                }
            } else {
                if (mcqAnswerMode === 'multiple') {
                    setValue('correctAnswers', [] as any);
                } else {
                    setValue('correctAnswer', '');
                }
            }
        } else if (questionType === 'Numerical') {
            if (typeof draft.numericalAnswer === 'number' && !Number.isNaN(draft.numericalAnswer)) {
                setValue('numericalAnswer', draft.numericalAnswer as any);
                setValue('numericalAnswerText', String(draft.numericalAnswer) as any);
            }
        } else if (questionType === 'Text') {
            if (draft.textAnswer) setValue('textAnswer', draft.textAnswer as any);
        }
    };

    const handleQuestionImageCropped = async (data: { imageUrl: string; extractedText?: string }) => {
        if (questionUploadMode === 'image') {
            if (!currentUserId) {
                toast({
                    variant: 'destructive',
                    title: 'Image upload failed',
                    description: 'You must be signed in to attach question images.',
                });
                return;
            }
            try {
                const uploadedImageUrl = await uploadPracticeQuestionImage(storage, currentUserId, 'question', data.imageUrl);
                const currentUrls = form.getValues('imageUrls') || [];
                setValue('imageUrls', [...currentUrls, uploadedImageUrl], { shouldDirty: true, shouldValidate: true });
                toast({
                    title: 'Question image added',
                    description: 'Cropped image uploaded and attached for this question.',
                });
            } catch (error: any) {
                console.error('Question image upload failed:', error);
                toast({
                    variant: 'destructive',
                    title: 'Image upload failed',
                    description: error?.message || 'Could not upload the cropped question image.',
                });
            }
            return;
        }

        if (data.extractedText && data.extractedText.trim()) {
            const raw = data.extractedText.trim();
            setExtractedQuestionText(raw);
            const currentText = (form.getValues('questionText') || '').trim();
            if (currentText) {
                const shouldAppend = !currentText || !currentText.includes(raw);
                const mergedText = shouldAppend
                    ? (currentText ? `${currentText}\n${raw}` : raw)
                    : currentText;
                setValue('questionText', mergedText);
                toast({
                    title: 'OCR continuation added',
                    description: 'Next page text was appended to Question Text.',
                });
                return;
            }
            const draft = buildExtractedDraft(raw, questionType || 'MCQ', mcqOptionCount);
            applyExtractedDraftToForm(draft);
            toast({
                title: 'OCR completed',
                description: 'Question and options were auto-filled. You can edit manually before saving.',
            });
            return;
        }

        toast({
            variant: 'destructive',
            title: 'No text extracted',
            description: 'OCR mode does not save question images. Please crop again or type question text manually.',
        });
    };

    const handleMcqOptionsOcrCropped = (data: { imageUrl: string; extractedText?: string }) => {
        if (!data.extractedText || !data.extractedText.trim()) {
            toast({
                variant: 'destructive',
                title: 'No text extracted',
                description: 'Please crop the options area and try again.',
            });
            return;
        }
        const parsed = extractMcqOptionsOnly(data.extractedText, mcqOptionCount);
        const extracted = (parsed.options || []).map((item) => String(item || '').trim()).filter(Boolean);
        if (extracted.length === 0) {
            toast({
                variant: 'destructive',
                title: 'No options detected',
                description: 'OCR could not detect option text. Please crop more tightly around options.',
            });
            return;
        }

        const currentOptions = Array.from({ length: mcqOptionCount }, (_, index) => String((form.getValues('options') || [])[index] || '').trim());
        const hasExistingOptions = currentOptions.some((item) => !!item);
        const normalizedOptions = [...currentOptions];

        if (!hasExistingOptions) {
            extracted.forEach((value, index) => {
                if (index < normalizedOptions.length) normalizedOptions[index] = value;
            });
        } else {
            let consumed = 0;
            for (let index = 0; index < normalizedOptions.length && consumed < extracted.length; index += 1) {
                if (!normalizedOptions[index]) {
                    normalizedOptions[index] = extracted[consumed];
                    consumed += 1;
                }
            }
            if (consumed === 0) {
                toast({
                    title: 'All options already filled',
                    description: 'OCR text was not applied because no empty option field was found.',
                });
            }
        }

        setValue('options', normalizedOptions as any);
        if (parsed.correctAnswer && normalizedOptions.includes(parsed.correctAnswer)) {
            if (mcqAnswerMode === 'multiple') {
                setValue('correctAnswers', [parsed.correctAnswer] as any);
            } else {
                setValue('correctAnswer', parsed.correctAnswer);
                setValue('correctAnswers', [] as any);
            }
        }
        toast({
            title: 'MCQ options updated',
            description: parsed.correctAnswer
                ? 'Options were updated from OCR and correct answer was matched.'
                : hasExistingOptions
                    ? 'OCR text was applied to the next empty option(s).'
                    : 'Options were filled from OCR.',
        });
    };

    const handleSolutionAttachmentCropped = async (data: { imageUrl: string }) => {
        if (!currentUserId) {
            toast({
                variant: 'destructive',
                title: 'Image upload failed',
                description: 'You must be signed in to attach solution images.',
            });
            return;
        }
        try {
            const uploadedImageUrl = await uploadPracticeQuestionImage(storage, currentUserId, 'solution', data.imageUrl);
            const currentUrls = form.getValues('explanationImageUrls') || [];
            setValue('explanationImageUrls', [...currentUrls, uploadedImageUrl], { shouldDirty: true, shouldValidate: true });
            toast({
                title: 'Cropped area attached',
                description: 'Selected solution area was uploaded and attached.',
            });
        } catch (error: any) {
            console.error('Solution image upload failed:', error);
            toast({
                variant: 'destructive',
                title: 'Image upload failed',
                description: error?.message || 'Could not upload the cropped solution image.',
            });
        }
    };

    const handleCreateTopic = async () => {
        if (!selectedSubject || isCreatingTopic) return;
        const name = window.prompt('Enter new topic name');
        const trimmedName = (name || '').trim();
        if (!trimmedName) return;
        try {
            setIsCreatingTopic(true);
            const created = await addDocumentNonBlocking(collection(firestore, 'topics'), {
                name: trimmedName,
                subjectId: selectedSubject,
                teacherId: questionBankOwnerId || currentUserId || null,
            });
            const createdId = (created as any)?.id;
            if (createdId) {
                setValue('topicId', createdId);
            }
            toast({ title: 'Topic created', description: `"${trimmedName}" has been added.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Topic creation failed', description: error?.message || 'Could not create topic.' });
        } finally {
            setIsCreatingTopic(false);
        }
    };

    const handleDeleteTopic = async () => {
        if (!selectedTopic || isDeletingTopic) return;
        if (selectedTopicQuestionCount > 0) {
            toast({
                variant: 'destructive',
                title: 'Cannot delete topic',
                description: `This topic is linked with ${selectedTopicQuestionCount} question(s). Delete or move those questions first.`,
            });
            return;
        }
        const topicLabel = selectedTopicName || 'this topic';
        const shouldDelete = window.confirm(`Delete "${topicLabel}" permanently? This cannot be undone.`);
        if (!shouldDelete) return;
        try {
            setIsDeletingTopic(true);
            await deleteDoc(doc(firestore, 'topics', selectedTopic));
            setValue('topicId', '', { shouldDirty: true, shouldValidate: true });
            setValue('subtopics', [] as any, { shouldDirty: true, shouldValidate: true });
            setSelectedSubtopicParent('');
            toast({
                title: 'Topic deleted',
                description: `"${topicLabel}" was removed.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Topic delete failed',
                description: error?.message || 'Could not delete topic.',
            });
        } finally {
            setIsDeletingTopic(false);
        }
    };

    const renderAdditionalAlignmentsSection = () => (
      <div className={`space-y-4 rounded-2xl border p-4 transition-all md:p-5 ${isClassificationReady ? 'border-primary/20 bg-gradient-to-br from-primary/12 via-slate-800/35 to-slate-900/25' : 'bg-muted/20 opacity-90'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">1A</span>
            <h3 className="text-base font-semibold md:text-lg">Additional Alignments (Optional)</h3>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-xl border-primary/35 bg-primary/10 px-4 text-primary hover:bg-primary/20"
            onClick={() => appendAlignment({
              examTypeId: '',
              classId: '',
              subjectId: '',
              topicId: '',
              subtopics: [],
              accessLevel: watch('accessLevel') || 'free',
              mockTestOnly: !!watch('mockTestOnly'),
              difficultyLevel: 'Easy' as const,
              isPreviousYear: false,
              previousYear: '',
            } as never)}
            disabled={!isClassificationReady}
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add Alignment
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Use alignments to map this same question to additional exam/curriculum/subject/topic categories.</p>
        {alignmentFields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-white/[0.03] p-3 text-sm text-muted-foreground">
            No additional alignments yet. Click <span className="font-medium text-foreground">Add Alignment</span> to include this question in more categories.
          </div>
        ) : null}
        {alignmentFields.map((alignment, index) => {
          const aExam = watch(`alignments.${index}.examTypeId` as const);
          const aClass = watch(`alignments.${index}.classId` as const);
          const aSubject = watch(`alignments.${index}.subjectId` as const);
          const aTopic = watch(`alignments.${index}.topicId` as const);
          const alignmentClassesBase = (classes || []).filter((c: any) => c.examTypeId === aExam);
          const alignmentClasses = (allowedClassIds && allowedClassIds.length > 0)
            ? alignmentClassesBase.filter((c: any) => allowedClassIds.includes(c.id))
            : alignmentClassesBase;
          const alignmentSubjectsBase = (subjects || []).filter((s: any) => s.classId === aClass);
          const alignmentSubjects = (allowedSubjectIds && allowedSubjectIds.length > 0)
            ? alignmentSubjectsBase.filter((s: any) => allowedSubjectIds.includes(s.id))
            : alignmentSubjectsBase;
          const alignmentTopics = (topics || []).filter((t: any) => t.subjectId === aSubject);
          const alignmentSubtopics = normalizeSubtopics((watch(`alignments.${index}.subtopics` as const) || []) as string[]);
          const alignmentIsPreviousYear = !!watch(`alignments.${index}.isPreviousYear` as const);
          const alignmentTopicSubtopicCatalog = getTopicSubtopicCatalog(aTopic || '');
          const alignmentAvailableParentSubtopics = normalizeSubtopics([
            ...alignmentSubtopics,
            ...alignmentTopicSubtopicCatalog,
          ]);
          const alignmentSubtopicHierarchy = buildSubtopicHierarchy(alignmentAvailableParentSubtopics);
          const selectedAlignmentParent = alignmentSubtopicParentByIndex[index] || '';
          const effectiveAlignmentParent = selectedAlignmentParent
            && alignmentAvailableParentSubtopics.some((item) => isSameSubtopicPath(item, selectedAlignmentParent))
              ? selectedAlignmentParent
              : '';
          const alignmentQuestionNumber = alignmentQuestionNumbersByIndex[index] || 0;
          const alignmentQuestionTitle = alignmentQuestionNumber > 0 ? buildQuestionTitle(alignmentQuestionNumber) : '';

          return (
            <div key={alignment.id} className="space-y-4 rounded-xl border border-border/70 bg-white/[0.03] p-4 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.65)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary">
                  Alignment {index + 1}
                </Badge>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => removeAlignment(index)}
                  disabled={!isClassificationReady}
                  className="h-9 rounded-xl bg-red-500/90 px-4 text-white hover:bg-red-500"
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove Alignment
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormField control={control} name={`alignments.${index}.examTypeId` as const} render={({ field }) => (
                  <FormItem className="space-y-2"><FormLabel>Exam Type</FormLabel><Select onValueChange={(value) => { field.onChange(value); setValue(`alignments.${index}.classId` as const, ''); setValue(`alignments.${index}.subjectId` as const, ''); setValue(`alignments.${index}.topicId` as const, ''); setValue(`alignments.${index}.subtopics` as const, [] as never); setAlignmentSubtopicParentByIndex((prev) => ({ ...prev, [index]: '' })); setAlignmentSubtopicInputByIndex((prev) => ({ ...prev, [index]: '' })); }} value={field.value} disabled={!isClassificationReady}><FormControl><SelectTrigger className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]"><SelectValue placeholder="Select exam type" /></SelectTrigger></FormControl><SelectContent>{teacherScopedExamTypes.map((et: any) => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={control} name={`alignments.${index}.classId` as const} render={({ field }) => (
                  <FormItem className="space-y-2"><FormLabel>Curriculum/Class</FormLabel><Select onValueChange={(value) => { field.onChange(value); setValue(`alignments.${index}.subjectId` as const, ''); setValue(`alignments.${index}.topicId` as const, ''); setValue(`alignments.${index}.subtopics` as const, [] as never); setAlignmentSubtopicParentByIndex((prev) => ({ ...prev, [index]: '' })); setAlignmentSubtopicInputByIndex((prev) => ({ ...prev, [index]: '' })); }} value={field.value} disabled={!aExam || !isClassificationReady}><FormControl><SelectTrigger className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]"><SelectValue placeholder="Select class" /></SelectTrigger></FormControl><SelectContent>{alignmentClasses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={control} name={`alignments.${index}.subjectId` as const} render={({ field }) => (
                  <FormItem className="space-y-2"><FormLabel>Subject</FormLabel><Select onValueChange={(value) => { field.onChange(value); setValue(`alignments.${index}.topicId` as const, ''); setValue(`alignments.${index}.subtopics` as const, [] as never); setAlignmentSubtopicParentByIndex((prev) => ({ ...prev, [index]: '' })); setAlignmentSubtopicInputByIndex((prev) => ({ ...prev, [index]: '' })); }} value={field.value} disabled={!aClass || !isClassificationReady}><FormControl><SelectTrigger className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]"><SelectValue placeholder="Select subject" /></SelectTrigger></FormControl><SelectContent>{alignmentSubjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={control} name={`alignments.${index}.topicId` as const} render={({ field }) => (
                  <FormItem className="space-y-2"><FormLabel>Topic</FormLabel><Select onValueChange={(value) => { field.onChange(value); setValue(`alignments.${index}.subtopics` as const, [] as never); setAlignmentSubtopicParentByIndex((prev) => ({ ...prev, [index]: '' })); setAlignmentSubtopicInputByIndex((prev) => ({ ...prev, [index]: '' })); }} value={field.value} disabled={!aSubject || !isClassificationReady}><FormControl><SelectTrigger className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]"><SelectValue placeholder="Select topic" /></SelectTrigger></FormControl><SelectContent>{alignmentTopics.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                
                <FormField control={control} name={`alignments.${index}.accessLevel` as const} render={({ field }) => (
                  <FormItem className="space-y-2"><FormLabel>Question Access</FormLabel><Select onValueChange={field.onChange} value={field.value || 'free'} disabled={!isClassificationReady}><FormControl><SelectTrigger className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]"><SelectValue placeholder="Select access" /></SelectTrigger></FormControl><SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={control} name={`alignments.${index}.mockTestOnly` as const} render={({ field }) => (
                  <FormItem className="space-y-2"><FormLabel>Mock Test Usage</FormLabel><Select onValueChange={(value) => field.onChange(value === 'yes')} value={field.value ? 'yes' : 'no'} disabled={!isClassificationReady}><FormControl><SelectTrigger className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]"><SelectValue placeholder="Select usage" /></SelectTrigger></FormControl><SelectContent><SelectItem value="no">Student Use + Official Mock Test</SelectItem><SelectItem value="yes">Teacher Official Mock Test</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={control} name={`alignments.${index}.isPreviousYear` as const} render={({ field }) => (
                  <FormItem className="space-y-2"><FormLabel>Previous Year Question</FormLabel><Select onValueChange={(value) => field.onChange(value === 'yes')} value={field.value ? 'yes' : 'no'} disabled={!isClassificationReady}><FormControl><SelectTrigger className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]"><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="no">No</SelectItem><SelectItem value="yes">Yes</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={control} name={`alignments.${index}.previousYear` as const} render={({ field }) => (
                  <FormItem className="space-y-2"><FormLabel>Previous Year</FormLabel><FormControl><Input className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]" type="number" placeholder="e.g., 2020" {...field} value={field.value || ''} disabled={!alignmentIsPreviousYear || !isClassificationReady} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormItem className="space-y-2">
                  <FormLabel>Question Number (Auto)</FormLabel>
                  <FormControl>
                    <Input className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]" value={alignmentQuestionTitle} readOnly disabled placeholder="Complete alignment setup first" />
                  </FormControl>
                  <FormDescription>Auto-increments for the selected alignment category.</FormDescription>
                </FormItem>
              </div>

              <div className="space-y-3 rounded-xl border border-border/70 bg-white/[0.03] p-4">
                <FormLabel>Subtopic Builder (Optional)</FormLabel>
                <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full border-primary/35 bg-primary/10 text-primary">
                      {effectiveAlignmentParent ? `Parent: ${effectiveAlignmentParent}` : 'Parent: Topic (Top-level)'}
                    </Badge>
                    {effectiveAlignmentParent ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg px-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        onClick={() => {
                          setAlignmentSubtopicParentByIndex((prev) => ({ ...prev, [index]: '' }));
                          setAlignmentSubtopicInputByIndex((prev) => ({ ...prev, [index]: '' }));
                        }}
                      >
                        Switch to top-level
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                    <Input
                      className="h-11 rounded-xl border-slate-400/30 bg-white/[0.04]"
                      placeholder={effectiveAlignmentParent ? `Type child subtopic under ${effectiveAlignmentParent}` : 'Type top-level subtopic (e.g., Kinematics)'}
                      value={alignmentSubtopicInputByIndex[index] || ''}
                      onChange={(event) => setAlignmentSubtopicInputByIndex((prev) => ({ ...prev, [index]: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addAlignmentSubtopic(index, effectiveAlignmentParent);
                        }
                      }}
                      disabled={!aTopic || !isClassificationReady}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addAlignmentSubtopic(index, effectiveAlignmentParent)}
                      disabled={!aTopic || !isClassificationReady}
                      className="h-11 rounded-xl border-primary/35 bg-primary/10 px-5 text-primary hover:bg-primary/20"
                    >
                      {effectiveAlignmentParent ? 'Add Child Subtopic' : 'Add Top-level Subtopic'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use "Select" to tag this alignment into an existing subtopic, or "Add child" to create nested levels.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Visual Subtopic Tree
                  </p>
                  {!aTopic ? (
                    <div className="rounded-lg border border-dashed border-border/60 bg-white/[0.02] p-3 text-sm text-muted-foreground">
                      Select an alignment topic first to start its subtopic hierarchy.
                    </div>
                  ) : isSubtopicCatalogLoading && alignmentSubtopicHierarchy.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-white/[0.02] p-3 text-sm text-muted-foreground">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Loading shared DCAM subtopics...
                    </div>
                  ) : alignmentSubtopicHierarchy.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/60 bg-white/[0.02] p-3 text-sm text-muted-foreground">
                      No subtopics yet for this alignment. Start with a top-level subtopic above.
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-xl border border-border/70 bg-white/[0.02] p-3">
                      {alignmentSubtopicHierarchy.map((node) => (
                        renderAlignmentSubtopicHierarchyNode(index, node, alignmentSubtopics)
                      ))}
                    </div>
                  )}
                </div>
                <FormDescription>Add topic-specific subtopics for this alignment.</FormDescription>
              </div>
            </div>
          );
        })}
      </div>
    );

    return (
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 grid gap-8">
            <div className='space-y-8'>
                {!isBankOnlyView && (
                <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/70 shadow-[0_24px_80px_-42px_rgba(56,189,248,0.45)]">
                    <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/16 blur-3xl" />
                    <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-full bg-gradient-to-r from-cyan-400/14 via-transparent to-transparent" />
                    <CardHeader className="relative space-y-5 pb-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <Badge className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                                Teacher Question Studio
                            </Badge>
                            <Badge variant="outline" className={cn(
                                "rounded-full px-3 py-1 text-xs font-semibold",
                                isClassificationReady
                                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                                    : "border-border/70 bg-white/[0.04] text-muted-foreground"
                            )}>
                                {isClassificationReady ? 'Ready For Upload' : 'Setup In Progress'}
                            </Badge>
                        </div>
                        <CardTitle className="flex items-start gap-3 font-headline text-2xl md:text-3xl">
                            <span className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary shadow-[0_12px_28px_-20px_rgba(59,130,246,0.9)]">
                                <Sparkles className="h-5 w-5" />
                            </span>
                            <span className="leading-tight">Create New DCAM Question Bank Entry</span>
                        </CardTitle>
                        <CardDescription className="max-w-5xl text-sm leading-relaxed text-muted-foreground/95 md:text-[15px]">
                            Use this production-grade workflow to classify and upload questions faster: set taxonomy, choose answer format, extract/crop content, and publish directly into your bank.
                        </CardDescription>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Setup Progress</p>
                                <p className="mt-1 text-lg font-semibold text-foreground">{setupCompletionPercentage}% complete</p>
                                <p className="text-xs text-muted-foreground">{completedSetupMilestones}/{setupMilestones.length} fields ready</p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-white/[0.05] p-3">
                                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Topic Coverage</p>
                                <p className="mt-1 text-lg font-semibold text-foreground">{selectedTopicQuestionCount}</p>
                                <p className="text-xs text-muted-foreground">{selectedTopic ? 'existing question(s) in this topic' : 'select a topic to view count'}</p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-white/[0.05] p-3">
                                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"><UploadCloud className="h-3.5 w-3.5" /> Attached Media</p>
                                <p className="mt-1 text-lg font-semibold text-foreground">{totalAttachedMediaCount}</p>
                                <p className="text-xs text-muted-foreground">question + explanation image assets</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <div className="relative space-y-5 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/12 via-slate-800/40 to-slate-900/30 p-4 md:p-6">
                                        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-primary/25 via-transparent to-transparent" />
                                        <div className="relative flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground shadow-sm">1</span>
                                                <h3 className="flex items-center gap-2 text-base font-semibold md:text-lg">
                                                    <FolderTree className="h-4 w-4 text-primary" />
                                                    Select Exam, Curriculum, Subject, and Topic
                                                </h3>
                                            </div>
                                            <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-xs text-primary">
                                                Taxonomy Setup
                                            </Badge>
                                        </div>
                                        <p className="relative text-sm text-muted-foreground">Curriculum and subject options are linked to your teaching profile from the dashboard.</p>
                                        <div className="relative flex flex-wrap items-center gap-2">
                                            {setupMilestones.map((item) => (
                                                <Badge
                                                    key={`setup-${item.key}`}
                                                    variant="outline"
                                                    className={cn(
                                                        "rounded-full border px-2.5 py-1 text-[11px]",
                                                        item.done
                                                            ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
                                                            : "border-border/70 bg-white/[0.04] text-muted-foreground"
                                                    )}
                                                >
                                                    {item.done ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : null}
                                                    {item.label}
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="relative grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                            <FormField control={control} name="examTypeId" render={({ field }) => (
                                                <FormItem className="space-y-2"><FormLabel>Exam Type</FormLabel>
                                                    <Select onValueChange={(value) => field.onChange(value)} value={field.value}>
                                                        <FormControl><SelectTrigger className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]"><SelectValue placeholder="Select an exam type" /></SelectTrigger></FormControl>
                                                        <SelectContent>{teacherScopedExamTypes?.map((et: any) => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={control} name="classId" render={({ field }) => (
                                                <FormItem className="space-y-2"><FormLabel>Curriculum/Class</FormLabel>
                                                    <Select onValueChange={(value) => field.onChange(value)} value={field.value} disabled={!selectedExamType}>
                                                        <FormControl><SelectTrigger className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]"><SelectValue placeholder="Select a class" /></SelectTrigger></FormControl>
                                                        <SelectContent>{filteredClasses?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={control} name="subjectId" render={({ field }) => (
                                                <FormItem className="space-y-2"><FormLabel>Subject</FormLabel>
                                                    <Select onValueChange={(value) => field.onChange(value)} value={field.value} disabled={!selectedClass}>
                                                        <FormControl><SelectTrigger className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]"><SelectValue placeholder="Select a subject" /></SelectTrigger></FormControl>
                                                        <SelectContent>{filteredSubjects.map((subject: any) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={control} name="topicId" render={({ field }) => (
                                                <FormItem className="md:col-span-2 xl:col-span-3 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <FormLabel>Topic</FormLabel>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Button type="button" variant="outline" size="sm" onClick={handleCreateTopic} disabled={!selectedSubject || isCreatingTopic} className="h-10 rounded-xl border-primary/35 bg-primary/10 px-4 text-primary hover:bg-primary/20">
                                                                {isCreatingTopic ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                                                Create Topic
                                                            </Button>
                                                            <Button type="button" variant="destructive" size="sm" onClick={handleDeleteTopic} disabled={!selectedTopic || isDeletingTopic} className="h-10 rounded-xl bg-red-500/90 px-4 text-white hover:bg-red-500">
                                                                {isDeletingTopic ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                                                Delete Topic
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <Select onValueChange={(value) => {
                                                        field.onChange(value);
                                                        setValue('subtopics', [] as any, { shouldDirty: true, shouldValidate: true });
                                                        setSelectedSubtopicParent('');
                                                        setSubtopicInput('');
                                                    }} value={field.value} disabled={!selectedSubject || isTopicOptionsLoading}>
                                                        <FormControl><SelectTrigger className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]"><SelectValue placeholder={isTopicOptionsLoading ? "Loading topics..." : "Select a topic"} /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            {isTopicOptionsLoading ? (
                                                                <SelectItem value="__loading_topics" disabled>Loading topics...</SelectItem>
                                                            ) : filteredTopics.map((topic: any) => <SelectItem key={topic.id} value={topic.id}>{topic.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField
                                                control={control}
                                                name="subtopics"
                                                render={() => (
                                                    <FormItem className="md:col-span-2 xl:col-span-3 space-y-3 rounded-xl border border-border/70 bg-white/[0.03] p-4">
                                                        <FormLabel>Subtopic Builder For {selectedTopicName || 'Selected Topic'} (Optional)</FormLabel>
                                                        <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <Badge variant="outline" className="rounded-full border-primary/35 bg-primary/10 text-primary">
                                                                    {selectedSubtopicParent ? `Parent: ${selectedSubtopicParent}` : 'Parent: Topic (Top-level)'}
                                                                </Badge>
                                                                {selectedSubtopicParent ? (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 rounded-lg px-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                                                        onClick={() => {
                                                                            setSelectedSubtopicParent('');
                                                                            setSubtopicInput('');
                                                                        }}
                                                                    >
                                                                        Switch to top-level
                                                                    </Button>
                                                                ) : null}
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                                                                <Input
                                                                    className="h-11 rounded-xl border-slate-400/30 bg-white/[0.04]"
                                                                    placeholder={selectedSubtopicParent ? `Type child subtopic under ${selectedSubtopicParent}` : "Type top-level subtopic (e.g., Kinematics)"}
                                                                    value={subtopicInput}
                                                                    onChange={(event) => setSubtopicInput(event.target.value)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === 'Enter') {
                                                                            event.preventDefault();
                                                                            addSubtopic();
                                                                        }
                                                                    }}
                                                                    disabled={!selectedTopic}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    onClick={addSubtopic}
                                                                    disabled={!selectedTopic}
                                                                    className="h-11 rounded-xl border-primary/35 bg-primary/10 px-5 text-primary hover:bg-primary/20"
                                                                >
                                                                    {selectedSubtopicParent ? 'Add Child Subtopic' : 'Add Top-level Subtopic'}
                                                                </Button>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                Use "Select" to tag this question into an existing subtopic, or "Add child" to create nested levels.
                                                            </p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                                                Visual Subtopic Tree
                                                            </p>
                                                            {!selectedTopic ? (
                                                                <div className="rounded-lg border border-dashed border-border/60 bg-white/[0.02] p-3 text-sm text-muted-foreground">
                                                                    Select a topic first to start building its subtopic hierarchy.
                                                                </div>
                                                            ) : isSubtopicCatalogLoading && subtopicHierarchy.length === 0 ? (
                                                                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-white/[0.02] p-3 text-sm text-muted-foreground">
                                                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                                                    Loading shared DCAM subtopics...
                                                                </div>
                                                            ) : subtopicHierarchy.length === 0 ? (
                                                                <div className="rounded-lg border border-dashed border-border/60 bg-white/[0.02] p-3 text-sm text-muted-foreground">
                                                                    No subtopics yet. Start with a top-level subtopic above.
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2 rounded-xl border border-border/70 bg-white/[0.02] p-3">
                                                                    {subtopicHierarchy.map((node) => renderSubtopicHierarchyNode(node))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <FormDescription>
                                                            {selectedTopicName
                                                                ? `Build subtopics visually: add top-level first, then use "Add child" inside each subtopic box to create deeper levels.`
                                                                : 'Select a topic first. Then you can create nested subtopics in a box-style hierarchy.'}
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            
                                            <FormField control={control} name="accessLevel" render={({ field }) => (
                                                <FormItem className="space-y-2"><FormLabel>Question Access</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]"><SelectValue placeholder="Select access" /></SelectTrigger></FormControl><SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={control} name="mockTestOnly" render={({ field }) => (
                                                <FormItem className="space-y-2"><FormLabel>Mock Test Usage</FormLabel><Select onValueChange={(value) => field.onChange(value === 'yes')} value={field.value ? 'yes' : 'no'}><FormControl><SelectTrigger className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]"><SelectValue placeholder="Select usage" /></SelectTrigger></FormControl><SelectContent><SelectItem value="no">Student Use + Official Mock Test</SelectItem><SelectItem value="yes">Teacher Official Mock Test</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={control} name="isPreviousYear" render={({ field }) => (
                                                <FormItem className="space-y-2"><FormLabel>Previous Year Question</FormLabel><Select onValueChange={(value) => field.onChange(value === 'yes')} value={field.value ? 'yes' : 'no'}><FormControl><SelectTrigger className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]"><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="no">No</SelectItem><SelectItem value="yes">Yes</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                            )} />
                                            {selectedIsPreviousYear ? (
                                                <FormField control={control} name="previousYear" render={({ field }) => (
                                                    <FormItem className="space-y-2"><FormLabel>Previous Year</FormLabel><FormControl><Input className="h-12 rounded-xl border-slate-400/30 bg-white/[0.04]" type="number" placeholder="e.g., 2020" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                                                )} />
                                            ) : null}
                                        </div>
                                        <div className="rounded-xl border border-border/70 bg-white/[0.04] p-3 text-sm">
                                            <p className="mb-2 flex items-center gap-2 font-medium">
                                                <ShieldCheck className="h-4 w-4 text-primary" />
                                                Selection Summary
                                            </p>
                                            <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-5">
                                                {setupMilestones.map((item) => (
                                                    <div
                                                        key={`summary-${item.key}`}
                                                        className={cn(
                                                            "rounded-lg border px-2.5 py-2",
                                                            item.done
                                                                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                                                                : "border-border/70 bg-white/[0.03]"
                                                        )}
                                                    >
                                                        <p className="font-medium">{item.label}</p>
                                                        <p>{item.done ? 'Selected' : 'Pending'}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {renderAdditionalAlignmentsSection()}

                                    <div className={`space-y-3 rounded-2xl border p-4 transition-all md:p-5 ${isClassificationReady ? 'border-primary/20 bg-gradient-to-br from-primary/12 via-slate-800/35 to-slate-900/25' : 'bg-muted/20 opacity-90'}`}>
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">2</span>
                                            <h3 className="text-base font-semibold md:text-lg">Choose Question Type and Content Format</h3>
                                        </div>
                                        {!isClassificationReady ? (
                                            <p className="rounded-md border border-dashed p-2 text-sm text-muted-foreground">Complete Step 1 first to unlock question format and content fields.</p>
                                        ) : null}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField control={control} name="questionType" render={({ field }) => (
                                                <FormItem className="space-y-3"><FormLabel>Question Type</FormLabel>
                                                    <FormControl>
                                                        <RadioGroup onValueChange={(value) => {
                                                            const nextType = value as 'MCQ' | 'Numerical' | 'Text';
                                                            setValue('questionType', nextType, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                                                            if (value === 'MCQ') {
                                                                setMcqOptionCount(4);
                                                                setValue('options', ['', '', '', ''] as any);
                                                                setValue('mcqAnswerMode', 'single' as any);
                                                                setValue('correctAnswer', '');
                                                                setValue('correctAnswers', [] as any);
                                                                setValue('numericalAnswer', undefined as any);
                                                                setValue('numericalAnswerText', undefined as any);
                                                                setValue('textAnswer', undefined as any);
                                                            } else if (value === 'Numerical') {
                                                                setValue('options', undefined as any);
                                                                setValue('mcqAnswerMode', undefined as any);
                                                                setValue('correctAnswer', undefined as any);
                                                                setValue('correctAnswers', undefined as any);
                                                                setValue('numericalAnswer', undefined as any);
                                                                setValue('numericalAnswerText', '');
                                                                setValue('textAnswer', undefined as any);
                                                            } else {
                                                                setValue('options', undefined as any);
                                                                setValue('mcqAnswerMode', undefined as any);
                                                                setValue('correctAnswer', undefined as any);
                                                                setValue('correctAnswers', undefined as any);
                                                                setValue('numericalAnswer', undefined as any);
                                                                setValue('numericalAnswerText', undefined as any);
                                                                setValue('textAnswer', '');
                                                            }
                                                        }} value={field.value} className="flex flex-row space-x-4" disabled={!isClassificationReady}>
                                                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="MCQ" /></FormControl><FormLabel className="font-normal">Multiple Choice</FormLabel></FormItem>
                                                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Numerical" /></FormControl><FormLabel className="font-normal">Numerical Answer</FormLabel></FormItem>
                                                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="Text" /></FormControl><FormLabel className="font-normal">Text Answer</FormLabel></FormItem>
                                                        </RadioGroup>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                        {questionType === 'MCQ' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormItem>
                                                    <FormLabel>Number of Options</FormLabel>
                                                    <Select value={String(mcqOptionCount)} onValueChange={(value) => setMcqOptionCount(Number(value))} disabled={!isClassificationReady}>
                                                        <FormControl><SelectTrigger><SelectValue placeholder="Select option count" /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            {Array.from({ length: 7 }, (_, index) => index + 2).map((count) => (
                                                                <SelectItem key={count} value={String(count)}>{count} options</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormDescription>After selecting count, fill options and mark one or more correct answers.</FormDescription>
                                                </FormItem>
                                            </div>
                                        )}
                                        <FormField control={control} name="questionTitle" render={({ field }) => (<FormItem><FormLabel>Question Number (Auto)</FormLabel><FormControl><Input {...field} value={field.value || autoQuestionTitle} readOnly disabled placeholder={questionCategoryKey ? '' : 'Select exam, curriculum and subject first'} /></FormControl><FormDescription>{isQuestionBankLoading ? 'Loading your existing question index...' : questionCategoryKey ? 'This number auto-increments for the selected exam + curriculum + subject.' : 'Choose exam, curriculum and subject to see the next auto question number.'}</FormDescription><FormMessage /></FormItem>)} />
                                        {!hasUploadedQuestionImage ? (
                                            <div className="space-y-2">
                                                <MathToolbar onInsert={insertMathIntoQuestionText} />
                                                <FormField control={control} name="questionText" render={({ field }) => (<FormItem><FormLabel>Question Text</FormLabel><FormControl><Textarea placeholder="e.g., What is the formula for..." {...field} ref={(el) => { questionTextRef.current = el; field.ref(el); }} value={field.value || ''} rows={4} /></FormControl><MathTextPreview text={field.value || ''} /><FormMessage /></FormItem>)} />
                                            </div>
                                        ) : null}
                                        <div className={cn(
                                            "relative overflow-hidden rounded-xl border p-4 md:p-5 transition-all",
                                            isClassificationReady
                                                ? "border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-[0_8px_30px_-16px_rgba(59,130,246,0.55)]"
                                                : "bg-muted/10 opacity-80"
                                        )}>
                                            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-primary/20 via-transparent to-primary/5" />
                                            <div className="relative space-y-4">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-semibold tracking-wide">Question Upload Studio</p>
                                                        <p className="text-xs text-muted-foreground">Professional upload flow for OCR and image-only questions.</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="secondary" className="border border-primary/20 bg-primary/15 text-primary">Step 3</Badge>
                                                        <Badge variant="outline" className="border-primary/30">
                                                            {questionUploadMode === 'ocr' ? 'OCR Mode Active' : 'Image Mode Active'}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <FormItem className="space-y-2">
                                                    <FormLabel>Question Input Mode</FormLabel>
                                                    <FormControl>
                                                        <RadioGroup
                                                            className="grid grid-cols-1 md:grid-cols-2 gap-3"
                                                            value={questionUploadMode}
                                                            onValueChange={(value) => {
                                                                const next = value as 'ocr' | 'image';
                                                                setQuestionUploadMode(next);
                                                                setExtractedQuestionText('');
                                                                if (next === 'ocr') {
                                                                    setValue('imageUrls', [] as any, { shouldDirty: true, shouldValidate: true });
                                                                }
                                                            }}
                                                        >
                                                            <FormItem className={cn(
                                                                "flex items-start gap-3 rounded-lg border px-3 py-3 space-y-0",
                                                                questionUploadMode === 'ocr' ? "border-primary/50 bg-primary/10" : "border-border/70"
                                                            )}>
                                                                <FormControl><RadioGroupItem value="ocr" /></FormControl>
                                                                <div className="space-y-1">
                                                                    <FormLabel className="font-medium">OCR (Auto-fill Text)</FormLabel>
                                                                    <p className="text-xs text-muted-foreground">Best for text extraction from PDF pages.</p>
                                                                </div>
                                                            </FormItem>
                                                            <FormItem className={cn(
                                                                "flex items-start gap-3 rounded-lg border px-3 py-3 space-y-0",
                                                                questionUploadMode === 'image' ? "border-primary/50 bg-primary/10" : "border-border/70"
                                                            )}>
                                                                <FormControl><RadioGroupItem value="image" /></FormControl>
                                                                <div className="space-y-1">
                                                                    <FormLabel className="font-medium">Attach Cropped Image</FormLabel>
                                                                    <p className="text-xs text-muted-foreground">Best for diagram/image-based questions.</p>
                                                                </div>
                                                            </FormItem>
                                                        </RadioGroup>
                                                    </FormControl>
                                                </FormItem>

                                                {!isClassificationReady ? (
                                                    <div className="rounded-lg border border-dashed border-primary/35 bg-primary/5 p-3 text-xs text-muted-foreground">
                                                        Complete exam, class, subject, and topic selection to enable PDF tools.
                                                    </div>
                                                ) : questionUploadMode === 'ocr' ? (
                                                    <>
                                                        <div className="rounded-lg border border-dashed border-primary/35 bg-primary/5 p-3 text-xs text-muted-foreground">
                                                            <p>Upload PDF, crop question area, OCR auto-fills text.</p>
                                                            <p>If next crop is done, continuation appends to existing question text.</p>
                                                        </div>
                                                        <PdfQuestionExtractor
                                                            file={questionPdfFile}
                                                            onFileChange={setQuestionPdfFile}
                                                            onImageCropped={handleQuestionImageCropped}
                                                            title="Question OCR from PDF"
                                                            description="Select page and crop over the question/options."
                                                            pageNumber={questionPdfPage}
                                                            onPageNumberChange={setQuestionPdfPage}
                                                            enableTextExtraction
                                                        />
                                                        {extractedQuestionText ? (
                                                            <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                                                                <p className="mb-1 font-medium text-foreground">Latest Extracted Text</p>
                                                                <p className="whitespace-pre-wrap">{extractedQuestionText}</p>
                                                            </div>
                                                        ) : null}
                                                    </>
                                                ) : (
                                                    <PdfQuestionExtractor
                                                        file={questionPdfFile}
                                                        onFileChange={setQuestionPdfFile}
                                                        onImageCropped={handleQuestionImageCropped}
                                                        title="Attach Question Crop"
                                                        description="Upload file, crop required question part, and attach."
                                                        pageNumber={questionPdfPage}
                                                        onPageNumberChange={setQuestionPdfPage}
                                                        accept="*/*"
                                                    />
                                                )}
                                                {(watch('imageUrls') || []).length > 0 ? (
                                                    <div className="space-y-2 rounded-lg border bg-background p-3">
                                                        <p className="text-xs font-medium text-foreground">Uploaded Question Image(s)</p>
                                                        <div className="flex flex-col gap-3">
                                                            {(watch('imageUrls') || []).map((url: string, index: number) => (
                                                                <div key={`${url}-${index}`} className="relative group rounded-md border p-2">
                                                                    <img
                                                                        src={url}
                                                                        alt={`Uploaded question image ${index + 1}`}
                                                                        loading="lazy"
                                                                        className="h-auto max-h-[520px] w-full rounded-md object-contain bg-background"
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        variant="destructive"
                                                                        size="icon"
                                                                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100"
                                                                        onClick={() => {
                                                                            const currentUrls = form.getValues('imageUrls') || [];
                                                                            setValue('imageUrls', currentUrls.filter((_: string, i: number) => i !== index));
                                                                        }}
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                        {questionType === 'MCQ' && (
                                            <div className="space-y-4">
                                                <FormLabel>Options & Correct Answer</FormLabel>
                                                <div className="rounded-lg border border-primary/25 bg-gradient-to-r from-primary/10 via-background to-background p-3 space-y-2">
                                                    <p className="text-sm font-semibold">Upload Options via OCR</p>
                                                    <p className="text-xs text-muted-foreground">Crop only options area. Additional crops auto-fill next empty option fields.</p>
                                                    {isClassificationReady ? (
                                                        <PdfQuestionExtractor
                                                            file={mcqOptionsPdfFile}
                                                            onFileChange={setMcqOptionsPdfFile}
                                                            onImageCropped={handleMcqOptionsOcrCropped}
                                                            title="MCQ Options OCR"
                                                            description="Upload or select page and crop options only."
                                                            pageNumber={mcqOptionsPdfPage}
                                                            onPageNumberChange={setMcqOptionsPdfPage}
                                                            enableTextExtraction
                                                        />
                                                    ) : (
                                                        <div className="rounded-lg border border-dashed border-border/70 bg-white/[0.03] p-3 text-xs text-muted-foreground">
                                                            Complete taxonomy fields to enable options OCR.
                                                        </div>
                                                    )}
                                                </div>
                                                <FormField
                                                  control={control}
                                                  name="mcqAnswerMode"
                                                  render={({ field }) => (
                                                    <FormItem className="space-y-2">
                                                      <FormLabel>Correct Answer Type</FormLabel>
                                                      <FormControl>
                                                        <RadioGroup
                                                          className="flex gap-6"
                                                          value={field.value || 'single'}
                                                          onValueChange={(value) => {
                                                            field.onChange(value);
                                                            if (value === 'single') {
                                                              const fromMulti = (selectedCorrectAnswers && selectedCorrectAnswers[0]) || '';
                                                              setValue('correctAnswer', fromMulti || selectedCorrectAnswer || '');
                                                              setValue('correctAnswers', [] as any);
                                                            } else {
                                                              const first = selectedCorrectAnswer ? [selectedCorrectAnswer] : [];
                                                              setValue('correctAnswers', first as any);
                                                              setValue('correctAnswer', '');
                                                            }
                                                          }}
                                                        >
                                                          <FormItem className="flex items-center gap-2 space-y-0">
                                                            <FormControl><RadioGroupItem value="single" /></FormControl>
                                                            <FormLabel className="font-normal">Single Correct</FormLabel>
                                                          </FormItem>
                                                          <FormItem className="flex items-center gap-2 space-y-0">
                                                            <FormControl><RadioGroupItem value="multiple" /></FormControl>
                                                            <FormLabel className="font-normal">Multiple Correct</FormLabel>
                                                          </FormItem>
                                                        </RadioGroup>
                                                      </FormControl>
                                                    </FormItem>
                                                  )}
                                                />
                                                <div className="space-y-2">
                                                    {Array.from({ length: mcqOptionCount }, (_, index) => (
                                                        <FormField
                                                            key={`mcq-option-${index}`}
                                                            control={control}
                                                            name={`options.${index}`}
                                                            render={({ field: optionField }) => {
                                                                const optionLabel = String.fromCharCode(65 + index);
                                                                const optionValue = optionField.value || '';
                                                                const isSelected = mcqAnswerMode === 'multiple'
                                                                  ? selectedCorrectAnswers.includes(optionValue)
                                                                  : selectedCorrectAnswer === optionValue;
                                                                const isMathToolOpen = !!openCreateOptionMathToolByIndex[index];
                                                                return (
                                                                    <FormItem className={cn("space-y-2 rounded-md border p-2", isSelected ? "border-primary bg-primary/5" : "")}>
                                                                        <div className="grid grid-cols-[40px_1fr_auto] items-center gap-2">
                                                                            <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold">
                                                                                {optionLabel}
                                                                            </div>
                                                                            <Input
                                                                                {...optionField}
                                                                                ref={(el) => {
                                                                                    mcqOptionInputRefs.current[index] = el;
                                                                                    optionField.ref(el);
                                                                                }}
                                                                                placeholder={`Option ${optionLabel}`}
                                                                                onChange={(event) => {
                                                                                    const nextValue = event.target.value;
                                                                                    const previousValue = optionField.value || '';
                                                                                    optionField.onChange(nextValue);
                                                                                    syncCorrectAnswersOnCreateOptionChange(previousValue, nextValue);
                                                                                }}
                                                                            />
                                                                            <Button
                                                                                type="button"
                                                                                size="sm"
                                                                                variant={isSelected ? "default" : "outline"}
                                                                                disabled={!optionValue}
                                                                                onClick={() => {
                                                                                  if (!optionValue) return;
                                                                                  if (mcqAnswerMode === 'multiple') {
                                                                                    const current = Array.from(new Set(selectedCorrectAnswers || []));
                                                                                    const next = current.includes(optionValue)
                                                                                      ? current.filter((value) => value !== optionValue)
                                                                                      : [...current, optionValue];
                                                                                    setValue('correctAnswers', next as any, { shouldValidate: true, shouldDirty: true });
                                                                                  } else {
                                                                                    setValue('correctAnswer', optionValue, { shouldValidate: true, shouldDirty: true });
                                                                                  }
                                                                                }}
                                                                            >
                                                                                {isSelected ? "Correct" : "Mark Correct"}
                                                                            </Button>
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    setOpenCreateOptionMathToolByIndex((prev) => ({ ...prev, [index]: !prev[index] }));
                                                                                }}
                                                                            >
                                                                                {isMathToolOpen ? 'Hide Math Tool' : 'Use Math Tool'}
                                                                            </Button>
                                                                        </div>
                                                                        {isMathToolOpen ? (
                                                                            <MathToolbar onInsert={(token) => insertMathIntoCreateOption(index, token)} />
                                                                        ) : null}
                                                                        {optionValue ? (
                                                                            <div className="math-preview rounded-md border bg-background px-3 py-2">
                                                                                <p className="mb-1 text-xs font-medium text-muted-foreground">Math Preview</p>
                                                                                <MathText text={optionValue} className="text-sm" />
                                                                            </div>
                                                                        ) : null}
                                                                    </FormItem>
                                                                );
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                                {mcqAnswerMode === 'single' ? (
                                                  <FormField control={control} name="correctAnswer" render={() => <FormMessage />} />
                                                ) : (
                                                  <FormField control={control} name="correctAnswers" render={() => <FormMessage />} />
                                                )}
                                            </div>
                                        )}
                                        {questionType === 'Numerical' && (
                                            <FormField
                                                control={control}
                                                name="numericalAnswer"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-2">
                                                        <FormLabel>Correct Numerical Answer</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="text"
                                                                placeholder="e.g., 42"
                                                                {...field}
                                                                value={field.value ?? ''}
                                                                ref={(el) => {
                                                                    numericalAnswerRef.current = el;
                                                                    field.ref(el);
                                                                }}
                                                                onChange={(event) => {
                                                                    const raw = event.target.value;
                                                                    field.onChange(raw as any);
                                                                    setValue('numericalAnswerText', raw as any, { shouldDirty: true });
                                                                }}
                                                                disabled={!isClassificationReady}
                                                            />
                                                        </FormControl>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setShowCreateNumericalAnswerMathTool((prev) => !prev)}
                                                            disabled={!isClassificationReady}
                                                        >
                                                            {showCreateNumericalAnswerMathTool ? 'Hide Math Tool' : 'Use Math Tool'}
                                                        </Button>
                                                        {showCreateNumericalAnswerMathTool ? (
                                                            <MathToolbar onInsert={insertMathIntoCreateNumericalAnswer} />
                                                        ) : null}
                                                        <MathTextPreview text={String((watch('numericalAnswerText') || field.value || '') as string)} />
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                        {questionType === 'Text' && (
                                            <FormField
                                                control={control}
                                                name="textAnswer"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-2">
                                                        <FormLabel>Reference Text Answer</FormLabel>
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder="Add expected text answer or key points..."
                                                                {...field}
                                                                rows={3}
                                                                disabled={!isClassificationReady}
                                                                ref={(el) => {
                                                                    textAnswerRef.current = el;
                                                                    field.ref(el);
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setShowCreateTextAnswerMathTool((prev) => !prev)}
                                                            disabled={!isClassificationReady}
                                                        >
                                                            {showCreateTextAnswerMathTool ? 'Hide Math Tool' : 'Use Math Tool'}
                                                        </Button>
                                                        {showCreateTextAnswerMathTool ? (
                                                            <MathToolbar onInsert={insertMathIntoCreateTextAnswer} />
                                                        ) : null}
                                                        <MathTextPreview text={field.value || ''} />
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                                            <p className="text-sm font-medium">Solution Explanation</p>
                                            <FormField control={control} name="solutionExplanation" render={({ field }) => (<FormItem><FormLabel>Solution Text (Optional)</FormLabel><FormControl><Textarea placeholder="Add step-by-step explanation for students..." {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
                                            <div className="space-y-2 rounded-md border p-3">
                                                <FormLabel>Attach Solution Pages (no OCR)</FormLabel>
                                                {isClassificationReady ? (
                                                    <PdfQuestionExtractor
                                                        file={solutionAttachFile}
                                                        onFileChange={setSolutionAttachFile}
                                                        onImageCropped={handleSolutionAttachmentCropped}
                                                        title="Attach Solution Crop"
                                                        description="Upload file, crop required part, and attach. Repeat for multi-page sequence."
                                                        pageNumber={solutionAttachPage}
                                                        onPageNumberChange={setSolutionAttachPage}
                                                        accept="*/*"
                                                    />
                                                ) : (
                                                    <div className="rounded-lg border border-dashed border-border/70 bg-white/[0.03] p-3 text-xs text-muted-foreground">
                                                        Complete taxonomy fields to enable solution attachments.
                                                    </div>
                                                )}
                                            </div>
                                            {watch('explanationImageUrls') && watch('explanationImageUrls').length > 0 && (
                                                <div className="space-y-2">
                                                    <FormLabel>Explanation Image Previews</FormLabel>
                                                    <div className="flex flex-col gap-4">
                                                        {watch('explanationImageUrls').map((url: string, index: number) => (
                                                            <div key={index} className="relative group">
                                                                <img
                                                                    src={url}
                                                                    alt={`Explanation image ${index + 1}`}
                                                                    loading="lazy"
                                                                    className="h-auto max-h-[260px] w-full max-w-[420px] rounded-md border object-contain bg-background"
                                                                />
                                                                <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => {
                                                                    const currentUrls = form.getValues('explanationImageUrls') || [];
                                                                    setValue('explanationImageUrls', currentUrls.filter((_: any, i: number) => i !== index));
                                                                }}>
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="sticky bottom-2 z-10 rounded-2xl border border-primary/20 bg-slate-800/55 p-3 shadow-[0_25px_60px_-35px_rgba(59,130,246,0.7)] backdrop-blur">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary">Final Step</Badge>
                                                <span>Review selections and publish to your bank</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3">
                                            <Button
                                                type="submit"
                                                size="lg"
                                                className="min-w-[200px] rounded-xl bg-gradient-to-r from-primary via-blue-500 to-cyan-500 text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-[1.01] hover:from-primary/90 hover:via-blue-500/90 hover:to-cyan-500/90"
                                                disabled={isSubmitting || !isTeacher || !isClassificationReady}
                                            >
                                                {isSubmitting ? (
                                                    <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Adding...</>
                                                ) : (
                                                    <>Add Question <ArrowRight className="ml-2 h-4 w-4" /></>
                                                )}
                                            </Button>
                                            <Button asChild type="button" variant="outline" size="lg" className="rounded-xl border-primary/35 bg-primary/10 text-primary hover:bg-primary/20">
                                                <Link href="/practice/bank">Visit DCAM Question Bank Page</Link>
                                            </Button>
                                            <Button type="button" variant="secondary" size="lg" onClick={onResetFields} disabled={isSubmitting} className="rounded-xl border border-border/70 bg-white/[0.05] hover:bg-white/[0.08]">
                                                Reset Fields
                                            </Button>
                                        </div>
                                    </div>
                                    {isQuestionBankLoading ? (
                                        <p className="px-1 text-xs text-muted-foreground">Question bank index is still loading in background. You can continue filling fields.</p>
                                    ) : null}
                                    </div>
                                </form>
                            </Form>
                    </CardContent>
                </Card>
                )}
            </div>
        </main>
    )
};


const StudentView = ({ isLoading, curriculumTree, isSubscribed, questionTree }: any) => (
    <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <Tabs defaultValue="quiz" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="quiz">Practice Quiz</TabsTrigger>
                <TabsTrigger value="bank">DCAM Question Bank</TabsTrigger>
            </TabsList>
            <TabsContent value="quiz">
                <Card className="shadow-lg mt-4">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl">Start a New Practice Session</CardTitle>
                        <CardDescription>Customize your practice session by selecting your desired filters.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-48 w-full" /> : (
                            <StartPracticeForm
                                curriculumTree={curriculumTree}
                                isSubscribed={!!isSubscribed}
                            />
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="bank">
                <Card className="shadow-lg mt-4">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl flex items-center gap-2">
                            <ClipboardList className="w-6 h-6" /> DCAM Question Bank
                        </CardTitle>
                        <CardDescription>Browse the question bank by curriculum. Click on a topic to start a practice session.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-20 w-full" />
                                <Skeleton className="h-20 w-full" />
                                <Skeleton className="h-20 w-full" />
                            </div>
                        ) : questionTree.length > 0 ? (
                            <Accordion type="multiple" className="w-full space-y-2">
                                {questionTree.map((et: any) => (
                                    <AccordionItem value={et.id} key={et.id} className="border rounded-lg">
                                        <AccordionTrigger className="text-2xl font-semibold px-6">{et.name}</AccordionTrigger>
                                        <AccordionContent className="px-6 pb-2">
                                            {et.classes.length > 0 ? (
                                                <Accordion type="multiple" className="w-full space-y-2" defaultValue={et.classes.map((c: any) => c.id)}>
                                                    {et.classes.map((c: any) => (
                                                        <AccordionItem value={c.id} key={c.id} className="border rounded-lg">
                                                            <AccordionTrigger className="text-xl font-medium px-4">{c.name}</AccordionTrigger>
                                                            <AccordionContent className="px-4 pb-2">
                                                                {c.subjects.length > 0 ? (
                                                                    <Accordion type="multiple" className="w-full space-y-2" defaultValue={c.subjects.map((s: any) => s.id)}>
                                                                        {c.subjects.map((s: any) => (
                                                                            <AccordionItem value={s.id} key={s.id} className="border-l-2 pl-4 border-muted">
                                                                                <AccordionTrigger className="text-lg font-medium">{s.name}</AccordionTrigger>
                                                                                <AccordionContent className="pl-4 pt-2">
                                                                                    {s.topics.length > 0 ? (
                                                                                        <Accordion type="multiple" className="w-full space-y-1">
                                                                                            {s.topics.map((t: any) => (
                                                                                                <AccordionItem value={t.id} key={t.id} className="border-none">
                                                                                                    <AccordionTrigger className="text-sm py-2">{t.name} ({t.questions.length} questions)</AccordionTrigger>
                                                                                                    <AccordionContent className="pl-4">
                                                                                                        <StartTopicPracticeForm topic={t} isSubscribed={!!isSubscribed} />
                                                                                                    </AccordionContent>
                                                                                                </AccordionItem>
                                                                                            ))}
                                                                                        </Accordion>
                                                                                    ) : <p className="text-center text-muted-foreground py-4">No topics with questions found for this subject.</p>}
                                                                                </AccordionContent>
                                                                            </AccordionItem>
                                                                        ))}
                                                                    </Accordion>
                                                                ) : <p className="text-center text-muted-foreground py-4">No subjects with questions found for this class.</p>}
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    ))}
                                                </Accordion>
                                            ) : <p className="text-center text-muted-foreground py-4">No classes with questions found for this exam type.</p>}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        ) : (
                            <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                                <p className='font-medium'>No question bank entries available yet.</p>
                                <p className='text-sm'>Please check back later.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </main>
);

export default function PracticePage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [formResetSignal, setFormResetSignal] = useState(0);
  const [clearQuestionContentSignal, setClearQuestionContentSignal] = useState(0);
  const [shouldLoadQuestionIndex, setShouldLoadQuestionIndex] = useState(false);
  const { isTeacher, isQuestionUploader, isExplicitStudent, isLoading: isTeacherLoading } = useIsTeacher();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const isAllowedTeacherAuthor = isAllowedTeacherAuthorEmail(user?.email);
  const canAccessQuestionUpload = isTeacher || isQuestionUploader || isAllowedTeacherAuthor;
  const canManageTeacherAuthoring = isAdmin || isQuestionUploader || isAllowedTeacherAuthor;
  const isTeacherAuthoringRestricted = isTeacher && !canManageTeacherAuthoring && !isAdminLoading;
  const shouldUseTeachingProfileScope = isTeacher && !canManageTeacherAuthoring;
  const shouldWaitForTeacherRoleResolution = isTeacherLoading && !isQuestionUploader && !isAllowedTeacherAuthor;
  const questionBankOwnerId = useMemo(
    () => resolveDcamQuestionBankOwnerId({
      userId: user?.uid,
      email: user?.email,
      isQuestionUploader,
    }),
    [isQuestionUploader, user?.email, user?.uid]
  );
  const [editingQuestion, setEditingQuestion] = useState<PracticeQuestion | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
  const form = useForm<z.infer<typeof questionSchema>>({
    resolver: zodResolver(questionSchema),
    defaultValues: QUESTION_FORM_DEFAULT_VALUES,
  });
  const watchedSubjectId = useWatch({ control: form.control, name: 'subjectId' });
  const watchedTopicId = useWatch({ control: form.control, name: 'topicId' });
  const watchedAlignments = useWatch({ control: form.control, name: 'alignments' });
  const selectedTopicIdForIndex = String(watchedTopicId || '').trim();
  const selectedSubtopicCatalogTopicKey = useMemo(() => {
    const topicIds = [
      selectedTopicIdForIndex,
      ...(((watchedAlignments || []) as CategorySelectionInput[]).map((alignment) => alignment.topicId)),
    ]
      .map((topicId) => String(topicId || '').trim())
      .filter(Boolean);
    return Array.from(new Set(topicIds)).sort().join('|');
  }, [selectedTopicIdForIndex, watchedAlignments]);
  const [subtopicCatalogQuestions, setSubtopicCatalogQuestions] = useState<PracticeQuestion[]>([]);
  const [isSubtopicCatalogLoading, setIsSubtopicCatalogLoading] = useState(false);
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfile>(userDocRef);
  const teachingAssignments = userProfile?.teachingAssignments || [];
  const allowedClassIds = useMemo(
    () => shouldUseTeachingProfileScope ? Array.from(new Set([
      ...(userProfile?.teachesClassIds || []),
      ...teachingAssignments.map((assignment) => assignment.classId).filter(Boolean),
    ])) : [],
    [shouldUseTeachingProfileScope, userProfile?.teachesClassIds, teachingAssignments]
  );
  const allowedSubjectIds = useMemo(
    () => shouldUseTeachingProfileScope ? Array.from(new Set([
      ...(userProfile?.teachesSubjectIds || []),
      ...teachingAssignments.flatMap((assignment) => assignment.subjectIds || []).filter(Boolean),
    ])) : [],
    [shouldUseTeachingProfileScope, userProfile?.teachesSubjectIds, teachingAssignments]
  );
  const shouldUseScopedClassQuery = allowedClassIds.length > 0 && allowedClassIds.length <= 30;
  const shouldUseDirectSubjectQuery = allowedSubjectIds.length > 0 && allowedSubjectIds.length <= 30;
  const shouldUseClassScopedSubjectQuery = !shouldUseDirectSubjectQuery && allowedClassIds.length > 0 && allowedClassIds.length <= 30;

  const questionsCollectionRef = useMemoFirebase(() => {
    if (!firestore || !questionBankOwnerId || !shouldLoadQuestionIndex || !selectedTopicIdForIndex) return null;
    return query(collection(firestore, 'practice_questions'), where('topicId', '==', selectedTopicIdForIndex));
  }, [firestore, questionBankOwnerId, shouldLoadQuestionIndex, selectedTopicIdForIndex]);
  const classesQuery = useMemoFirebase(() => {
    if (!firestore || !canAccessQuestionUpload || shouldWaitForTeacherRoleResolution || (shouldUseTeachingProfileScope && isUserProfileLoading)) return null;
    if (shouldUseScopedClassQuery) {
      return query(collection(firestore, 'classes'), where(documentId(), 'in', allowedClassIds));
    }
    return query(collection(firestore, 'classes'), orderBy('name'));
  }, [firestore, canAccessQuestionUpload, shouldWaitForTeacherRoleResolution, shouldUseTeachingProfileScope, isUserProfileLoading, shouldUseScopedClassQuery, allowedClassIds]);
  const subjectsQuery = useMemoFirebase(() => {
    if (!firestore || !canAccessQuestionUpload || shouldWaitForTeacherRoleResolution || (shouldUseTeachingProfileScope && isUserProfileLoading)) return null;
    if (shouldUseDirectSubjectQuery) {
      return query(collection(firestore, 'subjects'), where(documentId(), 'in', allowedSubjectIds));
    }
    if (shouldUseClassScopedSubjectQuery) {
      return query(collection(firestore, 'subjects'), where('classId', 'in', allowedClassIds));
    }
    return query(collection(firestore, 'subjects'), orderBy('name'));
  }, [firestore, canAccessQuestionUpload, shouldWaitForTeacherRoleResolution, shouldUseTeachingProfileScope, isUserProfileLoading, shouldUseDirectSubjectQuery, allowedSubjectIds, shouldUseClassScopedSubjectQuery, allowedClassIds]);
  const examTypesQuery = useMemoFirebase(() => {
    if (!firestore || !canAccessQuestionUpload || shouldWaitForTeacherRoleResolution) return null;
    return query(collection(firestore, 'exam_types'), orderBy('name'));
  }, [firestore, canAccessQuestionUpload, shouldWaitForTeacherRoleResolution]);

  const { data: questions, isLoading: areQuestionsLoading } = useCollection<PracticeQuestion>(questionsCollectionRef);
  const { data: classes, isLoading: areClassesLoading } = useCollection<Class>(classesQuery);
  const { data: subjects, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: examTypes, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const selectedTopicSubjectId = String(watchedSubjectId || '').trim();
  const selectedAlignmentSubjectKey = ((watchedAlignments || []) as CategorySelectionInput[])
    .map((alignment) => String(alignment.subjectId || '').trim())
    .filter(Boolean)
    .sort()
    .join('|');
  const editQuestionSubjectKey = useMemo(() => {
    const subjectIds = [
      editingQuestion?.subjectId,
      ...(editingQuestion?.alignments || []).map((alignment) => alignment.subjectId),
    ].map((subjectId) => String(subjectId || '').trim()).filter(Boolean);
    return Array.from(new Set(subjectIds)).sort().join('|');
  }, [editingQuestion]);
  const selectedTopicSubjectIds = useMemo(() => {
    const subjectIds = [
      selectedTopicSubjectId,
      ...selectedAlignmentSubjectKey.split('|'),
      ...editQuestionSubjectKey.split('|'),
    ].map((subjectId) => subjectId.trim()).filter(Boolean);
    return Array.from(new Set(subjectIds));
  }, [editQuestionSubjectKey, selectedAlignmentSubjectKey, selectedTopicSubjectId]);
  const shouldUseSelectedTopicQuery = selectedTopicSubjectIds.length > 0 && selectedTopicSubjectIds.length <= 30;
  const topicsQuery = useMemoFirebase(() => {
    if (!firestore || !canAccessQuestionUpload || shouldWaitForTeacherRoleResolution || (shouldUseTeachingProfileScope && isUserProfileLoading)) return null;
    if (!shouldUseSelectedTopicQuery) return null;
    return query(collection(firestore, 'topics'), where('subjectId', 'in', selectedTopicSubjectIds));
  }, [firestore, canAccessQuestionUpload, shouldWaitForTeacherRoleResolution, shouldUseTeachingProfileScope, isUserProfileLoading, shouldUseSelectedTopicQuery, selectedTopicSubjectIds]);
  const { data: topics, isLoading: areTopicsLoading } = useCollection<Topic>(topicsQuery);
  const areCurriculumSourcesReady =
    !shouldWaitForTeacherRoleResolution
    && (!shouldUseTeachingProfileScope || !isUserProfileLoading)
    && !areClassesLoading
    && !areSubjectsLoading
    && !areExamTypesLoading;

  useEffect(() => {
    if (!firestore || !canAccessQuestionUpload || !questionBankOwnerId || !selectedSubtopicCatalogTopicKey) {
      setSubtopicCatalogQuestions([]);
      setIsSubtopicCatalogLoading(false);
      return;
    }

    const cachedQuestions = PRACTICE_QUESTION_CATALOG_CACHE.get(questionBankOwnerId);
    if (cachedQuestions) {
      setSubtopicCatalogQuestions(cachedQuestions);
      setIsSubtopicCatalogLoading(false);
      return;
    }

    let isActive = true;
    setIsSubtopicCatalogLoading(true);

    getDocs(query(collection(firestore, 'practice_questions'), where('teacherId', '==', questionBankOwnerId)))
      .then((snapshot) => {
        const sharedOwnerQuestions = snapshot.docs.map((questionDoc) => ({
          id: questionDoc.id,
          ...(questionDoc.data() as Omit<PracticeQuestion, 'id'>),
        }));
        PRACTICE_QUESTION_CATALOG_CACHE.set(questionBankOwnerId, sharedOwnerQuestions);
        if (isActive) {
          setSubtopicCatalogQuestions(sharedOwnerQuestions);
        }
      })
      .catch((error) => {
        console.warn('Shared DCAM subtopic catalog could not be loaded:', error);
        if (isActive) {
          setSubtopicCatalogQuestions([]);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsSubtopicCatalogLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [firestore, canAccessQuestionUpload, questionBankOwnerId, selectedSubtopicCatalogTopicKey]);

  const updateSubtopicCatalogCache = (updater: (questions: PracticeQuestion[]) => PracticeQuestion[]) => {
    if (!questionBankOwnerId) return;
    setSubtopicCatalogQuestions((currentQuestions) => {
      const cachedQuestions = PRACTICE_QUESTION_CATALOG_CACHE.get(questionBankOwnerId) || currentQuestions;
      const nextQuestions = updater(cachedQuestions);
      PRACTICE_QUESTION_CATALOG_CACHE.set(questionBankOwnerId, nextQuestions);
      return nextQuestions;
    });
  };

  useEffect(() => {
    if (!canAccessQuestionUpload || !user?.uid || !areCurriculumSourcesReady || !selectedTopicIdForIndex) {
      setShouldLoadQuestionIndex(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShouldLoadQuestionIndex(true);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [canAccessQuestionUpload, user?.uid, areCurriculumSourcesReady, selectedTopicIdForIndex]);
  
  const topicMap = useMemo(() => {
    if (!topics) return {};
    return topics.reduce((acc, topic) => {
      acc[topic.id] = topic.name;
      return acc;
    }, {} as Record<string, string>);
  }, [topics]);
  
  const classMap = useMemo(() => {
    if (!classes) return {};
    return classes.reduce((acc, c) => {
      acc[c.id] = c.name;
      return acc;
    }, {} as Record<string, string>);
  }, [classes]);

  const examTypeMap = useMemo(() => {
    if (!examTypes) return {};
    return examTypes.reduce((acc, et) => {
      acc[et.id] = et.name;
      return acc;
    }, {} as Record<string, string>);
  }, [examTypes]);

  const teacherScopedQuestionsForNumbering = useMemo(() => {
    if (!questions || !canAccessQuestionUpload || !questionBankOwnerId) return [];
    return questions.filter((question) =>
      question.teacherId === questionBankOwnerId
      && (allowedClassIds.length === 0 || allowedClassIds.includes(question.classId))
      && (allowedSubjectIds.length === 0 || allowedSubjectIds.includes(question.subjectId))
    );
  }, [questions, canAccessQuestionUpload, questionBankOwnerId, allowedClassIds, allowedSubjectIds]);
  const loadQuestionIndexForSubmit = async (
    primarySelection: CategorySelectionInput,
    alignments: CategorySelectionInput[],
    incomingFingerprint: string
  ): Promise<PracticeQuestion[]> => {
    if (!questionBankOwnerId) return [];

    const resultMap = new Map<string, PracticeQuestion>();
    const addQuestionToIndex = (question: PracticeQuestion) => {
      if (question.teacherId !== questionBankOwnerId) return;
      resultMap.set(question.id, question);
    };

    if (Array.isArray(questions)) {
      questions.forEach(addQuestionToIndex);
    }

    const questionsRef = collection(firestore, 'practice_questions');
    const categoryKeys = getCategoryKeysForSelection(primarySelection, alignments);
    const topicIds = getTopicIdsForSelection(primarySelection, alignments);

    const addSnapshotToIndex = (snapshot: Awaited<ReturnType<typeof getDocs>>) => {
      snapshot.docs.forEach((questionDoc) => {
        addQuestionToIndex({
          id: questionDoc.id,
          ...(questionDoc.data() as Omit<PracticeQuestion, 'id'>),
        });
      });
    };

    const reads: Array<Promise<void>> = [];

    if (incomingFingerprint) {
      reads.push(
        getDocs(query(questionsRef, where('questionFingerprint', '==', incomingFingerprint)))
          .then(addSnapshotToIndex)
      );
    }

    chunkFirestoreInValues(categoryKeys).forEach((categoryKeyChunk) => {
      if (categoryKeyChunk.length === 0) return;
      reads.push(
        getDocs(query(questionsRef, where('categoryKeys', 'array-contains-any', categoryKeyChunk)))
          .then(addSnapshotToIndex)
      );
    });

    chunkFirestoreInValues(topicIds).forEach((topicIdChunk) => {
      if (topicIdChunk.length === 0) return;
      reads.push(
        getDocs(query(questionsRef, where('topicId', 'in', topicIdChunk)))
          .then(addSnapshotToIndex)
      );
    });

    const settledReads = await Promise.allSettled(reads);
    settledReads.forEach((result) => {
      if (result.status === 'rejected') {
        console.warn('Question upload index read skipped:', result.reason);
      }
    });

    return Array.from(resultMap.values());
  };
  const isTeacherFormLoading =
    shouldWaitForTeacherRoleResolution ||
    (shouldUseTeachingProfileScope && isUserProfileLoading) ||
    areClassesLoading ||
    areSubjectsLoading ||
    areExamTypesLoading;
  const isQuestionBankIndexLoading = Boolean(selectedTopicIdForIndex) && (!shouldLoadQuestionIndex || areQuestionsLoading);

  const handleResetFields = () => {
    form.reset(QUESTION_FORM_DEFAULT_VALUES);
    setFormResetSignal((v) => v + 1);
  };

  const onSubmit = async (values: z.infer<typeof questionSchema>) => {
    if (submitLockRef.current || isSubmitting) return;
    if (!canAccessQuestionUpload || !user) {
      toast({ variant: 'destructive', title: 'Not Authorized', description: 'Only teachers or Question Upload accounts can create questions.' });
      return;
    }
    if (isTeacherAuthoringRestricted) {
      toast({
        variant: 'destructive',
        title: 'Question authoring disabled',
        description: getTeacherAuthoringRestrictionCopy(),
      });
      return;
    }
    if (!questionBankOwnerId) {
      toast({ variant: 'destructive', title: 'Question bank unavailable', description: 'The shared question bank owner could not be resolved. Please sign in again.' });
      return;
    }
    if (allowedClassIds.length > 0 && !allowedClassIds.includes(values.classId)) {
      toast({ variant: 'destructive', title: 'Invalid Curriculum Selection', description: 'You can only upload questions for your teaching curricula.' });
      return;
    }
    if (allowedSubjectIds.length > 0 && !allowedSubjectIds.includes(values.subjectId)) {
      toast({ variant: 'destructive', title: 'Invalid Subject Selection', description: 'You can only upload questions for subjects in your teaching profile.' });
      return;
    }
    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const questionsRef = collection(firestore, 'practice_questions');
      const data: any = { ...values };
      const teacherId = questionBankOwnerId;
      const mediaOwnerId = user.uid;
      const rawAlignments = (values.alignments || []) as CategorySelectionInput[];
      const primarySelection = {
        examTypeId: values.examTypeId,
        classId: values.classId,
        subjectId: values.subjectId,
        topicId: values.topicId,
        subtopics: normalizeSubtopics(values.subtopics),
      };
      if (data.questionType === 'MCQ') {
        data.mcqAnswerMode = data.mcqAnswerMode || 'single';
        if (data.mcqAnswerMode === 'multiple') {
          const selected = Array.from(new Set((data.correctAnswers || []).filter(Boolean)));
          data.correctAnswers = selected;
          data.correctAnswer = selected[0] || '';
        } else {
          data.correctAnswers = [];
        }
        data.numericalAnswerText = '';
      } else if (data.questionType === 'Numerical') {
        data.numericalAnswerText = String((values as any).numericalAnswerText ?? (values as any).numericalAnswer ?? '').trim();
      } else {
        data.numericalAnswerText = '';
      }
      data.isPreviousYear = !!values.isPreviousYear;
      data.subtopics = primarySelection.subtopics;
      data.previousYear = values.isPreviousYear ? String(values.previousYear || '').trim() : '';
      data.teacherId = teacherId;
      data.uploadedByUserId = user.uid;
      data.uploadedByEmail = user.email || '';
      data.uploadedByName = user.displayName || user.email || 'Question Upload';
      data.createdAt = new Date().toISOString();
      data.updatedAt = data.createdAt;
      data.mockTestOnly = !!values.mockTestOnly;
      // OCR questions should be consumed as text. Keep question image only for explicit image-only mode.
      const isImageOnlyQuestion = normalizeForFingerprint(data.questionText) === normalizeForFingerprint('Question attached as image');
      if (!isImageOnlyQuestion) {
        data.imageUrls = [];
        delete data.imageUrl;
      }
      const localQuestionIndexForSubmit = teacherScopedQuestionsForNumbering.filter((question) =>
        question.teacherId === questionBankOwnerId
        && (allowedClassIds.length === 0 || allowedClassIds.includes(question.classId))
        && (allowedSubjectIds.length === 0 || allowedSubjectIds.includes(question.subjectId))
      );
      const questionNumberPlan = computeQuestionNumberPlan(
        localQuestionIndexForSubmit,
        primarySelection,
        rawAlignments
      );
      const assignedQuestionNumber = questionNumberPlan.primaryQuestionNumber;
      data.questionNumber = assignedQuestionNumber;
      data.questionTitle = buildQuestionTitle(assignedQuestionNumber);
      data.alignments = rawAlignments
        .map((item: any, index: number) => {
          if (!item.examTypeId || !item.classId || !item.subjectId || !item.topicId) {
            return null;
          }
          const alignmentQuestionNumber = questionNumberPlan.alignmentQuestionNumbersByIndex[index] || 0;
          return {
            ...item,
            subtopics: normalizeSubtopics(item.subtopics),
            accessLevel: item.accessLevel === 'paid' ? 'paid' : 'free',
            mockTestOnly: !!item.mockTestOnly,
            isPreviousYear: !!item.isPreviousYear,
            previousYear: item.isPreviousYear ? String(item.previousYear || '').trim() : '',
            questionNumber: alignmentQuestionNumber > 0 ? alignmentQuestionNumber : undefined,
            questionTitle: alignmentQuestionNumber > 0 ? buildQuestionTitle(alignmentQuestionNumber) : undefined,
          };
        })
        .filter(Boolean);
      data.categoryKeys = getCategoryKeysForSelection(primarySelection, data.alignments);
      const initialQuestionImages = isImageOnlyQuestion
        ? getPersistedPracticeQuestionImageUrls(values.imageUrls)
        : [];
      const initialExplanationImages = getPersistedPracticeQuestionImageUrls(values.explanationImageUrls);
      data.imageUrls = initialQuestionImages;
      if (initialQuestionImages.length > 0) {
        data.imageUrl = initialQuestionImages[0];
      } else {
        delete data.imageUrl;
      }
      data.explanationImageUrls = initialExplanationImages;
      if (initialExplanationImages.length > 0) {
        data.explanationImageUrl = initialExplanationImages[0];
      } else {
        delete data.explanationImageUrl;
      }
      data.questionFingerprint = buildQuestionFingerprint(data);
      const duplicateExists = localQuestionIndexForSubmit.some((q) =>
        q.questionFingerprint === data.questionFingerprint || buildQuestionFingerprint(q) === data.questionFingerprint
      );
      if (duplicateExists) {
        toast({
          variant: 'destructive',
          title: 'Duplicate question detected',
          description: 'This exact question already exists in your question bank.',
        });
        return;
      }
      const createdQuestion = await addDocumentNonBlocking(questionsRef, data);
      if (!createdQuestion) {
        toast({
          variant: 'destructive',
          title: 'Question save failed',
          description: 'The question could not be saved. Please retry once.',
        });
        return;
      }
      updateSubtopicCatalogCache((currentQuestions) => [
        ...currentQuestions.filter((question) => question.id !== createdQuestion.id),
        { id: createdQuestion.id, ...(data as Omit<PracticeQuestion, 'id'>) },
      ]);
      void syncPracticeQuestionSummaryForCreate(firestore, data);
      void (async () => {
        try {
          const [persistedQuestionImages, persistedExplanationImages] = await Promise.all([
            isImageOnlyQuestion
              ? persistPracticeQuestionImageUrls(storage, mediaOwnerId, 'question', values.imageUrls)
              : Promise.resolve([]),
            persistPracticeQuestionImageUrls(storage, mediaOwnerId, 'solution', values.explanationImageUrls),
          ]);
          const finalizedData = {
            ...data,
            imageUrls: persistedQuestionImages,
            explanationImageUrls: persistedExplanationImages,
          };
          if (persistedQuestionImages.length > 0) {
            finalizedData.imageUrl = persistedQuestionImages[0];
          } else {
            delete finalizedData.imageUrl;
          }
          if (persistedExplanationImages.length > 0) {
            finalizedData.explanationImageUrl = persistedExplanationImages[0];
          } else {
            delete finalizedData.explanationImageUrl;
          }
          finalizedData.questionFingerprint = buildQuestionFingerprint(finalizedData);

          const verifiedQuestionIndex = await loadQuestionIndexForSubmit(
            primarySelection,
            rawAlignments,
            finalizedData.questionFingerprint
          );
          const verifiedScopedQuestions = verifiedQuestionIndex.filter((question) =>
            question.id !== createdQuestion.id
            && question.teacherId === questionBankOwnerId
            && (allowedClassIds.length === 0 || allowedClassIds.includes(question.classId))
            && (allowedSubjectIds.length === 0 || allowedSubjectIds.includes(question.subjectId))
          );
          const verifiedNumberPlan = computeQuestionNumberPlan(
            verifiedScopedQuestions,
            primarySelection,
            rawAlignments
          );
          const verifiedAlignments = data.alignments.map((alignment: CategorySelectionInput, index: number) => {
            const verifiedAlignmentNumber = verifiedNumberPlan.alignmentQuestionNumbersByIndex[index] || 0;
            return {
              ...alignment,
              questionNumber: verifiedAlignmentNumber > 0 ? verifiedAlignmentNumber : undefined,
              questionTitle: verifiedAlignmentNumber > 0 ? buildQuestionTitle(verifiedAlignmentNumber) : undefined,
            };
          });

          const finalizationPatch: any = {
            imageUrls: finalizedData.imageUrls,
            explanationImageUrls: finalizedData.explanationImageUrls,
            questionFingerprint: finalizedData.questionFingerprint,
            questionNumber: verifiedNumberPlan.primaryQuestionNumber,
            questionTitle: buildQuestionTitle(verifiedNumberPlan.primaryQuestionNumber),
            alignments: verifiedAlignments,
            updatedAt: new Date().toISOString(),
          };
          if (finalizedData.imageUrl) {
            finalizationPatch.imageUrl = finalizedData.imageUrl;
          }
          if (finalizedData.explanationImageUrl) {
            finalizationPatch.explanationImageUrl = finalizedData.explanationImageUrl;
          }

          await updateDocumentNonBlocking(createdQuestion, finalizationPatch);
        } catch (error: any) {
          console.error('Practice question background finalization failed:', error);
          toast({
            variant: 'destructive',
            title: 'Question saved, attachment sync failed',
            description: error?.message || 'The question was saved, but media may need to be attached again.',
          });
        }
      })();
      toast({
        title: 'Question Added!',
        description: 'The new practice question has been saved.',
      });
      const nextValues = buildNextQuestionFormValues(values);
      nextValues.questionTitle = buildQuestionTitle(assignedQuestionNumber + 1);
      form.reset(nextValues);
      setClearQuestionContentSignal((v) => v + 1);
    } catch (error: any) {
      console.error('Practice question save failed:', error);
      toast({
        variant: 'destructive',
        title: 'Question save failed',
        description: error?.message || 'The question could not be saved. Please retry.',
      });
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const handleDeleteRequest = (questionId: string) => {
    if (isTeacherAuthoringRestricted) {
      toast({
        variant: 'destructive',
        title: 'Question editing disabled',
        description: getTeacherAuthoringRestrictionCopy(),
      });
      return;
    }
    setQuestionToDelete(questionId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (isTeacherAuthoringRestricted) {
      toast({
        variant: 'destructive',
        title: 'Question editing disabled',
        description: getTeacherAuthoringRestrictionCopy(),
      });
      setIsDeleteDialogOpen(false);
      return;
    }
    if (questionToDelete) {
      const targetQuestion = (questions || []).find((item) => item.id === questionToDelete);
      if (!targetQuestion || targetQuestion.teacherId !== questionBankOwnerId) {
        toast({
          variant: 'destructive',
          title: 'Delete Not Allowed',
          description: 'You can only delete questions from the active question bank.',
        });
        setIsDeleteDialogOpen(false);
        return;
      }
      try {
        await deleteDoc(doc(firestore, 'practice_questions', questionToDelete));
        await syncPracticeQuestionSummaryForDelete(firestore, targetQuestion);
        updateSubtopicCatalogCache((currentQuestions) => (
          currentQuestions.filter((question) => question.id !== questionToDelete)
        ));
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Delete failed',
          description: error?.message || 'The question could not be deleted right now.',
        });
        return;
      }
      toast({
        title: 'Question Deleted',
        description: 'The question has been removed from the question bank.',
      });
      setQuestionToDelete(null);
    }
    setIsDeleteDialogOpen(false);
  };
  
  const teacherViewProps = {
    form,
    onSubmit,
    isTopicOptionsLoading: areTopicsLoading,
    isQuestionBankLoading: isQuestionBankIndexLoading,
    isSubmitting,
    isTeacher: canAccessQuestionUpload,
    topicMap,
    classMap,
    examTypeMap,
    setEditingQuestion,
    handleDeleteRequest,
    classes,
    subjects,
    topics,
    examTypes,
    currentUserId: user?.uid,
    questionBankOwnerId,
    allQuestions: questions || [],
    existingTeacherQuestions: teacherScopedQuestionsForNumbering,
    subtopicCatalogQuestions,
    isSubtopicCatalogLoading,
    allowedClassIds,
    allowedSubjectIds,
    formResetSignal,
    clearQuestionContentSignal,
    onResetFields: handleResetFields,
  };

  const isBankOnlyView = searchParams.get('view') === 'bank';

  useEffect(() => {
    if (isBankOnlyView) {
      router.replace('/practice/bank');
    }
  }, [isBankOnlyView, router]);

  useEffect(() => {
    if (!isTeacherAuthoringRestricted) return;
    router.replace('/dashboard');
  }, [isTeacherAuthoringRestricted, router]);

  useEffect(() => {
    if (!isTeacherLoading && !canAccessQuestionUpload && isExplicitStudent) {
      router.replace('/dcam-practice-session');
    }
  }, [canAccessQuestionUpload, isExplicitStudent, isTeacherLoading, router]);

  if (!isTeacherLoading && !canAccessQuestionUpload && isExplicitStudent) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Practice" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="shadow-lg">
            <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Redirecting to practice setup...
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

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
      {isBankOnlyView ? (
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="shadow-lg">
            <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Redirecting to filter page...
            </CardContent>
          </Card>
        </main>
      ) : <TeacherView {...teacherViewProps} isBankOnlyView={isBankOnlyView} />}
      <Dialog open={!!editingQuestion} onOpenChange={(isOpen) => !isOpen && setEditingQuestion(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>Make changes to the question below. Click save when you're done.</DialogDescription>
          </DialogHeader>
          {editingQuestion && !isTeacherFormLoading && !isTeacherAuthoringRestricted && (
            <EditQuestionForm
              key={editingQuestion.id}
              questionToEdit={editingQuestion}
              classes={classes || []}
              subjects={subjects || []}
              topics={topics || []}
              examTypes={examTypes || []}
              currentUserId={user?.uid}
              questionBankOwnerId={questionBankOwnerId}
              allowedClassIds={allowedClassIds}
              allowedSubjectIds={allowedSubjectIds}
              onFinished={() => setEditingQuestion(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete this question.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setQuestionToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className={cn(buttonVariants({ variant: "destructive" }))}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

