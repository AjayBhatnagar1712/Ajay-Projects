'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { ArrowLeft, BookOpen, FileText, Layers3, LoaderCircle, PackagePlus, Pencil, Sparkles, Video, X } from 'lucide-react';

import DashboardHeader from '@/components/dashboard-header';
import TeacherOfferCustomMockBuilder from '@/components/subscription/teacher-offer-custom-mock-builder';
import TeacherOfferPracticePackBuilder from '@/components/subscription/teacher-offer-practice-pack-builder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { addDocumentNonBlocking, updateDocumentNonBlocking, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useToast } from '@/hooks/use-toast';
import { isStandaloneMockTest } from '@/lib/mock-test-visibility';
import { formatPremiumCustomMockAttemptPricingRule } from '@/lib/premium-custom-mock';
import { formatPremiumPracticeAttemptPricingRule } from '@/lib/premium-practice-session';
import { isAllowedTeacherAuthorEmail } from '@/lib/teacher-authoring';
import {
  countTeacherOfferSelections,
  type TeacherOffer,
  type TeacherOfferCustomMockPack,
  type TeacherOfferPracticePack,
} from '@/lib/teacher-offers';
import { cn } from '@/lib/utils';

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string; examTypeId: string };
type Subject = { id: string; name: string; classId: string };

type Course = {
  id: string;
  title?: string;
  teacherId?: string;
  accessLevel?: 'free' | 'paid';
  price?: number;
  publicationStatus?: 'draft' | 'published' | 'deleted';
  classId?: string;
  subjectIds?: string[];
  isCrashCourse?: boolean;
};

type MockTest = {
  id: string;
  title?: string;
  teacherId?: string;
  accessLevel?: 'free' | 'paid';
  price?: number;
  publicationStatus?: 'draft' | 'published' | 'deleted';
  isCourseOnly?: boolean;
  courseId?: string;
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  subjectIds?: string[];
  config?: {
    subjectConfigs?: Array<{
      subjectId?: string;
    }>;
  };
};

type LiveBatch = {
  id: string;
  title?: string;
  teacherId?: string;
  accessLevel?: 'free' | 'paid';
  price?: number;
  publicationStatus?: 'draft' | 'published' | 'deleted';
  examTypeId?: string;
  classId?: string;
  subjectIds?: string[];
  totalSessions?: number;
};

type SelectionCardProps = {
  title: string;
  subtitle: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  meta?: ReactNode;
  trailing?: ReactNode;
};

const isPaidContent = (item: { accessLevel?: 'free' | 'paid'; price?: number }) =>
  item.accessLevel === 'paid' || (typeof item.price === 'number' && item.price > 0);

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const uniqueValues = (values: Array<string | undefined | null>) => Array.from(new Set(values.filter(Boolean))) as string[];

const buildMockSubjectIds = (mockTest: MockTest) => uniqueValues([
  mockTest.subjectId,
  ...(mockTest.subjectIds || []),
  ...((mockTest.config?.subjectConfigs || []).map((config) => config.subjectId)),
]);

const hasSelectedSubjectMatch = (itemSubjectIds: string[] | undefined, selectedSubjectIds: string[]) => {
  if (selectedSubjectIds.length === 0) return true;
  const itemSubjectIdSet = new Set(itemSubjectIds || []);
  return selectedSubjectIds.some((subjectId) => itemSubjectIdSet.has(subjectId));
};

function SelectionCard({ title, subtitle, checked, onToggle, meta, trailing }: SelectionCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition',
        checked ? 'border-primary/50 bg-primary/10' : 'border-border/70 bg-background/40 hover:border-primary/30 hover:bg-primary/5'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
          <Checkbox checked={checked} onCheckedChange={(value) => onToggle(!!value)} className="mt-0.5" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            {meta ? <div className="mt-2">{meta}</div> : null}
          </div>
        </label>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </div>
  );
}

export default function SubscriptionOffersPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const allowStandaloneMockTests = isAllowedTeacherAuthorEmail(user?.email);

  const [title, setTitle] = useState('');
  const [examTypeId, setExamTypeId] = useState('');
  const [classId, setClassId] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [price, setPrice] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [selectedCrashCourseIds, setSelectedCrashCourseIds] = useState<string[]>([]);
  const [selectedMockTestIds, setSelectedMockTestIds] = useState<string[]>([]);
  const [selectedLiveBatchIds, setSelectedLiveBatchIds] = useState<string[]>([]);
  const [includedSessionsByBatchId, setIncludedSessionsByBatchId] = useState<Record<string, string>>({});
  const [practicePack, setPracticePack] = useState<TeacherOfferPracticePack | null>(null);
  const [practicePackResetToken, setPracticePackResetToken] = useState(0);
  const [customMockPack, setCustomMockPack] = useState<TeacherOfferCustomMockPack | null>(null);
  const [customMockPackResetToken, setCustomMockPackResetToken] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState('');
  const [hydratedEditingOfferId, setHydratedEditingOfferId] = useState('');

  useEffect(() => {
    const offerId = new URLSearchParams(window.location.search).get('edit') || '';
    setEditingOfferId(offerId);
  }, []);

  const examTypesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null), [firestore]);
  const classesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null), [firestore]);
  const subjectsQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null), [firestore]);
  const teacherCoursesQuery = useMemoFirebase(
    () => (firestore && user?.uid ? query(collection(firestore, 'courses'), where('teacherId', '==', user.uid)) : null),
    [firestore, user?.uid]
  );
  const teacherMockTestsQuery = useMemoFirebase(
    () => (firestore && user?.uid ? query(collection(firestore, 'mock_tests'), where('teacherId', '==', user.uid)) : null),
    [firestore, user?.uid]
  );
  const teacherLiveBatchesQuery = useMemoFirebase(
    () => (firestore && user?.uid ? query(collection(firestore, 'live_batches'), where('teacherId', '==', user.uid)) : null),
    [firestore, user?.uid]
  );
  const teacherOffersQuery = useMemoFirebase(
    () => (firestore && user?.uid ? query(collection(firestore, 'teacher_offers'), where('createdByTeacherId', '==', user.uid)) : null),
    [firestore, user?.uid]
  );

  const { data: examTypes, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classes, isLoading: areClassesLoading } = useCollection<ClassItem>(classesQuery);
  const { data: subjects, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: teacherCourses, isLoading: areTeacherCoursesLoading } = useCollection<Course>(teacherCoursesQuery);
  const { data: teacherMockTests, isLoading: areTeacherMockTestsLoading } = useCollection<MockTest>(teacherMockTestsQuery);
  const { data: teacherLiveBatches, isLoading: areTeacherLiveBatchesLoading } = useCollection<LiveBatch>(teacherLiveBatchesQuery);
  const { data: teacherOffers, isLoading: areTeacherOffersLoading } = useCollection<TeacherOffer>(teacherOffersQuery);

  const examTypeNameById = useMemo(
    () => Object.fromEntries((examTypes || []).map((examType) => [examType.id, examType.name])),
    [examTypes]
  );
  const classNameById = useMemo(
    () => Object.fromEntries((classes || []).map((classItem) => [classItem.id, classItem.name])),
    [classes]
  );
  const classExamTypeById = useMemo(
    () => Object.fromEntries((classes || []).map((classItem) => [classItem.id, classItem.examTypeId])),
    [classes]
  );
  const subjectNameById = useMemo(
    () => Object.fromEntries((subjects || []).map((subject) => [subject.id, subject.name])),
    [subjects]
  );

  const paidCourses = useMemo(
    () => (teacherCourses || []).filter((course) => isPaidContent(course) && course.publicationStatus !== 'deleted'),
    [teacherCourses]
  );
  const paidRegularCourses = useMemo(() => paidCourses.filter((course) => !course.isCrashCourse), [paidCourses]);
  const paidCrashCourses = useMemo(() => paidCourses.filter((course) => !!course.isCrashCourse), [paidCourses]);
  const paidMockTests = useMemo(
    () => allowStandaloneMockTests
      ? (teacherMockTests || []).filter((mockTest) => isStandaloneMockTest(mockTest) && isPaidContent(mockTest) && mockTest.publicationStatus !== 'deleted')
      : [],
    [allowStandaloneMockTests, teacherMockTests]
  );
  const paidLiveBatches = useMemo(
    () => (teacherLiveBatches || []).filter((liveBatch) => isPaidContent(liveBatch) && liveBatch.publicationStatus !== 'deleted'),
    [teacherLiveBatches]
  );

  const sortedTeacherOffers = useMemo(() => {
    return (teacherOffers || [])
      .filter((offer) => String(offer.status || 'active') !== 'archived')
      .sort((left, right) => {
      const leftTime = toDate(left.updatedAt)?.getTime() || toDate(left.createdAt)?.getTime() || 0;
      const rightTime = toDate(right.updatedAt)?.getTime() || toDate(right.createdAt)?.getTime() || 0;
      return rightTime - leftTime;
    });
  }, [teacherOffers]);
  const editingOffer = useMemo(
    () => sortedTeacherOffers.find((offer) => offer.id === editingOfferId) || null,
    [editingOfferId, sortedTeacherOffers]
  );

  const filteredClasses = useMemo(
    () => (classes || []).filter((classItem) => !examTypeId || classItem.examTypeId === examTypeId),
    [classes, examTypeId]
  );
  const filteredSubjects = useMemo(
    () => (classId ? (subjects || []).filter((subject) => subject.classId === classId) : []),
    [subjects, classId]
  );

  const filteredRegularCourses = useMemo(() => {
    return paidRegularCourses.filter((course) => {
      if (examTypeId && classExamTypeById[course.classId || ''] !== examTypeId) return false;
      if (classId && course.classId !== classId) return false;
      return hasSelectedSubjectMatch(course.subjectIds || [], selectedSubjectIds);
    });
  }, [paidRegularCourses, examTypeId, classExamTypeById, classId, selectedSubjectIds]);

  const filteredCrashCourses = useMemo(() => {
    return paidCrashCourses.filter((course) => {
      if (examTypeId && classExamTypeById[course.classId || ''] !== examTypeId) return false;
      if (classId && course.classId !== classId) return false;
      return hasSelectedSubjectMatch(course.subjectIds || [], selectedSubjectIds);
    });
  }, [paidCrashCourses, examTypeId, classExamTypeById, classId, selectedSubjectIds]);

  const filteredMockTests = useMemo(() => {
    return paidMockTests.filter((mockTest) => {
      if (examTypeId && mockTest.examTypeId !== examTypeId) return false;
      if (classId && mockTest.classId !== classId) return false;
      return hasSelectedSubjectMatch(buildMockSubjectIds(mockTest), selectedSubjectIds);
    });
  }, [paidMockTests, examTypeId, classId, selectedSubjectIds]);

  const filteredLiveBatches = useMemo(() => {
    return paidLiveBatches.filter((liveBatch) => {
      if (examTypeId && liveBatch.examTypeId !== examTypeId) return false;
      if (classId && liveBatch.classId !== classId) return false;
      return hasSelectedSubjectMatch(liveBatch.subjectIds || [], selectedSubjectIds);
    });
  }, [paidLiveBatches, examTypeId, classId, selectedSubjectIds]);

  const regularCourseById = useMemo(
    () => Object.fromEntries(paidRegularCourses.map((course) => [course.id, course])),
    [paidRegularCourses]
  );
  const crashCourseById = useMemo(
    () => Object.fromEntries(paidCrashCourses.map((course) => [course.id, course])),
    [paidCrashCourses]
  );
  const mockTestById = useMemo(
    () => Object.fromEntries(paidMockTests.map((mockTest) => [mockTest.id, mockTest])),
    [paidMockTests]
  );
  const liveBatchById = useMemo(
    () => Object.fromEntries(paidLiveBatches.map((liveBatch) => [liveBatch.id, liveBatch])),
    [paidLiveBatches]
  );

  useEffect(() => {
    if (isTeacherLoading) return;
    if (!isTeacher) {
      router.replace('/dashboard');
    }
  }, [isTeacher, isTeacherLoading, router]);

  useEffect(() => {
    if (!classId) return;
    if (!filteredClasses.some((classItem) => classItem.id === classId)) {
      setClassId('');
    }
  }, [classId, filteredClasses]);

  useEffect(() => {
    const filteredSubjectIdSet = new Set(filteredSubjects.map((subject) => subject.id));
    setSelectedSubjectIds((current) => current.filter((subjectId) => filteredSubjectIdSet.has(subjectId)));
  }, [filteredSubjects]);

  useEffect(() => {
    const allowedIds = new Set(filteredRegularCourses.map((course) => course.id));
    setSelectedCourseIds((current) => current.filter((courseId) => allowedIds.has(courseId)));
  }, [filteredRegularCourses]);

  useEffect(() => {
    const allowedIds = new Set(filteredCrashCourses.map((course) => course.id));
    setSelectedCrashCourseIds((current) => current.filter((courseId) => allowedIds.has(courseId)));
  }, [filteredCrashCourses]);

  useEffect(() => {
    const allowedIds = new Set(filteredMockTests.map((mockTest) => mockTest.id));
    setSelectedMockTestIds((current) => current.filter((mockTestId) => allowedIds.has(mockTestId)));
  }, [filteredMockTests]);

  useEffect(() => {
    const allowedIds = new Set(filteredLiveBatches.map((liveBatch) => liveBatch.id));
    setSelectedLiveBatchIds((current) => current.filter((liveBatchId) => allowedIds.has(liveBatchId)));
    setIncludedSessionsByBatchId((current) =>
      Object.fromEntries(Object.entries(current).filter(([liveBatchId]) => allowedIds.has(liveBatchId)))
    );
  }, [filteredLiveBatches]);

  const isLoading =
    isTeacherLoading
    || areExamTypesLoading
    || areClassesLoading
    || areSubjectsLoading
    || areTeacherCoursesLoading
    || areTeacherMockTestsLoading
    || areTeacherLiveBatchesLoading
    || areTeacherOffersLoading;

  useEffect(() => {
    if (isLoading || !editingOfferId || editingOffer) return;
    toast({
      variant: 'destructive',
      title: 'Offer not found',
      description: 'This offer is unavailable or no longer belongs to your account.',
    });
    setEditingOfferId('');
    setHydratedEditingOfferId('');
    router.replace('/subscription/offers', { scroll: false });
  }, [editingOffer, editingOfferId, isLoading, router, toast]);

  useEffect(() => {
    if (isLoading || !editingOfferId || !editingOffer || hydratedEditingOfferId === editingOfferId) return;

    setTitle(String(editingOffer.title || ''));
    setExamTypeId(String(editingOffer.examTypeId || ''));
    setClassId(String(editingOffer.classId || ''));
    setSelectedSubjectIds(Array.isArray(editingOffer.subjectIds) ? editingOffer.subjectIds : []);
    setPrice(String(Math.max(0, Number(editingOffer.price || 0))));
    setSelectedCourseIds((editingOffer.courses || []).map((course) => course.id).filter(Boolean));
    setSelectedCrashCourseIds((editingOffer.crashCourses || []).map((course) => course.id).filter(Boolean));
    setSelectedMockTestIds(
      allowStandaloneMockTests ? (editingOffer.mockTests || []).map((mockTest) => mockTest.id).filter(Boolean) : []
    );
    setSelectedLiveBatchIds((editingOffer.liveBatches || []).map((liveBatch) => liveBatch.id).filter(Boolean));
    setIncludedSessionsByBatchId(
      Object.fromEntries(
        (editingOffer.liveBatches || []).map((liveBatch) => [
          liveBatch.id,
          String(Math.max(1, Number(liveBatch.includedSessions || 1))),
        ])
      )
    );
    setPracticePack(editingOffer.premiumPracticePack || null);
    setCustomMockPack(editingOffer.premiumCustomMockPack || null);
    setPracticePackResetToken((current) => current + 1);
    setCustomMockPackResetToken((current) => current + 1);
    setHydratedEditingOfferId(editingOfferId);
  }, [allowStandaloneMockTests, editingOffer, editingOfferId, hydratedEditingOfferId, isLoading]);

  const totalPaidItemsCount = paidRegularCourses.length + paidCrashCourses.length + paidMockTests.length + paidLiveBatches.length;
  const selectedLiveSessionCount = selectedLiveBatchIds.reduce(
    (sum, liveBatchId) => sum + Math.max(0, Number(includedSessionsByBatchId[liveBatchId] || 0)),
    0
  );
  const selectedItemCount =
    selectedCourseIds.length
    + selectedCrashCourseIds.length
    + selectedMockTestIds.length
    + selectedLiveBatchIds.length
    + (practicePack?.totalQuestions ? 1 : 0)
    + (customMockPack?.totalQuestions ? 1 : 0);

  const selectedLabels = useMemo(() => {
    return [
      ...selectedCourseIds.map((courseId) => `Course: ${regularCourseById[courseId]?.title || 'Untitled Course'}`),
      ...selectedCrashCourseIds.map((courseId) => `Crash: ${crashCourseById[courseId]?.title || 'Untitled Crash Course'}`),
      ...(allowStandaloneMockTests ? selectedMockTestIds.map((mockTestId) => `Mock: ${mockTestById[mockTestId]?.title || 'Untitled Mock Test'}`) : []),
      ...selectedLiveBatchIds.map((liveBatchId) => `Batch: ${liveBatchById[liveBatchId]?.title || 'Untitled Live Batch'}`),
      ...(practicePack?.totalQuestions ? [`Practice: ${practicePack.totalQuestions} questions`] : []),
      ...(customMockPack?.totalQuestions ? [`Custom Mock: ${customMockPack.totalQuestions} questions`] : []),
    ];
  }, [
    selectedCourseIds,
    regularCourseById,
    selectedCrashCourseIds,
    crashCourseById,
    selectedMockTestIds,
    mockTestById,
    selectedLiveBatchIds,
    liveBatchById,
    practicePack,
    customMockPack,
  ]);

  const toggleSubject = (subjectId: string, checked: boolean) => {
    setSelectedSubjectIds((current) =>
      checked ? (current.includes(subjectId) ? current : [...current, subjectId]) : current.filter((value) => value !== subjectId)
    );
  };

  const toggleSelection = (
    itemId: string,
    checked: boolean,
    setter: Dispatch<SetStateAction<string[]>>
  ) => {
    setter((current) =>
      checked ? (current.includes(itemId) ? current : [...current, itemId]) : current.filter((value) => value !== itemId)
    );
  };

  const toggleLiveBatch = (liveBatch: LiveBatch, checked: boolean) => {
    setSelectedLiveBatchIds((current) =>
      checked ? (current.includes(liveBatch.id) ? current : [...current, liveBatch.id]) : current.filter((value) => value !== liveBatch.id)
    );
    setIncludedSessionsByBatchId((current) => {
      if (!checked) {
        const next = { ...current };
        delete next[liveBatch.id];
        return next;
      }
      const defaultSessions = Math.max(1, Number(liveBatch.totalSessions || 1));
      return {
        ...current,
        [liveBatch.id]: current[liveBatch.id] || String(defaultSessions),
      };
    });
  };

  const resetOfferForm = () => {
    setTitle('');
    setExamTypeId('');
    setClassId('');
    setSelectedSubjectIds([]);
    setPrice('');
    setSelectedCourseIds([]);
    setSelectedCrashCourseIds([]);
    setSelectedMockTestIds([]);
    setSelectedLiveBatchIds([]);
    setIncludedSessionsByBatchId({});
    setPracticePack(null);
    setPracticePackResetToken((current) => current + 1);
    setCustomMockPack(null);
    setCustomMockPackResetToken((current) => current + 1);
  };

  const handleStartEditingOffer = (offer: TeacherOffer) => {
    if (!offer.id) return;
    setHydratedEditingOfferId('');
    setEditingOfferId(offer.id);
    router.replace(`/subscription/offers?edit=${encodeURIComponent(offer.id)}`, { scroll: false });
    window.setTimeout(() => {
      document.getElementById('offer-builder-basics')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleCancelEditing = () => {
    setEditingOfferId('');
    setHydratedEditingOfferId('');
    resetOfferForm();
    router.replace('/subscription/offers', { scroll: false });
  };

  const handleSaveOffer = async () => {
    if (!firestore || !user?.uid) return;

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      toast({
        variant: 'destructive',
        title: 'Add an offer title',
        description: 'Use at least 3 characters so the bundle can be identified later.',
      });
      return;
    }
    if (!examTypeId || !classId) {
      toast({
        variant: 'destructive',
        title: 'Select exam and curriculum',
        description: 'Teacher offers need both exam and curriculum before they can be saved.',
      });
      return;
    }
    if (selectedItemCount === 0) {
      toast({
        variant: 'destructive',
        title: 'Choose content for the offer',
        description: `Add at least one course, crash course,${allowStandaloneMockTests ? ' mock test,' : ''} live batch, practice pack, or premium custom mock.`,
      });
      return;
    }
    if (price.trim() === '') {
      toast({
        variant: 'destructive',
        title: 'Add a final price',
        description: 'Set the final offer price in INR before saving.',
      });
      return;
    }

    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid price',
        description: 'Enter a valid non-negative INR amount.',
      });
      return;
    }

    for (const liveBatchId of selectedLiveBatchIds) {
      const liveBatch = liveBatchById[liveBatchId];
      const includedSessions = Number(includedSessionsByBatchId[liveBatchId]);
      const totalSessions = Math.max(0, Number(liveBatch?.totalSessions || 0));

      if (!Number.isFinite(includedSessions) || includedSessions <= 0) {
        toast({
          variant: 'destructive',
          title: 'Invalid live batch sessions',
          description: 'Each selected live batch needs an included session count greater than zero.',
        });
        return;
      }

      if (totalSessions > 0 && includedSessions > totalSessions) {
        toast({
          variant: 'destructive',
          title: 'Included sessions exceed batch total',
          description: `${liveBatch?.title || 'Selected live batch'} only has ${totalSessions} total sessions.`,
        });
        return;
      }
    }

    const subjectNames = selectedSubjectIds
      .map((subjectId) => subjectNameById[subjectId])
      .filter((value): value is string => !!value);

    const offer: TeacherOffer = {
      createdByTeacherId: user.uid,
      title: trimmedTitle,
      examTypeId,
      examTypeName: examTypeNameById[examTypeId] || '',
      classId,
      className: classNameById[classId] || '',
      subjectIds: selectedSubjectIds,
      subjectNames,
      courses: selectedCourseIds
        .map((courseId) => regularCourseById[courseId])
        .filter((course): course is Course => !!course)
        .map((course) => ({
          id: course.id,
          title: course.title || 'Untitled Course',
        })),
      crashCourses: selectedCrashCourseIds
        .map((courseId) => crashCourseById[courseId])
        .filter((course): course is Course => !!course)
        .map((course) => ({
          id: course.id,
          title: course.title || 'Untitled Crash Course',
        })),
      mockTests: allowStandaloneMockTests
        ? selectedMockTestIds
            .map((mockTestId) => mockTestById[mockTestId])
            .filter((mockTest): mockTest is MockTest => !!mockTest)
            .map((mockTest) => ({
              id: mockTest.id,
              title: mockTest.title || 'Untitled Mock Test',
            }))
        : [],
      liveBatches: selectedLiveBatchIds
        .map((liveBatchId) => liveBatchById[liveBatchId])
        .filter((liveBatch): liveBatch is LiveBatch => !!liveBatch)
        .map((liveBatch) => ({
          id: liveBatch.id,
          title: liveBatch.title || 'Untitled Live Batch',
          totalSessions: Math.max(0, Number(liveBatch.totalSessions || 0)),
          includedSessions: Math.max(1, Number(includedSessionsByBatchId[liveBatch.id] || 1)),
        })),
      premiumPracticePack: practicePack,
      premiumPracticeSessionCount: Math.max(0, Number(practicePack?.totalQuestions || 0)),
      premiumCustomMockPack: customMockPack,
      premiumCustomMockQuestionCount: Math.max(0, Number(customMockPack?.totalQuestions || 0)),
      price: Number(parsedPrice.toFixed(2)),
      currency: 'INR',
      status: 'active',
      updatedAt: serverTimestamp(),
    };

    setIsSaving(true);
    try {
      if (editingOfferId) {
        await updateDocumentNonBlocking(doc(firestore, 'teacher_offers', editingOfferId), offer);
        toast({
          title: 'Offer updated',
          description: `${trimmedTitle} now includes the latest content and quantities.`,
        });
        setEditingOfferId('');
        setHydratedEditingOfferId('');
        router.replace('/subscription/offers', { scroll: false });
      } else {
        await addDocumentNonBlocking(collection(firestore, 'teacher_offers'), {
          ...offer,
          createdAt: serverTimestamp(),
        });
        toast({
          title: 'Offer created',
          description: `${trimmedTitle} has been added to your teacher offers.`,
        });
      }
      resetOfferForm();
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Offer Builder" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="space-y-6">
            <Skeleton className="h-36 w-full" />
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Skeleton className="h-[28rem] w-full" />
              <Skeleton className="h-[28rem] w-full" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!isTeacher) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title={editingOfferId ? 'Edit Offer' : 'Offer Builder'} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <Card className="relative overflow-hidden border-primary/35 bg-gradient-to-br from-sky-950/45 via-blue-950/35 to-slate-950/70 shadow-[0_22px_54px_-34px_rgba(59,130,246,0.75)]">
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
            <CardContent className="relative p-5 md:p-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full border-primary/40 bg-primary/15 px-3 py-1 text-primary">
                      {editingOfferId ? <Pencil className="mr-1.5 h-3.5 w-3.5" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                      {editingOfferId ? 'Editing Offer' : 'Teacher Offer Workspace'}
                    </Badge>
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {sortedTeacherOffers.length} saved offers
                    </Badge>
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                      {editingOfferId ? `Update ${editingOffer?.title || 'teacher offer'}` : 'Build teacher bundles on a dedicated page'}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                      {editingOfferId
                        ? 'Add or remove included content, adjust live sessions and question packs, then save the updated offer.'
                        : allowStandaloneMockTests
                        ? 'Set the exam scope, choose your paid courses, crash courses, mock tests, and live batches, then decide how many live sessions the offer includes.'
                        : 'Set the exam scope, choose your paid courses, crash courses, live batches, and premium question packs, then decide how many live sessions the offer includes.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="rounded-full border-border/70 bg-background/35">
                      <Link href="/subscription">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Subscription
                      </Link>
                    </Button>
                    {editingOfferId ? (
                      <Button type="button" variant="outline" className="rounded-full border-border/70 bg-background/35" onClick={handleCancelEditing}>
                        <X className="mr-2 h-4 w-4" />
                        Cancel Editing
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className={cn('grid grid-cols-2 gap-3', allowStandaloneMockTests ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
                  <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200">Courses</p>
                    <p className="mt-2 text-2xl font-semibold">{paidRegularCourses.length}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-rose-200">Crash</p>
                    <p className="mt-2 text-2xl font-semibold">{paidCrashCourses.length}</p>
                  </div>
                  {allowStandaloneMockTests ? (
                    <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-sky-200">Mock Tests</p>
                      <p className="mt-2 text-2xl font-semibold">{paidMockTests.length}</p>
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-200">Live Batches</p>
                    <p className="mt-2 text-2xl font-semibold">{paidLiveBatches.length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card id="offer-builder-basics" className="scroll-mt-24 border-border/70 bg-card/75">
              <CardHeader>
                <CardTitle>Offer Basics</CardTitle>
                <CardDescription>Define the scope first so content selection stays focused.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="teacher-offer-title">Offer Title</Label>
                  <Input
                    id="teacher-offer-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Example: NEET April Power Pack"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Exam</Label>
                    <Select
                      value={examTypeId}
                      onValueChange={(value) => {
                        setExamTypeId(value);
                        setClassId('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select exam" />
                      </SelectTrigger>
                      <SelectContent>
                        {(examTypes || []).map((examType) => (
                          <SelectItem key={examType.id} value={examType.id}>
                            {examType.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Curriculum</Label>
                    <Select value={classId} onValueChange={setClassId} disabled={!examTypeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select curriculum" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredClasses.map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Label>Subjects</Label>
                      <p className="mt-1 text-xs text-muted-foreground">Optional filter for narrowing the content included in this offer.</p>
                    </div>
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {selectedSubjectIds.length} selected
                    </Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {filteredSubjects.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground md:col-span-2">
                        Select exam and curriculum to unlock subject filters.
                      </div>
                    ) : (
                      filteredSubjects.map((subject) => (
                        <label
                          key={subject.id}
                          className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/35 px-3 py-2.5 text-sm transition hover:border-primary/35 hover:bg-primary/5"
                        >
                          <Checkbox
                            checked={selectedSubjectIds.includes(subject.id)}
                            onCheckedChange={(value) => toggleSubject(subject.id, !!value)}
                          />
                          <span>{subject.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teacher-offer-price">Final Offer Price (INR)</Label>
                  <Input
                    id="teacher-offer-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder="1999"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/75">
              <CardHeader>
                <CardTitle>Bundle Summary</CardTitle>
                <CardDescription>Review the exact content mix before saving the teacher offer.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/70 bg-background/35 p-3">
                    <p className="text-xs text-muted-foreground">Courses</p>
                    <p className="mt-2 text-2xl font-semibold">{selectedCourseIds.length}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/35 p-3">
                    <p className="text-xs text-muted-foreground">Crash Courses</p>
                    <p className="mt-2 text-2xl font-semibold">{selectedCrashCourseIds.length}</p>
                  </div>
                  {allowStandaloneMockTests ? (
                    <div className="rounded-xl border border-border/70 bg-background/35 p-3">
                      <p className="text-xs text-muted-foreground">Mock Tests</p>
                      <p className="mt-2 text-2xl font-semibold">{selectedMockTestIds.length}</p>
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-border/70 bg-background/35 p-3">
                    <p className="text-xs text-muted-foreground">Live Sessions</p>
                    <p className="mt-2 text-2xl font-semibold">{selectedLiveSessionCount}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/35 p-3">
                    <p className="text-xs text-muted-foreground">Practice Questions</p>
                    <p className="mt-2 text-2xl font-semibold">{practicePack?.totalQuestions || 0}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/35 p-3">
                    <p className="text-xs text-muted-foreground">Custom Mock Questions</p>
                    <p className="mt-2 text-2xl font-semibold">{customMockPack?.totalQuestions || 0}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Current Scope</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full bg-background/60">
                      {examTypeNameById[examTypeId] || 'Exam not selected'}
                    </Badge>
                    <Badge variant="outline" className="rounded-full bg-background/60">
                      {classNameById[classId] || 'Curriculum not selected'}
                    </Badge>
                    {selectedSubjectIds.length > 0 ? (
                      selectedSubjectIds.map((subjectId) => (
                        <Badge key={subjectId} variant="outline" className="rounded-full bg-background/60">
                          {subjectNameById[subjectId] || 'Subject'}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="rounded-full bg-background/60">
                        All subjects in scope
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/35 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">Selected Content</p>
                      <p className="text-xs text-muted-foreground">Up to six selections are previewed here.</p>
                    </div>
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {selectedItemCount} items
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedLabels.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No content selected yet.</p>
                    ) : (
                      <>
                        {selectedLabels.slice(0, 6).map((label) => (
                          <Badge key={label} variant="outline" className="rounded-full bg-background/60">
                            {label}
                          </Badge>
                        ))}
                        {selectedLabels.length > 6 ? (
                          <Badge variant="outline" className="rounded-full bg-background/60">
                            +{selectedLabels.length - 6} more
                          </Badge>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  className="h-11 w-full rounded-xl text-sm font-semibold"
                  onClick={handleSaveOffer}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : editingOfferId ? (
                    <Pencil className="mr-2 h-4 w-4" />
                  ) : (
                    <PackagePlus className="mr-2 h-4 w-4" />
                  )}
                  {editingOfferId ? 'Update Offer' : 'Save Teacher Offer'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {totalPaidItemsCount === 0 ? (
            <Card className="border-dashed border-border/70 bg-card/70">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {allowStandaloneMockTests
                  ? 'No paid content is available for your account yet. Mark your courses, mock tests, crash courses, or live batches as paid first.'
                  : 'No paid content is available for your account yet. Mark your courses, crash courses, or live batches as paid first.'}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-border/70 bg-card/75">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Courses
                      </CardTitle>
                      <CardDescription>Pick paid full courses and crash courses for this offer.</CardDescription>
                    </div>
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {filteredRegularCourses.length + filteredCrashCourses.length} available
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Full Courses</p>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">{selectedCourseIds.length} selected</Badge>
                    </div>
                    {filteredRegularCourses.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
                        No paid full courses match the current scope.
                      </div>
                    ) : (
                      filteredRegularCourses.map((course) => (
                        <SelectionCard
                          key={course.id}
                          title={course.title || 'Untitled Course'}
                          subtitle={`${classNameById[course.classId || ''] || 'Scope not set'}${course.subjectIds?.length ? ` / ${course.subjectIds.map((subjectId) => subjectNameById[subjectId]).filter(Boolean).join(', ')}` : ''}`}
                          checked={selectedCourseIds.includes(course.id)}
                          onToggle={(checked) => toggleSelection(course.id, checked, setSelectedCourseIds)}
                        />
                      ))
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Crash Courses</p>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">{selectedCrashCourseIds.length} selected</Badge>
                    </div>
                    {filteredCrashCourses.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
                        No paid crash courses match the current scope.
                      </div>
                    ) : (
                      filteredCrashCourses.map((course) => (
                        <SelectionCard
                          key={course.id}
                          title={course.title || 'Untitled Crash Course'}
                          subtitle={`${classNameById[course.classId || ''] || 'Scope not set'}${course.subjectIds?.length ? ` / ${course.subjectIds.map((subjectId) => subjectNameById[subjectId]).filter(Boolean).join(', ')}` : ''}`}
                          checked={selectedCrashCourseIds.includes(course.id)}
                          onToggle={(checked) => toggleSelection(course.id, checked, setSelectedCrashCourseIds)}
                          meta={<Badge className="border-rose-400/40 bg-rose-500/15 text-rose-100">Crash Course</Badge>}
                        />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                {allowStandaloneMockTests ? (
                  <Card className="border-border/70 bg-card/75">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Mock Tests
                          </CardTitle>
                          <CardDescription>Select standalone paid mock tests to bundle.</CardDescription>
                        </div>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          {filteredMockTests.length} available
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {filteredMockTests.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
                          No paid standalone mock tests match the current scope.
                        </div>
                      ) : (
                        filteredMockTests.map((mockTest) => (
                          <SelectionCard
                            key={mockTest.id}
                            title={mockTest.title || 'Untitled Mock Test'}
                            subtitle={[
                              examTypeNameById[mockTest.examTypeId || ''] || 'Exam not set',
                              classNameById[mockTest.classId || ''] || 'Curriculum not set',
                              buildMockSubjectIds(mockTest).map((subjectId) => subjectNameById[subjectId]).filter(Boolean).join(', ') || 'Subjects not set',
                            ].join(' / ')}
                            checked={selectedMockTestIds.includes(mockTest.id)}
                            onToggle={(checked) => toggleSelection(mockTest.id, checked, setSelectedMockTestIds)}
                          />
                        ))
                      )}
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="border-border/70 bg-card/75">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Video className="h-5 w-5 text-primary" />
                          Live Batches
                        </CardTitle>
                        <CardDescription>Choose the live batches to include and set the session count for each one.</CardDescription>
                      </div>
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {filteredLiveBatches.length} available
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {filteredLiveBatches.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
                        No paid live batches match the current scope.
                      </div>
                    ) : (
                      filteredLiveBatches.map((liveBatch) => {
                        const totalSessions = Math.max(0, Number(liveBatch.totalSessions || 0));
                        const isSelected = selectedLiveBatchIds.includes(liveBatch.id);

                        return (
                          <SelectionCard
                            key={liveBatch.id}
                            title={liveBatch.title || 'Untitled Live Batch'}
                            subtitle={[
                              examTypeNameById[liveBatch.examTypeId || ''] || 'Exam not set',
                              classNameById[liveBatch.classId || ''] || 'Curriculum not set',
                              liveBatch.subjectIds?.map((subjectId) => subjectNameById[subjectId]).filter(Boolean).join(', ') || 'Subjects not set',
                            ].join(' / ')}
                            checked={isSelected}
                            onToggle={(checked) => toggleLiveBatch(liveBatch, checked)}
                            meta={
                              <Badge variant="outline" className="rounded-full bg-background/60">
                                Total Sessions: {totalSessions || 'N/A'}
                              </Badge>
                            }
                            trailing={
                              isSelected ? (
                                <div className="w-28 space-y-1">
                                  <Label htmlFor={`sessions-${liveBatch.id}`} className="text-[11px] text-muted-foreground">
                                    Included
                                  </Label>
                                  <Input
                                    id={`sessions-${liveBatch.id}`}
                                    type="number"
                                    min={1}
                                    max={totalSessions > 0 ? totalSessions : undefined}
                                    value={includedSessionsByBatchId[liveBatch.id] || ''}
                                    onChange={(event) =>
                                      setIncludedSessionsByBatchId((current) => ({
                                        ...current,
                                        [liveBatch.id]: event.target.value,
                                      }))
                                    }
                                  />
                                </div>
                              ) : null
                            }
                          />
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          <TeacherOfferPracticePackBuilder
            teacherId={user?.uid || ''}
            examTypeId={examTypeId}
            examTypeName={examTypeNameById[examTypeId] || ''}
            classId={classId}
            className={classNameById[classId] || ''}
            availableSubjects={filteredSubjects}
            selectedSubjectIds={selectedSubjectIds}
            resetToken={practicePackResetToken}
            initialValue={editingOffer?.premiumPracticePack || null}
            onChange={setPracticePack}
          />

          <TeacherOfferCustomMockBuilder
            teacherId={user?.uid || ''}
            examTypeId={examTypeId}
            examTypeName={examTypeNameById[examTypeId] || ''}
            classId={classId}
            className={classNameById[classId] || ''}
            availableSubjects={filteredSubjects}
            selectedSubjectIds={selectedSubjectIds}
            resetToken={customMockPackResetToken}
            initialValue={editingOffer?.premiumCustomMockPack || null}
            onChange={setCustomMockPack}
          />

          <Card className="border-border/70 bg-card/75">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Layers3 className="h-5 w-5 text-primary" />
                    Created Offers
                  </CardTitle>
                  <CardDescription>Teacher bundles already saved from this dedicated builder.</CardDescription>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {sortedTeacherOffers.length} offers
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {sortedTeacherOffers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-background/35 px-4 py-12 text-center text-sm text-muted-foreground">
                  No teacher offers created yet. Build the first one from the sections above.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {sortedTeacherOffers.map((offer) => {
                    const counts = countTeacherOfferSelections(offer);
                    const includedSessions = (offer.liveBatches || []).reduce(
                      (sum, liveBatch) => sum + Math.max(0, Number(liveBatch.includedSessions || 0)),
                      0
                    );
                    const updatedAt = toDate(offer.updatedAt) || toDate(offer.createdAt);

                    return (
                      <Card key={offer.id || `${offer.title}-${offer.classId}-${offer.price}`} className="border-border/70 bg-background/35">
                        <CardHeader className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <CardTitle className="line-clamp-2 text-lg leading-snug">{offer.title || 'Untitled Offer'}</CardTitle>
                            <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                              INR {Number(offer.price || 0).toLocaleString()}
                            </Badge>
                          </div>
                          <CardDescription>
                            {[offer.examTypeName, offer.className, ...(offer.subjectNames || [])].filter(Boolean).join(' / ') || 'Scope not set'}
                          </CardDescription>
                          <p className="text-xs text-muted-foreground">
                            {updatedAt ? `Updated ${updatedAt.toLocaleString()}` : 'Saved teacher offer'}
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className={cn('grid grid-cols-2 gap-3', allowStandaloneMockTests ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
                            <div className="rounded-lg border border-border/60 bg-card/75 px-3 py-3">
                              Courses
                              <p className="mt-1 text-base font-semibold text-foreground">{counts.coursesCount}</p>
                            </div>
                            <div className="rounded-lg border border-border/60 bg-card/75 px-3 py-3">
                              Crash
                              <p className="mt-1 text-base font-semibold text-foreground">{counts.crashCoursesCount}</p>
                            </div>
                            {allowStandaloneMockTests ? (
                              <div className="rounded-lg border border-border/60 bg-card/75 px-3 py-3">
                                Mock
                                <p className="mt-1 text-base font-semibold text-foreground">{counts.mockTestsCount}</p>
                              </div>
                            ) : null}
                            <div className="rounded-lg border border-border/60 bg-card/75 px-3 py-3">
                              Batches
                              <p className="mt-1 text-base font-semibold text-foreground">{counts.liveBatchesCount}</p>
                            </div>
                            <div className="rounded-lg border border-border/60 bg-card/75 px-3 py-3">
                              Sessions
                              <p className="mt-1 text-base font-semibold text-foreground">{includedSessions}</p>
                            </div>
                          </div>
                          {offer.premiumPracticePack?.totalQuestions ? (
                            <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-3 text-sm">
                              <p className="font-medium text-cyan-50">
                                {offer.premiumPracticePack.questionAccessLevel === 'paid' ? 'Paid practice rules inherited' : 'Free practice pack'}
                              </p>
                              <p className="mt-1 text-cyan-100/85">
                                {offer.premiumPracticePack.questionAccessLevel === 'paid'
                                  ? formatPremiumPracticeAttemptPricingRule(offer.premiumPracticePack.attemptPricing)
                                  : 'Uses the free practice question bank for the saved exam scope.'}
                              </p>
                            </div>
                          ) : null}
                          {offer.premiumCustomMockPack?.totalQuestions ? (
                            <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-3 text-sm">
                              <p className="font-medium text-amber-50">Premium custom mock inherited</p>
                              <p className="mt-1 text-amber-100/85">
                                {formatPremiumCustomMockAttemptPricingRule(offer.premiumCustomMockPack.attemptPricing)}
                              </p>
                              <p className="mt-1 text-xs text-amber-100/75">
                                Duration {Number(offer.premiumCustomMockPack.duration || 0)} min | Questions {offer.premiumCustomMockPack.totalQuestions} | Marks {Number(offer.premiumCustomMockPack.totalMarks || 0)}
                              </p>
                            </div>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full rounded-xl"
                            onClick={() => handleStartEditingOffer(offer)}
                            disabled={!offer.id}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Offer
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
