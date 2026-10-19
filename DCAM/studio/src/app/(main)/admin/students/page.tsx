'use client';

import Link from 'next/link';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, query, orderBy, doc, writeBatch, getDocs, setDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { useState, useMemo, useEffect } from 'react';
import DashboardHeader from '@/components/dashboard-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Trash2, LoaderCircle, Search, Activity, BookOpenCheck, Target, Layers3 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as XLSX from 'xlsx';
import { add } from 'date-fns';
import { buildAdminAssignedCoursePayload, isCourseAssignableForStudentAccess } from '@/lib/course-assignment';
import {
    QUESTION_UPLOAD_ROLE_ID,
    QUESTION_UPLOAD_ROLE_LABEL,
    isQuestionUploadRole,
} from '@/lib/teacher-authoring';

type ManagedRoleId = 'student' | 'teacher' | 'admin' | typeof QUESTION_UPLOAD_ROLE_ID;

type UserProfile = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    roleId: ManagedRoleId;
    photoURL?: string;
    teacherStatus?: 'pending' | 'approved' | 'rejected';
    status?: 'active' | 'blocked';
    subscriptionPlanId?: string;
    subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'trialing';
};

type SubscriptionPlan = {
  id: string;
  name: string;
  billingInterval: 'monthly' | 'yearly';
}

type CourseDoc = { id: string; title?: string; teacherId?: string; publicationStatus?: 'draft' | 'published' | 'deleted'; accessLevel?: 'free' | 'paid'; subscriptionAttached?: boolean; createdAt?: unknown; updatedAt?: unknown; };
type MockTestDoc = { id: string; teacherId?: string; publicationStatus?: 'draft' | 'published' | 'deleted'; accessLevel?: 'free' | 'paid'; subscriptionAttached?: boolean; createdAt?: unknown; updatedAt?: unknown; startTime?: unknown; };
type LiveBatchDoc = { id: string; teacherId?: string; publicationStatus?: 'draft' | 'published' | 'deleted'; accessLevel?: 'free' | 'paid'; subscriptionAttached?: boolean; createdAt?: unknown; updatedAt?: unknown; };
type DoubtDoc = { id: string; studentId?: string; teacherId?: string; status?: 'open' | 'answered' | 'closed' | string; createdAt?: unknown; };
type PaymentDoc = { id: string; userId?: string; teacherId?: string; status?: string; grossAmount?: number; purchasedAt?: unknown; };
type ContentDoc = { id: string; teacherId?: string; createdAt?: unknown; updatedAt?: unknown; };
type CurriculumRequestDoc = { id: string; teacherId?: string; status?: 'pending' | 'approved' | 'rejected' | string; createdAt?: unknown; reviewedAt?: unknown; };
type CountAndLast = { count: number; lastAt: Date | null; };
type UserScopedActivityDoc = {
    id: string;
    data: () => Record<string, unknown>;
    ref: { parent: { parent: { id: string } | null } };
};

type StudentActivity = {
    purchasedCourses: number;
    purchasedMockTests: number;
    enrolledLiveBatches: number;
    mockAttempts: number;
    practiceSessions: number;
    customMockTests: number;
    doubtsAsked: number;
    doubtsAnswered: number;
    payments: number;
    paymentAmount: number;
    lastActivityAt: Date | null;
};

type TeacherActivity = {
    courses: number;
    coursesPublished: number;
    mockTests: number;
    mockTestsPublished: number;
    liveBatches: number;
    liveBatchesPublished: number;
    contentUploads: number;
    doubtsAnswered: number;
    curriculumRequests: number;
    payments: number;
    paymentAmount: number;
    lastActivityAt: Date | null;
};

const emptyCountAndLast = (): CountAndLast => ({ count: 0, lastAt: null });
const emptyStudentActivity = (): StudentActivity => ({
    purchasedCourses: 0,
    purchasedMockTests: 0,
    enrolledLiveBatches: 0,
    mockAttempts: 0,
    practiceSessions: 0,
    customMockTests: 0,
    doubtsAsked: 0,
    doubtsAnswered: 0,
    payments: 0,
    paymentAmount: 0,
    lastActivityAt: null,
});
const emptyTeacherActivity = (): TeacherActivity => ({
    courses: 0,
    coursesPublished: 0,
    mockTests: 0,
    mockTestsPublished: 0,
    liveBatches: 0,
    liveBatchesPublished: 0,
    contentUploads: 0,
    doubtsAnswered: 0,
    curriculumRequests: 0,
    payments: 0,
    paymentAmount: 0,
    lastActivityAt: null,
});

const toDateSafe = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
        try {
            const parsed = (value as { toDate: () => Date }).toDate();
            return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
        } catch {
            return null;
        }
    }
    return null;
};

const maxDate = (a: Date | null, b: Date | null): Date | null => {
    if (!a) return b;
    if (!b) return a;
    return a.getTime() > b.getTime() ? a : b;
};

const formatLastActivity = (date: Date | null) =>
    date
        ? date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : 'No activity yet';

const displayName = (user: UserProfile) => `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed User';

const managedRoleIds: ManagedRoleId[] = ['student', 'teacher', 'admin', QUESTION_UPLOAD_ROLE_ID];

const normalizeManagedRole = (roleId?: string | null): ManagedRoleId =>
    managedRoleIds.includes(roleId as ManagedRoleId) ? roleId as ManagedRoleId : 'student';

const formatManagedRoleLabel = (roleId?: string | null) => {
    if (roleId === 'admin') return 'Admin';
    if (roleId === 'teacher') return 'Teacher';
    if (isQuestionUploadRole(roleId)) return QUESTION_UPLOAD_ROLE_LABEL;
    return 'Student';
};

const isStaffRole = (roleId?: string | null) =>
    roleId === 'teacher' || roleId === 'admin' || isQuestionUploadRole(roleId);

const getStaffRoleBadgeVariant = (roleId?: string | null) => {
    if (roleId === 'admin') return 'destructive' as const;
    if (isQuestionUploadRole(roleId)) return 'outline' as const;
    return 'secondary' as const;
};

const RoleSelector = ({ user }: { user: UserProfile }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const initialRole = normalizeManagedRole(user.roleId);
    const [currentRole, setCurrentRole] = useState<ManagedRoleId>(initialRole);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleRoleChange = async (newRole: ManagedRoleId) => {
        setIsUpdating(true);
        try {
            const batch = writeBatch(firestore);
            const userRef = doc(firestore, 'users', user.id);
            const teacherRoleRef = doc(firestore, 'roles_teacher', user.id);
            const adminRoleRef = doc(firestore, 'roles_admin', user.id);
            const questionUploadRoleRef = doc(firestore, 'roles_question_upload', user.id);

            const roleUpdate: { roleId: ManagedRoleId; teacherStatus?: string | ReturnType<typeof deleteField> } = { roleId: newRole };

            if (newRole === 'student') {
                batch.delete(teacherRoleRef);
                batch.delete(adminRoleRef);
                batch.delete(questionUploadRoleRef);
                roleUpdate.teacherStatus = deleteField();
            } else if (newRole === 'teacher') {
                roleUpdate.teacherStatus = 'approved';
                batch.set(teacherRoleRef, { createdAt: new Date().toISOString() });
                batch.delete(adminRoleRef);
                batch.delete(questionUploadRoleRef);
            } else if (newRole === 'admin') {
                roleUpdate.teacherStatus = 'approved';
                batch.set(teacherRoleRef, { createdAt: new Date().toISOString() });
                batch.set(adminRoleRef, { createdAt: new Date().toISOString() });
                batch.delete(questionUploadRoleRef);
            } else if (newRole === QUESTION_UPLOAD_ROLE_ID) {
                roleUpdate.teacherStatus = deleteField();
                batch.delete(teacherRoleRef);
                batch.delete(adminRoleRef);
                batch.set(questionUploadRoleRef, { createdAt: new Date().toISOString() });
            }
            
            batch.update(userRef, roleUpdate);
            await batch.commit();
            
            setCurrentRole(newRole);
            toast({ title: 'Role Updated', description: `${user.firstName}'s role is now ${formatManagedRoleLabel(newRole)}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        } finally {
            setIsUpdating(false);
        }
    };
    
    return (
        <Select value={currentRole} onValueChange={(value) => handleRoleChange(value as ManagedRoleId)} disabled={isUpdating}>
            <SelectTrigger className="w-[165px]">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value={QUESTION_UPLOAD_ROLE_ID}>{QUESTION_UPLOAD_ROLE_LABEL}</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
        </Select>
    )
}

const SubscriptionStatusSelector = ({ user }: { user: UserProfile }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isUpdating, setIsUpdating] = useState(false);

    const handleStatusChange = async (newStatus: 'active' | 'canceled') => {
        setIsUpdating(true);
        try {
            const batch = writeBatch(firestore);
            
            const userRef = doc(firestore, 'users', user.id);
            batch.update(userRef, { subscriptionStatus: newStatus });

            // Also update the subcollection if it exists, creating it if necessary
            const userSubscriptionRef = doc(firestore, 'users', user.id, 'subscriptions', 'main');
            batch.set(userSubscriptionRef, { status: newStatus }, { merge: true });

            await batch.commit();

            toast({ title: 'Subscription Updated', description: `${user.firstName}'s subscription is now ${newStatus === 'active' ? 'Active' : 'Inactive'}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        } finally {
            setIsUpdating(false);
        }
    };
    
    if (user.roleId !== 'student' || !user.subscriptionPlanId) {
        return null;
    }

    const currentStatus = (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing') ? 'active' : 'canceled';

    return (
        <Select 
            value={currentStatus} 
            onValueChange={handleStatusChange} 
            disabled={isUpdating}
        >
            <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Set Status"/>
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="canceled">Inactive</SelectItem>
            </SelectContent>
        </Select>
    );
};

const PlanSelector = ({ user, plans }: { user: UserProfile, plans: SubscriptionPlan[] }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isUpdating, setIsUpdating] = useState(false);

    const handlePlanChange = async (newPlanId: string) => {
        setIsUpdating(true);
        try {
            const userRef = doc(firestore, 'users', user.id);
            const userSubscriptionRef = doc(firestore, 'users', user.id, 'subscriptions', 'main');
            const batch = writeBatch(firestore);

            if (newPlanId === 'none') {
                // Removing subscription
                batch.update(userRef, {
                    subscriptionPlanId: null,
                    subscriptionStatus: 'canceled',
                });
                batch.delete(userSubscriptionRef);
                toast({ title: 'Subscription Removed', description: `${user.firstName}'s subscription has been removed.` });
            } else {
                // Adding or changing subscription
                const newPlan = plans.find(p => p.id === newPlanId);
                if (!newPlan) throw new Error("Selected plan not found.");

                const now = new Date();
                const endDate = newPlan.billingInterval === 'monthly' ? add(now, { months: 1 }) : add(now, { years: 1 });

                batch.update(userRef, {
                    subscriptionPlanId: newPlanId,
                    subscriptionStatus: 'active',
                });
                batch.set(userSubscriptionRef, {
                    id: 'main',
                    planId: newPlanId,
                    status: 'active',
                    currentPeriodStart: now.toISOString(),
                    currentPeriodEnd: endDate.toISOString(),
                }, { merge: true });
                toast({ title: 'Subscription Updated', description: `${user.firstName} is now subscribed to ${newPlan.name}.` });
            }
            await batch.commit();

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Select value={user.subscriptionPlanId || 'none'} onValueChange={handlePlanChange} disabled={isUpdating}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select a plan" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="none">No Plan</SelectItem>
                <SelectSeparator />
                {plans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};


export default function UserManagementPage() {
    const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
    const auth = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [userToBlock, setUserToBlock] = useState<UserProfile | null>(null);
    const [isBlocking, setIsBlocking] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [userToUnblock, setUserToUnblock] = useState<UserProfile | null>(null);
    const [isUnblocking, setIsUnblocking] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'students' | 'teachers'>('students');
    const [coursePurchasesByUserId, setCoursePurchasesByUserId] = useState<Record<string, CountAndLast>>({});
    const [mockPurchasesByUserId, setMockPurchasesByUserId] = useState<Record<string, CountAndLast>>({});
    const [batchEnrollmentsByUserId, setBatchEnrollmentsByUserId] = useState<Record<string, CountAndLast>>({});
    const [mockAttemptsByUserId, setMockAttemptsByUserId] = useState<Record<string, CountAndLast>>({});
    const [practiceSessionsByUserId, setPracticeSessionsByUserId] = useState<Record<string, CountAndLast>>({});
    const [customMockTestsByUserId, setCustomMockTestsByUserId] = useState<Record<string, CountAndLast>>({});
    const [assignedCourseIdsByUserId, setAssignedCourseIdsByUserId] = useState<Record<string, string[]>>({});
    const [selectedCourseByUserId, setSelectedCourseByUserId] = useState<Record<string, string>>({});
    const [isUpdatingCourseAccessByUserId, setIsUpdatingCourseAccessByUserId] = useState<Record<string, boolean>>({});
    const [isActivityLoading, setIsActivityLoading] = useState(false);

    const usersQuery = useMemoFirebase(
        () => firestore ? query(collection(firestore, 'users'), orderBy('lastName')) : null,
        [firestore]
    );
    const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

    const plansQuery = useMemoFirebase(
        () => firestore ? query(collection(firestore, 'subscription_plans')) : null,
        [firestore]
    );
    const { data: plans, isLoading: arePlansLoading } = useCollection<SubscriptionPlan>(plansQuery);

    const coursesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'courses')) : null, [firestore]);
    const mockTestsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'mock_tests')) : null, [firestore]);
    const liveBatchesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'live_batches')) : null, [firestore]);
    const doubtsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'doubts')) : null, [firestore]);
    const paymentsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'payments')) : null, [firestore]);
    const contentQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'content')) : null, [firestore]);
    const curriculumRequestsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'curriculum_requests')) : null, [firestore]);

    const { data: courses, isLoading: areCoursesLoading } = useCollection<CourseDoc>(coursesQuery);
    const { data: mockTests, isLoading: areMockTestsLoading } = useCollection<MockTestDoc>(mockTestsQuery);
    const { data: liveBatches, isLoading: areLiveBatchesLoading } = useCollection<LiveBatchDoc>(liveBatchesQuery);
    const { data: doubts, isLoading: areDoubtsLoading } = useCollection<DoubtDoc>(doubtsQuery);
    const { data: payments, isLoading: arePaymentsLoading } = useCollection<PaymentDoc>(paymentsQuery);
    const { data: contentItems, isLoading: areContentItemsLoading } = useCollection<ContentDoc>(contentQuery);
    const { data: curriculumRequests, isLoading: areCurriculumRequestsLoading } = useCollection<CurriculumRequestDoc>(curriculumRequestsQuery);

    useEffect(() => {
        if (!firestore || !isAdmin || areUsersLoading) return;
        let isCancelled = false;

        const aggregateByUserId = (docs: UserScopedActivityDoc[], dateFields: string[]) => {
            const byUser: Record<string, CountAndLast> = {};
            for (const item of docs) {
                const userId = item.ref.parent.parent?.id;
                if (!userId) continue;
                const data = item.data();
                let recordDate: Date | null = null;
                for (const field of dateFields) {
                    recordDate = toDateSafe(data[field]);
                    if (recordDate) break;
                }
                const existing = byUser[userId] || emptyCountAndLast();
                existing.count += 1;
                existing.lastAt = maxDate(existing.lastAt, recordDate);
                byUser[userId] = existing;
            }
            return byUser;
        };

        const collectIdsByUserId = (docs: UserScopedActivityDoc[]) => {
            const byUser: Record<string, string[]> = {};
            for (const item of docs) {
                const userId = item.ref.parent.parent?.id;
                if (!userId) continue;
                if (!byUser[userId]) byUser[userId] = [];
                if (!byUser[userId].includes(item.id)) {
                    byUser[userId].push(item.id);
                }
            }
            return byUser;
        };

        const loadUserScopedDocs = async (collectionName: string): Promise<UserScopedActivityDoc[]> => {
            if (!users?.length) return [];
            const snapshots = await Promise.all(
                users.map((profile) => getDocs(query(collection(firestore, 'users', profile.id, collectionName))))
            );
            return snapshots.flatMap((snapshot) => snapshot.docs as UserScopedActivityDoc[]);
        };

        const loadActivityDocs = async (collectionName: string): Promise<UserScopedActivityDoc[]> => {
            try {
                const snapshot = await getDocs(query(collectionGroup(firestore, collectionName)));
                return snapshot.docs as UserScopedActivityDoc[];
            } catch (error) {
                const code = (error as { code?: string }).code;
                if (code !== 'permission-denied') {
                    console.warn(`Activity load failed for ${collectionName}. Falling back to user-scoped reads.`);
                }
                try {
                    return await loadUserScopedDocs(collectionName);
                } catch {
                    return [];
                }
            }
        };

        const loadGroupedActivity = async () => {
            setIsActivityLoading(true);
            try {
                const [courseDocs, mockDocs, enrollmentDocs, testResultDocs, practiceResultDocs, customTestDocs] = await Promise.all([
                    loadActivityDocs('purchased_courses'),
                    loadActivityDocs('purchased_mock_tests'),
                    loadActivityDocs('enrolled_live_batches'),
                    loadActivityDocs('test_results'),
                    loadActivityDocs('practice_results'),
                    loadActivityDocs('custom_tests'),
                ]);

                if (isCancelled) return;
                setCoursePurchasesByUserId(aggregateByUserId(courseDocs, ['purchasedAt', 'createdAt']));
                setMockPurchasesByUserId(aggregateByUserId(mockDocs, ['purchasedAt', 'createdAt']));
                setBatchEnrollmentsByUserId(aggregateByUserId(enrollmentDocs, ['enrolledAt', 'paidAt', 'createdAt']));
                setMockAttemptsByUserId(aggregateByUserId(testResultDocs, ['submittedAt', 'createdAt']));
                setPracticeSessionsByUserId(aggregateByUserId(practiceResultDocs, ['submittedAt', 'createdAt']));
                setCustomMockTestsByUserId(aggregateByUserId(customTestDocs, ['updatedAt', 'createdAt']));
                setAssignedCourseIdsByUserId(collectIdsByUserId(courseDocs));
            } finally {
                if (!isCancelled) setIsActivityLoading(false);
            }
        };

        loadGroupedActivity();
        return () => {
            isCancelled = true;
        };
    }, [areUsersLoading, firestore, isAdmin, users]);

    const planMap = useMemo(() => {
        if (!plans) return {};
        return plans.reduce((acc, plan) => {
            acc[plan.id] = plan.name;
            return acc;
        }, {} as Record<string, string>);
    }, [plans]);

    const teacherNameById = useMemo(() => {
        return (users || []).reduce((acc, user) => {
            const resolvedName = displayName(user);
            acc[user.id] = resolvedName || 'Teacher';
            return acc;
        }, {} as Record<string, string>);
    }, [users]);

    const assignableCourses = useMemo(
        () =>
            (courses || [])
                .filter((course) => isCourseAssignableForStudentAccess(course))
                .sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id))
                .map((course) => {
                    const teacherName = course.teacherId ? teacherNameById[course.teacherId] || 'Unknown Teacher' : 'Unknown Teacher';
                    return {
                        ...course,
                        label: `${course.title || 'Untitled Course'} - ${teacherName}`,
                    };
                }),
        [courses, teacherNameById]
    );

    const courseTitleById = useMemo(() => {
        return assignableCourses.reduce((acc, course) => {
            acc[course.id] = course.title || 'Untitled Course';
            return acc;
        }, {} as Record<string, string>);
    }, [assignableCourses]);

    const searchedUsers = useMemo(() => {
        if (!users) return [];
        const q = searchQuery.trim().toLowerCase();
        if (!q) return users;
        return users.filter(user =>
            [
                user.email || '',
                user.phoneNumber || '',
                user.firstName || '',
                user.lastName || '',
                user.roleId || '',
            ].join(' ').toLowerCase().includes(q)
        );
    }, [users, searchQuery]);

    const studentUsers = useMemo(
        () => searchedUsers.filter(user => user.roleId === 'student' || !user.roleId),
        [searchedUsers]
    );
    const teacherUsers = useMemo(
        () => searchedUsers.filter(user => isStaffRole(user.roleId)),
        [searchedUsers]
    );

    const studentActivityByUserId = useMemo(() => {
        const map: Record<string, StudentActivity> = {};
        const ensure = (userId: string) => {
            if (!map[userId]) map[userId] = emptyStudentActivity();
            return map[userId];
        };

        Object.entries(coursePurchasesByUserId).forEach(([userId, value]) => {
            const current = ensure(userId);
            current.purchasedCourses = value.count;
            current.lastActivityAt = maxDate(current.lastActivityAt, value.lastAt);
        });
        Object.entries(mockPurchasesByUserId).forEach(([userId, value]) => {
            const current = ensure(userId);
            current.purchasedMockTests = value.count;
            current.lastActivityAt = maxDate(current.lastActivityAt, value.lastAt);
        });
        Object.entries(batchEnrollmentsByUserId).forEach(([userId, value]) => {
            const current = ensure(userId);
            current.enrolledLiveBatches = value.count;
            current.lastActivityAt = maxDate(current.lastActivityAt, value.lastAt);
        });
        Object.entries(mockAttemptsByUserId).forEach(([userId, value]) => {
            const current = ensure(userId);
            current.mockAttempts = value.count;
            current.lastActivityAt = maxDate(current.lastActivityAt, value.lastAt);
        });
        Object.entries(practiceSessionsByUserId).forEach(([userId, value]) => {
            const current = ensure(userId);
            current.practiceSessions = value.count;
            current.lastActivityAt = maxDate(current.lastActivityAt, value.lastAt);
        });
        Object.entries(customMockTestsByUserId).forEach(([userId, value]) => {
            const current = ensure(userId);
            current.customMockTests = value.count;
            current.lastActivityAt = maxDate(current.lastActivityAt, value.lastAt);
        });

        (doubts || []).forEach(doubt => {
            if (!doubt.studentId) return;
            const current = ensure(doubt.studentId);
            current.doubtsAsked += 1;
            if (doubt.status === 'answered') current.doubtsAnswered += 1;
            current.lastActivityAt = maxDate(current.lastActivityAt, toDateSafe(doubt.createdAt));
        });

        (payments || []).forEach(payment => {
            if (!payment.userId || payment.status !== 'paid') return;
            const current = ensure(payment.userId);
            current.payments += 1;
            current.paymentAmount += Number(payment.grossAmount || 0);
            current.lastActivityAt = maxDate(current.lastActivityAt, toDateSafe(payment.purchasedAt));
        });

        return map;
    }, [batchEnrollmentsByUserId, coursePurchasesByUserId, customMockTestsByUserId, doubts, mockAttemptsByUserId, mockPurchasesByUserId, payments, practiceSessionsByUserId]);

    const teacherActivityByUserId = useMemo(() => {
        const map: Record<string, TeacherActivity> = {};
        const ensure = (userId: string) => {
            if (!map[userId]) map[userId] = emptyTeacherActivity();
            return map[userId];
        };

        (courses || []).forEach(course => {
            if (!course.teacherId) return;
            const current = ensure(course.teacherId);
            current.courses += 1;
            if (course.publicationStatus !== 'draft' && course.publicationStatus !== 'deleted') current.coursesPublished += 1;
            current.lastActivityAt = maxDate(current.lastActivityAt, maxDate(toDateSafe(course.updatedAt), toDateSafe(course.createdAt)));
        });
        (mockTests || []).forEach(test => {
            if (!test.teacherId) return;
            const current = ensure(test.teacherId);
            current.mockTests += 1;
            if (test.publicationStatus !== 'draft' && test.publicationStatus !== 'deleted') current.mockTestsPublished += 1;
            current.lastActivityAt = maxDate(current.lastActivityAt, maxDate(maxDate(toDateSafe(test.updatedAt), toDateSafe(test.createdAt)), toDateSafe(test.startTime)));
        });
        (liveBatches || []).forEach(batch => {
            if (!batch.teacherId) return;
            const current = ensure(batch.teacherId);
            current.liveBatches += 1;
            if (batch.publicationStatus !== 'draft' && batch.publicationStatus !== 'deleted') current.liveBatchesPublished += 1;
            current.lastActivityAt = maxDate(current.lastActivityAt, maxDate(toDateSafe(batch.updatedAt), toDateSafe(batch.createdAt)));
        });
        (contentItems || []).forEach(content => {
            if (!content.teacherId) return;
            const current = ensure(content.teacherId);
            current.contentUploads += 1;
            current.lastActivityAt = maxDate(current.lastActivityAt, maxDate(toDateSafe(content.updatedAt), toDateSafe(content.createdAt)));
        });
        (doubts || []).forEach(doubt => {
            if (!doubt.teacherId) return;
            if (doubt.status !== 'answered') return;
            const current = ensure(doubt.teacherId);
            current.doubtsAnswered += 1;
            current.lastActivityAt = maxDate(current.lastActivityAt, toDateSafe(doubt.createdAt));
        });
        (curriculumRequests || []).forEach(request => {
            if (!request.teacherId) return;
            const current = ensure(request.teacherId);
            current.curriculumRequests += 1;
            current.lastActivityAt = maxDate(current.lastActivityAt, maxDate(toDateSafe(request.reviewedAt), toDateSafe(request.createdAt)));
        });
        (payments || []).forEach(payment => {
            if (!payment.teacherId || payment.status !== 'paid') return;
            const current = ensure(payment.teacherId);
            current.payments += 1;
            current.paymentAmount += Number(payment.grossAmount || 0);
            current.lastActivityAt = maxDate(current.lastActivityAt, toDateSafe(payment.purchasedAt));
        });
        return map;
    }, [contentItems, courses, curriculumRequests, doubts, liveBatches, mockTests, payments]);

    const handleBlockUser = async () => {
        if (!userToBlock) return;
    
        setIsBlocking(true);
        try {
            const batch = writeBatch(firestore);
            
            const blockedEmailRef = doc(firestore, "blocked_emails", userToBlock.email);
            batch.set(blockedEmailRef, { blockedAt: new Date(), userId: userToBlock.id });
    
            const userRef = doc(firestore, 'users', userToBlock.id);
            batch.update(userRef, { status: 'blocked' });
    
            const teacherRoleRef = doc(firestore, 'roles_teacher', userToBlock.id);
            batch.delete(teacherRoleRef);
            
            const adminRoleRef = doc(firestore, 'roles_admin', userToBlock.id);
            batch.delete(adminRoleRef);
            
            await batch.commit();
            
            toast({
                title: 'User Blocked',
                description: `${userToBlock.firstName} ${userToBlock.lastName} has been blocked and can be unblocked from User Management.`,
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Blocking Failed', description: error.message });
        } finally {
            setIsBlocking(false);
            setUserToBlock(null);
        }
    };

    const deleteUserScopedCollectionDocs = async (userId: string, collectionName: string) => {
        const scopedCollection = collection(firestore, 'users', userId, collectionName);
        const snapshot = await getDocs(query(scopedCollection));

        if (collectionName === 'custom_tests') {
            for (const customTestDoc of snapshot.docs) {
                const attemptsSnapshot = await getDocs(
                    query(collection(firestore, 'users', userId, 'custom_tests', customTestDoc.id, 'attempts'))
                );
                await Promise.all(attemptsSnapshot.docs.map((attemptDoc) => deleteDoc(attemptDoc.ref)));
            }
        }

        await Promise.all(snapshot.docs.map((entryDoc) => deleteDoc(entryDoc.ref)));
    };

    const handleDeleteUserAccount = async () => {
        if (!userToBlock) return;
        if (auth.currentUser?.uid === userToBlock.id) {
            toast({
                variant: 'destructive',
                title: 'Delete blocked',
                description: 'You cannot delete your own account from this panel.',
            });
            return;
        }

        setIsDeleting(true);
        try {
            const userId = userToBlock.id;

            const userScopedCollections = [
                'subscriptions',
                'test_results',
                'practice_results',
                'course_progress',
                'custom_tests',
                'enrolled_live_batches',
                'chat_preferences',
                'sales',
                'purchased_courses',
                'purchased_mock_tests',
                'purchased_live_batches',
                'premium_mock_feature_purchases',
                'premium_practice_session_purchases',
            ];

            for (const collectionName of userScopedCollections) {
                await deleteUserScopedCollectionDocs(userId, collectionName);
            }

            const batch = writeBatch(firestore);
            const userRef = doc(firestore, 'users', userId);
            const teacherRoleRef = doc(firestore, 'roles_teacher', userId);
            const adminRoleRef = doc(firestore, 'roles_admin', userId);
            const blockedEmailRef = doc(firestore, 'blocked_emails', userToBlock.email);

            batch.delete(userRef);
            batch.delete(teacherRoleRef);
            batch.delete(adminRoleRef);
            // Deleting an account should not keep it in blocked-email records.
            batch.delete(blockedEmailRef);

            await batch.commit();

            toast({
                title: 'Account Deleted',
                description: `${userToBlock.firstName} ${userToBlock.lastName} has been permanently removed from the platform.`,
            });

            setAssignedCourseIdsByUserId((prev) => {
                const next = { ...prev };
                delete next[userId];
                return next;
            });
            setSelectedCourseByUserId((prev) => {
                const next = { ...prev };
                delete next[userId];
                return next;
            });
            setIsUpdatingCourseAccessByUserId((prev) => {
                const next = { ...prev };
                delete next[userId];
                return next;
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
        } finally {
            setIsDeleting(false);
            setUserToBlock(null);
        }
    };
    
    const handleUnblockUser = async () => {
        if (!userToUnblock) return;
    
        setIsUnblocking(true);
        try {
            const batch = writeBatch(firestore);
            
            const blockedEmailRef = doc(firestore, "blocked_emails", userToUnblock.email);
            batch.delete(blockedEmailRef);
    
            const userRef = doc(firestore, 'users', userToUnblock.id);
            batch.update(userRef, { status: 'active' });
    
            await batch.commit();
            
            toast({
                title: 'User Unblocked',
                description: `${userToUnblock.firstName} ${userToUnblock.lastName} has been unblocked.`,
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Unblocking Failed', description: error.message });
        } finally {
            setIsUnblocking(false);
            setUserToUnblock(null);
        }
    };

    const exportToExcel = (data: any[], fileName: string) => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
    };

    const handleExportStudents = () => {
        if (!users) return;
        const studentData = users
            .filter(user => user.roleId === 'student' || !user.roleId)
            .map(({ id, firstName, lastName, email, phoneNumber, roleId, subscriptionPlanId, subscriptionStatus }) => {
                const activity = studentActivityByUserId[id] || emptyStudentActivity();
                const assignedCourseIds = assignedCourseIdsByUserId[id] || [];
                const assignedCourses = assignedCourseIds.map((courseId) => courseTitleById[courseId] || courseId).join(', ');
                return ({ 
                id, 
                firstName, 
                lastName, 
                email, 
                phoneNumber, 
                roleId,
                subscriptionPlan: subscriptionPlanId ? (planMap[subscriptionPlanId] || 'N/A') : 'No Plan',
                subscriptionStatus: subscriptionStatus || 'none',
                purchasedCourses: activity.purchasedCourses,
                assignedCourseCount: assignedCourseIds.length,
                assignedCourses: assignedCourses || 'none',
                purchasedMockTests: activity.purchasedMockTests,
                enrolledLiveBatches: activity.enrolledLiveBatches,
                mockAttempts: activity.mockAttempts,
                practiceSessions: activity.practiceSessions,
                customMockTests: activity.customMockTests,
                doubtsAsked: activity.doubtsAsked,
                doubtsAnswered: activity.doubtsAnswered,
                payments: activity.payments,
                paymentAmount: activity.paymentAmount,
                lastActivity: formatLastActivity(activity.lastActivityAt),
             })});
        exportToExcel(studentData, 'students_export');
    };

    const handleExportTeachers = () => {
        if (!users) return;
        const teacherData = users
            .filter(user => isStaffRole(user.roleId))
            .map(({ id, firstName, lastName, email, phoneNumber, roleId, teacherStatus }) => {
                const activity = teacherActivityByUserId[id] || emptyTeacherActivity();
                return ({
                    id, firstName, lastName, email, phoneNumber, roleId, teacherStatus,
                    courses: activity.courses,
                    coursesPublished: activity.coursesPublished,
                    mockTests: activity.mockTests,
                    mockTestsPublished: activity.mockTestsPublished,
                    liveBatches: activity.liveBatches,
                    liveBatchesPublished: activity.liveBatchesPublished,
                    contentUploads: activity.contentUploads,
                    doubtsAnswered: activity.doubtsAnswered,
                    curriculumRequests: activity.curriculumRequests,
                    payments: activity.payments,
                    paymentAmount: activity.paymentAmount,
                    lastActivity: formatLastActivity(activity.lastActivityAt),
                })
            });
        exportToExcel(teacherData, 'teachers_export');
    };
    
    const handleAssignCourse = async (student: UserProfile) => {
        const selectedCourseId = selectedCourseByUserId[student.id];
        if (!selectedCourseId) {
            toast({ variant: 'destructive', title: 'Select a course first' });
            return;
        }

        const selectedCourse = assignableCourses.find((course) => course.id === selectedCourseId);
        if (!selectedCourse) {
            toast({ variant: 'destructive', title: 'Selected course not found' });
            return;
        }

        setIsUpdatingCourseAccessByUserId((prev) => ({ ...prev, [student.id]: true }));
        try {
            const nowIso = new Date().toISOString();
            await setDoc(
                doc(firestore, 'users', student.id, 'purchased_courses', selectedCourseId),
                buildAdminAssignedCoursePayload({
                    courseId: selectedCourseId,
                    teacherId: selectedCourse.teacherId || null,
                    adminUserId: auth.currentUser?.uid || '',
                    adminUserEmail: auth.currentUser?.email || '',
                    assignedAt: nowIso,
                }),
                { merge: true }
            );

            const now = new Date();
            setAssignedCourseIdsByUserId((prev) => {
                const existing = prev[student.id] || [];
                if (existing.includes(selectedCourseId)) return prev;
                const updated = [...existing, selectedCourseId];
                setCoursePurchasesByUserId((prevCounts) => ({
                    ...prevCounts,
                    [student.id]: { count: updated.length, lastAt: now },
                }));
                return { ...prev, [student.id]: updated };
            });

            toast({
                title: 'Course Assigned',
                description: `${courseTitleById[selectedCourseId] || 'Course'} assigned to ${displayName(student)}.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Assignment Failed',
                description: error.message,
            });
        } finally {
            setIsUpdatingCourseAccessByUserId((prev) => ({ ...prev, [student.id]: false }));
        }
    };

    const totalStudents = (users || []).filter(user => user.roleId === 'student' || !user.roleId).length;
    const totalTeachers = (users || []).filter(user => isStaffRole(user.roleId)).length;
    const totalBlockedUsers = (users || []).filter(user => user.status === 'blocked').length;
    const totalAssignedCourses = Object.values(assignedCourseIdsByUserId).reduce((sum, ids) => sum + ids.length, 0);

    const isLoading =
        isAdminLoading ||
        areUsersLoading ||
        arePlansLoading ||
        areCoursesLoading ||
        areMockTestsLoading ||
        areLiveBatchesLoading ||
        areDoubtsLoading ||
        arePaymentsLoading ||
        areContentItemsLoading ||
        areCurriculumRequestsLoading ||
        isActivityLoading;

    if (isLoading) {
        return <div className="p-8"><Skeleton className="h-48 w-full" /></div>
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col h-full">
                <DashboardHeader title="Access Denied" />
                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 flex items-center justify-center">
                    <Card className="w-full max-w-md text-center">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-center gap-2 text-destructive">
                                <AlertTriangle /> Access Denied
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p>You do not have permission to view this page. Please contact an administrator if you believe this is an error.</p>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <DashboardHeader title="User Management" />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
                <Card className="border-primary/25 bg-gradient-to-r from-primary/10 via-background to-background">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <Activity className="h-6 w-6 text-primary" />
                            Student & Teacher Tracking
                        </CardTitle>
                        <CardDescription>
                            User management is split by role and now tracks current platform activity for students, teachers, and question upload accounts.
                        </CardDescription>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Students</p>
                                <p className="mt-1 text-xl font-semibold">{totalStudents}</p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Staff Roles</p>
                                <p className="mt-1 text-xl font-semibold">{totalTeachers}</p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Blocked Users</p>
                                <p className="mt-1 text-xl font-semibold">{totalBlockedUsers}</p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned Courses</p>
                                <p className="mt-1 text-xl font-semibold">{totalAssignedCourses}</p>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader className="space-y-4">
                        <div>
                            <CardTitle>User Directory</CardTitle>
                            <CardDescription>Track role-based activity and manage accounts.</CardDescription>
                        </div>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="relative w-full md:max-w-sm">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name, email, phone..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleExportStudents} variant="outline" size="sm">Export Students</Button>
                                <Button onClick={handleExportTeachers} variant="outline" size="sm">Export Teachers</Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'students' | 'teachers')} className="space-y-4">
                            <TabsList>
                                <TabsTrigger value="students">Students ({studentUsers.length})</TabsTrigger>
                                <TabsTrigger value="teachers">Staff ({teacherUsers.length})</TabsTrigger>
                            </TabsList>

                            <TabsContent value="students" className="space-y-3">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Phone</TableHead>
                                            <TableHead>Last Activity</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {studentUsers.length > 0 ? (
                                            studentUsers.map(user => {
                                                const activity = studentActivityByUserId[user.id] || emptyStudentActivity();
                                                return (
                                                    <TableRow key={user.id}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <Avatar>
                                                                    <AvatarImage src={user.photoURL} />
                                                                    <AvatarFallback>{user.firstName?.charAt(0)}{user.lastName?.charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                                <span className="font-medium">{displayName(user)}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{user.email}</TableCell>
                                                        <TableCell>{user.phoneNumber}</TableCell>
                                                        <TableCell>
                                                            <p className="text-sm font-medium">{formatLastActivity(activity.lastActivityAt)}</p>
                                                            <p className="text-xs text-muted-foreground">Open Manage to view and reset the password for this account.</p>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex flex-wrap justify-end items-center gap-2">
                                                                {user.status === 'blocked' ? (
                                                                    <>
                                                                        <Button variant="outline" size="sm" onClick={() => setUserToUnblock(user)}>Unblock</Button>
                                                                        <Button asChild size="sm" variant="outline">
                                                                            <Link href={`/admin/students/${user.id}`}>Manage</Link>
                                                                        </Button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Button asChild size="sm" variant="outline">
                                                                            <Link href={`/admin/students/${user.id}`}>Manage</Link>
                                                                        </Button>
                                                                        <RoleSelector user={user} />
                                                                        <Button variant="ghost" size="icon" onClick={() => setUserToBlock(user)}>
                                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-24">No students found.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>

                            <TabsContent value="teachers" className="space-y-3">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Phone</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Activity</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {teacherUsers.length > 0 ? (
                                            teacherUsers.map(user => {
                                                const activity = teacherActivityByUserId[user.id] || emptyTeacherActivity();
                                                return (
                                                    <TableRow key={user.id}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <Avatar>
                                                                    <AvatarImage src={user.photoURL} />
                                                                    <AvatarFallback>{user.firstName?.charAt(0)}{user.lastName?.charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                                <span className="font-medium">{displayName(user)}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{user.email}</TableCell>
                                                        <TableCell>{user.phoneNumber}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={getStaffRoleBadgeVariant(user.roleId)}>
                                                                {formatManagedRoleLabel(user.roleId)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-wrap gap-1">
                                                                <Badge variant="outline">Courses {activity.coursesPublished}/{activity.courses}</Badge>
                                                                <Badge variant="outline">Tests {activity.mockTestsPublished}/{activity.mockTests}</Badge>
                                                                <Badge variant="outline">Batches {activity.liveBatchesPublished}/{activity.liveBatches}</Badge>
                                                                <Badge variant="outline">Doubts {activity.doubtsAnswered}</Badge>
                                                            </div>
                                                            <p className="mt-1 text-xs text-muted-foreground">{formatLastActivity(activity.lastActivityAt)}</p>
                                                            <p className="text-xs text-muted-foreground">Open Manage to view and reset the password for this account.</p>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end items-center gap-2">
                                                                {user.status === 'blocked' ? (
                                                                    <>
                                                                        <Button variant="outline" size="sm" onClick={() => setUserToUnblock(user)}>Unblock</Button>
                                                                        <Button asChild size="sm" variant="outline">
                                                                            <Link href={`/admin/students/teachers/${user.id}`}>Manage</Link>
                                                                        </Button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Button asChild size="sm" variant="outline">
                                                                            <Link href={`/admin/students/teachers/${user.id}`}>Manage</Link>
                                                                        </Button>
                                                                        <RoleSelector user={user} />
                                                                        <Button variant="ghost" size="icon" onClick={() => setUserToBlock(user)}>
                                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center h-24">No staff accounts found.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </main>
            <AlertDialog open={!!userToBlock} onOpenChange={() => setUserToBlock(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Block or delete this user?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Choose what to do with {userToBlock?.firstName} {userToBlock?.lastName}.
                            Blocking is reversible from User Management. Deleting removes the account data permanently.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isBlocking || isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleBlockUser}
                            disabled={isBlocking || isDeleting}
                            className="bg-amber-500 text-black hover:bg-amber-400 focus-visible:ring-amber-300/60"
                        >
                            {isBlocking && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            Block User
                        </AlertDialogAction>
                        <AlertDialogAction
                            onClick={handleDeleteUserAccount}
                            disabled={isBlocking || isDeleting}
                            className={cn(buttonVariants({ variant: 'destructive' }))}
                        >
                            {isDeleting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            Delete Account
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={!!userToUnblock} onOpenChange={() => setUserToUnblock(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unblock this user?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will unblock {userToUnblock?.firstName} {userToUnblock?.lastName}. They will be able to log in again.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnblockUser} disabled={isUnblocking}>
                            {isUnblocking && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            Unblock User
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
