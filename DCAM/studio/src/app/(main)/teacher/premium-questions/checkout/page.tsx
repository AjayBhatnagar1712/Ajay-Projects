'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CreditCard, LoaderCircle } from 'lucide-react';
import { collection, limit, query, where } from 'firebase/firestore';

import DashboardHeader from '@/components/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { completeVerifiedPayment, createRazorpayOrder } from '@/app/actions';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { sendSelfBellNotification } from '@/lib/client-notifications';
import { resolveScopedDifficultyPricing, type ScopedDifficultyPricingMap } from '@/lib/premium-pricing';
import { ALLOWED_TEACHER_AUTHOR_EMAIL } from '@/lib/teacher-authoring';
import {
  buildTeacherQuestionPurchaseScopeDetail,
  buildTeacherQuestionPurchaseScopeLabel,
  computeTeacherQuestionAccessEndDate,
  computeTeacherQuestionDailyRateAmount,
  computeTeacherQuestionTotalAmount,
  formatRupeeAmount,
  hasTeacherQuestionPurchaseSelection,
  parseTeacherQuestionPurchaseCheckoutPayload,
  syncTeacherQuestionPurchasePublicScopes,
  sumDifficultyCounts,
  type TeacherQuestionPurchaseDoc,
} from '@/lib/teacher-question-purchase';

type PricingOwnerProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  dcamTeacherQuestionPricingByScope?: ScopedDifficultyPricingMap;
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

const normalizeRazorpayContact = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits.length >= 10 ? digits.slice(-10) : '';
};

const buildOwnerName = (owner?: PricingOwnerProfile | null) =>
  `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() || owner?.displayName || 'DCAM Question Bank';

const formatDifficultyLine = (label: string, counts: Record<'Easy' | 'Medium' | 'Hard', number>) =>
  `${label}: Easy ${counts.Easy} • Medium ${counts.Medium} • Hard ${counts.Hard}`;

export default function TeacherPremiumQuestionsCheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const payload = useMemo(
    () => parseTeacherQuestionPurchaseCheckoutPayload(searchParams),
    [searchParams]
  );

  const ownerQuery = useMemoFirebase(
    () => (
      firestore
        ? query(collection(firestore, 'users'), where('email', '==', ALLOWED_TEACHER_AUTHOR_EMAIL), limit(1))
        : null
    ),
    [firestore]
  );
  const { data: ownerRows, isLoading: isOwnerLoading } = useCollection<PricingOwnerProfile>(ownerQuery);
  const owner = (ownerRows || [])[0] || null;

  const teacherStandardPricing = useMemo(
    () => resolveScopedDifficultyPricing({
      scopedPricingMap: owner?.dcamTeacherQuestionPricingByScope,
      examTypeId: payload?.examTypeId,
      classId: payload?.classId,
      subjectId: payload?.subjectId,
      questionSource: 'standard',
    }),
    [owner?.dcamTeacherQuestionPricingByScope, payload?.classId, payload?.examTypeId, payload?.subjectId]
  );
  const teacherPyqPricing = useMemo(
    () => resolveScopedDifficultyPricing({
      scopedPricingMap: owner?.dcamTeacherQuestionPricingByScope,
      examTypeId: payload?.examTypeId,
      classId: payload?.classId,
      subjectId: payload?.subjectId,
      questionSource: 'pyq',
    }),
    [owner?.dcamTeacherQuestionPricingByScope, payload?.classId, payload?.examTypeId, payload?.subjectId]
  );

  const dailyRateAmount = useMemo(
    () => payload
      ? computeTeacherQuestionDailyRateAmount({
          regularCounts: payload.regularCounts,
          pyqCounts: payload.pyqCounts,
          regularPricing: teacherStandardPricing,
          pyqPricing: teacherPyqPricing,
        })
      : 0,
    [payload, teacherPyqPricing, teacherStandardPricing]
  );
  const totalAmount = useMemo(
    () => payload
      ? computeTeacherQuestionTotalAmount({
          dailyRateAmount,
          studentsCount: payload.studentsCount,
          daysCount: payload.daysCount,
        })
      : 0,
    [dailyRateAmount, payload]
  );
  const totalRegularQuestions = useMemo(
    () => (payload ? sumDifficultyCounts(payload.regularCounts) : 0),
    [payload]
  );
  const totalPyqQuestions = useMemo(
    () => (payload ? sumDifficultyCounts(payload.pyqCounts) : 0),
    [payload]
  );
  const totalQuestions = totalRegularQuestions + totalPyqQuestions;
  const scopeLabel = payload ? buildTeacherQuestionPurchaseScopeLabel(payload) : '';
  const scopeDetail = payload ? buildTeacherQuestionPurchaseScopeDetail(payload) : '';
  const canPay = Boolean(
    payload
    && owner?.id
    && hasTeacherQuestionPurchaseSelection(payload)
    && totalAmount > 0
  );

  const handlePayNow = async () => {
    if (!payload || !owner?.id || !user) {
      toast({
        variant: 'destructive',
        title: 'Checkout is not ready',
        description: 'Reload the page and try again.',
      });
      return;
    }
    if (!canPay) {
      toast({
        variant: 'destructive',
        title: 'Nothing to purchase yet',
        description: 'Select at least one paid question pack with a valid price before continuing.',
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
    setIsProcessingPayment(true);

    const orderResult = await createRazorpayOrder(totalAmount, 'INR');
    if (orderResult.error || !orderResult.orderId) {
      toast({
        variant: 'destructive',
        title: 'Payment initialization failed',
        description: orderResult.error || 'Could not create the payment order.',
      });
      setIsProcessingPayment(false);
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      name: 'DCAM Classes',
      description: `Teacher question purchase: ${scopeLabel || 'Selected scope'}`,
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
          setIsProcessingPayment(false);
          return;
        }

        const paidAt = new Date().toISOString();
        const accessEndsAt = computeTeacherQuestionAccessEndDate(paidAt, payload.daysCount);
        const teacherName = buildOwnerName(owner);
        const buyerName = user.displayName || user.email || 'Teacher';
        const purchaseDoc: TeacherQuestionPurchaseDoc = {
          ...payload,
          id: paymentId,
          status: 'paid',
          buyerId: user.uid,
          buyerName,
          buyerEmail: user.email || '',
          teacherId: owner.id,
          teacherName,
          dailyRateAmount,
          totalAmountPaid: totalAmount,
          grossAmount: totalAmount,
          currency: 'INR',
          totalQuestionCount: totalQuestions,
          totalRegularQuestionCount: totalRegularQuestions,
          totalPyqQuestionCount: totalPyqQuestions,
          currentCoverageAmount: totalAmount,
          regularDailyRateByDifficulty: teacherStandardPricing,
          pyqDailyRateByDifficulty: teacherPyqPricing,
          purchasedAt: paidAt,
          updatedAt: paidAt,
          accessStartsAt: paidAt,
          accessEndsAt,
          razorpayOrderId: String(response.razorpay_order_id || '').trim(),
          razorpayPaymentId: paymentId,
        };

        try {
          const idToken = await user.getIdToken(true);
          const completionResult = await completeVerifiedPayment({
            idToken,
            orderId: razorpayOrderId,
            paymentId,
            signature: razorpaySignature,
            grossAmount: totalAmount,
            currency: 'INR',
            paymentData: {
              id: paymentId,
              type: 'teacher_question_purchase',
              status: 'paid',
              userId: user.uid,
              userEmail: user.email || '',
              teacherId: owner.id,
              teacherName,
              linkedContentType: 'teacher_question_purchase',
              linkedContentId: `${payload.examTypeId}__${payload.classId}__${payload.subjectId}`,
              grossAmount: totalAmount,
              currency: 'INR',
              razorpayOrderId: String(response.razorpay_order_id || '').trim(),
              razorpayPaymentId: paymentId,
              purchasedAt: paidAt,
              examTypeId: payload.examTypeId,
              examTypeName: payload.examTypeName,
              classId: payload.classId,
              className: payload.className,
              subjectId: payload.subjectId,
              subjectName: payload.subjectName,
              topicId: payload.topicId || '',
              topicName: payload.topicName || '',
              subtopicPath: payload.subtopicPath || '',
              subtopicLabel: payload.subtopicLabel || '',
              regularCounts: payload.regularCounts,
              pyqCounts: payload.pyqCounts,
              studentsCount: payload.studentsCount,
              daysCount: payload.daysCount,
              dailyRateAmount,
              totalQuestionCount: totalQuestions,
            },
            writes: [
              {
                path: `users/${user.uid}/teacher_question_purchases/${paymentId}`,
                merge: true,
                data: purchaseDoc,
              },
            ],
            revenueSplit: {
              teacherId: owner.id,
              linkedContentType: 'teacher_question_purchase',
              linkedContentId: `${payload.examTypeId}__${payload.classId}__${payload.subjectId}`,
              saleType: 'teacher_question_purchase',
              purchasedAt: paidAt,
              userEmail: user.email || '',
              studentName: buyerName,
              studentEmail: user.email || '',
              metadata: {
                examTypeId: payload.examTypeId,
                examTypeName: payload.examTypeName,
                classId: payload.classId,
                className: payload.className,
                subjectId: payload.subjectId,
                subjectName: payload.subjectName,
                topicId: payload.topicId || '',
                topicName: payload.topicName || '',
                subtopicPath: payload.subtopicPath || '',
                subtopicLabel: payload.subtopicLabel || '',
                studentsCount: payload.studentsCount,
                daysCount: payload.daysCount,
                totalQuestionCount: totalQuestions,
                totalRegularQuestionCount: totalRegularQuestions,
                totalPyqQuestionCount: totalPyqQuestions,
              },
            },
          });
          if (!completionResult.success) {
            throw new Error(completionResult.error || 'Could not complete the verified payment.');
          }

          await syncTeacherQuestionPurchasePublicScopes(firestore, user.uid);

          await sendSelfBellNotification(user, {
            title: 'Question purchase successful',
            message: `${scopeLabel || 'Your selected question scope'} is now available in Your Purchases.`,
            href: '/teacher/question-purchases',
            notificationType: 'teacher_question_purchase_success',
            dedupeKey: `teacher-question-purchase:${paymentId}`,
            contentType: 'teacher_question_purchase',
            contentId: paymentId,
            teacherId: owner.id,
            metadata: {
              purchaseId: paymentId,
              totalAmountPaid: totalAmount,
              totalQuestionCount: totalQuestions,
            },
          });

          toast({
            title: 'Purchase successful',
            description: 'Your premium question purchase has been completed successfully.',
          });
          router.replace(`/teacher/question-purchases?status=success&purchaseId=${encodeURIComponent(paymentId)}`);
        } catch (error: any) {
          toast({
            variant: 'destructive',
            title: 'Payment recorded but purchase save failed',
            description: error?.message || 'Please contact support with your payment reference.',
          });
        } finally {
          setIsProcessingPayment(false);
        }
      },
      prefill: {
        name: user.displayName || 'DCAM Teacher',
        email: user.email || '',
        contact: normalizedContact,
      },
      readonly: {
        contact: false,
        email: false,
        name: false,
      },
      notes: {
        source: 'teacher_question_purchase',
        userId: user.uid,
        teacherId: owner.id,
        examTypeId: payload.examTypeId,
        classId: payload.classId,
        subjectId: payload.subjectId,
        topicId: payload.topicId || '',
        totalQuestionCount: String(totalQuestions),
        studentsCount: String(payload.studentsCount),
        daysCount: String(payload.daysCount),
      },
      theme: {
        color: '#22c55e',
      },
      modal: {
        ondismiss: () => {
          toast({
            variant: 'destructive',
            title: 'Payment cancelled',
            description: 'You closed Razorpay before completing the payment.',
          });
          setIsProcessingPayment(false);
        },
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  const loading = isOwnerLoading;

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Question Checkout" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-card/60 p-5 md:flex-row md:items-center md:justify-between">
            <p className="max-w-3xl text-sm text-muted-foreground">
              Review the purchase details once, then continue to Razorpay to complete payment.
            </p>
            <Button asChild variant="outline" className="rounded-full border-white/10 bg-transparent px-5">
              <Link href="/teacher/premium-questions">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Premium Questions
              </Link>
            </Button>
          </div>

          {!payload ? (
            <Card className="rounded-[28px] border border-destructive/40 bg-destructive/5">
              <CardHeader>
                <CardTitle>Checkout details are missing</CardTitle>
                <CardDescription>
                  Return to the premium questions page, choose the question counts you want, and then continue to checkout again.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : loading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : (
            <>
              <Card className="rounded-[28px] border border-white/10 bg-card/70">
                <CardHeader className="pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-2xl">{scopeLabel || 'Selected question scope'}</CardTitle>
                      <CardDescription>
                        {scopeDetail || 'All topics'}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={canPay
                        ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100'
                        : 'border-white/10 bg-white/5 text-slate-100'}
                    >
                      {canPay ? 'Ready for payment' : 'Checkout unavailable'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Questions</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-50">{totalQuestions}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Students</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-50">{payload.studentsCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Days</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-50">{payload.daysCount}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Total payable</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-50">{formatRupeeAmount(totalAmount)}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <Card className="rounded-[28px] border border-white/10 bg-card/70">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Checkout summary</CardTitle>
                    <CardDescription>
                      This amount is recalculated using the current teacher pricing for the selected scope.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                      <p className="text-sm font-semibold text-slate-50">Question request</p>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <p>{formatDifficultyLine('Regular', payload.regularCounts)}</p>
                        <p>{formatDifficultyLine('PYQ', payload.pyqCounts)}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                      <p className="text-sm font-semibold text-slate-50">Daily pricing applied</p>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <p>{formatDifficultyLine('Regular', {
                          Easy: teacherStandardPricing.easy,
                          Medium: teacherStandardPricing.medium,
                          Hard: teacherStandardPricing.hard,
                        } as Record<'Easy' | 'Medium' | 'Hard', number>)}</p>
                        <p>{formatDifficultyLine('PYQ', {
                          Easy: teacherPyqPricing.easy,
                          Medium: teacherPyqPricing.medium,
                          Hard: teacherPyqPricing.hard,
                        } as Record<'Easy' | 'Medium' | 'Hard', number>)}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                      <p className="text-sm font-semibold text-slate-50">Calculation</p>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <p>Daily rate for this request: {formatRupeeAmount(dailyRateAmount)}</p>
                        <p>{payload.studentsCount} students × {payload.daysCount} days</p>
                        <p className="font-medium text-slate-100">Estimated total: {formatRupeeAmount(totalAmount)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border border-white/10 bg-card/70">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Pay now</CardTitle>
                    <CardDescription>
                      Complete payment in Razorpay. After success, the purchase will appear in Your Purchases automatically.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Question bank</p>
                      <p className="mt-2 text-base font-semibold text-slate-50">{buildOwnerName(owner)}</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Amount</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-50">{formatRupeeAmount(totalAmount)}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {formatRupeeAmount(dailyRateAmount)} per day for this full request.
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={() => {
                        void handlePayNow();
                      }}
                      disabled={!canPay || isProcessingPayment}
                      className="h-12 w-full rounded-full text-base font-semibold"
                    >
                      {isProcessingPayment ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Opening Razorpay...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Pay with Razorpay
                        </>
                      )}
                    </Button>

                    {!canPay ? (
                      <p className="text-sm text-muted-foreground">
                        Add a valid paid question request before continuing to payment.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
    </div>
  );
}
