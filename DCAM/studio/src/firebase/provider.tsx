'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc, writeBatch } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseStorage } from 'firebase/storage';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'
import { designatedAdminEmail } from '@/firebase/config';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
}

// Internal state for user authentication
interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; // The Auth service instance
  storage: FirebaseStorage | null;
  // User authentication state
  user: User | null;
  isUserLoading: boolean; // True during initial auth check
  userError: Error | null; // Error from auth listener
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult { // Renamed from UserAuthHookResult for consistency if desired, or keep as UserAuthHookResult
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
  storage,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true, // Start loading until first auth event
    userError: null,
  });

  // Effect to subscribe to Firebase auth state changes
  useEffect(() => {
    if (!auth) { // If no Auth service instance, cannot determine user state
      setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth service not provided.") });
      return;
    }

    setUserAuthState({ user: null, isUserLoading: true, userError: null }); // Reset on auth instance change
    let isActive = true;
    let hasResolvedInitialAuthState = false;

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => { // Auth state determined
        hasResolvedInitialAuthState = true;
        if (!isActive) return;
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
      },
      (error) => { // Auth listener error
        hasResolvedInitialAuthState = true;
        if (!isActive) return;
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );

    void auth.authStateReady()
      .then(() => {
        if (!isActive || hasResolvedInitialAuthState) return;
        hasResolvedInitialAuthState = true;
        setUserAuthState({ user: auth.currentUser ?? null, isUserLoading: false, userError: null });
      })
      .catch((error) => {
        if (!isActive || hasResolvedInitialAuthState) return;
        hasResolvedInitialAuthState = true;
        const normalizedError = error instanceof Error ? error : new Error('Unable to restore Firebase auth state.');
        console.error("FirebaseProvider: authStateReady error:", normalizedError);
        setUserAuthState({ user: auth.currentUser ?? null, isUserLoading: false, userError: normalizedError });
      });

    return () => {
      isActive = false;
      unsubscribe();
    }; // Cleanup
  }, [auth]); // Depends on the auth instance

  const { user } = userAuthState;
  const roleCheckStorageKey = user ? `dcam_role_doc_checked_v2_${user.uid}` : '';
  
  useEffect(() => {
    const ensureRoleDocuments = async () => {
      if (!user || !firestore) return;
      if (typeof window !== 'undefined' && roleCheckStorageKey) {
        const wasChecked = window.sessionStorage.getItem(roleCheckStorageKey);
        if (wasChecked === '1') return;
      }

      try {
        const userRef = doc(firestore, 'users', user.uid);
        const teacherRoleRef = doc(firestore, 'roles_teacher', user.uid);
        const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
        const [userSnap, teacherRoleSnap, adminRoleSnap] = await Promise.all([
          getDoc(userRef),
          getDoc(teacherRoleRef),
          getDoc(adminRoleRef),
        ]);
        const existingUserData = userSnap.exists() ? userSnap.data() as Record<string, unknown> : null;
        const createdAt = new Date().toISOString();
        const isDesignatedAdmin = (user.email || '').toLowerCase() === designatedAdminEmail;
        const hasTeacherRoleDoc = teacherRoleSnap.exists();
        const hasAdminRoleDoc = adminRoleSnap.exists() || isDesignatedAdmin;
        const existingRoleId = typeof existingUserData?.roleId === 'string' ? existingUserData.roleId : '';
        const existingTeacherStatus = typeof existingUserData?.teacherStatus === 'string' ? existingUserData.teacherStatus : '';
        const hasLegacyApprovedTeacherProfile =
          existingRoleId === 'teacher'
          && existingTeacherStatus !== 'pending'
          && existingTeacherStatus !== 'rejected';
        const [firstName = 'User', ...lastNameParts] = (user.displayName || '')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        const restoredRoleId =
          hasAdminRoleDoc
            ? 'admin'
            : existingRoleId === 'admin'
              ? 'admin'
              : existingRoleId === 'teacher'
                ? 'teacher'
                : existingRoleId === 'student'
                  ? 'student'
                  : hasTeacherRoleDoc
                    ? 'teacher'
                    : 'student';
        const shouldRestoreApprovedTeacher =
          restoredRoleId === 'admin'
          || hasLegacyApprovedTeacherProfile;
        const shouldProvisionTeacherRoleDoc = restoredRoleId === 'admin' || shouldRestoreApprovedTeacher;
        const batch = writeBatch(firestore);
        let hasPendingWrites = false;

        if (!userSnap.exists()) {
          const restoredProfile: Record<string, unknown> = {
            id: user.uid,
            firstName,
            lastName: lastNameParts.join(' '),
            email: user.email || '',
            phoneNumber: user.phoneNumber || '',
            status: 'active',
            roleId: restoredRoleId,
          };

          if (user.photoURL) {
            restoredProfile.photoURL = user.photoURL;
          }
          if (shouldRestoreApprovedTeacher) {
            restoredProfile.teacherStatus = 'approved';
          } else if (restoredRoleId === 'teacher') {
            restoredProfile.teacherStatus = 'pending';
          }

          batch.set(userRef, restoredProfile, { merge: false });
          hasPendingWrites = true;
        } else {
          const roleUpdate: Record<string, unknown> = {};
          if ((hasAdminRoleDoc || hasTeacherRoleDoc) && existingRoleId !== restoredRoleId) {
            roleUpdate.roleId = restoredRoleId;
          }
          if (shouldRestoreApprovedTeacher && existingTeacherStatus !== 'approved') {
            roleUpdate.teacherStatus = 'approved';
          }
          if (Object.keys(roleUpdate).length > 0) {
            batch.set(userRef, roleUpdate, { merge: true });
            hasPendingWrites = true;
          }
        }

        if (shouldProvisionTeacherRoleDoc && !hasTeacherRoleDoc) {
          batch.set(teacherRoleRef, { createdAt }, { merge: true });
          hasPendingWrites = true;
        }

        if (restoredRoleId === 'admin' && !adminRoleSnap.exists()) {
          batch.set(adminRoleRef, { createdAt }, { merge: true });
          hasPendingWrites = true;
        }

        if (hasPendingWrites) {
          await batch.commit();
        }

        if (typeof window !== 'undefined' && roleCheckStorageKey) {
          window.sessionStorage.setItem(roleCheckStorageKey, '1');
        }
      } catch (error) {
        console.error("Failed to provision role documents:", error);
      }
    };

    ensureRoleDocuments();
  }, [user, firestore, roleCheckStorageKey]);

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth && storage);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      storage: servicesAvailable ? storage : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [firebaseApp, firestore, auth, storage, userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if core services are not available or used outside provider.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth || !context.storage) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    storage: context.storage,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

/** Hook to access Firebase Storage instance. */
export const useStorage = (): FirebaseStorage => {
  const { storage } = useFirebase();
  return storage;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => { // Renamed from useAuthUser
  const { user, isUserLoading, userError } = useFirebase(); // Leverages the main hook
  return { user, isUserLoading, userError };
};
