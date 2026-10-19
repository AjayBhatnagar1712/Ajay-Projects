import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  DocumentUploadRequest,
  DocumentUploadResponse,
  DocumentUploadStore,
  RegisterDocumentUploadInviteError,
} from "@workspace/tenant-document-upload";
import { assertSyncAccountAuth } from "./syncAuth.js";
import * as vercelDb from "./vercelSyncDb.js";
import { json, readJsonBody } from "./http.js";

const REGISTER_ERROR_MESSAGES: Record<RegisterDocumentUploadInviteError, string> = {
  invalid_name: "Enter tenant full name",
  invalid_phone: "Enter a valid 10-digit mobile number",
  duplicate_invite: "An active document upload link already exists for this number.",
};

async function loadTenantDocumentUpload() {
  return import("@workspace/tenant-document-upload");
}

async function handleRequesterRoutes(
  req: VercelRequest,
  res: VercelResponse,
  segments: string[],
  store: DocumentUploadStore,
): Promise<void> {
  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const lib = await loadTenantDocumentUpload();
  const requesterPhone = vercelDb.normalizePhone(segments[1] ?? "");
  const requesterRole = (segments[2] ?? "").trim();
  if (requesterRole !== "owner" && requesterRole !== "broker") {
    json(res, 400, { error: "Invalid requester role" });
    return;
  }

  const auth = await assertSyncAccountAuth(requestAuthorization(req), requesterPhone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  if (segments.length >= 4) {
    const token = segments[3] ?? "";
    const result = await lib.getRequesterDocumentUploadInvite(store, requesterPhone, requesterRole, token);
    if (!result.ok) {
      json(res, result.code === "forbidden" ? 403 : 404, { error: result.error, code: result.code });
      return;
    }
    json(res, 200, { ok: true, invite: result.invite });
    return;
  }

  const invites = await lib.listRequesterDocumentUploadInvites(store, requesterPhone, requesterRole);
  json(res, 200, { ok: true, invites });
}

function uploadPathSegments(req: VercelRequest): string[] {
  const raw = req.query.uploadPath ?? req.query.path;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.length > 0) return raw.split("/").filter(Boolean);
  return [];
}

function uploadRequest(req: VercelRequest, segments: string[]): DocumentUploadRequest {
  return {
    method: req.method ?? "GET",
    query: { uploadPath: segments.join("/") },
    body: req.body,
    headers: req.headers as Record<string, string | string[] | undefined>,
  };
}

function uploadResponse(res: VercelResponse): DocumentUploadResponse {
  const adapted: DocumentUploadResponse = {
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

async function loadDocumentUploadStore(): Promise<DocumentUploadStore> {
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

async function resolveRequesterName(
  store: DocumentUploadStore,
  phone: string,
  role: string,
): Promise<string | null> {
  const data = await store.getAccountData(vercelDb.normalizePhone(phone), role);
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

  const segments = uploadPathSegments(req);
  const requesterPhoneFromPath = vercelDb.normalizePhone(segments[1] ?? "");
  const requesterRole = (segments[2] ?? "").trim();
  if (requesterRole !== "owner" && requesterRole !== "broker") {
    json(res, 400, { error: "Invalid requester role" });
    return;
  }

  const auth = await assertSyncAccountAuth(requestAuthorization(req), requesterPhoneFromPath);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  const body = readJsonBody(req) as {
    tenantName?: string;
    tenantPhone?: string;
    requesterName?: string;
    propertyId?: string;
    propertyLabel?: string;
    propertyImage?: string;
    propertyAddress?: string;
    monthlyRent?: string;
    securityDeposit?: string;
    agreementDraftId?: string;
  } | null;

  const tenantName = (body?.tenantName ?? "").trim();
  const tenantPhone = (body?.tenantPhone ?? "").trim();
  if (!tenantName || !tenantPhone) {
    json(res, 400, { error: "Tenant name and phone are required" });
    return;
  }

  const store = await loadDocumentUploadStore();
  const lib = await loadTenantDocumentUpload();
  const requesterName =
    (body?.requesterName ?? "").trim() ||
    (await resolveRequesterName(store, requesterPhoneFromPath, requesterRole)) ||
    "Your property manager";

  const result = await lib.registerDocumentUploadInvite(store, {
    requesterPhone: requesterPhoneFromPath,
    requesterRole,
    requesterName,
    tenantName,
    tenantPhone,
    propertyId: body?.propertyId,
    propertyLabel: body?.propertyLabel,
    propertyImage: body?.propertyImage,
    propertyAddress: body?.propertyAddress,
    monthlyRent: body?.monthlyRent,
    securityDeposit: body?.securityDeposit,
    agreementDraftId: body?.agreementDraftId,
    origin: requestOrigin(req),
  });

  if (!result.ok) {
    json(res, 400, {
      error: REGISTER_ERROR_MESSAGES[result.error],
      code: result.error,
    });
    return;
  }

  json(res, 201, {
    invite: result.invite,
    inviteLink: result.invite.inviteLink,
  });
}

export async function handleTenantDocumentUploadRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const segments = uploadPathSegments(req);

  if (segments[0] === "create" && segments.length >= 3) {
    await handleCreateInvite(req, res);
    return;
  }

  const store = await loadDocumentUploadStore();

  if (segments[0] === "requester" && segments.length >= 3) {
    await handleRequesterRoutes(req, res, segments, store);
    return;
  }

  const lib = await loadTenantDocumentUpload();
  await lib.handleTenantDocumentUploadRequest(
    uploadRequest(req, segments),
    uploadResponse(res),
    store,
  );
}
