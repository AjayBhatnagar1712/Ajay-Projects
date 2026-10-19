import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertSyncAccountAuth } from "./syncAuth.js";
import { json, readJsonBody } from "./http.js";
import {
  acceptInvitation,
  createInvitation,
  declineInvitation,
  getInvitationByToken,
  listInvitationsForOwner,
} from "@workspace/invitations-store";
import { normalizePhone } from "./vercelSyncDb.js";

const DEFAULT_EXPIRY_DAYS = Number(process.env.INVITE_EXPIRY_DAYS ?? "7");

function invitePathSegments(req: VercelRequest): string[] {
  const raw = req.query.invitePath ?? req.query.path;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.length > 0) return raw.split("/").filter(Boolean);
  return [];
}

function requestAuthorization(req: VercelRequest): string | undefined {
  const header = req.headers.authorization ?? req.headers.Authorization;
  if (Array.isArray(header)) return header[0];
  return header;
}

function publicInviteView(record: Awaited<ReturnType<typeof getInvitationByToken>>) {
  if (!record) return null;
  return {
    token: record.token,
    propertyLabel: record.propertyLabel,
    ownerName: record.ownerName,
    tenantName: record.tenantName,
    monthlyRent: record.monthlyRent,
    maintenanceIncluded: record.maintenanceIncluded,
    monthlyMaintenance: record.monthlyMaintenance,
    securityDeposit: record.securityDeposit,
    startDate: record.startDate,
    status: record.status,
    expiresAt: record.expiresAt,
    acceptedAt: record.acceptedAt,
    declinedAt: record.declinedAt,
  };
}

export async function handleInvitationsRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const segments = invitePathSegments(req);

  if (segments.length === 0) {
    json(res, 404, { error: "Not found" });
    return;
  }

  if (segments[0] === "mine") {
    if (req.method !== "GET") {
      json(res, 405, { error: "Method not allowed" });
      return;
    }
    const phone = normalizePhone(String(req.query.ownerPhone ?? ""));
    if (phone.length !== 10) {
      json(res, 400, { error: "Invalid owner phone" });
      return;
    }
    const auth = await assertSyncAccountAuth(requestAuthorization(req), phone);
    if (!auth.ok) {
      json(res, auth.status, { error: auth.error });
      return;
    }
    const invites = await listInvitationsForOwner(phone);
    json(res, 200, { invites });
    return;
  }

  const token = segments[0];
  if (!token) {
    json(res, 400, { error: "Invalid token" });
    return;
  }

  if (segments.length === 1) {
    if (req.method === "GET") {
      const record = await getInvitationByToken(token);
      if (!record) {
        json(res, 404, { error: "Invitation not found" });
        return;
      }
      json(res, 200, { invitation: publicInviteView(record) });
      return;
    }

    if (req.method === "POST") {
      const body = readJsonBody(req) as { action?: string } | null;
      const action = body?.action;
      if (action === "accept") {
        const result = await acceptInvitation(token);
        if (!result.record) {
          json(res, 404, { error: "Invitation not found" });
          return;
        }
        json(res, 200, {
          invitation: publicInviteView(result.record),
          error: result.error,
        });
        return;
      }
      if (action === "decline") {
        const result = await declineInvitation(token);
        if (!result.record) {
          json(res, 404, { error: "Invitation not found" });
          return;
        }
        json(res, 200, {
          invitation: publicInviteView(result.record),
          error: result.error,
        });
        return;
      }
      json(res, 400, { error: "Invalid action" });
      return;
    }

    json(res, 405, { error: "Method not allowed" });
    return;
  }

  json(res, 404, { error: "Not found" });
}

export async function handleCreateInvitation(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const body = readJsonBody(req) as {
    ownerPhone?: string;
    ownerName?: string;
    propertyId?: string;
    propertyLabel?: string;
    tenantName?: string;
    tenantPhone?: string;
    monthlyRent?: string;
    maintenanceIncluded?: boolean;
    monthlyMaintenance?: string;
    securityDeposit?: string;
    startDate?: string;
    expiryDays?: number;
  } | null;

  const ownerPhone = normalizePhone(body?.ownerPhone ?? "");
  if (ownerPhone.length !== 10) {
    json(res, 400, { error: "Invalid owner phone" });
    return;
  }

  const auth = await assertSyncAccountAuth(requestAuthorization(req), ownerPhone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  if (!body?.propertyId || !body?.tenantName || !body?.tenantPhone) {
    json(res, 400, { error: "Missing invitation fields" });
    return;
  }

  const days =
    typeof body.expiryDays === "number" && body.expiryDays > 0
      ? body.expiryDays
      : DEFAULT_EXPIRY_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const record = await createInvitation({
    ownerPhone,
    ownerName: body.ownerName ?? "",
    propertyId: body.propertyId,
    propertyLabel: body.propertyLabel ?? "",
    tenantName: body.tenantName,
    tenantPhone: body.tenantPhone,
    monthlyRent: body.monthlyRent ?? "",
    maintenanceIncluded: Boolean(body.maintenanceIncluded),
    monthlyMaintenance: body.monthlyMaintenance ?? "",
    securityDeposit: body.securityDeposit ?? "",
    startDate: body.startDate ?? "",
    expiresAt,
  });

  json(res, 201, { invitation: record });
}
