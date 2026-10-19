'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/firebase';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useToast } from '@/hooks/use-toast';
import {
  enquiryTypeContent,
  formatEnquiryDate,
  formatEnquiryFileSize,
  getEnquirySourceLabel,
  getPlanToStartLabel,
  getPreferredClassTypeLabel,
  type EnquiryRecord,
  type EnquiryType,
} from '@/lib/enquiries';
import {
  CheckCircle2,
  Eye,
  GraduationCap,
  LoaderCircle,
  Mail,
  Paperclip,
  Phone,
  RefreshCw,
  School,
} from 'lucide-react';

function getOrderedEnquiries(items: EnquiryRecord[]) {
  return [...items].sort((left, right) => {
    return (right.createdAtMs || 0) - (left.createdAtMs || 0);
  });
}

type EnquiriesApiResponse = {
  enquiries?: EnquiryRecord[];
  error?: string;
};

function getListDetails(enquiry: EnquiryRecord) {
  return {
    examName: enquiry.studentCoachingEnquiry?.examName || '-',
    className: enquiry.studentCoachingEnquiry?.className || '-',
  };
}

function EnquiryDetailsDialog({
  enquiry,
  onClose,
}: {
  enquiry: EnquiryRecord | null;
  onClose: () => void;
}) {
  const coaching = enquiry?.studentCoachingEnquiry;

  return (
    <Dialog open={!!enquiry} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        {enquiry ? (
          <>
            <DialogHeader>
              <DialogTitle>{enquiry.name}</DialogTitle>
              <DialogDescription>
                {getEnquirySourceLabel(enquiry.source)} enquiry received {formatEnquiryDate(enquiry.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Email</p>
                <a className="mt-1 inline-flex items-center gap-2 break-all font-medium" href={`mailto:${enquiry.email}`}>
                  <Mail className="h-4 w-4 text-primary" />
                  {enquiry.email}
                </a>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Phone</p>
                <a className="mt-1 inline-flex items-center gap-2 font-medium" href={`tel:${enquiry.phoneNumber}`}>
                  <Phone className="h-4 w-4 text-primary" />
                  {enquiry.phoneNumber}
                </a>
              </div>
            </div>

            <div className="rounded-[22px] border border-border/70 bg-background/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Student selections
              </p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Exam: </span>
                  <span className="font-medium">{coaching?.examName || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Curriculum: </span>
                  <span className="font-medium">{coaching?.className || '-'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Subjects: </span>
                  <span className="font-medium">{coaching?.subjectNames?.join(', ') || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Preferred class type: </span>
                  <span className="font-medium">
                    {getPreferredClassTypeLabel(coaching?.preferredClassType) || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Plan to start: </span>
                  <span className="font-medium">
                    {getPlanToStartLabel(coaching?.planToStart) || '-'}
                    {coaching?.preferredStartDate ? ` | ${coaching.preferredStartDate}` : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Message</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                {enquiry.message || 'No message added.'}
              </p>
            </div>

            <div className="rounded-[22px] border border-border/70 bg-background/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Files</p>
              {enquiry.attachments?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {enquiry.attachments.map((attachment) => (
                    <a
                      key={`${enquiry.id}-${attachment.storagePath}`}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-2 text-xs font-medium transition hover:border-primary/35 hover:text-primary"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      <span className="max-w-[13rem] truncate">{attachment.name}</span>
                      <span className="text-muted-foreground">{formatEnquiryFileSize(attachment.sizeBytes)}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No files attached.</p>
              )}
            </div>

            {enquiry.status === 'resolved' ? (
              <p className="text-xs text-muted-foreground">
                Resolved {formatEnquiryDate(enquiry.resolvedAt)}
                {enquiry.resolvedByEmail ? ` by ${enquiry.resolvedByEmail}` : ''}
              </p>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EnquirySection({
  enquiryType,
  enquiries,
  resolvingId,
  onResolve,
  onView,
  showResolve = true,
  emptyMessage = 'No open enquiries.',
}: {
  enquiryType: EnquiryType;
  enquiries: EnquiryRecord[];
  resolvingId: string;
  onResolve: (enquiry: EnquiryRecord) => Promise<void>;
  onView: (enquiry: EnquiryRecord) => void;
  showResolve?: boolean;
  emptyMessage?: string;
}) {
  const content = enquiryTypeContent[enquiryType];
  const Icon = enquiryType === 'student' ? GraduationCap : School;
  const totalCount = enquiries.length;

  return (
    <Card className="border-border/70 bg-gradient-to-b from-background to-muted/20">
      <CardHeader className="border-b border-border/60 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl">{content.label}</CardTitle>
              <CardDescription>Name, exam, and curriculum only. Open details with View.</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
            {totalCount} {totalCount === 1 ? 'enquiry' : 'enquiries'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {enquiries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          getOrderedEnquiries(enquiries).map((enquiry) => {
            const isResolving = resolvingId === enquiry.id;
            const listDetails = getListDetails(enquiry);

            return (
              <div
                key={enquiry.id}
                className="grid gap-3 rounded-[22px] border border-border/70 bg-background/70 p-4 shadow-sm md:grid-cols-[1.1fr_1fr_1fr_auto] md:items-center"
              >
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Name</p>
                  <p className="mt-1 font-semibold">{enquiry.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Exam</p>
                  <p className="mt-1 font-medium">{listDetails.examName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Curriculum</p>
                  <p className="mt-1 font-medium">{listDetails.className}</p>
                </div>
                <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onView(enquiry)}
                    className="rounded-full"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  {showResolve && enquiry.status === 'open' ? (
                    <Button
                      size="sm"
                      onClick={() => void onResolve(enquiry)}
                      disabled={isResolving}
                      className="rounded-full"
                    >
                      {isResolving ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Resolve
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminEnquiriesPage() {
  const { user } = useUser();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { toast } = useToast();
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]);
  const [isEnquiriesLoading, setIsEnquiriesLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [resolvingId, setResolvingId] = useState('');
  const [selectedEnquiry, setSelectedEnquiry] = useState<EnquiryRecord | null>(null);
  const [showResolvedEnquiries, setShowResolvedEnquiries] = useState(false);

  const loadEnquiries = useCallback(async () => {
    if (!user || !isAdmin) {
      setEnquiries([]);
      setPageError('');
      return;
    }

    setIsEnquiriesLoading(true);
    setPageError('');

    try {
      const idToken = await user.getIdToken(true);
      const response = await fetch('/api/enquiries', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as EnquiriesApiResponse | null;

      if (!response.ok || !data) {
        throw new Error(data?.error || 'Could not load enquiries right now.');
      }

      setEnquiries(data.enquiries || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load enquiries right now.';
      setPageError(message);
      setEnquiries([]);
    } finally {
      setIsEnquiriesLoading(false);
    }
  }, [isAdmin, user]);

  useEffect(() => {
    if (!isAdmin) {
      setEnquiries([]);
      setPageError('');
      setIsEnquiriesLoading(false);
      return;
    }

    void loadEnquiries();
  }, [isAdmin, loadEnquiries]);

  const studentEnquiries = useMemo(
    () => enquiries.filter((item) => item.enquiryType === 'student'),
    [enquiries]
  );
  const teacherEnquiries = useMemo(
    () => enquiries.filter((item) => item.enquiryType === 'teacher'),
    [enquiries]
  );
  const openStudentEnquiries = useMemo(
    () => studentEnquiries.filter((item) => item.status === 'open'),
    [studentEnquiries]
  );
  const openTeacherEnquiries = useMemo(
    () => teacherEnquiries.filter((item) => item.status === 'open'),
    [teacherEnquiries]
  );
  const resolvedStudentEnquiries = useMemo(
    () => studentEnquiries.filter((item) => item.status === 'resolved'),
    [studentEnquiries]
  );
  const resolvedTeacherEnquiries = useMemo(
    () => teacherEnquiries.filter((item) => item.status === 'resolved'),
    [teacherEnquiries]
  );

  const totalOpenCount = useMemo(
    () => enquiries.filter((item) => item.status === 'open').length,
    [enquiries]
  );
  const totalResolvedCount = useMemo(
    () => enquiries.filter((item) => item.status === 'resolved').length,
    [enquiries]
  );

  async function handleResolve(enquiry: EnquiryRecord) {
    if (!user?.uid) return;

    setResolvingId(enquiry.id);
    try {
      const idToken = await user.getIdToken(true);
      const response = await fetch('/api/enquiries', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          enquiryId: enquiry.id,
          status: 'resolved',
        }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error || 'Could not update this enquiry.');
      }

      const now = new Date();
      setEnquiries((current) =>
        current.map((item) =>
          item.id === enquiry.id
            ? {
                ...item,
                status: 'resolved',
                resolvedAt: now.toISOString(),
                resolvedAtMs: now.getTime(),
                resolvedBy: user.uid,
                resolvedByEmail: user.email || '',
              }
            : item
        )
      );

      toast({
        title: 'Enquiry resolved',
        description: `${enquiry.name}'s enquiry is now marked as resolved.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Resolve failed',
        description: error?.message || 'Could not update this enquiry.',
      });
    } finally {
      setResolvingId('');
    }
  }

  const loading = isAdminLoading || (isAdmin && isEnquiriesLoading && enquiries.length === 0);

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Enquiries" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-6 xl:grid-cols-2">
            <Skeleton className="h-[32rem] w-full" />
            <Skeleton className="h-[32rem] w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Enquiries" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">Only admins can review enquiries.</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Enquiries" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
        <Card className="border-border/70 bg-gradient-to-r from-primary/10 via-background to-background">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Enquiry Center</CardTitle>
                <CardDescription>Open enquiries are listed below. Resolved enquiries stay hidden until opened.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadEnquiries()}
                disabled={isEnquiriesLoading}
                className="rounded-full"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isEnquiriesLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Open</p>
              <p className="mt-1 text-2xl font-semibold">{totalOpenCount}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Resolved</p>
              <p className="mt-1 text-2xl font-semibold">{totalResolvedCount}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Open student</p>
              <p className="mt-1 text-2xl font-semibold">{openStudentEnquiries.length}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Open teacher</p>
              <p className="mt-1 text-2xl font-semibold">{openTeacherEnquiries.length}</p>
            </div>
          </CardContent>
        </Card>

        {pageError ? (
          <Card className="border-rose-300/20 bg-rose-500/10">
            <CardContent className="p-4 text-sm text-rose-100">
              {pageError}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <EnquirySection
            enquiryType="student"
            enquiries={openStudentEnquiries}
            resolvingId={resolvingId}
            onResolve={handleResolve}
            onView={setSelectedEnquiry}
          />
          <EnquirySection
            enquiryType="teacher"
            enquiries={openTeacherEnquiries}
            resolvingId={resolvingId}
            onResolve={handleResolve}
            onView={setSelectedEnquiry}
          />
        </div>

        <Card className="border-border/70">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <CardTitle className="text-base">Resolved enquiries</CardTitle>
              <CardDescription>{totalResolvedCount} resolved enquiries are hidden from the main list.</CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowResolvedEnquiries((current) => !current)}
              className="rounded-full"
            >
              {showResolvedEnquiries ? 'Hide resolved enquiries' : 'View resolved enquiries'}
            </Button>
          </CardContent>
        </Card>

        {showResolvedEnquiries ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <EnquirySection
              enquiryType="student"
              enquiries={resolvedStudentEnquiries}
              resolvingId={resolvingId}
              onResolve={handleResolve}
              onView={setSelectedEnquiry}
              showResolve={false}
              emptyMessage="No resolved student enquiries."
            />
            <EnquirySection
              enquiryType="teacher"
              enquiries={resolvedTeacherEnquiries}
              resolvingId={resolvingId}
              onResolve={handleResolve}
              onView={setSelectedEnquiry}
              showResolve={false}
              emptyMessage="No resolved teacher enquiries."
            />
          </div>
        ) : null}
      </main>
      <EnquiryDetailsDialog enquiry={selectedEnquiry} onClose={() => setSelectedEnquiry(null)} />
    </div>
  );
}
