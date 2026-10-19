'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, BookOpen, ClipboardCheck, ClipboardList, Coins, Inbox, IndianRupee, ShieldCheck, UserCheck, Users } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-border/70 bg-gradient-to-r from-primary/10 via-background to-background">
        <div className="absolute inset-y-0 right-0 w-48 bg-gradient-to-l from-primary/20 to-transparent" />
        <CardHeader className="relative flex flex-row items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl">Admin Control Center</CardTitle>
            <CardDescription>Oversee users, content, and platform governance at a glance.</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="group border-border/70 bg-gradient-to-br from-background to-muted/40 transition hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> User Management
                  </CardTitle>
                  <CardDescription>Approve teachers and manage student access.</CardDescription>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/students">Open Workspace</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group border-border/70 bg-gradient-to-br from-background to-muted/40 transition hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" /> Teacher Approvals
                  </CardTitle>
                  <CardDescription>Review pending teacher requests and approve platform access.</CardDescription>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/teacher-approvals">Open Workspace</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group border-border/70 bg-gradient-to-br from-background to-muted/40 transition hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Inbox className="h-4 w-4 text-primary" /> Enquiries
                  </CardTitle>
                  <CardDescription>Review student and teacher website enquiries and mark them resolved.</CardDescription>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/enquiries">Open Workspace</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group border-border/70 bg-gradient-to-br from-background to-muted/40 transition hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-primary" /> DCAM Staff Performance
                  </CardTitle>
                  <CardDescription>Audit Question Upload staff, review their entries, and correct the shared DCAM Question Bank.</CardDescription>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/staff-performance">Open Workspace</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group border-border/70 bg-gradient-to-br from-background to-muted/40 transition hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" /> Curriculum
                  </CardTitle>
                  <CardDescription>Manage subjects, topics, and structure.</CardDescription>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/curriculum">Open Workspace</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group border-border/70 bg-gradient-to-br from-background to-muted/40 transition hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" /> Content Library
                  </CardTitle>
                  <CardDescription>Review and update study materials.</CardDescription>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/content">Open Workspace</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group border-border/70 bg-gradient-to-br from-background to-muted/40 transition hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-primary" /> DCAM Question Pricing
                  </CardTitle>
                  <CardDescription>Set subject-wise paid question and PYQ pricing for admin-owned DCAM content.</CardDescription>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/question-pricing">Open Workspace</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group border-border/70 bg-gradient-to-br from-background to-muted/40 transition hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" /> Teacher Question Management
                  </CardTitle>
                  <CardDescription>Assign paid DCAM question stock to teacher purchase ledgers without changing the bank-owner account.</CardDescription>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/teacher-question-management">Open Workspace</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-gradient-to-b from-muted/40 to-background">
          <CardHeader>
            <CardTitle className="text-base">Admin Priorities</CardTitle>
            <CardDescription>Quick reminders for daily review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border/60 bg-background/60 p-4">
              Review teacher teaching profiles and curriculum assignments.
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-4">
              Audit new content uploads for accuracy and quality.
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-4">
              Use User Management to block or unblock accounts directly.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
