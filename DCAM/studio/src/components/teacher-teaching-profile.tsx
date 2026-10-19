'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser, updateDocumentNonBlocking } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, PlusCircle, Trash2 } from 'lucide-react';

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string; examTypeId: string };
type Subject = { id: string; name: string; classId: string };

type TeachingAssignment = {
  examTypeId: string;
  classId: string;
  allSubjects: boolean;
  subjectIds: string[];
};

type UserProfile = {
  teachingAssignments?: TeachingAssignment[];
  teachesExamTypeIds?: string[];
  teachesClassIds?: string[];
  teachesSubjectIds?: string[];
  teachingSummary?: string;
};

const assignmentSchema = z
  .object({
    examTypeId: z.string().min(1, 'Select an exam.'),
    classId: z.string().min(1, 'Select a curriculum/class.'),
    allSubjects: z.boolean(),
    subjectIds: z.array(z.string()),
  })
  .superRefine((value, ctx) => {
    if (!value.allSubjects && value.subjectIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one subject or choose "all subjects".',
        path: ['subjectIds'],
      });
    }
  });

const teachingProfileSchema = z.object({
  teachingAssignments: z.array(assignmentSchema).min(1, 'Add at least one curriculum assignment.'),
  teachingSummary: z.string().max(240, 'Summary can be up to 240 characters.').optional(),
});

function getClassSubjects(subjects: Subject[], classId: string): Subject[] {
  return subjects.filter((subject) => subject.classId === classId);
}

export default function TeacherTeachingProfile() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const didHydrateRef = useRef(false);
  const lastSavedPayloadRef = useRef('');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfile>(userDocRef);

  const examTypesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null),
    [firestore]
  );
  const classesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null),
    [firestore]
  );
  const subjectsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null),
    [firestore]
  );

  const { data: examTypes, isLoading: areExamTypesLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classes, isLoading: areClassesLoading } = useCollection<ClassItem>(classesQuery);
  const { data: subjects, isLoading: areSubjectsLoading } = useCollection<Subject>(subjectsQuery);

  const form = useForm<z.infer<typeof teachingProfileSchema>>({
    resolver: zodResolver(teachingProfileSchema),
    defaultValues: {
      teachingAssignments: [{ examTypeId: '', classId: '', allSubjects: true, subjectIds: [] }],
      teachingSummary: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'teachingAssignments',
  });
  const watchedProfile = useWatch({ control: form.control });

  const normalizeProfilePayload = useCallback((values: z.infer<typeof teachingProfileSchema>) => {
    if (!subjects) return null;

    const normalizedAssignments = values.teachingAssignments.map((assignment) => {
      const classSubjects = getClassSubjects(subjects, assignment.classId);
      const normalizedSubjectIds = assignment.allSubjects
        ? classSubjects.map((subject) => subject.id)
        : assignment.subjectIds.filter((id) => classSubjects.some((subject) => subject.id === id));

      return {
        examTypeId: assignment.examTypeId,
        classId: assignment.classId,
        allSubjects: assignment.allSubjects,
        subjectIds: normalizedSubjectIds,
      };
    });

    const allExamTypeIds = Array.from(new Set(normalizedAssignments.map((a) => a.examTypeId)));
    const allClassIds = Array.from(new Set(normalizedAssignments.map((a) => a.classId)));
    const allSubjectIds = Array.from(new Set(normalizedAssignments.flatMap((a) => a.subjectIds)));

    return {
      teachingAssignments: normalizedAssignments,
      teachesExamTypeIds: allExamTypeIds,
      teachesClassIds: allClassIds,
      teachesSubjectIds: allSubjectIds,
      teachingSummary: values.teachingSummary || '',
    };
  }, [subjects]);

  const persistTeachingProfile = useCallback(async (
    values: unknown,
    options?: { silent?: boolean; auto?: boolean }
  ) => {
    if (!userDocRef) return;
    const parsed = teachingProfileSchema.safeParse(values);
    if (!parsed.success) return;

    const payload = normalizeProfilePayload(parsed.data);
    if (!payload) return;

    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedPayloadRef.current) return;

    if (options?.auto) {
      setIsAutoSaving(true);
    } else {
      setIsSubmitting(true);
    }

    try {
      await updateDocumentNonBlocking(userDocRef, payload);
      lastSavedPayloadRef.current = serialized;
      if (!options?.silent) {
        toast({
          title: 'Teaching profile updated',
          description: 'These options are now permanently saved and used in Question Bank and Mock Tests.',
        });
      }
    } catch (error: any) {
      if (!options?.silent) {
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: error.message || 'Could not save teaching profile.',
        });
      }
    } finally {
      if (options?.auto) {
        setIsAutoSaving(false);
      } else {
        setIsSubmitting(false);
      }
    }
  }, [normalizeProfilePayload, toast, userDocRef]);

  useEffect(() => {
    if (!userProfile) return;
    const legacyAssignments: TeachingAssignment[] =
      userProfile.teachesClassIds && userProfile.teachesClassIds.length > 0
        ? userProfile.teachesClassIds.map((classId, index) => ({
            classId,
            examTypeId: userProfile.teachesExamTypeIds?.[index] || userProfile.teachesExamTypeIds?.[0] || '',
            allSubjects: !(userProfile.teachesSubjectIds && userProfile.teachesSubjectIds.length > 0),
            subjectIds: userProfile.teachesSubjectIds || [],
          }))
        : [];

    const assignments =
      userProfile.teachingAssignments && userProfile.teachingAssignments.length > 0
        ? userProfile.teachingAssignments
        : legacyAssignments.length > 0
          ? legacyAssignments
          : [{ examTypeId: '', classId: '', allSubjects: true, subjectIds: [] }];

    form.reset({
      teachingAssignments: assignments,
      teachingSummary: userProfile.teachingSummary || '',
    });
    const initialPayload = normalizeProfilePayload({
      teachingAssignments: assignments,
      teachingSummary: userProfile.teachingSummary || '',
    });
    if (initialPayload) {
      lastSavedPayloadRef.current = JSON.stringify(initialPayload);
    }
    didHydrateRef.current = true;
  }, [form, userProfile]);

  const isLoading = isUserProfileLoading || areExamTypesLoading || areClassesLoading || areSubjectsLoading;

  useEffect(() => {
    if (!didHydrateRef.current || isLoading || !watchedProfile) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      persistTeachingProfile(watchedProfile, { silent: true, auto: true });
    }, 700);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [watchedProfile, isLoading, persistTeachingProfile]);

  async function onSubmit(values: z.infer<typeof teachingProfileSchema>) {
    await persistTeachingProfile(values);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teaching Profile</CardTitle>
        <CardDescription>
          Add one or more curricula. For each curriculum, teach all subjects or selected subjects.
        </CardDescription>
        <p className="text-sm text-muted-foreground">
          Changes are auto-saved. You can also use the manual save button below anytime.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const selectedExam = form.watch(`teachingAssignments.${index}.examTypeId`);
                  const selectedClass = form.watch(`teachingAssignments.${index}.classId`);
                  const isAllSubjects = form.watch(`teachingAssignments.${index}.allSubjects`);

                  const filteredClasses = (classes || []).filter((classItem) => classItem.examTypeId === selectedExam);
                  const filteredSubjects = (subjects || []).filter((subject) => subject.classId === selectedClass);

                  return (
                    <div key={field.id} className="rounded-lg border p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`teachingAssignments.${index}.examTypeId`}
                          render={({ field: examField }) => (
                            <FormItem>
                              <FormLabel>Exam</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                  examField.onChange(value);
                                  form.setValue(`teachingAssignments.${index}.classId`, '');
                                  form.setValue(`teachingAssignments.${index}.subjectIds`, []);
                                }}
                                value={examField.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select exam" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {(examTypes || []).map((examType) => (
                                    <SelectItem key={examType.id} value={examType.id}>
                                      {examType.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`teachingAssignments.${index}.classId`}
                          render={({ field: classField }) => (
                            <FormItem>
                              <FormLabel>Curriculum/Class</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                  classField.onChange(value);
                                  form.setValue(`teachingAssignments.${index}.subjectIds`, []);
                                }}
                                value={classField.value}
                                disabled={!selectedExam}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select curriculum" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {filteredClasses.map((classItem) => (
                                    <SelectItem key={classItem.id} value={classItem.id}>
                                      {classItem.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`teachingAssignments.${index}.allSubjects`}
                        render={({ field: allField }) => (
                          <FormItem className="flex flex-row items-center gap-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={allField.value}
                                onCheckedChange={(checked) => {
                                  const next = !!checked;
                                  allField.onChange(next);
                                  if (next) {
                                    form.setValue(`teachingAssignments.${index}.subjectIds`, []);
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">Teach all subjects in this curriculum</FormLabel>
                          </FormItem>
                        )}
                      />

                      {!isAllSubjects ? (
                        <FormField
                          control={form.control}
                          name={`teachingAssignments.${index}.subjectIds`}
                          render={({ field: subjectField }) => (
                            <FormItem>
                              <FormLabel>Selected Subjects</FormLabel>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md border p-3">
                                {selectedClass && filteredSubjects.length > 0 ? (
                                  filteredSubjects.map((subject) => (
                                    <label key={subject.id} className="flex items-center gap-2 text-sm">
                                      <Checkbox
                                        checked={subjectField.value?.includes(subject.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            subjectField.onChange([...(subjectField.value || []), subject.id]);
                                          } else {
                                            subjectField.onChange((subjectField.value || []).filter((id) => id !== subject.id));
                                          }
                                        }}
                                      />
                                      <span>{subject.name}</span>
                                    </label>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground">Select exam and curriculum first.</p>
                                )}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : null}

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ examTypeId: '', classId: '', allSubjects: true, subjectIds: [] })}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Another Curriculum
                </Button>
              </div>

              <FormField
                control={form.control}
                name="teachingSummary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Teaching Summary (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Example: I teach JEE Physics and Math with test-oriented strategy."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-3">
                {isAutoSaving ? <p className="text-sm text-muted-foreground">Auto-saving changes...</p> : null}
                <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Now (Manual)
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
