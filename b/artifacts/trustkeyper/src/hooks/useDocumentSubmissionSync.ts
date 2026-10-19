import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  fetchRequesterDocumentUploadInvites,
  hasStoredDocumentUploadInvitesNeedingPoll,
} from "@/lib/agreementDocumentUpload";
import { AGREEMENT_DOCUMENT_UPLOAD_UPDATED_EVENT } from "@/lib/agreementDocumentUploadStore";
import {
  DOCUMENT_SUBMISSION_NOTIFICATION_EVENT,
  getUnreadDocumentSubmissionNotifications,
  type DocumentSubmissionNotification,
} from "@/lib/documentSubmissionNotifications";
import { DOCUMENT_SUBMISSION_SYNC_EVENT } from "@/lib/documentSubmissionSync";
import { getActiveSession } from "@/lib/storageKeys";

const POLL_INTERVAL_MS = 60_000;

export function useDocumentSubmissionSync(): {
  activeNotification: DocumentSubmissionNotification | null;
  dismissActiveNotification: () => void;
  navigateToAgreement: (href: string) => void;
} {
  const [, setLocation] = useLocation();
  const [activeNotification, setActiveNotification] = useState<DocumentSubmissionNotification | null>(
    null,
  );

  const pickUnreadNotification = useCallback(() => {
    const unread = getUnreadDocumentSubmissionNotifications();
    const next = unread[0] ?? null;
    setActiveNotification((current) => {
      if (current && unread.some((row) => row.id === current.id)) return current;
      return next;
    });
  }, []);

  const syncFromServer = useCallback(async () => {
    const session = getActiveSession();
    if (!session || (session.role !== "owner" && session.role !== "broker")) return;
    await fetchRequesterDocumentUploadInvites();
    pickUnreadNotification();
  }, [pickUnreadNotification]);

  useEffect(() => {
    pickUnreadNotification();
    if (!document.hidden) {
      void syncFromServer();
    }

    const syncIfVisible = () => {
      if (document.hidden) return;
      if (!hasStoredDocumentUploadInvitesNeedingPoll()) return;
      void syncFromServer();
    };

    const interval = window.setInterval(syncIfVisible, POLL_INTERVAL_MS);
    const onRefresh = () => {
      pickUnreadNotification();
      void syncFromServer();
    };
    const onVisibilityChange = () => {
      if (document.hidden) return;
      pickUnreadNotification();
      void syncFromServer();
    };

    window.addEventListener("focus", onRefresh);
    window.addEventListener(DOCUMENT_SUBMISSION_NOTIFICATION_EVENT, pickUnreadNotification);
    window.addEventListener(DOCUMENT_SUBMISSION_SYNC_EVENT, pickUnreadNotification);
    window.addEventListener(AGREEMENT_DOCUMENT_UPLOAD_UPDATED_EVENT, onRefresh);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener(DOCUMENT_SUBMISSION_NOTIFICATION_EVENT, pickUnreadNotification);
      window.removeEventListener(DOCUMENT_SUBMISSION_SYNC_EVENT, pickUnreadNotification);
      window.removeEventListener(AGREEMENT_DOCUMENT_UPLOAD_UPDATED_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pickUnreadNotification, syncFromServer]);

  const dismissActiveNotification = useCallback(() => {
    setActiveNotification(null);
    pickUnreadNotification();
  }, [pickUnreadNotification]);

  const navigateToAgreement = useCallback(
    (href: string) => {
      setLocation(href);
    },
    [setLocation],
  );

  return {
    activeNotification,
    dismissActiveNotification,
    navigateToAgreement,
  };
}
