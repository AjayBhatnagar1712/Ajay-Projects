'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, deleteField, doc, orderBy, query, updateDoc, where } from 'firebase/firestore';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  LoaderCircle,
  Pencil,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
} from 'lucide-react';

import DashboardHeader from '@/components/dashboard-header';
import MathText from '@/components/math-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useToast } from '@/hooks/use-toast';
import {
  DCAM_QUESTION_BANK_OWNER_ID,
  QUESTION_UPLOAD_ROLE_ID,
  QUESTION_UPLOAD_ROLE_LABEL,
} from '@/lib/teacher-authoring';
import { buildPracticeQuestionScopeEntries } from '@/lib/practice-question-scope';
import {
  syncPracticeQuestionSummaryForDelete,
  syncPracticeQuestionSummaryForUpdate,
} from '@/lib/practice-question-summary';

type QuestionType = 'MCQ' | 'Numerical' | 'Text';
type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';
type AccessLevel = 'free' | 'paid';

type QuestionAlignment = {
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  topicId?: string;
  subtopics?: string[];
  questionNumber?: number;
  questionTitle?: string;
  accessLevel?: AccessLevel;
  mockTestOnly?: boolean;
  difficultyLevel?: DifficultyLevel;
  isPreviousYear?: boolean;
  previousYear?: string;
};

type PracticeQuestion = {
  id: string;
  questionTitle?: string;
  questionNumber?: number;
  questionText?: string;
  solutionExplanation?: string;
  questionType?: QuestionType;
  options?: string[];
  mcqAnswerMode?: 'single' | 'multiple';
  correctAnswer?: string;
  correctAnswers?: string[];
  numericalAnswer?: number;
  numericalAnswerText?: string;
  textAnswer?: string;
  difficultyLevel?: DifficultyLevel;
  isPreviousYear?: boolean;
  previousYear?: string;
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  topicId?: string;
  subtopics?: string[];
  alignments?: QuestionAlignment[];
  accessLevel?: AccessLevel;
  mockTestOnly?: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  explanationImageUrl?: string;
  explanationImageUrls?: string[];
  teacherId?: string;
  uploadedByUserId?: string;
  uploadedByEmail?: string;
  uploadedByName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type UserProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  photoURL?: string;
  roleId?: string;
  status?: 'active' | 'blocked' | string;
};

type ClassDoc = { id: string; name?: string; examTypeId?: string };
type SubjectDoc = { id: string; name?: string; classId?: string };
type TopicDoc = { id: string; name?: string; subjectId?: string };
type ExamTypeDoc = { id: string; name?: string };

type TaxonomyRow = {
  key: string;
  examTypeId: string;
  classId: string;
  subjectId: string;
  topicId: string;
  subtopicLabel: string;
  questionIds: Set<string>;
};

const UNKNOWN_DATE_KEY = 'unknown';

const toTextValue = (value: unknown): string => (
  typeof value === 'string' || typeof value === 'number' ? String(value) : ''
);

const toTrimmedString = (value: unknown): string => toTextValue(value).trim();

const toStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => toTrimmedString(item)).filter(Boolean);
  const single = toTrimmedString(value);
  return single ? [single] : [];
};

const toUniqueStringArray = (value: unknown): string[] => Array.from(new Set(toStringArray(value)));

const toDateSafe = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    try {
      const parsed = (value as { toDate: () => Date }).toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

const getQuestionCreatedDate = (question: PracticeQuestion): Date | null =>
  toDateSafe(question.createdAt) || toDateSafe(question.updatedAt);

const getDateKey = (date: Date | null): string => {
  if (!date) return UNKNOWN_DATE_KEY;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (dateKey: string): string => {
  if (dateKey === UNKNOWN_DATE_KEY) return 'Date not recorded';
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value: unknown): string => {
  const parsed = toDateSafe(value);
  if (!parsed) return 'Not recorded';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const displayUserName = (user?: UserProfile | null): string =>
  `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
  || user?.displayName
  || user?.email
  || 'Question Upload Staff';

const getQuestionTitle = (question: PracticeQuestion): string => {
  const number = Number(question.questionNumber || 0);
  if (Number.isFinite(number) && number > 0) return `Question ${Math.floor(number)}`;
  return toTrimmedString(question.questionTitle) || 'Untitled Question';
};

const normalizeQuestionType = (value?: string): QuestionType => (
  value === 'MCQ' || value === 'Numerical' ? value : 'Text'
);

const normalizeDifficulty = (value?: string): DifficultyLevel => (
  value === 'Medium' || value === 'Hard' ? value : 'Easy'
);

const normalizeAccessLevel = (value?: string): AccessLevel => (value === 'paid' ? 'paid' : 'free');

const normalizeSubtopics = (value: unknown): string[] => toUniqueStringArray(value);

const splitLines = (value: string): string[] => value
  .split(/\r?\n/)
  .map((item) => item.trim())
  .filter(Boolean);

const splitCommaList = (value: string): string[] => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const makeMap = <T extends { id: string; name?: string }>(items?: T[] | null) =>
  Object.fromEntries((items || []).map((item) => [item.id, item.name || item.id]));

export default function AdminStaffPerformancePage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUploaderId, setSelectedUploaderId] = useState('');
  const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);
  const [editingSourceQuestion, setEditingSourceQuestion] = useState<PracticeQuestion | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<PracticeQuestion | null>(null);
  const [optionText, setOptionText] = useState('');
  const [correctAnswerText, setCorrectAnswerText] = useState('');
  const [subtopicText, setSubtopicText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState('');

  const questionUploadUsersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), where('roleId', '==', QUESTION_UPLOAD_ROLE_ID)) : null),
    [firestore],
  );
  const dcamQuestionsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'practice_questions'), where('teacherId', '==', DCAM_QUESTION_BANK_OWNER_ID)) : null),
    [firestore],
  );
  const classesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null),
    [firestore],
  );
  const subjectsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null),
    [firestore],
  );
  const topicsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'topics'), orderBy('name')) : null),
    [firestore],
  );
  const examTypesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null),
    [firestore],
  );

  const { data: questionUploadUsersRaw, isLoading: areUsersLoading } = useCollection<UserProfile>(questionUploadUsersQuery);
  const { data: dcamQuestionsRaw, isLoading: areQuestionsLoading } = useCollection<PracticeQuestion>(dcamQuestionsQuery);
  const { data: classesRaw, isLoading: areClassesLoading } = useCollection<ClassDoc>(classesQuery);
  const { data: subjectsRaw, isLoading: areSubjectsLoading } = useCollection<SubjectDoc>(subjectsQuery);
  const { data: topicsRaw, isLoading: areTopicsLoading } = useCollection<TopicDoc>(topicsQuery);
  const { data: examTypesRaw, isLoading: areExamTypesLoading } = useCollection<ExamTypeDoc>(examTypesQuery);

  const questionUploadUsers = useMemo(
    () => [...(questionUploadUsersRaw || [])].sort((left, right) => displayUserName(left).localeCompare(displayUserName(right))),
    [questionUploadUsersRaw],
  );
  const dcamQuestions = useMemo(
    () => (dcamQuestionsRaw || []).map((question) => ({
      ...question,
      questionType: normalizeQuestionType(question.questionType),
      difficultyLevel: 'Easy' as const,
      accessLevel: normalizeAccessLevel(question.accessLevel),
      subtopics: normalizeSubtopics(question.subtopics),
      options: toStringArray(question.options),
      correctAnswers: toUniqueStringArray(question.correctAnswers),
      alignments: Array.isArray(question.alignments) ? question.alignments : [],
    })),
    [dcamQuestionsRaw],
  );

  const examTypeMap = useMemo(() => makeMap(examTypesRaw), [examTypesRaw]);
  const classMap = useMemo(() => makeMap(classesRaw), [classesRaw]);
  const subjectMap = useMemo(() => makeMap(subjectsRaw), [subjectsRaw]);
  const topicMap = useMemo(() => makeMap(topicsRaw), [topicsRaw]);

  const filteredUsers = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return questionUploadUsers;
    return questionUploadUsers.filter((item) => [
      displayUserName(item),
      item.email || '',
      item.phoneNumber || '',
    ].join(' ').toLowerCase().includes(needle));
  }, [questionUploadUsers, searchTerm]);

  const questionsByUploader = useMemo(() => {
    const grouped = new Map<string, PracticeQuestion[]>();
    dcamQuestions.forEach((question) => {
      const uploaderId = toTrimmedString(question.uploadedByUserId);
      if (!uploaderId) return;
      grouped.set(uploaderId, [...(grouped.get(uploaderId) || []), question]);
    });
    return grouped;
  }, [dcamQuestions]);

  const selectedUploader = useMemo(
    () => questionUploadUsers.find((item) => item.id === selectedUploaderId) || null,
    [questionUploadUsers, selectedUploaderId],
  );

  useEffect(() => {
    if (selectedUploaderId && questionUploadUsers.some((item) => item.id === selectedUploaderId)) return;
    setSelectedUploaderId(questionUploadUsers[0]?.id || '');
  }, [questionUploadUsers, selectedUploaderId]);

  const selectedQuestions = useMemo(() => {
    const source = questionsByUploader.get(selectedUploaderId) || [];
    return [...source].sort((left, right) => {
      const leftTime = getQuestionCreatedDate(left)?.getTime() || 0;
      const rightTime = getQuestionCreatedDate(right)?.getTime() || 0;
      return rightTime - leftTime;
    });
  }, [questionsByUploader, selectedUploaderId]);

  const totalUploadedQuestions = selectedQuestions.length;
  const latestUpload = selectedQuestions[0] || null;
  const reviewedQuestionsWithMetadataCount = useMemo(
    () => dcamQuestions.filter((question) => toTrimmedString(question.uploadedByUserId)).length,
    [dcamQuestions],
  );

  const dateGroups = useMemo(() => {
    const groups = new Map<string, { dateKey: string; questions: PracticeQuestion[]; taxonomyRows: TaxonomyRow[] }>();

    selectedQuestions.forEach((question) => {
      const dateKey = getDateKey(getQuestionCreatedDate(question));
      if (!groups.has(dateKey)) {
        groups.set(dateKey, { dateKey, questions: [], taxonomyRows: [] });
      }
      groups.get(dateKey)?.questions.push(question);
    });

    groups.forEach((group) => {
      const taxonomy = new Map<string, TaxonomyRow>();
      group.questions.forEach((question) => {
        const entries = buildPracticeQuestionScopeEntries({
          ...question,
          id: question.id,
          teacherId: question.teacherId || '',
          questionType: normalizeQuestionType(question.questionType),
          difficultyLevel: 'Easy' as const,
          accessLevel: normalizeAccessLevel(question.accessLevel),
        });

        entries.forEach((entry) => {
          const subtopicLabel = normalizeSubtopics(entry.subtopics).join(' > ') || 'No subtopic';
          const key = [
            entry.examTypeId,
            entry.classId,
            entry.subjectId,
            entry.topicId,
            subtopicLabel,
          ].join('__');
          if (!taxonomy.has(key)) {
            taxonomy.set(key, {
              key,
              examTypeId: entry.examTypeId,
              classId: entry.classId,
              subjectId: entry.subjectId,
              topicId: entry.topicId,
              subtopicLabel,
              questionIds: new Set<string>(),
            });
          }
          taxonomy.get(key)?.questionIds.add(question.id);
        });
      });
      group.taxonomyRows = Array.from(taxonomy.values()).sort((left, right) => {
        const leftLabel = [
          examTypeMap[left.examTypeId] || left.examTypeId,
          classMap[left.classId] || left.classId,
          subjectMap[left.subjectId] || left.subjectId,
          topicMap[left.topicId] || left.topicId,
          left.subtopicLabel,
        ].join(' ');
        const rightLabel = [
          examTypeMap[right.examTypeId] || right.examTypeId,
          classMap[right.classId] || right.classId,
          subjectMap[right.subjectId] || right.subjectId,
          topicMap[right.topicId] || right.topicId,
          right.subtopicLabel,
        ].join(' ');
        return leftLabel.localeCompare(rightLabel);
      });
    });

    return Array.from(groups.values()).sort((left, right) => {
      if (left.dateKey === UNKNOWN_DATE_KEY) return 1;
      if (right.dateKey === UNKNOWN_DATE_KEY) return -1;
      return right.dateKey.localeCompare(left.dateKey);
    });
  }, [selectedQuestions, examTypeMap, classMap, subjectMap, topicMap]);

  useEffect(() => {
    if (!expandedDateKey || dateGroups.some((group) => group.dateKey === expandedDateKey)) return;
    setExpandedDateKey(dateGroups[0]?.dateKey || null);
  }, [dateGroups, expandedDateKey]);

  const isLoading = isAdminLoading || areUsersLoading || areQuestionsLoading || areClassesLoading || areSubjectsLoading || areTopicsLoading || areExamTypesLoading;

  const openEditDialog = (question: PracticeQuestion) => {
    setEditingSourceQuestion(question);
    setEditingQuestion({ ...question });
    setOptionText((question.options || []).join('\n'));
    setCorrectAnswerText(
      (question.correctAnswers && question.correctAnswers.length > 0
        ? question.correctAnswers
        : (question.correctAnswer ? [question.correctAnswer] : [])
      ).join('\n')
    );
    setSubtopicText((question.subtopics || []).join(', '));
  };

  const closeEditDialog = () => {
    setEditingSourceQuestion(null);
    setEditingQuestion(null);
    setOptionText('');
    setCorrectAnswerText('');
    setSubtopicText('');
  };

  const updateEditingQuestion = (patch: Partial<PracticeQuestion>) => {
    setEditingQuestion((current) => (current ? { ...current, ...patch } : current));
  };

  const saveEditedQuestion = async () => {
    if (!firestore || !editingQuestion || !editingSourceQuestion) return;

    const questionText = toTrimmedString(editingQuestion.questionText);
    const questionType = normalizeQuestionType(editingQuestion.questionType);
    const previousYear = toTrimmedString(editingQuestion.previousYear);
    const yearPattern = /^(19|20)\d{2}$/;

    if (questionText.length < 10) {
      toast({ variant: 'destructive', title: 'Question too short', description: 'Question text must be at least 10 characters.' });
      return;
    }
    if (!editingQuestion.examTypeId || !editingQuestion.classId || !editingQuestion.subjectId || !editingQuestion.topicId) {
      toast({ variant: 'destructive', title: 'Missing taxonomy', description: 'Exam, curriculum, subject, and topic are required.' });
      return;
    }
    if (editingQuestion.isPreviousYear && !yearPattern.test(previousYear)) {
      toast({ variant: 'destructive', title: 'Invalid previous year', description: 'Enter a valid 4-digit year like 2024.' });
      return;
    }

    const payload: Record<string, any> = {
      questionText,
      solutionExplanation: toTextValue(editingQuestion.solutionExplanation),
      difficultyLevel: 'Easy' as const,
      accessLevel: normalizeAccessLevel(editingQuestion.accessLevel),
      mockTestOnly: !!editingQuestion.mockTestOnly,
      isPreviousYear: !!editingQuestion.isPreviousYear,
      previousYear: editingQuestion.isPreviousYear ? previousYear : '',
      questionType,
      mcqAnswerMode: editingQuestion.mcqAnswerMode === 'multiple' ? 'multiple' : 'single',
      examTypeId: editingQuestion.examTypeId,
      classId: editingQuestion.classId,
      subjectId: editingQuestion.subjectId,
      topicId: editingQuestion.topicId,
      subtopics: splitCommaList(subtopicText),
      updatedAt: new Date().toISOString(),
      updatedByUserId: user?.uid || '',
      updatedByEmail: user?.email || '',
    };

    if (questionType === 'MCQ') {
      const options = splitLines(optionText);
      const correctAnswers = splitLines(correctAnswerText);
      if (options.length < 2) {
        toast({ variant: 'destructive', title: 'Invalid options', description: 'MCQ questions need at least two options.' });
        return;
      }
      if (correctAnswers.length === 0) {
        toast({ variant: 'destructive', title: 'Missing answer', description: 'Add at least one correct answer.' });
        return;
      }
      const missingAnswer = correctAnswers.find((answer) => !options.includes(answer));
      if (missingAnswer) {
        toast({
          variant: 'destructive',
          title: 'Answer must match an option',
          description: `Correct answer "${missingAnswer}" is not present in the option list.`,
        });
        return;
      }
      payload.options = options;
      payload.correctAnswers = payload.mcqAnswerMode === 'multiple' ? correctAnswers : [];
      payload.correctAnswer = correctAnswers[0];
      payload.numericalAnswer = deleteField();
      payload.numericalAnswerText = '';
      payload.textAnswer = '';
    } else if (questionType === 'Numerical') {
      const answerText = toTrimmedString(editingQuestion.numericalAnswerText || editingQuestion.numericalAnswer);
      const answerNumber = Number(answerText);
      if (!answerText || !Number.isFinite(answerNumber)) {
        toast({ variant: 'destructive', title: 'Invalid numerical answer', description: 'Enter a valid numerical answer.' });
        return;
      }
      payload.numericalAnswer = answerNumber;
      payload.numericalAnswerText = answerText;
      payload.options = [];
      payload.correctAnswer = '';
      payload.correctAnswers = [];
      payload.textAnswer = '';
    } else {
      const textAnswer = toTrimmedString(editingQuestion.textAnswer);
      if (!textAnswer) {
        toast({ variant: 'destructive', title: 'Missing text answer', description: 'Text-answer questions need an answer.' });
        return;
      }
      payload.textAnswer = textAnswer;
      payload.options = [];
      payload.correctAnswer = '';
      payload.correctAnswers = [];
      payload.numericalAnswer = deleteField();
      payload.numericalAnswerText = '';
    }

    setIsSavingEdit(true);
    try {
      await updateDoc(doc(firestore, 'practice_questions', editingQuestion.id), payload);
      await syncPracticeQuestionSummaryForUpdate(firestore, editingSourceQuestion, payload);
      toast({ title: 'Question updated', description: 'The DCAM Question Bank document was updated.' });
      closeEditDialog();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update this question.';
      toast({ variant: 'destructive', title: 'Save failed', description: message });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const deleteQuestion = async (question: PracticeQuestion) => {
    if (!firestore) return;
    const confirmed = window.confirm('Delete this question permanently from the DCAM Question Bank?');
    if (!confirmed) return;
    setDeletingQuestionId(question.id);
    try {
      await deleteDoc(doc(firestore, 'practice_questions', question.id));
      await syncPracticeQuestionSummaryForDelete(firestore, question);
      if (editingQuestion?.id === question.id) closeEditDialog();
      toast({ title: 'Question deleted', description: 'The question was removed from the DCAM Question Bank.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete this question.';
      toast({ variant: 'destructive', title: 'Delete failed', description: message });
    } finally {
      setDeletingQuestionId('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="DCAM Staff Performance" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="DCAM Staff Performance" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="border-rose-400/30 bg-rose-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-100">
                <ShieldCheck className="h-5 w-5" />
                Admin access required
              </CardTitle>
              <CardDescription className="text-rose-100/80">
                Only admins can review Question Upload staff performance.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="DCAM Staff Performance" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <Card className="border-primary/20 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40">
            <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <Badge variant="outline" className="w-fit border-cyan-300/35 bg-cyan-500/10 text-cyan-100">
                  {QUESTION_UPLOAD_ROLE_LABEL} Audit
                </Badge>
                <div>
                  <h2 className="text-3xl font-semibold text-white">Review DCAM Question Upload Staff</h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-300 md:text-base">
                    Track staff uploads into the shared DCAM Question Bank, inspect date-wise taxonomy counts, and correct or delete uploaded questions from one admin workspace.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Staff accounts</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{questionUploadUsers.length}</p>
                </div>
                <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/80">Tracked uploads</p>
                  <p className="mt-2 text-2xl font-semibold text-cyan-50">{reviewedQuestionsWithMetadataCount}</p>
                </div>
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-100/80">Selected total</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-50">{totalUploadedQuestions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <Card className="border-border/70 bg-card/90">
              <CardHeader className="space-y-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserRoundCheck className="h-5 w-5 text-primary" />
                    Question Upload Accounts
                  </CardTitle>
                  <CardDescription>Click an account to audit only that user&apos;s uploaded questions.</CardDescription>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search staff"
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredUsers.length > 0 ? filteredUsers.map((staffUser) => {
                  const count = questionsByUploader.get(staffUser.id)?.length || 0;
                  const isSelected = staffUser.id === selectedUploaderId;
                  return (
                    <button
                      key={staffUser.id}
                      type="button"
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        isSelected
                          ? 'border-primary/55 bg-primary/10 ring-1 ring-primary/25'
                          : 'border-border/70 bg-white/[0.03] hover:border-primary/35 hover:bg-primary/5'
                      }`}
                      onClick={() => {
                        setSelectedUploaderId(staffUser.id);
                        setExpandedDateKey(null);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{displayUserName(staffUser)}</p>
                          <p className="truncate text-xs text-muted-foreground">{staffUser.email || 'No email'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{staffUser.phoneNumber || 'No phone'}</p>
                        </div>
                        <Badge variant={isSelected ? 'default' : 'outline'} className="shrink-0 rounded-full">
                          {count}
                        </Badge>
                      </div>
                    </button>
                  );
                }) : (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No accounts are currently set to {QUESTION_UPLOAD_ROLE_LABEL}.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border/70 bg-card/90">
                <CardHeader>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-2xl">
                        <ClipboardCheck className="h-6 w-6 text-primary" />
                        {selectedUploader ? displayUserName(selectedUploader) : 'No staff selected'}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {selectedUploader?.email || 'Select a Question Upload account to review performance.'}
                      </CardDescription>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total uploads</p>
                        <p className="mt-2 text-2xl font-semibold">{totalUploadedQuestions}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Dates active</p>
                        <p className="mt-2 text-2xl font-semibold">{dateGroups.length}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Latest upload</p>
                        <p className="mt-2 text-sm font-semibold">{latestUpload ? formatDateTime(latestUpload.createdAt || latestUpload.updatedAt) : 'None'}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <Card className="border-border/70 bg-card/90">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    Date-wise Upload Review
                  </CardTitle>
                  <CardDescription>
                    Each date shows taxonomy counts first, then the exact uploaded questions for admin review.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dateGroups.length > 0 ? dateGroups.map((group) => {
                    const isExpanded = expandedDateKey === group.dateKey;
                    return (
                      <div key={group.dateKey} className="rounded-2xl border border-border/70 bg-white/[0.03]">
                        <button
                          type="button"
                          className="flex w-full flex-col gap-3 p-4 text-left md:flex-row md:items-center md:justify-between"
                          onClick={() => setExpandedDateKey(isExpanded ? null : group.dateKey)}
                        >
                          <div>
                            <p className="text-lg font-semibold">{formatDateLabel(group.dateKey)}</p>
                            <p className="text-sm text-muted-foreground">{group.questions.length} question(s) uploaded</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full">
                              {group.taxonomyRows.length} taxonomy bucket(s)
                            </Badge>
                            <Badge className="rounded-full">{isExpanded ? 'Hide questions' : 'Review questions'}</Badge>
                          </div>
                        </button>

                        <div className="border-t border-border/70 p-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Exam</TableHead>
                                <TableHead>Curriculum</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>Topic</TableHead>
                                <TableHead>Subtopic</TableHead>
                                <TableHead className="text-right">Questions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.taxonomyRows.map((row) => (
                                <TableRow key={row.key}>
                                  <TableCell>{examTypeMap[row.examTypeId] || 'Unknown exam'}</TableCell>
                                  <TableCell>{classMap[row.classId] || 'Unknown curriculum'}</TableCell>
                                  <TableCell>{subjectMap[row.subjectId] || 'Unknown subject'}</TableCell>
                                  <TableCell>{topicMap[row.topicId] || 'Unknown topic'}</TableCell>
                                  <TableCell>{row.subtopicLabel}</TableCell>
                                  <TableCell className="text-right font-semibold">{row.questionIds.size}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {isExpanded ? (
                          <div className="space-y-4 border-t border-border/70 p-4">
                            {group.questions.map((question) => {
                              const selectedAnswers = question.correctAnswers && question.correctAnswers.length > 0
                                ? question.correctAnswers
                                : (question.correctAnswer ? [question.correctAnswer] : []);
                              const explanationImages = question.explanationImageUrls && question.explanationImageUrls.length > 0
                                ? question.explanationImageUrls
                                : (question.explanationImageUrl ? [question.explanationImageUrl] : []);
                              const questionImages = question.imageUrls && question.imageUrls.length > 0
                                ? question.imageUrls
                                : (question.imageUrl ? [question.imageUrl] : []);

                              return (
                                <div key={question.id} className="rounded-xl border border-border/70 bg-background/60 p-4">
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" className="rounded-full">{examTypeMap[question.examTypeId || ''] || 'Unknown exam'}</Badge>
                                        <Badge variant="outline" className="rounded-full">{classMap[question.classId || ''] || 'Unknown curriculum'}</Badge>
                                        <Badge variant="outline" className="rounded-full">{subjectMap[question.subjectId || ''] || 'Unknown subject'}</Badge>
                                        <Badge variant="outline" className="rounded-full">{topicMap[question.topicId || ''] || 'Unknown topic'}</Badge>
                                        {normalizeSubtopics(question.subtopics).map((subtopic) => (
                                          <Badge key={`${question.id}-${subtopic}`} variant="outline" className="rounded-full border-primary/35 bg-primary/10 text-primary">
                                            {subtopic}
                                          </Badge>
                                        ))}
                                        <Badge variant={question.accessLevel === 'paid' ? 'destructive' : 'secondary'} className="rounded-full">
                                          {question.accessLevel === 'paid' ? 'Paid' : 'Free'}
                                        </Badge>
                                        <Badge className="rounded-full">{normalizeQuestionType(question.questionType)}</Badge>
                                      </div>
                                      <p className="font-semibold">{getQuestionTitle(question)}</p>
                                      <p className="text-xs text-muted-foreground">Uploaded {formatDateTime(question.createdAt || question.updatedAt)}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => openEditDialog(question)}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        className="rounded-xl"
                                        onClick={() => deleteQuestion(question)}
                                        disabled={deletingQuestionId === question.id}
                                      >
                                        {deletingQuestionId === question.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                        Delete
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="mt-4 space-y-3">
                                    <MathText text={question.questionText || ''} className="text-sm" />
                                    {questionImages.length > 0 ? (
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        {questionImages.map((imageUrl) => (
                                          <img key={imageUrl} src={imageUrl} alt="Question asset" className="max-h-64 rounded-lg border border-border/70 object-contain" />
                                        ))}
                                      </div>
                                    ) : null}
                                    {question.questionType === 'MCQ' ? (
                                      <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                                        <p className="mb-2 text-xs font-medium text-muted-foreground">Options</p>
                                        {(question.options || []).map((option, index) => (
                                          <p key={`${question.id}-option-${index}`} className={selectedAnswers.includes(option) ? 'font-semibold text-emerald-300' : ''}>
                                            {String.fromCharCode(65 + index)}. {option}{selectedAnswers.includes(option) ? ' (Correct)' : ''}
                                          </p>
                                        ))}
                                      </div>
                                    ) : question.questionType === 'Numerical' ? (
                                      <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                                        <span className="font-semibold">Answer: </span>
                                        {question.numericalAnswerText || question.numericalAnswer || 'Not set'}
                                      </div>
                                    ) : (
                                      <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                                        <span className="font-semibold">Answer: </span>
                                        {question.textAnswer || 'Not set'}
                                      </div>
                                    )}
                                    {question.solutionExplanation ? (
                                      <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                                        <p className="mb-2 text-xs font-medium text-muted-foreground">Solution</p>
                                        <MathText text={question.solutionExplanation} className="text-sm" />
                                      </div>
                                    ) : null}
                                    {explanationImages.length > 0 ? (
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        {explanationImages.map((imageUrl) => (
                                          <img key={imageUrl} src={imageUrl} alt="Explanation asset" className="max-h-64 rounded-lg border border-border/70 object-contain" />
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  }) : (
                    <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                      {selectedUploader
                        ? 'No tracked questions uploaded by this account yet. New uploads will appear here automatically.'
                        : 'Select a staff account to review uploaded questions.'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={!!editingQuestion} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-5xl flex-col overflow-hidden p-0">
          <DialogHeader className="border-b border-border/70 px-6 py-5">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Question Bank Entry
            </DialogTitle>
            <DialogDescription>
              Saving here updates the same DCAM Question Bank question document.
            </DialogDescription>
          </DialogHeader>

          {editingQuestion ? (
            <>
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-6 p-6">
                  <div className="grid gap-4 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Exam</Label>
                      <Select
                        value={editingQuestion.examTypeId || ''}
                        onValueChange={(value) => updateEditingQuestion({ examTypeId: value, classId: '', subjectId: '', topicId: '' })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                        <SelectContent>
                          {(examTypesRaw || []).map((exam) => (
                            <SelectItem key={exam.id} value={exam.id}>{exam.name || exam.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Curriculum</Label>
                      <Select
                        value={editingQuestion.classId || ''}
                        onValueChange={(value) => updateEditingQuestion({ classId: value, subjectId: '', topicId: '' })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select curriculum" /></SelectTrigger>
                        <SelectContent>
                          {(classesRaw || [])
                            .filter((item) => !editingQuestion.examTypeId || item.examTypeId === editingQuestion.examTypeId)
                            .map((klass) => (
                              <SelectItem key={klass.id} value={klass.id}>{klass.name || klass.id}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Select
                        value={editingQuestion.subjectId || ''}
                        onValueChange={(value) => updateEditingQuestion({ subjectId: value, topicId: '' })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                        <SelectContent>
                          {(subjectsRaw || [])
                            .filter((item) => !editingQuestion.classId || item.classId === editingQuestion.classId)
                            .map((subject) => (
                              <SelectItem key={subject.id} value={subject.id}>{subject.name || subject.id}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Topic</Label>
                      <Select
                        value={editingQuestion.topicId || ''}
                        onValueChange={(value) => updateEditingQuestion({ topicId: value })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
                        <SelectContent>
                          {(topicsRaw || [])
                            .filter((item) => !editingQuestion.subjectId || item.subjectId === editingQuestion.subjectId)
                            .map((topic) => (
                              <SelectItem key={topic.id} value={topic.id}>{topic.name || topic.id}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
                    <div className="space-y-2">
                      <Label>Subtopics</Label>
                      <Input
                        value={subtopicText}
                        onChange={(event) => setSubtopicText(event.target.value)}
                        placeholder="Separate subtopics with commas"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Access</Label>
                      <Select value={normalizeAccessLevel(editingQuestion.accessLevel)} onValueChange={(value) => updateEditingQuestion({ accessLevel: value as AccessLevel })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <Label>Question Type</Label>
                      <Select value={normalizeQuestionType(editingQuestion.questionType)} onValueChange={(value) => updateEditingQuestion({ questionType: value as QuestionType })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MCQ">MCQ</SelectItem>
                          <SelectItem value="Numerical">Numerical</SelectItem>
                          <SelectItem value="Text">Text</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex items-center justify-between rounded-xl border border-border/70 p-4">
                        <span className="text-sm font-medium">Mock-test only</span>
                        <Switch checked={!!editingQuestion.mockTestOnly} onCheckedChange={(checked) => updateEditingQuestion({ mockTestOnly: checked })} />
                      </label>
                      <label className="flex items-center justify-between rounded-xl border border-border/70 p-4">
                        <span className="text-sm font-medium">Previous-year question</span>
                        <Switch checked={!!editingQuestion.isPreviousYear} onCheckedChange={(checked) => updateEditingQuestion({ isPreviousYear: checked })} />
                      </label>
                    </div>
                  </div>

                  {editingQuestion.isPreviousYear ? (
                    <div className="max-w-xs space-y-2">
                      <Label>Previous Year</Label>
                      <Input
                        value={editingQuestion.previousYear || ''}
                        onChange={(event) => updateEditingQuestion({ previousYear: event.target.value })}
                        placeholder="2024"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label>Question Text</Label>
                    <Textarea
                      value={editingQuestion.questionText || ''}
                      onChange={(event) => updateEditingQuestion({ questionText: event.target.value })}
                      rows={7}
                    />
                  </div>

                  {normalizeQuestionType(editingQuestion.questionType) === 'MCQ' ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Options</Label>
                        <Textarea value={optionText} onChange={(event) => setOptionText(event.target.value)} rows={7} />
                      </div>
                      <div className="space-y-2">
                        <Label>Correct Answer(s)</Label>
                        <Textarea value={correctAnswerText} onChange={(event) => setCorrectAnswerText(event.target.value)} rows={7} />
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={editingQuestion.mcqAnswerMode === 'multiple'}
                            onCheckedChange={(checked) => updateEditingQuestion({ mcqAnswerMode: checked ? 'multiple' : 'single' })}
                          />
                          <span className="text-sm text-muted-foreground">Multiple correct answers</span>
                        </div>
                      </div>
                    </div>
                  ) : normalizeQuestionType(editingQuestion.questionType) === 'Numerical' ? (
                    <div className="max-w-md space-y-2">
                      <Label>Numerical Answer</Label>
                      <Input
                        value={editingQuestion.numericalAnswerText || editingQuestion.numericalAnswer || ''}
                        onChange={(event) => updateEditingQuestion({ numericalAnswerText: event.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Text Answer</Label>
                      <Textarea value={editingQuestion.textAnswer || ''} onChange={(event) => updateEditingQuestion({ textAnswer: event.target.value })} rows={4} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Solution Explanation</Label>
                    <Textarea
                      value={editingQuestion.solutionExplanation || ''}
                      onChange={(event) => updateEditingQuestion({ solutionExplanation: event.target.value })}
                      rows={5}
                    />
                  </div>
                </div>
              </ScrollArea>
              <div className="flex flex-col gap-3 border-t border-border/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  Changes apply to the live DCAM Question Bank.
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={closeEditDialog}>Cancel</Button>
                  <Button type="button" onClick={saveEditedQuestion} disabled={isSavingEdit}>
                    {isSavingEdit ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
