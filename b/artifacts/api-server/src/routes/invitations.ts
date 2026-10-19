import { Router, type IRouter, type Request, type Response } from "express";
import { assertSyncAccountAuth } from "@workspace/auth-server";
import {
  acceptInvitation,
  createInvitation,
  declineInvitation,
  getInvitationByToken,
  listInvitationsForOwner,
  type TenantInvitationRecord,
} from "@workspace/invitations-store";
import { normalizePhone } from "../lib/accountStore";

const DEFAULT_EXPIRY_DAYS = Number(process.env.INVITE_EXPIRY_DAYS ?? "7");

const router: IRouter = Router();

function publicInviteView(record: TenantInvitationRecord | null) {
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

router.post("/invitations", async (req: Request, res: Response) => {
  try {
    const body = req.body as {
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
    };

    const ownerPhone = normalizePhone(body?.ownerPhone ?? "");
    if (ownerPhone.length !== 10) {
      res.status(400).json({ error: "Invalid owner phone" });
      return;
    }

    const auth = await assertSyncAccountAuth(req.headers.authorization, ownerPhone);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    if (!body?.propertyId || !body?.tenantName || !body?.tenantPhone) {
      res.status(400).json({ error: "Missing invitation fields" });
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

    res.status(201).json({ invitation: record });
  } catch (err) {
    res.status(500).json({
      error: "Invitations function failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/invitations/mine", async (req: Request, res: Response) => {
  try {
    const phone = normalizePhone(String(req.query.ownerPhone ?? ""));
    if (phone.length !== 10) {
      res.status(400).json({ error: "Invalid owner phone" });
      return;
    }
    const auth = await assertSyncAccountAuth(req.headers.authorization, phone);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const invites = await listInvitationsForOwner(phone);
    res.json({ invites });
  } catch (err) {
    res.status(500).json({
      error: "Invitations function failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/invitations/:token", async (req: Request, res: Response) => {
  try {
    const token = Array.isArray(req.params.token)
  ? req.params.token[0]
  : req.params.token;

const record = await getInvitationByToken(token);
    if (!record) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }
    res.json({ invitation: publicInviteView(record) });
  } catch (err) {
    res.status(500).json({
      error: "Invitations function failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post("/invitations/:token", async (req: Request, res: Response) => {
  try {
    const action = (req.body as { action?: string })?.action;
    const token = Array.isArray(req.params.token)
  ? req.params.token[0]
  : req.params.token;

    if (action === "accept") {
      const result = await acceptInvitation(token);
      if (!result.record) {
        res.status(404).json({ error: "Invitation not found" });
        return;
      }
      res.json({ invitation: publicInviteView(result.record), error: result.error });
      return;
    }

    if (action === "decline") {
      const result = await declineInvitation(token);
      if (!result.record) {
        res.status(404).json({ error: "Invitation not found" });
        return;
      }
      res.json({ invitation: publicInviteView(result.record), error: result.error });
      return;
    }

    res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    res.status(500).json({
      error: "Invitations function failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
