'use client';

import React, { useEffect, useMemo, type ReactNode } from 'react';
import { AppSessionBridge } from '@/components/app-session-bridge';
import { FirebaseProvider } from '@/firebase/provider';
import { firebaseConfig } from '@/firebase/config';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const INDEXED_DB_RECOVERY_KEY = 'dcam_indexeddb_recovery_attempted_v1';

function isIndexedDbCorruptionError(value: unknown) {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === 'string'
        ? value
        : value && typeof value === 'object' && 'message' in value && typeof value.message === 'string'
          ? value.message
          : '';

  return (
    message.includes('refusing to open IndexedDB database due to potential corruption')
    || message.includes('corruption of the IndexedDB database data')
  );
}

function deleteIndexedDbDatabase(name: string) {
  return new Promise<void>((resolve) => {
    const request = window.indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

async function clearFirebaseIndexedDbDatabases() {
  if (typeof window === 'undefined' || !window.indexedDB) return;

  const knownDatabaseNames = new Set([
    'firebaseLocalStorageDb',
    `firestore/[DEFAULT]/${firebaseConfig.projectId}/main`,
  ]);

  if ('databases' in window.indexedDB && typeof window.indexedDB.databases === 'function') {
    const databases = await window.indexedDB.databases();
    databases
      .map((database) => database.name)
      .filter((name): name is string => !!name)
      .filter((name) => /firebase|firestore/i.test(name))
      .forEach((name) => knownDatabaseNames.add(name));
  }

  await Promise.all([...knownDatabaseNames].map((name) => deleteIndexedDbDatabase(name)));
}

function registerIndexedDbCorruptionRecovery() {
  const recover = (value: unknown) => {
    if (!isIndexedDbCorruptionError(value)) return false;
    if (window.sessionStorage.getItem(INDEXED_DB_RECOVERY_KEY) === '1') return true;

    window.sessionStorage.setItem(INDEXED_DB_RECOVERY_KEY, '1');
    void clearFirebaseIndexedDbDatabases().finally(() => {
      window.location.reload();
    });
    return true;
  };

  const handleWindowError = (event: ErrorEvent) => {
    if (recover(event.error ?? event.message)) {
      event.preventDefault();
    }
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (recover(event.reason)) {
      event.preventDefault();
    }
  };

  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  return () => {
    window.removeEventListener('error', handleWindowError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
}

function initializeFirestoreClient(firebaseApp: ReturnType<typeof getApp>) {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: memoryLocalCache(),
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    return getFirestore(firebaseApp);
  }
}

function initializeAuthClient(firebaseApp: ReturnType<typeof getApp>) {
  return getAuth(firebaseApp);
}

async function ensurePersistentAuthSession(auth: Auth) {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (localStorageError) {
    console.warn('Firebase auth localStorage persistence could not be enabled.', {
      localStorageError,
    });
  }
}

function initializeFirebaseClient() {
  const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const storageBucket = firebaseConfig.storageBucket;

  return {
    firebaseApp,
    auth: initializeAuthClient(firebaseApp),
    firestore: initializeFirestoreClient(firebaseApp),
    storage: getStorage(firebaseApp, storageBucket ? `gs://${storageBucket}` : undefined),
  };
}

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebaseClient();
  }, []); // Empty dependency array ensures this runs only once on mount

  useEffect(() => {
    void ensurePersistentAuthSession(firebaseServices.auth);
  }, [firebaseServices.auth]);

  useEffect(() => {
    return registerIndexedDbCorruptionRecovery();
  }, []);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
      storage={firebaseServices.storage}
    >
      <AppSessionBridge />
      {children}
    </FirebaseProvider>
  );
}
