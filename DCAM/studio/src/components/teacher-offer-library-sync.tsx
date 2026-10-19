'use client';

import { useEffect, useRef } from 'react';
import { collection, doc, getDoc, orderBy, query, type Firestore } from 'firebase/firestore';

import { setDocumentNonBlocking, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { isCourseHiddenFromStudents } from '@/lib/course-assignment';
import type { LiveBatchSessionPurchaseHistoryItem } from '@/lib/live-batch-session-access';
import type { TeacherOffer } from '@/lib/teacher-offers';

export type TeacherOfferPurchaseRecord = {
  id: string;
  offerId?: string;
  teacherOfferId?: string;
  teacherId?: string;
  teacherName?: string;
  status?: 'paid' | 'failed';
  currency?: string;
  purchasedAt?: unknown;
  updatedAt?: unknown;
  offerSnapshot?: TeacherOffer | null;
  offer?: TeacherOffer | null;
  teacherOffer?: TeacherOffer | null;
  teacherOfferSnapshot?: TeacherOffer | null;
};

type MaterializeTeacherOfferContentUnlocksInput = {
  firestore: Firestore;
  userId: string;
  purchase: TeacherOfferPurchaseRecord;
  offer?: TeacherOffer | null;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
};

const isTeacherOfferLike = (value: unknown): value is TeacherOffer => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as TeacherOffer;
  return (
    Array.isArray(candidate.courses)
    || Array.isArray(candidate.crashCourses)
    || Array.isArray(candidate.mockTests)
    || Array.isArray(candidate.liveBatches)
    || !!candidate.premiumPracticePack
    || !!candidate.premiumCustomMockPack
  );
};

export const resolveTeacherOfferFromPurchase = (
  purchase: TeacherOfferPurchaseRecord,
  explicitOffer?: TeacherOffer | null
) => {
  if (isTeacherOfferLike(explicitOffer)) return explicitOffer;
  const embeddedCandidates = [
    purchase.offerSnapshot,
    purchase.offer,
    purchase.teacherOffer,
    purchase.teacherOfferSnapshot,
  ];
  const embeddedOffer = embeddedCandidates.find((candidate) => isTeacherOfferLike(candidate));
  if (embeddedOffer) return embeddedOffer;
  return isTeacherOfferLike(purchase) ? (purchase as unknown as TeacherOffer) : null;
};

export const materializeTeacherOfferContentUnlocks = async ({
  firestore,
  userId,
  purchase,
  offer: explicitOffer,
}: MaterializeTeacherOfferContentUnlocksInput) => {
  const offer = resolveTeacherOfferFromPurchase(purchase, explicitOffer);
  if (!offer) return false;

  const purchaseId = String(purchase.id || '').trim();
  const offerId = String(offer.id || purchase.offerId || purchase.teacherOfferId || '').trim();
  const teacherId = String(purchase.teacherId || offer.createdByTeacherId || '').trim();
  const teacherName = String(purchase.teacherName || '').trim();
  const purchasedAtIso = (toDate(purchase.updatedAt) || toDate(purchase.purchasedAt) || new Date()).toISOString();

  for (const course of [...(offer.courses || []), ...(offer.crashCourses || [])]) {
    const courseId = String(course?.id || '').trim();
    if (!courseId) continue;
    const courseRef = doc(firestore, 'courses', courseId);
    const courseSnap = await getDoc(courseRef);
    if (!courseSnap.exists() || isCourseHiddenFromStudents(courseSnap.data() as { publicationStatus?: string | null })) continue;

    const purchasedCourseRef = doc(firestore, 'users', userId, 'purchased_courses', courseId);
    const purchasedCourseSnap = await getDoc(purchasedCourseRef);
    if (purchasedCourseSnap.exists()) continue;

    await setDocumentNonBlocking(
      purchasedCourseRef,
      {
        id: courseId,
        courseId,
        teacherId: teacherId || null,
        offerId: offerId || null,
        offerPurchaseId: purchaseId || null,
        purchasedAt: purchasedAtIso,
        source: 'teacher_offer',
      },
      { merge: true }
    );
  }

  for (const mockTest of offer.mockTests || []) {
    const mockTestId = String(mockTest?.id || '').trim();
    if (!mockTestId) continue;
    const purchasedMockTestRef = doc(firestore, 'users', userId, 'purchased_mock_tests', mockTestId);
    const purchasedMockTestSnap = await getDoc(purchasedMockTestRef);
    if (purchasedMockTestSnap.exists()) continue;

    await setDocumentNonBlocking(
      purchasedMockTestRef,
      {
        id: mockTestId,
        testId: mockTestId,
        teacherId: teacherId || null,
        offerId: offerId || null,
        offerPurchaseId: purchaseId || null,
        purchasedAt: purchasedAtIso,
        source: 'teacher_offer',
      },
      { merge: true }
    );
  }

  for (const liveBatch of offer.liveBatches || []) {
    const batchId = String(liveBatch?.id || '').trim();
    if (!batchId) continue;

    const includedSessions = Math.max(0, Number(liveBatch.includedSessions || 0));
    const totalSessionsInBatch = Math.max(0, Number(liveBatch.totalSessions || 0));
    const batchPurchaseHistoryId = `teacher_offer_${purchaseId}_${batchId}`;
    const liveBatchRef = doc(firestore, 'live_batches', batchId);
    const liveBatchSnap = await getDoc(liveBatchRef);
    const persistedLiveBatch = liveBatchSnap.exists()
      ? (liveBatchSnap.data() as {
          title?: string;
          teacherId?: string;
          teacherName?: string;
          publicationStatus?: string;
        })
      : null;
    const isLiveBatchPublishable =
      !!persistedLiveBatch
      && (
        !('publicationStatus' in persistedLiveBatch)
        || String(persistedLiveBatch.publicationStatus || '').trim() === 'published'
      );
    const newHistoryEntry: LiveBatchSessionPurchaseHistoryItem = {
      purchasedAt: purchasedAtIso,
      sessionsPurchased: includedSessions,
      sessionFee: 0,
      amountPaid: 0,
      paymentId: batchPurchaseHistoryId,
      planId: null,
    };

    const purchasedLiveBatchRef = doc(firestore, 'users', userId, 'purchased_live_batches', batchId);
    const purchasedLiveBatchSnap = await getDoc(purchasedLiveBatchRef);
    const existingPurchasedLiveBatch = purchasedLiveBatchSnap.exists()
      ? (purchasedLiveBatchSnap.data() as {
          sessionPurchaseHistory?: LiveBatchSessionPurchaseHistoryItem[];
          sessionsPurchased?: number;
          totalSessionsInBatch?: number;
        })
      : null;
    const existingPurchasedHistory = Array.isArray(existingPurchasedLiveBatch?.sessionPurchaseHistory)
      ? existingPurchasedLiveBatch.sessionPurchaseHistory
      : [];
    const purchasedHistoryWithoutOfferEntry = existingPurchasedHistory.filter(
      (entry) => String(entry?.paymentId || '').trim() !== batchPurchaseHistoryId
    );
    const purchasedLiveBatchHistory =
      includedSessions > 0
        ? [...purchasedHistoryWithoutOfferEntry, newHistoryEntry]
        : purchasedHistoryWithoutOfferEntry;
    const totalPurchasedSessions =
      purchasedLiveBatchHistory.length > 0
        ? purchasedLiveBatchHistory.reduce(
            (sum, entry) => sum + Math.max(0, Number(entry?.sessionsPurchased || 0)),
            0
          )
        : Math.max(0, Number(existingPurchasedLiveBatch?.sessionsPurchased || 0), includedSessions);

    await setDocumentNonBlocking(
      purchasedLiveBatchRef,
      {
        id: batchId,
        batchId,
        liveBatchId: batchId,
        teacherId: teacherId || null,
        offerId: offerId || null,
        offerPurchaseId: purchaseId || null,
        purchasedAt: purchasedAtIso,
        sessionsPurchased: totalPurchasedSessions,
        totalSessionsInBatch: Math.max(totalSessionsInBatch, Number(existingPurchasedLiveBatch?.totalSessionsInBatch || 0)),
        sessionPurchaseHistory: purchasedLiveBatchHistory,
        latestPurchase: includedSessions > 0 ? newHistoryEntry : null,
        source: 'teacher_offer',
      },
      { merge: true }
    );

    if (!isLiveBatchPublishable) {
      continue;
    }

    const enrolledLiveBatchRef = doc(firestore, 'users', userId, 'enrolled_live_batches', batchId);
    const enrolledLiveBatchSnap = await getDoc(enrolledLiveBatchRef);
    const existingEnrolledLiveBatch = enrolledLiveBatchSnap.exists()
      ? (enrolledLiveBatchSnap.data() as {
          enrolledAt?: string;
          hiddenFromMyBatch?: boolean;
          hiddenFromMyBatchAt?: string | null;
          sessionPurchaseHistory?: LiveBatchSessionPurchaseHistoryItem[];
          sessionsPurchased?: number;
          totalSessionsInBatch?: number;
        })
      : null;
    const existingEnrolledHistory = Array.isArray(existingEnrolledLiveBatch?.sessionPurchaseHistory)
      ? existingEnrolledLiveBatch.sessionPurchaseHistory
      : [];
    const enrolledHistoryWithoutOfferEntry = existingEnrolledHistory.filter(
      (entry) => String(entry?.paymentId || '').trim() !== batchPurchaseHistoryId
    );
    const enrolledLiveBatchHistory =
      includedSessions > 0
        ? [...enrolledHistoryWithoutOfferEntry, newHistoryEntry]
        : enrolledHistoryWithoutOfferEntry;
    const totalEnrolledSessions =
      enrolledLiveBatchHistory.length > 0
        ? enrolledLiveBatchHistory.reduce(
            (sum, entry) => sum + Math.max(0, Number(entry?.sessionsPurchased || 0)),
            0
          )
        : Math.max(0, Number(existingEnrolledLiveBatch?.sessionsPurchased || 0), includedSessions);

    await setDocumentNonBlocking(
      enrolledLiveBatchRef,
      {
        id: batchId,
        batchId,
        title: String(persistedLiveBatch?.title || liveBatch.title || '').trim() || 'Live Batch',
        teacherId: String(persistedLiveBatch?.teacherId || teacherId || '').trim(),
        teacherName: String(persistedLiveBatch?.teacherName || teacherName || '').trim(),
        accessLevel: 'paid',
        enrolledAt: existingEnrolledLiveBatch?.hiddenFromMyBatch !== undefined
          ? (existingEnrolledLiveBatch as { enrolledAt?: string }).enrolledAt || purchasedAtIso
          : purchasedAtIso,
        paidAt: purchasedAtIso,
        paymentPlanId: null,
        hiddenFromMyBatch: existingEnrolledLiveBatch?.hiddenFromMyBatch ?? false,
        hiddenFromMyBatchAt: existingEnrolledLiveBatch?.hiddenFromMyBatchAt ?? null,
        sessionsPurchased: totalEnrolledSessions,
        sessionFee: 0,
        totalSessionsInBatch: Math.max(totalSessionsInBatch, Number(existingEnrolledLiveBatch?.totalSessionsInBatch || 0)),
        amountPaid: 0,
        sessionPurchaseHistory: enrolledLiveBatchHistory,
        latestPurchase: includedSessions > 0 ? newHistoryEntry : null,
        offerId: offerId || null,
        offerPurchaseId: purchaseId || null,
        source: 'teacher_offer',
      },
      { merge: true }
    );
  }

  return true;
};

export default function TeacherOfferLibrarySync() {
  const firestore = useFirestore();
  const { user } = useUser();
  const syncedOfferPurchaseKeysRef = useRef<Set<string>>(new Set());

  const purchasedTeacherOffersQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'users', user.uid, 'purchased_teacher_offers'), orderBy('purchasedAt', 'desc'));
  }, [firestore, user?.uid]);

  const teacherOfferPurchasesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'users', user.uid, 'teacher_offer_purchases'), orderBy('purchasedAt', 'desc'));
  }, [firestore, user?.uid]);

  const { data: purchasedTeacherOffersData } = useCollection<TeacherOfferPurchaseRecord>(purchasedTeacherOffersQuery);
  const { data: teacherOfferPurchasesData } = useCollection<TeacherOfferPurchaseRecord>(teacherOfferPurchasesQuery);
  const purchasedTeacherOffers = purchasedTeacherOffersData || [];
  const teacherOfferPurchases = teacherOfferPurchasesData || [];

  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const mergedPurchases = [...purchasedTeacherOffers, ...teacherOfferPurchases]
      .map((purchase) => ({ ...purchase, id: String(purchase.id || '').trim() }))
      .filter((purchase) => purchase.id && purchase.status !== 'failed');

    if (mergedPurchases.length === 0) return;

    const dedupedPurchases = new Map<string, TeacherOfferPurchaseRecord>();
    mergedPurchases.forEach((purchase) => {
      const offerKey = String(purchase.offerId || purchase.teacherOfferId || '').trim();
      const dedupeKey = `${offerKey}::${purchase.id}`;
      dedupedPurchases.set(dedupeKey, purchase);
    });

    let isCancelled = false;

    const syncPurchases = async () => {
      for (const purchase of dedupedPurchases.values()) {
        if (isCancelled) return;

        const syncKey = `${purchase.id}::${String(purchase.updatedAt || purchase.purchasedAt || '')}`;
        if (syncedOfferPurchaseKeysRef.current.has(syncKey)) continue;

        const materialized = await materializeTeacherOfferContentUnlocks({
          firestore,
          userId: user.uid,
          purchase,
        });
        if (materialized) {
          syncedOfferPurchaseKeysRef.current.add(syncKey);
        }
      }
    };

    syncPurchases().catch(() => {
      // Ignore sync errors and keep the rest of the student workspace usable.
    });

    return () => {
      isCancelled = true;
    };
  }, [firestore, purchasedTeacherOffers, teacherOfferPurchases, user?.uid]);

  return null;
}
