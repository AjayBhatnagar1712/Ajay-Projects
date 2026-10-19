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
  LoaderCircle,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import TeacherOfferPracticePackBuilder from '@/components/subscription/teacher-offer-practice-pack-builder';
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
  ADMIN_PRACTICE_SESSION_ASSIGNMENT_SOURCE,
  buildAdminPracticeSessionPurchasePayload,
  buildAdminPracticeSessionQuestionScopeIndex,
  countAdminPracticeSessionQuestionIdsByDifficulty,
  selectAdminPracticeSessionReusableQuestionIds,
  type AdminPracticeSessionQuestion,
} from '@/lib/admin-practice-session-management';
import {
  normalizePremiumPracticeTopicConfigs,
  type PremiumPracticeAttemptPricingMap,
} from '@/lib/premium-practice-session';
import { mergeLegacyDifficultyCounts } from '@/lib/question-difficulty';
import { ALLOWED_TEACHER_AUTHOR_EMAIL, DCAM_QUESTION_BANK_LABEL } from '@/lib/teacher-authoring';
import type { TeacherOfferPracticePack } from '@/lib/teacher-offers';

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
  premiumPracticeAttemptPricingByScope?: PremiumPracticeAttemptPricingMap;
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

const EMPTY_STUDENTS: StudentProfile[] = [];
const EMPTY_OWNER_ROWS: PricingOwnerProfile[] = [];
const EMPTY_EXAM_TYPES: ExamType[] = [];
const EMPTY_CLASSES: ClassItem[] = [];
const EMPTY_SUBJECTS: Subject[] = [];
const EMPTY_OWNER_QUESTIONS: AdminPracticeSessionQuestion[] = [];
const ADMIN_PRACTICE_QUESTION_BANK_SOURCE_OPTIONS: Array<'student_plus_official'> = ['student_plus_official'];

const displayStudentName = (student?: StudentProfile | null) =>
  `${student?.firstName || ''} ${student?.lastName || ''}`.trim()
  || student?.displayName
  || student?.email
  || 'Student';

const formatOwnerName = (owner?: PricingOwnerProfile | null) =>
  `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim()
  || owner?.displayName
  || DCAM_QUESTION_BANK_LABEL;

export default function AdminPracticeSessionManagementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedExamTypeId, setSelectedExamTypeId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [practicePack, setPracticePack] = useState<TeacherOfferPracticePack | null>(null);
  const [builderResetToken, setBuilderResetToken] = useState(0);
  const [busyKey, setBusyKey] = useState('');

  const studentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), where('roleId', '==', 'student')) : null),
    [firestore],
  );
  const ownerQuery = useMemoFirebase(
    () => (
      firestore
        ? query(collection(firestore, 'users'), where('email', '==', ALLOWED_TEACHER_AUTHOR_EMAIL), limit(1))
        : null
    ),
    [firestore],
  );
  const examTypesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null),
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

  const { data: studentsRaw, isLoading: areStudentsLoading } = useCollection<StudentProfile>(studentsQuery);
  const { data: ownerRowsRaw, isLoading: isOwnerLoading } = useCollection<PricingOwnerProfile>(ownerQuery);
  const { data: examTypesRaw, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classesRaw, isLoading: areClassesLoading } = useCollection<ClassItem>(classesQuery);
  const { data: subjectsRaw, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);

  const students = studentsRaw ?? EMPTY_STUDENTS;
  const ownerRows = ownerRowsRaw ?? EMPTY_OWNER_ROWS;
  const examTypes = examTypesRaw ?? EMPTY_EXAM_TYPES;
  const classes = classesRaw ?? EMPTY_CLASSES;
  const subjects = subjectsRaw ?? EMPTY_SUBJECTS;
  const owner = ownerRows[0] || null;

  const ownerQuestionsQuery = useMemoFirebase(
    () => (
      firestore && owner?.id
        ? query(collection(firestore, 'practice_questions'), where('teacherId', '==', owner.id))
        : null
    ),
    [firestore, owner?.id],
  );
  const { data: ownerQuestionsRaw, isLoading: areOwnerQuestionsLoading } = useCollection<AdminPracticeSessionQuestion>(ownerQuestionsQuery);
  const ownerQuestions = ownerQuestionsRaw ?? EMPTY_OWNER_QUESTIONS;

  const loading =
    isAdminLoading
    || areStudentsLoading
    || isOwnerLoading
    || areExamTypesLoading
    || areClassesLoading
    || areSubjectsLoading
    || areOwnerQuestionsLoading;

  const ownerQuestionScopeIndex = useMemo(
    () => buildAdminPracticeSessionQuestionScopeIndex({
      questions: ownerQuestions,
      teacherId: owner?.id,
      accessLevel: 'paid',
    }),
    [owner?.id, ownerQuestions],
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
    [availableExamTypeIds, examTypes],
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
    [availableClassIds, classes, selectedExamTypeId],
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
          && !entry.mockTestOnly
        ) {
          ids.add(entry.subjectId);
        }
      });
    });
    return ids;
  }, [ownerQuestionScopeIndex.entriesByQuestionId, ownerQuestionScopeIndex.questions, selectedClassId, selectedExamTypeId]);

  const availableSubjects = useMemo(
    () => subjects.filter((subject) => subject.classId === selectedClassId && availableSubjectIds.has(subject.id)),
    [availableSubjectIds, selectedClassId, subjects],
  );

  const examNameById = useMemo(
    () => Object.fromEntries(examTypes.map((examType) => [examType.id, examType.name || 'Untitled Exam'])),
    [examTypes],
  );
  const classNameById = useMemo(
    () => Object.fromEntries(classes.map((classItem) => [classItem.id, classItem.name || 'Untitled Curriculum'])),
    [classes],
  );
  const builderAvailableSubjects = useMemo(
    () => availableSubjects.map((subject) => ({
      id: subject.id,
      name: subject.name || subject.id,
      classId: subject.classId || selectedClassId,
    })),
    [availableSubjects, selectedClassId],
  );

  const totalRequestedQuestions = useMemo(
    () => Math.max(0, Number(practicePack?.totalQuestions || 0)),
    [practicePack?.totalQuestions],
  );
  const normalizedPracticePackTopicConfigs = useMemo(
    () => normalizePremiumPracticeTopicConfigs(practicePack?.topicConfigs),
    [practicePack?.topicConfigs],
  );

  const grantPreview = useMemo(() => {
    if (!selectedExamTypeId || !selectedClassId || normalizedPracticePackTopicConfigs.length === 0) {
      return {
        selectedQuestionIds: [] as string[],
        insufficientConfigs: [] as Array<{
          indexPosition: number;
          config: NonNullable<TeacherOfferPracticePack['topicConfigs']>[number];
          requestedCount: number;
          availableCount: number;
        }>,
      };
    }

    return selectAdminPracticeSessionReusableQuestionIds({
      index: ownerQuestionScopeIndex,
      examTypeId: selectedExamTypeId,
      classId: selectedClassId,
      configs: normalizedPracticePackTopicConfigs,
    });
  }, [normalizedPracticePackTopicConfigs, ownerQuestionScopeIndex, selectedClassId, selectedExamTypeId]);

  const includedQuestionCountByDifficulty = useMemo(
    () => countAdminPracticeSessionQuestionIdsByDifficulty(grantPreview.selectedQuestionIds, ownerQuestionScopeIndex.questionById),
    [grantPreview.selectedQuestionIds, ownerQuestionScopeIndex.questionById],
  );
  const includedStandardQuestionCount = useMemo(
    () => mergeLegacyDifficultyCounts(includedQuestionCountByDifficulty).easy,
    [includedQuestionCountByDifficulty],
  );

  const previewShortfall = Math.max(0, totalRequestedQuestions - grantPreview.selectedQuestionIds.length);
  const canAssignGrant =
    !!selectedStudent?.id
    && !!owner?.id
    && !!selectedExamTypeId
    && !!selectedClassId
    && totalRequestedQuestions > 0
    && grantPreview.insufficientConfigs.length === 0
    && previewShortfall === 0;

  useEffect(() => {
    if (!isAssignDialogOpen) return;
    setSelectedExamTypeId('');
    setSelectedClassId('');
    setSelectedSubjectIds([]);
    setPracticePack(null);
    setBuilderResetToken((value) => value + 1);
  }, [isAssignDialogOpen, selectedStudent?.id]);

  useEffect(() => {
    const availableSubjectIdSet = new Set(availableSubjects.map((subject) => subject.id));
    setSelectedSubjectIds((current) => {
      const next = current.filter((subjectId) => availableSubjectIdSet.has(subjectId));
      if (next.length === current.length && next.every((subjectId, index) => subjectId === current[index])) {
        return current;
      }
      return next;
    });
  }, [availableSubjects]);

  const handleAssignGrant = async () => {
    if (!firestore || !user?.uid || !selectedStudent?.id || !owner?.id || !practicePack) return;
    if (!canAssignGrant) {
      toast({
        variant: 'destructive',
        title: 'Fix the practice pack first',
        description: 'Please make sure the selected practice scope has enough unique questions before assigning.',
      });
      return;
    }

    const purchaseRef = doc(collection(firestore, 'users', selectedStudent.id, 'premium_practice_session_purchases'));
    const payload = buildAdminPracticeSessionPurchasePayload({
      id: purchaseRef.id,
      studentId: selectedStudent.id,
      teacherId: owner.id,
      teacherName: formatOwnerName(owner),
      examTypeId: selectedExamTypeId,
      examTypeName: examNameById[selectedExamTypeId] || '',
      classId: selectedClassId,
      className: classNameById[selectedClassId] || '',
      questionBankSource: 'student_plus_official',
      configs: normalizedPracticePackTopicConfigs,
      includedQuestionIds: grantPreview.selectedQuestionIds,
      includedQuestionCountByDifficulty,
      attemptPricing: practicePack.attemptPricing || null,
      perQuestionTimeSeconds: practicePack.perQuestionTimeSeconds || null,
      assignedByAdminId: user.uid,
      assignedByAdminEmail: user.email || '',
    });

    setBusyKey(`assign_${selectedStudent.id}`);
    try {
      await setDoc(purchaseRef, payload, { merge: true });
      toast({
        title: 'Practice session access assigned',
        description: `${grantPreview.selectedQuestionIds.length} reusable practice question${grantPreview.selectedQuestionIds.length === 1 ? '' : 's'} were assigned to ${displayStudentName(selectedStudent)}.`,
      });
      setIsAssignDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Assignment failed.';
      toast({
        variant: 'destructive',
        title: 'Could not assign practice session access',
        description: errorMessage,
      });
    } finally {
      setBusyKey('');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Practice Session Management" />
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
        <DashboardHeader title="Practice Session Management" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="border-rose-400/30 bg-rose-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-100">
                <ShieldCheck className="h-5 w-5" />
                Admin access required
              </CardTitle>
              <CardDescription className="text-rose-100/80">
                Only admins can assign reusable premium practice questions to students.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Practice Session Management" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <Card className="border-border/70 bg-gradient-to-r from-slate-900 via-slate-900/95 to-cyan-950/40">
            <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <Badge variant="outline" className="border-cyan-300/40 bg-cyan-500/10 text-cyan-100">
                  Admin Practice Access
                </Badge>
                <div>
                  <h2 className="text-3xl font-semibold text-white">Grant Practice Session Questions</h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-300 md:text-base">
                    Assign reusable premium practice access from the {DCAM_QUESTION_BANK_LABEL} to students.
                    The assigned pack behaves like saved offer-backed practice access in the student builder.
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
                  Search students, review contact details, and assign reusable premium practice access.
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
                          Assign Practice Access
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
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-6xl flex-col overflow-hidden border-border/70 bg-slate-950 p-0 text-slate-50">
          <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5">
            <DialogTitle className="text-2xl">Assign Practice Session Questions</DialogTitle>
            <DialogDescription className="text-slate-300">
              Build a reusable premium practice pack for {displayStudentName(selectedStudent)}. This behaves like purchased practice access in the student builder, but is assigned by admin.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            <div className="space-y-6">
              <Card className="border-white/10 bg-slate-900/75">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-cyan-300" />
                    Practice Pack Basics
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    Choose the exam, curriculum, and subjects first. Then configure the question pool exactly like a premium practice offer pack.
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
                          setSelectedSubjectIds([]);
                          setPracticePack(null);
                          setBuilderResetToken((token) => token + 1);
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
                          setSelectedSubjectIds([]);
                          setPracticePack(null);
                          setBuilderResetToken((token) => token + 1);
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

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Select Subjects</Label>
                      <p className="text-sm text-slate-400">
                        Choose one or more subjects, then configure their topics, subtopics, difficulty, PYQ filters, and question counts below.
                      </p>
                    </div>
                    {!selectedClassId ? (
                      <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/45 px-4 py-5 text-sm text-slate-400">
                        Select exam and curriculum first to unlock subject selection.
                      </div>
                    ) : availableSubjects.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/45 px-4 py-5 text-sm text-slate-400">
                        No student-usable paid subjects are available for this exam and curriculum right now.
                      </div>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {availableSubjects.map((subject) => {
                          const checked = selectedSubjectIds.includes(subject.id);
                          return (
                            <label
                              key={subject.id}
                              className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(nextChecked) => {
                                  setSelectedSubjectIds((current) => (
                                    nextChecked
                                      ? Array.from(new Set([...current, subject.id]))
                                      : current.filter((entry) => entry !== subject.id)
                                  ));
                                  setPracticePack(null);
                                }}
                              />
                              <span>{subject.name || subject.id}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <TeacherOfferPracticePackBuilder
                teacherId={owner?.id || ''}
                examTypeId={selectedExamTypeId}
                examTypeName={examNameById[selectedExamTypeId] || ''}
                classId={selectedClassId}
                className={classNameById[selectedClassId] || ''}
                availableSubjects={builderAvailableSubjects}
                selectedSubjectIds={selectedSubjectIds}
                resetToken={builderResetToken}
                questionBankSourceOptions={ADMIN_PRACTICE_QUESTION_BANK_SOURCE_OPTIONS}
                onChange={setPracticePack}
              />

              <Card className="border-white/10 bg-slate-900/70">
                <CardHeader>
                  <CardTitle className="text-lg">Assignment Preview</CardTitle>
                  <CardDescription className="text-slate-300">
                    This is the frozen reusable question pool that will be written into the student’s practice access record.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-slate-950/55 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Requested</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{totalRequestedQuestions}</p>
                    </div>
                    <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">Can Assign</p>
                      <p className="mt-2 text-2xl font-semibold text-cyan-50">{grantPreview.selectedQuestionIds.length}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/55 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Assignment Source</p>
                      <p className="mt-2 text-sm font-semibold text-white">{ADMIN_PRACTICE_SESSION_ASSIGNMENT_SOURCE}</p>
                    </div>
                  </div>

                  {previewShortfall > 0 ? (
                    <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                      Only {grantPreview.selectedQuestionIds.length} unique question{grantPreview.selectedQuestionIds.length === 1 ? '' : 's'} can be frozen from the current blueprint.
                      Reduce overlap, lower counts, or widen the scope before assigning.
                    </div>
                  ) : null}

                  {grantPreview.insufficientConfigs.length > 0 ? (
                    <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                      Some topic scopes still overlap too tightly to satisfy the requested counts. Adjust the blueprint until requested and assignable totals match.
                    </div>
                  ) : null}

                  <div className="grid gap-3">
                    <div className="rounded-xl border border-white/10 bg-slate-950/55 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Standard</p>
                      <p className="mt-2 text-xl font-semibold text-white">{includedStandardQuestionCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-white/10 px-6 py-4">
            <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-300">
                {selectedStudent?.email || 'Student not selected'} • Requested: {totalRequestedQuestions} • Can assign: {grantPreview.selectedQuestionIds.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-white/15 bg-slate-950/60 text-slate-100 hover:bg-slate-900"
                  onClick={() => setIsAssignDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAssignGrant}
                  className="rounded-full"
                  disabled={!canAssignGrant || busyKey === `assign_${selectedStudent?.id || ''}`}
                >
                  {busyKey === `assign_${selectedStudent?.id || ''}` ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Assign Practice Access
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
