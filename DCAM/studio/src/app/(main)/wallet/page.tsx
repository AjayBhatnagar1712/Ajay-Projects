'use client';

import { useEffect, useMemo, useState } from 'react';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useFirestore, useDoc, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  Clock3,
  History,
  Landmark,
  ListChecks,
  LoaderCircle,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  Wallet2,
} from 'lucide-react';
import { processTeacherInstantWithdrawal, saveTeacherPayoutDestination } from '@/app/actions';
import {
  resolveDefaultCommissions,
  resolveOverrideCommissions,
  type RevenueSettingsDoc,
  type TeacherCommissionOverrideDoc,
} from '@/lib/revenue-sharing';

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
  verifiedAt?: string | null;
};

type TeacherWalletProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  roleId?: 'teacher' | 'admin' | 'student';
  teacherStatus?: 'pending' | 'approved' | 'rejected';
  payoutMethod?: PayoutMethod;
  payoutTransferMode?: 'UPI' | 'BANK_TRANSFER';
  payoutDetailsStatus?: 'submitted' | 'saved' | 'verified' | 'draft' | 'failed' | string;
  payoutDestinationLabel?: string;
  payoutContactName?: string;
  payoutContactEmail?: string;
  payoutContactPhone?: string;
  payoutUpiId?: string | null;
  payoutUpiIdMasked?: string | null;
  payoutBankName?: string | null;
  payoutBankIfsc?: string | null;
  payoutAccountHolderName?: string | null;
  payoutBankAccountNumber?: string | null;
  payoutBankAccountLast4?: string | null;
  payoutDetailsVerifiedAt?: string | null;
  payoutDetailsUpdatedAt?: string | null;
  razorpayFundAccountId?: string | null;
};

type PayoutRequest = {
  id: string;
  requesterId: string;
  requesterType: 'teacher' | 'admin';
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'paid' | 'failed';
  createdAt?: string;
  processedAt?: string;
  reason?: string;
  payoutReferenceId?: string;
  failureReason?: string;
  payoutMethod?: PayoutMethod;
  payoutDestinationLabel?: string;
  payoutDestinationSnapshot?: PayoutDestinationSnapshot;
  providerMode?: 'automatic' | 'manual_queue' | string;
  queueReason?: string | null;
};

type WalletTransaction = {
  id: string;
  entryType?: 'sale_credit' | 'withdrawal_pending' | 'withdrawal_paid' | 'withdrawal_rejected' | string;
  status?: string;
  paymentId?: string;
  payoutRequestId?: string;
  teacherId?: string | null;
  userId?: string;
  studentName?: string;
  linkedContentType?: string | null;
  saleType?: string;
  grossAmount?: number;
  adminCommissionPercent?: number;
  adminCommissionAmount?: number;
  teacherPayoutAmount?: number;
  withdrawalAmount?: number;
  currency?: string;
  createdAt?: string;
  payoutMethod?: PayoutMethod;
  payoutDestinationLabel?: string;
  payoutDestinationSnapshot?: PayoutDestinationSnapshot;
  reason?: string;
  failureReason?: string;
  providerMode?: 'automatic' | 'manual_queue' | string;
  queueReason?: string | null;
};

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

const prettyEntryType = (entryType?: string) => {
  if (entryType === 'sale_credit') return 'Sale Credit';
  if (entryType === 'withdrawal_pending') return 'Withdrawal Request';
  if (entryType === 'withdrawal_paid') return 'Manual Settlement Completed';
  if (entryType === 'withdrawal_rejected') return 'Withdrawal Reversed';
  return entryType || 'Entry';
};

const prettyRevenueSource = (linkedContentType?: string | null, saleType?: string | null) => {
  const normalized = String(linkedContentType || saleType || '').trim().toLowerCase();
  if (!normalized) return 'General Transaction';
  if (normalized.includes('live_batch')) return 'Live Batch';
  if (normalized.includes('mock_test') && normalized.includes('custom')) return 'Custom Mock Test';
  if (normalized.includes('mock_test')) return 'Mock Test';
  if (normalized.includes('practice_session')) return 'Practice Session';
  if (normalized.includes('course')) return 'Course';
  if (normalized.includes('withdraw')) return 'Withdrawal';
  return String(saleType || linkedContentType || 'Transaction')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const maskEmailAddress = (value?: string | null) => {
  const email = String(value || '').trim().toLowerCase();
  const [name, domain] = email.split('@');
  if (!name || !domain) return '-';
  const visiblePrefix = name.slice(0, Math.min(2, name.length));
  const hiddenLength = Math.max(1, name.length - visiblePrefix.length);
  return `${visiblePrefix}${'*'.repeat(hiddenLength)}@${domain}`;
};

const maskPhoneNumber = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '-';
  if (digits.length <= 4) return digits;
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

const buildPayoutRouteSummary = (input: {
  upiId?: string | null;
  upiIdMasked?: string | null;
  bankName?: string | null;
  bankAccountLast4?: string | null;
}) => {
  const hasUpi = Boolean(String(input.upiId || input.upiIdMasked || '').trim());
  const hasBank = Boolean(String(input.bankName || input.bankAccountLast4 || '').trim());
  if (hasUpi && hasBank) return 'UPI + Bank details saved';
  if (hasUpi) return `UPI • ${input.upiId || input.upiIdMasked}`;
  if (hasBank) return `Bank • ${input.bankName || 'Saved account'}${input.bankAccountLast4 ? ` • ****${input.bankAccountLast4}` : ''}`;
  return 'No payout details shared yet';
};

export default function WalletPage() {
  const { user } = useUser();
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [payoutContactName, setPayoutContactName] = useState('');
  const [payoutContactEmail, setPayoutContactEmail] = useState('');
  const [payoutContactPhone, setPayoutContactPhone] = useState('');
  const [payoutUpiId, setPayoutUpiId] = useState('');
  const [bankAccountHolderName, setBankAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [confirmBankAccountNumber, setConfirmBankAccountNumber] = useState('');
  const [confirmPayoutDestination, setConfirmPayoutDestination] = useState(false);
  const [confirmWithdrawalDestination, setConfirmWithdrawalDestination] = useState(false);
  const [isSavingPayoutDestination, setIsSavingPayoutDestination] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const walletRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'wallets', `teacher_${user.uid}`) : null),
    [firestore, user]
  );
  const settingsRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'platform_settings', 'revenue') : null),
    [firestore]
  );
  const overrideRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'teacher_commission_overrides', user.uid) : null),
    [firestore, user]
  );

  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<TeacherWalletProfile>(userRef);
  const { data: wallet, isLoading: isWalletLoading } = useDoc<WalletDoc>(walletRef);
  const { data: revenueSettings, isLoading: isRevenueSettingsLoading } = useDoc<RevenueSettingsDoc>(settingsRef);
  const { data: teacherOverride, isLoading: isTeacherOverrideLoading } = useDoc<TeacherCommissionOverrideDoc>(overrideRef);

  const requestsQuery = useMemoFirebase(
    () =>
      firestore && user?.uid
        ? query(
            collection(firestore, 'payout_requests'),
            where('requesterType', '==', 'teacher'),
            where('requesterId', '==', user.uid),
            orderBy('createdAt', 'desc')
          )
        : null,
    [firestore, user]
  );
  const passbookQuery = useMemoFirebase(
    () =>
      firestore && user?.uid
        ? query(collection(firestore, 'wallet_transactions'), where('teacherId', '==', user.uid))
        : null,
    [firestore, user]
  );

  const { data: requests, isLoading: isRequestsLoading } = useCollection<PayoutRequest>(requestsQuery);
  const { data: passbookRows, isLoading: isPassbookLoading } = useCollection<WalletTransaction>(passbookQuery);

  const available = wallet?.availableBalance || 0;
  const pending = wallet?.pendingBalance || 0;
  const totalEarned = wallet?.totalEarned || 0;
  const totalWithdrawn = wallet?.totalWithdrawn || 0;
  const hasSavedUpi = Boolean(userProfile?.payoutUpiId || userProfile?.payoutUpiIdMasked);
  const hasSavedBank = Boolean(userProfile?.payoutBankAccountNumber || userProfile?.payoutBankAccountLast4);
  const payoutRouteReady = hasSavedUpi || hasSavedBank;
  const payoutRouteLabel = buildPayoutRouteSummary({
    upiId: userProfile?.payoutUpiId,
    upiIdMasked: userProfile?.payoutUpiIdMasked,
    bankName: userProfile?.payoutBankName,
    bankAccountLast4: userProfile?.payoutBankAccountLast4,
  });
  const payoutStatusLabel = payoutRouteReady ? 'Routes ready for admin' : 'Add UPI or bank first';
  const payoutDeliveryLabel =
    hasSavedUpi && hasSavedBank
      ? 'Admin will receive both your UPI and bank details with each withdrawal request.'
      : hasSavedUpi
        ? 'Admin will receive your saved UPI details with each withdrawal request.'
        : hasSavedBank
          ? 'Admin will receive your saved bank details with each withdrawal request.'
          : 'Save at least one route so admin knows where to send your payment.';
  const payoutContactSummaryName =
    userProfile?.payoutContactName ||
    `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() ||
    userProfile?.displayName ||
    'Teacher';
  const requestedWithdrawalAmount = Number(requestAmount);
  const hasValidRequestedAmount = Number.isFinite(requestedWithdrawalAmount) && requestedWithdrawalAmount > 0;
  const isRequestedAmountAboveAvailable = hasValidRequestedAmount && requestedWithdrawalAmount > available;
  const canSubmitWithdrawal =
    payoutRouteReady &&
    confirmWithdrawalDestination &&
    hasValidRequestedAmount &&
    !isRequestedAmountAboveAvailable &&
    !isSubmitting;

  useEffect(() => {
    if (!userProfile) return;

    const defaultContactName =
      userProfile.payoutContactName ||
      `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() ||
      userProfile.displayName ||
      '';
    const defaultEmail = userProfile.payoutContactEmail || userProfile.email || user?.email || '';
    const defaultPhone = userProfile.payoutContactPhone || userProfile.phoneNumber || '';

    setPayoutContactName(defaultContactName);
    setPayoutContactEmail(defaultEmail);
    setPayoutContactPhone(defaultPhone);
    setBankAccountHolderName(userProfile.payoutAccountHolderName || defaultContactName);
    setBankName(userProfile.payoutBankName || '');
    setBankIfsc(userProfile.payoutBankIfsc || '');
    setPayoutUpiId(userProfile.payoutUpiId || '');
    setBankAccountNumber(userProfile.payoutBankAccountNumber || '');
    setConfirmBankAccountNumber(userProfile.payoutBankAccountNumber || '');
    setConfirmPayoutDestination(false);
  }, [userProfile, user?.email]);

  const defaultCommissions = useMemo(() => resolveDefaultCommissions(revenueSettings), [revenueSettings]);
  const overrideCommissions = useMemo(() => resolveOverrideCommissions(teacherOverride), [teacherOverride]);
  const effectiveCommissions = useMemo(
    () => ({
      course: overrideCommissions.course ?? defaultCommissions.course,
      mockTest: overrideCommissions.mockTest ?? defaultCommissions.mockTest,
      liveBatch: overrideCommissions.liveBatch ?? defaultCommissions.liveBatch,
      practiceSession: overrideCommissions.practiceSession ?? defaultCommissions.practiceSession,
      customMockTest: overrideCommissions.customMockTest ?? defaultCommissions.customMockTest,
    }),
    [defaultCommissions, overrideCommissions]
  );

  const sortedPassbook = useMemo(() => {
    const rows = [...(passbookRows || [])];
    rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return rows;
  }, [passbookRows]);
  const totalRequests = (requests || []).length;
  const paidRequests = (requests || []).filter((req) => req.status === 'approved' || req.status === 'paid').length;
  const teacherSplitCards = [
    {
      key: 'course',
      label: 'Course',
      description: 'Full paid courses sold on the platform.',
      adminPercent: effectiveCommissions.course,
    },
    {
      key: 'liveBatch',
      label: 'Live Batch',
      description: 'Paid live-batch session purchases and recharges.',
      adminPercent: effectiveCommissions.liveBatch,
    },
    {
      key: 'mockTest',
      label: 'Mock Test',
      description: 'Standalone premium mock-test purchases.',
      adminPercent: effectiveCommissions.mockTest,
    },
    {
      key: 'practiceSession',
      label: 'Practice Session',
      description: 'Premium teacher practice-session payments.',
      adminPercent: effectiveCommissions.practiceSession,
    },
    {
      key: 'customMockTest',
      label: 'Custom Mock Test',
      description: 'Custom mock builds created after payment.',
      adminPercent: effectiveCommissions.customMockTest,
    },
  ] as const;
  const walletMetricCards = [
    {
      label: 'Ready To Request',
      value: formatCurrency(available),
      note: 'Amount you can request from admin right now.',
      accent: 'from-cyan-500/15 via-sky-500/5 to-transparent',
    },
    {
      label: 'Under Admin Review',
      value: formatCurrency(pending),
      note: 'Requested amount waiting for manual transfer.',
      accent: 'from-amber-500/15 via-orange-500/5 to-transparent',
    },
    {
      label: 'Total Earnings',
      value: formatCurrency(totalEarned),
      note: 'All credits added to your wallet so far.',
      accent: 'from-emerald-500/15 via-green-500/5 to-transparent',
    },
    {
      label: 'Total Paid Out',
      value: formatCurrency(totalWithdrawn),
      note: 'Amount already settled to you by admin.',
      accent: 'from-violet-500/15 via-indigo-500/5 to-transparent',
    },
  ] as const;
  const payoutJourneyCards = [
    {
      title: '1. Save Details',
      description: 'Add the UPI ID or bank account where admin should send your payout.',
      accent: 'border-cyan-300/20 bg-cyan-500/10 text-cyan-50',
    },
    {
      title: '2. Send Request',
      description: 'Choose how much to withdraw and send the request to admin.',
      accent: 'border-emerald-300/20 bg-emerald-500/10 text-emerald-50',
    },
    {
      title: '3. Admin Settles',
      description: 'Admin transfers the money manually and marks the request as paid.',
      accent: 'border-amber-300/20 bg-amber-500/10 text-amber-50',
    },
  ] as const;
  const withdrawalRules = [
    'Any positive available amount can be requested',
    'Admin receives every saved UPI and bank route with the withdrawal request',
    'Up to 3 withdrawal requests per day',
  ] as const;
  const primaryButtonClass =
    'h-11 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 px-5 text-white shadow-[0_18px_34px_-20px_rgba(37,99,235,0.95)] transition-all duration-200 hover:-translate-y-0.5 hover:from-cyan-300 hover:via-sky-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60';
  const secondaryButtonClass =
    'h-11 rounded-xl border border-white/10 bg-white/[0.04] px-5 text-slate-100 transition-all duration-200 hover:border-cyan-300/35 hover:bg-cyan-500/10';
  const inputClass =
    'h-12 rounded-xl border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-300/60';

  const savePayoutRoute = async (route: PayoutMethod) => {
    if (!user) return;
    if (!confirmPayoutDestination) {
      toast({
        variant: 'destructive',
        title: 'Confirm payout destination',
        description: 'Tick the confirmation checkbox before saving UPI or bank details.',
      });
      return;
    }

    setIsSavingPayoutDestination(true);
    try {
      const idToken = await user.getIdToken(true);
      const result = await saveTeacherPayoutDestination({
        idToken,
        payoutMethod: route,
        contactName: payoutContactName,
        contactEmail: payoutContactEmail,
        contactPhone: payoutContactPhone,
        upiId: route === 'upi' ? payoutUpiId : '',
        accountHolderName: route === 'bank_account' ? bankAccountHolderName : '',
        bankName: route === 'bank_account' ? bankName : '',
        ifscCode: route === 'bank_account' ? bankIfsc : '',
        accountNumber: route === 'bank_account' ? bankAccountNumber : '',
        confirmAccountNumber: route === 'bank_account' ? confirmBankAccountNumber : '',
      });

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Payout route not saved',
          description: result.error || 'Could not save payout details for admin.',
        });
        return;
      }

      setConfirmPayoutDestination(false);
      setConfirmWithdrawalDestination(false);
      toast({
        title: 'Payout details saved',
        description: `${result.routeLabel || 'Your payout destination'} is now ready for admin settlement requests.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: error.message || 'Could not save payout details.',
      });
    } finally {
      setIsSavingPayoutDestination(false);
    }
  };

  const createInstantWithdrawal = async () => {
    if (!user || !firestore) return;
    if (!payoutRouteReady) {
      toast({
        variant: 'destructive',
        title: 'Payout details required',
        description: 'Add your UPI ID or bank account details before sending a withdrawal request to admin.',
      });
      return;
    }
    if (!confirmWithdrawalDestination) {
      toast({
        variant: 'destructive',
        title: 'Confirm withdrawal destination',
        description: 'Confirm the payout details that admin should use before sending your withdrawal request.',
      });
      return;
    }
    const amount = Number(requestAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid amount', description: 'Enter a valid withdrawal amount.' });
      return;
    }
    if (amount > available) {
      toast({ variant: 'destructive', title: 'Insufficient balance', description: 'Requested amount exceeds available balance.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken(true);
      const result = await processTeacherInstantWithdrawal({
        idToken,
        amount,
        reason: requestReason || '',
      });
      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Withdrawal failed',
          description: result.error || 'Could not submit withdrawal request.',
        });
        return;
      }

      setRequestAmount('');
      setRequestReason('');
      setConfirmWithdrawalDestination(false);
      toast({
        title: 'Withdrawal request sent to admin',
        description: `INR ${amount.toLocaleString()} moved to pending balance. Admin can now review your payout details and settle the payment manually.`,
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Request failed', description: error.message || 'Could not submit withdrawal request.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading =
    isTeacherLoading ||
    isAdminLoading ||
    isUserProfileLoading ||
    isWalletLoading ||
    isRequestsLoading ||
    isPassbookLoading ||
    isRevenueSettingsLoading ||
    isTeacherOverrideLoading;

  if (isLoading) {
    return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
  }

  if (!isTeacher || isAdmin) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Access Denied" />
        <main className="flex flex-1 items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.95))] p-4 md:p-6 lg:p-8">
          <Card className="w-full max-w-lg border-white/10 bg-slate-950/80 text-center shadow-[0_24px_60px_-40px_rgba(56,189,248,0.85)]">
            <CardHeader className="space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/10">
                <AlertTriangle className="h-6 w-6 text-rose-300" />
              </div>
              <CardTitle className="flex items-center justify-center gap-2 text-destructive">Access Denied</CardTitle>
              <CardDescription>
                This workspace is reserved for approved teacher wallet operations only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-300">
                Switch to a teacher account to review earnings, platform splits, and payout history.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Wallet" />
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-4 md:p-6 lg:p-8 space-y-6">
        <Card className="relative overflow-hidden border-white/10 bg-[linear-gradient(135deg,rgba(8,47,73,0.94),rgba(15,23,42,0.96)_52%,rgba(30,41,59,0.92))] shadow-[0_28px_70px_-44px_rgba(56,189,248,0.95)]">
          <div className="pointer-events-none absolute -left-16 top-0 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />
          <CardContent className="relative p-6 md:p-8">
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  Teacher Wallet
                </span>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                    See your earnings, share payout details, and request money in one place.
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-slate-200/82">
                    This page shows three things clearly: how much is ready to request, how much is waiting with admin, and where admin should send your payment.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-cyan-300/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15">
                    Requestable now {formatCurrency(available)}
                  </Badge>
                  <Badge className="border-emerald-300/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15">
                    Under review {formatCurrency(pending)}
                  </Badge>
                  <Badge className="border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]">
                    {totalRequests} requests sent
                  </Badge>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200">Ready To Request</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(available)}</p>
                  <p className="mt-2 text-xs text-cyan-100/80">This amount can be sent to admin right away.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Your Live Batch Split</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    Admin {effectiveCommissions.liveBatch}% | You {100 - effectiveCommissions.liveBatch}%
                  </p>
                  <p className="mt-2 text-xs text-slate-300">This is the current revenue share for live-batch sales.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Requests Sent</p>
                  <p className="mt-2 text-lg font-semibold text-white">{totalRequests}</p>
                  <p className="mt-2 text-xs text-slate-300">Total payout requests you have sent to admin.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Waiting With Admin</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(pending)}</p>
                  <p className="mt-2 text-xs text-slate-300">Reserved amount waiting for admin to settle or reject.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(15,23,42,0.72))] shadow-[0_18px_40px_-34px_rgba(56,189,248,0.45)]">
          <CardHeader className="border-b border-white/10 pb-4">
            <CardTitle className="text-white">How Payout Works</CardTitle>
            <CardDescription>
              Follow these three steps whenever you want admin to send money from your wallet.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid gap-3 md:grid-cols-3">
              {payoutJourneyCards.map((item) => (
                <div key={item.title} className={`rounded-2xl border p-4 ${item.accent}`}>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-current/85">{item.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {walletMetricCards.map((card) => (
            <Card key={card.label} className="overflow-hidden border-white/10 bg-slate-950/70 shadow-[0_20px_40px_-34px_rgba(56,189,248,0.85)]">
              <CardContent className="relative p-5">
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.accent}`} />
                <div className="relative space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{card.label}</p>
                  <p className="text-2xl font-semibold text-white">{card.value}</p>
                  <p className="text-sm text-slate-300">{card.note}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(15,23,42,0.74))] shadow-[0_18px_48px_-34px_rgba(56,189,248,0.75)]">
          <CardHeader className="border-b border-white/10">
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              Admin Percentage Transparency
            </CardTitle>
            <CardDescription>
              These are the effective revenue rules applied to your sales after the admin default split and any teacher-specific override. Live batch is now shown separately.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              {teacherSplitCards.map((card) => {
                const isLiveBatchCard = card.key === 'liveBatch';
                return (
                  <div
                    key={card.key}
                    className={`rounded-2xl border p-4 ${
                      isLiveBatchCard
                        ? 'border-cyan-300/30 bg-cyan-500/10 shadow-[0_16px_34px_-28px_rgba(56,189,248,0.85)]'
                        : 'border-white/10 bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${isLiveBatchCard ? 'text-cyan-200' : 'text-slate-400'}`}>
                          {card.label}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          Admin {card.adminPercent}% | You {100 - card.adminPercent}%
                        </p>
                      </div>
                      {isLiveBatchCard ? (
                        <Badge className="border-cyan-300/35 bg-cyan-500/15 text-cyan-100">Priority</Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{card.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(8,47,73,0.32),rgba(15,23,42,0.94))] shadow-[0_18px_48px_-34px_rgba(34,197,94,0.45)]">
          <CardHeader className="border-b border-white/10">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <ShieldCheck className="h-5 w-5 text-emerald-300" />
                  Step 1: Share Payout Details With Admin
                </CardTitle>
                <CardDescription>
                  Save the UPI ID or bank account that admin should use while settling your withdrawal requests manually. You can update these details anytime before sending a new request.
                </CardDescription>
              </div>
              <Badge className={payoutRouteReady ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-300/30 bg-amber-500/10 text-amber-100'}>
                {payoutStatusLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 pt-5 xl:grid-cols-[0.88fr_1.12fr]">
            <div className="space-y-4">
              <div className={`rounded-3xl border p-5 ${payoutRouteReady ? 'border-emerald-300/25 bg-emerald-500/10' : 'border-amber-300/20 bg-amber-500/10'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Saved payout routes</p>
                    <p className="mt-2 text-xl font-semibold text-white">{payoutRouteLabel}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200/82">{payoutDeliveryLabel}</p>
                  </div>
                  <div className={`rounded-2xl border px-3 py-2 text-xs font-semibold ${payoutRouteReady ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-300/30 bg-amber-500/10 text-amber-100'}`}>
                    {payoutStatusLabel}
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Saved UPI ID</p>
                      <Badge className={hasSavedUpi ? 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/[0.05] text-slate-300'}>
                        {hasSavedUpi ? 'Saved' : 'Not saved'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium text-white">{userProfile?.payoutUpiId || userProfile?.payoutUpiIdMasked || 'Add a UPI ID to start receiving manual settlements.'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Saved bank details</p>
                      <Badge className={hasSavedBank ? 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/[0.05] text-slate-300'}>
                        {hasSavedBank ? 'Saved' : 'Not saved'}
                      </Badge>
                    </div>
                    {hasSavedBank ? (
                      <div className="mt-2 space-y-1 text-sm text-white">
                        <p>{userProfile?.payoutBankName || 'Bank saved'}</p>
                        <p className="text-slate-300">A/C: {userProfile?.payoutBankAccountNumber || `****${userProfile?.payoutBankAccountLast4 || ''}`}</p>
                        <p className="text-slate-300">IFSC: {userProfile?.payoutBankIfsc || '-'}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm font-medium text-white">Add bank account details if you want admin to have a bank-transfer option.</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Receiver Name</p>
                    <p className="mt-2 text-sm font-medium text-white">{payoutContactSummaryName}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Last Updated</p>
                    <p className="mt-2 text-sm font-medium text-white">{prettyDate(userProfile?.payoutDetailsUpdatedAt || undefined)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                      <Mail className="h-3.5 w-3.5" />
                      Contact Email
                    </div>
                    <p className="mt-2 text-sm font-medium text-white">{maskEmailAddress(userProfile?.payoutContactEmail || userProfile?.email)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                      <Phone className="h-3.5 w-3.5" />
                      Contact Mobile
                    </div>
                    <p className="mt-2 text-sm font-medium text-white">{maskPhoneNumber(userProfile?.payoutContactPhone || userProfile?.phoneNumber)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">How admin uses this</p>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <div className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>If only one route is saved, that route is sent with the withdrawal request.</span>
                  </div>
                  <div className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>If both UPI and bank details are saved, both are sent to admin together.</span>
                  </div>
                  <div className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>If neither route is saved, the withdrawal request stays locked until you add one first.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input
                  placeholder="Receiver full name"
                  value={payoutContactName}
                  onChange={(e) => setPayoutContactName(e.target.value)}
                  className={inputClass}
                />
                <Input
                  type="email"
                  placeholder="Receiver email for admin updates"
                  value={payoutContactEmail}
                  onChange={(e) => setPayoutContactEmail(e.target.value)}
                  className={inputClass}
                />
                <Input
                  placeholder="10-digit mobile number"
                  value={payoutContactPhone}
                  onChange={(e) => setPayoutContactPhone(e.target.value)}
                  className={inputClass}
                />
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
                  These contact details go with every withdrawal request so admin can verify the transfer destination before paying you.
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">UPI details</p>
                    <p className="mt-2 text-lg font-semibold text-white">Save or edit your UPI ID</p>
                    <p className="mt-2 text-sm leading-6 text-cyan-50/90">This UPI ID will be sent to admin on withdrawal requests whenever it is saved here.</p>
                  </div>
                  <Badge className={hasSavedUpi ? 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/[0.06] text-slate-200'}>
                    {hasSavedUpi ? 'UPI saved' : 'No UPI saved'}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
                  <Input
                    placeholder="UPI ID like teacher@okaxis"
                    value={payoutUpiId}
                    onChange={(e) => setPayoutUpiId(e.target.value)}
                    className={inputClass}
                  />
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-cyan-50/90">
                    {hasSavedUpi
                      ? `Current saved UPI: ${userProfile?.payoutUpiId || userProfile?.payoutUpiIdMasked}`
                      : 'No UPI is saved yet. Add one now if admin should be able to pay you by UPI.'}
                  </div>
                </div>
                <div className="mt-4">
                  <Button onClick={() => savePayoutRoute('upi')} disabled={isSavingPayoutDestination} className={`${primaryButtonClass} min-w-[220px]`}>
                    {isSavingPayoutDestination ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wallet2 className="h-4 w-4" />}
                    Save UPI Details
                  </Button>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Bank details</p>
                    <p className="mt-2 text-lg font-semibold text-white">Save or edit your bank account</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">These bank details will also be sent to admin whenever a withdrawal request is created.</p>
                  </div>
                  <Badge className={hasSavedBank ? 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/[0.06] text-slate-200'}>
                    {hasSavedBank ? 'Bank saved' : 'No bank saved'}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input
                    placeholder="Account holder name"
                    value={bankAccountHolderName}
                    onChange={(e) => setBankAccountHolderName(e.target.value)}
                    className={inputClass}
                  />
                  <Input
                    placeholder="Bank name"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className={inputClass}
                  />
                  <Input
                    placeholder="IFSC code"
                    value={bankIfsc}
                    onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                    className={inputClass}
                  />
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-300">
                    {hasSavedBank
                      ? `Current saved account: ${userProfile?.payoutBankAccountNumber || `****${userProfile?.payoutBankAccountLast4 || ''}`}`
                      : 'No bank account is saved yet. Add one if you want admin to have a bank-transfer option.'}
                  </div>
                  <Input
                    placeholder="Bank account number"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, ''))}
                    className={inputClass}
                  />
                  <Input
                    placeholder="Confirm bank account number"
                    value={confirmBankAccountNumber}
                    onChange={(e) => setConfirmBankAccountNumber(e.target.value.replace(/\D/g, ''))}
                    className={inputClass}
                  />
                </div>
                <div className="mt-4">
                  <Button onClick={() => savePayoutRoute('bank_account')} disabled={isSavingPayoutDestination} className={`${secondaryButtonClass} min-w-[220px]`}>
                    {isSavingPayoutDestination ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
                    Save Bank Details
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="confirm-payout-destination"
                    checked={confirmPayoutDestination}
                    onCheckedChange={(checked) => setConfirmPayoutDestination(Boolean(checked))}
                    className="mt-1 border-white/20"
                  />
                  <label htmlFor="confirm-payout-destination" className="cursor-pointer text-sm leading-6 text-slate-200">
                    I confirm that the saved UPI ID and bank details belong to me. Admin can use whichever routes are saved here while manually settling my withdrawal requests.
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.76))] shadow-[0_18px_48px_-34px_rgba(37,99,235,0.75)]">
          <CardHeader className="border-b border-white/10">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Wallet2 className="h-5 w-5 text-cyan-300" />
                  Step 2: Send Withdrawal Request To Admin
                </CardTitle>
                <CardDescription>
                  Move available teacher earnings into admin review. Admin will send the money manually using the payout details shown below.
                </CardDescription>
              </div>
              <Badge className={payoutRouteReady ? 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100' : 'border-amber-300/30 bg-amber-500/10 text-amber-100'}>
                {payoutRouteReady ? payoutRouteLabel : 'Requests stay locked until UPI or bank details are saved'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 pt-5 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Payout Rules</p>
                <div className="mt-3 space-y-2">
                  {withdrawalRules.map((rule) => (
                    <div key={rule} className="flex items-start gap-2 text-sm text-cyan-50/90">
                      <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Processing Note</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Wallet balance is reserved first, then the request goes to admin. Admin can reject it and return the amount to available balance, or settle it manually and mark it paid with a transfer reference.
                </p>
              </div>
              <div className={`rounded-2xl border p-4 ${payoutRouteReady ? 'border-emerald-300/20 bg-emerald-500/10' : 'border-amber-300/20 bg-amber-500/10'}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">Payout Details Shared With Admin</p>
                <p className="mt-2 text-lg font-semibold text-white">{payoutRouteLabel}</p>
                <p className="mt-2 text-sm leading-6 text-slate-200/82">
                  {payoutRouteReady
                    ? payoutDeliveryLabel
                    : 'You must complete Step 1 first. Until then, the withdrawal button stays disabled.'}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                <Input
                  type="number"
                  min={0.01}
                  placeholder="Request amount (INR)"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  className={inputClass}
                />
                <Input
                  placeholder="Request note for admin (optional)"
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className={inputClass}
                />
                <Button
                  onClick={createInstantWithdrawal}
                  disabled={!canSubmitWithdrawal}
                  className={`${primaryButtonClass} md:min-w-[220px]`}
                >
                  {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                  Send Withdrawal Request
                </Button>
              </div>
              <div
                className={`rounded-2xl border p-4 ${
                  payoutRouteReady
                    ? 'border-white/10 bg-white/[0.03]'
                    : 'border-amber-300/20 bg-amber-500/10'
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Withdrawal readiness</p>
                <p className="mt-2 text-sm leading-6 text-slate-200/88">
                  {!payoutRouteReady
                    ? 'Finish adding payout details first. The withdrawal action unlocks only after Step 1 is complete.'
                    : available <= 0
                      ? 'No requestable balance is available right now. As soon as earnings reach your wallet, you can send a request to admin.'
                      : !hasValidRequestedAmount
                        ? `Enter any amount above zero up to ${formatCurrency(available)} to continue.`
                        : isRequestedAmountAboveAvailable
                          ? `Requested amount is above your available balance of ${formatCurrency(available)}.`
                          : 'Amount, payout details, and confirmation are all valid. You can send this request to admin now.'}
                </p>
              </div>
              <div className={`rounded-2xl border p-4 ${payoutRouteReady ? 'border-white/10 bg-white/[0.04]' : 'border-amber-300/20 bg-amber-500/10'}`}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="confirm-withdrawal-destination"
                    checked={confirmWithdrawalDestination}
                    onCheckedChange={(checked) => setConfirmWithdrawalDestination(Boolean(checked))}
                    className="mt-1 border-white/20"
                    disabled={!payoutRouteReady || available <= 0}
                  />
                  <label htmlFor="confirm-withdrawal-destination" className={`cursor-pointer text-sm leading-6 ${payoutRouteReady && available > 0 ? 'text-slate-200' : 'text-amber-50/90'}`}>
                    {payoutRouteReady && available > 0
                      ? `I reviewed the saved payout routes and want admin to use ${payoutRouteLabel} for this withdrawal request.`
                      : !payoutRouteReady
                        ? 'Withdrawal confirmation unlocks automatically after UPI or bank details are saved in Step 1.'
                        : 'Withdrawal confirmation unlocks once some balance is available in the wallet.'}
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs text-slate-400">Available Balance</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(available)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs text-slate-400">Pending Balance</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(pending)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs text-slate-400">Completed Requests</p>
                  <p className="mt-2 text-lg font-semibold text-white">{paidRequests}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="passbook" className="space-y-4">
          <TabsList className="h-auto rounded-2xl border border-white/10 bg-slate-950/70 p-1.5">
            <TabsTrigger value="passbook" className="rounded-xl px-4 py-2 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-100">
              <BookOpenCheck className="mr-2 h-4 w-4" />
              Passbook
            </TabsTrigger>
            <TabsTrigger value="requests" className="rounded-xl px-4 py-2 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-100">
              <History className="mr-2 h-4 w-4" />
              Requests Sent To Admin
            </TabsTrigger>
          </TabsList>

          <TabsContent value="passbook">
            <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.78))] shadow-[0_18px_48px_-34px_rgba(56,189,248,0.7)]">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="flex items-center gap-2 text-white">
                  <BookOpenCheck className="h-5 w-5 text-cyan-300" />
                  Passbook
                </CardTitle>
                <CardDescription>
                  A transaction-by-transaction ledger showing what the student paid, which product was sold, what admin kept, what reached your wallet, and which amounts are waiting for admin settlement.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <Table>
                    <TableHeader className="bg-white/[0.03]">
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Revenue Source</TableHead>
                        <TableHead>Student Paid</TableHead>
                        <TableHead>Admin %</TableHead>
                        <TableHead>Admin Cut</TableHead>
                        <TableHead>Your Credit</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedPassbook.length > 0 ? (
                        sortedPassbook.map((row) => (
                          <TableRow key={row.id} className="hover:bg-white/[0.03]">
                            <TableCell className="text-sm text-slate-200">{prettyDate(row.createdAt)}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-slate-100">{prettyEntryType(row.entryType)}</p>
                                <p className="text-xs text-slate-400">{prettyRevenueSource(row.linkedContentType, row.saleType)}</p>
                                {row.payoutDestinationLabel ? <p className="text-xs text-cyan-200">Route: {row.payoutDestinationLabel}</p> : null}
                                {row.studentName ? <p className="text-xs text-slate-500">Student: {row.studentName}</p> : null}
                                {row.queueReason ? <p className="text-xs text-amber-300">{row.queueReason}</p> : null}
                                {row.failureReason ? <p className="text-xs text-rose-300">{row.failureReason}</p> : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-200">{formatCurrency(Number(row.grossAmount || 0))}</TableCell>
                            <TableCell className="text-slate-200">{Number(row.adminCommissionPercent || 0).toFixed(2)}%</TableCell>
                            <TableCell className="text-slate-200">{formatCurrency(Number(row.adminCommissionAmount || 0))}</TableCell>
                            <TableCell className={Number(row.teacherPayoutAmount || 0) < 0 ? 'text-rose-300' : 'text-emerald-300'}>
                              {formatCurrency(Number(row.teacherPayoutAmount || 0))}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={`capitalize ${
                                  row.status === 'approved' || row.status === 'paid'
                                    ? 'bg-emerald-500/10 text-emerald-200'
                                    : row.status === 'rejected'
                                      ? 'bg-rose-500/10 text-rose-200'
                                      : row.status === 'pending' || row.status === 'processing'
                                        ? 'bg-amber-500/10 text-amber-200'
                                        : 'bg-white/[0.06] text-slate-200'
                                }`}
                              >
                                {row.status || '-'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-28 text-center text-slate-400">
                            No passbook entries yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.78))] shadow-[0_18px_48px_-34px_rgba(37,99,235,0.7)]">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Clock3 className="h-5 w-5 text-cyan-300" />
                  Requests Sent To Admin
                </CardTitle>
                <CardDescription>
                  Review every payout request sent to admin with status, timestamps, destination, and admin transfer reference.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <Table>
                    <TableHeader className="bg-white/[0.03]">
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Settled</TableHead>
                        <TableHead>Admin Ref</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(requests || []).length > 0 ? (
                        (requests || []).map((req) => (
                          <TableRow key={req.id} className="hover:bg-white/[0.03]">
                            <TableCell className="font-medium text-slate-100">{formatCurrency(Number(req.amount || 0))}</TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={`capitalize ${
                                  req.status === 'approved' || req.status === 'paid'
                                    ? 'bg-emerald-500/10 text-emerald-200'
                                    : req.status === 'rejected' || req.status === 'failed'
                                      ? 'bg-rose-500/10 text-rose-200'
                                      : 'bg-amber-500/10 text-amber-200'
                                }`}
                              >
                                {req.status === 'paid' ? 'approved' : req.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-300">
                              <div className="space-y-1">
                                <p>{req.payoutDestinationLabel || req.payoutDestinationSnapshot?.label || '-'}</p>
                                {req.queueReason ? <p className="text-xs text-amber-300">{req.queueReason}</p> : null}
                                {req.failureReason ? <p className="text-xs text-rose-300">{req.failureReason}</p> : null}
                                {req.status === 'approved' || req.status === 'paid' ? (
                                  <p className="text-xs text-emerald-300">Approved means admin has sent the money to your saved route.</p>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-300">{prettyDate(req.createdAt)}</TableCell>
                            <TableCell className="text-slate-300">{prettyDate(req.processedAt)}</TableCell>
                            <TableCell className="text-slate-300">{req.payoutReferenceId || '-'}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-28 text-center text-slate-400">
                            No withdrawal requests yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
