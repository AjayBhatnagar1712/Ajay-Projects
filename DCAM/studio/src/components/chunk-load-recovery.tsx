'use client';

import { useEffect } from 'react';

const RETRY_KEY = '__chunk_retry_state__';
const RETRY_WINDOW_MS = 20_000;
const FORCED_DOCUMENT_NAVIGATION_PREFIXES = [
  '/admin',
  '/chat',
  '/checkout',
  '/content',
  '/courses',
  '/crash-courses',
  '/curriculum',
  '/custom-mock-tests',
  '/dashboard',
  '/dcam-custom-mock',
  '/dcam-practice-session',
  '/doubts',
  '/find-teachers',
  '/help',
  '/live-batches',
  '/mock-tests',
  '/my-batch',
  '/my-learning',
  '/my-practice',
  '/notice-board',
  '/offers',
  '/practice',
  '/profile',
  '/start-practice-session',
  '/subscription',
  '/teacher',
  '/teacher-marketplace',
  '/teachers',
  '/test',
  '/wallet',
];

function shouldForceDocumentNavigation(pathname: string): boolean {
  return FORCED_DOCUMENT_NAVIGATION_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function hasChunkLoadSignature(message: string): boolean {
  const lowered = message.toLowerCase();
  return lowered.includes('chunkloaderror')
    || lowered.includes('loading chunk')
    || lowered.includes('/_next/static/chunks/')
    || lowered.includes("cannot read properties of undefined (reading 'call')")
    || lowered.includes('cannot read properties of undefined (reading "call")');
}

function shouldRetry(pathname: string): boolean {
  try {
    const raw = sessionStorage.getItem(RETRY_KEY);
    const now = Date.now();
    if (raw) {
      const parsed = JSON.parse(raw) as { pathname?: string; ts?: number };
      if (parsed.pathname === pathname && typeof parsed.ts === 'number' && now - parsed.ts < RETRY_WINDOW_MS) {
        return false;
      }
    }
    sessionStorage.setItem(RETRY_KEY, JSON.stringify({ pathname, ts: now }));
    return true;
  } catch {
    return true;
  }
}

function clearRetryStateLater() {
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(RETRY_KEY);
    } catch {
      // no-op
    }
  }, RETRY_WINDOW_MS);
}

function reloadWithBuster() {
  const url = new URL(window.location.href);
  url.searchParams.set('__chunk_retry', Date.now().toString());
  window.location.replace(url.toString());
}

export default function ChunkLoadRecovery() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('__chunk_retry')) return;
    url.searchParams.delete('__chunk_retry');
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, []);

  useEffect(() => {
    const maybeRecover = (message: string) => {
      if (!hasChunkLoadSignature(message)) return;
      if (!shouldRetry(window.location.pathname)) return;
      reloadWithBuster();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = typeof reason === 'string'
        ? reason
        : (typeof reason?.message === 'string' ? reason.message : '');
      if (!message) return;
      maybeRecover(message);
    };

    const onError = (event: ErrorEvent) => {
      const message = event.message || '';
      if (message) {
        const stack = typeof event.error?.stack === 'string' ? event.error.stack.toLowerCase() : '';
        if (
          stack.includes('webpack-runtime') ||
          stack.includes('__webpack_require__') ||
          stack.includes('initializemodulechunk')
        ) {
          maybeRecover(`${message} ${stack}`);
          return;
        }
        maybeRecover(message);
        return;
      }

      const target = event.target as (HTMLScriptElement | null);
      const src = target?.src || '';
      if (src.includes('/_next/static/chunks/')) {
        maybeRecover(src);
      }
    };

    clearRetryStateLater();
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError, true);

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError, true);
    };
  }, []);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#')) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (!shouldForceDocumentNavigation(url.pathname)) return;

      // Force a full-page load for the logged-in workspace so a freshly deployed app
      // does not keep using a stale client router/runtime from the previous build.
      event.preventDefault();
      window.location.assign(url.toString());
    };

    document.addEventListener('click', onDocumentClick, true);
    return () => {
      document.removeEventListener('click', onDocumentClick, true);
    };
  }, []);

  return null;
}
