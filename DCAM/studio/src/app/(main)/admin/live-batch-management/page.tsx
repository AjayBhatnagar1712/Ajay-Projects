'use client';

import { useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  LoaderCircle,
  Mail,
  Phone,
  RefreshCcw,
  Search,
  ShieldAlert,
  TicketPlus,
  TicketX,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useToast } from '@/hooks/use-toast';
import {
  buildAdminLiveBatchPurchaseEntry,
  buildAdminLiveBatchRemovalEntry,
  getLiveBatchCoverageSnapshot,
  mergeLiveBatchPurchaseHistory,
  mergeLiveBatchRemovalHistory,
  removeStudentAttemptsFromAnalytics,
  sumLiveBatchPurchaseHistory,
  type LiveBatchAccessSnapshot,
  type LiveBatchTestAnalyticsDoc,
} from '@/lib/admin-live-batch-management';
import type { LiveBatchSessionLike } from '@/lib/live-batch-session-access';

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

type ExamType = { id: string; name?: string };
type ClassItem = { id: string; name?: string };
type Subject = { id: string; name?: string };

type SubscriptionPlan = {
  id: string;
  linkedContentType?: 'course' | 'mock_test' | 'live_batch';
  linkedContentId?: string;
  sessionFee?: number;
  totalSessions?: number;
  numberOfLiveClasses?: number;
};

type LiveBatchDoc = {
  id: string;
  title?: string;
  teacherId?: string;
  teacherName?: string;
  accessLevel?: 'free' | 'paid';
  publicationStatus?: 'draft' | 'published' | 'deleted';
  examTypeId?: string;
  classId?: string;
  subjectIds?: string[];
  totalSessions?: number;
};

type LiveBatchSessionDoc = LiveBatchSessionLike & {
  id: string;
  batchId?: string;
};

type StudentLiveBatchAccessRecord = LiveBatchAccessSnapshot & {
  id: string;
  batchId?: string;
  liveBatchId?: string;
  purchasedAt?: string;
  examTypeId?: string;
  classId?: string;
  subjectIds?: string[];
  assignmentSource?: string;
  assignedByAdminId?: string;
  assignedByAdminEmail?: string;
};

type UserTestResultDoc = { id: string; testId?: string };

type ManageBatchRow = {
  batch: LiveBatchDoc;
  enrolledRecord: StudentLiveBatchAccessRecord | null;
  purchasedRecord: StudentLiveBatchAccessRecord | null;
  effectiveRecord: LiveBatchAccessSnapshot | null;
  remainingSessions: number;
  consumedSessions: number;
  grossPurchasedSessions: number;
  totalPurchasedSessions: number;
  removedSessions: number;
  totalSessionsInBatch: number;
  maxAssignableTokens: number;
  isActive: boolean;
  isDisabled: boolean;
  subjectLabel: string;
  examLabel: string;
  classLabel: string;
};

const displayStudentName = (student?: StudentProfile | null) =>
  `${student?.firstName || ''} ${student?.lastName || ''}`.trim()
  || student?.displayName
  || student?.email
  || 'Student';

const formatDateTime = (value?: string | null) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString();
};

const resolveEffectiveRecord = (
  batchId: string,
  enrolledRecord?: StudentLiveBatchAccessRecord | null,
  purchasedRecord?: StudentLiveBatchAccessRecord | null
): LiveBatchAccessSnapshot | null => {
  if (enrolledRecord) return enrolledRecord;
  if (!purchasedRecord) return null;

  return {
    ...purchasedRecord,
    id: purchasedRecord.id,
    batchId: purchasedRecord.batchId || purchasedRecord.liveBatchId || batchId,
    enrolledAt: purchasedRecord.enrolledAt || purchasedRecord.purchasedAt || '',
    paidAt: purchasedRecord.paidAt || purchasedRecord.purchasedAt || '',
    hiddenFromMyBatch: false,
    hiddenFromMyBatchAt: null,
  };
};

export default function AdminLiveBatchManagementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [tokenDialogState, setTokenDialogState] = useState<{ mode: 'assign' | 'remove'; batchId: string } | null>(null);
  const [tokenCountInput, setTokenCountInput] = useState('1');
  const [resetTargetBatchId, setResetTargetBatchId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const studentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), where('roleId', '==', 'student')) : null),
    [firestore]
  );
  const liveBatchesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'live_batches')) : null),
    [firestore]
  );
  const examTypesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'exam_types')) : null),
    [firestore]
  );
  const classesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classes')) : null),
    [firestore]
  );
  const subjectsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'subjects')) : null),
    [firestore]
  );
  const plansQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'subscription_plans'), where('linkedContentType', '==', 'live_batch')) : null),
    [firestore]
  );
  const sessionsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'live_batch_sessions')) : null),
    [firestore]
  );
  const selectedStudentEnrolledQuery = useMemoFirebase(() => {
    if (!firestore || !selectedStudent?.id) return null;
    return query(collection(firestore, 'users', selectedStudent.id, 'enrolled_live_batches'));
  }, [firestore, selectedStudent?.id]);
  const selectedStudentPurchasedQuery = useMemoFirebase(() => {
    if (!firestore || !selectedStudent?.id) return null;
    return query(collection(firestore, 'users', selectedStudent.id, 'purchased_live_batches'));
  }, [firestore, selectedStudent?.id]);

  const { data: students = [], isLoading: areStudentsLoading } = useCollection<StudentProfile>(studentsQuery);
  const { data: liveBatches = [], isLoading: areLiveBatchesLoading } = useCollection<LiveBatchDoc>(liveBatchesQuery);
  const { data: examTypes = [], isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classes = [], isLoading: areClassesLoading } = useCollection<ClassItem>(classesQuery);
  const { data: subjects = [], isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: plans = [], isLoading: arePlansLoading } = useCollection<SubscriptionPlan>(plansQuery);
  const { data: sessions = [], isLoading: areSessionsLoading } = useCollection<LiveBatchSessionDoc>(sessionsQuery);
  const { data: selectedStudentEnrolled = [], isLoading: areSelectedStudentEnrollmentsLoading } =
    useCollection<StudentLiveBatchAccessRecord>(selectedStudentEnrolledQuery);
  const { data: selectedStudentPurchased = [], isLoading: areSelectedStudentPurchasesLoading } =
    useCollection<StudentLiveBatchAccessRecord>(selectedStudentPurchasedQuery);

  const loading =
    isAdminLoading
    || areStudentsLoading
    || areLiveBatchesLoading
    || areExamTypesLoading
    || areClassesLoading
    || areSubjectsLoading
    || arePlansLoading
    || areSessionsLoading;

  const examNameById = useMemo(
    () => Object.fromEntries((examTypes || []).map((item) => [item.id, item.name || 'Untitled Exam'])),
    [examTypes]
  );
  const classNameById = useMemo(
    () => Object.fromEntries((classes || []).map((item) => [item.id, item.name || 'Untitled Curriculum'])),
    [classes]
  );
  const subjectNameById = useMemo(
    () => Object.fromEntries((subjects || []).map((item) => [item.id, item.name || 'Untitled Subject'])),
    [subjects]
  );
  const planByBatchId = useMemo(() => {
    const map = new Map<string, SubscriptionPlan>();
    (plans || []).forEach((plan) => {
      const batchId = String(plan.linkedContentId || '').trim();
      if (!batchId || map.has(batchId)) return;
      map.set(batchId, plan);
    });
    return map;
  }, [plans]);
  const sessionsByBatchId = useMemo(() => {
    const map = new Map<string, LiveBatchSessionDoc[]>();
    (sessions || []).forEach((session) => {
      const batchId = String(session.batchId || '').trim();
      if (!batchId) return;
      const current = map.get(batchId) || [];
      current.push(session);
      map.set(batchId, current);
    });
    return map;
  }, [sessions]);

  const publishedPaidLiveBatches = useMemo(
    () =>
      (liveBatches || [])
        .filter(
          (batch) =>
            batch.publicationStatus === 'published'
            && (batch.accessLevel || 'paid') === 'paid'
        )
        .sort((left, right) => (left.title || 'Live Batch').localeCompare(right.title || 'Live Batch')),
    [liveBatches]
  );

  const filteredStudents = useMemo(() => {
    const queryText = searchTerm.trim().toLowerCase();
    return [...(students || [])]
      .filter((student) => student.roleId === 'student')
      .filter((student) => {
        if (!queryText) return true;
        const haystack = [
          displayStudentName(student),
          student.email || '',
          student.phoneNumber || '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(queryText);
      })
      .sort((left, right) => displayStudentName(left).localeCompare(displayStudentName(right)));
  }, [searchTerm, students]);

  const manageDialogLoading = areSelectedStudentEnrollmentsLoading || areSelectedStudentPurchasesLoading;

  const selectedStudentEnrolledByBatchId = useMemo(() => {
    const map = new Map<string, StudentLiveBatchAccessRecord>();
    (selectedStudentEnrolled || []).forEach((record) => {
      const batchId = String(record.batchId || record.liveBatchId || record.id || '').trim();
      if (!batchId) return;
      map.set(batchId, record);
    });
    return map;
  }, [selectedStudentEnrolled]);

  const selectedStudentPurchasedByBatchId = useMemo(() => {
    const map = new Map<string, StudentLiveBatchAccessRecord>();
    (selectedStudentPurchased || []).forEach((record) => {
      const batchId = String(record.batchId || record.liveBatchId || record.id || '').trim();
      if (!batchId) return;
      map.set(batchId, record);
    });
    return map;
  }, [selectedStudentPurchased]);

  const manageBatchRows = useMemo<ManageBatchRow[]>(() => {
    return publishedPaidLiveBatches.map((batch) => {
      const batchId = batch.id;
      const enrolledRecord = selectedStudentEnrolledByBatchId.get(batchId) || null;
      const purchasedRecord = selectedStudentPurchasedByBatchId.get(batchId) || null;
      const effectiveRecord = resolveEffectiveRecord(batchId, enrolledRecord, purchasedRecord);
      const plan = planByBatchId.get(batchId);
      const totalSessionsInBatch = Math.max(
        0,
        Number(
          batch.totalSessions
          ?? plan?.totalSessions
          ?? plan?.numberOfLiveClasses
          ?? effectiveRecord?.totalSessionsInBatch
          ?? 0
        )
      );
      const coverage = effectiveRecord
        ? getLiveBatchCoverageSnapshot({
            batch,
            sessions: sessionsByBatchId.get(batchId) || [],
            enrollment: effectiveRecord,
          })
        : null;
      const remainingSessions = coverage?.remainingSessions ?? 0;
      const grossPurchasedSessions = coverage?.grossPurchasedSessions ?? 0;
      const totalPurchasedSessions = coverage?.totalPurchasedSessions ?? 0;
      const removedSessions = coverage?.appliedRemovedSessions ?? 0;
      const consumedSessions = coverage?.consumedSessions ?? 0;
      const subjectLabel =
        (batch.subjectIds || []).map((subjectId) => subjectNameById[subjectId]).filter(Boolean).join(', ')
        || 'No subjects mapped';
      const maxAssignableTokens = totalSessionsInBatch > 0
        ? Math.max(0, totalSessionsInBatch - totalPurchasedSessions)
        : 0;
      const isDisabled = Boolean(effectiveRecord?.adminAccessDisabled);
      const isActive = Boolean(effectiveRecord && !isDisabled);

      return {
        batch,
        enrolledRecord,
        purchasedRecord,
        effectiveRecord,
        remainingSessions,
        consumedSessions,
        grossPurchasedSessions,
        totalPurchasedSessions,
        removedSessions,
        totalSessionsInBatch,
        maxAssignableTokens,
        isActive,
        isDisabled,
        subjectLabel,
        examLabel: batch.examTypeId ? examNameById[batch.examTypeId] || batch.examTypeId : 'N/A',
        classLabel: batch.classId ? classNameById[batch.classId] || batch.classId : 'N/A',
      };
    }).sort((left, right) => {
      if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
      if (left.isDisabled !== right.isDisabled) return left.isDisabled ? -1 : 1;
      return (left.batch.title || 'Live Batch').localeCompare(right.batch.title || 'Live Batch');
    });
  }, [
    classNameById,
    examNameById,
    planByBatchId,
    publishedPaidLiveBatches,
    selectedStudentEnrolledByBatchId,
    selectedStudentPurchasedByBatchId,
    sessionsByBatchId,
    subjectNameById,
  ]);

  const activeBatchCount = manageBatchRows.filter((row) => row.isActive).length;
  const disabledBatchCount = manageBatchRows.filter((row) => row.isDisabled).length;
  const selectedTokenRow = useMemo(
    () => (tokenDialogState ? manageBatchRows.find((row) => row.batch.id === tokenDialogState.batchId) || null : null),
    [manageBatchRows, tokenDialogState]
  );
  const resetTargetRow = useMemo(
    () => (resetTargetBatchId ? manageBatchRows.find((row) => row.batch.id === resetTargetBatchId) || null : null),
    [manageBatchRows, resetTargetBatchId]
  );

  const openManageDialog = (student: StudentProfile) => {
    setSelectedStudent(student);
    setIsManageDialogOpen(true);
    setTokenDialogState(null);
    setResetTargetBatchId(null);
  };

  const closeManageDialog = (open: boolean) => {
    setIsManageDialogOpen(open);
    if (open) return;
    setTokenDialogState(null);
    setResetTargetBatchId(null);
    setTokenCountInput('1');
  };

  const openTokenDialog = (mode: 'assign' | 'remove', batchId: string) => {
    setTokenDialogState({ mode, batchId });
    setTokenCountInput('1');
  };

  const getCurrentAdminActionId = () =>
    `${Date.now()}_${String(selectedStudent?.id || 'student').replace(/[^a-zA-Z0-9_-]/g, '')}_${String(user?.uid || 'admin').replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const handleAssignTokens = async () => {
    if (!firestore || !selectedStudent || !selectedTokenRow || !user?.uid) return;

    const tokensToAssign = Math.max(0, Math.floor(Number(tokenCountInput || 0)));
    if (tokensToAssign <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid token count',
        description: 'Enter at least 1 token to assign.',
      });
      return;
    }
    if (selectedTokenRow.totalSessionsInBatch <= 0) {
      toast({
        variant: 'destructive',
        title: 'Batch sessions not configured',
        description: 'This live batch does not have a valid total session count yet.',
      });
      return;
    }
    if (tokensToAssign > selectedTokenRow.maxAssignableTokens) {
      toast({
        variant: 'destructive',
        title: 'Too many tokens',
        description: `You can assign at most ${selectedTokenRow.maxAssignableTokens} more token${selectedTokenRow.maxAssignableTokens === 1 ? '' : 's'} for this batch right now.`,
      });
      return;
    }

    const busyLabel = `assign:${selectedStudent.id}:${selectedTokenRow.batch.id}`;
    setBusyKey(busyLabel);
    try {
      const nowIso = new Date().toISOString();
      const actionId = getCurrentAdminActionId();
      const batch = selectedTokenRow.batch;
      const plan = planByBatchId.get(batch.id);
      const sessionFee = Math.max(
        0,
        Number(
          plan?.sessionFee
          ?? selectedTokenRow.enrolledRecord?.sessionFee
          ?? selectedTokenRow.purchasedRecord?.sessionFee
          ?? 0
        )
      );
      const purchaseEntry = buildAdminLiveBatchPurchaseEntry({
        batchId: batch.id,
        sessionsPurchased: tokensToAssign,
        sessionFee,
        assignedAtIso: nowIso,
        actionId,
      });
      const enrolledRef = doc(firestore, 'users', selectedStudent.id, 'enrolled_live_batches', batch.id);
      const purchasedRef = doc(firestore, 'users', selectedStudent.id, 'purchased_live_batches', batch.id);

      await runTransaction(firestore, async (transaction) => {
        const enrolledSnap = await transaction.get(enrolledRef);
        const purchasedSnap = await transaction.get(purchasedRef);
        const enrolledData = enrolledSnap.exists() ? (enrolledSnap.data() as StudentLiveBatchAccessRecord) : null;
        const purchasedData = purchasedSnap.exists() ? (purchasedSnap.data() as StudentLiveBatchAccessRecord) : null;
        const enrolledHistoryBase = enrolledData?.sessionPurchaseHistory ?? purchasedData?.sessionPurchaseHistory ?? [];
        const purchasedHistoryBase = purchasedData?.sessionPurchaseHistory ?? enrolledData?.sessionPurchaseHistory ?? [];
        const mergedEnrolledHistory = mergeLiveBatchPurchaseHistory(enrolledHistoryBase, purchaseEntry);
        const mergedPurchasedHistory = mergeLiveBatchPurchaseHistory(purchasedHistoryBase, purchaseEntry);
        const totalGrossSessions = sumLiveBatchPurchaseHistory(mergedEnrolledHistory);
        const removalHistory =
          enrolledData?.adminSessionRemovalHistory
          ?? purchasedData?.adminSessionRemovalHistory
          ?? [];
        const enrolledAt =
          String(enrolledData?.enrolledAt || purchasedData?.enrolledAt || purchasedData?.purchasedAt || nowIso).trim()
          || nowIso;

        transaction.set(
          purchasedRef,
          {
            id: batch.id,
            batchId: batch.id,
            liveBatchId: batch.id,
            teacherId: batch.teacherId || '',
            teacherName: batch.teacherName || '',
            accessLevel: 'paid',
            purchasedAt: nowIso,
            paidAt: nowIso,
            assignedAt: nowIso,
            assignedByAdminId: user.uid,
            assignedByAdminEmail: user.email || '',
            assignmentSource: 'admin_manual',
            sessionsPurchased: totalGrossSessions,
            sessionFee,
            totalSessionsInBatch: selectedTokenRow.totalSessionsInBatch,
            amountPaid: Math.max(0, Number(purchasedData?.amountPaid || enrolledData?.amountPaid || 0)),
            sessionPurchaseHistory: mergedPurchasedHistory,
            adminSessionRemovalHistory: removalHistory,
            latestPurchase: purchaseEntry,
            adminAccessDisabled: false,
            adminAccessDisabledAt: null,
            adminDisabledReason: null,
          },
          { merge: true }
        );

        transaction.set(
          enrolledRef,
          {
            id: batch.id,
            batchId: batch.id,
            title: batch.title || 'Live Batch',
            teacherId: batch.teacherId || '',
            teacherName: batch.teacherName || '',
            accessLevel: 'paid',
            examTypeId: batch.examTypeId || '',
            classId: batch.classId || '',
            subjectIds: batch.subjectIds || [],
            enrolledAt,
            paidAt: nowIso,
            assignedAt: nowIso,
            assignedByAdminId: user.uid,
            assignedByAdminEmail: user.email || '',
            assignmentSource: 'admin_manual',
            hiddenFromMyBatch: false,
            hiddenFromMyBatchAt: null,
            sessionsPurchased: totalGrossSessions,
            sessionFee,
            totalSessionsInBatch: selectedTokenRow.totalSessionsInBatch,
            amountPaid: Math.max(0, Number(enrolledData?.amountPaid || purchasedData?.amountPaid || 0)),
            sessionPurchaseHistory: mergedEnrolledHistory,
            adminSessionRemovalHistory: removalHistory,
            latestPurchase: purchaseEntry,
            adminAccessDisabled: false,
            adminAccessDisabledAt: null,
            adminDisabledReason: null,
          },
          { merge: true }
        );
      });

      toast({
        title: 'Tokens assigned',
        description: `${tokensToAssign} token${tokensToAssign === 1 ? '' : 's'} added to ${displayStudentName(selectedStudent)} for ${selectedTokenRow.batch.title || 'this live batch'}.`,
      });
      setTokenDialogState(null);
      setTokenCountInput('1');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Assignment failed',
        description: error?.message || 'Could not assign live-batch tokens right now.',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemoveTokens = async () => {
    if (!firestore || !selectedStudent || !selectedTokenRow || !user?.uid) return;

    const tokensToRemove = Math.max(0, Math.floor(Number(tokenCountInput || 0)));
    if (tokensToRemove <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid token count',
        description: 'Enter at least 1 token to remove.',
      });
      return;
    }
    if (tokensToRemove > selectedTokenRow.remainingSessions) {
      toast({
        variant: 'destructive',
        title: 'Too many tokens',
        description: `Only ${selectedTokenRow.remainingSessions} removable token${selectedTokenRow.remainingSessions === 1 ? '' : 's'} are available right now.`,
      });
      return;
    }

    const busyLabel = `remove:${selectedStudent.id}:${selectedTokenRow.batch.id}`;
    setBusyKey(busyLabel);
    try {
      const nowIso = new Date().toISOString();
      const actionId = getCurrentAdminActionId();
      const batch = selectedTokenRow.batch;
      const removalEntry = buildAdminLiveBatchRemovalEntry({
        batchId: batch.id,
        sessionsRemoved: tokensToRemove,
        removedAtIso: nowIso,
        actionId,
        adminId: user.uid,
        adminEmail: user.email || '',
      });
      const enrolledRef = doc(firestore, 'users', selectedStudent.id, 'enrolled_live_batches', batch.id);
      const purchasedRef = doc(firestore, 'users', selectedStudent.id, 'purchased_live_batches', batch.id);

      await runTransaction(firestore, async (transaction) => {
        const enrolledSnap = await transaction.get(enrolledRef);
        const purchasedSnap = await transaction.get(purchasedRef);
        const enrolledData = enrolledSnap.exists() ? (enrolledSnap.data() as StudentLiveBatchAccessRecord) : null;
        const purchasedData = purchasedSnap.exists() ? (purchasedSnap.data() as StudentLiveBatchAccessRecord) : null;

        if (!enrolledData && !purchasedData) {
          throw new Error('This student does not have any recorded access for the selected batch.');
        }

        const mergedRemovalHistory = mergeLiveBatchRemovalHistory(
          enrolledData?.adminSessionRemovalHistory ?? purchasedData?.adminSessionRemovalHistory ?? [],
          removalEntry
        );
        const nextEnrolledRecord = enrolledData
          ? {
              ...enrolledData,
              id: enrolledData.id || batch.id,
              batchId: enrolledData.batchId || batch.id,
              adminSessionRemovalHistory: mergedRemovalHistory,
            }
          : null;
        const nextPurchasedRecord = purchasedData
          ? {
              ...purchasedData,
              id: purchasedData.id || batch.id,
              batchId: purchasedData.batchId || purchasedData.liveBatchId || batch.id,
              liveBatchId: purchasedData.liveBatchId || batch.id,
              adminSessionRemovalHistory: mergedRemovalHistory,
            }
          : null;
        const effectiveAfterRemoval = resolveEffectiveRecord(batch.id, nextEnrolledRecord, nextPurchasedRecord);
        const nextCoverage = effectiveAfterRemoval
          ? getLiveBatchCoverageSnapshot({
              batch,
              sessions: sessionsByBatchId.get(batch.id) || [],
              enrollment: effectiveAfterRemoval,
            })
          : null;
        const shouldDisableAccess = (nextCoverage?.remainingSessions ?? 0) <= 0;
        const hiddenAt = shouldDisableAccess ? nowIso : null;

        transaction.set(
          purchasedRef,
          {
            id: batch.id,
            batchId: batch.id,
            liveBatchId: batch.id,
            teacherId: batch.teacherId || purchasedData?.teacherId || '',
            teacherName: batch.teacherName || purchasedData?.teacherName || '',
            accessLevel: 'paid',
            adminSessionRemovalHistory: mergedRemovalHistory,
            adminAccessDisabled: shouldDisableAccess,
            adminAccessDisabledAt: hiddenAt,
            adminDisabledReason: shouldDisableAccess ? 'admin_token_deassign' : null,
          },
          { merge: true }
        );

        transaction.set(
          enrolledRef,
          {
            id: batch.id,
            batchId: batch.id,
            title: batch.title || enrolledData?.title || 'Live Batch',
            teacherId: batch.teacherId || enrolledData?.teacherId || '',
            teacherName: batch.teacherName || enrolledData?.teacherName || '',
            accessLevel: 'paid',
            examTypeId: batch.examTypeId || enrolledData?.examTypeId || '',
            classId: batch.classId || enrolledData?.classId || '',
            subjectIds: batch.subjectIds || enrolledData?.subjectIds || [],
            adminSessionRemovalHistory: mergedRemovalHistory,
            hiddenFromMyBatch: shouldDisableAccess,
            hiddenFromMyBatchAt: hiddenAt,
            adminAccessDisabled: shouldDisableAccess,
            adminAccessDisabledAt: hiddenAt,
            adminDisabledReason: shouldDisableAccess ? 'admin_token_deassign' : null,
          },
          { merge: true }
        );
      });

      toast({
        title: 'Tokens removed',
        description: `${tokensToRemove} token${tokensToRemove === 1 ? '' : 's'} removed from ${displayStudentName(selectedStudent)} for ${selectedTokenRow.batch.title || 'this live batch'}.`,
      });
      setTokenDialogState(null);
      setTokenCountInput('1');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Removal failed',
        description: error?.message || 'Could not remove tokens right now.',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handlePermanentReset = async () => {
    if (!firestore || !selectedStudent || !resetTargetRow) return;

    const busyLabel = `reset:${selectedStudent.id}:${resetTargetRow.batch.id}`;
    setBusyKey(busyLabel);
    try {
      const batchId = resetTargetRow.batch.id;
      const batchTestsSnapshot = await getDocs(
        query(collection(firestore, 'mock_tests'), where('liveBatchId', '==', batchId))
      );
      const batchTestIds = new Set(
        batchTestsSnapshot.docs.map((docSnap) => docSnap.id).filter(Boolean)
      );

      const studentResultsSnapshot = await getDocs(
        query(collection(firestore, 'users', selectedStudent.id, 'test_results'))
      );
      const batchResultDocs = studentResultsSnapshot.docs.filter((docSnap) => {
        const data = docSnap.data() as UserTestResultDoc;
        return batchTestIds.has(String(data.testId || '').trim());
      });

      await Promise.all(batchResultDocs.map((docSnap) => deleteDoc(docSnap.ref)));

      for (const batchTestDoc of batchTestsSnapshot.docs) {
        const analyticsRef = doc(firestore, 'test_analytics', batchTestDoc.id);
        const analyticsSnap = await getDoc(analyticsRef);
        if (!analyticsSnap.exists()) continue;

        const nextAnalytics = removeStudentAttemptsFromAnalytics(
          analyticsSnap.data() as LiveBatchTestAnalyticsDoc,
          selectedStudent.id
        );
        if (!nextAnalytics) continue;

        await setDoc(analyticsRef, nextAnalytics, { merge: true });
      }

      await Promise.all([
        deleteDoc(doc(firestore, 'users', selectedStudent.id, 'enrolled_live_batches', batchId)),
        deleteDoc(doc(firestore, 'users', selectedStudent.id, 'purchased_live_batches', batchId)),
      ]);

      toast({
        title: 'Batch history reset',
        description: `${displayStudentName(selectedStudent)} has been permanently reset for ${resetTargetRow.batch.title || 'this live batch'}.`,
      });
      setResetTargetBatchId(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Permanent reset failed',
        description: error?.message || 'Could not permanently reset this live batch right now.',
      });
    } finally {
      setBusyKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Live Batch Management" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Access Denied" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="mx-auto max-w-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" />
                Access denied
              </CardTitle>
              <CardDescription>This workspace is available only to admins.</CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Live Batch Management" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
        <Card className="border-border/70 bg-gradient-to-r from-slate-900/80 to-cyan-950/70">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Badge variant="outline" className="border-cyan-400/30 bg-cyan-500/10 text-cyan-100">
                  Admin Workspace
                </Badge>
                <CardTitle className="mt-3 text-3xl">Manage live-batch access like token purchases</CardTitle>
                <CardDescription className="mt-2 max-w-3xl text-base text-slate-300">
                  Assign paid live-batch tokens, remove remaining tokens, or permanently reset a student&apos;s batch history.
                  The student outcome stays aligned with the regular purchase flow.
                </CardDescription>
              </div>
              <div className="grid min-w-[220px] grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Students</p>
                  <p className="mt-2 text-2xl font-semibold">{filteredStudents.length}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Paid batches</p>
                  <p className="mt-2 text-2xl font-semibold">{publishedPaidLiveBatches.length}</p>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Student Directory
                </CardTitle>
                <CardDescription>Search by student name, email, or phone number and open the live-batch manager.</CardDescription>
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search students..."
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{displayStudentName(student)}</p>
                          <p className="text-xs text-muted-foreground">{student.id}</p>
                        </div>
                      </TableCell>
                      <TableCell>{student.phoneNumber?.trim() || 'N/A'}</TableCell>
                      <TableCell className="break-all">{student.email?.trim() || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={student.status === 'blocked' ? 'destructive' : 'secondary'}>
                          {student.status || 'active'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openManageDialog(student)}>
                          Manage Live Batches
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No students matched your current search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <Dialog open={isManageDialogOpen} onOpenChange={closeManageDialog}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Live Batch Access for {displayStudentName(selectedStudent)}</DialogTitle>
            <DialogDescription>
              Assign tokens like a purchase, remove only the remaining token balance, or permanently reset the batch history.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Email</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4 text-primary" />
                  {selectedStudent?.email || 'N/A'}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Phone</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-medium">
                  <Phone className="h-4 w-4 text-primary" />
                  {selectedStudent?.phoneNumber || 'N/A'}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Batch Status</p>
                <p className="mt-2 text-sm font-medium">
                  Active: {activeBatchCount} | De-assigned with history: {disabledBatchCount}
                </p>
              </CardContent>
            </Card>
          </div>

          {manageDialogLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : (
            <div className="grid gap-4">
              {manageBatchRows.map((row) => {
                const rowBusyPrefix = `${selectedStudent?.id}:${row.batch.id}`;
                return (
                  <Card key={row.batch.id} className="border-border/70">
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold">{row.batch.title || 'Untitled Live Batch'}</h3>
                            {row.isActive ? (
                              <Badge>Active</Badge>
                            ) : row.isDisabled ? (
                              <Badge variant="secondary">De-assigned, history kept</Badge>
                            ) : (
                              <Badge variant="outline">Not assigned</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{row.examLabel}</Badge>
                            <Badge variant="outline">{row.classLabel}</Badge>
                            <Badge variant="outline">{row.subjectLabel}</Badge>
                          </div>
                          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                            <p>Batch sessions: <span className="font-semibold text-foreground">{row.totalSessionsInBatch || 'Not set'}</span></p>
                            <p>Active tokens left: <span className="font-semibold text-foreground">{row.remainingSessions}</span></p>
                            <p>Covered/used sessions: <span className="font-semibold text-foreground">{row.consumedSessions}</span></p>
                            <p>Admin-removed tokens: <span className="font-semibold text-foreground">{row.removedSessions}</span></p>
                            <p>Effective allocated tokens: <span className="font-semibold text-foreground">{row.totalPurchasedSessions}</span></p>
                            <p>Gross purchased history: <span className="font-semibold text-foreground">{row.grossPurchasedSessions}</span></p>
                            <p>Assignable now: <span className="font-semibold text-foreground">{row.maxAssignableTokens}</span></p>
                            <p>Last hidden at: <span className="font-semibold text-foreground">{formatDateTime(String(row.effectiveRecord?.hiddenFromMyBatchAt || row.effectiveRecord?.adminAccessDisabledAt || ''))}</span></p>
                          </div>
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => openTokenDialog('assign', row.batch.id)}
                            disabled={busyKey?.includes(rowBusyPrefix) || row.maxAssignableTokens <= 0}
                          >
                            {busyKey === `assign:${selectedStudent?.id}:${row.batch.id}` ? (
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <TicketPlus className="mr-2 h-4 w-4" />
                            )}
                            {row.effectiveRecord ? 'Add Tokens' : 'Assign Tokens'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => openTokenDialog('remove', row.batch.id)}
                            disabled={busyKey?.includes(rowBusyPrefix) || row.remainingSessions <= 0}
                          >
                            {busyKey === `remove:${selectedStudent?.id}:${row.batch.id}` ? (
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <TicketX className="mr-2 h-4 w-4" />
                            )}
                            Remove Tokens
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => setResetTargetBatchId(row.batch.id)}
                            disabled={busyKey?.includes(rowBusyPrefix) || !row.effectiveRecord}
                          >
                            {busyKey === `reset:${selectedStudent?.id}:${row.batch.id}` ? (
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCcw className="mr-2 h-4 w-4" />
                            )}
                            Permanent Reset
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!tokenDialogState && !!selectedTokenRow}
        onOpenChange={(open) => {
          if (open) return;
          setTokenDialogState(null);
          setTokenCountInput('1');
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {tokenDialogState?.mode === 'assign' ? 'Assign Live-Batch Tokens' : 'Remove Remaining Tokens'}
            </DialogTitle>
            <DialogDescription>
              {tokenDialogState?.mode === 'assign'
                ? 'This behaves like a zero-price admin purchase and makes the batch visible in My Batch again.'
                : 'Only the current remaining token balance can be removed. If the balance reaches zero, the batch is hidden from My Batch until new tokens are added.'}
            </DialogDescription>
          </DialogHeader>

          {selectedTokenRow ? (
            <div className="space-y-4">
              <Card className="bg-muted/30">
                <CardContent className="grid gap-3 p-4 text-sm md:grid-cols-2">
                  <div>
                    <p className="font-semibold">{selectedTokenRow.batch.title || 'Live Batch'}</p>
                    <p className="text-muted-foreground">{selectedTokenRow.examLabel} / {selectedTokenRow.classLabel}</p>
                    <p className="text-muted-foreground">{selectedTokenRow.subjectLabel}</p>
                  </div>
                  <div className="space-y-1 text-muted-foreground">
                    <p>Active tokens left: <span className="font-semibold text-foreground">{selectedTokenRow.remainingSessions}</span></p>
                    <p>Effective allocated tokens: <span className="font-semibold text-foreground">{selectedTokenRow.totalPurchasedSessions}</span></p>
                    <p>Assignable now: <span className="font-semibold text-foreground">{selectedTokenRow.maxAssignableTokens}</span></p>
                    <p>Admin removed: <span className="font-semibold text-foreground">{selectedTokenRow.removedSessions}</span></p>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label htmlFor="token-count">
                  {tokenDialogState?.mode === 'assign' ? 'How many tokens to give?' : 'How many tokens to remove?'}
                </Label>
                <Input
                  id="token-count"
                  inputMode="numeric"
                  value={tokenCountInput}
                  onChange={(event) => setTokenCountInput(event.target.value.replace(/[^\d]/g, ''))}
                  placeholder="Enter token count"
                />
                <p className="text-xs text-muted-foreground">
                  {tokenDialogState?.mode === 'assign'
                    ? `Maximum assignable right now: ${selectedTokenRow.maxAssignableTokens}.`
                    : `Maximum removable right now: ${selectedTokenRow.remainingSessions}.`}
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenDialogState(null)}>
              Cancel
            </Button>
            <Button
              onClick={tokenDialogState?.mode === 'assign' ? handleAssignTokens : handleRemoveTokens}
              disabled={
                !!busyKey
                && !!selectedTokenRow
                && busyKey.includes(`${selectedStudent?.id}:${selectedTokenRow.batch.id}`)
              }
            >
              {!!busyKey && !!selectedTokenRow && busyKey.includes(`${selectedStudent?.id}:${selectedTokenRow.batch.id}`) ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : tokenDialogState?.mode === 'assign' ? (
                <TicketPlus className="mr-2 h-4 w-4" />
              ) : (
                <TicketX className="mr-2 h-4 w-4" />
              )}
              {tokenDialogState?.mode === 'assign' ? 'Assign Tokens' : 'Remove Tokens'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resetTargetRow}
        onOpenChange={(open) => {
          if (open) return;
          setResetTargetBatchId(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Permanently reset this batch?</DialogTitle>
            <DialogDescription>
              This removes the student&apos;s live-batch access docs, linked live-batch test results, and batch test attempt history.
              After this, the student will behave like they never joined the batch before.
            </DialogDescription>
          </DialogHeader>

          {resetTargetRow ? (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="space-y-2 p-4 text-sm">
                <p><span className="font-semibold">Student:</span> {displayStudentName(selectedStudent)}</p>
                <p><span className="font-semibold">Live batch:</span> {resetTargetRow.batch.title || 'Live Batch'}</p>
                <p><span className="font-semibold">Current remaining tokens:</span> {resetTargetRow.remainingSessions}</p>
                <p><span className="font-semibold">Covered/used sessions:</span> {resetTargetRow.consumedSessions}</p>
              </CardContent>
            </Card>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTargetBatchId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handlePermanentReset}
              disabled={!!busyKey && !!resetTargetRow && busyKey === `reset:${selectedStudent?.id}:${resetTargetRow.batch.id}`}
            >
              {!!busyKey && !!resetTargetRow && busyKey === `reset:${selectedStudent?.id}:${resetTargetRow.batch.id}` ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Permanently Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
