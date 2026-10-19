import {
  pullAccountFromCloud,
  pushAccountKeyToCloud,
  pushLocalKeysToCloud,
} from "./cloudSync";
import { persistActiveSessionBackup } from "./initAppStorage";
import { migrateLegacyStorage } from "./storageMigration";
import { normalizePhoneDigits, setSessionItem, storageKey } from "./storageKeys";
import {
  getTenantWorkspaceForPhone,
  saveTenantWorkspace,
  type TenantWorkspaceRecord,
} from "./tenantWorkspace";
import { pullTenantWorkspaceFromServer } from "./tenantWorkflowServer";

/** True when a tenant workspace snapshot exists locally (with or without a profile). */
export function tenantLocalWorkspaceExists(phone: string): boolean {
  const p = normalizePhoneDigits(phone);
  if (p.length !== 10 || typeof localStorage === "undefined") return false;
  return (
    localStorage.getItem(`tk_${p}_tenant_workspace`) !== null ||
    localStorage.getItem(storageKey(p, "tenant", "tenant_workspace")) !== null ||
    getTenantWorkspaceForPhone(p) !== null
  );
}

export function tenantProfileExistsLocally(phone: string): boolean {
  const p = normalizePhoneDigits(phone);
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(storageKey(p, "tenant", "profile")) !== null;
}

function setTenantSession(phone: string): void {
  const p = normalizePhoneDigits(phone);
  sessionStorage.setItem("tk_active_phone", p);
  sessionStorage.setItem("tk_active_role", "tenant");
  persistActiveSessionBackup(p, "tenant");
}

function clearTenantSession(): void {
  sessionStorage.removeItem("tk_active_phone");
  sessionStorage.removeItem("tk_active_role");
}

function applyTenantProfileToSession(phone: string): void {
  try {
    const p = normalizePhoneDigits(phone);
    const raw = localStorage.getItem(storageKey(p, "tenant", "profile"));
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (typeof parsed.name === "string") setSessionItem("name", parsed.name);
    if (typeof parsed.phone === "string") setSessionItem("phone", parsed.phone);
  } catch {
    /* ignore */
  }
}

/** Creates a cloud-synced tenant profile from an existing workspace snapshot. */
export async function provisionTenantProfileFromWorkspace(
  phone: string,
  workspace: TenantWorkspaceRecord,
  accessToken?: string | null,
): Promise<void> {
  const p = normalizePhoneDigits(phone);
  const profileJson = JSON.stringify({
    name: workspace.tenantName?.trim() || "",
    phone: p,
    email: "",
    firm: "",
    bankHolderName: "",
    bankName: "",
    bankAccountNumber: "",
    bankIFSC: "",
    upiId: "",
    upiQrFileName: "",
    propertyCount: "",
    propertyIntent: "",
    createdAt: String(workspace.accountCreatedAt ?? workspace.updatedAt ?? Date.now()),
  });
  localStorage.setItem(storageKey(p, "tenant", "profile"), profileJson);
  saveTenantWorkspace({ ...workspace, phone: p });
  await pushAccountKeyToCloud(p, "tenant", "profile", profileJson, accessToken ?? undefined);
  const workspaceJson = JSON.stringify({ ...workspace, phone: p });
  await pushAccountKeyToCloud(p, "tenant", "tenant_workspace", workspaceJson, accessToken ?? undefined);
}

/**
 * Completes tenant login after OTP — pulls cloud data, provisions profile from workspace when
 * the tenant completed document upload but never received a profile row.
 */
export async function completeTenantLoginAfterOtp(
  phone: string,
  accessToken?: string | null,
): Promise<boolean> {
  const p = normalizePhoneDigits(phone);
  if (p.length !== 10) return false;

  setTenantSession(p);

  let pulled = await pullAccountFromCloud(p, "tenant");
  if (!pulled) {
    await new Promise((r) => setTimeout(r, 400));
    pulled = await pullAccountFromCloud(p, "tenant");
  }

  if (!tenantProfileExistsLocally(p)) {
    const localWorkspace = getTenantWorkspaceForPhone(p);
    if (localWorkspace) {
      await provisionTenantProfileFromWorkspace(p, localWorkspace, accessToken);
    } else {
      const serverWorkspace = await pullTenantWorkspaceFromServer(p, accessToken);
      if (serverWorkspace) {
        await provisionTenantProfileFromWorkspace(p, serverWorkspace, accessToken);
      }
    }
  }

  const hasProfile = tenantProfileExistsLocally(p);
  const hasWorkspace = tenantLocalWorkspaceExists(p);

  if (hasProfile || hasWorkspace) {
    if (!hasProfile && hasWorkspace) {
      const workspace = getTenantWorkspaceForPhone(p);
      if (workspace) {
        await provisionTenantProfileFromWorkspace(p, workspace, accessToken);
      }
    }
    migrateLegacyStorage(p, "tenant");
    applyTenantProfileToSession(p);
    void pushLocalKeysToCloud(p, "tenant", accessToken ?? undefined);
    return true;
  }

  clearTenantSession();
  return false;
}
