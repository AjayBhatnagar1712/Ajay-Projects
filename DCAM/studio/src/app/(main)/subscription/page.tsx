'use client';

import { useState, useMemo, type ReactNode, type Dispatch, type SetStateAction, FC, useEffect, useRef } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import DashboardHeader from "@/components/dashboard-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, PlusCircle, Edit, Trash2, LoaderCircle, BookOpen, FileText, Video, ArrowUpRight, Sparkles } from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, where, getDoc, getDocs, serverTimestamp, limit } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  buildPricingScopeKey,
  normalizeDifficultyPricing,
  normalizeScopedDifficultyPricingMap,
  resolveScopedDifficultyPricing,
  type ResolvedDifficultyPricing,
  type ScopedDifficultyPricingRule,
  type ScopedDifficultyPricingMap,
} from '@/lib/premium-pricing';
import {
  formatPremiumPracticeAttemptPricingRule,
  normalizePremiumPracticeAttemptPricingMap,
  normalizePremiumPracticeAttemptPricingRule,
  resolvePremiumPracticeAttemptPricingRule,
  type AttemptIntervalUnit,
  type AttemptLimitMode,
  type PremiumPracticeAttemptPricingMap,
  type PremiumPracticeAttemptPricingRule,
} from '@/lib/premium-practice-session';
import {
  buildPremiumCustomMockAttemptRuleFromLegacyLimit,
  formatPremiumCustomMockAttemptPricingRule,
  normalizePremiumCustomMockAttemptPricingMap,
  normalizePremiumCustomMockAttemptPricingRule,
  resolvePremiumCustomMockAttemptPricingRule,
  type PremiumCustomMockAttemptPricingMap,
  type PremiumCustomMockAttemptPricingRule,
} from '@/lib/premium-custom-mock';
import {
  normalizeCouponCode,
  resolveCourseBasePrice,
  resolveCourseCoupons,
  type CourseCoupon,
} from '@/lib/course-plan-pricing';
import { ALLOWED_TEACHER_AUTHOR_EMAIL, isAllowedTeacherAuthorEmail } from '@/lib/teacher-authoring';
import { isStandaloneMockTest } from '@/lib/mock-test-visibility';
import { countTeacherOfferSelections, type TeacherOffer } from '@/lib/teacher-offers';
import { buildPracticeQuestionScopeEntries, type PracticeQuestionScopeEntry, type PracticeQuestionScopeSource } from '@/lib/practice-question-scope';
import { splitSubtopicPath } from '@/lib/subtopic-paths';
import { notifyTeacherPublication } from '@/lib/client-notifications';
import { type TeacherQuestionPurchaseDoc } from '@/lib/teacher-question-purchase';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { useRouter, useSearchParams } from 'next/navigation';

// Zod Schema & Types
const planSchema = z.object({
  name: z.string().min(3, 'Plan name must be at least 3 characters.'),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  billingInterval: z.enum(['monthly', 'yearly']),
  numberOfLiveClasses: z.number().int().min(0, 'Number of live classes cannot be negative.').optional(),
  examTypeId: z.string().min(1, 'You must select an exam type.'),
  classId: z.string().optional(),
  subjectIds: z.array(z.string()).optional(),
  topicId: z.string().optional(),
  features: z.string().min(10, 'Please list at least one feature (one per line).'),
});

type ExamType = { id: string; name: string; };
type Class = { id: string; name: string; examTypeId: string; };
type Subject = { id: string; name: string; classId: string; };
type Topic = { id: string; name: string; subjectId: string; };
type PricingScopeQuestion = PracticeQuestionScopeSource & {
  questionText?: string;
};
type SubtopicOption = { value: string; label: string };

type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  billingInterval: 'monthly' | 'yearly';
  paymentType?: 'one_time' | 'subscription';
  oneTimePrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  couponCode?: string;
  courseCoupons?: CourseCoupon[];
  numberOfLiveClasses?: number;
  totalSessions?: number;
  sessionFee?: number;
  sessionPricingModel?: 'per_session';
  examTypeId: string;
  classId?: string;
  subjectIds?: string[];
  topicId?: string;
  features: string[];
  isPopular?: boolean; // For styling
  createdByTeacherId?: string;
  linkedContentType?: 'course' | 'mock_test' | 'live_batch';
  linkedContentId?: string;
};

type PaidCourse = {
  id: string;
  title: string;
  teacherId?: string;
  accessLevel?: 'free' | 'paid';
  price?: number;
  subscriptionAttached?: boolean;
  publicationStatus?: 'draft' | 'published' | 'deleted';
  classId?: string;
  subjectIds?: string[];
};

type PaidMockTest = {
  id: string;
  title: string;
  teacherId?: string;
  accessLevel?: 'free' | 'paid';
  price?: number;
  subscriptionAttached?: boolean;
  publicationStatus?: 'draft' | 'published' | 'deleted';
  isCourseOnly?: boolean;
  courseId?: string;
  examTypeId?: string;
  classId?: string;
  subjectId?: string;
  subjectIds?: string[];
};

type PaidLiveBatch = {
  id: string;
  title: string;
  teacherId?: string;
  accessLevel?: 'free' | 'paid';
  price?: number;
  subscriptionAttached?: boolean;
  publicationStatus?: 'draft' | 'published' | 'deleted';
  examTypeId?: string;
  classId?: string;
  subjectIds?: string[];
  totalSessions?: number;
  perSessionFee?: number;
};

type LinkedContentType = 'course' | 'mock_test' | 'live_batch';
type LinkedContentSeed = { type: LinkedContentType; id: string };
type PremiumPracticeDifficultyPricing = {
  easy?: number;
  medium?: number;
  hard?: number;
};
type LegacyPremiumMockAttemptLimit = {
  mode?: AttemptLimitMode;
  maxTotalAttempts?: number | null;
  maxAttemptsPerInterval?: number | null;
  intervalValue?: number | null;
  intervalUnit?: AttemptIntervalUnit | null;
};
type TeacherSubscriptionSettings = {
  premiumPracticeQuestionPrice?: number;
  premiumPracticeQuestionPriceByDifficulty?: PremiumPracticeDifficultyPricing;
  premiumPracticeQuestionPricingByScope?: ScopedDifficultyPricingMap;
  premiumPracticeAttemptPricingByScope?: PremiumPracticeAttemptPricingMap;
  premiumMockTestQuestionPrice?: number;
  premiumMockTestQuestionPriceByDifficulty?: PremiumPracticeDifficultyPricing;
  premiumMockTestQuestionPricingByScope?: ScopedDifficultyPricingMap;
  premiumMockTestAttemptPricingByScope?: PremiumCustomMockAttemptPricingMap;
  premiumMockTestAttemptLimit?: LegacyPremiumMockAttemptLimit;
};

type PricingOwnerProfile = {
  id: string;
  email?: string;
};

type TeacherAttemptInputState = {
  mode: AttemptLimitMode;
  maxTotalAttempts: string;
  maxAttemptsPerInterval: string;
  intervalValue: string;
  intervalUnit: AttemptIntervalUnit;
  rechargePrice: string;
  intervalAttemptPrice: string;
};

type PurchasedPricingScopeOptions = {
  examTypes: ExamType[];
  classes: Class[];
  subjects: Subject[];
  topics: Topic[];
  subtopics: SubtopicOption[];
  canUseSubjectWideScope: boolean;
  canUseTopicWideScope: boolean;
};

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

const normalizeSubtopicScopePath = (value?: string | null) =>
  splitSubtopicPath(String(value || ''))
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(' > ');

const normalizeSubtopicScopeSegments = (value?: string | null) =>
  splitSubtopicPath(String(value || ''))
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);

const subtopicPathStartsWith = (fullPath?: string | null, prefixPath?: string | null) => {
  const fullSegments = normalizeSubtopicScopeSegments(fullPath);
  const prefixSegments = normalizeSubtopicScopeSegments(prefixPath);
  if (prefixSegments.length === 0) return true;
  if (fullSegments.length < prefixSegments.length) return false;
  return prefixSegments.every((segment, index) => fullSegments[index] === segment);
};

const purchaseCoversPricingScopeEntry = (
  purchase: TeacherQuestionPurchaseDoc,
  entry: PracticeQuestionScopeEntry<PricingScopeQuestion>
) => {
  if (entry.accessLevel !== 'paid' || entry.mockTestOnly) return false;
  if (entry.examTypeId !== purchase.examTypeId) return false;
  if (entry.classId !== purchase.classId) return false;
  if (entry.subjectId !== purchase.subjectId) return false;
  if (String(purchase.topicId || '').trim() && entry.topicId !== String(purchase.topicId || '').trim()) return false;
  const purchaseSubtopicPath = normalizeSubtopicScopePath(purchase.subtopicPath);
  if (!purchaseSubtopicPath) return true;
  return (entry.subtopics || []).some((candidatePath) => subtopicPathStartsWith(candidatePath, purchaseSubtopicPath));
};

const pricingRuleMatchesPurchasedEntry = (
  rule: Pick<ScopedDifficultyPricingRule, 'examTypeId' | 'classId' | 'subjectId' | 'topicId' | 'subtopicPath'>,
  entry: PracticeQuestionScopeEntry<PricingScopeQuestion>
) => {
  if (entry.examTypeId !== String(rule.examTypeId || '').trim()) return false;
  if (entry.classId !== String(rule.classId || '').trim()) return false;
  const subjectId = String(rule.subjectId || '').trim();
  if (subjectId && entry.subjectId !== subjectId) return false;
  const topicId = String(rule.topicId || '').trim();
  if (topicId && entry.topicId !== topicId) return false;
  const subtopicPath = normalizeSubtopicScopePath(rule.subtopicPath);
  if (!subtopicPath) return true;
  return (entry.subtopics || []).some((candidatePath) => subtopicPathStartsWith(candidatePath, subtopicPath));
};

const formatOfferPriceLabel = (value: unknown, currency?: string) => {
  const normalizedValue = Math.max(0, Number(value || 0));
  const currencyLabel = String(currency || 'INR').trim() || 'INR';
  return `${currencyLabel} ${normalizedValue.toLocaleString()}`;
};

const isPaidContent = (item: { accessLevel?: 'free' | 'paid'; price?: number }) =>
  item.accessLevel === 'paid' || (typeof item.price === 'number' && item.price > 0);

async function syncCourseSubscriptionAttached(firestore: any, courseId: string, teacherUser?: { getIdToken: (forceRefresh?: boolean) => Promise<string> } | null) {
  if (!firestore || !courseId) return;
  const courseRef = doc(firestore, 'courses', courseId);
  const courseSnap = await getDoc(courseRef);
  const plansQuery = query(
    collection(firestore, 'subscription_plans'),
    where('linkedContentType', '==', 'course'),
    where('linkedContentId', '==', courseId)
  );
  const snap = await getDocs(plansQuery);
  const hasLinkedPlan = !snap.empty;
  const previousPublicationStatus = courseSnap.exists() ? String(courseSnap.data()?.publicationStatus || '') : '';
  await updateDocumentNonBlocking(courseRef, {
    subscriptionAttached: hasLinkedPlan,
    publicationStatus: hasLinkedPlan ? 'published' : 'draft',
  });
  if (hasLinkedPlan && previousPublicationStatus !== 'published') {
    await notifyTeacherPublication(teacherUser as any, { contentType: 'course', contentId: courseId });
  }
}

async function syncMockTestSubscriptionAttached(firestore: any, mockTestId: string, teacherUser?: { getIdToken: (forceRefresh?: boolean) => Promise<string> } | null) {
  if (!firestore || !mockTestId) return;
  const mockTestRef = doc(firestore, 'mock_tests', mockTestId);
  const mockTestSnap = await getDoc(mockTestRef);
  const plansQuery = query(
    collection(firestore, 'subscription_plans'),
    where('linkedContentType', '==', 'mock_test'),
    where('linkedContentId', '==', mockTestId)
  );
  const snap = await getDocs(plansQuery);
  const hasLinkedPlan = !snap.empty;
  const previousPublicationStatus = mockTestSnap.exists() ? String(mockTestSnap.data()?.publicationStatus || '') : '';
  await updateDocumentNonBlocking(mockTestRef, {
    subscriptionAttached: hasLinkedPlan,
    publicationStatus: hasLinkedPlan ? 'published' : 'draft',
  });
  if (hasLinkedPlan && previousPublicationStatus !== 'published') {
    await notifyTeacherPublication(teacherUser as any, { contentType: 'mock_test', contentId: mockTestId });
  }
}

async function syncLiveBatchSubscriptionAttached(firestore: any, liveBatchId: string, teacherUser?: { getIdToken: (forceRefresh?: boolean) => Promise<string> } | null) {
  if (!firestore || !liveBatchId) return;
  const liveBatchRef = doc(firestore, 'live_batches', liveBatchId);
  const liveBatchSnap = await getDoc(liveBatchRef);
  const plansQuery = query(
    collection(firestore, 'subscription_plans'),
    where('linkedContentType', '==', 'live_batch'),
    where('linkedContentId', '==', liveBatchId)
  );
  const snap = await getDocs(plansQuery);
  const hasLinkedPlan = !snap.empty;
  const previousPublicationStatus = liveBatchSnap.exists() ? String(liveBatchSnap.data()?.publicationStatus || '') : '';
  await updateDocumentNonBlocking(liveBatchRef, {
    subscriptionAttached: hasLinkedPlan,
    publicationStatus: hasLinkedPlan ? 'published' : 'draft',
  });
  if (hasLinkedPlan && previousPublicationStatus !== 'published') {
    await notifyTeacherPublication(teacherUser as any, { contentType: 'live_batch', contentId: liveBatchId });
  }
}

const teacherPlanSchema = z.object({
  linkedContentType: z.enum(['course', 'mock_test', 'live_batch']),
  linkedContentId: z.string().min(1, 'Select a paid course, paid test, or paid live batch.'),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  oneTimePrice: z.coerce.number().min(0, 'One-time payment must be positive.').optional(),
  courseCoupons: z.array(z.object({
    code: z.string().optional(),
    discountAmount: z.coerce.number().min(0, 'Discount must be positive.').optional(),
  })).optional(),
  billingInterval: z.enum(['monthly', 'yearly']),
  numberOfLiveClasses: z.number().int().min(0, 'Number of live classes cannot be negative.').optional(),
  examTypeId: z.string().optional(),
  classId: z.string().optional(),
  subjectIds: z.array(z.string()).optional(),
  topicId: z.string().optional(),
  features: z.string().min(10, 'Please list at least one feature (one per line).'),
});

// PlanForm Component (for Create/Edit)
const PlanForm: FC<{
  examTypes: ExamType[];
  classes: Class[];
  subjects: Subject[];
  topics: Topic[];
  onFinished: () => void;
  planToEdit?: SubscriptionPlan;
}> = ({ examTypes, classes, subjects, topics, onFinished, planToEdit }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const form = useForm<z.infer<typeof planSchema>>({
        resolver: zodResolver(planSchema),
        defaultValues: planToEdit ? {
            ...planToEdit,
            subjectIds: planToEdit.subjectIds || [],
            numberOfLiveClasses: planToEdit.numberOfLiveClasses,
            features: planToEdit.features.join('\n'),
        } : {
            name: '',
            price: 0,
            billingInterval: 'yearly',
            examTypeId: '',
            classId: '',
            subjectIds: [],
            topicId: '',
            features: '',
        },
    });

    const { watch, setValue } = form;
    const selectedExamType = watch('examTypeId');
    const selectedClass = watch('classId');
    const selectedSubjects = watch('subjectIds') || [];

    const filteredClasses = useMemo(() => {
        if (!selectedExamType) return [];
        return classes.filter(c => c.examTypeId === selectedExamType);
    }, [selectedExamType, classes]);
    const filteredSubjects = useMemo(() => {
        if (!selectedClass) return [];
        return subjects.filter(subject => subject.classId === selectedClass);
    }, [selectedClass, subjects]);
    const filteredTopics = useMemo(() => {
        if (selectedSubjects.length !== 1) return [];
        return topics.filter(topic => topic.subjectId === selectedSubjects[0]);
    }, [selectedSubjects, topics]);

    useEffect(() => {
        setValue('classId', '');
        setValue('subjectIds', []);
        setValue('topicId', '');
    }, [selectedExamType, setValue]);

    useEffect(() => {
        setValue('subjectIds', []);
        setValue('topicId', '');
    }, [selectedClass, setValue]);

    useEffect(() => {
        if (selectedSubjects.length !== 1) {
            setValue('topicId', '');
        }
    }, [selectedSubjects, setValue]);


    async function onSubmit(values: z.infer<typeof planSchema>) {
        setIsSubmitting(true);
        const { features, classId, subjectIds, topicId, ...rest } = values;
        
        const dataToSave: any = {
            ...rest,
            features: features.split('\n').filter(f => f.trim() !== ''),
        };

        if (classId) dataToSave.classId = classId;
        if (subjectIds) dataToSave.subjectIds = subjectIds;
        if (topicId) dataToSave.topicId = topicId;


        try {
            if (planToEdit) {
                const planRef = doc(firestore, 'subscription_plans', planToEdit.id);
                await updateDocumentNonBlocking(planRef, dataToSave);
                toast({ title: 'Plan Updated!', description: `"${values.name}" has been updated.` });
            } else {
                const plansRef = collection(firestore, 'subscription_plans');
                await addDocumentNonBlocking(plansRef, dataToSave);
                toast({ title: 'Plan Created!', description: `"${values.name}" has been added.` });
            }
            onFinished();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Plan Name</FormLabel><FormControl><Input placeholder="e.g., Excel Plan" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField control={form.control} name="price" render={({ field }) => (
                        <FormItem><FormLabel>Price (INR)</FormLabel><FormControl><Input type="number" placeholder="e.g., 18000" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="billingInterval" render={({ field }) => (
                        <FormItem><FormLabel>Billing Interval</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="numberOfLiveClasses" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Live Classes (Optional)</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    placeholder="e.g., 50"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        field.onChange(value === '' ? undefined : parseInt(value, 10));
                                    }}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                 </div>
                 <div className="space-y-2 rounded-md border p-4">
                    <FormLabel>Plan Scope</FormLabel>
                    <FormDescription>Select the hierarchy for this plan. Selections are optional.</FormDescription>
                    <FormField control={form.control} name="examTypeId" render={({ field }) => (
                        <FormItem><FormLabel>Exam Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an exam type" /></SelectTrigger></FormControl><SelectContent>{examTypes.map(et => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="classId" render={({ field }) => (
                        <FormItem><FormLabel>Class (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedExamType}>
                                <FormControl><SelectTrigger><SelectValue placeholder="All Classes" /></SelectTrigger></FormControl>
                                <SelectContent>{filteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="subjectIds" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Subjects (Optional)</FormLabel>
                            <FormDescription>Select one or more subjects for this plan.</FormDescription>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2 border rounded-md">
                            {filteredSubjects.map((item) => (
                                <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value?.includes(item.id)}
                                            onCheckedChange={(checked) => {
                                                return checked
                                                ? field.onChange([...(field.value || []), item.id])
                                                : field.onChange(
                                                    field.value?.filter(
                                                        (value) => value !== item.id
                                                    )
                                                    );
                                            }}
                                            disabled={!selectedClass}
                                        />
                                    </FormControl>
                                    <FormLabel className="font-normal text-sm">{item.name}</FormLabel>
                                </FormItem>
                            ))}
                            </div>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="topicId" render={({ field }) => (
                        <FormItem><FormLabel>Topic (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''} disabled={selectedSubjects.length !== 1}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select topic (requires 1 subject)" /></SelectTrigger></FormControl>
                                <SelectContent>{filteredTopics.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                 </div>
                 <FormField control={form.control} name="features" render={({ field }) => (
                    <FormItem><FormLabel>Features</FormLabel><FormDescription>Enter one feature per line.</FormDescription><FormControl><Textarea placeholder="Full access to Class 12 content\nAll Subjects: Physics, Chemistry, Maths..." {...field} rows={5}/></FormControl><FormMessage /></FormItem>
                )} />
                 <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <LoaderCircle className="mr-2 animate-spin" />}
                    {planToEdit ? 'Save Changes' : 'Create Plan'}
                </Button>
            </form>
        </Form>
    )
};

// Admin View Component
const AdminView: FC<{ 
    plans: SubscriptionPlan[]; 
    examTypes: ExamType[]; 
    classes: Class[];
    subjects: Subject[];
    topics: Topic[];
}> = ({ plans, examTypes, classes, subjects, topics }) => {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [planToEdit, setPlanToEdit] = useState<SubscriptionPlan | null>(null);
    const [planToDelete, setPlanToDelete] = useState<SubscriptionPlan | null>(null);
    
    const examTypeMap = useMemo(() => examTypes.reduce((acc, et) => ({ ...acc, [et.id]: et.name }), {} as Record<string, string>), [examTypes]);
    const classMap = useMemo(() => classes.reduce((acc, c) => ({...acc, [c.id]: c.name}), {} as Record<string, string>), [classes]);
    const subjectMap = useMemo(() => subjects.reduce((acc, s) => ({...acc, [s.id]: s.name}), {} as Record<string, string>), [subjects]);
    const topicMap = useMemo(() => topics.reduce((acc, t) => ({...acc, [t.id]: t.name}), {} as Record<string, string>), [topics]);

    const getPlanScope = (plan: SubscriptionPlan): string => {
        const scopeParts = [examTypeMap[plan.examTypeId]];
        if (plan.classId && classMap[plan.classId]) scopeParts.push(classMap[plan.classId]);
        if (plan.subjectIds && plan.subjectIds.length > 0) {
            const subjectNames = plan.subjectIds.map(id => subjectMap[id]).filter(Boolean).join(', ');
            if (subjectNames) scopeParts.push(subjectNames);
        }
        if (plan.topicId && topicMap[plan.topicId]) scopeParts.push(topicMap[plan.topicId]);
        return scopeParts.join(' / ');
    };

    const plansByExamType = useMemo(() => {
        return plans.reduce((acc, plan) => {
            const examTypeName = examTypeMap[plan.examTypeId] || 'Uncategorized';
            if (!acc[examTypeName]) acc[examTypeName] = [];
            acc[examTypeName].push(plan);
            return acc;
        }, {} as Record<string, SubscriptionPlan[]>);
    }, [plans, examTypeMap]);

    const handleDelete = async () => {
        if (!planToDelete) return;
        try {
            const affectedCourseId = planToDelete.linkedContentType === 'course' ? planToDelete.linkedContentId : null;
            await deleteDocumentNonBlocking(doc(firestore, 'subscription_plans', planToDelete.id));
            if (affectedCourseId) {
                await syncCourseSubscriptionAttached(firestore, affectedCourseId, user);
            }
            toast({ title: 'Plan Deleted', description: `"${planToDelete.name}" has been deleted.`});
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
        } finally {
            setPlanToDelete(null);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="font-headline text-2xl font-semibold">Manage Subscription Plans</h2>
                 <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2"/>Add New Plan</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Add New Subscription Plan</DialogTitle>
                        </DialogHeader>
                        <PlanForm examTypes={examTypes} classes={classes} subjects={subjects} topics={topics} onFinished={() => setIsAddDialogOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>

            {Object.keys(plansByExamType).length > 0 ? Object.entries(plansByExamType).map(([examTypeName, plans]) => (
                <div key={examTypeName}>
                    <h3 className="font-headline text-xl font-semibold mb-4 border-b pb-2">{examTypeName}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {plans.map(plan => (
                            <Card key={plan.id} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle>{plan.name}</CardTitle>
                                    <CardDescription className='font-medium'>{getPlanScope(plan)}</CardDescription>
                                    <CardDescription>INR {plan.price.toLocaleString()} / {plan.billingInterval}</CardDescription>
                                    {plan.numberOfLiveClasses !== undefined && (
                                        <CardDescription>{plan.numberOfLiveClasses} Live Classes</CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent className="flex-grow"><ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">{plan.features.map((f, i) => <li key={i}>{f}</li>)}</ul></CardContent>
                                <CardFooter className="flex justify-end gap-2 border-t pt-4 mt-4">
                                    <Button variant="ghost" onClick={() => setPlanToEdit(plan)}><Edit className="mr-2"/>Edit</Button>
                                    <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setPlanToDelete(plan)}><Trash2 className="mr-2"/>Delete</Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            )) : <p className="text-muted-foreground text-center py-8">No subscription plans found. Add one to get started.</p>}

            <Dialog open={!!planToEdit} onOpenChange={(open) => !open && setPlanToEdit(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Subscription Plan</DialogTitle>
                    </DialogHeader>
                    {planToEdit && <PlanForm examTypes={examTypes} classes={classes} subjects={subjects} topics={topics} planToEdit={planToEdit} onFinished={() => setPlanToEdit(null)} />}
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!planToDelete} onOpenChange={(open) => !open && setPlanToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the "{planToDelete?.name}" plan. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className={cn(buttonVariants({ variant: 'destructive' }))}>Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

const TeacherPlanForm: FC<{
  examTypes: ExamType[];
  classes: Class[];
  subjects: Subject[];
  topics: Topic[];
  paidCourses: PaidCourse[];
  paidMockTests: PaidMockTest[];
  paidLiveBatches: PaidLiveBatch[];
  allowMockTests?: boolean;
  onFinished: () => void;
  planToEdit?: SubscriptionPlan;
  initialLinkedContent?: LinkedContentSeed | null;
}> = ({ examTypes, classes, subjects, topics, paidCourses, paidMockTests, paidLiveBatches, allowMockTests = false, onFinished, planToEdit, initialLinkedContent = null }) => {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const safeInitialLinkedContent = !allowMockTests && initialLinkedContent?.type === 'mock_test' ? null : initialLinkedContent;
  const safePlanLinkedContentType =
    !allowMockTests && planToEdit?.linkedContentType === 'mock_test'
      ? 'course'
      : (planToEdit?.linkedContentType || 'course');

  const classMap = useMemo(() => classes.reduce((acc, c) => ({ ...acc, [c.id]: c }), {} as Record<string, Class>), [classes]);
  const paidCourseMap = useMemo(() => paidCourses.reduce((acc, c) => ({ ...acc, [c.id]: c }), {} as Record<string, PaidCourse>), [paidCourses]);
  const paidMockTestMap = useMemo(() => paidMockTests.reduce((acc, t) => ({ ...acc, [t.id]: t }), {} as Record<string, PaidMockTest>), [paidMockTests]);
  const paidLiveBatchMap = useMemo(() => paidLiveBatches.reduce((acc, b) => ({ ...acc, [b.id]: b }), {} as Record<string, PaidLiveBatch>), [paidLiveBatches]);

  const form = useForm<z.infer<typeof teacherPlanSchema>>({
    resolver: zodResolver(teacherPlanSchema),
    defaultValues: planToEdit ? {
      linkedContentType: safePlanLinkedContentType,
      linkedContentId: !allowMockTests && planToEdit.linkedContentType === 'mock_test' ? '' : (planToEdit.linkedContentId || ''),
      price: planToEdit.price,
      oneTimePrice: planToEdit.oneTimePrice ?? planToEdit.price,
      courseCoupons: resolveCourseCoupons(planToEdit).map((coupon) => ({
        code: coupon.code,
        discountAmount: coupon.discountAmount,
      })),
      billingInterval: planToEdit.billingInterval,
      numberOfLiveClasses: planToEdit.numberOfLiveClasses,
      examTypeId: planToEdit.examTypeId || '',
      classId: planToEdit.classId || '',
      subjectIds: planToEdit.subjectIds || [],
      topicId: planToEdit.topicId || '',
      features: planToEdit.features.join('\n'),
    } : {
      linkedContentType: safeInitialLinkedContent?.type || 'course',
      linkedContentId: safeInitialLinkedContent?.id || '',
      price: 0,
      oneTimePrice: 0,
      courseCoupons: [],
      billingInterval: 'yearly',
      numberOfLiveClasses: undefined,
      examTypeId: '',
      classId: '',
      subjectIds: [],
      topicId: '',
      features: '',
    },
  });
  const {
    fields: courseCouponFields,
    append: appendCourseCoupon,
    remove: removeCourseCoupon,
  } = useFieldArray({
    control: form.control,
    name: 'courseCoupons',
  });

  const selectedContentType = form.watch('linkedContentType');
  const selectedContentId = form.watch('linkedContentId');
  const selectedExamType = form.watch('examTypeId');
  const selectedClass = form.watch('classId');
  const selectedSubjectIds = form.watch('subjectIds') || [];
  const watchedOneTimePrice = Number(form.watch('oneTimePrice') ?? 0);
  const watchedCourseCoupons = form.watch('courseCoupons') || [];
  const isCoursePlan = selectedContentType === 'course';
  const isLiveBatchPlan = selectedContentType === 'live_batch';
  const hasHydratedInitialSeed = useRef<string | null>(null);
  const contentOptions = selectedContentType === 'course'
    ? paidCourses.map((c) => ({ id: c.id, label: c.title }))
    : selectedContentType === 'mock_test' && allowMockTests
      ? paidMockTests.map((t) => ({ id: t.id, label: t.title }))
      : selectedContentType === 'live_batch'
        ? paidLiveBatches.map((b) => ({ id: b.id, label: b.title }))
        : [];

  const filteredClasses = useMemo(() => {
    if (!selectedExamType) return [];
    return classes.filter((c) => c.examTypeId === selectedExamType);
  }, [selectedExamType, classes]);

  const filteredSubjects = useMemo(() => {
    if (!selectedClass) return [];
    return subjects.filter((subject) => subject.classId === selectedClass);
  }, [selectedClass, subjects]);

  const filteredTopics = useMemo(() => {
    if (selectedSubjectIds.length !== 1) return [];
    return topics.filter((topic) => topic.subjectId === selectedSubjectIds[0]);
  }, [selectedSubjectIds, topics]);

  const getContentScopeSeed = (
    linkedContentType: LinkedContentType,
    linkedContentId: string
  ): { examTypeId: string; classId: string; subjectIds: string[] } => {
    if (!linkedContentId) return { examTypeId: '', classId: '', subjectIds: [] };

    if (linkedContentType === 'course') {
      const course = paidCourseMap[linkedContentId];
      const classDoc = course?.classId ? classMap[course.classId] : undefined;
      return {
        examTypeId: classDoc?.examTypeId || '',
        classId: course?.classId || '',
        subjectIds: course?.subjectIds || [],
      };
    }

    if (linkedContentType === 'mock_test') {
      const test = paidMockTestMap[linkedContentId];
      return {
        examTypeId: test?.examTypeId || '',
        classId: test?.classId || '',
        subjectIds: test?.subjectIds?.length ? test.subjectIds : test?.subjectId ? [test.subjectId] : [],
      };
    }

    const batch = paidLiveBatchMap[linkedContentId];
    return {
      examTypeId: batch?.examTypeId || '',
      classId: batch?.classId || '',
      subjectIds: batch?.subjectIds || [],
    };
  };

  const selectedContentScopeSeed = useMemo(
    () => getContentScopeSeed(selectedContentType, selectedContentId || ''),
    [selectedContentType, selectedContentId, paidCourseMap, paidMockTestMap, paidLiveBatchMap, classMap]
  );

  const normalizedOneTimePrice = Number.isFinite(watchedOneTimePrice) ? Math.max(0, watchedOneTimePrice) : 0;
  const courseCouponPreviews = watchedCourseCoupons.map((coupon) => {
    const discountAmount = Number.isFinite(Number(coupon?.discountAmount))
      ? Math.max(0, Math.min(Number(coupon?.discountAmount), normalizedOneTimePrice))
      : 0;
    const finalPrice = Math.max(0, normalizedOneTimePrice - discountAmount);
    const discountPercent = normalizedOneTimePrice > 0
      ? Number(((discountAmount / normalizedOneTimePrice) * 100).toFixed(2))
      : 0;

    return {
      code: normalizeCouponCode(coupon?.code),
      discountAmount,
      finalPrice,
      discountPercent,
    };
  });

  useEffect(() => {
    if (planToEdit || !safeInitialLinkedContent) return;

    const seedKey = `${safeInitialLinkedContent.type}:${safeInitialLinkedContent.id}`;
    if (hasHydratedInitialSeed.current === seedKey) return;

    const exists =
      (safeInitialLinkedContent.type === 'course' && !!paidCourseMap[safeInitialLinkedContent.id]) ||
      (safeInitialLinkedContent.type === 'mock_test' && allowMockTests && !!paidMockTestMap[safeInitialLinkedContent.id]) ||
      (safeInitialLinkedContent.type === 'live_batch' && !!paidLiveBatchMap[safeInitialLinkedContent.id]);

    form.setValue('linkedContentType', safeInitialLinkedContent.type);
    form.setValue('linkedContentId', exists ? safeInitialLinkedContent.id : '');
    hasHydratedInitialSeed.current = seedKey;
  }, [planToEdit, safeInitialLinkedContent, allowMockTests, paidCourseMap, paidMockTestMap, paidLiveBatchMap, form]);

  useEffect(() => {
    if (allowMockTests || selectedContentType !== 'mock_test') return;
    form.setValue('linkedContentType', 'course');
    form.setValue('linkedContentId', '');
  }, [allowMockTests, selectedContentType, form]);

  useEffect(() => {
    if (!selectedContentId) return;
    form.setValue('examTypeId', selectedContentScopeSeed.examTypeId || '');
    form.setValue('classId', selectedContentScopeSeed.classId || '');
    form.setValue('subjectIds', selectedContentScopeSeed.subjectIds || []);
    form.setValue('topicId', '');
    if (!isLiveBatchPlan) {
      form.setValue('numberOfLiveClasses', undefined);
    }
  }, [selectedContentId, selectedContentScopeSeed, form, isLiveBatchPlan]);

  useEffect(() => {
    if (!isLiveBatchPlan || !selectedContentId) return;
    const selectedBatch = paidLiveBatchMap[selectedContentId];
    if (!selectedBatch) return;

    const resolvedTotalSessions = Math.max(0, Number(selectedBatch.totalSessions ?? 0));
    const existingSessionFee = planToEdit?.linkedContentType === 'live_batch'
      ? Math.max(0, Number(form.getValues('price') ?? planToEdit.price ?? 0))
      : 0;

    form.setValue('price', existingSessionFee);
    form.setValue('oneTimePrice', existingSessionFee);
    form.setValue('billingInterval', 'yearly');
    form.setValue('numberOfLiveClasses', resolvedTotalSessions > 0 ? resolvedTotalSessions : undefined);
  }, [isLiveBatchPlan, selectedContentId, paidLiveBatchMap, form, planToEdit]);

  useEffect(() => {
    if (selectedClass && !filteredClasses.some((item) => item.id === selectedClass)) {
      form.setValue('classId', '');
      form.setValue('subjectIds', []);
      form.setValue('topicId', '');
    }
  }, [selectedClass, filteredClasses, form]);

  useEffect(() => {
    if (!selectedSubjectIds.length) {
      form.setValue('topicId', '');
      return;
    }

    const validSubjectIds = selectedSubjectIds.filter((id) => filteredSubjects.some((subject) => subject.id === id));
    if (validSubjectIds.length !== selectedSubjectIds.length) {
      form.setValue('subjectIds', validSubjectIds);
    }
    if (validSubjectIds.length !== 1) {
      form.setValue('topicId', '');
    }
  }, [selectedSubjectIds, filteredSubjects, form]);

  useEffect(() => {
    if (!isCoursePlan) return;

    const currentPrice = Number(form.getValues('price') ?? 0);
    if (Math.abs(currentPrice - normalizedOneTimePrice) > 0.001) {
      form.setValue('price', normalizedOneTimePrice);
    }
  }, [isCoursePlan, normalizedOneTimePrice, form]);

  useEffect(() => {
    if (!isLiveBatchPlan && form.getValues('numberOfLiveClasses') !== undefined) {
      form.setValue('numberOfLiveClasses', undefined);
    }
  }, [isLiveBatchPlan, form]);

  async function onSubmit(values: z.infer<typeof teacherPlanSchema>) {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const affectedCourseIds = new Set<string>();
      const affectedMockTestIds = new Set<string>();
      const affectedLiveBatchIds = new Set<string>();
      if (planToEdit?.linkedContentType === 'course' && planToEdit.linkedContentId) affectedCourseIds.add(planToEdit.linkedContentId);
      if (planToEdit?.linkedContentType === 'mock_test' && planToEdit.linkedContentId) affectedMockTestIds.add(planToEdit.linkedContentId);
      if (planToEdit?.linkedContentType === 'live_batch' && planToEdit.linkedContentId) affectedLiveBatchIds.add(planToEdit.linkedContentId);
      if (values.linkedContentType === 'course' && values.linkedContentId) affectedCourseIds.add(values.linkedContentId);
      if (values.linkedContentType === 'mock_test' && values.linkedContentId) affectedMockTestIds.add(values.linkedContentId);
      if (values.linkedContentType === 'live_batch' && values.linkedContentId) affectedLiveBatchIds.add(values.linkedContentId);

      const dataToSave: Record<string, any> = {
        features: values.features.split('\n').map((f) => f.trim()).filter((f) => f.length > 0),
        createdByTeacherId: user.uid,
        linkedContentType: values.linkedContentType,
        linkedContentId: values.linkedContentId,
      };
      if (values.linkedContentType === 'course' && !paidCourseMap[values.linkedContentId]) {
        throw new Error('Selected paid course was not found.');
      }
      if (values.linkedContentType === 'mock_test' && !allowMockTests) {
        throw new Error('Standalone mock-test subscription plans are only available for the owner teacher account.');
      }
      if (values.linkedContentType === 'mock_test' && !paidMockTestMap[values.linkedContentId]) {
        throw new Error('Selected paid mock test was not found.');
      }
      if (values.linkedContentType === 'live_batch' && !paidLiveBatchMap[values.linkedContentId]) {
        throw new Error('Selected paid live batch was not found.');
      }

      const linkedTitle = values.linkedContentType === 'course'
        ? paidCourseMap[values.linkedContentId]?.title
        : values.linkedContentType === 'mock_test'
          ? paidMockTestMap[values.linkedContentId]?.title
          : paidLiveBatchMap[values.linkedContentId]?.title;

      const scopeSeed = getContentScopeSeed(values.linkedContentType, values.linkedContentId);
      const resolvedExamTypeId = values.examTypeId || scopeSeed.examTypeId;
      if (!resolvedExamTypeId && values.linkedContentType !== 'course') {
        throw new Error('Exam type is required for this plan.');
      }

      const resolvedClassId = values.classId || scopeSeed.classId || '';
      const customSubjectIds = (values.subjectIds || []).filter(Boolean);
      const resolvedSubjectIds = customSubjectIds.length > 0 ? customSubjectIds : (scopeSeed.subjectIds || []);
      if (resolvedExamTypeId) dataToSave.examTypeId = resolvedExamTypeId;
      if (resolvedClassId) dataToSave.classId = resolvedClassId;
      if (resolvedSubjectIds.length > 0) dataToSave.subjectIds = Array.from(new Set(resolvedSubjectIds));
      if (values.topicId) dataToSave.topicId = values.topicId;

      if (values.linkedContentType === 'course') {
        const basePrice = Math.max(0, Number(values.oneTimePrice ?? values.price ?? 0));
        if (basePrice <= 0) {
          throw new Error('Set payment amount for course plan.');
        }

        const normalizedCoupons = (values.courseCoupons || [])
          .map((coupon, index) => {
            const code = normalizeCouponCode(coupon.code);
            const rawDiscountAmount = Number(coupon.discountAmount ?? 0);
            const hasCouponInput = code.length > 0 || rawDiscountAmount > 0;
            if (!hasCouponInput) return null;
            if (!code) {
              throw new Error(`Enter coupon code for coupon row ${index + 1}.`);
            }

            const discountAmount = Math.max(0, Math.min(rawDiscountAmount, basePrice));
            if (discountAmount <= 0) {
              throw new Error(`Enter a discount amount greater than 0 for coupon ${code}.`);
            }

            const finalPrice = Math.max(0, Number((basePrice - discountAmount).toFixed(2)));
            const discountPercent = basePrice > 0
              ? Number(((discountAmount / basePrice) * 100).toFixed(2))
              : 0;

            return {
              code,
              discountAmount,
              finalPrice,
              discountPercent,
            } satisfies CourseCoupon;
          })
          .filter((coupon): coupon is CourseCoupon => !!coupon);

        const seenCoupons = new Set<string>();
        const duplicateCoupon = normalizedCoupons.find((coupon) => {
          if (seenCoupons.has(coupon.code)) return true;
          seenCoupons.add(coupon.code);
          return false;
        });
        if (duplicateCoupon) {
          throw new Error(`Coupon code ${duplicateCoupon.code} is duplicated. Use unique coupon codes per course.`);
        }

        dataToSave.paymentType = 'one_time';
        dataToSave.oneTimePrice = basePrice;
        dataToSave.price = basePrice;
        dataToSave.courseCoupons = normalizedCoupons;
        dataToSave.discountAmount = 0;
        dataToSave.discountPercent = 0;
        dataToSave.couponCode = null;
        dataToSave.billingInterval = 'yearly';
      } else if (values.linkedContentType === 'live_batch') {
        const linkedBatch = paidLiveBatchMap[values.linkedContentId];
        const totalSessions = Math.max(
          0,
          Number(linkedBatch?.totalSessions ?? values.numberOfLiveClasses ?? 0)
        );
        const sessionFee = Math.max(
          0,
          Number(values.price ?? 0)
        );

        if (totalSessions <= 0) {
          throw new Error('Set total sessions in Live Batch edit first. Total sessions must be greater than 0.');
        }
        if (sessionFee <= 0) {
          throw new Error('Set per-session fee in Subscription plan. Per-session fee must be greater than 0.');
        }

        dataToSave.paymentType = 'one_time';
        dataToSave.price = sessionFee;
        dataToSave.oneTimePrice = sessionFee;
        dataToSave.discountAmount = 0;
        dataToSave.discountPercent = 0;
        dataToSave.couponCode = null;
        dataToSave.billingInterval = 'yearly';
        dataToSave.numberOfLiveClasses = totalSessions;
        dataToSave.totalSessions = totalSessions;
        dataToSave.sessionFee = sessionFee;
        dataToSave.sessionPricingModel = 'per_session';
      } else {
        dataToSave.paymentType = 'subscription';
        dataToSave.price = values.price;
        dataToSave.billingInterval = values.billingInterval;
      }

      const modeLabel = values.linkedContentType === 'live_batch'
        ? 'Per Session'
        : dataToSave.paymentType === 'one_time'
          ? 'One-Time'
          : `${dataToSave.billingInterval} Interval`;
      dataToSave.name = `${linkedTitle || 'Content'} ${modeLabel} Plan`;

      if (values.linkedContentType === 'live_batch' && values.numberOfLiveClasses !== undefined && !dataToSave.numberOfLiveClasses) {
        dataToSave.numberOfLiveClasses = values.numberOfLiveClasses;
      }

      if (planToEdit) {
        await updateDocumentNonBlocking(doc(firestore, 'subscription_plans', planToEdit.id), dataToSave);
        toast({ title: 'Plan Updated', description: `"${dataToSave.name}" has been updated.` });
      } else {
        await addDocumentNonBlocking(collection(firestore, 'subscription_plans'), dataToSave);
        toast({ title: 'Plan Created', description: `"${dataToSave.name}" has been created.` });
      }

      await Promise.all(Array.from(affectedCourseIds).map((courseId) => syncCourseSubscriptionAttached(firestore, courseId, user)));
      await Promise.all(Array.from(affectedMockTestIds).map((mockTestId) => syncMockTestSubscriptionAttached(firestore, mockTestId, user)));
      await Promise.all(Array.from(affectedLiveBatchIds).map((liveBatchId) => syncLiveBatchSubscriptionAttached(firestore, liveBatchId, user)));
      onFinished();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Operation Failed', description: error.message || 'Could not save plan.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
        <FormField control={form.control} name="linkedContentType" render={({ field }) => (
          <FormItem>
            <FormLabel>Paid Content Type</FormLabel>
            <Select
              onValueChange={(value) => {
                field.onChange(value);
                form.setValue('linkedContentId', '');
                form.setValue('examTypeId', '');
                form.setValue('classId', '');
                form.setValue('subjectIds', []);
                form.setValue('topicId', '');
                form.setValue('price', 0);
                form.setValue('oneTimePrice', 0);
                form.setValue('courseCoupons', []);
                if (value !== 'live_batch') {
                  form.setValue('numberOfLiveClasses', undefined);
                }
              }}
              value={field.value}
            >
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="course">Paid Course</SelectItem>
                {allowMockTests ? <SelectItem value="mock_test">Paid Mock Test</SelectItem> : null}
                <SelectItem value="live_batch">Paid Live Batch</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="linkedContentId" render={({ field }) => (
          <FormItem>
            <FormLabel>
              {selectedContentType === 'course' ? 'Paid Course' : selectedContentType === 'mock_test' ? 'Paid Mock Test' : 'Paid Live Batch'}
            </FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder={`Select ${selectedContentType === 'course' ? 'course' : selectedContentType === 'mock_test' ? 'test' : 'live batch'}`} /></SelectTrigger></FormControl>
              <SelectContent>
                {contentOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        {selectedContentType === 'mock_test' ? (
          <div className="space-y-3 rounded-md border p-4">
            <FormLabel>Plan Scope (Customizable)</FormLabel>
            <FormDescription>Auto-filled from selected content. You can edit exam, class, subjects, and topic for this plan.</FormDescription>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField control={form.control} name="examTypeId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Exam Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select exam type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {examTypes.map((examType) => (
                        <SelectItem key={examType.id} value={examType.id}>{examType.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="classId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Class (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedExamType}>
                    <FormControl><SelectTrigger><SelectValue placeholder="All Classes" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {filteredClasses.map((classItem) => (
                        <SelectItem key={classItem.id} value={classItem.id}>{classItem.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="subjectIds" render={({ field }) => (
              <FormItem>
                <FormLabel>Subjects (Optional)</FormLabel>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2 border rounded-md">
                  {filteredSubjects.map((subject) => (
                    <FormItem key={subject.id} className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value?.includes(subject.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...(field.value || []), subject.id]);
                              return;
                            }
                            field.onChange((field.value || []).filter((value) => value !== subject.id));
                          }}
                          disabled={!selectedClass}
                        />
                      </FormControl>
                      <FormLabel className="font-normal text-sm">{subject.name}</FormLabel>
                    </FormItem>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="topicId" render={({ field }) => (
              <FormItem>
                <FormLabel>Topic (Optional)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''} disabled={selectedSubjectIds.length !== 1}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select topic (requires 1 subject)" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {filteredTopics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>{topic.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        ) : null}
        {isCoursePlan ? (
          <div className="space-y-3 rounded-md border p-4">
            <FormLabel>Course Pricing</FormLabel>
            <FormDescription>
              Set the public course price here. Coupon discounts stay hidden from the course page and apply only when a student enters a valid coupon at checkout.
            </FormDescription>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="oneTimePrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>One-Time Payment (INR)</FormLabel>
                  <FormControl><Input type="number" min={0} step="0.01" placeholder="e.g., 9999" {...field} value={field.value ?? 0} /></FormControl>
                  <FormDescription>This amount is shown publicly on the course page.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Displayed Course Price (INR)</FormLabel>
                  <FormControl><Input type="number" {...field} value={normalizedOneTimePrice.toFixed(2)} readOnly /></FormControl>
                  <FormDescription>This remains the same until a student applies a coupon.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="space-y-4 rounded-md border border-dashed border-border/80 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Course Coupon Codes</p>
                  <p className="text-xs text-muted-foreground">
                    Add multiple coupon codes for this course. Students must enter one during checkout to see the reduced price.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => appendCourseCoupon({ code: '', discountAmount: 0 })}
                >
                  Add Coupon
                </Button>
              </div>

              {courseCouponFields.length > 0 ? (
                <div className="space-y-4">
                  {courseCouponFields.map((couponField, index) => {
                    const preview = courseCouponPreviews[index];
                    return (
                      <div key={couponField.id} className="space-y-4 rounded-md border border-border/70 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium">Coupon {index + 1}</p>
                            <p className="text-xs text-muted-foreground">Share this code privately with eligible students.</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="justify-start text-destructive hover:text-destructive sm:justify-center"
                            onClick={() => removeCourseCoupon(index)}
                          >
                            Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField control={form.control} name={`courseCoupons.${index}.code`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Coupon Code</FormLabel>
                              <FormControl><Input placeholder="e.g., COURSE500OFF" {...field} value={field.value || ''} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`courseCoupons.${index}.discountAmount`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Discount Amount (INR)</FormLabel>
                              <FormControl><Input type="number" min={0} step="0.01" placeholder="e.g., 500" {...field} value={field.value ?? 0} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormItem>
                            <FormLabel>Student Pays (INR)</FormLabel>
                            <FormControl><Input type="number" value={preview?.finalPrice.toFixed(2) || '0.00'} readOnly /></FormControl>
                          </FormItem>
                          <FormItem>
                            <FormLabel>Discount Percentage</FormLabel>
                            <FormControl><Input value={`${preview?.discountPercent.toFixed(2) || '0.00'}%`} readOnly /></FormControl>
                          </FormItem>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                  No coupon codes added yet. This course will use only the public base price until you add one.
                </div>
              )}
            </div>
          </div>
        ) : isLiveBatchPlan ? (
          <div className="space-y-3 rounded-md border p-4">
            <FormLabel>Live Batch Session Pricing</FormLabel>
            <FormDescription>
              Only the selected batch name, per class session rate, and total class session count are used.
            </FormDescription>
            <FormItem>
              <FormLabel>Selected Live Batch</FormLabel>
              <FormControl>
                <Input value={selectedContentId ? (paidLiveBatchMap[selectedContentId]?.title || 'Selected live batch') : 'Select live batch'} readOnly />
              </FormControl>
            </FormItem>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Per Class Session Rate (INR)</FormLabel>
                  <FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl>
                  <FormDescription>Set the per-session amount here for this subscription plan.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormItem>
                <FormLabel>Total Class Session Count</FormLabel>
                <div className="h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                  {Math.max(0, Number(paidLiveBatchMap[selectedContentId || '']?.totalSessions ?? form.getValues('numberOfLiveClasses') ?? 0))} sessions
                </div>
                <FormDescription>
                  This value is set in Live Batch create/edit. One session means one meeting; tests are excluded.
                </FormDescription>
              </FormItem>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="price" render={({ field }) => (
              <FormItem><FormLabel>Price (INR)</FormLabel><FormControl><Input type="number" min={0} step="0.01" placeholder="e.g., 4999" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="billingInterval" render={({ field }) => (
              <FormItem><FormLabel>Billing Interval</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent></Select><FormMessage /></FormItem>
            )} />
          </div>
        )}
        <FormField control={form.control} name="features" render={({ field }) => (
          <FormItem><FormLabel>Features</FormLabel><FormDescription>Enter one feature per line.</FormDescription><FormControl><Textarea rows={5} placeholder="Recorded lessons\nPractice sheets\nDoubt support" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="mr-2 animate-spin" />}
          {planToEdit ? 'Save Changes' : 'Create Plan'}
        </Button>
      </form>
    </Form>
  );
};

type ScopedPricingRuleView = {
  key: string;
  examTypeId: string;
  classId: string;
  subjectId?: string;
  topicId?: string;
  subtopicPath?: string;
  examTypeName: string;
  className: string;
  subjectName?: string;
  topicName?: string;
  subtopicLabel?: string;
  pricing: ResolvedDifficultyPricing;
  attemptSummary?: string;
};

const ScopedPricingCard: FC<{
  title: string;
  description: string;
  scopePrefix: string;
  examTypes: ExamType[];
  classes: Class[];
  subjects: Subject[];
  topics: Topic[];
  subtopics: SubtopicOption[];
  selectedExamTypeId: string;
  selectedClassId: string;
  selectedSubjectId: string;
  selectedTopicId: string;
  selectedSubtopicPath: string;
  canUseSubjectWideScope: boolean;
  canUseTopicWideScope: boolean;
  priceInput: { easy: string; medium: string; hard: string };
  currentPricing: ResolvedDifficultyPricing;
  rules: ScopedPricingRuleView[];
  isSaving: boolean;
  onExamTypeChange: (value: string) => void;
  onClassIdChange: (value: string) => void;
  onSubjectIdChange: (value: string) => void;
  onTopicIdChange: (value: string) => void;
  onSubtopicPathChange: (value: string) => void;
  onPriceInputChange: (difficulty: 'easy' | 'medium' | 'hard', value: string) => void;
  onSave: () => void;
  onSelectRule: (rule: ScopedPricingRuleView) => void;
  onDeleteRule: (rule: ScopedPricingRuleView) => void;
  emptyText: string;
  saveLabel?: string;
  children?: ReactNode;
}> = ({
  title,
  description,
  scopePrefix,
  examTypes,
  classes,
  subjects,
  topics,
  subtopics,
  selectedExamTypeId,
  selectedClassId,
  selectedSubjectId,
  selectedTopicId,
  selectedSubtopicPath,
  canUseSubjectWideScope,
  canUseTopicWideScope,
  priceInput,
  currentPricing,
  rules,
  isSaving,
  onExamTypeChange,
  onClassIdChange,
  onSubjectIdChange,
  onTopicIdChange,
  onSubtopicPathChange,
  onPriceInputChange,
  onSave,
  onSelectRule,
  onDeleteRule,
  emptyText,
  saveLabel,
  children,
}) => {
  const filteredClasses = useMemo(
    () => classes.filter((classItem) => classItem.examTypeId === selectedExamTypeId),
    [classes, selectedExamTypeId]
  );
  const filteredSubjects = useMemo(
    () => subjects.filter((subject) => subject.classId === selectedClassId),
    [selectedClassId, subjects]
  );
  const filteredTopics = useMemo(
    () => topics.filter((topic) => topic.subjectId === selectedSubjectId),
    [selectedSubjectId, topics]
  );
  const selectedScopeKey = buildPricingScopeKey(
    selectedExamTypeId,
    selectedClassId,
    selectedSubjectId,
    selectedTopicId,
    selectedSubtopicPath
  );
  const hasSavedScope = !!selectedScopeKey && rules.some((rule) => rule.key === selectedScopeKey);
  const scopeSummary = [
    examTypes.find((examType) => examType.id === selectedExamTypeId)?.name,
    filteredClasses.find((classItem) => classItem.id === selectedClassId)?.name,
    filteredSubjects.find((subject) => subject.id === selectedSubjectId)?.name,
    selectedTopicId
      ? filteredTopics.find((topic) => topic.id === selectedTopicId)?.name
      : canUseSubjectWideScope
        ? 'All purchased topics'
        : '',
    selectedSubtopicPath
      ? subtopics.find((option) => option.value === selectedSubtopicPath)?.label
      : selectedTopicId && canUseTopicWideScope
        ? 'All purchased subtopics'
        : '',
  ].filter(Boolean).join(' / ');

  return (
    <Card className="border-primary/25 bg-card/80 backdrop-blur">
      <CardHeader className="space-y-3">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-background/60 to-background/40 p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${scopePrefix}-exam-type`}>Exam</Label>
              <Select value={selectedExamTypeId} onValueChange={onExamTypeChange}>
                <SelectTrigger id={`${scopePrefix}-exam-type`}>
                  <SelectValue placeholder="Select exam" />
                </SelectTrigger>
                <SelectContent>
                  {examTypes.map((examType) => (
                    <SelectItem key={examType.id} value={examType.id}>
                      {examType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${scopePrefix}-class-id`}>Curriculum</Label>
              <Select value={selectedClassId} onValueChange={onClassIdChange} disabled={!selectedExamTypeId}>
                <SelectTrigger id={`${scopePrefix}-class-id`}>
                  <SelectValue placeholder={selectedExamTypeId ? 'Select curriculum' : 'Select exam first'} />
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
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`${scopePrefix}-subject-id`}>Subject</Label>
              <Select value={selectedSubjectId} onValueChange={onSubjectIdChange} disabled={!selectedClassId}>
                <SelectTrigger id={`${scopePrefix}-subject-id`}>
                  <SelectValue placeholder={selectedClassId ? 'Select purchased subject' : 'Select curriculum first'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${scopePrefix}-topic-id`}>Topic</Label>
              <Select
                value={selectedTopicId || '__all_topics__'}
                onValueChange={(value) => onTopicIdChange(value === '__all_topics__' ? '' : value)}
                disabled={!selectedSubjectId || (!canUseSubjectWideScope && filteredTopics.length === 0)}
              >
                <SelectTrigger id={`${scopePrefix}-topic-id`}>
                  <SelectValue placeholder={selectedSubjectId ? 'Select purchased topic' : 'Select subject first'} />
                </SelectTrigger>
                <SelectContent>
                  {canUseSubjectWideScope ? (
                    <SelectItem value="__all_topics__">All purchased topics</SelectItem>
                  ) : null}
                  {filteredTopics.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${scopePrefix}-subtopic-path`}>Subtopic</Label>
              <Select
                value={selectedSubtopicPath || '__all_subtopics__'}
                onValueChange={(value) => onSubtopicPathChange(value === '__all_subtopics__' ? '' : value)}
                disabled={!selectedTopicId}
              >
                <SelectTrigger id={`${scopePrefix}-subtopic-path`}>
                  <SelectValue placeholder={selectedTopicId ? 'Select purchased subtopic' : 'Select topic first'} />
                </SelectTrigger>
                <SelectContent>
                  {canUseTopicWideScope ? (
                    <SelectItem value="__all_subtopics__">All purchased subtopics</SelectItem>
                  ) : null}
                  {subtopics.map((subtopic) => (
                    <SelectItem key={subtopic.value} value={subtopic.value}>
                      {subtopic.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(3,minmax(0,220px))_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor={`${scopePrefix}-easy`}>Easy Price (INR)</Label>
            <Input
              id={`${scopePrefix}-easy`}
              type="number"
              min={0}
              step="0.01"
              value={priceInput.easy}
              onChange={(event) => onPriceInputChange('easy', event.target.value)}
              placeholder="e.g., 3"
              disabled={!selectedScopeKey}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${scopePrefix}-medium`}>Medium Price (INR)</Label>
            <Input
              id={`${scopePrefix}-medium`}
              type="number"
              min={0}
              step="0.01"
              value={priceInput.medium}
              onChange={(event) => onPriceInputChange('medium', event.target.value)}
              placeholder="e.g., 5"
              disabled={!selectedScopeKey}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${scopePrefix}-hard`}>Hard Price (INR)</Label>
            <Input
              id={`${scopePrefix}-hard`}
              type="number"
              min={0}
              step="0.01"
              value={priceInput.hard}
              onChange={(event) => onPriceInputChange('hard', event.target.value)}
              placeholder="e.g., 8"
              disabled={!selectedScopeKey}
            />
          </div>
          <div className="flex items-center gap-2 md:pb-0.5">
            <Button type="button" onClick={onSave} disabled={isSaving || !selectedScopeKey}>
              {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              {saveLabel || (hasSavedScope ? 'Update Scope' : 'Save Scope')}
            </Button>
          </div>
        </div>

        {children}

        {scopeSummary ? (
          <p className="text-xs text-muted-foreground">Pricing scope: {scopeSummary}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full">
            Easy: INR {currentPricing.easy.toLocaleString()} / question
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Medium: INR {currentPricing.medium.toLocaleString()} / question
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Hard: INR {currentPricing.hard.toLocaleString()} / question
          </Badge>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/45 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Saved Scope</p>
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {rules.length} rule{rules.length === 1 ? '' : 's'}
            </Badge>
          </div>

          {rules.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
              {rules.map((rule) => {
                const isActive = selectedScopeKey === rule.key;
                const ruleLabel = [rule.examTypeName, rule.className, rule.subjectName, rule.topicName, rule.subtopicLabel]
                  .filter(Boolean)
                  .join(' / ');
                return (
                  <div
                    key={rule.key}
                    className={cn(
                      'flex items-start justify-between gap-3 rounded-xl border p-3 transition',
                      isActive
                        ? 'border-primary/45 bg-primary/10 shadow-[0_12px_30px_-24px_rgba(59,130,246,0.85)]'
                        : 'border-border/60 bg-background/55 hover:border-primary/30'
                    )}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => onSelectRule(rule)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{ruleLabel}</p>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Easy {rule.pricing.easy.toLocaleString()} | Medium {rule.pricing.medium.toLocaleString()} | Hard {rule.pricing.hard.toLocaleString()}
                      </p>
                      {rule.attemptSummary ? (
                        <p className="mt-1 text-[11px] text-cyan-100/80">{rule.attemptSummary}</p>
                      ) : null}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                      onClick={() => onDeleteRule(rule)}
                      disabled={isSaving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const AttemptSettingsFields: FC<{
  title: string;
  description: string;
  scopePrefix: string;
  input: TeacherAttemptInputState;
  setInput: Dispatch<SetStateAction<TeacherAttemptInputState>>;
  summary: string;
}> = ({ title, description, scopePrefix, input, setInput, summary }) => (
  <div className="rounded-xl border border-border/70 bg-background/45 p-4">
    <div className="space-y-1">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>

    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${scopePrefix}-attempt-mode`}>Attempt Mode</Label>
        <Select
          value={input.mode}
          onValueChange={(value) =>
            setInput((current) => ({ ...current, mode: value as AttemptLimitMode }))
          }
        >
          <SelectTrigger id={`${scopePrefix}-attempt-mode`}>
            <SelectValue placeholder="Select attempt mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unlimited">Unlimited</SelectItem>
            <SelectItem value="total">Fixed total attempts</SelectItem>
            <SelectItem value="interval">Attempts per interval</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-primary/80">Current Rule</p>
        <p className="mt-2 text-sm text-foreground">{summary}</p>
      </div>
    </div>

    {input.mode === 'total' ? (
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${scopePrefix}-total-attempts`}>Total Attempts</Label>
          <Input
            id={`${scopePrefix}-total-attempts`}
            type="number"
            min={1}
            value={input.maxTotalAttempts}
            onChange={(event) =>
              setInput((current) => ({ ...current, maxTotalAttempts: event.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${scopePrefix}-recharge-price`}>Recharge Price (INR)</Label>
          <Input
            id={`${scopePrefix}-recharge-price`}
            type="number"
            min={0}
            step="0.01"
            value={input.rechargePrice}
            onChange={(event) =>
              setInput((current) => ({ ...current, rechargePrice: event.target.value }))
            }
          />
        </div>
      </div>
    ) : null}

    {input.mode === 'interval' ? (
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor={`${scopePrefix}-attempts-per-interval`}>Attempts / Interval</Label>
          <Input
            id={`${scopePrefix}-attempts-per-interval`}
            type="number"
            min={1}
            value={input.maxAttemptsPerInterval}
            onChange={(event) =>
              setInput((current) => ({ ...current, maxAttemptsPerInterval: event.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${scopePrefix}-interval-value`}>Interval Value</Label>
          <Input
            id={`${scopePrefix}-interval-value`}
            type="number"
            min={1}
            value={input.intervalValue}
            onChange={(event) =>
              setInput((current) => ({ ...current, intervalValue: event.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${scopePrefix}-interval-unit`}>Interval Unit</Label>
          <Select
            value={input.intervalUnit}
            onValueChange={(value) =>
              setInput((current) => ({ ...current, intervalUnit: value as AttemptIntervalUnit }))
            }
          >
            <SelectTrigger id={`${scopePrefix}-interval-unit`}>
              <SelectValue placeholder="Select interval unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${scopePrefix}-interval-attempt-price`}>Instant Attempt Price (INR)</Label>
          <Input
            id={`${scopePrefix}-interval-attempt-price`}
            type="number"
            min={0}
            step="0.01"
            value={input.intervalAttemptPrice}
            onChange={(event) =>
              setInput((current) => ({ ...current, intervalAttemptPrice: event.target.value }))
            }
          />
        </div>
      </div>
    ) : null}
  </div>
);

const TeacherView: FC<{
  plans: SubscriptionPlan[];
  examTypes: ExamType[];
  classes: Class[];
  subjects: Subject[];
  topics: Topic[];
  paidCourses: PaidCourse[];
  paidMockTests: PaidMockTest[];
  paidLiveBatches: PaidLiveBatch[];
  teacherOffers: TeacherOffer[];
  initialLinkedContent?: LinkedContentSeed | null;
}> = ({ plans, examTypes, classes, subjects, topics, paidCourses, paidMockTests, paidLiveBatches, teacherOffers, initialLinkedContent = null }) => {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const allowStandaloneMockTests = isAllowedTeacherAuthorEmail(user?.email);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addDialogSeed, setAddDialogSeed] = useState<LinkedContentSeed | null>(initialLinkedContent);
  const [planToEdit, setPlanToEdit] = useState<SubscriptionPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<SubscriptionPlan | null>(null);
  const [offerToDelete, setOfferToDelete] = useState<TeacherOffer | null>(null);
  const [isDeletingOffer, setIsDeletingOffer] = useState(false);
  const [premiumPracticePriceInput, setPremiumPracticePriceInput] = useState({
    easy: '0',
    medium: '0',
    hard: '0',
  });
  const [selectedPracticeExamTypeId, setSelectedPracticeExamTypeId] = useState('');
  const [selectedPracticeClassId, setSelectedPracticeClassId] = useState('');
  const [selectedPracticeSubjectId, setSelectedPracticeSubjectId] = useState('');
  const [selectedPracticeTopicId, setSelectedPracticeTopicId] = useState('');
  const [selectedPracticeSubtopicPath, setSelectedPracticeSubtopicPath] = useState('');
  const [premiumPracticeAttemptInput, setPremiumPracticeAttemptInput] = useState<{
    mode: AttemptLimitMode;
    maxTotalAttempts: string;
    maxAttemptsPerInterval: string;
    intervalValue: string;
    intervalUnit: AttemptIntervalUnit;
    rechargePrice: string;
    intervalAttemptPrice: string;
  }>({
    mode: 'unlimited',
    maxTotalAttempts: '1',
    maxAttemptsPerInterval: '1',
    intervalValue: '1',
    intervalUnit: 'week',
    rechargePrice: '0',
    intervalAttemptPrice: '0',
  });
  const [premiumMockTestPriceInput, setPremiumMockTestPriceInput] = useState({
    easy: '0',
    medium: '0',
    hard: '0',
  });
  const [selectedMockExamTypeId, setSelectedMockExamTypeId] = useState('');
  const [selectedMockClassId, setSelectedMockClassId] = useState('');
  const [selectedMockSubjectId, setSelectedMockSubjectId] = useState('');
  const [selectedMockTopicId, setSelectedMockTopicId] = useState('');
  const [selectedMockSubtopicPath, setSelectedMockSubtopicPath] = useState('');
  const [premiumMockAttemptInput, setPremiumMockAttemptInput] = useState<{
    mode: AttemptLimitMode;
    maxTotalAttempts: string;
    maxAttemptsPerInterval: string;
    intervalValue: string;
    intervalUnit: AttemptIntervalUnit;
    rechargePrice: string;
    intervalAttemptPrice: string;
  }>({
    mode: 'unlimited',
    maxTotalAttempts: '1',
    maxAttemptsPerInterval: '1',
    intervalValue: '1',
    intervalUnit: 'week',
    rechargePrice: '0',
    intervalAttemptPrice: '0',
  });
  const [isSavingPremiumPracticePrice, setIsSavingPremiumPracticePrice] = useState(false);
  const [isSavingPremiumMockTestPrice, setIsSavingPremiumMockTestPrice] = useState(false);
  const [isSavingPremiumMockTestAttemptRule, setIsSavingPremiumMockTestAttemptRule] = useState(false);
  const initialSeedHandled = useRef(false);
  const teacherProfileRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user?.uid]
  );
  const pricingOwnerQuery = useMemoFirebase(
    () => (
      firestore
        ? query(collection(firestore, 'users'), where('email', '==', ALLOWED_TEACHER_AUTHOR_EMAIL), limit(1))
        : null
    ),
    [firestore]
  );
  const teacherQuestionPurchasesQuery = useMemoFirebase(
    () => (
      firestore && user?.uid
        ? query(collection(firestore, 'users', user.uid, 'teacher_question_purchases'), orderBy('purchasedAt', 'desc'))
        : null
    ),
    [firestore, user?.uid]
  );
  const { data: teacherSubscriptionSettings } = useDoc<TeacherSubscriptionSettings>(teacherProfileRef);
  const { data: pricingOwnerRowsRaw } = useCollection<PricingOwnerProfile>(pricingOwnerQuery);
  const pricingOwner = useMemo(
    () => (Array.isArray(pricingOwnerRowsRaw) ? pricingOwnerRowsRaw[0] || null : null),
    [pricingOwnerRowsRaw]
  );
  const pricingQuestionsQuery = useMemoFirebase(
    () => (
      firestore && pricingOwner?.id
        ? query(collection(firestore, 'practice_questions'), where('teacherId', '==', pricingOwner.id))
        : null
    ),
    [firestore, pricingOwner?.id]
  );
  const { data: teacherQuestionPurchasesRaw } = useCollection<TeacherQuestionPurchaseDoc>(teacherQuestionPurchasesQuery);
  const { data: pricingQuestionsRaw } = useCollection<PricingScopeQuestion>(pricingQuestionsQuery);
  const teacherQuestionPurchases = useMemo(
    () => (Array.isArray(teacherQuestionPurchasesRaw) ? teacherQuestionPurchasesRaw : []),
    [teacherQuestionPurchasesRaw]
  );
  const pricingQuestions = useMemo(
    () => (Array.isArray(pricingQuestionsRaw) ? pricingQuestionsRaw : []),
    [pricingQuestionsRaw]
  );
  const examTypeNameById = useMemo(
    () => examTypes.reduce((acc, examType) => ({ ...acc, [examType.id]: examType.name }), {} as Record<string, string>),
    [examTypes]
  );
  const classNameById = useMemo(
    () => classes.reduce((acc, classItem) => ({ ...acc, [classItem.id]: classItem.name }), {} as Record<string, string>),
    [classes]
  );
  const subjectNameById = useMemo(
    () => subjects.reduce((acc, subject) => ({ ...acc, [subject.id]: subject.name }), {} as Record<string, string>),
    [subjects]
  );
  const topicNameById = useMemo(
    () => topics.reduce((acc, topic) => ({ ...acc, [topic.id]: topic.name }), {} as Record<string, string>),
    [topics]
  );
  const premiumPracticePricingByScope = useMemo(
    () => normalizeScopedDifficultyPricingMap(teacherSubscriptionSettings?.premiumPracticeQuestionPricingByScope),
    [teacherSubscriptionSettings?.premiumPracticeQuestionPricingByScope]
  );
  const premiumPracticeAttemptPricingByScope = useMemo(
    () => normalizePremiumPracticeAttemptPricingMap(teacherSubscriptionSettings?.premiumPracticeAttemptPricingByScope),
    [teacherSubscriptionSettings?.premiumPracticeAttemptPricingByScope]
  );
  const premiumMockTestPricingByScope = useMemo(
    () => normalizeScopedDifficultyPricingMap(teacherSubscriptionSettings?.premiumMockTestQuestionPricingByScope),
    [teacherSubscriptionSettings?.premiumMockTestQuestionPricingByScope]
  );
  const premiumMockTestAttemptPricingByScope = useMemo(
    () => normalizePremiumCustomMockAttemptPricingMap(teacherSubscriptionSettings?.premiumMockTestAttemptPricingByScope),
    [teacherSubscriptionSettings?.premiumMockTestAttemptPricingByScope]
  );
  const paidTeacherQuestionPurchases = useMemo(
    () => teacherQuestionPurchases.filter((purchase) => (purchase.status || 'paid') === 'paid'),
    [teacherQuestionPurchases]
  );
  const purchasedPricingScopeEntries = useMemo(() => {
    return pricingQuestions
      .flatMap((question) => buildPracticeQuestionScopeEntries(question))
      .filter((entry) => entry.accessLevel === 'paid' && !entry.mockTestOnly)
      .filter((entry) => paidTeacherQuestionPurchases.some((purchase) => purchaseCoversPricingScopeEntry(purchase, entry)));
  }, [paidTeacherQuestionPurchases, pricingQuestions]);
  const buildPurchasedScopeOptions = (
    selectedExamTypeId: string,
    selectedClassId: string,
    selectedSubjectId: string,
    selectedTopicId: string
  ): PurchasedPricingScopeOptions => {
    const availableExamTypes = Array.from(new Set(purchasedPricingScopeEntries.map((entry) => entry.examTypeId)))
      .map((examTypeId) => examTypes.find((examType) => examType.id === examTypeId) || { id: examTypeId, name: examTypeNameById[examTypeId] || examTypeId })
      .sort((left, right) => (left.name || left.id).localeCompare(right.name || right.id));

    const availableClasses = Array.from(
      new Set(
        purchasedPricingScopeEntries
          .filter((entry) => entry.examTypeId === selectedExamTypeId)
          .map((entry) => entry.classId)
      )
    )
      .map((classId) => classes.find((classItem) => classItem.id === classId) || { id: classId, name: classNameById[classId] || classId, examTypeId: selectedExamTypeId })
      .sort((left, right) => (left.name || left.id).localeCompare(right.name || right.id));

    const availableSubjects = Array.from(
      new Set(
        purchasedPricingScopeEntries
          .filter((entry) => entry.examTypeId === selectedExamTypeId && entry.classId === selectedClassId)
          .map((entry) => entry.subjectId)
      )
    )
      .map((subjectId) => subjects.find((subject) => subject.id === subjectId) || { id: subjectId, name: subjectNameById[subjectId] || subjectId, classId: selectedClassId })
      .sort((left, right) => (left.name || left.id).localeCompare(right.name || right.id));

    const availableTopics = Array.from(
      new Set(
        purchasedPricingScopeEntries
          .filter((entry) =>
            entry.examTypeId === selectedExamTypeId
            && entry.classId === selectedClassId
            && entry.subjectId === selectedSubjectId
          )
          .map((entry) => entry.topicId)
      )
    )
      .map((topicId) => topics.find((topic) => topic.id === topicId) || { id: topicId, name: topicNameById[topicId] || topicId, subjectId: selectedSubjectId })
      .sort((left, right) => (left.name || left.id).localeCompare(right.name || right.id));

    const canUseSubjectWideScope = paidTeacherQuestionPurchases.some((purchase) =>
      purchase.examTypeId === selectedExamTypeId
      && purchase.classId === selectedClassId
      && purchase.subjectId === selectedSubjectId
      && !String(purchase.topicId || '').trim()
    );

    const availableSubtopics = Array.from(
      new Set(
        purchasedPricingScopeEntries
          .filter((entry) =>
            entry.examTypeId === selectedExamTypeId
            && entry.classId === selectedClassId
            && entry.subjectId === selectedSubjectId
            && entry.topicId === selectedTopicId
          )
          .flatMap((entry) => entry.subtopics || [])
          .map((path) => normalizeSubtopicScopePath(path))
          .filter(Boolean)
      )
    )
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({
        value,
        label: splitSubtopicPath(value).join(' / ') || value,
      }));

    const canUseTopicWideScope = !selectedTopicId || availableSubtopics.length === 0
      ? false
      : paidTeacherQuestionPurchases.some((purchase) =>
        purchase.examTypeId === selectedExamTypeId
        && purchase.classId === selectedClassId
        && purchase.subjectId === selectedSubjectId
        && (
          !String(purchase.topicId || '').trim()
          || (
            String(purchase.topicId || '').trim() === selectedTopicId
            && !normalizeSubtopicScopePath(purchase.subtopicPath)
          )
        )
      );

    return {
      examTypes: availableExamTypes,
      classes: availableClasses,
      subjects: availableSubjects,
      topics: availableTopics,
      subtopics: availableSubtopics,
      canUseSubjectWideScope,
      canUseTopicWideScope,
    };
  };
  const practiceScopeOptions = useMemo(
    () => buildPurchasedScopeOptions(selectedPracticeExamTypeId, selectedPracticeClassId, selectedPracticeSubjectId, selectedPracticeTopicId),
    [
      selectedPracticeExamTypeId,
      selectedPracticeClassId,
      selectedPracticeSubjectId,
      selectedPracticeTopicId,
      purchasedPricingScopeEntries,
      paidTeacherQuestionPurchases,
      examTypes,
      classes,
      subjects,
      topics,
      examTypeNameById,
      classNameById,
      subjectNameById,
      topicNameById,
    ]
  );
  const mockScopeOptions = useMemo(
    () => buildPurchasedScopeOptions(selectedMockExamTypeId, selectedMockClassId, selectedMockSubjectId, selectedMockTopicId),
    [
      selectedMockExamTypeId,
      selectedMockClassId,
      selectedMockSubjectId,
      selectedMockTopicId,
      purchasedPricingScopeEntries,
      paidTeacherQuestionPurchases,
      examTypes,
      classes,
      subjects,
      topics,
      examTypeNameById,
      classNameById,
      subjectNameById,
      topicNameById,
    ]
  );
  const premiumPracticeQuestionPriceByDifficulty = useMemo(() => {
    return resolveScopedDifficultyPricing({
      legacyPrice: teacherSubscriptionSettings?.premiumPracticeQuestionPrice,
      globalPricing: teacherSubscriptionSettings?.premiumPracticeQuestionPriceByDifficulty,
      scopedPricingMap: premiumPracticePricingByScope,
      examTypeId: selectedPracticeExamTypeId,
      classId: selectedPracticeClassId,
      subjectId: selectedPracticeSubjectId,
      topicId: selectedPracticeTopicId,
      subtopicPath: selectedPracticeSubtopicPath,
    });
  }, [
    teacherSubscriptionSettings?.premiumPracticeQuestionPrice,
    teacherSubscriptionSettings?.premiumPracticeQuestionPriceByDifficulty,
    premiumPracticePricingByScope,
    selectedPracticeExamTypeId,
    selectedPracticeClassId,
    selectedPracticeSubjectId,
    selectedPracticeTopicId,
    selectedPracticeSubtopicPath,
  ]);

  const premiumMockTestQuestionPriceByDifficulty = useMemo(() => {
    return resolveScopedDifficultyPricing({
      legacyPrice: teacherSubscriptionSettings?.premiumMockTestQuestionPrice,
      globalPricing: teacherSubscriptionSettings?.premiumMockTestQuestionPriceByDifficulty,
      scopedPricingMap: premiumMockTestPricingByScope,
      examTypeId: selectedMockExamTypeId,
      classId: selectedMockClassId,
      subjectId: selectedMockSubjectId,
      topicId: selectedMockTopicId,
      subtopicPath: selectedMockSubtopicPath,
    });
  }, [
    teacherSubscriptionSettings?.premiumMockTestQuestionPrice,
    teacherSubscriptionSettings?.premiumMockTestQuestionPriceByDifficulty,
    premiumMockTestPricingByScope,
    selectedMockExamTypeId,
    selectedMockClassId,
    selectedMockSubjectId,
    selectedMockTopicId,
    selectedMockSubtopicPath,
  ]);
  const selectedMockAttemptRule = useMemo(() => {
    const scopedRule = resolvePremiumCustomMockAttemptPricingRule({
      scopedPricingMap: premiumMockTestAttemptPricingByScope,
      examTypeId: selectedMockExamTypeId,
      classId: selectedMockClassId,
    });
    const scopeKey = buildPricingScopeKey(selectedMockExamTypeId, selectedMockClassId);
    if (scopeKey && premiumMockTestAttemptPricingByScope[scopeKey]) {
      return scopedRule;
    }
    return buildPremiumCustomMockAttemptRuleFromLegacyLimit(teacherSubscriptionSettings?.premiumMockTestAttemptLimit);
  }, [
    premiumMockTestAttemptPricingByScope,
    selectedMockExamTypeId,
    selectedMockClassId,
    teacherSubscriptionSettings?.premiumMockTestAttemptLimit,
  ]);
  const selectedPracticeAttemptRule = useMemo(
    () => resolvePremiumPracticeAttemptPricingRule({
      scopedPricingMap: premiumPracticeAttemptPricingByScope,
      examTypeId: selectedPracticeExamTypeId,
      classId: selectedPracticeClassId,
    }),
    [premiumPracticeAttemptPricingByScope, selectedPracticeExamTypeId, selectedPracticeClassId]
  );

  useEffect(() => {
    setPremiumPracticePriceInput({
      easy: String(premiumPracticeQuestionPriceByDifficulty.easy),
      medium: String(premiumPracticeQuestionPriceByDifficulty.medium),
      hard: String(premiumPracticeQuestionPriceByDifficulty.hard),
    });
  }, [premiumPracticeQuestionPriceByDifficulty]);

  useEffect(() => {
    setPremiumPracticeAttemptInput({
      mode: selectedPracticeAttemptRule.mode,
      maxTotalAttempts: String(selectedPracticeAttemptRule.maxTotalAttempts ?? 1),
      maxAttemptsPerInterval: String(selectedPracticeAttemptRule.maxAttemptsPerInterval ?? 1),
      intervalValue: String(selectedPracticeAttemptRule.intervalValue ?? 1),
      intervalUnit: selectedPracticeAttemptRule.intervalUnit || 'week',
      rechargePrice: String(selectedPracticeAttemptRule.rechargePrice ?? 0),
      intervalAttemptPrice: String(selectedPracticeAttemptRule.intervalAttemptPrice ?? 0),
    });
  }, [selectedPracticeAttemptRule]);

  useEffect(() => {
    setPremiumMockTestPriceInput({
      easy: String(premiumMockTestQuestionPriceByDifficulty.easy),
      medium: String(premiumMockTestQuestionPriceByDifficulty.medium),
      hard: String(premiumMockTestQuestionPriceByDifficulty.hard),
    });
  }, [premiumMockTestQuestionPriceByDifficulty]);

  useEffect(() => {
    setPremiumMockAttemptInput({
      mode: selectedMockAttemptRule.mode,
      maxTotalAttempts: String(selectedMockAttemptRule.maxTotalAttempts ?? 1),
      maxAttemptsPerInterval: String(selectedMockAttemptRule.maxAttemptsPerInterval ?? 1),
      intervalValue: String(selectedMockAttemptRule.intervalValue ?? 1),
      intervalUnit: selectedMockAttemptRule.intervalUnit || 'week',
      rechargePrice: String(selectedMockAttemptRule.rechargePrice ?? 0),
      intervalAttemptPrice: String(selectedMockAttemptRule.intervalAttemptPrice ?? 0),
    });
  }, [selectedMockAttemptRule]);

  useEffect(() => {
    if (practiceScopeOptions.examTypes.length === 0) {
      if (selectedPracticeExamTypeId) setSelectedPracticeExamTypeId('');
      return;
    }
    if (practiceScopeOptions.examTypes.some((examType) => examType.id === selectedPracticeExamTypeId)) return;
    setSelectedPracticeExamTypeId(practiceScopeOptions.examTypes[0].id);
  }, [practiceScopeOptions.examTypes, selectedPracticeExamTypeId]);

  useEffect(() => {
    if (practiceScopeOptions.classes.length === 0) {
      if (selectedPracticeClassId) setSelectedPracticeClassId('');
      return;
    }
    if (practiceScopeOptions.classes.some((classItem) => classItem.id === selectedPracticeClassId)) return;
    setSelectedPracticeClassId(practiceScopeOptions.classes[0].id);
  }, [practiceScopeOptions.classes, selectedPracticeClassId]);

  useEffect(() => {
    if (practiceScopeOptions.subjects.length === 0) {
      if (selectedPracticeSubjectId) setSelectedPracticeSubjectId('');
      return;
    }
    if (practiceScopeOptions.subjects.some((subject) => subject.id === selectedPracticeSubjectId)) return;
    setSelectedPracticeSubjectId(practiceScopeOptions.subjects[0].id);
  }, [practiceScopeOptions.subjects, selectedPracticeSubjectId]);

  useEffect(() => {
    if (practiceScopeOptions.topics.length === 0) {
      if (selectedPracticeTopicId) setSelectedPracticeTopicId('');
      return;
    }
    if (selectedPracticeTopicId && practiceScopeOptions.topics.some((topic) => topic.id === selectedPracticeTopicId)) return;
    if (practiceScopeOptions.canUseSubjectWideScope) {
      if (selectedPracticeTopicId) setSelectedPracticeTopicId('');
      return;
    }
    setSelectedPracticeTopicId(practiceScopeOptions.topics[0].id);
  }, [practiceScopeOptions.canUseSubjectWideScope, practiceScopeOptions.topics, selectedPracticeTopicId]);

  useEffect(() => {
    if (!selectedPracticeTopicId) {
      if (selectedPracticeSubtopicPath) setSelectedPracticeSubtopicPath('');
      return;
    }
    if (practiceScopeOptions.subtopics.length === 0) {
      if (selectedPracticeSubtopicPath) setSelectedPracticeSubtopicPath('');
      return;
    }
    if (
      selectedPracticeSubtopicPath
      && practiceScopeOptions.subtopics.some((subtopic) => subtopic.value === selectedPracticeSubtopicPath)
    ) {
      return;
    }
    if (practiceScopeOptions.canUseTopicWideScope) {
      if (selectedPracticeSubtopicPath) setSelectedPracticeSubtopicPath('');
      return;
    }
    setSelectedPracticeSubtopicPath(practiceScopeOptions.subtopics[0].value);
  }, [
    practiceScopeOptions.canUseTopicWideScope,
    practiceScopeOptions.subtopics,
    selectedPracticeSubtopicPath,
    selectedPracticeTopicId,
  ]);

  useEffect(() => {
    if (mockScopeOptions.examTypes.length === 0) {
      if (selectedMockExamTypeId) setSelectedMockExamTypeId('');
      return;
    }
    if (mockScopeOptions.examTypes.some((examType) => examType.id === selectedMockExamTypeId)) return;
    setSelectedMockExamTypeId(mockScopeOptions.examTypes[0].id);
  }, [mockScopeOptions.examTypes, selectedMockExamTypeId]);

  useEffect(() => {
    if (mockScopeOptions.classes.length === 0) {
      if (selectedMockClassId) setSelectedMockClassId('');
      return;
    }
    if (mockScopeOptions.classes.some((classItem) => classItem.id === selectedMockClassId)) return;
    setSelectedMockClassId(mockScopeOptions.classes[0].id);
  }, [mockScopeOptions.classes, selectedMockClassId]);

  useEffect(() => {
    if (mockScopeOptions.subjects.length === 0) {
      if (selectedMockSubjectId) setSelectedMockSubjectId('');
      return;
    }
    if (mockScopeOptions.subjects.some((subject) => subject.id === selectedMockSubjectId)) return;
    setSelectedMockSubjectId(mockScopeOptions.subjects[0].id);
  }, [mockScopeOptions.subjects, selectedMockSubjectId]);

  useEffect(() => {
    if (mockScopeOptions.topics.length === 0) {
      if (selectedMockTopicId) setSelectedMockTopicId('');
      return;
    }
    if (selectedMockTopicId && mockScopeOptions.topics.some((topic) => topic.id === selectedMockTopicId)) return;
    if (mockScopeOptions.canUseSubjectWideScope) {
      if (selectedMockTopicId) setSelectedMockTopicId('');
      return;
    }
    setSelectedMockTopicId(mockScopeOptions.topics[0].id);
  }, [mockScopeOptions.canUseSubjectWideScope, mockScopeOptions.topics, selectedMockTopicId]);

  useEffect(() => {
    if (!selectedMockTopicId) {
      if (selectedMockSubtopicPath) setSelectedMockSubtopicPath('');
      return;
    }
    if (mockScopeOptions.subtopics.length === 0) {
      if (selectedMockSubtopicPath) setSelectedMockSubtopicPath('');
      return;
    }
    if (selectedMockSubtopicPath && mockScopeOptions.subtopics.some((subtopic) => subtopic.value === selectedMockSubtopicPath)) {
      return;
    }
    if (mockScopeOptions.canUseTopicWideScope) {
      if (selectedMockSubtopicPath) setSelectedMockSubtopicPath('');
      return;
    }
    setSelectedMockSubtopicPath(mockScopeOptions.subtopics[0].value);
  }, [
    mockScopeOptions.canUseTopicWideScope,
    mockScopeOptions.subtopics,
    selectedMockSubtopicPath,
    selectedMockTopicId,
  ]);

  const paidCourseIdSet = useMemo(() => new Set((paidCourses || []).map((course) => course.id)), [paidCourses]);
  const paidMockTestIdSet = useMemo(() => new Set((paidMockTests || []).map((test) => test.id)), [paidMockTests]);
  const paidLiveBatchIdSet = useMemo(() => new Set((paidLiveBatches || []).map((batch) => batch.id)), [paidLiveBatches]);

  const teacherPlans = useMemo(() => {
    return (plans || []).filter((plan) => {
      if (plan.linkedContentType === 'mock_test' && !allowStandaloneMockTests) return false;
      if (plan.createdByTeacherId === user?.uid) return true;
      if (!plan.linkedContentType || !plan.linkedContentId) return false;
      if (plan.linkedContentType === 'course') return paidCourseIdSet.has(plan.linkedContentId);
      if (plan.linkedContentType === 'mock_test') return allowStandaloneMockTests && paidMockTestIdSet.has(plan.linkedContentId);
      if (plan.linkedContentType === 'live_batch') return paidLiveBatchIdSet.has(plan.linkedContentId);
      return false;
    });
  }, [plans, user?.uid, allowStandaloneMockTests, paidCourseIdSet, paidMockTestIdSet, paidLiveBatchIdSet]);

  const linkedCourseIds = useMemo(() => {
    return new Set(
      (plans || [])
        .filter((plan) => plan.linkedContentType === 'course' && !!plan.linkedContentId)
        .map((plan) => plan.linkedContentId as string)
    );
  }, [plans]);
  const linkedMockTestIds = useMemo(() => {
    return new Set(
      (plans || [])
        .filter((plan) => plan.linkedContentType === 'mock_test' && !!plan.linkedContentId)
        .map((plan) => plan.linkedContentId as string)
    );
  }, [plans]);
  const linkedLiveBatchIds = useMemo(() => {
    return new Set(
      (plans || [])
        .filter((plan) => plan.linkedContentType === 'live_batch' && !!plan.linkedContentId)
        .map((plan) => plan.linkedContentId as string)
    );
  }, [plans]);

  const waitingCourses = useMemo(
    () => (paidCourses || []).filter((course) => course.subscriptionAttached !== true && !linkedCourseIds.has(course.id)),
    [paidCourses, linkedCourseIds]
  );
  const waitingMockTests = useMemo(
    () => allowStandaloneMockTests
      ? (paidMockTests || []).filter((test) => test.subscriptionAttached !== true && !linkedMockTestIds.has(test.id))
      : [],
    [allowStandaloneMockTests, paidMockTests, linkedMockTestIds]
  );
  const waitingLiveBatches = useMemo(
    () => (paidLiveBatches || []).filter((batch) => batch.subscriptionAttached !== true && !linkedLiveBatchIds.has(batch.id)),
    [paidLiveBatches, linkedLiveBatchIds]
  );

  const paidContentCount = paidCourses.length + (allowStandaloneMockTests ? paidMockTests.length : 0) + paidLiveBatches.length;
  const waitingContentCount = waitingCourses.length + waitingMockTests.length + waitingLiveBatches.length;
  const readyContentCount = Math.max(0, paidContentCount - waitingContentCount);
  const createdPlanCount = teacherPlans.length;
  const sortedTeacherOffers = useMemo(() => {
    return teacherOffers
      .filter((offer) => String(offer.status || 'active') !== 'archived')
      .sort((left, right) => {
      const leftTime = toDate(left.updatedAt)?.getTime() || toDate(left.createdAt)?.getTime() || 0;
      const rightTime = toDate(right.updatedAt)?.getTime() || toDate(right.createdAt)?.getTime() || 0;
      return rightTime - leftTime;
    });
  }, [teacherOffers]);

  const waitingSummary = [
    { key: 'courses', title: 'Courses Waiting', count: waitingCourses.length, note: 'Pending plan attachment', Icon: BookOpen },
    ...(allowStandaloneMockTests
      ? [{ key: 'tests', title: 'Mock Tests Waiting', count: waitingMockTests.length, note: 'Pending plan attachment', Icon: FileText }]
      : []),
    { key: 'batches', title: 'Live Batches Waiting', count: waitingLiveBatches.length, note: 'Pending plan attachment', Icon: Video },
  ] as const;

  const getLinkedTypeLabel = (linkedType?: LinkedContentType) => {
    if (linkedType === 'course') return 'Course';
    if (linkedType === 'mock_test') return 'Mock Test';
    if (linkedType === 'live_batch') return 'Live Batch';
    return 'Plan';
  };

  const courseMap = useMemo(() => paidCourses.reduce((acc, c) => ({ ...acc, [c.id]: c.title }), {} as Record<string, string>), [paidCourses]);
  const mockTestMap = useMemo(() => paidMockTests.reduce((acc, t) => ({ ...acc, [t.id]: t.title }), {} as Record<string, string>), [paidMockTests]);
  const liveBatchMap = useMemo(() => paidLiveBatches.reduce((acc, b) => ({ ...acc, [b.id]: b.title }), {} as Record<string, string>), [paidLiveBatches]);

  const getLinkedLabel = (plan: SubscriptionPlan) => {
    if (plan.linkedContentType === 'course') return `Course: ${courseMap[plan.linkedContentId || ''] || 'Unknown Course'}`;
    if (plan.linkedContentType === 'mock_test') return `Mock Test: ${mockTestMap[plan.linkedContentId || ''] || 'Unknown Test'}`;
    if (plan.linkedContentType === 'live_batch') return `Live Batch: ${liveBatchMap[plan.linkedContentId || ''] || 'Unknown Live Batch'}`;
    return 'Linked content unavailable';
  };

  const practicePricingRules = useMemo(() => {
    return Object.keys(premiumPracticePricingByScope)
      .map((key) => {
        const pricingRule = premiumPracticePricingByScope[key];
        const examTypeId = pricingRule?.examTypeId || '';
        const classId = pricingRule?.classId || '';
        const subjectId = String(pricingRule?.subjectId || '').trim();
        const topicId = String(pricingRule?.topicId || '').trim();
        const subtopicPath = normalizeSubtopicScopePath(pricingRule?.subtopicPath);
        const attemptRule = premiumPracticeAttemptPricingByScope[buildPricingScopeKey(examTypeId, classId)];
        return {
          key,
          examTypeId,
          classId,
          ...(subjectId ? { subjectId } : {}),
          ...(topicId ? { topicId } : {}),
          ...(subtopicPath ? { subtopicPath } : {}),
          examTypeName: examTypeNameById[examTypeId] || 'Unknown exam',
          className: classNameById[classId] || 'Unknown curriculum',
          subjectName: subjectId ? subjectNameById[subjectId] || subjectId : undefined,
          topicName: topicId ? topicNameById[topicId] || topicId : undefined,
          subtopicLabel: subtopicPath ? splitSubtopicPath(subtopicPath).join(' / ') || subtopicPath : undefined,
          pricing: normalizeDifficultyPricing(pricingRule, 0),
          attemptSummary: formatPremiumPracticeAttemptPricingRule(attemptRule),
        };
      })
      .filter((rule) =>
        purchasedPricingScopeEntries.some((entry) => pricingRuleMatchesPurchasedEntry(rule, entry))
      )
      .sort((left, right) => {
        return [left.examTypeName, left.className, left.subjectName || '', left.topicName || '', left.subtopicLabel || '']
          .join(' / ')
          .localeCompare([right.examTypeName, right.className, right.subjectName || '', right.topicName || '', right.subtopicLabel || ''].join(' / '));
      });
  }, [
    premiumPracticePricingByScope,
    premiumPracticeAttemptPricingByScope,
    examTypeNameById,
    classNameById,
    subjectNameById,
    topicNameById,
    purchasedPricingScopeEntries,
  ]);

  const mockPricingRules = useMemo(() => {
    return Object.keys(premiumMockTestPricingByScope)
      .map((key) => {
        const pricingRule = premiumMockTestPricingByScope[key];
        const examTypeId = pricingRule?.examTypeId || '';
        const classId = pricingRule?.classId || '';
        const subjectId = String(pricingRule?.subjectId || '').trim();
        const topicId = String(pricingRule?.topicId || '').trim();
        const subtopicPath = normalizeSubtopicScopePath(pricingRule?.subtopicPath);
        const attemptRule = premiumMockTestAttemptPricingByScope[buildPricingScopeKey(examTypeId, classId)];
        return {
          key,
          examTypeId,
          classId,
          ...(subjectId ? { subjectId } : {}),
          ...(topicId ? { topicId } : {}),
          ...(subtopicPath ? { subtopicPath } : {}),
          examTypeName: examTypeNameById[examTypeId] || 'Unknown exam',
          className: classNameById[classId] || 'Unknown curriculum',
          subjectName: subjectId ? subjectNameById[subjectId] || subjectId : undefined,
          topicName: topicId ? topicNameById[topicId] || topicId : undefined,
          subtopicLabel: subtopicPath ? splitSubtopicPath(subtopicPath).join(' / ') || subtopicPath : undefined,
          pricing: normalizeDifficultyPricing(pricingRule, 0),
          attemptSummary: formatPremiumCustomMockAttemptPricingRule(attemptRule),
        };
      })
      .filter((rule) =>
        purchasedPricingScopeEntries.some((entry) => pricingRuleMatchesPurchasedEntry(rule, entry))
      )
      .sort((left, right) => {
        return [left.examTypeName, left.className, left.subjectName || '', left.topicName || '', left.subtopicLabel || '']
          .join(' / ')
          .localeCompare([right.examTypeName, right.className, right.subjectName || '', right.topicName || '', right.subtopicLabel || ''].join(' / '));
      });
  }, [
    premiumMockTestPricingByScope,
    premiumMockTestAttemptPricingByScope,
    examTypeNameById,
    classNameById,
    subjectNameById,
    topicNameById,
    purchasedPricingScopeEntries,
  ]);

  useEffect(() => {
    if (!initialLinkedContent || initialSeedHandled.current) return;
    initialSeedHandled.current = true;

    const exists =
      (initialLinkedContent.type === 'course' && waitingCourses.some((course) => course.id === initialLinkedContent.id)) ||
      (initialLinkedContent.type === 'mock_test' && allowStandaloneMockTests && waitingMockTests.some((test) => test.id === initialLinkedContent.id)) ||
      (initialLinkedContent.type === 'live_batch' && waitingLiveBatches.some((batch) => batch.id === initialLinkedContent.id));

    if (exists) {
      setAddDialogSeed(initialLinkedContent);
      setIsAddDialogOpen(true);
    }
  }, [initialLinkedContent, allowStandaloneMockTests, waitingCourses, waitingMockTests, waitingLiveBatches]);

  const openCreateDialog = (seed?: LinkedContentSeed) => {
    setAddDialogSeed(seed || null);
    setIsAddDialogOpen(true);
  };

  const handleSavePremiumPracticePrice = async () => {
    if (!firestore || !user?.uid) return;
    if (!selectedPracticeExamTypeId || !selectedPracticeClassId || !selectedPracticeSubjectId) {
      toast({
        variant: 'destructive',
        title: 'Select pricing scope',
        description: 'Choose exam, curriculum, and a purchased subject before saving practice pricing.',
      });
      return;
    }
    const easyPrice = Number(premiumPracticePriceInput.easy);
    const mediumPrice = Number(premiumPracticePriceInput.medium);
    const hardPrice = Number(premiumPracticePriceInput.hard);
    const normalizedAttemptRule = normalizePremiumPracticeAttemptPricingRule({
      examTypeId: selectedPracticeExamTypeId,
      classId: selectedPracticeClassId,
      mode: premiumPracticeAttemptInput.mode,
      maxTotalAttempts: Number(premiumPracticeAttemptInput.maxTotalAttempts),
      maxAttemptsPerInterval: Number(premiumPracticeAttemptInput.maxAttemptsPerInterval),
      intervalValue: Number(premiumPracticeAttemptInput.intervalValue),
      intervalUnit: premiumPracticeAttemptInput.intervalUnit,
      rechargePrice: Number(premiumPracticeAttemptInput.rechargePrice),
      intervalAttemptPrice: Number(premiumPracticeAttemptInput.intervalAttemptPrice),
    });
    if (
      !Number.isFinite(easyPrice) || easyPrice < 0 ||
      !Number.isFinite(mediumPrice) || mediumPrice < 0 ||
      !Number.isFinite(hardPrice) || hardPrice < 0
    ) {
      toast({
        variant: 'destructive',
        title: 'Invalid price',
        description: 'Enter valid non-negative prices for Easy, Medium, and Hard.',
      });
      return;
    }
    if (premiumPracticeAttemptInput.mode === 'total' && !normalizedAttemptRule.maxTotalAttempts) {
      toast({
        variant: 'destructive',
        title: 'Invalid total attempts',
        description: 'Set total attempts to 1 or more for this premium practice scope.',
      });
      return;
    }
    if (premiumPracticeAttemptInput.mode === 'total' && normalizedAttemptRule.rechargePrice < 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid recharge price',
        description: 'Recharge price must be zero or more.',
      });
      return;
    }
    if (
      premiumPracticeAttemptInput.mode === 'interval'
      && (!normalizedAttemptRule.maxAttemptsPerInterval || !normalizedAttemptRule.intervalValue || !normalizedAttemptRule.intervalUnit)
    ) {
      toast({
        variant: 'destructive',
        title: 'Invalid interval limit',
        description: 'Set attempts per interval, interval value, and interval unit for this premium practice scope.',
      });
      return;
    }
    if (premiumPracticeAttemptInput.mode === 'interval' && normalizedAttemptRule.intervalAttemptPrice < 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid instant-attempt price',
        description: 'Instant-attempt price must be zero or more.',
      });
      return;
    }

    const normalizedPrices = {
      easy: Number(easyPrice.toFixed(2)),
      medium: Number(mediumPrice.toFixed(2)),
      hard: Number(hardPrice.toFixed(2)),
    };
    const scopeKey = buildPricingScopeKey(
      selectedPracticeExamTypeId,
      selectedPracticeClassId,
      selectedPracticeSubjectId,
      selectedPracticeTopicId,
      selectedPracticeSubtopicPath
    );
    const nextPricingMap: ScopedDifficultyPricingMap = {
      ...premiumPracticePricingByScope,
      [scopeKey]: {
        examTypeId: selectedPracticeExamTypeId,
        classId: selectedPracticeClassId,
        subjectId: selectedPracticeSubjectId,
        ...(selectedPracticeTopicId ? { topicId: selectedPracticeTopicId } : {}),
        ...(selectedPracticeSubtopicPath ? { subtopicPath: selectedPracticeSubtopicPath } : {}),
        ...normalizedPrices,
      },
    };
    const nextAttemptPricingMap: PremiumPracticeAttemptPricingMap = {
      ...premiumPracticeAttemptPricingByScope,
      [scopeKey]: normalizedAttemptRule,
    };
    setIsSavingPremiumPracticePrice(true);
    try {
      await updateDocumentNonBlocking(doc(firestore, 'users', user.uid), {
        premiumPracticeQuestionPricingByScope: nextPricingMap,
        premiumPracticeAttemptPricingByScope: nextAttemptPricingMap,
      });
      const practiceScopeLabel = [
        examTypeNameById[selectedPracticeExamTypeId] || 'Selected exam',
        classNameById[selectedPracticeClassId] || 'Selected curriculum',
        subjectNameById[selectedPracticeSubjectId] || 'Selected subject',
        selectedPracticeTopicId ? topicNameById[selectedPracticeTopicId] || selectedPracticeTopicId : '',
        selectedPracticeSubtopicPath ? splitSubtopicPath(selectedPracticeSubtopicPath).join(' / ') : '',
      ].filter(Boolean).join(' / ');
      toast({
        title: 'Price updated',
        description: `${practiceScopeLabel} practice pricing saved. Attempt rule stays linked to ${examTypeNameById[selectedPracticeExamTypeId] || 'the selected exam'} / ${classNameById[selectedPracticeClassId] || 'the selected curriculum'}.`,
      });
    } finally {
      setIsSavingPremiumPracticePrice(false);
    }
  };

  const handleSavePremiumMockTestPrice = async () => {
    if (!firestore || !user?.uid) return;
    if (!selectedMockExamTypeId || !selectedMockClassId || !selectedMockSubjectId) {
      toast({
        variant: 'destructive',
        title: 'Select pricing scope',
        description: 'Choose exam, curriculum, and a purchased subject before saving custom mock pricing.',
      });
      return;
    }
    const easyPrice = Number(premiumMockTestPriceInput.easy);
    const mediumPrice = Number(premiumMockTestPriceInput.medium);
    const hardPrice = Number(premiumMockTestPriceInput.hard);
    const normalizedAttemptRule = normalizePremiumCustomMockAttemptPricingRule({
      examTypeId: selectedMockExamTypeId,
      classId: selectedMockClassId,
      mode: premiumMockAttemptInput.mode,
      maxTotalAttempts: Number(premiumMockAttemptInput.maxTotalAttempts),
      maxAttemptsPerInterval: Number(premiumMockAttemptInput.maxAttemptsPerInterval),
      intervalValue: Number(premiumMockAttemptInput.intervalValue),
      intervalUnit: premiumMockAttemptInput.intervalUnit,
      rechargePrice: Number(premiumMockAttemptInput.rechargePrice),
      intervalAttemptPrice: Number(premiumMockAttemptInput.intervalAttemptPrice),
    });
    if (
      !Number.isFinite(easyPrice) || easyPrice < 0 ||
      !Number.isFinite(mediumPrice) || mediumPrice < 0 ||
      !Number.isFinite(hardPrice) || hardPrice < 0
    ) {
      toast({
        variant: 'destructive',
        title: 'Invalid price',
        description: 'Enter valid non-negative prices for Easy, Medium, and Hard.',
      });
      return;
    }
    if (premiumMockAttemptInput.mode === 'total' && !normalizedAttemptRule.maxTotalAttempts) {
      toast({
        variant: 'destructive',
        title: 'Invalid total attempts',
        description: 'Set total attempts to 1 or more for this custom mock scope.',
      });
      return;
    }
    if (premiumMockAttemptInput.mode === 'total' && normalizedAttemptRule.rechargePrice < 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid recharge price',
        description: 'Recharge price must be zero or more.',
      });
      return;
    }
    if (
      premiumMockAttemptInput.mode === 'interval'
      && (!normalizedAttemptRule.maxAttemptsPerInterval || !normalizedAttemptRule.intervalValue || !normalizedAttemptRule.intervalUnit)
    ) {
      toast({
        variant: 'destructive',
        title: 'Invalid interval limit',
        description: 'Set attempts per interval, interval value, and interval unit for this custom mock scope.',
      });
      return;
    }
    if (premiumMockAttemptInput.mode === 'interval' && normalizedAttemptRule.intervalAttemptPrice < 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid instant-attempt price',
        description: 'Instant-attempt price must be zero or more.',
      });
      return;
    }

    const normalizedPrices = {
      easy: Number(easyPrice.toFixed(2)),
      medium: Number(mediumPrice.toFixed(2)),
      hard: Number(hardPrice.toFixed(2)),
    };
    const scopeKey = buildPricingScopeKey(
      selectedMockExamTypeId,
      selectedMockClassId,
      selectedMockSubjectId,
      selectedMockTopicId,
      selectedMockSubtopicPath
    );
    const nextPricingMap: ScopedDifficultyPricingMap = {
      ...premiumMockTestPricingByScope,
      [scopeKey]: {
        examTypeId: selectedMockExamTypeId,
        classId: selectedMockClassId,
        subjectId: selectedMockSubjectId,
        ...(selectedMockTopicId ? { topicId: selectedMockTopicId } : {}),
        ...(selectedMockSubtopicPath ? { subtopicPath: selectedMockSubtopicPath } : {}),
        ...normalizedPrices,
      },
    };
    const nextAttemptPricingMap: PremiumCustomMockAttemptPricingMap = {
      ...premiumMockTestAttemptPricingByScope,
      [scopeKey]: normalizedAttemptRule,
    };
    setIsSavingPremiumMockTestPrice(true);
    try {
      await updateDocumentNonBlocking(doc(firestore, 'users', user.uid), {
        premiumMockTestQuestionPricingByScope: nextPricingMap,
        premiumMockTestAttemptPricingByScope: nextAttemptPricingMap,
      });
      const mockScopeLabel = [
        examTypeNameById[selectedMockExamTypeId] || 'Selected exam',
        classNameById[selectedMockClassId] || 'Selected curriculum',
        subjectNameById[selectedMockSubjectId] || 'Selected subject',
        selectedMockTopicId ? topicNameById[selectedMockTopicId] || selectedMockTopicId : '',
        selectedMockSubtopicPath ? splitSubtopicPath(selectedMockSubtopicPath).join(' / ') : '',
      ].filter(Boolean).join(' / ');
      toast({
        title: 'Price updated',
        description: `${mockScopeLabel} custom mock pricing saved. Attempt rule stays linked to ${examTypeNameById[selectedMockExamTypeId] || 'the selected exam'} / ${classNameById[selectedMockClassId] || 'the selected curriculum'}.`,
      });
    } finally {
      setIsSavingPremiumMockTestPrice(false);
    }
  };

  const handleDeletePracticePricingRule = async (rule: ScopedPricingRuleView) => {
    if (!firestore || !user?.uid) return;
    const nextPricingMap = { ...premiumPracticePricingByScope };
    delete nextPricingMap[rule.key];
    setIsSavingPremiumPracticePrice(true);
    try {
      await updateDocumentNonBlocking(doc(firestore, 'users', user.uid), {
        premiumPracticeQuestionPricingByScope: nextPricingMap,
      });
      toast({
        title: 'Practice pricing removed',
        description: `${[rule.examTypeName, rule.className, rule.subjectName, rule.topicName, rule.subtopicLabel].filter(Boolean).join(' / ')} practice pricing deleted. Attempt settings for the exam and curriculum stay unchanged.`,
      });
    } finally {
      setIsSavingPremiumPracticePrice(false);
    }
  };

  const handleDeleteMockPricingRule = async (rule: ScopedPricingRuleView) => {
    if (!firestore || !user?.uid) return;
    const nextPricingMap = { ...premiumMockTestPricingByScope };
    delete nextPricingMap[rule.key];
    setIsSavingPremiumMockTestPrice(true);
    try {
      await updateDocumentNonBlocking(doc(firestore, 'users', user.uid), {
        premiumMockTestQuestionPricingByScope: nextPricingMap,
      });
      toast({
        title: 'Custom mock pricing removed',
        description: `${[rule.examTypeName, rule.className, rule.subjectName, rule.topicName, rule.subtopicLabel].filter(Boolean).join(' / ')} custom mock pricing deleted. Attempt settings for the exam and curriculum stay unchanged.`,
      });
    } finally {
      setIsSavingPremiumMockTestPrice(false);
    }
  };

  const handleSavePremiumMockTestAttemptRule = async () => {
    if (!firestore || !user?.uid) return;
    if (!selectedMockExamTypeId || !selectedMockClassId) {
      toast({
        variant: 'destructive',
        title: 'Select pricing scope',
        description: 'Choose both exam and curriculum before saving mock-test attempt pricing.',
      });
      return;
    }
    const normalizedRule = normalizePremiumCustomMockAttemptPricingRule({
      examTypeId: selectedMockExamTypeId,
      classId: selectedMockClassId,
      mode: premiumMockAttemptInput.mode,
      maxTotalAttempts: Number(premiumMockAttemptInput.maxTotalAttempts),
      maxAttemptsPerInterval: Number(premiumMockAttemptInput.maxAttemptsPerInterval),
      intervalValue: Number(premiumMockAttemptInput.intervalValue),
      intervalUnit: premiumMockAttemptInput.intervalUnit,
      rechargePrice: Number(premiumMockAttemptInput.rechargePrice),
      intervalAttemptPrice: Number(premiumMockAttemptInput.intervalAttemptPrice),
    });

    if (premiumMockAttemptInput.mode === 'total' && !normalizedRule.maxTotalAttempts) {
      toast({
        variant: 'destructive',
        title: 'Invalid total attempts',
        description: 'Set total attempts to 1 or more.',
      });
      return;
    }
    if (
      premiumMockAttemptInput.mode === 'interval'
      && (!normalizedRule.maxAttemptsPerInterval || !normalizedRule.intervalValue || !normalizedRule.intervalUnit)
    ) {
      toast({
        variant: 'destructive',
        title: 'Invalid interval limit',
        description: 'Set attempts per interval, interval value, and interval unit.',
      });
      return;
    }

    const scopeKey = buildPricingScopeKey(selectedMockExamTypeId, selectedMockClassId);
    const nextAttemptPricingMap: PremiumCustomMockAttemptPricingMap = {
      ...premiumMockTestAttemptPricingByScope,
      [scopeKey]: normalizedRule,
    };

    setIsSavingPremiumMockTestAttemptRule(true);
    try {
      await updateDocumentNonBlocking(doc(firestore, 'users', user.uid), {
        premiumMockTestAttemptPricingByScope: nextAttemptPricingMap,
      });
      toast({
        title: 'Attempt settings updated',
        description: `Paid mock-test attempt rule saved: ${formatPremiumCustomMockAttemptPricingRule(normalizedRule)}.`,
      });
    } finally {
      setIsSavingPremiumMockTestAttemptRule(false);
    }
  };

  const handleDelete = async () => {
    if (!planToDelete) return;
    try {
      const affectedCourseId = planToDelete.linkedContentType === 'course' ? planToDelete.linkedContentId : null;
      const affectedMockTestId = planToDelete.linkedContentType === 'mock_test' ? planToDelete.linkedContentId : null;
      const affectedLiveBatchId = planToDelete.linkedContentType === 'live_batch' ? planToDelete.linkedContentId : null;
      await deleteDocumentNonBlocking(doc(firestore, 'subscription_plans', planToDelete.id));
      if (affectedCourseId) {
        await syncCourseSubscriptionAttached(firestore, affectedCourseId, user);
      }
      if (affectedMockTestId) {
        await syncMockTestSubscriptionAttached(firestore, affectedMockTestId, user);
      }
      if (affectedLiveBatchId) {
        await syncLiveBatchSubscriptionAttached(firestore, affectedLiveBatchId, user);
      }
      toast({ title: 'Plan Deleted', description: `"${planToDelete.name}" has been deleted.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: error.message || 'Could not delete plan.' });
    } finally {
      setPlanToDelete(null);
    }
  };

  const handleDeleteOffer = async () => {
    if (!offerToDelete?.id || !firestore) {
      setOfferToDelete(null);
      return;
    }

    const offerTitle = String(offerToDelete.title || 'Untitled Offer').trim() || 'Untitled Offer';

    try {
      setIsDeletingOffer(true);
      const result = await updateDocumentNonBlocking(doc(firestore, 'teacher_offers', offerToDelete.id), {
        status: 'archived',
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (result === null) {
        throw new Error('Could not archive the saved teacher offer.');
      }
      toast({
        title: 'Offer Removed',
        description: `"${offerTitle}" has been removed from your subscription page.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: error?.message || 'Could not delete the saved teacher offer.',
      });
    } finally {
      setIsDeletingOffer(false);
      setOfferToDelete(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-background/60 to-background/30 p-6">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Teacher Workspace
            </div>
            <div>
              <h2 className="font-headline text-3xl font-semibold tracking-tight">My Paid Content Subscriptions</h2>
              <p className="mt-1 text-sm text-muted-foreground">Attach subscription plans for all paid content waiting in each category.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1">Paid Content: {paidContentCount}</Badge>
              <Badge variant={waitingContentCount > 0 ? 'default' : 'secondary'} className="rounded-full px-3 py-1">Waiting: {waitingContentCount}</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">Ready: {readyContentCount}</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">Plans Created: {createdPlanCount}</Badge>
            </div>
          </div>
          <Dialog
            open={isAddDialogOpen}
            onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (!open) setAddDialogSeed(null);
            }}
          >
            <DialogTrigger asChild>
              <Button
                type="button"
                className="h-11 rounded-xl px-5 text-sm font-semibold shadow-lg shadow-primary/25 transition hover:-translate-y-0.5"
                onClick={() => openCreateDialog()}
                disabled={waitingContentCount === 0}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Add Subscription Plan</DialogTitle></DialogHeader>
              <TeacherPlanForm
                key={`create-${addDialogSeed?.type || 'none'}-${addDialogSeed?.id || 'none'}`}
                examTypes={examTypes}
                classes={classes}
                subjects={subjects}
                topics={topics}
                paidCourses={waitingCourses}
                paidMockTests={allowStandaloneMockTests ? waitingMockTests : []}
                paidLiveBatches={waitingLiveBatches}
                allowMockTests={allowStandaloneMockTests}
                initialLinkedContent={addDialogSeed}
                onFinished={() => {
                  setIsAddDialogOpen(false);
                  setAddDialogSeed(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold">Student Builder Pricing</h3>
          <p className="text-sm text-muted-foreground">
            Set what students pay on your teacher profile when they build paid practice sessions or custom mock tests from your purchased DCAM question bank.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ScopedPricingCard
            title="Practice Session Pricing"
            description="Control per-question pricing and attempt rules for paid practice sessions students build from your profile."
            scopePrefix="teacher-practice-pricing"
            examTypes={practiceScopeOptions.examTypes}
            classes={practiceScopeOptions.classes}
            subjects={practiceScopeOptions.subjects}
            topics={practiceScopeOptions.topics}
            subtopics={practiceScopeOptions.subtopics}
            selectedExamTypeId={selectedPracticeExamTypeId}
            selectedClassId={selectedPracticeClassId}
            selectedSubjectId={selectedPracticeSubjectId}
            selectedTopicId={selectedPracticeTopicId}
            selectedSubtopicPath={selectedPracticeSubtopicPath}
            canUseSubjectWideScope={practiceScopeOptions.canUseSubjectWideScope}
            canUseTopicWideScope={practiceScopeOptions.canUseTopicWideScope}
            priceInput={premiumPracticePriceInput}
            currentPricing={premiumPracticeQuestionPriceByDifficulty}
            rules={practicePricingRules}
            isSaving={isSavingPremiumPracticePrice}
            onExamTypeChange={setSelectedPracticeExamTypeId}
            onClassIdChange={setSelectedPracticeClassId}
            onSubjectIdChange={setSelectedPracticeSubjectId}
            onTopicIdChange={setSelectedPracticeTopicId}
            onSubtopicPathChange={setSelectedPracticeSubtopicPath}
            onPriceInputChange={(difficulty, value) =>
              setPremiumPracticePriceInput((current) => ({ ...current, [difficulty]: value }))
            }
            onSave={handleSavePremiumPracticePrice}
            onSelectRule={(rule) => {
              setSelectedPracticeExamTypeId(rule.examTypeId);
              setSelectedPracticeClassId(rule.classId);
              setSelectedPracticeSubjectId(rule.subjectId || '');
              setSelectedPracticeTopicId(rule.topicId || '');
              setSelectedPracticeSubtopicPath(rule.subtopicPath || '');
            }}
            onDeleteRule={handleDeletePracticePricingRule}
            emptyText="No practice pricing saved yet for your purchased question scopes."
            saveLabel="Save Practice Pricing"
          >
            <AttemptSettingsFields
              title="Practice Attempt Settings"
              description="Decide whether students get unlimited attempts, fixed attempts, or interval-based attempts for this practice scope."
              scopePrefix="teacher-practice-attempts"
              input={premiumPracticeAttemptInput}
              setInput={setPremiumPracticeAttemptInput}
              summary={formatPremiumPracticeAttemptPricingRule(selectedPracticeAttemptRule)}
            />
          </ScopedPricingCard>

          <ScopedPricingCard
            title="Custom Mock Test Pricing"
            description="Control per-question pricing and attempt rules for paid custom mock tests students build from your profile."
            scopePrefix="teacher-custom-mock-pricing"
            examTypes={mockScopeOptions.examTypes}
            classes={mockScopeOptions.classes}
            subjects={mockScopeOptions.subjects}
            topics={mockScopeOptions.topics}
            subtopics={mockScopeOptions.subtopics}
            selectedExamTypeId={selectedMockExamTypeId}
            selectedClassId={selectedMockClassId}
            selectedSubjectId={selectedMockSubjectId}
            selectedTopicId={selectedMockTopicId}
            selectedSubtopicPath={selectedMockSubtopicPath}
            canUseSubjectWideScope={mockScopeOptions.canUseSubjectWideScope}
            canUseTopicWideScope={mockScopeOptions.canUseTopicWideScope}
            priceInput={premiumMockTestPriceInput}
            currentPricing={premiumMockTestQuestionPriceByDifficulty}
            rules={mockPricingRules}
            isSaving={isSavingPremiumMockTestPrice}
            onExamTypeChange={setSelectedMockExamTypeId}
            onClassIdChange={setSelectedMockClassId}
            onSubjectIdChange={setSelectedMockSubjectId}
            onTopicIdChange={setSelectedMockTopicId}
            onSubtopicPathChange={setSelectedMockSubtopicPath}
            onPriceInputChange={(difficulty, value) =>
              setPremiumMockTestPriceInput((current) => ({ ...current, [difficulty]: value }))
            }
            onSave={handleSavePremiumMockTestPrice}
            onSelectRule={(rule) => {
              setSelectedMockExamTypeId(rule.examTypeId);
              setSelectedMockClassId(rule.classId);
              setSelectedMockSubjectId(rule.subjectId || '');
              setSelectedMockTopicId(rule.topicId || '');
              setSelectedMockSubtopicPath(rule.subtopicPath || '');
            }}
            onDeleteRule={handleDeleteMockPricingRule}
            emptyText="No custom mock pricing saved yet for your purchased question scopes."
            saveLabel="Save Custom Mock Pricing"
          >
            <AttemptSettingsFields
              title="Custom Mock Attempt Settings"
              description="Set how students can reuse, recharge, or unlock more attempts for paid custom mock tests in this scope."
              scopePrefix="teacher-custom-mock-attempts"
              input={premiumMockAttemptInput}
              setInput={setPremiumMockAttemptInput}
              summary={formatPremiumCustomMockAttemptPricingRule(selectedMockAttemptRule)}
            />
          </ScopedPricingCard>
        </div>
      </div>

      <Card id="teacher-offers-workspace" className="scroll-mt-24 border-border/60 bg-card/70 backdrop-blur">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-xl">Offers</CardTitle>
              <CardDescription>Create bundled offers from your own content and premium scope credits.</CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {sortedTeacherOffers.length} created
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background/35 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Created Offers</p>
            <p className="mt-3 text-3xl font-semibold">{sortedTeacherOffers.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Saved bundled offers built around your exam, curriculum, subjects, courses, crash courses, live batches, and premium question credits.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/25 bg-primary/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Offer Builder</p>
            <p className="mt-3 text-xl font-semibold">Build a new teacher offer</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Start with exam and curriculum, add your courses, crash courses, live batches, and premium question packs, then set one final price.
            </p>
            <div className="mt-4">
              <Button asChild>
                <Link href="/subscription/offers">
                  Open Offer Builder
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Created Offers</h3>
          <p className="mt-1 text-sm text-muted-foreground">Teacher bundle offers saved from the offer builder.</p>
        </div>
        <Badge variant="outline" className="rounded-full px-3 py-1">{sortedTeacherOffers.length} offers</Badge>
      </div>

      {sortedTeacherOffers.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {sortedTeacherOffers.map((offer) => {
            const counts = countTeacherOfferSelections(offer);
            const includedLiveSessions = (offer.liveBatches || []).reduce((sum, batch) => sum + Math.max(0, Number(batch.includedSessions || 0)), 0);
            const scopeLabel = [offer.examTypeName, offer.className, ...(offer.subjectNames || [])].filter(Boolean).join(' / ');
            const summaryItems = [
              { label: 'Courses', value: counts.coursesCount },
              { label: 'Crash courses', value: counts.crashCoursesCount },
              ...(allowStandaloneMockTests ? [{ label: 'Mock tests', value: counts.mockTestsCount }] : []),
              { label: 'Live batches', value: counts.liveBatchesCount },
              { label: 'Live sessions', value: includedLiveSessions },
              { label: 'Practice questions', value: counts.premiumPracticeSessionCount },
              { label: 'Custom mock questions', value: counts.premiumCustomMockQuestionCount },
            ].filter((item) => item.value > 0);

            return (
              <Card
                key={offer.id || `${offer.title}-${offer.examTypeId}-${offer.classId}`}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98))] shadow-[0_22px_60px_-36px_rgba(2,6,23,0.95)]"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />
                <CardHeader className="relative space-y-3 p-5 pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="line-clamp-2 text-lg font-semibold leading-snug text-white">
                        {offer.title || 'Untitled Offer'}
                      </CardTitle>
                      <CardDescription className="mt-1 line-clamp-1 text-xs text-slate-400">
                        {scopeLabel || 'Scope not set'}
                      </CardDescription>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/65">Price</p>
                      <p className="mt-0.5 text-lg font-semibold text-cyan-50">{formatOfferPriceLabel(offer.price, offer.currency)}</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="relative px-5 pb-4 pt-1">
                  {summaryItems.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {summaryItems.map((item) => (
                        <div
                          key={`${offer.id || offer.title}-${item.label}`}
                          className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/45 px-2.5 py-1.5"
                        >
                          <span className="text-sm font-semibold text-white">{item.value}</span>
                          <span className="text-[11px] text-slate-400">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/35 px-3 py-3 text-xs text-slate-400">
                      No content saved in this offer.
                    </div>
                  )}
                </CardContent>

                <CardFooter className="relative grid grid-cols-2 gap-2 border-t border-white/10 px-5 py-3">
                  {offer.id ? (
                    <Button asChild size="sm" className="h-9 rounded-lg">
                      <Link href={`/subscription/offers?edit=${encodeURIComponent(offer.id)}`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Offer
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg border-destructive/35 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setOfferToDelete(offer)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed border-border/70 bg-card/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No teacher offers created yet. Use the offer builder to create the first one.
              </CardContent>
            </Card>
          )}

      {paidContentCount === 0 ? (
        <Card className="border-dashed border-border/70 bg-card/60">
          <CardContent className="py-8 text-sm text-muted-foreground">
            No paid courses or live batches found for your account. Set content access to paid first.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {waitingSummary.map(({ key, title, count, note, Icon }) => (
              <Card key={key} className="border-border/60 bg-card/70 backdrop-blur">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{title}</CardTitle>
                      <CardDescription className="mt-1 text-xs">{note}</CardDescription>
                    </div>
                    <div className="rounded-lg border border-primary/40 bg-primary/10 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className={cn("text-4xl font-semibold tracking-tight", count === 0 ? "text-muted-foreground" : "text-foreground")}>{count}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {waitingContentCount === 0 ? (
            <Card className="border-border/60 bg-card/70">
              <CardContent className="py-7 text-sm text-muted-foreground">
                All paid content already has attached subscription plans.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {waitingCourses.length > 0 ? (
                <Card className="border-border/60 bg-card/70 backdrop-blur">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">Paid Courses Waiting for Subscription</CardTitle>
                        <CardDescription>Attach a plan to publish these courses.</CardDescription>
                      </div>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">{waitingCourses.length} pending</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {waitingCourses.map((course) => (
                      <div key={course.id} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition duration-200 hover:border-primary/40 hover:bg-background/60 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{course.title}</p>
                          <p className="text-xs text-muted-foreground">Paid course pending subscription attachment.</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button size="sm" className="rounded-lg px-4" onClick={() => openCreateDialog({ type: 'course', id: course.id })}>Attach Plan</Button>
                          <Button asChild variant="outline" size="sm" className="rounded-lg border-border/70 hover:border-primary/40">
                            <Link href={`/courses/edit/${course.id}`}>
                              Open
                              <ArrowUpRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              {waitingMockTests.length > 0 ? (
                <Card className="border-border/60 bg-card/70 backdrop-blur">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">Paid Mock Tests Waiting for Subscription</CardTitle>
                        <CardDescription>Attach a plan to publish these mock tests.</CardDescription>
                      </div>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">{waitingMockTests.length} pending</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {waitingMockTests.map((test) => (
                      <div key={test.id} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition duration-200 hover:border-primary/40 hover:bg-background/60 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{test.title}</p>
                          <p className="text-xs text-muted-foreground">Paid mock test pending subscription attachment.</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button size="sm" className="rounded-lg px-4" onClick={() => openCreateDialog({ type: 'mock_test', id: test.id })}>Attach Plan</Button>
                          <Button asChild variant="outline" size="sm" className="rounded-lg border-border/70 hover:border-primary/40">
                            <Link href={`/mock-tests/edit/${test.id}`}>
                              Open
                              <ArrowUpRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              {waitingLiveBatches.length > 0 ? (
                <Card className="border-border/60 bg-card/70 backdrop-blur">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">Paid Live Batches Waiting for Subscription</CardTitle>
                        <CardDescription>Attach a plan to publish these live batches.</CardDescription>
                      </div>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">{waitingLiveBatches.length} pending</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {waitingLiveBatches.map((batch) => (
                      <div key={batch.id} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition duration-200 hover:border-primary/40 hover:bg-background/60 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{batch.title}</p>
                          <p className="text-xs text-muted-foreground">Paid live batch pending subscription attachment.</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button size="sm" className="rounded-lg px-4" onClick={() => openCreateDialog({ type: 'live_batch', id: batch.id })}>Attach Plan</Button>
                          <Button asChild variant="outline" size="sm" className="rounded-lg border-border/70 hover:border-primary/40">
                            <Link href={`/live-batches/edit/${batch.id}`}>
                              Open
                              <ArrowUpRight className="ml-1 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Created Subscription Plans</h3>
          <p className="mt-1 text-sm text-muted-foreground">Manage plans already linked to your content.</p>
        </div>
        <Badge variant="outline" className="rounded-full px-3 py-1">{teacherPlans.length} plans</Badge>
      </div>

      {teacherPlans.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teacherPlans.map((plan) => (
            <Card key={plan.id} className="group flex h-full flex-col overflow-hidden border-border/60 bg-card/70 backdrop-blur transition duration-200 hover:-translate-y-1 hover:border-primary/40">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="line-clamp-2 text-lg leading-snug">{plan.name}</CardTitle>
                  <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                    {getLinkedTypeLabel(plan.linkedContentType)}
                  </Badge>
                </div>
                <CardDescription>{getLinkedLabel(plan)}</CardDescription>
                {plan.linkedContentType === 'live_batch' ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                    <p className="text-sm font-semibold text-primary">INR {Number(plan.sessionFee ?? plan.price ?? 0).toLocaleString()} per session</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Total sessions: {Number(plan.totalSessions ?? plan.numberOfLiveClasses ?? 0)}
                    </p>
                  </div>
                ) : plan.paymentType === 'one_time' ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                    <p className="text-sm font-semibold text-primary">
                      INR {resolveCourseBasePrice(plan).toLocaleString()} one-time
                    </p>
                    {plan.linkedContentType === 'course' && resolveCourseCoupons(plan).length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {resolveCourseCoupons(plan).length} coupon code{resolveCourseCoupons(plan).length === 1 ? '' : 's'} configured for this course.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <CardDescription className="rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
                    INR {plan.price.toLocaleString()} / {plan.billingInterval}
                  </CardDescription>
                )}
                {plan.numberOfLiveClasses !== undefined && plan.linkedContentType !== 'live_batch' ? (
                  <CardDescription className="text-xs">Live Classes: {plan.numberOfLiveClasses}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {plan.features.slice(0, 4).map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="line-clamp-2">{feature}</span>
                    </li>
                  ))}
                  {plan.features.length > 4 ? (
                    <li className="text-xs text-muted-foreground/80">+{plan.features.length - 4} more features</li>
                  ) : null}
                </ul>
              </CardContent>
              <CardFooter className="mt-2 flex justify-end gap-2 border-t border-border/60 pt-4">
                <Button variant="outline" size="sm" className="rounded-lg border-primary/30 hover:bg-primary/10" onClick={() => setPlanToEdit(plan)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setPlanToDelete(plan)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-border/70 bg-card/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No teacher plans found. Create one to get started.
          </CardContent>
        </Card>
      )}

      <Dialog open={!!planToEdit} onOpenChange={(open) => !open && setPlanToEdit(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Edit Subscription Plan</DialogTitle></DialogHeader>
          {planToEdit && (
            <TeacherPlanForm
              examTypes={examTypes}
              classes={classes}
              subjects={subjects}
              topics={topics}
              paidCourses={paidCourses}
              paidMockTests={allowStandaloneMockTests ? paidMockTests : []}
              paidLiveBatches={paidLiveBatches}
              allowMockTests={allowStandaloneMockTests}
              planToEdit={planToEdit}
              onFinished={() => setPlanToEdit(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!planToDelete} onOpenChange={(open) => !open && setPlanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{planToDelete?.name}".</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className={cn(buttonVariants({ variant: 'destructive' }))}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!offerToDelete} onOpenChange={(open) => !open && !isDeletingOffer && setOfferToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove saved offer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{offerToDelete?.title || 'Untitled Offer'}" from your created offers list on the subscription page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingOffer}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOffer}
              disabled={isDeletingOffer}
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              {isDeletingOffer ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Offer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Student View Component
const StudentView: FC<{ 
    plans: SubscriptionPlan[]; 
    examTypes: ExamType[],
    classes: Class[],
    subjects: Subject[],
    topics: Topic[],
}> = ({ plans, examTypes, classes, subjects, topics }) => {
    const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly');
    const [selectedExamType, setSelectedExamType] = useState<string>('all');

    const examTypeMap = useMemo(() => examTypes.reduce((acc, et) => ({ ...acc, [et.id]: et.name }), {} as Record<string, string>), [examTypes]);
    const classMap = useMemo(() => classes.reduce((acc, c) => ({...acc, [c.id]: c.name}), {} as Record<string, string>), [classes]);
    const subjectMap = useMemo(() => subjects.reduce((acc, s) => ({...acc, [s.id]: s.name}), {} as Record<string, string>), [subjects]);
    const topicMap = useMemo(() => topics.reduce((acc, t) => ({...acc, [t.id]: t.name}), {} as Record<string, string>), [topics]);

    const getPlanScope = (plan: SubscriptionPlan): string => {
        const scopeParts = [examTypeMap[plan.examTypeId]];
        if (plan.classId && classMap[plan.classId]) scopeParts.push(classMap[plan.classId]);
        if (plan.subjectIds && plan.subjectIds.length > 0) {
            const subjectNames = plan.subjectIds.map(id => subjectMap[id]).filter(Boolean).join(', ');
            if (subjectNames) scopeParts.push(subjectNames);
        }
        if (plan.topicId && topicMap[plan.topicId]) scopeParts.push(topicMap[plan.topicId]);
        return scopeParts.join(' / ');
    };

    const filteredPlans = useMemo(() => {
        return plans.filter(plan =>
            ((plan.paymentType === 'one_time') || plan.billingInterval === billingInterval) &&
            (selectedExamType === 'all' || plan.examTypeId === selectedExamType)
        );
    }, [plans, billingInterval, selectedExamType]);

    return (
        <div className="space-y-12">
            <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
                <h2 className="font-headline text-4xl font-semibold">Choose Your Path to Success</h2>
                <p className="mt-4 text-lg text-muted-foreground">Select the perfect plan designed for your goal and conquer the exams with DCAM Classes.</p>
                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 mt-8">
                     <div className="flex items-center space-x-2">
                        <Label htmlFor="billing-toggle" className={billingInterval === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}>Monthly</Label>
                        <Switch id="billing-toggle" checked={billingInterval === 'yearly'} onCheckedChange={(checked) => setBillingInterval(checked ? 'yearly' : 'monthly')} />
                        <Label htmlFor="billing-toggle" className={billingInterval === 'yearly' ? 'text-foreground' : 'text-muted-foreground'}>Yearly (Save 16%)</Label>
                    </div>
                     <Select value={selectedExamType} onValueChange={setSelectedExamType}>
                        <SelectTrigger className="w-[220px]"><SelectValue placeholder="Filter by Exam Type" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Exam Types</SelectItem>{examTypes.map(et => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            {filteredPlans.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    {filteredPlans.map((plan) => (
                        <Card key={plan.id} className={`shadow-lg flex flex-col h-full ${plan.isPopular ? 'border-primary border-2 shadow-primary/20' : ''}`}>
                             {plan.isPopular && <div className="bg-primary text-primary-foreground text-sm font-semibold text-center py-1 rounded-t-lg">Most Popular</div>}
                             <CardHeader><CardTitle className="font-headline text-2xl">{plan.name}</CardTitle>
                                <CardDescription>{getPlanScope(plan)}</CardDescription>
                             </CardHeader>
                             <CardContent className="space-y-6 flex-grow">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-4xl font-bold">INR {Number(plan.sessionFee ?? plan.price ?? 0).toLocaleString()}</span>
                                  <span className="text-muted-foreground">
                                    {plan.linkedContentType === 'live_batch'
                                      ? 'per session'
                                      : plan.paymentType === 'one_time'
                                        ? 'one-time'
                                        : `/${billingInterval === 'monthly' ? 'month' : 'year'}`}
                                  </span>
                                </div>
                                <ul className="space-y-3 text-sm">
                                    {plan.linkedContentType === 'live_batch' && (plan.totalSessions ?? plan.numberOfLiveClasses) !== undefined && (
                                        <li className="flex items-start">
                                            <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                                            <span>{Number(plan.totalSessions ?? plan.numberOfLiveClasses)} total live sessions (meetings only)</span>
                                        </li>
                                    )}
                                    {plan.features.map((feature, index) => (<li key={index} className="flex items-start"><Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" /><span>{feature}</span></li>))}
                                </ul>
                            </CardContent>
                             <CardFooter>
                                <Button asChild className="w-full" variant={plan.isPopular ? 'default' : 'outline'}>
                                    <Link href={`/checkout/${plan.id}`}>{plan.linkedContentType === 'live_batch' ? 'Select Sessions & Pay' : 'Choose Plan'}</Link>
                                </Button>
                             </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center text-muted-foreground py-16">
                    <p className="font-semibold text-lg">No plans match your current filters.</p>
                    <p>Try a different billing interval or exam type.</p>
                </div>
            )}
             <p className="text-center text-xs text-muted-foreground mt-8">All subscriptions are managed securely. You can upgrade, downgrade, or cancel your plan at any time.</p>
        </div>
    )
}
// Main Page Component
export default function SubscriptionPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const isStudent = !isAdmin && !isTeacher;

  const initialLinkedContent = useMemo<LinkedContentSeed | null>(() => {
    const linkedContentType = searchParams.get('linkedContentType');
    const linkedContentId = searchParams.get('linkedContentId');
    if (!linkedContentId) return null;
    if (linkedContentType === 'course' || linkedContentType === 'mock_test' || linkedContentType === 'live_batch') {
      return { type: linkedContentType, id: linkedContentId };
    }
    return null;
  }, [searchParams]);

  const plansQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'subscription_plans'), orderBy('price')) : null, [firestore]);
  const examTypesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null, [firestore]);
  const classesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null, [firestore]);
  const subjectsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null, [firestore]);
  const topicsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'topics'), orderBy('name')) : null, [firestore]);
  const teacherCoursesQuery = useMemoFirebase(
    () => (firestore && user?.uid) ? query(collection(firestore, 'courses'), where('teacherId', '==', user.uid)) : null,
    [firestore, user?.uid]
  );
  const teacherMockTestsQuery = useMemoFirebase(
    () => (firestore && user?.uid) ? query(collection(firestore, 'mock_tests'), where('teacherId', '==', user.uid)) : null,
    [firestore, user?.uid]
  );
  const teacherLiveBatchesQuery = useMemoFirebase(
    () => (firestore && user?.uid) ? query(collection(firestore, 'live_batches'), where('teacherId', '==', user.uid)) : null,
    [firestore, user?.uid]
  );
  const teacherOffersQuery = useMemoFirebase(
    () => (firestore && user?.uid) ? query(collection(firestore, 'teacher_offers'), where('createdByTeacherId', '==', user.uid)) : null,
    [firestore, user?.uid]
  );
  
  const { data: plans, isLoading: arePlansLoading } = useCollection<SubscriptionPlan>(plansQuery);
  const { data: examTypes, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classes, isLoading: areClassesLoading } = useCollection<Class>(classesQuery);
  const { data: subjects, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: topics, isLoading: areTopicsLoading } = useCollection<Topic>(topicsQuery);
  const { data: teacherCourses, isLoading: areTeacherCoursesLoading } = useCollection<PaidCourse>(teacherCoursesQuery);
  const { data: teacherMockTests, isLoading: areTeacherMockTestsLoading } = useCollection<PaidMockTest>(teacherMockTestsQuery);
  const { data: teacherLiveBatches, isLoading: areTeacherLiveBatchesLoading } = useCollection<PaidLiveBatch>(teacherLiveBatchesQuery);
  const { data: teacherOffers, isLoading: areTeacherOffersLoading } = useCollection<TeacherOffer>(teacherOffersQuery);

  const teacherPaidCourses = useMemo(
    () => (teacherCourses || []).filter((item) => isPaidContent(item) && item.publicationStatus !== 'deleted'),
    [teacherCourses]
  );
  const teacherPaidMockTests = useMemo(
    () => (teacherMockTests || []).filter((item) => isStandaloneMockTest(item) && isPaidContent(item) && item.publicationStatus !== 'deleted'),
    [teacherMockTests]
  );
  const teacherPaidLiveBatches = useMemo(
    () => (teacherLiveBatches || []).filter((item) => isPaidContent(item) && item.publicationStatus !== 'deleted'),
    [teacherLiveBatches]
  );


  const isLoading = isAdminLoading || isTeacherLoading || arePlansLoading || areExamTypesLoading || areClassesLoading || areSubjectsLoading || areTopicsLoading || areTeacherCoursesLoading || areTeacherMockTestsLoading || areTeacherLiveBatchesLoading || areTeacherOffersLoading;

  useEffect(() => {
    if (isAdminLoading || isTeacherLoading) return;
    if (!isAdmin && !isTeacher) {
      router.replace('/dashboard');
    }
  }, [isAdminLoading, isTeacherLoading, isAdmin, isTeacher, router]);

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Subscription" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        {isLoading ? (
            <div className="space-y-8">
                <Skeleton className="h-24 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-80 w-full" />
                    <Skeleton className="h-80 w-full" />
                    <Skeleton className="h-80 w-full" />
                </div>
            </div>
        ) : isAdmin ? (
            <AdminView 
                plans={plans || []} 
                examTypes={examTypes || []} 
                classes={classes || []}
                subjects={subjects || []}
                topics={topics || []}
            />
        ) : isTeacher ? (
            <TeacherView
                plans={plans || []}
                examTypes={examTypes || []}
                classes={classes || []}
                subjects={subjects || []}
                topics={topics || []}
                paidCourses={teacherPaidCourses}
                paidMockTests={teacherPaidMockTests}
                paidLiveBatches={teacherPaidLiveBatches}
                teacherOffers={teacherOffers || []}
                initialLinkedContent={initialLinkedContent}
            />
        ) : isStudent ? (
            <div className="space-y-8">
                <Skeleton className="h-24 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-80 w-full" />
                    <Skeleton className="h-80 w-full" />
                    <Skeleton className="h-80 w-full" />
                </div>
            </div>
        ) : (
            null
        )}
      </main>
    </div>
  );
}
