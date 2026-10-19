import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveTenantDashboardPhase,
  resolveTenantNotification,
  resolveTenantProgressSteps,
  saveTenantWorkspace,
  getTenantWorkspaceForPhone,
  type TenantWorkspaceRecord,
} from "./tenantWorkspace";

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
  };
}

const baseWorkspace: TenantWorkspaceRecord = {
  phone: "9876543210",
  tenantName: "Meena",
  propertyLabel: "Prestige Unit 1806",
  propertyAddress: "Financial District, Hyderabad",
  monthlyRent: "13000",
  updatedAt: Date.now(),
};

describe("tenantWorkspace", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists and loads workspace by phone", () => {
    saveTenantWorkspace(baseWorkspace);
    const loaded = getTenantWorkspaceForPhone("9876543210");
    expect(loaded?.propertyLabel).toBe("Prestige Unit 1806");
  });

  it("marks documents submitted phase after upload", () => {
    const phase = resolveTenantDashboardPhase({
      ...baseWorkspace,
      documentUploadStatus: "documents_submitted",
    });
    expect(phase).toBe("documents_submitted");
  });

  it("highlights agreement generation after documents submitted", () => {
    const steps = resolveTenantProgressSteps({
      ...baseWorkspace,
      documentUploadStatus: "documents_submitted",
      documentUploadSubmittedAt: Date.now(),
    });
    expect(steps[0]?.state).toBe("complete");
    expect(steps[1]?.state).toBe("current");
    expect(steps[2]?.state).toBe("upcoming");
  });

  it("returns documents under review notification by default after submit", () => {
    const notification = resolveTenantNotification({
      ...baseWorkspace,
      documentUploadStatus: "documents_submitted",
    });
    expect(notification.kind).toBe("documents_under_review");
    expect(notification.title).toBe("Documents Under Review");
    expect(notification.description).toContain("currently being reviewed");
    expect(notification.actionHref).toBe("/tenant/documents");
  });

  it("returns continue action for in-progress document collection", () => {
    const notification = resolveTenantNotification({
      ...baseWorkspace,
      documentUploadStatus: "documents_in_progress",
      documentUploadToken: "adu_resume",
    });
    expect(notification.actionLabel).toBe("Continue Document Collection");
    expect(notification.actionHref).toBe("/upload/documents/adu_resume");
  });
});
