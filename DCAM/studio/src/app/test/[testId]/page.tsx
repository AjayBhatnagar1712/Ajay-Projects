'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { doc, collection, query, where, serverTimestamp, runTransaction } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Timer, User, ArrowLeft, Check, XIcon, Trophy, Users, BarChart, Flag, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import MathText from '@/components/math-text';
import ExamSessionLoader, { type ExamSessionLoaderPhase } from '@/components/exam-session-loader';
import {
    ExamImageGallery,
    getExamQuestionAssetUrls,
    normalizeExamImageUrls,
    preloadExamImageUrls,
    waitForExamImagesInElement,
} from '@/components/exam-image-gallery';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
    getLiveBatchTestTeacherQuestionAccessCheckAt,
    getLiveBatchTestAttemptState,
    hasPaidLiveBatchTestTokenAccessAtStart,
    resolveLiveBatchTestSchedule,
} from '@/lib/live-batch-test-access';
import type { LiveBatchEnrollmentLike, LiveBatchSessionLike } from '@/lib/live-batch-session-access';
import {
    buildPremiumCustomMockAttemptRuleFromLegacyLimit,
    consumePremiumCustomMockAttempt,
    resolvePremiumCustomMockAttemptUsage,
    type PremiumCustomMockAttemptPricingRule,
    type PremiumCustomMockAttemptState,
} from '@/lib/premium-custom-mock';
import { formatTestDurationLabel, normalizeTestDurationMinutes } from '@/lib/test-duration';
import {
    fetchPracticeQuestionDocsByIds,
    loadSubjectNameMap,
    readDocSnapshotResilient,
    readQuerySnapshotResilient,
} from '@/lib/exam-question-loader';
import {
    buildPracticeQuestionScopeEntries,
    type PracticeQuestionScopeAlignment,
} from '@/lib/practice-question-scope';
import { extractSubtopicPaths, normalizeSubtopicValue, splitSubtopicPath } from '@/lib/subtopic-paths';
import {
    buildTeacherPremiumQuestionTestBlockedReason,
    resolveTeacherPremiumQuestionAccessMap,
} from '@/lib/teacher-premium-question-test-access';

type QuestionType = 'MCQ' | 'Numerical' | 'Text';
type SubjectName = 'Physics' | 'Chemistry' | 'Mathematics' | string;
enum QuestionStatus {
  NotAnswered,
  Answered,
  MarkedForReview,
  AnsweredAndMarkedForReview,
  NotVisited,
}

type MockQuestion = {
  id: string;
  examTypeId?: string;
  classId?: string;
  subjectId: string;
  topicId?: string;
  subtopics?: string[];
  accessLevel?: 'free' | 'paid';
  mockTestOnly?: boolean;
  isPreviousYear?: boolean;
  previousYear?: string;
  difficultyLevel?: 'Easy' | 'Medium' | 'Hard';
  teacherId?: string;
  alignments?: PracticeQuestionScopeAlignment[];
  questionText: string;
  solutionExplanation?: string;
  questionType: 'MCQ' | 'Numerical' | 'Text';
  options?: string[];
  correctAnswer?: string;
  numericalAnswer?: number;
  numericalAnswerText?: string;
  textAnswer?: string;
  subject: SubjectName;
  imageUrl?: string;
  imageUrls?: string[];
  explanationImageUrl?: string;
  explanationImageUrls?: string[];
  solutionImageUrl?: string;
  solutionImageUrls?: string[];
  explanation?: string;
  explanationText?: string;
  answerExplanation?: string;
};

type Answer = {
  value: string | number;
  status: QuestionStatus;
};
type AttemptLimitMode = 'unlimited' | 'total' | 'interval';
type AttemptIntervalUnit = 'day' | 'week' | 'month' | 'year';
type AttemptLimitSettings = {
    mode: AttemptLimitMode;
    maxTotalAttempts: number | null;
    maxAttemptsPerInterval: number | null;
    intervalValue: number | null;
    intervalUnit: AttemptIntervalUnit | null;
};
type AttemptHistoryEntry = {
    studentId?: string;
    submittedAt?: unknown;
};
type TestQuestionSourceMode = 'all' | 'pyq';
type TestSectionConfig = {
    subjectId: string;
    topicId?: string;
    subtopic?: string;
    subtopicPaths?: string[];
    questionAccessLevel?: 'free' | 'paid';
    questionType?: 'All' | 'MCQ' | 'Numerical' | 'Text';
    difficultyLevel?: 'All' | 'Easy' | 'Medium' | 'Hard';
    questionSource?: TestQuestionSourceMode;
    previousYearMode?: TestQuestionSourceMode;
    previousYears?: string[];
    numQuestions?: number;
    count?: number;
    randomizePerAttempt?: boolean;
};

const normalizeText = (value: string | number | undefined) => String(value ?? '').trim().toLowerCase();
const PREVIOUS_YEAR_PATTERN = /^(19|20)\d{2}$/;
const normalizeQuestionIdList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
        value
            .map((item) => String(item || '').trim())
            .filter(Boolean)
    ));
};
const mergeQuestionIdLists = (...groups: unknown[]) => Array.from(new Set(groups.flatMap(normalizeQuestionIdList)));
const normalizePreviousYearValue = (value?: string) => {
    const year = String(value || '').trim();
    return PREVIOUS_YEAR_PATTERN.test(year) ? year : '';
};
const normalizePreviousYearList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
        value
            .map((item) => normalizePreviousYearValue(String(item || '')))
            .filter(Boolean)
    )).sort((a, b) => Number(b) - Number(a));
};
const normalizePreviousYearMode = (value: unknown): TestQuestionSourceMode => (value === 'pyq' ? 'pyq' : 'all');
const normalizeSubtopicPathSegments = (segments: string[]) =>
    segments.map((segment) => String(segment || '').trim()).filter(Boolean);
const parseSubtopicPathSelection = (value?: string) =>
    normalizeSubtopicPathSegments(splitSubtopicPath(String(value || '')));
const serializeSubtopicPathSelection = (segments: string[]) =>
    normalizeSubtopicPathSegments(segments).join(' > ');
const getSubtopicPathKey = (segments: string[]) =>
    normalizeSubtopicPathSegments(segments).map((segment) => normalizeSubtopicValue(segment)).join('>');
const normalizeSubtopicPathSelections = (subtopicPaths: string[] = [], legacySubtopic?: string) => {
    const unique = new Map<string, string>();
    [...subtopicPaths, legacySubtopic || ''].forEach((value) => {
        const parsed = parseSubtopicPathSelection(value);
        if (!parsed.length) return;
        const key = getSubtopicPathKey(parsed);
        if (!key || unique.has(key)) return;
        unique.set(key, serializeSubtopicPathSelection(parsed));
    });
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
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
const matchesSelectedSubtopicPaths = (
    subtopics: string[] | undefined,
    selectedSubtopics: string[] = []
) => {
    const normalizedSelections = normalizeSubtopicPathSelections(selectedSubtopics);
    if (normalizedSelections.length === 0) return true;
    const questionPaths = extractSubtopicPaths(subtopics);
    if (questionPaths.length === 0) return false;
    return normalizedSelections.some((selection) => {
        const selectionPath = parseSubtopicPathSelection(selection);
        return questionPaths.some((questionPath) => subtopicPathStartsWith(questionPath, selectionPath));
    });
};
const matchesPreviousYearScope = (
    isPreviousYear: unknown,
    previousYear: unknown,
    previousYearMode: TestQuestionSourceMode,
    selectedPreviousYears: string[] = []
) => {
    if (previousYearMode !== 'pyq') return true;
    const year = normalizePreviousYearValue(String(previousYear || ''));
    if (!isPreviousYear || !year) return false;
    if (selectedPreviousYears.length === 0) return true;
    return selectedPreviousYears.includes(year);
};
const matchesQuestionBankSourceValue = (
    mockTestOnly: unknown,
    source: 'student_plus_official' | 'teacher_official'
) => (source === 'teacher_official' ? !!mockTestOnly : !mockTestOnly);
const getSectionRequestedQuestionCount = (section: TestSectionConfig) =>
    Number(section.numQuestions ?? section.count ?? 0);
const getSectionSubtopicSelections = (section: TestSectionConfig) =>
    normalizeSubtopicPathSelections(section.subtopicPaths || [], section.subtopic);

const getExplanationAssets = (question: MockQuestion) => {
    const explanationImages = normalizeExamImageUrls(
        (question as any).explanationImageUrls,
        (question as any).explanationImageUrl,
        (question as any).solutionImageUrls,
        (question as any).solutionImageUrl,
        (question as any).solutionImages,
        (question as any).answerExplanationImageUrls,
        (question as any).answerExplanationImageUrl,
        (question as any).answerExplanationImages,
        (question as any).explanationImages,
        (question as any).ocrExplanationImageUrls,
        (question as any).ocrExplanationImageUrl,
        (question as any).ocrExplanationImages,
    );

    const textCandidates = [
        question.solutionExplanation,
        (question as any).explanation,
        (question as any).explanationText,
        (question as any).answerExplanation,
    ];
    const explanationText = textCandidates.find((value) => typeof value === 'string' && value.trim()) || '';

    return { explanationImages, explanationText };
};
const getQuestionImageUrls = (question: Pick<MockQuestion, 'imageUrl' | 'imageUrls'>) =>
    normalizeExamImageUrls(question.imageUrls, question.imageUrl).slice(0, 1);
const isImageOnlyQuestionPlaceholder = (questionText?: string) =>
    normalizeText(questionText) === 'question attached as image';
const isAnswerCorrect = (question: MockQuestion, answerValue: string | number | undefined) => {
    if (question.questionType === 'MCQ') return question.correctAnswer === answerValue;
    if (question.questionType === 'Numerical') return Number(question.numericalAnswer) === Number(answerValue);
    return normalizeText(question.textAnswer) === normalizeText(answerValue);
};
const getCorrectAnswer = (question: MockQuestion) => question.correctAnswer ?? question.numericalAnswerText ?? question.numericalAnswer ?? question.textAnswer ?? '-';

const parseAttemptDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
        const dt = new Date(value);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate();
    }
    return null;
};

const waitForNextPaint = async () => {
    if (typeof window === 'undefined') return;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
};

const PDF_CAPTURE_THEME_TOKENS: Record<string, string> = {
    '--background': '210 20% 98%',
    '--foreground': '215 28% 17%',
    '--card': '0 0% 100%',
    '--card-foreground': '215 28% 17%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '215 28% 17%',
    '--primary': '220 90% 55%',
    '--primary-foreground': '210 20% 98%',
    '--secondary': '215 20% 90%',
    '--secondary-foreground': '215 28% 17%',
    '--muted': '215 20% 90%',
    '--muted-foreground': '215 20% 45%',
    '--accent': '25 95% 53%',
    '--accent-foreground': '210 20% 98%',
    '--destructive': '0 84.2% 60.2%',
    '--destructive-foreground': '210 40% 98%',
    '--border': '215 20% 85%',
    '--input': '215 20% 85%',
    '--ring': '220 90% 55%',
    '--chart-1': '220 90% 55%',
    '--chart-2': '25 95% 53%',
    '--chart-3': '160 84% 39%',
    '--chart-4': '346 77% 49%',
    '--chart-5': '280 73% 56%',
    '--radius': '0.75rem',
    '--sidebar-background': '0 0% 100%',
    '--sidebar-foreground': '215 28% 17%',
    '--sidebar-primary': '220 90% 55%',
    '--sidebar-primary-foreground': '210 20% 98%',
    '--sidebar-accent': '215 20% 90%',
    '--sidebar-accent-foreground': '215 28% 17%',
    '--sidebar-border': '215 20% 85%',
    '--sidebar-ring': '220 90% 55%',
};

const applyPdfCaptureTheme = (wrapper: HTMLDivElement, clone: HTMLElement) => {
    wrapper.style.colorScheme = 'light';
    Object.entries(PDF_CAPTURE_THEME_TOKENS).forEach(([key, value]) => {
        wrapper.style.setProperty(key, value);
    });

    clone.style.color = 'hsl(var(--foreground))';
    clone.style.background = 'hsl(var(--card))';
    clone.style.borderColor = 'hsl(var(--border))';

    const cards = Array.from(clone.querySelectorAll('div.rounded-lg.border'));
    cards.forEach((card, index) => {
        const element = card as HTMLDivElement;
        const isRootCard = index === 0 && element === clone;
        element.style.background = isRootCard ? 'hsl(var(--card))' : 'hsl(var(--background))';
        element.style.borderColor = 'hsl(var(--border))';
        element.style.boxShadow = isRootCard ? '0 16px 40px rgba(15, 23, 42, 0.08)' : 'none';
    });
};

const buildPdfCaptureImageUrl = (value: string) => {
    const url = String(value || '').trim();
    if (!url || typeof window === 'undefined') return url;
    if (/^(data:image\/|blob:|\/)/i.test(url)) return url;

    try {
        const parsed = new URL(url, window.location.origin);
        if (parsed.origin === window.location.origin) return parsed.toString();
        const proxyUrl = new URL('/api/exam-media-proxy', window.location.origin);
        proxyUrl.searchParams.set('url', parsed.toString());
        return proxyUrl.toString();
    } catch {
        return url;
    }
};

const buildPdfCaptureClone = (source: HTMLElement) => {
    if (typeof document === 'undefined') {
        throw new Error('Document is not available for PDF export.');
    }

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-pdf-capture-root', 'true');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-100000px';
    wrapper.style.top = '0';
    wrapper.style.zIndex = '-1';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.opacity = '0';
    wrapper.style.background = '#ffffff';
    wrapper.style.padding = '0';
    wrapper.style.margin = '0';

    const clone = source.cloneNode(true) as HTMLElement;
    clone.style.width = `${Math.max(source.scrollWidth, source.clientWidth)}px`;
    clone.style.maxWidth = 'none';
    clone.style.background = '#ffffff';

    const images = Array.from(clone.querySelectorAll('img'));
    images.forEach((image) => {
        const element = image as HTMLImageElement;
        const originalSrc = element.currentSrc || element.getAttribute('src') || '';
        const rewrittenSrc = buildPdfCaptureImageUrl(originalSrc);
        if (rewrittenSrc) {
            element.setAttribute('src', rewrittenSrc);
            element.src = rewrittenSrc;
        }
        element.loading = 'eager';
        element.decoding = 'sync';
        element.removeAttribute('srcset');
        element.removeAttribute('sizes');
        element.setAttribute('crossorigin', 'anonymous');
    });

    applyPdfCaptureTheme(wrapper, clone);
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);
    return { wrapper, clone };
};

const subtractInterval = (base: Date, value: number, unit: AttemptIntervalUnit): Date => {
    const dt = new Date(base);
    const amount = Math.max(1, Math.floor(Number(value) || 1));
    if (unit === 'day') dt.setDate(dt.getDate() - amount);
    if (unit === 'week') dt.setDate(dt.getDate() - (amount * 7));
    if (unit === 'month') dt.setMonth(dt.getMonth() - amount);
    if (unit === 'year') dt.setFullYear(dt.getFullYear() - amount);
    return dt;
};

const normalizeAttemptLimit = (config: any): AttemptLimitSettings => {
    const raw = config?.attemptLimit || {};
    const mode = raw?.mode;
    return {
        mode: mode === 'total' || mode === 'interval' ? mode : 'unlimited',
        maxTotalAttempts: Number.isFinite(Number(raw?.maxTotalAttempts)) ? Number(raw.maxTotalAttempts) : null,
        maxAttemptsPerInterval: Number.isFinite(Number(raw?.maxAttemptsPerInterval)) ? Number(raw.maxAttemptsPerInterval) : null,
        intervalValue: Number.isFinite(Number(raw?.intervalValue)) ? Number(raw.intervalValue) : null,
        intervalUnit: (typeof raw?.intervalUnit === 'string' && ['day', 'week', 'month', 'year'].includes(raw.intervalUnit))
            ? raw.intervalUnit as AttemptIntervalUnit
            : null,
    };
};

const evaluateAttemptLimit = (
    settings: AttemptLimitSettings,
    history: AttemptHistoryEntry[],
    studentId: string
): { blocked: boolean; message: string } => {
    if (settings.mode === 'unlimited') return { blocked: false, message: '' };
    const userAttempts = history.filter((item) => item?.studentId === studentId);
    if (settings.mode === 'total' && settings.maxTotalAttempts) {
        if (userAttempts.length >= settings.maxTotalAttempts) {
            return {
                blocked: true,
                message: `Attempt limit reached. You can attempt this test only ${settings.maxTotalAttempts} time${settings.maxTotalAttempts === 1 ? '' : 's'} in total.`,
            };
        }
        return { blocked: false, message: '' };
    }
    if (
        settings.mode === 'interval'
        && settings.maxAttemptsPerInterval
        && settings.intervalValue
        && settings.intervalUnit
    ) {
        const now = new Date();
        const windowStart = subtractInterval(now, settings.intervalValue, settings.intervalUnit);
        const usedInWindow = userAttempts.filter((item) => {
            const attemptedAt = parseAttemptDate(item?.submittedAt);
            return !!attemptedAt && attemptedAt.getTime() >= windowStart.getTime();
        }).length;
        if (usedInWindow >= settings.maxAttemptsPerInterval) {
            const intervalLabel = `${settings.intervalValue} ${settings.intervalUnit}${settings.intervalValue === 1 ? '' : 's'}`;
            return {
                blocked: true,
                message: `Attempt limit reached. You can attempt this test ${settings.maxAttemptsPerInterval} time${settings.maxAttemptsPerInterval === 1 ? '' : 's'} per ${intervalLabel}.`,
            };
        }
    }
    return { blocked: false, message: '' };
};

type CustomTestConfig = {
    id: string;
    title: string;
    accessLevel: 'free' | 'paid';
    questionAccessLevel?: 'free' | 'paid';
    questionSource?: 'student_plus_official' | 'teacher_official';
    examTypeId?: string;
    classId?: string;
    teacherId?: string;
    createdFromTeacherId?: string;
    purchasedAt?: unknown;
    attemptLimit?: {
        mode?: AttemptLimitMode;
        maxTotalAttempts?: number | null;
        maxAttemptsPerInterval?: number | null;
        intervalValue?: number | null;
        intervalUnit?: AttemptIntervalUnit | null;
    };
    attemptPricing?: PremiumCustomMockAttemptPricingRule | null;
    attemptState?: PremiumCustomMockAttemptState | null;
    includedQuestionIds?: string[];
    includedSubjectConfigs?: TestSectionConfig[];
    config: {
        questionIds: string[];
        duration?: number | null;
        marksPerQuestion?: number;
        negativeMarksPerQuestion?: number;
        subjectConfigs?: TestSectionConfig[];
    };
}

type OfficialTestConfig = {
    id: string;
    title: string;
    startTime: { toDate: () => Date };
    examCategory: 'JEE Main' | 'JEE Advanced' | 'Both';
    accessLevel: 'free' | 'paid';
    isLiveBatchTest?: boolean;
    liveBatchId?: string;
    availabilityMode?: 'single_day' | 'unlimited';
    scheduledDate?: string;
    scheduledTime?: string;
    scheduledEndTime?: string;
    accessStartTime?: string;
    accessEndTime?: string;
    accessWindowStartAt?: unknown;
    accessWindowEndAt?: unknown;
    questionAccessLevel?: 'free' | 'paid';
    questionSource?: 'student_plus_official' | 'teacher_official';
    examTypeId?: string;
    classId?: string;
    teacherId?: string;
    isCourseOnly?: boolean;
    courseId?: string;
    attemptLimit?: {
        mode?: AttemptLimitMode;
        maxTotalAttempts?: number | null;
        maxAttemptsPerInterval?: number | null;
        intervalValue?: number | null;
        intervalUnit?: AttemptIntervalUnit | null;
    };
    config: {
        questionIds: string[];
        duration?: number | null;
        marksPerQuestion?: number;
        negativeMarksPerQuestion?: number;
        subjectConfigs?: TestSectionConfig[];
    };
}

type LiveBatchConfig = {
    id: string;
    accessLevel?: 'free' | 'paid';
    contentUnlockLeadMinutes?: number;
}

type TestAnalytics = {
  averageScore: number;
  topperScore: number;
  averageTimeTaken: number;
  numberOfAttempts: number;
  attemptHistory?: AttemptHistoryEntry[];
};

type ScoringSettings = {
  hasScoring: boolean;
  marksPerQuestion: number | null;
  negativeMarksPerQuestion: number | null;
};

type AttemptMetrics = {
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  finalScore: number;
  accuracyPercent: number;
};

const isFiniteNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const resolveScoringSettings = (
  testType: string | null,
  config: CustomTestConfig | OfficialTestConfig | null
): ScoringSettings => {
  if (testType === 'custom') {
    return {
      hasScoring: true,
      marksPerQuestion: Number((config as CustomTestConfig | null)?.config?.marksPerQuestion ?? 4),
      negativeMarksPerQuestion: Number((config as CustomTestConfig | null)?.config?.negativeMarksPerQuestion ?? 1),
    };
  }

  const officialConfig = config as OfficialTestConfig | null;
  const rawMarks = officialConfig?.config?.marksPerQuestion;
  const rawNegativeMarks = officialConfig?.config?.negativeMarksPerQuestion;

  if (officialConfig?.isCourseOnly) {
    if (isFiniteNonNegativeNumber(rawMarks) && isFiniteNonNegativeNumber(rawNegativeMarks)) {
      return {
        hasScoring: true,
        marksPerQuestion: rawMarks,
        negativeMarksPerQuestion: rawNegativeMarks,
      };
    }
    return {
      hasScoring: false,
      marksPerQuestion: null,
      negativeMarksPerQuestion: null,
    };
  }

  return {
    hasScoring: true,
    marksPerQuestion: isFiniteNonNegativeNumber(rawMarks) ? rawMarks : 4,
    negativeMarksPerQuestion: isFiniteNonNegativeNumber(rawNegativeMarks) ? rawNegativeMarks : 1,
  };
};

const calculateAttemptMetrics = (
  questions: MockQuestion[],
  answers: Map<string | number, Answer>,
  scoring: ScoringSettings
): AttemptMetrics => {
  let answeredCount = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let finalScore = 0;

  questions.forEach((question) => {
    const answer = answers.get(question.id);
    const attempted = answer && answer.value !== '' && answer.value !== undefined;
    if (!attempted) return;

    answeredCount += 1;
    const correct = isAnswerCorrect(question, answer.value);
    if (correct) {
      correctCount += 1;
      finalScore += scoring.hasScoring ? (scoring.marksPerQuestion ?? 0) : 1;
      return;
    }

    wrongCount += 1;
    if (scoring.hasScoring) {
      finalScore -= scoring.negativeMarksPerQuestion ?? 0;
    }
  });

  return {
    answeredCount,
    correctCount,
    wrongCount,
    unansweredCount: questions.length - answeredCount,
    finalScore,
    accuracyPercent: answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0,
  };
};

const fetchQuestionsByIds = async (firestore: any, questionIds: string[]): Promise<MockQuestion[]> => {
    const [subjectsMap, docs] = await Promise.all([
        loadSubjectNameMap(firestore),
        fetchPracticeQuestionDocsByIds(firestore, questionIds, 'test questions'),
    ]);

    return docs.map(({ id, data }) => ({
        ...(data as any),
        id,
        subject: subjectsMap.get(String(data.subjectId || '').trim()) || 'Unknown Subject',
    } as MockQuestion));
};

const sectionMatchesQuestion = (
    question: MockQuestion,
    section: TestSectionConfig,
    context: {
        examTypeId?: string;
        classId?: string;
        accessLevel?: 'free' | 'paid';
        questionSource?: 'student_plus_official' | 'teacher_official';
    }
) => {
    const questionAccessFilter = section.questionAccessLevel || context.accessLevel;
    const questionTypeFilter = section.questionType || 'All';
    const difficultyFilter = section.difficultyLevel || 'All';
    const topicFilter = section.topicId || '';
    const selectedSubtopics = getSectionSubtopicSelections(section);
    const previousYearMode = normalizePreviousYearMode(section.previousYearMode || section.questionSource);
    const previousYears = normalizePreviousYearList(section.previousYears || []);

    return buildPracticeQuestionScopeEntries(question).some((entry) => {
        if (context.examTypeId && entry.examTypeId !== context.examTypeId) return false;
        if (context.classId && entry.classId !== context.classId) return false;
        if (section.subjectId && entry.subjectId !== section.subjectId) return false;
        if (topicFilter && entry.topicId !== topicFilter) return false;
        if (questionAccessFilter && entry.accessLevel !== questionAccessFilter) return false;
        if (context.questionSource && !matchesQuestionBankSourceValue(entry.mockTestOnly, context.questionSource)) return false;
        if (questionTypeFilter !== 'All' && entry.questionType !== questionTypeFilter) return false;
        
        if (!matchesSelectedSubtopicPaths(entry.subtopics, selectedSubtopics)) return false;
        if (!matchesPreviousYearScope(entry.isPreviousYear, entry.previousYear, previousYearMode, previousYears)) return false;

        return true;
    });
};

const randomInt = (maxExclusive: number) => {
    if (maxExclusive <= 0) return 0;
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const array = new Uint32Array(1);
        const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
        let value = 0;
        do {
            crypto.getRandomValues(array);
            value = array[0];
        } while (value >= limit);
        return value % maxExclusive;
    }
    return Math.floor(Math.random() * maxExclusive);
};

const shuffleArray = <T,>(items: T[]): T[] => {
    const output = [...items];
    for (let i = output.length - 1; i > 0; i -= 1) {
        const j = randomInt(i + 1);
        [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
};

const fetchSectionCandidateQuestions = async (
    firestore: any,
    section: TestSectionConfig,
    context: {
        accessLevel?: 'free' | 'paid';
        questionSource?: 'student_plus_official' | 'teacher_official';
        teacherId?: string;
        examTypeId?: string;
        classId?: string;
    }
): Promise<MockQuestion[]> => {
    if (!section.subjectId) return [];
    const normalizedTeacherId = String(context.teacherId || '').trim();
    const sectionQuery = normalizedTeacherId
        ? query(collection(firestore, 'practice_questions'), where('teacherId', '==', normalizedTeacherId))
        : query(collection(firestore, 'practice_questions'), where('subjectId', '==', section.subjectId));
    const [sectionSnapshot, subjectsMap] = await Promise.all([
        readQuerySnapshotResilient(sectionQuery, `test section ${section.subjectId}`),
        loadSubjectNameMap(firestore),
    ]);

    const candidates = sectionSnapshot.docs.map((questionDoc) => {
        const data = questionDoc.data();
        return {
            ...(data as any),
            id: questionDoc.id,
            subject: subjectsMap.get(data.subjectId) || 'Unknown Subject',
        } as MockQuestion;
    });

    return candidates.filter((question) => {
        return sectionMatchesQuestion(question, section, {
            examTypeId: context.examTypeId,
            classId: context.classId,
            accessLevel: section.questionAccessLevel || context.accessLevel,
            questionSource: context.questionSource,
        });
    });
};

const AnalyticsDashboard: React.FC<{
  userScore: number;
  userTime: number;
  analytics: TestAnalytics | null;
  isLoading: boolean;
}> = ({ userScore, userTime, analytics, isLoading }) => {
    if(isLoading) {
        return <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>
    }

    if (!analytics) return null;

    return (
        <div className="mt-8">
             <h3 className="font-headline text-2xl mb-4 text-center">Performance Analysis</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="text-center">
                    <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2"><User className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-lg">Your Score</CardTitle></CardHeader>
                    <CardContent><p className="text-4xl font-bold text-primary">{userScore}</p></CardContent>
                </Card>
                 <Card className="text-center">
                    <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2"><Trophy className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-lg">Topper's Score</CardTitle></CardHeader>
                    <CardContent><p className="text-4xl font-bold">{analytics.topperScore.toFixed(0)}</p></CardContent>
                </Card>
                 <Card className="text-center">
                    <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2"><Users className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-lg">Average Score</CardTitle></CardHeader>
                    <CardContent><p className="text-4xl font-bold">{analytics.averageScore.toFixed(0)}</p></CardContent>
                </Card>
                <Card className="text-center">
                    <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2"><Timer className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-lg">Your Time</CardTitle></CardHeader>
                    <CardContent><p className="text-4xl font-bold">{userTime} <span className='text-base font-normal'>mins</span></p></CardContent>
                </Card>
                <Card className="text-center">
                    <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2"><Timer className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-lg">Average Time</CardTitle></CardHeader>
                    <CardContent><p className="text-4xl font-bold">{analytics.averageTimeTaken.toFixed(0)} <span className='text-base font-normal'>mins</span></p></CardContent>
                </Card>
                 <Card className="text-center">
                    <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2"><BarChart className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-lg">Total Attempts</CardTitle></CardHeader>
                    <CardContent><p className="text-4xl font-bold">{analytics.numberOfAttempts}</p></CardContent>
                </Card>
             </div>
        </div>
    );
}

export default function MockTestPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { testId } = useParams() as { testId: string };
    const searchParams = useSearchParams();
    const router = useRouter();
    const testType = searchParams.get('type');
    const retryToken = searchParams.get('retry') || '';
    const { toast } = useToast();
    const pdfResultsRef = useRef<HTMLDivElement>(null);
    const handleRetryLoad = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('retry', Date.now().toString());
        const nextQuery = params.toString();
        router.replace(nextQuery ? `/test/${testId}?${nextQuery}` : `/test/${testId}`);
    }, [router, searchParams, testId]);

    const [testTitle, setTestTitle] = useState('Loading Test...');
    const [questions, setQuestions] = useState<MockQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [testConfig, setTestConfig] = useState<CustomTestConfig | OfficialTestConfig | null>(null);

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Map<string | number, Answer>>(new Map());
    const [duration, setDuration] = useState<number | null>(180);
    const [timeLeft, setTimeLeft] = useState<number | null>(180 * 60);
    const [attemptStartedAt, setAttemptStartedAt] = useState<number | null>(null);
    const [finalTimeTaken, setFinalTimeTaken] = useState<number | null>(null);
    const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [score, setScore] = useState(0);
    const [analytics, setAnalytics] = useState<TestAnalytics | null>(null);
    const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
    const [userAttemptCount, setUserAttemptCount] = useState(0);
    const [wasAutoSubmitted, setWasAutoSubmitted] = useState(false);
    const [attemptLimitBlockedReason, setAttemptLimitBlockedReason] = useState<string | null>(null);
    const [accessWindowBlockedReason, setAccessWindowBlockedReason] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [launchPhase, setLaunchPhase] = useState<ExamSessionLoaderPhase>('config');
    const [launchProgress, setLaunchProgress] = useState(4);
    const [launchDetail, setLaunchDetail] = useState('Checking your test configuration...');
    const [launchQuestionCount, setLaunchQuestionCount] = useState(0);
    const [launchAssetCount, setLaunchAssetCount] = useState(0);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [reviewScanOpen, setReviewScanOpen] = useState<Record<string, boolean>>({});
    const [reviewExplanationOpen, setReviewExplanationOpen] = useState<Record<string, boolean>>({});
    const [liveSolutionOpen, setLiveSolutionOpen] = useState<Record<string, boolean>>({});
    const officialTestConfig = testType !== 'custom' ? (testConfig as OfficialTestConfig | null) : null;
    const liveBatchId = officialTestConfig?.liveBatchId || '';
    const isLiveBatchTest = Boolean(officialTestConfig?.isLiveBatchTest && liveBatchId);
    const backHref = useMemo(() => {
        if (testType === 'custom') return '/my-practice';
        if (isLiveBatchTest) return `/live-batches/${liveBatchId}/classroom`;
        return `/mock-tests/${testId}`;
    }, [isLiveBatchTest, liveBatchId, testId, testType]);
    const handleBackToSource = useCallback(() => {
        router.push(backHref);
    }, [backHref, router]);
    const isCreatorAttempt = testType !== 'custom'
      && !!user?.uid
      && !!(testConfig as OfficialTestConfig | null)?.teacherId
      && (testConfig as OfficialTestConfig | null)?.teacherId === user.uid;

    const handleDownloadPdf = async () => {
        if (isGeneratingPdf) return;

        toast({
            title: 'Generating PDF...',
            description: 'Loading every question and solution image for your analysis report.',
        });

        try {
            flushSync(() => {
                setIsGeneratingPdf(true);
            });

            await waitForNextPaint();

            if (reportAssetUrls.length > 0) {
                const preloadResult = await preloadExamImageUrls(reportAssetUrls);
                if (preloadResult.failed > 0) {
                    console.warn(`Analysis PDF preload delayed ${preloadResult.failed} asset(s).`);
                }
            }

            await waitForNextPaint();

            const input = pdfResultsRef.current;
            if (!input) {
                throw new Error('The analysis report is not ready for capture yet.');
            }

            let wrapper: HTMLDivElement | null = null;
            let captureNode: HTMLElement | null = null;

            try {
                const prepared = buildPdfCaptureClone(input);
                wrapper = prepared.wrapper;
                captureNode = prepared.clone;

                await waitForNextPaint();
                await waitForExamImagesInElement(captureNode);
                await waitForNextPaint();

                const canvas = await html2canvas(captureNode, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    imageTimeout: 15000,
                    windowWidth: Math.max(captureNode.scrollWidth, captureNode.clientWidth),
                    windowHeight: Math.max(captureNode.scrollHeight, captureNode.clientHeight),
                });

                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgWidth = canvas.width;
                const imgHeight = canvas.height;
                const ratio = pdfWidth / imgWidth;
                const finalImgHeight = imgHeight * ratio;

                let heightLeft = finalImgHeight;
                let position = 0;

                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, finalImgHeight);
                heightLeft -= pdfHeight;

                while (heightLeft > 0) {
                    position -= pdfHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, finalImgHeight);
                    heightLeft -= pdfHeight;
                }

                pdf.save(`test-analysis-${testId}.pdf`);
            } finally {
                wrapper?.remove();
            }
        } catch (error) {
            console.error('Failed to generate analysis PDF:', error);
            toast({
                title: 'Could not generate PDF',
                description: 'The analysis report could not be downloaded. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const getElapsedAttemptMinutes = useCallback(() => {
        if (!attemptStartedAt) return 0;
        return Math.max(0, Math.ceil((Date.now() - attemptStartedAt) / 60000));
    }, [attemptStartedAt]);

    const handleSubmitTest = useCallback(async (options?: { autoSubmitted?: boolean }) => {
        setIsSubmitDialogOpen(false);
        setWasAutoSubmitted(Boolean(options?.autoSubmitted));

        const scoring = resolveScoringSettings(testType, testConfig);
        const metrics = calculateAttemptMetrics(questions, answers, scoring);
        const finalScore = metrics.finalScore;
        setScore(finalScore);
        const userTime = getElapsedAttemptMinutes();
        setFinalTimeTaken(userTime);
        setIsFinished(true);

        if (user && firestore && (testType !== 'custom') && !isCreatorAttempt) {
            try {
                await runTransaction(firestore, async (transaction) => {
                    const analyticsRef = doc(firestore, 'test_analytics', testId);
                    const userResultRef = doc(collection(firestore, 'users', user.uid, 'test_results'));

                    const analyticsDoc = await transaction.get(analyticsRef);

                    const answersToSave: Record<string, any> = {};
                    answers.forEach((ans, qId) => { answersToSave[String(qId)] = ans.value; });

                    const userResultData = {
                        testId: testId,
                        score: finalScore,
                        timeTaken: userTime,
                        answers: answersToSave,
                        questionTimes: {},
                        submittedAt: serverTimestamp(),
                    };

                    const attemptEntry = {
                      studentId: user.uid,
                      studentName: user.displayName || user.email || 'Student',
                      score: finalScore,
                      timeTaken: userTime,
                      attemptedQuestions: metrics.answeredCount,
                      correctQuestions: metrics.correctCount,
                      incorrectQuestions: metrics.wrongCount,
                      answers: answersToSave,
                      questionTimes: {},
                      submittedAt: new Date().toISOString(),
                    };

                    if (!analyticsDoc.exists()) {
                        transaction.set(analyticsRef, {
                            id: testId,
                            totalScore: finalScore,
                            totalTimeTaken: userTime,
                            numberOfAttempts: 1,
                            averageScore: finalScore,
                            averageTimeTaken: userTime,
                            topperScore: finalScore,
                            topperStudentName: user.displayName || 'Anonymous',
                            attemptHistory: [attemptEntry],
                        });
                    } else {
                        const oldAnalytics = analyticsDoc.data();
                        const newNumberOfAttempts = oldAnalytics.numberOfAttempts + 1;
                        const newTotalScore = oldAnalytics.totalScore + finalScore;
                        const newTotalTimeTaken = oldAnalytics.totalTimeTaken + userTime;
                        
                        let newTopperScore = oldAnalytics.topperScore;
                        let newTopperStudentName = oldAnalytics.topperStudentName;
                        if (finalScore > oldAnalytics.topperScore) {
                            newTopperScore = finalScore;
                            newTopperStudentName = user.displayName || 'Anonymous';
                        }
                        
                        transaction.update(analyticsRef, {
                            numberOfAttempts: newNumberOfAttempts,
                            totalScore: newTotalScore,
                            totalTimeTaken: newTotalTimeTaken,
                            averageScore: newTotalScore / newNumberOfAttempts,
                            averageTimeTaken: newTotalTimeTaken / newNumberOfAttempts,
                            topperScore: newTopperScore,
                            topperStudentName: newTopperStudentName,
                            attemptHistory: [...(Array.isArray(oldAnalytics.attemptHistory) ? oldAnalytics.attemptHistory : []), attemptEntry],
                        });
                    }
                    
                    transaction.set(userResultRef, userResultData);
                });
                setUserAttemptCount((prev) => Math.max(prev, 1));
            } catch (error) {
                console.error("Test submission transaction failed: ", error);
            }
        } else if (user && firestore && testType === 'custom') {
            const answersToSave: Record<string, any> = {};
            answers.forEach((ans, qId) => { answersToSave[String(qId)] = ans.value; });

            try {
                const attemptRef = doc(collection(firestore, 'users', user.uid, 'custom_tests', testId, 'attempts'));
                const customTestRef = doc(firestore, 'users', user.uid, 'custom_tests', testId);
                await runTransaction(firestore, async (transaction) => {
                    const customTestSnap = await transaction.get(customTestRef);
                    const latestCustomTest = customTestSnap.exists() ? (customTestSnap.data() as CustomTestConfig) : null;
                    if ((latestCustomTest?.attemptPricing || latestCustomTest?.attemptState) && latestCustomTest) {
                        const consumeResult = consumePremiumCustomMockAttempt({
                            attemptPricing: latestCustomTest.attemptPricing || buildPremiumCustomMockAttemptRuleFromLegacyLimit(latestCustomTest.attemptLimit),
                            attemptState: latestCustomTest.attemptState,
                            purchasedAt: latestCustomTest.purchasedAt,
                        });
                        if (!consumeResult.ok) {
                            throw new Error('Premium custom mock attempts are exhausted.');
                        }
                        transaction.update(customTestRef, {
                            attemptState: consumeResult.nextState,
                            updatedAt: serverTimestamp(),
                        });
                    }
                    transaction.set(attemptRef, {
                        testId,
                        studentId: user.uid,
                        studentName: user.displayName || user.email || 'Student',
                        score: finalScore,
                        timeTaken: userTime,
                        attemptedQuestions: metrics.answeredCount,
                        correctQuestions: metrics.correctCount,
                        incorrectQuestions: metrics.wrongCount,
                        answers: answersToSave,
                        questionTimes: {},
                        submittedAt: serverTimestamp(),
                    });
                });
                setUserAttemptCount((prev) => prev + 1);
            } catch (error) {
                console.error('Custom test attempt save failed:', error);
            }
        }
    }, [answers, firestore, getElapsedAttemptMinutes, questions, testId, testType, user, testConfig, isCreatorAttempt]);


    useEffect(() => {
        let isActive = true;

        const loadTest = async () => {
            if (!firestore || !user) return;
            setIsLoading(true);
            setLoadError(null);
            setIsFinished(false);
            setScore(0);
            setAnswers(new Map());
            setCurrentQuestionIndex(0);
            setAnalytics(null);
            setUserAttemptCount(0);
            setWasAutoSubmitted(false);
            setAttemptLimitBlockedReason(null);
            setAccessWindowBlockedReason(null);
            setAttemptStartedAt(null);
            setFinalTimeTaken(null);
            setQuestions([]);
            setReviewScanOpen({});
            setReviewExplanationOpen({});
            setLiveSolutionOpen({});
            setLaunchPhase('config');
            setLaunchProgress(6);
            setLaunchDetail('Checking your test configuration...');
            setLaunchQuestionCount(0);
            setLaunchAssetCount(0);

            try {
                let testConfigSnap;
                let loadedTestConfig: CustomTestConfig | OfficialTestConfig;

            if (testType === 'custom') {
                const testConfigRef = doc(firestore, 'users', user.uid, 'custom_tests', testId);
                testConfigSnap = await readDocSnapshotResilient(testConfigRef, `custom test ${testId}`);
                loadedTestConfig = testConfigSnap.data() as CustomTestConfig;
            } else {
                const testConfigRef = doc(firestore, 'mock_tests', testId);
                testConfigSnap = await readDocSnapshotResilient(testConfigRef, `mock test ${testId}`);
                loadedTestConfig = testConfigSnap.data() as OfficialTestConfig;
            }
    
            if (testConfigSnap.exists() && loadedTestConfig?.config) {
                setTestConfig(loadedTestConfig);
                setTestTitle(loadedTestConfig.title);
                const normalizedDuration = normalizeTestDurationMinutes(loadedTestConfig.config.duration);
                setDuration(normalizedDuration);
                setTimeLeft(normalizedDuration !== null ? normalizedDuration * 60 : null);
                const configQuestionIds = normalizeQuestionIdList(loadedTestConfig.config.questionIds);
                const includedCustomQuestionIds = testType === 'custom'
                    ? normalizeQuestionIdList((loadedTestConfig as CustomTestConfig).includedQuestionIds)
                    : [];
                let finalQuestionIds = mergeQuestionIdLists(configQuestionIds, includedCustomQuestionIds);
                const isPremiumCustomTest =
                    testType === 'custom'
                    && (((loadedTestConfig as CustomTestConfig).questionAccessLevel || loadedTestConfig.accessLevel) === 'paid');
                const includedSubjectConfigs: TestSectionConfig[] = testType === 'custom'
                    ? (((loadedTestConfig as CustomTestConfig).includedSubjectConfigs || []) as TestSectionConfig[])
                    : [];
                const savedSubjectConfigs: TestSectionConfig[] = (loadedTestConfig.config.subjectConfigs || []) as TestSectionConfig[];
                const rawSectionConfigs: TestSectionConfig[] = savedSubjectConfigs.length > 0
                    ? savedSubjectConfigs
                    : includedSubjectConfigs;
                const sectionConfigs: TestSectionConfig[] = isPremiumCustomTest
                    ? rawSectionConfigs.map((section) => ({ ...section, randomizePerAttempt: false }))
                    : rawSectionConfigs;
                const hasRandomizedSections = sectionConfigs.some((section) => !!section.randomizePerAttempt);
                const attemptLimit = normalizeAttemptLimit(loadedTestConfig);
                const isOwnerAttempt = testType !== 'custom'
                    && !!user?.uid
                    && !!(loadedTestConfig as OfficialTestConfig | null)?.teacherId
                    && (loadedTestConfig as OfficialTestConfig | null)?.teacherId === user.uid;
                if (testType !== 'custom' && !isOwnerAttempt) {
                    const officialTest = loadedTestConfig as OfficialTestConfig;
                    const accessState = getLiveBatchTestAttemptState(officialTest);
                    const resolvedSchedule = resolveLiveBatchTestSchedule(officialTest);

                    if (accessState === 'before_test_start' && resolvedSchedule.testStartAt) {
                        setAccessWindowBlockedReason(
                            officialTest.availabilityMode === 'unlimited'
                                ? `This test will be available from ${resolvedSchedule.testStartAt.toLocaleDateString()}.`
                                : `This test will be available from ${resolvedSchedule.testStartAt.toLocaleString()}.`
                        );
                        setQuestions([]);
                        return;
                    }
                    if (accessState === 'before_access_start' && resolvedSchedule.accessStartAt) {
                        setAccessWindowBlockedReason(`This test will start accepting entries from ${resolvedSchedule.accessStartAt.toLocaleString()}.`);
                        setQuestions([]);
                        return;
                    }
                    if (accessState === 'after_test_end' && resolvedSchedule.testEndAt) {
                        setAccessWindowBlockedReason(`This test ended on ${resolvedSchedule.testEndAt.toLocaleString()}.`);
                        setQuestions([]);
                        return;
                    }
                    if (accessState === 'after_access_end' && resolvedSchedule.accessEndAt) {
                        setAccessWindowBlockedReason(`This test access window ended on ${resolvedSchedule.accessEndAt.toLocaleString()}.`);
                        setQuestions([]);
                        return;
                    }

                    let liveBatchContentUnlockLeadMinutes: number | undefined;

                    if (officialTest.isLiveBatchTest && officialTest.liveBatchId) {
                        const liveBatchSnap = await readDocSnapshotResilient(
                            doc(firestore, 'live_batches', officialTest.liveBatchId),
                            `live batch ${officialTest.liveBatchId}`
                        );
                        const liveBatch = liveBatchSnap.exists() ? (liveBatchSnap.data() as LiveBatchConfig) : null;
                        liveBatchContentUnlockLeadMinutes = liveBatch?.contentUnlockLeadMinutes;
                        const enrollmentSnap = await readDocSnapshotResilient(
                            doc(firestore, 'users', user.uid, 'enrolled_live_batches', officialTest.liveBatchId),
                            `live batch enrollment ${officialTest.liveBatchId}`
                        );
                        const enrollment = enrollmentSnap.exists() ? (enrollmentSnap.data() as LiveBatchEnrollmentLike) : null;

                        if (!enrollment) {
                            setAccessWindowBlockedReason('Join this live batch first to access its scheduled tests.');
                            setQuestions([]);
                            return;
                        }

                        const hasStarted =
                            !!resolvedSchedule.testStartAt
                            && new Date().getTime() >= resolvedSchedule.testStartAt.getTime();
                        const isPaidLiveBatch = (liveBatch?.accessLevel || 'free') === 'paid';

                        if (isPaidLiveBatch && hasStarted) {
                            const sessionsSnap = await readQuerySnapshotResilient(
                                query(collection(firestore, 'live_batch_sessions'), where('batchId', '==', officialTest.liveBatchId)),
                                `live batch sessions ${officialTest.liveBatchId}`
                            );
                            const batchSessions = sessionsSnap.docs.map((sessionDoc) => ({ id: sessionDoc.id, ...(sessionDoc.data() as LiveBatchSessionLike) }));
                            const hasTokenAccess = hasPaidLiveBatchTestTokenAccessAtStart({
                                test: officialTest,
                                enrollment,
                                sessions: batchSessions,
                            });
                            if (!hasTokenAccess) {
                                setAccessWindowBlockedReason('This test stayed available only for students who still had live-session credit when it opened.');
                                setQuestions([]);
                                return;
                            }
                        }
                    }

                    const teacherPremiumQuestionAccessMap = await resolveTeacherPremiumQuestionAccessMap(
                        firestore,
                        [{ ...officialTest, id: testId }],
                        { [testId]: 1 },
                        {
                            [testId]: getLiveBatchTestTeacherQuestionAccessCheckAt({
                                test: officialTest,
                                contentUnlockLeadMinutes: liveBatchContentUnlockLeadMinutes,
                                now: new Date(),
                            }),
                        }
                    );
                    const teacherPremiumQuestionAccessState = teacherPremiumQuestionAccessMap[testId];
                    if (teacherPremiumQuestionAccessState?.isProtected && !teacherPremiumQuestionAccessState.isAccessible) {
                        setAccessWindowBlockedReason(buildTeacherPremiumQuestionTestBlockedReason(teacherPremiumQuestionAccessState));
                        setQuestions([]);
                        return;
                    }
                }
                if (testType === 'custom') {
                    const loadedCustomTestConfig = loadedTestConfig as CustomTestConfig;
                    const customAttemptsQuery = query(collection(firestore, 'users', user.uid, 'custom_tests', testId, 'attempts'));
                    const customAttemptsSnap = await readQuerySnapshotResilient(customAttemptsQuery, `custom test attempts ${testId}`);
                    const attemptHistory: AttemptHistoryEntry[] = customAttemptsSnap.docs.map((attemptDoc) => {
                        const data = attemptDoc.data() as Record<string, unknown>;
                        return {
                            studentId: typeof data.studentId === 'string' ? data.studentId : user.uid,
                            submittedAt: data.submittedAt,
                        };
                    });
                    setUserAttemptCount(attemptHistory.length);
                    const customAttemptUsage =
                        !!loadedCustomTestConfig.attemptPricing || !!loadedCustomTestConfig.attemptState
                            ? resolvePremiumCustomMockAttemptUsage({
                                attemptPricing: loadedCustomTestConfig.attemptPricing || buildPremiumCustomMockAttemptRuleFromLegacyLimit(loadedCustomTestConfig.attemptLimit),
                                attemptState: loadedCustomTestConfig.attemptState,
                                purchasedAt: loadedCustomTestConfig.purchasedAt,
                            })
                            : null;
                    if (customAttemptUsage?.isExhausted) {
                        setAttemptLimitBlockedReason(
                            customAttemptUsage.actionKind === 'total_recharge'
                                ? 'All included attempts are used. Recharge this premium custom mock from My Practice or the edit screen to continue.'
                                : customAttemptUsage.actionKind === 'interval_attempt'
                                    ? 'Current interval attempts are used. Buy 1 instant attempt from My Practice or the edit screen, or wait for the next interval reset.'
                                : 'Attempts are exhausted for this premium custom mock.'
                        );
                        setQuestions([]);
                        return;
                    }
                    if (!customAttemptUsage && attemptLimit.mode !== 'unlimited') {
                        const limitResult = evaluateAttemptLimit(attemptLimit, attemptHistory, user.uid);
                        if (limitResult.blocked) {
                            setAttemptLimitBlockedReason(limitResult.message);
                            setQuestions([]);
                            return;
                        }
                    }
                } else if (!isOwnerAttempt && attemptLimit.mode !== 'unlimited') {
                    const analyticsRef = doc(firestore, 'test_analytics', testId);
                    const analyticsSnap = await readDocSnapshotResilient(analyticsRef, `test analytics ${testId}`);
                    const attemptHistory = analyticsSnap.exists() && Array.isArray((analyticsSnap.data() as any)?.attemptHistory)
                        ? ((analyticsSnap.data() as any).attemptHistory as AttemptHistoryEntry[])
                        : [];
                    const limitResult = evaluateAttemptLimit(attemptLimit, attemptHistory, user.uid);
                    if (limitResult.blocked) {
                        setAttemptLimitBlockedReason(limitResult.message);
                        setQuestions([]);
                        return;
                    }
                }
                const questionAccessLevel = (loadedTestConfig as any).questionAccessLevel || loadedTestConfig.accessLevel;
                const questionSource =
                    ((loadedTestConfig as any).questionSource as ('student_plus_official' | 'teacher_official' | undefined))
                    || (testType === 'custom' ? 'student_plus_official' : undefined);
                const questionTeacherId = (loadedTestConfig as any).teacherId || (loadedTestConfig as any).createdFromTeacherId;
                setLaunchPhase('questions');
                setLaunchProgress(42);
                setLaunchDetail(
                    hasRandomizedSections
                        ? 'Assembling your question paper and preparing randomized sections...'
                        : 'Loading your question paper...'
                );
                let finalQuestions: MockQuestion[] | null = null;

                if (hasRandomizedSections || (finalQuestionIds.length === 0 && sectionConfigs.length > 0)) {
                    const staticQuestions = await fetchQuestionsByIds(firestore, finalQuestionIds);
                    const selectedIds: string[] = [];
                    const usedIds = new Set<string>();
                    const questionById = new Map(staticQuestions.map((question) => [question.id, question] as const));

                    for (const section of sectionConfigs) {
                        const requestedCount = getSectionRequestedQuestionCount(section);
                        if (!section.subjectId || requestedCount <= 0) continue;

                        if (section.randomizePerAttempt) {
                            const dynamicPool = await fetchSectionCandidateQuestions(firestore, section, {
                                accessLevel: questionAccessLevel,
                                questionSource,
                                teacherId: questionTeacherId,
                                examTypeId: (loadedTestConfig as any).examTypeId,
                                classId: (loadedTestConfig as any).classId,
                            });
                            dynamicPool.forEach((question) => {
                                questionById.set(question.id, question);
                            });
                            const pool = dynamicPool.filter((question) => !usedIds.has(question.id));
                            if (pool.length < requestedCount) {
                                toast({
                                    variant: 'destructive',
                                    title: 'Insufficient random pool',
                                    description: `Section for subject could not provide ${requestedCount} unique questions.`,
                                });
                                throw new Error('Insufficient random pool for section');
                            }
                            const picked = shuffleArray(pool).slice(0, requestedCount).map((question) => question.id);
                            picked.forEach((id) => usedIds.add(id));
                            selectedIds.push(...picked);
                        } else {
                            const staticPool = staticQuestions.filter((question) =>
                                sectionMatchesQuestion(question, section, {
                                    examTypeId: (loadedTestConfig as any).examTypeId,
                                    classId: (loadedTestConfig as any).classId,
                                    accessLevel: questionAccessLevel,
                                    questionSource,
                                })
                            ).filter((question) => !usedIds.has(question.id));

                            let chosen = staticPool.slice(0, requestedCount).map((question) => question.id);
                            if (chosen.length < requestedCount) {
                                const fallbackPool = await fetchSectionCandidateQuestions(firestore, section, {
                                    accessLevel: questionAccessLevel,
                                    questionSource,
                                    teacherId: questionTeacherId,
                                    examTypeId: (loadedTestConfig as any).examTypeId,
                                    classId: (loadedTestConfig as any).classId,
                                });
                                fallbackPool.forEach((question) => {
                                    questionById.set(question.id, question);
                                });
                                const needed = requestedCount - chosen.length;
                                const extra = fallbackPool
                                    .filter((question) => !usedIds.has(question.id) && !chosen.includes(question.id))
                                    .slice(0, needed)
                                    .map((question) => question.id);
                                chosen = [...chosen, ...extra];
                            }
                            if (chosen.length < requestedCount) {
                                toast({
                                    variant: 'destructive',
                                    title: 'Insufficient fixed section questions',
                                    description: `Section for subject could not provide ${requestedCount} questions.`,
                                });
                                throw new Error('Insufficient fixed section questions');
                            }
                            chosen.forEach((id) => usedIds.add(id));
                            selectedIds.push(...chosen);
                        }
                    }

                    if (selectedIds.length > 0) {
                        finalQuestionIds = hasRandomizedSections ? shuffleArray(selectedIds) : selectedIds;
                        const missingSelectedIds = finalQuestionIds.filter((questionId) => !questionById.has(questionId));
                        if (missingSelectedIds.length > 0) {
                            const missingQuestions = await fetchQuestionsByIds(firestore, missingSelectedIds);
                            missingQuestions.forEach((question) => {
                                questionById.set(question.id, question);
                            });
                        }
                        finalQuestions = finalQuestionIds
                            .map((questionId) => questionById.get(questionId))
                            .filter((question): question is MockQuestion => Boolean(question));
                    }
                }

                const fetchedQuestions = finalQuestions ?? await fetchQuestionsByIds(firestore, finalQuestionIds);
                if (fetchedQuestions.length === 0) {
                    throw new Error('No questions could be loaded for this test. Please retry.');
                }
                if (!isActive) return;

                const assetUrls = Array.from(new Set(
                    fetchedQuestions.flatMap((question) => getExamQuestionAssetUrls(question as unknown as Record<string, unknown>))
                ));
                setLaunchQuestionCount(fetchedQuestions.length);
                setLaunchAssetCount(assetUrls.length);

                if (assetUrls.length > 0) {
                    setLaunchProgress(50);
                    setLaunchDetail(`Preloading ${assetUrls.length} question and solution image${assetUrls.length === 1 ? '' : 's'}...`);
                    const preloadResult = await preloadExamImageUrls(assetUrls, ({ completed, total, failed }) => {
                        if (!isActive) return;
                        const ratio = total === 0 ? 1 : completed / total;
                        setLaunchProgress(Math.max(50, Math.min(92, Math.round(50 + (ratio * 42)))));
                        setLaunchDetail(
                            failed > 0
                                ? `Loading exam media ${completed}/${total} (${failed} delayed)`
                                : `Loading exam media ${completed}/${total}`
                        );
                    });
                    if (!isActive) return;
                    if (preloadResult.failed > 0) {
                        console.warn(`Exam media preload had ${preloadResult.failed} delayed asset(s).`);
                    }
                } else {
                    setLaunchProgress(92);
                    setLaunchDetail('Question paper is ready. Starting your exam environment...');
                }

                setLaunchPhase('environment');
                setLaunchProgress(98);
                setLaunchDetail('Launching your exam environment...');
                await new Promise((resolve) => setTimeout(resolve, 180));
                if (!isActive) return;
                setQuestions(fetchedQuestions);
                setAttemptStartedAt(Date.now());
                } else {
                    setTestTitle("Test Not Found or Misconfigured");
                    setQuestions([]);
                    setLoadError('This test configuration is missing or does not contain any questions.');
                }
            } catch (error) {
                console.error('Failed to load test questions:', error);
                if (!isActive) return;
                setQuestions([]);
                setLoadError(error instanceof Error && error.message ? error.message : 'Could not load test questions. Please retry.');
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        };
        void loadTest();
        return () => {
            isActive = false;
        };
    }, [testId, testType, retryToken, user, firestore]);
    
    useEffect(() => {
        const fetchAnalytics = async () => {
            if (isFinished && firestore && testId && testType !== 'custom') {
                setIsAnalyticsLoading(true);
                try {
                    const analyticsRef = doc(firestore, 'test_analytics', testId);
                    const docSnap = await readDocSnapshotResilient(analyticsRef, `test analytics summary ${testId}`);
                    if (docSnap.exists()) {
                        setAnalytics(docSnap.data() as TestAnalytics);
                    }
                    if (isCreatorAttempt) {
                      setUserAttemptCount(0);
                    } else if (user?.uid) {
                      const resultsQuery = query(
                        collection(firestore, 'users', user.uid, 'test_results'),
                        where('testId', '==', testId)
                      );
                      const resultSnap = await readQuerySnapshotResilient(resultsQuery, `test results ${testId}`);
                      setUserAttemptCount(resultSnap.size);
                    }
                } catch (error) {
                    console.error("Error fetching analytics:", error);
                } finally {
                    setIsAnalyticsLoading(false);
                }
            }
        };
        fetchAnalytics();
    }, [isFinished, firestore, testId, testType, user, isCreatorAttempt]);

    // Timer effect
    useEffect(() => {
        if (isLoading || isFinished || timeLeft === null || timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev === null) return prev;
                if (prev <= 1) {
                    handleSubmitTest({ autoSubmitted: true });
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft, isLoading, isFinished, handleSubmitTest]);

    const sections = useMemo(() => {
        if (!questions.length) return [];
        const sectionMap: Record<string, MockQuestion[]> = {};
        questions.forEach(q => {
            if (!sectionMap[q.subject]) {
                sectionMap[q.subject] = [];
            }
            sectionMap[q.subject].push(q);
        });
        return Object.entries(sectionMap).map(([name, questions]) => ({ name, questions }));
    }, [questions]);

    const getQuestionStatus = useCallback((questionId: string | number) => {
        const answer = answers.get(questionId);
        if (!answer) return QuestionStatus.NotVisited;
        return answer.status;
    }, [answers]);

    const reviewQuestionAssets = useMemo(() => {
        return questions.map((question) => {
            const questionImages = getQuestionImageUrls(question);
            const { explanationImages, explanationText } = getExplanationAssets(question);
            const hasExplanation = Boolean((explanationText && explanationText.trim()) || explanationImages.length > 0);

            return {
                questionId: question.id,
                questionImages,
                explanationImages,
                explanationText,
                hasExplanation,
            };
        });
    }, [questions]);

    const reviewAssetsByQuestionId = useMemo(
        () => Object.fromEntries(reviewQuestionAssets.map((entry) => [entry.questionId, entry])),
        [reviewQuestionAssets]
    );

    const reportAssetUrls = useMemo(
        () => Array.from(new Set(reviewQuestionAssets.flatMap((entry) => [...entry.questionImages, ...entry.explanationImages]))),
        [reviewQuestionAssets]
    );

	    const currentQuestion = questions[currentQuestionIndex];
	    const alwaysShowAttachedScan = testType === 'custom';
	    const questionImages = useMemo(() => {
	        if (!currentQuestion) return [];
	        return getQuestionImageUrls(currentQuestion);
	    }, [currentQuestion]);
    const shouldShowQuestionText = !isImageOnlyQuestionPlaceholder(currentQuestion?.questionText) || questionImages.length === 0;
    const currentSolutionAssets = useMemo(
        () => (currentQuestion ? getExplanationAssets(currentQuestion) : { explanationImages: [] as string[], explanationText: '' }),
        [currentQuestion]
    );

    const handleSelectQuestion = (index: number) => {
        const cq = questions[currentQuestionIndex];
        const currentStatus = getQuestionStatus(cq.id);
        if (currentStatus === QuestionStatus.NotVisited) {
            setAnswers(prev => new Map(prev).set(cq.id, { value: '', status: QuestionStatus.NotAnswered }));
        }
        setCurrentQuestionIndex(index);
    };
    
    const handleSaveAndNext = () => {
        const currentAnswer = answers.get(currentQuestion.id);
        const hasAnswer =
            currentAnswer !== undefined &&
            currentAnswer.value !== '' &&
            currentAnswer.value !== undefined;
        // Save should finalize this question as normal answered/not-answered (not review state).
        setAnswers((prev) =>
            new Map(prev).set(currentQuestion.id, {
                value: hasAnswer ? currentAnswer!.value : '',
                status: hasAnswer ? QuestionStatus.Answered : QuestionStatus.NotAnswered,
            })
        );
        if (currentQuestionIndex < questions.length - 1) {
            handleSelectQuestion(currentQuestionIndex + 1);
        }
    };

    const handleSkipQuestion = () => {
        setLiveSolutionOpen((prev) => ({ ...prev, [currentQuestion.id]: false }));
        setAnswers(prev => new Map(prev).set(currentQuestion.id, { value: '', status: QuestionStatus.NotAnswered }));
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex((prev) => prev + 1);
        }
    };
    
    const handleMarkForReview = () => {
        const currentAnswer = answers.get(currentQuestion.id);
        const newStatus = currentAnswer?.value ? QuestionStatus.AnsweredAndMarkedForReview : QuestionStatus.MarkedForReview;
        setAnswers(prev => new Map(prev).set(currentQuestion.id, { value: currentAnswer?.value || '', status: newStatus }));
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex((prev) => prev + 1);
        }
    };
    
    const handleClearResponse = () => {
        setLiveSolutionOpen((prev) => ({ ...prev, [currentQuestion.id]: false }));
        setAnswers(prev => new Map(prev).set(currentQuestion.id, { value: '', status: QuestionStatus.NotAnswered }));
    };

    const handleAnswerChange = (value: string | number) => {
        const currentStatus = getQuestionStatus(currentQuestion.id);
        const newStatus = currentStatus === QuestionStatus.MarkedForReview || currentStatus === QuestionStatus.AnsweredAndMarkedForReview
            ? QuestionStatus.AnsweredAndMarkedForReview
            : QuestionStatus.Answered;
        setAnswers(prev => new Map(prev).set(currentQuestion.id, { value, status: newStatus }));
    };

    const getStatusClasses = (status: QuestionStatus) => {
        switch (status) {
            case QuestionStatus.Answered:
                return 'bg-emerald-500 text-white border-emerald-400';
            case QuestionStatus.NotAnswered:
                return 'bg-rose-500 text-white border-rose-400';
            case QuestionStatus.MarkedForReview:
                return 'bg-violet-500 text-white border-violet-400';
            case QuestionStatus.AnsweredAndMarkedForReview:
                return 'bg-violet-500 text-white border-violet-400 relative after:content-[\'✔\'] after:absolute after:bottom-0 after:right-0 after:text-[10px] after:text-emerald-200';
            case QuestionStatus.NotVisited:
                return 'bg-slate-300 text-slate-900 border-slate-400';
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };
    
    const summary = useMemo(() => {
        const summaryData = { answered: 0, notAnswered: 0, notVisited: questions.length, markedForReview: 0, answeredAndMarked: 0 };
        answers.forEach(answer => {
            switch (answer.status) {
                case QuestionStatus.Answered: summaryData.answered++; break;
                case QuestionStatus.NotAnswered: summaryData.notAnswered++; break;
                case QuestionStatus.MarkedForReview: summaryData.markedForReview++; break;
                case QuestionStatus.AnsweredAndMarkedForReview: summaryData.answeredAndMarked++; break;
            }
        });
        summaryData.notVisited = questions.length - (summaryData.answered + summaryData.notAnswered + summaryData.markedForReview + summaryData.answeredAndMarked);
        return summaryData;
    }, [answers, questions]);

    const answeredTotal = summary.answered + summary.answeredAndMarked;
    const reviewTotal = summary.markedForReview + summary.answeredAndMarked;
    const completedPercent = questions.length > 0 ? Math.round((answeredTotal / questions.length) * 100) : 0;
    const scoringSettings = useMemo(() => resolveScoringSettings(testType, testConfig), [testConfig, testType]);
    const displayMarksPerQuestion = scoringSettings.marksPerQuestion;
    const displayNegativeMarks = scoringSettings.negativeMarksPerQuestion;
    const hasTimeLimit = timeLeft !== null;
    const durationLabel = formatTestDurationLabel(duration);
    const currentAnswer = currentQuestion ? answers.get(currentQuestion.id) : undefined;
    const currentQuestionAttempted = Boolean(
      currentAnswer &&
      currentAnswer.value !== '' &&
      currentAnswer.value !== undefined
    );
    const currentCorrectAnswer = currentQuestion ? getCorrectAnswer(currentQuestion) : '-';
    const currentSolutionOpen = currentQuestion ? !!liveSolutionOpen[currentQuestion.id] : false;
    const currentHasExplanation = Boolean(
      (currentSolutionAssets.explanationText && currentSolutionAssets.explanationText.trim()) ||
      currentSolutionAssets.explanationImages.length > 0
    );
    const canRevealCurrentSolution = Boolean(
      currentQuestion &&
      currentQuestionAttempted &&
      (currentCorrectAnswer !== '-' || currentHasExplanation)
    );
    const isCourseOnlyTest = Boolean(
      testType !== 'custom' &&
      (testConfig as OfficialTestConfig | null)?.isCourseOnly
    );
    const isUntimedLiveBatchTest = Boolean(
      testType !== 'custom' &&
      (testConfig as OfficialTestConfig | null)?.isLiveBatchTest &&
      !isCourseOnlyTest &&
      !hasTimeLimit
    );

    if (isLoading) {
        return (
            <ExamSessionLoader
              modeLabel={testType === 'custom' ? 'Custom Mock Test' : 'Mock Test'}
              title={testTitle === 'Loading Test...' ? (testType === 'custom' ? 'Preparing Custom Mock Test' : 'Preparing Mock Test') : `Preparing ${testTitle}`}
              subtitle="We are loading all questions, scans, and solution media before opening the exam so students enter a fully prepared paper."
              detail={launchDetail}
              phase={launchPhase}
              progress={launchProgress}
              questionCount={launchQuestionCount}
              assetCount={launchAssetCount}
            />
        );
    }

    if (accessWindowBlockedReason) {
        return (
            <div className="flex h-screen w-screen items-center justify-center">
              <div className="text-center max-w-xl px-4">
                <h1 className="text-2xl font-bold mb-3">Test Not Available</h1>
                <p className="text-muted-foreground">{accessWindowBlockedReason}</p>
                <div className="flex items-center justify-center gap-3 mt-5">
                  <Button onClick={handleBackToSource}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
                </div>
              </div>
            </div>
        );
    }

    if (attemptLimitBlockedReason) {
        return (
            <div className="flex h-screen w-screen items-center justify-center">
              <div className="text-center max-w-xl px-4">
                <h1 className="text-2xl font-bold mb-3">Attempt Limit Reached</h1>
                <p className="text-muted-foreground">{attemptLimitBlockedReason}</p>
                <div className="flex items-center justify-center gap-3 mt-5">
                  <Button onClick={handleBackToSource}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
                </div>
              </div>
            </div>
        );
    }
    
    if (!currentQuestion) {
        return (
            <div className="flex h-screen w-screen items-center justify-center">
              <div className="text-center max-w-xl px-4">
                <h1 className="text-2xl font-bold mb-4">{testTitle}</h1>
                <p className="text-lg text-destructive">{loadError || 'Could not load test questions.'}</p>
                <p className="text-muted-foreground mt-2">
                  {loadError
                    ? 'A temporary read failure or missing question document blocked this attempt. Retry loading and the page will request the test again.'
                    : 'There may be no questions available for this test configuration.'}
                </p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <Button onClick={handleRetryLoad}>Retry Loading</Button>
                  <Button variant="outline" onClick={handleBackToSource}><ArrowLeft className='mr-2'/>Go Back</Button>
                </div>
              </div>
            </div>
        );
    }

    if(isFinished) {
        const timeTaken = finalTimeTaken ?? 0;
        const resultMetrics = calculateAttemptMetrics(questions, answers, scoringSettings);
        const answeredCount = resultMetrics.answeredCount;
        const correctCount = resultMetrics.correctCount;
        const wrongCount = resultMetrics.wrongCount;
        const unansweredCount = resultMetrics.unansweredCount;
        const accuracyPercent = resultMetrics.accuracyPercent;
        const correctWrongRatio = `${correctCount}:${wrongCount}`;
        const currentAttemptNo = Math.max(1, userAttemptCount);
        const isCourseOnly = isCourseOnlyTest;
        const courseId = (testConfig as OfficialTestConfig | null)?.courseId;
        const hasScoring = scoringSettings.hasScoring;
        const marksPerQuestion = scoringSettings.marksPerQuestion ?? 0;
        const negativeMarksPerQuestion = scoringSettings.negativeMarksPerQuestion ?? 0;
        const resultBackHref = isLiveBatchTest && liveBatchId
          ? `/live-batches/${liveBatchId}/classroom`
          : isCourseOnly && courseId
            ? `/courses/${courseId}`
            : '/mock-tests';
        const resultBackLabel = isLiveBatchTest
          ? 'Back to Classroom'
          : isCourseOnly
            ? 'Back to Course'
            : 'Back to Mock Tests';
        const showReattemptButton = !(isLiveBatchTest && wasAutoSubmitted);

        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 py-8 px-4">
                <Card ref={pdfResultsRef} className="w-full max-w-4xl text-center shadow-2xl p-6 bg-card">
                    <CardHeader>
                        <CardTitle className="font-headline text-3xl">Test Finished: {testTitle}</CardTitle>
                        <CardDescription>
                            {hasScoring
                              ? `Total Marks: ${questions.length * marksPerQuestion} (Scoring: +${marksPerQuestion} correct, -${negativeMarksPerQuestion} incorrect)`
                              : 'Scoring is turned off for this test. Results are shown using correct, incorrect, and accuracy only.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        
                        {testType !== 'custom' && hasScoring && (
                            <AnalyticsDashboard 
                                userScore={score} 
                                userTime={timeTaken > 0 ? timeTaken : 0} 
                                analytics={analytics}
                                isLoading={isAnalyticsLoading}
                            />
                        )}

                        {testType === 'custom' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-md mx-auto pt-6">
                                <Card className="text-center">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg font-medium">Your Score</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-5xl font-bold text-primary">{score}</p>
                                    </CardContent>
                                </Card>
                                <Card className="text-center">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg font-medium">Time Taken</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-5xl font-bold">{timeTaken > 0 ? timeTaken : 0} <span className="text-2xl font-medium text-muted-foreground">mins</span></p>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                        {!hasScoring && (
                            <div className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
                                <Card className="text-center">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg font-medium">Correct</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-5xl font-bold text-emerald-500">{correctCount}</p>
                                    </CardContent>
                                </Card>
                                <Card className="text-center">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg font-medium">Incorrect</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-5xl font-bold text-rose-500">{wrongCount}</p>
                                    </CardContent>
                                </Card>
                                <Card className="text-center">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg font-medium">Accuracy</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-5xl font-bold text-cyan-500">{accuracyPercent}<span className="text-2xl font-medium text-muted-foreground">%</span></p>
                                    </CardContent>
                                </Card>
                                <Card className="text-center">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg font-medium">Time Taken</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-5xl font-bold">{timeTaken > 0 ? timeTaken : 0} <span className="text-2xl font-medium text-muted-foreground">mins</span></p>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                        <Card className="mt-6">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">Attempt Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-left">
                                    {hasScoring ? <p><span className="font-semibold">Marks Scored:</span> {score}</p> : null}
                                    <p><span className="font-semibold">Time Taken:</span> {timeTaken > 0 ? timeTaken : 0} mins</p>
                                    <p><span className="font-semibold">Attempt No.:</span> {currentAttemptNo}</p>
                                    <p><span className="font-semibold">Total Questions:</span> {questions.length}</p>
                                    <p><span className="font-semibold">Attempted:</span> {answeredCount}</p>
                                    <p><span className="font-semibold">Correct Answers:</span> {correctCount}</p>
                                    <p><span className="font-semibold">Wrong Answers:</span> {wrongCount}</p>
                                    <p><span className="font-semibold">Unanswered:</span> {unansweredCount}</p>
                                    {!hasScoring ? <p><span className="font-semibold">Correct : Wrong Ratio:</span> {correctWrongRatio}</p> : null}
                                    {!hasScoring ? <p><span className="font-semibold">Accuracy:</span> {accuracyPercent}%</p> : null}
                                    <p><span className="font-semibold">Re-attempts:</span> {Math.max(0, currentAttemptNo - 1)}</p>
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card className="mt-6 text-left">
                            <CardHeader>
                                <CardTitle>Review Your Answers</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {questions.map((q, i) => {
                                    const ans = answers.get(q.id);
                                    let isCorrect = false;
                                    if(ans && (ans.value !== '' && ans.value !== undefined)) {
                                        isCorrect = isAnswerCorrect(q, ans.value);
                                    }
                                    const attempted = ans && (ans.value !== '' && ans.value !== undefined);

	                                    const reviewAssets = reviewAssetsByQuestionId[q.id];
                                    const qImages = reviewAssets?.questionImages || [];
                                    const explanationImages = reviewAssets?.explanationImages || [];
                                    const explanationText = reviewAssets?.explanationText || '';
                                    const hasExplanation = reviewAssets?.hasExplanation || false;
                                    const showScan = alwaysShowAttachedScan || isGeneratingPdf || !!reviewScanOpen[q.id];
                                    const showExplanation = isGeneratingPdf ? hasExplanation : !!reviewExplanationOpen[q.id];

                                    return (
                                        <div key={q.id} className="flex items-start gap-3 p-3 border-b last:border-b-0">
                                            {attempted ? (isCorrect ? <Check className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" /> : <XIcon className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />) : <div className="w-5 h-5 mt-1 flex-shrink-0" />}
                                            <div className="flex-1">
                                                <p className="font-medium">
                                                    Q{i+1}: <MathText text={q.questionText} className="font-medium" />
                                                </p>
                                                {qImages.length > 0 ? (
                                                  <div className="my-2">
                                                    {!alwaysShowAttachedScan && !isGeneratingPdf ? (
	                                                    <Button
	                                                      type="button"
	                                                      size="sm"
	                                                      variant="outline"
	                                                      onClick={() => setReviewScanOpen((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
	                                                    >
	                                                      {showScan ? 'Hide Question' : 'View Question'}
	                                                    </Button>
                                                    ) : null}
                                                    {showScan ? (
                                                      <ExamImageGallery
                                                        sources={qImages}
                                                        altPrefix={`Question ${i + 1} image`}
                                                        listClassName={alwaysShowAttachedScan ? undefined : "mt-2"}
                                                        imageLoading={isGeneratingPdf ? 'eager' : 'lazy'}
                                                      />
                                                    ) : null}
                                                  </div>
                                                ) : null}
                                                <p className="text-sm">
                                                    Your answer:{' '}
                                                    <span className="font-semibold">
                                                        <MathText text={attempted ? ans.value : 'Not Answered'} />
                                                    </span>
                                                </p>
                                                {!isCorrect && attempted && (
                                                    <p className="text-sm">
                                                        Correct answer:{' '}
                                                        <span className="font-semibold text-green-600">
                                                            <MathText text={getCorrectAnswer(q)} />
                                                        </span>
                                                    </p>
                                                )}
                                                <div className="my-2">
                                                  {!isGeneratingPdf ? (
                                                    <Button
                                                      type="button"
                                                      size="sm"
                                                      variant="outline"
                                                      onClick={() => setReviewExplanationOpen((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                                                    >
                                                      {showExplanation ? 'Hide Explanation' : 'View Explanation'}
                                                    </Button>
                                                  ) : null}
                                                  {showExplanation ? (
                                                    <div className="mt-2 space-y-2">
                                                      {hasExplanation ? (
                                                        <>
                                                          {explanationText ? (
                                                            <p className="text-sm whitespace-pre-wrap">
                                                              <span className="font-semibold">Solution:</span>{' '}
                                                              <MathText text={explanationText} className="text-sm" />
                                                            </p>
                                                          ) : null}
                                                          {explanationImages.length > 0 ? (
                                                            <ExamImageGallery
                                                              sources={explanationImages}
                                                              altPrefix={`Explanation for question ${i + 1} image`}
                                                              imageClassName="max-h-[560px]"
                                                              imageLoading={isGeneratingPdf ? 'eager' : 'lazy'}
                                                            />
                                                          ) : null}
                                                        </>
                                                      ) : (
                                                        <p className="text-sm text-muted-foreground">No explanation available.</p>
                                                      )}
                                                    </div>
                                                  ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </CardContent>
                        </Card>
                    </CardContent>
                </Card>
                <div className="flex gap-4 mt-8">
                    <Button onClick={() => router.push(resultBackHref)}>
                      {resultBackLabel}
                    </Button>
                    {showReattemptButton ? (
                      <Button variant="secondary" onClick={() => {
                        const params = new URLSearchParams();
                        if (testType === 'custom') params.set('type', 'custom');
                        params.set('retry', String(Date.now()));
                        const query = params.toString();
                        // Force a fresh mount for the same test route.
                        window.location.assign(`/test/${testId}${query ? `?${query}` : ''}`);
                      }}>Re-attempt Test</Button>
                    ) : null}
                    <Button variant="outline" onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
                      {isGeneratingPdf ? 'Preparing PDF...' : 'Download Analysis PDF'}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <>
            <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-slate-800/70 bg-slate-950/90 px-4 backdrop-blur md:px-6">
                <div className="flex items-center gap-2"><Logo className="w-8 h-8 text-primary" /><span className="font-headline text-xl font-semibold text-primary">DCAM Classes</span></div>
                <div className="hidden md:flex items-center gap-3">
                    <Badge variant="secondary" className="border border-slate-700 bg-slate-900 text-slate-200">Question {currentQuestionIndex + 1}/{questions.length}</Badge>
                    <Badge variant="secondary" className="border border-slate-700 bg-slate-900 text-slate-200">Completed {completedPercent}%</Badge>
                </div>
                <div><h1 className="font-headline text-xl font-semibold text-center">{testTitle}</h1></div>
            </header>
            <div className="bg-[radial-gradient(circle_at_10%_20%,rgba(59,130,246,0.12),transparent_40%),radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.10),transparent_35%)] min-h-[calc(100vh-4rem)]">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 p-4 md:p-6">
                {/* Left Panel: Question Area */}
                <div className="flex flex-col gap-4">
                    <Card className="border-slate-800/80 bg-slate-900/80 shadow-xl backdrop-blur">
                        <CardHeader className="space-y-4">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all" style={{ width: `${completedPercent}%` }} />
                            </div>
                            <div className="flex flex-wrap justify-between items-center gap-3">
                                <CardTitle className="text-2xl font-bold tracking-tight">Question No. {currentQuestionIndex + 1}</CardTitle>
                                <div className='flex gap-2 text-sm'>
                                    {scoringSettings.hasScoring ? (
                                      <>
                                        <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-100 border border-emerald-400/40">Marks: +{displayMarksPerQuestion}</Badge>
                                        <Badge variant="secondary" className="bg-rose-500/20 text-rose-100 border border-rose-400/40">Negative Marks: -{displayNegativeMarks}</Badge>
                                      </>
                                    ) : (
                                      <Badge variant="secondary" className="border border-cyan-300/35 bg-cyan-500/15 text-cyan-100">
                                        Result: Correct / Incorrect only
                                      </Badge>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {shouldShowQuestionText ? (
                                <p className="text-xl leading-relaxed text-slate-50">
                                    <MathText text={currentQuestion.questionText} className="text-xl leading-relaxed text-slate-50" />
                                </p>
                            ) : null}
                            {questionImages.length > 0 ? (
                                <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                                    <ExamImageGallery
                                        sources={questionImages}
                                        altPrefix="Question image"
                                        frameClassName="border-slate-700 bg-slate-950"
                                    />
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                    <Card className="flex-grow border-slate-800/80 bg-slate-900/80 shadow-xl backdrop-blur">
                        <CardContent className="p-6">
                            {currentQuestion.questionType === 'MCQ' ? (
                                <RadioGroup value={answers.get(currentQuestion.id)?.value as string || ''} onValueChange={handleAnswerChange}>
                                    {currentQuestion.options?.map((option, index) => (
                                        <div
                                          key={index}
                                          className={cn(
                                            'flex items-center space-x-3 p-4 rounded-lg border transition-all',
                                            answers.get(currentQuestion.id)?.value === option
                                              ? 'border-primary bg-primary/15 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]'
                                              : 'border-slate-700 bg-slate-950/60 hover:border-slate-500 hover:bg-slate-900'
                                          )}
                                        >
                                          <RadioGroupItem value={option} id={`option-${index}`} />
                                          <Label htmlFor={`option-${index}`} className="flex-1 text-base leading-relaxed text-slate-100">
                                              <MathText text={option} className="text-base leading-relaxed text-slate-100" />
                                          </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            ) : currentQuestion.questionType === 'Numerical' ? (
                                <><Label htmlFor="numerical-answer" className="text-lg text-slate-100">Your Answer</Label><Input id="numerical-answer" type="number" className="mt-2 h-12 text-lg border-slate-700 bg-slate-950/70" placeholder="Enter your numerical answer" value={answers.get(currentQuestion.id)?.value || ''} onChange={(e) => handleAnswerChange(e.target.value)} /></>
                            ) : (
                                <><Label htmlFor="text-answer" className="text-lg text-slate-100">Your Answer</Label><Input id="text-answer" type="text" className="mt-2 h-12 text-lg border-slate-700 bg-slate-950/70" placeholder="Enter your text answer" value={answers.get(currentQuestion.id)?.value || ''} onChange={(e) => handleAnswerChange(e.target.value)} /></>
                            )}
                            {isUntimedLiveBatchTest && canRevealCurrentSolution ? (
                                <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-cyan-100">Solution unlocked for this question</p>
                                            <p className="text-xs text-cyan-100/75">Because this is an untimed live-batch test, students can review the solution after answering.</p>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="border-cyan-300/30 bg-slate-950/40 text-cyan-50 hover:bg-cyan-500/15"
                                            onClick={() => setLiveSolutionOpen((prev) => ({ ...prev, [currentQuestion.id]: !prev[currentQuestion.id] }))}
                                        >
                                            {currentSolutionOpen ? 'Hide Solution' : 'View Solution'}
                                        </Button>
                                    </div>
                                    {currentSolutionOpen ? (
                                        <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                                            {currentCorrectAnswer !== '-' ? (
                                                <div className="space-y-1">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/70">Correct Answer</p>
                                                    <div className="text-base font-semibold text-emerald-200">
                                                        <MathText text={currentCorrectAnswer} className="text-base font-semibold text-emerald-200" />
                                                    </div>
                                                </div>
                                            ) : null}
                                            {currentSolutionAssets.explanationText ? (
                                                <div className="space-y-1">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/70">Explanation</p>
                                                    <MathText text={currentSolutionAssets.explanationText} className="text-sm leading-relaxed text-slate-100" />
                                                </div>
                                            ) : null}
                                            {currentSolutionAssets.explanationImages.length > 0 ? (
                                                <ExamImageGallery
                                                    sources={currentSolutionAssets.explanationImages}
                                                    altPrefix={`Solution for question ${currentQuestionIndex + 1} image`}
                                                    frameClassName="rounded-xl border-slate-700 bg-slate-950"
                                                    imageClassName="max-h-[560px]"
                                                />
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                    <div className="flex flex-wrap gap-3">
                        <Button size="lg" className="shadow-md bg-emerald-600 hover:bg-emerald-500 text-white" onClick={handleSaveAndNext}><CheckCircle2 className="mr-2 h-4 w-4" />Save & Next</Button>
                        <Button size="lg" className="shadow-md bg-violet-600 hover:bg-violet-500 text-white" onClick={handleMarkForReview}><Flag className="mr-2 h-4 w-4" />Mark for Review & Next</Button>
                        <Button size="lg" variant="outline" className="border-slate-500 bg-slate-800/60 text-slate-100 hover:bg-slate-700" onClick={handleSkipQuestion}>Skip Question</Button>
                        <Button size="lg" className="bg-rose-600 hover:bg-rose-500 text-white" onClick={handleClearResponse}><Circle className="mr-2 h-4 w-4" />Clear Response</Button>
                    </div>
                </div>
                {/* Right Panel: Info and Navigation */}
                <div className="flex flex-col gap-4 lg:sticky lg:top-20 h-fit">
                    <Card className="border-slate-800/80 bg-slate-900/80 shadow-xl backdrop-blur">
                      <CardContent className="p-4 flex items-center gap-4">
                        <Avatar className="h-12 w-12 border border-slate-700"><AvatarImage src={user?.photoURL || undefined} /><AvatarFallback><User /></AvatarFallback></Avatar>
                        <div>
                          <p className="font-semibold text-lg">{user?.displayName}</p>
                          <p className="text-sm text-slate-400">JEE Main Aspirant</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="text-center border-slate-800/80 bg-slate-900/80 shadow-xl backdrop-blur">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                          <Timer className="h-5 w-5" />
                          {hasTimeLimit ? 'Time Left' : 'Time Limit'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {hasTimeLimit ? (
                          <p className="font-mono text-4xl font-bold tracking-wider text-cyan-300">{formatTime(timeLeft ?? 0)}</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-2xl font-semibold text-cyan-100">{durationLabel}</p>
                            <p className="text-sm text-slate-400">This test stays open until you submit it.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="border-slate-800/80 bg-slate-900/80 shadow-xl backdrop-blur"><CardHeader><CardTitle className="text-3xl">Question Palette</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-5">
                                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-emerald-500"/><span>Answered ({answeredTotal})</span></div>
                                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-rose-500"/><span>Not Answered ({summary.notAnswered})</span></div>
                                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-slate-300"/><span>Not Visited ({summary.notVisited})</span></div>
                                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-violet-500"/><span>Marked for Review ({reviewTotal})</span></div>
                            </div>
                            {sections.map(section => (
                                <div key={section.name} className="mb-4">
                                    <h4 className="font-semibold mb-2 capitalize tracking-wide text-slate-200">{section.name}</h4>
                                    <div className="grid grid-cols-5 gap-2">
                                        {questions.filter(q => q.subject === section.name).map(q => {
                                            const originalIndex = questions.findIndex(origQ => origQ.id === q.id);
                                            return (
                                                <Button key={q.id} variant="outline" size="icon" className={cn('h-10 w-10 rounded-xl border text-sm font-semibold', getStatusClasses(getQuestionStatus(q.id)), currentQuestion.id === q.id && 'ring-2 ring-white/70 ring-offset-2 ring-offset-slate-950')} onClick={() => handleSelectQuestion(originalIndex)}>
                                                    {originalIndex + 1}
                                                </Button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <Button size="lg" className="w-full h-12 text-base shadow-lg" onClick={() => setIsSubmitDialogOpen(true)}>Submit Test</Button>
                </div>
                <AlertDialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure you want to submit?</AlertDialogTitle>
                            <AlertDialogDescription>
                                You will not be able to change your answers after submitting. Here is a summary:
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                            <div><span className="font-semibold text-foreground">Answered:</span> {summary.answered + summary.answeredAndMarked}</div>
                            <div><span className="font-semibold text-foreground">Not Answered:</span> {summary.notAnswered}</div>
                            <div><span className="font-semibold text-foreground">Marked for Review:</span> {summary.markedForReview + summary.answeredAndMarked}</div>
                            <div><span className="font-semibold text-foreground">Not Visited:</span> {summary.notVisited}</div>
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void handleSubmitTest()}>Submit</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
            </div>
        </>
    );
}
