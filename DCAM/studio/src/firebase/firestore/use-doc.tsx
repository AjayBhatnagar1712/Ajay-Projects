'use client';
    
import { useEffect, useState } from 'react';
import {
  DocumentReference,
  onSnapshot,
  getDoc,
  getDocFromServer,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

const RETRYABLE_FIRESTORE_DOC_CODES = new Set<string>([
  'aborted',
  'cancelled',
  'deadline-exceeded',
  'failed-precondition',
  'internal',
  'resource-exhausted',
  'unavailable',
  'unknown',
]);
const MAX_DOC_RETRY_ATTEMPTS = 6;
const INITIAL_DOC_FETCH_TIMEOUT_MS = 1200;

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/**
 * React hook to subscribe to a single Firestore document in real-time.
 * Handles nullable references.
 * 
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} docRef -
 * The Firestore DocumentReference. Waits if null/undefined.
 * @returns {UseDocResult<T>} Object with data, isLoading, error.
 */
export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [hasResolvedInitialSnapshot, setHasResolvedInitialSnapshot] = useState<boolean>(false);
  const [resolvedDocPath, setResolvedDocPath] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const currentDocPath = memoizedDocRef?.path ?? null;

  useEffect(() => {
    setRetryAttempt(0);
    setRetryTick(0);
  }, [currentDocPath]);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      setHasResolvedInitialSnapshot(false);
      setResolvedDocPath(null);
      setRetryAttempt(0);
      return;
    }

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;
    let didResolveInitialFetch = false;
    setIsLoading(true);
    setError(null);
    setHasResolvedInitialSnapshot(false);
    setResolvedDocPath((prevPath) => (prevPath === memoizedDocRef.path ? prevPath : null));
    // Optional: setData(null); // Clear previous data instantly

    const applyDocSnapshot = (
      snapshot: DocumentSnapshot<DocumentData>,
      source: 'listener' | 'server-fallback' | 'cache-fallback' = 'listener'
    ) => {
      if (snapshot.exists()) {
        setData({ ...(snapshot.data() as T), id: snapshot.id });
      } else {
        setData(null);
      }
      setError(null);

      const isInitialMissingCacheSnapshot =
        !didResolveInitialFetch
        && source === 'listener'
        && snapshot.metadata.fromCache
        && !snapshot.exists();

      if (isInitialMissingCacheSnapshot) {
        // A missing-cache snapshot can arrive before Firestore checks the server.
        // Keep loading so pages don't treat "doc missing in cache" as the final answer.
        setHasResolvedInitialSnapshot(false);
        setResolvedDocPath(null);
        setIsLoading(true);
        return;
      }

      didResolveInitialFetch = true;
      setRetryAttempt(0);
      setHasResolvedInitialSnapshot(true);
      setResolvedDocPath(memoizedDocRef.path);
      setIsLoading(false);
    };

    const applyDocError = (snapshotError: FirestoreError | Error) => {
      const isPermissionDenied =
        snapshotError instanceof Error
        && 'code' in snapshotError
        && (snapshotError as FirestoreError).code === 'permission-denied';
      const errorCode =
        snapshotError instanceof Error && 'code' in snapshotError
          ? (snapshotError as FirestoreError).code
          : undefined;
      const isRetryable = !!errorCode && RETRYABLE_FIRESTORE_DOC_CODES.has(errorCode);

      if (isPermissionDenied) {
        didResolveInitialFetch = true;
        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: memoizedDocRef.path,
        });

        setError(contextualError);
        setData(null);
        errorEmitter.emit('permission-error', contextualError);
        setRetryAttempt(0);
        setHasResolvedInitialSnapshot(true);
        setResolvedDocPath(memoizedDocRef.path);
        setIsLoading(false);
        return;
      }

      if (isRetryable && retryAttempt < MAX_DOC_RETRY_ATTEMPTS) {
        const nextAttempt = retryAttempt + 1;
        const retryDelayMs = Math.min(1000 * (2 ** (nextAttempt - 1)), 10_000);
        setError(snapshotError);
        setRetryAttempt(nextAttempt);
        setHasResolvedInitialSnapshot(false);
        setResolvedDocPath(null);
        setIsLoading(true);
        retryTimer = setTimeout(() => {
          setRetryTick((tick) => tick + 1);
        }, retryDelayMs);
        return;
      }

      didResolveInitialFetch = true;
      setError(snapshotError);
      setRetryAttempt(0);
      setHasResolvedInitialSnapshot(true);
      setResolvedDocPath(memoizedDocRef.path);
      setIsLoading(false);
    };

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (isCancelled) return;
        applyDocSnapshot(snapshot);
      },
      (snapshotError: FirestoreError) => {
        if (isCancelled) return;
        applyDocError(snapshotError);
      }
    );

    fallbackTimer = setTimeout(() => {
      if (isCancelled || didResolveInitialFetch) return;

      void getDocFromServer(memoizedDocRef)
        .then((snapshot) => {
          if (isCancelled || didResolveInitialFetch) return;
          applyDocSnapshot(snapshot, 'server-fallback');
          console.warn('useDoc: initial onSnapshot delayed or cache-only, getDocFromServer fallback applied.');
        })
        .catch((fetchError) => {
          if (isCancelled || didResolveInitialFetch) return;

          void getDoc(memoizedDocRef)
            .then((snapshot) => {
              if (isCancelled || didResolveInitialFetch) return;
              applyDocSnapshot(snapshot, 'cache-fallback');
              console.warn('useDoc: getDocFromServer failed, getDoc fallback applied.');
            })
            .catch((cacheFetchError) => {
              if (isCancelled || didResolveInitialFetch) return;
              applyDocError(cacheFetchError as FirestoreError | Error);
            });
        });
    }, INITIAL_DOC_FETCH_TIMEOUT_MS);

    return () => {
      isCancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [memoizedDocRef, retryTick]); // Re-run if the reference changes or retry is requested.

  const effectiveIsLoading =
    !!memoizedDocRef &&
    (isLoading || resolvedDocPath !== currentDocPath || !hasResolvedInitialSnapshot);

  return { data, isLoading: effectiveIsLoading, error };
}
