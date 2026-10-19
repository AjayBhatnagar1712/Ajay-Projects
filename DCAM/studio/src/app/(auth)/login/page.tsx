'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth, useFirestore } from '@/firebase';
import {
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
  RecaptchaVerifier,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  updateProfile,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { useState, useEffect, useRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GoogleAuthHandler } from '@/components/auth/google-auth-handler';
import { resolveSavedPhoneOtpLogin } from '@/app/actions';
import { collection, doc, getDoc, getDocs, limit, query, where, writeBatch } from 'firebase/firestore';
import { designatedAdminEmail, firebaseConfig } from '@/firebase/config';
import {
  canReachFirebaseAuthApi,
  getFirebaseAuthErrorCode,
  getFirebaseAuthErrorMessage,
  isFirebaseAuthNetworkError,
  isLocalHost,
} from '@/firebase/auth-error-message';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ToastAction } from '@/components/ui/toast';
import { queuePostLoginToast } from '@/lib/post-login-toast';
import { isSameIndianPhone, normalizeIndianPhoneDigits, toIndianE164 } from '@/lib/phone-number';

const emailFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const phoneFormSchema = z.object({
    phoneNumber: z.string().min(10, 'Please enter a valid 10-digit phone number.').max(10, 'Please enter a valid 10-digit phone number.'),
});

const otpFormSchema = z.object({
    otp: z.string().length(6, 'OTP must be 6 digits.'),
});

type UserProfile = {
  id: string;
  roleId?: 'student' | 'teacher' | 'admin';
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
};

type FirebaseErrorLike = {
  code?: string;
  message?: string;
};

function splitDisplayName(displayName?: string | null) {
  const parts = (displayName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

function isTransientProfileReadError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = (error as FirebaseErrorLike).code;
  return code === 'unavailable' || code === 'deadline-exceeded' || code === 'failed-precondition';
}

function shouldRetryPhoneVerification(error: unknown) {
  const code = getFirebaseAuthErrorCode(error);
  const message = ((error as FirebaseErrorLike | null)?.message || '').toLowerCase();
  return code === 'auth/invalid-app-credential'
    || code === 'auth/captcha-check-failed'
    || code === 'auth/code-expired'
    || message.includes('timeout');
}

function hasCompletedRole(profile?: UserProfile | null) {
  return Boolean(profile?.roleId);
}

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [phoneIsLoading, setPhoneIsLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const sendOtpButtonId = 'send-otp-button';
  const [activeTab, setActiveTab] = useState('email');
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const [pendingPhoneUser, setPendingPhoneUser] = useState<User | null>(null);
  const [pendingPhoneE164, setPendingPhoneE164] = useState('');
  const [registrationDetails, setRegistrationDetails] = useState({
    firstName: '',
    lastName: '',
  });
  const [isFinalizingPhoneRegistration, setIsFinalizingPhoneRegistration] = useState(false);
  const inputClassName = 'h-12 rounded-xl border-white/15 bg-slate-900/60 text-white placeholder:text-slate-400 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-0';
  const primaryButtonClassName = 'h-12 w-full rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-500 font-semibold text-white shadow-[0_14px_30px_-14px_rgba(56,189,248,0.95)] transition-all hover:brightness-110 hover:shadow-[0_20px_42px_-16px_rgba(34,211,238,0.9)] active:scale-[0.99]';

  const resetRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      recaptchaVerifierRef.current = null;
    }
  };

  const initializeRecaptcha = async () => {
    if (!auth) {
      throw new Error('Auth is not initialized.');
    }
    if (!document.getElementById(sendOtpButtonId)) {
      throw new Error('Send OTP button is not ready for reCAPTCHA.');
    }
    resetRecaptcha();
    const verifier = new RecaptchaVerifier(auth, sendOtpButtonId, {
      size: 'invisible',
      callback: () => undefined,
      'expired-callback': () => undefined,
    });
    recaptchaVerifierRef.current = verifier;
    await verifier.render();
    return verifier;
  };

  useEffect(() => {
    if (activeTab !== 'phone') {
      resetRecaptcha();
    }
  }, [activeTab]);

  useEffect(() => {
    return () => resetRecaptcha();
  }, []);

  const emailForm = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const triggerPasswordResetForEmail = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: 'Password Reset Email Sent',
        description: `If an account exists for ${email}, you will receive a reset link shortly.`,
      });
    } catch (resetError) {
      console.error('Failed to trigger password reset from login page', resetError);
      toast({
        title: 'Password Reset Email Sent',
        description: `If an account exists for ${email}, you will receive a reset link shortly.`,
      });
    }
  };

  async function onEmailSubmit(values: z.infer<typeof emailFormSchema>) {
    const normalizedEmail = values.email.trim().toLowerCase();
    setIsLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, values.password);
      const currentUser = credential.user;

      const userDocRef = doc(firestore, 'users', currentUser.uid);

      try {
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const profile = userDocSnap.data() as UserProfile;
          if (profile?.roleId) {
            queuePostLoginToast({
              title: 'Login Successful',
              description: `Welcome back, ${currentUser.displayName || 'User'}!`,
            });
            router.push('/dashboard');
            return;
          }

          const inferred = splitDisplayName(currentUser.displayName);
          setRegistrationDetails({
            firstName: profile?.firstName || inferred.firstName,
            lastName: profile?.lastName || inferred.lastName,
          });
        } else {
          const inferred = splitDisplayName(currentUser.displayName);
          setRegistrationDetails({
            firstName: inferred.firstName,
            lastName: inferred.lastName,
          });
        }

        setPendingPhoneE164(currentUser.phoneNumber || '');
        setPendingPhoneUser(currentUser);
        toast({
          title: 'Complete your account',
          description: 'Choose Student or Teacher to continue.',
        });
      } catch (profileError: unknown) {
        if (!isTransientProfileReadError(profileError)) {
          throw profileError;
        }

        console.warn('Profile read failed after successful email login', {
          code: getFirebaseAuthErrorCode(profileError),
          message: (profileError as FirebaseErrorLike | null)?.message || 'Unknown error',
        });
        queuePostLoginToast({
          title: 'Login Successful',
          description: 'Signed in. Profile sync will continue automatically when the connection stabilizes.',
        });
        router.push('/dashboard');
        return;
      }
    } catch (error: unknown) {
      const runningOnLocalhost = typeof window !== 'undefined' && isLocalHost(window.location.hostname);
      const errorCode = getFirebaseAuthErrorCode(error);
      let description = getFirebaseAuthErrorMessage(error, runningOnLocalhost);

      const isInvalidCredentialError = errorCode === 'auth/invalid-credential' || errorCode === 'auth/invalid-login-credentials';
      if (isInvalidCredentialError) {
        try {
          const signInMethods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
          const supportsPassword = signInMethods.includes('password');
          const supportsGoogle = signInMethods.includes(GoogleAuthProvider.PROVIDER_ID);

          if (supportsGoogle && !supportsPassword) {
            toast({
              variant: 'destructive',
              title: 'This account uses Google sign-in',
              description: 'Use Google to sign in, or send a reset link to create an email password.',
              action: (
                <ToastAction
                  altText="Send reset link"
                  onClick={() => {
                    void triggerPasswordResetForEmail(normalizedEmail);
                  }}
                >
                  Send reset link
                </ToastAction>
              ),
            });
            return;
          }
        } catch (methodsError) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Could not fetch sign-in methods after login failure', {
              code: getFirebaseAuthErrorCode(methodsError),
              message: (methodsError as { message?: string } | null)?.message || 'Unknown error',
            });
          }
        }
      }

      if (runningOnLocalhost && isFirebaseAuthNetworkError(error)) {
        const apiReachable = await canReachFirebaseAuthApi(firebaseConfig.apiKey);
        if (apiReachable) {
          description = `${description} Firebase API is reachable from localhost, so check browser privacy settings and extensions.`;
        }
      }

      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description,
      });

      if (process.env.NODE_ENV !== 'production') {
        const expectedLoginFailure = errorCode === 'auth/invalid-credential'
          || errorCode === 'auth/invalid-login-credentials'
          || errorCode === 'auth/user-disabled'
          || errorCode === 'auth/too-many-requests';

        if (!expectedLoginFailure) {
          console.warn('Email login failed (unexpected)', {
            code: errorCode,
            message: (error as { message?: string } | null)?.message || 'Unknown error',
            origin: typeof window !== 'undefined' ? window.location.origin : undefined,
            projectId: firebaseConfig.projectId,
            authDomain: firebaseConfig.authDomain,
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  const phoneForm = useForm<z.infer<typeof phoneFormSchema>>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: {
        phoneNumber: '',
    }
  });

  const otpForm = useForm<z.infer<typeof otpFormSchema>>({
    resolver: zodResolver(otpFormSchema),
    defaultValues: {
        otp: '',
    }
  });

  async function onPhoneSubmit(values: z.infer<typeof phoneFormSchema>) {
    setPhoneIsLoading(true);
    try {
        const cleaned = normalizeIndianPhoneDigits(values.phoneNumber);
        if (cleaned.length !== 10) throw new Error('Please enter a valid 10-digit phone number.');
        const phoneNumber = toIndianE164(cleaned);

        let confirmation: ConfirmationResult;
        try {
          const verifier = await initializeRecaptcha();
          confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
        } catch (firstAttemptError) {
          if (!shouldRetryPhoneVerification(firstAttemptError)) {
            throw firstAttemptError;
          }

          const retryVerifier = await initializeRecaptcha();
          confirmation = await signInWithPhoneNumber(auth, phoneNumber, retryVerifier);
        }

        setConfirmationResult(confirmation);
        setPendingPhoneE164(phoneNumber);
        toast({
            title: "OTP Sent",
            description: `A verification code has been sent to ${phoneNumber}.`
        });
    } catch (error: unknown) {
        const code = getFirebaseAuthErrorCode(error);
        let description = (error as { message?: string } | null)?.message || 'Could not send OTP.';
        const runningOnLocalhost = typeof window !== 'undefined' && isLocalHost(window.location.hostname);
        if (code === 'auth/invalid-app-credential') {
          description = runningOnLocalhost
            ? 'App verification failed on localhost. Add localhost in Firebase Auth Authorized domains and disable strict privacy/ad-block extensions, then try again.'
            : 'App verification failed. Please try again in a few moments.';
        } else if (code === 'auth/too-many-requests') {
          description = 'Too many attempts. Please wait a few minutes and try again.';
        } else if (code === 'auth/captcha-check-failed') {
          description = 'reCAPTCHA verification failed. Please retry.';
        } else if (code === 'auth/code-expired' || `${description}`.toLowerCase().includes('timeout')) {
          description = 'Verification timed out. Please retry sending OTP.';
        }
        resetRecaptcha();
        toast({
            variant: "destructive",
            title: "Failed to send OTP",
            description,
        });
    } finally {
        setPhoneIsLoading(false);
    }
  }

  async function onOtpSubmit(values: z.infer<typeof otpFormSchema>) {
    if (!confirmationResult) {
        toast({ variant: 'destructive', title: 'Verification Error', description: 'Please request an OTP first.' });
        return;
    }
    setPhoneIsLoading(true);
    try {
        const credential = await confirmationResult.confirm(values.otp);
        const currentUser = credential.user;
        const userDocRef = doc(firestore, 'users', currentUser.uid);

        try {
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const profile = userDocSnap.data() as UserProfile;
            if (hasCompletedRole(profile)) {
              queuePostLoginToast({
                title: 'Login Successful',
                description: `Welcome back, ${currentUser.displayName || 'User'}!`,
              });
              router.push('/dashboard');
              return;
            }
          }

          const matchedProfiles = new Map<string, UserProfile>();
          const possibleNumbers = Array.from(
            new Set(
              [
                currentUser.phoneNumber || '',
                pendingPhoneE164,
                values.otp ? pendingPhoneE164 : '',
                phoneForm.getValues('phoneNumber'),
              ]
                .flatMap((value) => {
                  const digits = normalizeIndianPhoneDigits(value);
                  const e164 = toIndianE164(value);
                  return [digits, e164].filter(Boolean);
                })
            )
          );

          for (const phoneCandidate of possibleNumbers) {
            const snapshot = await getDocs(
              query(collection(firestore, 'users'), where('phoneNumber', '==', phoneCandidate), limit(3))
            );
            snapshot.docs.forEach((entry) => {
              matchedProfiles.set(entry.id, entry.data() as UserProfile);
            });
          }

          const existingCompletedAccount = Array.from(matchedProfiles.entries()).find(([profileId, profile]) =>
            profileId !== currentUser.uid && hasCompletedRole(profile) && isSameIndianPhone(profile.phoneNumber, currentUser.phoneNumber || pendingPhoneE164)
          );

          if (existingCompletedAccount) {
            const idToken = await currentUser.getIdToken();
            const resolvedLogin = await resolveSavedPhoneOtpLogin({ idToken });

            if (resolvedLogin.success && resolvedLogin.customToken) {
              await signInWithCustomToken(auth, resolvedLogin.customToken);
              setConfirmationResult(null);
              otpForm.reset();
              queuePostLoginToast({
                title: 'Login Successful',
                description: 'Welcome back! OTP login opened your saved account.',
              });
              router.push('/dashboard');
              return;
            }

            await signOut(auth);
            setConfirmationResult(null);
            otpForm.reset();
            toast({
              variant: 'destructive',
              title: 'Phone login unavailable',
              description: resolvedLogin.error || 'This number is saved in your profile, but the existing account could not be opened with OTP right now.',
            });
            return;
          }

          await signOut(auth);
          setConfirmationResult(null);
          otpForm.reset();
          toast({
            variant: 'destructive',
            title: 'Phone login unavailable',
            description: 'This number is not linked to a completed account. Use Email or Google login.',
          });
          return;
        } catch (profileError: unknown) {
          if (!isTransientProfileReadError(profileError)) {
            throw profileError;
          }

          console.warn('Profile read failed after successful OTP login', {
            code: getFirebaseAuthErrorCode(profileError),
            message: (profileError as FirebaseErrorLike | null)?.message || 'Unknown error',
          });
          queuePostLoginToast({
            title: 'Login Successful',
            description: 'Signed in. Profile sync will continue automatically when the connection stabilizes.',
          });
          router.push('/dashboard');
          return;
        }
    } catch (error: unknown) {
        const errorCode = getFirebaseAuthErrorCode(error);
        const isOtpFailure = errorCode === 'auth/invalid-verification-code' || errorCode === 'auth/code-expired';
        const runningOnLocalhost = typeof window !== 'undefined' && isLocalHost(window.location.hostname);
        toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: isOtpFailure
              ? 'The OTP is invalid or has expired. Please try again.'
              : getFirebaseAuthErrorMessage(error, runningOnLocalhost),
        });
    } finally {
        setPhoneIsLoading(false);
    }
  }

  async function finalizePhoneRegistration(role: 'student' | 'teacher') {
    if (!pendingPhoneUser) return;
    const firstName = registrationDetails.firstName.trim();
    const lastName = registrationDetails.lastName.trim();

    if (!firstName || !lastName) {
      toast({
        variant: 'destructive',
        title: 'Name required',
        description: 'Please enter both first name and last name.',
      });
      return;
    }

    setIsFinalizingPhoneRegistration(true);
    try {
      const userRef = doc(firestore, 'users', pendingPhoneUser.uid);
      const batch = writeBatch(firestore);

      const userData: any = {
        id: pendingPhoneUser.uid,
        firstName,
        lastName,
        email: pendingPhoneUser.email || '',
        phoneNumber: pendingPhoneE164 || pendingPhoneUser.phoneNumber || '',
        roleId: role,
        status: 'active',
        photoURL: pendingPhoneUser.photoURL || '',
      };

      if (role === 'teacher') {
        userData.teacherStatus = 'pending';
      }

      if ((pendingPhoneUser.email || '').toLowerCase() === designatedAdminEmail) {
        userData.roleId = 'admin';
        userData.teacherStatus = 'approved';
        const adminRoleRef = doc(firestore, 'roles_admin', pendingPhoneUser.uid);
        const teacherRoleRef = doc(firestore, 'roles_teacher', pendingPhoneUser.uid);
        batch.set(adminRoleRef, { createdAt: new Date().toISOString() }, { merge: true });
        batch.set(teacherRoleRef, { createdAt: new Date().toISOString() }, { merge: true });
      }

      batch.set(userRef, userData, { merge: true });
      await batch.commit();

      await updateProfile(pendingPhoneUser, {
        displayName: `${firstName} ${lastName}`.trim(),
      });

      setPendingPhoneUser(null);
      setConfirmationResult(null);
      otpForm.reset();
      phoneForm.reset();
      queuePostLoginToast({
        title: userData.roleId === 'teacher' && userData.teacherStatus === 'pending' ? 'Teacher Request Submitted' : 'Account created',
        description: userData.roleId === 'teacher' && userData.teacherStatus === 'pending'
          ? 'Your teacher account is waiting for admin approval.'
          : `Your ${userData.roleId} account is ready.`,
      });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Registration failed',
        description: error.message || 'Could not complete account creation.',
      });
    } finally {
      setIsFinalizingPhoneRegistration(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_12%_8%,_rgba(56,189,248,0.2),_transparent_38%),radial-gradient(circle_at_88%_20%,_rgba(59,130,246,0.16),_transparent_40%),linear-gradient(180deg,_#050913_0%,_#0a1220_42%,_#0b1524_100%)] text-white">
      <div className="relative overflow-hidden">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute top-32 -right-24 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
          <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="hidden lg:flex flex-col justify-between rounded-3xl border border-cyan-300/15 bg-slate-950/45 p-10 shadow-[0_30px_80px_-36px_rgba(56,189,248,0.7)] backdrop-blur">
              <div>
                <Link href="/dashboard" className="flex items-center gap-3">
                  <Logo className="h-10 w-10 text-cyan-200" />
                  <div>
                    <p className="text-sm uppercase tracking-[0.35em] text-cyan-200/70">DCAM</p>
                    <p className="font-headline text-2xl font-semibold text-white">Classes</p>
                  </div>
                </Link>
                <h1 className="mt-10 text-4xl font-semibold leading-tight text-white">
                  Prep smarter with a login built for speed.
                </h1>
                <p className="mt-4 text-base text-slate-200/80">
                  Access your study dashboard, practice, and live sessions in seconds with a seamless sign-in
                  experience across email, phone, and Google.
                </p>
              </div>
              <div className="space-y-4 text-sm text-slate-200/70">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-cyan-300" />
                  Streamlined course delivery and exam prep.
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-amber-300" />
                  Secure role-based access across the platform.
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-sky-300" />
                  Built for scale, clarity, and speed.
                </div>
              </div>
            </div>

            <Card className="w-full max-w-md justify-self-center border-white/15 bg-slate-950/60 text-white shadow-[0_35px_80px_-40px_rgba(34,211,238,0.95)] backdrop-blur-xl">
              <CardHeader className="text-center">
                <Link href="/dashboard" className="flex items-center gap-2 justify-center mb-4">
                  <Logo className="w-8 h-8 text-cyan-200" />
                  <span className="font-headline text-2xl font-semibold text-white">
                    DCAM Classes
                  </span>
                </Link>
                <CardTitle className="text-3xl text-white">Welcome Back</CardTitle>
                <CardDescription className="text-slate-300">Log in to continue your exam journey.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="email" className="w-full" onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2 rounded-xl border border-white/10 bg-slate-900/60 p-1">
                    <TabsTrigger value="email" className="rounded-lg text-slate-300 data-[state=active]:bg-cyan-400/20 data-[state=active]:text-white">Email</TabsTrigger>
                    <TabsTrigger value="phone" className="rounded-lg text-slate-300 data-[state=active]:bg-cyan-400/20 data-[state=active]:text-white">Phone</TabsTrigger>
                  </TabsList>
                  <TabsContent value="email">
                    <Form {...emailForm}>
                      <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4 pt-4">
                        <FormField
                          control={emailForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-200">Email</FormLabel>
                              <FormControl>
                                <Input placeholder="user@example.com" {...field} className={inputClassName} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={emailForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-slate-200">Password</FormLabel>
                                <Link
                                  href="/forgot-password"
                                  className="text-sm font-medium text-cyan-200 transition-colors hover:text-cyan-100 hover:underline"
                                >
                                  Forgot Password?
                                </Link>
                              </div>
                              <FormControl>
                                <Input type="password" placeholder="********" {...field} className={inputClassName} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className={primaryButtonClassName} disabled={isLoading}>
                          {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                          Log In Securely
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>
                  <TabsContent value="phone">
                    {!confirmationResult ? (
                      <Form {...phoneForm}>
                        <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4 pt-4">
                          <FormField
                            control={phoneForm.control}
                            name="phoneNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-200">Phone Number</FormLabel>
                                <div className="flex items-center">
                                  <span className="inline-flex h-12 items-center px-4 rounded-l-xl border border-r-0 border-white/15 bg-slate-900/60 text-sm text-slate-300">+91</span>
                                  <Input type="tel" placeholder="9876543210" {...field} className={`${inputClassName} rounded-l-none`} />
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button id={sendOtpButtonId} type="submit" className={primaryButtonClassName} disabled={phoneIsLoading}>
                            {phoneIsLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Send OTP Code
                          </Button>
                        </form>
                      </Form>
                    ) : (
                      <div>
                        <div className="text-center text-sm text-slate-300/80 mb-4 pt-4">
                          <p>
                            Enter the code sent to +91 {phoneForm.getValues('phoneNumber')}.
                          </p>
                          <Button
                            type="button"
                            variant="link"
                            className="p-0 h-auto font-medium text-cyan-200"
                            onClick={() => setConfirmationResult(null)}
                          >
                            Change number?
                          </Button>
                        </div>

                        <Form {...otpForm}>
                          <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
                            <FormField
                              control={otpForm.control}
                              name="otp"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-200">Verification Code</FormLabel>
                                  <FormControl>
                                    <Input type="tel" placeholder="Enter 6-digit OTP" {...field} className={inputClassName} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button type="submit" className={primaryButtonClassName} disabled={phoneIsLoading}>
                              {phoneIsLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Verify & Log In
                            </Button>
                          </form>
                        </Form>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="mt-6">
                  <GoogleAuthHandler ctaMode="login" />
                </div>
                
                <div className="mt-6 text-center text-sm text-slate-300/80">
                  <p>
                    Don&apos;t have an account?{' '}
                    <Link href="/signup" className="font-medium text-cyan-200 hover:underline">
                      Sign up
                    </Link>
                  </p>
                </div>
              </CardContent>
              <AlertDialog open={!!pendingPhoneUser}>
                <AlertDialogContent className="bg-slate-900 text-white border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Complete Account Creation</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-300">
                      This account is missing profile details. Choose Student or Teacher to continue.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-200">First Name</label>
                      <Input
                        value={registrationDetails.firstName}
                        onChange={(e) => setRegistrationDetails((prev) => ({ ...prev, firstName: e.target.value }))}
                        placeholder="First name"
                        disabled={isFinalizingPhoneRegistration}
                        className="bg-white/5 border-white/10 text-white placeholder:text-slate-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-200">Last Name</label>
                      <Input
                        value={registrationDetails.lastName}
                        onChange={(e) => setRegistrationDetails((prev) => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Last name"
                        disabled={isFinalizingPhoneRegistration}
                        className="bg-white/5 border-white/10 text-white placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <AlertDialogFooter className="sm:justify-center gap-3">
                    <Button
                      onClick={() => finalizePhoneRegistration('student')}
                      disabled={isFinalizingPhoneRegistration}
                      className="w-full sm:w-auto bg-cyan-500 text-white hover:bg-cyan-400"
                    >
                      {isFinalizingPhoneRegistration ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Register as Student
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => finalizePhoneRegistration('teacher')}
                      disabled={isFinalizingPhoneRegistration}
                      className="w-full sm:w-auto"
                    >
                      {isFinalizingPhoneRegistration ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Register as Teacher
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
