import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertSyncAccountAuth } from "./syncAuth.js";
import { json, readJsonBody } from "./http.js";
import {
  getMarketingCorsRoute,
  handleMarketingCorsPreflight,
  resolveMarketingCorsOrigin,
} from "./marketingCors.js";
import * as vercelDb from "./vercelSyncDb.js";

export function syncPathSegments(req: VercelRequest): string[] {
  const raw = req.query.syncPath ?? req.query.path;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.length > 0) return raw.split("/").filter(Boolean);
  return [];
}

type SyncStore = {
  normalizePhone: (phone: string) => string;
  accountHasProfile: (phone: string, role: string) => Promise<boolean>;
  getAccountData: (phone: string, role: string) => Promise<Record<string, string>>;
  getRolesForPhone: (phone: string) => Promise<string[]>;
  getAccountSummariesForPhone: (
    phone: string,
  ) => Promise<Array<{ role: string; displayName: string }>>;
  setAccountDataBulk: (phone: string, role: string, entries: Record<string, string>) => Promise<void>;
  setAccountDataKey: (
    phone: string,
    role: string,
    dataKey: string,
    value: string,
  ) => Promise<void>;
};

async function loadSyncStore(): Promise<SyncStore> {
  if (vercelDb.usePostgres()) return vercelDb;
  return import("@workspace/sync-store");
}

function requestAuthorization(req: VercelRequest): string | undefined {
  const header = req.headers.authorization ?? req.headers.Authorization;
  if (Array.isArray(header)) return header[0];
  return header;
}

function syncCors(
  req: VercelRequest,
  segments: string[],
): { origin: string; route: NonNullable<ReturnType<typeof getMarketingCorsRoute>> } | undefined {
  const origin = resolveMarketingCorsOrigin(req, segments);
  const route = getMarketingCorsRoute(segments, req.method);
  if (!origin || !route) return undefined;
  return { origin, route };
}

/**
 * Handles sync routes after vercel.json rewrites /api/sync/* → /api/sync?syncPath=...
 */
export async function handleSyncRequest(req: VercelRequest, res: VercelResponse): Promise<void> {
  const store = await loadSyncStore();
  const segments = syncPathSegments(req);

  if (handleMarketingCorsPreflight(req, res, segments)) return;

  if (segments[0] !== "accounts") {
    json(res, 404, { error: "Not found" });
    return;
  }

  const phone = store.normalizePhone(segments[1] ?? "");
  if (phone.length !== 10) {
    json(res, 400, { error: "Invalid phone" });
    return;
  }

  if (segments.length === 3 && segments[2] === "roles") {
    const cors = syncCors(req, segments);
    if (req.method !== "GET") {
      json(res, 405, { error: "Method not allowed" }, cors);
      return;
    }
    try {
      const roles = await store.getRolesForPhone(phone);
      json(res, 200, { phone, roles }, cors);
    } catch (err) {
      json(res, 500, { error: "Failed to list roles", detail: String(err) }, cors);
    }
    return;
  }

  if (segments.length === 3 && segments[2] === "summaries") {
    const cors = syncCors(req, segments);
    if (req.method !== "GET") {
      json(res, 405, { error: "Method not allowed" }, cors);
      return;
    }
    try {
      const accounts = await store.getAccountSummariesForPhone(phone);
      json(res, 200, { phone, accounts }, cors);
    } catch (err) {
      json(res, 500, { error: "Failed to list account summaries", detail: String(err) }, cors);
    }
    return;
  }

  const role = segments[2] ?? "";
  if (!role) {
    json(res, 400, { error: "Invalid role" });
    return;
  }

  if (segments.length === 4 && segments[3] === "exists") {
    if (req.method !== "GET") {
      json(res, 405, { error: "Method not allowed" });
      return;
    }
    try {
      const exists = await store.accountHasProfile(phone, role);
      json(res, 200, { phone, role, exists });
    } catch (err) {
      json(res, 500, { error: "Failed to check account", detail: String(err) });
    }
    return;
  }

  if (segments.length === 3) {
    if (req.method === "GET") {
      const auth = await assertSyncAccountAuth(requestAuthorization(req), phone);
      if (!auth.ok) {
        json(res, auth.status, { error: auth.error });
        return;
      }
      try {
        const data = await store.getAccountData(phone, role);
        const hasProfile = typeof data.profile === "string" && data.profile.length > 0;
        const hasTenantWorkspace =
          role === "tenant" &&
          typeof data.tenant_workspace === "string" &&
          data.tenant_workspace.length > 0;
        if (!hasProfile && !hasTenantWorkspace) {
          json(res, 404, { error: "Account not found" });
          return;
        }
        json(res, 200, { phone, role, data });
      } catch (err) {
        json(res, 500, { error: "Failed to load account", detail: String(err) });
      }
      return;
    }

    if (req.method === "PUT") {
      const auth = await assertSyncAccountAuth(requestAuthorization(req), phone);
      if (!auth.ok) {
        json(res, auth.status, { error: auth.error });
        return;
      }
      try {
        const body = readJsonBody(req) as { entries?: Record<string, string> } | null;
        const entries = body?.entries;
        if (!entries || typeof entries !== "object") {
          json(res, 400, { error: "Invalid request" });
          return;
        }
        await store.setAccountDataBulk(phone, role, entries);
        json(res, 200, { ok: true });
      } catch (err) {
        json(res, 500, { error: "Failed to save data", detail: String(err) });
      }
      return;
    }

    json(res, 405, { error: "Method not allowed" });
    return;
  }

  if (segments.length === 4) {
    const cors = segments[3] === "profile" ? syncCors(req, segments) : undefined;
    if (req.method !== "PUT") {
      json(res, 405, { error: "Method not allowed" }, cors);
      return;
    }
    const auth = await assertSyncAccountAuth(requestAuthorization(req), phone);
    if (!auth.ok) {
      json(res, auth.status, { error: auth.error }, cors);
      return;
    }
    try {
      const dataKey = segments[3] ?? "";
      const body = readJsonBody(req) as { value?: string } | null;
      const value = typeof body?.value === "string" ? body.value : null;

      if (!dataKey || value === null) {
        json(res, 400, { error: "Invalid request" }, cors);
        return;
      }

      await store.setAccountDataKey(phone, role, dataKey, value);
      json(res, 200, { ok: true }, cors);
    } catch (err) {
      json(res, 500, { error: "Failed to save data", detail: String(err) }, cors);
    }
    return;
  }

  json(res, 404, { error: "Not found" });
}
