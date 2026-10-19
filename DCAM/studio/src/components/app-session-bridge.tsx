'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useUser } from '@/firebase';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { syncAppSessionStateToApp } from '@/lib/app-bridge';

const PUBLIC_ENTRY_PATHS = new Set([
  '/',
  '/login',
  '/signup',
  '/student-registration',
  '/teacher-registration',
]);
const APP_FCM_TOKEN_EVENT = 'dcam-app-fcm-token';

type NativeFcmTokenEvent = CustomEvent<{
  token?: string;
  platform?: string;
}>;

export function AppSessionBridge() {
  const { user, isUserLoading } = useUser();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const pathname = usePathname();
  const router = useRouter();
  const [nativeFcmToken, setNativeFcmToken] = useState('');
  const registeredTokenRef = useRef('');

  useEffect(() => {
    const handleNativeFcmToken = (event: Event) => {
      const detail = (event as NativeFcmTokenEvent).detail;
      const token = typeof detail?.token === 'string' ? detail.token.trim() : '';
      if (token) {
        setNativeFcmToken(token);
      }
    };

    window.addEventListener(APP_FCM_TOKEN_EVENT, handleNativeFcmToken);
    return () => window.removeEventListener(APP_FCM_TOKEN_EVENT, handleNativeFcmToken);
  }, []);

  useEffect(() => {
    if (isUserLoading || isAdminLoading || !user) return;

    syncAppSessionStateToApp({
      userId: user.uid,
      launchPath: '/dashboard',
      isAdmin,
    });
  }, [isAdmin, isAdminLoading, isUserLoading, user?.uid]);

  useEffect(() => {
    if (isUserLoading || isAdminLoading || !user || !isAdmin || !nativeFcmToken) return;
    if (registeredTokenRef.current === nativeFcmToken) return;

    let isCancelled = false;
    const currentUser = user;

    async function registerNativeFcmToken() {
      try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/app-notification-tokens', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${idToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            token: nativeFcmToken,
            platform: 'android',
          }),
        });

        if (!isCancelled && response.ok) {
          registeredTokenRef.current = nativeFcmToken;
        }
      } catch {
        // The native app will resend the token on the next session sync or token refresh.
      }
    }

    void registerNativeFcmToken();

    return () => {
      isCancelled = true;
    };
  }, [isAdmin, isAdminLoading, isUserLoading, nativeFcmToken, user]);

  useEffect(() => {
    if (isUserLoading || !user || !PUBLIC_ENTRY_PATHS.has(pathname)) return;
    router.replace('/dashboard');
  }, [isUserLoading, pathname, router, user]);

  return null;
}
