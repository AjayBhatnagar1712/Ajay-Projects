import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';
import { getFirebaseAdminBucketName } from '@/lib/firebase-admin';
import {
  sanitizeEnquiryFileName,
  type EnquiryAttachmentUploadTarget,
  type EnquiryType,
} from '@/lib/enquiries';

export const runtime = 'nodejs';

const EnquiryAttachmentUploadUrlSchema = z.object({
  enquiryType: z.enum(['student', 'teacher']),
  fileName: z.string().trim().min(1, 'Choose a file to upload.').max(240, 'File name is too long.'),
  contentType: z.string().trim().max(200).optional(),
  fileSizeBytes: z.number().int().positive().max(10 * 1024 * 1024).optional(),
});

const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
]);

function toDownloadUrl(storagePath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${getFirebaseAdminBucketName()}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

function buildStoragePath(enquiryType: EnquiryType, fileName: string) {
  const safeName = sanitizeEnquiryFileName(fileName);
  return `enquiry_attachments/${enquiryType}/pending/${Date.now()}_${randomUUID()}_${safeName}`;
}

const storageAuth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/devstorage.read_write'],
});

async function getStorageAccessToken() {
  const client = await storageAuth.getClient();
  const accessToken = await client.getAccessToken();
  return typeof accessToken === 'string' ? accessToken : accessToken?.token || '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = EnquiryAttachmentUploadUrlSchema.parse(body);

    const contentType = parsed.contentType?.trim() || 'application/octet-stream';
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: 'This file type is not supported for enquiry attachments.' },
        {
          status: 400,
          headers: { 'cache-control': 'no-store' },
        }
      );
    }

    const storagePath = buildStoragePath(parsed.enquiryType, parsed.fileName);
    const token = randomUUID();
    const bucketName = getFirebaseAdminBucketName();
    const accessToken = await getStorageAccessToken();

    if (!accessToken) {
      throw new Error('Could not resolve a Cloud Storage access token.');
    }

    const sessionResponse = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucketName)}/o?uploadType=resumable&name=${encodeURIComponent(storagePath)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': contentType,
          ...(parsed.fileSizeBytes ? { 'X-Upload-Content-Length': String(parsed.fileSizeBytes) } : {}),
        },
        body: JSON.stringify({
          name: storagePath,
          contentType,
          cacheControl: 'private, max-age=0, no-transform',
          metadata: {
            firebaseStorageDownloadTokens: token,
            originalFileName: parsed.fileName,
          },
        }),
      }
    );

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text().catch(() => '');
      throw new Error(errorText || 'Could not create a Cloud Storage upload session.');
    }

    const uploadUrl = sessionResponse.headers.get('location');
    if (!uploadUrl) {
      throw new Error('Cloud Storage did not return an upload session URL.');
    }

    const response: EnquiryAttachmentUploadTarget = {
      uploadUrl,
      uploadHeaders: {
        'Content-Type': contentType,
      },
      attachment: {
        name: parsed.fileName,
        url: toDownloadUrl(storagePath, token),
        contentType,
        storagePath,
      },
    };

    return NextResponse.json(response, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message || 'Could not prepare this upload.',
        },
        {
          status: 400,
          headers: { 'cache-control': 'no-store' },
        }
      );
    }

    console.error('Enquiry attachment upload target failed:', error);
    return NextResponse.json(
      {
        error: 'Could not prepare this file upload right now.',
      },
      {
        status: 500,
        headers: { 'cache-control': 'no-store' },
      }
    );
  }
}
