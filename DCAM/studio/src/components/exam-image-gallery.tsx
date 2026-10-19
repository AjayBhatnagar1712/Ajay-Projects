'use client';

import { useMemo } from 'react';

import { cn } from '@/lib/utils';

type ExamImageGalleryProps = {
  sources: unknown[];
  altPrefix: string;
  listClassName?: string;
  frameClassName?: string;
  imageClassName?: string;
  imageLoading?: 'lazy' | 'eager';
};

const IMAGE_URL_PREFIX_RE = /^(https?:\/\/|data:image\/|blob:|\/)/i;
const DATA_IMAGE_PREFIX_RE = /^data:image\//i;
const IMAGE_PRELOAD_TIMEOUT_MS = 12000;
const IMAGE_PRELOAD_CONCURRENCY = 4;

const isDataImageUrl = (value: string) => DATA_IMAGE_PREFIX_RE.test(value);

const normalizeDataImageUrl = (value: string) => {
  const trimmed = value.trim();
  const commaIndex = trimmed.indexOf(',');
  if (commaIndex === -1) return trimmed;
  const header = trimmed.slice(0, commaIndex + 1);
  const payload = trimmed.slice(commaIndex + 1).replace(/\s+/g, '');
  return `${header}${payload}`;
};

const normalizeSourceList = (input: unknown): string[] => {
  if (!input) return [];
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return [];
    if (isDataImageUrl(raw)) {
      return [normalizeDataImageUrl(raw)];
    }
    if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
      try {
        return normalizeSourceList(JSON.parse(raw));
      } catch {
        return [raw];
      }
    }
    if (raw.includes(',') || raw.includes('\n')) {
      return raw
        .split(/[\n,]/g)
        .map((value) => value.trim())
        .filter(Boolean);
    }
    return [raw];
  }
  if (Array.isArray(input)) {
    return input.flatMap((item) => normalizeSourceList(item));
  }
  if (typeof input === 'object') {
    return Object.values(input as Record<string, unknown>).flatMap((value) => normalizeSourceList(value));
  }
  return [];
};

const sanitizeExamImageUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || !IMAGE_URL_PREFIX_RE.test(trimmed)) return '';
  if (isDataImageUrl(trimmed)) {
    return normalizeDataImageUrl(trimmed);
  }
  return trimmed;
};

export const normalizeExamImageUrls = (...sources: unknown[]) =>
  Array.from(
    new Set(
      sources
        .flatMap((source) => normalizeSourceList(source))
        .map((url) => sanitizeExamImageUrl(url))
        .filter(Boolean)
    )
  );

export type ExamImagePreloadProgress = {
  completed: number;
  total: number;
  failed: number;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const preloadSingleImageUrl = async (url: string) => {
  if (typeof window === 'undefined') return true;

  const image = new window.Image();

  return await new Promise<boolean>((resolve) => {
    let resolved = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      resolve(false);
    }, IMAGE_PRELOAD_TIMEOUT_MS);

    const finalize = (ok: boolean) => {
      if (resolved) return;
      resolved = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      resolve(ok);
    };

    image.onload = () => finalize(true);
    image.onerror = () => finalize(false);
    image.decoding = 'async';
    image.loading = 'eager';
    image.src = url;

    if (image.complete) {
      finalize(true);
    }
  });
};

export async function preloadExamImageUrls(
  sources: string[],
  onProgress?: (progress: ExamImagePreloadProgress) => void
) {
  const urls = Array.from(new Set((sources || []).map((value) => String(value || '').trim()).filter(Boolean)));
  const total = urls.length;

  if (total === 0) {
    onProgress?.({ completed: 0, total: 0, failed: 0 });
    return { completed: 0, total: 0, failed: 0 };
  }

  let nextIndex = 0;
  let completed = 0;
  let failed = 0;

  const workers = Array.from({ length: Math.min(IMAGE_PRELOAD_CONCURRENCY, total) }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= total) return;

      const ok = await preloadSingleImageUrl(urls[currentIndex]);
      completed += 1;
      if (!ok) {
        failed += 1;
      }
      onProgress?.({ completed, total, failed });

      // Yield between image batches to keep the UI responsive on slower devices.
      await delay(0);
    }
  });

  await Promise.all(workers);
  return { completed, total, failed };
}

export async function waitForExamImagesInElement(container: HTMLElement | null) {
  if (typeof window === 'undefined' || !container) return;

  const images = Array.from(container.querySelectorAll('img'));
  if (images.length === 0) return;

  await Promise.all(
    images.map(async (image) => {
      const element = image as HTMLImageElement;

      if (element.complete && element.naturalWidth > 0) {
        if (typeof element.decode === 'function') {
          try {
            await element.decode();
          } catch {
            // Ignore decode failures and let html2canvas attempt a fallback render.
          }
        }
        return;
      }

      await new Promise<void>((resolve) => {
        let settled = false;
        const finalize = () => {
          if (settled) return;
          settled = true;
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }
          element.removeEventListener('load', finalize);
          element.removeEventListener('error', finalize);
          resolve();
        };
        let timeoutHandle: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          finalize();
        }, IMAGE_PRELOAD_TIMEOUT_MS);

        element.addEventListener('load', finalize, { once: true });
        element.addEventListener('error', finalize, { once: true });

        if (element.complete) {
          finalize();
        }
      });
    })
  );
}

export const getExamQuestionAssetUrls = (question: Record<string, unknown>) =>
  normalizeExamImageUrls(
    question.imageUrls,
    question.imageUrl,
    question.questionImageUrls,
    question.questionImageUrl,
    question.explanationImageUrls,
    question.explanationImageUrl,
    question.solutionImageUrls,
    question.solutionImageUrl,
    question.solutionImages,
    question.answerExplanationImageUrls,
    question.answerExplanationImageUrl,
    question.answerExplanationImages,
    question.explanationImages,
    question.ocrExplanationImageUrls,
    question.ocrExplanationImageUrl,
    question.ocrExplanationImages,
  );

export function ExamImageGallery({
  sources,
  altPrefix,
  listClassName,
  frameClassName,
  imageClassName,
  imageLoading = 'lazy',
}: ExamImageGalleryProps) {
  const imageUrls = useMemo(() => normalizeExamImageUrls(...sources), [sources]);
  if (imageUrls.length === 0) return null;

  return (
    <div className={cn('space-y-2', listClassName)}>
      {imageUrls.map((url, index) => (
        <div key={`${url}-${index}`} className={cn('overflow-hidden rounded-md border bg-muted/50 p-2', frameClassName)}>
          <img
            src={url}
            alt={`${altPrefix} ${index + 1}`}
            loading={imageLoading}
            decoding="async"
            className={cn('mx-auto h-auto max-h-[70vh] w-auto max-w-full rounded-md object-contain', imageClassName)}
          />
        </div>
      ))}
    </div>
  );
}
