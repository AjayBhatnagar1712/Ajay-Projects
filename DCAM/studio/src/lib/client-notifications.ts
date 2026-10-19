import type { User } from 'firebase/auth';

import {
  fanOutLiveBatchBellNotification,
  fanOutTeacherPublicationBellNotification,
  pushSelfBellNotification,
} from '@/app/actions';
import type { AppNotificationType, NotificationContentType } from '@/lib/notifications';

type SelfBellNotificationInput = {
  title: string;
  message: string;
  href?: string;
  notificationType: AppNotificationType;
  dedupeKey: string;
  contentType?: NotificationContentType;
  contentId?: string;
  teacherId?: string;
  batchId?: string;
  courseId?: string;
  testId?: string;
  liveBatchId?: string;
  eventDate?: string;
  eventEndDate?: string;
  eventTime?: string;
  eventEndTime?: string;
  accessLevel?: string;
  metadata?: Record<string, unknown>;
};

type LiveBatchBellNotificationInput = {
  batchId: string;
  title: string;
  message: string;
  notificationType: AppNotificationType;
  dedupeKey: string;
  href?: string;
  eventDate?: string;
  eventEndDate?: string;
  eventTime?: string;
  eventEndTime?: string;
};

const getFreshIdToken = async (user?: User | null) => {
  if (!user) return '';
  try {
    return await user.getIdToken(true);
  } catch {
    return '';
  }
};

export async function sendSelfBellNotification(user: User | null | undefined, input: SelfBellNotificationInput) {
  const idToken = await getFreshIdToken(user);
  if (!idToken) return false;

  try {
    const result = await pushSelfBellNotification({ idToken, ...input });
    return result.success;
  } catch {
    return false;
  }
}

export async function notifyTeacherPublication(user: User | null | undefined, input: {
  contentType: Extract<NotificationContentType, 'course' | 'mock_test' | 'live_batch'>;
  contentId: string;
}) {
  const idToken = await getFreshIdToken(user);
  if (!idToken) return false;

  try {
    const result = await fanOutTeacherPublicationBellNotification({ idToken, ...input });
    return result.success;
  } catch {
    return false;
  }
}

export async function notifyLiveBatchStudents(user: User | null | undefined, input: LiveBatchBellNotificationInput) {
  const idToken = await getFreshIdToken(user);
  if (!idToken) return false;

  try {
    const result = await fanOutLiveBatchBellNotification({ idToken, ...input });
    return result.success;
  } catch {
    return false;
  }
}
