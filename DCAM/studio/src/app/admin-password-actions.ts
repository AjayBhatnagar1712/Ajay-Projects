'use server';

import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp, getFirebaseAdminDb } from '@/lib/firebase-admin';

type AdminResetUserPasswordInput = {
  idToken: string;
  userId: string;
  newPassword: string;
};

type AdminResetUserPasswordResult = {
  success: boolean;
  updatedAt?: string;
  error?: string;
};

const cleanString = (value: unknown) => String(value || '').trim();

export async function adminResetUserPassword(
  input: AdminResetUserPasswordInput
): Promise<AdminResetUserPasswordResult> {
  try {
    const idToken = cleanString(input?.idToken);
    const userId = cleanString(input?.userId);
    const newPassword = String(input?.newPassword || '');

    if (!idToken || !userId) {
      return { success: false, error: 'Missing password reset context.' };
    }

    if (newPassword.trim().length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    const adminApp = getFirebaseAdminApp();
    const adminAuth = getAdminAuth(adminApp);
    const adminDb = getFirebaseAdminDb();

    const decoded = await adminAuth.verifyIdToken(idToken);
    const requesterId = cleanString(decoded.uid);
    if (!requesterId) {
      return { success: false, error: 'Could not resolve the current admin.' };
    }

    const adminRoleSnap = await adminDb.doc(`roles_admin/${requesterId}`).get();
    if (!adminRoleSnap.exists) {
      return { success: false, error: 'Only admins can manage user passwords.' };
    }

    const targetUserSnap = await adminDb.doc(`users/${userId}`).get();
    if (!targetUserSnap.exists) {
      return { success: false, error: 'User profile not found.' };
    }

    await adminAuth.updateUser(userId, { password: newPassword });

    return {
      success: true,
      updatedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Could not reset the user password.',
    };
  }
}
