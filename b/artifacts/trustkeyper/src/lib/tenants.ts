import type { TenantDocumentUploadStatus } from "@workspace/tenant-document-upload";
import { markInviteConverted } from "./brokerTenantOnboarding";
import { queueCloudSync } from "./cloudSync";
import { registerTenantLeadPhoneClaimLocally } from "./tenantPhoneRules";
import { getItem, getSessionItem, setItem, setSessionItem } from "./storageKeys";

export type TenantWho = "Family" | "Bachelor";
export type Identify = "Male" | "Female";
export type Food = "Veg" | "Non-Veg";
export type PropertyType =
  | "Apartment"
  | "House"
  | "Studio"
  | "Villa"
  | "PG/Hostel"
  | "Other";
export type Sharing = "Single" | "Double" | "Triple" | "Entire Property";
export type Roommate = "Male" | "Female" | "Anyone";

export interface TenantProfile {
  aadhaar?: string;
  pan?: string;
}

export type LeadStatus =
  | "New Lead"
  | "Contacted"
  | "Property Shared"
  | "Site Visit Scheduled"
  | "Converted"
  | "Closed";

export type TenantLeadSource = "manual" | "broker_onboarding_link" | "property_share";

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  profile?: TenantProfile;
  linkedinUrl?: string;
  occupancyFrom?: string;
  who?: TenantWho | string;
  whoOther?: string;
  identify?: Identify[] | string[];
  food?: Food | string;
  city?: string;
  localities?: string[];
  propertyType?: PropertyType | string;
  propertyTypeOther?: string;
  sharing?: Sharing | string;
  roommate?: Roommate[] | string[];
  status: "Lead Added" | "Profile Complete";
  invitationSent: boolean;
  detailsComplete: boolean;
  leadStatus?: LeadStatus;
  source?: TenantLeadSource;
  onboardingToken?: string;
  submittedAt?: number;
  documentUploadStatus?: TenantDocumentUploadStatus;
  documentUploadToken?: string;
  documentUploadSubmittedAt?: number;
  createdAt: number;
}

function readTenantsJson(): string | null {
  if (typeof window === "undefined") return null;
  return getSessionItem("tenants") ?? getItem("tenants");
}

function persistTenantList(list: Tenant[]): void {
  try {
    const payload = JSON.stringify(list);
    setSessionItem("tenants", payload);
    setItem("tenants", payload);
    queueCloudSync("tenants", payload);
  } catch {
    /* ignore */
  }
}

export function getTenants(): Tenant[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = readTenantsJson();
    return raw ? (JSON.parse(raw) as Tenant[]) : [];
  } catch {
    return [];
  }
}

export function addTenant(
  t: Omit<Tenant, "id" | "createdAt" | "status" | "invitationSent" | "detailsComplete"> & {
    invitationSent?: boolean;
    detailsComplete?: boolean;
  },
): Tenant {
  const { invitationSent = false, detailsComplete = false, ...rest } = t;
  const tenant: Tenant = {
    ...rest,
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    status: detailsComplete ? "Profile Complete" : "Lead Added",
    invitationSent,
    detailsComplete,
  };
  const list = getTenants();
  list.unshift(tenant);
  persistTenantList(list);
  const leadSource = rest.source ?? "manual";
  if (leadSource === "manual") {
    registerTenantLeadPhoneClaimLocally(tenant, "manual");
  }
  return tenant;
}

export function getTenantById(id: string): Tenant | undefined {
  return getTenants().find((t) => t.id === id);
}

export function updateTenant(
  id: string,
  patch: Partial<Omit<Tenant, "id" | "createdAt">>,
): Tenant | null {
  const list = getTenants();
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const next: Tenant = { ...list[idx], ...patch };
  if ("detailsComplete" in patch) {
    next.status = next.detailsComplete ? "Profile Complete" : "Lead Added";
  }
  list[idx] = next;
  persistTenantList(list);
  if (patch.leadStatus === "Converted" && next.onboardingToken) {
    markInviteConverted(next.onboardingToken);
  }
  return next;
}

function phoneLast10(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.slice(-10);
}

/** Match tenant by last 10 digits of contact phone. */
export function findTenantByContact(contact: string): Tenant | undefined {
  const digits = phoneLast10(contact);
  if (digits.length !== 10) return undefined;
  return getTenants().find((t) => phoneLast10(t.phone) === digits);
}

export function resolveTenantKyc(contact: string): { aadhaar: string; pan: string } {
  const tenant = findTenantByContact(contact);
  return {
    aadhaar: tenant?.profile?.aadhaar?.trim() ?? "",
    pan: tenant?.profile?.pan?.trim() ?? "",
  };
}

/** Upsert tenant by phone when added from agreement flow so they appear under Tenants. */
export function ensureTenantFromAgreement(name: string, contact: string): void {
  const digits = phoneLast10(contact);
  if (digits.length !== 10 || !name.trim()) return;
  const phone = `+91${digits}`;
  const list = getTenants();
  const idx = list.findIndex((t) => phoneLast10(t.phone) === digits);
  if (idx !== -1) {
    list[idx] = { ...list[idx], name: name.trim() };
    persistTenantList(list);
    return;
  }
  addTenant({
    name: name.trim(),
    phone,
    invitationSent: false,
    detailsComplete: false,
  });
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export const CITY_LOCALITIES: Record<string, string[]> = {
  Hyderabad: [
    "Madhapur",
    "Gachibowli",
    "Hi-Tech City",
    "Kondapur",
    "Banjara Hills",
    "Jubilee Hills",
    "Kukatpally",
    "Begumpet",
  ],
  Bengaluru: [
    "Indiranagar",
    "Koramangala",
    "Whitefield",
    "HSR Layout",
    "Marathahalli",
    "Bellandur",
    "Jayanagar",
    "BTM Layout",
  ],
  Mumbai: [
    "Bandra",
    "Andheri",
    "Powai",
    "Lower Parel",
    "Worli",
    "Juhu",
    "Goregaon",
  ],
  Delhi: [
    "Saket",
    "Dwarka",
    "Rohini",
    "Karol Bagh",
    "Connaught Place",
    "Vasant Kunj",
  ],
  Pune: ["Hinjewadi", "Kothrud", "Baner", "Viman Nagar", "Wakad", "Kharadi"],
  Noida: ["Sector 62", "Sector 18", "Sector 78", "Sector 137", "Sector 50"],
};

export function buildBrokerTenantWhatsAppMessage(tenant: Pick<Tenant, "name">): string {
  return `Hello ${tenant.name.trim() || "there"},\n\nThis is your broker from TrustKeyper. Please let me know if you have any questions about your rental search.\n\nSent via TrustKeyper.`;
}

export function getBrokerTenantWhatsAppHref(tenant: Pick<Tenant, "name" | "phone">): string {
  const digits = tenant.phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return "https://wa.me/";
  return `https://wa.me/91${digits}?text=${encodeURIComponent(buildBrokerTenantWhatsAppMessage(tenant))}`;
}
