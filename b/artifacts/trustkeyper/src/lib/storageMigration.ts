import type { Role } from "./auth";
import { storageKey } from "./storageKeys";

const MIGRATION_FLAG = "tk_legacy_storage_migrated_v1";

type StoreKind = "local" | "session";

function storeOf(kind: StoreKind): Storage {
  return kind === "local" ? localStorage : sessionStorage;
}

/** Copy legacy flat key → namespaced key if legacy exists and target is empty. */
function migrateEntry(
  phone: string,
  role: Role,
  dataType: string,
  legacyKey: string,
  kind: StoreKind,
): void {
  try {
    const targetKey = storageKey(phone, role, dataType);
    const store = storeOf(kind);
    const legacy = store.getItem(legacyKey);
    if (!legacy || store.getItem(targetKey)) return;
    store.setItem(targetKey, legacy);
    store.removeItem(legacyKey);
  } catch {
    /* private mode / quota */
  }
}

const BROKER_LOCAL: Array<[string, string]> = [
  ["properties", "broker_properties"],
  ["tenants", "broker_tenants"],
  ["agreements", "broker_agreements"],
  ["profile", "broker_profile_v1"],
  ["agreement_draft", "broker_agreement_draft"],
];

const BROKER_SESSION: Array<[string, string]> = [
  ["properties", "broker_properties"],
  ["tenants", "broker_tenants"],
  ["agreements", "broker_agreements"],
  ["add_property_data", "broker_add_property_data"],
  ["add_tenant_draft", "broker_add_tenant_draft"],
  ["agreement_pending_property", "agreement_pending_property"],
  ["agreement_edit_draft", "agreement_edit_draft"],
  ["name", "broker_name"],
  ["firm", "broker_firm"],
  ["phone", "broker_phone"],
];

const OWNER_LOCAL: Array<[string, string]> = [
  ["onboarding_data", "trustkeyper_onboarding_data"],
  ["properties", "broker_properties"],
];

const OWNER_SESSION: Array<[string, string]> = [
  ["name", "owner_name"],
  ["phone", "owner_phone"],
  ["contact", "owner_contact"],
];

/**
 * Moves pre-namespaced flat keys into tk_{phone}_{role}_* for the given account.
 * Safe to call repeatedly; skips when target already has data.
 */
export function migrateLegacyStorage(phone: string, role: Role): void {
  if (!phone) return;

  const localPairs = role === "owner" ? OWNER_LOCAL : role === "broker" ? BROKER_LOCAL : [];
  const sessionPairs = role === "owner" ? OWNER_SESSION : role === "broker" ? BROKER_SESSION : [];

  for (const [dataType, legacyKey] of localPairs) {
    migrateEntry(phone, role, dataType, legacyKey, "local");
  }
  for (const [dataType, legacyKey] of sessionPairs) {
    migrateEntry(phone, role, dataType, legacyKey, "session");
  }
}

/** One-time global sweep when any legacy broker keys exist (helps mobile upgrades). */
export function migrateLegacyStorageGlobal(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(MIGRATION_FLAG) === "1") return;
    const hasLegacy =
      localStorage.getItem("broker_properties") !== null ||
      localStorage.getItem("broker_profile_v1") !== null ||
      localStorage.getItem("trustkeyper_onboarding_data") !== null;
    if (!hasLegacy) {
      localStorage.setItem(MIGRATION_FLAG, "1");
      return;
    }

    const phone =
      sessionStorage.getItem("tk_active_phone") ||
      localStorage.getItem("tk_session_backup_phone") ||
      "";
    const role = (sessionStorage.getItem("tk_active_role") ||
      localStorage.getItem("tk_session_backup_role") ||
      "broker") as Role;

    if (phone) {
      migrateLegacyStorage(phone, role);
      if (role !== "owner") migrateLegacyStorage(phone, "owner");
      if (role !== "broker") migrateLegacyStorage(phone, "broker");
    }

    localStorage.setItem(MIGRATION_FLAG, "1");
  } catch {
    /* ignore */
  }
}
