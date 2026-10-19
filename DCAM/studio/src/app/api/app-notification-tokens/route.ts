import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { getFirebaseAdminApp, getFirebaseAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const AppNotificationTokenSchema = z.object({
  token: z.string().trim().min(20).max(4096),
  platform: z.string().trim().max(40).optional(),
});

const tokenDocId = (token: string) =>
  createHash('sha256').update(token).digest('hex');

async function verifyAdminRequest(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!idToken) {
    return { ok: false as const, status: 401, error: 'Missing authorization token.' };
  }

  try {
    const auth = getAuth(getFirebaseAdminApp());
    const db = getFirebaseAdminDb();
    const decoded = await auth.verifyIdToken(idToken);
    const adminRole = await db.doc(`roles_admin/${decoded.uid}`).get();

    if (!adminRole.exists) {
      return { ok: false as const, status: 403, error: 'Admin access required.' };
    }

    return {
      ok: true as const,
      userId: decoded.uid,
      email: typeof decoded.email === 'string' ? decoded.email.toLowerCase() : '',
    };
  } catch {
    return { ok: false as const, status: 401, error: 'Invalid authorization token.' };
  }
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAdminRequest(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      {
        status: authResult.status,
        headers: { 'cache-control': 'no-store' },
      }
    );
  }

  try {
    const parsed = AppNotificationTokenSchema.parse(await request.json());
    const db = getFirebaseAdminDb();
    const id = tokenDocId(parsed.token);

    await db.doc(`app_notification_tokens/${id}`).set(
      {
        id,
        token: parsed.token,
        platform: parsed.platform || 'android',
        userId: authResult.userId,
        userEmail: authResult.email || null,
        role: 'admin',
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json(
      { success: true },
      {
        headers: { 'cache-control': 'no-store' },
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid notification token.' },
        {
          status: 400,
          headers: { 'cache-control': 'no-store' },
        }
      );
    }

    console.error('App notification token registration failed:', error);
    return NextResponse.json(
      { error: 'Could not register this device for notifications.' },
      {
        status: 500,
        headers: { 'cache-control': 'no-store' },
      }
    );
  }
}
