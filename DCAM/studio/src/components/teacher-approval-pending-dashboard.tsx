'use client';

import Link from 'next/link';
import { Clock3, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TeacherApprovalStatus } from '@/lib/teacher-approval';

export default function TeacherApprovalPendingDashboard({
  teacherStatus,
}: {
  teacherStatus: TeacherApprovalStatus | null;
}) {
  const isRejected = teacherStatus === 'rejected';
  const title = isRejected ? 'Teacher Access Rejected' : 'Teacher Approval Pending';
  const description = isRejected
    ? 'Your teacher account is still locked. Please contact the admin team if this should be reviewed again.'
    : 'Your teacher account has been created, but the admin team must approve it before you can use the teacher dashboard.';

  return (
    <Card className="border-amber-300/30 bg-gradient-to-br from-amber-500/10 via-background to-background">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
            {isRejected ? <ShieldAlert className="h-6 w-6" /> : <Clock3 className="h-6 w-6" />}
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant={isRejected ? 'destructive' : 'secondary'}>
            {isRejected ? 'Rejected' : 'Pending Approval'}
          </Badge>
          <Badge variant="outline">Teacher tools locked</Badge>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
          You can review your profile while the request is under review. Course creation, mock tests, live batches,
          subscription setup, wallet actions, and other teacher tools will unlock after approval.
        </div>
        <Button asChild variant="outline">
          <Link href="/profile">Open Profile</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
