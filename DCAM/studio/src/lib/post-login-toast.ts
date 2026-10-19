'use client';

const POST_LOGIN_TOAST_KEY = 'dcam:post-login-toast';
const DEFAULT_DELAY_MS = 0;
const DEFAULT_DURATION_MS = 7000;
const MAX_DELAY_MS = 30000;
const MAX_DURATION_MS = 20000;

export type PostLoginToastPayload = {
  title?: string;
  description?: string;
  delayMs?: number;
  durationMs?: number;
};

type NormalizedPostLoginToastPayload = {
  title: string;
  description: string;
  delayMs: number;
  durationMs: number;
};

function toBoundedInteger(value: unknown, fallback: number, max: number, min: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.floor(value);
  if (rounded < min) return fallback;
  return Math.min(rounded, max);
}

function normalizePayload(payload: PostLoginToastPayload): NormalizedPostLoginToastPayload {
  const title = typeof payload.title === 'string' && payload.title.trim().length > 0
    ? payload.title.trim()
    : 'Login Successful';
  const description = typeof payload.description === 'string' && payload.description.trim().length > 0
    ? payload.description.trim()
    : 'Welcome back!';
  const delayMs = toBoundedInteger(payload.delayMs, DEFAULT_DELAY_MS, MAX_DELAY_MS, 0);
  const durationMs = toBoundedInteger(payload.durationMs, DEFAULT_DURATION_MS, MAX_DURATION_MS, 1);

  return { title, description, delayMs, durationMs };
}

export function queuePostLoginToast(payload: PostLoginToastPayload = {}): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizePayload(payload);
  window.sessionStorage.setItem(POST_LOGIN_TOAST_KEY, JSON.stringify(normalized));
}

function readPostLoginToast(): NormalizedPostLoginToastPayload | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(POST_LOGIN_TOAST_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PostLoginToastPayload;
    return normalizePayload(parsed);
  } catch {
    return normalizePayload({});
  }
}

export function peekPostLoginToast(): NormalizedPostLoginToastPayload | null {
  return readPostLoginToast();
}

export function clearPostLoginToast(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(POST_LOGIN_TOAST_KEY);
}

export function consumePostLoginToast(): NormalizedPostLoginToastPayload | null {
  const payload = readPostLoginToast();
  if (payload) {
    clearPostLoginToast();
  }
  return payload;
}
