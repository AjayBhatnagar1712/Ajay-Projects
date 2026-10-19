'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import type { FirebaseError } from 'firebase/app';
import {
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  getRedirectResult,
  linkWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
  type AuthCredential,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoaderCircle } from 'lucide-react';
import { getFirebaseAuthErrorCode, getFirebaseAuthErrorMessage, isLocalHost } from '@/firebase/auth-error-message';
import { designatedAdminEmail } from '@/firebase/config';
import { queuePostLoginToast } from '@/lib/post-login-toast';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';

type PendingGoogleLink = {
  email: string;
  credential: AuthCredential;
};

type AppGoogleSignInResultDetail = {
  status: 'success' | 'error';
  idToken?: string | null;
  accessToken?: string | null;
  code?: string | null;
  message?: string | null;
};

declare global {
  interface Window {
    DcamAppBridge?: {
      postMessage(message: string): void;
    };
  }
}

const REDIRECT_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);
const APP_EXTERNAL_BROWSER_BRIDGE_URL = 'dcamclassesapp://open-external';
const APP_NATIVE_GOOGLE_SIGN_IN_REQUEST = JSON.stringify({ type: 'google-sign-in' });
const APP_NATIVE_GOOGLE_SIGN_IN_RESULT_EVENT = 'dcam-app-google-sign-in-result';
const SILENT_GOOGLE_SIGN_IN_CODES = new Set([
  'auth/popup-closed-by-user',
]);

function isEmbeddedBrowserUserAgent(userAgent: string) {
  const normalizedUserAgent = userAgent.toLowerCase();
  const isAndroidWebView = normalizedUserAgent.includes('android')
    && (normalizedUserAgent.includes('; wv')
      || (normalizedUserAgent.includes('version/')
        && normalizedUserAgent.includes('chrome/')
        && !normalizedUserAgent.includes('samsungbrowser/')));
  const isIosWebView = /(iphone|ipad|ipod)/.test(normalizedUserAgent)
    && normalizedUserAgent.includes('applewebkit')
    && !normalizedUserAgent.includes('safari');

  return isAndroidWebView || isIosWebView;
}

function createExternalBrowserBridgeUrl(targetUrl: string) {
  return `${APP_EXTERNAL_BROWSER_BRIDGE_URL}?url=${encodeURIComponent(targetUrl)}`;
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function normalizePhotoUrl(value: unknown) {
  return String(value || '').trim();
}

type GoogleAuthHandlerProps = {
    ctaMode?: 'default' | 'login' | 'signup';
};

export function GoogleAuthHandler({ ctaMode = 'default' }: GoogleAuthHandlerProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [newUser, setNewUser] = useState<User | null>(null);
    const [pendingGoogleLink, setPendingGoogleLink] = useState<PendingGoogleLink | null>(null);
    const [linkPassword, setLinkPassword] = useState('');
    const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
    const [isSendingReset, setIsSendingReset] = useState(false);
    const [isEmbeddedBrowser, setIsEmbeddedBrowser] = useState(false);
    const [hasNativeGoogleBridge, setHasNativeGoogleBridge] = useState(false);
    const [showEmbeddedBrowserDialog, setShowEmbeddedBrowserDialog] = useState(false);
    const auth = useAuth();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const dividerLabel = ctaMode === 'login'
        ? 'Fast-track access'
        : ctaMode === 'signup'
            ? 'Quick account setup'
            : 'Or continue with';
    const googleButtonLabel = ctaMode === 'login'
        ? 'Continue with Google'
        : ctaMode === 'signup'
            ? 'Sign up with Google'
            : 'Continue with Google';
    const embeddedBrowserButtonLabel = ctaMode === 'signup'
        ? 'Sign up with Google in Chrome'
        : 'Continue with Google in Chrome';
    const effectiveGoogleButtonLabel = isEmbeddedBrowser && !hasNativeGoogleBridge
        ? embeddedBrowserButtonLabel
        : googleButtonLabel;

    useEffect(() => {
        if (typeof navigator === 'undefined' || typeof window === 'undefined') {
            return;
        }

        setIsEmbeddedBrowser(isEmbeddedBrowserUserAgent(navigator.userAgent));
        setHasNativeGoogleBridge(typeof window.DcamAppBridge?.postMessage === 'function');
    }, []);

    const handleAuthenticatedGoogleUser = useCallback(async (user: User) => {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const isDesignatedAdmin = user.email?.toLowerCase() === designatedAdminEmail;

        if (userDocSnap.exists()) {
            // Existing user: Update their info and check for admin promotion.
            const batch = writeBatch(firestore);
            const [firstName, ...lastName] = user.displayName?.split(' ') || ['', ''];
            const userDocData = userDocSnap.data();
            const existingPhotoURL = normalizePhotoUrl(userDocData.photoURL);
            const googlePhotoURL = normalizePhotoUrl(user.photoURL);
            const resolvedPhotoURL = existingPhotoURL || googlePhotoURL;

            const updatedData: any = {
                firstName: firstName || userDocData.firstName,
                lastName: lastName.join(' ') || userDocData.lastName,
                email: user.email,
            };
            if (resolvedPhotoURL) {
                updatedData.photoURL = resolvedPhotoURL;
            }

            if (isDesignatedAdmin) {
                updatedData.roleId = 'admin';
                updatedData.teacherStatus = 'approved';
                const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
                const teacherRoleRef = doc(firestore, 'roles_teacher', user.uid);
                batch.set(adminRoleRef, { createdAt: new Date().toISOString() }, { merge: true });
                batch.set(teacherRoleRef, { createdAt: new Date().toISOString() }, { merge: true });
            }

            batch.set(userDocRef, updatedData, { merge: true });
            await batch.commit();

            if (existingPhotoURL && googlePhotoURL !== existingPhotoURL) {
                try {
                    await updateProfile(user, { photoURL: existingPhotoURL });
                } catch (error) {
                    console.warn('Could not preserve existing profile photo on Google sign-in.', error);
                }
            }

            queuePostLoginToast({
                title: 'Login Successful',
                description: `Welcome back, ${user.displayName || 'User'}!`,
            });
            router.push('/dashboard');
            return;
        }

        // New user: trigger the role selection dialog.
        setNewUser(user);
    }, [firestore, router, toast]);

    const reportGoogleSignInError = useCallback((error: unknown) => {
        const code = getFirebaseAuthErrorCode(error);
        if (code && SILENT_GOOGLE_SIGN_IN_CODES.has(code)) {
            return;
        }

        const runningOnLocalhost = typeof window !== 'undefined' && isLocalHost(window.location.hostname);
        toast({
            variant: 'destructive',
            title: 'Google Sign-In Failed',
            description: getFirebaseAuthErrorMessage(error, runningOnLocalhost),
        });
        if (process.env.NODE_ENV !== 'production') {
            console.error('Google sign-in failed', {
                error,
                code,
                origin: typeof window !== 'undefined' ? window.location.origin : undefined,
            });
        }
    }, [toast]);

    const openCurrentPageInBrowser = useCallback(() => {
        if (typeof window === 'undefined') {
            return;
        }

        window.location.assign(createExternalBrowserBridgeUrl(window.location.href));
    }, []);

    const requestNativeGoogleSignIn = useCallback(() => {
        if (typeof window === 'undefined' || typeof window.DcamAppBridge?.postMessage !== 'function') {
            return false;
        }

        window.DcamAppBridge.postMessage(APP_NATIVE_GOOGLE_SIGN_IN_REQUEST);
        return true;
    }, []);

    const reportNativeGoogleSignInError = useCallback((detail: AppGoogleSignInResultDetail) => {
        if (detail.code === 'canceled') {
            return;
        }

        let description = detail.message || 'Google sign-in could not be completed in the app. Please try again.';
        if (detail.code === 'clientConfigurationError') {
            description = 'Google sign-in is not configured correctly for this Android app build yet.';
        } else if (detail.code === 'uiUnavailable') {
            description = 'Google sign-in is temporarily unavailable on this device. Please try again.';
        }

        toast({
            variant: 'destructive',
            title: 'Google Sign-In Failed',
            description,
        });
    }, [toast]);

    const resolveAccountExistsWithDifferentCredential = useCallback(async (error: unknown) => {
        const pendingCredential = GoogleAuthProvider.credentialFromError(error as FirebaseError);
        const pendingEmail = ((error as { customData?: { email?: string } }).customData?.email || '').toLowerCase();

        if (!pendingCredential || !pendingEmail) {
            reportGoogleSignInError(error);
            return;
        }

        try {
            const signInMethods = await fetchSignInMethodsForEmail(auth, pendingEmail);
            if (signInMethods.includes('password')) {
                setPendingGoogleLink({
                    email: pendingEmail,
                    credential: pendingCredential,
                });
                setLinkPassword('');
                toast({
                    title: 'Link your existing account',
                    description: `Enter password for ${pendingEmail} to connect Google sign-in.`,
                });
                return;
            }

            toast({
                variant: 'destructive',
                title: 'Account already exists',
                description: 'Sign in using your existing provider first, then link Google from account settings.',
            });
        } catch (methodsError: unknown) {
            reportGoogleSignInError(methodsError);
        }
    }, [auth, reportGoogleSignInError, toast]);

    const runGoogleSignInAction = useCallback(async ({
        signIn,
        provider,
        allowRedirectFallback,
    }: {
        signIn: () => Promise<UserCredential>;
        provider?: GoogleAuthProvider;
        allowRedirectFallback: boolean;
    }) => {
        try {
            const result = await signIn();
            await handleAuthenticatedGoogleUser(result.user);
        } catch (error: unknown) {
            const errorCode = getFirebaseAuthErrorCode(error);
            if (errorCode === 'auth/account-exists-with-different-credential') {
                await resolveAccountExistsWithDifferentCredential(error);
                return;
            }

            if (allowRedirectFallback && provider && errorCode && REDIRECT_FALLBACK_CODES.has(errorCode)) {
                try {
                    toast({
                        title: 'Continuing with Google',
                        description: 'Popup was blocked. Redirecting to Google sign-in...',
                    });
                    await signInWithRedirect(auth, provider);
                    return;
                } catch (redirectError: unknown) {
                    reportGoogleSignInError(redirectError);
                    return;
                }
            }

            reportGoogleSignInError(error);
        }
    }, [auth, handleAuthenticatedGoogleUser, reportGoogleSignInError, resolveAccountExistsWithDifferentCredential, toast]);

    const handleNativeGoogleSignInSuccess = useCallback(async (detail: AppGoogleSignInResultDetail) => {
        const idToken = detail.idToken?.trim() || null;
        const accessToken = detail.accessToken?.trim() || null;

        if (!idToken && !accessToken) {
            reportNativeGoogleSignInError({
                status: 'error',
                message: 'Google sign-in finished without returning any Google tokens.',
            });
            return;
        }

        setIsLoading(true);
        try {
            const credential = GoogleAuthProvider.credential(idToken, accessToken);
            await runGoogleSignInAction({
                signIn: () => signInWithCredential(auth, credential),
                allowRedirectFallback: false,
            });
        } finally {
            setIsLoading(false);
        }
    }, [auth, reportNativeGoogleSignInError, runGoogleSignInAction]);

    useEffect(() => {
        let isActive = true;

        async function processRedirectResult() {
            try {
                const result = await getRedirectResult(auth);
                if (!isActive || !result?.user) return;
                setIsLoading(true);
                await handleAuthenticatedGoogleUser(result.user);
            } catch (error: unknown) {
                if (!isActive) return;
                reportGoogleSignInError(error);
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        }

        void processRedirectResult();

        return () => {
            isActive = false;
        };
    }, [auth, handleAuthenticatedGoogleUser, reportGoogleSignInError]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const handleAppGoogleSignInResult = (event: Event) => {
            const detail = (event as CustomEvent<AppGoogleSignInResultDetail>).detail;
            if (!detail) {
                setIsLoading(false);
                reportNativeGoogleSignInError({
                    status: 'error',
                    message: 'Received an empty response from the Android app.',
                });
                return;
            }

            if (detail.status === 'success') {
                void handleNativeGoogleSignInSuccess(detail);
                return;
            }

            setIsLoading(false);
            reportNativeGoogleSignInError(detail);
        };

        window.addEventListener(
            APP_NATIVE_GOOGLE_SIGN_IN_RESULT_EVENT,
            handleAppGoogleSignInResult as EventListener,
        );

        return () => {
            window.removeEventListener(
                APP_NATIVE_GOOGLE_SIGN_IN_RESULT_EVENT,
                handleAppGoogleSignInResult as EventListener,
            );
        };
    }, [handleNativeGoogleSignInSuccess, reportNativeGoogleSignInError]);

    async function triggerLinkPasswordReset() {
        if (!pendingGoogleLink || isSendingReset) return;
        setIsSendingReset(true);
        try {
            await sendPasswordResetEmail(auth, pendingGoogleLink.email);
            toast({
                title: 'Password Reset Email Sent',
                description: `If an account exists for ${pendingGoogleLink.email}, you will receive a reset link shortly.`,
            });
        } catch (error) {
            console.error('Failed to send password reset email while linking Google', error);
            toast({
                title: 'Password Reset Email Sent',
                description: `If an account exists for ${pendingGoogleLink.email}, you will receive a reset link shortly.`,
            });
        } finally {
            setIsSendingReset(false);
        }
    }

    async function linkGoogleToPasswordAccount() {
        if (!pendingGoogleLink || isLinkingGoogle) return;
        if (!linkPassword.trim()) {
            toast({
                variant: 'destructive',
                title: 'Password required',
                description: 'Enter your existing account password to link Google sign-in.',
            });
            return;
        }

        setIsLinkingGoogle(true);
        try {
            const credential = await signInWithEmailAndPassword(auth, pendingGoogleLink.email, linkPassword);
            const user = credential.user;

            try {
                await linkWithCredential(user, pendingGoogleLink.credential);
            } catch (linkError: unknown) {
                const linkErrorCode = getFirebaseAuthErrorCode(linkError);
                if (linkErrorCode !== 'auth/provider-already-linked') {
                    throw linkError;
                }
            }

            setPendingGoogleLink(null);
            setLinkPassword('');
            await handleAuthenticatedGoogleUser(user);
        } catch (error: unknown) {
            const code = getFirebaseAuthErrorCode(error);
            if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials' || code === 'auth/wrong-password') {
                toast({
                    variant: 'destructive',
                    title: 'Link Failed',
                    description: 'Incorrect password. Use Forgot Password if you do not remember it.',
                });
                return;
            }

            if (code === 'auth/credential-already-in-use') {
                toast({
                    variant: 'destructive',
                    title: 'Google already linked elsewhere',
                    description: 'This Google account is already linked to another user.',
                });
                return;
            }

            reportGoogleSignInError(error);
        } finally {
            setIsLinkingGoogle(false);
        }
    }

    async function handleGoogleSignIn() {
        if (isLoading) return;
        setIsLoading(true);

        const provider = createGoogleProvider();
        try {
            await runGoogleSignInAction({
                signIn: () => signInWithPopup(auth, provider),
                provider,
                allowRedirectFallback: true,
            });
        } finally {
            setIsLoading(false);
        }
    }

    async function handleRoleSelection(role: 'student' | 'teacher') {
        if (!newUser) return;
        
        setIsLoading(true);
        try {
            const batch = writeBatch(firestore);
            const userRef = doc(firestore, 'users', newUser.uid);

            const [firstName, ...lastName] = newUser.displayName?.split(' ') || ['User', ''];

            const userData: any = {
                id: newUser.uid,
                firstName: firstName,
                lastName: lastName.join(' '),
                email: newUser.email,
                photoURL: newUser.photoURL,
                phoneNumber: newUser.phoneNumber || '',
                roleId: role,
                status: 'active',
            };
            
            if (role === 'teacher') {
                userData.teacherStatus = 'pending';
            }

             // Special admin logic for the designated admin email
            if (newUser.email?.toLowerCase() === designatedAdminEmail) {
                userData.roleId = 'admin';
                userData.teacherStatus = 'approved';
                
                const adminRoleRef = doc(firestore, 'roles_admin', newUser.uid);
                const teacherRoleRef = doc(firestore, 'roles_teacher', newUser.uid);
                batch.set(adminRoleRef, { createdAt: new Date().toISOString() });
                batch.set(teacherRoleRef, { createdAt: new Date().toISOString() });
            }
            
            batch.set(userRef, userData);
            await batch.commit();

            queuePostLoginToast({
                title: userData.roleId === 'teacher' && userData.teacherStatus === 'pending' ? 'Teacher Request Submitted' : 'Registration Complete!',
                description: userData.roleId === 'teacher' && userData.teacherStatus === 'pending'
                  ? 'Your teacher account is waiting for admin approval.'
                  : `Your ${userData.roleId} account has been created.`,
            });
            setNewUser(null);
            router.push('/dashboard');
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Registration Failed',
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    }


    return (
        <>
            <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-[11px] tracking-[0.18em] text-slate-300">
                        {dividerLabel}
                    </span>
                </div>
            </div>
            <Button
                variant="outline"
                className="h-auto w-full rounded-xl border-white/20 bg-slate-950/60 px-4 py-3 text-white shadow-[0_12px_30px_-18px_rgba(56,189,248,0.85)] transition-all hover:border-cyan-300/40 hover:bg-slate-900/80 hover:shadow-[0_20px_45px_-20px_rgba(34,211,238,0.75)]"
                onClick={() => {
                    if (isEmbeddedBrowser && hasNativeGoogleBridge) {
                        setIsLoading(true);
                        if (!requestNativeGoogleSignIn()) {
                            setIsLoading(false);
                            setShowEmbeddedBrowserDialog(true);
                        }
                        return;
                    }

                    if (isEmbeddedBrowser) {
                        setShowEmbeddedBrowserDialog(true);
                        return;
                    }

                    void handleGoogleSignIn();
                }}
                disabled={isLoading}
            >
                <span className="mr-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 text-slate-900">
                    {isLoading && newUser === null ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                        <svg className="h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-72.2 72.2C322 108.5 288.7 96 248 96c-88.8 0-160.1 71.9-160.1 160.1s71.3 160.1 160.1 160.1c98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
                    )}
                </span>
                <span className="text-sm font-semibold">
                    {effectiveGoogleButtonLabel}
                </span>
            </Button>

            <AlertDialog open={showEmbeddedBrowserDialog} onOpenChange={setShowEmbeddedBrowserDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Open Google Sign-In in Chrome</AlertDialogTitle>
                        <AlertDialogDescription>
                            Google blocks sign-in inside embedded app webviews. Open this page in Chrome to continue with Google, or use email and phone login inside the app.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:justify-center gap-3 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setShowEmbeddedBrowserDialog(false);
                            }}
                            className="w-full sm:w-auto"
                        >
                            Use email instead
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                setShowEmbeddedBrowserDialog(false);
                                openCurrentPageInBrowser();
                            }}
                            className="w-full sm:w-auto"
                        >
                            Open in Chrome
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog
                open={!!pendingGoogleLink}
                onOpenChange={(open) => {
                    if (!open && !isLinkingGoogle && !isSendingReset) {
                        setPendingGoogleLink(null);
                        setLinkPassword('');
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Link Google to Existing Account</AlertDialogTitle>
                        <AlertDialogDescription>
                            To use both password and Google for <strong>{pendingGoogleLink?.email}</strong>, enter your current password.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Password</label>
                        <Input
                            type="password"
                            value={linkPassword}
                            onChange={(event) => setLinkPassword(event.target.value)}
                            placeholder="Enter your current password"
                            disabled={isLinkingGoogle}
                        />
                        <p className="text-xs text-muted-foreground">
                            Don&apos;t remember it? Send a reset link and create a new password.
                        </p>
                    </div>
                    <AlertDialogFooter className="sm:justify-center gap-3 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                if (isLinkingGoogle || isSendingReset) return;
                                setPendingGoogleLink(null);
                                setLinkPassword('');
                            }}
                            disabled={isLinkingGoogle || isSendingReset}
                            className="w-full sm:w-auto"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                void triggerLinkPasswordReset();
                            }}
                            disabled={isLinkingGoogle || isSendingReset}
                            className="w-full sm:w-auto"
                        >
                            {isSendingReset ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Send reset link
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                void linkGoogleToPasswordAccount();
                            }}
                            disabled={isLinkingGoogle || isSendingReset}
                            className="w-full sm:w-auto"
                        >
                            {isLinkingGoogle ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Link account
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!newUser}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>One Last Step!</AlertDialogTitle>
                        <AlertDialogDescription>
                            Welcome, {newUser?.displayName}! To complete your registration, please tell us who you are.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className='sm:justify-center gap-4 pt-4'>
                        <Button onClick={() => handleRoleSelection('student')} disabled={isLoading} className='w-full sm:w-auto'>
                            {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            I'm a Student
                        </Button>
                        <Button variant="secondary" onClick={() => handleRoleSelection('teacher')} disabled={isLoading} className='w-full sm:w-auto'>
                             {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            I'm a Teacher
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
