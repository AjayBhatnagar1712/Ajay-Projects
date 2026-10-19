import { useCallback, useEffect, useState } from "react";
import { X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DocumentSubmissionNotification } from "@/lib/documentSubmissionNotifications";
import {
  markDocumentSubmissionNotificationDisplayed,
  markDocumentSubmissionNotificationRead,
  resolveAgreementHrefForNotification,
} from "@/lib/documentSubmissionNotifications";

const AUTO_DISMISS_MS = 6500;

interface DocumentSubmissionNotificationBannerProps {
  notification: DocumentSubmissionNotification;
  onDismiss: () => void;
  onNavigate: (href: string) => void;
}

export function DocumentSubmissionNotificationBanner({
  notification,
  onDismiss,
  onNavigate,
}: DocumentSubmissionNotificationBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    markDocumentSubmissionNotificationDisplayed(notification.id);
    const showTimer = window.setTimeout(() => setVisible(true), 20);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(onDismiss, 300);
    }, AUTO_DISMISS_MS);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [notification.id, onDismiss]);

  const handleClose = useCallback(() => {
    setVisible(false);
    window.setTimeout(onDismiss, 300);
  }, [onDismiss]);

  const handleViewAgreement = useCallback(() => {
    markDocumentSubmissionNotificationRead(notification.id);
    onNavigate(resolveAgreementHrefForNotification(notification));
    handleClose();
  }, [handleClose, notification, onNavigate]);

  return (
    <div
      className={`fixed inset-x-0 top-0 z-[60] px-4 pt-3 pointer-events-none transition-transform duration-300 ease-out ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-xl border border-primary/20 bg-white shadow-lg shadow-primary/10 overflow-hidden">
        <div className="flex items-start gap-3 px-4 py-3 sm:px-5 sm:py-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileText size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Documents Submitted</p>
            <p className="mt-1 text-sm text-gray-600">
              <span className="font-medium text-gray-800">{notification.tenantName}</span> has
              successfully uploaded all requested documents. You can now review them and continue
              the agreement process.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={handleViewAgreement}>
                View Agreement
              </Button>
              {notification.propertyLabel ? (
                <span className="text-xs text-gray-500">{notification.propertyLabel}</span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Dismiss notification"
            className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
