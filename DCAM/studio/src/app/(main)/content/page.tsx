

'use client';

import { useState, useMemo, useEffect, FC } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import DashboardHeader from '@/components/dashboard-header';
import { useFirestore, useCollection, addDocumentNonBlocking, useMemoFirebase, updateDocumentNonBlocking, useUser, useStorage } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useIsSubscribed } from '@/hooks/useIsSubscribed';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Film, LoaderCircle, Youtube, BookOpen, FileText, Lock, Edit } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { isStandaloneMockTest } from '@/lib/mock-test-visibility';
import { QUESTION_DIFFICULTY, QUESTION_DIFFICULTY_LABEL } from '@/lib/question-difficulty';

const contentSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters long.'),
  description: z.string().min(10, 'Description must be at least 10 characters long.'),
  type: z.enum(['video', 'pdf']),
  videoUrl: z.string().url('Please enter a valid video URL.').optional().or(z.literal('')),
  fileUrl: z.string().url('Please enter a valid PDF URL.').optional().or(z.literal('')),
  pdfFile: z.any().optional(),
  examTypeId: z.string().min(1, 'You must select an exam type.'),
  classId: z.string().min(1, 'You must select a class.'),
  subjectId: z.string().min(1, 'You must select a subject.'),
  topicId: z.string().min(1, 'You must select a topic.'),
  difficultyLevel: z.enum(['Easy', 'Medium', 'Hard']).transform(() => QUESTION_DIFFICULTY),
  accessLevel: z.enum(['free', 'paid']),
}).superRefine((data, ctx) => {
    if (data.type === 'video' && (!data.videoUrl || data.videoUrl.length === 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Video URL is required for video content.',
            path: ['videoUrl'],
        });
    }
    const hasPdfFile = !!data.pdfFile;
    if (data.type === 'pdf' && (!data.fileUrl || data.fileUrl.length === 0) && !hasPdfFile) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Upload a PDF or provide a PDF URL.',
            path: ['pdfFile'],
        });
    }
});


type ExamType = { id: string; name: string; };
type Class = { id: string; name: string; examTypeId: string; };
type Subject = { id: string; name: string; classId: string; };
type Topic = { id: string; name: string; subjectId: string; };
type Content = {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'pdf';
  videoUrl?: string;
  fileUrl?: string;
  topicId: string;
  subjectId: string;
  classId: string;
  examTypeId: string;
  difficultyLevel: 'Easy' | 'Medium' | 'Hard';
  accessLevel: 'free' | 'paid';
  teacherId?: string;
  teacherName?: string;
};
type CourseItem = {
  id: string;
  title: string;
  teacherId?: string;
};
type MockTestItem = {
  id: string;
  title: string;
  teacherId?: string;
  isCourseOnly?: boolean;
  courseId?: string;
};

const getEmbedUrl = (url: string | undefined): { type: 'youtube' | 'direct' | null; src: string | null } => {
  if (!url) return { type: null, src: null };
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      let videoId: string | null = null;

      if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.split('/').filter(Boolean)[0] || null;
      } else {
        videoId = urlObj.searchParams.get('v');
        if (!videoId) {
          const parts = urlObj.pathname.split('/').filter(Boolean);
          const markerIndex = parts.findIndex((part) => ['live', 'embed', 'shorts'].includes(part));
          if (markerIndex !== -1 && parts[markerIndex + 1]) {
            videoId = parts[markerIndex + 1];
          }
        }
      }

      if (videoId) return { type: 'youtube', src: `https://www.youtube.com/embed/${videoId}` };
    }
    if (url.match(/\.(mp4|webm|ogg)$/)) {
      return { type: 'direct', src: url };
    }
  } catch (error) {
    return { type: null, src: null };
  }
  return { type: null, src: null };
};

const SubscriptionPromptDialog = ({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
            <DialogHeader>
                 <div className="flex flex-col items-center justify-center text-center p-4">
                    <Lock className="w-16 h-16 text-amber-500 mb-4" />
                    <DialogTitle className="font-headline text-2xl font-semibold text-amber-600">Premium Content Locked</DialogTitle>
                    <DialogDescription className="text-amber-700/80 mt-2 max-w-md">
                        This content is not included in your current subscription. Please upgrade your plan to unlock it.
                    </DialogDescription>
                </div>
            </DialogHeader>
            <div className="flex justify-center">
                <Button asChild className="mt-4 bg-amber-500 hover:bg-amber-600 text-white">
                    <Link href="/subscription">View Subscription Plans</Link>
                </Button>
            </div>
        </DialogContent>
    </Dialog>
);


function ContentForm({ examTypes, classes, subjects, topics, onFormFinished, contentToEdit }: { examTypes: ExamType[], classes: Class[], subjects: Subject[], topics: Topic[], onFormFinished: () => void, contentToEdit?: Content | null }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!contentToEdit;

  const form = useForm<z.infer<typeof contentSchema>>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'video',
      videoUrl: '',
      fileUrl: '',
      pdfFile: null,
      examTypeId: '',
      classId: '',
      subjectId: '',
      topicId: '',
      difficultyLevel: QUESTION_DIFFICULTY,
      accessLevel: 'free',
    },
  });

  useEffect(() => {
    if (isEditMode && contentToEdit) {
      const topic = topics.find(t => t.id === contentToEdit.topicId);
      const subject = subjects.find(s => s.id === (topic?.subjectId || contentToEdit.subjectId));
      const classItem = classes.find(c => c.id === (subject?.classId || contentToEdit.classId));
      const examType = examTypes.find(et => et.id === (classItem?.examTypeId || contentToEdit.examTypeId));

      form.reset({
        ...contentToEdit,
        videoUrl: contentToEdit.videoUrl || '',
        fileUrl: contentToEdit.fileUrl || '',
        pdfFile: null,
        examTypeId: examType?.id || '',
        classId: classItem?.id || '',
        subjectId: subject?.id || '',
        difficultyLevel: QUESTION_DIFFICULTY,
      });
    }
  }, [isEditMode, contentToEdit, topics, subjects, classes, examTypes, form]);


  const contentType = form.watch('type');
  const selectedExamType = form.watch('examTypeId');
  const selectedClass = form.watch('classId');
  const selectedSubject = form.watch('subjectId');

  useEffect(() => { if (!isEditMode || form.getValues('examTypeId') !== selectedExamType) { form.setValue('classId', ''); form.setValue('subjectId', ''); form.setValue('topicId', ''); } }, [selectedExamType, form, isEditMode]);
  useEffect(() => { if (!isEditMode || form.getValues('classId') !== selectedClass) { form.setValue('subjectId', ''); form.setValue('topicId', ''); } }, [selectedClass, form, isEditMode]);
  useEffect(() => { if (!isEditMode || form.getValues('subjectId') !== selectedSubject) { form.setValue('topicId', ''); } }, [selectedSubject, form, isEditMode]);

  const filteredClasses = useMemo(() => { if (!selectedExamType) return []; return classes.filter(c => c.examTypeId === selectedExamType); }, [selectedExamType, classes]);
  const filteredSubjects = useMemo(() => { if (!selectedClass) return []; return subjects.filter(subject => subject.classId === selectedClass); }, [selectedClass, subjects]);
  const filteredTopics = useMemo(() => { if (!selectedSubject) return []; return topics.filter(topic => topic.subjectId === selectedSubject); }, [selectedSubject, topics]);

  const onSubmit = async (values: z.infer<typeof contentSchema>) => {
    setIsSubmitting(true);
    const dataToSave: { [key: string]: any } = { ...values };
    if (dataToSave.type === 'video') {
        dataToSave.fileUrl = '';
    } else {
        dataToSave.videoUrl = '';
    }
    delete dataToSave.pdfFile;

    try {
        if (isEditMode && contentToEdit) {
            const contentRef = doc(firestore, 'content', contentToEdit.id);
            dataToSave.teacherId = contentToEdit.teacherId;
            dataToSave.teacherName = contentToEdit.teacherName;
            if (dataToSave.type === 'pdf' && values.pdfFile instanceof File) {
              const uploadRef = ref(storage, `content_files/${dataToSave.teacherId}/${Date.now()}_${values.pdfFile.name}`);
              const snapshot = await uploadBytes(uploadRef, values.pdfFile);
              dataToSave.fileUrl = await getDownloadURL(snapshot.ref);
            } else if (dataToSave.type === 'pdf') {
              dataToSave.fileUrl = values.fileUrl || contentToEdit.fileUrl || '';
            }
            await updateDocumentNonBlocking(contentRef, dataToSave);
            toast({ title: 'Content Updated!', description: `${values.title} has been updated.` });
        } else {
            if (!user) {
              toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to add content.' });
              return;
            }
            if (dataToSave.type === 'pdf' && values.pdfFile instanceof File) {
              const uploadRef = ref(storage, `content_files/${user.uid}/${Date.now()}_${values.pdfFile.name}`);
              const snapshot = await uploadBytes(uploadRef, values.pdfFile);
              dataToSave.fileUrl = await getDownloadURL(snapshot.ref);
            }
            const contentRef = collection(firestore, 'content');
            await addDocumentNonBlocking(contentRef, {
              ...dataToSave,
              teacherId: user.uid,
              teacherName: user.displayName || 'Teacher',
            });
            toast({ title: 'Content Added!', description: `${values.title} has been added.` });
            form.reset();
        }
        onFormFinished();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto pr-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem className="space-y-3"><FormLabel>Content Type</FormLabel>
                    <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-row space-x-4">
                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="video" /></FormControl><FormLabel className="font-normal">Video</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="pdf" /></FormControl><FormLabel className="font-normal">PDF</FormLabel></FormItem>
                        </RadioGroup>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="accessLevel" render={({ field }) => (
                <FormItem className="space-y-3"><FormLabel>Access Level</FormLabel>
                    <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-row space-x-4">
                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="free" /></FormControl><FormLabel className="font-normal">Free</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="paid" /></FormControl><FormLabel className="font-normal">Paid</FormLabel></FormItem>
                        </RadioGroup>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
        </div>
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="e.g., Introduction to Kinematics" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Describe the key concepts covered." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        {contentType === 'video' && (
            <FormField control={form.control} name="videoUrl" render={({ field }) => (
                <FormItem><FormLabel>Video URL</FormLabel><FormControl><Input placeholder="https://www.youtube.com/watch?v=..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />
        )}
        {contentType === 'pdf' && (
            <>
              <FormField control={form.control} name="pdfFile" render={({ field }) => (
                <FormItem>
                  <FormLabel>Upload PDF</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => field.onChange(e.target.files?.[0] ?? null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="fileUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>PDF URL (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/notes.pdf" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="examTypeId" render={({ field }) => (
            <FormItem><FormLabel>Exam Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an exam type" /></SelectTrigger></FormControl><SelectContent>{examTypes.map(et => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
          )} />
           <FormField control={form.control} name="classId" render={({ field }) => (
            <FormItem><FormLabel>Class</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedExamType}><FormControl><SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger></FormControl><SelectContent>{filteredClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="subjectId" render={({ field }) => (
            <FormItem><FormLabel>Subject</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedClass}><FormControl><SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger></FormControl><SelectContent>{filteredSubjects.map(subject => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
          )} />
           <FormField control={form.control} name="topicId" render={({ field }) => (
            <FormItem><FormLabel>Topic</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedSubject}><FormControl><SelectTrigger><SelectValue placeholder="Select a topic" /></SelectTrigger></FormControl><SelectContent>{filteredTopics.map(topic => <SelectItem key={topic.id} value={topic.id}>{topic.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="difficultyLevel" render={({ field }) => (
            <FormItem><FormLabel>Difficulty</FormLabel><Select onValueChange={field.onChange} value={QUESTION_DIFFICULTY}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value={QUESTION_DIFFICULTY}>{QUESTION_DIFFICULTY_LABEL}</SelectItem></SelectContent></Select><FormMessage /></FormItem>
          )} />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> {isEditMode ? 'Saving...' : 'Adding...'}</> : <>{isEditMode ? 'Save Changes' : <><PlusCircle className="mr-2" /> Add Content</>}</>}
        </Button>
      </form>
    </Form>
  );
}

function ContentListItem({ contentItem, isUnlocked, canEdit, onEdit }: { contentItem: Content, isUnlocked: boolean, canEdit: boolean, onEdit: (item: Content) => void }) {
  const [showSubPrompt, setShowSubPrompt] = useState(false);
  const embed = getEmbedUrl(contentItem.videoUrl);
  const difficultyVariant = { Easy: 'default', Medium: 'secondary', Hard: 'destructive' } as const;
  
  const isLocked = !isUnlocked;

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(contentItem);
  };

  const itemContent = (
    <div className={cn("group flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-all hover:bg-muted/50", isLocked && "bg-muted/50 hover:bg-muted/50 cursor-not-allowed")}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {isLocked ? <Lock /> : contentItem.type === 'video' ? (embed?.type === 'youtube' ? <Youtube /> : <Film />) : <FileText />}
        </div>
        <div className="flex-1">
            <div className="flex justify-between items-start">
                <h3 className={cn("font-semibold", !isLocked && "group-hover:underline")}>{contentItem.title}</h3>
                 <div className="flex items-center gap-2">
                    {contentItem.accessLevel === 'free' ? <Badge variant="secondary">Free</Badge> : <Badge variant="destructive">Paid</Badge>}
                    {canEdit && (
                      <Button variant="ghost" size="icon" onClick={handleEditClick}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{contentItem.description}</p>
            <div className="mt-2 flex items-center gap-2">
                <Badge variant={difficultyVariant[contentItem.difficultyLevel] || 'default'}>{QUESTION_DIFFICULTY_LABEL}</Badge>
            </div>
        </div>
    </div>
  );

  if (isLocked) {
    return (
      <>
        <div onClick={() => setShowSubPrompt(true)}>
            {itemContent}
        </div>
        <SubscriptionPromptDialog open={showSubPrompt} onOpenChange={setShowSubPrompt} />
      </>
    )
  }

  if (contentItem.type === 'pdf') {
      return (
          <a href={contentItem.fileUrl} target="_blank" rel="noopener noreferrer">
              {itemContent}
          </a>
      )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {itemContent}
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{contentItem.title}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video">
          {embed?.type === 'youtube' && embed.src && <iframe src={embed.src} title={contentItem.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="h-full w-full rounded-lg" />}
          {embed?.type === 'direct' && embed.src && <video controls src={embed.src} className="h-full w-full rounded-lg bg-black" />}
          {!embed?.src && <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted text-destructive-foreground"><p>Invalid or unsupported video URL.</p></div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContentPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { isSubscribed, subscriptionPlan, isLoading: isSubscribedLoading } = useIsSubscribed();
  const [formKey, setFormKey] = useState(0);
  const [editingContent, setEditingContent] = useState<Content | null>(null);

  const examTypesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null, [firestore]);
  const classesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null, [firestore]);
  const subjectsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null, [firestore]);
  const topicsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'topics'), orderBy('name')) : null, [firestore]);
  const contentQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'content'), orderBy('title')) : null, [firestore]);
  const coursesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'courses'), orderBy('title')) : null, [firestore]);
  const mockTestsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'mock_tests'), orderBy('title')) : null, [firestore]);
  
  const { data: examTypes, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classes, isLoading: areClassesLoading } = useCollection<Class>(classesQuery);
  const { data: subjects, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: topics, isLoading: areTopicsLoading } = useCollection<Topic>(topicsQuery);
  const { data: content, isLoading: areContentLoading } = useCollection<Content>(contentQuery);
  const { data: courses, isLoading: areCoursesLoading } = useCollection<CourseItem>(coursesQuery);
  const { data: mockTests, isLoading: areMockTestsLoading } = useCollection<MockTestItem>(mockTestsQuery);

  const contentTree = useMemo(() => {
    if (!content || !topics || !subjects || !classes || !examTypes) return [];
    const teacherScoped =
      isTeacher && !isAdmin && user?.uid
        ? content.filter(item => item.teacherId === user.uid)
        : content;

    return examTypes.map(et => ({
      ...et,
      classes: classes.filter(c => c.examTypeId === et.id).map(c => ({
        ...c,
        subjects: subjects.filter(s => s.classId === c.id).map(s => ({
          ...s,
          topics: topics.filter(t => t.subjectId === s.id).map(t => ({
            ...t,
            items: teacherScoped.filter(item => item.topicId === t.id)
          })).filter(t => t.items.length > 0)
        })).filter(s => s.topics.length > 0)
      })).filter(c => c.subjects.length > 0)
    })).filter(et => et.classes.length > 0);
  }, [content, topics, subjects, classes, examTypes, isTeacher, isAdmin, user?.uid]);

  const teacherCourses = useMemo(() => {
    if (!isTeacher || isAdmin || !user?.uid || !courses) return [];
    return courses.filter((course) => course.teacherId === user.uid);
  }, [courses, isTeacher, isAdmin, user?.uid]);

  const teacherMockTests = useMemo(() => {
    if (!isTeacher || isAdmin || !user?.uid || !mockTests) return [];
    return mockTests.filter((test) => test.teacherId === user.uid && isStandaloneMockTest(test));
  }, [mockTests, isTeacher, isAdmin, user?.uid]);
  
  const isLoading = isTeacherLoading || isAdminLoading || areExamTypesLoading || areClassesLoading || areSubjectsLoading || areTopicsLoading || areContentLoading || areCoursesLoading || areMockTestsLoading || isSubscribedLoading;
  const canEdit = isTeacher || isAdmin;
  const canEditItem = (item: Content): boolean => {
    if (isAdmin) return true;
    if (!isTeacher || !user?.uid) return false;
    return item.teacherId === user.uid;
  };
  
  const canAccess = (item: Content): boolean => {
    if (item.accessLevel === 'free') return true;
    if (canEdit) return true; // Teachers/Admins have full access
    if (!isSubscribed || !subscriptionPlan) return false;

    // The plan must at least match the exam type.
    if (subscriptionPlan.examTypeId !== item.examTypeId) {
        return false;
    }

    // If plan is scoped to a specific topic, it's the most granular check.
    if (subscriptionPlan.topicId) {
        // A topic-specific plan requires the content to be in that exact topic.
        return subscriptionPlan.topicId === item.topicId;
    }

    // If plan is scoped to specific subjects (within a class).
    if (subscriptionPlan.subjectIds && subscriptionPlan.subjectIds.length > 0) {
        // It must be within the plan's class AND one of the plan's subjects.
        return subscriptionPlan.classId === item.classId && 
               subscriptionPlan.subjectIds.includes(item.subjectId);
    }

    // If plan is scoped to a specific class.
    if (subscriptionPlan.classId) {
        // It grants access to all content within that class.
        return subscriptionPlan.classId === item.classId;
    }

    // If none of the more specific scopes are on the plan, and we've reached here,
    // it means the plan covers the entire exam type. Access is granted.
    return true;
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Your Content" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 grid gap-8">
        {isTeacher && !isAdmin && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="font-headline text-2xl">Your Courses</CardTitle>
                <CardDescription>Courses created by you.</CardDescription>
              </CardHeader>
              <CardContent>
                {teacherCourses.length > 0 ? (
                  <div className="space-y-2">
                    {teacherCourses.map((course) => (
                      <Link key={course.id} href={`/courses/${course.id}`} className="block rounded-md border p-3 text-sm hover:bg-muted/50">
                        {course.title}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No courses created yet.</p>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="font-headline text-2xl">Your Mock Tests</CardTitle>
                <CardDescription>Mock tests created by you.</CardDescription>
              </CardHeader>
              <CardContent>
                {teacherMockTests.length > 0 ? (
                  <div className="space-y-2">
                    {teacherMockTests.map((test) => (
                      <Link key={test.id} href="/mock-tests" className="block rounded-md border p-3 text-sm hover:bg-muted/50">
                        {test.title}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No mock tests created yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
