'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { formatRelative } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, useStorage } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, where, doc, setDoc, addDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, LoaderCircle, MessagesSquare, Send, User as UserIcon, MessageCircle, Paperclip, X, Download, AlertTriangle, FileText, Search, Users } from 'lucide-react';
import DashboardHeader from '@/components/dashboard-header';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

const chatMessageSchema = z.object({ text: z.string().max(500, 'Message is too long.').optional() });

type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl?: string;
  text?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  createdAt: Timestamp;
  isUploading?: boolean;
  uploadError?: string;
};

type GroupChatPreferences = {
  id: string;
  clearedAt?: Timestamp;
};

type UserProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  photoURL?: string;
  roleId?: 'student' | 'teacher' | 'admin';
  teacherStatus?: 'pending' | 'approved' | 'rejected';
  examTypeId?: string;
  selectedExamTypeId?: string;
  preferredExamTypeId?: string;
  subscriptionPlanId?: string;
};

type SubscriptionPlan = {
  id: string;
  examTypeId?: string;
  linkedContentType?: 'course' | 'mock_test' | 'live_batch' | null;
  linkedContentId?: string | null;
};

type DirectMessageThread = {
  id: string;
  participants: string[];
  lastMessageText?: string;
  lastMessageSenderId?: string;
  lastMessageAt?: Timestamp;
  unreadCounts?: Record<string, number>;
};

function Message({ message, isOwnMessage, toast }: { message: ChatMessage; isOwnMessage: boolean; toast: ReturnType<typeof useToast>['toast'] }) {
  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const urlToDownload = message.fileUrl || message.imageUrl;
    if (!urlToDownload) return;

    try {
      toast({ title: 'Starting download...', description: message.fileName || 'file' });
      const a = document.createElement('a');
      a.href = urlToDownload;
      // The target="_blank" is a fallback for when the download attribute is not respected
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      // The download attribute suggests a filename to the browser
      a.download = message.fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download initialization failed:", error);
      toast({
          variant: "destructive",
          title: "Download Failed",
          description: "Could not start the file download. Please try opening it in a new tab.",
      });
    }
  };

  const isImage = message.fileType?.startsWith('image/');

  return (
    <div className={cn('flex items-start gap-3', isOwnMessage && 'flex-row-reverse')}>
      <Avatar className="h-8 w-8">
        <AvatarImage src={message.senderPhotoUrl} />
        <AvatarFallback>{message.senderName?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className={cn('flex flex-col gap-1', isOwnMessage && 'items-end')}>
        <div className={cn('rounded-lg px-3 py-2 max-w-sm', isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
          {message.isUploading && (
              <div className="w-48 h-20 flex items-center justify-center bg-secondary rounded-md my-2">
                <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
          )}
          {message.uploadError && (
              <div className="w-48 h-auto flex flex-col items-center justify-center bg-destructive/20 text-destructive-foreground rounded-md my-2 p-2 text-center">
                <AlertTriangle className="h-6 w-6 mb-2" />
                <p className="text-xs font-semibold">{message.uploadError}</p>
              </div>
          )}
          {!message.isUploading && !message.uploadError && (
            isImage && message.imageUrl ? (
              <div className="relative group max-w-xs my-2">
                  <Link href={message.imageUrl} target="_blank" rel="noopener noreferrer">
                      <Image src={message.imageUrl} alt={message.fileName || 'Sent image'} width={200} height={200} className="rounded-md object-contain" />
                  </Link>
                  <button
                    onClick={handleDownload}
                    className="absolute top-2 right-2 p-1.5 bg-gray-900/50 text-white rounded-full hover:bg-gray-900/80 transition-colors"
                    aria-label="Download image"
                  >
                    <Download className="h-4 w-4" />
                  </button>
              </div>
            ) : message.fileUrl && (
                <div className="relative group max-w-xs my-2 p-3 rounded-md bg-background/20">
                    <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div className="flex-1 overflow-hidden">
                             <p className="text-sm font-medium truncate">{message.fileName}</p>
                             <p className="text-xs text-muted-foreground/80">{message.fileType}</p>
                        </div>
                        <button onClick={handleDownload} className="p-1.5 text-inherit rounded-full hover:bg-black/20 transition-colors" aria-label="Download file">
                            <Download className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )
          )}
          {message.text && <p className="text-sm whitespace-pre-wrap">{message.text}</p>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">{isOwnMessage ? 'You' : message.senderName}</span>
          <span>{message.createdAt ? formatRelative(message.createdAt.toDate(), new Date()) : 'sending...'}</span>
        </div>
      </div>
    </div>
  );
}

function GroupChat({ canTeacherChat, isTeacherAccount }: { canTeacherChat: boolean; isTeacherAccount: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  
  const [file, setFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<z.infer<typeof chatMessageSchema>>({
    resolver: zodResolver(chatMessageSchema),
    defaultValues: { text: '' },
  });

  const groupChatPrefsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid, 'chat_preferences', 'group_chat');
  }, [firestore, user]);
  const { data: groupChatPrefs } = useDoc<GroupChatPreferences>(groupChatPrefsRef);
  const [localClearedAtMs, setLocalClearedAtMs] = useState<number | null>(null);

  const chatMessagesQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'group_chat_messages'), orderBy('createdAt', 'asc')) : null), [firestore]);
  const { data: messages, isLoading: areMessagesLoading } = useCollection<ChatMessage>(chatMessagesQuery);

  const clearedAtMs = useMemo(() => {
    const serverMs = groupChatPrefs?.clearedAt?.toDate?.().getTime?.() ?? null;
    if (serverMs == null) return localClearedAtMs;
    if (localClearedAtMs == null) return serverMs;
    return Math.max(serverMs, localClearedAtMs);
  }, [groupChatPrefs, localClearedAtMs]);

  const visibleMessages = useMemo(() => {
    if (!messages) return [];
    if (clearedAtMs == null) return messages;
    return messages.filter((msg) => {
      const msgMs = msg.createdAt?.toDate?.().getTime?.();
      if (typeof msgMs !== 'number') return true;
      return msgMs > clearedAtMs;
    });
  }, [messages, clearedAtMs]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if(selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
        toast({ variant: 'destructive', title: 'File too large', description: 'Please select a file smaller than 10MB.' });
        return;
      }
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setPreviewDataUrl(reader.result as string);
        reader.readAsDataURL(selectedFile);
      } else {
          setPreviewDataUrl(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreviewDataUrl(null);
    if(fileInputRef.current) fileInputRef.current.value = '';
  }

  const handleClearForMe = async () => {
    if (!firestore || !user || !groupChatPrefsRef) return;
    const nowMs = Date.now();
    setLocalClearedAtMs(nowMs);
    try {
      await setDoc(groupChatPrefsRef, { clearedAt: serverTimestamp() }, { merge: true });
      toast({ title: 'Group chat cleared', description: 'Older group messages are now hidden only for your account.' });
    } catch (error: any) {
      setLocalClearedAtMs(null);
      toast({
        variant: 'destructive',
        title: 'Could not clear chat',
        description: error?.message || 'Please try again.',
      });
    }
  };

  async function onSubmit(values: z.infer<typeof chatMessageSchema>) {
    if (!user || !firestore || !storage) return;
    if (!values.text && !file) {
        toast({ variant: 'destructive', title: 'Cannot send an empty message.' });
        return;
    }

    setIsSubmitting(true);
    const attachedFile = file;

    try {
      const messageData: any = { 
          senderId: user.uid, 
          senderName: user.displayName || 'Anonymous', 
          senderPhotoUrl: user.photoURL || '', 
          createdAt: serverTimestamp(),
          text: values.text || '',
      };

      if (attachedFile) {
        const sanitizedFileName = attachedFile.name.replace(/[#\[\]*?]/g, '_');
        const filePath = `chat_files/group/${Date.now()}_${sanitizedFileName}`;
        const storageRef = ref(storage, filePath);
        const uploadResult = await uploadBytes(storageRef, attachedFile);
        const downloadURL = await getDownloadURL(uploadResult.ref);

        messageData.fileUrl = downloadURL;
        messageData.fileName = attachedFile.name;
        messageData.fileType = attachedFile.type;
        if (attachedFile.type.startsWith('image/')) {
            messageData.imageUrl = downloadURL;
        }
      }
      
      await addDoc(collection(firestore, 'group_chat_messages'), messageData);
      form.reset();
      handleRemoveFile();

    } catch (error: any) {
        console.error("Failed to send message or upload file:", error);
        toast({
            variant: "destructive",
            title: "Failed to send message",
            description: error.message || "Could not send the message. Please try again.",
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Card className="flex flex-col h-full max-h-[calc(100vh-16rem)] shadow-none border-none">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Community Chat</p>
            <p className="text-xs text-muted-foreground">Announcements and open discussions</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleClearForMe} disabled={areMessagesLoading || visibleMessages.length === 0}>
          Clear for me
        </Button>
      </div>
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {!canTeacherChat && isTeacherAccount && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            Your teacher account is pending admin approval. Community chat is available after approval.
          </div>
        )}
        {areMessagesLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" />
          </div>
        ) : visibleMessages.length > 0 ? (
          visibleMessages.map(msg => <Message key={msg.id} message={msg} isOwnMessage={msg.senderId === user?.uid} toast={toast} />)
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center gap-2">
            <p className="font-medium">No community messages yet.</p>
            <p className="text-xs">Be the first to start a conversation.</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </CardContent>
      <div className="border-t p-4">
        {file && (
            <div className="relative w-fit max-w-xs mb-2 p-2 border rounded-lg bg-muted">
                {previewDataUrl ? (
                    <Image src={previewDataUrl} alt="Preview" width={80} height={80} className="rounded-md object-cover" />
                ) : (
                    <div className="flex items-center gap-2">
                        <FileText className="h-10 w-10 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground truncate">{file.name}</p>
                    </div>
                )}
                <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={handleRemoveFile} disabled={isSubmitting}><X className="h-4 w-4" /></Button>
            </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting || (!canTeacherChat && isTeacherAccount)}><Paperclip className="h-5 w-5" /></Button>
            <Input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} disabled={isSubmitting || (!canTeacherChat && isTeacherAccount)} />
            <FormField control={form.control} name="text" render={({ field }) => (<FormItem className="flex-1"><FormControl><Input placeholder="Share an update with the community..." autoComplete="off" {...field} disabled={isSubmitting || (!canTeacherChat && isTeacherAccount)} /></FormControl></FormItem>)} />
            <Button type="submit" disabled={isSubmitting || (!canTeacherChat && isTeacherAccount)} className="gap-2">
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </Form>
      </div>
    </Card>
  );
}

function CommunityAnnouncements({ canPost }: { canPost: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<z.infer<typeof chatMessageSchema>>({
    resolver: zodResolver(chatMessageSchema),
    defaultValues: { text: '' },
  });

  const announcementsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'community_announcements'), orderBy('createdAt', 'asc'));
  }, [firestore]);
  const { data: messages, isLoading: areMessagesLoading } = useCollection<ChatMessage>(announcementsQuery);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'File too large', description: 'Please select a file smaller than 10MB.' });
        return;
      }
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setPreviewDataUrl(reader.result as string);
        reader.readAsDataURL(selectedFile);
      } else {
        setPreviewDataUrl(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreviewDataUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  async function onSubmit(values: z.infer<typeof chatMessageSchema>) {
    if (!canPost) return;
    if (!user || !firestore || !storage) return;
    if (!values.text && !file) {
      toast({ variant: 'destructive', title: 'Cannot send an empty announcement.' });
      return;
    }

    setIsSubmitting(true);
    const attachedFile = file;

    try {
      const messageData: any = {
        senderId: user.uid,
        senderName: user.displayName || 'Admin',
        senderPhotoUrl: user.photoURL || '',
        createdAt: serverTimestamp(),
        text: values.text || '',
      };

      if (attachedFile) {
        const sanitizedFileName = attachedFile.name.replace(/[#\[\]*?]/g, '_');
        const filePath = `chat_files/community_announcements/${Date.now()}_${sanitizedFileName}`;
        const storageRef = ref(storage, filePath);
        const uploadResult = await uploadBytes(storageRef, attachedFile);
        const downloadURL = await getDownloadURL(uploadResult.ref);

        messageData.fileUrl = downloadURL;
        messageData.fileName = attachedFile.name;
        messageData.fileType = attachedFile.type;
        if (attachedFile.type.startsWith('image/')) {
          messageData.imageUrl = downloadURL;
        }
      }

      await addDoc(collection(firestore, 'community_announcements'), messageData);
      form.reset();
      handleRemoveFile();
    } catch (error: any) {
      console.error('Failed to send announcement:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to send announcement',
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="flex flex-col h-full max-h-[calc(100vh-16rem)] shadow-none border-none">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Community Announcements</p>
            <p className="text-xs text-muted-foreground">Admin posts updates. Teachers can read and download attachments.</p>
          </div>
        </div>
      </div>
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {areMessagesLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : messages && messages.length > 0 ? (
          messages.map((msg) => <Message key={msg.id} message={msg} isOwnMessage={msg.senderId === user?.uid} toast={toast} />)
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center gap-2">
            <p className="font-medium">No announcements yet.</p>
            <p className="text-xs">Admins will post updates here.</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </CardContent>
      <div className="border-t p-4">
        {canPost ? (
          <>
            {file && (
              <div className="relative w-fit max-w-xs mb-2 p-2 border rounded-lg bg-muted">
                {previewDataUrl ? (
                  <Image src={previewDataUrl} alt="Preview" width={80} height={80} className="rounded-md object-cover" />
                ) : (
                  <div className="flex items-center gap-2">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground truncate">{file.name}</p>
                  </div>
                )}
                <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={handleRemoveFile} disabled={isSubmitting}><X className="h-4 w-4" /></Button>
              </div>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}><Paperclip className="h-5 w-5" /></Button>
                <Input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} disabled={isSubmitting} />
                <FormField control={form.control} name="text" render={({ field }) => (<FormItem className="flex-1"><FormControl><Input placeholder="Post an announcement..." autoComplete="off" {...field} disabled={isSubmitting} /></FormControl></FormItem>)} />
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="sr-only">Send</span>
                </Button>
              </form>
            </Form>
          </>
        ) : (
          <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Read-only for teachers. Only admins can post announcements.
          </div>
        )}
      </div>
    </Card>
  );
}

function AdminCommunityHub() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="teacher-announcements">
        <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1 rounded-2xl">
          <TabsTrigger value="teacher-announcements" className="rounded-xl">Teacher Announcements</TabsTrigger>
          <TabsTrigger value="student-community" className="rounded-xl">Student Community</TabsTrigger>
        </TabsList>
        <TabsContent value="teacher-announcements" className="pt-4">
          <CommunityAnnouncements canPost />
        </TabsContent>
        <TabsContent value="student-community" className="pt-4">
          <GroupChat canTeacherChat={true} isTeacherAccount={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DirectMessagesList({
  canTeacherChat,
  isTeacherAccount,
  isStudentAccount,
}: {
  canTeacherChat: boolean;
  isTeacherAccount: boolean;
  isStudentAccount: boolean;
}) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');

    const usersQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users'));
    }, [firestore, user]);

    const threadsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'direct_message_threads'), where('participants', 'array-contains', user.uid));
    }, [firestore, user]);

    const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);
    const { data: threads, isLoading: areThreadsLoading } = useCollection<DirectMessageThread>(threadsQuery);
    const plansQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'subscription_plans'));
    }, [firestore]);
    const { data: plans, isLoading: arePlansLoading } = useCollection<SubscriptionPlan>(plansQuery);

    const createChatId = (uid1: string, uid2: string) => [uid1, uid2].sort().join('_');

    const unreadThreadCount = useMemo(() => {
        if (!threads || !user) return 0;
        return threads.reduce((count, thread) => {
            const unread = thread.unreadCounts?.[user.uid] || 0;
            return unread > 0 ? count + 1 : count;
        }, 0);
    }, [threads, user]);

    const threadById = useMemo(() => {
        const entries = (threads || []).map((thread) => [thread.id, thread] as const);
        return new Map(entries);
    }, [threads]);

    const examTypeByPlanId = useMemo(() => {
      const map = new Map<string, string>();
      (plans || []).forEach((plan) => {
        if (plan.id && plan.examTypeId) map.set(plan.id, plan.examTypeId);
      });
      return map;
    }, [plans]);

    const getUserExamTypeId = (profile?: UserProfile) => {
      if (!profile) return '';
      return (
        profile.examTypeId ||
        profile.selectedExamTypeId ||
        profile.preferredExamTypeId ||
        (profile.subscriptionPlanId ? examTypeByPlanId.get(profile.subscriptionPlanId) || '' : '')
      );
    };

    const currentUserProfile = useMemo(() => (users || []).find((u) => u.id === user?.uid), [users, user?.uid]);
    const planById = useMemo(() => {
      const map = new Map<string, SubscriptionPlan>();
      (plans || []).forEach((plan) => {
        if (plan.id) map.set(plan.id, plan);
      });
      return map;
    }, [plans]);
    const getLinkedContent = (profile?: UserProfile) => {
      const planId = profile?.subscriptionPlanId;
      if (!planId) return { type: '', id: '' };
      const plan = planById.get(planId);
      return {
        type: plan?.linkedContentType || '',
        id: plan?.linkedContentId || '',
      };
    };
    const currentStudentExamTypeId = useMemo(() => (isStudentAccount ? getUserExamTypeId(currentUserProfile) : ''), [isStudentAccount, currentUserProfile, examTypeByPlanId]);
    const currentStudentLinkedContent = useMemo(() => (isStudentAccount ? getLinkedContent(currentUserProfile) : { type: '', id: '' }), [isStudentAccount, currentUserProfile, planById]);

    const filteredUsers = useMemo(() => {
        if (!users || !user) return [];
        const normalizedQuery = searchTerm.trim().toLowerCase();

        return [...users]
            .filter((otherUser) => otherUser.id !== user.uid)
            .filter((otherUser) => {
                if (isTeacherAccount) {
                  return otherUser.roleId === 'admin';
                }
                if (!isStudentAccount) return true;
                if (otherUser.roleId === 'admin') return true;
                if (otherUser.roleId !== 'student') return false;
                const otherExamTypeId = getUserExamTypeId(otherUser);
                const sameExam = !!currentStudentExamTypeId && !!otherExamTypeId && otherExamTypeId === currentStudentExamTypeId;
                const otherLinked = getLinkedContent(otherUser);
                const sameCourse =
                  currentStudentLinkedContent.type === 'course' &&
                  otherLinked.type === 'course' &&
                  !!currentStudentLinkedContent.id &&
                  currentStudentLinkedContent.id === otherLinked.id;
                const sameLiveBatch =
                  currentStudentLinkedContent.type === 'live_batch' &&
                  otherLinked.type === 'live_batch' &&
                  !!currentStudentLinkedContent.id &&
                  currentStudentLinkedContent.id === otherLinked.id;
                return sameExam || sameCourse || sameLiveBatch;
            })
            .filter((otherUser) => {
                if (!normalizedQuery) return true;
                const fullName = `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim().toLowerCase();
                return fullName.includes(normalizedQuery);
            })
            .sort((a, b) => {
                const aChatId = createChatId(user.uid, a.id);
                const bChatId = createChatId(user.uid, b.id);
                const aThread = threadById.get(aChatId);
                const bThread = threadById.get(bChatId);
                const aUnread = aThread?.unreadCounts?.[user.uid] || 0;
                const bUnread = bThread?.unreadCounts?.[user.uid] || 0;
                if (aUnread !== bUnread) return bUnread - aUnread;
                const aTime = aThread?.lastMessageAt?.toDate?.().getTime?.() || 0;
                const bTime = bThread?.lastMessageAt?.toDate?.().getTime?.() || 0;
                if (aTime !== bTime) return bTime - aTime;
                const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
                const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
                return aName.localeCompare(bName);
            });
    }, [users, user, threadById, searchTerm, isTeacherAccount, isStudentAccount, currentStudentExamTypeId, currentStudentLinkedContent, examTypeByPlanId, planById]);

    const groupedUsers = useMemo(() => {
        const supervisors: UserProfile[] = [];
        const staff: UserProfile[] = [];
        const classmates: UserProfile[] = [];
        const others: UserProfile[] = [];
        filteredUsers.forEach((u) => {
          if (u.roleId === 'admin') {
            supervisors.push(u);
          } else if (u.roleId === 'teacher') {
            staff.push(u);
          } else if (u.roleId === 'student') {
            classmates.push(u);
          } else {
            others.push(u);
          }
        });
        return { supervisors, staff, classmates, others };
    }, [filteredUsers]);

    const isLoading = areUsersLoading || areThreadsLoading || arePlansLoading;

    const renderUserCard = (otherUser: UserProfile, options?: { supervisor?: boolean }) => {
      const chatId = createChatId(user!.uid, otherUser.id);
      const thread = threadById.get(chatId);
      const unreadCount = thread?.unreadCounts?.[user!.uid] || 0;
      const hasUnread = unreadCount > 0;
      const previewText =
        thread?.lastMessageText && thread.lastMessageText.trim().length > 0
          ? thread.lastMessageText
          : thread?.lastMessageAt
            ? 'Sent an attachment'
            : 'Start a conversation';
      const displayName = options?.supervisor
        ? 'Supervisor'
        : `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() || 'User';

      return (
        <Link href={`/chat/direct/${chatId}`} key={otherUser.id} className="block">
          <div className="flex items-center justify-between rounded-xl border border-transparent bg-background/40 p-3 transition hover:border-border/60 hover:bg-muted/60">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={otherUser.photoURL} />
                <AvatarFallback>
                  {(otherUser.firstName?.charAt(0) || 'U')}
                  {(otherUser.lastName?.charAt(0) || '')}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{displayName}</p>
                  {options?.supervisor ? (
                    <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                      Admin
                    </span>
                  ) : null}
                </div>
                <p className={cn('max-w-52 truncate text-sm', hasUnread ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                  {previewText}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasUnread && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              <Button variant={hasUnread ? 'default' : 'outline'} size="sm" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                {thread?.lastMessageAt ? 'Open' : 'Start'}
              </Button>
            </div>
          </div>
        </Link>
      );
    };

    if (isLoading) {
        return <div className="space-y-2 p-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;
    }

    if (!canTeacherChat && isTeacherAccount) {
      return (
        <div className="p-6">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            Your teacher account is pending admin approval. Direct messages are enabled after approval.
          </div>
        </div>
      );
    }

    return (
        <div className="space-y-2 p-2">
            {isTeacherAccount && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                Teachers can send direct messages only to admins.
              </div>
            )}
            {isStudentAccount && (
              <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-3 text-xs text-cyan-100">
                You can message <span className="font-semibold">Supervisor (Admin)</span> and students from your same exam, same course, or same live batch.
              </div>
            )}
            <div className="sticky top-0 z-10 rounded-xl border border-border/60 bg-card/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <div className="mb-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
                <span>Direct messages</span>
                {unreadThreadCount > 0 && (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                      {unreadThreadCount > 99 ? '99+' : unreadThreadCount}
                    </span>
                    new
                  </span>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={isStudentAccount ? "Search classmates or supervisor..." : "Search people..."}
                  className="pl-9"
                />
              </div>
            </div>
            {filteredUsers.length > 0 ? (
              <>
                {groupedUsers.supervisors.length > 0 && (
                  <div className="px-2 pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Supervisor
                    </p>
                  </div>
                )}
                {groupedUsers.supervisors.map((otherUser) => renderUserCard(otherUser, { supervisor: isStudentAccount }))}

                {!isStudentAccount && groupedUsers.staff.length > 0 && (
                  <div className="px-2 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {isTeacherAccount ? 'Admins' : 'Teachers'}
                    </p>
                  </div>
                )}
                {!isStudentAccount && groupedUsers.staff.map((otherUser) => renderUserCard(otherUser))}

                {groupedUsers.classmates.length > 0 && (
                  <div className="px-2 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {isStudentAccount ? 'Learning Peers' : 'Students'}
                    </p>
                  </div>
                )}
                {groupedUsers.classmates.map((otherUser) => renderUserCard(otherUser))}

                {!isStudentAccount && groupedUsers.others.length > 0 && (
                  <div className="px-2 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Others</p>
                  </div>
                )}
                {!isStudentAccount && groupedUsers.others.map((otherUser) => renderUserCard(otherUser))}
              </>
            ) : <p className="text-muted-foreground text-center p-8">No people found.</p>}
        </div>
    );
}

export default function ChatPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const threadsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'direct_message_threads'), where('participants', 'array-contains', user.uid));
  }, [firestore, user]);
  const { data: threads } = useCollection<DirectMessageThread>(threadsQuery);
  const unreadThreadCount = useMemo(() => {
    if (!threads || !user) return 0;
    return threads.reduce((count, thread) => {
      const unread = thread.unreadCounts?.[user.uid] || 0;
      return unread > 0 ? count + 1 : count;
    }, 0);
  }, [threads, user]);

  const isTeacherAccount = userProfile?.roleId === 'teacher';
  const isStudentAccount = userProfile?.roleId === 'student';
  const isAdminAccount = userProfile?.roleId === 'admin';
  const canTeacherChat = !isTeacherAccount || userProfile?.teacherStatus === 'approved' || userProfile?.roleId === 'admin';
  const useAnnouncementsCommunity = isTeacherAccount;
  const useDualCommunityForAdmin = isAdminAccount;
  const directMessageSubtitle = isTeacherAccount
    ? 'Teachers can have 1:1 conversations with admins only.'
    : isStudentAccount
      ? 'Students can message Supervisor and peers from same exam/course/live batch.'
      : '1:1 conversations with teachers, admins, and students.';

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Chat Hub" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <Card className="shadow-lg border-border/70 bg-gradient-to-br from-background to-muted/40">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="font-headline text-2xl flex items-center gap-2"><MessagesSquare /> Chat Hub</CardTitle>
                <CardDescription>Connect with the community and start direct 1:1 conversations.</CardDescription>
              </div>
              <div className="hidden md:flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                Live & secure
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <button className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-left">
                <div>
                  <p className="text-sm font-semibold">{useDualCommunityForAdmin ? 'Communities' : useAnnouncementsCommunity ? 'Community Announcements' : 'Community Chat'}</p>
                  <p className="text-xs text-muted-foreground">
                    {useDualCommunityForAdmin
                      ? 'Manage teacher announcements and student community chat.'
                      : useAnnouncementsCommunity
                        ? 'Admin announcements for teachers.'
                        : 'Open discussions and announcements.'}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <button className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-left">
                <div>
                  <p className="text-sm font-semibold">Direct Messages</p>
                  <p className="text-xs text-muted-foreground">{directMessageSubtitle}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="community">
              <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1 rounded-2xl">
                <TabsTrigger value="community" className="rounded-xl">Community Chat</TabsTrigger>
                <TabsTrigger value="direct" className="rounded-xl" disabled={isTeacherAccount && !canTeacherChat}>
                  <span className="flex items-center gap-2">
                    Direct Messages
                    {unreadThreadCount > 0 && (
                      <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                        {unreadThreadCount > 99 ? '99+' : unreadThreadCount}
                      </span>
                    )}
                  </span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="community" className="pt-4">
                {useDualCommunityForAdmin ? (
                  <AdminCommunityHub />
                ) : useAnnouncementsCommunity ? (
                  <CommunityAnnouncements canPost={isAdminAccount} />
                ) : (
                  <GroupChat canTeacherChat={canTeacherChat} isTeacherAccount={isTeacherAccount} />
                )}
              </TabsContent>
              <TabsContent value="direct" className="pt-4">
                <DirectMessagesList canTeacherChat={canTeacherChat} isTeacherAccount={isTeacherAccount} isStudentAccount={isStudentAccount} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
