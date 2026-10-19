'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, orderBy, query } from 'firebase/firestore';
import DashboardHeader from '@/components/dashboard-header';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Sparkles, SlidersHorizontal, Star, UserRound, GraduationCap, ArrowRight, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { isPublicTeacherProfile } from '@/lib/teacher-approval';

type ExamType = { id: string; name: string };
type ClassItem = { id: string; name: string; examTypeId: string };
type Subject = { id: string; name: string; classId: string };
type TeachingAssignment = {
  examTypeId: string;
  classId: string;
  allSubjects?: boolean;
  subjectIds?: string[];
};
type UserProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  roleId?: 'student' | 'teacher' | 'admin';
  status?: 'active' | 'blocked';
  teacherStatus?: 'pending' | 'approved' | 'rejected';
  teachingAssignments?: TeachingAssignment[];
  teachesClassIds?: string[];
  teachesExamTypeIds?: string[];
  teachesSubjectIds?: string[];
  platformRating?: number;
  rating?: number;
  totalRatings?: number;
};

export default function FindTeachersPage() {
  const firestore = useFirestore();

  const examTypesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'exam_types'), orderBy('name')) : null), [firestore]);
  const classesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classes'), orderBy('name')) : null), [firestore]);
  const subjectsQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'subjects'), orderBy('name')) : null), [firestore]);
  const usersQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'users'), orderBy('firstName')) : null), [firestore]);

  const { data: examTypes, isLoading: examLoading } = useCollection<ExamType>(examTypesQuery);
  const { data: classes, isLoading: classLoading } = useCollection<ClassItem>(classesQuery);
  const { data: subjects, isLoading: subjectLoading } = useCollection<Subject>(subjectsQuery);
  const { data: users, isLoading: userLoading } = useCollection<UserProfile>(usersQuery);

  const [examTypeId, setExamTypeId] = useState('');
  const [classId, setClassId] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<{ examTypeId: string; classId: string; subjectIds: string[] } | null>(null);

  const filteredClasses = useMemo(() => (classes || []).filter((c) => c.examTypeId === examTypeId), [classes, examTypeId]);
  const filteredSubjects = useMemo(() => (subjects || []).filter((s) => s.classId === classId), [subjects, classId]);

  useEffect(() => {
    if (classId && !filteredClasses.some((c) => c.id === classId)) setClassId('');
  }, [filteredClasses, classId]);

  useEffect(() => {
    setSelectedSubjectIds((curr) => curr.filter((id) => filteredSubjects.some((s) => s.id === id)));
  }, [filteredSubjects]);

  useEffect(() => {
    setAppliedFilters(null);
  }, [examTypeId, classId, selectedSubjectIds]);

  const loading = examLoading || classLoading || subjectLoading || userLoading;
  const selectedExam = useMemo(
    () => (examTypes || []).find((item) => item.id === examTypeId) || null,
    [examTypes, examTypeId]
  );
  const selectedClass = useMemo(
    () => (classes || []).find((item) => item.id === classId) || null,
    [classes, classId]
  );
  const hasCurriculumForExam = Boolean(examTypeId && filteredClasses.length > 0);
  const canSearch = Boolean(examTypeId && classId && hasCurriculumForExam);
  const searchGuidance = useMemo(() => {
    if (!examTypeId) {
      return {
        tone: 'info' as const,
        title: 'Start with exam selection',
        description: 'Choose your target exam first to unlock matching curricula and subjects.',
      };
    }
    if (filteredClasses.length === 0) {
      return {
        tone: 'warning' as const,
        title: 'No curriculum mapped for this exam yet',
        description: `Admin has not added curriculum/class for ${selectedExam?.name || 'the selected exam'} right now. Choose another exam or check back soon.`,
      };
    }
    if (!classId) {
      return {
        tone: 'warning' as const,
        title: 'Exam selected. Curriculum is pending.',
        description: 'Now choose a curriculum/class to continue teacher discovery.',
      };
    }
    if (filteredSubjects.length === 0) {
      return {
        tone: 'warning' as const,
        title: 'Subjects not available yet',
        description: 'No subjects are mapped for this exam + curriculum combination right now.',
      };
    }
    if (selectedSubjectIds.length === 0) {
      return {
        tone: 'info' as const,
        title: 'No subject filter selected',
        description: 'Search will include teachers mapped to any subject under this curriculum.',
      };
    }
    return {
      tone: 'success' as const,
      title: 'Filters are ready',
      description: `${selectedSubjectIds.length} subject filter${selectedSubjectIds.length > 1 ? 's' : ''} selected. Click Search Teachers to fetch best matches.`,
    };
  }, [examTypeId, classId, filteredClasses.length, filteredSubjects.length, selectedSubjectIds.length, selectedExam?.name]);

  const toggleSubject = (subjectId: string, checked: boolean) => {
    setSelectedSubjectIds((curr) => (checked ? (curr.includes(subjectId) ? curr : [...curr, subjectId]) : curr.filter((id) => id !== subjectId)));
  };

  const matchedTeachers = useMemo(() => {
    if (!appliedFilters || !users) return [];
    const classSubjectIds = (subjects || []).filter((s) => s.classId === appliedFilters.classId).map((s) => s.id);

    return users
      .filter((u) => isPublicTeacherProfile(u))
      .filter((u) => {
        const assignments = Array.isArray(u.teachingAssignments) ? u.teachingAssignments : [];
        const assignmentMatches = assignments.filter((a) => a.examTypeId === appliedFilters.examTypeId && a.classId === appliedFilters.classId);

        const teachesClassFromLegacy = (u.teachesClassIds || []).includes(appliedFilters.classId);
        const teachesExamFromLegacy = (u.teachesExamTypeIds || []).includes(appliedFilters.examTypeId);
        const teachesSubjectsLegacy = new Set(u.teachesSubjectIds || []);

        const teachesSubjectsFromAssignments = new Set<string>();
        assignmentMatches.forEach((a) => {
          if (a.allSubjects) classSubjectIds.forEach((id) => teachesSubjectsFromAssignments.add(id));
          (a.subjectIds || []).forEach((id) => teachesSubjectsFromAssignments.add(id));
        });

        const merged = new Set<string>([...Array.from(teachesSubjectsFromAssignments), ...Array.from(teachesSubjectsLegacy)]);
        const classMatch = assignmentMatches.length > 0 || teachesClassFromLegacy;
        const examMatch = assignmentMatches.length > 0 || teachesExamFromLegacy;
        if (!classMatch || !examMatch) return false;

        if (appliedFilters.subjectIds.length === 0) return true;
        return appliedFilters.subjectIds.every((id) => merged.has(id));
      })
      .sort((a, b) => {
        const ra = typeof a.platformRating === 'number' ? a.platformRating : typeof a.rating === 'number' ? a.rating : -1;
        const rb = typeof b.platformRating === 'number' ? b.platformRating : typeof b.rating === 'number' ? b.rating : -1;
        if (ra !== rb) return rb - ra;
        const an = `${a.firstName || ''} ${a.lastName || ''}`.trim();
        const bn = `${b.firstName || ''} ${b.lastName || ''}`.trim();
        return an.localeCompare(bn);
      });
  }, [appliedFilters, users, subjects]);

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Find Teachers" />
      <main className="relative flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_36%),radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_34%)] p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Card className="overflow-hidden border-cyan-400/35 bg-gradient-to-r from-sky-950/55 via-blue-950/40 to-indigo-950/55 shadow-[0_24px_56px_-30px_rgba(14,165,233,0.75)]">
            <CardContent className="p-6 md:p-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <p className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-100">
                    <Sparkles className="h-3.5 w-3.5" />
                    Teacher Discovery
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Search Teachers By Exam, Curriculum, and Subject Fit</h2>
                  <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
                    Build your exact learning context, then discover teachers mapped to that scope with high-confidence match results.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-full border-cyan-300/35 bg-cyan-500/15 px-3 py-1 text-cyan-100">
                    Rated Profiles
                  </Badge>
                  <Badge variant="secondary" className="rounded-full border-indigo-300/35 bg-indigo-500/15 px-3 py-1 text-indigo-100">
                    By Exam + Class
                  </Badge>
                  <Badge variant="secondary" className="rounded-full border-sky-300/35 bg-sky-500/15 px-3 py-1 text-sky-100">
                    Subject Precision
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-gradient-to-b from-slate-900/88 to-slate-950/72 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.95)]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <SlidersHorizontal className="h-5 w-5 text-primary" />
                Search Filters
              </CardTitle>
              <CardDescription>Set your criteria, validate your setup, and run a precise teacher search.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading ? (
                <Skeleton className="h-36 w-full" />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select value={examTypeId} onValueChange={setExamTypeId}>
                      <SelectTrigger className="h-12 rounded-xl border-border/70 bg-slate-950/70"><SelectValue placeholder="Select exam" /></SelectTrigger>
                      <SelectContent>{(examTypes || []).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={classId} onValueChange={setClassId} disabled={!examTypeId || filteredClasses.length === 0}>
                      <SelectTrigger className="h-12 rounded-xl border-border/70 bg-slate-950/70">
                        <SelectValue placeholder={examTypeId && filteredClasses.length === 0 ? 'No curriculum available for this exam' : 'Select curriculum/class'} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredClasses.length > 0 ? (
                          filteredClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                        ) : (
                          <SelectItem value="__no_curriculum__" disabled>
                            Admin has not added curriculum for this exam yet
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {examTypeId && filteredClasses.length === 0 ? (
                    <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-3 text-sm">
                      <p className="font-semibold text-amber-100">Curriculum unavailable for selected exam</p>
                      <p className="text-muted-foreground">
                        Admin has not configured curriculum/class for <span className="font-medium text-foreground">{selectedExam?.name || 'this exam'}</span>. Please choose another exam.
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-border/70 bg-slate-900/55 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold">Subjects (optional)</p>
                      <Badge variant="outline" className="rounded-full border-cyan-300/30 bg-cyan-500/10 text-cyan-100">
                        {selectedSubjectIds.length} selected
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {filteredSubjects.length === 0 ? (
                        <p className="text-sm text-muted-foreground md:col-span-3">
                          {!examTypeId
                            ? 'Select an exam first to load matching curricula and subjects.'
                            : filteredClasses.length === 0
                              ? 'This exam has no curriculum configured yet. Subjects will appear after curriculum is added.'
                            : !classId
                              ? 'Exam selected. Choose curriculum/class to load subjects.'
                              : 'No subjects are currently mapped for this selected exam + curriculum.'}
                        </p>
                      ) : (
                        filteredSubjects.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/45 px-3 py-2 text-sm transition hover:border-cyan-300/40 hover:bg-cyan-500/10">
                            <Checkbox checked={selectedSubjectIds.includes(s.id)} onCheckedChange={(v) => toggleSubject(s.id, !!v)} />
                            <span>{s.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <div
                    className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                      searchGuidance.tone === 'success'
                        ? 'border-emerald-300/35 bg-emerald-500/10'
                        : searchGuidance.tone === 'warning'
                          ? 'border-amber-300/35 bg-amber-500/10'
                          : 'border-cyan-300/35 bg-cyan-500/10'
                    }`}
                  >
                    {searchGuidance.tone === 'success' ? (
                      <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 text-emerald-300" />
                    ) : searchGuidance.tone === 'warning' ? (
                      <AlertTriangle className="mt-0.5 h-4.5 w-4.5 text-amber-300" />
                    ) : (
                      <Info className="mt-0.5 h-4.5 w-4.5 text-cyan-300" />
                    )}
                    <div>
                      <p className="text-sm font-semibold">{searchGuidance.title}</p>
                      <p className="text-sm text-muted-foreground">{searchGuidance.description}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="h-11 rounded-full border border-cyan-300/35 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-6 font-semibold text-slate-950 shadow-[0_14px_30px_-16px_rgba(56,189,248,0.95)] transition-all hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={!canSearch}
                    onClick={() => setAppliedFilters({ examTypeId, classId, subjectIds: selectedSubjectIds })}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Search Teachers
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {canSearch
                      ? `Ready to search${selectedExam ? ` in ${selectedExam.name}` : ''}${selectedClass ? ` / ${selectedClass.name}` : ''}.`
                      : examTypeId && filteredClasses.length === 0
                        ? 'Search unavailable: admin has not added any curriculum/class for the selected exam yet.'
                        : 'Search unlocks after selecting both exam and curriculum/class.'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {!appliedFilters ? (
            <Card className="border-dashed border-cyan-300/35 bg-cyan-500/5">
              <CardContent className="p-10 text-center">
                <Search className="mx-auto mb-3 h-6 w-6 text-cyan-300" />
                <p className="font-medium">Ready to discover best-fit teachers</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure filters above and click Search Teachers.
                </p>
              </CardContent>
            </Card>
          ) : matchedTeachers.length === 0 ? (
            <Card className="border-dashed border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-10 text-center">
                <GraduationCap className="mx-auto mb-3 h-6 w-6 text-amber-300" />
                <p className="font-medium">No teachers found for this filter set</p>
                <p className="mt-1 text-sm text-muted-foreground">Try changing subjects or selecting a different class.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-500/5 p-3">
                <Badge variant="outline" className="rounded-full border-cyan-300/40 bg-cyan-500/10 text-cyan-100">
                  {matchedTeachers.length} teacher{matchedTeachers.length > 1 ? 's' : ''} found
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Match context: {selectedExam?.name || 'Exam'} / {selectedClass?.name || 'Curriculum'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matchedTeachers.map((t) => {
                const fullName = `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Teacher';
                const rating = typeof t.platformRating === 'number' ? t.platformRating : typeof t.rating === 'number' ? t.rating : null;
                return (
                  <Card key={t.id} className="group overflow-hidden border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-blue-950/55 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/50 hover:shadow-[0_18px_42px_-26px_rgba(56,189,248,0.75)]">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-14 w-14 ring-2 ring-cyan-300/25">
                            <AvatarImage src={t.photoURL} />
                            <AvatarFallback>{fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-2">
                            <p className="font-semibold text-lg leading-none">{fullName}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="inline-flex items-center gap-1 rounded-full border-cyan-300/30 bg-cyan-500/10 text-cyan-100">
                                <Star className="h-3 w-3" />
                                {rating !== null ? `${rating.toFixed(1)} / 5` : 'New'}
                              </Badge>
                              <Badge variant="outline" className="rounded-full border-indigo-300/30 bg-indigo-500/10 text-indigo-100">
                                Exam + Class Match
                              </Badge>
                              {typeof t.totalRatings === 'number' ? (
                                <span className="text-xs text-muted-foreground">({t.totalRatings} ratings)</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                          <UserRound className="h-3.5 w-3.5" />
                          Profile Ready
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-slate-950/45 p-3">
                        <p className="text-xs text-muted-foreground">
                          Open profile to create free/premium mocks and practice sessions in one click.
                        </p>
                        <Button asChild className="h-9 rounded-full border border-cyan-300/35 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-4 text-slate-950 shadow-[0_10px_22px_-14px_rgba(56,189,248,0.8)] hover:from-cyan-200 hover:via-sky-300 hover:to-blue-400">
                          <Link href={`/teachers/${t.id}`}>
                            View Profile <ArrowRight className="ml-1.5 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
