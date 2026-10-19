'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { CreditCard, IndianRupee, LoaderCircle, Minus, PencilLine, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { add } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import Script from 'next/script';
import { completeVerifiedPayment, createRazorpayOrder } from '@/app/actions';
import { cn } from '@/lib/utils';
import { sendSelfBellNotification } from '@/lib/client-notifications';
import {
  normalizeCouponCode,
  resolveCourseBasePrice,
  resolveCourseCouponByCode,
  resolveCourseCoupons,
  type CourseCoupon,
} from '@/lib/course-plan-pricing';

// --- Types ---
type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  billingInterval: 'monthly' | 'yearly';
  paymentType?: 'one_time' | 'subscription';
  createdByTeacherId?: string;
  linkedContentType?: 'course' | 'mock_test' | 'live_batch';
  linkedContentId?: string;
  numberOfLiveClasses?: number;
  totalSessions?: number;
  sessionFee?: number;
  oneTimePrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  couponCode?: string | null;
  courseCoupons?: CourseCoupon[];
};

type MockTestMeta = {
  title?: string;
  isCourseOnly?: boolean;
  courseId?: string;
  teacherId?: string;
};

type LiveBatchMeta = {
  title?: string;
  teacherId?: string;
  teacherName?: string;
  totalSessions?: number;
};

type CourseMeta = {
  title?: string;
  teacherId?: string;
  teacherName?: string;
};

type LiveBatchSessionPurchaseHistoryItem = {
  purchasedAt?: string;
  sessionsPurchased?: number;
  sessionFee?: number;
  amountPaid?: number;
  paymentId?: string;
  planId?: string;
};

type EnrolledLiveBatchRecord = {
  sessionPurchaseHistory?: LiveBatchSessionPurchaseHistoryItem[];
  sessionsPurchased?: number;
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

// --- Main Page Component ---
export default function CheckoutPage() {
  const { planId } = useParams() as { planId: string };
  const searchParams = useSearchParams();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [courseCouponInput, setCourseCouponInput] = useState('');
  const [appliedCourseCouponCode, setAppliedCourseCouponCode] = useState('');
  const rawRequestedSessionsParam = searchParams.get('sessions');
  const hasRequestedSessionsParam = typeof rawRequestedSessionsParam === 'string' && rawRequestedSessionsParam.trim().length > 0;

  const initialRequestedSessions = useMemo(() => {
    const raw = Number(rawRequestedSessionsParam || 1);
    if (!Number.isFinite(raw)) return 1;
    return Math.max(1, Math.floor(raw));
  }, [rawRequestedSessionsParam]);
  const [requestedSessions, setRequestedSessions] = useState<number>(initialRequestedSessions);

  useEffect(() => {
    setIsEditingOrder(false);
    setCourseCouponInput('');
    setAppliedCourseCouponCode('');
  }, [planId, rawRequestedSessionsParam]);

  const planDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'subscription_plans', planId);
  }, [firestore, planId]);

  const { data: plan, isLoading: isPlanLoading } = useDoc<SubscriptionPlan>(planDocRef);

  const linkedLiveBatchRef = useMemoFirebase(() => {
    if (!firestore || !plan || plan.linkedContentType !== 'live_batch' || !plan.linkedContentId) return null;
    return doc(firestore, 'live_batches', plan.linkedContentId);
  }, [firestore, plan]);

  const linkedMockTestRef = useMemoFirebase(() => {
    if (!firestore || !plan || plan.linkedContentType !== 'mock_test' || !plan.linkedContentId) return null;
    return doc(firestore, 'mock_tests', plan.linkedContentId);
  }, [firestore, plan]);
  const linkedCourseRef = useMemoFirebase(() => {
    if (!firestore || !plan || plan.linkedContentType !== 'course' || !plan.linkedContentId) return null;
    return doc(firestore, 'courses', plan.linkedContentId);
  }, [firestore, plan]);

  const { data: linkedLiveBatch, isLoading: isLinkedLiveBatchLoading } = useDoc<LiveBatchMeta>(linkedLiveBatchRef);
  const { data: linkedMockTest, isLoading: isLinkedMockTestLoading } = useDoc<MockTestMeta>(linkedMockTestRef);
  const { data: linkedCourse, isLoading: isLinkedCourseLoading } = useDoc<CourseMeta>(linkedCourseRef);

  const isLiveBatchPlan = plan?.linkedContentType === 'live_batch';
  const isCoursePlan = plan?.linkedContentType === 'course';
  const isInvalidStandaloneMockTestPlan =
    plan?.linkedContentType === 'mock_test' &&
    !!linkedMockTest &&
    (linkedMockTest.isCourseOnly === true || !!(linkedMockTest.courseId && linkedMockTest.courseId.trim().length > 0));

  const resolvedPerSessionFee = Math.max(
    0,
    Number(plan?.sessionFee ?? plan?.price ?? 0)
  );

  const resolvedTotalSessions = Math.max(
    0,
    Number(plan?.totalSessions ?? plan?.numberOfLiveClasses ?? linkedLiveBatch?.totalSessions ?? 0)
  );

  const requestedSessionsNormalized = Math.max(1, Math.floor(Number(requestedSessions || 1)));
  const isPrefilledLiveBatchCheckout = Boolean(isLiveBatchPlan && hasRequestedSessionsParam);
  const maxSelectableSessions = Math.max(1, resolvedTotalSessions || 1);

  const invalidSessionInputMessage = useMemo(() => {
    if (!isLiveBatchPlan) return '';
    if (resolvedTotalSessions <= 0) {
      return 'This batch does not have total sessions configured yet. Ask the teacher to update session settings first.';
    }
    if (requestedSessionsNormalized > resolvedTotalSessions) {
      return `You selected ${requestedSessionsNormalized} sessions, but this batch has only ${resolvedTotalSessions} total sessions. Please choose ${resolvedTotalSessions} or fewer.`;
    }
    return '';
  }, [isLiveBatchPlan, requestedSessionsNormalized, resolvedTotalSessions]);

  const payableAmount = isLiveBatchPlan
    ? Number((resolvedPerSessionFee * requestedSessionsNormalized).toFixed(2))
    : isCoursePlan
      ? Number((resolveCourseCouponByCode(plan, appliedCourseCouponCode)?.finalPrice ?? resolveCourseBasePrice(plan)).toFixed(2))
      : Number(plan?.price ?? 0);
  const baseCoursePrice = isCoursePlan ? resolveCourseBasePrice(plan) : 0;
  const availableCourseCoupons = isCoursePlan ? resolveCourseCoupons(plan) : [];
  const appliedCourseCoupon = isCoursePlan ? resolveCourseCouponByCode(plan, appliedCourseCouponCode) : null;
  const courseDiscountAmount = appliedCourseCoupon?.discountAmount ?? 0;

  useEffect(() => {
    setRequestedSessions(initialRequestedSessions);
  }, [initialRequestedSessions]);

  const updateRequestedSessions = (nextValue: number) => {
    if (!Number.isFinite(nextValue)) {
      setRequestedSessions(1);
      return;
    }
    const normalized = Math.max(1, Math.min(Math.floor(nextValue), maxSelectableSessions));
    setRequestedSessions(normalized);
  };

  const adjustRequestedSessions = (delta: number) => {
    setIsEditingOrder(true);
    updateRequestedSessions(requestedSessionsNormalized + delta);
  };

  const startEditingOrder = () => {
    setIsEditingOrder(true);
  };

  const stopEditingOrder = () => {
    setIsEditingOrder(false);
  };

  const applyCourseCoupon = () => {
    if (!isCoursePlan || !plan) return;

    const normalizedCode = normalizeCouponCode(courseCouponInput);
    if (!normalizedCode) {
      toast({ variant: 'destructive', title: 'Enter coupon code', description: 'Type a valid coupon code before applying it.' });
      return;
    }

    const matchedCoupon = resolveCourseCouponByCode(plan, normalizedCode);
    if (!matchedCoupon) {
      toast({ variant: 'destructive', title: 'Coupon not found', description: 'This coupon code is invalid for the selected course.' });
      return;
    }

    setAppliedCourseCouponCode(normalizedCode);
    setCourseCouponInput(normalizedCode);
    toast({
      title: 'Coupon applied',
      description: `${matchedCoupon.code} applied. Student saves INR ${matchedCoupon.discountAmount.toLocaleString()}.`,
    });
  };

  const clearCourseCoupon = () => {
    setAppliedCourseCouponCode('');
    setCourseCouponInput('');
  };

  const initializePayment = async () => {
    if (!plan || !user || !firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Plan or user not found.' });
      return;
    }

    const selectedSessions = requestedSessionsNormalized;
    if (isLiveBatchPlan) {
      if (resolvedPerSessionFee <= 0) {
        toast({
          variant: 'destructive',
          title: 'Session fee missing',
          description: 'This live batch does not have a valid per-session fee yet.',
        });
        return;
      }
      if (resolvedTotalSessions <= 0) {
        toast({
          variant: 'destructive',
          title: 'Sessions not configured',
          description: 'This live batch does not have total sessions configured yet.',
        });
        return;
      }
      if (selectedSessions > resolvedTotalSessions) {
        toast({
          variant: 'destructive',
          title: 'Invalid session count',
          description: `You requested ${selectedSessions} sessions, but only ${resolvedTotalSessions} sessions are available in this batch.`,
        });
        return;
      }
    }

    const amountToCharge = Number(payableAmount || 0);
    if (!Number.isFinite(amountToCharge) || amountToCharge <= 0) {
      toast({ variant: 'destructive', title: 'Invalid amount', description: 'Payment amount must be greater than zero.' });
      return;
    }
    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      toast({ variant: 'destructive', title: 'Razorpay not configured', description: 'Payment gateway key is missing for this app.' });
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

    setIsProcessing(true);

    // 1. Create order on server.
    const orderResult = await createRazorpayOrder(amountToCharge);
    if (orderResult.error || !orderResult.orderId) {
      toast({ variant: 'destructive', title: 'Payment Error', description: orderResult.error || 'Could not create a payment order.' });
      setIsProcessing(false);
      return;
    }

    // 2. Open Razorpay checkout.
    let checkoutOutcome: 'pending' | 'failed' | 'success' = 'pending';
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: Math.round(amountToCharge * 100),
      currency: 'INR',
      name: 'DCAM Classes',
      description: isLiveBatchPlan
        ? `Live Batch Sessions: ${selectedSessions} x INR ${resolvedPerSessionFee}`
        : isCoursePlan && appliedCourseCoupon
          ? `Course Purchase: ${plan.name} (${appliedCourseCoupon.code})`
          : `Subscription: ${plan.name}`,
      order_id: orderResult.orderId,
      handler: async function (response: any) {
        checkoutOutcome = 'success';
        try {
          const paymentId = String(response.razorpay_payment_id || '').trim();
          const razorpayOrderId = String(response.razorpay_order_id || '').trim();
          const razorpaySignature = String(response.razorpay_signature || '').trim();
          if (!paymentId || !razorpayOrderId || !razorpaySignature) {
            throw new Error('Payment response is missing verification details.');
          }

          const now = new Date();
          const endDate = plan.billingInterval === 'monthly' ? add(now, { months: 1 }) : add(now, { years: 1 });
          const purchasedAt = now.toISOString();
          const verifiedWrites: Array<{ path: string; merge: boolean; data: Record<string, unknown> }> = [
            {
              path: `users/${user.uid}/subscriptions/main`,
              merge: true,
              data: {
                id: 'main',
                planId,
                status: 'active',
                currentPeriodStart: purchasedAt,
                currentPeriodEnd: endDate.toISOString(),
              },
            },
          ];

          if (plan.linkedContentType === 'course' && plan.linkedContentId) {
            verifiedWrites.push({
              path: `users/${user.uid}/purchased_courses/${plan.linkedContentId}`,
              merge: true,
              data: {
                id: plan.linkedContentId,
                courseId: plan.linkedContentId,
                planId: plan.id,
                teacherId: linkedCourse?.teacherId || '',
                teacherName: linkedCourse?.teacherName || '',
                purchasedAt,
              },
            });
          }

          if (plan.linkedContentType === 'mock_test' && plan.linkedContentId) {
            verifiedWrites.push({
              path: `users/${user.uid}/purchased_mock_tests/${plan.linkedContentId}`,
              merge: true,
              data: {
                id: plan.linkedContentId,
                testId: plan.linkedContentId,
                planId: plan.id,
                teacherId: linkedMockTest?.teacherId || '',
                purchasedAt,
              },
            });
          }

          if (plan.linkedContentType === 'live_batch' && plan.linkedContentId) {
            const enrolledLiveBatchRef = doc(firestore, 'users', user.uid, 'enrolled_live_batches', plan.linkedContentId);
            const existingEnrollmentSnap = await getDoc(enrolledLiveBatchRef);
            const existingEnrollment = existingEnrollmentSnap.exists()
              ? (existingEnrollmentSnap.data() as EnrolledLiveBatchRecord)
              : null;
            const existingHistory = Array.isArray(existingEnrollment?.sessionPurchaseHistory)
              ? existingEnrollment.sessionPurchaseHistory
              : [];
            const filteredHistory = existingHistory.filter((entry) => entry?.paymentId !== response.razorpay_payment_id);
            const newHistoryEntry: LiveBatchSessionPurchaseHistoryItem = {
              purchasedAt,
              sessionsPurchased: selectedSessions,
              sessionFee: resolvedPerSessionFee,
              amountPaid: amountToCharge,
              paymentId,
              planId: plan.id,
            };
            const sessionPurchaseHistory = [...filteredHistory, newHistoryEntry];
            const totalPurchasedSessions = sessionPurchaseHistory.reduce(
              (sum, entry) => sum + Math.max(0, Number(entry?.sessionsPurchased || 0)),
              0
            );

            verifiedWrites.push({
              path: `users/${user.uid}/purchased_live_batches/${plan.linkedContentId}`,
              merge: true,
              data: {
                id: plan.linkedContentId,
                batchId: plan.linkedContentId,
                liveBatchId: plan.linkedContentId,
                planId: plan.id,
                teacherId: linkedLiveBatch?.teacherId || '',
                teacherName: linkedLiveBatch?.teacherName || '',
                purchasedAt,
                sessionsPurchased: totalPurchasedSessions,
                sessionFee: resolvedPerSessionFee,
                totalSessionsInBatch: resolvedTotalSessions,
                amountPaid: amountToCharge,
                sessionPurchaseHistory,
                latestPurchase: newHistoryEntry,
                adminAccessDisabled: false,
                adminAccessDisabledAt: null,
                adminDisabledReason: null,
              },
            });

            verifiedWrites.push({
              path: `users/${user.uid}/enrolled_live_batches/${plan.linkedContentId}`,
              merge: true,
              data: {
                id: plan.linkedContentId,
                batchId: plan.linkedContentId,
                title: linkedLiveBatch?.title || plan.name,
                teacherId: linkedLiveBatch?.teacherId || '',
                teacherName: linkedLiveBatch?.teacherName || '',
                accessLevel: 'paid',
                enrolledAt: purchasedAt,
                paidAt: purchasedAt,
                paymentPlanId: plan.id,
                hiddenFromMyBatch: false,
                hiddenFromMyBatchAt: null,
                adminAccessDisabled: false,
                adminAccessDisabledAt: null,
                adminDisabledReason: null,
                sessionsPurchased: totalPurchasedSessions,
                sessionFee: resolvedPerSessionFee,
                totalSessionsInBatch: resolvedTotalSessions,
                amountPaid: amountToCharge,
                sessionPurchaseHistory,
                latestPurchase: newHistoryEntry,
              },
            });
          }

          const teacherIdForRevenue = String(
            plan.createdByTeacherId ||
              linkedLiveBatch?.teacherId ||
              linkedMockTest?.teacherId ||
              linkedCourse?.teacherId ||
              ''
          ).trim();
          const idToken = await user.getIdToken(true);
          const completionResult = await completeVerifiedPayment({
            idToken,
            orderId: razorpayOrderId,
            paymentId,
            signature: razorpaySignature,
            grossAmount: amountToCharge,
            currency: 'INR',
            userProfileUpdates: {
              subscriptionStatus: 'active',
              subscriptionPlanId: planId,
            },
            paymentData: {
              id: paymentId,
              userId: user.uid,
              userEmail: user.email || '',
              planId: plan.id,
              planName: plan.name,
              linkedContentType: plan.linkedContentType || null,
              linkedContentId: plan.linkedContentId || null,
              grossAmount: amountToCharge,
              currency: 'INR',
              razorpayOrderId,
              razorpayPaymentId: paymentId,
              sessionCount: isLiveBatchPlan ? selectedSessions : null,
              sessionFee: isLiveBatchPlan ? resolvedPerSessionFee : null,
              totalSessionsInBatch: isLiveBatchPlan ? resolvedTotalSessions : null,
              couponCode: appliedCourseCoupon?.code || null,
              couponDiscountAmount: appliedCourseCoupon?.discountAmount ?? 0,
              baseCoursePrice: isCoursePlan ? baseCoursePrice : null,
              status: 'paid',
              purchasedAt,
            },
            writes: verifiedWrites,
            revenueSplit: {
              teacherId: teacherIdForRevenue || null,
              linkedContentType: plan.linkedContentType || 'course',
              linkedContentId: plan.linkedContentId || null,
              saleType: plan.linkedContentType || 'subscription_purchase',
              purchasedAt,
              userEmail: user.email || '',
              studentName: user.displayName || '',
              studentEmail: user.email || '',
              metadata: {
                planId: plan.id,
                planName: plan.name,
                billingInterval: plan.billingInterval,
                sessionCount: isLiveBatchPlan ? selectedSessions : null,
                sessionFee: isLiveBatchPlan ? resolvedPerSessionFee : null,
                couponCode: appliedCourseCoupon?.code || null,
                couponDiscountAmount: appliedCourseCoupon?.discountAmount ?? 0,
                baseCoursePrice: isCoursePlan ? baseCoursePrice : null,
              },
            },
          });
          if (!completionResult.success) {
            throw new Error(completionResult.error || 'Could not complete the verified payment.');
          }

          const purchasedContentId = String(plan.linkedContentId || '').trim();
          const purchasedContentType = String(plan.linkedContentType || '').trim();
          let successTitle = 'Congratulations on your purchase';
          let successMessage = `${plan.name} is now unlocked in your workspace.`;
          let successHref = '/dashboard';
          let successNotificationType = 'subscription_purchased';

          if (purchasedContentType === 'course' && purchasedContentId) {
            successTitle = 'Congratulations on your new course';
            successMessage = `${linkedCourse?.title || plan.name} is now available in My Learning.`;
            successHref = `/courses/${purchasedContentId}/dive-in`;
            successNotificationType = 'course_purchased';
          } else if (purchasedContentType === 'mock_test' && purchasedContentId) {
            successTitle = 'Congratulations on your mock test purchase';
            successMessage = `${linkedMockTest?.title || plan.name} is ready for your next attempt.`;
            successHref = `/mock-tests/${purchasedContentId}`;
            successNotificationType = 'mock_test_purchased';
          } else if (purchasedContentType === 'live_batch' && purchasedContentId) {
            successTitle = 'Congratulations on joining the live batch';
            successMessage = `${linkedLiveBatch?.title || plan.name} is now available in My Batch.`;
            successHref = `/live-batches/${purchasedContentId}`;
            successNotificationType = 'live_batch_purchased';
          }

          await sendSelfBellNotification(user, {
            title: successTitle,
            message: successMessage,
            href: successHref,
            notificationType: successNotificationType,
            dedupeKey: `checkout:${response.razorpay_payment_id}`,
            contentType: purchasedContentType || undefined,
            contentId: purchasedContentId || undefined,
            teacherId: teacherIdForRevenue || undefined,
            courseId: purchasedContentType === 'course' ? purchasedContentId : undefined,
            testId: purchasedContentType === 'mock_test' ? purchasedContentId : undefined,
            batchId: purchasedContentType === 'live_batch' ? purchasedContentId : undefined,
            liveBatchId: purchasedContentType === 'live_batch' ? purchasedContentId : undefined,
          });

          router.push(`/checkout/completion?status=success&plan=${plan.name}`);
        } catch (dbError: any) {
          toast({
            variant: 'destructive',
            title: 'Database Update Failed',
            description: `Payment was successful, but we failed to update your subscription. Please contact support. Error: ${dbError.message}`,
          });
          setIsProcessing(false);
          router.push('/checkout/completion?status=error');
        }
      },
      prefill: {
        name: user.displayName || 'DCAM User',
        email: user.email || '',
        contact: user.phoneNumber || '',
      },
      notes: {
        planId: plan.id,
        userId: user.uid,
        liveBatchSessions: isLiveBatchPlan ? String(selectedSessions) : '',
        courseCouponCode: appliedCourseCoupon?.code || '',
      },
      theme: {
        color: '#4338ca',
      },
      modal: {
        ondismiss: () => {
          if (checkoutOutcome !== 'pending') {
            if (checkoutOutcome === 'failed') {
              setIsProcessing(false);
            }
            return;
          }
          toast({
            title: 'Payment cancelled',
            description: 'You closed Razorpay before completing the transaction. No sessions were added.',
          });
          setIsProcessing(false);
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response: any) {
      checkoutOutcome = 'failed';
      toast({
        variant: 'destructive',
        title: 'Payment Failed',
        description: response?.error?.description || 'The transaction did not complete. No sessions were added.',
      });
      setIsProcessing(false);
    });

    rzp.open();
  };

  const renderContent = () => {
    if (isPlanLoading || isLinkedMockTestLoading || isLinkedCourseLoading || (isLiveBatchPlan && isLinkedLiveBatchLoading)) {
      return (
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <Skeleton className="h-20 w-48 rounded-full" />
          <Skeleton className="h-[440px] w-full rounded-[32px]" />
        </div>
      );
    }

    if (!plan) {
      return (
        <Card className="mx-auto w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Plan Not Found</CardTitle>
            <CardDescription>The subscription plan you selected could not be found.</CardDescription>
          </CardHeader>
        </Card>
      );
    }

    if (isInvalidStandaloneMockTestPlan) {
      return (
        <Card className="mx-auto w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Plan Unavailable</CardTitle>
            <CardDescription>
              This test is part of a course and cannot be purchased as a separate mock test.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

    if (isLiveBatchPlan && (resolvedPerSessionFee <= 0 || resolvedTotalSessions <= 0)) {
      return (
        <Card className="mx-auto w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Plan Unavailable</CardTitle>
            <CardDescription>
              This live batch plan is incomplete. The teacher must set both total sessions and per-session fee before checkout.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      return (
        <Card className="mx-auto w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-destructive">Razorpay Not Configured</CardTitle>
            <CardDescription>The application is missing the Razorpay Key ID. Please add it to your .env file.</CardDescription>
          </CardHeader>
        </Card>
      );
    }

    const isSessionSelectionInvalid = Boolean(invalidSessionInputMessage);
    const checkoutSubtitle = isLiveBatchPlan
      ? 'Live batch session purchase'
      : isCoursePlan
        ? 'One-time course purchase'
      : plan.paymentType === 'one_time'
        ? 'One-time payment'
        : plan.billingInterval === 'monthly'
          ? 'Billed monthly'
          : 'Billed yearly';
    const reviewMessage = isEditingOrder
      ? 'You are editing the order on this page. The total updates instantly before checkout.'
      : isCoursePlan
        ? 'Students can apply a valid teacher coupon here. Without a coupon, checkout uses the public course price.'
      : isPrefilledLiveBatchCheckout
        ? 'This order came from the classroom page. Checkout will start only after you click the button below.'
        : 'Review the order details and click Checkout when you are ready.';
    const paymentButtonLabel = isProcessing
      ? 'Opening checkout...'
      : 'Checkout';

    return (
      <div className="relative mx-auto w-full max-w-5xl">
        <div className="absolute inset-x-10 top-12 -z-10 h-48 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -left-10 top-32 -z-10 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
        <Card className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.97),rgba(17,24,39,0.96)_42%,rgba(8,47,73,0.92))] shadow-[0_40px_120px_-45px_rgba(8,145,178,0.45)]">
          <CardContent className="p-0">
            <div className="grid xl:grid-cols-[1.35fr_0.85fr]">
              <section className="p-6 md:p-8 lg:p-10">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-4">
                      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-100">
                        <Sparkles className="h-3.5 w-3.5" />
                        Secure Checkout
                      </div>
                      <div className="space-y-2">
                        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
                          {plan.name}
                        </h2>
                        <p className="text-base text-slate-300">{checkoutSubtitle}</p>
                        <p className="max-w-2xl text-sm leading-6 text-slate-400">
                          Review the order, adjust the session count if needed, and continue through secure checkout with instant verification.
                        </p>
                      </div>
                    </div>
                    <div className="min-w-[220px] rounded-[28px] border border-white/10 bg-white/5 px-5 py-4 text-right backdrop-blur-sm">
                      <p className="text-[11px] uppercase tracking-[0.32em] text-slate-400">Total Payable</p>
                      <p className="mt-3 flex items-center justify-end text-4xl font-semibold tracking-tight text-white">
                        <IndianRupee className="h-7 w-7" />
                        {Number(payableAmount || 0).toLocaleString()}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">Inclusive of the current order configuration</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                        {isLiveBatchPlan ? 'Per Session' : isCoursePlan ? 'Base Price' : 'Plan Price'}
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-white">
                        {isLiveBatchPlan
                          ? `INR ${resolvedPerSessionFee.toLocaleString()}`
                          : isCoursePlan
                            ? `INR ${baseCoursePrice.toLocaleString()}`
                            : `INR ${Number(plan.price || 0).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                        {isLiveBatchPlan ? 'Sessions in Batch' : isCoursePlan ? 'Coupon Status' : 'Billing Cycle'}
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-white">
                        {isLiveBatchPlan
                          ? resolvedTotalSessions
                          : isCoursePlan
                            ? appliedCourseCoupon?.code || 'None'
                            : plan.billingInterval === 'monthly'
                              ? 'Monthly'
                              : 'Yearly'}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Order Status</p>
                      <p className="mt-3 text-2xl font-semibold text-white">
                        {isLiveBatchPlan ? requestedSessionsNormalized : isCoursePlan ? 'Ready to unlock' : 'Ready'}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {isLiveBatchPlan ? 'Sessions selected right now' : isCoursePlan ? 'Coupon can still be applied below' : 'Payment details confirmed'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-slate-950/35 p-5 backdrop-blur-sm md:p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <p className="text-lg font-semibold text-white">Order configuration</p>
                        <p className="max-w-xl text-sm leading-6 text-slate-400">
                          {isLiveBatchPlan
                            ? 'This order can be adjusted here before payment. The total updates instantly as you change the session count.'
                            : isCoursePlan
                              ? 'The public course price is fixed here. Students can still apply a valid teacher coupon before payment.'
                              : 'Your plan details are locked and ready for payment.'}
                        </p>
                      </div>
                      {isLiveBatchPlan ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={isEditingOrder ? stopEditingOrder : startEditingOrder}
                          className="h-11 rounded-2xl border-white/15 bg-white/5 px-5 text-sm font-semibold text-slate-100 hover:bg-white/10 hover:text-white"
                        >
                          <PencilLine className="h-4 w-4" />
                          {isEditingOrder ? 'Done editing' : 'Edit order'}
                        </Button>
                      ) : null}
                    </div>

                    {isLiveBatchPlan ? (
                      <div className="mt-6 space-y-4">
                        {isPrefilledLiveBatchCheckout && !isEditingOrder ? (
                          <div className="rounded-[24px] border border-emerald-300/15 bg-[linear-gradient(145deg,rgba(16,185,129,0.08),rgba(8,47,73,0.18))] p-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                              <div className="flex gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
                                  <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div className="space-y-2">
                                  <p className="text-lg font-semibold text-white">Imported from classroom</p>
                                  <p className="max-w-xl text-sm leading-6 text-slate-300">
                                    Review the imported order here or edit the session count before continuing to checkout.
                                  </p>
                                </div>
                              </div>
                              <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100">
                                {isEditingOrder ? 'Editing' : 'Ready'}
                              </div>
                            </div>
                            <div className="mt-5 grid gap-3 md:grid-cols-3">
                              <div className="rounded-[20px] border border-white/10 bg-slate-950/40 p-4">
                                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Selected</p>
                                <p className="mt-3 text-3xl font-semibold text-white">{requestedSessionsNormalized}</p>
                              </div>
                              <div className="rounded-[20px] border border-white/10 bg-slate-950/40 p-4">
                                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Session Fee</p>
                                <p className="mt-3 text-3xl font-semibold text-white">INR {resolvedPerSessionFee.toLocaleString()}</p>
                              </div>
                              <div className="rounded-[20px] border border-white/10 bg-slate-950/40 p-4">
                                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Current Total</p>
                                <p className="mt-3 text-3xl font-semibold text-white">INR {payableAmount.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-sm font-semibold text-white">Select sessions</p>
                                  <p className="text-xs text-slate-400">One session means one completed live meeting.</p>
                                </div>
                                <div className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
                                  Max {resolvedTotalSessions}
                                </div>
                              </div>
                              <div className="mt-5 flex items-center gap-3">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  disabled={isProcessing || requestedSessionsNormalized <= 1}
                                  onClick={() => adjustRequestedSessions(-1)}
                                  className="h-12 w-12 rounded-2xl border-white/15 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <Input
                                  id="requested-sessions"
                                  type="number"
                                  min={1}
                                  max={resolvedTotalSessions}
                                  step={1}
                                  value={requestedSessionsNormalized}
                                  onChange={(event) => {
                                    setIsEditingOrder(true);
                                    updateRequestedSessions(Number(event.target.value));
                                  }}
                                  className="h-14 rounded-[20px] border-white/15 bg-slate-950/70 px-4 text-center text-2xl font-semibold tracking-tight text-white placeholder:text-slate-500 focus-visible:ring-cyan-300/60"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  disabled={isProcessing || requestedSessionsNormalized >= maxSelectableSessions}
                                  onClick={() => adjustRequestedSessions(1)}
                                  className="h-12 w-12 rounded-2xl border-white/15 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(8,47,73,0.72))] p-5">
                              <p className="text-sm font-semibold text-white">Live pricing preview</p>
                              <div className="mt-4 space-y-3 text-sm text-slate-300">
                                <div className="flex items-center justify-between">
                                  <span>Selected sessions</span>
                                  <span className="font-semibold text-white">{requestedSessionsNormalized}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Per session fee</span>
                                  <span className="font-semibold text-white">INR {resolvedPerSessionFee.toLocaleString()}</span>
                                </div>
                                <div className="h-px bg-white/10" />
                                <div className="flex items-center justify-between text-base">
                                  <span>Total payable</span>
                                  <span className="font-semibold text-emerald-300">INR {payableAmount.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {isSessionSelectionInvalid ? (
                          <div className="rounded-[20px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                            {invalidSessionInputMessage}
                          </div>
                        ) : (
                          <div className="rounded-[20px] border border-emerald-300/15 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-200">
                            Payable amount = {requestedSessionsNormalized} x INR {resolvedPerSessionFee.toLocaleString()} = INR {payableAmount.toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : isCoursePlan ? (
                      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-white">Apply teacher coupon</p>
                            <p className="text-xs leading-6 text-slate-400">
                              Enter the coupon code shared by the teacher. The course page keeps showing the public base price until a valid code is applied here.
                            </p>
                          </div>
                          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                            <Input
                              value={courseCouponInput}
                              onChange={(event) => setCourseCouponInput(event.target.value.toUpperCase())}
                              placeholder="Enter coupon code"
                              className="h-12 rounded-2xl border-white/15 bg-slate-950/70 px-4 text-base font-medium uppercase tracking-[0.12em] text-white placeholder:text-slate-500 focus-visible:ring-cyan-300/60"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={applyCourseCoupon}
                              className="h-12 rounded-2xl border-white/15 bg-white/5 px-5 text-sm font-semibold text-slate-100 hover:bg-white/10 hover:text-white"
                            >
                              Apply Coupon
                            </Button>
                          </div>
                          {appliedCourseCoupon ? (
                            <div className="mt-4 rounded-[20px] border border-emerald-300/20 bg-emerald-300/10 p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-emerald-100">{appliedCourseCoupon.code} applied</p>
                                  <p className="text-xs text-emerald-200/90">
                                    Student saves INR {appliedCourseCoupon.discountAmount.toLocaleString()} and pays INR {appliedCourseCoupon.finalPrice.toLocaleString()}.
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={clearCourseCoupon}
                                  className="h-10 justify-start px-0 text-emerald-100 hover:bg-transparent hover:text-white sm:justify-center sm:px-3"
                                >
                                  Remove Coupon
                                </Button>
                              </div>
                            </div>
                          ) : availableCourseCoupons.length > 0 ? (
                            <div className="mt-4 rounded-[20px] border border-cyan-300/15 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
                              {availableCourseCoupons.length} coupon code{availableCourseCoupons.length === 1 ? '' : 's'} configured for this course. Students pay the base price unless a valid code is entered here.
                            </div>
                          ) : (
                            <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                              No coupon codes are configured for this course. Checkout will use the public base price.
                            </div>
                          )}
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(8,47,73,0.72))] p-5">
                          <p className="text-sm font-semibold text-white">Course pricing summary</p>
                          <div className="mt-4 space-y-3 text-sm text-slate-300">
                            <div className="flex items-center justify-between">
                              <span>Public price</span>
                              <span className="font-semibold text-white">INR {baseCoursePrice.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Coupon discount</span>
                              <span className="font-semibold text-white">INR {courseDiscountAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Applied coupon</span>
                              <span className="font-semibold text-white">{appliedCourseCoupon?.code || 'None'}</span>
                            </div>
                            <div className="h-px bg-white/10" />
                            <div className="flex items-center justify-between text-base">
                              <span>Total payable</span>
                              <span className="font-semibold text-emerald-300">INR {payableAmount.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                        <p className="text-sm text-slate-300">
                          This order is already finalized. Continue to checkout to complete the payment securely.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <aside className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.18),rgba(15,23,42,0.82))] p-6 md:p-8 lg:p-10 xl:border-l xl:border-t-0">
                <div className="flex h-full flex-col justify-between gap-8">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Payment Desk
                      </div>
                      <div>
                        <h3 className="text-2xl font-semibold text-white">Order review</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          Review the current order, coupon impact, and payable total before charging the student.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[26px] border border-white/10 bg-slate-950/50 p-5">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm text-slate-300">
                          <span>Product</span>
                          <span className="max-w-[190px] text-right font-medium text-white">{plan.name}</span>
                        </div>
                        {isLiveBatchPlan ? (
                          <>
                            <div className="flex items-center justify-between text-sm text-slate-300">
                              <span>Sessions</span>
                              <span className="font-medium text-white">{requestedSessionsNormalized}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-slate-300">
                              <span>Session fee</span>
                              <span className="font-medium text-white">INR {resolvedPerSessionFee.toLocaleString()}</span>
                            </div>
                          </>
                        ) : isCoursePlan ? (
                          <>
                            <div className="flex items-center justify-between text-sm text-slate-300">
                              <span>Base price</span>
                              <span className="font-medium text-white">INR {baseCoursePrice.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-slate-300">
                              <span>Coupon</span>
                              <span className="font-medium text-white">{appliedCourseCoupon?.code || 'Not applied'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-slate-300">
                              <span>Savings</span>
                              <span className="font-medium text-white">INR {courseDiscountAmount.toLocaleString()}</span>
                            </div>
                          </>
                        ) : null}
                        <div className="flex items-center justify-between text-sm text-slate-300">
                          <span>Checkout</span>
                          <span className="font-medium text-white">Secure online payment</span>
                        </div>
                        <div className="h-px bg-white/10" />
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">Total</span>
                          <span className="text-2xl font-semibold text-white">INR {payableAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      'rounded-[24px] border px-4 py-4 text-sm leading-6',
                      isEditingOrder
                        ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-50'
                        : 'border-white/10 bg-white/[0.04] text-slate-300'
                    )}>
                      {reviewMessage}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={initializePayment}
                      size="lg"
                      className="h-14 w-full rounded-2xl border border-emerald-200/20 bg-[linear-gradient(135deg,rgba(110,231,183,1),rgba(34,211,238,0.95))] px-6 text-base font-semibold text-slate-950 shadow-[0_24px_50px_-28px_rgba(45,212,191,0.85)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_60px_-28px_rgba(45,212,191,0.95)]"
                      disabled={isProcessing || (isLiveBatchPlan && isSessionSelectionInvalid)}
                    >
                      {isProcessing ? <LoaderCircle className="mr-2 animate-spin" /> : <CreditCard className="mr-2" />}
                      {paymentButtonLabel}
                    </Button>
                    {isLiveBatchPlan ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={isEditingOrder ? stopEditingOrder : startEditingOrder}
                        className="h-12 w-full rounded-2xl border-white/15 bg-white/5 text-sm font-semibold text-slate-100 hover:bg-white/10 hover:text-white"
                      >
                        <PencilLine className="mr-2 h-4 w-4" />
                        {isEditingOrder ? 'Done editing' : 'Edit order'}
                      </Button>
                    ) : null}
                    <p className="px-1 text-xs leading-5 text-slate-400">
                      Payments are processed securely. If the student cancels or the transaction fails, no sessions are added and a status popup is shown immediately.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <>
      <Script
        id="razorpay-checkout-js"
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => {
          if (!window.Razorpay) {
            toast({ variant: 'destructive', title: 'Network Error', description: 'Could not load payment gateway. Please check your connection and try again.' });
          }
        }}
        onError={() => {
          toast({ variant: 'destructive', title: 'Network Error', description: 'Could not load payment gateway. Please check your connection and try again.' });
        }}
      />
      <div className="flex flex-col h-full">
        <DashboardHeader title="Checkout" />
        <main className="relative flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {renderContent()}
        </main>
      </div>
    </>
  );
}
