'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import DashboardHeader from '@/components/dashboard-header';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, addDocumentNonBlocking, useUser, useDoc, useStorage } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useState, useMemo, useEffect, useRef } from 'react';
import { LoaderCircle, PlusCircle, Sparkles, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { notifyTeacherPublication } from '@/lib/client-notifications';
import { cn } from '@/lib/utils';
import { extractSubtopicPaths, normalizeSubtopicValue, splitSubtopicPath } from '@/lib/subtopic-paths';
import { getTeacherAuthoringRestrictionCopy, isAllowedTeacherAuthorEmail } from '@/lib/teacher-authoring';

type Question = {
  id: string;
  questionText: string;
  questionType?: 'MCQ' | 'Numerical' | 'Text';
  classId: string;
  subjectId: string;
  topicId: string;
  subtopics?: string[];
  accessLevel: 'free' | 'paid';
  mockTestOnly?: boolean;
  isPreviousYear?: boolean;
  previousYear?: string;
  examTypeId: string;
  difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  examLevel?: 'weak' | 'medium' | 'strong';
  alignments?: Array<{ examTypeId: string; classId: string; subjectId: string; difficultyLevel?: 'Easy' | 'Medium' | 'Hard' }>;
  teacherId?: string;
};
type Class = { id: string; name: string; examTypeId: string };
type Subject = { id: string; name: string; classId: string };
type Topic = { id: string; name: string; subjectId: string };
type ExamType = { id: string; name: string };
type TeachingAssignment = { classId: string; subjectIds?: string[]; allSubjects?: boolean };
type UserProfile = { teachingAssignments?: TeachingAssignment[] };
type AttemptLimitMode = 'unlimited' | 'total' | 'interval';
type AttemptIntervalUnit = 'day' | 'week' | 'month' | 'year';
const PREVIOUS_YEAR_PATTERN = /^(19|20)\d{2}$/;

const normalizePreviousYearValue = (value?: string) => {
  const year = String(value || '').trim();
  return PREVIOUS_YEAR_PATTERN.test(year) ? year : '';
};

const normalizePreviousYearList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => normalizePreviousYearValue(String(item || '')))
        .filter(Boolean)
    )
  ).sort((a, b) => Number(b) - Number(a));
};

const getPreviousYearKey = (years: string[]) => normalizePreviousYearList(years).join('|');

const normalizeSectionQuestionSource = (value?: string): 'all' | 'pyq' => (value === 'pyq' ? 'pyq' : 'all');

const normalizeSubtopicPathSegments = (segments: string[]) =>
  segments.map((segment) => String(segment || '').trim()).filter(Boolean);

const serializeSubtopicPathSelection = (segments: string[]) =>
  normalizeSubtopicPathSegments(segments).join(' > ');

const parseSubtopicPathSelection = (value?: string) =>
  normalizeSubtopicPathSegments(splitSubtopicPath(String(value || '')));

const getSubtopicPathKey = (segments: string[]) =>
  normalizeSubtopicPathSegments(segments).map((segment) => normalizeSubtopicValue(segment)).join('>');

const normalizeSubtopicPathSelections = (
  subtopicPaths?: string[],
  legacySubtopic?: string,
  legacyFurtherSubtopic?: string
) => {
  const unique = new Map<string, string>();

  (subtopicPaths || []).forEach((value) => {
    const segments = parseSubtopicPathSelection(value);
    if (!segments.length) return;
    const key = getSubtopicPathKey(segments);
    if (!key || unique.has(key)) return;
    unique.set(key, serializeSubtopicPathSelection(segments));
  });

  const legacySegments = normalizeSubtopicPathSegments(
    legacyFurtherSubtopic ? [legacySubtopic || '', legacyFurtherSubtopic] : [legacySubtopic || '']
  );
  if (legacySegments.length) {
    const key = getSubtopicPathKey(legacySegments);
    if (key && !unique.has(key)) unique.set(key, serializeSubtopicPathSelection(legacySegments));
  }

  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
};

const subtopicPathStartsWith = (path: string[], prefix: string[]) => {
  const normalizedPath = normalizeSubtopicPathSegments(path);
  const normalizedPrefix = normalizeSubtopicPathSegments(prefix);
  if (!normalizedPrefix.length) return true;
  if (normalizedPath.length < normalizedPrefix.length) return false;
  return normalizedPrefix.every((segment, index) => normalizeSubtopicValue(normalizedPath[index]) === normalizeSubtopicValue(segment));
};

const hasMatchingSubtopicPrefix = (pathPool: string[][], prefix: string[]) =>
  pathPool.some((path) => subtopicPathStartsWith(path, prefix));

const getChildSubtopicOptions = (pathPool: string[][], parentPath: string[]) => {
  const parentSegments = normalizeSubtopicPathSegments(parentPath);
  const options = new Map<string, string>();
  pathPool.forEach((path) => {
    const normalizedPath = normalizeSubtopicPathSegments(path);
    if (normalizedPath.length <= parentSegments.length) return;
    if (!subtopicPathStartsWith(normalizedPath, parentSegments)) return;
    const nextSegment = normalizedPath[parentSegments.length];
    const key = normalizeSubtopicValue(nextSegment);
    if (!key || options.has(key)) return;
    options.set(key, nextSegment);
  });
  return Array.from(options.values()).sort((a, b) => a.localeCompare(b));
};

const getSubtopicSelectionKey = (
  subtopicPaths?: string[],
  legacySubtopic?: string,
  legacyFurtherSubtopic?: string
) =>
  normalizeSubtopicPathSelections(subtopicPaths, legacySubtopic, legacyFurtherSubtopic)
    .map((value) => getSubtopicPathKey(parseSubtopicPathSelection(value)))
    .filter(Boolean)
    .sort()
    .join('|');

const matchesSelectedSubtopicPaths = (
  questionSubtopics: string[] | undefined,
  selectedSubtopicPaths?: string[],
  legacySubtopic?: string,
  legacyFurtherSubtopic?: string
) => {
  const normalizedSelections = normalizeSubtopicPathSelections(selectedSubtopicPaths, legacySubtopic, legacyFurtherSubtopic);
  if (normalizedSelections.length === 0) return true;
  const questionPaths = extractSubtopicPaths(questionSubtopics);
  if (questionPaths.length === 0) return false;
  const parsedSelections = normalizedSelections.map((value) => parseSubtopicPathSelection(value)).filter((segments) => segments.length > 0);
  if (parsedSelections.length === 0) return true;
  return parsedSelections.some((selectionPath) =>
    questionPaths.some((questionPath) => subtopicPathStartsWith(questionPath, selectionPath))
  );
};

const subjectConfigSchema = z.object({
  subjectId: z.string().min(1, 'Select a subject.'),
  subjectName: z.string(),
  topicId: z.string().optional().default(''),
  topicName: z.string().optional().default(''),
  subtopic: z.string().optional().default(''),
  furtherSubtopic: z.string().optional().default(''),
  subtopicPaths: z.array(z.string()).optional().default([]),
  questionSource: z.enum(['all', 'pyq']).default('all'),
  previousYears: z.array(z.string()).optional().default([]),
  questionAccessLevel: z.enum(['free', 'paid']),
  randomizePerAttempt: z.boolean().optional().default(false),
  questionType: z.enum(['All', 'MCQ', 'Numerical', 'Text']),
  difficultyLevel: z.enum(['All', 'Easy', 'Medium', 'Hard']),
  count: z.coerce.number().min(1, 'Must be > 0'),
});

const formSchema = z.object({
  title: z.string().min(5, 'Test title must be at least 5 characters long.'),
  accessLevel: z.enum(['free', 'paid']),
  duration: z.coerce.number().min(1, 'Duration must be at least 1 minute.'),
  marksPerQuestion: z.coerce.number().min(0, 'Marks cannot be negative.'),
  negativeMarksPerQuestion: z.coerce.number().min(0, 'Negative marks cannot be negative.'),
  questionSource: z.enum(['student_plus_official', 'teacher_official']),
  examTypeId: z.string().min(1, 'Select an exam.'),
  classId: z.string().min(1, 'Select a curriculum/class.'),
  examLevel: z.enum(['weak', 'medium', 'strong']),
  mockTestDescription: z.string(),
  mockTestOutcomes: z.string(),
  mockTestYoutubeUrl: z.string(),
  attemptRules: z.string(),
  attemptGuidance: z.string(),
  attemptLimitMode: z.enum(['unlimited', 'total', 'interval']),
  maxTotalAttempts: z.coerce.number().int().min(1),
  maxAttemptsPerInterval: z.coerce.number().int().min(1),
  attemptIntervalValue: z.coerce.number().int().min(1),
  attemptIntervalUnit: z.enum(['day', 'week', 'month', 'year']),
  showLeaderboard: z.boolean().optional().default(false),
  subjectConfigs: z.array(subjectConfigSchema).min(1, 'Please configure at least one subject.'),
}).superRefine((values, ctx) => {
  const seen = new Set<string>();
  values.subjectConfigs.forEach((item, index) => {
    const key = `${item.subjectId}__${item.topicId || ''}__${getSubtopicSelectionKey(item.subtopicPaths, item.subtopic, item.furtherSubtopic)}__${item.questionType}__${item.difficultyLevel}__${item.questionAccessLevel}__${item.questionSource || 'all'}__${getPreviousYearKey(item.previousYears || [])}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate section selected with same filters (including PYQ years).',
        path: ['subjectConfigs', index, 'difficultyLevel'],
      });
    }
    seen.add(key);
  });
  if (values.attemptLimitMode === 'total' && values.maxTotalAttempts < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Total attempts must be at least 1.',
      path: ['maxTotalAttempts'],
    });
  }
  if (values.attemptLimitMode === 'interval') {
    if (values.maxAttemptsPerInterval < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Attempts per interval must be at least 1.',
        path: ['maxAttemptsPerInterval'],
      });
    }
    if (values.attemptIntervalValue < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Interval value must be at least 1.',
        path: ['attemptIntervalValue'],
      });
    }
  }
});

export default function CreateCustomTestPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSubscriptionTestId, setPendingSubscriptionTestId] = useState<string | null>(null);
  const [pendingSubscriptionTestTitle, setPendingSubscriptionTestTitle] = useState<string>('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [subtopicDraftPathBySection, setSubtopicDraftPathBySection] = useState<Record<string, string[]>>({});
  const { isTeacher } = useIsTeacher();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const canManageTeacherAuthoring = isAdmin || isAllowedTeacherAuthorEmail(user?.email);
  const isTeacherAuthoringRestricted = isTeacher && !isAdminLoading && !canManageTeacherAuthoring;
  const courseIdForInCourseTest = (searchParams.get('courseId') || '').trim();
  const insertAfterModuleIndexRaw = Number(searchParams.get('afterModuleIndex'));
  const isInCourseContext = isTeacher && courseIdForInCourseTest.length > 0 && Number.isInteger(insertAfterModuleIndexRaw);
  const liveBatchIdForScheduledTest = (searchParams.get('liveBatchId') || '').trim();
  const scheduledDateForLiveBatchTest = (searchParams.get('scheduledDate') || '').trim();
  const isLiveBatchScheduledContext =
    isTeacher &&
    liveBatchIdForScheduledTest.length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(scheduledDateForLiveBatchTest);

  useEffect(() => {
    if (!isTeacherAuthoringRestricted) return;
    router.replace('/dashboard');
  }, [isTeacherAuthoringRestricted, router]);

  const classesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null, [firestore]);
  const subjectsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null, [firestore]);
  const questionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'practice_questions')) : null, [firestore]);
  const examTypesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null, [firestore]);
  const topicsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'topics'), orderBy('name')) : null, [firestore]);
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);

  const { data: classes, isLoading: areClassesLoading } = useCollection<Class>(classesQuery);
  const { data: subjects, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: allQuestions, isLoading: areQuestionsLoading } = useCollection<Question>(questionsQuery);
  const { data: examTypes, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: topics, isLoading: areTopicsLoading } = useCollection<Topic>(topicsQuery);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const teachingAssignments = userProfile?.teachingAssignments || [];
  const allowedClassIds = Array.from(new Set(teachingAssignments.map((assignment) => assignment.classId).filter(Boolean)));
  const allowedSubjectIds = Array.from(new Set(teachingAssignments.flatMap((assignment) => assignment.subjectIds || []).filter(Boolean)));

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      accessLevel: 'free',
      duration: 60,
      marksPerQuestion: 4,
      negativeMarksPerQuestion: 1,
      questionSource: 'student_plus_official',
      examTypeId: '',
      classId: '',
      examLevel: 'medium',
      mockTestDescription: '',
      mockTestOutcomes: '',
      mockTestYoutubeUrl: '',
      attemptRules: '',
      attemptGuidance: '',
      attemptLimitMode: 'unlimited',
      maxTotalAttempts: 1,
      maxAttemptsPerInterval: 1,
      attemptIntervalValue: 1,
      attemptIntervalUnit: 'week',
      showLeaderboard: false,
      subjectConfigs: [{ subjectId: '', subjectName: '', topicId: '', topicName: '', subtopic: '', furtherSubtopic: '', subtopicPaths: [], questionSource: 'all', previousYears: [], questionAccessLevel: 'free', randomizePerAttempt: false, questionType: 'All', difficultyLevel: 'Easy' as const, count: 10 }],
    },
  });

  const { control, watch, setValue, getValues } = form;
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'subjectConfigs',
  });
  const prevExamTypeRef = useRef<string>('');
  const prevClassRef = useRef<string>('');

  const selectedExamType = watch('examTypeId');
  const selectedClass = watch('classId');
  const sectionModeEnabled = true;
  const selectedAccessLevel = watch('accessLevel');
  const questionSourceFilter = watch('questionSource');
  const attemptLimitMode = watch('attemptLimitMode');
  const watchedSubjectConfigs = watch('subjectConfigs');
  const marksPerQuestion = Number(watch('marksPerQuestion') || 0);
  const totalRequestedQuestions = watchedSubjectConfigs.reduce((acc, curr) => acc + (Number(curr.count) || 0), 0);
  const totalMarks = totalRequestedQuestions * marksPerQuestion;

  useEffect(() => {
    const emptyConfig = { subjectId: '', subjectName: '', topicId: '', topicName: '', subtopic: '', furtherSubtopic: '', subtopicPaths: [] as string[], questionSource: 'all' as const, previousYears: [] as string[], questionAccessLevel: getValues('accessLevel') as 'free' | 'paid', randomizePerAttempt: false, questionType: 'All' as const, difficultyLevel: 'Easy' as const, count: 10 };
    const currentConfigs = getValues('subjectConfigs') || [];

    if (selectedExamType !== prevExamTypeRef.current) {
      prevExamTypeRef.current = selectedExamType;
      if (getValues('classId')) {
        setValue('classId', '');
      }
      if (currentConfigs.length > 0) {
        replace([emptyConfig]);
        return;
      }
    }

    if (selectedClass !== prevClassRef.current) {
      prevClassRef.current = selectedClass;
      if (currentConfigs.length > 0) {
        replace([emptyConfig]);
        return;
      }
    }

    if (currentConfigs.length === 0) {
      append(emptyConfig);
    }
  }, [selectedExamType, selectedClass, sectionModeEnabled, append, replace, setValue, getValues]);

  const filteredClasses = useMemo(() => {
    if (!classes || !selectedExamType) return [];
    const examScoped = classes.filter((c) => c.examTypeId === selectedExamType);
    if (!isTeacher) return examScoped;
    return examScoped.filter((c) => allowedClassIds.includes(c.id));
  }, [classes, selectedExamType, isTeacher, allowedClassIds]);

  const filteredSubjects = useMemo(() => {
    if (!subjects || !selectedClass) return [];
    const classScoped = subjects.filter((s) => s.classId === selectedClass);
    if (!isTeacher) return classScoped;
    const assignment = teachingAssignments.find((a) => a.classId === selectedClass);
    if (!assignment) return [];
    if (assignment.allSubjects) return classScoped;
    return classScoped.filter((s) => (assignment.subjectIds || []).includes(s.id));
  }, [subjects, selectedClass, isTeacher, teachingAssignments]);

  const teacherScopedExamTypes = useMemo(() => {
    if (!isTeacher) return examTypes || [];
    const assignedExamTypeIds = new Set(
      (classes || [])
        .filter((c) => allowedClassIds.includes(c.id))
        .map((c) => c.examTypeId)
    );
    return (examTypes || []).filter((et) => assignedExamTypeIds.has(et.id));
  }, [isTeacher, examTypes, classes, allowedClassIds]);

  const matchesExamClass = (q: Question, examTypeId?: string, classId?: string) => {
    const directMatch = (!examTypeId || q.examTypeId === examTypeId) && (!classId || q.classId === classId);
    if (directMatch) return true;
    return (q.alignments || []).some((a) => (!examTypeId || a.examTypeId === examTypeId) && (!classId || a.classId === classId));
  };

  const matchesSubjectInContext = (q: Question, subjectId: string, examTypeId?: string, classId?: string) => {
    const direct = q.subjectId === subjectId && matchesExamClass(q, examTypeId, classId);
    if (direct) return true;
    return (q.alignments || []).some((a) =>
      a.subjectId === subjectId
      && (!examTypeId || a.examTypeId === examTypeId)
      && (!classId || a.classId === classId)
    );
  };

  const matchesTopic = (q: Question, topicId?: string) => {
    if (!topicId) return true;
    return q.topicId === topicId;
  };

  const matchesSubtopicPath = (
    q: Question,
    subtopicPaths?: string[],
    subtopic?: string,
    furtherSubtopic?: string
  ) => {
    return matchesSelectedSubtopicPaths(q.subtopics, subtopicPaths, subtopic, furtherSubtopic);
  };

  const matchesQuestionSource = (q: Question, source: 'student_plus_official' | 'teacher_official') => {
    const isTeacherOfficialQuestion = !!q.mockTestOnly;
    if (source === 'teacher_official') return isTeacherOfficialQuestion;
    return !isTeacherOfficialQuestion;
  };

  const matchesDifficultyInContext = (q: Question, difficulty: 'Easy' | 'Medium' | 'Hard' | 'All', examTypeId?: string, classId?: string) => true;

  const matchesQuestionType = (q: Question, questionType: 'All' | 'MCQ' | 'Numerical' | 'Text') => {
    if (questionType === 'All') return true;
    return (q.questionType || 'MCQ') === questionType;
  };

  const matchesPreviousYearFilter = (
    q: Question,
    questionSource: 'all' | 'pyq' = 'all',
    previousYears: string[] = []
  ) => {
    if (questionSource !== 'pyq') return true;
    const year = normalizePreviousYearValue(q.previousYear);
    if (!q.isPreviousYear || !year) return false;
    const selectedYears = normalizePreviousYearList(previousYears);
    if (selectedYears.length === 0) return true;
    return selectedYears.includes(year);
  };

  const availableQuestions = useMemo(() => {
    return (allQuestions || []).filter((q) => {
      if (!matchesQuestionSource(q, questionSourceFilter)) return false;
      if (!matchesExamClass(q, selectedExamType || undefined, selectedClass || undefined)) return false;
      if (isTeacher && user?.uid && q.teacherId !== user.uid) return false;
      if (isTeacher && allowedClassIds.length > 0) {
        const questionClassIds = [q.classId, ...(q.alignments || []).map((a) => a.classId)];
        if (!questionClassIds.some((id) => allowedClassIds.includes(id))) return false;
      }
      if (isTeacher && allowedSubjectIds.length > 0) {
        const questionSubjectIds = [q.subjectId, ...(q.alignments || []).map((a) => a.subjectId)];
        if (!questionSubjectIds.some((id) => allowedSubjectIds.includes(id))) return false;
      }
      return true;
    });
  }, [allQuestions, questionSourceFilter, selectedExamType, selectedClass, isTeacher, user, allowedClassIds, allowedSubjectIds]);

  const getAvailableCountForConfig = (
    subjectId?: string,
    topicId?: string,
    subtopicPaths?: string[],
    subtopic?: string,
    furtherSubtopic?: string,
    questionAccessLevel: 'free' | 'paid' = 'free',
    questionType: 'All' | 'MCQ' | 'Numerical' | 'Text' = 'All',
    difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard' = 'All',
    sectionQuestionSource: 'all' | 'pyq' = 'all',
    previousYears: string[] = []
  ) => {
    if (!subjectId) return 0;
    return availableQuestions.filter((q) =>
      q.accessLevel === questionAccessLevel
      &&
      matchesSubjectInContext(q, subjectId, selectedExamType || undefined, selectedClass || undefined)
      && matchesTopic(q, topicId)
      && matchesSubtopicPath(q, subtopicPaths, subtopic, furtherSubtopic)
      && matchesQuestionType(q, questionType)
      && matchesDifficultyInContext(q, difficultyLevel, selectedExamType || undefined, selectedClass || undefined)
      && matchesPreviousYearFilter(q, sectionQuestionSource, previousYears)
    ).length;
  };

  const getAvailablePyqYearsForConfig = (
    subjectId?: string,
    topicId?: string,
    subtopicPaths?: string[],
    subtopic?: string,
    furtherSubtopic?: string,
    questionAccessLevel: 'free' | 'paid' = 'free',
    questionType: 'All' | 'MCQ' | 'Numerical' | 'Text' = 'All',
    difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard' = 'All'
  ) => {
    if (!subjectId) return [];
    const years = availableQuestions
      .filter((q) =>
        q.accessLevel === questionAccessLevel
        && matchesSubjectInContext(q, subjectId, selectedExamType || undefined, selectedClass || undefined)
        && matchesTopic(q, topicId)
        && matchesSubtopicPath(q, subtopicPaths, subtopic, furtherSubtopic)
        && matchesQuestionType(q, questionType)
        && matchesDifficultyInContext(q, difficultyLevel, selectedExamType || undefined, selectedClass || undefined)
        && !!q.isPreviousYear
      )
      .map((q) => normalizePreviousYearValue(q.previousYear))
      .filter(Boolean);
    return Array.from(new Set(years)).sort((a, b) => Number(b) - Number(a));
  };

  useEffect(() => {
    if (!watchedSubjectConfigs || watchedSubjectConfigs.length === 0) return;
    let hasChanges = false;
    const nextConfigs = watchedSubjectConfigs.map((cfg) => {
      if (!cfg.subjectId) return cfg;
      const normalizedSource = normalizeSectionQuestionSource(cfg.questionSource);
      const normalizedSubtopicPaths = normalizeSubtopicPathSelections(cfg.subtopicPaths, cfg.subtopic, cfg.furtherSubtopic);
      const pathPoolForTopic = availableQuestions
        .filter((q) =>
          q.accessLevel === cfg.questionAccessLevel
          && matchesSubjectInContext(q, cfg.subjectId, selectedExamType || undefined, selectedClass || undefined)
          && matchesTopic(q, cfg.topicId)
        )
        .flatMap((q) => extractSubtopicPaths(q.subtopics));
      const sanitizedSubtopicPaths = cfg.topicId
        ? normalizedSubtopicPaths.filter((value) => hasMatchingSubtopicPrefix(pathPoolForTopic, parseSubtopicPathSelection(value)))
        : [];
      const firstLegacyPath = parseSubtopicPathSelection(sanitizedSubtopicPaths[0] || '');
      const nextLegacySubtopic = firstLegacyPath[0] || '';
      const nextLegacyFurtherSubtopic = firstLegacyPath[1] || '';

      const availablePyqYears = getAvailablePyqYearsForConfig(
        cfg.subjectId,
        cfg.topicId,
        sanitizedSubtopicPaths,
        nextLegacySubtopic,
        nextLegacyFurtherSubtopic,
        cfg.questionAccessLevel,
        cfg.questionType,
        cfg.difficultyLevel
      );
      const normalizedSelectedYears = normalizePreviousYearList(cfg.previousYears || []);
      const sanitizedYears = normalizedSource === 'pyq'
        ? normalizedSelectedYears.filter((year) => availablePyqYears.includes(year))
        : [];
      const nextBase = {
        ...cfg,
        subtopicPaths: sanitizedSubtopicPaths,
        subtopic: nextLegacySubtopic,
        furtherSubtopic: nextLegacyFurtherSubtopic,
        questionSource: normalizedSource,
        previousYears: sanitizedYears,
      };
      if (
        normalizedSource !== cfg.questionSource
        || getPreviousYearKey(normalizedSelectedYears) !== getPreviousYearKey(sanitizedYears)
        || getSubtopicSelectionKey(cfg.subtopicPaths, cfg.subtopic, cfg.furtherSubtopic) !== getSubtopicSelectionKey(sanitizedSubtopicPaths, nextLegacySubtopic, nextLegacyFurtherSubtopic)
      ) {
        hasChanges = true;
      }
      const availableCount = getAvailableCountForConfig(
        cfg.subjectId,
        cfg.topicId,
        sanitizedSubtopicPaths,
        nextLegacySubtopic,
        nextLegacyFurtherSubtopic,
        cfg.questionAccessLevel,
        cfg.questionType,
        cfg.difficultyLevel,
        normalizedSource,
        sanitizedYears
      );
      const requestedCount = Number(cfg.count || 0);
      if (Number.isFinite(requestedCount) && requestedCount > availableCount && availableCount > 0) {
        hasChanges = true;
        return { ...nextBase, count: availableCount };
      }
      return nextBase;
    });
    if (hasChanges) {
      replace(nextConfigs);
    }
  }, [watchedSubjectConfigs, availableQuestions, selectedExamType, selectedClass, replace]);

  const handleThumbnailChange = (file?: File) => {
    if (!file) {
      setThumbnailFile(null);
      return;
    }
    const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
    if (!isJpeg) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Only JPEG/JPG thumbnail files are allowed.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Please upload a thumbnail smaller than 5MB.' });
      return;
    }
    setThumbnailFile(file);
  };

  async function onSubmit(values: z.infer<typeof formSchema>, saveAsDraft: boolean = false) {
    if (!user) return;
    if (isTeacherAuthoringRestricted) {
      toast({
        variant: 'destructive',
        title: 'Mock test creation disabled',
        description: getTeacherAuthoringRestrictionCopy(),
      });
      return;
    }
    if (isTeacher && allowedClassIds.length > 0 && !allowedClassIds.includes(values.classId)) {
      toast({ variant: 'destructive', title: 'Invalid Curriculum', description: 'You can only create tests for your assigned curricula.' });
      return;
    }

    setIsSubmitting(true);

    const finalQuestionIds: string[] = [];
    const usedQuestionIds = new Set<string>();
    let selectionError = false;
    const prioritizedConfigs = [...values.subjectConfigs].sort((a, b) => {
      const specificity = (cfg: (typeof values.subjectConfigs)[number]) =>
        (normalizeSubtopicPathSelections(cfg.subtopicPaths, cfg.subtopic, cfg.furtherSubtopic).length > 0 ? 1 : 0)
        + Math.min(
          3,
          Math.max(
            0,
            ...normalizeSubtopicPathSelections(cfg.subtopicPaths, cfg.subtopic, cfg.furtherSubtopic)
              .map((value) => parseSubtopicPathSelection(value).length)
          )
        )
        + (cfg.questionType === 'All' ? 0 : 1)
        + (cfg.difficultyLevel === 'All' ? 0 : 1)
        + (normalizeSectionQuestionSource(cfg.questionSource) === 'pyq' ? 1 : 0)
        + (normalizePreviousYearList(cfg.previousYears || []).length > 0 ? 1 : 0);
      return specificity(b) - specificity(a);
    });

    for (const config of prioritizedConfigs) {
      const normalizedConfigSubtopicPaths = normalizeSubtopicPathSelections(config.subtopicPaths, config.subtopic, config.furtherSubtopic);
      const firstLegacyPath = parseSubtopicPathSelection(normalizedConfigSubtopicPaths[0] || '');
      const legacySubtopic = firstLegacyPath[0] || '';
      const legacyFurtherSubtopic = firstLegacyPath[1] || '';
      const subjectQuestions = availableQuestions.filter((q) =>
        q.accessLevel === config.questionAccessLevel
        &&
        matchesSubjectInContext(q, config.subjectId, values.examTypeId, values.classId)
        && matchesTopic(q, config.topicId)
        && matchesSubtopicPath(q, normalizedConfigSubtopicPaths, legacySubtopic, legacyFurtherSubtopic)
        && matchesQuestionType(q, config.questionType)
        && matchesDifficultyInContext(q, config.difficultyLevel, values.examTypeId, values.classId)
        && matchesPreviousYearFilter(q, normalizeSectionQuestionSource(config.questionSource), normalizePreviousYearList(config.previousYears || []))
        && !usedQuestionIds.has(q.id)
      );
      if (subjectQuestions.length < config.count) {
        const sectionSource = normalizeSectionQuestionSource(config.questionSource);
        const pyqLabel = sectionSource === 'pyq'
          ? ` / PYQ ${normalizePreviousYearList(config.previousYears || []).join(', ') || 'All Years'}`
          : '';
        toast({
          variant: 'destructive',
          title: 'Not Enough Questions',
          description: `Subject "${config.subjectName}" (${config.questionAccessLevel}, ${config.questionType}, ${config.difficultyLevel}${pyqLabel}) has ${subjectQuestions.length} available questions, requested ${config.count}.`,
        });
        selectionError = true;
        break;
      }
      const shuffled = [...subjectQuestions].sort(() => 0.5 - Math.random());
      const selectedIds = shuffled.slice(0, config.count).map((q) => q.id);
      selectedIds.forEach((id) => usedQuestionIds.add(id));
      finalQuestionIds.push(...selectedIds);
    }

    if (selectionError || finalQuestionIds.length === 0) {
      setIsSubmitting(false);
      return;
    }

    if (liveBatchIdForScheduledTest && !isLiveBatchScheduledContext) {
      toast({
        variant: 'destructive',
        title: 'Invalid Scheduled Date',
        description: 'Please provide a valid test date in YYYY-MM-DD format for live-batch scheduled tests.',
      });
      setIsSubmitting(false);
      return;
    }

    const shouldSaveAsDraft = saveAsDraft || (values.accessLevel === 'paid' && !isLiveBatchScheduledContext);
    const isSubscriptionAttached = values.accessLevel === 'free' || isLiveBatchScheduledContext;
    const startTimeValue = isLiveBatchScheduledContext
      ? new Date(`${scheduledDateForLiveBatchTest}T00:00:00`)
      : serverTimestamp();
    const attemptLimit = {
      mode: values.attemptLimitMode as AttemptLimitMode,
      maxTotalAttempts: values.attemptLimitMode === 'total' ? Number(values.maxTotalAttempts) : null,
      maxAttemptsPerInterval: values.attemptLimitMode === 'interval' ? Number(values.maxAttemptsPerInterval) : null,
      intervalValue: values.attemptLimitMode === 'interval' ? Number(values.attemptIntervalValue) : null,
      intervalUnit: values.attemptLimitMode === 'interval' ? (values.attemptIntervalUnit as AttemptIntervalUnit) : null,
    };
    const mapStoredSubjectConfigs = (
      configs: Array<z.infer<typeof subjectConfigSchema>>
    ) => configs.map(({ subjectId, topicId, subtopic, furtherSubtopic, subtopicPaths, questionSource, previousYears, questionAccessLevel, questionType, difficultyLevel, randomizePerAttempt, count }) => {
      const normalizedPaths = normalizeSubtopicPathSelections(subtopicPaths, subtopic, furtherSubtopic);
      const firstPath = parseSubtopicPathSelection(normalizedPaths[0] || '');
      return {
        subjectId,
        topicId: topicId || '',
        subtopic: firstPath[0] || '',
        furtherSubtopic: firstPath[1] || '',
        subtopicPaths: normalizedPaths,
        questionSource: normalizeSectionQuestionSource(questionSource),
        previousYearMode: normalizeSectionQuestionSource(questionSource),
        previousYears: normalizePreviousYearList(previousYears || []),
        questionAccessLevel,
        questionType,
        difficultyLevel,
        randomizePerAttempt: !!randomizePerAttempt,
        numQuestions: count,
      };
    });

    try {
      let thumbnailUrl = '';
      let createdMockTestId = '';
      if (thumbnailFile) {
        const safeName = thumbnailFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uploadRef = ref(storage, `course_thumbnails/${user.uid}/mock_tests/${Date.now()}_${safeName}`);
        const uploaded = await uploadBytes(uploadRef, thumbnailFile, { contentType: thumbnailFile.type });
        thumbnailUrl = await getDownloadURL(uploaded.ref);
      }

      if (isInCourseContext) {
        const testRef = doc(collection(firestore, 'mock_tests'));
        createdMockTestId = testRef.id;
        await setDocumentNonBlocking(testRef, {
          id: testRef.id,
          teacherId: user.uid,
          title: values.title,
          accessLevel: values.accessLevel,
          questionSource: values.questionSource,
          publicationStatus: shouldSaveAsDraft ? 'draft' : 'published',
          subscriptionAttached: isSubscriptionAttached,
          startTime: startTimeValue,
          examTypeId: values.examTypeId,
          classId: values.classId,
          examLevel: values.examLevel,
          thumbnailUrl,
          imageUrl: thumbnailUrl,
          mockTestDescription: values.mockTestDescription.trim(),
          mockTestOutcomes: values.mockTestOutcomes.trim(),
          mockTestYoutubeUrl: values.mockTestYoutubeUrl.trim(),
          attemptRules: values.attemptRules.trim(),
          attemptGuidance: values.attemptGuidance.trim(),
          attemptLimit,
          showLeaderboard: isTeacher ? !!values.showLeaderboard : false,
          isCourseOnly: true,
          courseId: courseIdForInCourseTest,
          insertAfterModuleIndex: insertAfterModuleIndexRaw,
          config: {
            questionIds: finalQuestionIds,
            duration: values.duration,
            totalQuestions: totalRequestedQuestions,
            marksPerQuestion: values.marksPerQuestion,
            negativeMarksPerQuestion: values.negativeMarksPerQuestion,
            totalMarks,
            subjectConfigs: mapStoredSubjectConfigs(values.subjectConfigs),
          },
          createdAt: serverTimestamp(),
        }, { merge: true });
        if (values.accessLevel === 'paid' && !isLiveBatchScheduledContext) {
          setPendingSubscriptionTestId(testRef.id);
          setPendingSubscriptionTestTitle(values.title);
          toast({
            title: 'Paid test saved as draft',
            description: 'Attach a subscription plan to publish this test.',
          });
          return;
        }
      } else if (isTeacher) {
        const testRef = doc(collection(firestore, 'mock_tests'));
        createdMockTestId = testRef.id;
        await setDocumentNonBlocking(testRef, {
          id: testRef.id,
          teacherId: user.uid,
          title: values.title,
          accessLevel: values.accessLevel,
          questionSource: values.questionSource,
          publicationStatus: shouldSaveAsDraft ? 'draft' : 'published',
          subscriptionAttached: isSubscriptionAttached,
          startTime: startTimeValue,
          examTypeId: values.examTypeId,
          classId: values.classId,
          examLevel: values.examLevel,
          thumbnailUrl,
          imageUrl: thumbnailUrl,
          mockTestDescription: values.mockTestDescription.trim(),
          mockTestOutcomes: values.mockTestOutcomes.trim(),
          mockTestYoutubeUrl: values.mockTestYoutubeUrl.trim(),
          attemptRules: values.attemptRules.trim(),
          attemptGuidance: values.attemptGuidance.trim(),
          attemptLimit,
          showLeaderboard: isTeacher ? !!values.showLeaderboard : false,
          isCourseOnly: false,
          ...(isLiveBatchScheduledContext
            ? {
                isLiveBatchTest: true,
                liveBatchId: liveBatchIdForScheduledTest,
                scheduledDate: scheduledDateForLiveBatchTest,
              }
            : {}),
          config: {
            questionIds: finalQuestionIds,
            duration: values.duration,
            totalQuestions: totalRequestedQuestions,
            marksPerQuestion: values.marksPerQuestion,
            negativeMarksPerQuestion: values.negativeMarksPerQuestion,
            totalMarks,
            subjectConfigs: mapStoredSubjectConfigs(values.subjectConfigs),
          },
          createdAt: serverTimestamp(),
        }, { merge: true });
        if (values.accessLevel === 'paid' && !isLiveBatchScheduledContext) {
          setPendingSubscriptionTestId(testRef.id);
          setPendingSubscriptionTestTitle(values.title);
          toast({
            title: 'Paid test saved as draft',
            description: 'Attach a subscription plan to publish this test.',
          });
          return;
        }
      } else {
        const customTestsRef = collection(firestore, 'users', user.uid, 'custom_tests');
        await addDocumentNonBlocking(customTestsRef, {
          studentId: user.uid,
          createdByTeacher: isTeacher,
          title: values.title,
          accessLevel: values.accessLevel,
          questionSource: values.questionSource,
          examTypeId: values.examTypeId,
          classId: values.classId,
          examLevel: values.examLevel,
          thumbnailUrl,
          imageUrl: thumbnailUrl,
          mockTestDescription: values.mockTestDescription.trim(),
          mockTestOutcomes: values.mockTestOutcomes.trim(),
          mockTestYoutubeUrl: values.mockTestYoutubeUrl.trim(),
          attemptRules: values.attemptRules.trim(),
          attemptGuidance: values.attemptGuidance.trim(),
          attemptLimit,
          showLeaderboard: false,
          config: {
            questionIds: finalQuestionIds,
            duration: values.duration,
            totalQuestions: totalRequestedQuestions,
            marksPerQuestion: values.marksPerQuestion,
            negativeMarksPerQuestion: values.negativeMarksPerQuestion,
            totalMarks,
            subjectConfigs: mapStoredSubjectConfigs(values.subjectConfigs),
          },
          createdAt: serverTimestamp(),
        });
      }

      toast({
        title: shouldSaveAsDraft ? 'Mock Test Saved as Draft' : 'Mock Test Created',
        description: shouldSaveAsDraft
          ? `${values.title} is saved in draft.`
          : `${values.title} saved with ${totalRequestedQuestions} questions and ${totalMarks} total marks.`,
      });
      if (isTeacher && !isInCourseContext && !isLiveBatchScheduledContext && values.accessLevel !== 'paid' && !shouldSaveAsDraft && createdMockTestId) {
        await notifyTeacherPublication(user, {
          contentType: 'mock_test',
          contentId: createdMockTestId,
        });
      }
      if (isLiveBatchScheduledContext) {
        router.push(`/live-batches/schedule/${liveBatchIdForScheduledTest}`);
      } else {
        router.push(isInCourseContext ? `/courses/${courseIdForInCourseTest}` : '/mock-tests');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLoading = isAdminLoading || areClassesLoading || areSubjectsLoading || areQuestionsLoading || areExamTypesLoading || areTopicsLoading;
  const stepCardClass = 'space-y-4 rounded-2xl border border-slate-400/30 bg-gradient-to-br from-slate-900/70 via-slate-900/55 to-slate-950/45 p-5 shadow-[0_20px_55px_-38px_rgba(14,165,233,0.45)]';
  const builderInputClass = 'h-11 rounded-xl border-slate-400/35 bg-slate-800/55 text-slate-100 placeholder:text-slate-300/70 focus-visible:ring-cyan-400/45';
  const builderSelectClass = 'h-11 rounded-xl border-slate-400/35 bg-slate-800/55 text-slate-100 focus:ring-cyan-400/45';
  const builderTextareaClass = 'min-h-[120px] rounded-xl border-slate-400/35 bg-slate-800/55 text-slate-100 placeholder:text-slate-300/70 focus-visible:ring-cyan-400/45';

  if (isTeacherAuthoringRestricted) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Create Mock Test" />
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
      <DashboardHeader title="Create Mock Test" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <Card className="overflow-hidden border-slate-400/35 bg-gradient-to-br from-slate-900/88 via-slate-900/76 to-cyan-950/24 shadow-[0_30px_80px_-50px_rgba(14,165,233,0.55)]">
            <CardHeader className="border-b border-slate-400/25 bg-gradient-to-r from-slate-900/70 via-blue-950/25 to-slate-900/60">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Teacher Test Studio
                  </div>
                  <CardTitle className="mt-3 font-headline text-3xl text-white">Mock Test Builder</CardTitle>
                  <CardDescription className="mt-2 max-w-3xl text-base text-slate-200/85">
                    Build premium tests with precise control over question source, topic depth, PYQ filters, and attempt policy. Designed to be fast, clear, and conversion-ready for teachers.
                  </CardDescription>
                </div>
                <div className="rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-4 py-3 text-xs text-cyan-100">
                  <p className="font-semibold">Workflow</p>
                  <p className="mt-1">Details | Filters | Sections | Publish</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                <Badge variant="outline" className="justify-center rounded-full border-cyan-300/35 bg-cyan-500/10 py-1.5 text-cyan-100">1. Test Details</Badge>
                <Badge variant="outline" className="justify-center rounded-full border-cyan-300/35 bg-cyan-500/10 py-1.5 text-cyan-100">2. Exam & Scope</Badge>
                <Badge variant="outline" className="justify-center rounded-full border-cyan-300/35 bg-cyan-500/10 py-1.5 text-cyan-100">3. Section Rules</Badge>
                <Badge variant="outline" className="justify-center rounded-full border-cyan-300/35 bg-cyan-500/10 py-1.5 text-cyan-100">4. Launch Setup</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((values) => onSubmit(values, false))} className="space-y-8">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-xl border border-slate-500/30 bg-slate-900/55 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.13em] text-slate-400">Exam</p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-100">{teacherScopedExamTypes.find((exam) => exam.id === selectedExamType)?.name || 'Not selected'}</p>
                      </div>
                      <div className="rounded-xl border border-slate-500/30 bg-slate-900/55 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.13em] text-slate-400">Curriculum</p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-100">{filteredClasses.find((item) => item.id === selectedClass)?.name || 'Not selected'}</p>
                      </div>
                      <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.13em] text-cyan-200">Sections</p>
                        <p className="mt-1 text-sm font-semibold text-cyan-100">{fields.length} configured</p>
                      </div>
                      <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.13em] text-cyan-200">Questions</p>
                        <p className="mt-1 text-sm font-semibold text-cyan-100">{totalRequestedQuestions} requested</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                        <p className="font-semibold">Smart sequencing</p>
                        <p className="mt-1 text-emerald-100/85">Fill top to bottom: exam context first, then section filters, then launch details.</p>
                      </div>
                      <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                        <p className="font-semibold">Duplicate-safe sections</p>
                        <p className="mt-1 text-cyan-100/85">The builder blocks duplicate section combinations automatically.</p>
                      </div>
                      <div className="rounded-xl border border-violet-300/25 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
                        <p className="font-semibold">Topic-depth control</p>
                        <p className="mt-1 text-violet-100/85">Target complete topic, selected branch, or PYQ years with precision.</p>
                      </div>
                    </div>

                    <div className={stepCardClass}>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-200">Step 1</p>
                        <h3 className="mt-1 text-xl font-semibold text-slate-100">Test Details</h3>
                        <p className="mt-1 text-sm text-slate-300/80">Set the identity, access mode, and scoring model for this mock test.</p>
                      </div>
                      {isInCourseContext ? (
                        <div className="rounded-xl border border-cyan-300/35 bg-cyan-500/10 p-3 text-sm text-cyan-100">
                          This test will be added inside the selected course flow and will not appear on the main mock tests page.
                        </div>
                      ) : null}
                      {isLiveBatchScheduledContext ? (
                        <div className="rounded-xl border border-emerald-300/35 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                          This test is being created for live batch scheduling and is set for {scheduledDateForLiveBatchTest}.
                        </div>
                      ) : null}
                      <FormField control={form.control} name="title" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Test Title</FormLabel>
                          <FormControl><Input className={builderInputClass} placeholder="e.g., Weekly PCM Mock - Class 12" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormItem>
                        <FormLabel>Thumbnail (JPEG only)</FormLabel>
                        <FormControl>
                          <Input className={builderInputClass} type="file" accept=".jpg,.jpeg,image/jpeg" onChange={(e) => handleThumbnailChange(e.target.files?.[0])} />
                        </FormControl>
                        <FormDescription>Optional. Upload `.jpg` or `.jpeg` only (max 5MB).</FormDescription>
                      </FormItem>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="accessLevel" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Test Access Level</FormLabel>
                            <FormControl>
                              <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                                <FormItem className="flex items-center space-x-2 rounded-xl border border-slate-500/30 bg-slate-950/35 px-3 py-2"><FormControl><RadioGroupItem value="free" /></FormControl><FormLabel className="font-normal text-slate-100">Free</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-2 rounded-xl border border-slate-500/30 bg-slate-950/35 px-3 py-2"><FormControl><RadioGroupItem value="paid" /></FormControl><FormLabel className="font-normal text-slate-100">Paid</FormLabel></FormItem>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name="duration" render={({ field }) => (
                          <FormItem><FormLabel>Total Time (minutes)</FormLabel><FormControl><Input className={builderInputClass} type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="marksPerQuestion" render={({ field }) => (
                          <FormItem><FormLabel>Marks per Question</FormLabel><FormControl><Input className={builderInputClass} type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="negativeMarksPerQuestion" render={({ field }) => (
                          <FormItem><FormLabel>Negative Marking / Question</FormLabel><FormControl><Input className={builderInputClass} type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                    </div>

                    <div className={stepCardClass}>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-200">Step 2</p>
                        <h3 className="mt-1 text-xl font-semibold text-slate-100">Exam, Curriculum, and Filters</h3>
                        <p className="mt-1 text-sm text-slate-300/80">Choose the learner context so question availability and curriculum mapping stay accurate.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <FormField control={form.control} name="examTypeId" render={({ field }) => (
                          <FormItem><FormLabel>Exam</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className={builderSelectClass}><SelectValue placeholder="Select exam" /></SelectTrigger></FormControl><SelectContent>{teacherScopedExamTypes.map((et) => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="classId" render={({ field }) => (
                          <FormItem><FormLabel>Curriculum/Class</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedExamType}><FormControl><SelectTrigger className={builderSelectClass}><SelectValue placeholder="Select curriculum/class" /></SelectTrigger></FormControl><SelectContent>{filteredClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="questionSource" render={({ field }) => (
                          <FormItem><FormLabel>Question Source</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className={builderSelectClass}><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="student_plus_official">Student Use + Official Mock Test</SelectItem><SelectItem value="teacher_official">Teacher Official Mock Test</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="examLevel" render={({ field }) => (
                          <FormItem><FormLabel>Exam Difficulty Level</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className={builderSelectClass}><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="weak">Weak</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="strong">Strong</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                        )} />
                      </div>
                    </div>

                    <div className={stepCardClass}>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-200">Step 3</p>
                        <h3 className="mt-1 text-xl font-semibold text-slate-100">Section-Wise Question Distribution</h3>
                      </div>
                      <FormDescription>
                        Add one or more sections. For each section choose subject, source (All/PYQ), topic, nested subtopic branches (optional), question access, question type and question count.
                      </FormDescription>
                      <div className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Fast Setup Guide</p>
                        <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-200/90 md:grid-cols-3">
                          <p className="rounded-lg border border-slate-400/25 bg-slate-900/45 px-3 py-2">
                            <span className="font-semibold text-cyan-100">1.</span> Pick subject and topic for the section.
                          </p>
                          <p className="rounded-lg border border-slate-400/25 bg-slate-900/45 px-3 py-2">
                            <span className="font-semibold text-cyan-100">2.</span> Optional: narrow by subtopic branches or PYQ years.
                          </p>
                          <p className="rounded-lg border border-slate-400/25 bg-slate-900/45 px-3 py-2">
                            <span className="font-semibold text-cyan-100">3.</span> Set question count and verify bank count before adding next section.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {fields.map((field, index) => {
                          const allConfigs = watch('subjectConfigs') || [];
                          const currentSubjectId = watch(`subjectConfigs.${index}.subjectId`);
                          const currentTopicId = watch(`subjectConfigs.${index}.topicId`) || '';
                          const currentSubtopic = watch(`subjectConfigs.${index}.subtopic`) || '';
                          const currentFurtherSubtopic = watch(`subjectConfigs.${index}.furtherSubtopic`) || '';
                          const currentSubtopicPaths = normalizeSubtopicPathSelections(
                            (watch(`subjectConfigs.${index}.subtopicPaths`) || []) as string[],
                            currentSubtopic,
                            currentFurtherSubtopic
                          );
                          const currentQuestionType = watch(`subjectConfigs.${index}.questionType`) || 'All';
                          const currentDifficultyLevel = watch(`subjectConfigs.${index}.difficultyLevel`) || 'All';
                          const currentQuestionAccessLevel = watch(`subjectConfigs.${index}.questionAccessLevel`) || 'free';
                          const currentSectionQuestionSource = normalizeSectionQuestionSource(watch(`subjectConfigs.${index}.questionSource`) || 'all');
                          const currentPreviousYears = normalizePreviousYearList(watch(`subjectConfigs.${index}.previousYears`) || []);
                          const topicOptions = (topics || []).filter((t) => t.subjectId === currentSubjectId);
                          const subtopicPathPool = availableQuestions
                            .filter((q) =>
                              q.accessLevel === currentQuestionAccessLevel
                              &&
                              matchesSubjectInContext(q, currentSubjectId || '', selectedExamType || undefined, selectedClass || undefined)
                              && matchesTopic(q, currentTopicId)
                            )
                            .flatMap((q) => extractSubtopicPaths(q.subtopics));
                          const draftSubtopicPath = subtopicDraftPathBySection[field.id] || [];
                          const levelOptionSets: string[][] = [];
                          let traversalParent: string[] = [];
                          while (true) {
                            const levelOptions = getChildSubtopicOptions(subtopicPathPool, traversalParent);
                            if (levelOptions.length === 0) break;
                            levelOptionSets.push(levelOptions);
                            const selectedAtLevel = String(draftSubtopicPath[levelOptionSets.length - 1] || '').trim();
                            if (!selectedAtLevel || !levelOptions.some((option) => normalizeSubtopicValue(option) === normalizeSubtopicValue(selectedAtLevel))) {
                              break;
                            }
                            traversalParent = [...traversalParent, selectedAtLevel];
                          }
                          const normalizedDraftPath = normalizeSubtopicPathSegments(traversalParent);
                          const subtopicOptions: string[] = [];
                          const furtherSubtopicOptions: string[] = [];
                          const showSubtopicField = false;
                          const showFurtherSubtopicField = false;
                          const availablePyqYears = getAvailablePyqYearsForConfig(
                            currentSubjectId,
                            currentTopicId,
                            currentSubtopicPaths,
                            currentSubtopic,
                            currentFurtherSubtopic,
                            currentQuestionAccessLevel,
                            currentQuestionType,
                            currentDifficultyLevel
                          );
                          const availableCount = getAvailableCountForConfig(
                            currentSubjectId,
                            currentTopicId,
                            currentSubtopicPaths,
                            currentSubtopic,
                            currentFurtherSubtopic,
                            currentQuestionAccessLevel,
                            currentQuestionType,
                            currentDifficultyLevel,
                            currentSectionQuestionSource,
                            currentPreviousYears
                          );
                          const hasDuplicateCombination = (
                            subjectId: string,
                            topicId: string,
                            selectedSubtopicPaths: string[],
                            questionAccessLevel: 'free' | 'paid',
                            questionType: 'All' | 'MCQ' | 'Numerical' | 'Text',
                            difficultyLevel: 'All' | 'Easy' | 'Medium' | 'Hard',
                            questionSource: 'all' | 'pyq',
                            previousYears: string[]
                          ) => {
                            const candidateKey = `${subjectId}__${topicId || ''}__${getSubtopicSelectionKey(selectedSubtopicPaths)}__${questionType}__${difficultyLevel}__${questionAccessLevel}__${questionSource}__${getPreviousYearKey(previousYears)}`;
                            return allConfigs.some((cfg, i) => {
                              if (i === index) return false;
                              const key = `${cfg.subjectId}__${cfg.topicId || ''}__${getSubtopicSelectionKey(cfg.subtopicPaths, cfg.subtopic, cfg.furtherSubtopic)}__${cfg.questionType}__${cfg.difficultyLevel}__${cfg.questionAccessLevel || 'free'}__${normalizeSectionQuestionSource(cfg.questionSource)}__${getPreviousYearKey(cfg.previousYears || [])}`;
                              return key === candidateKey;
                            });
                          };
                          return (
                            <div key={field.id} className="space-y-4 rounded-2xl border border-slate-400/30 bg-gradient-to-br from-slate-900/70 via-slate-900/55 to-slate-950/45 p-4 shadow-[0_18px_50px_-40px_rgba(14,165,233,0.48)] sm:p-5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="rounded-full border-cyan-300/35 bg-cyan-500/10 text-cyan-100">Section {index + 1}</Badge>
                                  <Badge variant="outline" className="rounded-full border-slate-300/30 bg-slate-800/65 text-slate-100">{availableCount} in bank</Badge>
                                </div>
                                <p className="text-xs text-slate-300/85">Build a precise question recipe for this section.</p>
                              </div>
                              <div className={`grid grid-cols-1 md:grid-cols-2 ${showFurtherSubtopicField ? 'lg:grid-cols-8' : showSubtopicField ? 'lg:grid-cols-7' : 'lg:grid-cols-6'} gap-2 items-end`}>
                                <FormField control={form.control} name={`subjectConfigs.${index}.subjectId`} render={({ field: subjectField }) => (
                                  <FormItem><FormLabel>Subject</FormLabel><Select onValueChange={(value) => {
                                    if (hasDuplicateCombination(value, '', [], currentQuestionAccessLevel, currentQuestionType, currentDifficultyLevel, 'all', [])) {
                                      toast({
                                        variant: 'destructive',
                                        title: 'Duplicate section',
                                        description: 'This section already exists with the same filters.',
                                      });
                                      return;
                                    }
                                    subjectField.onChange(value);
                                    const subjectName = filteredSubjects.find((s) => s.id === value)?.name || '';
                                    setValue(`subjectConfigs.${index}.subjectName`, subjectName);
                                    setValue(`subjectConfigs.${index}.topicId`, '');
                                    setValue(`subjectConfigs.${index}.topicName`, '');
                                    setValue(`subjectConfigs.${index}.subtopic`, '');
                                    setValue(`subjectConfigs.${index}.furtherSubtopic`, '');
                                    setValue(`subjectConfigs.${index}.subtopicPaths`, []);
                                    setValue(`subjectConfigs.${index}.questionSource`, 'all');
                                    setValue(`subjectConfigs.${index}.previousYears`, []);
                                    setSubtopicDraftPathBySection((prev) => ({ ...prev, [field.id]: [] }));
                                  }} value={subjectField.value} disabled={!selectedClass}><FormControl><SelectTrigger className={builderSelectClass}><SelectValue placeholder="Select subject" /></SelectTrigger></FormControl><SelectContent>{filteredSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name={`subjectConfigs.${index}.questionSource`} render={({ field: sectionSourceField }) => (
                                  <FormItem>
                                    <FormLabel>Question Source</FormLabel>
                                    <Select onValueChange={(value: 'all' | 'pyq') => {
                                      if (!currentSubjectId) {
                                        sectionSourceField.onChange(value);
                                        setValue(`subjectConfigs.${index}.previousYears`, []);
                                        return;
                                      }
                                      if (hasDuplicateCombination(currentSubjectId, currentTopicId, currentSubtopicPaths, currentQuestionAccessLevel, currentQuestionType, currentDifficultyLevel, value, [])) {
                                        toast({
                                          variant: 'destructive',
                                          title: 'Duplicate section',
                                          description: 'This section already exists with the same filters.',
                                        });
                                        return;
                                      }
                                      sectionSourceField.onChange(value);
                                      setValue(`subjectConfigs.${index}.previousYears`, []);
                                    }} value={sectionSourceField.value || 'all'} disabled={!currentSubjectId}>
                                      <FormControl><SelectTrigger className={builderSelectClass}><SelectValue placeholder="All Questions" /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        <SelectItem value="all">All Questions</SelectItem>
                                        <SelectItem value="pyq">Previous Year (PYQ)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={form.control} name={`subjectConfigs.${index}.topicId`} render={({ field: topicField }) => (
                                  <FormItem><FormLabel>Topic</FormLabel><Select onValueChange={(value) => {
                                    const normalizedTopicId = value === '__all_topics__' ? '' : value;
                                    if (!currentSubjectId) {
                                      topicField.onChange(normalizedTopicId);
                                      return;
                                    }
                                    if (hasDuplicateCombination(currentSubjectId, normalizedTopicId, [], currentQuestionAccessLevel, currentQuestionType, currentDifficultyLevel, currentSectionQuestionSource, currentPreviousYears)) {
                                      toast({
                                        variant: 'destructive',
                                        title: 'Duplicate section',
                                        description: 'This section already exists with the same filters.',
                                      });
                                      return;
                                    }
                                    topicField.onChange(normalizedTopicId);
                                    const topicName = topicOptions.find((t) => t.id === normalizedTopicId)?.name || '';
                                    setValue(`subjectConfigs.${index}.topicName`, topicName);
                                    setValue(`subjectConfigs.${index}.subtopic`, '');
                                    setValue(`subjectConfigs.${index}.furtherSubtopic`, '');
                                    setValue(`subjectConfigs.${index}.subtopicPaths`, []);
                                    setValue(`subjectConfigs.${index}.previousYears`, []);
                                    setSubtopicDraftPathBySection((prev) => ({ ...prev, [field.id]: [] }));
                                  }} value={topicField.value || '__all_topics__'} disabled={!currentSubjectId}><FormControl><SelectTrigger className={builderSelectClass}><SelectValue placeholder="All topics" /></SelectTrigger></FormControl><SelectContent><SelectItem value="__all_topics__">All topics</SelectItem>{topicOptions.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                {showSubtopicField ? (
                                  <FormField control={form.control} name={`subjectConfigs.${index}.subtopic`} render={({ field: subtopicField }) => (
                                    <FormItem><FormLabel>Subtopic (selected topic)</FormLabel><Select onValueChange={(value) => {
                                      const normalizedSubtopic = value === '__all_subtopics__' ? '' : value;
                                      if (!currentSubjectId) {
                                        subtopicField.onChange(normalizedSubtopic);
                                        setValue(`subjectConfigs.${index}.furtherSubtopic`, '');
                                        return;
                                      }
                                      if (hasDuplicateCombination(currentSubjectId, currentTopicId, normalizeSubtopicPathSelections([normalizedSubtopic]), currentQuestionAccessLevel, currentQuestionType, currentDifficultyLevel, currentSectionQuestionSource, currentPreviousYears)) {
                                        toast({
                                          variant: 'destructive',
                                          title: 'Duplicate section',
                                          description: 'This section already exists with the same filters.',
                                        });
                                        return;
                                      }
                                      subtopicField.onChange(normalizedSubtopic);
                                      setValue(`subjectConfigs.${index}.furtherSubtopic`, '');
                                      setValue(`subjectConfigs.${index}.previousYears`, []);
                                    }} value={subtopicField.value || '__all_subtopics__'} disabled={!currentSubjectId}><FormControl><SelectTrigger className={builderSelectClass}><SelectValue placeholder="All sub topics" /></SelectTrigger></FormControl><SelectContent><SelectItem value="__all_subtopics__">All sub topics</SelectItem>{subtopicOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                  )} />
                                ) : null}
                                {showFurtherSubtopicField ? (
                                  <FormField control={form.control} name={`subjectConfigs.${index}.furtherSubtopic`} render={({ field: furtherSubtopicField }) => (
                                    <FormItem><FormLabel>Further Sub Topic</FormLabel><Select onValueChange={(value) => {
                                      const normalizedFurtherSubtopic = value === '__all_further_subtopics__' ? '' : value;
                                      if (!currentSubjectId) {
                                        furtherSubtopicField.onChange(normalizedFurtherSubtopic);
                                        return;
                                      }
                                      if (hasDuplicateCombination(currentSubjectId, currentTopicId, normalizeSubtopicPathSelections([serializeSubtopicPathSelection([currentSubtopic, normalizedFurtherSubtopic])]), currentQuestionAccessLevel, currentQuestionType, currentDifficultyLevel, currentSectionQuestionSource, currentPreviousYears)) {
                                        toast({
                                          variant: 'destructive',
                                          title: 'Duplicate section',
                                          description: 'This section already exists with the same filters.',
                                        });
                                        return;
                                      }
                                      furtherSubtopicField.onChange(normalizedFurtherSubtopic);
                                      setValue(`subjectConfigs.${index}.previousYears`, []);
                                    }} value={furtherSubtopicField.value || '__all_further_subtopics__'} disabled={!currentSubjectId || !currentSubtopic}><FormControl><SelectTrigger className={builderSelectClass}><SelectValue placeholder="All further sub topics" /></SelectTrigger></FormControl><SelectContent><SelectItem value="__all_further_subtopics__">All further sub topics</SelectItem>{furtherSubtopicOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                  )} />
                                ) : null}
                                <FormField control={form.control} name={`subjectConfigs.${index}.questionType`} render={({ field: typeField }) => (
                                  <FormItem><FormLabel>Question Type</FormLabel><Select onValueChange={(value: 'All' | 'MCQ' | 'Numerical' | 'Text') => {
                                    if (!currentSubjectId) {
                                      typeField.onChange(value);
                                      return;
                                    }
                                    if (hasDuplicateCombination(currentSubjectId, currentTopicId, currentSubtopicPaths, currentQuestionAccessLevel, value, currentDifficultyLevel, currentSectionQuestionSource, currentPreviousYears)) {
                                      toast({
                                        variant: 'destructive',
                                        title: 'Duplicate section',
                                        description: 'This section already exists with the same filters.',
                                      });
                                      return;
                                    }
                                    typeField.onChange(value);
                                    setValue(`subjectConfigs.${index}.previousYears`, []);
                                  }} value={typeField.value}><FormControl><SelectTrigger className={builderSelectClass}><SelectValue placeholder="All types" /></SelectTrigger></FormControl><SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="MCQ">MCQ</SelectItem><SelectItem value="Numerical">Numerical</SelectItem><SelectItem value="Text">Text</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                )} />
                                
                                <FormField control={form.control} name={`subjectConfigs.${index}.questionAccessLevel`} render={({ field: questionAccessField }) => (
                                  <FormItem><FormLabel>Question Access</FormLabel><Select onValueChange={(value: 'free' | 'paid') => {
                                    if (!currentSubjectId) {
                                      questionAccessField.onChange(value);
                                      return;
                                    }
                                    if (hasDuplicateCombination(currentSubjectId, currentTopicId, currentSubtopicPaths, value, currentQuestionType, currentDifficultyLevel, currentSectionQuestionSource, currentPreviousYears)) {
                                      toast({
                                        variant: 'destructive',
                                        title: 'Duplicate section',
                                        description: 'This section already exists with the same filters.',
                                      });
                                      return;
                                    }
                                    questionAccessField.onChange(value);
                                    setValue(`subjectConfigs.${index}.previousYears`, []);
                                  }} value={questionAccessField.value}><FormControl><SelectTrigger className={builderSelectClass}><SelectValue placeholder="Select access" /></SelectTrigger></FormControl><SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                                )} />
                              </div>
                              {currentTopicId ? (
                                <div className="rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-500/10 via-slate-900/30 to-cyan-500/10 p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-semibold text-cyan-100">Nested Subtopic Filters (Optional)</p>
                                      <p className="text-[11px] text-slate-300/85">Choose any branch depth. Each selected branch automatically includes all of its child subtopics.</p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={currentSubtopicPaths.length === 0 ? 'default' : 'outline'}
                                      className="h-9 rounded-full border-cyan-300/35 bg-cyan-500/20 px-4 text-cyan-50 hover:bg-cyan-500/30"
                                      onClick={() => {
                                        if (!currentSubjectId) return;
                                        if (hasDuplicateCombination(currentSubjectId, currentTopicId, [], currentQuestionAccessLevel, currentQuestionType, currentDifficultyLevel, currentSectionQuestionSource, currentPreviousYears)) {
                                          toast({
                                            variant: 'destructive',
                                            title: 'Duplicate section',
                                            description: 'This section already exists with the same filters.',
                                          });
                                          return;
                                        }
                                        setValue(`subjectConfigs.${index}.subtopicPaths`, []);
                                        setValue(`subjectConfigs.${index}.subtopic`, '');
                                        setValue(`subjectConfigs.${index}.furtherSubtopic`, '');
                                        setValue(`subjectConfigs.${index}.previousYears`, []);
                                      }}
                                    >
                                      All subtopics in topic
                                    </Button>
                                  </div>
                                  {subtopicPathPool.length === 0 ? (
                                    <p className="mt-2 text-xs text-muted-foreground">No nested subtopics available in question bank for this topic.</p>
                                  ) : (
                                    <div className="mt-3 space-y-3">
                                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                        {levelOptionSets.map((levelOptions, levelIndex) => (
                                          <FormItem key={`${field.id}-level-${levelIndex}`}>
                                            <FormLabel>{`Subtopic Level ${levelIndex + 1}`}</FormLabel>
                                            <Select
                                              onValueChange={(value) => {
                                                setSubtopicDraftPathBySection((prev) => {
                                                  const existing = [...(prev[field.id] || [])];
                                                  const next = existing.slice(0, levelIndex);
                                                  if (value !== '__no_selection__') {
                                                    next[levelIndex] = value;
                                                  }
                                                  return { ...prev, [field.id]: next };
                                                });
                                              }}
                                              value={draftSubtopicPath[levelIndex] || '__no_selection__'}
                                            >
                                              <FormControl><SelectTrigger className={builderSelectClass}><SelectValue placeholder={levelIndex === 0 ? 'Select top-level subtopic' : 'Select child subtopic'} /></SelectTrigger></FormControl>
                                              <SelectContent>
                                                <SelectItem value="__no_selection__">{levelIndex === 0 ? 'Select top-level subtopic' : 'Stop here (all child subtopics)'}</SelectItem>
                                                {levelOptions.map((option) => (
                                                  <SelectItem key={`${field.id}-level-${levelIndex}-${option}`} value={option}>
                                                    {option}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </FormItem>
                                        ))}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          className="h-9 rounded-full bg-cyan-500 px-4 font-semibold text-slate-950 hover:bg-cyan-400"
                                          disabled={!currentSubjectId || normalizedDraftPath.length === 0}
                                          onClick={() => {
                                            if (!currentSubjectId || normalizedDraftPath.length === 0) return;
                                            const branchPath = serializeSubtopicPathSelection(normalizedDraftPath);
                                            const mergedPaths = normalizeSubtopicPathSelections([...currentSubtopicPaths, branchPath]);
                                            if (hasDuplicateCombination(currentSubjectId, currentTopicId, mergedPaths, currentQuestionAccessLevel, currentQuestionType, currentDifficultyLevel, currentSectionQuestionSource, currentPreviousYears)) {
                                              toast({
                                                variant: 'destructive',
                                                title: 'Duplicate section',
                                                description: 'This section already exists with the same filters.',
                                              });
                                              return;
                                            }
                                            const firstPath = parseSubtopicPathSelection(mergedPaths[0] || '');
                                            setValue(`subjectConfigs.${index}.subtopicPaths`, mergedPaths);
                                            setValue(`subjectConfigs.${index}.subtopic`, firstPath[0] || '');
                                            setValue(`subjectConfigs.${index}.furtherSubtopic`, firstPath[1] || '');
                                            setValue(`subjectConfigs.${index}.previousYears`, []);
                                          }}
                                        >
                                          Add Selected Branch
                                        </Button>
                                        <p className="text-xs text-slate-300/85">
                                          Current draft: {normalizedDraftPath.length > 0 ? serializeSubtopicPathSelection(normalizedDraftPath) : 'No branch selected'}
                                        </p>
                                      </div>
                                      {currentSubtopicPaths.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                          {currentSubtopicPaths.map((selectedPath) => (
                                            <button
                                              key={`${field.id}-subtopic-path-${selectedPath}`}
                                              type="button"
                                              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-500/15 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-500/25"
                                              onClick={() => {
                                                if (!currentSubjectId) return;
                                                const nextPaths = normalizeSubtopicPathSelections(currentSubtopicPaths.filter((path) => path !== selectedPath));
                                                if (hasDuplicateCombination(currentSubjectId, currentTopicId, nextPaths, currentQuestionAccessLevel, currentQuestionType, currentDifficultyLevel, currentSectionQuestionSource, currentPreviousYears)) {
                                                  toast({
                                                    variant: 'destructive',
                                                    title: 'Duplicate section',
                                                    description: 'This section already exists with the same filters.',
                                                  });
                                                  return;
                                                }
                                                const firstPath = parseSubtopicPathSelection(nextPaths[0] || '');
                                                setValue(`subjectConfigs.${index}.subtopicPaths`, nextPaths);
                                                setValue(`subjectConfigs.${index}.subtopic`, firstPath[0] || '');
                                                setValue(`subjectConfigs.${index}.furtherSubtopic`, firstPath[1] || '');
                                                setValue(`subjectConfigs.${index}.previousYears`, []);
                                              }}
                                            >
                                              <span>{selectedPath}</span>
                                              <span className="font-semibold">x</span>
                                            </button>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-slate-300/85">No branch selected yet. This section currently includes all subtopics under the selected topic.</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                              {currentSectionQuestionSource === 'pyq' ? (
                                <div className="rounded-xl border border-amber-300/35 bg-amber-500/12 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-amber-100">PYQ Year Filter</p>
                                    <p className="text-xs text-amber-100/85">
                                      {availablePyqYears.length > 0
                                        ? (currentPreviousYears.length > 0 ? `Selected: ${currentPreviousYears.join(', ')}` : 'Selected: All Years')
                                        : 'No PYQ years available'}
                                    </p>
                                  </div>
                                  {availablePyqYears.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={currentPreviousYears.length === 0 ? 'default' : 'outline'}
                                        className="h-8 rounded-full border-amber-300/35 bg-amber-500/20 px-3 text-amber-50 hover:bg-amber-500/30"
                                        onClick={() => setValue(`subjectConfigs.${index}.previousYears`, [])}
                                      >
                                        All Years
                                      </Button>
                                      {availablePyqYears.map((year) => {
                                        const selectedYear = currentPreviousYears.includes(year);
                                        return (
                                          <label
                                            key={`${field.id}-pyq-${year}`}
                                            className={cn(
                                              'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all',
                                              selectedYear
                                                ? 'border-amber-400/45 bg-amber-500/15 text-amber-100'
                                                : 'border-border/70 bg-background/80 hover:border-amber-400/35 hover:bg-amber-500/10'
                                            )}
                                          >
                                            <Checkbox
                                              checked={selectedYear}
                                              onCheckedChange={(checked: boolean) => {
                                                const nextSelected = new Set(currentPreviousYears);
                                                if (checked) nextSelected.add(year);
                                                else nextSelected.delete(year);
                                                const normalizedYears = normalizePreviousYearList(Array.from(nextSelected));
                                                if (hasDuplicateCombination(currentSubjectId, currentTopicId, currentSubtopicPaths, currentQuestionAccessLevel, currentQuestionType, currentDifficultyLevel, 'pyq', normalizedYears)) {
                                                  toast({
                                                    variant: 'destructive',
                                                    title: 'Duplicate section',
                                                    description: 'This section already exists with the same filters.',
                                                  });
                                                  return;
                                                }
                                                setValue(`subjectConfigs.${index}.previousYears`, normalizedYears);
                                              }}
                                            />
                                            <span>{year}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      Change section filters or switch source to All Questions.
                                    </p>
                                  )}
                                </div>
                              ) : null}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(190px,1fr)_minmax(220px,1fr)_minmax(140px,180px)_auto] gap-3 items-end">
                                <FormField control={form.control} name={`subjectConfigs.${index}.count`} render={({ field: countField }) => (
                                  <FormItem><FormLabel>No. of Questions</FormLabel><FormControl><Input className={builderInputClass} type="number" min="1" {...countField} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name={`subjectConfigs.${index}.randomizePerAttempt`} render={({ field: randomField }) => (
                                  <FormItem className="rounded-xl border border-slate-500/30 bg-slate-900/50 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <FormLabel className="m-0 text-sm text-slate-100">Random Each Attempt</FormLabel>
                                      <FormControl>
                                        <Switch checked={!!randomField.value} onCheckedChange={randomField.onChange} />
                                      </FormControl>
                                    </div>
                                  </FormItem>
                                )} />
                                <div className="rounded-xl border border-slate-500/30 bg-slate-900/50 p-3 text-sm min-w-0">
                                  <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">Bank Count</p>
                                  <p className="mt-1 text-2xl font-semibold text-cyan-100">{availableCount}</p>
                                  {currentSectionQuestionSource === 'pyq' ? (
                                    <p className="text-[11px] text-muted-foreground">
                                      PYQ {currentPreviousYears.length > 0 ? currentPreviousYears.join(', ') : 'All Years'}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex lg:justify-end">
                                  {fields.length > 1 ? (
                                    <Button type="button" variant="destructive" size="icon" className="h-11 w-11 rounded-xl" onClick={() => remove(index)}><X className="h-4 w-4" /></Button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <Button type="button" variant="outline" className="h-11 rounded-full border-cyan-300/35 bg-cyan-500/10 px-5 font-semibold text-cyan-100 hover:bg-cyan-500/20" onClick={() => append({ subjectId: '', subjectName: '', topicId: '', topicName: '', subtopic: '', furtherSubtopic: '', subtopicPaths: [], questionSource: 'all', previousYears: [], questionAccessLevel: selectedAccessLevel, randomizePerAttempt: false, questionType: 'All', difficultyLevel: 'Easy' as const, count: 10 })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Section
                      </Button>
                      <FormField control={form.control} name="subjectConfigs" render={() => <FormItem><FormMessage /></FormItem>} />
                    </div>

                    <div className={stepCardClass}>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-200">Step 4</p>
                        <h3 className="mt-1 text-xl font-semibold text-slate-100">Mock Test Overview</h3>
                        <p className="mt-1 text-sm text-slate-300/80">Write a clear public-facing pitch so students understand the value before they attempt.</p>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="mockTestDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description of the Mock Test</FormLabel>
                              <FormControl>
                                <Textarea className={builderTextareaClass} rows={4} placeholder="Add a clear description of this mock test..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="mockTestOutcomes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mock Test Outcomes</FormLabel>
                              <FormControl>
                                <Textarea className={builderTextareaClass} rows={4} placeholder="Mention the expected outcomes for students..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="mockTestYoutubeUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Preview Explanation Video URL (for non-purchased students)</FormLabel>
                              <FormControl>
                                <Input className={builderInputClass} placeholder="https://www.youtube.com/watch?v=..." {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className={stepCardClass}>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-200">Step 5</p>
                        <h3 className="mt-1 text-xl font-semibold text-slate-100">Attempt Instructions</h3>
                        <p className="mt-1 text-sm text-slate-300/80">Define rules and guidance to reduce confusion and improve student performance quality.</p>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="attemptRules"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rules of Attempting the Mock Test</FormLabel>
                              <FormControl>
                                <Textarea className={builderTextareaClass} rows={4} placeholder="Define the rules students must follow while attempting..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {isTeacher ? (
                          <FormField
                            control={form.control}
                            name="showLeaderboard"
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between rounded-xl border border-slate-400/30 bg-slate-900/45 p-3">
                                <div className="space-y-1">
                                  <FormLabel className="m-0 text-slate-100">Show Leaderboard to Students</FormLabel>
                                  <FormDescription className="text-slate-300/80">If enabled, students can view ranking on the test details page.</FormDescription>
                                </div>
                                <FormControl>
                                  <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        ) : null}
                        <FormField
                          control={form.control}
                          name="attemptGuidance"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Guidance of Attempting</FormLabel>
                              <FormControl>
                                <Textarea className={builderTextareaClass} rows={4} placeholder="Add guidance/tips to attempt this mock test effectively..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {isTeacher ? (
                      <div className={stepCardClass}>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-200">Step 6</p>
                          <h3 className="mt-1 text-xl font-semibold text-slate-100">Attempt Limits</h3>
                        </div>
                        <FormDescription>
                          Control how many times students can attempt this mock test.
                        </FormDescription>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="attemptLimitMode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Attempt Limit Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger className={builderSelectClass}><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="unlimited">Unlimited Attempts</SelectItem>
                                    <SelectItem value="total">Total Attempts</SelectItem>
                                    <SelectItem value="interval">Attempts Per Interval</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {attemptLimitMode === 'total' ? (
                            <FormField
                              control={form.control}
                              name="maxTotalAttempts"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Maximum Total Attempts</FormLabel>
                                  <FormControl><Input className={builderInputClass} type="number" min="1" {...field} value={field.value ?? ''} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ) : null}
                        </div>
                        {attemptLimitMode === 'interval' ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                              control={form.control}
                              name="maxAttemptsPerInterval"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Attempts Allowed</FormLabel>
                                  <FormControl><Input className={builderInputClass} type="number" min="1" {...field} value={field.value ?? ''} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="attemptIntervalValue"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Interval Count</FormLabel>
                                  <FormControl><Input className={builderInputClass} type="number" min="1" {...field} value={field.value ?? ''} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="attemptIntervalUnit"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Interval Unit</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className={builderSelectClass}><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      <SelectItem value="day">Day(s)</SelectItem>
                                      <SelectItem value="week">Week(s)</SelectItem>
                                      <SelectItem value="month">Month(s)</SelectItem>
                                      <SelectItem value="year">Year(s)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        ) : null}
                        {attemptLimitMode === 'unlimited' ? (
                          <p className="text-sm text-muted-foreground">Students can attempt this test any number of times.</p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-slate-400/30 bg-gradient-to-r from-slate-900/60 via-blue-950/20 to-slate-900/55 p-5">
                      <h3 className="text-xl font-semibold text-slate-100">Launch Summary</h3>
                      <p className="mt-1 text-sm text-slate-300/80">Review the key metrics below before saving draft or publishing.</p>
                      <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                        <div className="rounded-xl border border-slate-400/30 bg-slate-900/55 px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">Total Questions</p>
                          <p className="mt-1 text-2xl font-semibold text-cyan-100">{totalRequestedQuestions}</p>
                        </div>
                        <div className="rounded-xl border border-slate-400/30 bg-slate-900/55 px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">Total Marks</p>
                          <p className="mt-1 text-2xl font-semibold text-cyan-100">{totalMarks}</p>
                        </div>
                        <div className="rounded-xl border border-slate-400/30 bg-slate-900/55 px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.13em] text-slate-400">Total Time</p>
                          <p className="mt-1 text-2xl font-semibold text-cyan-100">{watch('duration')} min</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-400/30 bg-slate-900/50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Final Action</p>
                          <p className="mt-1 text-sm text-slate-300/80">Save as draft to review later or create now to publish this test flow.</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                      {isTeacher ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-full border-cyan-300/35 bg-cyan-500/10 px-5 font-semibold text-cyan-100 hover:bg-cyan-500/20"
                          disabled={isSubmitting}
                          onClick={form.handleSubmit((values) => onSubmit(values, true))}
                          size="lg"
                        >
                          {isSubmitting ? (<><LoaderCircle className="mr-2 animate-spin" /> Saving...</>) : 'Save as Draft'}
                        </Button>
                      ) : null}
                      <Button type="submit" className="h-11 rounded-full bg-cyan-500 px-6 font-semibold text-slate-950 hover:bg-cyan-400" disabled={isSubmitting} size="lg">
                        {isSubmitting ? (<><LoaderCircle className="mr-2 animate-spin" /> Creating Test...</>) : 'Create Mock Test'}
                      </Button>
                        </div>
                      </div>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <AlertDialog open={!!pendingSubscriptionTestId} onOpenChange={(open) => !open && setPendingSubscriptionTestId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Paid Test Saved As Draft</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingSubscriptionTestTitle}" is saved in draft and will be published only after you attach a subscription plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => router.push('/mock-tests')}>Later</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingSubscriptionTestId) return;
                window.location.assign(`/subscription?linkedContentType=mock_test&linkedContentId=${pendingSubscriptionTestId}`);
              }}
            >
              Open Subscription Page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


