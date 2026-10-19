'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import DashboardHeader from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle } from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase, useStorage, useUser, updateDocumentNonBlocking } from '@/firebase';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { getTeacherAuthoringRestrictionCopy, isAllowedTeacherAuthorEmail } from '@/lib/teacher-authoring';

type MockTest = {
  id: string;
  teacherId?: string;
  title?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  mockTestDescription?: string;
  mockTestOutcomes?: string;
  mockTestYoutubeUrl?: string;
  attemptRules?: string;
  attemptGuidance?: string;
  attemptLimit?: {
    mode?: 'unlimited' | 'total' | 'interval';
    maxTotalAttempts?: number | null;
    maxAttemptsPerInterval?: number | null;
    intervalValue?: number | null;
    intervalUnit?: 'day' | 'week' | 'month' | 'year' | null;
  };
  showLeaderboard?: boolean;
  config?: {
    duration?: number;
    marksPerQuestion?: number;
    negativeMarksPerQuestion?: number;
  };
};

type EditState = {
  title: string;
  duration: number;
  marksPerQuestion: number;
  negativeMarksPerQuestion: number;
  mockTestDescription: string;
  mockTestOutcomes: string;
  mockTestYoutubeUrl: string;
  attemptRules: string;
  attemptGuidance: string;
  attemptLimitMode: 'unlimited' | 'total' | 'interval';
  maxTotalAttempts: number;
  maxAttemptsPerInterval: number;
  attemptIntervalValue: number;
  attemptIntervalUnit: 'day' | 'week' | 'month' | 'year';
  showLeaderboard: boolean;
};

const initialState: EditState = {
  title: '',
  duration: 60,
  marksPerQuestion: 4,
  negativeMarksPerQuestion: 1,
  mockTestDescription: '',
  mockTestOutcomes: '',
  mockTestYoutubeUrl: '',
  attemptRules: '',
  attemptGuidance: '',
  attemptLimitMode: 'unlimited',
  maxTotalAttempts: 1,
  maxAttemptsPerInterval: 1,
  attemptIntervalValue: 1,
  attemptIntervalUnit: 'week',
  showLeaderboard: false,
};

export default function EditMockTestPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { toast } = useToast();
  const router = useRouter();
  const { testId } = useParams() as { testId: string };
  const canManageTeacherAuthoring = isAdmin || isAllowedTeacherAuthorEmail(user?.email);
  const isTeacherAuthoringRestricted = isTeacher && !isAdminLoading && !canManageTeacherAuthoring;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [values, setValues] = useState<EditState>(initialState);

  const testDocRef = useMemoFirebase(() => {
    if (!firestore || !testId) return null;
    return doc(firestore, 'mock_tests', testId);
  }, [firestore, testId]);

  const { data: testData, isLoading: isTestLoading } = useDoc<MockTest>(testDocRef);

  useEffect(() => {
    if (!isTeacherAuthoringRestricted) return;
    router.replace('/dashboard');
  }, [isTeacherAuthoringRestricted, router]);

  useEffect(() => {
    if (!testData) return;
    setValues({
      title: testData.title || '',
      duration: Number(testData.config?.duration ?? 60),
      marksPerQuestion: Number(testData.config?.marksPerQuestion ?? 4),
      negativeMarksPerQuestion: Number(testData.config?.negativeMarksPerQuestion ?? 1),
      mockTestDescription: testData.mockTestDescription || '',
      mockTestOutcomes: testData.mockTestOutcomes || '',
      mockTestYoutubeUrl: testData.mockTestYoutubeUrl || '',
      attemptRules: testData.attemptRules || '',
      attemptGuidance: testData.attemptGuidance || '',
      attemptLimitMode: (testData.attemptLimit?.mode || 'unlimited') as EditState['attemptLimitMode'],
      maxTotalAttempts: Number(testData.attemptLimit?.maxTotalAttempts ?? 1),
      maxAttemptsPerInterval: Number(testData.attemptLimit?.maxAttemptsPerInterval ?? 1),
      attemptIntervalValue: Number(testData.attemptLimit?.intervalValue ?? 1),
      attemptIntervalUnit: (testData.attemptLimit?.intervalUnit || 'week') as EditState['attemptIntervalUnit'],
      showLeaderboard: !!testData.showLeaderboard,
    });
  }, [testData]);

  const setField = <K extends keyof EditState>(key: K, val: EditState[K]) => {
    setValues((prev) => ({ ...prev, [key]: val }));
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

  async function onSave() {
    if (!user || !testDocRef) return;
    if (isTeacherAuthoringRestricted) {
      toast({
        variant: 'destructive',
        title: 'Mock test editing disabled',
        description: getTeacherAuthoringRestrictionCopy(),
      });
      return;
    }
    if (!values.title.trim() || values.title.trim().length < 5) {
      toast({ variant: 'destructive', title: 'Invalid Title', description: 'Test title must be at least 5 characters long.' });
      return;
    }
    if (values.duration < 1) {
      toast({ variant: 'destructive', title: 'Invalid Duration', description: 'Duration must be at least 1 minute.' });
      return;
    }
    if (values.marksPerQuestion < 0 || values.negativeMarksPerQuestion < 0) {
      toast({ variant: 'destructive', title: 'Invalid Marks', description: 'Marks fields cannot be negative.' });
      return;
    }
    if (values.attemptLimitMode === 'total' && values.maxTotalAttempts < 1) {
      toast({ variant: 'destructive', title: 'Invalid Attempt Limit', description: 'Maximum total attempts must be at least 1.' });
      return;
    }
    if (values.attemptLimitMode === 'interval' && (values.maxAttemptsPerInterval < 1 || values.attemptIntervalValue < 1)) {
      toast({ variant: 'destructive', title: 'Invalid Attempt Limit', description: 'Interval attempt settings must be at least 1.' });
      return;
    }

    setIsSubmitting(true);
    try {
      let thumbnailUrl = testData?.thumbnailUrl || testData?.imageUrl || '';
      if (thumbnailFile) {
        const safeName = thumbnailFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uploadRef = ref(storage, `course_thumbnails/${user.uid}/mock_tests/${Date.now()}_${safeName}`);
        const uploaded = await uploadBytes(uploadRef, thumbnailFile, { contentType: thumbnailFile.type });
        thumbnailUrl = await getDownloadURL(uploaded.ref);
      }

      await updateDocumentNonBlocking(testDocRef, {
        title: values.title.trim(),
        thumbnailUrl,
        imageUrl: thumbnailUrl,
        mockTestDescription: values.mockTestDescription.trim(),
        mockTestOutcomes: values.mockTestOutcomes.trim(),
        mockTestYoutubeUrl: values.mockTestYoutubeUrl.trim(),
        attemptRules: values.attemptRules.trim(),
        attemptGuidance: values.attemptGuidance.trim(),
        attemptLimit: {
          mode: values.attemptLimitMode,
          maxTotalAttempts: values.attemptLimitMode === 'total' ? Number(values.maxTotalAttempts) : null,
          maxAttemptsPerInterval: values.attemptLimitMode === 'interval' ? Number(values.maxAttemptsPerInterval) : null,
          intervalValue: values.attemptLimitMode === 'interval' ? Number(values.attemptIntervalValue) : null,
          intervalUnit: values.attemptLimitMode === 'interval' ? values.attemptIntervalUnit : null,
        },
        showLeaderboard: !!values.showLeaderboard,
        'config.duration': Number(values.duration),
        'config.marksPerQuestion': Number(values.marksPerQuestion),
        'config.negativeMarksPerQuestion': Number(values.negativeMarksPerQuestion),
      });

      toast({ title: 'Mock Test Updated', description: `"${values.title}" has been saved.` });
      router.push('/mock-tests');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error?.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLoading = isTeacherLoading || isAdminLoading || isTestLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Edit Mock Test" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Skeleton className="h-72 w-full" />
        </main>
      </div>
    );
  }

  if (!isTeacher) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Edit Mock Test" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card><CardContent className="p-6 text-muted-foreground">This page is available only for teacher accounts.</CardContent></Card>
        </main>
      </div>
    );
  }

  if (isTeacherAuthoringRestricted) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Edit Mock Test" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="shadow-lg">
            <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Redirecting to dashboard...
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!testData || (testData.teacherId && testData.teacherId !== user?.uid)) {
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Edit Mock Test" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card><CardContent className="p-6 text-muted-foreground">Mock test not found or you do not have permission to edit it.</CardContent></Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Edit Mock Test" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Edit Mock Test</CardTitle>
              <CardDescription>You can edit title, timing/marking, thumbnail, and step 4/5/6 details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="text-lg font-semibold">Basic Details</h3>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Test Name</p>
                  <Input value={values.title} onChange={(e) => setField('title', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Thumbnail Change (JPEG only)</p>
                  <Input type="file" accept=".jpg,.jpeg,image/jpeg" onChange={(e) => handleThumbnailChange(e.target.files?.[0])} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Total Time (minutes)</p>
                    <Input type="number" value={values.duration} onChange={(e) => setField('duration', Number(e.target.value || 0))} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Marks per Question</p>
                    <Input type="number" value={values.marksPerQuestion} onChange={(e) => setField('marksPerQuestion', Number(e.target.value || 0))} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Negative Marking</p>
                    <Input type="number" value={values.negativeMarksPerQuestion} onChange={(e) => setField('negativeMarksPerQuestion', Number(e.target.value || 0))} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="text-lg font-semibold">Step 4: Mock Test Overview</h3>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Description of the Mock Test</p>
                  <Textarea rows={4} value={values.mockTestDescription} onChange={(e) => setField('mockTestDescription', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Mock Test Outcomes</p>
                  <Textarea rows={4} value={values.mockTestOutcomes} onChange={(e) => setField('mockTestOutcomes', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Explanation Video for students who havent purchased</p>
                  <Input value={values.mockTestYoutubeUrl} onChange={(e) => setField('mockTestYoutubeUrl', e.target.value)} />
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="text-lg font-semibold">Step 5: Attempt Instructions</h3>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Rules of Attempting the Mock Test</p>
                  <Textarea rows={4} value={values.attemptRules} onChange={(e) => setField('attemptRules', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Guidance of Attempting</p>
                  <Textarea rows={4} value={values.attemptGuidance} onChange={(e) => setField('attemptGuidance', e.target.value)} />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Show Leaderboard to Students</p>
                    <p className="text-xs text-muted-foreground">Students can view ranking and top scores on the test details page.</p>
                  </div>
                  <Switch checked={!!values.showLeaderboard} onCheckedChange={(checked) => setField('showLeaderboard', checked)} />
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="text-lg font-semibold">Step 6: Attempt Limits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Attempt Limit Type</p>
                    <Select value={values.attemptLimitMode} onValueChange={(value) => setField('attemptLimitMode', value as EditState['attemptLimitMode'])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unlimited">Unlimited Attempts</SelectItem>
                        <SelectItem value="total">Total Attempts</SelectItem>
                        <SelectItem value="interval">Attempts Per Interval</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {values.attemptLimitMode === 'total' ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Maximum Total Attempts</p>
                      <Input type="number" min="1" value={values.maxTotalAttempts} onChange={(e) => setField('maxTotalAttempts', Number(e.target.value || 0))} />
                    </div>
                  ) : null}
                </div>
                {values.attemptLimitMode === 'interval' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Attempts Allowed</p>
                      <Input type="number" min="1" value={values.maxAttemptsPerInterval} onChange={(e) => setField('maxAttemptsPerInterval', Number(e.target.value || 0))} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Interval Count</p>
                      <Input type="number" min="1" value={values.attemptIntervalValue} onChange={(e) => setField('attemptIntervalValue', Number(e.target.value || 0))} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Interval Unit</p>
                      <Select value={values.attemptIntervalUnit} onValueChange={(value) => setField('attemptIntervalUnit', value as EditState['attemptIntervalUnit'])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Day(s)</SelectItem>
                          <SelectItem value="week">Week(s)</SelectItem>
                          <SelectItem value="month">Month(s)</SelectItem>
                          <SelectItem value="year">Year(s)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
              </div>

              <Button type="button" disabled={isSubmitting} size="lg" onClick={onSave}>
                {isSubmitting ? (<><LoaderCircle className="mr-2 animate-spin" /> Saving Changes...</>) : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
