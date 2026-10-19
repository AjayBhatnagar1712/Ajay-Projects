import { pushAccountKeyToCloud } from "./cloudSync";
import { tenantLeadPhoneDataKey } from "@workspace/broker-tenant-onboarding";
import { profileExistsAsync } from "./auth";
import { getActiveSession, setItem } from "./storageKeys";
import { findTenantByContact, type Tenant } from "./tenants";

export type TenantPhoneConflictKind = "lead" | "tenant_account";

export function findDuplicateTenantLead(phone: string): Tenant | undefined {
  return findTenantByContact(phone);
}

export async function getTenantPhoneConflict(
  phone: string,
  options?: { excludeTenantId?: string },
): Promise<TenantPhoneConflictKind | null> {
  const existing = findTenantByContact(phone);
  if (existing && existing.id !== options?.excludeTenantId) {
    return "lead";
  }
  if (await profileExistsAsync(phone, "tenant")) {
    return "tenant_account";
  }
  return null;
}

export function tenantPhoneConflictMessage(conflict: TenantPhoneConflictKind): string {
  if (conflict === "tenant_account") {
    return "This mobile number already has a tenant account. A phone number can only be a tenant once.";
  }
  return "A tenant lead with this mobile number already exists in your list.";
}

export function registerTenantLeadPhoneClaimLocally(
  tenant: Pick<Tenant, "id" | "name" | "phone">,
  source: "manual" | "broker_onboarding_link" = "manual",
): void {
  const session = getActiveSession();
  if (!session || session.role !== "broker") return;

  const digits = tenant.phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return;

  const payload = JSON.stringify({
    tenantId: tenant.id,
    tenantName: tenant.name,
    brokerPhone: session.phone,
    source,
  });
  const dataKey = tenantLeadPhoneDataKey(digits);
  setItem(dataKey, payload);
  void pushAccountKeyToCloud(session.phone, "broker", dataKey, payload);
}
