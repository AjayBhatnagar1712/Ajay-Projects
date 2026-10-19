'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import DashboardHeader from "@/components/dashboard-header";
import { useIsTeacher } from "@/hooks/useIsTeacher";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import StudentDashboard from "@/components/student-dashboard";
import TeacherDashboard from "@/components/teacher-dashboard";
import AdminDashboard from "@/components/admin-dashboard";
import TeacherApprovalPendingDashboard from "@/components/teacher-approval-pending-dashboard";
import { useToast } from "@/hooks/use-toast";
import { clearPostLoginToast, peekPostLoginToast } from "@/lib/post-login-toast";
import { ClipboardList } from "lucide-react";

function RoleBasedDashboard() {
  const { isTeacher, isQuestionUploader, isPendingTeacher, isRejectedTeacher, teacherStatus, isLoading: isTeacherLoading } = useIsTeacher();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const isLoading = isTeacherLoading || isAdminLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (isAdmin) return <AdminDashboard />;
  if (isPendingTeacher || isRejectedTeacher) {
    return <TeacherApprovalPendingDashboard teacherStatus={teacherStatus} />;
  }
  if (isQuestionUploader) {
    return (
      <Card className="max-w-xl border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Question Upload Workspace
          </CardTitle>
          <CardDescription>
            Add, review, and manage your uploaded DCAM question-bank entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/practice">Open Question Bank</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return isTeacher ? <TeacherDashboard /> : <StudentDashboard />;
}


export default function DashboardPage() {
  const { toast } = useToast();

  useEffect(() => {
    const queuedToast = peekPostLoginToast();
    if (!queuedToast) return;

    const timeoutId = window.setTimeout(() => {
      toast({
        title: queuedToast.title,
        description: queuedToast.description,
        duration: queuedToast.durationMs,
      });
      clearPostLoginToast();
    }, queuedToast.delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="grid gap-8">
          <RoleBasedDashboard />
        </div>
      </main>
    </div>
  );
}
