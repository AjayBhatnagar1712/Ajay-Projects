'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { collection, doc, limit, orderBy, query, where } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Crown, Sparkles, UserSquare2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatTestDurationLabel } from '@/lib/test-duration';
import {
  buildPremiumCustomMockAttemptRuleFromLegacyLimit,
  formatPremiumCustomMockAttemptActionButtonLabel,
  resolvePremiumCustomMockAttemptUsage,
  type PremiumCustomMockAttemptPricingRule,
  type PremiumCustomMockAttemptState,
} from '@/lib/premium-custom-mock';
import {
  buildTeacherPremiumQuestionRowsFromQuestions,
  resolveTeacherPremiumQuestionAvailability,
} from '@/lib/teacher-premium-question-access';
import {
  isTeacherQuestionPurchaseActiveAt,
  type TeacherQuestionPurchasePublicScope,
} from '@/lib/teacher-question-purchase';
import { ALLOWED_TEACHER_AUTHOR_EMAIL } from '@/lib/teacher-authoring';
import { isPublicTeacherProfile } from '@/lib/teacher-approval';

type TeacherProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  roleId?: 'student' | 'teacher' | 'admin';
  status?: 'active' | 'blocked';
  teacherStatus?: 'pending' | 'approved' | 'rejected';
  teachingAssignments?: Array<{
    examTypeId?: string;
    classId?: string;
    allSubjects?: boolean;
    subjectIds?: string[];
  }>;
  publicTeacherQuestionPurchaseScopes?: TeacherQuestionPurchasePublicScope[];
};

type PricingOwnerProfile = { id: string };

type PracticeQuestion = {
  id: string;
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  accessLevel?: 'free' | 'paid';
  mockTestOnly?: boolean;
  teacherId?: string;
  alignments?: Array<{ examTypeId?: string; classId?: string; subjectId?: string }>;
};

type ExamType = { id: string; name?: string };
type ClassItem = { id: string; name?: string; examTypeId?: string };
type StudentCustomMockTest = {
  id: string;
  title?: string;
  accessLevel?: 'free' | 'paid';
  createdFromTeacherId?: string;
  premiumCombinationKey?: string;
  createdAt?: { toDate: () => Date };
  purchasedAt?: unknown;
  attemptLimit?: {
    mode?: 'unlimited' | 'total' | 'interval';
    maxTotalAttempts?: number | null;
    maxAttemptsPerInterval?: number | null;
    intervalValue?: number | null;
    intervalUnit?: 'day' | 'week' | 'month' | 'year' | null;
  };
  attemptPricing?: PremiumCustomMockAttemptPricingRule | null;
  attemptState?: PremiumCustomMockAttemptState | null;
  config?: { questionIds?: string[]; duration?: number | null };
};
type PremiumMockFeaturePurchase = {
  id?: string;
  teacherId?: string;
  examTypeId?: string;
  classId?: string;
  questionCount?: number;
  includedQuestionCount?: number;
  includedQuestionIds?: string[];
  includedSubjectConfigs?: Array<{ count?: number; numQuestions?: number }>;
  subjectConfigs?: Array<{ count?: number; numQuestions?: number }>;
  premiumCustomMockTestId?: string;
  status?: 'paid' | 'failed';
};

const normalizeAccessLevel = (value?: string) => String(value || '').trim().toLowerCase();
const isPaidQuestionForPremium = (question: PracticeQuestion) =>
  normalizeAccessLevel(question.accessLevel) === 'paid' && question.mockTestOnly !== true;

export default function TeacherPremiumMockPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const params = useParams<{ teacherId: string }>();
  const searchParams = useSearchParams();
  const teacherId = typeof params?.teacherId === 'string' ? params.teacherId : '';

  const examTypeId = searchParams.get('examTypeId') || '';
  const classId = searchParams.get('classId') || '';
  const premiumFeaturePurchaseIdParam = searchParams.get('premiumFeaturePurchaseId') || '';
  const subjectIds = (searchParams.get('subjectIds') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const examTypeName = searchParams.get('examTypeName') || '';
  const className = searchParams.get('className') || '';

  const teacherRef = useMemoFirebase(() => (firestore && teacherId ? doc(firestore, 'users', teacherId) : null), [firestore, teacherId]);
  const pricingOwnerQuery = useMemoFirebase(
    () => (
      firestore
        ? query(collection(firestore, 'users'), where('email', '==', ALLOWED_TEACHER_AUTHOR_EMAIL), limit(1))
        : null
    ),
    [firestore]
  );
  const { data: pricingOwnerRowsRaw, isLoading: pricingOwnerLoading } = useCollection<PricingOwnerProfile>(pricingOwnerQuery);
  const pricingOwner = useMemo(
    () => (Array.isArray(pricingOwnerRowsRaw) ? pricingOwnerRowsRaw[0] || null : null),
    [pricingOwnerRowsRaw]
  );
  const questionsQuery = useMemoFirebase(() => (firestore && teacherId ? query(collection(firestore, 'practice_questions'), where('teacherId', '==', teacherId)) : null), [firestore, teacherId]);
  const pricingOwnerQuestionsQuery = useMemoFirebase(
    () => (firestore && pricingOwner?.id ? query(collection(firestore, 'practice_questions'), where('teacherId', '==', pricingOwner.id)) : null),
    [firestore, pricingOwner?.id]
  );
  const examTypesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null), [firestore]);
  const classesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null), [firestore]);
  const customTestsQuery = useMemoFirebase(
    () => (firestore && user?.uid ? query(collection(firestore, 'users', user.uid, 'custom_tests'), orderBy('createdAt', 'desc')) : null),
    [firestore, user?.uid]
  );
  const premiumFeaturePurchasesQuery = useMemoFirebase(
    () => (firestore && user?.uid && teacherId
      ? query(collection(firestore, 'users', user.uid, 'premium_mock_feature_purchases'), where('teacherId', '==', teacherId))
      : null),
    [firestore, teacherId, user?.uid]
  );

  const { data: teacher, isLoading: teacherLoading } = useDoc<TeacherProfile>(teacherRef);
  const { data: teacherQuestionsRaw, isLoading: questionsLoading } = useCollection<PracticeQuestion>(questionsQuery);
  const { data: pricingOwnerQuestionsRaw, isLoading: pricingOwnerQuestionsLoading } = useCollection<PracticeQuestion>(pricingOwnerQuestionsQuery);
  const { data: examTypes, isLoading: examTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classes, isLoading: classesLoading } = useCollection<ClassItem>(classesQuery);
  const { data: customTests, isLoading: customTestsLoading } = useCollection<StudentCustomMockTest>(customTestsQuery);
  const { data: premiumFeaturePurchases, isLoading: premiumFeaturePurchasesLoading } = useCollection<PremiumMockFeaturePurchase>(premiumFeaturePurchasesQuery);
  const teacherQuestions = useMemo(
    () => (Array.isArray(teacherQuestionsRaw) ? teacherQuestionsRaw : []),
    [teacherQuestionsRaw]
  );
  const pricingOwnerQuestions = useMemo(
    () => (Array.isArray(pricingOwnerQuestionsRaw) ? pricingOwnerQuestionsRaw : []),
    [pricingOwnerQuestionsRaw]
  );
  const publicTeacherQuestionPurchaseScopes = useMemo(
    () =>
      (Array.isArray(teacher?.publicTeacherQuestionPurchaseScopes) ? teacher.publicTeacherQuestionPurchaseScopes : [])
        .filter((scope) => isTeacherQuestionPurchaseActiveAt(scope)),
    [teacher?.publicTeacherQuestionPurchaseScopes]
  );

  const fullName = useMemo(() => `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim() || 'Teacher', [teacher]);
  const [selectedExamTypeId, setSelectedExamTypeId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const effectiveExamTypeId = selectedExamTypeId;
  const effectiveClassId = selectedClassId;

  const purchasedPaidQuestions = useMemo(() => {
    if (!pricingOwner?.id || publicTeacherQuestionPurchaseScopes.length === 0) return [] as PracticeQuestion[];

    const ownerPaidQuestions = pricingOwnerQuestions.filter((question) => isPaidQuestionForPremium(question));
    if (ownerPaidQuestions.length === 0) return [] as PracticeQuestion[];

    const availability = resolveTeacherPremiumQuestionAvailability({
      rows: buildTeacherPremiumQuestionRowsFromQuestions(ownerPaidQuestions, { accessLevel: 'paid' }),
      purchases: publicTeacherQuestionPurchaseScopes as any,
      minimumStudentsRequired: 1,
      randomize: false,
    });

    const byId = new Map<string, PracticeQuestion>();
    availability.selectableRows.forEach((row) => {
      if (!row.question?.id || byId.has(row.question.id)) return;
      byId.set(row.question.id, row.question);
    });
    return Array.from(byId.values());
  }, [pricingOwner?.id, pricingOwnerQuestions, publicTeacherQuestionPurchaseScopes]);

  const paidQuestions = useMemo(() => {
    if (purchasedPaidQuestions.length > 0) {
      return purchasedPaidQuestions;
    }
    const byId = new Map<string, PracticeQuestion>();
    (teacherQuestions || []).forEach((question) => {
      if (!isPaidQuestionForPremium(question)) return;
      if (!question.id || byId.has(question.id)) return;
      byId.set(question.id, question);
    });
    return Array.from(byId.values());
  }, [purchasedPaidQuestions, teacherQuestions]);

  const contextQuestions = useMemo(() => {
    return paidQuestions.filter((question) => {
      const directMatch =
        (!effectiveExamTypeId || question.examTypeId === effectiveExamTypeId) &&
        (!effectiveClassId || question.classId === effectiveClassId) &&
        (subjectIds.length === 0 || (question.subjectId ? subjectIds.includes(question.subjectId) : false));

      const alignmentMatch = (question.alignments || []).some((alignment) => {
        return (
          (!effectiveExamTypeId || alignment.examTypeId === effectiveExamTypeId) &&
          (!effectiveClassId || alignment.classId === effectiveClassId) &&
          (subjectIds.length === 0 || (alignment.subjectId ? subjectIds.includes(alignment.subjectId) : false))
        );
      });

      return directMatch || alignmentMatch;
    });
  }, [paidQuestions, effectiveExamTypeId, effectiveClassId, subjectIds]);

  const premiumCount = useMemo(
    () => paidQuestions.length,
    [paidQuestions]
  );

  const paidCombos = useMemo(() => {
    const comboMap = new Map<string, { examTypeId: string; classId: string; questionIds: Set<string> }>();
    paidQuestions.forEach((question) => {
      const candidates = [
        { examTypeId: question.examTypeId, classId: question.classId },
        ...(question.alignments || []).map((alignment) => ({ examTypeId: alignment.examTypeId, classId: alignment.classId })),
      ];
      const uniqueCandidateKeys = new Set<string>();
      candidates.forEach((candidate) => {
        if (!candidate.examTypeId || !candidate.classId) return;
        uniqueCandidateKeys.add(`${candidate.examTypeId}__${candidate.classId}`);
      });
      uniqueCandidateKeys.forEach((key) => {
        const [candidateExamTypeId, candidateClassId] = key.split('__');
        const existing = comboMap.get(key);
        if (!existing) {
          comboMap.set(key, {
            examTypeId: candidateExamTypeId,
            classId: candidateClassId,
            questionIds: new Set(question.id ? [question.id] : []),
          });
          return;
        }
        if (question.id) {
          existing.questionIds.add(question.id);
        }
      });
    });
    return Array.from(comboMap.entries()).map(([key, value]) => ({
      key,
      examTypeId: value.examTypeId,
      classId: value.classId,
      questionCount: value.questionIds.size,
    }));
  }, [paidQuestions]);

  const assignmentCombos = useMemo(() => {
    const comboMap = new Map<string, { examTypeId: string; classId: string }>();
    (teacher?.teachingAssignments || []).forEach((assignment) => {
      const assignedExamTypeId = assignment.examTypeId || '';
      const assignedClassId = assignment.classId || '';
      if (!assignedExamTypeId || !assignedClassId) return;
      const key = `${assignedExamTypeId}__${assignedClassId}`;
      if (comboMap.has(key)) return;
      comboMap.set(key, { examTypeId: assignedExamTypeId, classId: assignedClassId });
    });
    return Array.from(comboMap.entries()).map(([key, value]) => ({
      key,
      examTypeId: value.examTypeId,
      classId: value.classId,
    }));
  }, [teacher?.teachingAssignments]);

  const paidComboCountByKey = useMemo(() => {
    const map = new Map<string, number>();
    paidCombos.forEach((combo) => map.set(combo.key, combo.questionCount));
    return map;
  }, [paidCombos]);

  const comboBase = assignmentCombos.length > 0 ? assignmentCombos : paidCombos;
  const comboOptions = useMemo(() => {
    const examNameById = new Map((examTypes || []).map((item) => [item.id, item.name || 'Exam']));
    const classNameById = new Map((classes || []).map((item) => [item.id, item.name || 'Curriculum']));
    return comboBase
      .map((combo) => ({
        ...combo,
        examName: examNameById.get(combo.examTypeId) || combo.examTypeId,
        className: classNameById.get(combo.classId) || combo.classId,
        questionCount: paidComboCountByKey.get(combo.key) || 0,
      }))
      .sort((a, b) => `${a.examName}__${a.className}`.localeCompare(`${b.examName}__${b.className}`));
  }, [comboBase, examTypes, classes, paidComboCountByKey]);

  useEffect(() => {
    if (comboOptions.length === 0) {
      if (selectedExamTypeId) setSelectedExamTypeId('');
      if (selectedClassId) setSelectedClassId('');
      return;
    }

    const queryExamTypeId = examTypeId || '';
    const queryClassId = classId || '';
    const queryKey = queryExamTypeId && queryClassId ? `${queryExamTypeId}__${queryClassId}` : '';
    if (queryKey && comboOptions.some((combo) => combo.key === queryKey)) {
      if (!selectedExamTypeId && !selectedClassId) {
        setSelectedExamTypeId(queryExamTypeId);
        setSelectedClassId(queryClassId);
      }
    } else if (selectedExamTypeId && selectedClassId && !comboOptions.some((combo) => combo.key === `${selectedExamTypeId}__${selectedClassId}`)) {
      setSelectedExamTypeId('');
      setSelectedClassId('');
      return;
    }
  }, [comboOptions, examTypeId, classId, selectedExamTypeId, selectedClassId]);

  useEffect(() => {
    if (!selectedExamTypeId) {
      if (selectedClassId) setSelectedClassId('');
      return;
    }
    if (!comboOptions.some((combo) => combo.examTypeId === selectedExamTypeId && combo.classId === selectedClassId)) {
      setSelectedClassId('');
    }
  }, [comboOptions, selectedExamTypeId, selectedClassId]);

  const selectedComboKey = selectedExamTypeId && selectedClassId ? `${selectedExamTypeId}__${selectedClassId}` : '';

  const premiumTestsForTeacher = useMemo(
    () =>
      (customTests || []).filter(
        (test) => test.accessLevel === 'paid' && test.createdFromTeacherId === teacherId
      ),
    [customTests, teacherId]
  );
  const premiumAttemptUsageByTestId = useMemo(() => {
    return Object.fromEntries(
      premiumTestsForTeacher.map((test) => {
        const usage = resolvePremiumCustomMockAttemptUsage({
          attemptPricing: test.attemptPricing || buildPremiumCustomMockAttemptRuleFromLegacyLimit(test.attemptLimit),
          attemptState: test.attemptState,
          purchasedAt: test.purchasedAt || test.createdAt,
        });
        return [test.id, usage];
      })
    ) as Record<string, ReturnType<typeof resolvePremiumCustomMockAttemptUsage>>;
  }, [premiumTestsForTeacher]);

  const selectedCombo = useMemo(
    () => comboOptions.find((combo) => combo.key === selectedComboKey) || null,
    [comboOptions, selectedComboKey]
  );
  const canCreatePremiumMock = !!selectedCombo && selectedCombo.questionCount > 0;
  const matchingFeaturePurchase = useMemo(() => {
    const getIncludedQuestionCount = (purchase: {
      includedQuestionCount?: number;
      includedQuestionIds?: string[];
      questionCount?: number;
      includedSubjectConfigs?: Array<{ count?: number; numQuestions?: number }>;
      subjectConfigs?: Array<{ count?: number; numQuestions?: number }>;
    }) => {
      const configs = Array.isArray(purchase.includedSubjectConfigs)
        ? purchase.includedSubjectConfigs
        : Array.isArray(purchase.subjectConfigs)
          ? purchase.subjectConfigs
          : [];
      const configuredCount = configs.reduce(
        (count, config) => count + Math.max(0, Number(config?.count ?? config?.numQuestions ?? 0)),
        0
      );
      const storedIdsCount = Array.isArray(purchase.includedQuestionIds)
        ? purchase.includedQuestionIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).length
        : 0;
      const storedCount = Math.max(0, Number(purchase.includedQuestionCount ?? purchase.questionCount ?? 0));
      return Math.max(storedCount, configuredCount, storedIdsCount);
    };
    const paidPurchases = (premiumFeaturePurchases || [])
      .map((purchase) => ({ ...purchase, id: String(purchase.id || '').trim() }))
      .filter((purchase) => purchase.id && purchase.status === 'paid');
    if (premiumFeaturePurchaseIdParam) {
      return paidPurchases.find((purchase) => purchase.id === premiumFeaturePurchaseIdParam) || null;
    }
    if (!selectedCombo) return null;
    return paidPurchases.find((purchase) =>
      purchase.examTypeId === selectedCombo.examTypeId
      && purchase.classId === selectedCombo.classId
      && getIncludedQuestionCount(purchase) > 0
    ) || null;
  }, [premiumFeaturePurchaseIdParam, premiumFeaturePurchases, selectedCombo]);

  const loading =
    teacherLoading
    || pricingOwnerLoading
    || questionsLoading
    || pricingOwnerQuestionsLoading
    || examTypesLoading
    || classesLoading
    || customTestsLoading
    || premiumFeaturePurchasesLoading;
  const headerTitle = `${fullName} Premium Mock Test`;
  const isTeacherAvailable = teacher?.roleId === 'teacher' && isPublicTeacherProfile(teacher);

  if (!loading && !isTeacherAvailable) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title={headerTitle} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="border-dashed">
            <CardContent className="p-10 text-center text-muted-foreground">
              Teacher profile not available.
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const handleCreatePremiumMock = () => {
    if (!canCreatePremiumMock || !selectedCombo) return;
    const params = new URLSearchParams({
      mode: 'premium',
      teacherId,
      examTypeId: selectedCombo.examTypeId,
      classId: selectedCombo.classId,
      examTypeName: selectedCombo.examName,
      className: selectedCombo.className,
    });
    if (matchingFeaturePurchase?.id) {
      params.set('premiumFeaturePurchaseId', matchingFeaturePurchase.id);
    }
    const createUrl = `/custom-mock-tests/create?${params.toString()}`;
    router.push(createUrl);
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title={headerTitle} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="overflow-hidden border-amber-400/30 bg-gradient-to-r from-amber-950/50 via-orange-950/35 to-yellow-950/40">
              <CardContent className="p-6 md:p-7">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200">
                  <Crown className="h-3.5 w-3.5" />
                  Premium Question Access
                </p>
                <h2 className="mt-2 text-2xl font-semibold md:text-3xl">{fullName} Premium Mock Test</h2>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
                  Build paid premium mock tests from this teacher&apos;s premium question bank to level up speed, precision, and exam temperament.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline">Exam: {examTypeName || examTypeId || '-'}</Badge>
                  <Badge variant="outline">Curriculum: {className || classId || '-'}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Sparkles className="h-5 w-5 text-amber-300" />
                  Premium Access Setup
                </CardTitle>
                <CardDescription>
                  Select exam and curriculum, then create a paid premium mock test.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-amber-300/20 bg-amber-500/10 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-amber-200">Paid In Selected Context</p>
                    <p className="mt-1 text-xl font-semibold">{contextQuestions.length}</p>
                  </div>
                  <div className="rounded-lg border border-indigo-300/20 bg-indigo-500/10 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-indigo-200">Teacher-Wide Paid</p>
                    <p className="mt-1 text-xl font-semibold">{premiumCount}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>1. Access harder and more exam-like questions from this teacher.</li>
                    <li>2. Select your exam and curriculum from the teacher&apos;s mapped options.</li>
                    <li>3. Create premium custom mocks only from paid-access teacher question banks.</li>
                  </ul>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Exam</p>
                    <Select
                      value={selectedExamTypeId}
                      onValueChange={(value) => {
                        setSelectedExamTypeId(value);
                        setSelectedClassId('');
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set(comboOptions.map((combo) => combo.examTypeId))).map((id) => {
                          const combo = comboOptions.find((item) => item.examTypeId === id);
                          return (
                            <SelectItem key={id} value={id}>
                              {combo?.examName || id}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Curriculum</p>
                    <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={!selectedExamTypeId}>
                      <SelectTrigger><SelectValue placeholder="Select curriculum" /></SelectTrigger>
                      <SelectContent>
                        {comboOptions
                          .filter((combo) => combo.examTypeId === selectedExamTypeId)
                          .map((combo) => (
                            <SelectItem key={combo.key} value={combo.classId}>
                              {combo.className}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedCombo ? (
                  <div className="rounded-xl border border-border/70 bg-slate-950/40 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{selectedCombo.examName} / {selectedCombo.className}</p>
                        <p className="text-muted-foreground">Paid question bank count: {selectedCombo.questionCount}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          selectedCombo.questionCount > 0
                            ? 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100'
                            : 'border-amber-300/40 bg-amber-500/10 text-amber-100'
                        }
                      >
                        {selectedCombo.questionCount > 0 ? 'Paid Questions Available' : 'No Paid Questions Yet'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {selectedCombo.questionCount > 0
                        ? 'You can now create and edit premium mock tests for this exam and curriculum.'
                        : 'Teacher is currently gathering premium questions for this exam and curriculum. Please check back soon or choose another mapped combination.'}
                    </p>
                    {matchingFeaturePurchase ? (
                      <p className="mt-2 text-xs text-emerald-200/85">
                        Offer/prepaid access linked: {Math.max(0, Number(matchingFeaturePurchase.questionCount || 0))} question{Number(matchingFeaturePurchase.questionCount || 0) === 1 ? '' : 's'} are already included before any extra charge.
                      </p>
                    ) : null}
                    {selectedCombo.questionCount <= 0 ? (
                      <p className="mt-2 text-xs text-amber-200/85">
                        Premium question bank is being prepared for this combination.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">
                    {comboOptions.length === 0
                      ? 'No exam/curriculum options are mapped by this teacher yet.'
                      : 'Select an exam and curriculum to continue.'}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2">
                  <Button
                    type="button"
                    onClick={handleCreatePremiumMock}
                    className="h-10 rounded-full border border-cyan-300/35 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-400 px-5 font-semibold text-slate-950 shadow-[0_10px_24px_-12px_rgba(56,189,248,0.75)] transition-all hover:from-cyan-300 hover:via-sky-300 hover:to-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canCreatePremiumMock}
                  >
                    Create Premium Mock Test (Paid) <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button asChild variant="ghost" className="h-9 rounded-full px-4 text-sm">
                    <Link href={`/teachers/${teacherId}`}>
                      View Teacher Profile <UserSquare2 className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle>Created Premium Mock Tests</CardTitle>
                <CardDescription>Premium self-created tests from this teacher&apos;s paid question bank.</CardDescription>
              </CardHeader>
              <CardContent>
                {premiumTestsForTeacher.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-8 text-center text-muted-foreground">
                    No premium mock tests created yet for this teacher.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {premiumTestsForTeacher.map((test) => {
                      const usage = premiumAttemptUsageByTestId[test.id];
                      const attemptsLeftLabel = usage?.attemptsLeft === null ? 'Unlimited' : String(usage?.attemptsLeft ?? 0);
                      const primaryHref = usage?.isExhausted
                        ? `/custom-mock-tests/create?editTestId=${encodeURIComponent(test.id)}&mode=premium`
                        : `/test/${test.id}?type=custom`;
                      const primaryLabel = formatPremiumCustomMockAttemptActionButtonLabel(usage, 'Start Premium Attempt');
                      return (
                        <Card key={test.id} className="border-border/70 bg-gradient-to-b from-slate-900/90 to-amber-950/40">
                          <CardContent className="pt-4 space-y-3">
                            <p className="text-lg font-semibold">{test.title || 'Untitled Premium Mock Test'}</p>
                            <p className="text-xs text-muted-foreground">
                              Questions: {test.config?.questionIds?.length || 0} | Duration: {formatTestDurationLabel(test.config?.duration)}
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-amber-100/85">
                                Attempt Rule
                                <p className="mt-1 text-sm font-semibold text-amber-50">{usage?.ruleLabel || 'Unlimited attempts'}</p>
                              </div>
                              <div className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-cyan-100/85">
                                Attempts Left
                                <p className="mt-1 text-sm font-semibold text-cyan-50">{attemptsLeftLabel}</p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {usage?.isExhausted
                                ? (usage.actionAmount > 0
                                  ? `${usage.usageLabel}. ${usage.actionLabel} for INR ${usage.actionAmount.toLocaleString()}.`
                                  : `${usage.usageLabel}. ${usage.actionLabel}.`)
                                : (usage?.usageLabel || 'No attempts yet.')}
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <Button asChild variant="outline" className="rounded-full">
                                <Link href={`/my-practice/custom-tests/${test.id}/attempt-history`}>
                                  Attempt History
                                </Link>
                              </Button>
                              {usage?.isExhausted && usage.actionKind === 'none' ? (
                                <Button className="rounded-full" disabled>
                                  Attempts Exhausted
                                </Button>
                              ) : (
                                <Button asChild className="rounded-full">
                                  <Link href={primaryHref}>
                                    {primaryLabel}
                                  </Link>
                                </Button>
                              )}
                              <Button asChild variant="outline" className="rounded-full sm:col-span-2">
                                <Link href={`/custom-mock-tests/create?editTestId=${encodeURIComponent(test.id)}&mode=premium`}>
                                  Edit Premium Mock Test
                                </Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
