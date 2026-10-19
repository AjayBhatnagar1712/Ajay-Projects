'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { collection, doc, orderBy, query, writeBatch } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useToast } from '@/hooks/use-toast';
import {
  getNormalizedTeacherStatus,
  type TeacherApprovalStatus,
} from '@/lib/teacher-approval';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, LoaderCircle, Search, XCircle } from 'lucide-react';

type UserProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  roleId?: 'student' | 'teacher' | 'admin';
  teacherStatus?: TeacherApprovalStatus;
  status?: 'active' | 'blocked';
};

function TeacherStatusBadge({ status }: { status: TeacherApprovalStatus }) {
  if (status === 'approved') {
    return <Badge className="bg-emerald-500/15 text-emerald-100">Approved</Badge>;
  }
  if (status === 'rejected') {
    return <Badge variant="destructive">Rejected</Badge>;
  }
  return <Badge variant="secondary">Pending</Badge>;
}

export default function TeacherApprovalsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const [activeTab, setActiveTab] = useState<TeacherApprovalStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingTeacherId, setProcessingTeacherId] = useState('');

  const usersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), orderBy('firstName')) : null),
    [firestore]
  );
  const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  const teacherRequests = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return (users || [])
      .filter((user) => user.roleId === 'teacher')
      .map((user) => ({
        ...user,
        normalizedTeacherStatus: getNormalizedTeacherStatus(user) || 'pending',
      }))
      .filter((user) => {
        if (!normalizedSearch) return true;
        const haystack = `${user.firstName || ''} ${user.lastName || ''} ${user.email || ''} ${user.phoneNumber || ''}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
  }, [searchQuery, users]);

  const pendingTeachers = useMemo(
    () => teacherRequests.filter((user) => user.normalizedTeacherStatus === 'pending'),
    [teacherRequests]
  );
  const approvedTeachers = useMemo(
    () => teacherRequests.filter((user) => user.normalizedTeacherStatus === 'approved'),
    [teacherRequests]
  );
  const rejectedTeachers = useMemo(
    () => teacherRequests.filter((user) => user.normalizedTeacherStatus === 'rejected'),
    [teacherRequests]
  );

  async function updateTeacherApproval(user: UserProfile, nextStatus: TeacherApprovalStatus) {
    if (!firestore) return;
    setProcessingTeacherId(user.id);
    try {
      const batch = writeBatch(firestore);
      const userRef = doc(firestore, 'users', user.id);
      const teacherRoleRef = doc(firestore, 'roles_teacher', user.id);

      batch.set(
        userRef,
        {
          roleId: 'teacher',
          teacherStatus: nextStatus,
        },
        { merge: true }
      );

      if (nextStatus === 'approved') {
        batch.set(teacherRoleRef, { createdAt: new Date().toISOString() }, { merge: true });
      } else {
        batch.delete(teacherRoleRef);
      }

      await batch.commit();

      toast({
        title: nextStatus === 'approved' ? 'Teacher Approved' : nextStatus === 'rejected' ? 'Teacher Rejected' : 'Moved Back To Review',
        description: `${user.firstName || 'This teacher'} is now marked as ${nextStatus}.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Approval update failed',
        description: error?.message || 'Could not update teacher approval status.',
      });
    } finally {
      setProcessingTeacherId('');
    }
  }

  const loading = isAdminLoading || areUsersLoading;

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Teacher Approvals" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-80 w-full" />
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Teacher Approvals" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">Only admins can review teacher approval requests.</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Teacher Approvals" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
        <Card className="border-border/70 bg-gradient-to-r from-primary/10 via-background to-background">
          <CardHeader>
            <CardTitle>Teacher Approval Queue</CardTitle>
            <CardDescription>
              New teacher signups stay locked until approved here. Students cannot discover or use their public teacher pages until approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
              <p className="mt-1 text-2xl font-semibold">{pendingTeachers.length}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved</p>
              <p className="mt-1 text-2xl font-semibold">{approvedTeachers.length}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Rejected</p>
              <p className="mt-1 text-2xl font-semibold">{rejectedTeachers.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Approval Requests</CardTitle>
              <CardDescription>Review teacher access before unlocking the teacher workspace.</CardDescription>
            </div>
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name, email, or phone..."
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TeacherApprovalStatus)} className="space-y-4">
              <TabsList>
                <TabsTrigger value="pending">Pending ({pendingTeachers.length})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({approvedTeachers.length})</TabsTrigger>
                <TabsTrigger value="rejected">Rejected ({rejectedTeachers.length})</TabsTrigger>
              </TabsList>

              {(['pending', 'approved', 'rejected'] as TeacherApprovalStatus[]).map((status) => {
                const rowsForStatus = status === 'approved'
                  ? approvedTeachers
                  : status === 'rejected'
                    ? rejectedTeachers
                    : pendingTeachers;

                return (
                <TabsContent key={status} value={status}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rowsForStatus.length > 0 ? (
                        rowsForStatus.map((teacher) => {
                          const isProcessing = processingTeacherId === teacher.id;
                          return (
                            <TableRow key={teacher.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{`${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Unnamed Teacher'}</p>
                                  <p className="text-xs text-muted-foreground">{teacher.id}</p>
                                </div>
                              </TableCell>
                              <TableCell className="break-all">{teacher.email || 'N/A'}</TableCell>
                              <TableCell>{teacher.phoneNumber || 'N/A'}</TableCell>
                              <TableCell>
                                <TeacherStatusBadge status={teacher.normalizedTeacherStatus} />
                              </TableCell>
                              <TableCell>
                                <Badge variant={teacher.status === 'blocked' ? 'destructive' : 'outline'}>
                                  {teacher.status === 'blocked' ? 'Blocked' : 'Active'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Button asChild size="sm" variant="outline">
                                    <Link href={`/admin/students/teachers/${teacher.id}`}>Manage</Link>
                                  </Button>
                                  {teacher.normalizedTeacherStatus !== 'approved' ? (
                                    <Button
                                      size="sm"
                                      onClick={() => updateTeacherApproval(teacher, 'approved')}
                                      disabled={isProcessing}
                                    >
                                      {isProcessing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                      Approve
                                    </Button>
                                  ) : null}
                                  {teacher.normalizedTeacherStatus !== 'pending' ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => updateTeacherApproval(teacher, 'pending')}
                                      disabled={isProcessing}
                                    >
                                      Move To Pending
                                    </Button>
                                  ) : null}
                                  {teacher.normalizedTeacherStatus !== 'rejected' ? (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => updateTeacherApproval(teacher, 'rejected')}
                                      disabled={isProcessing}
                                    >
                                      {isProcessing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                                      Reject
                                    </Button>
                                  ) : null}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            No teachers found in this queue.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
