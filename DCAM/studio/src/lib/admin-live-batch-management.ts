import {
  calculateLiveBatchSessionCoverage,
  normalizeAdminSessionRemovalHistory,
  normalizeSessionPurchaseHistory,
  type LiveBatchAdminSessionRemovalHistoryItem,
  type LiveBatchEnrollmentLike,
  type LiveBatchLike,
  type LiveBatchManualSessionUnlockHistoryItem,
  type LiveBatchSessionLike,
  type LiveBatchSessionPurchaseHistoryItem,
} from '@/lib/live-batch-session-access';

type AdminAccessActor = {
  adminId?: string;
  adminEmail?: string;
};

export type LiveBatchAccessSnapshot = LiveBatchEnrollmentLike & {
  id?: string;
  batchId?: string;
  liveBatchId?: string;
  title?: string;
  teacherId?: string;
  teacherName?: string;
  accessLevel?: 'free' | 'paid';
  enrolledAt?: string;
  paidAt?: string;
  hiddenFromMyBatch?: boolean;
  hiddenFromMyBatchAt?: string | null;
  sessionsPurchased?: number;
  sessionFee?: number;
  totalSessionsInBatch?: number;
  amountPaid?: number;
  latestPurchase?: LiveBatchSessionPurchaseHistoryItem | null;
  manualSessionUnlockHistory?: LiveBatchManualSessionUnlockHistoryItem[];
  adminAccessDisabled?: boolean;
  adminAccessDisabledAt?: string | null;
  adminDisabledReason?: string | null;
};

export type LiveBatchAnalyticsAttempt = {
  studentId?: string;
  studentName?: string;
  score?: number;
  timeTaken?: number;
  submittedAt?: unknown;
};

export type LiveBatchTestAnalyticsDoc = {
  id?: string;
  totalScore?: number;
  totalTimeTaken?: number;
  numberOfAttempts?: number;
  averageScore?: number;
  averageTimeTaken?: number;
  topperScore?: number;
  topperStudentName?: string;
  attemptHistory?: LiveBatchAnalyticsAttempt[];
};

const sanitizeIdPart = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'entry';

export const buildAdminLiveBatchPurchaseEntry = (params: {
  batchId: string;
  sessionsPurchased: number;
  sessionFee: number;
  assignedAtIso: string;
  actionId: string;
}): LiveBatchSessionPurchaseHistoryItem => ({
  purchasedAt: params.assignedAtIso,
  sessionsPurchased: Math.max(0, Math.floor(Number(params.sessionsPurchased || 0))),
  sessionFee: Math.max(0, Number(params.sessionFee || 0)),
  amountPaid: 0,
  paymentId: `admin_live_batch_assign_${sanitizeIdPart(params.batchId)}_${sanitizeIdPart(params.actionId)}`,
  planId: null,
});

export const buildAdminLiveBatchRemovalEntry = (
  params: AdminAccessActor & {
    batchId: string;
    sessionsRemoved: number;
    removedAtIso: string;
    actionId: string;
  }
): LiveBatchAdminSessionRemovalHistoryItem => ({
  removedAt: params.removedAtIso,
  sessionsRemoved: Math.max(0, Math.floor(Number(params.sessionsRemoved || 0))),
  removedByAdminId: params.adminId || '',
  removedByAdminEmail: params.adminEmail || '',
  removalId: `admin_live_batch_remove_${sanitizeIdPart(params.batchId)}_${sanitizeIdPart(params.actionId)}`,
  note: 'Removed by admin from Live Batch Management',
});

export const mergeLiveBatchPurchaseHistory = (
  existingHistory: unknown,
  nextEntry: LiveBatchSessionPurchaseHistoryItem
) => {
  const current = Array.isArray(existingHistory)
    ? (existingHistory as LiveBatchSessionPurchaseHistoryItem[])
    : [];
  const nextId = String(nextEntry?.paymentId || '').trim();
  const withoutDuplicate = nextId
    ? current.filter((entry) => String(entry?.paymentId || '').trim() !== nextId)
    : current;
  return [...withoutDuplicate, nextEntry];
};

export const mergeLiveBatchRemovalHistory = (
  existingHistory: unknown,
  nextEntry: LiveBatchAdminSessionRemovalHistoryItem
) => {
  const current = Array.isArray(existingHistory)
    ? (existingHistory as LiveBatchAdminSessionRemovalHistoryItem[])
    : [];
  const nextId = String(nextEntry?.removalId || '').trim();
  const withoutDuplicate = nextId
    ? current.filter((entry) => String(entry?.removalId || '').trim() !== nextId)
    : current;
  return [...withoutDuplicate, nextEntry];
};

export const sumLiveBatchPurchaseHistory = (history: unknown) =>
  normalizeSessionPurchaseHistory({ sessionPurchaseHistory: history }).reduce(
    (sum, entry) => sum + entry.sessionsPurchased,
    0
  );

export const sumLiveBatchRemovalHistory = (history: unknown) =>
  normalizeAdminSessionRemovalHistory({ adminSessionRemovalHistory: history }).reduce(
    (sum, entry) => sum + entry.sessionsRemoved,
    0
  );

export const getLiveBatchCoverageSnapshot = (params: {
  batch?: LiveBatchLike | null;
  sessions?: LiveBatchSessionLike[] | null;
  enrollment?: LiveBatchEnrollmentLike | null;
}) =>
  calculateLiveBatchSessionCoverage({
    batch: params.batch || null,
    sessions: params.sessions || [],
    enrollment: params.enrollment || null,
  });

export const removeStudentAttemptsFromAnalytics = (
  analytics: LiveBatchTestAnalyticsDoc | null | undefined,
  studentId: string
) => {
  const targetStudentId = String(studentId || '').trim();
  const source = Array.isArray(analytics?.attemptHistory) ? analytics!.attemptHistory! : [];
  const remainingAttempts = source.filter(
    (attempt) => String(attempt?.studentId || '').trim() !== targetStudentId
  );

  if (remainingAttempts.length === source.length) {
    return null;
  }

  if (remainingAttempts.length === 0) {
    return {
      attemptHistory: [],
      numberOfAttempts: 0,
      totalScore: 0,
      totalTimeTaken: 0,
      averageScore: 0,
      averageTimeTaken: 0,
      topperScore: 0,
      topperStudentName: '',
    };
  }

  let topperScore = Number.NEGATIVE_INFINITY;
  let topperStudentName = '';
  let totalScore = 0;
  let totalTimeTaken = 0;

  remainingAttempts.forEach((attempt) => {
    const score = Number(attempt?.score || 0);
    const timeTaken = Number(attempt?.timeTaken || 0);
    totalScore += score;
    totalTimeTaken += timeTaken;
    if (score > topperScore) {
      topperScore = score;
      topperStudentName = String(attempt?.studentName || '').trim() || 'Student';
    }
  });

  return {
    attemptHistory: remainingAttempts,
    numberOfAttempts: remainingAttempts.length,
    totalScore,
    totalTimeTaken,
    averageScore: remainingAttempts.length > 0 ? totalScore / remainingAttempts.length : 0,
    averageTimeTaken: remainingAttempts.length > 0 ? totalTimeTaken / remainingAttempts.length : 0,
    topperScore: Number.isFinite(topperScore) ? topperScore : 0,
    topperStudentName,
  };
};
