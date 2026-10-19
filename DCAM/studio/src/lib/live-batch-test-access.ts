import {
  calculateLiveBatchSessionCoverage,
  parseYmdHmToLocalDateTime,
  type LiveBatchEnrollmentLike,
  type LiveBatchSessionLike,
} from '@/lib/live-batch-session-access';

export type LiveBatchTestScheduleLike = {
  availabilityMode?: 'single_day' | 'unlimited' | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  scheduledEndTime?: string | null;
  accessStartTime?: string | null;
  accessEndTime?: string | null;
  startTime?: unknown;
  accessWindowStartAt?: unknown;
  accessWindowEndAt?: unknown;
};

export type ResolvedLiveBatchTestSchedule = {
  availabilityMode: 'single_day' | 'unlimited' | 'legacy';
  testStartAt: Date | null;
  testEndAt: Date | null;
  accessStartAt: Date | null;
  accessEndAt: Date | null;
  entryStartAt: Date | null;
  availabilityEndAt: Date | null;
  hasAccessWindow: boolean;
  hasTestEnd: boolean;
  isAlwaysAvailableAfterStart: boolean;
};

export type LiveBatchTestAttemptState =
  | 'not_scheduled'
  | 'before_test_start'
  | 'before_access_start'
  | 'after_access_end'
  | 'after_test_end'
  | 'open';

const normalizeLeadMinutes = (value?: unknown) => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
};

export const toDateValue = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null) {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    if (typeof candidate.toDate === 'function') {
      try {
        const parsed = candidate.toDate();
        return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
      } catch {
        return null;
      }
    }
    if (typeof candidate.seconds === 'number') {
      const parsed = new Date(candidate.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  return null;
};

const parseScheduledDateTime = (dateValue?: string | null, timeValue?: string | null) => {
  const normalizedDate = typeof dateValue === 'string' ? dateValue.trim() : '';
  const normalizedTime = typeof timeValue === 'string' ? timeValue.trim() : '';
  if (!normalizedDate || !normalizedTime) return null;
  return parseYmdHmToLocalDateTime(normalizedDate, normalizedTime);
};

const resolveAvailabilityMode = (value?: unknown): 'single_day' | 'unlimited' | null => {
  if (value === 'single_day' || value === 'unlimited') return value;
  return null;
};

export const resolveLiveBatchTestSchedule = (
  test?: LiveBatchTestScheduleLike | null
): ResolvedLiveBatchTestSchedule => {
  const availabilityMode = resolveAvailabilityMode(test?.availabilityMode);
  const scheduledStartAt = parseScheduledDateTime(test?.scheduledDate, test?.scheduledTime);
  const directStartAt = toDateValue(test?.startTime);
  const accessStartAt =
    toDateValue(test?.accessWindowStartAt) || parseScheduledDateTime(test?.scheduledDate, test?.accessStartTime);
  const accessEndAt =
    toDateValue(test?.accessWindowEndAt) || parseScheduledDateTime(test?.scheduledDate, test?.accessEndTime);
  const testEndAt = parseScheduledDateTime(test?.scheduledDate, test?.scheduledEndTime);
  const dateOnlyStartAt =
    typeof test?.scheduledDate === 'string' && test.scheduledDate.trim()
      ? parseScheduledDateTime(test.scheduledDate, '00:00')
      : null;

  if (availabilityMode === 'unlimited') {
    const testStartAt = directStartAt || scheduledStartAt || dateOnlyStartAt;
    return {
      availabilityMode,
      testStartAt,
      testEndAt: null,
      accessStartAt: null,
      accessEndAt: null,
      entryStartAt: testStartAt,
      availabilityEndAt: null,
      hasAccessWindow: false,
      hasTestEnd: false,
      isAlwaysAvailableAfterStart: Boolean(testStartAt),
    };
  }

  if (availabilityMode === 'single_day') {
    const testStartAt = scheduledStartAt || directStartAt;
    return {
      availabilityMode,
      testStartAt,
      testEndAt,
      accessStartAt: null,
      accessEndAt: null,
      entryStartAt: testStartAt,
      availabilityEndAt: testEndAt,
      hasAccessWindow: false,
      hasTestEnd: Boolean(testEndAt),
      isAlwaysAvailableAfterStart: Boolean(testStartAt && !testEndAt),
    };
  }

  const testStartAt = scheduledStartAt || directStartAt;

  return {
    availabilityMode: 'legacy',
    testStartAt,
    testEndAt,
    accessStartAt,
    accessEndAt,
    entryStartAt: accessStartAt || testStartAt,
    availabilityEndAt: testEndAt || accessEndAt,
    hasAccessWindow: Boolean(accessStartAt && accessEndAt),
    hasTestEnd: Boolean(testEndAt),
    isAlwaysAvailableAfterStart: Boolean(testStartAt && !accessStartAt && !accessEndAt && !testEndAt),
  };
};

export const getLiveBatchTestTeacherQuestionCoverageStartAt = (
  test?: LiveBatchTestScheduleLike | null,
  contentUnlockLeadMinutes: number = 0
): Date | null => {
  const schedule = resolveLiveBatchTestSchedule(test);
  const baseStartAt = schedule.entryStartAt || schedule.testStartAt;
  if (!baseStartAt) return null;

  const leadMinutes = normalizeLeadMinutes(contentUnlockLeadMinutes);
  return new Date(baseStartAt.getTime() - (leadMinutes * 60 * 1000));
};

export const getLiveBatchTestTeacherQuestionAccessCheckAt = (params: {
  test?: LiveBatchTestScheduleLike | null;
  contentUnlockLeadMinutes?: number;
  now?: Date;
}): Date | null => {
  const coverageStartAt = getLiveBatchTestTeacherQuestionCoverageStartAt(
    params.test,
    params.contentUnlockLeadMinutes
  );
  if (!coverageStartAt) return null;

  const now = params.now || new Date();
  return coverageStartAt.getTime() > now.getTime() ? coverageStartAt : now;
};

export const getLiveBatchTestAttemptState = (
  test?: LiveBatchTestScheduleLike | null,
  nowValue: Date = new Date()
): LiveBatchTestAttemptState => {
  const schedule = resolveLiveBatchTestSchedule(test);
  const nowMs = nowValue.getTime();

  if (!schedule.testStartAt) return 'not_scheduled';
  if (nowMs < schedule.testStartAt.getTime()) return 'before_test_start';
  if (schedule.accessStartAt && nowMs < schedule.accessStartAt.getTime()) return 'before_access_start';
  if (schedule.testEndAt && nowMs > schedule.testEndAt.getTime()) return 'after_test_end';
  if (schedule.accessEndAt && nowMs > schedule.accessEndAt.getTime()) return 'after_access_end';
  return 'open';
};

export const getLiveBatchTestReportsVisibleAfter = (
  test?: LiveBatchTestScheduleLike | null
): Date | null => {
  const schedule = resolveLiveBatchTestSchedule(test);
  return schedule.testEndAt || schedule.accessEndAt || null;
};

export const hasPaidLiveBatchTestTokenAccessAtStart = (params: {
  test?: LiveBatchTestScheduleLike | null;
  enrollment?: LiveBatchEnrollmentLike | null;
  sessions?: LiveBatchSessionLike[] | null;
}): boolean => {
  const startAt = resolveLiveBatchTestSchedule(params.test).testStartAt;
  if (!startAt || !params.enrollment) return false;

  const coverage = calculateLiveBatchSessionCoverage({
    sessions: params.sessions || [],
    enrollment: params.enrollment,
    now: startAt,
  });

  return coverage.remainingSessions > 0;
};
