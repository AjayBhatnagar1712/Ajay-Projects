'use client';

type FirebaseAuthErrorLike = {
  code?: string;
  message?: string;
};

const LOCAL_AUTH_TROUBLESHOOTING =
  'On localhost, check Firebase Auth Authorized domains (add localhost), disable ad-block/VPN/proxy, and allow third-party cookies for this site.';

export function getFirebaseAuthErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  return (error as FirebaseAuthErrorLike).code;
}

export function isFirebaseAuthNetworkError(error: unknown): boolean {
  return getFirebaseAuthErrorCode(error) === 'auth/network-request-failed';
}

export function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function getFirebaseAuthErrorMessage(error: unknown, useLocalhostHint = false): string {
  const code = getFirebaseAuthErrorCode(error);
  const fallback = (error as FirebaseAuthErrorLike | null)?.message || 'Authentication failed. Please try again.';

  if (code === 'auth/popup-blocked') {
    return 'The Google sign-in popup was blocked by your browser. Allow popups and try again.';
  }

  if (code === 'auth/popup-closed-by-user') {
    return 'The Google sign-in popup was closed before authentication completed.';
  }

  if (code === 'auth/cancelled-popup-request') {
    return 'A sign-in request is already in progress. Please wait and try again.';
  }

  if (code === 'auth/network-request-failed') {
    return useLocalhostHint
      ? `Could not reach Firebase Auth from this browser. ${LOCAL_AUTH_TROUBLESHOOTING}`
      : 'Could not reach Firebase Auth. Check your internet connection and try again.';
  }

  if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
    return 'Invalid email or password.';
  }

  if (code === 'auth/user-disabled') {
    return 'This account has been disabled.';
  }

  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }

  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized for Firebase Auth. Add it in Firebase Console > Authentication > Settings.';
  }

  return fallback;
}

export async function canReachFirebaseAuthApi(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'probe@example.com',
        password: 'invalid-password',
        returnSecureToken: true,
      }),
    });

    return response.ok || response.status === 400;
  } catch {
    return false;
  }
}
