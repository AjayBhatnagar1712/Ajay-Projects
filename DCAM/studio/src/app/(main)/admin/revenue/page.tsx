'use client';

import { useMemo, useState } from 'react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import {
  useFirestore,
  useCollection,
  useDoc,
  useMemoFirebase,
  setDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useUser,
} from '@/firebase';
import { collection, query, doc, orderBy, writeBatch } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, ArrowUpRight, CheckCircle2, LoaderCircle, RotateCcw, Save, Sparkles, Users, Wallet, XCircle } from 'lucide-react';
import {
  resolveDefaultCommissions,
  resolveOverrideCommissions,
  type CommissionConfig,
  type CommissionKey,
  type PartialCommissionConfig,
  type RevenueSettingsDoc,
  type TeacherCommissionOverrideDoc,
} from '@/lib/revenue-sharing';

type CommissionInputMap = Partial<Record<CommissionKey, string>>;

type RevenueSettings = RevenueSettingsDoc & {
  id: string;
  updatedAt?: string;
  updatedBy?: string;
};

type TeacherOverride = TeacherCommissionOverrideDoc & {
  id: string;
  updatedAt?: string;
  updatedBy?: string;
};

type TeacherUser = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roleId?: 'student' | 'teacher' | 'admin';
  teacherStatus?: 'pending' | 'approved' | 'rejected';
};

type WalletDoc = {
  id: string;
  ownerType: 'teacher' | 'admin';
  ownerId: string;
  availableBalance?: number;
  pendingBalance?: number;
  totalEarned?: number;
  totalWithdrawn?: number;
};

type PayoutMethod = 'upi' | 'bank_account';

type PayoutDestinationSnapshot = {
  method?: PayoutMethod;
  label?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  payoutTransferMode?: 'UPI' | 'BANK_TRANSFER';
  hasUpiRoute?: boolean;
  hasBankRoute?: boolean;
  bankName?: string | null;
  bankIfsc?: string | null;
  accountHolderName?: string | null;
  bankAccountNumber?: string | null;
  accountLast4?: string | null;
  upiId?: string | null;
  upiIdMasked?: string | null;
  updatedAt?: string | null;
};

type PayoutRequest = {
  id: string;
  requesterId: string;
  requesterType: 'teacher' | 'admin';
  amount: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'paid' | 'failed';
  createdAt?: string;
  processedAt?: string;
  processedBy?: string;
  failureReason?: string;
  payoutReferenceId?: string;
  payoutMethod?: PayoutMethod;
  payoutDestinationLabel?: string;
  payoutDestinationSnapshot?: PayoutDestinationSnapshot;
  providerMode?: 'manual_admin_settlement' | string;
  queueReason?: string | null;
};

const COMMISSION_FIELDS: Array<{
  key: CommissionKey;
  label: string;
  shortLabel: string;
}> = [
  { key: 'course', label: 'Course', shortLabel: 'Course' },
  { key: 'mockTest', label: 'Mock Test', shortLabel: 'Mock' },
  { key: 'liveBatch', label: 'Live Batch', shortLabel: 'Live Batch' },
  { key: 'practiceSession', label: 'Practice Session', shortLabel: 'Practice' },
  { key: 'customMockTest', label: 'Custom Mock Test', shortLabel: 'Custom' },
];

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const prettyDate = (value?: string) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
};

const sectionCardClass =
  'border-border/60 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(15,23,42,0.72))] shadow-[0_18px_40px_-28px_rgba(56,189,248,0.55)] backdrop-blur supports-[backdrop-filter]:bg-card/75';
const metricCardClass =
  'border-border/60 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.72))] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_16px_36px_-24px_rgba(56,189,248,0.75)]';
const primaryButtonClass =
  'h-10 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 px-4 text-white shadow-[0_16px_30px_-18px_rgba(37,99,235,0.95)] transition-all duration-200 hover:-translate-y-0.5 hover:from-cyan-300 hover:via-sky-400 hover:to-blue-500';
const subtleButtonClass = 'h-10 rounded-xl border border-border/70 bg-background/70 px-4 hover:bg-accent/70';
const destructiveButtonClass =
  'h-10 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 text-white shadow-[0_12px_24px_-16px_rgba(225,29,72,0.9)] hover:from-rose-500 hover:to-red-500';
const inputClass = 'h-11 rounded-xl border-border/70 bg-background/70 focus-visible:ring-primary/70';
const compactInputClass = 'h-9 rounded-lg border-border/70 bg-background/70 focus-visible:ring-primary/70';

export default function RevenueManagementPage() {
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const settingsRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'platform_settings', 'revenue') : null),
    [firestore]
  );
  const teachersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), orderBy('lastName')) : null),
    [firestore]
  );
  const overridesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'teacher_commission_overrides')) : null),
    [firestore]
  );
  const adminWalletRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'wallets', 'admin_main') : null),
    [firestore]
  );
  const payoutRequestsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'payout_requests'), orderBy('createdAt', 'desc')) : null),
    [firestore]
  );
  const walletsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'wallets')) : null),
    [firestore]
  );

  const { data: settings, isLoading: isSettingsLoading } = useDoc<RevenueSettings>(settingsRef);
  const { data: teachers, isLoading: isTeachersLoading } = useCollection<TeacherUser>(teachersQuery);
  const { data: overrides, isLoading: isOverridesLoading } = useCollection<TeacherOverride>(overridesQuery);
  const { data: adminWallet, isLoading: isAdminWalletLoading } = useDoc<WalletDoc>(adminWalletRef);
  const { data: payoutRequests, isLoading: isPayoutRequestsLoading } = useCollection<PayoutRequest>(payoutRequestsQuery);
  const { data: wallets, isLoading: isWalletsLoading } = useCollection<WalletDoc>(walletsQuery);

  const [defaultInputs, setDefaultInputs] = useState<CommissionInputMap>({});
  const [teacherInputs, setTeacherInputs] = useState<Record<string, CommissionInputMap>>({});
  const [isSavingDefault, setIsSavingDefault] = useState(false);
  const [savingTeacherId, setSavingTeacherId] = useState<string | null>(null);
  const [clearingTeacherId, setClearingTeacherId] = useState<string | null>(null);
  const [adminWithdrawAmount, setAdminWithdrawAmount] = useState('');
  const [adminWithdrawReason, setAdminWithdrawReason] = useState('');
  const [isSubmittingAdminWithdraw, setIsSubmittingAdminWithdraw] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [manualSettlementRefs, setManualSettlementRefs] = useState<Record<string, string>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const defaultCommissions = useMemo(() => resolveDefaultCommissions(settings), [settings]);

  const overrideMap = useMemo(() => {
    const map: Record<string, TeacherOverride> = {};
    (overrides || []).forEach((override) => {
      map[override.id] = override;
    });
    return map;
  }, [overrides]);

  const sortedTeachers = useMemo(() => {
    const teacherCandidates = (teachers || []).filter((u) => {
      if (u.roleId === 'teacher') return true;
      if (u.roleId === 'admin') return false;
      return u.teacherStatus === 'approved' || u.teacherStatus === 'pending';
    });
    return [...teacherCandidates].sort((a, b) => {
      const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
      const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [teachers]);

  const onSaveDefault = async () => {
    if (!settingsRef || !user?.uid) return;
    const nextDefaults = {} as CommissionConfig;
    for (const field of COMMISSION_FIELDS) {
      const raw = defaultInputs[field.key];
      const hasRaw = typeof raw === 'string' && raw.trim() !== '';
      const parsed = hasRaw ? Number(raw) : defaultCommissions[field.key];
      if (!Number.isFinite(parsed)) {
        toast({
          variant: 'destructive',
          title: `Invalid ${field.label} %`,
          description: 'Enter a valid number between 0 and 100.',
        });
        return;
      }
      nextDefaults[field.key] = clampPercent(parsed);
    }

    setIsSavingDefault(true);
    try {
      await setDocumentNonBlocking(
        settingsRef,
        {
          defaultCommissions: nextDefaults,
          defaultCommissionPercent: nextDefaults.course,
          updatedAt: new Date().toISOString(),
          updatedBy: user.uid,
        },
        { merge: true }
      );
      setDefaultInputs({});
      toast({ title: 'Saved', description: 'Universal commission split updated.' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: error.message || 'Could not save universal percentages.',
      });
    } finally {
      setIsSavingDefault(false);
    }
  };

  const onSaveTeacherOverride = async (teacherId: string) => {
    if (!firestore || !user?.uid) return;

    const override = overrideMap[teacherId];
    const currentOverride = resolveOverrideCommissions(override);
    const rowInputs = teacherInputs[teacherId] || {};
    const nextOverride = {} as CommissionConfig;

    for (const field of COMMISSION_FIELDS) {
      const raw = rowInputs[field.key];
      const hasRaw = typeof raw === 'string' && raw.trim() !== '';
      const parsed = hasRaw
        ? Number(raw)
        : (currentOverride[field.key] ?? defaultCommissions[field.key]);

      if (!Number.isFinite(parsed)) {
        toast({
          variant: 'destructive',
          title: `Invalid ${field.label} %`,
          description: 'Enter a valid number between 0 and 100.',
        });
        return;
      }
      nextOverride[field.key] = clampPercent(parsed);
    }

    setSavingTeacherId(teacherId);
    try {
      await setDocumentNonBlocking(
        doc(firestore, 'teacher_commission_overrides', teacherId),
        {
          commissions: nextOverride,
          commissionPercent: nextOverride.course,
          updatedAt: new Date().toISOString(),
          updatedBy: user.uid,
        },
        { merge: true }
      );
      setTeacherInputs((prev) => {
        const next = { ...prev };
        delete next[teacherId];
        return next;
      });
      toast({ title: 'Override saved', description: 'Teacher transaction split updated.' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: error.message || 'Could not save teacher override.',
      });
    } finally {
      setSavingTeacherId(null);
    }
  };

  const onClearTeacherOverride = async (teacherId: string) => {
    if (!firestore) return;
    setClearingTeacherId(teacherId);
    try {
      await deleteDocumentNonBlocking(doc(firestore, 'teacher_commission_overrides', teacherId));
      setTeacherInputs((prev) => {
        const next = { ...prev };
        delete next[teacherId];
        return next;
      });
      toast({ title: 'Override removed', description: 'Teacher now uses the universal split.' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Remove failed',
        description: error.message || 'Could not clear override.',
      });
    } finally {
      setClearingTeacherId(null);
    }
  };

  const isLoading =
    isAdminLoading ||
    isSettingsLoading ||
    isTeachersLoading ||
    isOverridesLoading ||
    isAdminWalletLoading ||
    isPayoutRequestsLoading ||
    isWalletsLoading;

  const teacherById = useMemo(() => {
    const map: Record<string, TeacherUser> = {};
    (teachers || []).forEach((teacher) => {
      map[teacher.id] = teacher;
    });
    return map;
  }, [teachers]);

  const adminAvailable = adminWallet?.availableBalance || 0;
  const adminPending = adminWallet?.pendingBalance || 0;
  const adminEarned = adminWallet?.totalEarned || 0;
  const adminWithdrawn = adminWallet?.totalWithdrawn || 0;

  const teacherWithdrawalRequests = useMemo(
    () => (payoutRequests || []).filter((r) => r.requesterType === 'teacher'),
    [payoutRequests]
  );
  const openTeacherRequests = useMemo(
    () => teacherWithdrawalRequests.filter((r) => r.status === 'pending' || r.status === 'processing'),
    [teacherWithdrawalRequests]
  );
  const walletMap = useMemo(() => {
    const map: Record<string, WalletDoc> = {};
    (wallets || []).forEach((wallet) => {
      const key = wallet.ownerType === 'admin' ? 'admin_main' : `teacher_${wallet.ownerId}`;
      map[key] = wallet;
    });
    return map;
  }, [wallets]);

  const createAdminWithdrawalRequest = async () => {
    if (!firestore || !user?.uid) return;
    const amount = Number(adminWithdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid amount', description: 'Enter a valid amount.' });
      return;
    }
    if (amount > adminAvailable) {
      toast({ variant: 'destructive', title: 'Insufficient balance', description: 'Amount exceeds available admin balance.' });
      return;
    }
    setIsSubmittingAdminWithdraw(true);
    try {
      const now = new Date().toISOString();
      const reqRef = doc(collection(firestore, 'payout_requests'));
      const walletRef = doc(firestore, 'wallets', 'admin_main');
      const batch = writeBatch(firestore);
      batch.set(reqRef, {
        id: reqRef.id,
        requesterId: user.uid,
        requesterType: 'admin',
        amount,
        reason: adminWithdrawReason || '',
        status: 'pending',
        createdAt: now,
      });
      batch.set(
        walletRef,
        {
          availableBalance: adminAvailable - amount,
          pendingBalance: adminPending + amount,
          updatedAt: now,
        },
        { merge: true }
      );
      await batch.commit();
      setAdminWithdrawAmount('');
      setAdminWithdrawReason('');
      toast({ title: 'Admin withdrawal requested', description: 'Request is now pending processing.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Request failed', description: error.message || 'Could not request withdrawal.' });
    } finally {
      setIsSubmittingAdminWithdraw(false);
    }
  };

  const updateRequestStatus = async (request: PayoutRequest, nextStatus: 'rejected' | 'approved') => {
    if (!firestore || !user?.uid) return;
    const settlementReference = (manualSettlementRefs[request.id] || '').trim();
    const rejectionReason = (rejectionReasons[request.id] || '').trim();
    if (nextStatus === 'approved' && request.requesterType === 'teacher' && settlementReference.length < 3) {
      toast({
        variant: 'destructive',
        title: 'Transfer reference required',
        description: 'Enter the bank or UPI transfer reference before approving this withdrawal request.',
      });
      return;
    }
    if (nextStatus === 'rejected' && request.requesterType === 'teacher' && rejectionReason.length < 5) {
      toast({
        variant: 'destructive',
        title: 'Rejection reason required',
        description: 'Add a short reason so the teacher understands why this withdrawal was rejected.',
      });
      return;
    }
    setProcessingRequestId(request.id);
    try {
      const now = new Date().toISOString();
      const reqRef = doc(firestore, 'payout_requests', request.id);
      const walletDocId = request.requesterType === 'admin' ? 'admin_main' : `teacher_${request.requesterId}`;
      const walletRef = doc(firestore, 'wallets', walletDocId);
      const walletTxRef =
        request.requesterType === 'admin'
          ? doc(firestore, 'wallet_transactions', `admin_withdraw_${request.id}`)
          : doc(firestore, 'wallet_transactions', `withdraw_${request.id}`);
      const requesterWallet = walletMap[walletDocId];
      const walletAvailable = Number(requesterWallet?.availableBalance || 0);
      const walletPending = Number(requesterWallet?.pendingBalance || 0);
      const walletWithdrawn = Number(requesterWallet?.totalWithdrawn || 0);

      const batch = writeBatch(firestore);
      if (nextStatus === 'rejected') {
        batch.update(reqRef, {
          status: 'rejected',
          processedAt: now,
          processedBy: user.uid,
          failureReason: rejectionReason || 'Withdrawal request rejected by admin.',
          payoutReferenceId: null,
          queueReason: null,
        });
        batch.set(
          walletRef,
          {
            availableBalance: walletAvailable + request.amount,
            pendingBalance: Math.max(0, walletPending - request.amount),
            updatedAt: now,
          },
          { merge: true }
        );
        batch.set(
          walletTxRef,
          {
            id: walletTxRef.id,
            entryType: 'withdrawal_rejected',
            status: 'rejected',
            payoutRequestId: request.id,
            teacherId: request.requesterType === 'teacher' ? request.requesterId : null,
            requesterId: request.requesterId,
            requesterType: request.requesterType,
            grossAmount: 0,
            adminCommissionPercent: 0,
            adminCommissionAmount: 0,
            teacherPayoutAmount: request.requesterType === 'teacher' ? Number(request.amount || 0) : 0,
            withdrawalAmount: Number(request.amount || 0),
            currency: 'INR',
            createdAt: now,
            reason: request.reason || '',
            failureReason: rejectionReason || 'Withdrawal request rejected by admin.',
            payoutMethod: request.payoutMethod || request.payoutDestinationSnapshot?.method || null,
            payoutDestinationLabel: request.payoutDestinationLabel || request.payoutDestinationSnapshot?.label || null,
            payoutDestinationSnapshot: request.payoutDestinationSnapshot || null,
          },
          { merge: true }
        );
      } else {
        batch.update(reqRef, {
          status: 'approved',
          processedAt: now,
          processedBy: user.uid,
          payoutReferenceId: settlementReference || null,
          providerMode: 'manual_admin_settlement',
          queueReason: null,
          failureReason: null,
        });
        batch.set(
          walletRef,
          {
            pendingBalance: Math.max(0, walletPending - request.amount),
            totalWithdrawn: walletWithdrawn + request.amount,
            updatedAt: now,
          },
          { merge: true }
        );
        batch.set(
          walletTxRef,
          {
            id: walletTxRef.id,
            entryType: 'withdrawal_paid',
            status: 'approved',
            payoutRequestId: request.id,
            payoutReferenceId: settlementReference || null,
            teacherId: request.requesterType === 'teacher' ? request.requesterId : null,
            requesterId: request.requesterId,
            requesterType: request.requesterType,
            grossAmount: 0,
            adminCommissionPercent: 0,
            adminCommissionAmount: 0,
            teacherPayoutAmount: request.requesterType === 'teacher' ? -Number(request.amount || 0) : 0,
            withdrawalAmount: Number(request.amount || 0),
            currency: 'INR',
            createdAt: now,
            reason: request.reason || '',
            payoutMethod: request.payoutMethod || request.payoutDestinationSnapshot?.method || null,
            payoutDestinationLabel: request.payoutDestinationLabel || request.payoutDestinationSnapshot?.label || null,
            payoutDestinationSnapshot: request.payoutDestinationSnapshot || null,
            providerMode: 'manual_admin_settlement',
          },
          { merge: true }
        );
      }
      await batch.commit();
      setManualSettlementRefs((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
      setRejectionReasons((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
      toast({
        title: nextStatus === 'approved' ? 'Withdrawal approved' : 'Withdrawal rejected',
        description:
          nextStatus === 'approved'
            ? 'The request now shows as approved, meaning the amount has been sent to the teacher using your reference.'
            : 'The request was rejected and the reason is now visible in the teacher request history.',
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message || 'Could not update request.' });
    } finally {
      setProcessingRequestId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="mb-6 h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Access Denied" />
        <main className="flex flex-1 items-center justify-center overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center justify-center gap-2">
                <AlertTriangle /> Access Denied
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>You do not have permission to view this page.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Revenue Management" />
      <main className="flex-1 space-y-6 overflow-y-auto bg-gradient-to-b from-background via-background to-primary/5 p-4 md:p-6 lg:p-8">
        <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-r from-sky-500/10 via-background to-indigo-500/10 shadow-[0_16px_40px_-30px_rgba(56,189,248,0.9)]">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-400/15 blur-3xl" />
          <CardContent className="relative pt-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Revenue Control Center
                </span>
                <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
                  Commission, payout and teacher override management
                </h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Control how admin and teacher revenue is split across courses, live batches, mock tests, practice sessions, and custom mocks from one premium control surface.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:min-w-[340px]">
                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">Active Teachers</p>
                  <p className="mt-1 text-xl font-semibold">{sortedTeachers.length}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">Pending Payouts</p>
                  <p className="mt-1 text-xl font-semibold">{openTeacherRequests.length}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">Admin Available</p>
                  <p className="mt-1 text-sm font-semibold">{formatCurrency(adminAvailable)}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">Admin Pending</p>
                  <p className="mt-1 text-sm font-semibold">{formatCurrency(adminPending)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={sectionCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Universal Commission Split
            </CardTitle>
            <CardDescription>
              Set the platform-wide admin percentage for every paid content line, including live batches. Teachers inherit these values unless you apply an override.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              {COMMISSION_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-sm font-medium">{field.label} %</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={defaultInputs[field.key] ?? ''}
                    onChange={(e) => setDefaultInputs((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={String(defaultCommissions[field.key])}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              Teachers see these same effective percentages inside their wallet page, including the dedicated live-batch split.
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={onSaveDefault} disabled={isSavingDefault} className={`${primaryButtonClass} min-w-[176px]`}>
                {isSavingDefault ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Default Split
              </Button>
              <div className="flex flex-wrap gap-2">
                {COMMISSION_FIELDS.map((field) => (
                  <Badge key={field.key} className="bg-primary/10 text-primary hover:bg-primary/15">
                    {field.shortLabel}: {defaultCommissions[field.key]}%
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className={metricCardClass}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Admin Available</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-lg font-semibold">{formatCurrency(adminAvailable)}</p>
              <Wallet className="h-5 w-5 text-primary/80" />
            </CardContent>
          </Card>
          <Card className={metricCardClass}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Admin Pending</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-lg font-semibold">{formatCurrency(adminPending)}</p>
              <ArrowUpRight className="h-5 w-5 text-primary/80" />
            </CardContent>
          </Card>
          <Card className={metricCardClass}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Admin Earned</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-lg font-semibold">{formatCurrency(adminEarned)}</p>
              <Wallet className="h-5 w-5 text-primary/80" />
            </CardContent>
          </Card>
          <Card className={metricCardClass}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Admin Withdrawn</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-lg font-semibold">{formatCurrency(adminWithdrawn)}</p>
              <ArrowUpRight className="h-5 w-5 text-primary/80" />
            </CardContent>
          </Card>
        </div>

        <Card className={sectionCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Admin Withdrawal
            </CardTitle>
            <CardDescription>Create admin withdrawal requests from available admin revenue.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              type="number"
              min={0}
              value={adminWithdrawAmount}
              onChange={(e) => setAdminWithdrawAmount(e.target.value)}
              placeholder="Amount (INR)"
              className={inputClass}
            />
            <Input
              value={adminWithdrawReason}
              onChange={(e) => setAdminWithdrawReason(e.target.value)}
              placeholder="Reason (optional)"
              className={inputClass}
            />
            <div className="md:col-span-2">
              <Button onClick={createAdminWithdrawalRequest} disabled={isSubmittingAdminWithdraw} className={`${primaryButtonClass} w-full md:w-auto`}>
                {isSubmittingAdminWithdraw ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                Request Admin Withdrawal
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={sectionCardClass}>
          <CardHeader>
            <CardTitle>Teacher Commission Overrides</CardTitle>
            <CardDescription>
              Fine-tune commission percentages for one teacher at a time. Clearing a row instantly returns that teacher to the universal course, live-batch, mock, practice, and custom-mock split.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <Table>
                <TableHeader className="bg-muted/25">
                  <TableRow>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teacher</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Effective Split</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manual Override %</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {sortedTeachers.length > 0 ? (
                  sortedTeachers.map((teacher) => {
                    const override = overrideMap[teacher.id];
                    const overrideSplit = resolveOverrideCommissions(override);
                    const hasOverride = COMMISSION_FIELDS.some((field) => typeof overrideSplit[field.key] === 'number');
                    const effectiveSplit = {
                      course: overrideSplit.course ?? defaultCommissions.course,
                      mockTest: overrideSplit.mockTest ?? defaultCommissions.mockTest,
                      liveBatch: overrideSplit.liveBatch ?? defaultCommissions.liveBatch,
                      practiceSession: overrideSplit.practiceSession ?? defaultCommissions.practiceSession,
                      customMockTest: overrideSplit.customMockTest ?? defaultCommissions.customMockTest,
                    } satisfies CommissionConfig;
                    const rowInputs = teacherInputs[teacher.id] || {};
                    return (
                      <TableRow key={teacher.id} className="transition-colors hover:bg-primary/5">
                        <TableCell className="font-medium">
                          {`${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Teacher'}
                        </TableCell>
                        <TableCell>{teacher.email || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {COMMISSION_FIELDS.map((field) => (
                              <Badge
                                key={field.key}
                                variant={hasOverride ? 'default' : 'secondary'}
                                className={hasOverride ? 'bg-primary/85 text-primary-foreground' : 'bg-muted/70'}
                              >
                                {field.shortLabel}: {effectiveSplit[field.key]}%
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[360px]">
                          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                            {COMMISSION_FIELDS.map((field) => (
                              <div key={field.key} className="space-y-1">
                                <label className="text-muted-foreground text-[11px] font-medium">{field.shortLabel}</label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={rowInputs[field.key] ?? ''}
                                  onChange={(e) =>
                                    setTeacherInputs((prev) => ({
                                      ...prev,
                                      [teacher.id]: {
                                        ...(prev[teacher.id] || {}),
                                        [field.key]: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder={String(effectiveSplit[field.key])}
                                  className={compactInputClass}
                                />
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => onSaveTeacherOverride(teacher.id)}
                              disabled={savingTeacherId === teacher.id}
                              className={`${primaryButtonClass} h-9 px-3`}
                            >
                              {savingTeacherId === teacher.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onClearTeacherOverride(teacher.id)}
                              disabled={clearingTeacherId === teacher.id || !hasOverride}
                              className={`${subtleButtonClass} h-9 px-3`}
                            >
                              {clearingTeacherId === teacher.id ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                              Clear
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No teachers found.
                    </TableCell>
                  </TableRow>
                )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className={sectionCardClass}>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>Teacher Withdrawal Requests</CardTitle>
                <CardDescription>
                  Approve a request only after you manually send the money to the teacher. If you reject a request, give the teacher a clear reason.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="border-amber-300/30 bg-amber-500/10 text-amber-100">
                  Open {openTeacherRequests.length}
                </Badge>
                <Badge className="border-white/10 bg-white/[0.05] text-slate-200">
                  Total {teacherWithdrawalRequests.length}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <Table>
                <TableHeader className="bg-muted/25">
                  <TableRow>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requester</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payout Details</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teacher Note</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin Update</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Created</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment Proof</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {teacherWithdrawalRequests.length > 0 ? (
                  teacherWithdrawalRequests.map((req) => {
                    const teacher = teacherById[req.requesterId];
                    const requesterLabel = `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim() || req.requesterId;
                    const payoutDetails = req.payoutDestinationSnapshot;
                    const isCompleted = req.status === 'approved' || req.status === 'paid';
                    const isRejected = req.status === 'rejected' || req.status === 'failed';
                    const isActionable = req.status === 'pending' || req.status === 'processing';
                    return (
                      <TableRow key={req.id} className="transition-colors hover:bg-primary/5">
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{requesterLabel}</p>
                            {teacher?.email ? <p className="text-xs text-muted-foreground">{teacher.email}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(Number(req.amount || 0))}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`capitalize ${
                              isCompleted
                                ? 'bg-emerald-500/10 text-emerald-200'
                                : isRejected
                                  ? 'bg-rose-500/10 text-rose-200'
                                  : 'bg-amber-500/10 text-amber-200'
                            }`}
                          >
                            {isCompleted ? 'approved' : req.status}
                          </Badge>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {isCompleted
                              ? 'Approved means the amount has been sent to the teacher.'
                              : isRejected
                                ? 'Rejected request with teacher-visible reason.'
                                : 'Waiting for admin transfer and final decision.'}
                          </p>
                        </TableCell>
                        <TableCell className="min-w-[320px]">
                          <div className="space-y-1 text-sm">
                            <p className="font-medium">{req.payoutDestinationLabel || payoutDetails?.label || '-'}</p>
                            {payoutDetails?.upiId || payoutDetails?.upiIdMasked ? (
                              <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">UPI</p>
                                <p className="font-mono text-cyan-300">{payoutDetails.upiId || payoutDetails.upiIdMasked || '-'}</p>
                              </div>
                            ) : null}
                            {payoutDetails?.bankAccountNumber || payoutDetails?.accountLast4 ? (
                              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Bank</p>
                                <p className="font-mono text-cyan-300">{payoutDetails.bankAccountNumber || `****${payoutDetails.accountLast4 || ''}`}</p>
                                <p className="text-xs text-muted-foreground">
                                  {payoutDetails.accountHolderName || '-'} | {payoutDetails.bankName || '-'} | IFSC {payoutDetails.bankIfsc || '-'}
                                </p>
                              </div>
                            ) : null}
                            {!payoutDetails?.upiId && !payoutDetails?.upiIdMasked && !payoutDetails?.bankAccountNumber && !payoutDetails?.accountLast4 ? (
                              <p className="text-xs text-muted-foreground">No payout details attached.</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">
                              Receiver: {payoutDetails?.contactName || '-'} | Mobile: {payoutDetails?.contactPhone || '-'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>{req.reason || '-'}</p>
                            {req.queueReason ? <p className="text-xs text-amber-300">{req.queueReason}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[240px]">
                          {isRejected ? (
                            <div className="rounded-lg border border-rose-400/20 bg-rose-500/5 p-3 text-sm">
                              <p className="font-medium text-rose-200">Rejected</p>
                              <p className="mt-1 text-rose-100/90">{req.failureReason || 'No rejection reason added.'}</p>
                            </div>
                          ) : isCompleted ? (
                            <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3 text-sm">
                              <p className="font-medium text-emerald-200">Amount sent to teacher</p>
                              <p className="mt-1 text-emerald-100/90">Approved on {prettyDate(req.processedAt)}</p>
                            </div>
                          ) : (
                            <Input
                              value={rejectionReasons[req.id] ?? req.failureReason ?? ''}
                              onChange={(e) => setRejectionReasons((prev) => ({ ...prev, [req.id]: e.target.value }))}
                              placeholder="Reason required if rejecting"
                              className={compactInputClass}
                            />
                          )}
                        </TableCell>
                        <TableCell>{prettyDate(req.createdAt)}</TableCell>
                        <TableCell className="min-w-[180px]">
                          {isCompleted ? (
                            <div className="space-y-1 text-sm">
                              <p className="font-medium text-emerald-200">{req.payoutReferenceId || '-'}</p>
                              <p className="text-xs text-muted-foreground">Transfer reference shared with teacher</p>
                            </div>
                          ) : isRejected ? (
                            <p className="text-sm text-muted-foreground">No payment sent</p>
                          ) : (
                            <Input
                              value={manualSettlementRefs[req.id] ?? req.payoutReferenceId ?? ''}
                              onChange={(e) => setManualSettlementRefs((prev) => ({ ...prev, [req.id]: e.target.value }))}
                              placeholder="UTR / bank ref after transfer"
                              className={compactInputClass}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isActionable ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateRequestStatus(req, 'approved')}
                                disabled={processingRequestId === req.id}
                                className={`${primaryButtonClass} h-9 px-3`}
                              >
                                {processingRequestId === req.id ? (
                                  <LoaderCircle className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => updateRequestStatus(req, 'rejected')}
                                disabled={processingRequestId === req.id}
                                className={`${destructiveButtonClass} h-9 px-3`}
                              >
                                <XCircle className="h-4 w-4" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <Badge className={isCompleted ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100' : 'border-rose-300/30 bg-rose-500/10 text-rose-100'}>
                              {isCompleted ? 'Closed as approved' : 'Closed as rejected'}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No teacher withdrawal requests yet.
                    </TableCell>
                  </TableRow>
                )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
