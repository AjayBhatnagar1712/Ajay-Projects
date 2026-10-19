export type LiveBatchTimingMode = 'batch_default' | 'manual_override';

export type LiveBatchSubjectScheduleLike = {
  subjectId?: string | null;
  daysOfWeek?: Array<string | null | undefined> | null;
  startTime?: string | null;
  endTime?: string | null;
  useDifferentTimingPerDay?: boolean;
  dayTimings?: Record<string, { startTime?: string | null; endTime?: string | null } | undefined> | null;
  sessionCount?: unknown;
  defaultZoomLink?: string | null;
};

export type LiveBatchLike = {
  id?: string;
  batchStartDate?: string;
  subjectIds?: Array<string | null | undefined>;
  subjectSchedules?: LiveBatchSubjectScheduleLike[] | null;
  scheduleVersion?: unknown;
};

export type LiveBatchSessionLike = {
  id?: string;
  batchId?: string;
  type?: string;
  date?: string;
  holidayEndDate?: string;
  meetingTime?: string;
  meetingEndTime?: string;
  subjectId?: string;
  subjectName?: string;
  meetingTitle?: string;
  sessionLabel?: string;
  zoomLink?: string;
  previousSessionUrl?: string;
  notesFileUrl?: string;
  reason?: string;
  timingMode?: LiveBatchTimingMode | string;
  scheduleVersion?: unknown;
  targetSessionId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type LiveBatchSessionPurchaseHistoryItem = {
  purchasedAt?: unknown;
  sessionsPurchased?: unknown;
  sessionFee?: unknown;
  amountPaid?: unknown;
  paymentId?: unknown;
  planId?: unknown;
};

export type LiveBatchAdminSessionRemovalHistoryItem = {
  removedAt?: unknown;
  sessionsRemoved?: unknown;
  removedByAdminId?: unknown;
  removedByAdminEmail?: unknown;
  removalId?: unknown;
  note?: unknown;
};

export type LiveBatchManualSessionUnlockHistoryItem = {
  unlockedAt?: unknown;
  sessionId?: unknown;
  sessionAccessKey?: unknown;
  sessionLabel?: unknown;
  meetingDate?: unknown;
  meetingTime?: unknown;
  subjectId?: unknown;
  subjectName?: unknown;
};

export type LiveBatchEnrollmentLike = {
  paidAt?: unknown;
  enrolledAt?: unknown;
  sessionsPurchased?: unknown;
  sessionPurchaseHistory?: unknown;
  adminSessionRemovalHistory?: unknown;
  manualSessionUnlockHistory?: unknown;
  adminAccessDisabled?: unknown;
  hiddenFromMyBatch?: unknown;
};

export type NormalizedSessionPurchase = {
  id: string;
  purchasedAt: Date;
  purchasedAtMs: number;
  sessionsPurchased: number;
};

export type NormalizedSessionRemoval = {
  id: string;
  removedAt: Date;
  removedAtMs: number;
  sessionsRemoved: number;
};

export type NormalizedManualSessionUnlock = {
  id: string;
  unlockedAt: Date;
  unlockedAtMs: number;
  sessionId: string;
  sessionAccessKey: string;
  sessionLabel: string;
  meetingDate: string;
  meetingTime: string;
  subjectId: string;
  subjectName: string;
};

export type EffectiveLiveBatchMeeting<T extends LiveBatchSessionLike = LiveBatchSessionLike> = T & {
  date: string;
  meetingTime: string;
  meetingEndTime: string;
  subjectId?: string;
  subjectName?: string;
  timingMode: LiveBatchTimingMode;
  scheduleVersion: number;
  effectiveDateTime: Date;
  effectiveCompletionDateTime: Date;
  effectiveTimingSource: 'stored' | 'batch_schedule';
  meetingIdentityKey: string;
  meetingOccurrenceKey: string;
};

export type ConductedLiveBatchMeeting = {
  id: string;
  source: 'meeting' | 'previous_session' | 'meeting_and_previous_session';
  date: string;
  meetingTime: string;
  meetingEndTime: string;
  dateTime: Date;
  completionDateTime: Date;
  subjectId: string;
  subjectName: string;
  meetingTitle: string;
  sessionId: string;
  previousSessionId: string;
  zoomLink: string;
  meetingOccurrenceKey: string;
};

export type ConductedLiveBatchSessionDateOption = {
  key: string;
  date: string;
  meetingTime: string;
  meetingEndTime: string;
  subjectId: string;
  subjectName: string;
  meetingTitle: string;
  source: 'batch_schedule' | 'meeting' | 'previous_session' | 'meeting_and_previous_session';
  completionDateTime: Date;
};

export type LiveBatchSessionResolution<T extends LiveBatchSessionLike = LiveBatchSessionLike> = {
  effectiveMeetings: EffectiveLiveBatchMeeting<T>[];
  upcomingMeetings: EffectiveLiveBatchMeeting<T>[];
  visiblePreviousSessions: T[];
  conductedMeetings: ConductedLiveBatchMeeting[];
};

export type LiveBatchSessionCoverage = {
  purchases: NormalizedSessionPurchase[];
  removals: NormalizedSessionRemoval[];
  appliedSessionRemovals: NormalizedSessionRemoval[];
  manualSessionUnlocks: NormalizedManualSessionUnlock[];
  appliedManualSessionUnlocks: NormalizedManualSessionUnlock[];
  rejectedManualSessionUnlocks: NormalizedManualSessionUnlock[];
  conductedMeetings: ConductedLiveBatchMeeting[];
  coveredConductedMeetings: ConductedLiveBatchMeeting[];
  uncoveredConductedMeetings: ConductedLiveBatchMeeting[];
  coveredMeetingIds: Set<string>;
  coveredMeetingDateKeys: Set<string>;
  coveredMeetingDateTimeKeys: Set<string>;
  unlockedPreviousSessionIds: Set<string>;
  unlockedPreviousSessionAccessKeys: Set<string>;
  grossPurchasedSessions: number;
  requestedRemovedSessions: number;
  appliedRemovedSessions: number;
  totalPurchasedSessions: number;
  meetingConsumedSessions: number;
  manualUnlockConsumedSessions: number;
  consumedSessions: number;
  remainingSessions: number;
  firstPurchaseAt: Date | null;
  lastPurchaseAt: Date | null;
};

type ResolutionOptions = {
  now?: Date;
  batch?: LiveBatchLike | null;
};

type LegacyResolutionOptions = Date | ResolutionOptions;

type SessionSuppressionIndex = {
  batchWideSuppressedDates: Set<string>;
  suppressedSessionIds: Set<string>;
  suppressedOccurrenceKeys: Set<string>;
  suppressedTimedOccurrenceKeys: Set<string>;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export const asDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

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

const parseYmdToLocalDate = (value?: string): Date | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toLocalYmd = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeTextKey = (value?: string) => String(value || '').trim().toLowerCase();

const normalizeTimingMode = (value?: unknown): LiveBatchTimingMode =>
  value === 'manual_override' ? 'manual_override' : 'batch_default';

const normalizeScheduleVersion = (value?: unknown) => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const normalizeSubjectId = (value?: string | null) => String(value || '').trim();

const normalizeSubjectIds = (values?: Array<string | null | undefined>) =>
  (values || []).map((value) => normalizeSubjectId(value)).filter(Boolean);

const resolveSessionSubjectId = (
  session: Pick<LiveBatchSessionLike, 'subjectId'>,
  batch?: LiveBatchLike | null
) => {
  const directSubjectId = normalizeSubjectId(session.subjectId);
  if (directSubjectId) return directSubjectId;

  const batchSubjectIds = normalizeSubjectIds(batch?.subjectIds);
  return batchSubjectIds.length === 1 ? batchSubjectIds[0] : '';
};

const getMeetingSubjectKey = (
  session: Pick<LiveBatchSessionLike, 'subjectId' | 'subjectName'>,
  batch?: LiveBatchLike | null
) => {
  const subjectIdKey = normalizeTextKey(resolveSessionSubjectId(session, batch));
  if (subjectIdKey) return `subject-id:${subjectIdKey}`;

  const subjectNameKey = normalizeTextKey(session.subjectName);
  if (subjectNameKey) return `subject-name:${subjectNameKey}`;

  return 'subject:all';
};

const getDateSubjectCandidateKeys = (
  session: Pick<LiveBatchSessionLike, 'date' | 'subjectId' | 'subjectName'>,
  batch?: LiveBatchLike | null
) => {
  const dateKey = String(session.date || '').trim();
  return getDateSubjectCandidateKeysForDate(dateKey, session, batch);
};

const getDateSubjectCandidateKeysForDate = (
  dateKey: string,
  session: Pick<LiveBatchSessionLike, 'subjectId' | 'subjectName'>,
  batch?: LiveBatchLike | null
) => {
  if (!dateKey) return [] as string[];

  const keys = new Set<string>();
  const subjectIdKey = normalizeTextKey(resolveSessionSubjectId(session, batch));
  if (subjectIdKey) keys.add(`${dateKey}__subject-id:${subjectIdKey}`);

  const subjectNameKey = normalizeTextKey(session.subjectName);
  if (subjectNameKey) keys.add(`${dateKey}__subject-name:${subjectNameKey}`);

  if (keys.size === 0) {
    keys.add(`${dateKey}__subject:all`);
  }

  return Array.from(keys);
};

const getDateSubjectTimeCandidateKeysForDate = (
  dateKey: string,
  session: Pick<LiveBatchSessionLike, 'subjectId' | 'subjectName' | 'meetingTime'>,
  batch?: LiveBatchLike | null
) => {
  const meetingTime = String(session.meetingTime || '').trim();
  if (!dateKey || !meetingTime) return [] as string[];

  const keys = new Set<string>();
  getDateSubjectCandidateKeysForDate(dateKey, session, batch).forEach((key) => {
    keys.add(`${key}__time:${meetingTime}`);
  });
  keys.add(`${dateKey}__subject:all__time:${meetingTime}`);
  return Array.from(keys);
};

const getDateSubjectTimeCandidateKeys = (
  session: Pick<LiveBatchSessionLike, 'date' | 'subjectId' | 'subjectName' | 'meetingTime'>,
  batch?: LiveBatchLike | null
) => {
  const dateKey = String(session.date || '').trim();
  return getDateSubjectTimeCandidateKeysForDate(dateKey, session, batch);
};

export const getLiveBatchSessionOccurrenceKey = (
  session: Pick<LiveBatchSessionLike, 'date' | 'subjectId' | 'subjectName'>,
  batch?: LiveBatchLike | null
) => getDateSubjectCandidateKeys(session, batch)[0] || '';

export const getLiveBatchPreviousSessionAccessKey = (
  session: Pick<LiveBatchSessionLike, 'date' | 'subjectId' | 'subjectName' | 'meetingTime'>,
  batch?: LiveBatchLike | null
) => {
  const dateKey = String(session.date || '').trim() || 'unknown-date';
  const subjectId = normalizeSubjectId(resolveSessionSubjectId(session, batch));
  const subjectNameKey = normalizeTextKey(session.subjectName);
  const meetingTime = String(session.meetingTime || '').trim() || 'unknown-time';

  return [
    dateKey,
    subjectId || subjectNameKey || 'unknown-subject',
    meetingTime,
  ].join('__');
};

const getMeetingTitleKey = (
  session: Pick<LiveBatchSessionLike, 'meetingTitle' | 'subjectId' | 'subjectName'>,
  batch?: LiveBatchLike | null
) => {
  const rawTitleKey = normalizeTextKey(session.meetingTitle);
  if (rawTitleKey && !['daily live session', 'live session'].includes(rawTitleKey)) {
    return rawTitleKey;
  }

  const subjectFallbackKey = getMeetingSubjectKey(session, batch).replace(/^subject-(id|name):/, '');
  return subjectFallbackKey ? `${subjectFallbackKey} live session` : 'live session';
};

const getMeetingIdentityKey = (
  session: Pick<LiveBatchSessionLike, 'date' | 'subjectId' | 'subjectName' | 'meetingTitle'>,
  batch?: LiveBatchLike | null
) => {
  const dateKey = String(session.date || '').trim() || 'unknown-date';
  return `${dateKey}__${getMeetingSubjectKey(session, batch)}__${getMeetingTitleKey(session, batch)}`;
};

const getMeetingRevisionMs = (
  session: Pick<LiveBatchSessionLike, 'createdAt' | 'updatedAt' | 'date' | 'meetingTime'>
) => {
  return (
    asDate(session.updatedAt)?.getTime()
    ?? asDate(session.createdAt)?.getTime()
    ?? parseYmdHmToLocalDateTime(session.date, session.meetingTime)?.getTime()
    ?? 0
  );
};

const getMeetingPriority = (session: Pick<LiveBatchSessionLike, 'timingMode'>) =>
  normalizeTimingMode(session.timingMode) === 'manual_override' ? 2 : 1;

export const parseYmdHmToLocalDateTime = (dateValue?: string, timeValue?: string): Date | null => {
  if (!dateValue) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const date = parseYmdToLocalDate(dateValue);
    if (!date) return null;

    const normalizedTime = timeValue && /^\d{1,2}:\d{2}$/.test(timeValue) ? timeValue : '23:59';
    const [hours, minutes] = normalizedTime.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

    date.setHours(hours, minutes, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getLiveBatchMeetingCompletionDateTime = (
  session: Pick<LiveBatchSessionLike, 'date' | 'meetingTime' | 'meetingEndTime'>
): Date | null => parseYmdHmToLocalDateTime(session.date, session.meetingEndTime || session.meetingTime);

export const isLiveBatchMeetingCompleted = (
  session: Pick<LiveBatchSessionLike, 'date' | 'meetingTime' | 'meetingEndTime'>,
  nowValue: Date = new Date()
) => {
  const completionDateTime = getLiveBatchMeetingCompletionDateTime(session);
  return !!completionDateTime && completionDateTime.getTime() <= nowValue.getTime();
};

const normalizeResolutionOptions = (options?: LegacyResolutionOptions): ResolutionOptions => {
  if (options instanceof Date) {
    return { now: options };
  }
  return {
    now: options?.now,
    batch: options?.batch,
  };
};

const expandYmdDateRange = (startValue?: string, endValue?: string) => {
  const startDate = parseYmdToLocalDate(startValue);
  if (!startDate) return [] as string[];
  const endDateParsed = parseYmdToLocalDate(endValue);
  const normalizedEndDate = !endDateParsed || endDateParsed.getTime() < startDate.getTime() ? startDate : endDateParsed;

  const dates: string[] = [];
  const cursor = new Date(startDate);
  while (cursor.getTime() <= normalizedEndDate.getTime()) {
    dates.push(toLocalYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const buildBatchSubjectScheduleMap = (batch?: LiveBatchLike | null) => {
  const scheduleBySubjectId = new Map<string, LiveBatchSubjectScheduleLike>();
  (batch?.subjectSchedules || []).forEach((schedule) => {
    const subjectId = normalizeSubjectId(schedule?.subjectId);
    if (!subjectId || scheduleBySubjectId.has(subjectId)) return;
    scheduleBySubjectId.set(subjectId, schedule);
  });
  return scheduleBySubjectId;
};

const getScheduleTimingForDay = (
  schedule: LiveBatchSubjectScheduleLike,
  dayName: string
): { startTime: string; endTime: string } | null => {
  if (!(schedule.daysOfWeek || []).includes(dayName)) return null;

  if (schedule.useDifferentTimingPerDay) {
    const dayTiming = schedule.dayTimings?.[dayName];
    const startTime = String(dayTiming?.startTime || '').trim();
    const endTime = String(dayTiming?.endTime || dayTiming?.startTime || '').trim();
    if (!startTime) return null;
    return {
      startTime,
      endTime: endTime || startTime,
    };
  }

  const startTime = String(schedule.startTime || '').trim();
  const endTime = String(schedule.endTime || schedule.startTime || '').trim();
  if (!startTime) return null;
  return {
    startTime,
    endTime: endTime || startTime,
  };
};

export const getLiveBatchScheduleTimingForDate = (
  batch: LiveBatchLike | null | undefined,
  session: Pick<LiveBatchSessionLike, 'date' | 'subjectId' | 'subjectName'>
): { subjectId: string; startTime: string; endTime: string } | null => {
  if (!batch?.subjectSchedules?.length || !session?.date) return null;

  const resolvedSubjectId = resolveSessionSubjectId(session, batch);
  if (!resolvedSubjectId) return null;

  const schedule = buildBatchSubjectScheduleMap(batch).get(resolvedSubjectId);
  if (!schedule) return null;

  const date = parseYmdToLocalDate(session.date);
  if (!date) return null;

  const dayName = DAY_NAMES[date.getDay()];
  const timing = getScheduleTimingForDay(schedule, dayName);
  if (!timing) return null;

  return {
    subjectId: resolvedSubjectId,
    startTime: timing.startTime,
    endTime: timing.endTime,
  };
};

const buildSessionSuppressionIndex = (
  sessions: LiveBatchSessionLike[],
  batch?: LiveBatchLike | null
): SessionSuppressionIndex => {
  const batchWideSuppressedDates = new Set<string>();
  const suppressedSessionIds = new Set<string>();
  const suppressedOccurrenceKeys = new Set<string>();
  const suppressedTimedOccurrenceKeys = new Set<string>();

  sessions.forEach((session) => {
    const typeKey = normalizeTextKey(session.type);
    if (typeKey !== 'holiday' && typeKey !== 'cancelled') return;

    const dateKey = String(session.date || '').trim();
    const relevantDates = typeKey === 'holiday'
      ? expandYmdDateRange(session.date, session.holidayEndDate)
      : (dateKey ? [dateKey] : []);
    if (relevantDates.length === 0) return;

    const targetSessionId = String(session.targetSessionId || '').trim();
    if (targetSessionId) {
      suppressedSessionIds.add(targetSessionId);
    }

    const timedOccurrenceKeys = relevantDates.flatMap((currentDate) =>
      getDateSubjectTimeCandidateKeysForDate(currentDate, session, batch)
    );
    if (timedOccurrenceKeys.length > 0) {
      timedOccurrenceKeys.forEach((key) => suppressedTimedOccurrenceKeys.add(key));
      return;
    }

    const occurrenceKeys = relevantDates.flatMap((currentDate) =>
      getDateSubjectCandidateKeysForDate(currentDate, session, batch).filter((key) => !key.endsWith('__subject:all'))
    );
    if (occurrenceKeys.length > 0) {
      occurrenceKeys.forEach((key) => suppressedOccurrenceKeys.add(key));
      return;
    }

    relevantDates.forEach((currentDate) => batchWideSuppressedDates.add(currentDate));
  });

  return {
    batchWideSuppressedDates,
    suppressedSessionIds,
    suppressedOccurrenceKeys,
    suppressedTimedOccurrenceKeys,
  };
};

const isSuppressedForSession = (
  session: Pick<LiveBatchSessionLike, 'id' | 'date' | 'subjectId' | 'subjectName' | 'meetingTime'>,
  suppressionIndex: SessionSuppressionIndex,
  batch?: LiveBatchLike | null
) => {
  const dateKey = String(session.date || '').trim();
  if (!dateKey) return false;

  const sessionId = String(session.id || '').trim();
  if (sessionId && suppressionIndex.suppressedSessionIds.has(sessionId)) return true;
  if (suppressionIndex.batchWideSuppressedDates.has(dateKey)) return true;
  if (getDateSubjectTimeCandidateKeys(session, batch).some((key) => suppressionIndex.suppressedTimedOccurrenceKeys.has(key))) {
    return true;
  }

  return getDateSubjectCandidateKeys(session, batch).some((key) => suppressionIndex.suppressedOccurrenceKeys.has(key));
};

const resolveEffectiveMeeting = <T extends LiveBatchSessionLike>(
  session: T,
  params: {
    batch?: LiveBatchLike | null;
    now: Date;
    suppressionIndex: SessionSuppressionIndex;
  }
): EffectiveLiveBatchMeeting<T> | null => {
  if (normalizeTextKey(session.type) !== 'meeting') return null;

  const dateKey = String(session.date || '').trim();
  if (!dateKey) return null;

  const rawTimingMode = normalizeTimingMode(session.timingMode);
  const rawDateTime = parseYmdHmToLocalDateTime(dateKey, session.meetingTime);
  const rawCompletionDateTime = getLiveBatchMeetingCompletionDateTime(session);
  const rawIsCompleted = !!rawCompletionDateTime && rawCompletionDateTime.getTime() <= params.now.getTime();

  let effectiveSubjectId = resolveSessionSubjectId(session, params.batch) || undefined;
  let effectiveMeetingTime = String(session.meetingTime || '').trim();
  let effectiveMeetingEndTime = String(session.meetingEndTime || session.meetingTime || '').trim();
  let effectiveTimingSource: 'stored' | 'batch_schedule' = 'stored';

  if (rawTimingMode === 'batch_default' && !rawIsCompleted) {
    const batchTiming = getLiveBatchScheduleTimingForDate(params.batch, session);
    if (!batchTiming) {
      if (!rawDateTime || rawDateTime.getTime() >= params.now.getTime()) {
        return null;
      }
    } else {
      effectiveSubjectId = batchTiming.subjectId || effectiveSubjectId;
      effectiveMeetingTime = batchTiming.startTime;
      effectiveMeetingEndTime = batchTiming.endTime || batchTiming.startTime;
      effectiveTimingSource = 'batch_schedule';
    }
  }

  const effectiveDateTime = parseYmdHmToLocalDateTime(dateKey, effectiveMeetingTime);
  const effectiveCompletionDateTime = parseYmdHmToLocalDateTime(
    dateKey,
    effectiveMeetingEndTime || effectiveMeetingTime
  );

  if (!effectiveDateTime || !effectiveCompletionDateTime) return null;

  const meetingLike = {
    ...session,
    date: dateKey,
    subjectId: effectiveSubjectId || session.subjectId,
    meetingTime: effectiveMeetingTime,
    meetingEndTime: effectiveMeetingEndTime || effectiveMeetingTime,
  };

  if (isSuppressedForSession(meetingLike, params.suppressionIndex, params.batch)) {
    return null;
  }

  return {
    ...session,
    date: dateKey,
    subjectId: effectiveSubjectId || session.subjectId,
    meetingTime: effectiveMeetingTime,
    meetingEndTime: effectiveMeetingEndTime || effectiveMeetingTime,
    timingMode: rawTimingMode,
    scheduleVersion: normalizeScheduleVersion(session.scheduleVersion),
    effectiveDateTime,
    effectiveCompletionDateTime,
    effectiveTimingSource,
    meetingIdentityKey: getMeetingIdentityKey(meetingLike, params.batch),
    meetingOccurrenceKey: getLiveBatchSessionOccurrenceKey(meetingLike, params.batch),
  };
};

const choosePreferredMeeting = <T extends LiveBatchSessionLike>(
  current: EffectiveLiveBatchMeeting<T>,
  candidate: EffectiveLiveBatchMeeting<T>
) => {
  const currentPriority = getMeetingPriority(current);
  const candidatePriority = getMeetingPriority(candidate);
  if (currentPriority !== candidatePriority) {
    return candidatePriority > currentPriority ? candidate : current;
  }

  const currentRevisionMs = getMeetingRevisionMs(current);
  const candidateRevisionMs = getMeetingRevisionMs(candidate);
  if (currentRevisionMs !== candidateRevisionMs) {
    return candidateRevisionMs > currentRevisionMs ? candidate : current;
  }

  const currentId = normalizeTextKey(current.id);
  const candidateId = normalizeTextKey(candidate.id);
  return candidateId > currentId ? candidate : current;
};

const getPreviousSessionCompletionDateTime = (
  session: Pick<LiveBatchSessionLike, 'date' | 'meetingTime' | 'meetingEndTime' | 'updatedAt' | 'createdAt'>,
  matchedMeeting?: Pick<ConductedLiveBatchMeeting, 'completionDateTime' | 'dateTime'>
) => {
  if (matchedMeeting?.completionDateTime) return matchedMeeting.completionDateTime;

  const explicitCompletionDateTime = parseYmdHmToLocalDateTime(
    session.date,
    session.meetingEndTime || session.meetingTime
  );
  if (explicitCompletionDateTime) return explicitCompletionDateTime;

  const uploadedAt = asDate(session.updatedAt) || asDate(session.createdAt);
  if (uploadedAt) return uploadedAt;

  return parseYmdHmToLocalDateTime(session.date, '23:59');
};

const getPreviousSessionDateTime = (
  session: Pick<LiveBatchSessionLike, 'date' | 'meetingTime' | 'updatedAt' | 'createdAt'>,
  matchedMeeting?: Pick<ConductedLiveBatchMeeting, 'dateTime'>
) => {
  if (matchedMeeting?.dateTime) return matchedMeeting.dateTime;

  const explicitDateTime = parseYmdHmToLocalDateTime(session.date, session.meetingTime);
  if (explicitDateTime) return explicitDateTime;

  const uploadedAt = asDate(session.updatedAt) || asDate(session.createdAt);
  if (uploadedAt) return uploadedAt;

  return parseYmdHmToLocalDateTime(session.date, '23:59');
};

export const resolveLiveBatchSessions = <T extends LiveBatchSessionLike>(
  params: {
    sessions: T[];
    batch?: LiveBatchLike | null;
    now?: Date;
  }
): LiveBatchSessionResolution<T> => {
  const now = params.now || new Date();
  const suppressionIndex = buildSessionSuppressionIndex(params.sessions, params.batch);

  const latestMeetingByIdentity = new Map<string, EffectiveLiveBatchMeeting<T>>();
  params.sessions.forEach((session) => {
    const effectiveMeeting = resolveEffectiveMeeting(session, {
      batch: params.batch,
      now,
      suppressionIndex,
    });
    if (!effectiveMeeting) return;

    const existingMeeting = latestMeetingByIdentity.get(effectiveMeeting.meetingIdentityKey);
    if (!existingMeeting) {
      latestMeetingByIdentity.set(effectiveMeeting.meetingIdentityKey, effectiveMeeting);
      return;
    }

    latestMeetingByIdentity.set(
      effectiveMeeting.meetingIdentityKey,
      choosePreferredMeeting(existingMeeting, effectiveMeeting)
    );
  });

  const effectiveMeetings = Array.from(latestMeetingByIdentity.values()).sort((left, right) => {
    const leftMs = left.effectiveDateTime.getTime();
    const rightMs = right.effectiveDateTime.getTime();
    if (leftMs !== rightMs) return leftMs - rightMs;
    return normalizeTextKey(left.id).localeCompare(normalizeTextKey(right.id));
  });

  const upcomingMeetings = effectiveMeetings.filter(
    (meeting) => meeting.effectiveCompletionDateTime.getTime() > now.getTime()
  );

  const visiblePreviousSessions = params.sessions
    .filter((session) => {
      if (normalizeTextKey(session.type) !== 'previous_session' || !session.date) return false;
      return !isSuppressedForSession(session, suppressionIndex, params.batch);
    })
    .sort((left, right) => {
      const leftMs =
        (asDate(left.updatedAt) || asDate(left.createdAt) || parseYmdHmToLocalDateTime(left.date, left.meetingTime))?.getTime()
        ?? 0;
      const rightMs =
        (asDate(right.updatedAt) || asDate(right.createdAt) || parseYmdHmToLocalDateTime(right.date, right.meetingTime))?.getTime()
        ?? 0;

      if (leftMs !== rightMs) return leftMs - rightMs;
      return normalizeTextKey(left.id).localeCompare(normalizeTextKey(right.id));
    });

  const conductedMeetingByOccurrenceKey = new Map<string, ConductedLiveBatchMeeting>();
  const getSubjectLabel = (session: Pick<LiveBatchSessionLike, 'subjectId' | 'subjectName'>) =>
    String(session.subjectName || resolveSessionSubjectId(session, params.batch) || '').trim();

  effectiveMeetings.forEach((meeting) => {
    if (meeting.effectiveCompletionDateTime.getTime() > now.getTime()) return;

    const conductedMeeting: ConductedLiveBatchMeeting = {
      id: String(meeting.id || meeting.meetingOccurrenceKey || `${meeting.date}-${meeting.meetingTime}`),
      source: 'meeting',
      date: meeting.date,
      meetingTime: meeting.meetingTime,
      meetingEndTime: meeting.meetingEndTime || meeting.meetingTime,
      dateTime: meeting.effectiveDateTime,
      completionDateTime: meeting.effectiveCompletionDateTime,
      subjectId: String(meeting.subjectId || ''),
      subjectName: getSubjectLabel(meeting),
      meetingTitle: String(meeting.meetingTitle || meeting.sessionLabel || ''),
      sessionId: String(meeting.id || ''),
      previousSessionId: '',
      zoomLink: String(meeting.zoomLink || ''),
      meetingOccurrenceKey: meeting.meetingOccurrenceKey,
    };

    const existing = conductedMeetingByOccurrenceKey.get(meeting.meetingOccurrenceKey);
    if (!existing || conductedMeeting.completionDateTime.getTime() >= existing.completionDateTime.getTime()) {
      conductedMeetingByOccurrenceKey.set(meeting.meetingOccurrenceKey, conductedMeeting);
    }
  });

  visiblePreviousSessions.forEach((session) => {
    const occurrenceKey = getLiveBatchSessionOccurrenceKey(session, params.batch);
    if (!occurrenceKey) return;

    const existing = conductedMeetingByOccurrenceKey.get(occurrenceKey);
    const completionDateTime = getPreviousSessionCompletionDateTime(session, existing || undefined);
    if (!completionDateTime || completionDateTime.getTime() > now.getTime()) return;

    const dateTime = getPreviousSessionDateTime(session, existing || undefined);
    if (!dateTime) return;

    const previousSessionId = String(session.id || '');
    if (existing) {
      const nextMeetingTitle = existing.meetingTitle || String(session.sessionLabel || session.meetingTitle || '');
      const nextSubjectName = existing.subjectName || getSubjectLabel(session);
      conductedMeetingByOccurrenceKey.set(occurrenceKey, {
        ...existing,
        source: existing.source === 'meeting' ? 'meeting_and_previous_session' : existing.source,
        previousSessionId: existing.previousSessionId || previousSessionId,
        meetingTitle: nextMeetingTitle,
        subjectName: nextSubjectName,
      });
      return;
    }

    conductedMeetingByOccurrenceKey.set(occurrenceKey, {
      id: previousSessionId || occurrenceKey,
      source: 'previous_session',
      date: String(session.date || ''),
      meetingTime: String(session.meetingTime || ''),
      meetingEndTime: String(session.meetingEndTime || session.meetingTime || ''),
      dateTime,
      completionDateTime,
      subjectId: resolveSessionSubjectId(session, params.batch),
      subjectName: getSubjectLabel(session),
      meetingTitle: String(session.sessionLabel || session.meetingTitle || ''),
      sessionId: '',
      previousSessionId,
      zoomLink: '',
      meetingOccurrenceKey: occurrenceKey,
    });
  });

  const conductedMeetings = Array.from(conductedMeetingByOccurrenceKey.values()).sort(
    (left, right) => left.completionDateTime.getTime() - right.completionDateTime.getTime()
  );

  return {
    effectiveMeetings,
    upcomingMeetings,
    visiblePreviousSessions,
    conductedMeetings,
  };
};

const getConductedSessionDateOptionKey = (
  option: Pick<ConductedLiveBatchSessionDateOption, 'date' | 'meetingTime' | 'subjectId' | 'subjectName'>
) => [
  option.date,
  normalizeSubjectId(option.subjectId) || normalizeTextKey(option.subjectName) || 'all',
  String(option.meetingTime || '').trim() || 'time-tba',
].join('__');

export const getConductedLiveBatchSessionDateOptions = <T extends LiveBatchSessionLike>(
  params: {
    sessions: T[];
    batch?: LiveBatchLike | null;
    now?: Date;
    scheduleLookbackMonths?: number;
  }
): ConductedLiveBatchSessionDateOption[] => {
  const now = params.now || new Date();
  const optionsByKey = new Map<string, ConductedLiveBatchSessionDateOption>();
  const addOption = (option: Omit<ConductedLiveBatchSessionDateOption, 'key'>) => {
    if (!option.date) return;
    if (option.completionDateTime.getTime() > now.getTime()) return;
    const key = getConductedSessionDateOptionKey(option);
    optionsByKey.set(key, { ...option, key });
  };

  const suppressionIndex = buildSessionSuppressionIndex(params.sessions, params.batch);
  const configuredBatchStartDate = parseYmdToLocalDate(params.batch?.batchStartDate);
  const lookbackMonths = Math.max(0, Math.floor(Number(params.scheduleLookbackMonths || 0)));
  const lookbackStartDate = lookbackMonths > 0
    ? new Date(now.getFullYear(), now.getMonth() - lookbackMonths, now.getDate())
    : null;
  const datedSessionStarts = params.sessions
    .map((session) => parseYmdToLocalDate(session.date))
    .filter((date): date is Date => Boolean(date));
  const batchStartDate = [
    configuredBatchStartDate,
    lookbackStartDate,
    ...datedSessionStarts,
  ]
    .filter((date): date is Date => Boolean(date))
    .sort((left, right) => left.getTime() - right.getTime())[0] || null;
  const subjectSchedules = params.batch?.subjectSchedules || [];

  if (batchStartDate && subjectSchedules.length > 0) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    subjectSchedules.forEach((schedule) => {
      const subjectId = normalizeSubjectId(schedule?.subjectId);
      if (!subjectId) return;
      const cursor = new Date(batchStartDate);
      cursor.setHours(0, 0, 0, 0);

      while (cursor.getTime() <= today.getTime()) {
        const dayName = DAY_NAMES[cursor.getDay()];
        const timing = getScheduleTimingForDay(schedule, dayName);

        if (timing) {
          const date = toLocalYmd(cursor);
          const scheduleSession = {
            date,
            subjectId,
            subjectName: '',
            meetingTime: timing.startTime,
          };

          if (!isSuppressedForSession(scheduleSession, suppressionIndex, params.batch)) {
            const completionDateTime = parseYmdHmToLocalDateTime(date, timing.endTime || timing.startTime);
            if (completionDateTime && completionDateTime.getTime() <= now.getTime()) {
              addOption({
                date,
                meetingTime: timing.startTime,
                meetingEndTime: timing.endTime || timing.startTime,
                subjectId,
                subjectName: '',
                meetingTitle: '',
                source: 'batch_schedule',
                completionDateTime,
              });
            }
          }
        }

        cursor.setDate(cursor.getDate() + 1);
      }
    });
  }

  const sessionResolution = resolveLiveBatchSessions({
    sessions: params.sessions,
    batch: params.batch,
    now,
  });

  sessionResolution.conductedMeetings.forEach((meeting) => {
    addOption({
      date: meeting.date,
      meetingTime: meeting.meetingTime,
      meetingEndTime: meeting.meetingEndTime || meeting.meetingTime,
      subjectId: meeting.subjectId,
      subjectName: meeting.subjectName,
      meetingTitle: meeting.meetingTitle,
      source: meeting.source,
      completionDateTime: meeting.completionDateTime,
    });
  });

  return Array.from(optionsByKey.values()).sort((left, right) => {
    const leftKey = `${left.date} ${left.meetingTime}`;
    const rightKey = `${right.date} ${right.meetingTime}`;
    const dateCompare = rightKey.localeCompare(leftKey);
    if (dateCompare !== 0) return dateCompare;
    return `${left.subjectId} ${left.subjectName}`.localeCompare(`${right.subjectId} ${right.subjectName}`);
  });
};

export const getEffectiveLiveBatchMeetingSessions = <T extends LiveBatchSessionLike>(
  sessions: T[],
  options?: LegacyResolutionOptions
) => {
  const normalizedOptions = normalizeResolutionOptions(options);
  return resolveLiveBatchSessions({
    sessions,
    batch: normalizedOptions.batch,
    now: normalizedOptions.now,
  }).effectiveMeetings;
};

export const getVisiblePreviousLiveBatchSessions = <T extends LiveBatchSessionLike>(
  sessions: T[],
  options?: LegacyResolutionOptions
) => {
  const normalizedOptions = normalizeResolutionOptions(options);
  return resolveLiveBatchSessions({
    sessions,
    batch: normalizedOptions.batch,
    now: normalizedOptions.now,
  }).visiblePreviousSessions;
};

export const getUpcomingLiveBatchMeetingSessions = <T extends LiveBatchSessionLike>(
  sessions: T[],
  options?: LegacyResolutionOptions
) => {
  const normalizedOptions = normalizeResolutionOptions(options);
  return resolveLiveBatchSessions({
    sessions,
    batch: normalizedOptions.batch,
    now: normalizedOptions.now,
  }).upcomingMeetings;
};

export const findUpcomingLiveBatchMeetingMatch = <T extends LiveBatchSessionLike>(
  sessions: T[],
  params: {
    date?: string;
    subjectId?: string;
    subjectName?: string;
    meetingTitle?: string;
  },
  options?: LegacyResolutionOptions
) => {
  const normalizedOptions = normalizeResolutionOptions(options);
  const targetIdentityKey = getMeetingIdentityKey(params, normalizedOptions.batch);

  return (
    getUpcomingLiveBatchMeetingSessions(sessions, normalizedOptions).find(
      (session) => session.meetingIdentityKey === targetIdentityKey
    ) || null
  );
};

export const normalizeSessionPurchaseHistory = (
  enrollment?: LiveBatchEnrollmentLike | null
): NormalizedSessionPurchase[] => {
  if (!enrollment) return [];

  const rawHistory = Array.isArray(enrollment.sessionPurchaseHistory)
    ? (enrollment.sessionPurchaseHistory as LiveBatchSessionPurchaseHistoryItem[])
    : [];

  const normalizedHistory = rawHistory
    .map((entry, index) => {
      const purchasedAt = asDate(entry?.purchasedAt);
      const sessionsPurchased = Math.max(0, Math.floor(Number(entry?.sessionsPurchased || 0)));
      if (!purchasedAt || sessionsPurchased <= 0) return null;
      return {
        id: String(entry?.paymentId || entry?.planId || `${purchasedAt.getTime()}-${index}`),
        purchasedAt,
        purchasedAtMs: purchasedAt.getTime(),
        sessionsPurchased,
      };
    })
    .filter((entry): entry is NormalizedSessionPurchase => !!entry)
    .sort((left, right) => left.purchasedAtMs - right.purchasedAtMs);

  if (normalizedHistory.length > 0) return normalizedHistory;

  const fallbackPurchasedAt = asDate(enrollment.paidAt || enrollment.enrolledAt);
  const fallbackSessionsPurchased = Math.max(0, Math.floor(Number(enrollment.sessionsPurchased || 0)));
  if (!fallbackPurchasedAt || fallbackSessionsPurchased <= 0) return [];

  return [{
    id: `fallback-${fallbackPurchasedAt.getTime()}`,
    purchasedAt: fallbackPurchasedAt,
    purchasedAtMs: fallbackPurchasedAt.getTime(),
    sessionsPurchased: fallbackSessionsPurchased,
  }];
};

export const normalizeAdminSessionRemovalHistory = (
  enrollment?: LiveBatchEnrollmentLike | null
): NormalizedSessionRemoval[] => {
  if (!enrollment) return [];

  const rawHistory = Array.isArray(enrollment.adminSessionRemovalHistory)
    ? (enrollment.adminSessionRemovalHistory as LiveBatchAdminSessionRemovalHistoryItem[])
    : [];

  return rawHistory
    .map((entry, index) => {
      const removedAt = asDate(entry?.removedAt);
      const sessionsRemoved = Math.max(0, Math.floor(Number(entry?.sessionsRemoved || 0)));
      if (!removedAt || sessionsRemoved <= 0) return null;

      return {
        id: String(entry?.removalId || `${removedAt.getTime()}-${index}`),
        removedAt,
        removedAtMs: removedAt.getTime(),
        sessionsRemoved,
      };
    })
    .filter((entry): entry is NormalizedSessionRemoval => !!entry)
    .sort((left, right) => left.removedAtMs - right.removedAtMs);
};

export const normalizeManualSessionUnlockHistory = (
  enrollment?: LiveBatchEnrollmentLike | null
): NormalizedManualSessionUnlock[] => {
  if (!enrollment) return [];

  const rawHistory = Array.isArray(enrollment.manualSessionUnlockHistory)
    ? (enrollment.manualSessionUnlockHistory as LiveBatchManualSessionUnlockHistoryItem[])
    : [];

  return rawHistory
    .map((entry, index) => {
      const unlockedAt = asDate(entry?.unlockedAt);
      const sessionId = String(entry?.sessionId || '').trim();
      const sessionAccessKey = String(entry?.sessionAccessKey || '').trim();
      if (!unlockedAt || (!sessionId && !sessionAccessKey)) return null;

      return {
        id: `${sessionId || sessionAccessKey || unlockedAt.getTime()}-${index}`,
        unlockedAt,
        unlockedAtMs: unlockedAt.getTime(),
        sessionId,
        sessionAccessKey,
        sessionLabel: String(entry?.sessionLabel || '').trim(),
        meetingDate: String(entry?.meetingDate || '').trim(),
        meetingTime: String(entry?.meetingTime || '').trim(),
        subjectId: String(entry?.subjectId || '').trim(),
        subjectName: String(entry?.subjectName || '').trim(),
      };
    })
    .filter((entry): entry is NormalizedManualSessionUnlock => !!entry)
    .sort((left, right) => left.unlockedAtMs - right.unlockedAtMs);
};

export const getConductedLiveBatchMeetings = (
  sessions: LiveBatchSessionLike[],
  options?: LegacyResolutionOptions
) => {
  const normalizedOptions = normalizeResolutionOptions(options);
  return resolveLiveBatchSessions({
    sessions,
    batch: normalizedOptions.batch,
    now: normalizedOptions.now,
  }).conductedMeetings;
};

export const calculateLiveBatchSessionCoverage = (
  params: {
    sessions: LiveBatchSessionLike[];
    enrollment?: LiveBatchEnrollmentLike | null;
    batch?: LiveBatchLike | null;
    now?: Date;
  }
): LiveBatchSessionCoverage => {
  const now = params.now || new Date();
  const nowMs = now.getTime();
  const purchases = normalizeSessionPurchaseHistory(params.enrollment);
  const removals = normalizeAdminSessionRemovalHistory(params.enrollment);
  const sessionResolution = resolveLiveBatchSessions({
    sessions: params.sessions,
    batch: params.batch,
    now,
  });
  const conductedMeetings = sessionResolution.conductedMeetings;
  const visiblePreviousSessions = sessionResolution.visiblePreviousSessions;
  const visiblePreviousSessionIds = new Set(
    visiblePreviousSessions
      .map((session) => String(session.id || '').trim())
      .filter(Boolean)
  );
  const visiblePreviousSessionAccessKeys = new Set(
    visiblePreviousSessions
      .map((session) => getLiveBatchPreviousSessionAccessKey(session, params.batch))
      .filter(Boolean)
  );
  const getDerivedManualUnlockAccessKey = (unlock: NormalizedManualSessionUnlock) =>
    getLiveBatchPreviousSessionAccessKey(
      {
        date: unlock.meetingDate,
        meetingTime: unlock.meetingTime,
        subjectId: unlock.subjectId,
        subjectName: unlock.subjectName,
      },
      params.batch
    );
  const manualSessionUnlocks = normalizeManualSessionUnlockHistory(params.enrollment).filter((unlock) => {
    const derivedAccessKey = getDerivedManualUnlockAccessKey(unlock);
    return Boolean(
      (unlock.sessionId && visiblePreviousSessionIds.has(unlock.sessionId))
      || (unlock.sessionAccessKey && visiblePreviousSessionAccessKeys.has(unlock.sessionAccessKey))
      || (derivedAccessKey && visiblePreviousSessionAccessKeys.has(derivedAccessKey))
    );
  });

  const activeCredits: Array<{ purchaseId: string; purchasedAtMs: number; remaining: number }> = [];
  let purchasePointer = 0;

  const coveredConductedMeetings: ConductedLiveBatchMeeting[] = [];
  const uncoveredConductedMeetings: ConductedLiveBatchMeeting[] = [];
  const appliedSessionRemovals: NormalizedSessionRemoval[] = [];
  const appliedManualSessionUnlocks: NormalizedManualSessionUnlock[] = [];
  const rejectedManualSessionUnlocks: NormalizedManualSessionUnlock[] = [];

  const pushEligiblePurchases = (referenceMs: number) => {
    while (purchasePointer < purchases.length && purchases[purchasePointer].purchasedAtMs <= referenceMs) {
      const purchase = purchases[purchasePointer];
      activeCredits.push({
        purchaseId: purchase.id,
        purchasedAtMs: purchase.purchasedAtMs,
        remaining: purchase.sessionsPurchased,
      });
      purchasePointer += 1;
    }
  };

  const appliedManualUnlockSessionIds = new Set<string>();
  const appliedManualUnlockSessionKeys = new Set<string>();
  const consumptionEvents = [
    ...conductedMeetings.map((meeting) => ({
      kind: 'meeting' as const,
      atMs: meeting.completionDateTime.getTime(),
      meeting,
    })),
    ...removals.map((removal) => ({
      kind: 'removal' as const,
      atMs: removal.removedAtMs,
      removal,
    })),
    ...manualSessionUnlocks.map((unlock) => ({
      kind: 'manual_unlock' as const,
      atMs: unlock.unlockedAtMs,
      unlock,
    })),
  ].sort((left, right) => {
    if (left.atMs !== right.atMs) return left.atMs - right.atMs;
    if (left.kind === right.kind) return 0;
    const priority: Record<typeof left.kind, number> = {
      meeting: 0,
      removal: 1,
      manual_unlock: 2,
    };
    return priority[left.kind] - priority[right.kind];
  });

  for (const event of consumptionEvents) {
    pushEligiblePurchases(event.atMs);

    if (event.kind === 'meeting') {
      const credit = activeCredits.find((item) => item.remaining > 0);
      if (credit) {
        credit.remaining -= 1;
        coveredConductedMeetings.push(event.meeting);
      } else {
        uncoveredConductedMeetings.push(event.meeting);
      }
      continue;
    }

    if (event.kind === 'removal') {
      let sessionsToRemove = event.removal.sessionsRemoved;
      if (sessionsToRemove <= 0) continue;

      for (const credit of activeCredits) {
        if (sessionsToRemove <= 0) break;
        if (credit.remaining <= 0) continue;
        const applied = Math.min(credit.remaining, sessionsToRemove);
        credit.remaining -= applied;
        sessionsToRemove -= applied;
      }

      if (sessionsToRemove < event.removal.sessionsRemoved) {
        appliedSessionRemovals.push(event.removal);
      }
      continue;
    }

    const alreadyApplied = Boolean(
      (event.unlock.sessionId && appliedManualUnlockSessionIds.has(event.unlock.sessionId))
      || (event.unlock.sessionAccessKey && appliedManualUnlockSessionKeys.has(event.unlock.sessionAccessKey))
      || appliedManualUnlockSessionKeys.has(getDerivedManualUnlockAccessKey(event.unlock))
    );
    if (alreadyApplied) continue;

    const credit = activeCredits.find((item) => item.remaining > 0);
    if (credit) {
      credit.remaining -= 1;
      appliedManualSessionUnlocks.push(event.unlock);
      if (event.unlock.sessionId) appliedManualUnlockSessionIds.add(event.unlock.sessionId);
      if (event.unlock.sessionAccessKey) appliedManualUnlockSessionKeys.add(event.unlock.sessionAccessKey);
      const derivedAccessKey = getDerivedManualUnlockAccessKey(event.unlock);
      if (derivedAccessKey) appliedManualUnlockSessionKeys.add(derivedAccessKey);
    } else {
      rejectedManualSessionUnlocks.push(event.unlock);
    }
  }

  pushEligiblePurchases(nowMs);

  const coveredMeetingIds = new Set(
    coveredConductedMeetings
      .map((meeting) => meeting.sessionId)
      .filter(Boolean)
  );
  const coveredMeetingDateKeys = new Set(coveredConductedMeetings.map((meeting) => meeting.date));
  const coveredMeetingDateTimeKeys = new Set(
    coveredConductedMeetings.map((meeting) => `${meeting.date} ${meeting.meetingTime || ''}`)
  );
  const unlockedPreviousSessionIds = new Set(
    appliedManualSessionUnlocks.map((unlock) => unlock.sessionId).filter(Boolean)
  );
  const unlockedPreviousSessionAccessKeys = new Set<string>();
  appliedManualSessionUnlocks.forEach((unlock) => {
    if (unlock.sessionAccessKey) unlockedPreviousSessionAccessKeys.add(unlock.sessionAccessKey);
    const derivedAccessKey = getDerivedManualUnlockAccessKey(unlock);
    if (derivedAccessKey) unlockedPreviousSessionAccessKeys.add(derivedAccessKey);
  });

  const grossPurchasedSessions = purchases.reduce((sum, purchase) => sum + purchase.sessionsPurchased, 0);
  const requestedRemovedSessions = removals.reduce((sum, removal) => sum + removal.sessionsRemoved, 0);
  const appliedRemovedSessions = Math.max(
    0,
    grossPurchasedSessions - activeCredits.reduce((sum, credit) => sum + credit.remaining, 0) - coveredConductedMeetings.length - appliedManualSessionUnlocks.length
  );
  const totalPurchasedSessions = Math.max(0, grossPurchasedSessions - appliedRemovedSessions);
  const meetingConsumedSessions = coveredConductedMeetings.length;
  const manualUnlockConsumedSessions = appliedManualSessionUnlocks.length;
  const consumedSessions = meetingConsumedSessions + manualUnlockConsumedSessions;
  const remainingSessions = Math.max(0, activeCredits.reduce((sum, credit) => sum + credit.remaining, 0));

  return {
    purchases,
    removals,
    appliedSessionRemovals,
    manualSessionUnlocks,
    appliedManualSessionUnlocks,
    rejectedManualSessionUnlocks,
    conductedMeetings,
    coveredConductedMeetings,
    uncoveredConductedMeetings,
    coveredMeetingIds,
    coveredMeetingDateKeys,
    coveredMeetingDateTimeKeys,
    unlockedPreviousSessionIds,
    unlockedPreviousSessionAccessKeys,
    grossPurchasedSessions,
    requestedRemovedSessions,
    appliedRemovedSessions,
    totalPurchasedSessions,
    meetingConsumedSessions,
    manualUnlockConsumedSessions,
    consumedSessions,
    remainingSessions,
    firstPurchaseAt: purchases[0]?.purchasedAt || null,
    lastPurchaseAt: purchases[purchases.length - 1]?.purchasedAt || null,
  };
};
