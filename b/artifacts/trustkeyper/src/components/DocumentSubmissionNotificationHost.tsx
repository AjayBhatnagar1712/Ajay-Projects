import React from "react";
import { DocumentSubmissionNotificationBanner } from "@/components/DocumentSubmissionNotificationBanner";
import { useDocumentSubmissionSync } from "@/hooks/useDocumentSubmissionSync";

export function DocumentSubmissionNotificationHost(): React.ReactElement | null {
  const { activeNotification, dismissActiveNotification, navigateToAgreement } =
    useDocumentSubmissionSync();

  if (!activeNotification) return null;

  return (
    <DocumentSubmissionNotificationBanner
      notification={activeNotification}
      onDismiss={dismissActiveNotification}
      onNavigate={navigateToAgreement}
    />
  );
}
