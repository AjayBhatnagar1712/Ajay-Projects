import {
  assertTenantPhoneAvailable,
  registerTenantLeadPhoneClaim,
  type TenantPhoneConflict,
} from "./tenantPhoneUniqueness.js";

export {
  assertTenantPhoneAvailable,
  findBrokerTenantLeadByPhone,
  findGlobalTenantLeadClaim,
  registerTenantLeadPhoneClaim,
  tenantLeadPhoneDataKey,
  TENANT_LEAD_PHONE_PREFIX,
  type TenantPhoneConflict,
  type TenantPhoneRegistryEntry,
  type TenantPhoneUniquenessStore,
} from "./tenantPhoneUniqueness.js";

export type OnboardRequest = {
  method: string;
  query: Record<string, string | string[] | undefined>;
  body: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

export type OnboardResponse = {
  status(code: number): OnboardResponse;
  setHeader(name: string, value: string | string[]): OnboardResponse;
  end(body: string): void;
};

export type OnboardStore = {
  findEntryByDataKey: (
    dataKey: string,
  ) => Promise<{ phone: string; role: string; value: string } | null>;
  getAccountData: (phone: string, role: string) => Promise<Record<string, string>>;
  setAccountDataKey: (phone: string, role: string, dataKey: string, value: string) => Promise<void>;
  accountHasProfile?: (phone: string, role: string) => Promise<boolean>;
};

type BrokerOnboardInviteStatus =
  | "pending"
  | "onboarding_pending"
  | "onboarding_started"
  | "submitted"
  | "requirements_submitted"
  | "converted"
  | "expired";

type BrokerOnboardTokenSnapshot = {
  token: string;
  tenantName: string;
  tenantPhone: string;
  brokerPhone: string;
  brokerName: string;
  inviteLink?: string;
  status: BrokerOnboardInviteStatus;
  createdAt: number;
  expiresAt: number;
  startedAt?: number;
  submittedAt?: number;
  convertedAt?: number;
};

type BrokerTenantOnboardingInvite = BrokerOnboardTokenSnapshot & { id: string };

type InviteRow = BrokerTenantOnboardingInvite & { deletedAt?: number };

type StoredTenant = {
  id: string;
  name: string;
  phone: string;
  linkedinUrl?: string;
  occupancyFrom?: string;
  who?: string;
  whoOther?: string;
  identify?: string[];
  food?: string;
  city?: string;
  localities?: string[];
  propertyType?: string;
  propertyTypeOther?: string;
  sharing?: string;
  roommate?: string[];
  status: "Lead Added" | "Profile Complete";
  invitationSent: boolean;
  detailsComplete: boolean;
  leadStatus?: string;
  source?: string;
  onboardingToken?: string;
  submittedAt?: number;
  createdAt: number;
};

type SubmitBody = {
  name?: string;
  phone?: string;
  linkedinUrl?: string;
  occupancyFrom?: string;
  who?: string;
  whoOther?: string;
  identify?: string[];
  food?: string;
  city?: string;
  localities?: string[];
  propertyType?: string;
  propertyTypeOther?: string;
  sharing?: string;
  roommate?: string[];
  detailsComplete?: boolean;
};

const MOVE_IN_TIMELINES = new Set([
  "Immediately",
  "Within 15 Days",
  "Within 1 Month",
  "Flexible",
]);

const OCCUPANCY_TYPES = new Set([
  "Bachelor",
  "Family",
  "Couple",
  "Working Professionals",
  "Students",
  "Other",
]);

const FOOD_PREFERENCES = new Set(["Vegetarian", "Non Vegetarian", "Any", "Veg", "Non-Veg"]);

const SHARING_PREFERENCES = new Set([
  "Single Occupancy",
  "Double Sharing",
  "Triple Sharing",
  "No Preference",
  "Single",
  "Double",
  "Triple",
  "Entire Property",
]);

const PROPERTY_TYPES = new Set([
  "Apartment",
  "Independent House",
  "Villa",
  "Studio",
  "PG",
  "Shared Accommodation",
  "Other",
  "House",
  "PG/Hostel",
]);

function requiresBachelorGender(who: string): boolean {
  return who === "Bachelor";
}

function requiresOccupancyOther(who: string): boolean {
  return who === "Other";
}

function requiresRoommateGender(sharing: string): boolean {
  return sharing === "Double Sharing" || sharing === "Triple Sharing" || sharing === "Double" || sharing === "Triple";
}

function requiresPropertyTypeOther(propertyType: string): boolean {
  return propertyType === "Other";
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function onboardPathSegments(req: OnboardRequest): string[] {
  const raw = req.query.onboardPath ?? req.query.path;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.length > 0) return raw.split("/").filter(Boolean);
  return [];
}

function phoneLast10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function tokenDataKey(token: string): string {
  return `broker_tenant_onboard_${token}`;
}

export function json(res: OnboardResponse, status: number, body: unknown): void {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function readJsonBody(req: OnboardRequest): unknown {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}

function resolveInviteStatus(snapshot: BrokerOnboardTokenSnapshot): BrokerOnboardInviteStatus {
  if (snapshot.status === "submitted" || snapshot.status === "requirements_submitted") {
    return "requirements_submitted";
  }
  if (snapshot.status === "converted") return "converted";
  if (snapshot.expiresAt <= Date.now()) return "expired";
  if (snapshot.status === "onboarding_started") return "onboarding_started";
  if (snapshot.status === "onboarding_pending" || snapshot.status === "pending") {
    return "onboarding_pending";
  }
  return snapshot.status;
}

function isSubmittedStatus(status: BrokerOnboardInviteStatus): boolean {
  return status === "submitted" || status === "requirements_submitted";
}

async function updateInviteListStatus(
  store: OnboardStore,
  brokerPhone: string,
  token: string,
  patch: Partial<BrokerTenantOnboardingInvite>,
): Promise<void> {
  const data = await store.getAccountData(brokerPhone, "broker");
  const raw = data["broker_tenant_onboarding_invites"];
  if (!raw) return;
  try {
    const list = JSON.parse(raw) as BrokerTenantOnboardingInvite[];
    if (!Array.isArray(list)) return;
    const updated = list.map((inv) => (inv.token === token ? { ...inv, ...patch } : inv));
    await store.setAccountDataKey(
      brokerPhone,
      "broker",
      "broker_tenant_onboarding_invites",
      JSON.stringify(updated),
    );
  } catch {
    /* ignore malformed invites list */
  }
}

async function markInviteStarted(
  store: OnboardStore,
  brokerPhone: string,
  token: string,
  snapshot: BrokerOnboardTokenSnapshot,
): Promise<BrokerOnboardTokenSnapshot> {
  if (
    snapshot.status === "onboarding_started" ||
    isSubmittedStatus(snapshot.status) ||
    snapshot.status === "converted"
  ) {
    return snapshot;
  }

  const now = Date.now();
  const nextSnapshot: BrokerOnboardTokenSnapshot = {
    ...snapshot,
    status: "onboarding_started",
    startedAt: snapshot.startedAt ?? now,
  };
  await store.setAccountDataKey(
    brokerPhone,
    "broker",
    tokenDataKey(token),
    JSON.stringify(nextSnapshot),
  );
  await updateInviteListStatus(store, brokerPhone, token, {
    status: "onboarding_started",
    startedAt: nextSnapshot.startedAt,
  });
  return nextSnapshot;
}

async function loadTokenSnapshot(
  store: OnboardStore,
  token: string,
): Promise<{
  snapshot: BrokerOnboardTokenSnapshot;
  brokerPhone: string;
} | null> {
  const entry = await store.findEntryByDataKey(tokenDataKey(token));
  if (!entry) return null;

  try {
    const snapshot = JSON.parse(entry.value) as BrokerOnboardTokenSnapshot;
    if (snapshot.token !== token) return null;
    return { snapshot, brokerPhone: entry.phone };
  } catch {
    return null;
  }
}

async function markInviteSubmitted(
  store: OnboardStore,
  brokerPhone: string,
  token: string,
  snapshot: BrokerOnboardTokenSnapshot,
): Promise<void> {
  const now = Date.now();
  const nextSnapshot: BrokerOnboardTokenSnapshot = {
    ...snapshot,
    status: "requirements_submitted",
    submittedAt: now,
  };
  await store.setAccountDataKey(
    brokerPhone,
    "broker",
    tokenDataKey(token),
    JSON.stringify(nextSnapshot),
  );

  const data = await store.getAccountData(brokerPhone, "broker");
  const raw = data["broker_tenant_onboarding_invites"];
  if (!raw) return;
  try {
    const list = JSON.parse(raw) as BrokerTenantOnboardingInvite[];
    if (!Array.isArray(list)) return;
    const updated = list.map((inv) =>
      inv.token === token
        ? { ...inv, status: "requirements_submitted" as const, submittedAt: now }
        : inv,
    );
    await store.setAccountDataKey(
      brokerPhone,
      "broker",
      "broker_tenant_onboarding_invites",
      JSON.stringify(updated),
    );
  } catch {
    /* ignore malformed invites list */
  }
}

export class TenantPhoneUnavailableError extends Error {
  readonly code: TenantPhoneConflict;

  constructor(code: TenantPhoneConflict) {
    super(code);
    this.name = "TenantPhoneUnavailableError";
    this.code = code;
  }
}

async function appendBrokerTenantLead(
  store: OnboardStore,
  brokerPhone: string,
  token: string,
  body: SubmitBody,
): Promise<{ tenant: StoredTenant; isDuplicate: boolean }> {
  const data = await store.getAccountData(brokerPhone, "broker");
  const raw = data.tenants;
  const list: StoredTenant[] = raw ? (JSON.parse(raw) as StoredTenant[]) : [];
  const digits = phoneLast10(body.phone ?? "");
  const existing = list.find(
    (row) =>
      phoneLast10(row.phone) === digits &&
      row.onboardingToken === token &&
      row.source === "broker_onboarding_link",
  );
  if (existing) {
    return { tenant: existing, isDuplicate: true };
  }

  const conflict = await assertTenantPhoneAvailable(store, brokerPhone, digits);
  if (conflict) {
    throw new TenantPhoneUnavailableError(conflict);
  }

  const now = Date.now();
  const detailsComplete = body.detailsComplete === true;
  const tenant: StoredTenant = {
    id: `t_${now}_${Math.random().toString(36).slice(2, 7)}`,
    name: (body.name ?? "").trim(),
    phone: body.phone ?? "",
    linkedinUrl: body.linkedinUrl?.trim() || undefined,
    occupancyFrom: body.occupancyFrom,
    who: body.who,
    whoOther: body.whoOther?.trim() || undefined,
    identify: body.identify,
    food: body.food,
    city: body.city,
    localities: body.localities,
    propertyType: body.propertyType,
    propertyTypeOther: body.propertyTypeOther?.trim() || undefined,
    sharing: body.sharing,
    roommate: body.roommate,
    status: detailsComplete ? "Profile Complete" : "Lead Added",
    invitationSent: true,
    detailsComplete,
    leadStatus: "New Lead",
    source: "broker_onboarding_link",
    onboardingToken: token,
    submittedAt: now,
    createdAt: now,
  };

  list.unshift(tenant);
  await store.setAccountDataKey(brokerPhone, "broker", "tenants", JSON.stringify(list));
  await registerTenantLeadPhoneClaim(store, brokerPhone, digits, {
    tenantId: tenant.id,
    tenantName: tenant.name,
    brokerPhone,
    source: "broker_onboarding_link",
  });
  return { tenant, isDuplicate: false };
}

function validateSubmitBody(body: SubmitBody): string | null {
  const name = (body.name ?? "").trim();
  const phone = phoneLast10(body.phone ?? "");
  if (name.length < 2) return "Name is required";
  if (phone.length !== 10) return "Valid phone number is required";
  if (!(body.linkedinUrl ?? "").trim()) return "LinkedIn profile is required";

  const timeline = (body.occupancyFrom ?? "").trim();
  if (!timeline) return "Move-in timeline is required";
  if (!MOVE_IN_TIMELINES.has(timeline) && !isIsoDate(timeline)) {
    return "Move-in timeline is required";
  }

  const who = (body.who ?? "").trim();
  if (!OCCUPANCY_TYPES.has(who)) return "Occupancy type is required";
  if (requiresOccupancyOther(who) && !(body.whoOther ?? "").trim()) {
    return "Please describe who will be staying";
  }
  if (requiresBachelorGender(who)) {
    const gender = body.identify?.[0];
    if (gender !== "Male" && gender !== "Female") {
      return "Gender is required for bachelors";
    }
  }

  const food = (body.food ?? "").trim();
  if (!FOOD_PREFERENCES.has(food)) return "Food preference is required";

  if (body.detailsComplete !== false) {
    if (!body.city?.trim()) return "City is required";
    if (!body.localities || body.localities.length === 0) {
      return "At least one locality is required";
    }
    const propertyType = (body.propertyType ?? "").trim();
    if (!PROPERTY_TYPES.has(propertyType)) return "Property type is required";
    if (requiresPropertyTypeOther(propertyType) && !(body.propertyTypeOther ?? "").trim()) {
      return "Please specify the property type";
    }
    const sharing = (body.sharing ?? "").trim();
    if (!SHARING_PREFERENCES.has(sharing)) return "Sharing preference is required";
    if (requiresRoommateGender(sharing)) {
      const roommate = body.roommate?.[0];
      if (roommate !== "Male" && roommate !== "Female" && roommate !== "Anyone") {
        return "Preferred roommate gender is required";
      }
    }
  }
  return null;
}

const BROKER_ONBOARD_EXPIRY_DAYS = 14;
const BROKER_ONBOARDING_INVITES_KEY = "broker_tenant_onboarding_invites";

function generateOnboardToken(): string {
  return `bt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isActiveInviteStatusForRegister(status: BrokerOnboardInviteStatus): boolean {
  return status === "onboarding_pending" || status === "onboarding_started";
}

function resolveInviteStatusForRegister(
  storedStatus: string,
  expiresAt: number,
): BrokerOnboardInviteStatus {
  if (storedStatus === "pending" || storedStatus === "onboarding_pending") {
    return "onboarding_pending";
  }
  if (storedStatus === "onboarding_started") return "onboarding_started";
  if (storedStatus === "submitted" || storedStatus === "requirements_submitted") {
    return "requirements_submitted";
  }
  if (storedStatus === "converted") return "converted";
  if (expiresAt <= Date.now()) return "expired";
  return "expired";
}

export type RegisterBrokerOnboardInviteInput = {
  brokerPhone: string;
  brokerName: string;
  tenantName: string;
  tenantPhone: string;
  origin: string;
};

export type RegisterBrokerOnboardInviteError =
  | "invalid_name"
  | "invalid_phone"
  | "duplicate_tenant"
  | "duplicate_tenant_account"
  | "duplicate_invite";

export type RegisterBrokerOnboardInviteResult =
  | {
      ok: true;
      invite: BrokerTenantOnboardingInvite & { inviteLink: string };
    }
  | { ok: false; error: RegisterBrokerOnboardInviteError };

export async function registerBrokerOnboardingInvite(
  store: OnboardStore,
  input: RegisterBrokerOnboardInviteInput,
): Promise<RegisterBrokerOnboardInviteResult> {
  const name = input.tenantName.trim();
  const phoneDigits = phoneLast10(input.tenantPhone);
  const brokerPhone = phoneLast10(input.brokerPhone);

  if (name.length < 2) return { ok: false, error: "invalid_name" };
  if (phoneDigits.length !== 10) return { ok: false, error: "invalid_phone" };

  const phoneConflict = await assertTenantPhoneAvailable(store, brokerPhone, phoneDigits);
  if (phoneConflict) return { ok: false, error: phoneConflict };

  const data = await store.getAccountData(brokerPhone, "broker");
  let invites: InviteRow[] = [];
  const invitesRaw = data[BROKER_ONBOARDING_INVITES_KEY];
  if (invitesRaw) {
    try {
      const parsed = JSON.parse(invitesRaw) as InviteRow[];
      if (Array.isArray(parsed)) invites = parsed;
    } catch {
      invites = [];
    }
  }

  const hasPendingInvite = invites.some((inv) => {
    if (inv.deletedAt) return false;
    if (phoneLast10(inv.tenantPhone) !== phoneDigits) return false;
    const status = resolveInviteStatusForRegister(inv.status, inv.expiresAt);
    return isActiveInviteStatusForRegister(status);
  });
  if (hasPendingInvite) return { ok: false, error: "duplicate_invite" };

  const now = Date.now();
  const token = generateOnboardToken();
  const tenantPhone = `+91${phoneDigits}`;
  const origin = input.origin.replace(/\/$/, "");
  const inviteLink = `${origin}/onboard/tenant/${token}`;

  const invite: InviteRow = {
    id: `btoi_${now}_${Math.random().toString(36).slice(2, 7)}`,
    token,
    tenantName: name,
    tenantPhone,
    brokerPhone: input.brokerPhone,
    brokerName: input.brokerName.trim() || "Your broker",
    inviteLink,
    status: "onboarding_pending",
    createdAt: now,
    expiresAt: now + BROKER_ONBOARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };

  const snapshot: BrokerOnboardTokenSnapshot = {
    token: invite.token,
    tenantName: invite.tenantName,
    tenantPhone: invite.tenantPhone,
    brokerPhone: invite.brokerPhone,
    brokerName: invite.brokerName,
    inviteLink,
    status: "onboarding_pending",
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
  };

  invites.unshift(invite);
  await store.setAccountDataKey(
    brokerPhone,
    "broker",
    BROKER_ONBOARDING_INVITES_KEY,
    JSON.stringify(invites),
  );
  await store.setAccountDataKey(
    brokerPhone,
    "broker",
    tokenDataKey(token),
    JSON.stringify(snapshot),
  );

  await registerTenantLeadPhoneClaim(store, brokerPhone, phoneDigits, {
    tenantId: invite.id,
    tenantName: name,
    brokerPhone: input.brokerPhone,
    source: "onboarding_invite",
  });

  return {
    ok: true,
    invite: {
      ...invite,
      inviteLink,
    },
  };
}

export async function handleBrokerTenantOnboardRequest(
  req: OnboardRequest,
  res: OnboardResponse,
  store: OnboardStore,
): Promise<void> {
  const segments = onboardPathSegments(req);
  const token = segments[0];
  if (!token) {
    json(res, 404, { error: "Not found" });
    return;
  }

  if (segments.length === 1) {
    if (req.method !== "GET") {
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    const record = await loadTokenSnapshot(store, token);
    if (!record) {
      json(res, 404, { error: "Invalid onboarding link" });
      return;
    }

    let snapshot = record.snapshot;
    let status = resolveInviteStatus(snapshot);
    if (status === "expired") {
      json(res, 410, {
        error: "This onboarding link has expired",
        brokerName: snapshot.brokerName,
        status,
      });
      return;
    }

    if (status === "onboarding_pending") {
      snapshot = await markInviteStarted(store, record.brokerPhone, token, snapshot);
      status = resolveInviteStatus(snapshot);
    }

    json(res, 200, {
      tenantName: snapshot.tenantName,
      tenantPhone: snapshot.tenantPhone,
      brokerName: snapshot.brokerName,
      status,
      expiresAt: snapshot.expiresAt,
    });
    return;
  }

  if (segments[1] === "submit") {
    if (req.method !== "POST") {
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    const record = await loadTokenSnapshot(store, token);
    if (!record) {
      json(res, 404, { error: "Invalid onboarding link" });
      return;
    }

    const status = resolveInviteStatus(record.snapshot);
    if (status === "expired") {
      json(res, 410, { error: "This onboarding link has expired", status });
      return;
    }

    const rawBody = readJsonBody(req);
    const body: SubmitBody =
      rawBody && typeof rawBody === "object" ? (rawBody as SubmitBody) : {};
    const validationError = validateSubmitBody(body);
    if (validationError) {
      json(res, 400, { error: validationError });
      return;
    }

    const submitPhone = phoneLast10(body.phone ?? "");
    if (submitPhone.length !== 10) {
      json(res, 400, { error: "Valid phone number is required" });
      return;
    }

    if (isSubmittedStatus(status)) {
      const { tenant } = await appendBrokerTenantLead(store, record.brokerPhone, token, body);
      json(res, 200, {
        ok: true,
        duplicate: true,
        brokerName: record.snapshot.brokerName,
        tenantId: tenant.id,
      });
      return;
    }

    try {
      const { tenant, isDuplicate } = await appendBrokerTenantLead(
        store,
        record.brokerPhone,
        token,
        body,
      );
      if (!isDuplicate) {
        await markInviteSubmitted(store, record.brokerPhone, token, record.snapshot);
      }
      json(res, 201, {
        ok: true,
        duplicate: isDuplicate,
        brokerName: record.snapshot.brokerName,
        tenantId: tenant.id,
      });
    } catch (err) {
      if (err instanceof TenantPhoneUnavailableError) {
        json(res, 400, {
          error:
            err.code === "duplicate_tenant_account"
              ? "This mobile number already has a tenant account."
              : "A tenant lead with this mobile number already exists.",
          code: err.code,
        });
        return;
      }
      json(res, 500, { error: "Failed to save tenant requirements" });
    }
    return;
  }

  json(res, 404, { error: "Not found" });
}
