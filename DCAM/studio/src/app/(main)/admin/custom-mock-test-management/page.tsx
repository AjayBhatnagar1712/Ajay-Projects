'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  ClipboardList,
  LoaderCircle,
  Mail,
  Phone,
  PlusCircle,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';

import DashboardHeader from '@/components/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useToast } from '@/hooks/use-toast';
import {
  ADMIN_CUSTOM_MOCK_DEFAULT_TITLE,
  buildAdminCustomMockPurchasePayload,
  buildAdminCustomMockQuestionScopeIndex,
  countAdminCustomMockQuestionIdsByDifficulty,
  getAdminCustomMockAvailableQuestionCount,
  getAdminCustomMockSubtopicPathPool,
  normalizeAdminCustomMockSubtopicPathSelections,
  selectAdminCustomMockReusableQuestionIds,
  type AdminCustomMockQuestion,
  type AdminCustomMockScopeConfig,
} from '@/lib/admin-custom-mock-management';
import {
  buildPremiumCustomMockAttemptRuleFromLegacyLimit,
  normalizePremiumCustomMockAttemptPricingRule,
  type AttemptIntervalUnit,
  type AttemptLimitMode,
  type PremiumCustomMockAttemptPricingMap,
} from '@/lib/premium-custom-mock';
import { ALLOWED_TEACHER_AUTHOR_EMAIL, DCAM_QUESTION_BANK_LABEL } from '@/lib/teacher-authoring';

type StudentProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  roleId?: 'student' | 'teacher' | 'admin';
  status?: 'active' | 'blocked';
};

type PricingOwnerProfile = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  premiumMockTestAttemptPricingByScope?: PremiumCustomMockAttemptPricingMap;
  premiumMockTestAttemptLimit?: {
    mode?: AttemptLimitMode;
    maxTotalAttempts?: number | null;
    maxAttemptsPerInterval?: number | null;
    intervalValue?: number | null;
    intervalUnit?: AttemptIntervalUnit | null;
  };
};

type ExamType = {
  id: string;
  name?: string;
};

type ClassItem = {
  id: string;
  name?: string;
  examTypeId?: string;
};

type Subject = {
  id: string;
  name?: string;
  classId?: string;
};

type Topic = {
  id: string;
  name?: string;
  subjectId?: string;
};

type ScopeDifficultyLevel = 'All' | 'Easy' | 'Medium' | 'Hard';

type ScopeDraft = {
  id: string;
  subjectId: string;
  topicId: string;
  subtopicPaths: string[];
  difficultyLevel: ScopeDifficultyLevel;
  count: string;
};

const displayStudentName = (student?: StudentProfile | null) =>
  `${student?.firstName || ''} ${student?.lastName || ''}`.trim()
  || student?.displayName
  || student?.email
  || 'Student';

const buildScopeDraftId = () =>
  `scope_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createEmptyScopeDraft = (): ScopeDraft => ({
  id: buildScopeDraftId(),
  subjectId: '',
  topicId: '',
  subtopicPaths: [],
  difficultyLevel: 'Easy' as const,
  count: '10',
});

const DEFAULT_SCOPE_COUNT = 10;

const sanitizeScopeCountInput = (value?: string) =>
  String(value || '').replace(/[^\d]/g, '');

const clampScopeCountToAvailable = (
  rawValue: string | number | undefined,
  availableCount: number,
  fallbackCount = DEFAULT_SCOPE_COUNT
) => {
  const safeAvailableCount = Math.max(0, Math.floor(Number(availableCount) || 0));
  if (safeAvailableCount <= 0) return '0';

  const numericValue = Math.floor(Number(rawValue));
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return String(Math.min(fallbackCount, safeAvailableCount));
  }

  return String(Math.min(numericValue, safeAvailableCount));
};

const formatOwnerName = (owner?: PricingOwnerProfile | null) =>
  `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim()
  || owner?.displayName
  || DCAM_QUESTION_BANK_LABEL;

export default function AdminCustomMockTestManagementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedExamTypeId, setSelectedExamTypeId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [scopeDrafts, setScopeDrafts] = useState<ScopeDraft[]>([createEmptyScopeDraft()]);
  const [busyKey, setBusyKey] = useState('');

  const studentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), where('roleId', '==', 'student')) : null),
    [firestore]
  );
  const ownerQuery = useMemoFirebase(
    () => (
      firestore
        ? query(collection(firestore, 'users'), where('email', '==', ALLOWED_TEACHER_AUTHOR_EMAIL), limit(1))
        : null
    ),
    [firestore]
  );
  const examTypesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null),
    [firestore]
  );
  const classesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null),
    [firestore]
  );
  const subjectsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null),
    [firestore]
  );
  const topicsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'topics'), orderBy('name')) : null),
    [firestore]
  );

  const { data: studentsRaw, isLoading: areStudentsLoading } = useCollection<StudentProfile>(studentsQuery);
  const { data: ownerRowsRaw, isLoading: isOwnerLoading } = useCollection<PricingOwnerProfile>(ownerQuery);
  const { data: examTypesRaw, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classesRaw, isLoading: areClassesLoading } = useCollection<ClassItem>(classesQuery);
  const { data: subjectsRaw, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: topicsRaw, isLoading: areTopicsLoading } = useCollection<Topic>(topicsQuery);

  const students = studentsRaw || [];
  const ownerRows = ownerRowsRaw || [];
  const examTypes = examTypesRaw || [];
  const classes = classesRaw || [];
  const subjects = subjectsRaw || [];
  const topics = topicsRaw || [];
  const owner = ownerRows[0] || null;

  const ownerQuestionsQuery = useMemoFirebase(
    () => (
      firestore && owner?.id
        ? query(collection(firestore, 'practice_questions'), where('teacherId', '==', owner.id))
        : null
    ),
    [firestore, owner?.id]
  );

  const { data: ownerQuestionsRaw, isLoading: areOwnerQuestionsLoading } = useCollection<AdminCustomMockQuestion>(ownerQuestionsQuery);
  const ownerQuestions = ownerQuestionsRaw || [];

  const loading =
    isAdminLoading
    || areStudentsLoading
    || isOwnerLoading
    || areExamTypesLoading
    || areClassesLoading
    || areSubjectsLoading
    || areTopicsLoading
    || areOwnerQuestionsLoading;

  const ownerQuestionScopeIndex = useMemo(
    () => buildAdminCustomMockQuestionScopeIndex({
      questions: ownerQuestions,
      teacherId: owner?.id,
      accessLevel: 'paid',
      questionBankSource: 'student_plus_official',
    }),
    [owner?.id, ownerQuestions]
  );

  const examNameById = useMemo(
    () => Object.fromEntries(examTypes.map((examType) => [examType.id, examType.name || 'Untitled Exam'])),
    [examTypes]
  );
  const classNameById = useMemo(
    () => Object.fromEntries(classes.map((classItem) => [classItem.id, classItem.name || 'Untitled Curriculum'])),
    [classes]
  );
  const subjectNameById = useMemo(
    () => Object.fromEntries(subjects.map((subject) => [subject.id, subject.name || 'Untitled Subject'])),
    [subjects]
  );
  const topicNameById = useMemo(
    () => Object.fromEntries(topics.map((topic) => [topic.id, topic.name || 'Untitled Topic'])),
    [topics]
  );

  const filteredStudents = useMemo(() => {
    const queryText = searchTerm.trim().toLowerCase();
    return [...students]
      .filter((student) => student.roleId === 'student')
      .filter((student) => {
        if (!queryText) return true;
        const haystack = [
          displayStudentName(student),
          student.email || '',
          student.phoneNumber || '',
        ].join(' ').toLowerCase();
        return haystack.includes(queryText);
      })
      .sort((left, right) => displayStudentName(left).localeCompare(displayStudentName(right)));
  }, [searchTerm, students]);

  const availableExamTypeIds = useMemo(() => {
    const ids = new Set<string>();
    ownerQuestionScopeIndex.questions.forEach((question) => {
      ownerQuestionScopeIndex.entriesByQuestionId.get(question.id)?.forEach((entry) => {
        if (entry.examTypeId) ids.add(entry.examTypeId);
      });
    });
    return ids;
  }, [ownerQuestionScopeIndex.entriesByQuestionId, ownerQuestionScopeIndex.questions]);

  const availableExamTypes = useMemo(
    () => examTypes.filter((examType) => availableExamTypeIds.has(examType.id)),
    [availableExamTypeIds, examTypes]
  );

  const availableClassIds = useMemo(() => {
    if (!selectedExamTypeId) return new Set<string>();
    const ids = new Set<string>();
    ownerQuestionScopeIndex.questions.forEach((question) => {
      ownerQuestionScopeIndex.entriesByQuestionId.get(question.id)?.forEach((entry) => {
        if (entry.examTypeId === selectedExamTypeId && entry.classId) {
          ids.add(entry.classId);
        }
      });
    });
    return ids;
  }, [ownerQuestionScopeIndex.entriesByQuestionId, ownerQuestionScopeIndex.questions, selectedExamTypeId]);

  const availableClasses = useMemo(
    () => classes.filter((classItem) => classItem.examTypeId === selectedExamTypeId && availableClassIds.has(classItem.id)),
    [availableClassIds, classes, selectedExamTypeId]
  );

  const availableSubjectIds = useMemo(() => {
    if (!selectedExamTypeId || !selectedClassId) return new Set<string>();
    const ids = new Set<string>();
    ownerQuestionScopeIndex.questions.forEach((question) => {
      ownerQuestionScopeIndex.entriesByQuestionId.get(question.id)?.forEach((entry) => {
        if (
          entry.examTypeId === selectedExamTypeId
          && entry.classId === selectedClassId
          && entry.subjectId
        ) {
          ids.add(entry.subjectId);
        }
      });
    });
    return ids;
  }, [ownerQuestionScopeIndex.entriesByQuestionId, ownerQuestionScopeIndex.questions, selectedClassId, selectedExamTypeId]);

  const availableSubjects = useMemo(
    () => subjects.filter((subject) => subject.classId === selectedClassId && availableSubjectIds.has(subject.id)),
    [availableSubjectIds, selectedClassId, subjects]
  );

  const getAvailableTopicsForSubject = (subjectId?: string) => {
    const normalizedSubjectId = String(subjectId || '').trim();
    if (!selectedExamTypeId || !selectedClassId || !normalizedSubjectId) return [] as Topic[];

    const topicIds = new Set<string>();
    ownerQuestionScopeIndex.questions.forEach((question) => {
      ownerQuestionScopeIndex.entriesByQuestionId.get(question.id)?.forEach((entry) => {
        if (
          entry.examTypeId === selectedExamTypeId
          && entry.classId === selectedClassId
          && entry.subjectId === normalizedSubjectId
          && entry.topicId
        ) {
          topicIds.add(entry.topicId);
        }
      });
    });

    return topics
      .filter((topic) => topic.subjectId === normalizedSubjectId && topicIds.has(topic.id))
      .sort((left, right) => (left.name || 'Topic').localeCompare(right.name || 'Topic'));
  };

  const buildBankCountConfig = (
    scopeDraft: ScopeDraft,
    overrides?: Partial<AdminCustomMockScopeConfig>
  ): AdminCustomMockScopeConfig => {
    const normalizedSubtopicPaths = normalizeAdminCustomMockSubtopicPathSelections(
      overrides?.subtopicPaths ?? scopeDraft.subtopicPaths
    );
    return {
      subjectId: String((overrides?.subjectId ?? scopeDraft.subjectId) || '').trim(),
      subjectName: String((overrides?.subjectName ?? subjectNameById[scopeDraft.subjectId]) || '').trim(),
      topicId: String((overrides?.topicId ?? scopeDraft.topicId) || '').trim(),
      topicName: String((overrides?.topicName ?? topicNameById[scopeDraft.topicId]) || '').trim(),
      subtopic: String((overrides?.subtopic ?? normalizedSubtopicPaths[0]) || '').trim(),
      subtopicPaths: normalizedSubtopicPaths,
      questionSource: 'all',
      previousYears: [],
      randomizePerAttempt: false,
      questionType: 'All',
      difficultyLevel: 'Easy' as const,
      count: Math.max(1, Number((overrides?.count ?? scopeDraft.count) || 1)),
    };
  };

  const getScopeQuestionBankCount = (
    scopeDraft: ScopeDraft,
    overrides?: Partial<AdminCustomMockScopeConfig>
  ) => {
    if (!selectedExamTypeId || !selectedClassId || !scopeDraft.subjectId) return 0;
    return getAdminCustomMockAvailableQuestionCount({
      index: ownerQuestionScopeIndex,
      examTypeId: selectedExamTypeId,
      classId: selectedClassId,
      config: buildBankCountConfig(scopeDraft, overrides),
    });
  };

  const buildNormalizedScopeDraft = (
    scopeDraft: ScopeDraft,
    overrides: Partial<ScopeDraft>,
    preferredCount?: string | number
  ): ScopeDraft => {
    const nextScopeDraft: ScopeDraft = {
      ...scopeDraft,
      ...overrides,
      subtopicPaths: normalizeAdminCustomMockSubtopicPathSelections(
        overrides.subtopicPaths ?? scopeDraft.subtopicPaths
      ),
    };

    if (!nextScopeDraft.subjectId) {
      return {
        ...nextScopeDraft,
        topicId: '',
        subtopicPaths: [],
        difficultyLevel: 'Easy' as const,
        count: '0',
      };
    }

    const nextAvailableCount = getScopeQuestionBankCount(nextScopeDraft, { count: 1 });

    return {
      ...nextScopeDraft,
      count: clampScopeCountToAvailable(preferredCount ?? nextScopeDraft.count, nextAvailableCount),
    };
  };

  const normalizedScopeConfigs = useMemo(() => {
    return scopeDrafts.reduce<AdminCustomMockScopeConfig[]>((configs, scopeDraft) => {
        const count = Math.max(0, Number(scopeDraft.count || 0));
        if (!scopeDraft.subjectId || count <= 0) return configs;
        configs.push({
          subjectId: scopeDraft.subjectId,
          subjectName: subjectNameById[scopeDraft.subjectId] || '',
          topicId: scopeDraft.topicId || '',
          topicName: topicNameById[scopeDraft.topicId] || '',
          subtopic: normalizeAdminCustomMockSubtopicPathSelections(scopeDraft.subtopicPaths)[0] || '',
          subtopicPaths: normalizeAdminCustomMockSubtopicPathSelections(scopeDraft.subtopicPaths),
          questionSource: 'all' as const,
          previousYears: [] as string[],
          randomizePerAttempt: false,
          questionType: 'All' as const,
          difficultyLevel: 'Easy' as const,
          count,
        });
        return configs;
      }, []);
  }, [scopeDrafts, subjectNameById, topicNameById]);

  const totalRequestedQuestions = useMemo(
    () => normalizedScopeConfigs.reduce((sum, config) => sum + Math.max(0, Number(config.count || 0)), 0),
    [normalizedScopeConfigs]
  );

  const grantPreview = useMemo(() => {
    if (!selectedExamTypeId || !selectedClassId || normalizedScopeConfigs.length === 0) {
      return {
        selectedQuestionIds: [] as string[],
        insufficientConfigs: [] as Array<{
          indexPosition: number;
          config: AdminCustomMockScopeConfig;
          requestedCount: number;
          availableCount: number;
        }>,
      };
    }
    return selectAdminCustomMockReusableQuestionIds({
      index: ownerQuestionScopeIndex,
      examTypeId: selectedExamTypeId,
      classId: selectedClassId,
      configs: normalizedScopeConfigs,
    });
  }, [normalizedScopeConfigs, ownerQuestionScopeIndex, selectedClassId, selectedExamTypeId]);

  const includedQuestionCountByDifficulty = useMemo(
    () => countAdminCustomMockQuestionIdsByDifficulty(grantPreview.selectedQuestionIds, ownerQuestionScopeIndex.questionById),
    [grantPreview.selectedQuestionIds, ownerQuestionScopeIndex.questionById]
  );

  const previewShortfall = Math.max(0, totalRequestedQuestions - grantPreview.selectedQuestionIds.length);
  const canAssignGrant =
    !!selectedStudent?.id
    && !!owner?.id
    && !!selectedExamTypeId
    && !!selectedClassId
    && normalizedScopeConfigs.length > 0
    && totalRequestedQuestions > 0
    && grantPreview.insufficientConfigs.length === 0
    && previewShortfall === 0;

  useEffect(() => {
    if (!isAssignDialogOpen) return;
    setSelectedExamTypeId('');
    setSelectedClassId('');
    setScopeDrafts([createEmptyScopeDraft()]);
  }, [isAssignDialogOpen, selectedStudent?.id]);

  const updateScopeDraft = (scopeId: string, updater: (current: ScopeDraft) => ScopeDraft) => {
    setScopeDrafts((current) => current.map((scopeDraft) => (scopeDraft.id === scopeId ? updater(scopeDraft) : scopeDraft)));
  };

  const handleAssignGrant = async () => {
    if (!firestore || !user?.uid || !selectedStudent?.id || !owner?.id) return;
    if (!canAssignGrant) {
      toast({
        variant: 'destructive',
        title: 'Fix the grant scope first',
        description: 'Please make sure every selected scope has enough available questions before assigning.',
      });
      return;
    }

    const purchaseRef = doc(collection(firestore, 'users', selectedStudent.id, 'premium_mock_feature_purchases'));
    const scopeKey = `${selectedExamTypeId}__${selectedClassId}`;
    const scopedAttemptPricing =
      owner.premiumMockTestAttemptPricingByScope?.[scopeKey]
        ? normalizePremiumCustomMockAttemptPricingRule(owner.premiumMockTestAttemptPricingByScope[scopeKey])
        : buildPremiumCustomMockAttemptRuleFromLegacyLimit(owner.premiumMockTestAttemptLimit);

    const payload = buildAdminCustomMockPurchasePayload({
      id: purchaseRef.id,
      studentId: selectedStudent.id,
      teacherId: owner.id,
      teacherName: formatOwnerName(owner),
      examTypeId: selectedExamTypeId,
      examTypeName: examNameById[selectedExamTypeId] || '',
      classId: selectedClassId,
      className: classNameById[selectedClassId] || '',
      title: ADMIN_CUSTOM_MOCK_DEFAULT_TITLE,
      questionBankSource: 'student_plus_official',
      configs: normalizedScopeConfigs,
      includedQuestionIds: grantPreview.selectedQuestionIds,
      includedQuestionCountByDifficulty,
      attemptPricing: scopedAttemptPricing,
      assignedByAdminId: user.uid,
      assignedByAdminEmail: user.email || '',
    });

    setBusyKey(`assign_${selectedStudent.id}`);
    try {
      await setDoc(purchaseRef, payload, { merge: true });
      toast({
        title: 'Custom mock questions assigned',
        description: `${grantPreview.selectedQuestionIds.length} reusable premium custom mock question${grantPreview.selectedQuestionIds.length === 1 ? '' : 's'} were assigned to ${displayStudentName(selectedStudent)}.`,
      });
      setIsAssignDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Assignment failed.';
      toast({
        variant: 'destructive',
        title: 'Could not assign custom mock questions',
        description: errorMessage,
      });
    } finally {
      setBusyKey('');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Custom Mock Test Management" />
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
      <div className="flex flex-col h-full">
        <DashboardHeader title="Custom Mock Test Management" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="border-rose-400/30 bg-rose-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-100">
                <ShieldCheck className="h-5 w-5" />
                Admin access required
              </CardTitle>
              <CardDescription className="text-rose-100/80">
                Only admins can assign premium custom mock questions to students.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Custom Mock Test Management" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <Card className="border-border/70 bg-gradient-to-r from-slate-900 via-slate-900/95 to-cyan-950/40">
            <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <Badge variant="outline" className="border-cyan-300/40 bg-cyan-500/10 text-cyan-100">
                  Admin Premium Access
                </Badge>
                <div>
                  <h2 className="text-3xl font-semibold text-white">Grant Premium Custom Mock Questions</h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-300 md:text-base">
                    Assign reusable premium custom mock question pools from the {DCAM_QUESTION_BANK_LABEL} to students.
                    The grant behaves like a purchased included-question pack inside the student custom-mock builder.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Students</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{filteredStudents.length}</p>
                </div>
                <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">Owner Bank</p>
                  <p className="mt-2 text-lg font-semibold text-cyan-50">{formatOwnerName(owner)}</p>
                </div>
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/80">Paid Questions</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-50">{ownerQuestionScopeIndex.questions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {!owner?.id ? (
            <Card className="border-amber-400/35 bg-amber-500/10">
              <CardHeader>
                <CardTitle className="text-amber-100">DCAM question-bank owner not found</CardTitle>
                <CardDescription className="text-amber-100/80">
                  Could not locate the allowlisted question-bank owner for {ALLOWED_TEACHER_AUTHOR_EMAIL}.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <Card className="border-border/70 bg-card/90">
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Users className="h-5 w-5 text-cyan-300" />
                  Students
                </CardTitle>
                <CardDescription>
                  Search students, review contact details, and assign reusable premium custom mock access.
                </CardDescription>
              </div>
              <div className="relative w-full md:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by name, phone, or email"
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length > 0 ? filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{displayStudentName(student)}</p>
                          <p className="text-xs text-muted-foreground">{student.id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span>{student.phoneNumber || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span>{student.email || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            student.status === 'blocked'
                              ? 'border-rose-300/40 bg-rose-500/10 text-rose-100'
                              : 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100'
                          }
                        >
                          {student.status === 'blocked' ? 'Blocked' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          onClick={() => {
                            setSelectedStudent(student);
                            setIsAssignDialogOpen(true);
                          }}
                          className="rounded-full"
                          disabled={!owner?.id}
                        >
                          Assign Questions
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                        No students matched the current search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-5xl flex-col overflow-hidden border-border/70 bg-slate-950 p-0 text-slate-50">
          <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5">
            <DialogTitle className="text-2xl">Assign Custom Mock Questions</DialogTitle>
            <DialogDescription className="text-slate-300">
              Select the bank scope for {displayStudentName(selectedStudent)}, then enter how many questions to assign from the available question bank count shown inside each scope.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            <div className="space-y-6">
              <Card className="border-white/10 bg-slate-900/75">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ClipboardList className="h-5 w-5 text-cyan-300" />
                    Question Selection
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    Choose the exam and curriculum first. Then narrow by subject, topic, subtopic, and difficulty. The bank count shown at each step tells how many questions are available before you enter the assign count.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Exam</Label>
                      <Select
                        value={selectedExamTypeId}
                        onValueChange={(value) => {
                          setSelectedExamTypeId(value);
                          setSelectedClassId('');
                          setScopeDrafts([createEmptyScopeDraft()]);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select exam" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableExamTypes.map((examType) => (
                            <SelectItem key={examType.id} value={examType.id}>
                              {examType.name || examType.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Curriculum / Class</Label>
                      <Select
                        value={selectedClassId}
                        onValueChange={(value) => {
                          setSelectedClassId(value);
                          setScopeDrafts([createEmptyScopeDraft()]);
                        }}
                        disabled={!selectedExamTypeId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select curriculum" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableClasses.map((classItem) => (
                            <SelectItem key={classItem.id} value={classItem.id}>
                              {classItem.name || classItem.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {scopeDrafts.map((scopeDraft, index) => {
                      const availableTopics = getAvailableTopicsForSubject(scopeDraft.subjectId);
                      const normalizedSubtopicPaths = normalizeAdminCustomMockSubtopicPathSelections(scopeDraft.subtopicPaths);
                      const availableSubtopicPaths = getAdminCustomMockSubtopicPathPool({
                        index: ownerQuestionScopeIndex,
                        examTypeId: selectedExamTypeId,
                        classId: selectedClassId,
                        subjectId: scopeDraft.subjectId,
                        topicId: scopeDraft.topicId,
                      });
                      const subjectBankCount = scopeDraft.subjectId
                        ? getScopeQuestionBankCount(scopeDraft, {
                            topicId: '',
                            topicName: '',
                            subtopic: '',
                            subtopicPaths: [],
                            difficultyLevel: 'Easy' as const,
                            count: 1,
                          })
                        : 0;
                      const topicBankCount = scopeDraft.subjectId && scopeDraft.topicId
                        ? getScopeQuestionBankCount(scopeDraft, {
                            subtopic: '',
                            subtopicPaths: [],
                            difficultyLevel: 'Easy' as const,
                            count: 1,
                          })
                        : 0;
                      const subtopicBankCount = scopeDraft.subjectId && normalizedSubtopicPaths.length > 0
                        ? getScopeQuestionBankCount(scopeDraft, {
                            difficultyLevel: 'Easy' as const,
                            count: 1,
                          })
                        : 0;
                      const difficultyBankCount = scopeDraft.subjectId
                        ? getScopeQuestionBankCount(scopeDraft, { count: 1 })
                        : 0;
                      const requestedCount = Math.max(0, Number(scopeDraft.count || 0));

                      return (
                        <div key={scopeDraft.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">Scope {index + 1}</p>
                              <p className="text-xs text-slate-400">
                                Final available after current filters: {difficultyBankCount}
                              </p>
                            </div>
                            {scopeDrafts.length > 1 ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full border-rose-300/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                                onClick={() => setScopeDrafts((current) => current.filter((entry) => entry.id !== scopeDraft.id))}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove Scope
                              </Button>
                            ) : null}
                          </div>

                          <div className="grid gap-4 xl:grid-cols-4">
                            <div className="space-y-2">
                              <Label>Subject</Label>
                              <Select
                                value={scopeDraft.subjectId}
                                onValueChange={(value) => {
                                  updateScopeDraft(scopeDraft.id, () => buildNormalizedScopeDraft(
                                    scopeDraft,
                                    {
                                      subjectId: value,
                                      topicId: '',
                                      subtopicPaths: [],
                                      difficultyLevel: 'Easy' as const,
                                    },
                                    DEFAULT_SCOPE_COUNT
                                  ));
                                }}
                                disabled={!selectedClassId}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select subject" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableSubjects.map((subject) => (
                                    <SelectItem key={subject.id} value={subject.id}>
                                      {subject.name || subject.id}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Topic</Label>
                              <Select
                                value={scopeDraft.topicId || '__all_topics__'}
                                onValueChange={(value) => {
                                  updateScopeDraft(scopeDraft.id, () => buildNormalizedScopeDraft(
                                    scopeDraft,
                                    {
                                      topicId: value === '__all_topics__' ? '' : value,
                                      subtopicPaths: [],
                                      difficultyLevel: 'Easy' as const,
                                    },
                                    DEFAULT_SCOPE_COUNT
                                  ));
                                }}
                                disabled={!scopeDraft.subjectId}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="All topics" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__all_topics__">All topics</SelectItem>
                                  {availableTopics.map((topic) => (
                                    <SelectItem key={topic.id} value={topic.id}>
                                      {topic.name || topic.id}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            

                            <div className="space-y-2">
                              <Label>Questions to Assign</Label>
                              <Input
                                type="number"
                                min={1}
                                max={Math.max(difficultyBankCount, 1)}
                                value={scopeDraft.count}
                                disabled={!scopeDraft.subjectId || difficultyBankCount <= 0}
                                onChange={(event) => {
                                  updateScopeDraft(scopeDraft.id, () => ({
                                    ...scopeDraft,
                                    count: sanitizeScopeCountInput(event.target.value),
                                  }));
                                }}
                                onBlur={(event) => {
                                  updateScopeDraft(scopeDraft.id, () => ({
                                    ...scopeDraft,
                                    count: clampScopeCountToAvailable(event.target.value, difficultyBankCount),
                                  }));
                                }}
                              />
                              <p className="text-xs text-slate-400">
                                Available to assign from current selection: {difficultyBankCount}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Subject Bank Count</p>
                              <p className="mt-2 text-xl font-semibold text-white">
                                {scopeDraft.subjectId ? subjectBankCount : '--'}
                              </p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Topic Bank Count</p>
                              <p className="mt-2 text-xl font-semibold text-white">
                                {scopeDraft.topicId ? topicBankCount : '--'}
                              </p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Subtopic Bank Count</p>
                              <p className="mt-2 text-xl font-semibold text-white">
                                {normalizedSubtopicPaths.length > 0 ? subtopicBankCount : '--'}
                              </p>
                            </div>
                            <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">Standard Bank Count</p>
                              <p className="mt-2 text-xl font-semibold text-cyan-50">
                                {scopeDraft.subjectId ? difficultyBankCount : '--'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-500/5 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
                              Subtopics
                            </p>
                            {!scopeDraft.topicId ? (
                              <p className="mt-2 text-sm text-slate-400">
                                Select a topic if you want to narrow this scope to one or more subtopics.
                              </p>
                            ) : availableSubtopicPaths.length === 0 ? (
                              <p className="mt-2 text-sm text-slate-400">
                                No subtopic hierarchy is available for this topic.
                              </p>
                            ) : (
                              <div className="mt-3 grid gap-2 md:grid-cols-2">
                                {availableSubtopicPaths.map((pathSegments) => {
                                  const pathLabel = pathSegments.join(' > ');
                                  const checked = normalizedSubtopicPaths.includes(pathLabel);
                                  return (
                                    <label
                                      key={`${scopeDraft.id}-${pathLabel}`}
                                      className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                                    >
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(nextChecked) => {
                                          updateScopeDraft(scopeDraft.id, () => {
                                            const nextSelections = nextChecked
                                              ? [...normalizedSubtopicPaths, pathLabel]
                                              : normalizedSubtopicPaths.filter((entry) => entry !== pathLabel);
                                            return buildNormalizedScopeDraft(
                                              scopeDraft,
                                              {
                                                subtopicPaths: normalizeAdminCustomMockSubtopicPathSelections(nextSelections),
                                              },
                                              scopeDraft.count
                                            );
                                          });
                                        }}
                                      />
                                      <span className="leading-relaxed">{pathLabel}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {requestedCount > difficultyBankCount ? (
                            <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                              Only {difficultyBankCount} question{difficultyBankCount === 1 ? '' : 's'} are available for this selection. Reduce the assign count or widen the filters.
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-cyan-300/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                      onClick={() => setScopeDrafts((current) => [...current, createEmptyScopeDraft()])}
                      disabled={!selectedClassId}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Scope
                    </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-white/10 px-6 py-4">
            <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                <span>{selectedStudent?.email || selectedStudent?.phoneNumber || 'Selected student'}</span>
                <span>Requested: {totalRequestedQuestions}</span>
                <span>Can assign: {grantPreview.selectedQuestionIds.length}</span>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-white/10 bg-transparent"
                  onClick={() => setIsAssignDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={handleAssignGrant}
                  disabled={!canAssignGrant || busyKey === `assign_${selectedStudent?.id || ''}`}
                >
                  {busyKey === `assign_${selectedStudent?.id || ''}` ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Assign Questions
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
