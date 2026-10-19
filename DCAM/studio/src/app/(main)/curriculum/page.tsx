'use client';

import { useState, useMemo, FC, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useCollection, addDocumentNonBlocking, useMemoFirebase, updateDocumentNonBlocking, useUser } from '@/firebase';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { collection, query, orderBy, doc, writeBatch, getDocs, where, updateDoc, deleteDoc } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, LoaderCircle, Book, BookCopy, Edit2, Trash2, Tag, Search, Shapes, Layers3, BookOpenCheck, Clock3, CheckCircle2, XCircle, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import TeacherTeachingProfile from '@/components/teacher-teaching-profile';

// Zod schemas
const examTypeSchema = z.object({
    name: z.string().min(2, 'Exam Type name must be at least 2 characters.'),
});

const classSchema = z.object({
  name: z.string().min(2, 'Class name must be at least 2 characters.'),
  examTypeId: z.string().min(1, 'You must select an exam type.'),
});

const subjectSchema = z.object({
  name: z.string().min(2, 'Subject name must be at least 2 characters.'),
  classId: z.string().min(1, 'You must select a class.'),
});
const subjectFormSchema = subjectSchema.extend({
  examTypeId: z.string().min(1, 'You must select an exam type.'),
});

const topicSchema = z.object({
  name: z.string().min(3, 'Topic name must be at least 3 characters.'),
  description: z.string().optional(),
  subjectId: z.string().min(1, 'You must select a subject.'),
});
const topicFormSchema = topicSchema.extend({
  classId: z.string().min(1, 'You must select a class.'),
  examTypeId: z.string().min(1, 'You must select an exam type.'),
});

const curriculumRequestSchema = z.object({
  requestedExamType: z.string().min(2, 'Enter exam type.'),
  requestedCurriculum: z.string().min(2, 'Enter curriculum/class.'),
  requestedSubjects: z.string().min(2, 'Enter at least one subject.'),
  message: z.string().max(400, 'Message can be up to 400 characters.').optional(),
});

// Data types
type ExamType = { id: string; name: string; };
type Class = { id: string; name: string; examTypeId: string; };
type Subject = { id: string; name: string; classId: string };
type Topic = { id: string; name: string; description?: string; subjectId: string; };
type CurriculumRequestStatus = 'pending' | 'approved' | 'rejected';
type CurriculumRequest = {
  id: string;
  requestedExamType: string;
  requestedCurriculum: string;
  requestedSubjects: string;
  message?: string;
  teacherId?: string;
  teacherName?: string;
  teacherEmail?: string;
  status?: CurriculumRequestStatus | string;
  createdAt?: string | { toDate?: () => Date };
  reviewedAt?: string | { toDate?: () => Date };
  reviewedBy?: string;
};
type CurriculumRequestFilter = CurriculumRequestStatus | 'all';

const PRIMARY_ACTION_BUTTON =
  'h-11 rounded-xl px-5 text-[15px] font-semibold shadow-[0_12px_26px_rgba(59,130,246,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_32px_rgba(59,130,246,0.36)]';

const REQUEST_STATUS_META: Record<CurriculumRequestStatus, { label: string; badgeClassName: string; cardClassName: string }> = {
  pending: {
    label: 'Pending',
    badgeClassName: 'border-amber-400/40 bg-amber-500/10 text-amber-300',
    cardClassName: 'border-amber-400/25',
  },
  approved: {
    label: 'Approved',
    badgeClassName: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
    cardClassName: 'border-emerald-400/25',
  },
  rejected: {
    label: 'Rejected',
    badgeClassName: 'border-rose-400/40 bg-rose-500/10 text-rose-300',
    cardClassName: 'border-rose-400/25',
  },
};

const normalizeRequestStatus = (status: string | undefined | null): CurriculumRequestStatus => {
  if (status === 'approved' || status === 'rejected') return status;
  return 'pending';
};

const toDateSafe = (value?: string | { toDate?: () => Date } | null): Date | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    try {
      const parsed = value.toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

const formatDateTime = (value?: string | { toDate?: () => Date } | null): string => {
  const parsed = toDateSafe(value);
  if (!parsed) return 'Unknown time';
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// Add Exam Type Form
const AddExamTypeForm: FC<{ onFormSubmit: () => void }> = ({ onFormSubmit }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
  
    const form = useForm<z.infer<typeof examTypeSchema>>({
      resolver: zodResolver(examTypeSchema),
      defaultValues: { name: '' },
    });
  
    function onSubmit(values: z.infer<typeof examTypeSchema>) {
      setIsSubmitting(true);
      const examTypesRef = collection(firestore, 'exam_types');
      addDocumentNonBlocking(examTypesRef, values);
      toast({ title: 'Exam Type Added!', description: `"${values.name}" has been added.` });
      form.reset();
      onFormSubmit();
      setIsSubmitting(false);
    }
  
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Exam Type Name</FormLabel>
              <FormControl><Input placeholder="e.g., IIT-JEE" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <Button type="submit" disabled={isSubmitting} className={PRIMARY_ACTION_BUTTON}>
            {isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Add Exam Type
          </Button>
        </form>
      </Form>
    );
};

// Add Class Form
const AddClassForm: FC<{ examTypes: ExamType[], onFormSubmit: () => void }> = ({ examTypes, onFormSubmit }) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof classSchema>>({
    resolver: zodResolver(classSchema),
    defaultValues: { name: '', examTypeId: '' },
  });

  function onSubmit(values: z.infer<typeof classSchema>) {
    setIsSubmitting(true);
    const classesRef = collection(firestore, 'classes');
    addDocumentNonBlocking(classesRef, values);
    toast({ title: 'Class Added!', description: `"${values.name}" has been added.` });
    form.reset();
    onFormSubmit();
    setIsSubmitting(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="examTypeId" render={({ field }) => (
            <FormItem>
                <FormLabel>Exam Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select an exam type" /></SelectTrigger></FormControl>
                    <SelectContent>{examTypes.map(et => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
        )} />
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Class Name</FormLabel>
            <FormControl><Input placeholder="e.g., CBSE Class 10" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" disabled={isSubmitting} className={PRIMARY_ACTION_BUTTON}>
          {isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
          Add Class
        </Button>
      </form>
    </Form>
  );
};


// Add Subject Form
const AddSubjectForm: FC<{ examTypes: ExamType[], classes: Class[], onFormSubmit: () => void }> = ({ examTypes, classes, onFormSubmit }) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof subjectFormSchema>>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: { name: '', classId: '', examTypeId: '' },
  });

  const selectedExamTypeId = form.watch('examTypeId');

  const filteredClasses = useMemo(() => {
    if (!selectedExamTypeId) return [];
    return classes.filter(c => c.examTypeId === selectedExamTypeId);
  }, [selectedExamTypeId, classes]);

  useEffect(() => {
    form.setValue('classId', '');
  }, [selectedExamTypeId, form]);

  function onSubmit(values: z.infer<typeof subjectFormSchema>) {
    setIsSubmitting(true);
    const subjectsRef = collection(firestore, 'subjects');
    const { examTypeId: _examTypeId, ...subjectData } = values;
    addDocumentNonBlocking(subjectsRef, subjectData);
    toast({ title: 'Subject Added!', description: `"${subjectData.name}" has been added.` });
    form.reset();
    onFormSubmit();
    setIsSubmitting(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="examTypeId" render={({ field }) => (
            <FormItem>
                <FormLabel>Exam Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select an exam type" /></SelectTrigger></FormControl>
                    <SelectContent>{examTypes.map(et => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
        )} />
        <FormField control={form.control} name="classId" render={({ field }) => (
            <FormItem>
                <FormLabel>Class</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!selectedExamTypeId}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger></FormControl>
                    <SelectContent>{filteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
        )} />
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Subject Name</FormLabel>
            <FormControl><Input placeholder="e.g., Organic Chemistry" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" disabled={isSubmitting} className={PRIMARY_ACTION_BUTTON}>
          {isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
          Add Subject
        </Button>
      </form>
    </Form>
  );
};

// Add Topic Form
const AddTopicForm: FC<{ examTypes: ExamType[], classes: Class[], subjects: Subject[], onFormSubmit: () => void }> = ({ examTypes, classes, subjects, onFormSubmit }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
  
    const form = useForm<z.infer<typeof topicFormSchema>>({
      resolver: zodResolver(topicFormSchema),
      defaultValues: { name: '', description: '', subjectId: '', classId: '', examTypeId: '' },
    });

    const selectedExamTypeId = form.watch('examTypeId');
    const selectedClassId = form.watch('classId');

    const filteredClasses = useMemo(() => {
        if (!selectedExamTypeId) return [];
        return classes.filter(c => c.examTypeId === selectedExamTypeId);
    }, [selectedExamTypeId, classes]);

    const filteredSubjects = useMemo(() => {
        if (!selectedClassId) return [];
        return subjects.filter(s => s.classId === selectedClassId);
    }, [selectedClassId, subjects]);

    useEffect(() => {
        form.setValue('classId', '');
        form.setValue('subjectId', '');
    }, [selectedExamTypeId, form]);

    useEffect(() => {
        form.setValue('subjectId', '');
    }, [selectedClassId, form]);
  
    function onSubmit(values: z.infer<typeof topicFormSchema>) {
      setIsSubmitting(true);
      const topicsRef = collection(firestore, 'topics');
      const { examTypeId: _examTypeId, classId: _classId, ...topicData } = values;
      addDocumentNonBlocking(topicsRef, topicData);
      toast({ title: 'Topic Added!', description: `"${topicData.name}" has been added.` });
      form.reset();
      onFormSubmit();
      setIsSubmitting(false);
    }
  
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="examTypeId" render={({ field }) => (
                <FormItem>
                    <FormLabel>Exam Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select an exam type" /></SelectTrigger></FormControl>
                        <SelectContent>{examTypes.map(et => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="classId" render={({ field }) => (
                <FormItem>
                    <FormLabel>Class</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedExamTypeId}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger></FormControl>
                        <SelectContent>{filteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="subjectId" render={({ field }) => (
                <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedClassId}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger></FormControl>
                        <SelectContent>{filteredSubjects.map(subject => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                    <FormLabel>Topic Name</FormLabel>
                    <FormControl><Input placeholder="e.g., General Organic Chemistry" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                    <FormLabel>Topic Description (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="A brief overview of the topic" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <Button type="submit" disabled={isSubmitting || !form.watch('subjectId')} className={PRIMARY_ACTION_BUTTON}>
            {isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Add Topic
            </Button>
        </form>
      </Form>
    );
};

const EditForm: FC<{
  item: { type: 'examType' | 'class' | 'subject' | 'topic'; data: any };
  examTypes: ExamType[];
  classes: Class[];
  subjects: Subject[];
  onFinished: () => void;
}> = ({ item, examTypes, classes, subjects, onFinished }) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isExamType = item.type === 'examType';
  const isClass = item.type === 'class';
  const isSubject = item.type === 'subject';
  const isTopic = item.type === 'topic';

  let schema: z.ZodType<any> = z.object({});
  if (isExamType) schema = examTypeSchema;
  if (isClass) schema = classSchema;
  if (isSubject) schema = subjectSchema;
  if (isTopic) schema = topicSchema;

  let defaultValues: any = { ...item.data };
  if (isSubject) {
    const classItem = classes.find(c => c.id === item.data.classId);
    defaultValues.examTypeId = classItem?.examTypeId || '';
  } else if (isTopic) {
    const subject = subjects.find(s => s.id === item.data.subjectId);
    const classItem = classes.find(c => c.id === subject?.classId);
    defaultValues.examTypeId = classItem?.examTypeId || '';
    defaultValues.classId = subject?.classId || '';
  }

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const selectedExamTypeId = form.watch('examTypeId');
  const selectedClassId = form.watch('classId');
  
  const filteredClasses = useMemo(() => {
    if (!selectedExamTypeId) return [];
    return classes.filter(c => c.examTypeId === selectedExamTypeId);
  }, [selectedExamTypeId, classes]);

  const filteredSubjects = useMemo(() => {
    if (!selectedClassId) return [];
    return subjects.filter(s => s.classId === selectedClassId);
  }, [selectedClassId, subjects]);

  useEffect(() => {
    if (isSubject) {
        const classItem = classes.find(c => c.id === form.getValues('classId'));
        if (classItem && classItem.examTypeId !== selectedExamTypeId) {
            form.setValue('classId', '');
        }
    } else if (isTopic) {
        const subjectItem = subjects.find(s => s.id === form.getValues('subjectId'));
        const classItem = classes.find(c => c.id === subjectItem?.classId);
        if (classItem && classItem.examTypeId !== selectedExamTypeId) {
            form.setValue('classId', '');
            form.setValue('subjectId', '');
        } else if (subjectItem && subjectItem.classId !== selectedClassId) {
            form.setValue('subjectId', '');
        }
    }
  }, [selectedExamTypeId, selectedClassId, form, isSubject, isTopic, classes, subjects]);

  async function onSubmit(values: any) {
    setIsSubmitting(true);
    const { examTypeId, classId, ...dataToSave } = values;
    const collectionName = item.type === 'examType' ? 'exam_types' : `${item.type}s`;
    const docRef = doc(firestore, collectionName, item.data.id);

    try {
      await updateDocumentNonBlocking(docRef, dataToSave);
      toast({ title: `${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Updated!` });
      onFinished();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {isExamType && (
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Exam Type Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
        )}
        {isClass && (
            <>
                <FormField control={form.control} name="examTypeId" render={({ field }) => (
                    <FormItem><FormLabel>Exam Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{examTypes.map(et => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Class Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </>
        )}
        {isSubject && (
            <>
                <FormField control={form.control} name="examTypeId" render={({ field }) => (
                    <FormItem><FormLabel>Exam Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an exam type" /></SelectTrigger></FormControl><SelectContent>{examTypes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="classId" render={({ field }) => (
                    <FormItem><FormLabel>Class</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedExamTypeId}><FormControl><SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger></FormControl><SelectContent>{filteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Subject Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </>
        )}
        {isTopic && (
            <>
                <FormField control={form.control} name="examTypeId" render={({ field }) => (
                    <FormItem><FormLabel>Exam Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an exam type" /></SelectTrigger></FormControl><SelectContent>{examTypes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="classId" render={({ field }) => (
                    <FormItem><FormLabel>Class</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedExamTypeId}><FormControl><SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger></FormControl><SelectContent>{filteredClasses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="subjectId" render={({ field }) => (
                    <FormItem><FormLabel>Subject</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedClassId}><FormControl><SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger></FormControl><SelectContent>{filteredSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Topic Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Topic Description (Optional)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </>
        )}
        <Button type="submit" disabled={isSubmitting} className={PRIMARY_ACTION_BUTTON}>
          {isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Changes
        </Button>
      </form>
    </Form>
  );
};

const ContactAdminCurriculumRequestForm: FC = () => {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof curriculumRequestSchema>>({
    resolver: zodResolver(curriculumRequestSchema),
    defaultValues: {
      requestedExamType: '',
      requestedCurriculum: '',
      requestedSubjects: '',
      message: '',
    },
  });

  async function onSubmit(values: z.infer<typeof curriculumRequestSchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'curriculum_requests'), {
        ...values,
        teacherId: user.uid,
        teacherName: user.displayName || 'Anonymous Teacher',
        teacherEmail: user.email || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      toast({
        title: 'Request sent to admin',
        description: 'Your request for new exam/curriculum/subjects has been submitted.',
      });
      form.reset();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Request failed',
        description: error?.message || 'Could not submit request.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-background via-background to-primary/5 shadow-[0_16px_42px_rgba(15,23,42,0.24)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">Contact Admin For New Curriculum</CardTitle>
        <CardDescription className="text-sm md:text-base">
          If your exam, curriculum, or subjects are missing, send a structured request to admin from here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="requestedExamType" render={({ field }) => (
              <FormItem>
                <FormLabel>Requested Exam Type</FormLabel>
                <FormControl><Input placeholder="e.g., CUET-UG" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="requestedCurriculum" render={({ field }) => (
              <FormItem>
                <FormLabel>Requested Curriculum/Class</FormLabel>
                <FormControl><Input placeholder="e.g., CUET Science Stream 2027" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="requestedSubjects" render={({ field }) => (
              <FormItem>
                <FormLabel>Requested Subjects</FormLabel>
                <FormControl><Textarea rows={3} placeholder="e.g., Physics, Chemistry, Mathematics" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="message" render={({ field }) => (
              <FormItem>
                <FormLabel>Message (Optional)</FormLabel>
                <FormControl><Textarea rows={3} placeholder="Any additional note for admin..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" disabled={isSubmitting} className={cn(PRIMARY_ACTION_BUTTON, 'w-full md:w-auto')}>
              {isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send Request
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};


export default function CurriculumPage() {
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [formKey, setFormKey] = useState(0);
  const [itemToEdit, setItemToEdit] = useState<{type: 'examType' | 'class' | 'subject' | 'topic', data: any} | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{type: 'examType' | 'class' | 'subject' | 'topic', data: any} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const examTypesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null, [firestore]);
  const classesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null, [firestore]);
  const subjectsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null, [firestore]);
  const topicsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'topics'), orderBy('name')) : null, [firestore]);
  const curriculumRequestsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (isAdmin) return collection(firestore, 'curriculum_requests');
    if (user?.uid) return query(collection(firestore, 'curriculum_requests'), where('teacherId', '==', user.uid));
    return null;
  }, [firestore, isAdmin, user?.uid]);
  
  const { data: examTypes, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classes, isLoading: areClassesLoading } = useCollection<Class>(classesQuery);
  const { data: subjects, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: topics, isLoading: areTopicsLoading } = useCollection<Topic>(topicsQuery);
  const { data: curriculumRequests, isLoading: areCurriculumRequestsLoading } = useCollection<CurriculumRequest>(curriculumRequestsQuery);
  const [combinationSearch, setCombinationSearch] = useState('');
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<CurriculumRequestFilter>('pending');
  const [teacherRequestSearch, setTeacherRequestSearch] = useState('');
  const [teacherRequestStatusFilter, setTeacherRequestStatusFilter] = useState<CurriculumRequestFilter>('all');
  const [requestActionId, setRequestActionId] = useState<string | null>(null);
  const [requestDeleteId, setRequestDeleteId] = useState<string | null>(null);

  const curriculumCombinations = useMemo(() => {
    if (!classes || !subjects || !topics || !examTypes) return [];

    const topicCountBySubjectId = new Map<string, number>();
    for (const topic of topics) {
      topicCountBySubjectId.set(topic.subjectId, (topicCountBySubjectId.get(topic.subjectId) || 0) + 1);
    }

    const examTypeById = new Map(examTypes.map((examType) => [examType.id, examType] as const));

    return classes
      .map((curriculum) => {
        const linkedSubjects = subjects
          .filter((subject) => subject.classId === curriculum.id)
          .sort((a, b) => a.name.localeCompare(b.name));

        const totalTopicCount = linkedSubjects.reduce(
          (sum, subject) => sum + (topicCountBySubjectId.get(subject.id) || 0),
          0
        );

        return {
          examType: examTypeById.get(curriculum.examTypeId) || null,
          curriculum,
          subjects: linkedSubjects,
          totalTopicCount,
        };
      })
      .sort((a, b) => {
        const examCompare = (a.examType?.name || '').localeCompare(b.examType?.name || '');
        if (examCompare !== 0) return examCompare;
        return a.curriculum.name.localeCompare(b.curriculum.name);
      });
  }, [classes, subjects, topics, examTypes]);

  const filteredCombinations = useMemo(() => {
    const search = combinationSearch.trim().toLowerCase();
    if (!search) return curriculumCombinations;

    return curriculumCombinations.filter((combination) => {
      const examName = combination.examType?.name || '';
      const subjectNames = combination.subjects.map((subject) => subject.name).join(' ');
      return (
        examName.toLowerCase().includes(search) ||
        combination.curriculum.name.toLowerCase().includes(search) ||
        subjectNames.toLowerCase().includes(search)
      );
    });
  }, [combinationSearch, curriculumCombinations]);

  const totalCombinationsWithSubjects = useMemo(
    () => curriculumCombinations.filter((combination) => combination.subjects.length > 0).length,
    [curriculumCombinations]
  );

  const sortedCurriculumRequests = useMemo(() => {
    const source = curriculumRequests || [];
    return [...source].sort((a, b) => {
      const aTime = toDateSafe(a.createdAt)?.getTime() || 0;
      const bTime = toDateSafe(b.createdAt)?.getTime() || 0;
      return bTime - aTime;
    });
  }, [curriculumRequests]);

  const requestStatusCounts = useMemo(() => {
    const counts = { pending: 0, approved: 0, rejected: 0 };
    for (const requestItem of sortedCurriculumRequests) {
      const status = normalizeRequestStatus(requestItem.status);
      counts[status] += 1;
    }
    return counts;
  }, [sortedCurriculumRequests]);

  const filteredCurriculumRequests = useMemo(() => {
    const search = requestSearch.trim().toLowerCase();
    return sortedCurriculumRequests.filter((requestItem) => {
      const status = normalizeRequestStatus(requestItem.status);
      const matchesFilter = requestStatusFilter === 'all' || status === requestStatusFilter;
      if (!matchesFilter) return false;

      if (!search) return true;

      const searchableText = [
        requestItem.requestedExamType,
        requestItem.requestedCurriculum,
        requestItem.requestedSubjects,
        requestItem.teacherName,
        requestItem.teacherEmail,
        requestItem.message,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [sortedCurriculumRequests, requestSearch, requestStatusFilter]);

  const filteredTeacherCurriculumRequests = useMemo(() => {
    const search = teacherRequestSearch.trim().toLowerCase();
    return sortedCurriculumRequests.filter((requestItem) => {
      const status = normalizeRequestStatus(requestItem.status);
      const matchesFilter = teacherRequestStatusFilter === 'all' || status === teacherRequestStatusFilter;
      if (!matchesFilter) return false;

      if (!search) return true;
      const searchableText = [
        requestItem.requestedExamType,
        requestItem.requestedCurriculum,
        requestItem.requestedSubjects,
        requestItem.message,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [sortedCurriculumRequests, teacherRequestSearch, teacherRequestStatusFilter]);


  const isLoading = isAdminLoading || isTeacherLoading || areExamTypesLoading || areClassesLoading || areSubjectsLoading || areTopicsLoading;
  const onFormSubmit = () => setFormKey(prev => prev + 1);

  const handleEdit = (type: 'examType' | 'class' | 'subject' | 'topic', data: any) => {
    setItemToEdit({ type, data });
  };

  const handleDeleteRequest = (type: 'examType' | 'class' | 'subject' | 'topic', data: any) => {
    setItemToDelete({ type, data });
  };

  const handleCurriculumRequestStatusUpdate = async (
    requestItem: CurriculumRequest,
    nextStatus: CurriculumRequestStatus
  ) => {
    if (!firestore || !requestItem.id || requestActionId) return;
    setRequestActionId(requestItem.id);

    try {
      const requestRef = doc(firestore, 'curriculum_requests', requestItem.id);
      await updateDoc(requestRef, {
        status: nextStatus,
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.uid || 'admin',
      });

      if ((nextStatus === 'approved' || nextStatus === 'rejected') && requestItem.teacherId) {
        const notificationTitle =
          nextStatus === 'approved'
            ? 'Curriculum Request Approved'
            : 'Curriculum Request Rejected';
        const notificationMessage =
          nextStatus === 'approved'
            ? `Your request for "${requestItem.requestedCurriculum}" (${requestItem.requestedExamType}) was approved by admin.`
            : `Your request for "${requestItem.requestedCurriculum}" (${requestItem.requestedExamType}) was rejected by admin.`;

        await addDocumentNonBlocking(collection(firestore, 'notifications'), {
          title: notificationTitle,
          message: notificationMessage,
          href: '/curriculum',
          audience: 'teachers',
          notificationType: 'curriculum_request_status',
          curriculumRequestId: requestItem.id,
          curriculumRequestStatus: nextStatus,
          recipientId: requestItem.teacherId,
          createdAt: new Date(),
        });
      }

      toast({
        title: `Request ${REQUEST_STATUS_META[nextStatus].label.toLowerCase()}`,
        description: `Request from ${requestItem.teacherName || requestItem.teacherEmail || 'teacher'} has been marked as ${nextStatus}.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not update request',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setRequestActionId(null);
    }
  };

  const handleCurriculumRequestDelete = async (
    requestItem: CurriculumRequest,
    actor: 'admin' | 'teacher'
  ) => {
    if (!firestore || !requestItem.id || requestDeleteId || requestActionId) return;

    const status = normalizeRequestStatus(requestItem.status);
    if (actor === 'admin' && status === 'pending') {
      toast({
        variant: 'destructive',
        title: 'Cannot delete pending request',
        description: 'Admin can delete only approved or rejected requests.',
      });
      return;
    }

    const confirmed = window.confirm(
      actor === 'admin'
        ? 'Delete this reviewed request permanently? This cannot be undone.'
        : 'Delete this request permanently from your list? This cannot be undone.'
    );
    if (!confirmed) return;

    setRequestDeleteId(requestItem.id);
    try {
      await deleteDoc(doc(firestore, 'curriculum_requests', requestItem.id));
      toast({
        title: 'Request deleted',
        description:
          actor === 'admin'
            ? 'The request has been permanently deleted.'
            : 'Your request has been permanently deleted.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error?.message || 'Could not delete request.',
      });
    } finally {
      setRequestDeleteId(null);
    }
  };
  
  const confirmDelete = async () => {
    if (!itemToDelete || !firestore) return;
    setIsDeleting(true);

    try {
        const batch = writeBatch(firestore);
        const { type, data } = itemToDelete;

        if (type === 'examType') {
            const examTypeId = data.id;
            batch.delete(doc(firestore, 'exam_types', examTypeId));

            const classesQuerySnapshot = await getDocs(query(collection(firestore, 'classes'), where('examTypeId', '==', examTypeId)));
            if (!classesQuerySnapshot.empty) {
                const classIds = classesQuerySnapshot.docs.map(d => d.id);
                classesQuerySnapshot.docs.forEach(d => batch.delete(d.ref));

                for (let i = 0; i < classIds.length; i+=30) {
                    const classChunk = classIds.slice(i, i+30);
                    const subjectsQuerySnapshot = await getDocs(query(collection(firestore, 'subjects'), where('classId', 'in', classChunk)));
                    if (!subjectsQuerySnapshot.empty) {
                        const subjectIds = subjectsQuerySnapshot.docs.map(d => d.id);
                        subjectsQuerySnapshot.docs.forEach(d => batch.delete(d.ref));
                        
                        for (let j = 0; j < subjectIds.length; j += 30) {
                            const subjectChunk = subjectIds.slice(j, j + 30);
                            const topicsQuery = query(collection(firestore, 'topics'), where('subjectId', 'in', subjectChunk));
                            const topicsSnapshot = await getDocs(topicsQuery);
                            topicsSnapshot.docs.forEach(d => batch.delete(d.ref));
                        }
                    }
                }
            }
        } else if (type === 'class') {
            const classId = data.id;
            batch.delete(doc(firestore, 'classes', classId));

            const subjectsQuery = query(collection(firestore, 'subjects'), where('classId', '==', classId));
            const subjectsSnapshot = await getDocs(subjectsQuery);
            
            if (!subjectsSnapshot.empty) {
                const subjectIds = subjectsSnapshot.docs.map(d => d.id);
                subjectsSnapshot.docs.forEach(d => batch.delete(d.ref));
                
                for (let i = 0; i < subjectIds.length; i += 30) {
                    const chunk = subjectIds.slice(i, i + 30);
                    const topicsQuery = query(collection(firestore, 'topics'), where('subjectId', 'in', chunk));
                    const topicsSnapshot = await getDocs(topicsQuery);
                    topicsSnapshot.docs.forEach(d => batch.delete(d.ref));
                }
            }
        } else if (type === 'subject') {
            const subjectId = data.id;
            batch.delete(doc(firestore, 'subjects', subjectId));

            const topicsQuery = query(collection(firestore, 'topics'), where('subjectId', '==', subjectId));
            const topicsSnapshot = await getDocs(topicsQuery);
            topicsSnapshot.docs.forEach(d => batch.delete(d.ref));

        } else if (type === 'topic') {
            batch.delete(doc(firestore, 'topics', data.id));
        }

        await batch.commit();
        toast({ title: `${type.charAt(0).toUpperCase() + itemToDelete.type.slice(1)} Deleted`, description: `"${data.name}" and any associated children have been removed.` });
    } catch (error: any) {
        console.error("Deletion error: ", error);
        toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
    } finally {
        setIsDeleting(false);
        setItemToDelete(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title={isAdmin ? 'Curriculum Management' : 'Curriculum'} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 grid gap-8">
        {isTeacher && !isAdmin ? (
          <div className="grid gap-8">
            <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background shadow-[0_16px_40px_rgba(15,23,42,0.2)]">
              <CardHeader className="space-y-3">
                <CardTitle className="text-xl">Curriculum Request Overview</CardTitle>
                <CardDescription>
                  Track your submitted curriculum requests and latest admin decisions.
                </CardDescription>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
                    Pending: {requestStatusCounts.pending}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                    Approved: {requestStatusCounts.approved}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-300">
                    Rejected: {requestStatusCounts.rejected}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            <TeacherTeachingProfile />
            <ContactAdminCurriculumRequestForm />

            <Card className="border-primary/20 bg-gradient-to-b from-background via-background to-muted/20 shadow-[0_16px_40px_rgba(15,23,42,0.22)]">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-xl">Your Curriculum Request Status</CardTitle>
                    <CardDescription>All your submitted requests with latest status.</CardDescription>
                  </div>
                  <div className="relative w-full lg:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={teacherRequestSearch}
                      onChange={(e) => setTeacherRequestSearch(e.target.value)}
                      placeholder="Search request..."
                      className="h-11 rounded-xl border-primary/25 bg-background/70 pl-10"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {areCurriculumRequestsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                  </div>
                ) : sortedCurriculumRequests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                    No requests submitted yet. Use the form above to send your first request.
                  </div>
                ) : (
                  <Tabs
                    value={teacherRequestStatusFilter}
                    onValueChange={(value) => setTeacherRequestStatusFilter(value as CurriculumRequestFilter)}
                    className="space-y-4"
                  >
                    <TabsList className="h-auto flex-wrap gap-1 rounded-xl bg-muted/45 p-1.5">
                      <TabsTrigger value="all" className="rounded-lg">
                        All ({sortedCurriculumRequests.length})
                      </TabsTrigger>
                      <TabsTrigger value="pending" className="rounded-lg">
                        Pending ({requestStatusCounts.pending})
                      </TabsTrigger>
                      <TabsTrigger value="approved" className="rounded-lg">
                        Approved ({requestStatusCounts.approved})
                      </TabsTrigger>
                      <TabsTrigger value="rejected" className="rounded-lg">
                        Rejected ({requestStatusCounts.rejected})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value={teacherRequestStatusFilter} className="mt-0 space-y-3">
                      {filteredTeacherCurriculumRequests.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                          No requests match this filter.
                        </div>
                      ) : (
                        filteredTeacherCurriculumRequests.map((requestItem) => {
                          const status = normalizeRequestStatus(requestItem.status);
                          const statusMeta = REQUEST_STATUS_META[status];
                          const requestedSubjects = (requestItem.requestedSubjects || '')
                            .split(/,|\n/)
                            .map((subject) => subject.trim())
                            .filter(Boolean);

                          return (
                            <div
                              key={requestItem.id}
                              className={cn('rounded-2xl border bg-background/70 p-4', statusMeta.cardClassName)}
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <Badge variant="outline" className={cn('w-fit rounded-full', statusMeta.badgeClassName)}>
                                  {statusMeta.label}
                                </Badge>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-muted-foreground">
                                    Sent: {formatDateTime(requestItem.createdAt)}
                                  </p>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="h-8 rounded-lg"
                                    disabled={requestDeleteId === requestItem.id || requestActionId === requestItem.id}
                                    onClick={() => handleCurriculumRequestDelete(requestItem, 'teacher')}
                                  >
                                    {requestDeleteId === requestItem.id ? (
                                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                    Delete
                                  </Button>
                                </div>
                              </div>

                              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requested Exam</p>
                                  <p className="mt-1 text-sm font-medium">{requestItem.requestedExamType || 'N/A'}</p>
                                </div>
                                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requested Curriculum</p>
                                  <p className="mt-1 text-sm font-medium">{requestItem.requestedCurriculum || 'N/A'}</p>
                                </div>
                              </div>

                              <div className="mt-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requested Subjects</p>
                                <div className="flex flex-wrap gap-2">
                                  {requestedSubjects.length === 0 ? (
                                    <span className="text-sm text-muted-foreground">No subjects provided.</span>
                                  ) : (
                                    requestedSubjects.map((subjectName, subjectIndex) => (
                                      <Badge key={`${requestItem.id}-${subjectName}-${subjectIndex}`} variant="outline" className="rounded-full border-border/70">
                                        {subjectName}
                                      </Badge>
                                    ))
                                  )}
                                </div>
                              </div>

                              {requestItem.message ? (
                                <div className="mt-3 rounded-xl border border-border/60 bg-muted/15 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message</p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm">{requestItem.message}</p>
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
        {isAdmin && (
          <div className="grid gap-8">
            <Card className="relative overflow-hidden border-primary/25 bg-gradient-to-r from-primary/12 via-background to-background shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
              <div className="pointer-events-none absolute inset-y-0 right-0 w-72 bg-gradient-to-l from-primary/25 to-transparent" />
              <CardHeader className="relative space-y-4">
                <CardTitle className="flex items-center gap-3 font-headline text-2xl">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/35 bg-primary/15 text-primary">
                    <Layers3 className="h-5 w-5" />
                  </span>
                  Manage Exam, Curriculum, and Subjects
                </CardTitle>
                <CardDescription className="max-w-3xl text-sm md:text-base">
                  Create and monitor all exam-curriculum-subject combinations in one workspace.
                </CardDescription>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full bg-primary/90 px-3 py-1 text-xs">Exams: {examTypes?.length || 0}</Badge>
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">Curricula: {classes?.length || 0}</Badge>
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">Subjects: {subjects?.length || 0}</Badge>
                  <Badge variant="outline" className="rounded-full border-primary/40 bg-primary/5 px-3 py-1 text-xs">
                    Active Combinations: {totalCombinationsWithSubjects}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
                    Pending Requests: {requestStatusCounts.pending}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            <Card className="border-primary/20 bg-gradient-to-b from-background via-background to-muted/25 shadow-[0_20px_48px_rgba(15,23,42,0.24)]">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Inbox className="h-5 w-5 text-primary" />
                      Teacher Curriculum Requests
                    </CardTitle>
                    <CardDescription>Review, approve, or reject requests submitted by teachers.</CardDescription>
                  </div>
                  <div className="relative w-full lg:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={requestSearch}
                      onChange={(e) => setRequestSearch(e.target.value)}
                      placeholder="Search teacher, exam, curriculum..."
                      className="h-11 rounded-xl border-primary/25 bg-background/70 pl-10"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {areCurriculumRequestsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                  </div>
                ) : sortedCurriculumRequests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
                    No curriculum requests yet.
                  </div>
                ) : (
                  <Tabs
                    value={requestStatusFilter}
                    onValueChange={(value) => setRequestStatusFilter(value as CurriculumRequestFilter)}
                    className="space-y-4"
                  >
                    <TabsList className="h-auto flex-wrap gap-1 rounded-xl bg-muted/45 p-1.5">
                      <TabsTrigger value="pending" className="rounded-lg">
                        Pending ({requestStatusCounts.pending})
                      </TabsTrigger>
                      <TabsTrigger value="approved" className="rounded-lg">
                        Approved ({requestStatusCounts.approved})
                      </TabsTrigger>
                      <TabsTrigger value="rejected" className="rounded-lg">
                        Rejected ({requestStatusCounts.rejected})
                      </TabsTrigger>
                      <TabsTrigger value="all" className="rounded-lg">
                        All ({sortedCurriculumRequests.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value={requestStatusFilter} className="mt-0 space-y-3">
                      {filteredCurriculumRequests.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                          No requests match this filter.
                        </div>
                      ) : (
                        filteredCurriculumRequests.map((requestItem) => {
                          const status = normalizeRequestStatus(requestItem.status);
                          const statusMeta = REQUEST_STATUS_META[status];
                          const isRequestBusy =
                            requestActionId === requestItem.id || requestDeleteId === requestItem.id;
                          const requestedSubjects = (requestItem.requestedSubjects || '')
                            .split(/,|\n/)
                            .map((subject) => subject.trim())
                            .filter(Boolean);

                          return (
                            <div
                              key={requestItem.id}
                              className={cn(
                                'rounded-2xl border bg-background/70 p-4',
                                statusMeta.cardClassName
                              )}
                            >
                              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className={cn('rounded-full', statusMeta.badgeClassName)}>
                                      {statusMeta.label}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      Received {formatDateTime(requestItem.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-sm font-semibold">
                                    {requestItem.teacherName || 'Unknown Teacher'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {requestItem.teacherEmail || 'No email shared'}
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {status !== 'approved' ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-9 rounded-lg"
                                      disabled={isRequestBusy}
                                      onClick={() => handleCurriculumRequestStatusUpdate(requestItem, 'approved')}
                                    >
                                      {requestActionId === requestItem.id ? (
                                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                      )}
                                      Approve
                                    </Button>
                                  ) : null}

                                  {status !== 'rejected' ? (
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      className="h-9 rounded-lg"
                                      disabled={isRequestBusy}
                                      onClick={() => handleCurriculumRequestStatusUpdate(requestItem, 'rejected')}
                                    >
                                      {requestActionId === requestItem.id ? (
                                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <XCircle className="h-3.5 w-3.5" />
                                      )}
                                      Reject
                                    </Button>
                                  ) : null}

                                  {status !== 'pending' ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-9 rounded-lg border-amber-500/35 bg-amber-500/5 text-amber-200 hover:bg-amber-500/10"
                                      disabled={isRequestBusy}
                                      onClick={() => handleCurriculumRequestStatusUpdate(requestItem, 'pending')}
                                    >
                                      {requestActionId === requestItem.id ? (
                                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Clock3 className="h-3.5 w-3.5" />
                                      )}
                                      Move To Pending
                                    </Button>
                                  ) : null}

                                  {status !== 'pending' ? (
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      className="h-9 rounded-lg"
                                      disabled={isRequestBusy}
                                      onClick={() => handleCurriculumRequestDelete(requestItem, 'admin')}
                                    >
                                      {requestDeleteId === requestItem.id ? (
                                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                      Delete
                                    </Button>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requested Exam</p>
                                  <p className="mt-1 text-sm font-medium">{requestItem.requestedExamType || 'N/A'}</p>
                                </div>
                                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requested Curriculum</p>
                                  <p className="mt-1 text-sm font-medium">{requestItem.requestedCurriculum || 'N/A'}</p>
                                </div>
                              </div>

                              <div className="mt-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requested Subjects</p>
                                {requestedSubjects.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No subjects provided.</p>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {requestedSubjects.map((subjectName, subjectIndex) => (
                                      <Badge key={`${requestItem.id}-${subjectName}-${subjectIndex}`} variant="outline" className="rounded-full border-border/70">
                                        {subjectName}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {requestItem.message ? (
                                <div className="mt-3 rounded-xl border border-border/60 bg-muted/15 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teacher Message</p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm">{requestItem.message}</p>
                                </div>
                              ) : null}

                              {requestItem.reviewedAt ? (
                                <p className="mt-3 text-xs text-muted-foreground">
                                  Last reviewed: {formatDateTime(requestItem.reviewedAt)}
                                </p>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <Card className="border-primary/20 bg-gradient-to-b from-background to-muted/35 shadow-[0_16px_40px_rgba(15,23,42,0.22)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-headline text-xl">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Tag className="h-4 w-4" />
                    </span>
                    Add Exam Type
                  </CardTitle>
                  <CardDescription>Add a new exam type, e.g., "NEET".</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? <Skeleton className="h-24 w-full rounded-xl" /> : <AddExamTypeForm key={`examType-${formKey}`} onFormSubmit={onFormSubmit} />}
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-gradient-to-b from-background to-muted/35 shadow-[0_16px_40px_rgba(15,23,42,0.22)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-headline text-xl">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <BookCopy className="h-4 w-4" />
                    </span>
                    Add New Class
                  </CardTitle>
                  <CardDescription>Add a new curriculum/class, e.g., "Class 11".</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? <Skeleton className="h-24 w-full rounded-xl" /> : <AddClassForm key={`class-${formKey}`} examTypes={examTypes || []} onFormSubmit={onFormSubmit} />}
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-gradient-to-b from-background to-muted/35 shadow-[0_16px_40px_rgba(15,23,42,0.22)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-headline text-xl">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Book className="h-4 w-4" />
                    </span>
                    Add New Subject
                  </CardTitle>
                  <CardDescription>Add a new subject under a selected curriculum.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? <Skeleton className="h-40 w-full rounded-xl" /> : <AddSubjectForm key={`subject-${formKey}`} examTypes={examTypes || []} classes={classes || []} onFormSubmit={onFormSubmit} />}
                </CardContent>
              </Card>
            </div>

            <Card className="border-primary/20 bg-gradient-to-b from-background via-background to-muted/25 shadow-[0_20px_48px_rgba(15,23,42,0.26)]">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <BookOpenCheck className="h-5 w-5 text-primary" />
                      Already Created Combinations
                    </CardTitle>
                    <CardDescription>Review existing exam + curriculum + subject combinations.</CardDescription>
                  </div>
                  <div className="relative w-full lg:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={combinationSearch}
                      onChange={(e) => setCombinationSearch(e.target.value)}
                      placeholder="Search exam, curriculum, or subject..."
                      className="h-11 rounded-xl border-primary/25 bg-background/70 pl-10"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Shapes className="h-3.5 w-3.5" />
                    Existing Exam Types
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(examTypes || []).length === 0 ? (
                      <span className="text-sm text-muted-foreground">No exam types created yet.</span>
                    ) : (
                      (examTypes || []).map((examType) => (
                        <div key={examType.id} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs">
                          <span className="font-medium">{examType.name}</span>
                          <button
                            type="button"
                            className="rounded p-0.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                            onClick={() => handleEdit('examType', examType)}
                            aria-label={`Edit exam type ${examType.name}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-0.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDeleteRequest('examType', examType)}
                            aria-label={`Delete exam type ${examType.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                  </div>
                ) : filteredCombinations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
                    No combinations found. Add exam types, curricula, and subjects to build combinations.
                  </div>
                ) : (
                  filteredCombinations.map((combination) => (
                    <div key={combination.curriculum.id} className="rounded-2xl border border-border/65 bg-background/70 p-4">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="rounded-full border border-primary/20 bg-primary/10 text-primary">
                              {combination.examType?.name || 'Unknown Exam'}
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-border/70">
                              {combination.curriculum.name}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {combination.subjects.length} subjects mapped | {combination.totalTopicCount} topics
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-lg border-primary/30 bg-primary/5"
                            onClick={() => handleEdit('class', combination.curriculum)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit Curriculum
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-9 rounded-lg"
                            onClick={() => handleDeleteRequest('class', combination.curriculum)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Curriculum
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {combination.subjects.length === 0 ? (
                          <span className="text-sm text-muted-foreground">No subjects added yet for this curriculum.</span>
                        ) : (
                          combination.subjects.map((subject) => (
                            <div key={subject.id} className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/20 px-3 py-1.5 text-xs">
                              <span className="font-medium">{subject.name}</span>
                              <button
                                type="button"
                                className="rounded p-0.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                                onClick={() => handleEdit('subject', subject)}
                                aria-label={`Edit subject ${subject.name}`}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="rounded p-0.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDeleteRequest('subject', subject)}
                                aria-label={`Delete subject ${subject.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

      </main>

      <Dialog open={!!itemToEdit} onOpenChange={(isOpen) => !isOpen && setItemToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {itemToEdit?.type}</DialogTitle>
          </DialogHeader>
          {itemToEdit && !isLoading && (
            <EditForm
              item={itemToEdit}
              examTypes={examTypes || []}
              classes={classes || []}
              subjects={subjects || []}
              onFinished={() => setItemToEdit(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!itemToDelete} onOpenChange={(isOpen) => !isOpen && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{itemToDelete?.data.name}"
              {itemToDelete?.type !== 'topic' && ' and all of its children (classes, subjects, topics)'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: 'destructive' }))}
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
