import { Router, type IRouter, type Request, type Response } from "express";
import type {
  DocumentUploadRequest,
  DocumentUploadResponse,
  DocumentUploadStore,
  RegisterDocumentUploadInviteError,
} from "@workspace/tenant-document-upload";
import {
  getRequesterDocumentUploadInvite,
  handleTenantDocumentUploadRequest,
  listRequesterDocumentUploadInvites,
  registerDocumentUploadInvite,
} from "@workspace/tenant-document-upload";
import { assertSyncAccountAuth } from "@workspace/auth-server";
import * as syncStore from "@workspace/sync-store";

const router: IRouter = Router();

const REGISTER_ERROR_MESSAGES: Record<RegisterDocumentUploadInviteError, string> = {
  invalid_name: "Enter tenant full name",
  invalid_phone: "Enter a valid 10-digit mobile number",
  duplicate_invite: "An active document upload link already exists for this number.",
};

function phoneLast10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function uploadPathFromReq(req: Request): string {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const requesterPhone = Array.isArray(req.params.requesterPhone)
    ? req.params.requesterPhone[0]
    : req.params.requesterPhone;
  const requesterRole = Array.isArray(req.params.requesterRole)
    ? req.params.requesterRole[0]
    : req.params.requesterRole;
  if (requesterPhone && requesterRole && req.path.includes("/requester/")) {
    if (token) return `requester/${phoneLast10(requesterPhone)}/${requesterRole}/${token}`;
    return `requester/${phoneLast10(requesterPhone)}/${requesterRole}`;
  }
  if (requesterPhone && requesterRole && req.path.includes("/create/")) {
    return `create/${phoneLast10(requesterPhone)}/${requesterRole}`;
  }
  if (!token) return "";
  if (req.path.endsWith("/start")) return `${token}/start`;
  if (req.path.endsWith("/submit")) return `${token}/submit`;
  const docId = Array.isArray(req.params.docId) ? req.params.docId[0] : req.params.docId;
  if (docId && req.path.includes("/file/")) return `${token}/file/${docId}`;
  return token;
}

function uploadRequest(req: Request, uploadPath: string): DocumentUploadRequest {
  return {
    method: req.method,
    query: { uploadPath },
    body: req.body,
    headers: req.headers as Record<string, string | string[] | undefined>,
  };
}

function uploadResponse(res: Response): DocumentUploadResponse {
  let statusCode = 200;
  const adapted: DocumentUploadResponse = {
    status(code: number) {
      statusCode = code;
      res.status(code);
      return adapted;
    },
    setHeader(name: string, value: string | string[]) {
      res.setHeader(name, value);
      return adapted;
    },
    end(body: string) {
      res.status(statusCode).type("json").send(body);
    },
  };
  return adapted;
}

async function loadDocumentUploadStore(): Promise<DocumentUploadStore> {
  return {
    findEntryByDataKey: syncStore.findEntryByDataKey,
    getAccountData: syncStore.getAccountData,
    setAccountDataKey: syncStore.setAccountDataKey,
    accountHasProfile: syncStore.accountHasProfile,
  };
}

function requestOrigin(req: Request): string {
  const host = req.get("host");
  if (host) return `${req.protocol}://${host}`;
  return "http://localhost:5173";
}

async function handleCreate(req: Request, res: Response, store: DocumentUploadStore): Promise<void> {
  const requesterPhone = phoneLast10(
    Array.isArray(req.params.requesterPhone)
      ? req.params.requesterPhone[0]
      : (req.params.requesterPhone ?? ""),
  );
  const requesterRole = (
    Array.isArray(req.params.requesterRole) ? req.params.requesterRole[0] : req.params.requesterRole ?? ""
  ) as "owner" | "broker";

  if (requesterPhone.length !== 10 || (requesterRole !== "owner" && requesterRole !== "broker")) {
    res.status(400).json({ error: "Invalid requester" });
    return;
  }

  const body = req.body as {
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
  };

  const tenantName = (body.tenantName ?? "").trim();
  const tenantPhone = (body.tenantPhone ?? "").trim();
  if (!tenantName || !tenantPhone) {
    res.status(400).json({ error: "tenantName and tenantPhone are required" });
    return;
  }

  let requesterName = (body.requesterName ?? "").trim();
  if (!requesterName) {
    const data = await store.getAccountData(requesterPhone, requesterRole);
    try {
      requesterName = data.profile
        ? (JSON.parse(data.profile) as { name?: string }).name?.trim() ?? ""
        : "";
    } catch {
      requesterName = "";
    }
  }

  const result = await registerDocumentUploadInvite(store, {
    requesterPhone,
    requesterRole,
    requesterName: requesterName || "Your property manager",
    tenantName,
    tenantPhone,
    propertyId: body.propertyId,
    propertyLabel: body.propertyLabel,
    propertyImage: body.propertyImage,
    propertyAddress: body.propertyAddress,
    monthlyRent: body.monthlyRent,
    securityDeposit: body.securityDeposit,
    agreementDraftId: body.agreementDraftId,
    origin: requestOrigin(req),
  });

  if (!result.ok) {
    res.status(400).json({ error: REGISTER_ERROR_MESSAGES[result.error], code: result.error });
    return;
  }

  res.status(201).json({ ok: true, invite: result.invite, inviteLink: result.invite.inviteLink });
}

async function handleRequesterList(req: Request, res: Response, store: DocumentUploadStore): Promise<void> {
  const requesterPhone = phoneLast10(
    Array.isArray(req.params.requesterPhone)
      ? req.params.requesterPhone[0]
      : (req.params.requesterPhone ?? ""),
  );
  const requesterRole = (
    Array.isArray(req.params.requesterRole) ? req.params.requesterRole[0] : req.params.requesterRole ?? ""
  ) as "owner" | "broker";

  if (requesterPhone.length !== 10 || (requesterRole !== "owner" && requesterRole !== "broker")) {
    res.status(400).json({ error: "Invalid requester" });
    return;
  }

  const auth = await assertSyncAccountAuth(req.headers.authorization, requesterPhone);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const invites = await listRequesterDocumentUploadInvites(store, requesterPhone, requesterRole);
  res.status(200).json({ ok: true, invites });
}

async function handleRequesterDetail(req: Request, res: Response, store: DocumentUploadStore): Promise<void> {
  const requesterPhone = phoneLast10(
    Array.isArray(req.params.requesterPhone)
      ? req.params.requesterPhone[0]
      : (req.params.requesterPhone ?? ""),
  );
  const requesterRole = (
    Array.isArray(req.params.requesterRole) ? req.params.requesterRole[0] : req.params.requesterRole ?? ""
  ) as "owner" | "broker";
  const token = Array.isArray(req.params.token) ? req.params.token[0] : (req.params.token ?? "");

  if (requesterPhone.length !== 10 || (requesterRole !== "owner" && requesterRole !== "broker") || !token) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const auth = await assertSyncAccountAuth(req.headers.authorization, requesterPhone);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const result = await getRequesterDocumentUploadInvite(store, requesterPhone, requesterRole, token);
  if (!result.ok) {
    res.status(result.code === "forbidden" ? 403 : 404).json({ error: result.error, code: result.code });
    return;
  }

  res.status(200).json({ ok: true, invite: result.invite });
}

function runHandler(req: Request, res: Response): void {
  const uploadPath = uploadPathFromReq(req);
  if (!uploadPath) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  void loadDocumentUploadStore()
    .then(async (store) => {
      if (uploadPath.startsWith("create/")) {
        await handleCreate(req, res, store);
        return;
      }
      if (uploadPath.startsWith("requester/")) {
        if (req.method !== "GET") {
          res.status(405).json({ error: "Method not allowed" });
          return;
        }
        const parts = uploadPath.split("/");
        if (parts.length >= 4) {
          await handleRequesterDetail(req, res, store);
          return;
        }
        await handleRequesterList(req, res, store);
        return;
      }
      await handleTenantDocumentUploadRequest(uploadRequest(req, uploadPath), uploadResponse(res), store);
    })
    .catch((err: unknown) => {
      res.status(500).json({
        error: "Tenant document upload function failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    });
}

router.post("/tenant-document-upload/create/:requesterPhone/:requesterRole", runHandler);
router.get("/tenant-document-upload/requester/:requesterPhone/:requesterRole", runHandler);
router.get("/tenant-document-upload/requester/:requesterPhone/:requesterRole/:token", runHandler);
router.get("/tenant-document-upload/:token", runHandler);
router.get("/tenant-document-upload/:token/file/:docId", runHandler);
router.post("/tenant-document-upload/:token/start", runHandler);
router.post("/tenant-document-upload/:token/submit", runHandler);

export default router;
