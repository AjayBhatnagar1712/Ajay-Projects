'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { collection, doc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import DashboardHeader from '@/components/dashboard-header';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser, updateDocumentNonBlocking, useStorage } from '@/firebase';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ImageIcon, Layers3, PencilLine } from 'lucide-react';
import { notifyTeacherPublication } from '@/lib/client-notifications';
import { isValidHttpUrl } from '@/lib/http-url';
import { buildSubjectSessionCountMap, isValidSubjectSessionCount, normalizeSubjectSessionCount } from '@/lib/live-batch-subject-sessions';
import { getLiveBatchScheduleTimingForDate, parseYmdHmToLocalDateTime } from '@/lib/live-batch-session-access';

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string; examTypeId: string };
type Subject = { id: string; name: string; classId: string };
type TeachingAssignment = {
  examTypeId: string;
  classId: string;
  allSubjects?: boolean;
  subjectIds?: string[];
};
type UserProfile = { teachingAssignments?: TeachingAssignment[] };
type SubjectSchedule = {
  subjectId: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  useDifferentTimingPerDay?: boolean;
  dayTimings?: Record<string, { startTime: string; endTime: string }>;
  sessionCount: number;
  defaultZoomLink?: string;
};
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const createEmptySubjectSchedule = (subjectId: string): SubjectSchedule => ({
  subjectId,
  daysOfWeek: [],
  startTime: '',
  endTime: '',
  useDifferentTimingPerDay: false,
  dayTimings: {},
  sessionCount: 1,
  defaultZoomLink: '',
});
const getInvalidScheduleSubjectId = (
  selectedSubjectIds: string[],
  subjectSchedules: Record<string, SubjectSchedule>
) => selectedSubjectIds.find((subjectId) => {
  const schedule = subjectSchedules[subjectId];
  if (!schedule) return true;
  if (schedule.daysOfWeek.length === 0) return true;
  if (schedule.useDifferentTimingPerDay) {
    return schedule.daysOfWeek.some((day) => {
      const dayTime = schedule.dayTimings?.[day];
      if (!dayTime?.startTime || !dayTime?.endTime) return true;
      return dayTime.startTime >= dayTime.endTime;
    });
  }
  if (!schedule.startTime || !schedule.endTime) return true;
  return schedule.startTime >= schedule.endTime;
});
type LiveBatch = {
  id: string;
  title: string;
  description?: string;
  outcomes?: string;
  explanationVideoUrl?: string;
  examTypeId: string;
  classId: string;
  batchStartDate?: string;
  subjectIds: string[];
  accessLevel: 'free' | 'paid';
  publicationStatus?: 'draft' | 'published';
  subscriptionAttached?: boolean;
  teacherId: string;
  teacherName: string;
  teacherPhotoUrl?: string;
  thumbnailUrl?: string;
  subjectSchedules?: SubjectSchedule[];
  totalSessions?: number;
  scheduleVersion?: number;
};

const formSchema = z
  .object({
    title: z.string().min(3, 'Title must be at least 3 characters long.'),
    description: z.string().optional(),
    outcomes: z.string().optional(),
    explanationVideoUrl: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(value), {
        message: 'Please enter a valid YouTube URL.',
      }),
    examTypeId: z.string().min(1, 'Please select an exam.'),
    classId: z.string().min(1, 'Please select a curriculum/class.'),
    batchStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please choose batch start date.'),
    accessLevel: z.enum(['free', 'paid']),
  });

export default function EditLiveBatchPage() {
  const { user } = useUser();
  const router = useRouter();
  const params = useParams<{ batchId: string }>();
  const batchId = Array.isArray(params?.batchId) ? params.batchId[0] : params?.batchId;
  const firestore = useFirestore();
  const storage = useStorage();
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const { toast } = useToast();
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [subjectSchedules, setSubjectSchedules] = useState<Record<string, SubjectSchedule>>({});
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user?.uid]);
  const batchDocRef = useMemoFirebase(() => (firestore && batchId ? doc(firestore, 'live_batches', batchId) : null), [firestore, batchId]);
  const examTypesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null), [firestore]);
  const classesQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null), [firestore]);
  const subjectsQ = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null), [firestore]);

  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userDocRef);
  const { data: batch, isLoading: batchLoading } = useDoc<LiveBatch>(batchDocRef);
  const { data: examTypes, isLoading: examLoading } = useCollection<ExamType>(examTypesQ);
  const { data: classes, isLoading: classLoading } = useCollection<ClassItem>(classesQ);
  const { data: subjects, isLoading: subjectLoading } = useCollection<Subject>(subjectsQ);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      outcomes: '',
      explanationVideoUrl: '',
      examTypeId: '',
      classId: '',
      batchStartDate: '',
      accessLevel: 'free',
    },
  });

  useEffect(() => {
    if (!batch) return;
    form.reset({
      title: batch.title || '',
      description: batch.description || '',
      outcomes: batch.outcomes || '',
      explanationVideoUrl: batch.explanationVideoUrl || '',
      examTypeId: batch.examTypeId || '',
      classId: batch.classId || '',
      batchStartDate: batch.batchStartDate || '',
      accessLevel: batch.accessLevel || 'free',
    });
    const existingSubjectIds = Array.from(
      new Set([...(batch.subjectIds || []), ...((batch.subjectSchedules || []).map((s) => s.subjectId).filter(Boolean))])
    );
    setSelectedSubjectIds(existingSubjectIds);
    const resolvedSessionCounts = buildSubjectSessionCountMap({
      subjectIds: existingSubjectIds,
      subjectSchedules: batch.subjectSchedules || [],
      fallbackTotalSessions: batch.totalSessions,
    });
    const existingSchedulesBySubjectId = Object.fromEntries((batch.subjectSchedules || []).map((schedule) => [schedule.subjectId, schedule]));
    const scheduleMap = Object.fromEntries(
      existingSubjectIds.map((subjectId) => {
        const existingSchedule = existingSchedulesBySubjectId[subjectId];
        const baseSchedule = existingSchedule ? { ...existingSchedule } : createEmptySubjectSchedule(subjectId);
        return [
          subjectId,
          {
            ...createEmptySubjectSchedule(subjectId),
            ...baseSchedule,
            subjectId,
            sessionCount: normalizeSubjectSessionCount(resolvedSessionCounts[subjectId]),
          },
        ];
      })
    );
    setSubjectSchedules(scheduleMap);
  }, [batch, form]);

  const assignments = userProfile?.teachingAssignments || [];
  const selectedExam = form.watch('examTypeId');
  const selectedClass = form.watch('classId');
  const isStructureLocked = Boolean(batch?.examTypeId && batch?.classId);
  const selectedExamName = useMemo(
    () => examTypes?.find((exam) => exam.id === selectedExam)?.name || '',
    [examTypes, selectedExam]
  );
  const selectedClassName = useMemo(
    () => classes?.find((classItem) => classItem.id === selectedClass)?.name || '',
    [classes, selectedClass]
  );

  const allowedExamTypeIds = useMemo(() => Array.from(new Set(assignments.map((a) => a.examTypeId).filter(Boolean))), [assignments]);
  const allowedExams = useMemo(() => {
    if (!examTypes) return [];
    if (allowedExamTypeIds.length === 0) return examTypes;
    return examTypes.filter((e) => allowedExamTypeIds.includes(e.id));
  }, [examTypes, allowedExamTypeIds]);
  const allowedClassIdsForExam = useMemo(() => {
    if (!selectedExam) return [];
    return Array.from(new Set(assignments.filter((a) => a.examTypeId === selectedExam).map((a) => a.classId).filter(Boolean)));
  }, [assignments, selectedExam]);
  const allowedClasses = useMemo(() => {
    if (!classes || !selectedExam) return [];
    const examScoped = classes.filter((c) => c.examTypeId === selectedExam);
    if (allowedClassIdsForExam.length === 0) return examScoped;
    return examScoped.filter((c) => allowedClassIdsForExam.includes(c.id));
  }, [classes, selectedExam, allowedClassIdsForExam]);
  const allowedSubjects = useMemo(() => {
    if (!subjects || !selectedClass) return [];
    const classSubjects = subjects.filter((s) => s.classId === selectedClass);
    const classAssignments = assignments.filter((a) => a.examTypeId === selectedExam && a.classId === selectedClass);
    if (classAssignments.length === 0) return classSubjects;
    if (classAssignments.some((a) => a.allSubjects)) return classSubjects;
    const allowedSubjectIds = Array.from(new Set(classAssignments.flatMap((a) => a.subjectIds || []).filter(Boolean)));
    if (allowedSubjectIds.length === 0) return classSubjects;
    return classSubjects.filter((s) => allowedSubjectIds.includes(s.id));
  }, [subjects, assignments, selectedClass, selectedExam]);

  const loading = isTeacherLoading || profileLoading || batchLoading || examLoading || classLoading || subjectLoading;
  const invalidSubjectId = useMemo(
    () => getInvalidScheduleSubjectId(selectedSubjectIds, subjectSchedules),
    [selectedSubjectIds, subjectSchedules]
  );
  const invalidSubjectName = invalidSubjectId ? (allowedSubjects.find((s) => s.id === invalidSubjectId)?.name || 'Selected subject') : '';
  const invalidSessionCountSubjectId = useMemo(
    () => selectedSubjectIds.find((subjectId) => !isValidSubjectSessionCount(subjectSchedules[subjectId]?.sessionCount)),
    [selectedSubjectIds, subjectSchedules]
  );
  const invalidSessionCountSubjectName = invalidSessionCountSubjectId
    ? (allowedSubjects.find((s) => s.id === invalidSessionCountSubjectId)?.name || 'Selected subject')
    : '';
  const invalidSubjectClassLinkId = useMemo(
    () => selectedSubjectIds.find((subjectId) => {
      const candidate = subjectSchedules[subjectId]?.defaultZoomLink?.trim();
      return !!candidate && !isValidHttpUrl(candidate);
    }),
    [selectedSubjectIds, subjectSchedules]
  );
  const invalidSubjectClassLinkName = invalidSubjectClassLinkId
    ? (allowedSubjects.find((s) => s.id === invalidSubjectClassLinkId)?.name || 'Selected subject')
    : '';
  const totalPlannedSessions = useMemo(
    () => selectedSubjectIds.reduce((sum, subjectId) => sum + normalizeSubjectSessionCount(subjectSchedules[subjectId]?.sessionCount), 0),
    [selectedSubjectIds, subjectSchedules]
  );
  const isSubmitDisabled =
    isSubmitting
    || selectedSubjectIds.length === 0
    || !!invalidSubjectId
    || !!invalidSessionCountSubjectId
    || !!invalidSubjectClassLinkId
    || totalPlannedSessions <= 0;

  const toggleSubject = (subjectId: string, checked: boolean) => {
    setSelectedSubjectIds((current) => {
      const next = checked ? (current.includes(subjectId) ? current : [...current, subjectId]) : current.filter((id) => id !== subjectId);
      if (checked) {
        setSubjectSchedules((prev) => ({
          ...prev,
          [subjectId]: prev[subjectId] || createEmptySubjectSchedule(subjectId),
        }));
      } else {
        setSubjectSchedules((prev) => {
          const updated = { ...prev };
          delete updated[subjectId];
          return updated;
        });
      }
      return next;
    });
  };

  const toggleScheduleDay = (subjectId: string, day: string, checked: boolean) => {
    setSubjectSchedules((prev) => {
      const current = prev[subjectId] || createEmptySubjectSchedule(subjectId);
      const nextDays = checked ? Array.from(new Set([...current.daysOfWeek, day])) : current.daysOfWeek.filter((d) => d !== day);
      const nextDayTimings = { ...(current.dayTimings || {}) };
      if (!checked) {
        delete nextDayTimings[day];
      } else if (!nextDayTimings[day]) {
        nextDayTimings[day] = { startTime: current.startTime || '', endTime: current.endTime || '' };
      }
      return { ...prev, [subjectId]: { ...current, daysOfWeek: nextDays, dayTimings: nextDayTimings } };
    });
  };

  const updateScheduleTime = (subjectId: string, field: 'startTime' | 'endTime', value: string) => {
    setSubjectSchedules((prev) => {
      const current = prev[subjectId] || createEmptySubjectSchedule(subjectId);
      return { ...prev, [subjectId]: { ...current, [field]: value } };
    });
  };

  const toggleDifferentTimingPerDay = (subjectId: string, checked: boolean) => {
    setSubjectSchedules((prev) => {
      const current = prev[subjectId] || createEmptySubjectSchedule(subjectId);
      const nextDayTimings = { ...(current.dayTimings || {}) };
      if (checked) {
        current.daysOfWeek.forEach((day) => {
          if (!nextDayTimings[day]) {
            nextDayTimings[day] = { startTime: current.startTime || '', endTime: current.endTime || '' };
          }
        });
      }
      return { ...prev, [subjectId]: { ...current, useDifferentTimingPerDay: checked, dayTimings: nextDayTimings } };
    });
  };

  const updateDayTiming = (subjectId: string, day: string, field: 'startTime' | 'endTime', value: string) => {
    setSubjectSchedules((prev) => {
      const current = prev[subjectId] || createEmptySubjectSchedule(subjectId);
      const dayTimings = { ...(current.dayTimings || {}) };
      dayTimings[day] = { startTime: dayTimings[day]?.startTime || '', endTime: dayTimings[day]?.endTime || '', [field]: value };
      return { ...prev, [subjectId]: { ...current, dayTimings } };
    });
  };

  const updateSubjectSessionCount = (subjectId: string, value: string) => {
    setSubjectSchedules((prev) => {
      const current = prev[subjectId] || createEmptySubjectSchedule(subjectId);
      return {
        ...prev,
        [subjectId]: {
          ...current,
          sessionCount: normalizeSubjectSessionCount(value),
        },
      };
    });
  };

  const updateSubjectClassLink = (subjectId: string, value: string) => {
    setSubjectSchedules((prev) => {
      const current = prev[subjectId] || createEmptySubjectSchedule(subjectId);
      return {
        ...prev,
        [subjectId]: {
          ...current,
          defaultZoomLink: value,
        },
      };
    });
  };

  const handleThumbnailChange = (file?: File) => {
    if (!file) {
      setThumbnailFile(null);
      return;
    }
    const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
    if (!isJpeg) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Only JPEG/JPG thumbnail files are allowed.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Please upload a thumbnail smaller than 5MB.' });
      return;
    }
    setThumbnailFile(file);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !batchId || !batch) return;
    if (selectedSubjectIds.length === 0) {
      toast({ variant: 'destructive', title: 'Subjects required', description: 'Select at least one subject for the batch.' });
      return;
    }
    const scheduleErrorSubjectId = getInvalidScheduleSubjectId(selectedSubjectIds, subjectSchedules);
    if (scheduleErrorSubjectId) {
      const subjectName = allowedSubjects.find((s) => s.id === scheduleErrorSubjectId)?.name || 'Selected subject';
      toast({
        variant: 'destructive',
        title: 'Invalid schedule',
        description: `Please set valid days and time range for ${subjectName}.`,
      });
      return;
    }
    if (invalidSessionCountSubjectId) {
      toast({
        variant: 'destructive',
        title: 'Invalid subject session count',
        description: `Please enter a valid planned session count for ${invalidSessionCountSubjectName}.`,
      });
      return;
    }
    if (invalidSubjectClassLinkId) {
      toast({
        variant: 'destructive',
        title: 'Invalid class link',
        description: `Please enter a valid class link for ${invalidSubjectClassLinkName}.`,
      });
      return;
    }
    if (totalPlannedSessions <= 0) {
      toast({
        variant: 'destructive',
        title: 'Subject sessions required',
        description: 'Add at least one planned live meeting across the selected subjects.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let thumbnailUrl = batch.thumbnailUrl || '';
      if (thumbnailFile) {
        const safeName = thumbnailFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uploadRef = ref(storage, `live_batch_thumbnails/${user.uid}/${Date.now()}_${safeName}`);
        const uploaded = await uploadBytes(uploadRef, thumbnailFile, { contentType: thumbnailFile.type });
        thumbnailUrl = await getDownloadURL(uploaded.ref);
      }
      const isPaid = values.accessLevel === 'paid';
      const wasPaid = batch.accessLevel === 'paid';
      const subscriptionAttached = isPaid
        ? (wasPaid ? batch.subscriptionAttached === true : false)
        : true;
      const publicationStatus = isPaid && !subscriptionAttached ? 'draft' : 'published';
      const schedulesToSave = selectedSubjectIds.map((subjectId) => {
        const current = subjectSchedules[subjectId] || createEmptySubjectSchedule(subjectId);
        return {
          ...current,
          subjectId,
          sessionCount: normalizeSubjectSessionCount(current.sessionCount),
          defaultZoomLink: (current.defaultZoomLink || '').trim(),
        };
      });
      const totalSessions = schedulesToSave.reduce((sum, schedule) => sum + normalizeSubjectSessionCount(schedule.sessionCount), 0);
      const nextScheduleVersion = Math.max(0, Number(batch.scheduleVersion || 0)) + 1;

      await updateDocumentNonBlocking(doc(firestore, 'live_batches', batchId), {
        ...values,
        totalSessions,
        subjectIds: selectedSubjectIds,
        subjectSchedules: schedulesToSave,
        scheduleVersion: nextScheduleVersion,
        subscriptionAttached,
        publicationStatus,
        teacherName: user.displayName || 'Teacher',
        teacherPhotoUrl: user.photoURL || '',
        thumbnailUrl,
        updatedAt: new Date().toISOString(),
      });

      const inheritedMeetingSnap = await getDocs(
        query(collection(firestore, 'live_batch_sessions'), where('batchId', '==', batchId))
      );
      const nowValue = new Date();
      const nextBatchScheduleState = {
        subjectIds: selectedSubjectIds,
        subjectSchedules: schedulesToSave,
        scheduleVersion: nextScheduleVersion,
      };

      await Promise.all(
        inheritedMeetingSnap.docs.map(async (meetingDoc) => {
          const meeting = meetingDoc.data() as {
            type?: string;
            date?: string;
            meetingTime?: string;
            meetingEndTime?: string;
            subjectId?: string;
            subjectName?: string;
            timingMode?: string;
          };
          if (meeting.type !== 'meeting') return;
          if (meeting.timingMode === 'manual_override') return;

          const meetingStartAt = parseYmdHmToLocalDateTime(meeting.date, meeting.meetingTime);
          if (!meetingStartAt || meetingStartAt.getTime() <= nowValue.getTime()) return;

          const batchTiming = getLiveBatchScheduleTimingForDate(nextBatchScheduleState, meeting);
          if (!batchTiming) return;

          const nextMeetingTime = batchTiming.startTime;
          const nextMeetingEndTime = batchTiming.endTime || batchTiming.startTime;
          await updateDocumentNonBlocking(doc(firestore, 'live_batch_sessions', meetingDoc.id), {
            subjectId: batchTiming.subjectId,
            meetingTime: nextMeetingTime,
            meetingEndTime: nextMeetingEndTime,
            timingMode: 'batch_default',
            scheduleVersion: nextScheduleVersion,
            updatedAt: new Date().toISOString(),
          });
        })
      );

      if (publicationStatus === 'published' && batch?.publicationStatus !== 'published') {
        await notifyTeacherPublication(user, {
          contentType: 'live_batch',
          contentId: batchId,
        });
      }
      toast({ title: 'Batch updated', description: 'Live batch has been updated successfully.' });
      router.push(isPaid && !subscriptionAttached ? '/live-batches?view=waiting-subscription' : '/live-batches?view=your');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: error?.message || 'Could not update live batch.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Edit Live Batch" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8"><Skeleton className="h-64 w-full" /></main>
      </div>
    );
  }

  if (!isTeacher) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Edit Live Batch" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card><CardContent className="p-6 text-muted-foreground">This page is available only for teacher accounts.</CardContent></Card>
        </main>
      </div>
    );
  }

  if (!batch || batch.teacherId !== user?.uid) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Edit Live Batch" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card><CardContent className="p-6 text-muted-foreground">Batch not found or you do not have access to edit it.</CardContent></Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Edit Live Batch" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
        <Card className="border-border/70 bg-card/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><Layers3 className="h-5 w-5" />Edit Live Batch</CardTitle>
            <CardDescription>Update this live batch details, subjects, and access settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Batch Title</FormLabel><FormControl><Input placeholder="Batch title" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description (optional)</FormLabel><FormControl><Textarea rows={3} placeholder="Batch description..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="outcomes" render={({ field }) => (
                  <FormItem><FormLabel>Outcomes (optional)</FormLabel><FormControl><Textarea rows={3} placeholder="What outcomes students should expect from this live batch..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="explanationVideoUrl" render={({ field }) => (
                  <FormItem><FormLabel>Explanation YouTube Video URL (optional)</FormLabel><FormControl><Input placeholder="https://www.youtube.com/watch?v=..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormItem>
                  <FormLabel>Thumbnail (JPEG only)</FormLabel>
                  <FormControl><Input type="file" accept=".jpg,.jpeg,image/jpeg" onChange={(e) => handleThumbnailChange(e.target.files?.[0])} /></FormControl>
                  <p className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" />Upload a new image only if you want to replace current thumbnail.</p>
                </FormItem>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {isStructureLocked ? (
                    <>
                      <FormItem>
                        <FormLabel>Exam</FormLabel>
                        <FormControl>
                          <Input readOnly value={selectedExamName || 'Exam not found'} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Locked after batch creation.</p>
                      </FormItem>
                      <FormItem>
                        <FormLabel>Curriculum/Class</FormLabel>
                        <FormControl>
                          <Input readOnly value={selectedClassName || 'Curriculum/Class not found'} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Locked after batch creation.</p>
                      </FormItem>
                    </>
                  ) : (
                    <>
                      <FormField control={form.control} name="examTypeId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exam</FormLabel>
                          <Select onValueChange={(value) => { field.onChange(value); form.setValue('classId', ''); setSelectedSubjectIds([]); setSubjectSchedules({}); }} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger></FormControl>
                            <SelectContent>{allowedExams.map((examType) => <SelectItem key={examType.id} value={examType.id}>{examType.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="classId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Curriculum/Class</FormLabel>
                          <Select onValueChange={(value) => { field.onChange(value); setSelectedSubjectIds([]); setSubjectSchedules({}); }} value={field.value} disabled={!selectedExam}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select curriculum/class" /></SelectTrigger></FormControl>
                            <SelectContent>{allowedClasses.map((classItem) => <SelectItem key={classItem.id} value={classItem.id}>{classItem.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </>
                  )}
                  <FormField control={form.control} name="batchStartDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch Teaching Starts On</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Subjects</p>
                    <p className="text-xs text-muted-foreground">{selectedSubjectIds.length} selected</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {allowedSubjects.map((subject) => (
                      <label key={subject.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={selectedSubjectIds.includes(subject.id)} onCheckedChange={(value) => toggleSubject(subject.id, !!value)} />
                        <span>{subject.name}</span>
                      </label>
                    ))}
                  </div>
                  {selectedClass && allowedSubjects.length === 0 ? (
                    <p className="text-xs text-amber-300">
                      No subjects are available for this exam and curriculum in your teaching assignments.
                    </p>
                  ) : null}
                  {selectedClass && allowedSubjects.length > 0 && selectedSubjectIds.length === 0 ? (
                    <p className="text-xs text-amber-300">
                      Select subject(s). Batch schedule is required after curriculum and subjects are selected.
                    </p>
                  ) : null}
                </div>

                {selectedSubjectIds.length > 0 ? (
                  <div className="space-y-3 rounded-md border p-3">
                    <p className="text-sm font-medium">Content Scheduling (Days and Time per Subject) *</p>
                    <p className="text-xs text-muted-foreground">
                      Set separate weekly days, timing, and planned meeting count for every selected subject. Any day combination is allowed.
                    </p>
                    {invalidSubjectId ? (
                      <p className="text-xs text-destructive">
                        Complete valid schedule for {invalidSubjectName}. End time must be greater than start time.
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-300">
                        All selected subjects have valid day/time scheduling.
                      </p>
                    )}
                    {invalidSessionCountSubjectId ? (
                      <p className="text-xs text-destructive">
                        Add a valid planned session count for {invalidSessionCountSubjectName}.
                      </p>
                    ) : null}
                    {invalidSubjectClassLinkId ? (
                      <p className="text-xs text-destructive">
                        Add a valid subject class link for {invalidSubjectClassLinkName}.
                      </p>
                    ) : null}
                    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Total planned live meetings</p>
                      <p className="text-lg font-semibold">{totalPlannedSessions}</p>
                    </div>
                    {selectedSubjectIds.map((subjectId) => {
                      const subject = allowedSubjects.find((s) => s.id === subjectId);
                      const schedule = subjectSchedules[subjectId] || createEmptySubjectSchedule(subjectId);
                      return (
                        <div key={`schedule-${subjectId}`} className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <p className="text-sm font-semibold">{subject?.name || 'Subject'}</p>
                            <div className="w-full md:max-w-[220px] space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">Planned live meetings</label>
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={normalizeSubjectSessionCount(schedule.sessionCount)}
                                onChange={(e) => updateSubjectSessionCount(subjectId, e.target.value)}
                              />
                            </div>
                          </div>
                          <label className="inline-flex items-center gap-2 text-xs rounded-md border border-border/60 px-2 py-1.5">
                            <Checkbox checked={!!schedule.useDifferentTimingPerDay} onCheckedChange={(value) => toggleDifferentTimingPerDay(subjectId, !!value)} />
                            <span>Use different timing for separate days</span>
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                            {DAYS_OF_WEEK.map((day) => (
                              <label key={`${subjectId}-${day}`} className="flex items-center gap-2 text-xs rounded-md border border-border/60 px-2 py-1.5">
                                <Checkbox checked={schedule.daysOfWeek.includes(day)} onCheckedChange={(value) => toggleScheduleDay(subjectId, day, !!value)} />
                                <span>{day.slice(0, 3)}</span>
                              </label>
                            ))}
                          </div>
                          {!schedule.useDifferentTimingPerDay ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <FormItem>
                                <FormLabel>Start Time (for all selected days)</FormLabel>
                                <FormControl><Input type="time" value={schedule.startTime} onChange={(e) => updateScheduleTime(subjectId, 'startTime', e.target.value)} /></FormControl>
                              </FormItem>
                              <FormItem>
                                <FormLabel>End Time (for all selected days)</FormLabel>
                                <FormControl><Input type="time" value={schedule.endTime} onChange={(e) => updateScheduleTime(subjectId, 'endTime', e.target.value)} /></FormControl>
                              </FormItem>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {schedule.daysOfWeek.map((day) => {
                                const dayTime = schedule.dayTimings?.[day] || { startTime: '', endTime: '' };
                                return (
                                  <div key={`${subjectId}-${day}-time`} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end rounded-md border border-border/60 p-2">
                                    <p className="text-sm md:col-span-1">{day}</p>
                                    <FormItem className="md:col-span-2">
                                      <FormLabel>Start Time</FormLabel>
                                      <FormControl><Input type="time" value={dayTime.startTime} onChange={(e) => updateDayTiming(subjectId, day, 'startTime', e.target.value)} /></FormControl>
                                    </FormItem>
                                    <FormItem className="md:col-span-2">
                                      <FormLabel>End Time</FormLabel>
                                      <FormControl><Input type="time" value={dayTime.endTime} onChange={(e) => updateDayTiming(subjectId, day, 'endTime', e.target.value)} /></FormControl>
                                    </FormItem>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <FormItem>
                            <FormLabel>Default Class Link for This Subject (optional)</FormLabel>
                            <FormControl>
                              <Input
                                type="url"
                                placeholder="https://zoom.us/j/..."
                                value={schedule.defaultZoomLink || ''}
                                onChange={(e) => updateSubjectClassLink(subjectId, e.target.value)}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              This link will auto-fill when you schedule future meetings for {subject?.name || 'this subject'}.
                            </p>
                            {schedule.defaultZoomLink?.trim() && !isValidHttpUrl(schedule.defaultZoomLink) ? (
                              <p className="text-xs text-destructive">Enter a valid `http` or `https` class link.</p>
                            ) : null}
                          </FormItem>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <FormField control={form.control} name="accessLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Level</FormLabel>
                    <FormControl>
                      <RadioGroup className="flex gap-6" value={field.value} onValueChange={field.onChange}>
                        <div className="flex items-center gap-2"><RadioGroupItem value="free" id="batch-free-edit" /><label htmlFor="batch-free-edit">Free</label></div>
                        <div className="flex items-center gap-2"><RadioGroupItem value="paid" id="batch-paid-edit" /><label htmlFor="batch-paid-edit">Paid</label></div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <p className="text-xs text-muted-foreground">
                  Total live meetings are now derived from the planned session count you set for each subject. Mock tests are not counted.
                </p>

                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={isSubmitDisabled}><PencilLine className="mr-2 h-4 w-4" />{isSubmitting ? 'Saving...' : 'Save Changes'}</Button>
                  <Button type="button" variant="outline" onClick={() => router.push('/live-batches?view=your')}>Cancel</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
