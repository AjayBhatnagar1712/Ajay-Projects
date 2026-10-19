'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  getDocs,
  getDocsFromServer,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { normalizeQuestionDifficulty } from '@/lib/question-difficulty';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/* Internal implementation of Query:
  https://github.com/firebase/firebase-js-sdk/blob/c5f08a9bc5da0d2b0207802c972d53724ccef055/packages/firestore/src/lite-api/reference.ts#L143
*/
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

const INITIAL_COLLECTION_FETCH_TIMEOUT_MS = 1200;

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries.
 *
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence. Also make sure that its dependencies are stable references.
 *
 * @template T Optional type for document data. Defaults to any.
 */
export function useCollection<T = any>(
  memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & { __memo?: boolean }) | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let didResolveInitialFetch = false;
    let isCancelled = false;

    setIsLoading(true);
    setError(null);

    const resolvePath = () =>
      memoizedTargetRefOrQuery.type === 'collection'
        ? (memoizedTargetRefOrQuery as CollectionReference).path
        : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString();

    const applySnapshotResults = (
      snapshot: QuerySnapshot<DocumentData>,
      source: 'listener' | 'server-fallback' | 'cache-fallback' = 'listener'
    ) => {
      const results: ResultItemType[] = [];
      for (const doc of snapshot.docs) {
        const value = doc.data();
        const data = doc.ref.parent.id === 'practice_questions' ? normalizeQuestionDifficulty(value) : value;
        results.push({ ...(data as T), id: doc.id });
      }

      setData(results);
      setError(null);

      const isInitialEmptyCacheSnapshot =
        !didResolveInitialFetch
        && source === 'listener'
        && snapshot.metadata.fromCache
        && results.length === 0;

      if (isInitialEmptyCacheSnapshot) {
        // Firestore can emit an empty local-cache snapshot before the server result arrives.
        // Keep the hook in a loading state so the UI does not settle on a false "0 results".
        setIsLoading(true);
        return;
      }

      didResolveInitialFetch = true;
      setIsLoading(false);
    };

    const applySnapshotError = (snapshotError: FirestoreError | Error) => {
      didResolveInitialFetch = true;

      const isPermissionDenied =
        snapshotError instanceof Error
        && 'code' in snapshotError
        && (snapshotError as FirestoreError).code === 'permission-denied';

      if (isPermissionDenied) {
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: resolvePath(),
        });

        setError(contextualError);
        setData(null);
      } else {
        // Keep transient network/offline errors local and preserve existing data.
        setError(snapshotError);
      }

      setIsLoading(false);
    };

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        if (isCancelled) return;
        applySnapshotResults(snapshot);
      },
      (snapshotError: FirestoreError) => {
        if (isCancelled) return;
        applySnapshotError(snapshotError);
        // Keep this local to the hook state to avoid crashing on sign-out race conditions.
      }
    );

    const fallbackTimer = setTimeout(() => {
      if (didResolveInitialFetch || isCancelled) return;

      void getDocsFromServer(memoizedTargetRefOrQuery)
        .then((snapshot) => {
          if (didResolveInitialFetch || isCancelled) return;
          applySnapshotResults(snapshot, 'server-fallback');
          console.warn('useCollection: initial onSnapshot delayed or cache-only, getDocsFromServer fallback applied.');
        })
        .catch((fetchError) => {
          if (didResolveInitialFetch || isCancelled) return;

          void getDocs(memoizedTargetRefOrQuery)
            .then((snapshot) => {
              if (didResolveInitialFetch || isCancelled) return;
              applySnapshotResults(snapshot, 'cache-fallback');
              console.warn('useCollection: getDocsFromServer failed, getDocs fallback applied.');
            })
            .catch((cacheFetchError) => {
              if (didResolveInitialFetch || isCancelled) return;
              applySnapshotError(cacheFetchError as FirestoreError | Error);
            });
        });
    }, INITIAL_COLLECTION_FETCH_TIMEOUT_MS);

    return () => {
      isCancelled = true;
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [memoizedTargetRefOrQuery]);

  if (memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(memoizedTargetRefOrQuery + ' was not properly memoized using useMemoFirebase');
  }

  return { data, isLoading, error };
}
