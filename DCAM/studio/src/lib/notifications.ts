import { parseYmdHmToLocalDateTime } from '@/lib/live-batch-session-access';

export type NotificationContentType =
  | 'course'
  | 'mock_test'
  | 'live_batch'
  | 'teacher_offer'
  | 'premium_practice_session'
  | 'premium_custom_mock_test'
  | 'custom_mock_test'
  | (string & {});

export type AppNotificationType =
  | 'general'
  | 'course_enrolled'
  | 'course_purchased'
  | 'mock_test_purchased'
  | 'live_batch_enrolled'
  | 'live_batch_purchased'
  | 'teacher_offer_purchased'
  | 'teacher_question_purchase_success'
  | 'premium_practice_purchased'
  | 'premium_custom_mock_purchased'
  | 'custom_mock_created'
  | 'teacher_new_course'
  | 'teacher_new_mock_test'
  | 'teacher_new_live_batch'
  | 'live_batch_upcoming'
  | 'live_batch_holiday'
  | 'live_batch_cancelled'
  | 'live_batch_test_scheduled'
  | 'live_batch_buy_sessions'
  | 'curriculum_request_status'
  | 'teacher_schedule_class_reminder'
  | 'teacher_start_class_reminder'
  | (string & {});

export type StoredNotification = {
  id: string;
  title?: string;
  message?: string;
  href?: string | null;
  recipientId?: string | null;
  audience?: string | null;
  notificationType?: AppNotificationType;
  contentType?: NotificationContentType | null;
  contentId?: string | null;
  teacherId?: string | null;
  batchId?: string | null;
  courseId?: string | null;
  testId?: string | null;
  liveBatchId?: string | null;
  eventDate?: string | null;
  eventEndDate?: string | null;
  eventTime?: string | null;
  eventEndTime?: string | null;
  accessLevel?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  readAt?: unknown;
  isRead?: boolean;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type BellNotificationItem = {
  id: string;
  title: string;
  message: string;
  href?: string;
  notificationType: AppNotificationType;
  createdAtMs: number;
  isRead: boolean;
  isPersistent: boolean;
  persistentId?: string;
  keepUntilAction?: boolean;
};

const toDate = (value: unknown): Date | null => {
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

export const getNotificationCreatedAtMs = (notification?: Pick<StoredNotification, 'createdAt' | 'updatedAt'> | null) => {
  const createdAt = toDate(notification?.createdAt);
  if (createdAt) return createdAt.getTime();
  const updatedAt = toDate(notification?.updatedAt);
  return updatedAt ? updatedAt.getTime() : 0;
};

export const formatNotificationRelativeTime = (valueMs: number, nowMs = Date.now()) => {
  if (!Number.isFinite(valueMs) || valueMs <= 0) return 'just now';
  const diffMs = valueMs - nowMs;
  const absMinutes = Math.round(Math.abs(diffMs) / 60000);
  const absHours = Math.round(Math.abs(diffMs) / (60 * 60000));
  const absDays = Math.round(Math.abs(diffMs) / (24 * 60 * 60000));

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(diffMs) < 60 * 1000) return 'just now';
  if (Math.abs(diffMs) < 60 * 60 * 1000) {
    const minutes = Math.max(1, absMinutes);
    return formatter.format(diffMs < 0 ? -minutes : minutes, 'minute');
  }
  if (Math.abs(diffMs) < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, absHours);
    return formatter.format(diffMs < 0 ? -hours : hours, 'hour');
  }
  const days = Math.max(1, absDays);
  return formatter.format(diffMs < 0 ? -days : days, 'day');
};

export const formatNotificationAbsoluteTime = (valueMs: number) => {
  if (!Number.isFinite(valueMs) || valueMs <= 0) return 'Just now';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(valueMs));
};

export const formatScheduledMoment = (dateValue?: string | null, timeValue?: string | null) => {
  const scheduledAt = parseYmdHmToLocalDateTime(dateValue || undefined, timeValue || undefined);
  if (!scheduledAt) return '';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(scheduledAt);
};

export const buildPersistentBellNotification = (notification: StoredNotification): BellNotificationItem => ({
  id: notification.id,
  title: String(notification.title || 'Notification').trim() || 'Notification',
  message: String(notification.message || '').trim(),
  href: typeof notification.href === 'string' && notification.href.trim() ? notification.href.trim() : undefined,
  notificationType: notification.notificationType || 'general',
  createdAtMs: getNotificationCreatedAtMs(notification),
  isRead: notification.isRead === true,
  isPersistent: true,
  persistentId: notification.id,
});
