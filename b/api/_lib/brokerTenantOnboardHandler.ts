import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as vercelDb from "./vercelSyncDb.js";
import type {
  OnboardRequest,
  OnboardResponse,
  OnboardStore,
  RegisterBrokerOnboardInviteError,
} from "@workspace/broker-tenant-onboarding";
import { assertSyncAccountAuth } from "./syncAuth.js";
import { json, readJsonBody } from "./http.js";

const REGISTER_ERROR_MESSAGES: Record<RegisterBrokerOnboardInviteError, string> = {
  invalid_name: "Enter tenant full name",
  invalid_phone: "Enter a valid 10-digit mobile number",
  duplicate_tenant: "A tenant lead with this mobile number already exists.",
  duplicate_tenant_account: "This mobile number already has a tenant account.",
  duplicate_invite: "An active onboarding link already exists for this number.",
};

async function loadBrokerTenantOnboarding() {
  return import("@workspace/broker-tenant-onboarding");
}

function onboardPathSegments(req: VercelRequest): string[] {
  const raw = req.query.onboardPath ?? req.query.path;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.length > 0) return raw.split("/").filter(Boolean);
  return [];
}

function onboardRequest(req: VercelRequest, segments: string[]): OnboardRequest {
  return {
    method: req.method ?? "GET",
    query: { onboardPath: segments.join("/") },
    body: req.body,
    headers: req.headers as Record<string, string | string[] | undefined>,
  };
}

function onboardResponse(res: VercelResponse): OnboardResponse {
  const adapted: OnboardResponse = {
    status(code: number) {
      res.status(code);
      return adapted;
    },
    setHeader(name: string, value: string | string[]) {
      res.setHeader(name, value);
      return adapted;
    },
    end(body: string) {
      res.end(body);
    },
  };
  return adapted;
}

async function loadOnboardStore(): Promise<OnboardStore> {
  if (vercelDb.usePostgres()) {
    return {
      findEntryByDataKey: async (dataKey: string) => {
        const rows = await vercelDb.queryRows<{ phone: string; role: string; value: string }>(
          `SELECT phone, role, value FROM user_data WHERE data_key = $1 LIMIT 1`,
          [dataKey],
        );
        return rows[0] ?? null;
      },
      getAccountData: vercelDb.getAccountData,
      setAccountDataKey: vercelDb.setAccountDataKey,
      accountHasProfile: vercelDb.accountHasProfile,
    };
  }

  const syncStore = await import("@workspace/sync-store");
  return {
    findEntryByDataKey: syncStore.findEntryByDataKey,
    getAccountData: syncStore.getAccountData,
    setAccountDataKey: syncStore.setAccountDataKey,
    accountHasProfile: syncStore.accountHasProfile,
  };
}

function requestAuthorization(req: VercelRequest): string | undefined {
  const header = req.headers.authorization ?? req.headers.Authorization;
  if (Array.isArray(header)) return header[0];
  return header;
}

function requestOrigin(req: VercelRequest): string {
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const protoHeader = req.headers["x-forwarded-proto"] ?? "https";
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  if (host) return `${proto}://${host}`;
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;
  return "https://app.trustkeyper.com";
}

async function resolveBrokerDisplayName(store: OnboardStore, phone: string): Promise<string | null> {
  const data = await store.getAccountData(vercelDb.normalizePhone(phone), "broker");
  const rawProfile = data.profile;
  if (!rawProfile) return null;
  try {
    const profile = JSON.parse(rawProfile) as { name?: string };
    return profile.name?.trim() || null;
  } catch {
    return null;
  }
}

async function handleCreateInvite(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const segments = onboardPathSegments(req);
  const brokerPhoneFromPath = vercelDb.normalizePhone(segments[1] ?? "");
  const auth = await assertSyncAccountAuth(requestAuthorization(req), brokerPhoneFromPath);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  const rawBody = readJsonBody(req);
  const body =
    rawBody && typeof rawBody === "object"
      ? (rawBody as { tenantName?: string; tenantPhone?: string; brokerName?: string })
      : {};

  const tenantName = (body.tenantName ?? "").trim();
  const tenantPhone = (body.tenantPhone ?? "").trim();
  if (!tenantName || !tenantPhone) {
    json(res, 400, { error: "tenantName and tenantPhone are required" });
    return;
  }

  let store: OnboardStore;
  try {
    store = await loadOnboardStore();
  } catch (err) {
    json(res, 500, {
      error: "Broker tenant onboard function failed",
      detail: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  const brokerPhone = auth.user.phone;
  const brokerName =
    (body.brokerName ?? "").trim() ||
    (await resolveBrokerDisplayName(store, brokerPhone)) ||
    "Your broker";

  const { registerBrokerOnboardingInvite } = await loadBrokerTenantOnboarding();
  const result = await registerBrokerOnboardingInvite(store, {
    brokerPhone,
    brokerName,
    tenantName,
    tenantPhone,
    origin: requestOrigin(req),
  });

  if (!result.ok) {
    json(res, 400, { error: REGISTER_ERROR_MESSAGES[result.error], code: result.error });
    return;
  }

  json(res, 201, { ok: true, invite: result.invite });
}

export async function handleBrokerTenantOnboardRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const segments = onboardPathSegments(req);

  if (segments[0] === "create") {
    await handleCreateInvite(req, res);
    return;
  }

  let store: OnboardStore;
  try {
    store = await loadOnboardStore();
  } catch (err) {
    json(res, 500, {
      error: "Broker tenant onboard function failed",
      detail: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  const adaptedReq = onboardRequest(req, segments);
  const adaptedRes = onboardResponse(res);
  const { handleBrokerTenantOnboardRequest: handleBrokerTenantOnboardRequestCore } =
    await loadBrokerTenantOnboarding();
  await handleBrokerTenantOnboardRequestCore(adaptedReq, adaptedRes, store);
}
