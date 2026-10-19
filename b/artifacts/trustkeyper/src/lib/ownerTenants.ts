import type { TenantDocumentUploadStatus } from "@workspace/tenant-document-upload";
import type { Food, TenantWho } from "@/lib/tenants";
import { queueCloudSync } from "@/lib/cloudSync";
import type { Property } from "@/lib/properties";
import type { PropertyShareSource } from "@/lib/propertyShareView";
import { getItem, getSessionItem, setItem, setSessionItem } from "@/lib/storageKeys";

export type InquiryStatus = "open" | "invited";

/** Lead status for property-share inquiries on the owner Inquiries tab. */
export type PropertyInquiryLeadStatus = "new" | "contacted" | "converted" | "rejected";

/** Set only when the owner manually records an outcome. */
export type RecordedInviteStatus = "accepted" | "rejected";

export interface OwnerTenantInquiry {
  id: string;
  name: string;
  phone: string;
  propertyId: string;
  propertyLabel: string;
  who?: TenantWho;
  food?: Food;
  linkedinUrl?: string;
  status: InquiryStatus;
  /** Property share link inquiries use leadStatus; legacy rows default to "new". */
  leadStatus?: PropertyInquiryLeadStatus;
  source?: "property_share" | "manual";
  /** Who shared the property link — broker or owner. */
  sharedBy?: PropertyShareSource;
  createdAt: number;
  updatedAt?: number;
}

export interface OwnerTenantInvite {
  id: string;
  propertyId: string;
  propertyLabel: string;
  name: string;
  phone: string;
  who?: TenantWho;
  food?: Food;
  monthlyRent: string;
  maintenanceIncluded: boolean;
  monthlyMaintenance: string;
  securityDeposit: string;
  startDate: string;
  /** Legacy values are normalized on read; new invites omit status until marked. */
  status?: RecordedInviteStatus | "pending" | "pending_confirmation" | "declined" | "expired";
  inquiryId?: string;
  linkedinUrl?: string;
  createdAt: number;
  acceptedAt?: number;
  rejectedAt?: number;
  documentUploadStatus?: TenantDocumentUploadStatus;
  documentUploadToken?: string;
  documentUploadSubmittedAt?: number;
}

export interface SendTenantInvitePayload {
  propertyId: string;
  propertyLabel: string;
  members: Array<{
    name: string;
    phone: string;
    who?: TenantWho;
    food?: Food;
    inquiryId?: string;
  }>;
  monthlyRent: string;
  maintenanceIncluded: boolean;
  monthlyMaintenance: string;
  securityDeposit: string;
  startDate: string;
}

const INQUIRIES_KEY = "owner_tenant_inquiries";
const BROKER_INQUIRIES_KEY = "broker_property_inquiries";
const INVITES_KEY = "owner_tenant_invites";
const DECLINES_KEY = "tenant_property_declines";
export const OWNER_INVITES_UPDATED_EVENT = "tk-owner-invites-updated";
export const OWNER_INQUIRIES_UPDATED_EVENT = "tk-owner-inquiries-updated";
export const BROKER_INQUIRIES_UPDATED_EVENT = "tk-broker-inquiries-updated";

function readJson<T>(dataType: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = getSessionItem(dataType) ?? getItem(dataType);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function phoneLast10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function normalizeInquiry(raw: Partial<OwnerTenantInquiry> & { id: string }): OwnerTenantInquiry {
  return {
    id: raw.id,
    name: raw.name ?? "",
    phone: raw.phone ?? "",
    propertyId: raw.propertyId ?? "",
    propertyLabel: raw.propertyLabel ?? "",
    who: raw.who,
    food: raw.food,
    linkedinUrl: raw.linkedinUrl,
    status: raw.status === "invited" ? "invited" : "open",
    leadStatus: raw.leadStatus ?? "new",
    source: raw.source,
    sharedBy: raw.sharedBy,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: raw.updatedAt,
  };
}

function inquiriesKeyForRole(role: PropertyShareSource): string {
  return role === "broker" ? BROKER_INQUIRIES_KEY : INQUIRIES_KEY;
}

function readInquiriesForRole(role: PropertyShareSource): OwnerTenantInquiry[] {
  const key = inquiriesKeyForRole(role);
  return readJson<OwnerTenantInquiry>(key).map((row) =>
    normalizeInquiry(row as Partial<OwnerTenantInquiry> & { id: string }),
  );
}

function persist(dataType: string, list: unknown[]): void {
  try {
    const payload = JSON.stringify(list);
    setSessionItem(dataType, payload);
    setItem(dataType, payload);
    queueCloudSync(dataType, payload);
    if (typeof window === "undefined") return;
    if (dataType === INVITES_KEY) {
      window.dispatchEvent(new Event(OWNER_INVITES_UPDATED_EVENT));
    }
    if (dataType === INQUIRIES_KEY) {
      window.dispatchEvent(new Event(OWNER_INQUIRIES_UPDATED_EVENT));
    }
    if (dataType === BROKER_INQUIRIES_KEY) {
      window.dispatchEvent(new Event(BROKER_INQUIRIES_UPDATED_EVENT));
    }
  } catch {
    /* ignore */
  }
}

/** Returns a manual outcome badge only after the owner updates status. */
export function getRecordedInviteStatus(
  invite: OwnerTenantInvite,
): RecordedInviteStatus | null {
  if (invite.status === "accepted") return "accepted";
  if (invite.status === "rejected" || invite.status === "declined") return "rejected";
  return null;
}

export function getPropertyInviteLabel(p: Property): string {
  const title = p.nickname || p.address || "Property";
  const loc = [p.area, p.city].filter(Boolean).join(", ");
  return loc ? `${title}, ${loc}` : title;
}

export function removeLegacySeedInquiries(): void {
  const list = readJson<OwnerTenantInquiry>(INQUIRIES_KEY);
  const cleaned = list.filter((i) => !i.id.startsWith("inq_seed_"));
  if (cleaned.length !== list.length) {
    persist(INQUIRIES_KEY, cleaned);
  }
}

export function getOwnerInquiries(): OwnerTenantInquiry[] {
  return readJson<OwnerTenantInquiry>(INQUIRIES_KEY).map((row) =>
    normalizeInquiry(row as Partial<OwnerTenantInquiry> & { id: string }),
  );
}

/** Property-share inquiries for the owner Inquiries tab (newest first). */
export function getPropertyShareInquiries(): OwnerTenantInquiry[] {
  return getOwnerInquiries()
    .filter(
      (i) =>
        i.source === "property_share" &&
        i.status === "open" &&
        i.leadStatus !== "rejected" &&
        (i.sharedBy === "owner" || !i.sharedBy),
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Property-share inquiries for the broker Tenants → Inquiries tab (newest first). */
export function getBrokerPropertyShareInquiries(): OwnerTenantInquiry[] {
  return readInquiriesForRole("broker")
    .filter(
      (i) =>
        i.source === "property_share" &&
        i.status === "open" &&
        i.leadStatus !== "rejected",
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function findOpenPropertyShareInquiry(
  propertyId: string,
  phone: string,
): OwnerTenantInquiry | undefined {
  const digits = phoneLast10(phone);
  return getOwnerInquiries().find(
    (i) =>
      i.propertyId === propertyId &&
      phoneLast10(i.phone) === digits &&
      i.source === "property_share" &&
      i.status === "open" &&
      i.leadStatus !== "rejected",
  );
}

export function createPropertyShareInquiry(input: {
  name: string;
  phone: string;
  propertyId: string;
  propertyLabel: string;
  sharedBy?: PropertyShareSource;
}): { inquiry: OwnerTenantInquiry; isDuplicate: boolean } {
  const sharedBy = input.sharedBy ?? "owner";
  const list =
    sharedBy === "broker" ? readInquiriesForRole("broker") : getOwnerInquiries();
  const digits = phoneLast10(input.phone);
  const existing = list.find(
    (i) =>
      i.propertyId === input.propertyId &&
      phoneLast10(i.phone) === digits &&
      i.source === "property_share" &&
      i.status === "open" &&
      i.leadStatus !== "rejected",
  );
  if (existing) {
    return { inquiry: existing, isDuplicate: true };
  }

  const inquiry: OwnerTenantInquiry = {
    id: `inq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim(),
    phone: formatMemberContact(digits),
    propertyId: input.propertyId,
    propertyLabel: input.propertyLabel,
    status: "open",
    leadStatus: "new",
    source: "property_share",
    sharedBy,
    createdAt: Date.now(),
  };
  list.unshift(inquiry);
  persist(inquiriesKeyForRole(sharedBy), list);
  return { inquiry, isDuplicate: false };
}

export function updatePropertyInquiryLeadStatus(
  inquiryId: string,
  leadStatus: PropertyInquiryLeadStatus,
  role: PropertyShareSource = "owner",
): OwnerTenantInquiry | null {
  const key = inquiriesKeyForRole(role);
  const list = readInquiriesForRole(role);
  const idx = list.findIndex((i) => i.id === inquiryId);
  if (idx === -1) return null;
  list[idx] = {
    ...list[idx],
    leadStatus,
    updatedAt: Date.now(),
    status: leadStatus === "converted" ? "invited" : list[idx].status,
  };
  persist(key, list);
  return list[idx];
}

export function recordPropertyNotInterested(input: {
  name: string;
  phone: string;
  propertyId: string;
}): void {
  try {
    const raw = getSessionItem(DECLINES_KEY) ?? getItem(DECLINES_KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    list.unshift({
      ...input,
      phone: formatMemberContact(phoneLast10(input.phone)),
      createdAt: Date.now(),
    });
    const payload = JSON.stringify(list.slice(0, 200));
    setSessionItem(DECLINES_KEY, payload);
    setItem(DECLINES_KEY, payload);
    queueCloudSync(DECLINES_KEY, payload);
  } catch {
    /* ignore */
  }
}

export function getOpenInquiriesForProperty(propertyId: string): OwnerTenantInquiry[] {
  return getOwnerInquiries().filter((i) => i.propertyId === propertyId && i.status === "open");
}

export function getOwnerInvites(): OwnerTenantInvite[] {
  return readJson<OwnerTenantInvite>(INVITES_KEY);
}

export function sendOwnerTenantInvites(payload: SendTenantInvitePayload): OwnerTenantInvite[] {
  const inquiries = getOwnerInquiries();
  const invites = getOwnerInvites();
  const created: OwnerTenantInvite[] = [];

  for (const member of payload.members) {
    const invite: OwnerTenantInvite = {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      propertyId: payload.propertyId,
      propertyLabel: payload.propertyLabel,
      name: member.name,
      phone: member.phone,
      who: member.who,
      food: member.food,
      monthlyRent: payload.monthlyRent,
      maintenanceIncluded: payload.maintenanceIncluded,
      monthlyMaintenance: payload.monthlyMaintenance,
      securityDeposit: payload.securityDeposit,
      startDate: payload.startDate,
      inquiryId: member.inquiryId,
      createdAt: Date.now(),
    };
    created.push(invite);
    invites.unshift(invite);

    if (member.inquiryId) {
      const idx = inquiries.findIndex((i) => i.id === member.inquiryId);
      if (idx !== -1) {
        const inq = inquiries[idx];
        invite.linkedinUrl = inq.linkedinUrl;
        inquiries[idx] = { ...inq, status: "invited" };
      }
    }
  }

  persist(INQUIRIES_KEY, inquiries);
  persist(INVITES_KEY, invites);
  return created;
}

export function updateOwnerInviteStatus(
  inviteId: string,
  status: RecordedInviteStatus,
): OwnerTenantInvite | null {
  const invites = getOwnerInvites();
  const idx = invites.findIndex((i) => i.id === inviteId);
  if (idx === -1) return null;

  const now = Date.now();
  const updated: OwnerTenantInvite = {
    ...invites[idx],
    status,
    acceptedAt: status === "accepted" ? now : invites[idx].acceptedAt,
    rejectedAt: status === "rejected" ? now : invites[idx].rejectedAt,
  };
  invites[idx] = updated;
  persist(INVITES_KEY, invites);
  return updated;
}

export function deleteOwnerInvite(inviteId: string): boolean {
  const invites = getOwnerInvites();
  const next = invites.filter((i) => i.id !== inviteId);
  if (next.length === invites.length) return false;
  persist(INVITES_KEY, next);
  return true;
}

export function syncOwnerInviteDocumentUploadStatus(
  tenantPhone: string,
  status: TenantDocumentUploadStatus,
  options?: { token?: string; submittedAt?: number },
): void {
  const digits = tenantPhone.replace(/\D/g, "").slice(-10);
  const invites = getOwnerInvites();
  let changed = false;
  const next = invites.map((invite) => {
    if (invite.phone.replace(/\D/g, "").slice(-10) !== digits) return invite;
    changed = true;
    return {
      ...invite,
      documentUploadStatus: status,
      documentUploadToken: options?.token ?? invite.documentUploadToken,
      documentUploadSubmittedAt: options?.submittedAt ?? invite.documentUploadSubmittedAt,
    };
  });
  if (changed) persist(INVITES_KEY, next);
}

export function formatMemberContact(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    return `+91 ${last10}`;
  }
  return phone;
}

export function formatInviteAmount(value: string): string {
  const n = value.replace(/\D/g, "");
  if (!n) return "0";
  return Number(n).toLocaleString("en-IN");
}

export function formatInviteStartDate(isoOrDate: string): string {
  if (!isoOrDate) return "—";
  try {
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return isoOrDate;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoOrDate;
  }
}

function maintenanceLine(invite: OwnerTenantInvite): string {
  if (invite.maintenanceIncluded) return "Included in rent";
  const amt = formatInviteAmount(invite.monthlyMaintenance);
  return amt === "0" ? "—" : `₹${amt}/month`;
}

export function buildWhatsAppInviteMessage(invite: OwnerTenantInvite): string {
  return (
    `Hello ${invite.name.trim() || "there"},\n\n` +
    `You have been invited to join the following property:\n\n` +
    `Property: ${invite.propertyLabel}\n` +
    `Monthly Rent: ₹${formatInviteAmount(invite.monthlyRent)}\n` +
    `Maintenance: ${maintenanceLine(invite)}\n` +
    `Security Deposit: ₹${formatInviteAmount(invite.securityDeposit)}\n` +
    `Start Date: ${formatInviteStartDate(invite.startDate)}\n\n` +
    `Please let me know if you are interested.\n\n` +
    `Sent via TrustKeyper.`
  );
}

export function openWhatsAppInvite(invite: OwnerTenantInvite): void {
  if (typeof window === "undefined") return;
  window.open(getWhatsAppInviteHref(invite), "_blank", "noopener,noreferrer");
}

export function whatsAppInviteHref(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return "https://wa.me/";
  return `https://wa.me/91${digits}?text=${encodeURIComponent(message)}`;
}

export function getWhatsAppInviteHref(invite: OwnerTenantInvite): string {
  return whatsAppInviteHref(invite.phone, buildWhatsAppInviteMessage(invite));
}

export function getInquiryWhatsAppHref(inquiry: OwnerTenantInquiry): string {
  const message =
    `Hello ${inquiry.name.trim() || "there"},\n\n` +
    `Thank you for your interest in ${inquiry.propertyLabel}. I would like to discuss this property with you.\n\n` +
    `Sent via TrustKeyper.`;
  return whatsAppInviteHref(inquiry.phone, message);
}

export function isInviteFromInquiry(invite: OwnerTenantInvite): boolean {
  return !!invite.inquiryId;
}

export function countRecordedInvites(invites: OwnerTenantInvite[]) {
  let accepted = 0;
  let rejected = 0;
  for (const inv of invites) {
    const s = getRecordedInviteStatus(inv);
    if (s === "accepted") accepted += 1;
    if (s === "rejected") rejected += 1;
  }
  return { accepted, rejected };
}
