import { queueCloudSync, pushAccountKeyToCloud, BROKER_ONBOARD_TOKEN_PREFIX } from "./cloudSync";
import {
  BROKER_ONBOARDING_INVITES_UPDATED_EVENT,
  isActiveInviteStatus,
  normalizeStoredInviteStatus,
  notifyBrokerInvitesUpdated,
  resolveInviteStatus,
  type BrokerOnboardInviteStatus,
  type StoredBrokerOnboardInviteStatus,
} from "./brokerTenantInviteStatus";
import { getActiveSession, getItem, setItem } from "./storageKeys";
import { findTenantByContact, getTenants, type Tenant } from "./tenants";
import { findDuplicateTenantLead, getTenantPhoneConflict } from "./tenantPhoneRules";

export {
  findDuplicateTenantLead,
  getTenantPhoneConflict,
  registerTenantLeadPhoneClaimLocally,
  tenantPhoneConflictMessage,
} from "./tenantPhoneRules";

export { BROKER_ONBOARD_TOKEN_PREFIX, BROKER_ONBOARDING_INVITES_UPDATED_EVENT };
export {
  INVITE_STATUS_LABELS,
  inviteStatusBadgeClass,
  type BrokerOnboardInviteStatus,
} from "./brokerTenantInviteStatus";

export const BROKER_ONBOARDING_INVITES_KEY = "broker_tenant_onboarding_invites";

export const BROKER_ONBOARD_EXPIRY_DAYS = 14;

export interface BrokerTenantOnboardingInvite {
  id: string;
  token: string;
  tenantName: string;
  tenantPhone: string;
  brokerPhone: string;
  brokerName: string;
  inviteLink: string;
  status: StoredBrokerOnboardInviteStatus;
  createdAt: number;
  expiresAt: number;
  startedAt?: number;
  submittedAt?: number;
  convertedAt?: number;
  deletedAt?: number;
}

export interface BrokerOnboardTokenSnapshot {
  token: string;
  tenantName: string;
  tenantPhone: string;
  brokerPhone: string;
  brokerName: string;
  inviteLink?: string;
  status: StoredBrokerOnboardInviteStatus;
  createdAt: number;
  expiresAt: number;
  startedAt?: number;
  submittedAt?: number;
  convertedAt?: number;
}

function phoneLast10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function formatPhoneE164(phone: string): string {
  const digits = phoneLast10(phone);
  return digits.length === 10 ? `+91${digits}` : phone.trim();
}

function normalizeInviteRecord(
  invite: BrokerTenantOnboardingInvite,
): BrokerTenantOnboardingInvite {
  const inviteLink = invite.inviteLink || getTenantOnboardUrl(invite.token);
  return {
    ...invite,
    inviteLink,
    status: normalizeStoredInviteStatus(invite.status),
  };
}

function readInvites(): BrokerTenantOnboardingInvite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = getItem(BROKER_ONBOARDING_INVITES_KEY);
    const list = raw ? (JSON.parse(raw) as BrokerTenantOnboardingInvite[]) : [];
    return list.map(normalizeInviteRecord);
  } catch {
    return [];
  }
}

function persistInvites(list: BrokerTenantOnboardingInvite[]): void {
  const payload = JSON.stringify(list);
  setItem(BROKER_ONBOARDING_INVITES_KEY, payload);
  queueCloudSync(BROKER_ONBOARDING_INVITES_KEY, payload);
  notifyBrokerInvitesUpdated();
}

function onboardTokenKey(token: string): string {
  return `${BROKER_ONBOARD_TOKEN_PREFIX}${token}`;
}

function snapshotFromInvite(invite: BrokerTenantOnboardingInvite): BrokerOnboardTokenSnapshot {
  return {
    token: invite.token,
    tenantName: invite.tenantName,
    tenantPhone: invite.tenantPhone,
    brokerPhone: invite.brokerPhone,
    brokerName: invite.brokerName,
    inviteLink: invite.inviteLink,
    status: invite.status,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    startedAt: invite.startedAt,
    submittedAt: invite.submittedAt,
    convertedAt: invite.convertedAt,
  };
}

function updateInviteByToken(
  token: string,
  updater: (invite: BrokerTenantOnboardingInvite) => BrokerTenantOnboardingInvite,
): BrokerTenantOnboardingInvite | null {
  const list = readInvites();
  const idx = list.findIndex((inv) => inv.token === token && !inv.deletedAt);
  if (idx === -1) return null;
  const next = updater(list[idx]);
  list[idx] = next;
  persistInvites(list);

  const session = getActiveSession();
  if (session?.role === "broker") {
    const tokenPayload = JSON.stringify(snapshotFromInvite(next));
    setItem(onboardTokenKey(token), tokenPayload);
    void pushAccountKeyToCloud(session.phone, "broker", onboardTokenKey(token), tokenPayload);
  }

  return next;
}

export function isValidIndianMobile(phone: string): boolean {
  return phoneLast10(phone).length === 10;
}

export function getBrokerOnboardingInvites(): BrokerTenantOnboardingInvite[] {
  return readInvites().filter((inv) => !inv.deletedAt);
}

export function getBrokerOnboardingInvitesForBroker(
  brokerPhone: string,
): BrokerTenantOnboardingInvite[] {
  const digits = phoneLast10(brokerPhone);
  return getBrokerOnboardingInvites()
    .filter((inv) => phoneLast10(inv.brokerPhone) === digits)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getBrokerOnboardingInviteByToken(
  token: string,
): BrokerTenantOnboardingInvite | undefined {
  return getBrokerOnboardingInvites().find((inv) => inv.token === token);
}

export function getInviteResolvedStatus(
  invite: BrokerTenantOnboardingInvite,
): BrokerOnboardInviteStatus {
  return resolveInviteStatus(invite.status, invite.expiresAt, invite.deletedAt);
}

export function countActiveBrokerInvites(brokerPhone: string): number {
  return getBrokerOnboardingInvitesForBroker(brokerPhone).filter((inv) =>
    isActiveInviteStatus(getInviteResolvedStatus(inv)),
  ).length;
}

export function findPendingInviteByPhone(phone: string): BrokerTenantOnboardingInvite | undefined {
  const digits = phoneLast10(phone);
  return getBrokerOnboardingInvites().find((inv) => {
    if (phoneLast10(inv.tenantPhone) !== digits) return false;
    const status = getInviteResolvedStatus(inv);
    return isActiveInviteStatus(status);
  });
}

export function getTenantOnboardUrl(token: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  const path = `${normalized}/onboard/tenant/${token}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function buildBrokerTenantOnboardWhatsAppMessage(
  tenantName: string,
  link: string,
): string {
  const name = tenantName.trim() || "there";
  return [
    `Hi ${name},`,
    "",
    "Share your rental requirements with me through TrustKeyper so I can help you find properties that best match your needs.",
    "",
    link,
  ].join("\n");
}

export function buildBrokerTenantOnboardShareMessage(
  tenantName: string,
  link: string,
): string {
  return buildBrokerTenantOnboardWhatsAppMessage(tenantName, link);
}

export function formatTenantPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `+91 ${digits}` : phone;
}

export function formatInviteDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getBrokerTenantOnboardEmailHref(
  tenantName: string,
  link: string,
): string {
  const subject = encodeURIComponent("Complete your rental requirements on TrustKeyper");
  const body = encodeURIComponent(buildBrokerTenantOnboardShareMessage(tenantName, link));
  return `mailto:?subject=${subject}&body=${body}`;
}

export function getBrokerTenantOnboardSmsHref(
  tenantPhone: string,
  tenantName: string,
  link: string,
): string {
  const digits = phoneLast10(tenantPhone);
  const body = encodeURIComponent(buildBrokerTenantOnboardShareMessage(tenantName, link));
  if (digits.length === 10) {
    return `sms:+91${digits}?body=${body}`;
  }
  return `sms:?body=${body}`;
}

export function getBrokerTenantOnboardTelegramHref(
  tenantName: string,
  link: string,
): string {
  const text = encodeURIComponent(buildBrokerTenantOnboardShareMessage(tenantName, link));
  const url = encodeURIComponent(link);
  return `https://t.me/share/url?url=${url}&text=${text}`;
}

export function getBrokerTenantOnboardWhatsAppHref(
  tenantPhone: string,
  tenantName: string,
  link: string,
): string {
  const digits = phoneLast10(tenantPhone);
  const message = encodeURIComponent(buildBrokerTenantOnboardWhatsAppMessage(tenantName, link));
  if (digits.length === 10) {
    return `https://wa.me/91${digits}?text=${message}`;
  }
  return `https://wa.me/?text=${message}`;
}

function generateToken(): string {
  return `bt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type CreateBrokerOnboardInviteResult =
  | { ok: true; invite: BrokerTenantOnboardingInvite; link: string; whatsAppHref: string }
  | {
      ok: false;
      error:
        | "invalid_name"
        | "invalid_phone"
        | "duplicate_tenant"
        | "duplicate_tenant_account"
        | "duplicate_invite"
        | "no_session"
        | "unauthorized"
        | "server_error"
        | "network";
      detail?: string;
    };

export async function createBrokerTenantOnboardingInvite(
  tenantName: string,
  tenantPhone: string,
): Promise<CreateBrokerOnboardInviteResult> {
  const session = getActiveSession();
  if (!session || session.role !== "broker") {
    return { ok: false, error: "no_session" };
  }

  const name = tenantName.trim();
  const phone = formatPhoneE164(tenantPhone);
  if (name.length < 2) return { ok: false, error: "invalid_name" };
  if (!isValidIndianMobile(phone)) return { ok: false, error: "invalid_phone" };

  if (findDuplicateTenantLead(phone)) {
    return { ok: false, error: "duplicate_tenant" };
  }

  const tenantPhoneConflict = await getTenantPhoneConflict(phone);
  if (tenantPhoneConflict === "tenant_account") {
    return { ok: false, error: "duplicate_tenant_account" };
  }

  const pending = findPendingInviteByPhone(phone);
  if (pending) {
    return { ok: false, error: "duplicate_invite" };
  }

  const brokerName =
    (typeof window !== "undefined" && getItem("name")) ||
    session.phone;

  const serverResult = await (
    await import("./publicBrokerTenantOnboard")
  ).registerBrokerOnboardingInviteOnServer(
    session.phone,
    name,
    phone,
    brokerName.trim() || "Your broker",
  );

  if (serverResult.ok) {
    applyServerInviteLocally(serverResult.invite);
    return {
      ok: true,
      invite: serverResult.invite,
      link: serverResult.invite.inviteLink,
      whatsAppHref: getBrokerTenantOnboardWhatsAppHref(
        phone,
        name,
        serverResult.invite.inviteLink,
      ),
    };
  }

  if (serverResult.error !== "network") {
    return { ok: false, error: serverResult.error, detail: serverResult.detail };
  }

  if (import.meta.env.DEV) {
    return createBrokerTenantOnboardingInviteLocally(name, phone, session, brokerName);
  }

  return { ok: false, error: "server_error", detail: serverResult.detail };
}

function applyServerInviteLocally(invite: BrokerTenantOnboardingInvite): void {
  const normalized = normalizeInviteRecord(invite);
  const list = readInvites().filter((row) => row.token !== normalized.token);
  list.unshift(normalized);
  persistInvites(list);

  const tokenPayload = JSON.stringify(snapshotFromInvite(normalized));
  setItem(onboardTokenKey(normalized.token), tokenPayload);

  const session = getActiveSession();
  if (session?.role === "broker") {
    void pushAccountKeyToCloud(session.phone, "broker", onboardTokenKey(normalized.token), tokenPayload);
  }
}

function createBrokerTenantOnboardingInviteLocally(
  name: string,
  phone: string,
  session: { phone: string; role: string },
  brokerName: string,
): CreateBrokerOnboardInviteResult {
  const now = Date.now();
  const token = generateToken();
  const link = getTenantOnboardUrl(token);
  const invite: BrokerTenantOnboardingInvite = {
    id: `btoi_${now}_${Math.random().toString(36).slice(2, 7)}`,
    token,
    tenantName: name,
    tenantPhone: phone,
    brokerPhone: session.phone,
    brokerName: brokerName.trim() || "Your broker",
    inviteLink: link,
    status: "onboarding_pending",
    createdAt: now,
    expiresAt: now + BROKER_ONBOARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };

  const list = readInvites();
  list.unshift(invite);
  persistInvites(list);

  const tokenPayload = JSON.stringify(snapshotFromInvite(invite));
  setItem(onboardTokenKey(invite.token), tokenPayload);
  void pushAccountKeyToCloud(session.phone, "broker", onboardTokenKey(invite.token), tokenPayload);
  void pushAccountKeyToCloud(
    session.phone,
    "broker",
    BROKER_ONBOARDING_INVITES_KEY,
    JSON.stringify(list),
  );

  return {
    ok: true,
    invite,
    link,
    whatsAppHref: getBrokerTenantOnboardWhatsAppHref(phone, name, link),
  };
}

export function markInviteStartedLocally(token: string): void {
  updateInviteByToken(token, (invite) => {
    const resolved = getInviteResolvedStatus(invite);
    if (!isActiveInviteStatus(resolved) || resolved === "onboarding_started") {
      return invite;
    }
    return {
      ...invite,
      status: "onboarding_started",
      startedAt: invite.startedAt ?? Date.now(),
    };
  });
}

export function markInviteSubmittedLocally(token: string): void {
  updateInviteByToken(token, (invite) => ({
    ...invite,
    status: "requirements_submitted",
    submittedAt: Date.now(),
  }));
}

export function markInviteConverted(token: string): void {
  updateInviteByToken(token, (invite) => ({
    ...invite,
    status: "converted",
    convertedAt: Date.now(),
  }));
}

export function softDeleteBrokerInvite(inviteId: string): boolean {
  const list = readInvites();
  const idx = list.findIndex((inv) => inv.id === inviteId);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], deletedAt: Date.now() };
  persistInvites(list);
  return true;
}
