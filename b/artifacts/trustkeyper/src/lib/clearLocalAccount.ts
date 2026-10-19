import { CLOUD_SYNC_KEYS } from "@/lib/cloudSync";
import { clearActiveSessionBackup } from "@/lib/initAppStorage";
import { storageKey, normalizePhoneDigits } from "@/lib/storageKeys";

const ROLES = ["broker", "owner", "tenant", "manager"] as const;

const EXTRA_DATA_TYPES = [
  "owner_tenant_inquiries",
  "owner_tenant_invites",
  "tenant_property_declines",
  "owner_property_maintenance",
  "owner_property_documents",
  "add_tenant_draft",
  "agreement_pending_property",
  "agreement_edit_draft",
  "name",
  "firm",
  "phone",
  "contact",
] as const;

const LEGACY_LOCAL_KEYS = [
  "broker_properties",
  "broker_tenants",
  "broker_agreements",
  "broker_profile_v1",
  "broker_agreement_draft",
  "trustkeyper_onboarding_data",
] as const;

const LEGACY_SESSION_KEYS = [
  "broker_properties",
  "broker_tenants",
  "broker_agreements",
  "broker_add_property_data",
  "broker_add_tenant_draft",
  "agreement_pending_property",
  "agreement_edit_draft",
  "broker_name",
  "broker_firm",
  "broker_phone",
  "owner_name",
  "owner_phone",
  "owner_contact",
  "add_property_data",
] as const;

function removeFromStore(store: Storage, key: string): boolean {
  if (!store.getItem(key)) return false;
  store.removeItem(key);
  return true;
}

function removeKeysMatchingPhone(store: Storage, phone: string): string[] {
  const removed: string[] = [];
  const prefix = `tk_${phone}_`;
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k) keys.push(k);
  }
  for (const key of keys) {
    if (key.startsWith(prefix) || key.includes(phone)) {
      store.removeItem(key);
      removed.push(key);
    }
  }
  return removed;
}

/** Clear all browser-local account data and session for the given phone (10 digits). */
export function clearLocalAccountByPhone(rawPhone: string): {
  phone: string;
  removedLocal: string[];
  removedSession: string[];
  sessionCleared: boolean;
} {
  const phone = normalizePhoneDigits(rawPhone);
  const removedLocal: string[] = [];
  const removedSession: string[] = [];

  for (const role of ROLES) {
    for (const dataType of [...CLOUD_SYNC_KEYS, ...EXTRA_DATA_TYPES]) {
      const key = storageKey(phone, role, dataType);
      if (removeFromStore(localStorage, key)) removedLocal.push(key);
      if (removeFromStore(sessionStorage, key)) removedSession.push(key);
    }
  }

  removedLocal.push(...removeKeysMatchingPhone(localStorage, phone));
  removedSession.push(...removeKeysMatchingPhone(sessionStorage, phone));

  for (const key of LEGACY_LOCAL_KEYS) {
    if (removeFromStore(localStorage, key)) removedLocal.push(key);
  }
  for (const key of LEGACY_SESSION_KEYS) {
    if (removeFromStore(sessionStorage, key)) removedSession.push(key);
  }

  const activePhone = sessionStorage.getItem("tk_active_phone");
  const backupPhone = localStorage.getItem("tk_session_backup_phone");
  let sessionCleared = false;

  if (
    activePhone === phone ||
    backupPhone === phone ||
    normalizePhoneDigits(activePhone ?? "") === phone ||
    normalizePhoneDigits(backupPhone ?? "") === phone
  ) {
    sessionStorage.removeItem("tk_active_phone");
    sessionStorage.removeItem("tk_active_role");
    sessionStorage.removeItem("tk_pending_role");
    clearActiveSessionBackup();
    sessionCleared = true;
  }

  return {
    phone,
    removedLocal: [...new Set(removedLocal)],
    removedSession: [...new Set(removedSession)],
    sessionCleared,
  };
}
