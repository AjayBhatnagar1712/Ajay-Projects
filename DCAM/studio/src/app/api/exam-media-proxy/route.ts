import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

export const dynamic = 'force-dynamic';
const MAX_PROXY_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPE_PREFIXES = ['image/', 'application/pdf'];

function isAllowedRemoteUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    return ALLOWED_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith('.firebasestorage.app');
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url') || '';
  if (!rawUrl || !isAllowedRemoteUrl(rawUrl)) {
    return NextResponse.json({ error: 'Invalid media URL.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(rawUrl, {
      cache: 'no-store',
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Could not fetch media.' }, { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = Number(upstream.headers.get('content-length') || 0);
    const isAllowedContentType = ALLOWED_CONTENT_TYPE_PREFIXES.some((prefix) => contentType.toLowerCase().startsWith(prefix));
    if (!isAllowedContentType) {
      return NextResponse.json({ error: 'Unsupported media type.' }, { status: 415 });
    }
    if (Number.isFinite(contentLength) && contentLength > MAX_PROXY_BYTES) {
      return NextResponse.json({ error: 'Media file is too large.' }, { status: 413 });
    }
    if (!upstream.body) {
      return NextResponse.json({ error: 'Media response is empty.' }, { status: 502 });
    }

    const cacheControl = upstream.headers.get('cache-control') || 'private, max-age=300';

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('exam-media-proxy failed:', error);
    return NextResponse.json({ error: 'Media proxy failed.' }, { status: 502 });
  }
}
