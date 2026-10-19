'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { doc } from 'firebase/firestore';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  Mail,
  Phone,
  RefreshCw,
  User,
} from 'lucide-react';
import DashboardHeader from '@/components/dashboard-header';
import { adminResetUserPassword } from '@/app/admin-password-actions';
import { useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { QUESTION_UPLOAD_ROLE_LABEL, isQuestionUploadRole } from '@/lib/teacher-authoring';

type UserProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  roleId?: 'student' | 'teacher' | 'admin' | 'question_upload';
  status?: 'active' | 'blocked';
  teacherStatus?: 'pending' | 'approved' | 'rejected';
};

const formatDisplayName = (profile?: UserProfile | null, fallback = 'User') => {
  const value = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim();
  return value || fallback;
};

const formatRoleLabel = (roleId?: string | null) => {
  if (roleId === 'admin') return 'Admin';
  if (roleId === 'teacher') return 'Teacher';
  if (isQuestionUploadRole(roleId)) return QUESTION_UPLOAD_ROLE_LABEL;
  return 'Student';
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not recorded yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded yet';
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const buildGeneratedPassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const randomValues = new Uint32Array(12);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomValues);
  } else {
    randomValues.forEach((_, index) => {
      randomValues[index] = Math.floor(Math.random() * alphabet.length);
    });
  }
  return Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join('');
};

export function AdminUserPasswordManagement(props: {
  userId: string;
  managementTitle: string;
  entityLabel: string;
  backHref: string;
}) {
  const { userId, managementTitle, entityLabel, backHref } = props;
  const auth = useAuth();
  const firestore = useFirestore();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftPasswordVisible, setIsDraftPasswordVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [lastPasswordSetAt, setLastPasswordSetAt] = useState<string | null>(null);

  const userRef = useMemoFirebase(
    () => (firestore && userId ? doc(firestore, 'users', userId) : null),
    [firestore, userId]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userRef);

  const roleLabel = useMemo(() => formatRoleLabel(userProfile?.roleId), [userProfile?.roleId]);
  const profileName = useMemo(
    () => formatDisplayName(userProfile, entityLabel === 'teacher' ? 'Teacher' : 'Student'),
    [entityLabel, userProfile]
  );

  const handleGeneratePassword = () => {
    const generated = buildGeneratedPassword();
    setNewPassword(generated);
    setConfirmPassword(generated);
    setIsDraftPasswordVisible(true);
    toast({
      title: 'Password generated',
      description: 'A fresh password has been added to the form.',
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!auth.currentUser) {
      toast({
        variant: 'destructive',
        title: 'Sign in again',
        description: 'Your admin session is missing. Please sign in again.',
      });
      return;
    }

    if (newPassword.trim().length < 8) {
      toast({
        variant: 'destructive',
        title: 'Password too short',
        description: 'Use at least 8 characters for the new password.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Passwords do not match',
        description: 'Make sure both password fields are the same.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const result = await adminResetUserPassword({
        idToken,
        userId,
        newPassword,
      });

      if (!result.success) {
        throw new Error(result.error || 'Could not reset the password.');
      }

      setLastPasswordSetAt(result.updatedAt || new Date().toISOString());
      setNewPassword('');
      setConfirmPassword('');

      toast({
        title: 'Password updated',
        description: `${profileName}'s password has been changed successfully.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Password update failed',
        description: error?.message || 'Could not reset the password.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isAdminLoading || isProfileLoading;

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title={managementTitle} />
        <main className="flex-1 space-y-6 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Skeleton className="h-28 w-full" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-80 w-full" />
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title={managementTitle} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">
              Only admins can access user password management.
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex h-full flex-col">
        <DashboardHeader title={managementTitle} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">
              {entityLabel === 'teacher' ? 'Teacher' : 'Student'} not found.
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title={managementTitle} />
      <main className="flex-1 space-y-6 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight">{profileName}</h1>
              <p className="text-muted-foreground">
                Manage the password for this {entityLabel}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={userProfile.roleId === 'admin' ? 'destructive' : 'secondary'}>
                {roleLabel}
              </Badge>
              {userProfile.status === 'blocked' ? (
                <Badge variant="destructive">Blocked</Badge>
              ) : (
                <Badge variant="outline">Active</Badge>
              )}
              {userProfile.teacherStatus && userProfile.roleId === 'teacher' ? (
                <Badge variant="outline">Teacher status: {userProfile.teacherStatus}</Badge>
              ) : null}
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to User Management
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Name</CardDescription>
              <CardTitle className="flex items-center gap-2 text-xl">
                <User className="h-5 w-5 text-primary" />
                {profileName}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Email</CardDescription>
              <CardTitle className="flex items-center gap-2 text-xl break-all">
                <Mail className="h-5 w-5 text-primary" />
                {userProfile.email || 'Not provided'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Phone</CardDescription>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Phone className="h-5 w-5 text-primary" />
                {userProfile.phoneNumber || 'Not provided'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="mx-auto max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>
                Set a new password for this {entityLabel}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lastPasswordSetAt ? (
                <div className="mb-4 rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Last password set</p>
                  <p className="mt-1 font-medium">{formatDateTime(lastPasswordSetAt)}</p>
                </div>
              ) : null}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">New password</p>
                  <Input
                    value={newPassword}
                    type={isDraftPasswordVisible ? 'text' : 'password'}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Enter a new password"
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Confirm password</p>
                  <Input
                    value={confirmPassword}
                    type={isDraftPasswordVisible ? 'text' : 'password'}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter the new password"
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDraftPasswordVisible((prev) => !prev)}>
                    {isDraftPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {isDraftPasswordVisible ? 'Hide typing' : 'Show typing'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleGeneratePassword}>
                    <RefreshCw className="h-4 w-4" />
                    Generate password
                  </Button>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save new password
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
