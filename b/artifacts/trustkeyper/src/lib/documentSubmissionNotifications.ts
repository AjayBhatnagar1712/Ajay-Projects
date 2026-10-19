import type { RequesterDocumentUploadInviteView } from "@workspace/tenant-document-upload";
import { queueCloudSync } from "./cloudSync";
import { getItem, setItem } from "./storageKeys";

export const DOCUMENT_SUBMISSION_NOTIFICATIONS_KEY = "document_submission_notifications";
export const DOCUMENT_SUBMISSION_NOTIFICATION_EVENT = "tk-document-submission-notification";

export type DocumentSubmissionNotificationStatus = "unread" | "displayed" | "read" | "archived";

export interface DocumentSubmissionNotification {
  id: string;
  token: string;
  tenantName: string;
  tenantPhone: string;
  propertyId?: string;
  propertyLabel?: string;
  submittedAt: number;
  requesterRole: "owner" | "broker";
  status: DocumentSubmissionNotificationStatus;
  createdAt: number;
  displayedAt?: number;
  readAt?: number;
}

function broadcastUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DOCUMENT_SUBMISSION_NOTIFICATION_EVENT));
}

function readAll(): DocumentSubmissionNotification[] {
  try {
    const raw = getItem(DOCUMENT_SUBMISSION_NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DocumentSubmissionNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(notifications: DocumentSubmissionNotification[]): void {
  const sorted = [...notifications].sort((a, b) => b.submittedAt - a.submittedAt);
  const payload = JSON.stringify(sorted);
  setItem(DOCUMENT_SUBMISSION_NOTIFICATIONS_KEY, payload);
  queueCloudSync(DOCUMENT_SUBMISSION_NOTIFICATIONS_KEY, payload);
  broadcastUpdated();
}

export function notificationIdForSubmission(token: string, submittedAt: number): string {
  return `doc-submit-${token}-${submittedAt}`;
}

export function isInviteFullySubmitted(invite: RequesterDocumentUploadInviteView): boolean {
  return (
    invite.status === "submitted" &&
    invite.tenantDocumentStatus === "documents_submitted" &&
    typeof invite.submittedAt === "number" &&
    invite.submittedAt > 0
  );
}

export function getDocumentSubmissionNotifications(): DocumentSubmissionNotification[] {
  return readAll();
}

export function getUnreadDocumentSubmissionNotifications(): DocumentSubmissionNotification[] {
  return readAll().filter((row) => row.status === "unread");
}

export function findDocumentSubmissionNotification(id: string): DocumentSubmissionNotification | undefined {
  return readAll().find((row) => row.id === id);
}

export function createDocumentSubmissionNotification(input: {
  invite: RequesterDocumentUploadInviteView;
  requesterRole: "owner" | "broker";
}): DocumentSubmissionNotification | null {
  const { invite, requesterRole } = input;
  if (!isInviteFullySubmitted(invite)) return null;

  const submittedAt = invite.submittedAt ?? Date.now();
  const id = notificationIdForSubmission(invite.token, submittedAt);
  const existing = readAll();
  const duplicate = existing.find((row) => row.id === id);
  if (duplicate) return duplicate;

  const created: DocumentSubmissionNotification = {
    id,
    token: invite.token,
    tenantName: invite.tenantName,
    tenantPhone: invite.tenantPhone,
    propertyId: invite.propertyId,
    propertyLabel: invite.propertyLabel,
    submittedAt,
    requesterRole,
    status: "unread",
    createdAt: Date.now(),
  };

  persist([created, ...existing]);
  return created;
}

export function markDocumentSubmissionNotificationDisplayed(id: string): void {
  const rows = readAll();
  const idx = rows.findIndex((row) => row.id === id);
  if (idx === -1) return;
  if (rows[idx].status !== "unread") return;
  rows[idx] = {
    ...rows[idx],
    status: "displayed",
    displayedAt: Date.now(),
  };
  persist(rows);
}

export function markDocumentSubmissionNotificationRead(id: string): void {
  const rows = readAll();
  const idx = rows.findIndex((row) => row.id === id);
  if (idx === -1) return;
  if (rows[idx].status === "read" || rows[idx].status === "archived") return;
  rows[idx] = {
    ...rows[idx],
    status: "read",
    readAt: Date.now(),
  };
  persist(rows);
}

export function archiveDocumentSubmissionNotification(id: string): void {
  const rows = readAll();
  const idx = rows.findIndex((row) => row.id === id);
  if (idx === -1) return;
  rows[idx] = {
    ...rows[idx],
    status: "archived",
    readAt: rows[idx].readAt ?? Date.now(),
  };
  persist(rows);
}

export function resolveAgreementHrefForNotification(
  notification: DocumentSubmissionNotification,
): string {
  const base =
    notification.requesterRole === "owner"
      ? "/owner/agreements/generate"
      : "/broker/agreements/generate";
  const params = new URLSearchParams({
    resume: "1",
    focusToken: notification.token,
  });
  return `${base}?${params.toString()}`;
}
