'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { BookOpenCheck, GraduationCap, LoaderCircle, Search, ShieldCheck, Trash2, Users } from 'lucide-react';
import DashboardHeader from '@/components/dashboard-header';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useToast } from '@/hooks/use-toast';
import { buildAdminAssignedCoursePayload, isCourseAssignableForStudentAccess } from '@/lib/course-assignment';

type UserProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  roleId?: 'student' | 'teacher' | 'admin';
  status?: 'active' | 'blocked';
};

type CourseDoc = {
  id: string;
  title?: string;
  teacherId?: string;
  examTypeId?: string;
  classId?: string;
  subjectIds?: string[];
  publicationStatus?: 'draft' | 'published' | 'deleted' | string;
  accessLevel?: 'free' | 'paid' | string;
  subscriptionAttached?: boolean | null;
  updatedAt?: unknown;
  createdAt?: unknown;
};

type SubjectDoc = {
  id: string;
  name?: string;
};

type ClassDoc = {
  id: string;
  name?: string;
};

type ExamTypeDoc = {
  id: string;
  name?: string;
};

type PurchasedCourseDoc = {
  id: string;
  courseId?: string;
  teacherId?: string;
  assignedAt?: unknown;
  purchasedAt?: unknown;
  assignedByAdminEmail?: string;
};

type RemoveTarget = {
  id: string;
  title: string;
};

function displayName(user?: UserProfile | null) {
  if (!user) return 'Unnamed Student';
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.email || 'Unnamed Student';
}

function toDateSafe(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    try {
      const parsed = (value as { toDate: () => Date }).toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function formatDateTime(value: unknown) {
  const parsed = toDateSafe(value);
  if (!parsed) return 'Not recorded';
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function normalizeText(value: string | undefined | null) {
  return (value || '').trim().toLowerCase();
}

export default function AdminCourseManagementPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { toast } = useToast();

  const [studentSearch, setStudentSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('all');
  const [accessFilter, setAccessFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [isMutatingKey, setIsMutatingKey] = useState('');
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);

  const usersRef = useMemoFirebase(() => (firestore && isAdmin ? collection(firestore, 'users') : null), [firestore, isAdmin]);
  const coursesRef = useMemoFirebase(() => (firestore && isAdmin ? collection(firestore, 'courses') : null), [firestore, isAdmin]);
  const subjectsRef = useMemoFirebase(() => (firestore && isAdmin ? collection(firestore, 'subjects') : null), [firestore, isAdmin]);
  const classesRef = useMemoFirebase(() => (firestore && isAdmin ? collection(firestore, 'classes') : null), [firestore, isAdmin]);
  const examTypesRef = useMemoFirebase(() => (firestore && isAdmin ? collection(firestore, 'exam_types') : null), [firestore, isAdmin]);
  const purchasedCoursesRef = useMemoFirebase(
    () => (firestore && isAdmin && selectedStudentId ? collection(firestore, 'users', selectedStudentId, 'purchased_courses') : null),
    [firestore, isAdmin, selectedStudentId]
  );

  const { data: usersData, isLoading: isUsersLoading } = useCollection<UserProfile>(usersRef);
  const { data: coursesData, isLoading: isCoursesLoading } = useCollection<CourseDoc>(coursesRef);
  const { data: subjectsData } = useCollection<SubjectDoc>(subjectsRef);
  const { data: classesData } = useCollection<ClassDoc>(classesRef);
  const { data: examTypesData } = useCollection<ExamTypeDoc>(examTypesRef);
  const { data: purchasedCoursesData, isLoading: isPurchasedCoursesLoading } = useCollection<PurchasedCourseDoc>(purchasedCoursesRef);

  const users = usersData || [];
  const courses = coursesData || [];
  const subjects = subjectsData || [];
  const classes = classesData || [];
  const examTypes = examTypesData || [];
  const purchasedCourses = purchasedCoursesData || [];

  const subjectNameById = useMemo(
    () => Object.fromEntries(subjects.map((item) => [item.id, item.name || 'Unnamed Subject'])),
    [subjects]
  );
  const classNameById = useMemo(
    () => Object.fromEntries(classes.map((item) => [item.id, item.name || 'Unnamed Class'])),
    [classes]
  );
  const examNameById = useMemo(
    () => Object.fromEntries(examTypes.map((item) => [item.id, item.name || 'Unnamed Exam'])),
    [examTypes]
  );
  const userNameById = useMemo(
    () => Object.fromEntries(users.map((item) => [item.id, displayName(item)])),
    [users]
  );
  const coursesById = useMemo(() => Object.fromEntries(courses.map((item) => [item.id, item])), [courses]);

  const students = useMemo(
    () => users.filter((item) => item.roleId === 'student').sort((left, right) => displayName(left).localeCompare(displayName(right))),
    [users]
  );
  const teachers = useMemo(
    () => users.filter((item) => item.roleId === 'teacher' || item.roleId === 'admin').sort((left, right) => displayName(left).localeCompare(displayName(right))),
    [users]
  );

  const filteredStudents = useMemo(() => {
    const needle = normalizeText(studentSearch);
    if (!needle) return students;

    return students.filter((student) => {
      const haystack = [displayName(student), student.email, student.phoneNumber].map(normalizeText).join(' ');
      return haystack.includes(needle);
    });
  }, [studentSearch, students]);

  useEffect(() => {
    if (filteredStudents.length === 0) {
      if (selectedStudentId) setSelectedStudentId('');
      return;
    }

    const stillVisible = filteredStudents.some((student) => student.id === selectedStudentId);
    if (!stillVisible) {
      setSelectedStudentId(filteredStudents[0]?.id || '');
    }
  }, [filteredStudents, selectedStudentId]);

  const selectedStudent = useMemo(
    () => students.find((item) => item.id === selectedStudentId) || null,
    [selectedStudentId, students]
  );

  const assignedCourseIds = useMemo(
    () => new Set(purchasedCourses.map((item) => item.courseId || item.id).filter((value): value is string => Boolean(value))),
    [purchasedCourses]
  );

  const assignedCourseRows = useMemo(() => {
    return purchasedCourses
      .map((item) => {
        const courseId = item.courseId || item.id;
        const course = courseId ? coursesById[courseId] : undefined;
        const subjectNames = (course?.subjectIds || [])
          .map((subjectId) => subjectNameById[subjectId])
          .filter(Boolean);

        return {
          purchaseDocId: item.id,
          title: course?.title || 'Untitled Course',
          teacherName: userNameById[course?.teacherId || item.teacherId || ''] || 'Unknown teacher',
          accessLevel: normalizeText(course?.accessLevel) === 'paid' ? 'paid' : 'free',
          subjectNames,
          examName: course?.examTypeId ? examNameById[course.examTypeId] || 'Unassigned Exam' : 'Unassigned Exam',
          className: course?.classId ? classNameById[course.classId] || 'Unassigned Class' : 'Unassigned Class',
          assignedAt: item.assignedAt || item.purchasedAt,
          assignedByAdminEmail: item.assignedByAdminEmail || '',
        };
      })
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [classNameById, coursesById, examNameById, purchasedCourses, subjectNameById, userNameById]);

  const readyCourses = useMemo(() => courses.filter((course) => isCourseAssignableForStudentAccess(course)), [courses]);
  const readyPremiumCourseCount = useMemo(
    () => readyCourses.filter((course) => normalizeText(course.accessLevel) === 'paid').length,
    [readyCourses]
  );

  const availableCourses = useMemo(() => {
    const needle = normalizeText(courseSearch);

    return readyCourses
      .filter((course) => !assignedCourseIds.has(course.id))
      .filter((course) => selectedTeacherId === 'all' || course.teacherId === selectedTeacherId)
      .filter((course) => accessFilter === 'all' || normalizeText(course.accessLevel) === accessFilter)
      .filter((course) => {
        if (!needle) return true;
        const subjectNames = (course.subjectIds || []).map((subjectId) => subjectNameById[subjectId]).filter(Boolean).join(' ');
        const haystack = [
          course.title,
          userNameById[course.teacherId || ''],
          course.accessLevel,
          classNameById[course.classId || ''],
          examNameById[course.examTypeId || ''],
          subjectNames,
        ]
          .map(normalizeText)
          .join(' ');

        return haystack.includes(needle);
      })
      .sort((left, right) => (left.title || 'Untitled Course').localeCompare(right.title || 'Untitled Course'));
  }, [accessFilter, assignedCourseIds, classNameById, courseSearch, examNameById, readyCourses, selectedTeacherId, subjectNameById, userNameById]);

  async function handleAssignCourse(course: CourseDoc) {
    if (!firestore || !selectedStudentId) return;

    const mutationKey = `assign:${course.id}`;
    setIsMutatingKey(mutationKey);

    try {
      await setDoc(
        doc(firestore, 'users', selectedStudentId, 'purchased_courses', course.id),
        buildAdminAssignedCoursePayload({
          courseId: course.id,
          teacherId: course.teacherId || null,
          adminUserId: user?.uid || null,
          adminUserEmail: user?.email || null,
        }),
        { merge: true }
      );

      toast({
        title: 'Course assigned',
        description: `${course.title || 'This course'} is now available in ${displayName(selectedStudent)}'s My Learning.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Assignment failed',
        description: error?.message || 'Could not assign this course right now.',
      });
    } finally {
      setIsMutatingKey('');
    }
  }

  async function handleRemoveAssignedCourse() {
    if (!firestore || !selectedStudentId || !removeTarget) return;

    setIsMutatingKey(`remove:${removeTarget.id}`);

    try {
      await deleteDoc(doc(firestore, 'users', selectedStudentId, 'purchased_courses', removeTarget.id));
      toast({
        title: 'Course removed',
        description: `${removeTarget.title} was removed from ${displayName(selectedStudent)}'s assigned courses.`,
      });
      setRemoveTarget(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Remove failed',
        description: error?.message || 'Could not remove this course right now.',
      });
    } finally {
      setIsMutatingKey('');
    }
  }

  const loading = isAdminLoading || (isAdmin && ((isUsersLoading && users.length === 0) || (isCoursesLoading && courses.length === 0)));

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Course Management" />
        <main className="flex-1 space-y-6 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Skeleton className="h-40 w-full" />
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <Skeleton className="h-[42rem] w-full" />
            <Skeleton className="h-[42rem] w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title="Course Management" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">Only admins can manage student course assignments.</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Course Management" />
      <main className="flex-1 space-y-6 overflow-y-auto p-4 md:p-6 lg:p-8">
        <Card className="overflow-hidden border-border/70 bg-gradient-to-r from-primary/10 via-background to-background">
          <CardHeader className="gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-3xl">Admin Course Management</CardTitle>
                  <CardDescription className="mt-2 max-w-3xl text-base">
                    Assign free courses and ready premium courses directly to any student. Each assignment is saved to the same learning-access collection used by My Learning and course access.
                  </CardDescription>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                Premium courses appear here only after subscription access is attached, so students receive the same usable access they would after a real purchase flow.
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 border-t border-border/60 pt-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Students</p>
              <p className="mt-2 text-3xl font-semibold">{students.length}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Ready Courses</p>
              <p className="mt-2 text-3xl font-semibold">{readyCourses.length}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Premium Ready</p>
              <p className="mt-2 text-3xl font-semibold">{readyPremiumCourseCount}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Assigned To Student</p>
              <p className="mt-2 text-3xl font-semibold">{selectedStudent ? assignedCourseRows.length : 0}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-5 w-5 text-primary" />
                Select Student
              </CardTitle>
              <CardDescription>Choose a student first. Course assignments will be added to that student&apos;s learning access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Search by name, email, or phone"
                  className="pl-9"
                />
              </div>

              <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-1">
                {filteredStudents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                    No students matched your search.
                  </div>
                ) : (
                  filteredStudents.map((student) => {
                    const isSelected = student.id === selectedStudentId;
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => setSelectedStudentId(student.id)}
                        className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                          isSelected
                            ? 'border-primary/40 bg-primary/10 shadow-sm'
                            : 'border-border/60 bg-background hover:border-primary/25 hover:bg-muted/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{displayName(student)}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{student.email || 'No email'}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{student.phoneNumber || 'No phone number'}</p>
                          </div>
                          <Badge variant="outline" className="rounded-full">
                            {student.status === 'blocked' ? 'Blocked' : 'Active'}
                          </Badge>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Selected Student</p>
                {selectedStudent ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-lg font-semibold">{displayName(selectedStudent)}</p>
                    <p className="text-sm text-muted-foreground">{selectedStudent.email || 'No email'}</p>
                    <p className="text-sm text-muted-foreground">{selectedStudent.phoneNumber || 'No phone number'}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Select a student to manage course access.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BookOpenCheck className="h-5 w-5 text-primary" />
                  Assign Courses
                </CardTitle>
                <CardDescription>Filter eligible courses, then assign them to the selected student.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_0.7fr]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={courseSearch}
                    onChange={(event) => setCourseSearch(event.target.value)}
                    placeholder="Search by title, subject, class, exam, or teacher"
                    className="pl-9"
                  />
                </div>
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All teachers</SelectItem>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {displayName(teacher)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={accessFilter} onValueChange={(value) => setAccessFilter(value as 'all' | 'free' | 'paid')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by access" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Free and premium</SelectItem>
                    <SelectItem value="free">Free only</SelectItem>
                    <SelectItem value="paid">Premium only</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-xl">Currently Assigned</CardTitle>
                <CardDescription>These courses already sit inside the student&apos;s purchase-style learning collection.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedStudent ? (
                  <div className="rounded-2xl border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
                    Select a student to view assigned courses.
                  </div>
                ) : isPurchasedCoursesLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : assignedCourseRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
                    No courses are assigned to this student yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignedCourseRows.map((item) => (
                      <div key={item.purchaseDocId} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold">{item.title}</p>
                              <Badge className={item.accessLevel === 'paid' ? 'bg-amber-500/15 text-amber-100' : 'bg-emerald-500/15 text-emerald-100'}>
                                {item.accessLevel === 'paid' ? 'Premium' : 'Free'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">Teacher: {item.teacherName}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.examName} • {item.className}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Subjects: {item.subjectNames.length ? item.subjectNames.join(', ') : 'Not tagged'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Assigned on {formatDateTime(item.assignedAt)}
                              {item.assignedByAdminEmail ? ` by ${item.assignedByAdminEmail}` : ''}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setRemoveTarget({ id: item.purchaseDocId, title: item.title })}
                            disabled={isMutatingKey === `remove:${item.purchaseDocId}`}
                          >
                            {isMutatingKey === `remove:${item.purchaseDocId}` ? (
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-xl">Available Courses</CardTitle>
                <CardDescription>
                  Only courses that can genuinely open for students are shown here. Premium courses must already be wired for student subscription access before they become assignable.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedStudent ? (
                  <div className="rounded-2xl border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
                    Select a student to start assigning courses.
                  </div>
                ) : availableCourses.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
                    No matching courses are available for assignment with the current filters.
                  </div>
                ) : (
                  availableCourses.map((course) => {
                    const subjectNames = (course.subjectIds || []).map((subjectId) => subjectNameById[subjectId]).filter(Boolean);
                    const assignKey = `assign:${course.id}`;
                    const isAssigning = isMutatingKey === assignKey;

                    return (
                      <div key={course.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold">{course.title || 'Untitled Course'}</p>
                              <Badge className={normalizeText(course.accessLevel) === 'paid' ? 'bg-amber-500/15 text-amber-100' : 'bg-emerald-500/15 text-emerald-100'}>
                                {normalizeText(course.accessLevel) === 'paid' ? 'Premium' : 'Free'}
                              </Badge>
                              {course.subscriptionAttached ? (
                                <Badge variant="outline" className="rounded-full">Ready for access</Badge>
                              ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Teacher: {userNameById[course.teacherId || ''] || 'Unknown teacher'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {examNameById[course.examTypeId || ''] || 'Unassigned Exam'} • {classNameById[course.classId || ''] || 'Unassigned Class'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Subjects: {subjectNames.length ? subjectNames.join(', ') : 'Not tagged'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Updated {formatDateTime(course.updatedAt || course.createdAt)}
                            </p>
                          </div>
                          <Button type="button" onClick={() => void handleAssignCourse(course)} disabled={isAssigning}>
                            {isAssigning ? (
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <GraduationCap className="mr-2 h-4 w-4" />
                            )}
                            Assign to {selectedStudent ? displayName(selectedStudent) : 'student'}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <AlertDialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove assigned course?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `${removeTarget.title} will be removed from ${displayName(selectedStudent)}'s course access.`
                : 'This will remove the assigned course from the selected student.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(isMutatingKey && removeTarget && isMutatingKey === `remove:${removeTarget.id}`)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleRemoveAssignedCourse();
              }}
              disabled={Boolean(isMutatingKey && removeTarget && isMutatingKey === `remove:${removeTarget.id}`)}
            >
              {removeTarget && isMutatingKey === `remove:${removeTarget.id}` ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Remove course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
