import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequesterDocumentUploadInviteView } from "@workspace/tenant-document-upload";
import {
  createDocumentSubmissionNotification,
  getDocumentSubmissionNotifications,
  getUnreadDocumentSubmissionNotifications,
  isInviteFullySubmitted,
  markDocumentSubmissionNotificationDisplayed,
  markDocumentSubmissionNotificationRead,
  notificationIdForSubmission,
  resolveAgreementHrefForNotification,
} from "./documentSubmissionNotifications";

const storage = new Map<string, string>();

vi.mock("./storageKeys", () => ({
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
}));

vi.mock("./cloudSync", () => ({
  queueCloudSync: vi.fn(),
}));

function submittedInvite(
  overrides: Partial<RequesterDocumentUploadInviteView> = {},
): RequesterDocumentUploadInviteView {
  return {
    token: "tok_abc",
    tenantName: "Ravi Kumar",
    tenantPhone: "+91 9876543210",
    status: "submitted",
    tenantDocumentStatus: "documents_submitted",
    submittedAt: 1_700_000_000_000,
    requestedDocumentIds: ["aadhaar", "pan", "bank"],
    documentStatuses: { aadhaar: "uploaded", pan: "uploaded", bank: "uploaded" },
    documents: {},
    expiresAt: Date.now() + 86_400_000,
    propertyId: "prop_1",
    propertyLabel: "Green Heights",
    ...overrides,
  };
}

describe("documentSubmissionNotifications", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("detects a fully submitted invite", () => {
    expect(isInviteFullySubmitted(submittedInvite())).toBe(true);
    expect(
      isInviteFullySubmitted(
        submittedInvite({ tenantDocumentStatus: "documents_in_progress" }),
      ),
    ).toBe(false);
  });

  it("creates unread notifications only once per submission", () => {
    const invite = submittedInvite();
    const first = createDocumentSubmissionNotification({ invite, requesterRole: "owner" });
    const second = createDocumentSubmissionNotification({ invite, requesterRole: "owner" });

    expect(first?.id).toBe(notificationIdForSubmission(invite.token, invite.submittedAt ?? 0));
    expect(second?.id).toBe(first?.id);
    expect(getDocumentSubmissionNotifications()).toHaveLength(1);
    expect(getUnreadDocumentSubmissionNotifications()).toHaveLength(1);
  });

  it("moves notification through displayed and read states", () => {
    const created = createDocumentSubmissionNotification({
      invite: submittedInvite(),
      requesterRole: "broker",
    });
    expect(created).not.toBeNull();
    if (!created) return;

    markDocumentSubmissionNotificationDisplayed(created.id);
    expect(getUnreadDocumentSubmissionNotifications()).toHaveLength(0);

    markDocumentSubmissionNotificationRead(created.id);
    const row = getDocumentSubmissionNotifications().find((item) => item.id === created.id);
    expect(row?.status).toBe("read");
  });

  it("builds agreement href with focus token", () => {
    const created = createDocumentSubmissionNotification({
      invite: submittedInvite(),
      requesterRole: "owner",
    });
    expect(created).not.toBeNull();
    if (!created) return;

    expect(resolveAgreementHrefForNotification(created)).toBe(
      "/owner/agreements/generate?resume=1&focusToken=tok_abc",
    );
  });
});
