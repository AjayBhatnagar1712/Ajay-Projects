import { Router, type IRouter, type Request, type Response } from "express";
import type {
  OnboardRequest,
  OnboardResponse,
  OnboardStore,
  RegisterBrokerOnboardInviteError,
} from "@workspace/broker-tenant-onboarding";
import {
  handleBrokerTenantOnboardRequest,
  registerBrokerOnboardingInvite,
} from "@workspace/broker-tenant-onboarding";
import * as syncStore from "@workspace/sync-store";

const router: IRouter = Router();

const REGISTER_ERROR_MESSAGES: Record<RegisterBrokerOnboardInviteError, string> = {
  invalid_name: "Enter tenant full name",
  invalid_phone: "Enter a valid 10-digit mobile number",
  duplicate_tenant: "A tenant lead with this mobile number already exists.",
  duplicate_tenant_account: "This mobile number already has a tenant account.",
  duplicate_invite: "An active onboarding link already exists for this number.",
};

function phoneLast10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function onboardPathFromReq(req: Request): string {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const brokerPhone = Array.isArray(req.params.brokerPhone)
    ? req.params.brokerPhone[0]
    : req.params.brokerPhone;
  if (brokerPhone && req.path.includes("/create/")) {
    return `create/${phoneLast10(brokerPhone)}`;
  }
  if (!token) return "";
  if (req.path.endsWith("/submit")) return `${token}/submit`;
  return token;
}

function onboardRequest(req: Request, onboardPath: string): OnboardRequest {
  return {
    method: req.method,
    query: { onboardPath },
    body: req.body,
    headers: req.headers as Record<string, string | string[] | undefined>,
  };
}

function onboardResponse(res: Response): OnboardResponse {
  let statusCode = 200;
  const adapted: OnboardResponse = {
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

async function loadOnboardStore(): Promise<OnboardStore> {
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

async function handleCreate(req: Request, res: Response, store: OnboardStore): Promise<void> {
  const brokerPhone = phoneLast10(
    Array.isArray(req.params.brokerPhone) ? req.params.brokerPhone[0] : (req.params.brokerPhone ?? ""),
  );
  if (brokerPhone.length !== 10) {
    res.status(400).json({ error: "Invalid broker phone" });
    return;
  }

  const body = req.body as { tenantName?: string; tenantPhone?: string; brokerName?: string };
  const tenantName = (body.tenantName ?? "").trim();
  const tenantPhone = (body.tenantPhone ?? "").trim();
  if (!tenantName || !tenantPhone) {
    res.status(400).json({ error: "tenantName and tenantPhone are required" });
    return;
  }

  let brokerName = (body.brokerName ?? "").trim();
  if (!brokerName) {
    const data = await store.getAccountData(brokerPhone, "broker");
    try {
      brokerName = data.profile ? (JSON.parse(data.profile) as { name?: string }).name?.trim() ?? "" : "";
    } catch {
      brokerName = "";
    }
  }

  const result = await registerBrokerOnboardingInvite(store, {
    brokerPhone,
    brokerName: brokerName || "Your broker",
    tenantName,
    tenantPhone,
    origin: requestOrigin(req),
  });

  if (!result.ok) {
    res.status(400).json({ error: REGISTER_ERROR_MESSAGES[result.error], code: result.error });
    return;
  }

  res.status(201).json({ ok: true, invite: result.invite });
}

function runHandler(req: Request, res: Response): void {
  const onboardPath = onboardPathFromReq(req);
  if (!onboardPath) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  void loadOnboardStore()
    .then(async (store) => {
      if (onboardPath.startsWith("create/")) {
        await handleCreate(req, res, store);
        return;
      }
      const adaptedReq = onboardRequest(req, onboardPath);
      const adaptedRes = onboardResponse(res);
      await handleBrokerTenantOnboardRequest(adaptedReq, adaptedRes, store);
    })
    .catch((err: unknown) => {
      res.status(500).json({
        error: "Broker tenant onboard function failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    });
}

router.post("/broker-tenant-onboard/create/:brokerPhone", runHandler);
router.get("/broker-tenant-onboard/:token", runHandler);
router.post("/broker-tenant-onboard/:token/submit", runHandler);

export default router;
