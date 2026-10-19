'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ArrowUpRight,
  BadgeCheck,
  Camera,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  Sparkles,
  User as UserIcon,
  UserRound,
} from 'lucide-react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import DashboardHeader from '@/components/dashboard-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { normalizeIndianPhoneDigits, toIndianE164 } from '@/lib/phone-number';
import {
  updateDocumentNonBlocking,
  useAuth,
  useDoc,
  useFirestore,
  useMemoFirebase,
  useStorage,
  useUser,
} from '@/firebase';

const profileFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email(),
  phoneNumber: z.string().min(10, 'A valid phone number is required'),
});

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long.'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'New passwords do not match.',
  path: ['confirmPassword'],
});

type UserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  roleId: 'student' | 'teacher' | 'admin';
  photoURL?: string;
};

const primaryButtonClassName =
  'h-12 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 px-6 font-semibold text-slate-950 shadow-[0_20px_44px_-22px_rgba(56,189,248,0.95)] transition-all hover:brightness-110';
const secondaryButtonClassName =
  'h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-5 text-slate-100 hover:bg-slate-900';
const inputClassName =
  'h-14 rounded-2xl border-white/10 bg-slate-950/70 px-4 text-base text-slate-50 shadow-inner shadow-black/20 placeholder:text-slate-500 focus-visible:ring-cyan-300/60';
const fieldLabelClassName = 'text-[0.8rem] font-semibold uppercase tracking-[0.18em] text-slate-400';

export default function ProfilePage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const watchedFirstName = form.watch('firstName');
  const watchedLastName = form.watch('lastName');
  const phoneNumberValue = form.watch('phoneNumber');

  useEffect(() => {
    if (user) {
      form.setValue('email', user.email || '');
    }

    if (!userProfile) {
      if (user?.photoURL) {
        setImagePreview(user.photoURL);
      }
      return;
    }

    form.reset({
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      email: userProfile.email || user?.email || '',
      phoneNumber: normalizeIndianPhoneDigits(userProfile.phoneNumber),
    });

    if (userProfile.photoURL) {
      setImagePreview(userProfile.photoURL);
    } else if (user?.photoURL) {
      setImagePreview(user.photoURL);
    }
  }, [form, user, userProfile]);

  const normalizedProfilePhone = toIndianE164(phoneNumberValue);
  const isPhoneLoginEnabled = Boolean(normalizedProfilePhone);
  const showLoading = isUserLoading || isProfileLoading;
  const displayName = [watchedFirstName, watchedLastName].filter(Boolean).join(' ') || user?.displayName || 'Your profile';
  const roleLabel = userProfile?.roleId
    ? `${userProfile.roleId[0].toUpperCase()}${userProfile.roleId.slice(1)} account`
    : 'Account';

  const getInitials = () => {
    if (displayName) {
      return displayName
        .split(' ')
        .map((part) => part[0] || '')
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }
    return '';
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please select an image file.',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Please upload an image smaller than 5 MB.',
      });
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onProfileSubmit = async (values: z.infer<typeof profileFormSchema>) => {
    if (!user || !userDocRef) return;

    setIsLoading(true);
    try {
      let newPhotoURL = user.photoURL || '';
      if (imageFile) {
        const sanitizedFileName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const photoRef = ref(storage, `profile_pictures/${user.uid}/${Date.now()}_${sanitizedFileName}`);
        const uploadResult = await uploadBytes(photoRef, imageFile);
        newPhotoURL = await getDownloadURL(uploadResult.ref);
      }

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: `${values.firstName} ${values.lastName}`.trim(),
          photoURL: newPhotoURL,
        });

        if (values.email && values.email !== auth.currentUser.email) {
          await updateEmail(auth.currentUser, values.email);
        }
      }

      await updateDocumentNonBlocking(userDocRef, {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phoneNumber: normalizeIndianPhoneDigits(values.phoneNumber),
        photoURL: newPhotoURL,
      });

      toast({
        title: 'Profile updated',
        description: toIndianE164(values.phoneNumber)
          ? 'Your profile has been updated. This number is now ready for OTP login.'
          : 'Your profile has been updated successfully.',
      });

      setImageFile(null);
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        toast({
          variant: 'destructive',
          title: 'Please sign in again',
          description: 'To change your email address, please sign out and sign back in for security reasons.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: error.message,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onPasswordSubmit = async (values: z.infer<typeof passwordFormSchema>) => {
    setIsPasswordLoading(true);
    const currentUser = auth.currentUser;

    if (!currentUser || !currentUser.email) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not find user information. Please sign in again.',
      });
      setIsPasswordLoading(false);
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, values.currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, values.newPassword);

      toast({
        title: 'Password updated',
        description: 'Your password has been changed successfully.',
      });
      passwordForm.reset();
      setIsPasswordDialogOpen(false);
    } catch (error: any) {
      let description = 'An unexpected error occurred.';
      if (error.code === 'auth/wrong-password') {
        description = 'The current password you entered is incorrect. Please try again.';
      } else if (error.code === 'auth/requires-recent-login') {
        description = 'For your security, please sign out and sign back in before changing your password.';
      } else {
        description = error.message;
      }

      toast({
        variant: 'destructive',
        title: 'Password change failed',
        description,
      });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const resetProfileForm = () => {
    if (!userProfile) return;
    form.reset({
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      email: userProfile.email || user?.email || '',
      phoneNumber: normalizeIndianPhoneDigits(userProfile.phoneNumber),
    });
    setImagePreview(userProfile.photoURL || user?.photoURL || null);
    setImageFile(null);
  };

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="My Profile" />
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(2,8,23,0.98))] p-4 md:p-6 lg:p-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 xl:grid xl:grid-cols-[340px_minmax(0,1fr)] xl:items-start">
          <Card className="overflow-hidden border-white/10 bg-[linear-gradient(180deg,rgba(7,19,42,0.96),rgba(5,10,26,0.98))] shadow-[0_24px_70px_-34px_rgba(8,47,73,0.95)]">
            <CardContent className="p-0">
              <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_46%),linear-gradient(180deg,rgba(15,23,42,0.76),rgba(8,15,31,0.98))] px-6 py-8">
                {showLoading ? (
                  <div className="flex flex-col items-center gap-4">
                    <Skeleton className="h-28 w-28 rounded-full" />
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-56" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <Avatar className="h-28 w-28 border border-cyan-300/20 shadow-[0_0_0_8px_rgba(15,23,42,0.6)]">
                      <AvatarImage src={imagePreview || undefined} />
                      <AvatarFallback className="bg-slate-800 text-2xl font-semibold text-cyan-100">
                        {getInitials() || <UserIcon className="h-10 w-10" />}
                      </AvatarFallback>
                    </Avatar>
                    <Badge className="mt-5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-cyan-100 hover:bg-cyan-400/10">
                      {roleLabel}
                    </Badge>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">{displayName}</h2>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-slate-300">
                      Keep your identity polished across courses, live batches, tests, and purchases.
                    </p>
                  </div>
                )}
              </div>

              <div className="px-6 py-6">
                <button
                  type="button"
                  onClick={() => setIsPasswordDialogOpen(true)}
                  className="group w-full rounded-[28px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(10,20,40,0.92),rgba(6,12,26,0.98))] p-5 text-left transition-all duration-200 hover:-translate-y-[1px] hover:border-cyan-400/28 hover:shadow-[0_18px_40px_-24px_rgba(34,211,238,0.55)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">Security</p>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                          <LockKeyhole className="h-4.5 w-4.5" />
                        </div>
                        <p className="text-lg font-semibold text-white">Change Password</p>
                      </div>
                      <p className="max-w-xs text-sm leading-6 text-slate-300">
                        Open the password popup to update your account password anytime.
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-colors duration-200 group-hover:border-cyan-300/30 group-hover:text-cyan-100">
                        <ArrowUpRight className="h-4 w-4" />
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-300 transition-colors duration-200 group-hover:border-cyan-300/25 group-hover:text-cyan-100">
                        Open
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-8">
            <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(8,15,31,0.98))] shadow-[0_24px_70px_-34px_rgba(8,47,73,0.95)]">
              <CardHeader className="border-b border-white/8 pb-5">
                <div>
                  <div>
                    <div className="flex items-center gap-2 text-cyan-200">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-[0.24em]">Profile Studio</span>
                    </div>
                    <CardTitle className="mt-3 font-headline text-3xl tracking-tight text-white">Manage Your Profile</CardTitle>
                    <CardDescription className="mt-2 max-w-2xl text-base leading-7 text-slate-300">
                      Update the details students, teachers, and payment flows rely on every day.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                {showLoading ? (
                  <div className="space-y-8">
                    <div className="flex items-center gap-6">
                      <Skeleton className="h-28 w-28 rounded-[2rem]" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <Skeleton className="h-12 w-40 rounded-2xl" />
                  </div>
                ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onProfileSubmit)} className="space-y-8">
                      <div className="space-y-3">
                        <label className={fieldLabelClassName}>Profile Picture</label>
                        <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
                          <Avatar className="h-28 w-28 border border-white/10 shadow-[0_12px_28px_-18px_rgba(15,23,42,1)]">
                            <AvatarImage src={imagePreview || undefined} />
                            <AvatarFallback className="bg-slate-800 text-2xl font-semibold text-cyan-100">
                              {getInitials() || <UserIcon className="h-8 w-8" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                                <Camera className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-white">Upload a clean profile photo</p>
                                <p className="text-sm text-slate-400">Square images under 5 MB look best across the workspace.</p>
                              </div>
                            </div>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              className={cn(
                                inputClassName,
                                'mt-4 max-w-xl file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-400/15 file:px-4 file:py-2 file:font-semibold file:text-cyan-100 hover:file:bg-cyan-400/20'
                              )}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={fieldLabelClassName}>First Name</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                  <Input {...field} placeholder="Anjali" className={cn(inputClassName, 'pl-11')} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={fieldLabelClassName}>Last Name</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                  <Input {...field} placeholder="Patel" className={cn(inputClassName, 'pl-11')} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={fieldLabelClassName}>Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <Input {...field} placeholder="user@example.com" className={cn(inputClassName, 'pl-11')} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={fieldLabelClassName}>Phone Number</FormLabel>

                            <FormControl>
                              <div className="relative">
                                <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <Input {...field} placeholder="e.g. 9876543210" className={cn(inputClassName, 'pl-11')} />
                              </div>
                            </FormControl>

                            <p className="text-sm leading-6 text-slate-400">
                              {isPhoneLoginEnabled
                                ? 'This number is active for OTP login. If you change it and save again, the new number becomes the login number.'
                                : 'Save a 10-digit mobile number here to enable OTP login for this account.'}
                            </p>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex flex-wrap gap-3 pt-2">
                        <Button type="submit" className={primaryButtonClassName} disabled={isLoading}>
                          {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                          Save Changes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={secondaryButtonClassName}
                          onClick={resetProfileForm}
                          disabled={isLoading}
                        >
                          Reset
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>

            <Card className="hidden border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(8,15,31,0.98))] shadow-[0_24px_70px_-34px_rgba(8,47,73,0.95)]">
              <CardHeader className="border-b border-white/8 pb-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200">
                    <LockKeyhole className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl text-white">Change Password</CardTitle>
                    <CardDescription className="mt-2 max-w-2xl text-base leading-7 text-slate-300">
                      Keep your account secure with a fresh password that is unique and strong.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={fieldLabelClassName}>Current Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} className={inputClassName} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={fieldLabelClassName}>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} className={inputClassName} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={fieldLabelClassName}>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} className={inputClassName} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className={primaryButtonClassName} disabled={isPasswordLoading}>
                      {isPasswordLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                      Change Password
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={(open) => {
          setIsPasswordDialogOpen(open);
          if (!open) {
            passwordForm.reset();
          }
        }}
      >
        <DialogContent className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(8,15,31,0.99))] text-white shadow-[0_24px_70px_-34px_rgba(8,47,73,0.95)] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl text-white">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200">
                <LockKeyhole className="h-5 w-5" />
              </span>
              Change Password
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-slate-300">
              Update your password in this popup and keep your account secure.
            </DialogDescription>
          </DialogHeader>

          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={fieldLabelClassName}>Current Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} className={inputClassName} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={fieldLabelClassName}>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} className={inputClassName} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={fieldLabelClassName}>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} className={inputClassName} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="submit" className={primaryButtonClassName} disabled={isPasswordLoading}>
                  {isPasswordLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                  Change Password
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={secondaryButtonClassName}
                  onClick={() => setIsPasswordDialogOpen(false)}
                  disabled={isPasswordLoading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
