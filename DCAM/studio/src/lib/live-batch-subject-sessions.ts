export type SubjectScheduleSessionLike = {
  subjectId?: string | null;
  sessionCount?: unknown;
};

const normalizeSubjectId = (value?: string | null) => (typeof value === 'string' ? value.trim() : '');

export const isValidSubjectSessionCount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && Math.floor(parsed) === parsed;
};

export const normalizeSubjectSessionCount = (value: unknown, fallback = 0) => {
  if (!isValidSubjectSessionCount(value)) return Math.max(0, Math.floor(Number(fallback) || 0));
  return Math.max(0, Math.floor(Number(value)));
};

export const buildSubjectSessionCountMap = (params: {
  subjectIds?: Array<string | null | undefined>;
  subjectSchedules?: SubjectScheduleSessionLike[] | null;
  fallbackTotalSessions?: unknown;
}) => {
  const orderedSubjectIds: string[] = [];
  const pushSubjectId = (value?: string | null) => {
    const normalized = normalizeSubjectId(value);
    if (!normalized || orderedSubjectIds.includes(normalized)) return;
    orderedSubjectIds.push(normalized);
  };

  (params.subjectIds || []).forEach(pushSubjectId);
  (params.subjectSchedules || []).forEach((schedule) => pushSubjectId(schedule?.subjectId));

  const scheduleBySubjectId = new Map<string, SubjectScheduleSessionLike>();
  (params.subjectSchedules || []).forEach((schedule) => {
    const subjectId = normalizeSubjectId(schedule?.subjectId);
    if (!subjectId || scheduleBySubjectId.has(subjectId)) return;
    scheduleBySubjectId.set(subjectId, schedule);
  });

  const resolved = new Map<string, number>();
  let explicitTotal = 0;

  orderedSubjectIds.forEach((subjectId) => {
    const schedule = scheduleBySubjectId.get(subjectId);
    if (!schedule || !isValidSubjectSessionCount(schedule.sessionCount)) return;
    const normalizedCount = normalizeSubjectSessionCount(schedule.sessionCount);
    resolved.set(subjectId, normalizedCount);
    explicitTotal += normalizedCount;
  });

  const unresolvedSubjectIds = orderedSubjectIds.filter((subjectId) => !resolved.has(subjectId));
  const fallbackTotal = normalizeSubjectSessionCount(params.fallbackTotalSessions);
  const remainingTotal = Math.max(0, fallbackTotal - explicitTotal);
  const baseCount = unresolvedSubjectIds.length > 0 ? Math.floor(remainingTotal / unresolvedSubjectIds.length) : 0;
  let remainder = unresolvedSubjectIds.length > 0 ? remainingTotal % unresolvedSubjectIds.length : 0;

  unresolvedSubjectIds.forEach((subjectId) => {
    const nextCount = baseCount + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    resolved.set(subjectId, nextCount);
  });

  return Object.fromEntries(orderedSubjectIds.map((subjectId) => [subjectId, resolved.get(subjectId) ?? 0])) as Record<string, number>;
};

export const sumSubjectSessionCounts = (params: {
  subjectIds?: Array<string | null | undefined>;
  subjectSchedules?: SubjectScheduleSessionLike[] | null;
  fallbackTotalSessions?: unknown;
}) => Object.values(buildSubjectSessionCountMap(params)).reduce((sum, count) => sum + normalizeSubjectSessionCount(count), 0);
