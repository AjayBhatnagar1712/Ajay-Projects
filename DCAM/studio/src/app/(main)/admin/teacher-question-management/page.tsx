'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, orderBy, query, setDoc, where } from 'firebase/firestore';
import {
  Clock3,
  CalendarClock,
  Mail,
  PackagePlus,
  Phone,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

import TeacherDashboardPremiumQuestionHub, {
  type TeacherPremiumQuestionSelectionContext,
} from '@/components/teacher-dashboard-premium-question-hub';
import DashboardHeader from '@/components/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useToast } from '@/hooks/use-toast';
import {
  buildTeacherQuestionPurchaseRenewParams,
} from '@/lib/teacher-premium-question-access';
import {
  ADMIN_TEACHER_QUESTION_ASSIGNMENT_SOURCE,
  buildAdminTeacherQuestionPurchaseDoc,
} from '@/lib/admin-teacher-question-management';
import { isAllowedTeacherAuthorEmail, ALLOWED_TEACHER_AUTHOR_EMAIL } from '@/lib/teacher-authoring';
import {
  buildTeacherQuestionPurchaseScopeDetail,
  buildTeacherQuestionPurchaseScopeLabel,
  computeTeacherQuestionPurchaseExtendedAccessEndDate,
  computeTeacherQuestionPurchaseExtensionAmount,
  extendTeacherQuestionPurchaseDoc,
  formatRupeeAmount,
  getTeacherQuestionPurchaseResolvedAccessEndsAt,
  getTeacherQuestionPurchaseResolvedDaysCount,
  isTeacherQuestionPurchaseActiveAt,
  normalizeTeacherQuestionExtensionDayCount,
  normalizeTeacherQuestionStoredDayCount,
  syncTeacherQuestionPurchasePublicScopes,
  type TeacherQuestionPurchaseDoc,
} from '@/lib/teacher-question-purchase';

type TeacherProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  roleId?: 'student' | 'teacher' | 'admin';
  status?: 'active' | 'blocked';
};

const displayTeacherName = (teacher?: TeacherProfile | null) =>
  `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim()
  || teacher?.displayName
  || teacher?.email
  || 'Teacher';

export default function AdminTeacherQuestionManagementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherProfile | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [manageTab, setManageTab] = useState<'assign' | 'existing'>('assign');
  const [prefillAssignmentPurchaseId, setPrefillAssignmentPurchaseId] = useState('');
  const [assignmentExtensionDaysByPurchaseId, setAssignmentExtensionDaysByPurchaseId] = useState<Record<string, string>>({});

  const teachersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), where('roleId', '==', 'teacher')) : null),
    [firestore],
  );
  const { data: teachersRaw, isLoading: areTeachersLoading } = useCollection<TeacherProfile>(teachersQuery);
  const teachers = teachersRaw ?? [];
  const selectedTeacherPurchasesQuery = useMemoFirebase(
    () => (
      firestore && selectedTeacher?.id
        ? query(collection(firestore, 'users', selectedTeacher.id, 'teacher_question_purchases'), orderBy('updatedAt', 'desc'))
        : null
    ),
    [firestore, selectedTeacher?.id],
  );
  const { data: selectedTeacherPurchasesRaw } = useCollection<TeacherQuestionPurchaseDoc>(selectedTeacherPurchasesQuery);
  const selectedTeacherAdminAssignedPurchases = useMemo(
    () => (selectedTeacherPurchasesRaw || []).filter((purchase) => purchase.assignmentSource === ADMIN_TEACHER_QUESTION_ASSIGNMENT_SOURCE),
    [selectedTeacherPurchasesRaw],
  );

  useEffect(() => {
    setAssignmentExtensionDaysByPurchaseId({});
    setPrefillAssignmentPurchaseId('');
    setManageTab('assign');
  }, [selectedTeacher?.id]);

  useEffect(() => {
    if (!selectedTeacher?.id) return;
    if (prefillAssignmentPurchaseId) return;
    setManageTab(selectedTeacherAdminAssignedPurchases.length > 0 ? 'existing' : 'assign');
  }, [prefillAssignmentPurchaseId, selectedTeacher?.id, selectedTeacherAdminAssignedPurchases.length]);

  const filteredTeachers = useMemo(() => {
    const queryText = searchTerm.trim().toLowerCase();
    return [...teachers]
      .filter((teacher) => teacher.roleId === 'teacher')
      .filter((teacher) => !isAllowedTeacherAuthorEmail(teacher.email))
      .filter((teacher) => {
        if (!queryText) return true;
        const haystack = [
          displayTeacherName(teacher),
          teacher.email || '',
          teacher.phoneNumber || '',
        ].join(' ').toLowerCase();
        return haystack.includes(queryText);
      })
      .sort((left, right) => displayTeacherName(left).localeCompare(displayTeacherName(right)));
  }, [searchTerm, teachers]);

  const activeTeacherCount = useMemo(
    () => filteredTeachers.filter((teacher) => (teacher.status || 'active') !== 'blocked').length,
    [filteredTeachers],
  );
  const selectedTeacherAdminAssignedSummary = useMemo(() => {
    const active = selectedTeacherAdminAssignedPurchases.filter((purchase) => isTeacherQuestionPurchaseActiveAt(purchase));
    const expired = selectedTeacherAdminAssignedPurchases.length - active.length;
    const totalQuestions = selectedTeacherAdminAssignedPurchases.reduce(
      (count, purchase) => count + Math.max(0, Number(purchase.totalQuestionCount || 0)),
      0
    );
    return {
      total: selectedTeacherAdminAssignedPurchases.length,
      active: active.length,
      expired,
      totalQuestions,
    };
  }, [selectedTeacherAdminAssignedPurchases]);
  const prefillAssignmentPurchase = useMemo(
    () => selectedTeacherAdminAssignedPurchases.find((purchase) => purchase.id === prefillAssignmentPurchaseId) || null,
    [prefillAssignmentPurchaseId, selectedTeacherAdminAssignedPurchases]
  );

  const handleAssignQuestions = async (context: TeacherPremiumQuestionSelectionContext) => {
    if (!firestore || !user?.uid || !selectedTeacher?.id) return;

    const purchaseRef = doc(collection(firestore, 'users', selectedTeacher.id, 'teacher_question_purchases'));
    const payload = buildAdminTeacherQuestionPurchaseDoc({
      id: purchaseRef.id,
      teacherUserId: selectedTeacher.id,
      teacherName: displayTeacherName(selectedTeacher),
      teacherEmail: selectedTeacher.email || '',
      questionBankOwnerId: context.ownerId,
      questionBankOwnerName: context.ownerName,
      request: context.request,
      regularPricing: context.pricing.regularPricing,
      pyqPricing: context.pricing.pyqPricing,
      referenceTotalAmount: context.pricing.totalAmount,
      assignedByAdminId: user.uid,
      assignedByAdminEmail: user.email || '',
    });

    setBusyKey(`assign_${selectedTeacher.id}`);
      try {
        await setDoc(purchaseRef, payload, { merge: true });
        await syncTeacherQuestionPurchasePublicScopes(firestore, selectedTeacher.id);
        toast({
          title: 'Teacher question access assigned',
        description: `${context.pricing.totalQuestionCount} paid question${context.pricing.totalQuestionCount === 1 ? '' : 's'} are now available for ${displayTeacherName(selectedTeacher)} in Their Purchases.`,
      });
      setIsAssignDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Assignment failed.';
      toast({
        variant: 'destructive',
        title: 'Could not assign teacher question access',
        description: errorMessage,
      });
    } finally {
      setBusyKey('');
    }
  };

  const handleIncreaseAssignedDays = async (purchase: TeacherQuestionPurchaseDoc) => {
    if (!firestore || !user?.uid || !selectedTeacher?.id) return;

    const rawAddedDays = assignmentExtensionDaysByPurchaseId[purchase.id];
    const addedDaysCount = normalizeTeacherQuestionExtensionDayCount(rawAddedDays);
    const pricingReferenceAmountDelta = computeTeacherQuestionPurchaseExtensionAmount({
      purchase,
      addedDaysCount,
    });
    const updatedAt = new Date().toISOString();
    const updatedPurchase = extendTeacherQuestionPurchaseDoc({
      purchase,
      addedDaysCount,
      extendedAt: updatedAt,
      source: 'admin_extension',
      pricingReferenceAmountDelta,
      assignedByAdminId: user.uid,
      assignedByAdminEmail: user.email || '',
    });

    setBusyKey(`extend_${purchase.id}`);
      try {
        await setDoc(
          doc(firestore, 'users', selectedTeacher.id, 'teacher_question_purchases', purchase.id),
          updatedPurchase,
          { merge: true },
        );
        await syncTeacherQuestionPurchasePublicScopes(firestore, selectedTeacher.id);
        setAssignmentExtensionDaysByPurchaseId((current) => ({
        ...current,
        [purchase.id]: '1',
      }));
      toast({
        title: 'Assigned validity increased',
        description: `${displayTeacherName(selectedTeacher)} now has ${normalizeTeacherQuestionStoredDayCount(updatedPurchase.daysCount)} total days on this assigned question scope.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Day increase failed.';
      toast({
        variant: 'destructive',
        title: 'Could not increase assigned days',
        description: errorMessage,
      });
    } finally {
      setBusyKey('');
    }
  };

  if (isAdminLoading || areTeachersLoading) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Teacher Question Management" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Teacher Question Management" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="border-rose-400/30 bg-rose-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-100">
                <ShieldCheck className="h-5 w-5" />
                Admin access required
              </CardTitle>
              <CardDescription className="text-rose-100/80">
                Only admins can assign paid DCAM question access to teacher accounts.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Teacher Question Management" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <Card className="border-border/70 bg-gradient-to-r from-slate-900 via-slate-900/95 to-cyan-950/40">
            <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <Badge variant="outline" className="border-cyan-300/40 bg-cyan-500/10 text-cyan-100">
                  Admin Teacher Access
                </Badge>
                <div>
                  <h2 className="text-3xl font-semibold text-white">Grant Teacher Premium Questions</h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-300 md:text-base">
                    Open the same paid-question flow teachers use, choose the exact scope, question counts, students, and days,
                    then assign that stock directly into the teacher&apos;s purchase ledger.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Teachers</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{filteredTeachers.length}</p>
                </div>
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/80">Active</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-50">{activeTeacherCount}</p>
                </div>
                <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-amber-100/80">Bank Owner</p>
                  <p className="mt-2 text-sm font-semibold text-amber-50">{ALLOWED_TEACHER_AUTHOR_EMAIL}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-300/25 bg-amber-500/10">
            <CardContent className="p-4 text-sm text-amber-100">
              The DCAM bank-owner account <span className="font-semibold">{ALLOWED_TEACHER_AUTHOR_EMAIL}</span> is intentionally kept outside this admin-assignment flow,
              so its current question-bank owner behavior stays unchanged.
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/90">
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Users className="h-5 w-5 text-cyan-300" />
                  Teachers
                </CardTitle>
                <CardDescription>
                  Search teachers, review contact details, and assign paid DCAM question stock into their purchase ledger.
                </CardDescription>
              </div>
              <div className="relative w-full md:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by name, phone, or email"
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeachers.length > 0 ? filteredTeachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{displayTeacherName(teacher)}</p>
                          <p className="text-xs text-muted-foreground">
                            {(teacher.status || 'active') === 'blocked' ? 'Blocked teacher' : 'Active teacher'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span>{teacher.phoneNumber || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span>{teacher.email || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            teacher.status === 'blocked'
                              ? 'border-rose-300/40 bg-rose-500/10 text-rose-100'
                              : 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100'
                          }
                        >
                          {teacher.status === 'blocked' ? 'Blocked' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          className="rounded-full"
                          onClick={() => {
                            setSelectedTeacher(teacher);
                            setIsAssignDialogOpen(true);
                            setPrefillAssignmentPurchaseId('');
                          }}
                        >
                          <PackagePlus className="mr-2 h-4 w-4" />
                          Manage Access
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                        No teachers matched the current search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog
        open={isAssignDialogOpen}
        onOpenChange={(open) => {
          setIsAssignDialogOpen(open);
          if (!open) setSelectedTeacher(null);
        }}
      >
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-7xl flex-col overflow-hidden border-border/70 bg-slate-950 p-0 text-slate-50">
          <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5">
            <DialogTitle className="text-2xl">Manage Teacher Premium Questions</DialogTitle>
            <DialogDescription className="text-slate-300">
              Create new paid-question access or update earlier admin-assigned access for {displayTeacherName(selectedTeacher)}.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            {selectedTeacher ? (
              <div className="space-y-5">
                <div className="grid gap-4 xl:grid-cols-4">
                  <Card className="border-white/10 bg-slate-900/70">
                    <CardContent className="p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Teacher</p>
                      <p className="mt-2 text-base font-semibold text-white">{displayTeacherName(selectedTeacher)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-slate-900/70">
                    <CardContent className="p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Email</p>
                      <p className="mt-2 text-sm font-medium text-white">{selectedTeacher.email || 'N/A'}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-slate-900/70">
                    <CardContent className="p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Admin assigned packs</p>
                      <p className="mt-2 text-base font-semibold text-white">{selectedTeacherAdminAssignedSummary.total}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {selectedTeacherAdminAssignedSummary.active} active • {selectedTeacherAdminAssignedSummary.expired} expired
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-slate-900/70">
                    <CardContent className="p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Assigned question stock</p>
                      <p className="mt-2 text-base font-semibold text-white">{selectedTeacherAdminAssignedSummary.totalQuestions}</p>
                      <p className="mt-1 text-xs text-slate-400">{selectedTeacher.phoneNumber || 'No phone added'}</p>
                    </CardContent>
                  </Card>
                </div>

                <Tabs value={manageTab} onValueChange={(value) => setManageTab(value as 'assign' | 'existing')} className="space-y-4">
                  <TabsList className="h-auto w-full justify-start gap-2 rounded-2xl bg-slate-900/70 p-2">
                    <TabsTrigger value="assign" className="rounded-xl px-4 py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white">
                      Assign New Access
                    </TabsTrigger>
                    <TabsTrigger value="existing" className="rounded-xl px-4 py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white">
                      Manage Existing Access
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="assign" className="mt-0">
                    <Card className="border-white/10 bg-slate-900/70">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Assign new paid question access</CardTitle>
                        <CardDescription className="text-slate-300">
                          Choose a scope from the DCAM paid question bank and write it into the teacher&apos;s purchase ledger.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {prefillAssignmentPurchase ? (
                          <div className="flex flex-col gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-cyan-50">Assigning same scope again</p>
                              <p className="text-sm text-cyan-100">{buildTeacherQuestionPurchaseScopeLabel(prefillAssignmentPurchase)}</p>
                              <p className="text-xs text-cyan-100/80">
                                Scope is locked to this earlier assignment. Change counts, students, or days as needed.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full border-cyan-300/35 bg-transparent text-cyan-50 hover:bg-cyan-500/10"
                              onClick={() => setPrefillAssignmentPurchaseId('')}
                            >
                              Start different scope
                            </Button>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
                            Use this for a brand-new assignment, or to grant a fresh pack in another exam, curriculum, or subject.
                          </div>
                        )}

                        <TeacherDashboardPremiumQuestionHub
                          key={`${selectedTeacher.id}__${prefillAssignmentPurchaseId || 'new'}`}
                          purchaseLedgerUserId={selectedTeacher.id}
                          disableUrlPrefill
                          prefillPayloadOverride={prefillAssignmentPurchase ? buildTeacherQuestionPurchaseRenewParams(prefillAssignmentPurchase) : null}
                          lockScopeSelection={!!prefillAssignmentPurchase}
                          primaryActionLabel={prefillAssignmentPurchase ? 'Assign Same Scope Again' : 'Assign Question Access'}
                          primaryActionHelperText={
                            prefillAssignmentPurchase
                              ? 'This creates another paid-question pack in the same scope. The teacher’s usable stock will stack automatically.'
                              : 'Assign this paid question stock directly to the selected teacher. It will appear in Their Purchases and follow the same expiry and top-up rules as normal teacher purchases.'
                          }
                          onPrimaryAction={handleAssignQuestions}
                          isPrimaryActionBusy={busyKey === `assign_${selectedTeacher.id}`}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="existing" className="mt-0">
                    <Card className="border-white/10 bg-slate-900/70">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Existing admin-assigned access</CardTitle>
                        <CardDescription className="text-slate-300">
                          Renew expired packs, increase validity, or top up the same scope again without charging the teacher directly.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {selectedTeacherAdminAssignedPurchases.length > 0 ? selectedTeacherAdminAssignedPurchases.map((purchase) => {
                          const addedDaysInput = assignmentExtensionDaysByPurchaseId[purchase.id] || '1';
                          const normalizedAddedDays = normalizeTeacherQuestionExtensionDayCount(addedDaysInput);
                          const resolvedDaysCount = getTeacherQuestionPurchaseResolvedDaysCount(purchase);
                          const resolvedAccessEndsAt = getTeacherQuestionPurchaseResolvedAccessEndsAt(purchase);
                          const updatedDaysCount = resolvedDaysCount + normalizedAddedDays;
                          const updatedAccessEndsAt = computeTeacherQuestionPurchaseExtendedAccessEndDate(
                            purchase,
                            normalizedAddedDays,
                          );
                          const referenceValueDelta = computeTeacherQuestionPurchaseExtensionAmount({
                            purchase,
                            addedDaysCount: normalizedAddedDays,
                          });
                          const isActive = isTeacherQuestionPurchaseActiveAt(purchase);

                          return (
                            <div
                              key={purchase.id}
                              className="rounded-3xl border border-white/10 bg-slate-950/45 p-5"
                            >
                              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="border-cyan-300/30 bg-cyan-500/10 text-cyan-100">
                                      Admin assigned
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={isActive
                                        ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100'
                                        : 'border-amber-300/30 bg-amber-500/10 text-amber-100'}
                                    >
                                      {isActive ? 'Active' : 'Expired'}
                                    </Badge>
                                  </div>
                                  <p className="text-lg font-semibold text-white">
                                    {buildTeacherQuestionPurchaseScopeLabel(purchase) || 'Assigned question scope'}
                                  </p>
                                  <p className="text-sm text-slate-300">
                                    {buildTeacherQuestionPurchaseScopeDetail(purchase) || 'All topics'}
                                  </p>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-4">
                                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Questions</p>
                                    <p className="mt-2 text-xl font-semibold text-white">{purchase.totalQuestionCount}</p>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Students</p>
                                    <p className="mt-2 text-xl font-semibold text-white">{Math.max(1, Number(purchase.studentsCount || 1))}</p>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Days</p>
                                    <p className="mt-2 text-xl font-semibold text-white">{resolvedDaysCount}</p>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Valid till</p>
                                    <p className="mt-2 text-sm font-semibold text-white">
                                      {resolvedAccessEndsAt
                                        ? new Date(resolvedAccessEndsAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                        : 'N/A'}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
                                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                                    <label htmlFor={`assigned-days-${purchase.id}`} className="text-sm font-medium text-slate-100">
                                      {isActive ? 'Add more days' : 'Renew with days'}
                                    </label>
                                    <Input
                                      id={`assigned-days-${purchase.id}`}
                                      type="number"
                                      min={1}
                                      max={365}
                                      step={1}
                                      inputMode="numeric"
                                      value={addedDaysInput}
                                      onChange={(event) => setAssignmentExtensionDaysByPurchaseId((current) => ({
                                        ...current,
                                        [purchase.id]: event.target.value,
                                      }))}
                                      onBlur={() => setAssignmentExtensionDaysByPurchaseId((current) => ({
                                        ...current,
                                        [purchase.id]: String(normalizedAddedDays),
                                      }))}
                                      className="mt-3 h-12 rounded-2xl border-white/10 bg-slate-950/80 text-base"
                                      disabled={busyKey === `extend_${purchase.id}`}
                                    />
                                  </div>

                                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                                    <p className="flex items-center gap-2 text-sm font-semibold text-white">
                                      <CalendarClock className="h-4 w-4 text-primary" />
                                      Updated validity preview
                                    </p>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                      <div>
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Added days</p>
                                        <p className="mt-2 text-lg font-semibold text-white">{normalizedAddedDays}</p>
                                      </div>
                                      <div>
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">New total days</p>
                                        <p className="mt-2 text-lg font-semibold text-white">{updatedDaysCount}</p>
                                      </div>
                                      <div>
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">New valid till</p>
                                        <p className="mt-2 text-sm font-semibold text-white">
                                          {new Date(updatedAccessEndsAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                      </div>
                                    </div>
                                    <p className="mt-3 text-xs text-slate-400">
                                      Reference value added: {formatRupeeAmount(referenceValueDelta)}. This updates admin-assigned validity without charging the teacher.
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-3 xl:items-end xl:justify-between">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-full border-cyan-300/35 bg-transparent text-cyan-50 hover:bg-cyan-500/10"
                                    onClick={() => {
                                      setPrefillAssignmentPurchaseId(purchase.id);
                                      setManageTab('assign');
                                    }}
                                  >
                                    <PackagePlus className="mr-2 h-4 w-4" />
                                    Assign same scope again
                                  </Button>
                                  <Button
                                    type="button"
                                    className="rounded-full"
                                    onClick={() => void handleIncreaseAssignedDays(purchase)}
                                    disabled={busyKey === `extend_${purchase.id}`}
                                  >
                                    <Clock3 className="mr-2 h-4 w-4" />
                                    {isActive ? 'Increase days' : 'Renew days'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 p-6 text-center">
                            <p className="text-base font-semibold text-white">No admin-assigned question access yet</p>
                            <p className="mt-2 text-sm text-slate-300">
                              Start in Assign New Access to create the first paid question pack for this teacher.
                            </p>
                            <Button type="button" className="mt-4 rounded-full" onClick={() => setManageTab('assign')}>
                              Assign first question access
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

