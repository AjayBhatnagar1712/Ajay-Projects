'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore';

import DashboardHeader from '@/components/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, useStorage } from '@/firebase';
import { GripVertical, LoaderCircle, PlusCircle, Trash2 } from 'lucide-react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { notifyTeacherPublication } from '@/lib/client-notifications';
import { toDateInputValue } from '@/lib/course-expiry';
import { buildPracticeQuestionScopeEntries } from '@/lib/practice-question-scope';
import {
  buildTeacherPremiumQuestionRows,
  resolveTeacherPremiumQuestionAvailability,
} from '@/lib/teacher-premium-question-access';
import {
  isTeacherQuestionPurchaseActive,
  type TeacherQuestionPurchaseDoc,
} from '@/lib/teacher-question-purchase';
import { ALLOWED_TEACHER_AUTHOR_EMAIL } from '@/lib/teacher-authoring';

type Subject = { id: string; name: string; classId: string };
type Class = { id: string; name: string; examTypeId?: string };
type ExamType = { id: string; name: string };
type Topic = { id: string; name: string; subjectId: string };
type Question = {
  id: string;
  classId: string;
  subjectId: string;
  topicId?: string;
  subtopics?: string[];
  accessLevel: 'free' | 'paid';
  mockTestOnly?: boolean;
  examTypeId: string;
  difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  examLevel?: 'weak' | 'medium' | 'strong';
  alignments?: Array<{ examTypeId: string; classId: string; subjectId: string; difficultyLevel?: 'Easy' | 'Medium' | 'Hard' }>;
  teacherId?: string;
};
type TeachingAssignment = { classId: string; subjectIds?: string[] };
type UserProfile = { teachingAssignments?: TeachingAssignment[] };
type DcamQuestionBankOwnerProfile = { id: string; email?: string };

const subjectCfg = z.object({
  subjectId: z.string().min(1, 'Select a subject'),
  subjectName: z.string(),
  topicId: z.string().optional().default(''),
  topicName: z.string().optional().default(''),
  subtopic: z.string().optional().default(''),
  subtopics: z.array(z.string()).optional().default([]),
  count: z.coerce.number().min(1, 'Must be > 0'),
});

const optionalNumberField = (schema: z.ZodNumber) => z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, schema.optional());

const COURSE_TEST_QUESTION_SOURCE = 'student_plus_official' as const;

const testCfg = z.object({
  testMode: z.enum(['single', 'multi']),
  questionAccessLevel: z.enum(['free', 'paid']).default('free'),
  questionSource: z.enum(['student_plus_official', 'teacher_official']).default(COURSE_TEST_QUESTION_SOURCE),
  duration: optionalNumberField(z.number().min(1, 'Duration must be at least 1 minute.')),
  marksPerQuestion: optionalNumberField(z.number().min(0, 'Marks cannot be negative.')),
  negativeMarksPerQuestion: optionalNumberField(z.number().min(0, 'Negative marks cannot be negative.')),
  difficultyLevel: z.enum(['All', 'Easy', 'Medium', 'Hard']),
  examLevel: z.enum(['All', 'weak', 'medium', 'strong']),
  subjectConfigs: z.array(subjectCfg).min(1, 'Add at least one subject'),
});

const itemSchema = z.object({
  itemType: z.enum(['module', 'test', 'chapter']),
  linkedTestId: z.string().optional(),
  subjectId: z.string().min(1, 'Subject is required'),
  subjectName: z.string().optional(),
  moduleKey: z.string().optional(),
  parentModuleRef: z.string().optional(),
  chapterKey: z.string().optional(),
  chapterRef: z.string().optional(),
  heading: z.string().optional(),
  subHeading: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  accessLevel: z.enum(['free', 'paid']),
  contentType: z.enum(['text', 'youtube', 'pdf', 'word']),
  textBody: z.string().optional(),
  youtubeUrl: z.string().optional(),
  fileUrl: z.string().optional(),
  testConfig: testCfg.optional(),
}).superRefine((item, ctx) => {
  if (item.itemType === 'module') {
    if (item.contentType === 'text' && !item.textBody?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['textBody'], message: 'Text required' });
    if (item.contentType === 'youtube' && !item.youtubeUrl?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['youtubeUrl'], message: 'YouTube URL required' });
  } else if (item.itemType === 'test' && !item.testConfig) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['testConfig'], message: 'Test config required' });
  }
});

const schema = z.object({
  title: z.string().min(5, 'Title too short'),
  description: z.string().min(20, 'Description too short'),
  outcomes: z.string().optional(),
  introductionVideoUrl: z.string().min(1, 'Introduction video URL is required').url('Enter a valid YouTube URL'),
  introductionText: z.string().min(1, 'Introduction text is required'),
  accessLevel: z.enum(['free', 'paid']),
  examTypeId: z.string().min(1, 'Select exam type'),
  classId: z.string().min(1, 'Select class'),
  subjectIds: z.array(z.string()).min(1, 'Select at least one subject'),
  isCrashCourse: z.boolean().default(false),
  expiryDate: z.string().optional().default('').refine((value) => {
    if (!value) return true;
    return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
  }, 'Enter a valid expiry date'),
  modules: z.array(itemSchema).min(1, 'Add at least one item'),
});

const moduleDefaults = { itemType: 'module' as const, linkedTestId: '', subjectId: '', subjectName: '', moduleKey: '', parentModuleRef: '', chapterKey: '', heading: '', subHeading: '', title: '', accessLevel: 'free' as const, contentType: 'text' as const, textBody: '', youtubeUrl: '', fileUrl: '', testConfig: undefined };
const testDefaults = { itemType: 'test' as const, linkedTestId: '', subjectId: '', subjectName: '', moduleKey: '', parentModuleRef: '', chapterKey: '', heading: '', subHeading: '', title: '', accessLevel: 'free' as const, contentType: 'text' as const, textBody: '', youtubeUrl: '', fileUrl: '', testConfig: { testMode: 'single' as const, questionAccessLevel: 'free' as const, questionSource: COURSE_TEST_QUESTION_SOURCE, duration: undefined, marksPerQuestion: undefined, negativeMarksPerQuestion: undefined, difficultyLevel: 'Easy' as const, examLevel: 'All' as const, subjectConfigs: [{ subjectId: '', subjectName: '', topicId: '', topicName: '', subtopic: '', subtopics: [], count: 10 }] } };
const chapterDefaults = { itemType: 'chapter' as const, linkedTestId: '', subjectId: '', subjectName: '', moduleKey: '', parentModuleRef: '', chapterKey: '', chapterRef: undefined, heading: '', subHeading: '', title: '', accessLevel: 'free' as const, contentType: 'text' as const, textBody: '', youtubeUrl: '', fileUrl: '', testConfig: undefined };

type ExistingCourse = {
  id: string;
  teacherId?: string;
  publicationStatus?: 'draft' | 'published' | 'deleted';
  title?: string;
  description?: string;
  outcomes?: string;
  introduction?: { youtubeUrl?: string; textBody?: string };
  accessLevel?: 'free' | 'paid';
  examTypeId?: string;
  classId?: string;
  subjectIds?: string[];
  isCrashCourse?: boolean;
  expiryDate?: string | number | { seconds?: number; toDate?: () => Date };
  thumbnailUrl?: string;
  imageUrl?: string;
  modules?: Array<{
    itemType?: 'module' | 'chapter' | 'test';
    subjectId?: string;
    subjectName?: string;
    moduleKey?: string;
    parentModuleRef?: string;
    chapterKey?: string;
    chapterRef?: string;
    heading?: string;
    subHeading?: string;
    title?: string;
    accessLevel?: 'free' | 'paid';
    contentType?: 'text' | 'youtube' | 'pdf' | 'word' | 'chapter';
    textBody?: string;
    youtubeUrl?: string;
    fileUrl?: string;
    sequenceOrder?: number;
  }>;
};

type CourseInlineTest = {
  id: string;
  title?: string;
  accessLevel?: 'free' | 'paid';
  questionAccessLevel?: 'free' | 'paid';
  questionSource?: 'student_plus_official' | 'teacher_official';
  subjectId?: string;
  subjectName?: string;
  chapterRef?: string;
  parentModuleRef?: string;
  sequenceOrder?: number;
  testMode?: 'single' | 'multi';
  examLevel?: 'weak' | 'medium' | 'strong' | 'All';
  difficultyLevel?: 'Easy' | 'Medium' | 'Hard' | 'All';
  subjectConfigs?: Array<{
    subjectId?: string;
    subjectName?: string;
    topicId?: string;
    topicName?: string;
    subtopic?: string;
    subtopics?: string[];
    count?: number;
  }>;
  config?: {
    questionIds?: string[];
    duration?: number;
    marksPerQuestion?: number;
    negativeMarksPerQuestion?: number;
    totalQuestions?: number;
  };
};

type ExistingCourseModule = NonNullable<ExistingCourse['modules']>[number];
type CourseInlineTestSubjectConfig = NonNullable<CourseInlineTest['subjectConfigs']>[number];

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const asStringArray = (value: unknown): string[] =>
  asArray<unknown>(value).filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
const asNonNegativeNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed >= 0 ? parsed : fallback;
};
const asPositiveNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed > 0 ? parsed : fallback;
};
const asOptionalNonNegativeNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed >= 0 ? parsed : undefined;
};
const asOptionalPositiveNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed > 0 ? parsed : undefined;
};

const normalizeSubtopicSelection = (subtopics?: string[], legacySubtopic?: string): string[] => {
  const values = [...(Array.isArray(subtopics) ? subtopics : []), ...(legacySubtopic ? [legacySubtopic] : [])]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const normalized: string[] = [];
  values.forEach((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(value);
  });
  return normalized;
};

export default function EditCoursePage() {
  const params = useParams() as { courseId?: string | string[] };
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();
  const { isTeacher } = useIsTeacher();
  const editId = useMemo(() => {
    const rawCourseId = params?.courseId;
    if (Array.isArray(rawCourseId)) return (rawCourseId[0] || '').trim();
    return typeof rawCourseId === 'string' ? rawCourseId.trim() : '';
  }, [params?.courseId]);
  const [submitting, setSubmitting] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState<string>('');
  const [moduleFileByFieldId, setModuleFileByFieldId] = useState<Record<string, File | null>>({});
  const hasHydratedEditFormRef = useRef(false);

  const classesQ = useMemoFirebase(() => firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null, [firestore]);
  const examTypesQ = useMemoFirebase(() => firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null, [firestore]);
  const subjectsQ = useMemoFirebase(() => firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null, [firestore]);
  const topicsQ = useMemoFirebase(() => firestore ? query(collection(firestore, 'topics'), orderBy('name')) : null, [firestore]);
  const questionsQ = useMemoFirebase(() => firestore ? query(collection(firestore, 'practice_questions')) : null, [firestore]);
  const inlineTestsQ = useMemoFirebase(() => {
    if (!firestore || !editId) return null;
    return query(collection(firestore, 'mock_tests'), where('isCourseOnly', '==', true), where('courseId', '==', editId));
  }, [firestore, editId]);
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const editingCourseRef = useMemoFirebase(() => (firestore ? doc(firestore, 'courses', editId) : null), [firestore, editId]);
  const dcamQuestionBankOwnerQuery = useMemoFirebase(
    () => (
      firestore
        ? query(collection(firestore, 'users'), where('email', '==', ALLOWED_TEACHER_AUTHOR_EMAIL), limit(1))
        : null
    ),
    [firestore]
  );
  const teacherQuestionPurchasesQuery = useMemoFirebase(
    () => (
      firestore && user?.uid
        ? query(collection(firestore, 'users', user.uid, 'teacher_question_purchases'), orderBy('purchasedAt', 'desc'))
        : null
    ),
    [firestore, user?.uid]
  );

  const { data: classes, isLoading: classesLoading } = useCollection<Class>(classesQ);
  const { data: examTypes, isLoading: examTypesLoading } = useCollection<ExamType>(examTypesQ);
  const { data: subjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQ);
  const { data: topics, isLoading: topicsLoading } = useCollection<Topic>(topicsQ);
  const { data: questions, isLoading: questionsLoading } = useCollection<Question>(questionsQ);
  const { data: inlineCourseTests, isLoading: inlineTestsLoading } = useCollection<CourseInlineTest>(inlineTestsQ);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);
  const { data: editingCourse, isLoading: editingCourseLoading } = useDoc<ExistingCourse>(editingCourseRef);
  const { data: dcamQuestionBankOwnerRows } = useCollection<DcamQuestionBankOwnerProfile>(dcamQuestionBankOwnerQuery);
  const { data: teacherQuestionPurchasesData } = useCollection<TeacherQuestionPurchaseDoc>(teacherQuestionPurchasesQuery);

  const assignments = asArray<TeachingAssignment>(userProfile?.teachingAssignments);
  const allowedClassIds = Array.from(new Set(assignments.map((a) => a.classId).filter(Boolean)));
  const allowedSubjectIds = Array.from(new Set(assignments.flatMap((a) => a.subjectIds || []).filter(Boolean)));
  const dcamQuestionBankOwnerId = String(dcamQuestionBankOwnerRows?.[0]?.id || '').trim();
  const activeTeacherQuestionPurchases = useMemo(
    () => (teacherQuestionPurchasesData || []).filter((purchase) => isTeacherQuestionPurchaseActive(purchase)),
    [teacherQuestionPurchasesData]
  );

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      outcomes: '',
      introductionVideoUrl: '',
      introductionText: '',
      accessLevel: 'free',
      examTypeId: '',
      classId: '',
      subjectIds: [],
      isCrashCourse: false,
      expiryDate: '',
      modules: [],
    },
  });

  const { fields, append, remove, insert } = useFieldArray({ control: form.control, name: 'modules' });
  const selectedClass = form.watch('classId');
  const selectedCourseAccess = form.watch('accessLevel');
  const selectedSubjectIds = form.watch('subjectIds');
  const isPaidCourse = selectedCourseAccess === 'paid';

  const handleThumbnailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Please select an image file for thumbnail.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Please upload a thumbnail smaller than 5MB.' });
      return;
    }
    setThumbnailFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setThumbnailPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleModuleFileChange = (fieldId: string, file?: File) => {
    if (!file) {
      setModuleFileByFieldId((prev) => ({ ...prev, [fieldId]: null }));
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Please upload a file smaller than 25MB.' });
      return;
    }
    setModuleFileByFieldId((prev) => ({ ...prev, [fieldId]: file }));
  };

  const makeChapterKey = () => `chapter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const makeModuleKey = () => `module_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const makeChapterTitle = (items: z.infer<typeof itemSchema>[], subjectId: string) => `Chapter ${items.filter((m) => m.itemType === 'chapter' && m.subjectId === subjectId).length + 1}`;
  const getChapterBlockLastIndex = (
    items: z.infer<typeof itemSchema>[],
    chapterKey: string,
    subjectId: string,
    chapterIndex: number
  ) => {
    let lastIndex = chapterIndex;
    for (let idx = chapterIndex + 1; idx < items.length; idx += 1) {
      const item = items[idx];
      if (item.subjectId !== subjectId) continue;
      if (item.itemType === 'chapter') break;
      if ((item.chapterRef || '') === chapterKey) {
        lastIndex = idx;
      }
    }
    return lastIndex;
  };

  const getNestedModuleBlockLastIndex = (
    items: z.infer<typeof itemSchema>[],
    parentModuleKey: string,
    subjectId: string,
    parentIndex: number
  ) => {
    let lastIndex = parentIndex;
    const visibleBranch = new Set<string>([parentModuleKey]);

    for (let idx = parentIndex + 1; idx < items.length; idx += 1) {
      const item = items[idx];
      if (item.subjectId !== subjectId) continue;
      if (item.itemType === 'chapter') break;

      const parentRef = item.parentModuleRef || '';
      if (parentRef && visibleBranch.has(parentRef)) {
        lastIndex = idx;
        if (item.itemType === 'module' && item.moduleKey) {
          visibleBranch.add(item.moduleKey);
        }
        continue;
      }

      break;
    }

    return lastIndex;
  };

  const getModuleDepth = (items: z.infer<typeof itemSchema>[], itemIndex: number) => {
    const current = items[itemIndex];
    if (!current || current.itemType !== 'module') return 0;
    const subjectId = current.subjectId;
    let depth = 0;
    let cursor = current.parentModuleRef || '';
    const guard = new Set<string>();

    while (cursor) {
      if (guard.has(cursor)) break;
      guard.add(cursor);
      const parent = items.find((item) => item.itemType === 'module' && item.subjectId === subjectId && (item.moduleKey || '') === cursor);
      if (!parent) break;
      depth += 1;
      cursor = parent.parentModuleRef || '';
      if (depth > 20) break;
    }

    return depth;
  };

  const removeItemWithNestedModules = (removeAtIndex: number) => {
    const currentItems = form.getValues('modules') as z.infer<typeof itemSchema>[];
    const target = currentItems[removeAtIndex];
    if (!target) return;

    if (target.itemType !== 'module') {
      remove(removeAtIndex);
      return;
    }

    const targetKey = target.moduleKey || '';
    if (!targetKey) {
      remove(removeAtIndex);
      return;
    }

    const keysToDelete = new Set<string>([targetKey]);
    let changed = true;
    while (changed) {
      changed = false;
      currentItems.forEach((item) => {
        if (item.subjectId !== target.subjectId || item.itemType !== 'module') return;
        const parentRef = item.parentModuleRef || '';
        const moduleKey = item.moduleKey || '';
        if (parentRef && keysToDelete.has(parentRef) && moduleKey && !keysToDelete.has(moduleKey)) {
          keysToDelete.add(moduleKey);
          changed = true;
        }
      });
    }

    const indexesToDelete = currentItems
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => {
        if (item.subjectId !== target.subjectId) return false;
        if (item.itemType === 'module') {
          return keysToDelete.has(item.moduleKey || '');
        }
        return !!item.parentModuleRef && keysToDelete.has(item.parentModuleRef);
      })
      .map(({ idx }) => idx)
      .sort((a, b) => b - a);

    if (indexesToDelete.length === 0) {
      remove(removeAtIndex);
      return;
    }

    indexesToDelete.forEach((idx) => remove(idx));
  };

  const subjectOptions = useMemo(() => {
    if (!subjects || !selectedClass) return [];
    const base = subjects.filter((s) => s.classId === selectedClass);
    if (!isTeacher) return base;
    const classAssignments = assignments.filter((a) => a.classId === selectedClass);
    if (classAssignments.length === 0) return [];
    const classSpecificSubjectIds = Array.from(new Set(classAssignments.flatMap((a) => a.subjectIds || []).filter(Boolean)));
    if (classSpecificSubjectIds.length === 0) return base;
    return base.filter((s) => classSpecificSubjectIds.includes(s.id) && allowedSubjectIds.includes(s.id));
  }, [subjects, selectedClass, isTeacher, assignments, allowedSubjectIds]);
  const subjectNameById = useMemo(
    () => Object.fromEntries((subjects || []).map((subject) => [subject.id, subject.name])),
    [subjects]
  );

  const selectedSubjectDetails = useMemo(() => {
    const ids = selectedSubjectIds || [];
    return ids.map((id) => {
      const fromOptions = subjectOptions.find((s) => s.id === id);
      if (fromOptions) return fromOptions;
      const fromAll = (subjects || []).find((s) => s.id === id);
      if (fromAll) return fromAll;
      return { id, name: 'Subject', classId: selectedClass || '' };
    });
  }, [selectedSubjectIds, subjectOptions, subjects, selectedClass]);

  useEffect(() => {
    if (hasHydratedEditFormRef.current) return;
    if (!selectedSubjectIds || selectedSubjectIds.length === 0) return;
    const chosenIds = new Set(selectedSubjectIds || []);
    const currentModules = form.getValues('modules') || [];
    const filteredModules = currentModules.filter((item) => item.subjectId && chosenIds.has(item.subjectId));
    const nextModules = [...filteredModules];

    selectedSubjectDetails.forEach((subject) => {
      const hasAny = filteredModules.some((item) => item.subjectId === subject.id);
      if (!hasAny) {
        nextModules.push({
          ...chapterDefaults,
          subjectId: subject.id,
          subjectName: subject.name,
          chapterKey: makeChapterKey(),
          title: makeChapterTitle(nextModules as z.infer<typeof itemSchema>[], subject.id),
        });
      }
    });

    if (JSON.stringify(currentModules) !== JSON.stringify(nextModules)) {
      form.setValue('modules', nextModules as z.infer<typeof itemSchema>[], { shouldDirty: true, shouldValidate: true });
    }
  }, [selectedSubjectIds, selectedSubjectDetails, form]);

  const getQuestionPool = (
    config: z.infer<typeof testCfg>,
    classId: string,
    examTypeId?: string | null
  ) =>
    (questions || []).filter((q) => {
      const matchesExamClass = (
        (q.examTypeId === (examTypeId || q.examTypeId)) && q.classId === classId
      ) || (q.alignments || []).some((a) =>
        (!examTypeId || a.examTypeId === examTypeId) && a.classId === classId
      );
      if (q.accessLevel !== config.questionAccessLevel) return false;
      const questionBankTeacherId = dcamQuestionBankOwnerId || user?.uid || '';
      if (questionBankTeacherId && q.teacherId !== questionBankTeacherId) return false;
      const isTeacherOfficialQuestion = !!q.mockTestOnly;
      if (isTeacherOfficialQuestion) return false;
      if (!matchesExamClass) return false;
      
      if (config.examLevel !== 'All' && q.examLevel !== config.examLevel) return false;
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

  const getPaidQuestionAvailabilityForSection = (
    config: z.infer<typeof testCfg>,
    section: z.infer<typeof subjectCfg>,
    classId: string,
    examTypeId?: string | null
  ) => {
    const paidPool = getQuestionPool(
      { ...config, questionAccessLevel: 'paid' as const },
      classId,
      examTypeId
    );
    const paidRows = buildTeacherPremiumQuestionRows(
      paidPool.flatMap((question) => buildPracticeQuestionScopeEntries(question)),
      {
        accessLevel: 'paid',
        teacherId: dcamQuestionBankOwnerId || undefined,
        examTypeId: examTypeId || undefined,
        classId,
        subjectId: section.subjectId,
        topicId: section.topicId || undefined,
        subtopicPaths: normalizeSubtopicSelection(section.subtopics, section.subtopic),
      }
    );

    return resolveTeacherPremiumQuestionAvailability({
      rows: paidRows,
      purchases: activeTeacherQuestionPurchases,
      minimumStudentsRequired: 1,
    });
  };

  useEffect(() => {
    if (!editingCourse) return;
    if (inlineTestsLoading) return;
    if (hasHydratedEditFormRef.current) return;
    hasHydratedEditFormRef.current = true;
    const normalizedCourseModules = asArray<ExistingCourseModule>(editingCourse.modules).filter((m): m is ExistingCourseModule => !!m && typeof m === 'object');
    const normalizedInlineTests = asArray<CourseInlineTest>(inlineCourseTests).filter((t): t is CourseInlineTest => !!t && typeof t === 'object');
    const inferredSubjectIdsFromModules = normalizedCourseModules
      .map((m) => m.subjectId || '')
      .filter(Boolean);
    const inferredSubjectIdsFromTests = normalizedInlineTests
      .map((t) => t.subjectId || '')
      .filter(Boolean);
    const normalizedSubjectIds = asStringArray(editingCourse.subjectIds);
    const initialSubjectIds = normalizedSubjectIds.length > 0
      ? normalizedSubjectIds
      : Array.from(new Set([...inferredSubjectIdsFromModules, ...inferredSubjectIdsFromTests]));
    const fallbackSubjectId = initialSubjectIds[0] || '';
    const fallbackSubjectName = (subjects || []).find((s) => s.id === fallbackSubjectId)?.name || '';
    const normalizedModules: Array<z.infer<typeof itemSchema> & { __sequenceOrder?: number }> = (normalizedCourseModules.map((m) => ({
      itemType: m.itemType === 'chapter' ? 'chapter' : (m.itemType === 'test' ? 'test' : 'module'),
      linkedTestId: '',
      subjectId: m.subjectId || fallbackSubjectId,
      subjectName: m.subjectName || fallbackSubjectName,
      moduleKey: m.moduleKey || '',
      parentModuleRef: m.parentModuleRef || '',
      chapterKey: m.chapterKey || '',
      chapterRef: m.chapterRef || '',
      heading: m.heading || '',
      subHeading: m.subHeading || '',
      title: m.title || '',
      accessLevel: m.accessLevel || 'free',
      contentType: m.contentType === 'chapter' ? 'text' : (m.contentType || 'text'),
      textBody: m.textBody || '',
      youtubeUrl: m.youtubeUrl || '',
      fileUrl: m.fileUrl || '',
      testConfig: undefined,
      __sequenceOrder: typeof m.sequenceOrder === 'number' ? m.sequenceOrder : undefined,
    })) as Array<z.infer<typeof itemSchema> & { __sequenceOrder?: number }>);

    const normalizedTests: Array<z.infer<typeof itemSchema> & { __sequenceOrder?: number }> = normalizedInlineTests.map((t) => {
      const totalQuestions = asNonNegativeNumber(t.config?.totalQuestions ?? t.config?.questionIds?.length ?? 0, 0);
      const normalizedSubjectConfigs = asArray<CourseInlineTestSubjectConfig>(t.subjectConfigs).filter((sc): sc is CourseInlineTestSubjectConfig => !!sc && typeof sc === 'object');
      const hydratedSubjectConfigs = normalizedSubjectConfigs.length > 0
        ? normalizedSubjectConfigs.map((sc) => ({
            subjectId: sc.subjectId || t.subjectId || fallbackSubjectId,
            subjectName: sc.subjectName || t.subjectName || fallbackSubjectName,
            topicId: sc.topicId || '',
            topicName: sc.topicName || '',
            subtopic: normalizeSubtopicSelection(sc.subtopics, sc.subtopic)[0] || '',
            subtopics: normalizeSubtopicSelection(sc.subtopics, sc.subtopic),
            count: asPositiveNumber(sc.count, totalQuestions > 0 ? totalQuestions : 10),
          }))
        : [{
            subjectId: t.subjectId || fallbackSubjectId,
            subjectName: t.subjectName || fallbackSubjectName,
            topicId: '',
            topicName: '',
            subtopic: '',
            subtopics: [],
            count: totalQuestions > 0 ? totalQuestions : 10,
          }];
      return {
        itemType: 'test',
        linkedTestId: t.id,
        subjectId: t.subjectId || fallbackSubjectId,
        subjectName: t.subjectName || fallbackSubjectName,
        moduleKey: '',
        parentModuleRef: t.parentModuleRef || '',
        chapterKey: '',
        chapterRef: t.chapterRef || '',
        heading: '',
        subHeading: '',
        title: t.title || 'Course Test',
        accessLevel: editingCourse.accessLevel || 'free',
        contentType: 'text',
        textBody: '',
        youtubeUrl: '',
        fileUrl: '',
        testConfig: {
          testMode: t.testMode || 'single',
          questionAccessLevel: t.questionAccessLevel || t.accessLevel || editingCourse.accessLevel || 'free',
          questionSource: COURSE_TEST_QUESTION_SOURCE,
          duration: asOptionalPositiveNumber(t.config?.duration),
          marksPerQuestion: asOptionalNonNegativeNumber(t.config?.marksPerQuestion),
          negativeMarksPerQuestion: asOptionalNonNegativeNumber(t.config?.negativeMarksPerQuestion),
          difficultyLevel: 'Easy' as const,
          examLevel: t.examLevel || 'All',
          subjectConfigs: hydratedSubjectConfigs,
        },
        __sequenceOrder: typeof t.sequenceOrder === 'number' ? t.sequenceOrder : undefined,
      } as z.infer<typeof itemSchema> & { __sequenceOrder?: number };
    });

    const combined = [...normalizedModules, ...normalizedTests]
      .sort((a, b) => {
        const ao = typeof a.__sequenceOrder === 'number' ? a.__sequenceOrder : Number.MAX_SAFE_INTEGER;
        const bo = typeof b.__sequenceOrder === 'number' ? b.__sequenceOrder : Number.MAX_SAFE_INTEGER;
        return ao - bo;
      })
      .map(({ __sequenceOrder, ...item }) => item as z.infer<typeof itemSchema>);

    form.reset({
      title: editingCourse.title || '',
      description: editingCourse.description || '',
      outcomes: editingCourse.outcomes || '',
      introductionVideoUrl: editingCourse.introduction?.youtubeUrl || '',
      introductionText: editingCourse.introduction?.textBody || '',
      accessLevel: editingCourse.accessLevel || 'free',
      examTypeId: editingCourse.examTypeId || '',
      classId: editingCourse.classId || '',
      subjectIds: initialSubjectIds,
      isCrashCourse: !!editingCourse.isCrashCourse,
      expiryDate: toDateInputValue(editingCourse.expiryDate),
      modules: combined,
    });
    const existingThumb = editingCourse.thumbnailUrl || editingCourse.imageUrl || '';
    setExistingThumbnailUrl(existingThumb);
    setThumbnailPreview(existingThumb || null);
  }, [editingCourse, inlineCourseTests, inlineTestsLoading, form, subjects]);

  const onSubmit = async (values: z.infer<typeof schema>, saveAsDraft: boolean = false) => {
    if (!user) return;
    if (!thumbnailFile && !existingThumbnailUrl) {
      toast({ variant: 'destructive', title: 'Thumbnail required', description: 'Please upload a course thumbnail.' });
      return;
    }
    setSubmitting(true);
    try {
      const selected = (classes || []).find((c) => c.id === values.classId);
      if (!selected) throw new Error('Invalid class');
      if ((selected.examTypeId || '') !== values.examTypeId) throw new Error('Selected class does not match selected exam type');
      let thumbnailUrl = existingThumbnailUrl;
      if (thumbnailFile) {
        const sanitizedName = thumbnailFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const thumbnailRef = ref(storage, `course_thumbnails/${user.uid}/${Date.now()}_${sanitizedName}`);
        const thumbnailSnapshot = await uploadBytes(thumbnailRef, thumbnailFile);
        thumbnailUrl = await getDownloadURL(thumbnailSnapshot.ref);
      }

      const courseRef = doc(firestore, 'courses', editId);
      const modulesForCourse: any[] = [];
      let nonTestCount = 0;
      const shouldSaveAsDraft = saveAsDraft || values.accessLevel === 'paid';
      const moduleFieldIds = fields.map((f) => f.id);

      for (let i = 0; i < values.modules.length; i += 1) {
        const item = values.modules[i];
        const fieldId = moduleFieldIds[i];
        const resolvedChapterKey = item.chapterKey || `chapter_${i}`;
        const resolvedModuleKey = item.itemType === 'module' ? (item.moduleKey || `module_${i}`) : '';
        if (item.itemType === 'test') {
          const cfg = item.testConfig!;
          const questionIds: string[] = [];
          const normalizedSubjectConfigs = cfg.subjectConfigs.map((sc) => {
            const requestedSubtopics = normalizeSubtopicSelection(sc.subtopics, sc.subtopic);
            if (!sc.topicId || requestedSubtopics.length === 0) {
              return { ...sc, subtopic: '', subtopics: [] as string[] };
            }
            const validRequestedSubtopics = requestedSubtopics.filter((subtopic) => {
              const requestedKey = subtopic.toLowerCase();
              const scopeQuestions = cfg.questionAccessLevel === 'paid'
                ? getPaidQuestionAvailabilityForSection(cfg, sc, values.classId, values.examTypeId || null).selectableRows.map((row) => row.question)
                : getQuestionPool(cfg, values.classId, values.examTypeId || null);
              return scopeQuestions.some((q) =>
                q.subjectId === sc.subjectId
                && q.topicId === sc.topicId
                && (q.subtopics || []).some((value) => value.trim().toLowerCase() === requestedKey)
              );
            });
            return {
              ...sc,
              subtopic: validRequestedSubtopics[0] || '',
              subtopics: validRequestedSubtopics,
            };
          });
          for (const sc of normalizedSubjectConfigs) {
            const subtopicFilters = normalizeSubtopicSelection(sc.subtopics, sc.subtopic).map((value) => value.toLowerCase());
            const candidates = (
              cfg.questionAccessLevel === 'paid'
                ? getPaidQuestionAvailabilityForSection(cfg, sc, values.classId, values.examTypeId || null).selectableRows.map((row) => row.question)
                : getQuestionPool(cfg, values.classId, values.examTypeId || null)
            ).filter((q) => {
              const matchesScope =
              sc.topicId
                ? (
                  q.subjectId === sc.subjectId
                  && q.topicId === sc.topicId
                  && q.classId === values.classId
                  && q.examTypeId === (values.examTypeId || q.examTypeId)
                )
                : (
                  (q.subjectId === sc.subjectId && q.classId === values.classId && q.examTypeId === (values.examTypeId || q.examTypeId))
                  || (q.alignments || []).some((a) => a.subjectId === sc.subjectId && a.classId === values.classId && a.examTypeId === values.examTypeId)
                );
              if (!matchesScope) return false;
              if (subtopicFilters.length === 0) return true;
              return (q.subtopics || []).some((value) => subtopicFilters.includes(value.trim().toLowerCase()));
            }).filter((q) => !questionIds.includes(q.id));
            if (candidates.length < sc.count) throw new Error(`Not enough questions for "${item.title}" / subject ${sc.subjectName}`);
            questionIds.push(...[...candidates].sort(() => 0.5 - Math.random()).slice(0, sc.count).map((q) => q.id));
          }
          const duration = typeof cfg.duration === 'number' && Number.isFinite(cfg.duration) && cfg.duration > 0 ? cfg.duration : undefined;
          const marksPerQuestion = typeof cfg.marksPerQuestion === 'number' && Number.isFinite(cfg.marksPerQuestion) && cfg.marksPerQuestion >= 0 ? cfg.marksPerQuestion : undefined;
          const negativeMarksPerQuestion = typeof cfg.negativeMarksPerQuestion === 'number' && Number.isFinite(cfg.negativeMarksPerQuestion) && cfg.negativeMarksPerQuestion >= 0 ? cfg.negativeMarksPerQuestion : undefined;
          const existingTestId = (item.linkedTestId || '').trim();
          const tRef = existingTestId ? doc(firestore, 'mock_tests', existingTestId) : doc(collection(firestore, 'mock_tests'));
          await setDocumentNonBlocking(tRef, {
            teacherId: user.uid,
            title: item.title,
            subjectId: item.subjectId,
            subjectName: item.subjectName || '',
            chapterRef: item.chapterRef || null,
            parentModuleRef: item.parentModuleRef || null,
            accessLevel: values.accessLevel === 'paid' ? item.accessLevel : 'free',
            isCourseOnly: true,
            courseId: courseRef.id,
            insertAfterModuleIndex: nonTestCount - 1,
            sequenceOrder: i,
            examTypeId: values.examTypeId || null,
            classId: values.classId,
            testMode: cfg.testMode,
            questionAccessLevel: cfg.questionAccessLevel,
            questionSource: COURSE_TEST_QUESTION_SOURCE,
            difficultyLevel: 'Easy' as const,
            examLevel: cfg.examLevel,
            subjectConfigs: normalizedSubjectConfigs.map((sc) => ({
              ...sc,
              subtopic: sc.subtopic || '',
              subtopics: normalizeSubtopicSelection(sc.subtopics, sc.subtopic),
            })),
            config: {
              questionIds,
              totalQuestions: questionIds.length,
              ...(duration !== undefined ? { duration } : {}),
              ...(marksPerQuestion !== undefined ? { marksPerQuestion } : {}),
              ...(negativeMarksPerQuestion !== undefined ? { negativeMarksPerQuestion } : {}),
            },
            updatedAt: serverTimestamp(),
            ...(existingTestId ? {} : { createdAt: serverTimestamp() }),
          }, { merge: false });
        } else {
          let resolvedFileUrl = item.fileUrl || '';
          if (item.itemType === 'module' && (item.contentType === 'pdf' || item.contentType === 'word')) {
            const selectedFile = fieldId ? moduleFileByFieldId[fieldId] : null;
            if (selectedFile) {
              const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
              const moduleFileRef = ref(storage, `course_module_files/${user.uid}/${courseRef.id}/${Date.now()}_${sanitizedName}`);
              const uploaded = await uploadBytes(moduleFileRef, selectedFile);
              resolvedFileUrl = await getDownloadURL(uploaded.ref);
            }
            if (!resolvedFileUrl) {
              throw new Error(`Upload file required for module "${item.title}"`);
            }
          }

          modulesForCourse.push({
            id: `${Date.now()}_${i}`,
            subjectId: item.subjectId,
            subjectName: item.subjectName || '',
            moduleKey: item.itemType === 'module' ? resolvedModuleKey : null,
            parentModuleRef: item.parentModuleRef || null,
            chapterKey: item.itemType === 'chapter' ? resolvedChapterKey : null,
            chapterRef: item.chapterRef || null,
            heading: item.heading || item.title,
            subHeading: item.subHeading || '',
            title: item.title,
            contentType: item.itemType === 'chapter' ? 'chapter' : item.contentType,
            accessLevel: item.itemType === 'chapter' ? 'free' : values.accessLevel === 'paid' ? item.accessLevel : 'free',
            youtubeUrl: item.youtubeUrl || '',
            textBody: item.textBody || '',
            fileUrl: resolvedFileUrl,
            itemType: item.itemType,
            sequenceOrder: i,
          });
          if (item.itemType === 'module') nonTestCount += 1;
        }
      }

      const nextPublicationStatus = shouldSaveAsDraft ? 'draft' : 'published';

      await setDocumentNonBlocking(courseRef, {
        title: values.title,
        description: values.description,
        outcomes: values.outcomes || '',
        introduction: {
          youtubeUrl: values.introductionVideoUrl,
          textBody: values.introductionText,
        },
        imageUrl: thumbnailUrl,
        thumbnailUrl,
        accessLevel: values.accessLevel,
        subscriptionAttached: values.accessLevel === 'free',
        publicationStatus: nextPublicationStatus,
        price: values.accessLevel === 'paid' ? 1 : 0,
        classId: values.classId,
        classLevel: selected.name,
        examTypeId: values.examTypeId || null,
        subjectIds: values.subjectIds,
        isCrashCourse: values.isCrashCourse,
        expiryDate: values.expiryDate || null,
        modules: modulesForCourse,
        teacherId: user.uid,
        teacherName: user.displayName || 'Anonymous Teacher',
        createdAt: serverTimestamp(),
      }, { merge: false });

      if (nextPublicationStatus === 'published' && editingCourse?.publicationStatus !== 'published') {
        await notifyTeacherPublication(user, {
          contentType: 'course',
          contentId: editId,
        });
      }

      toast({
        title: values.accessLevel === 'paid'
          ? 'Course Waiting for Subscription'
          : shouldSaveAsDraft
            ? 'Course Saved as Draft'
            : 'Course Updated',
        description: values.accessLevel === 'paid'
          ? `${values.title} is saved and moved to waiting for subscription.`
          : shouldSaveAsDraft
            ? `${values.title} saved in draft.`
            : `${values.title} saved successfully.`,
      });
      const redirectPath = values.accessLevel === 'paid'
        ? '/courses?view=waiting-subscription'
        : shouldSaveAsDraft
          ? '/courses?view=draft'
          : '/courses?view=your';
      router.push(redirectPath);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: e.message || 'Unexpected error' });
    } finally {
      setSubmitting(false);
    }
  };

  const loading = classesLoading || examTypesLoading || subjectsLoading || topicsLoading || questionsLoading || inlineTestsLoading || editingCourseLoading;
  const canEditThisCourse = !!(isTeacher && user?.uid && editingCourse?.teacherId === user.uid);
  const selectedExamName = (examTypes || []).find((e) => e.id === form.getValues('examTypeId'))?.name || 'Not set';
  const selectedClassName = (classes || []).find((c) => c.id === form.getValues('classId'))?.name || 'Not set';
  const selectedSubjectNames = selectedSubjectDetails.map((s) => s.name);

  if (!loading && !editingCourse) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Edit Course" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Course Not Found</CardTitle>
                <CardDescription>The course does not exist or has been removed.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  if (!loading && !canEditThisCourse) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Edit Course" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Access denied</CardTitle>
                <CardDescription>You can only edit courses created by your account.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Edit Course" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Course Builder (Edit)</CardTitle>
              <CardDescription>Add modules and in-course tests. Drag items to reorder with mouse.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-64 w-full" /> : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((values) => onSubmit(values, false))} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormItem>
                        <FormLabel>Exam & Curriculum</FormLabel>
                        <div className="rounded-md border p-3 text-sm text-muted-foreground">
                          <p><span className="text-foreground font-medium">Exam:</span> {selectedExamName}</p>
                          <p className="mt-1"><span className="text-foreground font-medium">Curriculum:</span> {selectedClassName}</p>
                        </div>
                      </FormItem>
                      <FormItem>
                        <FormLabel>Subjects</FormLabel>
                        <div className="rounded-md border p-3 text-sm text-muted-foreground">
                          {selectedSubjectNames.length > 0 ? selectedSubjectNames.join(', ') : 'No subjects mapped'}
                        </div>
                      </FormItem>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="accessLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Course Access</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="free">Free</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              {field.value === 'paid'
                                ? 'Introduction stays free. You can mark individual modules, submodules, and tests as free preview or keep them locked until purchase.'
                                : 'All modules, submodules, and tests are unlocked for every student.'}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="expiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Course Expiry Date</FormLabel>
                            <FormControl>
                              <Input type="date" value={field.value || ''} onChange={field.onChange} />
                            </FormControl>
                            <FormDescription>After this date ends, this course will be hidden from students.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField control={form.control} name="title" render={({ field }) => <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="outcomes" render={({ field }) => <FormItem><FormLabel>Course Outcomes</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormDescription>What students will achieve after completing this course.</FormDescription><FormMessage /></FormItem>} />
                    <div className="space-y-3 rounded-md border p-4">
                      <h3 className="font-semibold">Fixed Module: Course Introduction</h3>
                      <div className="rounded-md border border-cyan-300/25 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-100">
                        Introduction video and introduction text are always free for students, even when the course access is set to paid.
                      </div>
                      <FormField
                        control={form.control}
                        name="introductionVideoUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>YouTube Video URL</FormLabel>
                            <FormControl><Input placeholder="https://www.youtube.com/watch?v=..." {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="introductionText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Introduction Text</FormLabel>
                            <FormControl><Textarea rows={4} placeholder="Write course introduction..." {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormItem>
                      <FormLabel>Course Thumbnail</FormLabel>
                      <FormControl><Input type="file" accept="image/*" onChange={handleThumbnailChange} /></FormControl>
                      <FormDescription>Upload image thumbnail (max 5MB).</FormDescription>
                      {thumbnailPreview ? <img src={thumbnailPreview} alt="Thumbnail preview" className="mt-2 h-40 w-auto rounded-md border object-cover" /> : null}
                    </FormItem>
                    <FormField
                      control={form.control}
                      name="isCrashCourse"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Crash Course</FormLabel>
                            <FormDescription>Enable this if this course should appear under crash courses for students.</FormDescription>
                          </div>
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="space-y-4 rounded-2xl border border-slate-500/30 bg-gradient-to-br from-slate-900/80 via-blue-950/20 to-slate-900/75 p-5">
                      <h3 className="font-semibold">Course Flow</h3>
                      <FormDescription>Selected subjects create separate flow boxes. Build chapter, module, and test inside each subject.</FormDescription>

                      {selectedSubjectDetails.length === 0 ? (
                        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Select at least one subject to start building subject-wise flow.</div>
                      ) : selectedSubjectDetails.map((subject) => {
                        const subjectIndexes = fields
                          .map((_, idx) => idx)
                          .filter((idx) => form.watch(`modules.${idx}.subjectId`) === subject.id);

                        return (
                          <div key={subject.id} className="space-y-4 rounded-xl border border-slate-500/30 bg-slate-950/45 p-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-lg font-semibold text-cyan-100">{subject.name}</h4>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-10 rounded-full border-cyan-300/35 bg-cyan-500/10 px-4 font-semibold text-cyan-100 hover:bg-cyan-500/20"
                                onClick={() => append({
                                  ...chapterDefaults,
                                  subjectId: subject.id,
                                  subjectName: subject.name,
                                  chapterKey: makeChapterKey(),
                                  title: makeChapterTitle(form.getValues('modules') as z.infer<typeof itemSchema>[], subject.id),
                                })}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Chapter
                              </Button>
                            </div>

                            {subjectIndexes.length === 0 ? (
                              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No flow items yet for {subject.name}.</div>
                            ) : subjectIndexes.map((i) => {
                              const itemType = form.watch(`modules.${i}.itemType`);
                              const chapterRef = form.watch(`modules.${i}.chapterRef`);
                              const chapterKey = form.watch(`modules.${i}.chapterKey`) || `chapter_${i}`;
                              const contentType = form.watch(`modules.${i}.contentType`);
                              const testMode = form.watch(`modules.${i}.testConfig.testMode`) || 'single';
                              const testSubjects = form.watch(`modules.${i}.testConfig.subjectConfigs`) || [];
                              const testCfgNow = form.watch(`modules.${i}.testConfig`) as z.infer<typeof testCfg> | undefined;
                              const subjectsForTest = subjectOptions.filter((s) => s.id === subject.id);
                              const selectedClassDef = (classes || []).find((c) => c.id === selectedClass);
                              const pool = testCfgNow && selectedClass ? getQuestionPool(testCfgNow, selectedClass, selectedClassDef?.examTypeId || null) : [];
                              const getBankCount = (subjectId: string, topicId?: string, selectedSubtopics: string[] = []) => {
                                const normalizedSubtopics = normalizeSubtopicSelection(selectedSubtopics).map((value) => value.toLowerCase());
                                const sectionScope = {
                                  subjectId,
                                  subjectName: subjectNameById[subjectId] || '',
                                  topicId: topicId || '',
                                  topicName: topicId ? (topics || []).find((topic) => topic.id === topicId)?.name || '' : '',
                                  subtopic: selectedSubtopics[0] || '',
                                  subtopics: normalizeSubtopicSelection(selectedSubtopics),
                                  count: 0,
                                };
                                const scopedPool = testCfgNow?.questionAccessLevel === 'paid'
                                  ? getPaidQuestionAvailabilityForSection(testCfgNow, sectionScope, selectedClass, selectedClassDef?.examTypeId || null).selectableRows.map((row) => row.question)
                                  : (testCfgNow && selectedClass ? getQuestionPool(testCfgNow, selectedClass, selectedClassDef?.examTypeId || null) : []);
                                return scopedPool.filter((q) => {
                                  const matchesScope = topicId
                                    ? (q.subjectId === subjectId && q.topicId === topicId && q.classId === selectedClass && q.examTypeId === selectedClassDef?.examTypeId)
                                    : ((q.subjectId === subjectId && q.classId === selectedClass && q.examTypeId === selectedClassDef?.examTypeId)
                                        || (q.alignments || []).some((a) => a.subjectId === subjectId && a.classId === selectedClass && a.examTypeId === selectedClassDef?.examTypeId));
                                  if (!matchesScope) return false;
                                  if (normalizedSubtopics.length === 0) return true;
                                  return (q.subtopics || []).some((value) => normalizedSubtopics.includes(value.trim().toLowerCase()));
                                }).length;
                              };
                              const chapterItems = form.getValues('modules').filter((m) => m.itemType === 'chapter' && m.subjectId === subject.id);
                              const chapterLabel = chapterRef ? (chapterItems.find((c) => c.chapterKey === chapterRef)?.title || 'Chapter') : null;
                              const moduleItems = form.getValues('modules').filter((m) => m.itemType === 'module' && m.subjectId === subject.id);
                              const parentModuleRef = form.watch(`modules.${i}.parentModuleRef`) || '';
                              const parentModuleLabel = parentModuleRef
                                ? (moduleItems.find((m) => (m.moduleKey || '') === parentModuleRef)?.title || 'Module')
                                : null;
                              const moduleDepth = itemType === 'module'
                                ? getModuleDepth(form.getValues('modules') as z.infer<typeof itemSchema>[], i)
                                : 0;
                              const insidePath = [chapterLabel, parentModuleLabel].filter(Boolean).join(' > ');
                              const chapterNumber = itemType === 'chapter'
                                ? form.getValues('modules').slice(0, i + 1).filter((m) => m.itemType === 'chapter' && m.subjectId === subject.id).length
                                : null;

                              return (
                                <div
                                  key={fields[i].id}
                                  className={`space-y-3 rounded-xl border border-slate-500/30 bg-slate-950/35 p-4 ${itemType === 'module' && moduleDepth > 0 ? 'bg-slate-900/55' : ''}`}
                                  style={itemType === 'module' && moduleDepth > 0 ? { marginLeft: `${Math.min(moduleDepth, 4) * 16}px` } : undefined}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{itemType === 'chapter' ? `Chapter ${chapterNumber}` : `Item ${i + 1}`}</span></div>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      className="h-10 rounded-lg"
                                      onClick={() => removeItemWithNestedModules(i)}
                                      disabled={subjectIndexes.length === 1}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />Remove
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <FormItem>
                                      <FormLabel>Type</FormLabel>
                                      <div className="flex h-11 items-center rounded-xl border border-slate-500/30 bg-slate-900/60 px-3 text-sm font-medium text-slate-100">
                                        {itemType === 'chapter' ? 'Chapter' : itemType === 'test' ? 'Test' : 'Module'}
                                      </div>
                                    </FormItem>
                                    <FormField control={form.control} name={`modules.${i}.title`} render={({ field }) => <FormItem><FormLabel>{itemType === 'test' ? 'Test Title' : itemType === 'chapter' ? 'Chapter Name' : 'Title'}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>} />
                                  </div>
                                  {isPaidCourse && itemType !== 'chapter' ? (
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,220px)_1fr]">
                                      <FormField
                                        control={form.control}
                                        name={`modules.${i}.accessLevel`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>{itemType === 'test' ? 'Test Access' : 'Lesson Access'}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                              <SelectContent>
                                                <SelectItem value="paid">Locked Until Purchase</SelectItem>
                                                <SelectItem value="free">Free Preview</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </FormItem>
                                        )}
                                      />
                                      <div className="rounded-md border border-slate-500/30 bg-slate-900/45 px-3 py-2.5 text-sm text-slate-300">
                                        {itemType === 'test'
                                          ? 'Free preview tests open without course payment. Locked tests unlock after the course is purchased.'
                                          : 'Free preview lessons stay open in paid courses. Locked lessons and submodules unlock after the course is purchased.'}
                                      </div>
                                    </div>
                                  ) : null}
                                  {insidePath && itemType !== 'chapter' ? (
                                    <div className="text-xs text-muted-foreground">Inside: <span className="font-medium">{insidePath}</span></div>
                                  ) : null}

                                  {itemType === 'chapter' ? (
                                    <div className="space-y-3 rounded-xl border border-slate-500/30 bg-slate-900/55 p-3">
                                      <FormDescription>Chapter is a separator section in course flow.</FormDescription>
                                      <FormField control={form.control} name={`modules.${i}.textBody`} render={({ field }) => <FormItem><FormLabel>Chapter Description (optional)</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>} />
                                      <div className="flex gap-2">
                                        <Button type="button" variant="outline" size="sm" className="rounded-full border-cyan-300/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20" onClick={() => {
                                          const modulesNow = form.getValues('modules') as z.infer<typeof itemSchema>[];
                                          const insertAt = getChapterBlockLastIndex(modulesNow, chapterKey, subject.id, i) + 1;
                                          insert(insertAt, {
                                            ...moduleDefaults,
                                            accessLevel: isPaidCourse ? 'paid' : 'free',
                                            subjectId: subject.id,
                                            subjectName: subject.name,
                                            chapterRef: chapterKey,
                                            moduleKey: makeModuleKey(),
                                            parentModuleRef: '',
                                          });
                                        }}>
                                          <PlusCircle className="mr-2 h-4 w-4" /> Add Module in Chapter
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" className="rounded-full border-cyan-300/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20" onClick={() => {
                                          const modulesNow = form.getValues('modules') as z.infer<typeof itemSchema>[];
                                          const insertAt = getChapterBlockLastIndex(modulesNow, chapterKey, subject.id, i) + 1;
                                          insert(insertAt, {
                                            ...testDefaults,
                                            accessLevel: isPaidCourse ? 'paid' : 'free',
                                            subjectId: subject.id,
                                            subjectName: subject.name,
                                            chapterRef: chapterKey,
                                            testConfig: { ...testDefaults.testConfig, subjectConfigs: [{ subjectId: subject.id, subjectName: subject.name, topicId: '', topicName: '', subtopic: '', subtopics: [], count: 10 }] },
                                          });
                                        }}>
                                          <PlusCircle className="mr-2 h-4 w-4" /> Add Test in Chapter
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" className="rounded-full border-cyan-300/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20" onClick={() => {
                                          const modulesNow = form.getValues('modules') as z.infer<typeof itemSchema>[];
                                          const insertAt = getChapterBlockLastIndex(modulesNow, chapterKey, subject.id, i) + 1;
                                          insert(insertAt, { ...chapterDefaults, subjectId: subject.id, subjectName: subject.name, chapterKey: makeChapterKey(), title: makeChapterTitle(modulesNow, subject.id) });
                                        }}>
                                          <PlusCircle className="mr-2 h-4 w-4" /> Add Chapter After This
                                        </Button>
                                      </div>
                                    </div>
                                  ) : itemType === 'module' ? (
                                    <div className="space-y-3">
                                      <div className="flex flex-wrap gap-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="rounded-full border-cyan-300/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                                          onClick={() => {
                                            const modulesNow = form.getValues('modules') as z.infer<typeof itemSchema>[];
                                            let currentModuleKey = form.getValues(`modules.${i}.moduleKey`) || '';
                                            if (!currentModuleKey) {
                                              currentModuleKey = makeModuleKey();
                                              form.setValue(`modules.${i}.moduleKey`, currentModuleKey, { shouldDirty: true, shouldValidate: true });
                                            }
                                            const insertAt = getNestedModuleBlockLastIndex(modulesNow, currentModuleKey, subject.id, i) + 1;
                                            insert(insertAt, {
                                              ...moduleDefaults,
                                              accessLevel: isPaidCourse ? 'paid' : 'free',
                                              subjectId: subject.id,
                                              subjectName: subject.name,
                                              chapterRef: chapterRef || '',
                                              moduleKey: makeModuleKey(),
                                              parentModuleRef: currentModuleKey,
                                            });
                                          }}
                                        >
                                          <PlusCircle className="mr-2 h-4 w-4" /> Add Submodule
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="rounded-full border-cyan-300/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                                          onClick={() => {
                                            const modulesNow = form.getValues('modules') as z.infer<typeof itemSchema>[];
                                            let currentModuleKey = form.getValues(`modules.${i}.moduleKey`) || '';
                                            if (!currentModuleKey) {
                                              currentModuleKey = makeModuleKey();
                                              form.setValue(`modules.${i}.moduleKey`, currentModuleKey, { shouldDirty: true, shouldValidate: true });
                                            }
                                            const insertAt = getNestedModuleBlockLastIndex(modulesNow, currentModuleKey, subject.id, i) + 1;
                                            insert(insertAt, {
                                              ...testDefaults,
                                              accessLevel: isPaidCourse ? 'paid' : 'free',
                                              subjectId: subject.id,
                                              subjectName: subject.name,
                                              chapterRef: chapterRef || '',
                                              parentModuleRef: currentModuleKey,
                                              testConfig: {
                                                ...testDefaults.testConfig,
                                                subjectConfigs: [{ subjectId: subject.id, subjectName: subject.name, topicId: '', topicName: '', subtopic: '', subtopics: [], count: 10 }],
                                              },
                                            });
                                          }}
                                        >
                                          <PlusCircle className="mr-2 h-4 w-4" /> Add Test in Module
                                        </Button>
                                      </div>
                                      <FormField control={form.control} name={`modules.${i}.contentType`} render={({ field }) => <FormItem><FormLabel>Content Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="youtube">YouTube</SelectItem><SelectItem value="pdf">PDF File</SelectItem><SelectItem value="word">Word File</SelectItem></SelectContent></Select></FormItem>} />
                                      {contentType === 'text' && <FormField control={form.control} name={`modules.${i}.textBody`} render={({ field }) => <FormItem><FormLabel>Text</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl></FormItem>} />}
                                      {contentType === 'youtube' && <FormField control={form.control} name={`modules.${i}.youtubeUrl`} render={({ field }) => <FormItem><FormLabel>YouTube URL</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>} />}
                                      {(contentType === 'pdf' || contentType === 'word') && (
                                        <FormItem>
                                          <FormLabel>{contentType === 'pdf' ? 'Upload PDF' : 'Upload Word File'}</FormLabel>
                                          <FormControl>
                                            <Input
                                              type="file"
                                              accept={contentType === 'pdf' ? '.pdf,application/pdf' : '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
                                              onChange={(e) => handleModuleFileChange(fields[i].id, e.target.files?.[0])}
                                            />
                                          </FormControl>
                                          <FormDescription>
                                            {moduleFileByFieldId[fields[i].id]?.name
                                              ? `Selected: ${moduleFileByFieldId[fields[i].id]?.name}`
                                              : (form.watch(`modules.${i}.fileUrl`) ? 'Existing file is linked. Upload to replace it.' : 'Upload directly; URL will be generated automatically.')}
                                          </FormDescription>
                                        </FormItem>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="space-y-4 rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-slate-900/85 via-blue-950/35 to-slate-900/80 p-4">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <FormDescription className="text-sm text-slate-200/85">Build this test using the same section-wise flow as practice session.</FormDescription>
                                        <Badge variant="outline" className="border-cyan-300/35 bg-cyan-500/10 text-cyan-100">{pool.length} eligible questions</Badge>
                                      </div>

                                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <FormField control={form.control} name={`modules.${i}.testConfig.testMode`} render={({ field }) => (
                                          <FormItem><FormLabel>Mode</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 rounded-xl border-slate-500/30 bg-white/[0.04]"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="single">Single</SelectItem><SelectItem value="multi">Multi</SelectItem></SelectContent></Select></FormItem>
                                        )} />
                                        <FormField control={form.control} name={`modules.${i}.testConfig.questionAccessLevel`} render={({ field }) => (
                                          <FormItem><FormLabel>Question Access</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 rounded-xl border-slate-500/30 bg-white/[0.04]"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent></Select></FormItem>
                                        )} />
                                      </div>

                                      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                                        <FormField control={form.control} name={`modules.${i}.testConfig.duration`} render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Duration (min)</FormLabel>
                                            <FormControl>
                                              <Input
                                                className="h-11 rounded-xl border-slate-500/30 bg-white/[0.04]"
                                                type="number"
                                                placeholder="Leave blank for untimed"
                                                value={field.value ?? ''}
                                                onChange={(event) => field.onChange(event.target.value === '' ? undefined : event.target.value)}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )} />
                                        <FormField control={form.control} name={`modules.${i}.testConfig.marksPerQuestion`} render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Marks/Q</FormLabel>
                                            <FormControl>
                                              <Input
                                                className="h-11 rounded-xl border-slate-500/30 bg-white/[0.04]"
                                                type="number"
                                                placeholder="Optional"
                                                value={field.value ?? ''}
                                                onChange={(event) => field.onChange(event.target.value === '' ? undefined : event.target.value)}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )} />
                                        <FormField control={form.control} name={`modules.${i}.testConfig.negativeMarksPerQuestion`} render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Negative/Q</FormLabel>
                                            <FormControl>
                                              <Input
                                                className="h-11 rounded-xl border-slate-500/30 bg-white/[0.04]"
                                                type="number"
                                                placeholder="Optional"
                                                value={field.value ?? ''}
                                                onChange={(event) => field.onChange(event.target.value === '' ? undefined : event.target.value)}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )} />
                                        
                                        <FormField control={form.control} name={`modules.${i}.testConfig.examLevel`} render={({ field }) => (
                                          <FormItem><FormLabel>Exam Level</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 rounded-xl border-slate-500/30 bg-white/[0.04]"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="weak">Weak</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="strong">Strong</SelectItem></SelectContent></Select></FormItem>
                                        )} />
                                      </div>
                                      <p className="text-xs text-slate-300/80">
                                        Leave duration blank for an untimed course test. Leave marks and negative blank to show only correct, incorrect, and accuracy details in the result.
                                      </p>

                                      <div className="space-y-3">
                                        <p className="text-[11px] uppercase tracking-[0.13em] text-cyan-200">Step 3 · Section-Wise Question Distribution</p>
                                        {testSubjects.map((_, si) => {
                                          const subjectFieldPath = `modules.${i}.testConfig.subjectConfigs.${si}.subjectId` as const;
                                          const topicFieldPath = `modules.${i}.testConfig.subjectConfigs.${si}.topicId` as const;
                                          const topicNameFieldPath = `modules.${i}.testConfig.subjectConfigs.${si}.topicName` as const;
                                          const subjectNameFieldPath = `modules.${i}.testConfig.subjectConfigs.${si}.subjectName` as const;
                                          const legacySubtopicFieldPath = `modules.${i}.testConfig.subjectConfigs.${si}.subtopic` as const;
                                          const subtopicsFieldPath = `modules.${i}.testConfig.subjectConfigs.${si}.subtopics` as const;
                                          const currentSubjectId = form.watch(subjectFieldPath) || '';
                                          const currentTopicId = form.watch(topicFieldPath) || '';
                                          const selectedSubtopics = normalizeSubtopicSelection(
                                            (form.watch(subtopicsFieldPath) || []) as string[],
                                            form.watch(legacySubtopicFieldPath) || ''
                                          );
                                          const topicOptions = (topics || []).filter((topic) => topic.subjectId === currentSubjectId);
                                          const subtopicOptions = currentTopicId
                                            ? Array.from(new Set(
                                              pool
                                                .filter((q) => q.subjectId === currentSubjectId && q.topicId === currentTopicId)
                                                .flatMap((q) => q.subtopics || [])
                                                .map((value) => value.trim())
                                                .filter(Boolean)
                                            )).sort((a, b) => a.localeCompare(b))
                                            : [];
                                          const activeSubtopics = selectedSubtopics.filter((selected) =>
                                            subtopicOptions.some((option) => option.trim().toLowerCase() === selected.trim().toLowerCase())
                                          );

                                          const setSectionSubtopics = (nextSubtopics: string[]) => {
                                            const normalized = normalizeSubtopicSelection(nextSubtopics);
                                            form.setValue(subtopicsFieldPath as any, normalized as any, { shouldDirty: true, shouldValidate: true });
                                            form.setValue(legacySubtopicFieldPath as any, normalized[0] || '', { shouldDirty: true, shouldValidate: true });
                                          };

                                          return (
                                            <div key={`${fields[i].id}-${si}`} className="space-y-3 rounded-xl border border-slate-500/30 bg-slate-950/45 p-3">
                                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <FormField control={form.control} name={subjectFieldPath} render={({ field }) => (
                                                  <FormItem><FormLabel>Subject</FormLabel><Select onValueChange={(value) => { field.onChange(value); form.setValue(subjectNameFieldPath as any, subjectsForTest.find((s) => s.id === value)?.name || ''); form.setValue(topicFieldPath as any, ''); form.setValue(topicNameFieldPath as any, ''); form.setValue(legacySubtopicFieldPath as any, ''); form.setValue(subtopicsFieldPath as any, [] as any); }} value={field.value}><FormControl><SelectTrigger className="h-11 rounded-xl border-slate-500/30 bg-white/[0.04]"><SelectValue placeholder="Select subject" /></SelectTrigger></FormControl><SelectContent>{subjectsForTest.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></FormItem>
                                                )} />
                                                <FormField control={form.control} name={topicFieldPath} render={({ field }) => (
                                                  <FormItem><FormLabel>Topic</FormLabel><Select onValueChange={(value) => { const normalizedTopicId = value === '__all_topics__' ? '' : value; field.onChange(normalizedTopicId); form.setValue(topicNameFieldPath as any, topicOptions.find((t) => t.id === normalizedTopicId)?.name || ''); form.setValue(legacySubtopicFieldPath as any, ''); form.setValue(subtopicsFieldPath as any, [] as any); }} value={field.value || '__all_topics__'}><FormControl><SelectTrigger className="h-11 rounded-xl border-slate-500/30 bg-white/[0.04]"><SelectValue placeholder="All topics" /></SelectTrigger></FormControl><SelectContent><SelectItem value="__all_topics__">All topics</SelectItem>{topicOptions.map((topic) => <SelectItem key={topic.id} value={topic.id}>{topic.name}</SelectItem>)}</SelectContent></Select></FormItem>
                                                )} />
                                              </div>

                                              {currentTopicId ? (
                                                <div className="space-y-2 rounded-xl border border-slate-500/25 bg-slate-900/55 p-3">
                                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="text-xs font-medium text-slate-200">Subtopic Combination</p>
                                                    <Button
                                                      type="button"
                                                      size="sm"
                                                      variant={activeSubtopics.length === 0 ? 'default' : 'outline'}
                                                      className={activeSubtopics.length === 0 ? 'h-8 rounded-full bg-cyan-500 text-slate-950 hover:bg-cyan-400' : 'h-8 rounded-full border-cyan-300/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20'}
                                                      onClick={() => setSectionSubtopics([])}
                                                    >
                                                      All subtopics
                                                    </Button>
                                                  </div>
                                                  {subtopicOptions.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">No subtopics found in the question bank for this topic.</p>
                                                  ) : (
                                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                      {subtopicOptions.map((subtopic) => {
                                                        const isChecked = activeSubtopics.some((value) => value.trim().toLowerCase() === subtopic.trim().toLowerCase());
                                                        return (
                                                          <button
                                                            key={`${fields[i].id}-${si}-${subtopic}`}
                                                            type="button"
                                                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition ${isChecked ? 'border-cyan-300/50 bg-cyan-500/15 text-cyan-50' : 'border-slate-600/50 bg-slate-950/40 text-slate-200 hover:border-slate-400/60'}`}
                                                            onClick={() => {
                                                              const next = isChecked
                                                                ? activeSubtopics.filter((value) => value.trim().toLowerCase() !== subtopic.trim().toLowerCase())
                                                                : [...activeSubtopics, subtopic];
                                                              setSectionSubtopics(next);
                                                            }}
                                                          >
                                                            <Checkbox checked={isChecked} className="pointer-events-none" />
                                                            <span className="truncate">{subtopic}</span>
                                                          </button>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                  <p className="text-xs text-muted-foreground">{activeSubtopics.length === 0 ? 'All subtopics are included for this topic.' : `${activeSubtopics.length} subtopic${activeSubtopics.length === 1 ? '' : 's'} selected.`}</p>
                                                </div>
                                              ) : (
                                                <p className="text-xs text-muted-foreground">Select a topic to choose all subtopics or a custom subtopic combination.</p>
                                              )}

                                              <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_140px_auto] md:items-end">
                                                <FormField control={form.control} name={`modules.${i}.testConfig.subjectConfigs.${si}.count`} render={({ field }) => <FormItem><FormLabel>Questions</FormLabel><FormControl><Input className="h-11 rounded-xl border-slate-500/30 bg-white/[0.04]" type="number" min={1} {...field} /></FormControl></FormItem>} />
                                                <div className="rounded-xl border border-slate-500/30 bg-slate-950/35 px-3 py-2 text-sm">
                                                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Bank Count</p>
                                                  <p className="mt-1 text-base font-semibold text-cyan-100">{getBankCount(currentSubjectId, currentTopicId, activeSubtopics)}</p>
                                                </div>
                                                {testMode === 'multi' ? (
                                                  <div className="flex justify-end">
                                                    <Button type="button" variant="destructive" size="sm" className="h-10 rounded-lg" onClick={() => form.setValue(`modules.${i}.testConfig.subjectConfigs`, testSubjects.filter((_, idx) => idx !== si))}>
                                                      <Trash2 className="mr-2 h-4 w-4" />Remove Section
                                                    </Button>
                                                  </div>
                                                ) : null}
                                              </div>
                                            </div>
                                          );
                                        })}
                                        {testMode === 'multi' ? (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10 rounded-full border-cyan-300/35 bg-cyan-500/10 px-5 font-semibold text-cyan-100 hover:bg-cyan-500/20"
                                            onClick={() => form.setValue(`modules.${i}.testConfig.subjectConfigs`, [...testSubjects, { subjectId: subject.id, subjectName: subject.name, topicId: '', topicName: '', subtopic: '', subtopics: [], count: 10 }])}
                                          >
                                            <PlusCircle className="mr-2 h-4 w-4" />Add Subject Section
                                          </Button>
                                        ) : null}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button type="button" variant="outline" disabled={submitting} size="lg" onClick={form.handleSubmit((values) => onSubmit(values, true))}>
                        {submitting ? <><LoaderCircle className="mr-2 animate-spin" />Saving...</> : 'Save as Draft'}
                      </Button>
                      <Button type="submit" disabled={submitting} size="lg">
                        {submitting ? <><LoaderCircle className="mr-2 animate-spin" />Saving...</> : 'Update Course'}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
