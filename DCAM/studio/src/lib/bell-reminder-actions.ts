const pad2 = (value: number) => String(value).padStart(2, '0');

const cleanString = (value: unknown) => String(value || '').trim();

const asDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
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

const toLocalYmd = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const toLocalHm = (date: Date) =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

export const normalizeReminderActionKeys = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(
    new Set(
      value
        .map((entry) => cleanString(entry))
        .filter(Boolean)
    )
  );
};

export const buildMeetingReminderActionKey = (input: {
  batchId?: unknown;
  sessionId?: unknown;
  date?: unknown;
  meetingTime?: unknown;
  subjectId?: unknown;
}) => {
  const batchId = cleanString(input.batchId);
  const sessionId = cleanString(input.sessionId);
  const date = cleanString(input.date);
  const meetingTime = cleanString(input.meetingTime);
  const subjectId = cleanString(input.subjectId);

  if (!batchId || !date || !meetingTime) return '';

  return ['meeting', batchId, sessionId || 'session', date, meetingTime, subjectId || 'all-subjects'].join(':');
};

export const buildTestReminderActionKey = (input: {
  testId?: unknown;
  scheduledDate?: unknown;
  scheduledTime?: unknown;
  startTime?: unknown;
}) => {
  const testId = cleanString(input.testId);
  let scheduledDate = cleanString(input.scheduledDate);
  let scheduledTime = cleanString(input.scheduledTime);

  if ((!scheduledDate || !scheduledTime) && input.startTime) {
    const parsedStartAt = asDate(input.startTime);
    if (parsedStartAt) {
      if (!scheduledDate) scheduledDate = toLocalYmd(parsedStartAt);
      if (!scheduledTime) scheduledTime = toLocalHm(parsedStartAt);
    }
  }

  if (!testId || !scheduledDate || !scheduledTime) return '';

  return ['test', testId, scheduledDate, scheduledTime].join(':');
};
