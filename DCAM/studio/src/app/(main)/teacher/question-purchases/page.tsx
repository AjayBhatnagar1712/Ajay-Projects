'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { collection, orderBy, query } from 'firebase/firestore';

import { completeVerifiedPayment, createRazorpayOrder } from '@/app/actions';
import TeacherDashboardPremiumQuestionHub, {
  type TeacherPremiumQuestionSelectionContext,
} from '@/components/teacher-dashboard-premium-question-hub';
import DashboardHeader from '@/components/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { sendSelfBellNotification } from '@/lib/client-notifications';
import {
  buildTeacherQuestionPurchaseScopeDetail,
  buildTeacherQuestionPurchaseScopeLabel,
  buildTeacherQuestionPurchaseFormHref,
  computeTeacherQuestionAccessEndDate,
  computeTeacherQuestionPurchaseExtendedAccessEndDate,
  formatRupeeAmount,
  getTeacherQuestionPurchaseResolvedAccessEndsAt,
  getTeacherQuestionPurchaseResolvedDaysCount,
  getTeacherQuestionPurchaseCurrentCoverageAmount,
  isTeacherQuestionPurchaseActiveAt,
  syncTeacherQuestionPurchasePublicScopes,
  type TeacherQuestionPurchaseDoc,
} from '@/lib/teacher-question-purchase';
import {
  buildTeacherQuestionPurchaseRenewParams,
  teacherPurchaseMatchesScope,
} from '@/lib/teacher-premium-question-access';

declare global {
  interface Window {
    Razorpay: any;
  }
}

type PurchaseGroup = {
  key: string;
  examTypeName: string;
  className: string;
  purchases: TeacherQuestionPurchaseDoc[];
};

const formatDateTime = (value?: string) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDateOnly = (value?: string) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getDisplayedPurchaseAmount = (purchase: TeacherQuestionPurchaseDoc) => {
  if (purchase.assignmentSource && Number(purchase.totalAmountPaid || 0) <= 0) {
    return Number(purchase.pricingReferenceTotalAmount || 0);
  }
  return Number(purchase.totalAmountPaid || 0);
};

const normalizeRazorpayContact = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.length >= 10 ? digits.slice(-10) : '';
};

export default function TeacherQuestionPurchasesPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { toast } = useToast();
  const [selectedPurchaseForEdit, setSelectedPurchaseForEdit] = useState<TeacherQuestionPurchaseDoc | null>(null);
  const [isProcessingEditPayment, setIsProcessingEditPayment] = useState(false);

  const purchasesQuery = useMemoFirebase(
    () => (
      firestore && user?.uid
        ? query(collection(firestore, 'users', user.uid, 'teacher_question_purchases'), orderBy('purchasedAt', 'desc'))
        : null
    ),
    [firestore, user?.uid],
  );
  const { data: purchases, isLoading } = useCollection<TeacherQuestionPurchaseDoc>(purchasesQuery);

  useEffect(() => {
    const status = searchParams.get('status');
    const purchaseId = searchParams.get('purchaseId');
    if (status !== 'success' || !purchaseId) return;

    toast({
      title: 'Purchase successful',
      description: 'Your premium question purchase is now listed in Your Purchases.',
    });
    router.replace('/teacher/question-purchases');
  }, [router, searchParams, toast]);

  const purchaseRows = purchases || [];

  useEffect(() => {
    if (!firestore || !user?.uid) return;
    if (!Array.isArray(purchaseRows)) return;
    void syncTeacherQuestionPurchasePublicScopes(firestore, user.uid, purchaseRows);
  }, [firestore, purchaseRows, user?.uid]);

  const summary = useMemo(() => {
    return purchaseRows.reduce(
      (acc, purchase) => {
        acc.totalSpent += getDisplayedPurchaseAmount(purchase);
        acc.totalQuestions += Number(purchase.totalQuestionCount || 0);
        if ((purchase.status || 'paid') === 'paid') acc.totalPurchases += 1;
        if (isTeacherQuestionPurchaseActiveAt(purchase)) {
          acc.activePurchases += 1;
        }
        return acc;
      },
      { totalPurchases: 0, activePurchases: 0, totalQuestions: 0, totalSpent: 0 },
    );
  }, [purchaseRows]);

  const groupedPurchases = useMemo<PurchaseGroup[]>(() => {
    const groups = new Map<string, PurchaseGroup>();
    purchaseRows.forEach((purchase) => {
      const examTypeName = String(purchase.examTypeName || '').trim() || 'Exam';
      const className = String(purchase.className || '').trim() || 'Curriculum';
      const key = `${examTypeName}__${className}`;
      const existing = groups.get(key);
      if (existing) {
        existing.purchases.push(purchase);
        return;
      }
      groups.set(key, { key, examTypeName, className, purchases: [purchase] });
    });
    return Array.from(groups.values()).sort((left, right) =>
      `${left.examTypeName} / ${left.className}`.localeCompare(`${right.examTypeName} / ${right.className}`),
    );
  }, [purchaseRows]);
  const selectedPurchaseEditPrefillPayload = useMemo(
    () => (selectedPurchaseForEdit ? buildTeacherQuestionPurchaseRenewParams(selectedPurchaseForEdit) : null),
    [selectedPurchaseForEdit]
  );
  const selectedPurchaseResolvedDaysCount = useMemo(
    () => getTeacherQuestionPurchaseResolvedDaysCount(selectedPurchaseForEdit),
    [selectedPurchaseForEdit]
  );

  const closeEditDialog = () => {
    if (isProcessingEditPayment) return;
    setSelectedPurchaseForEdit(null);
  };

  const handleTeacherPurchaseEdit = async (context: TeacherPremiumQuestionSelectionContext) => {
    if (!firestore || !user?.uid || !selectedPurchaseForEdit) return;

    const purchase = selectedPurchaseForEdit;
    const scopeMatches = teacherPurchaseMatchesScope(purchase, context.request);
    if (!scopeMatches) {
      toast({
        variant: 'destructive',
        title: 'Scope mismatch',
        description: 'This edit flow can only increase counts inside the same purchased scope.',
      });
      return;
    }

    const countsNotReduced = (
      Number(context.request.regularCounts.Easy || 0) >= Number(purchase.regularCounts?.Easy || 0)
      && Number(context.request.regularCounts.Medium || 0) >= Number(purchase.regularCounts?.Medium || 0)
      && Number(context.request.regularCounts.Hard || 0) >= Number(purchase.regularCounts?.Hard || 0)
      && Number(context.request.pyqCounts.Easy || 0) >= Number(purchase.pyqCounts?.Easy || 0)
      && Number(context.request.pyqCounts.Medium || 0) >= Number(purchase.pyqCounts?.Medium || 0)
      && Number(context.request.pyqCounts.Hard || 0) >= Number(purchase.pyqCounts?.Hard || 0)
    );
    const studentsNotReduced = Number(context.request.studentsCount || 0) >= Number(purchase.studentsCount || 0);
    const daysNotReduced = Number(context.request.daysCount || 0) >= Number(purchase.daysCount || 0);

    if (!countsNotReduced || !studentsNotReduced || !daysNotReduced) {
      toast({
        variant: 'destructive',
        title: 'Only increases are allowed',
        description: 'Edit Purchase can add more questions, students, or days, but it cannot reduce the existing purchase.',
      });
      return;
    }

    const isCurrentlyActive = isTeacherQuestionPurchaseActiveAt(purchase);
    const currentCoveredValue = isCurrentlyActive ? getTeacherQuestionPurchaseCurrentCoverageAmount(purchase) : 0;
    const targetCoveredValue = Number(Number(context.pricing.totalAmount || 0).toFixed(2));
    const amountDelta = Number(Math.max(0, targetCoveredValue - currentCoveredValue).toFixed(2));

    const anythingChanged =
      targetCoveredValue > currentCoveredValue
      || Number(context.request.studentsCount || 0) > Number(purchase.studentsCount || 0)
      || Number(context.request.daysCount || 0) > Number(purchase.daysCount || 0)
      || Number(context.pricing.totalQuestionCount || 0) > Number(purchase.totalQuestionCount || 0);

    if (!anythingChanged) {
      toast({
        title: 'Nothing new to save',
        description: 'Increase questions, students, or days before updating this purchase.',
      });
      return;
    }

    if (amountDelta <= 0) {
      toast({
        variant: 'destructive',
        title: 'Payment amount not valid',
        description: 'This edit does not produce a valid payable amount. Increase the purchase first.',
      });
      return;
    }
    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      toast({
        variant: 'destructive',
        title: 'Razorpay not configured',
        description: 'Payment gateway key is missing for this app.',
      });
      return;
    }
    if (typeof window === 'undefined' || !window.Razorpay) {
      toast({
        variant: 'destructive',
        title: 'Payment gateway unavailable',
        description: 'Could not load Razorpay. Refresh and try again.',
      });
      return;
    }

    const normalizedContact = normalizeRazorpayContact(user.phoneNumber);
    setIsProcessingEditPayment(true);

    const orderResult = await createRazorpayOrder(amountDelta, 'INR');
    if (orderResult.error || !orderResult.orderId) {
      toast({
        variant: 'destructive',
        title: 'Payment initialization failed',
        description: orderResult.error || 'Could not create the payment order.',
      });
      setIsProcessingEditPayment(false);
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: Math.round(amountDelta * 100),
      currency: 'INR',
      name: 'DCAM Classes',
      description: `Teacher question edit: ${buildTeacherQuestionPurchaseScopeLabel(purchase) || 'Selected scope'}`,
      order_id: orderResult.orderId,
      handler: async (response: any) => {
        const paymentId = String(response.razorpay_payment_id || '').trim();
        const razorpayOrderId = String(response.razorpay_order_id || '').trim();
        const razorpaySignature = String(response.razorpay_signature || '').trim();
        if (!paymentId || !razorpayOrderId || !razorpaySignature) {
          toast({
            variant: 'destructive',
            title: 'Payment reference missing',
            description: 'The payment completed but verification details are missing.',
          });
          setIsProcessingEditPayment(false);
          return;
        }

        const paidAt = new Date().toISOString();
        const nextAccessStartsAt = isCurrentlyActive
          ? String(purchase.accessStartsAt || purchase.purchasedAt || paidAt).trim() || paidAt
          : paidAt;
        const addedDaysCount = Math.max(0, Number(context.request.daysCount || 0) - Number(purchase.daysCount || 0));
        const nextAccessEndsAt = isCurrentlyActive
          ? (
              addedDaysCount > 0
                ? computeTeacherQuestionPurchaseExtendedAccessEndDate(purchase, addedDaysCount, paidAt)
                : String(purchase.accessEndsAt || computeTeacherQuestionAccessEndDate(nextAccessStartsAt, context.request.daysCount)).trim()
            )
          : computeTeacherQuestionAccessEndDate(paidAt, context.request.daysCount);

        const updatedPurchase: TeacherQuestionPurchaseDoc = {
          ...purchase,
          ...context.request,
          status: 'paid',
          dailyRateAmount: context.pricing.dailyRateAmount,
          totalAmountPaid: Number(Number(purchase.totalAmountPaid || 0).toFixed(2)) + amountDelta,
          grossAmount: Number(Number(purchase.grossAmount || 0).toFixed(2)) + amountDelta,
          totalQuestionCount: context.pricing.totalQuestionCount,
          totalRegularQuestionCount: context.pricing.totalRegularQuestionCount,
          totalPyqQuestionCount: context.pricing.totalPyqQuestionCount,
          regularDailyRateByDifficulty: context.pricing.regularPricing,
          pyqDailyRateByDifficulty: context.pricing.pyqPricing,
          accessStartsAt: nextAccessStartsAt,
          accessEndsAt: nextAccessEndsAt,
          updatedAt: paidAt,
          currentCoverageAmount: targetCoveredValue,
        };

        try {
          const idToken = await user.getIdToken(true);
          const completionResult = await completeVerifiedPayment({
            idToken,
            orderId: razorpayOrderId,
            paymentId,
            signature: razorpaySignature,
            grossAmount: amountDelta,
            currency: 'INR',
            paymentData: {
              id: paymentId,
              type: 'teacher_question_purchase_edit',
              status: 'paid',
              userId: user.uid,
              userEmail: user.email || '',
              teacherId: purchase.teacherId,
              teacherName: purchase.teacherName || '',
              linkedContentType: 'teacher_question_purchase',
              linkedContentId: purchase.id,
              sourcePurchaseId: purchase.id,
              scopeCompositeId: `${purchase.examTypeId}__${purchase.classId}__${purchase.subjectId}`,
              grossAmount: amountDelta,
              currency: 'INR',
              razorpayOrderId: String(response.razorpay_order_id || '').trim(),
              razorpayPaymentId: paymentId,
              purchasedAt: paidAt,
              examTypeId: purchase.examTypeId,
              examTypeName: purchase.examTypeName,
              classId: purchase.classId,
              className: purchase.className,
              subjectId: purchase.subjectId,
              subjectName: purchase.subjectName,
              topicId: purchase.topicId || '',
              topicName: purchase.topicName || '',
              subtopicPath: purchase.subtopicPath || '',
              subtopicLabel: purchase.subtopicLabel || '',
              previousRegularCounts: purchase.regularCounts,
              nextRegularCounts: context.request.regularCounts,
              previousPyqCounts: purchase.pyqCounts,
              nextPyqCounts: context.request.pyqCounts,
              previousStudentsCount: purchase.studentsCount,
              nextStudentsCount: context.request.studentsCount,
              previousDaysCount: purchase.daysCount,
              nextDaysCount: context.request.daysCount,
              previousAccessEndsAt: purchase.accessEndsAt,
              nextAccessEndsAt,
              previousCoverageAmount: currentCoveredValue,
              nextCoverageAmount: targetCoveredValue,
              dailyRateAmount: context.pricing.dailyRateAmount,
              totalQuestionCount: context.pricing.totalQuestionCount,
            },
            writes: [
              {
                path: `users/${user.uid}/teacher_question_purchases/${purchase.id}`,
                merge: true,
                data: updatedPurchase,
              },
            ],
            revenueSplit: {
              teacherId: purchase.teacherId,
              linkedContentType: 'teacher_question_purchase',
              linkedContentId: purchase.id,
              saleType: 'teacher_question_purchase_edit',
              purchasedAt: paidAt,
              userEmail: user.email || '',
              studentName: user.displayName || user.email || 'Teacher',
              studentEmail: user.email || '',
              metadata: {
                sourcePurchaseId: purchase.id,
                examTypeId: purchase.examTypeId,
                examTypeName: purchase.examTypeName,
                classId: purchase.classId,
                className: purchase.className,
                subjectId: purchase.subjectId,
                subjectName: purchase.subjectName,
                topicId: purchase.topicId || '',
                topicName: purchase.topicName || '',
                subtopicPath: purchase.subtopicPath || '',
                subtopicLabel: purchase.subtopicLabel || '',
                previousStudentsCount: purchase.studentsCount,
                nextStudentsCount: context.request.studentsCount,
                previousDaysCount: purchase.daysCount,
                nextDaysCount: context.request.daysCount,
                previousQuestionCount: purchase.totalQuestionCount,
                nextQuestionCount: context.pricing.totalQuestionCount,
              },
            },
          });
          if (!completionResult.success) {
            throw new Error(completionResult.error || 'Could not complete the verified payment.');
          }

          await syncTeacherQuestionPurchasePublicScopes(firestore, user.uid);

          await sendSelfBellNotification(user, {
            title: 'Question purchase updated',
            message: `${buildTeacherQuestionPurchaseScopeLabel(purchase) || 'Your selected question scope'} now reflects your updated questions, students, and days.`,
            href: '/teacher/question-purchases',
            notificationType: 'teacher_question_purchase_success',
            dedupeKey: `teacher-question-purchase-edit:${paymentId}`,
            contentType: 'teacher_question_purchase',
            contentId: purchase.id,
            teacherId: purchase.teacherId,
            metadata: {
              purchaseId: purchase.id,
              editPaymentId: paymentId,
              nextQuestionCount: context.pricing.totalQuestionCount,
              nextStudentsCount: context.request.studentsCount,
              nextDaysCount: context.request.daysCount,
              amountPaid: amountDelta,
            },
          });

          toast({
            title: 'Purchase updated',
            description: 'The purchase card now uses the updated questions, students, and validity.',
          });
          closeEditDialog();
        } catch (error: any) {
          toast({
            variant: 'destructive',
            title: 'Payment recorded but edit save failed',
            description: error?.message || 'Please contact support with your payment reference.',
          });
        } finally {
          setIsProcessingEditPayment(false);
        }
      },
      prefill: {
        name: user.displayName || 'DCAM Teacher',
        email: user.email || '',
        contact: normalizedContact,
      },
      readonly: { contact: false, email: false, name: false },
      notes: {
        source: 'teacher_question_purchase_edit',
        userId: user.uid,
        teacherId: purchase.teacherId,
        sourcePurchaseId: purchase.id,
        examTypeId: purchase.examTypeId,
        classId: purchase.classId,
        subjectId: purchase.subjectId,
        nextQuestionCount: String(context.pricing.totalQuestionCount),
        nextStudentsCount: String(context.request.studentsCount),
        nextDaysCount: String(context.request.daysCount),
      },
      theme: { color: '#22c55e' },
      modal: {
        ondismiss: () => {
          toast({
            variant: 'destructive',
            title: 'Payment cancelled',
            description: 'You closed Razorpay before completing the payment.',
          });
          setIsProcessingEditPayment(false);
        },
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  return (
    <div className="flex h-full flex-col">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <DashboardHeader title="Your Purchases" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-card/60 p-5 md:flex-row md:items-center md:justify-between">
            <p className="max-w-3xl text-sm text-muted-foreground">
              Review your subject-wise question access and edit active purchases when you need more students, days, or questions.
            </p>
            <Button asChild variant="outline" className="rounded-full border-white/10 bg-transparent px-5">
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-[24px] border border-white/10 bg-card/70"><CardContent className="p-5"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Active access</p><p className="mt-2 text-2xl font-semibold text-slate-50">{summary.activePurchases}</p></CardContent></Card>
            <Card className="rounded-[24px] border border-white/10 bg-card/70"><CardContent className="p-5"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Questions bought</p><p className="mt-2 text-2xl font-semibold text-slate-50">{summary.totalQuestions}</p></CardContent></Card>
            <Card className="rounded-[24px] border border-white/10 bg-card/70"><CardContent className="p-5"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total value</p><p className="mt-2 text-2xl font-semibold text-slate-50">{formatRupeeAmount(summary.totalSpent)}</p></CardContent></Card>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : purchaseRows.length === 0 ? (
            <Card className="rounded-[28px] border border-dashed border-white/15 bg-card/40">
              <CardHeader>
                <CardTitle>No purchases yet</CardTitle>
                <CardDescription>
                  When you complete a premium question purchase or receive assigned premium question access, it will appear here with the scope, counts, price, and validity.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-6">
              {groupedPurchases.map((group) => (
                <Card key={group.key} className="rounded-[30px] border border-white/10 bg-card/55">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl">{group.examTypeName} / {group.className}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {group.purchases.map((purchase) => {
                      const scopeLabel = buildTeacherQuestionPurchaseScopeLabel(purchase);
                      const scopeDetail = buildTeacherQuestionPurchaseScopeDetail(purchase);
                      const isActive = isTeacherQuestionPurchaseActiveAt(purchase);
                      const displayedPurchaseAmount = getDisplayedPurchaseAmount(purchase);
                      const resolvedAccessEndsAt = getTeacherQuestionPurchaseResolvedAccessEndsAt(purchase);
                      const resolvedDaysCount = getTeacherQuestionPurchaseResolvedDaysCount(purchase);

                      return (
                        <div key={purchase.id} className="rounded-[28px] border border-white/10 bg-slate-950/35 p-6">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={isActive ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-100'}>{isActive ? 'Active access' : 'Expired'}</Badge>
                                {purchase.assignmentSource ? <Badge variant="outline" className="border-cyan-300/30 bg-cyan-500/10 text-cyan-100">Admin base included</Badge> : null}
                              </div>
                              <p className="text-2xl font-semibold text-slate-50">{purchase.subjectName || scopeLabel || 'Purchased question scope'}</p>
                              <p className="text-sm text-muted-foreground">{scopeDetail || 'All topics'}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 lg:min-w-[180px]">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Valid till</p>
                              <p className="mt-2 text-sm font-medium text-slate-50">{formatDateOnly(resolvedAccessEndsAt)}</p>
                            </div>
                          </div>
                          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total questions</p><p className="mt-2 text-2xl font-semibold text-slate-50">{purchase.totalQuestionCount}</p></div>
                            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Students</p><p className="mt-2 text-2xl font-semibold text-slate-50">{purchase.studentsCount}</p></div>
                            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Days</p><p className="mt-2 text-2xl font-semibold text-slate-50">{resolvedDaysCount}</p></div>
                            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4"><p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Paid</p><p className="mt-2 text-2xl font-semibold text-slate-50">{formatRupeeAmount(displayedPurchaseAmount)}</p></div>
                          </div>
                          <div className="mt-5 flex flex-wrap gap-3">
                            <Button type="button" variant="outline" className="rounded-full border-white/10 bg-transparent px-5" onClick={() => setSelectedPurchaseForEdit(purchase)}>Edit Purchase</Button>
                            {!isActive ? (
                              <Button asChild className="rounded-full px-5 font-semibold">
                                <Link href={buildTeacherQuestionPurchaseFormHref(buildTeacherQuestionPurchaseRenewParams(purchase))}>Renew Same Scope</Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}

              <Card className="rounded-[28px] border border-white/10 bg-card/55">
                <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-50">Need another exam, curriculum, or subject?</p>
                    <p className="mt-1 text-sm text-muted-foreground">Buy another scope separately from your existing purchases.</p>
                  </div>
                  <Button asChild className="rounded-full px-5 font-semibold">
                    <Link href="/teacher/premium-questions">Buy Another Scope</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      <Dialog open={!!selectedPurchaseForEdit} onOpenChange={(open) => (!open ? closeEditDialog() : null)}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-7xl flex-col overflow-hidden border-white/10 bg-slate-950 p-0 text-slate-50">
          <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5">
            <DialogTitle className="text-2xl">{isTeacherQuestionPurchaseActiveAt(selectedPurchaseForEdit || undefined) ? 'Edit Purchase' : 'Renew And Edit Purchase'}</DialogTitle>
            <DialogDescription className="text-slate-300">
              {selectedPurchaseForEdit ? `Increase students, days, or paid question counts inside ${buildTeacherQuestionPurchaseScopeLabel(selectedPurchaseForEdit) || 'this scope'}. Scope stays locked to this purchase.` : 'Select a purchase to continue.'}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            {selectedPurchaseForEdit ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="border-white/10 bg-slate-900/70"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Current questions</p><p className="mt-2 text-2xl font-semibold text-white">{selectedPurchaseForEdit.totalQuestionCount}</p></CardContent></Card>
                  <Card className="border-white/10 bg-slate-900/70"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Current students</p><p className="mt-2 text-2xl font-semibold text-white">{selectedPurchaseForEdit.studentsCount}</p></CardContent></Card>
                  <Card className="border-white/10 bg-slate-900/70"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Current days</p><p className="mt-2 text-2xl font-semibold text-white">{selectedPurchaseResolvedDaysCount}</p></CardContent></Card>
                  <Card className="border-white/10 bg-slate-900/70"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Covered value now</p><p className="mt-2 text-2xl font-semibold text-white">{formatRupeeAmount(isTeacherQuestionPurchaseActiveAt(selectedPurchaseForEdit) ? getTeacherQuestionPurchaseCurrentCoverageAmount(selectedPurchaseForEdit) : 0)}</p></CardContent></Card>
                </div>

                <TeacherDashboardPremiumQuestionHub
                  key={`${selectedPurchaseForEdit.id}_${selectedPurchaseForEdit.updatedAt || selectedPurchaseForEdit.accessEndsAt || ''}`}
                  purchaseLedgerUserId={user?.uid}
                  disableUrlPrefill
                  prefillPayloadOverride={selectedPurchaseEditPrefillPayload}
                  lockScopeSelection
                  primaryActionLabel="Pay And Save Changes"
                  primaryActionHelperText="Increase question counts, students, or days for this purchase. You will only pay the extra amount needed to update this same purchase card."
                  onPrimaryAction={handleTeacherPurchaseEdit}
                  isPrimaryActionBusy={isProcessingEditPayment}
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
