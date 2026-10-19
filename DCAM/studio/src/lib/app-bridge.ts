'use client';

import type { BellNotificationItem } from '@/lib/notifications';

type AppBridgeMessage =
  | {
      type: 'sync-bell-notifications';
      userId: string | null;
      notifications: NativeBellNotificationPayload[];
    }
  | {
      type: 'sync-session-state';
      userId: string | null;
      launchPath: string;
      resetToHome: boolean;
      isAdmin: boolean;
    };

export type NativeBellNotificationPayload = {
  id: string;
  title: string;
  message: string;
  href?: string;
  notificationType: string;
  createdAtMs: number;
  keepUntilAction: boolean;
};

declare global {
  interface Window {
    DcamAppBridge?: {
      postMessage(message: string): void;
    };
  }
}

const canUseAppBridge = () =>
  typeof window !== 'undefined' && typeof window.DcamAppBridge?.postMessage === 'function';

const postAppBridgeMessage = (message: AppBridgeMessage) => {
  if (!canUseAppBridge()) return false;

  try {
    window.DcamAppBridge?.postMessage(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
};

const normalizeNotificationPayload = (
  notifications: BellNotificationItem[]
): NativeBellNotificationPayload[] =>
  notifications.map((notification) => ({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    href: notification.href,
    notificationType: notification.notificationType,
    createdAtMs: notification.createdAtMs,
    keepUntilAction: notification.keepUntilAction === true,
  }));

export const syncBellNotificationsToApp = (params: {
  userId?: string | null;
  notifications: BellNotificationItem[];
}) =>
  postAppBridgeMessage({
    type: 'sync-bell-notifications',
    userId: params.userId?.trim() || null,
    notifications: normalizeNotificationPayload(params.notifications),
  });

export const syncAppSessionStateToApp = (params: {
  userId?: string | null;
  launchPath?: string | null;
  resetToHome?: boolean;
  isAdmin?: boolean;
}) =>
  postAppBridgeMessage({
    type: 'sync-session-state',
    userId: params.userId?.trim() || null,
    launchPath: params.userId ? (params.launchPath?.trim() || '/dashboard') : '/',
    resetToHome: params.resetToHome === true,
    isAdmin: params.isAdmin === true,
  });

export const resetAppSessionStateInApp = () =>
  syncAppSessionStateToApp({
    userId: null,
    launchPath: '/',
    resetToHome: true,
  });
