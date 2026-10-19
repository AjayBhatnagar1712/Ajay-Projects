export const TENANT_LEAD_PHONE_PREFIX = "tenant_lead_phone_";

export function tenantLeadPhoneDataKey(phoneDigits: string): string {
  return `${TENANT_LEAD_PHONE_PREFIX}${phoneDigits}`;
}

export function phoneLast10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export type TenantPhoneRegistryEntry = {
  tenantId: string;
  tenantName: string;
  brokerPhone: string;
  source: "manual" | "onboarding_invite" | "broker_onboarding_link";
};

export type TenantPhoneConflict = "duplicate_tenant" | "duplicate_tenant_account";

export type TenantPhoneUniquenessStore = {
  findEntryByDataKey: (
    dataKey: string,
  ) => Promise<{ phone: string; role: string; value: string } | null>;
  getAccountData: (phone: string, role: string) => Promise<Record<string, string>>;
  setAccountDataKey: (phone: string, role: string, dataKey: string, value: string) => Promise<void>;
  accountHasProfile?: (phone: string, role: string) => Promise<boolean>;
};

export async function findBrokerTenantLeadByPhone(
  store: TenantPhoneUniquenessStore,
  brokerPhone: string,
  phoneDigits: string,
): Promise<{ id: string } | null> {
  const data = await store.getAccountData(phoneLast10(brokerPhone), "broker");
  const raw = data.tenants;
  if (!raw) return null;
  try {
    const list = JSON.parse(raw) as { id: string; phone: string }[];
    if (!Array.isArray(list)) return null;
    const match = list.find((row) => phoneLast10(row.phone) === phoneDigits);
    return match ? { id: match.id } : null;
  } catch {
    return null;
  }
}

export async function findGlobalTenantLeadClaim(
  store: TenantPhoneUniquenessStore,
  phoneDigits: string,
): Promise<{ brokerPhone: string } | null> {
  const entry = await store.findEntryByDataKey(tenantLeadPhoneDataKey(phoneDigits));
  if (!entry) return null;
  return { brokerPhone: phoneLast10(entry.phone) };
}

export async function assertTenantPhoneAvailable(
  store: TenantPhoneUniquenessStore,
  brokerPhone: string,
  phoneDigits: string,
): Promise<TenantPhoneConflict | null> {
  if (phoneDigits.length !== 10) return null;

  if (store.accountHasProfile) {
    const hasTenantAccount = await store.accountHasProfile(phoneDigits, "tenant");
    if (hasTenantAccount) return "duplicate_tenant_account";
  }

  const brokerLead = await findBrokerTenantLeadByPhone(store, brokerPhone, phoneDigits);
  if (brokerLead) return "duplicate_tenant";

  const globalClaim = await findGlobalTenantLeadClaim(store, phoneDigits);
  if (globalClaim) return "duplicate_tenant";

  return null;
}

export async function registerTenantLeadPhoneClaim(
  store: TenantPhoneUniquenessStore,
  brokerPhone: string,
  phoneDigits: string,
  entry: TenantPhoneRegistryEntry,
): Promise<void> {
  await store.setAccountDataKey(
    phoneLast10(brokerPhone),
    "broker",
    tenantLeadPhoneDataKey(phoneDigits),
    JSON.stringify(entry),
  );
}
