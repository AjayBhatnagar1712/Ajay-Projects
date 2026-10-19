
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { getNormalizedTeacherStatus, type TeacherApprovalStatus } from '@/lib/teacher-approval';
import { isQuestionUploadRole } from '@/lib/teacher-authoring';

type UserProfile = {
  roleId?: 'student' | 'teacher' | 'admin' | 'question_upload';
  teacherStatus?: 'pending' | 'approved' | 'rejected';
};

const FORCED_TEACHER_UIDS = new Set([
  'pD1x6hvtraVhURYxNG5aoOkVF9c2',
]);

const TEACHER_CACHE_STORAGE_KEY = 'dcam_teacher_uid_cache_v1';
let hasHydratedPersistentTeacherCache = false;

// Keeps a per-session teacher verdict for each uid.
// This prevents transient snapshot/rules/network hiccups from flipping a verified
// teacher back to false and triggering redirects on protected teacher pages.
const TEACHER_UID_CACHE = new Set<string>();

function hydratePersistentTeacherCache() {
  if (typeof window === 'undefined' || hasHydratedPersistentTeacherCache) return;
  try {
    const raw = window.localStorage.getItem(TEACHER_CACHE_STORAGE_KEY);
    if (!raw) {
      hasHydratedPersistentTeacherCache = true;
      return;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((uid) => {
        if (typeof uid === 'string' && uid.trim()) {
          TEACHER_UID_CACHE.add(uid);
        }
      });
    }
  } catch {
    // Ignore malformed local cache.
  } finally {
    hasHydratedPersistentTeacherCache = true;
  }
}

function persistTeacherCache() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TEACHER_CACHE_STORAGE_KEY, JSON.stringify(Array.from(TEACHER_UID_CACHE)));
  } catch {
    // Ignore storage failures (private mode/quota).
  }
}

export function useIsTeacher() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isCacheHydrated, setIsCacheHydrated] = useState(false);

  useEffect(() => {
    hydratePersistentTeacherCache();
    setIsCacheHydrated(true);
  }, []);

  const teacherRoleRef = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return null;
    return doc(firestore, 'roles_teacher', user.uid);
  }, [firestore, user?.uid]);
  
  const { data: teacherDoc, isLoading: isTeacherLoading } = useDoc(teacherRoleRef);

  const userDocRef = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const isTeacherByRoleDoc = !!teacherDoc;
  const isTeacherByProfileRole = userProfile?.roleId === 'teacher' || userProfile?.roleId === 'admin';
  const isQuestionUploader = isQuestionUploadRole(userProfile?.roleId);
  const isTeacherByForcedUid = !!user?.uid && FORCED_TEACHER_UIDS.has(user.uid);
  const isExplicitStudent = userProfile?.roleId === 'student';
  const isExplicitNonTeacher = isExplicitStudent || isQuestionUploader;
  const teacherStatus: TeacherApprovalStatus | null = useMemo(() => {
    if (isQuestionUploader) {
      return null;
    }
    if (userProfile) {
      return getNormalizedTeacherStatus(userProfile);
    }
    if (isTeacherByForcedUid || isTeacherByRoleDoc) {
      return 'approved';
    }
    return null;
  }, [isQuestionUploader, isTeacherByForcedUid, isTeacherByRoleDoc, userProfile]);
  const isTeacherRole = !isExplicitNonTeacher && (
    isTeacherByProfileRole
    || ((!userProfile || !isTeacherByProfileRole) && (isTeacherByRoleDoc || isTeacherByForcedUid))
  );
  const isApprovedTeacherBySignals = !isExplicitNonTeacher && teacherStatus === 'approved';
  const isTeacherByCache = !!user?.uid && TEACHER_UID_CACHE.has(user.uid);

  if (user?.uid && isApprovedTeacherBySignals) {
    if (!TEACHER_UID_CACHE.has(user.uid)) {
      TEACHER_UID_CACHE.add(user.uid);
      persistTeacherCache();
    }
  }

  useEffect(() => {
    if (!user?.uid || (teacherStatus === null && !isExplicitNonTeacher)) return;
    if (!TEACHER_UID_CACHE.has(user.uid)) return;
    if (isExplicitNonTeacher || teacherStatus === 'pending' || teacherStatus === 'rejected') {
      TEACHER_UID_CACHE.delete(user.uid);
      persistTeacherCache();
    }
  }, [isExplicitNonTeacher, teacherStatus, user?.uid]);

  const isTeacher = useMemo(
    () => (isExplicitNonTeacher ? false : (isApprovedTeacherBySignals || (teacherStatus === null && isTeacherByCache))),
    [isApprovedTeacherBySignals, isExplicitNonTeacher, isTeacherByCache, teacherStatus]
  );
  const isPendingTeacher = !isTeacher && teacherStatus === 'pending';
  const isRejectedTeacher = !isTeacher && teacherStatus === 'rejected';

  const shouldHoldRoleResolution = !!user?.uid && (isTeacherLoading || isProfileLoading);

  return {
    isTeacher,
    isTeacherRole,
    isApprovedTeacher: isTeacher,
    isQuestionUploader,
    isPendingTeacher,
    isRejectedTeacher,
    teacherStatus,
    isExplicitStudent,
    isLoading: !isCacheHydrated || isUserLoading || shouldHoldRoleResolution,
  };
}
