'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, serverTimestamp, setDoc } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Timer, User, ArrowLeft, Check, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractSubtopicPaths, normalizeSubtopicValue, splitSubtopicPath } from '@/lib/subtopic-paths';
import { buildPracticeQuestionScopeEntries } from '@/lib/practice-question-scope';
import { Logo } from '@/components/icons';
import { useIsSubscribed } from '@/hooks/useIsSubscribed';
import MathText from '@/components/math-text';
import ExamSessionLoader, { type ExamSessionLoaderPhase } from '@/components/exam-session-loader';
import { RouteTransitionFallback } from '@/components/route-transition';
import {
    ExamImageGallery,
    getExamQuestionAssetUrls,
    normalizeExamImageUrls,
    preloadExamImageUrls,
} from '@/components/exam-image-gallery';
import {
    consumePremiumPracticeAttempt,
    resolvePremiumPracticeAttemptUsage,
    type PremiumPracticeSessionPurchase,
} from '@/lib/premium-practice-session';
import {
    fetchPracticeQuestionDocsByIds,
    loadSubjectNameMap,
    readDocSnapshotResilient,
    readQuerySnapshotResilient,
} from '@/lib/exam-question-loader';

enum QuestionStatus {
  NotAnswered,
  Answered,
  MarkedForReview,
  AnsweredAndMarkedForReview,
  NotVisited,
}

type PracticeQuestion = {
  id: string;
  teacherId?: string;
  subjectId: string;
  topicId: string;
  subtopics?: string[];
  questionText: string;
  solutionExplanation?: string;
  questionType: 'MCQ' | 'Numerical' | 'Text';
  options?: string[];
  correctAnswer?: string;
  numericalAnswer?: number;
  numericalAnswerText?: string;
  textAnswer?: string;
  subject: string; // Added from join
  imageUrl?: string;
  imageUrls?: string[];
  explanationImageUrl?: string;
  explanationImageUrls?: string[];
  difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  examTypeId: string;
  classId: string;
  accessLevel: 'free' | 'paid';
  isPreviousYear?: boolean;
  previousYear?: string;
  mockTestOnly?: boolean;
  alignments?: Array<{
    examTypeId?: string;
    classId?: string;
    subjectId?: string;
    topicId?: string;
    subtopics?: string[];
    difficultyLevel?: 'Easy' | 'Medium' | 'Hard';
    accessLevel?: 'free' | 'paid';
    mockTestOnly?: boolean;
    isPreviousYear?: boolean;
    previousYear?: string;
  }>;
};

type PracticeQuestionRecord = Omit<PracticeQuestion, 'subject'>;

type Answer = {
  value: string | number;
  status: QuestionStatus;
  timeTaken: number;
};

const normalizeText = (value: string | number | undefined) => String(value ?? '').trim().toLowerCase();
const isAnswerCorrect = (question: PracticeQuestion, answerValue: string | number | undefined) => {
    if (question.questionType === 'MCQ') return question.correctAnswer === answerValue;
    if (question.questionType === 'Numerical') return Number(question.numericalAnswer) === Number(answerValue);
    return normalizeText(question.textAnswer) === normalizeText(answerValue);
};
const getCorrectAnswer = (question: PracticeQuestion) => question.correctAnswer ?? question.numericalAnswerText ?? question.numericalAnswer ?? question.textAnswer ?? '-';
const getQuestionImageUrls = (question: Pick<PracticeQuestion, 'imageUrl' | 'imageUrls'>) =>
    normalizeExamImageUrls(question.imageUrls, question.imageUrl);
const normalizePracticeQuestionIdList = (value: unknown): string[] => {
    const rawValues = Array.isArray(value)
        ? value
        : String(value || '')
            .split(',')
            .map((entry) => entry.trim());
    return Array.from(new Set(
        rawValues
            .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
            .map((entry) => entry.trim())
    ));
};
const fetchPracticeQuestionsByIds = async (firestore: any, questionIds: string[]): Promise<PracticeQuestion[]> => {
    const [subjectNameById, docs] = await Promise.all([
        loadSubjectNameMap(firestore),
        fetchPracticeQuestionDocsByIds(firestore, questionIds, 'practice session questions'),
    ]);

    return docs.map(({ id, data }) => {
        const questionData = data as Omit<PracticeQuestion, 'id' | 'subject'>;
        return {
            ...questionData,
            id,
            subject: subjectNameById.get(String(questionData.subjectId || '').trim()) || 'Unknown Subject',
        };
    });
};
const PREVIOUS_YEAR_PATTERN = /^(19|20)\d{2}$/;
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
const normalizePreviousYearMode = (value: unknown): 'all' | 'pyq' => (value === 'pyq' ? 'pyq' : 'all');
const normalizeSubtopicPathSegments = (segments: string[]) =>
    segments.map((segment) => String(segment || '').trim()).filter(Boolean);
const parseSubtopicPathSelection = (value?: string) =>
    normalizeSubtopicPathSegments(splitSubtopicPath(String(value || '')));
const serializeSubtopicPathSelection = (segments: string[]) =>
    normalizeSubtopicPathSegments(segments).join(' > ');
const getSubtopicPathKey = (segments: string[]) =>
    normalizeSubtopicPathSegments(segments).map((segment) => normalizeSubtopicValue(segment)).join('>');
const normalizeSubtopicPathSelections = (subtopicPaths: string[] = []) => {
    const unique = new Map<string, string>();
    subtopicPaths.forEach((value) => {
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
const matchesSelectedSubtopics = (
    question: PracticeQuestionRecord,
    selectedSubtopics: string[] = []
) => {
    return matchesSelectedSubtopicPaths(question.subtopics, selectedSubtopics);
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
const matchesPreviousYearFilter = (
    question: PracticeQuestionRecord,
    previousYearMode: 'all' | 'pyq',
    selectedPreviousYears: string[] = []
) => {
    if (previousYearMode !== 'pyq') return true;
    const year = normalizePreviousYearValue(question.previousYear);
    if (!question.isPreviousYear || !year) return false;
    if (selectedPreviousYears.length === 0) return true;
    return selectedPreviousYears.includes(year);
};
const matchesExamClass = (
    question: PracticeQuestionRecord,
    examTypeId?: string | null,
    classId?: string | null
) => {
    const normalizedExamTypeId = String(examTypeId || '').trim();
    const normalizedClassId = String(classId || '').trim();
    const directMatch =
        (!normalizedExamTypeId || question.examTypeId === normalizedExamTypeId)
        && (!normalizedClassId || question.classId === normalizedClassId);
    if (directMatch) return true;
    return (question.alignments || []).some(
        (alignment) =>
            (!normalizedExamTypeId || alignment.examTypeId === normalizedExamTypeId)
            && (!normalizedClassId || alignment.classId === normalizedClassId)
    );
};
const matchesSubjectInContext = (
    question: PracticeQuestionRecord,
    subjectId?: string | null,
    examTypeId?: string | null,
    classId?: string | null
) => {
    const normalizedSubjectId = String(subjectId || '').trim();
    if (!normalizedSubjectId) return true;
    const direct = question.subjectId === normalizedSubjectId && matchesExamClass(question, examTypeId, classId);
    if (direct) return true;
    return (question.alignments || []).some(
        (alignment) =>
            alignment.subjectId === normalizedSubjectId
            && (!examTypeId || alignment.examTypeId === examTypeId)
            && (!classId || alignment.classId === classId)
    );
};
const matchesDifficultyInContext = (
    question: PracticeQuestionRecord,
    difficultyLevel?: string | null,
    examTypeId?: string | null,
    classId?: string | null
) => true;
const matchesPreviousYearScope = (
    isPreviousYear: unknown,
    previousYear: unknown,
    previousYearMode: 'all' | 'pyq',
    selectedPreviousYears: string[] = []
) => {
    if (previousYearMode !== 'pyq') return true;
    const year = normalizePreviousYearValue(String(previousYear || ''));
    if (!isPreviousYear || !year) return false;
    if (selectedPreviousYears.length === 0) return true;
    return selectedPreviousYears.includes(year);
};
const getQuestionScopeEntries = (question: PracticeQuestionRecord) =>
    buildPracticeQuestionScopeEntries(question);
const matchesQuestionBankSourceValue = (
    mockTestOnly: unknown,
    source: 'student_plus_official' | 'teacher_official'
) => (source === 'teacher_official' ? !!mockTestOnly : !mockTestOnly);
const matchesPracticeScopeEntry = (
    entry: ReturnType<typeof getQuestionScopeEntries>[number],
    config: {
        subjectId?: string;
        topicId?: string;
        subtopics?: string[];
        questionBankSource?: 'student_plus_official' | 'teacher_official';
        questionType?: 'All' | 'MCQ' | 'Numerical' | 'Text';
        difficultyLevel?: 'All' | 'Easy' | 'Medium' | 'Hard' | string;
        previousYearMode?: 'all' | 'pyq';
        previousYears?: string[];
    },
    examTypeId?: string | null,
    classId?: string | null,
    defaultQuestionBankSource: 'student_plus_official' | 'teacher_official' = 'student_plus_official'
) => {
    const normalizedExamTypeId = String(examTypeId || '').trim();
    const normalizedClassId = String(classId || '').trim();
    const normalizedSubjectId = String(config.subjectId || '').trim();
    const normalizedTopicId = String(config.topicId || '').trim();
    const source = config.questionBankSource || defaultQuestionBankSource;

    if (normalizedExamTypeId && entry.examTypeId !== normalizedExamTypeId) return false;
    if (normalizedClassId && entry.classId !== normalizedClassId) return false;
    if (normalizedSubjectId && entry.subjectId !== normalizedSubjectId) return false;
    if (normalizedTopicId && entry.topicId !== normalizedTopicId) return false;
    if (!matchesQuestionBankSourceValue(entry.mockTestOnly, source)) return false;
    if (config.questionType && config.questionType !== 'All' && entry.questionType !== config.questionType) return false;
    
    if (!matchesSelectedSubtopicPaths(entry.subtopics, config.subtopics || [])) return false;
    if (!matchesPreviousYearScope(entry.isPreviousYear, entry.previousYear, config.previousYearMode || 'all', config.previousYears || [])) return false;

    return true;
};
const canUsePracticeScopeEntry = (
    entry: ReturnType<typeof getQuestionScopeEntries>[number],
    question: PracticeQuestionRecord,
    options: {
        teacherId?: string | null;
        teacherQuestionMode: 'free' | 'paid' | 'all';
        isSubscribed: boolean;
        subscriptionPlan: any;
        accessLevel?: string | null;
    }
) => {
    const teacherId = String(options.teacherId || '').trim();
    if (teacherId) {
        if (question.teacherId !== teacherId) return false;
        if (options.teacherQuestionMode === 'all') return true;
        return entry.accessLevel === options.teacherQuestionMode;
    }

    const requestedAccessLevel = String(options.accessLevel || '').trim();
    if (requestedAccessLevel && requestedAccessLevel !== 'all' && entry.accessLevel !== requestedAccessLevel) {
        return false;
    }

    if (entry.accessLevel === 'free') return true;

    if (!options.isSubscribed || !options.subscriptionPlan) return false;
    if (options.subscriptionPlan.examTypeId !== entry.examTypeId) return false;

    if (options.subscriptionPlan.topicId) return entry.topicId === options.subscriptionPlan.topicId;
    if (options.subscriptionPlan.subjectIds?.length) {
        return entry.classId === options.subscriptionPlan.classId && options.subscriptionPlan.subjectIds.includes(entry.subjectId);
    }
    if (options.subscriptionPlan.classId) return entry.classId === options.subscriptionPlan.classId;
    if (options.subscriptionPlan.examTypeId) return true;

    return false;
};
const questionMatchesPracticeScope = (
    question: PracticeQuestionRecord,
    config: Parameters<typeof matchesPracticeScopeEntry>[1],
    options: {
        examTypeId?: string | null;
        classId?: string | null;
        defaultQuestionBankSource: 'student_plus_official' | 'teacher_official';
        teacherId?: string | null;
        teacherQuestionMode: 'free' | 'paid' | 'all';
        isSubscribed: boolean;
        subscriptionPlan: any;
        accessLevel?: string | null;
    }
) => getQuestionScopeEntries(question).some((entry) =>
    matchesPracticeScopeEntry(entry, config, options.examTypeId, options.classId, options.defaultQuestionBankSource)
    && canUsePracticeScopeEntry(entry, question, options)
);
const mergePracticeQuestionRecords = (...groups: PracticeQuestionRecord[][]) => {
    const byId = new Map<string, PracticeQuestionRecord>();
    groups.flat().forEach((question) => {
        if (!question?.id || byId.has(question.id)) return;
        byId.set(question.id, question);
    });
    return Array.from(byId.values());
};

const QuestionExplanation: React.FC<{ question: PracticeQuestion; userAnswer: Answer | undefined; forceShow?: boolean; timedOut?: boolean }> = ({ question, userAnswer, forceShow = false, timedOut = false }) => {
    const isAttempted = userAnswer && userAnswer.value !== '';
    
    const explanationImages = useMemo(() => {
        return normalizeExamImageUrls(question.explanationImageUrls, question.explanationImageUrl);
    }, [question]);
    const hasExplanationText = !!question.solutionExplanation?.trim();
    const hasExplanationContent = explanationImages.length > 0 || hasExplanationText;

    if (!isAttempted && !forceShow) {
        return null;
    }

    const isCorrect = isAttempted ? isAnswerCorrect(question, userAnswer.value) : false;

    return (
        <Card className="mt-4 bg-muted/30 border-dashed">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    {isCorrect ? <Check className="h-5 w-5 text-green-500" /> : <XIcon className="h-5 w-5 text-red-500" />}
                    {timedOut ? 'Time Up - Solution' : 'Feedback'}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm font-semibold">
                    Your answer:{' '}
                    <span className={cn("font-bold", isCorrect ? "text-green-600" : "text-red-600")}>
                        <MathText text={isAttempted ? userAnswer?.value : 'Not Answered (Time Exceeded)'} />
                    </span>
                </p>
                {(!isCorrect || !isAttempted) && (
                    <p className="text-sm font-semibold">
                        Correct answer:{' '}
                        <span className="font-bold text-green-600">
                            <MathText text={getCorrectAnswer(question)} />
                        </span>
                    </p>
                )}
                {hasExplanationText && (
                    <div>
                        <p className="text-sm font-semibold text-muted-foreground">Solution Explanation:</p>
                        <MathText text={question.solutionExplanation} className="text-sm" />
                    </div>
                )}
                {explanationImages.length > 0 && (
                    <div>
                        <p className="text-sm font-semibold text-muted-foreground">Explanation:</p>
                        <ExamImageGallery
                            sources={explanationImages}
                            altPrefix="Explanation image"
                            listClassName="mt-1"
                        />
                    </div>
                )}
                {isCorrect && !hasExplanationContent && !timedOut && (
                    <p className="text-green-600 font-medium">Excellent! Your answer is correct.</p>
                )}
                 {(!isCorrect || timedOut) && !hasExplanationContent && (
                    <p className="text-red-600 font-medium">That's not quite right. Review the correct answer above.</p>
                )}
            </CardContent>
        </Card>
    );
};

const fetchPracticeQuestions = async (
    firestore: any,
    params: URLSearchParams,
    isSubscribed: boolean,
    subscriptionPlan: any
): Promise<PracticeQuestion[]> => {
    const allFetchedQuestions: PracticeQuestionRecord[] = [];

    const topicConfigsParam = params.get('topicConfigs');
    const subjectConfigsParam = params.get('subjectConfigs');
    const topicsParam = params.get('topics');
    const topicIdParam = params.get('topicId');

    const difficultyLevel = params.get('difficultyLevel');
    const questionType = params.get('questionType');
    const teacherId = params.get('teacherId');
    const examTypeId = params.get('examTypeId');
    const classId = params.get('classId');
    const teacherQuestionModeParam = params.get('teacherQuestionMode');
    const questionBankSourceParam = params.get('questionBankSource');
    const accessLevelParam = params.get('accessLevel');
    const practiceModeParam = params.get('practiceMode');
    const teacherQuestionMode: 'free' | 'paid' | 'all' = (() => {
        if (teacherId && practiceModeParam === 'premium') return 'paid';
        if (teacherId && practiceModeParam === 'regular') return 'free';
        if (teacherQuestionModeParam === 'free' || teacherQuestionModeParam === 'paid' || teacherQuestionModeParam === 'all') {
            return teacherQuestionModeParam;
        }
        if (accessLevelParam === 'paid') return 'paid';
        if (accessLevelParam === 'all') return 'all';
        return 'free';
    })();
    const matchesTeacherQuestionScope = (question: PracticeQuestionRecord) => {
        if (!teacherId) return true;
        if (question.teacherId !== teacherId) return false;
        const normalizedAccess = question.accessLevel || 'free';
        if (teacherQuestionMode === 'all') return true;
        return normalizedAccess === teacherQuestionMode;
    };
    const normalizeQuestionBankSource = (value: unknown): 'student_plus_official' | 'teacher_official' =>
        value === 'teacher_official' ? 'teacher_official' : 'student_plus_official';
    const defaultQuestionBankSource = normalizeQuestionBankSource(questionBankSourceParam);
    const matchesQuestionBankSource = (
        question: PracticeQuestionRecord,
        source: 'student_plus_official' | 'teacher_official'
    ) => (source === 'teacher_official' ? !!question.mockTestOnly : !question.mockTestOnly);
    let teacherScopedQuestionsCache: PracticeQuestionRecord[] | null = null;
    const getTeacherScopedQuestions = async (): Promise<PracticeQuestionRecord[]> => {
        if (!teacherId) return [];
        if (teacherScopedQuestionsCache) return teacherScopedQuestionsCache;
        const snapshot = await readQuerySnapshotResilient(
            query(collection(firestore, 'practice_questions'), where('teacherId', '==', teacherId)),
            'teacher scoped practice questions'
        );
        teacherScopedQuestionsCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PracticeQuestionRecord));
        return teacherScopedQuestionsCache;
    };
    const getTopicCandidateQuestions = async (topicId: string, subjectId?: string): Promise<PracticeQuestionRecord[]> => {
        if (teacherId) return getTeacherScopedQuestions();

        const topicQuerySnapshot = await readQuerySnapshotResilient(
            query(collection(firestore, 'practice_questions'), where('topicId', '==', topicId)),
            `practice topic ${topicId}`
        );
        const directTopicQuestions = topicQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PracticeQuestionRecord));

        const normalizedSubjectId = String(subjectId || '').trim();
        if (!normalizedSubjectId) return directTopicQuestions;

        const subjectQuerySnapshot = await readQuerySnapshotResilient(
            query(collection(firestore, 'practice_questions'), where('subjectId', '==', normalizedSubjectId)),
            `practice subject fallback ${normalizedSubjectId}`
        );
        const subjectQuestions = subjectQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PracticeQuestionRecord));
        return mergePracticeQuestionRecords(directTopicQuestions, subjectQuestions);
    };
    const getSubjectCandidateQuestions = async (subjectId: string): Promise<PracticeQuestionRecord[]> => {
        if (teacherId) return getTeacherScopedQuestions();
        const subjectQuerySnapshot = await readQuerySnapshotResilient(
            query(collection(firestore, 'practice_questions'), where('subjectId', '==', subjectId)),
            `practice subject ${subjectId}`
        );
        return subjectQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PracticeQuestionRecord));
    };

    type SubjectConfig = {
        subjectId: string;
        questionBankSource?: 'student_plus_official' | 'teacher_official';
        questionType?: 'All' | 'MCQ' | 'Numerical' | 'Text';
        difficultyLevel?: 'All' | 'Easy' | 'Medium' | 'Hard';
        previousYearMode?: 'all' | 'pyq';
        previousYears?: string[];
        count: number;
    };
    type TopicConfig = {
        subjectId: string;
        topicId: string;
        subtopics?: string[];
        questionBankSource?: 'student_plus_official' | 'teacher_official';
        questionType?: 'All' | 'MCQ' | 'Numerical' | 'Text';
        difficultyLevel?: 'All' | 'Easy' | 'Medium' | 'Hard';
        previousYearMode?: 'all' | 'pyq';
        previousYears?: string[];
        count: number;
    };
    
    let topicsConfig: {topicId: string, count: number}[] = [];
    let subjectConfigs: SubjectConfig[] = [];
    let topicConfigs: TopicConfig[] = [];

    if (topicConfigsParam) {
        try {
            const parsed = JSON.parse(topicConfigsParam);
            if (Array.isArray(parsed)) {
                topicConfigs = parsed
                    .map((item) => ({
                        subjectId: String(item?.subjectId || ''),
                        topicId: String(item?.topicId || ''),
                        subtopics: Array.isArray(item?.subtopics)
                            ? normalizeSubtopicPathSelections(
                                (item.subtopics as unknown[])
                                    .map((value) => String(value || '').trim())
                                    .filter((value) => value.length > 0)
                            )
                            : [],
                        questionBankSource: normalizeQuestionBankSource(item?.questionBankSource ?? questionBankSourceParam),
                        questionType: item?.questionType || 'All',
                        difficultyLevel: 'Easy' as const,
                        previousYearMode: normalizePreviousYearMode(item?.previousYearMode),
                        previousYears: normalizePreviousYearList(item?.previousYears),
                        count: Number(item?.count || 0),
                    }))
                    .filter((item) => item.subjectId && item.topicId && Number.isFinite(item.count) && item.count > 0);
            }
        } catch {
            topicConfigs = [];
        }
    }

    if (subjectConfigsParam) {
        try {
            const parsed = JSON.parse(subjectConfigsParam);
            if (Array.isArray(parsed)) {
                subjectConfigs = parsed
                    .map((item) => ({
                        subjectId: String(item?.subjectId || ''),
                        questionBankSource: normalizeQuestionBankSource(item?.questionBankSource ?? questionBankSourceParam),
                        questionType: item?.questionType || 'All',
                        difficultyLevel: 'Easy' as const,
                        previousYearMode: normalizePreviousYearMode(item?.previousYearMode),
                        previousYears: normalizePreviousYearList(item?.previousYears),
                        count: Number(item?.count || 0),
                    }))
                    .filter((item) => item.subjectId && Number.isFinite(item.count) && item.count > 0);
            }
        } catch {
            subjectConfigs = [];
        }
    }

    if (topicConfigs.length > 0) {
        for (const config of topicConfigs) {
            const activeQuestionBankSource = config.questionBankSource || defaultQuestionBankSource;
            let topicQuestions = await getTopicCandidateQuestions(config.topicId, config.subjectId);

            topicQuestions = topicQuestions.filter((question) =>
                questionMatchesPracticeScope(question, config, {
                    examTypeId,
                    classId,
                    defaultQuestionBankSource: activeQuestionBankSource,
                    teacherId,
                    teacherQuestionMode,
                    isSubscribed,
                    subscriptionPlan,
                })
            );

            const shuffled = [...topicQuestions].sort(() => 0.5 - Math.random());
            allFetchedQuestions.push(...shuffled.slice(0, config.count));
        }
    } else if (subjectConfigs.length > 0) {
        for (const config of subjectConfigs) {
            const activeQuestionBankSource = config.questionBankSource || defaultQuestionBankSource;
            let subjectQuestions = await getSubjectCandidateQuestions(config.subjectId);

            subjectQuestions = subjectQuestions.filter((question) =>
                questionMatchesPracticeScope(question, config, {
                    examTypeId,
                    classId,
                    defaultQuestionBankSource: activeQuestionBankSource,
                    teacherId,
                    teacherQuestionMode,
                    isSubscribed,
                    subscriptionPlan,
                })
            );

            const shuffled = [...subjectQuestions].sort(() => 0.5 - Math.random());
            allFetchedQuestions.push(...shuffled.slice(0, config.count));
        }
    } else if (topicsParam) {
        topicsConfig = topicsParam.split(',').map(part => {
            const [topicId, countStr] = part.split(':');
            return { topicId, count: parseInt(countStr, 10) };
        });
    } else if (topicIdParam) {
        const count = parseInt(params.get('count')!, 10); // Will be NaN if 'count' is not in params
        topicsConfig = [{ topicId: topicIdParam, count }];
    } else {
        return [];
    }

    for (const config of topicsConfig) {
        if (!config.topicId) continue;
        if (topicsParam && (isNaN(config.count) || config.count <= 0)) continue; // For multi-topic quiz, count is mandatory
        const activeQuestionBankSource = defaultQuestionBankSource;

        let topicQuestions = await getTopicCandidateQuestions(config.topicId);

        const accessLevel = params.get('accessLevel');
        topicQuestions = topicQuestions.filter((question) =>
            questionMatchesPracticeScope(
                question,
                {
                    topicId: config.topicId,
                    questionBankSource: activeQuestionBankSource,
                    questionType: (questionType === 'MCQ' || questionType === 'Numerical' || questionType === 'Text') ? questionType : 'All',
                    difficultyLevel: 'Easy' as const,
                    previousYearMode: 'all',
                    previousYears: [],
                },
                {
                    examTypeId,
                    classId,
                    defaultQuestionBankSource: activeQuestionBankSource,
                    teacherId,
                    teacherQuestionMode,
                    isSubscribed,
                    subscriptionPlan,
                    accessLevel,
                }
            )
        );

        const shuffled = [...topicQuestions].sort(() => 0.5 - Math.random());
        const selected = !isNaN(config.count) && config.count > 0
            ? shuffled.slice(0, config.count)
            : shuffled;

        allFetchedQuestions.push(...selected);
    }
    
    const subjectsMap = await loadSubjectNameMap(firestore);

    const questionsWithSubjects = allFetchedQuestions.map(q => ({
        ...q,
        subject: subjectsMap.get(q.subjectId) || 'Unknown Subject',
    }));

    return [...questionsWithSubjects].sort(() => 0.5 - Math.random());
};


function PracticeSession() {
    const { user } = useUser();
    const firestore = useFirestore();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { isSubscribed, subscriptionPlan, isLoading: isSubscribedLoading } = useIsSubscribed();

    const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFinished, setIsFinished] = useState(false);
    const [score, setScore] = useState(0);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [launchPhase, setLaunchPhase] = useState<ExamSessionLoaderPhase>('config');
    const [launchProgress, setLaunchProgress] = useState(4);
    const [launchDetail, setLaunchDetail] = useState('Checking your practice setup...');
    const [launchQuestionCount, setLaunchQuestionCount] = useState(0);
    const [launchAssetCount, setLaunchAssetCount] = useState(0);

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Map<string | number, Answer>>(new Map());
    const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
    const [questionStartTime, setQuestionStartTime] = useState(Date.now());
    const [timedOutQuestionIds, setTimedOutQuestionIds] = useState<Set<string | number>>(new Set());
    const [revealedSolutionQuestionIds, setRevealedSolutionQuestionIds] = useState<Set<string | number>>(new Set());
    const [revealedResultSolutionQuestionIds, setRevealedResultSolutionQuestionIds] = useState<Set<string | number>>(new Set());
    const [revealedResultQuestionImageIds, setRevealedResultQuestionImageIds] = useState<Set<string | number>>(new Set());
    const [premiumPurchase, setPremiumPurchase] = useState<PremiumPracticeSessionPurchase | null>(null);

    const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
    const timeLimitParam = searchParams.get('timeLimit');
    const totalTimeParam = searchParams.get('totalTime');
    const totalTimeMinutes = useMemo(() => {
        if (!totalTimeParam) return null;
        const parsed = parseInt(totalTimeParam, 10);
        if (Number.isNaN(parsed) || parsed <= 0) return null;
        return parsed;
    }, [totalTimeParam]);
    const perQuestionTimeFromTotal = useMemo(() => {
        if (!totalTimeMinutes || questions.length === 0) return null;
        return Math.max(1, Math.floor((totalTimeMinutes * 60) / questions.length));
    }, [totalTimeMinutes, questions.length]);
    const currentQuestion = questions[currentQuestionIndex];

    useEffect(() => {
        let isActive = true;

        const loadTest = async () => {
            if (!firestore || !user || isSubscribedLoading) return;
            setIsLoading(true);
            setLoadError(null);
            setIsFinished(false);
            setScore(0);
            setQuestions([]);
            setCurrentQuestionIndex(0);
            setAnswers(new Map());
            setTimedOutQuestionIds(new Set());
            setRevealedSolutionQuestionIds(new Set());
            setRevealedResultSolutionQuestionIds(new Set());
            setRevealedResultQuestionImageIds(new Set());
            setLaunchPhase('config');
            setLaunchProgress(6);
            setLaunchDetail('Checking your practice setup...');
            setLaunchQuestionCount(0);
            setLaunchAssetCount(0);
            try {
                const practiceModeParam = searchParams.get('practiceMode');
                const teacherIdParam = searchParams.get('teacherId');
                const premiumPurchaseId = searchParams.get('premiumPurchaseId');
                let fetchedQuestions: PracticeQuestion[] = [];
                setPremiumPurchase(null);
                setLaunchDetail('Validating access and session settings...');

                if (teacherIdParam && practiceModeParam === 'premium') {
                    if (!premiumPurchaseId) {
                        setQuestions([]);
                        setLoadError('Premium payment not found. Please complete payment before starting premium practice.');
                        return;
                    }

                    const purchaseRef = doc(
                        firestore,
                        'users',
                        user.uid,
                        'premium_practice_session_purchases',
                        premiumPurchaseId
                    );
                    const purchaseSnapshot = await readDocSnapshotResilient(purchaseRef, `premium practice purchase ${premiumPurchaseId}`);
                    if (!purchaseSnapshot.exists()) {
                        setQuestions([]);
                        setLoadError('Premium purchase record was not found. Please pay again to continue.');
                        return;
                    }

                    const purchaseData = purchaseSnapshot.data() as PremiumPracticeSessionPurchase;
                    if (purchaseData.status !== 'paid' || purchaseData.teacherId !== teacherIdParam) {
                        setQuestions([]);
                        setLoadError('This premium session is not authorized for the selected teacher.');
                        return;
                    }
                    const attemptUsage = resolvePremiumPracticeAttemptUsage({
                        attemptPricing: purchaseData.attemptPricing,
                        attemptState: purchaseData.attemptState,
                        purchasedAt: purchaseData.purchasedAt,
                    });
                    if (attemptUsage.isExhausted) {
                        setPremiumPurchase(purchaseData);
                        setQuestions([]);
                        setLoadError(
                            attemptUsage.actionKind === 'total_recharge'
                                ? 'All included attempts are used. Recharge this paid practice pack from the saved premium practice card to continue.'
                                : attemptUsage.actionKind === 'interval_attempt'
                                    ? 'Current interval attempts are used. Buy 1 instant attempt from the saved premium practice card or wait for the next interval reset.'
                                    : 'Attempts are exhausted for this paid practice pack.'
                        );
                        return;
                    }
                    setPremiumPurchase(purchaseData);

                    const persistedQuestionIds = Array.from(new Set([
                        ...(Array.isArray(purchaseData.questionIds)
                            ? purchaseData.questionIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
                            : []),
                        ...(Array.isArray(purchaseData.includedQuestionIds)
                            ? purchaseData.includedQuestionIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
                            : []),
                    ]));
                    if (persistedQuestionIds.length > 0) {
                        setLaunchPhase('questions');
                        setLaunchProgress(34);
                        setLaunchDetail('Restoring your saved premium question pack...');
                        fetchedQuestions = await fetchPracticeQuestionsByIds(firestore, persistedQuestionIds);
                    }
                }

                const explicitQuestionIds = normalizePracticeQuestionIdList(searchParams.get('questionIds'));
                if (fetchedQuestions.length === 0 && explicitQuestionIds.length > 0) {
                    setLaunchPhase('questions');
                    setLaunchProgress(34);
                    setLaunchDetail('Opening your selected practice questions...');
                    fetchedQuestions = await fetchPracticeQuestionsByIds(firestore, explicitQuestionIds);
                }

                if (fetchedQuestions.length === 0) {
                    setLaunchPhase('questions');
                    setLaunchProgress(40);
                    setLaunchDetail('Selecting questions for your practice session...');
                    fetchedQuestions = await fetchPracticeQuestions(firestore, searchParams, isSubscribed, subscriptionPlan);
                }

                if (!isActive) return;

                const assetUrls = Array.from(new Set(
                    fetchedQuestions.flatMap((question) => getExamQuestionAssetUrls(question as unknown as Record<string, unknown>))
                ));

                setLaunchQuestionCount(fetchedQuestions.length);
                setLaunchAssetCount(assetUrls.length);

                if (assetUrls.length > 0) {
                    setLaunchPhase('questions');
                    setLaunchProgress(48);
                    setLaunchDetail(`Preloading ${assetUrls.length} question and solution image${assetUrls.length === 1 ? '' : 's'}...`);
                    const preloadResult = await preloadExamImageUrls(assetUrls, ({ completed, total, failed }) => {
                        if (!isActive) return;
                        const ratio = total === 0 ? 1 : completed / total;
                        setLaunchProgress(Math.max(48, Math.min(92, Math.round(48 + (ratio * 44)))));
                        setLaunchDetail(
                            failed > 0
                                ? `Loading exam media ${completed}/${total} (${failed} delayed)`
                                : `Loading exam media ${completed}/${total}`
                        );
                    });
                    if (!isActive) return;
                    if (preloadResult.failed > 0) {
                        console.warn(`Practice session media preload had ${preloadResult.failed} delayed asset(s).`);
                    }
                } else {
                    setLaunchProgress(92);
                    setLaunchDetail('Question paper is ready. Starting your practice environment...');
                }

                setLaunchPhase('environment');
                setLaunchProgress(98);
                setLaunchDetail('Launching your practice environment...');
                await new Promise((resolve) => setTimeout(resolve, 180));
                if (!isActive) return;

                setQuestions(fetchedQuestions);
                setQuestionStartTime(Date.now());
            } catch (error) {
                console.error("Failed to load practice questions:", error);
                setLoadError('Could not load practice questions. Please try again.');
                setQuestions([]);
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
    }, [searchParams, user, firestore, isSubscribed, subscriptionPlan, isSubscribedLoading]);

    const getQuestionStatus = useCallback((questionId: string | number) => {
        const answer = answers.get(questionId);
        if (!answer) return QuestionStatus.NotVisited;
        return answer.status;
    }, [answers]);

    const handleSelectQuestion = useCallback((index: number) => {
        if (isFinished) return;
        
        const timeSpent = (Date.now() - questionStartTime) / 1000;
        const cq = questions[currentQuestionIndex];
        const currentAnswer = answers.get(cq.id) || { value: '', status: QuestionStatus.NotVisited, timeTaken: 0 };
        const newStatus = currentAnswer.status === QuestionStatus.NotVisited ? QuestionStatus.NotAnswered : currentAnswer.status;
        const shouldAddTime = !timedOutQuestionIds.has(cq.id);
        
        setAnswers(prev => new Map(prev).set(cq.id, {
            ...currentAnswer,
            status: newStatus,
            timeTaken: shouldAddTime ? (currentAnswer.timeTaken || 0) + timeSpent : currentAnswer.timeTaken || 0,
        }));

        // Reset timer immediately for the newly selected question to avoid
        // carrying a transient `0` into the timeout effect.
        if (perQuestionTimeFromTotal !== null) {
            setQuestionTimeLeft(perQuestionTimeFromTotal);
        } else if (timeLimitParam) {
            const parsed = parseInt(timeLimitParam, 10);
            setQuestionTimeLeft(Number.isNaN(parsed) || parsed <= 0 ? null : parsed);
        } else {
            setQuestionTimeLeft(null);
        }
        
        setCurrentQuestionIndex(index);
        setQuestionStartTime(Date.now());
    }, [isFinished, currentQuestionIndex, questions, answers, questionStartTime, timedOutQuestionIds, perQuestionTimeFromTotal, timeLimitParam]);

    const handleSaveAndNext = useCallback(() => {
        if (currentQuestionIndex < questions.length - 1) {
            handleSelectQuestion(currentQuestionIndex + 1);
        } else {
            setIsSubmitDialogOpen(true);
        }
    }, [currentQuestionIndex, questions.length, handleSelectQuestion]);

    // Timer Effects
    useEffect(() => {
        if (perQuestionTimeFromTotal !== null) {
            setQuestionTimeLeft(perQuestionTimeFromTotal);
            return;
        }
        if (timeLimitParam) {
            const parsed = parseInt(timeLimitParam, 10);
            setQuestionTimeLeft(Number.isNaN(parsed) || parsed <= 0 ? null : parsed);
            return;
        }
        setQuestionTimeLeft(null);
    }, [timeLimitParam, currentQuestionIndex, perQuestionTimeFromTotal]);

    useEffect(() => {
        if (isFinished || questionTimeLeft === null || questionTimeLeft <= 0) return;

        const timer = setInterval(() => {
            setQuestionTimeLeft(prev => (prev !== null ? prev - 1 : null));
        }, 1000);

        return () => clearInterval(timer);
    }, [questionTimeLeft, isFinished]);

    useEffect(() => {
        if (questionTimeLeft !== 0 || isFinished || !currentQuestion) return;
        if (timedOutQuestionIds.has(currentQuestion.id)) return;

        const timeSpent = (Date.now() - questionStartTime) / 1000;
        const currentAnswer = answers.get(currentQuestion.id) || { value: '', status: QuestionStatus.NotVisited, timeTaken: 0 };
        const nextStatus = currentAnswer.status === QuestionStatus.NotVisited ? QuestionStatus.NotAnswered : currentAnswer.status;

        setTimedOutQuestionIds((prev) => {
            const next = new Set(prev);
            next.add(currentQuestion.id);
            return next;
        });
        setAnswers((prev) => new Map(prev).set(currentQuestion.id, {
            ...currentAnswer,
            status: nextStatus,
            timeTaken: (currentAnswer.timeTaken || 0) + timeSpent,
        }));
    }, [questionTimeLeft, isFinished, currentQuestion, timedOutQuestionIds, questionStartTime, answers]);


    const sections = useMemo(() => {
        if (!questions.length) return [];
        const sectionMap: Record<string, PracticeQuestion[]> = {};
        questions.forEach(q => {
            if (!sectionMap[q.subject]) sectionMap[q.subject] = [];
            sectionMap[q.subject].push(q);
        });
        return Object.entries(sectionMap).map(([name, questions]) => ({ name, questions }));
    }, [questions]);

    const isAnswered = useMemo(() => {
        if (!currentQuestion) return false;
        const answer = answers.get(currentQuestion.id);
        return !!answer && answer.value !== '';
    }, [answers, currentQuestion]);
    const isTimedOut = useMemo(() => {
        if (!currentQuestion) return false;
        return timedOutQuestionIds.has(currentQuestion.id);
    }, [timedOutQuestionIds, currentQuestion]);
    const isSolutionVisible = useMemo(() => {
        if (!currentQuestion) return false;
        return revealedSolutionQuestionIds.has(currentQuestion.id);
    }, [revealedSolutionQuestionIds, currentQuestion]);
    const isAnswerLocked = isFinished || isAnswered || isTimedOut;
    
    const handleMarkForReview = () => {
        const currentAnswer = answers.get(currentQuestion.id);
        const newStatus = currentAnswer?.value ? QuestionStatus.AnsweredAndMarkedForReview : QuestionStatus.MarkedForReview;
        setAnswers(prev => new Map(prev).set(currentQuestion.id, { 
            value: currentAnswer?.value || '', 
            status: newStatus,
            timeTaken: currentAnswer?.timeTaken || 0,
        }));
        handleSaveAndNext();
    };
    
    const handleClearResponse = () => {
        const currentAnswer = answers.get(currentQuestion.id);
        setAnswers(prev => new Map(prev).set(currentQuestion.id, { 
            value: '', 
            status: QuestionStatus.NotAnswered,
            timeTaken: currentAnswer?.timeTaken || 0,
        }));
    }

    const handleAnswerChange = (value: string | number) => {
        if (isTimedOut) return;
        const currentAnswer = answers.get(currentQuestion.id);
        const currentStatus = currentAnswer?.status || QuestionStatus.NotVisited;
        const newStatus = currentStatus === QuestionStatus.MarkedForReview || currentStatus === QuestionStatus.AnsweredAndMarkedForReview
            ? QuestionStatus.AnsweredAndMarkedForReview
            : QuestionStatus.Answered;
        setAnswers(prev => new Map(prev).set(currentQuestion.id, { 
            value, 
            status: newStatus,
            timeTaken: currentAnswer?.timeTaken || 0,
        }));
    };
    
    const handleViewSolution = () => {
        if (!currentQuestion) return;
        setRevealedSolutionQuestionIds((prev) => {
            const next = new Set(prev);
            next.add(currentQuestion.id);
            return next;
        });
    };

    const handleSubmitTest = async () => {
        setIsSubmitDialogOpen(false);

        const finalAnswers = new Map(answers);
        const timeSpentOnLastQ = (Date.now() - questionStartTime) / 1000;
        const lastQ = questions[currentQuestionIndex];
        const lastAnswer = answers.get(lastQ.id) || { value: '', status: QuestionStatus.NotVisited, timeTaken: 0 };
        const lastStatus = lastAnswer.status === QuestionStatus.NotVisited ? QuestionStatus.NotAnswered : lastAnswer.status;
        const shouldAddLastQuestionTime = !timedOutQuestionIds.has(lastQ.id);
        
        finalAnswers.set(lastQ.id, {
            ...lastAnswer,
            status: lastStatus,
            timeTaken: shouldAddLastQuestionTime ? (lastAnswer.timeTaken || 0) + timeSpentOnLastQ : lastAnswer.timeTaken || 0
        });

        let correctAnswers = 0;
        let totalTimeTaken = 0;
        finalAnswers.forEach((answer, qId) => {
            totalTimeTaken += answer.timeTaken || 0;
            const question = questions.find(q => q.id === qId);
            if (!question) return;
            if (isAnswerCorrect(question, answer.value)) {
                correctAnswers++;
            }
        });
        setScore(correctAnswers);
        setAnswers(finalAnswers);
        setIsFinished(true);

        if (user && firestore) {
            const practiceResultsRef = collection(firestore, 'users', user.uid, 'practice_results');
            const topicIds = Array.from(new Set(questions.map(q => q.topicId)));
            const premiumPurchaseId = searchParams.get('premiumPurchaseId') || '';
            const practiceMode = searchParams.get('practiceMode') === 'premium' ? 'premium' : 'regular';
            const resultPayload = {
                topics: topicIds,
                questionsAttempted: finalAnswers.size,
                questionsCorrect: correctAnswers,
                totalQuestions: questions.length,
                timeTaken: totalTimeTaken,
                submittedAt: serverTimestamp(),
                practiceMode,
                teacherId: searchParams.get('teacherId') || '',
                premiumPracticePurchaseId: premiumPurchaseId,
            };
            if (practiceMode === 'premium' && premiumPurchaseId) {
                const purchaseRef = doc(firestore, 'users', user.uid, 'premium_practice_session_purchases', premiumPurchaseId);
                const latestPurchase = premiumPurchase
                    || (await readDocSnapshotResilient(purchaseRef, `premium practice purchase ${premiumPurchaseId} refresh`)
                        .then((snapshot) => (snapshot.exists() ? snapshot.data() as PremiumPracticeSessionPurchase : null)));
                if (latestPurchase) {
                    const consumeResult = consumePremiumPracticeAttempt({
                        attemptPricing: latestPurchase.attemptPricing,
                        attemptState: latestPurchase.attemptState,
                        purchasedAt: latestPurchase.purchasedAt,
                    });
                    setPremiumPurchase({
                        ...latestPurchase,
                        attemptState: consumeResult.nextState,
                    });
                    await Promise.all([
                        setDoc(purchaseRef, {
                            attemptState: consumeResult.nextState,
                            updatedAt: serverTimestamp(),
                        }, { merge: true }),
                        addDocumentNonBlocking(practiceResultsRef, resultPayload),
                    ]);
                    return;
                }
            }
            addDocumentNonBlocking(practiceResultsRef, resultPayload);
        }
    };

    const getStatusClasses = (status: QuestionStatus) => {
        switch (status) {
            case QuestionStatus.Answered: return 'bg-green-500 text-white';
            case QuestionStatus.NotAnswered: return 'bg-red-500 text-white';
            case QuestionStatus.MarkedForReview: return 'bg-purple-500 text-white';
            case QuestionStatus.AnsweredAndMarkedForReview: return 'bg-purple-500 text-white relative after:content-[\'✔\'] after:absolute after:bottom-0 after:right-0 after:text-xs after:text-green-300';
            case QuestionStatus.NotVisited: return 'bg-gray-200 text-gray-800';
        }
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

    const isImageOnlyQuestion = useMemo(() => {
        if (!currentQuestion) return false;
        return normalizeText(currentQuestion.questionText) === normalizeText('Question attached as image');
    }, [currentQuestion]);
    const questionImages = useMemo(() => {
        if (!currentQuestion || !isImageOnlyQuestion) return [];
        return getQuestionImageUrls(currentQuestion);
    }, [currentQuestion, isImageOnlyQuestion]);
    const shouldShowQuestionText = !isImageOnlyQuestion && !!(currentQuestion?.questionText || '').trim();
    const practiceAgainHref = useMemo(() => {
        const teacherIdParam = searchParams.get('teacherId') || '';
        if (!teacherIdParam) return '/practice';

        const nextParams = new URLSearchParams();
        const examTypeIdParam = searchParams.get('examTypeId') || '';
        const classIdParam = searchParams.get('classId') || '';
        const examTypeNameParam = searchParams.get('examTypeName') || '';
        const classNameParam = searchParams.get('className') || '';
        const premiumPurchaseIdParam = searchParams.get('premiumPurchaseId') || '';
        const practiceModeParam = searchParams.get('practiceMode') || '';
        const selectedSubjectIds = Array.from(new Set(questions.map((q) => q.subjectId))).filter(Boolean);

        if (examTypeIdParam) nextParams.set('examTypeId', examTypeIdParam);
        if (classIdParam) nextParams.set('classId', classIdParam);
        if (examTypeNameParam) nextParams.set('examTypeName', examTypeNameParam);
        if (classNameParam) nextParams.set('className', classNameParam);
        if (selectedSubjectIds.length > 0) nextParams.set('subjectIds', selectedSubjectIds.join(','));
        if (practiceModeParam === 'premium') nextParams.set('practiceMode', 'premium');
        if (premiumPurchaseIdParam) nextParams.set('premiumPurchaseId', premiumPurchaseIdParam);

        const qs = nextParams.toString();
        return `/start-practice-session/${encodeURIComponent(teacherIdParam)}${qs ? `?${qs}` : ''}`;
    }, [searchParams, questions]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };
    
    const formatSeconds = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    };

    if (isLoading || isSubscribedLoading) {
        return (
            <ExamSessionLoader
              modeLabel="Practice Session"
              title="Preparing Practice Session"
              subtitle="We are loading your questions, scans, and solution media before opening the practice environment."
              detail={launchDetail}
              phase={launchPhase}
              progress={launchProgress}
              questionCount={launchQuestionCount}
              assetCount={launchAssetCount}
            />
        );
    }
    
    if (!currentQuestion) {
        return (
            <div className="flex h-screen w-screen items-center justify-center">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">Practice Session</h1>
                <p className="text-lg text-destructive">{loadError || 'Could not load any questions.'}</p>
                <p className="text-muted-foreground mt-2">
                  {loadError ? 'Please go back and retry your session setup.' : 'There may be no questions available for your selected filters.'}
                </p>
                <Button onClick={() => router.back()} className="mt-4"><ArrowLeft className='mr-2'/>Go Back</Button>
              </div>
            </div>
        );
    }
    
    const totalTimeTaken = Array.from(answers.values()).reduce((acc, ans) => acc + (ans.timeTaken || 0), 0);

    if(isFinished) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen py-8">
                <Card className="w-full max-w-2xl text-center shadow-2xl">
                    <CardHeader>
                        <CardTitle className="font-headline text-3xl">Practice Session Finished!</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-lg text-muted-foreground">Here's how you did:</p>
                        <div className="flex items-end justify-center gap-6">
                            <div>
                                <p className="text-sm text-muted-foreground">Score</p>
                                <div className="text-6xl font-bold text-primary">{score} / {questions.length}</div>
                            </div>
                             <div>
                                <p className="text-sm text-muted-foreground">Total Time</p>
                                <div className="text-4xl font-bold">{formatSeconds(totalTimeTaken)}</div>
                            </div>
                        </div>
                        <p className="font-semibold text-2xl">
                            {questions.length > 0 ? ((score / questions.length) * 100).toFixed(2) : '0.00'}%
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-4 max-h-96 overflow-y-auto">
                            {questions.map((q, i) => {
                                const ans = answers.get(q.id);
                                const isCorrect = isAnswerCorrect(q, ans?.value);
                                const hasSolutionText = !!q.solutionExplanation?.trim();
                                const hasSolutionImages = normalizeExamImageUrls(q.explanationImageUrls, q.explanationImageUrl).length > 0;
                                const resultQuestionImages = getQuestionImageUrls(q);
                                const isResultQuestionVisible = revealedResultQuestionImageIds.has(q.id);
                                const isResultSolutionVisible = revealedResultSolutionQuestionIds.has(q.id);
                                return (
                                    <div key={q.id} className="flex items-start gap-2 p-2 border-b">
                                        {isCorrect ? <Check className="h-5 w-5 text-green-500 mt-1" /> : <XIcon className="h-5 w-5 text-red-500 mt-1" />}
                                        <div className="flex-1">
                                            <p className="font-medium">
                                                Q{i+1}: <MathText text={q.questionText} className="font-medium" />
                                            </p>
                                            <p className="text-sm">
                                                Your answer:{' '}
                                                <span className="font-semibold">
                                                    <MathText text={ans?.value || 'Not Answered'} />
                                                </span>
                                            </p>
                                            {!isCorrect && (
                                                <p className="text-sm">
                                                    Correct answer:{' '}
                                                    <span className="font-semibold text-green-600">
                                                        <MathText text={getCorrectAnswer(q)} />
                                                    </span>
                                                </p>
                                            )}
                                            <div className="mt-2 space-y-2">
                                                {resultQuestionImages.length > 0 || !isResultSolutionVisible ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {resultQuestionImages.length > 0 ? (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setRevealedResultQuestionImageIds((prev) => {
                                                                        const next = new Set(prev);
                                                                        if (next.has(q.id)) {
                                                                            next.delete(q.id);
                                                                        } else {
                                                                            next.add(q.id);
                                                                        }
                                                                        return next;
                                                                    });
                                                                }}
                                                            >
                                                                {isResultQuestionVisible ? 'Hide Question' : 'View Question'}
                                                            </Button>
                                                        ) : null}
                                                        {!isResultSolutionVisible ? (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setRevealedResultSolutionQuestionIds((prev) => {
                                                                        const next = new Set(prev);
                                                                        next.add(q.id);
                                                                        return next;
                                                                    });
                                                                }}
                                                            >
                                                                View Solution
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                                {isResultQuestionVisible ? (
                                                    <ExamImageGallery
                                                        sources={resultQuestionImages}
                                                        altPrefix="Result question image"
                                                    />
                                                ) : null}
                                                {isResultSolutionVisible ? (
                                                    <>
                                                        {hasSolutionText ? (
                                                            <p className="text-sm whitespace-pre-wrap">
                                                                <span className="font-semibold">Solution:</span>{' '}
                                                                <MathText text={q.solutionExplanation} className="text-sm" />
                                                            </p>
                                                        ) : null}
                                                        <ExamImageGallery
                                                            sources={[q.explanationImageUrls, q.explanationImageUrl]}
                                                            altPrefix="Result explanation image"
                                                        />
                                                        {!hasSolutionText && !hasSolutionImages ? (
                                                            <p className="text-sm text-muted-foreground">No explanation available for this question.</p>
                                                        ) : null}
                                                    </>
                                                ) : null}
                                            </div>
                                            <p className="text-sm text-muted-foreground">Time taken: {formatSeconds(ans?.timeTaken || 0)}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
                <Button onClick={() => router.push(practiceAgainHref)} className="mt-8">Practice Again</Button>
            </div>
        )
    }

    return (
        <>
            <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
                <div className="flex items-center gap-2"><Logo className="w-8 h-8 text-primary" /><span className="font-headline text-2xl font-semibold text-primary">DCAM Classes</span></div>
                <div><h1 className="font-headline text-xl font-semibold text-center">Practice Session</h1></div>
                <div className="w-48"></div>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 p-4">
                {/* Left Panel: Question Area */}
                <div className="flex flex-col gap-4">
                    <Card>
                      <CardHeader className="flex flex-row justify-between items-center">
                        <CardTitle>Question No. {currentQuestionIndex + 1}</CardTitle>
                        <div className="flex items-center gap-4">
                            {questionTimeLeft !== null && (
                                <div className={cn("flex items-center gap-2 font-mono text-lg font-semibold", questionTimeLeft <= 10 && "text-destructive")}>
                                    <Timer className="h-5 w-5" />
                                    <span title="Per-question time">{formatTime(questionTimeLeft)}</span>
                                </div>
                            )}
                        </div>
                      </CardHeader>
                      <CardContent className="prose max-w-none">
                          {shouldShowQuestionText ? <p><MathText text={currentQuestion.questionText} /></p> : null}
                          {questionImages.length > 0 && (
                              <ExamImageGallery
                                  sources={questionImages}
                                  altPrefix="Question image"
                                  listClassName="my-4"
                              />
                          )}
                      </CardContent>
                    </Card>
                    <Card className="flex-grow">
                        <CardContent className="p-6">
                            {currentQuestion.questionType === 'MCQ' ? (
                                <RadioGroup value={answers.get(currentQuestion.id)?.value as string || ''} onValueChange={handleAnswerChange} disabled={isAnswerLocked}>
                                    {currentQuestion.options?.map((option, index) => (
                                        <div key={index} className="flex items-center space-x-2 p-3 rounded-md hover:bg-muted">
                                            <RadioGroupItem value={option} id={`option-${index}`} />
                                            <Label htmlFor={`option-${index}`} className="flex-1 text-base">
                                                <MathText text={option} className="text-base" />
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            ) : currentQuestion.questionType === 'Numerical' ? (
                                <><Label htmlFor="numerical-answer" className="text-lg">Your Answer</Label><Input id="numerical-answer" type="number" className="mt-2 text-base" placeholder="Enter your numerical answer" value={answers.get(currentQuestion.id)?.value || ''} onChange={(e) => handleAnswerChange(e.target.value)} disabled={isAnswerLocked} /></>
                            ) : (
                                <><Label htmlFor="text-answer" className="text-lg">Your Answer</Label><Input id="text-answer" type="text" className="mt-2 text-base" placeholder="Enter your text answer" value={answers.get(currentQuestion.id)?.value || ''} onChange={(e) => handleAnswerChange(e.target.value)} disabled={isAnswerLocked} /></>
                            )}
                        </CardContent>
                    </Card>

                    {isTimedOut && !isSolutionVisible && (
                        <Button variant="outline" onClick={handleViewSolution}>View Solution</Button>
                    )}
                    <QuestionExplanation question={currentQuestion} userAnswer={answers.get(currentQuestion.id)} forceShow={isSolutionVisible} timedOut={isTimedOut} />

                    <div className="flex flex-wrap gap-2">
                        <Button onClick={handleSaveAndNext} disabled={isFinished}>Save & Next</Button>
                        <Button variant="secondary" onClick={handleMarkForReview} disabled={isAnswerLocked}>Mark for Review & Next</Button>
                        <Button variant="outline" onClick={handleClearResponse} disabled={isAnswerLocked}>Clear Response</Button>
                    </div>
                </div>
                {/* Right Panel: Info and Navigation */}
                <div className="flex flex-col gap-4">
                    <Card><CardContent className="p-4 flex items-center gap-4"><Avatar className="h-12 w-12"><AvatarImage src={user?.photoURL || undefined} /><AvatarFallback><User /></AvatarFallback></Avatar><div><p className="font-semibold">{user?.displayName}</p><p className="text-sm text-muted-foreground">JEE Main Aspirant</p></div></CardContent></Card>
                    <Card><CardHeader><CardTitle>Question Palette</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-green-500"/><span>Answered ({summary.answered + summary.answeredAndMarked})</span></div>
                                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-red-500"/><span>Not Answered ({summary.notAnswered})</span></div>
                                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-gray-200"/><span>Not Visited ({summary.notVisited})</span></div>
                                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-purple-500"/><span>Marked for Review ({summary.markedForReview + summary.answeredAndMarked})</span></div>
                            </div>
                            {sections.map(section => (
                                <div key={section.name} className="mb-4">
                                    <h4 className="font-semibold mb-2">{section.name}</h4>
                                    <div className="grid grid-cols-5 gap-2">
                                        {questions.filter(q => q.subject === section.name).map(q => {
                                            const originalIndex = questions.findIndex(origQ => origQ.id === q.id);
                                            return (
                                                <Button key={q.id} variant="outline" size="icon" className={cn('h-9 w-9', getStatusClasses(getQuestionStatus(q.id)), currentQuestion.id === q.id && 'ring-2 ring-primary ring-offset-2')} onClick={() => handleSelectQuestion(originalIndex)}>
                                                    {originalIndex + 1}
                                                </Button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <Button size="lg" className="w-full" onClick={() => setIsSubmitDialogOpen(true)} disabled={isFinished}>Submit Test</Button>
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
                            <AlertDialogAction onClick={handleSubmitTest}>Submit</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </>
    );
}


export default function PracticeSessionPage() {
    return (
      <Suspense fallback={
          <RouteTransitionFallback message="Setting up practice session" />
      }>
        <PracticeSession />
      </Suspense>
    );
  }

    
