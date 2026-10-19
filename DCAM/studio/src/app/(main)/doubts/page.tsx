'use client';

import { useState, useMemo, FC, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { formatDistanceToNow } from 'date-fns';
import { useUser, useFirestore, useCollection, useMemoFirebase, useStorage } from '@/firebase';
import { useIsTeacher } from '@/hooks/useIsTeacher';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { collection, query, where, orderBy, serverTimestamp, doc, addDoc, updateDoc, getDoc, getDocs, documentId } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, type UploadTaskSnapshot, type StorageReference } from 'firebase/storage';
import DashboardHeader from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, LoaderCircle, MessageSquare, User, HelpCircle, CheckCircle, Paperclip, X, FileText, Download, AlertCircle } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getNormalizedTeacherStatus } from '@/lib/teacher-approval';

// Data types
type Attachment = {
    id: string;
    name: string;
    url?: string;
    type: string;
    isUploading?: boolean;
    uploadError?: string;
}

type Doubt = {
  id: string;
  studentId: string;
  studentName: string;
  studentPhotoUrl?: string;
  teacherId?: string;
  teacherName?: string;
  teacherPhotoUrl?: string;
  topicId: string;
  question: string;
  questionAttachments?: Attachment[];
  answer?: string;
  answerAttachments?: Attachment[];
  status: 'open' | 'answered' | 'closed';
  createdAt: Timestamp;
};

// Zod schema for the doubt form
const doubtSchema = z.object({
  teacherId: z.string().min(1, 'Please select a teacher.'),
  topicId: z.string().min(1, 'Please enter a topic.'),
  question: z.string().min(20, 'Your question must be at least 20 characters long.'),
});

type EligibleTeacher = {
  id: string;
  name: string;
  photoURL?: string;
};
type StudentRecipientMode = 'admin-only' | 'eligible-teachers' | 'none';
function getUploadErrorMessage(error: any) {
    const code = error?.code as string | undefined;
    if (code === 'storage/unauthorized') return 'Permission denied by Storage rules';
    if (code === 'storage/canceled') return 'Upload canceled';
    if (code === 'storage/quota-exceeded') return 'Storage quota exceeded';
    if (code === 'storage/retry-limit-exceeded') return 'Network retry limit exceeded';
    if (typeof error?.message === 'string' && error.message.includes('timed out')) return 'Upload timed out. Check network and try again.';
    if (typeof error?.message === 'string' && error.message.trim().length > 0) return error.message;
    return 'Upload failed';
}
function uploadFileWithTimeout(storageRef: StorageReference, file: File): Promise<UploadTaskSnapshot> {
    const task = uploadBytesResumable(storageRef, file);

    return new Promise<UploadTaskSnapshot>((resolve, reject) => {
        task.on(
            'state_changed',
            undefined,
            (error) => reject(error),
            () => resolve(task.snapshot)
        );
    });
}

const FileInput: FC<{ files: File[], onFilesChange: (files: File[]) => void, disabled: boolean }> = ({ files, onFilesChange, disabled }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) {
            onFilesChange([...files, ...selectedFiles].slice(0, 5)); // Limit to 5 files
        }
    };

    const handleRemoveFile = (index: number) => {
        onFilesChange(files.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={disabled || files.length >= 5}>
                <Paperclip className="mr-2 h-4 w-4" />
                Attach Files (Max 5)
            </Button>
            <Input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} multiple disabled={disabled} />
            <div className="space-y-2">
                {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 text-sm rounded-md bg-muted">
                        <span className="truncate">{file.name}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFile(index)} disabled={disabled}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AttachmentItem: FC<{ attachment: Attachment }> = ({ attachment }) => {
    if (attachment.isUploading) {
        return (
            <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                <LoaderCircle className="h-5 w-5 text-muted-foreground animate-spin" />
                <span className="text-sm font-medium truncate flex-1 text-muted-foreground">{attachment.name}</span>
            </div>
        );
    }

    if (attachment.uploadError) {
        return (
            <div className="flex items-center gap-2 p-2 rounded-md border border-destructive/50 bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <div className="flex-1">
                    <span className="text-sm font-semibold truncate block">{attachment.name}</span>
                    <span className="text-xs">{attachment.uploadError}</span>
                </div>
            </div>
        );
    }
    
    return (
        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block p-2 rounded-md border hover:bg-muted">
            <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium truncate flex-1">{attachment.name}</span>
                <Download className="h-4 w-4 text-muted-foreground" />
            </div>
        </a>
    )
}

const AttachmentDisplay: FC<{ attachments: Attachment[] | undefined, title: string }> = ({ attachments, title }) => {
    if (!attachments || attachments.length === 0) return null;
    
    return (
        <div className="mt-4 space-y-2">
            <h5 className="font-semibold text-sm">{title}</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((file, index) => <AttachmentItem key={file.id || file.url || `${file.name}-${index}`} attachment={file} />)}
            </div>
        </div>
    )
}

// Component for the "Ask a Doubt" form
const AskDoubtForm: FC<{ setOpen: (open: boolean) => void; eligibleTeachers: EligibleTeacher[]; selectedRecipient: EligibleTeacher | null }> = ({ setOpen, eligibleTeachers, selectedRecipient }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const form = useForm<z.infer<typeof doubtSchema>>({
    resolver: zodResolver(doubtSchema),
    defaultValues: { teacherId: selectedRecipient?.id || '', topicId: '', question: '' },
  });

  useEffect(() => {
    form.setValue('teacherId', selectedRecipient?.id || '', { shouldValidate: true });
  }, [form, selectedRecipient]);

  async function onSubmit(values: z.infer<typeof doubtSchema>) {
    if (!user || !firestore || !storage) {
        toast({ variant: 'destructive', title: 'Service unavailable', description: 'Please refresh and try again.' });
        return;
    }
    setIsSubmitting(true);

    const selectedTeacher = eligibleTeachers.find((teacher) => teacher.id === values.teacherId);
    if (!selectedTeacher) {
      toast({ variant: 'destructive', title: 'Invalid teacher', description: 'Please select an eligible teacher.' });
      setIsSubmitting(false);
      return;
    }
    
    const attachmentPlaceholders = files.map((file, index) => ({
        id: `${Date.now()}-${index}`,
        name: file.name,
        type: file.type,
        isUploading: true,
    }));

    const newDoubtData: any = {
        ...values,
        studentId: user.uid,
        studentName: user.displayName || 'Anonymous Student',
        studentPhotoUrl: user.photoURL || '',
        teacherId: selectedTeacher.id,
        teacherName: selectedTeacher.name,
        teacherPhotoUrl: selectedTeacher.photoURL || '',
        status: 'open' as const,
        createdAt: serverTimestamp(),
        questionAttachments: attachmentPlaceholders,
    };
    
    try {
        const doubtsRef = collection(firestore, 'doubts');
        const docRef = await addDoc(doubtsRef, newDoubtData);

        toast({ title: 'Doubt Submitted!', description: 'Your question is being posted and files are uploading.' });
        form.reset();
        setFiles([]);
        setOpen(false);

        // Upload attachments
        await Promise.all(files.map(async (file, index) => {
            const placeholderId = attachmentPlaceholders[index].id;
            try {
                const sanitizedFileName = file.name.replace(/[#\[\]*?]/g, '_');
                const storageRef = ref(storage, `doubt_attachments/${docRef.id}/${user.uid}_${Date.now()}_${sanitizedFileName}`);
                const snapshot = await uploadFileWithTimeout(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);

                const currentDoc = await getDoc(docRef);
                if (currentDoc.exists()) {
                    const currentAttachments = currentDoc.data().questionAttachments || [];
                    const updatedAttachments = currentAttachments.map((att: Attachment) =>
                        att.id === placeholderId
                        ? { ...att, url: downloadURL, isUploading: false }
                        : att
                    );
                    await updateDoc(docRef, { questionAttachments: updatedAttachments });
                }
            } catch (uploadError: any) {
                const currentDoc = await getDoc(docRef);
                if (currentDoc.exists()) {
                    const currentAttachments = currentDoc.data().questionAttachments || [];
                    const updatedAttachments = currentAttachments.map((att: Attachment) =>
                        att.id === placeholderId
                        ? { ...att, isUploading: false, uploadError: getUploadErrorMessage(uploadError) }
                        : att
                    );
                    await updateDoc(docRef, { questionAttachments: updatedAttachments });
                }
                console.error("File upload failed:", uploadError);
            }
        }));

        setIsSubmitting(false);

    } catch (error: any) {
        console.error("Failed to submit doubt:", error);
        toast({ variant: 'destructive', title: 'Submission Failed', description: error.message || 'Could not submit your doubt.' });
        setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {selectedRecipient ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-muted-foreground">Sending doubt to</div>
            <div className="font-semibold">{selectedRecipient.name}</div>
          </div>
        ) : (
          <FormField control={form.control} name="teacherId" render={({ field }) => (
            <FormItem>
              <FormLabel>Recipient</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Supervisor/Teacher at DCAM" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {eligibleTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        )}
        <FormField control={form.control} name="topicId" render={({ field }) => (
          <FormItem>
            <FormLabel>Topic</FormLabel>
            <FormControl>
                <Input placeholder="e.g., Kinematics, Thermodynamics" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="question" render={({ field }) => (
          <FormItem>
            <FormLabel>Your Question</FormLabel>
            <FormControl><Textarea placeholder="Describe your doubt in detail..." {...field} rows={6} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FileInput files={files} onFilesChange={setFiles} disabled={isSubmitting} />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : <>Submit Doubt</>}
        </Button>
      </form>
    </Form>
  );
};

// Component to handle answering a doubt
const AnswerForm: FC<{ doubt: Doubt }> = ({ doubt }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  
  async function handleAnswerSubmit() {
    if (!user || !firestore || !storage) {
        toast({ variant: 'destructive', title: 'Service unavailable', description: 'Please refresh and try again.' });
        return;
    }
    if (answer.trim().length < 10) {
        toast({ variant: 'destructive', title: 'Answer is too short', description: 'Please provide a detailed answer of at least 10 characters.' });
        return;
    }
    setIsSubmitting(true);
    const doubtRef = doc(firestore, 'doubts', doubt.id);
    
    const attachmentPlaceholders = files.map((file, index) => ({
        id: `${Date.now()}-${index}`,
        name: file.name,
        type: file.type,
        isUploading: true,
    }));

    try {
        const answerData: any = {
            answer,
            status: 'answered' as const,
            teacherId: user.uid,
            teacherName: user.displayName || 'Expert Teacher',
            teacherPhotoUrl: user.photoURL || '',
            answerAttachments: attachmentPlaceholders,
        };
        
        await updateDoc(doubtRef, answerData);

        toast({ title: 'Answer Submitted!', description: 'The student has been notified and files are uploading.' });
        setAnswer('');
        setFiles([]);

        // Upload attachments
        await Promise.all(files.map(async (file, index) => {
            const placeholderId = attachmentPlaceholders[index].id;
            try {
                const sanitizedFileName = file.name.replace(/[#\[\]*?]/g, '_');
                const storageRef = ref(storage, `doubt_attachments/${doubt.id}/${user.uid}_${Date.now()}_${sanitizedFileName}`);
                const snapshot = await uploadFileWithTimeout(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);

                const currentDoc = await getDoc(doubtRef);
                if (currentDoc.exists()) {
                    const currentAttachments = currentDoc.data().answerAttachments || [];
                    const updatedAttachments = currentAttachments.map((att: Attachment) =>
                        att.id === placeholderId
                        ? { ...att, url: downloadURL, isUploading: false }
                        : att
                    );
                    await updateDoc(doubtRef, { answerAttachments: updatedAttachments });
                }
            } catch (uploadError: any) {
                 const currentDoc = await getDoc(doubtRef);
                if (currentDoc.exists()) {
                    const currentAttachments = currentDoc.data().answerAttachments || [];
                    const updatedAttachments = currentAttachments.map((att: Attachment) =>
                        att.id === placeholderId
                        ? { ...att, isUploading: false, uploadError: getUploadErrorMessage(uploadError) }
                        : att
                    );
                    await updateDoc(doubtRef, { answerAttachments: updatedAttachments });
                }
                console.error("Answer file upload failed:", uploadError);
            }
        }));

        setIsSubmitting(false);

    } catch (error: any) {
        console.error("Failed to submit answer:", error);
        toast({ variant: 'destructive', title: 'Submission Failed', description: error.message || 'Could not submit your answer.' });
        setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-4 space-y-4 rounded-md border bg-muted/50 p-4">
        <h4 className="font-semibold">Provide an Answer</h4>
        <Textarea 
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your detailed answer here..."
            rows={5}
            disabled={isSubmitting}
        />
        <FileInput files={files} onFilesChange={setFiles} disabled={isSubmitting} />
        <Button onClick={handleAnswerSubmit} disabled={isSubmitting}>
            {isSubmitting ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Posting...</> : <>Post Answer</>}
        </Button>
    </div>
  );
}

// Main component for the Doubts page
export default function DoubtsPage() {
  const { user } = useUser();
  const { isTeacher, isLoading: isTeacherLoading } = useIsTeacher();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const firestore = useFirestore();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const canModerateDoubts = isTeacher || isAdmin;
  const [eligibleTeachers, setEligibleTeachers] = useState<EligibleTeacher[]>([]);
  const [recipientMode, setRecipientMode] = useState<StudentRecipientMode>('none');
  const [isEligibleTeachersLoading, setIsEligibleTeachersLoading] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState('');

  useEffect(() => {
    const loadEligibleTeachers = async () => {
      if (!firestore || !user || canModerateDoubts) {
        setEligibleTeachers([]);
        setRecipientMode('none');
        return;
      }

      setIsEligibleTeachersLoading(true);
      try {
        const teacherIds = new Set<string>();
        const chunkSize = 30;
        const usersRef = collection(firestore, 'users');

        const [purchasedCoursesSnapshot, purchasedMockTestsSnapshot, purchasedLiveBatchesSnapshot] = await Promise.all([
          getDocs(collection(usersRef, user.uid, 'purchased_courses')),
          getDocs(collection(usersRef, user.uid, 'purchased_mock_tests')),
          getDocs(collection(usersRef, user.uid, 'purchased_live_batches')).catch(() => ({ docs: [] as any[] })),
        ]);

        const missingCourseTeacherIds = new Set<string>();
        purchasedCoursesSnapshot.forEach((purchaseDoc) => {
          const data = purchaseDoc.data() as { teacherId?: string; courseId?: string };
          if (typeof data.teacherId === 'string' && data.teacherId) teacherIds.add(data.teacherId);
          const contentId = typeof data.courseId === 'string' && data.courseId ? data.courseId : purchaseDoc.id;
          if (contentId && !(typeof data.teacherId === 'string' && data.teacherId)) missingCourseTeacherIds.add(contentId);
        });

        const missingMockTestTeacherIds = new Set<string>();
        purchasedMockTestsSnapshot.forEach((purchaseDoc) => {
          const data = purchaseDoc.data() as { teacherId?: string; testId?: string };
          if (typeof data.teacherId === 'string' && data.teacherId) teacherIds.add(data.teacherId);
          const contentId = typeof data.testId === 'string' && data.testId ? data.testId : purchaseDoc.id;
          if (contentId && !(typeof data.teacherId === 'string' && data.teacherId)) missingMockTestTeacherIds.add(contentId);
        });

        const missingLiveBatchTeacherIds = new Set<string>();
        purchasedLiveBatchesSnapshot.docs.forEach((purchaseDoc) => {
          const data = purchaseDoc.data() as { teacherId?: string; batchId?: string; liveBatchId?: string; adminAccessDisabled?: boolean };
          if (data.adminAccessDisabled === true) return;
          if (typeof data.teacherId === 'string' && data.teacherId) teacherIds.add(data.teacherId);
          const contentId =
            typeof data.liveBatchId === 'string' && data.liveBatchId
              ? data.liveBatchId
              : (typeof data.batchId === 'string' && data.batchId ? data.batchId : purchaseDoc.id);
          if (contentId && !(typeof data.teacherId === 'string' && data.teacherId)) missingLiveBatchTeacherIds.add(contentId);
        });

        const resolveTeacherIdsFromContent = async (collectionName: string, contentIds: string[]) => {
          for (let i = 0; i < contentIds.length; i += chunkSize) {
            const chunk = contentIds.slice(i, i + chunkSize);
            if (chunk.length === 0) continue;
            const snapshot = await getDocs(query(collection(firestore, collectionName), where(documentId(), 'in', chunk)));
            snapshot.forEach((contentDoc) => {
              const teacherId = contentDoc.data()?.teacherId;
              if (typeof teacherId === 'string' && teacherId.length > 0) teacherIds.add(teacherId);
            });
          }
        };

        await Promise.all([
          resolveTeacherIdsFromContent('courses', Array.from(missingCourseTeacherIds)).catch(() => {}),
          resolveTeacherIdsFromContent('mock_tests', Array.from(missingMockTestTeacherIds)).catch(() => {}),
          resolveTeacherIdsFromContent('live_batches', Array.from(missingLiveBatchTeacherIds)).catch(() => {}),
        ]);

        const teacherIdList = Array.from(teacherIds);
        const teachers: EligibleTeacher[] = [];

          const appendAdmins = async () => {
            const adminSnapshot = await getDocs(query(collection(firestore, 'users'), where('roleId', '==', 'admin')));
            adminSnapshot.forEach((adminDoc) => {
              const data = adminDoc.data() as {
                firstName?: string;
                lastName?: string;
                photoURL?: string;
                status?: 'active' | 'blocked';
              };
              if (data.status === 'blocked') return;
              const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Supervisor';
              teachers.push({ id: adminDoc.id, name: `${fullName} (Supervisor)`, photoURL: data.photoURL || '' });
            });
          };

        if (teacherIdList.length > 0) {
          setRecipientMode('eligible-teachers');
          for (let i = 0; i < teacherIdList.length; i += chunkSize) {
              const chunk = teacherIdList.slice(i, i + chunkSize);
              if (chunk.length === 0) continue;
              const snapshot = await getDocs(query(collection(firestore, 'users'), where(documentId(), 'in', chunk)));
              snapshot.forEach((teacherDoc) => {
                const data = teacherDoc.data() as {
                  firstName?: string;
                  lastName?: string;
                  photoURL?: string;
                  roleId?: 'student' | 'teacher' | 'admin';
                  teacherStatus?: 'pending' | 'approved' | 'rejected';
                  status?: 'active' | 'blocked';
                };
                const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Teacher';
                if (data.status === 'blocked') return;
                const canReceiveDoubts = data.roleId === 'admin'
                  || (data.roleId === 'teacher' && getNormalizedTeacherStatus(data) === 'approved');
                if (canReceiveDoubts) {
                  const label = data.roleId === 'admin' ? `${fullName} (Supervisor)` : fullName;
                  teachers.push({ id: teacherDoc.id, name: label, photoURL: data.photoURL || '' });
                }
              });
          }
          await appendAdmins();
        } else {
          // If no purchases exist yet, allow doubts only to supervisor(s).
          setRecipientMode('admin-only');
          await appendAdmins();
        }

        const uniqueById = new Map<string, EligibleTeacher>();
        teachers.forEach((teacher) => {
          if (!uniqueById.has(teacher.id)) uniqueById.set(teacher.id, teacher);
        });
        const deduped = Array.from(uniqueById.values()).sort((a, b) => a.name.localeCompare(b.name));
        setEligibleTeachers(deduped);
      } catch (error) {
        console.error('Failed to load eligible teachers for doubts:', error);
        setEligibleTeachers([]);
        setRecipientMode('none');
      } finally {
        setIsEligibleTeachersLoading(false);
      }
    };

    loadEligibleTeachers();
  }, [firestore, user, canModerateDoubts]);

  useEffect(() => {
    if (canModerateDoubts) return;
    if (selectedRecipientId && eligibleTeachers.some((t) => t.id === selectedRecipientId)) return;
    setSelectedRecipientId('');
  }, [canModerateDoubts, eligibleTeachers, selectedRecipientId]);

  const selectedRecipient = useMemo(() => {
    if (!selectedRecipientId) return null;
    return eligibleTeachers.find((teacher) => teacher.id === selectedRecipientId) || null;
  }, [eligibleTeachers, selectedRecipientId]);

  const doubtsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    if (isAdmin) {
      return query(collection(firestore, 'doubts'), orderBy('createdAt', 'desc'));
    }
    if (isTeacher) {
      return query(collection(firestore, 'doubts'), where('teacherId', '==', user.uid), orderBy('createdAt', 'desc'));
    }
    return query(collection(firestore, 'doubts'), where('studentId', '==', user.uid));
  }, [firestore, user, isAdmin, isTeacher]);

  const { data: doubts, isLoading: areDoubtsLoading } = useCollection<Doubt>(doubtsQuery);

  const filteredDoubts = useMemo(() => {
    if (!doubts) return { open: [], answered: [], myDoubts: [] };
    const sortedDoubts = [...doubts].sort((a, b) => {
      const aMs = a.createdAt?.toDate?.().getTime?.() ?? 0;
      const bMs = b.createdAt?.toDate?.().getTime?.() ?? 0;
      return bMs - aMs;
    });
    const studentScoped = !canModerateDoubts
      ? (selectedRecipientId ? sortedDoubts.filter((d) => d.teacherId === selectedRecipientId) : [])
      : sortedDoubts;
    const myDoubts = user ? studentScoped.filter(d => d.studentId === user.uid) : [];
    return {
      open: studentScoped.filter(d => d.status === 'open'),
      answered: studentScoped.filter(d => d.status === 'answered' || d.status === 'closed'),
      myDoubts: myDoubts,
    };
  }, [canModerateDoubts, doubts, selectedRecipientId, user]);
  
  const isLoading = areDoubtsLoading || isTeacherLoading || isAdminLoading;

  const getStatus = (doubt: Doubt) => {
    switch (doubt.status) {
      case 'open':
        return <Badge variant="destructive"><HelpCircle className="mr-1 h-3 w-3" />Open</Badge>;
      case 'answered':
        return <Badge variant="default"><CheckCircle className="mr-1 h-3 w-3" />Answered</Badge>;
      case 'closed':
         return <Badge variant="secondary">Closed</Badge>;
    }
  };

  const renderDoubtList = (doubtList: Doubt[]) => {
    if (isLoading) {
        return <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
        </div>;
    }
    if (doubtList.length === 0) {
        return <p className="text-muted-foreground text-center py-8">No doubts here.</p>;
    }
    return (
        <Accordion type="single" collapsible className="w-full space-y-4">
            {doubtList.map(doubt => (
                <AccordionItem value={doubt.id} key={doubt.id} className="border rounded-lg bg-card">
                    <AccordionTrigger className="p-4 text-left hover:no-underline">
                        <div className="flex-1 space-y-2">
                             <p className="font-semibold">{doubt.question}</p>
                             <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6"><AvatarImage src={doubt.studentPhotoUrl} /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar>
                                    <span>{doubt.studentName}</span>
                                </div>
                                <span>{doubt.createdAt && formatDistanceToNow(doubt.createdAt.toDate(), { addSuffix: true })}</span>
                                {getStatus(doubt)}
                             </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                       <div className="prose prose-sm max-w-none border-t pt-4">
                            <AttachmentDisplay attachments={doubt.questionAttachments} title="Question Attachments" />
                           {doubt.answer ? (
                            <>
                                <div className="flex items-center gap-2 mb-2 mt-4">
                                    <Avatar className="h-8 w-8"><AvatarImage src={doubt.teacherPhotoUrl} /><AvatarFallback>T</AvatarFallback></Avatar>
                                    <div>
                                        <p className="font-semibold">{doubt.teacherName || 'Expert Teacher'}</p>
                                        <p className="text-xs text-muted-foreground">Answered</p>
                                    </div>
                                </div>
                                <p>{doubt.answer}</p>
                                <AttachmentDisplay attachments={doubt.answerAttachments} title="Answer Attachments" />
                            </>
                           ) : isTeacher ? (
                               <AnswerForm doubt={doubt} />
                           ) : (
                               <p className="italic text-muted-foreground mt-4">An expert is looking into your question. Please check back later for an answer.</p>
                           )}
                       </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
  };
  
  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Doubt Resolution" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
         <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2"><MessageSquare /> Doubts Forum</CardTitle>
                    <CardDescription>
                      {canModerateDoubts
                        ? 'Review and resolve student doubts.'
                        : recipientMode === 'admin-only'
                          ? 'Select Supervisor and send your doubt.'
                          : 'Select recipient first. Teachers unlock from purchased courses/tests/live batches.'}
                    </CardDescription>
                </div>
                {!canModerateDoubts && (
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button disabled={isEligibleTeachersLoading || eligibleTeachers.length === 0 || !selectedRecipient}>
                              <PlusCircle className="mr-2"/>Ask a New Doubt
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Ask a New Doubt</DialogTitle>
                                <DialogDescription>
                                  {selectedRecipient
                                    ? `Your doubt will be sent to ${selectedRecipient.name}.`
                                    : (eligibleTeachers.length > 0
                                      ? 'Please select recipient on the doubts page first.'
                                      : (isEligibleTeachersLoading
                                          ? 'Loading eligible teachers...'
                                          : 'No eligible recipients found.'))
                                  }
                                </DialogDescription>
                            </DialogHeader>
                            {eligibleTeachers.length > 0 && selectedRecipient ? (
                              <AskDoubtForm setOpen={setIsFormOpen} eligibleTeachers={eligibleTeachers} selectedRecipient={selectedRecipient} />
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {isEligibleTeachersLoading
                                  ? 'Loading recipients...'
                                  : 'Select a recipient to continue.'}
                              </p>
                            )}
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent>
                {!canModerateDoubts && (
                  <div className="mb-6 space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Whom to send doubt
                    </label>
                    <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId} disabled={isEligibleTeachersLoading || eligibleTeachers.length === 0}>
                      <SelectTrigger className="max-w-md">
                        <SelectValue placeholder={isEligibleTeachersLoading ? 'Loading recipients...' : 'Select Supervisor/Teacher at DCAM'} />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleTeachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {eligibleTeachers.length > 0
                        ? recipientMode === 'admin-only'
                          ? 'No purchases found. You can send doubts only to Supervisor.'
                          : 'Recipients include Supervisor and Teachers at DCAM from your purchased courses/tests/live batches.'
                        : (isEligibleTeachersLoading
                            ? 'Loading eligible recipients...'
                            : 'No eligible recipients found yet.')}
                    </p>
                  </div>
                )}
                {!canModerateDoubts && !selectedRecipient ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                    Select recipient first to view the doubt forum.
                  </div>
                ) : (
                  <Tabs defaultValue="open">
                    <TabsList>
                        <TabsTrigger value="open">Open</TabsTrigger>
                        <TabsTrigger value="answered">Answered</TabsTrigger>
                        {!canModerateDoubts && <TabsTrigger value="my-doubts">My Doubts</TabsTrigger>}
                    </TabsList>
                    <TabsContent value="open" className="pt-4">{renderDoubtList(filteredDoubts.open)}</TabsContent>
                    <TabsContent value="answered" className="pt-4">{renderDoubtList(filteredDoubts.answered)}</TabsContent>
                    {!canModerateDoubts && <TabsContent value="my-doubts" className="pt-4">{renderDoubtList(filteredDoubts.myDoubts)}</TabsContent>}
                  </Tabs>
                )}
            </CardContent>
         </Card>
      </main>
    </div>
  );
}










