

'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import DashboardHeader from '@/components/dashboard-header';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, useUser } from '@/firebase';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useState, useMemo, useEffect } from 'react';
import { LoaderCircle, X, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

type PracticeQuestion = { id: string; classId: string; subjectId: string; examTypeId: string; accessLevel: 'free' | 'paid', tags?: string[]; examLevel?: 'weak' | 'medium' | 'strong'; teacherId?: string; };
type ExamType = { id: string; name: string; };
type ClassItem = { id: string; name: string; examTypeId: string };
type Subject = { id: string; name: string; classId: string };

const subjectConfigSchema = z.object({
  subjectId: z.string(),
  subjectName: z.string(),
  numQuestions: z.coerce.number().min(1, "Must be > 0"),
});

const formSchema = z.object({
  title: z.string().min(5, 'Test title must be at least 5 characters long.'),
  startTime: z.coerce.date().refine((date) => date > new Date(), { message: 'Start time must be in the future.' }),
  accessLevel: z.enum(['free', 'paid']),
  duration: z.coerce.number().min(1, 'Duration must be at least 1 minute.'),
  marksPerQuestion: z.coerce.number().min(0, 'Marks cannot be negative.'),
  negativeMarksPerQuestion: z.coerce.number().min(0, 'Negative marks cannot be negative.'),
  examTypeId: z.string().min(1, 'Please select an exam type.'),
  classId: z.string().min(1, 'Please select a curriculum/class.'),
  examLevel: z.enum(['All', 'weak', 'medium', 'strong']),
  officialTag: z.string().min(1, 'Please provide a tag to filter questions.'),
  subjectConfigs: z.array(subjectConfigSchema).min(1, 'Please select at least one subject configuration.'),
});


export default function CreateOfficialTestPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      accessLevel: 'free',
      duration: 180,
      marksPerQuestion: 4,
      negativeMarksPerQuestion: 1,
      examTypeId: '',
      classId: '',
      examLevel: 'All',
      officialTag: 'official-test',
      subjectConfigs: [],
    },
  });

  const { control, watch } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "subjectConfigs"
  });

  const selectedExamTypeId = watch('examTypeId');
  const selectedClassId = watch('classId');
  const officialTag = watch('officialTag');

  const classesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null, [firestore]);
  const subjectsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null, [firestore]);
  const questionsQuery = useMemoFirebase(() => {
      if (!firestore || !officialTag) return null;
      return query(
          collection(firestore, 'practice_questions'),
          where('tags', 'array-contains', officialTag)
      );
  }, [firestore, officialTag]);
  const examTypesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null, [firestore]);
  
  const { data: allClasses, isLoading: areClassesLoading } = useCollection<ClassItem>(classesQuery);
  const { data: allSubjects, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: officialQuestions, isLoading: areQuestionsLoading } = useCollection<PracticeQuestion>(questionsQuery);
  const { data: examTypes, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);


  useEffect(() => {
    form.setValue('classId', '');
    remove();
  }, [selectedExamTypeId, remove, form]);

  useEffect(() => {
    remove();
  }, [selectedClassId, remove]);

  const filteredClasses = useMemo(() => {
    if (!selectedExamTypeId) return [];
    return (allClasses || []).filter((item) => item.examTypeId === selectedExamTypeId);
  }, [allClasses, selectedExamTypeId]);

  const filteredSubjects = useMemo(() => {
    if (!selectedClassId) return [];
    return (allSubjects || []).filter((item) => item.classId === selectedClassId);
  }, [allSubjects, selectedClassId]);
  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    
    let finalQuestionIds: string[] = [];
    let questionSelectionError = false;

    const availableQuestions = (officialQuestions || []).filter(q => {
        if (q.examTypeId !== values.examTypeId || q.accessLevel !== values.accessLevel) return false;
        if (q.classId !== values.classId) return false;
        if (values.examLevel !== 'All' && q.examLevel !== values.examLevel) return false;
        if (isTeacher && !isAdmin && q.teacherId !== user?.uid) return false;
        return true;
    });

    for (const config of values.subjectConfigs) {
        const subjectQuestions = availableQuestions.filter(q => q.subjectId === config.subjectId);
        
        if (subjectQuestions.length < config.numQuestions) {
            toast({
                variant: 'destructive',
                title: 'Not Enough Questions',
                description: `Subject "${config.subjectName}" only has ${subjectQuestions.length} official questions for the selected filters, but you requested ${config.numQuestions}.`,
            });
            questionSelectionError = true;
            break; 
        }

        const shuffled = [...subjectQuestions].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, config.numQuestions);
        finalQuestionIds.push(...selected.map(q => q.id));
    }

    if (questionSelectionError) {
        setIsSubmitting(false);
        return;
    }

    const totalQuestions = values.subjectConfigs.reduce((acc, curr) => acc + curr.numQuestions, 0);

    if (finalQuestionIds.length !== totalQuestions) {
        toast({ variant: 'destructive', title: 'Question Selection Error', description: 'Could not gather the correct number of questions. Please check your configuration.' });
        setIsSubmitting(false);
        return;
    }
    
    try {
      const mockTestsRef = collection(firestore, 'mock_tests');
      
      await addDocumentNonBlocking(mockTestsRef, {
          title: values.title,
          startTime: values.startTime,
          examTypeId: values.examTypeId,
          classId: values.classId,
          teacherId: user?.uid || '',
          accessLevel: values.accessLevel,
          config: {
              questionIds: finalQuestionIds,
              duration: values.duration,
              totalQuestions: totalQuestions,
              marksPerQuestion: values.marksPerQuestion,
              negativeMarksPerQuestion: values.negativeMarksPerQuestion,
              subjectConfigs: values.subjectConfigs.map(({ subjectId, numQuestions }) => ({ subjectId, numQuestions })),
          },
      });
      
      toast({
        title: 'Official Test Created!',
        description: `"${values.title}" has been scheduled with ${totalQuestions} questions.`,
      });
      router.push('/mock-tests');
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Submission Failed',
            description: error.message || 'An unexpected error occurred.',
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  const isLoading = isTeacherLoading || isAdminLoading || areClassesLoading || areSubjectsLoading || areQuestionsLoading || areExamTypesLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Create Official Mock Test" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8"><Skeleton className="h-96 w-full" /></main>
      </div>
    );
  }

  if (!isTeacher && !isAdmin) {
    return (
        <div className="flex flex-col h-full">
            <DashboardHeader title="Access Denied" />
            <main className="flex-1 flex items-center justify-center p-4">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2 text-destructive"><AlertTriangle/> Access Denied</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>You do not have permission to create official mock tests. Please contact an administrator.</p>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Create Official Mock Test" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Official Test Configuration</CardTitle>
              <CardDescription>
                Build an official mock test using curated questions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  {/* Basic Info */}
                  <div className="space-y-4">
                      <FormField control={form.control} name="title" render={({ field }) => (
                          <FormItem><FormLabel className="text-lg font-semibold">Test Title</FormLabel><FormControl><Input placeholder="e.g., JEE Main 2024 - Full Syllabus Test 1" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           <FormField control={form.control} name="startTime" render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel className="font-semibold">Start Date & Time</FormLabel><FormControl>
                                    <Input type="datetime-local" value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ''} onChange={(e) => field.onChange(new Date(e.target.value))} min={format(new Date(), "yyyy-MM-dd'T'HH:mm")} />
                                </FormControl><FormMessage /></FormItem>
                           )} />
                           <FormField control={form.control} name="examTypeId" render={({ field }) => (
                                <FormItem><FormLabel className="font-semibold">Exam Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Exam Type" /></SelectTrigger></FormControl><SelectContent>{(examTypes || []).map(et => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                           )} />
                           <FormField control={form.control} name="classId" render={({ field }) => (
                                <FormItem><FormLabel className="font-semibold">Curriculum/Class</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedExamTypeId}><FormControl><SelectTrigger><SelectValue placeholder="Select curriculum/class" /></SelectTrigger></FormControl><SelectContent>{filteredClasses.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                           )} />
                           <FormField control={form.control} name="examLevel" render={({ field }) => (
                                <FormItem><FormLabel className="font-semibold">Exam Level</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="weak">Weak</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="strong">Strong</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                           )} />
                       </div>
                       <FormField control={form.control} name="officialTag" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-semibold">Official Question Tag</FormLabel>
                                <FormDescription>Enter the tag used to identify questions for this test.</FormDescription>
                                <FormControl><Input placeholder="e.g., official-test" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                  </div>

                  {/* Scoring and Duration */}
                  <div className="space-y-4 rounded-lg border p-4">
                      <h3 className="text-lg font-semibold">Scoring & Duration</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <FormField control={form.control} name="duration" render={({ field }) => (
                              <FormItem><FormLabel>Duration (minutes)</FormLabel><FormControl><Input type="number" placeholder="e.g., 180" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="marksPerQuestion" render={({ field }) => (
                              <FormItem><FormLabel>Marks per Question</FormLabel><FormControl><Input type="number" placeholder="e.g., 4" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="negativeMarksPerQuestion" render={({ field }) => (
                              <FormItem><FormLabel>Negative Marks</FormLabel><FormControl><Input type="number" placeholder="e.g., 1" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="accessLevel" render={({ field }) => (
                            <FormItem className="col-span-full"><FormLabel>Access Level</FormLabel><FormControl>
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="free" /></FormControl><FormLabel className="font-normal">Free</FormLabel></FormItem>
                                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="paid" /></FormControl><FormLabel className="font-normal">Paid</FormLabel></FormItem>
                                </RadioGroup>
                            </FormControl></FormItem>
                        )} />
                      </div>
                  </div>

                  {/* Subject Configuration */}
                  <div className="space-y-4">
                      <FormLabel className="text-lg font-semibold">Test Structure</FormLabel>
                      <FormDescription>Add subjects and specify the number of questions for each.</FormDescription>
                       {fields.map((field, index) => (
                           <div key={field.id} className="flex items-end gap-2 p-2 border rounded-md">
                               <FormField control={form.control} name={`subjectConfigs.${index}.subjectId`} render={({ field }) => (
                                    <FormItem className="flex-1"><FormLabel>Subject</FormLabel><Select onValueChange={(value) => {
                                        field.onChange(value);
                                        const subjectName = allSubjects?.find(s => s.id === value)?.name || '';
                                        form.setValue(`subjectConfigs.${index}.subjectName`, subjectName);
                                    }} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger></FormControl>
                                    <SelectContent>{filteredSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                                )} />
                               <FormField control={form.control} name={`subjectConfigs.${index}.numQuestions`} render={({ field }) => (
                                    <FormItem className="w-48"><FormLabel>No. of Questions</FormLabel><FormControl><Input type="number" placeholder="e.g., 25" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><X className="h-4 w-4" /></Button>
                           </div>
                       ))}
                       <Button type="button" variant="outline" onClick={() => append({ subjectId: '', subjectName: '', numQuestions: 25 })}>
                           Add Subject Section
                       </Button>
                       <FormField control={form.control} name="subjectConfigs" render={() => <FormItem><FormMessage /></FormItem>} />
                  </div>
                  
                  <Button type="submit" disabled={isSubmitting} size="lg">
                    {isSubmitting ? (
                      <><LoaderCircle className="mr-2 animate-spin" /> Creating Test...</>
                    ) : (
                      'Create Official Test'
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
