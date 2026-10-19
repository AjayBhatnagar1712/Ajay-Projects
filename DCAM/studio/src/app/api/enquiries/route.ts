import { createHash, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { z } from 'zod';
import { getFirebaseAdminApp, getFirebaseAdminBucket, getFirebaseAdminBucketName, getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  MAX_ENQUIRY_ATTACHMENTS,
  sanitizeEnquiryFileName,
  validateEnquiryAttachments,
  validateEnquiryMessage,
  type EnquiryAttachment,
  type EnquiryRecord,
  type EnquirySource,
  type EnquiryType,
  type PlanToStart,
  type PreferredClassType,
} from '@/lib/enquiries';

export const runtime = 'nodejs';
const ADMIN_ENQUIRY_TOPIC = 'dcam_admin_enquiries';
const ANDROID_NOTIFICATION_CHANNEL_ID = 'dcam_bell_notifications_v2';
const APP_NOTIFICATION_TOKEN_COLLECTION = 'app_notification_tokens';

const EnquiryRequestSchema = z.object({
  enquiryType: z.enum(['student', 'teacher']),
  name: z.string().trim().min(2, 'Enter your name.').max(120, 'Name is too long.'),
  email: z.string().trim().email('Enter a valid email address.').max(160, 'Email is too long.'),
  phoneNumber: z
    .string()
    .trim()
    .min(7, 'Enter a valid phone number.')
    .max(20, 'Phone number is too long.')
    .regex(/^[0-9+\-\s()]+$/, 'Enter a valid phone number.'),
  message: z.string().max(4000, 'Message is too long.'),
  source: z.enum(['website', 'website_home', 'student_help']).optional(),
  website: z.string().optional(),
  uploadedAttachments: z.string().optional(),
  examTypeId: z.string().trim().max(120).optional(),
  examName: z.string().trim().max(180).optional(),
  classId: z.string().trim().max(120).optional(),
  className: z.string().trim().max(180).optional(),
  subjectIds: z.string().optional(),
  subjectNames: z.string().optional(),
  preferredClassType: z.enum(['regular', 'online', 'both']).optional(),
  planToStart: z.enum(['immediate', 'later']).optional(),
  preferredStartDate: z.string().trim().max(20).optional(),
});

const UploadedEnquiryAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(240),
  url: z.string().trim().url(),
  contentType: z.string().trim().min(1).max(200),
  sizeBytes: z.number().finite().nonnegative(),
  storagePath: z.string().trim().min(1).max(500),
});

function toDownloadUrl(storagePath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${getFirebaseAdminBucketName()}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function parseStringArrayJson(value: string, fieldLabel: string) {
  if (!value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error(`${fieldLabel} must be an array.`);
    }

    return parsed
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .slice(0, 40);
  } catch {
    throw new z.ZodError([
      {
        code: 'custom',
        path: [fieldLabel],
        message: `${fieldLabel} details were invalid. Please try again.`,
      },
    ]);
  }
}

function buildStudentCoachingEnquiry(parsed: z.infer<typeof EnquiryRequestSchema>) {
  if (parsed.source !== 'website_home' || parsed.enquiryType !== 'student') return null;

  const subjectIds = parseStringArrayJson(parsed.subjectIds || '', 'Subject');
  const subjectNames = parseStringArrayJson(parsed.subjectNames || '', 'Subject');
  const planToStart = parsed.planToStart as PlanToStart | undefined;

  if (!parsed.examTypeId || !parsed.examName) {
    throw new z.ZodError([{ code: 'custom', path: ['examTypeId'], message: 'Select an exam.' }]);
  }
  if (!parsed.classId || !parsed.className) {
    throw new z.ZodError([{ code: 'custom', path: ['classId'], message: 'Select a curriculum.' }]);
  }
  if (subjectIds.length === 0 || subjectNames.length === 0) {
    throw new z.ZodError([{ code: 'custom', path: ['subjectIds'], message: 'Select at least one subject.' }]);
  }
  if (!parsed.preferredClassType) {
    throw new z.ZodError([{ code: 'custom', path: ['preferredClassType'], message: 'Select preferred class type.' }]);
  }
  if (!planToStart) {
    throw new z.ZodError([{ code: 'custom', path: ['planToStart'], message: 'Select when you plan to start.' }]);
  }
  if (planToStart === 'later' && !parsed.preferredStartDate) {
    throw new z.ZodError([{ code: 'custom', path: ['preferredStartDate'], message: 'Choose an approximate start date.' }]);
  }

  return {
    examTypeId: parsed.examTypeId,
    examName: parsed.examName,
    classId: parsed.classId,
    className: parsed.className,
    subjectIds,
    subjectNames,
    preferredClassType: parsed.preferredClassType as PreferredClassType,
    planToStart,
    preferredStartDate: planToStart === 'later' ? parsed.preferredStartDate || null : null,
  };
}

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
      email: typeof decoded.email === 'string' ? decoded.email : '',
    };
  } catch {
    return { ok: false as const, status: 401, error: 'Invalid authorization token.' };
  }
}

async function verifySignedInStudentRequest(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!idToken) {
    return { ok: false as const, status: 401, error: 'Missing student authorization token.' };
  }

  try {
    const auth = getAuth(getFirebaseAdminApp());
    const db = getFirebaseAdminDb();
    const decoded = await auth.verifyIdToken(idToken);
    const userSnap = await db.doc(`users/${decoded.uid}`).get();
    const userData = userSnap.data() || {};
    const roleId = typeof userData.roleId === 'string' ? userData.roleId : '';

    if (roleId && roleId !== 'student') {
      return { ok: false as const, status: 403, error: 'Only student accounts can use this help route.' };
    }

    return {
      ok: true as const,
      userId: decoded.uid,
      roleId: 'student' as const,
    };
  } catch {
    return { ok: false as const, status: 401, error: 'Invalid student authorization token.' };
  }
}

function isFileEntry(entry: FormDataEntryValue): entry is File {
  return typeof File !== 'undefined' && entry instanceof File;
}

function buildAdminEnquiryNotificationMessage(input: {
  enquiryType: EnquiryType;
  name: string;
  phoneNumber: string;
  examName?: string | null;
  className?: string | null;
}) {
  const parts = [
    input.name,
    input.examName ? `exam: ${input.examName}` : '',
    input.className ? `class: ${input.className}` : '',
    input.phoneNumber ? `phone: ${input.phoneNumber}` : '',
  ].filter(Boolean);

  return `${input.enquiryType === 'teacher' ? 'Teacher' : 'Student'} enquiry from ${parts.join(' | ')}.`;
}

const chunkItems = <T,>(items: T[], size = 500) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const tokenDocId = (token: string) =>
  createHash('sha256').update(token).digest('hex');

async function sendAdminEnquiryPushNotifications(input: {
  db: ReturnType<typeof getFirebaseAdminDb>;
  enquiry: EnquiryRecord;
  title: string;
  message: string;
}) {
  const messaging = getMessaging(getFirebaseAdminApp());
  const data = {
    id: `admin_enquiry_${input.enquiry.id}`,
    enquiryId: input.enquiry.id,
    notificationType: 'admin_new_enquiry',
    href: '/admin/enquiries',
    title: input.title,
    message: input.message,
    createdAtMs: String(input.enquiry.createdAtMs),
  };
  const android = {
    priority: 'high' as const,
    notification: {
      channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
      sound: 'default',
      tag: `admin_enquiry_${input.enquiry.id}`,
      clickAction: 'FLUTTER_NOTIFICATION_CLICK',
    },
  };
  const apns = {
    payload: {
      aps: {
        sound: 'default',
      },
    },
  };

  try {
    await messaging.send({
      topic: ADMIN_ENQUIRY_TOPIC,
      notification: {
        title: input.title,
        body: input.message,
      },
      data,
      android,
      apns,
    });
  } catch (error) {
    console.error('Admin enquiry topic push failed:', error);
  }

  try {
    const tokenSnapshot = await input.db
      .collection(APP_NOTIFICATION_TOKEN_COLLECTION)
      .where('role', '==', 'admin')
      .where('isActive', '==', true)
      .get();
    const tokens = Array.from(
      new Set(
        tokenSnapshot.docs
          .map((docSnap) => String(docSnap.data().token || '').trim())
          .filter(Boolean)
      )
    );

    for (const tokenChunk of chunkItems(tokens)) {
      const response = await messaging.sendEachForMulticast({
        tokens: tokenChunk,
        notification: {
          title: input.title,
          body: input.message,
        },
        data,
        android,
        apns,
      });

      const cleanupBatch = input.db.batch();
      let hasCleanup = false;
      response.responses.forEach((sendResponse, index) => {
        const code = sendResponse.error?.code || '';
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          cleanupBatch.set(
            input.db.doc(`${APP_NOTIFICATION_TOKEN_COLLECTION}/${tokenDocId(tokenChunk[index]!)}`),
            {
              isActive: false,
              updatedAt: FieldValue.serverTimestamp(),
              disabledReason: code,
            },
            { merge: true }
          );
          hasCleanup = true;
        }
      });

      if (hasCleanup) {
        await cleanupBatch.commit();
      }
    }
  } catch (error) {
    console.error('Admin enquiry direct token push failed:', error);
  }
}

async function notifyAdminsAboutEnquiry(input: {
  db: ReturnType<typeof getFirebaseAdminDb>;
  enquiry: EnquiryRecord;
}) {
  const adminSnapshot = await input.db.collection('roles_admin').get();
  if (adminSnapshot.empty) {
    return;
  }

  const title = input.enquiry.enquiryType === 'teacher'
    ? 'New teacher enquiry'
    : 'New student enquiry';
  const message = buildAdminEnquiryNotificationMessage({
    enquiryType: input.enquiry.enquiryType,
    name: input.enquiry.name,
    phoneNumber: input.enquiry.phoneNumber,
    examName: input.enquiry.studentCoachingEnquiry?.examName,
    className: input.enquiry.studentCoachingEnquiry?.className,
  });
  const batch = input.db.batch();

  adminSnapshot.docs.forEach((adminDoc) => {
    const recipientId = adminDoc.id.trim();
    if (!recipientId) return;

    const notificationId = `admin_enquiry_${input.enquiry.id}_${recipientId}`;
    const notificationRef = input.db.doc(`notifications/${notificationId}`);
    batch.set(notificationRef, {
      id: notificationId,
      recipientId,
      title,
      message,
      href: '/admin/enquiries',
      audience: 'admin',
      actorId: input.enquiry.submittedByUserId || null,
      notificationType: 'admin_new_enquiry',
      contentType: 'enquiry',
      contentId: input.enquiry.id,
      dedupeKey: `enquiry:${input.enquiry.id}`,
      metadata: {
        enquiryId: input.enquiry.id,
        enquiryType: input.enquiry.enquiryType,
        source: input.enquiry.source,
        name: input.enquiry.name,
        email: input.enquiry.email,
        phoneNumber: input.enquiry.phoneNumber,
        hasAttachments: input.enquiry.attachments.length > 0,
        submittedByUserId: input.enquiry.submittedByUserId,
        submittedByRoleId: input.enquiry.submittedByRoleId,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      isRead: false,
      readAt: null,
    });
  });

  await batch.commit();

  await sendAdminEnquiryPushNotifications({
    db: input.db,
    enquiry: input.enquiry,
    title,
    message,
  });
}

async function uploadAttachment(input: {
  enquiryId: string;
  enquiryType: EnquiryType;
  index: number;
  file: File;
}): Promise<EnquiryAttachment> {
  const bucket = getFirebaseAdminBucket();
  const safeName = sanitizeEnquiryFileName(input.file.name);
  const storagePath = `enquiry_attachments/${input.enquiryType}/${input.enquiryId}/${Date.now()}_${input.index}_${safeName}`;
  const token = randomUUID();
  const fileHandle = bucket.file(storagePath);
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const contentType = input.file.type || 'application/octet-stream';

  await fileHandle.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: 'private, max-age=0, no-transform',
      metadata: {
        firebaseStorageDownloadTokens: token,
        originalFileName: input.file.name,
      },
    },
  });

  return {
    name: input.file.name,
    url: toDownloadUrl(storagePath, token),
    contentType,
    sizeBytes: input.file.size,
    storagePath,
  };
}

export async function GET(request: NextRequest) {
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
    const db = getFirebaseAdminDb();
    const snapshot = await db.collection('enquiries').orderBy('createdAtMs', 'desc').get();
    const enquiries = snapshot.docs.map((entry) => entry.data() as EnquiryRecord);

    return NextResponse.json(
      { enquiries },
      {
        headers: { 'cache-control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('Enquiry fetch failed:', error);
    return NextResponse.json(
      { error: 'Could not load enquiries right now.' },
      {
        status: 500,
        headers: { 'cache-control': 'no-store' },
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const parsed = EnquiryRequestSchema.parse({
      enquiryType: readString(formData, 'enquiryType'),
      name: readString(formData, 'name'),
      email: readString(formData, 'email'),
      phoneNumber: readString(formData, 'phoneNumber'),
      message: readString(formData, 'message'),
      source: readString(formData, 'source'),
      website: readString(formData, 'website'),
      uploadedAttachments: readString(formData, 'uploadedAttachments'),
      examTypeId: readString(formData, 'examTypeId'),
      examName: readString(formData, 'examName'),
      classId: readString(formData, 'classId'),
      className: readString(formData, 'className'),
      subjectIds: readString(formData, 'subjectIds'),
      subjectNames: readString(formData, 'subjectNames'),
      preferredClassType: readString(formData, 'preferredClassType'),
      planToStart: readString(formData, 'planToStart'),
      preferredStartDate: readString(formData, 'preferredStartDate'),
    });

    if (parsed.website?.trim()) {
      return NextResponse.json(
        { success: true },
        {
          headers: { 'cache-control': 'no-store' },
        }
      );
    }

    const uploadedAttachmentsRaw = parsed.uploadedAttachments?.trim();
    const attachmentFiles = uploadedAttachmentsRaw
      ? []
      : formData
          .getAll('attachments')
          .filter(isFileEntry)
          .filter((file) => file.size > 0);

    let attachments: EnquiryAttachment[] = [];

    if (uploadedAttachmentsRaw) {
      let parsedUploadedAttachments: unknown;

      try {
        parsedUploadedAttachments = JSON.parse(uploadedAttachmentsRaw);
      } catch {
        return NextResponse.json(
          { error: 'Uploaded attachment details were invalid. Please try again.' },
          {
            status: 400,
            headers: { 'cache-control': 'no-store' },
          }
        );
      }

      attachments = z.array(UploadedEnquiryAttachmentSchema).max(MAX_ENQUIRY_ATTACHMENTS).parse(parsedUploadedAttachments);
    } else {
      const attachmentValidationError = validateEnquiryAttachments(attachmentFiles);
      if (attachmentValidationError) {
        return NextResponse.json(
          { error: attachmentValidationError },
          {
            status: 400,
            headers: { 'cache-control': 'no-store' },
          }
        );
      }
    }

    const source: EnquirySource = parsed.source || 'website';
    const studentCoachingEnquiry = buildStudentCoachingEnquiry(parsed);
    const normalizedMessage = parsed.message.trim();
    const messageValidationError = studentCoachingEnquiry
      ? normalizedMessage.length > 4000
        ? 'Message is too long.'
        : ''
      : validateEnquiryMessage(
          normalizedMessage,
          attachments.length > 0 || attachmentFiles.length > 0
        );

    if (messageValidationError) {
      return NextResponse.json(
        { error: messageValidationError },
        {
          status: 400,
          headers: { 'cache-control': 'no-store' },
        }
      );
    }

    let submittedByUserId: string | null = null;
    let submittedByRoleId: 'student' | null = null;

    if (source === 'student_help') {
      const studentAuth = await verifySignedInStudentRequest(request);
      if (!studentAuth.ok) {
        return NextResponse.json(
          { error: studentAuth.error },
          {
            status: studentAuth.status,
            headers: { 'cache-control': 'no-store' },
          }
        );
      }

      submittedByUserId = studentAuth.userId;
      submittedByRoleId = studentAuth.roleId;
    }

    const db = getFirebaseAdminDb();
    const enquiryRef = db.collection('enquiries').doc();
    const now = new Date();
    const createdAt = now.toISOString();
    const createdAtMs = now.getTime();

    if (!uploadedAttachmentsRaw) {
      attachments = await Promise.all(
        attachmentFiles.map((file, index) =>
          uploadAttachment({
            enquiryId: enquiryRef.id,
            enquiryType: parsed.enquiryType,
            index,
            file,
          })
        )
      );
    }

    const enquiryRecord: EnquiryRecord = {
      id: enquiryRef.id,
      enquiryType: parsed.enquiryType,
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      phoneNumber: parsed.phoneNumber,
      message: normalizedMessage,
      attachments,
      status: 'open',
      createdAt,
      createdAtMs,
      resolvedAt: null,
      resolvedAtMs: null,
      resolvedBy: null,
      resolvedByEmail: null,
      source,
      submittedByUserId,
      submittedByRoleId,
      studentCoachingEnquiry,
    };

    await enquiryRef.set(enquiryRecord);

    try {
      await notifyAdminsAboutEnquiry({ db, enquiry: enquiryRecord });
    } catch (notificationError) {
      console.error('Admin enquiry notification failed:', notificationError);
    }

    return NextResponse.json(
      {
        success: true,
        enquiryId: enquiryRef.id,
      },
      {
        headers: { 'cache-control': 'no-store' },
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message || 'Please check the form and try again.',
        },
        {
          status: 400,
          headers: { 'cache-control': 'no-store' },
        }
      );
    }

    console.error('Enquiry submission failed:', error);
    return NextResponse.json(
      {
        error: 'Could not submit the enquiry right now.',
      },
      {
        status: 500,
        headers: { 'cache-control': 'no-store' },
      }
    );
  }
}

const EnquiryResolveSchema = z.object({
  enquiryId: z.string().trim().min(1),
  status: z.literal('resolved'),
});

export async function PATCH(request: NextRequest) {
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
    const body = await request.json();
    const parsed = EnquiryResolveSchema.parse(body);
    const db = getFirebaseAdminDb();
    const enquiryRef = db.doc(`enquiries/${parsed.enquiryId}`);
    const existing = await enquiryRef.get();

    if (!existing.exists) {
      return NextResponse.json(
        { error: 'Enquiry not found.' },
        {
          status: 404,
          headers: { 'cache-control': 'no-store' },
        }
      );
    }

    const now = new Date();
    await enquiryRef.set(
      {
        status: 'resolved',
        resolvedAt: now.toISOString(),
        resolvedAtMs: now.getTime(),
        resolvedBy: authResult.userId,
        resolvedByEmail: authResult.email,
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
        { error: error.issues[0]?.message || 'Invalid resolve request.' },
        {
          status: 400,
          headers: { 'cache-control': 'no-store' },
        }
      );
    }

    console.error('Enquiry resolve failed:', error);
    return NextResponse.json(
      { error: 'Could not resolve this enquiry right now.' },
      {
        status: 500,
        headers: { 'cache-control': 'no-store' },
      }
    );
  }
}
