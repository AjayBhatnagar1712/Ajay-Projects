'use client';
import { normalizeQuestionDifficulty } from '@/lib/question-difficulty';

import {
  collection,
  documentId,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  getDocs,
  getDocsFromCache,
  getDocsFromServer,
  query,
  where,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';

const QUERY_CHUNK_SIZE = 30;
const QUERY_CONCURRENCY = 4;
const SUBJECT_CACHE_TTL_MS = 5 * 60 * 1000;
const QUESTION_DOC_CACHE_TTL_MS = 2 * 60 * 1000;
const QUERY_SERVER_TIMEOUT_MS = 7000;
const QUERY_FALLBACK_TIMEOUT_MS = 7000;
const DOC_SERVER_TIMEOUT_MS = 5000;
const DOC_FALLBACK_TIMEOUT_MS = 5000;
const RETRYABLE_READ_CODES = new Set([
  'aborted',
  'cancelled',
  'deadline-exceeded',
  'failed-precondition',
  'internal',
  'resource-exhausted',
  'unavailable',
  'unknown',
  'timeout',
]);

type TimeoutError = Error & { code: 'timeout' };
type SubjectCacheState = {
  expiresAt: number;
  promise: Promise<Map<string, string>> | null;
  value: Map<string, string> | null;
};
type QuestionDocCacheEntry = {
  expiresAt: number;
  data: DocumentData | null;
};

const subjectCache: SubjectCacheState = {
  expiresAt: 0,
  promise: null,
  value: null,
};
const questionDocCache = new Map<string, QuestionDocCacheEntry>();

function createTimeoutError(label: string, timeoutMs: number): TimeoutError {
  const error = new Error(`${label} timed out after ${timeoutMs}ms`) as TimeoutError;
  error.code = 'timeout';
  return error;
}

function normalizeFirestoreCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  const rawCode = String((error as { code?: unknown }).code || '').trim().toLowerCase();
  return rawCode.includes('/') ? rawCode.split('/').pop() || rawCode : rawCode;
}

function isRetryableReadError(error: unknown) {
  return RETRYABLE_READ_CODES.has(normalizeFirestoreCode(error));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreshQuestionDocCacheValue(questionId: string): DocumentData | null | undefined {
  const cacheEntry = questionDocCache.get(questionId);
  if (!cacheEntry) return undefined;
  if (cacheEntry.expiresAt <= Date.now()) {
    questionDocCache.delete(questionId);
    return undefined;
  }
  return cacheEntry.data;
}

async function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(createTimeoutError(label, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function withRetry<T>(label: string, operation: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableReadError(error) || attempt === attempts) {
        break;
      }
      await delay(250 * attempt);
    }
  }
  throw lastError;
}

export async function readQuerySnapshotResilient<T extends DocumentData>(
  targetQuery: Query<T>,
  label: string
): Promise<QuerySnapshot<T>> {
  let lastError: unknown = null;

  try {
    return await withRetry(label, () => withTimeout(() => getDocsFromServer(targetQuery), QUERY_SERVER_TIMEOUT_MS, label));
  } catch (error) {
    lastError = error;
  }

  try {
    return await getDocsFromCache(targetQuery);
  } catch {
    // No usable cache snapshot.
  }

  try {
    return await withTimeout(() => getDocs(targetQuery), QUERY_FALLBACK_TIMEOUT_MS, `${label} fallback`);
  } catch (fallbackError) {
    throw lastError ?? fallbackError;
  }
}

export async function readDocSnapshotResilient<T extends DocumentData>(
  docRef: DocumentReference<T>,
  label: string
) {
  let lastError: unknown = null;

  try {
    return await withRetry(label, () => withTimeout(() => getDocFromServer(docRef), DOC_SERVER_TIMEOUT_MS, label));
  } catch (error) {
    lastError = error;
  }

  try {
    return await getDocFromCache(docRef);
  } catch {
    // No usable cache snapshot.
  }

  try {
    return await withTimeout(() => getDoc(docRef), DOC_FALLBACK_TIMEOUT_MS, `${label} fallback`);
  } catch (fallbackError) {
    throw lastError ?? fallbackError;
  }
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<TResult>
): Promise<TResult[]> {
  if (items.length === 0) return [];

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function loadSubjectNameMap(firestore: Firestore): Promise<Map<string, string>> {
  if (subjectCache.value && subjectCache.expiresAt > Date.now()) {
    return subjectCache.value;
  }

  if (subjectCache.promise) {
    return subjectCache.promise;
  }

  subjectCache.promise = (async () => {
    try {
      const snapshot = await readQuerySnapshotResilient(collection(firestore, 'subjects'), 'subjects');
      const nextValue = new Map<string, string>();
      snapshot.forEach((docSnap) => {
        nextValue.set(docSnap.id, String(docSnap.data().name || ''));
      });
      subjectCache.value = nextValue;
      subjectCache.expiresAt = Date.now() + SUBJECT_CACHE_TTL_MS;
      return nextValue;
    } catch (error) {
      if (subjectCache.value) {
        return subjectCache.value;
      }
      throw error;
    }
  })();

  try {
    return await subjectCache.promise;
  } finally {
    subjectCache.promise = null;
  }
}

export async function fetchPracticeQuestionDocsByIds(
  firestore: Firestore,
  questionIds: string[],
  label = 'practice questions'
): Promise<Array<{ id: string; data: DocumentData }>> {
  const normalizedIds = Array.from(new Set(
    (questionIds || [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ));

  if (normalizedIds.length === 0) {
    return [];
  }

  const resolvedDocs = new Map<string, DocumentData>();
  const missingIds: string[] = [];

  normalizedIds.forEach((questionId) => {
    const cachedValue = getFreshQuestionDocCacheValue(questionId);
    if (cachedValue === undefined) {
      missingIds.push(questionId);
      return;
    }
    if (cachedValue) {
      resolvedDocs.set(questionId, cachedValue);
    }
  });

  if (missingIds.length > 0) {
    const chunks: string[][] = [];
    for (let index = 0; index < missingIds.length; index += QUERY_CHUNK_SIZE) {
      chunks.push(missingIds.slice(index, index + QUERY_CHUNK_SIZE));
    }

    const chunkResults = await mapWithConcurrency(chunks, QUERY_CONCURRENCY, async (chunk, chunkIndex) => {
      const snapshot = await readQuerySnapshotResilient(
        query(collection(firestore, 'practice_questions'), where(documentId(), 'in', chunk)),
        `${label} chunk ${chunkIndex + 1}/${chunks.length}`
      );

      return snapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => ({
        id: docSnap.id,
        data: normalizeQuestionDifficulty(docSnap.data()),
      }));
    });

    const expiresAt = Date.now() + QUESTION_DOC_CACHE_TTL_MS;
    missingIds.forEach((questionId) => {
      questionDocCache.set(questionId, { expiresAt, data: null });
    });

    chunkResults.flat().forEach(({ id, data }) => {
      questionDocCache.set(id, { expiresAt, data });
      resolvedDocs.set(id, data);
    });
  }

  const orderedDocs: Array<{ id: string; data: DocumentData }> = [];
  normalizedIds.forEach((questionId) => {
    const data = resolvedDocs.get(questionId);
    if (data) {
      orderedDocs.push({ id: questionId, data });
    }
  });

  return orderedDocs;
}

export async function fetchPracticeQuestionSubjectIdsByIds(
  firestore: Firestore,
  questionIds: string[],
  label = 'practice question subjects'
): Promise<string[]> {
  const docs = await fetchPracticeQuestionDocsByIds(firestore, questionIds, label);
  return Array.from(new Set(
    docs
      .map((entry) => String(entry.data.subjectId || '').trim())
      .filter(Boolean)
  ));
}
