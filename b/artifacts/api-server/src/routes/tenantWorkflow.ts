import { Router, type IRouter, type Request, type Response } from "express";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pathToFileURL } from "node:url";

const router: IRouter = Router();

function adaptResponse(res: Response): VercelResponse {
  const adapted = {
    status(code: number) {
      res.status(code);
      return adapted;
    },
    setHeader(name: string, value: string | string[]) {
      res.setHeader(name, value);
      return adapted;
    },
    json(body: unknown) {
      res.json(body);
      return adapted;
    },
    end(body?: string) {
      res.end(body);
    },
  };
  return adapted as unknown as VercelResponse;
}

function toVercelRequest(req: Request, workflowPath: string): VercelRequest {
  return {
    method: req.method,
    query: { workflowPath, ...req.query },
    body: req.body,
    headers: req.headers,
  } as unknown as VercelRequest;
}

async function loadTenantWorkflowHandler(): Promise<{
  handleTenantWorkflowRequest: (req: VercelRequest, res: VercelResponse) => Promise<void>;
}> {
  const handlerPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../api/_lib/tenantWorkflowHandler.js",
  );
  return import(pathToFileURL(handlerPath).href) as Promise<{
    handleTenantWorkflowRequest: (req: VercelRequest, res: VercelResponse) => Promise<void>;
  }>;
}

async function runWithPath(req: Request, res: Response, workflowPath: string): Promise<void> {
  try {
    const { handleTenantWorkflowRequest } = await loadTenantWorkflowHandler();
    await handleTenantWorkflowRequest(toVercelRequest(req, workflowPath), adaptResponse(res));
  } catch (err) {
    res.status(500).json({
      error: "Tenant workflow function failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

router.post("/tenant-workflow/send-for-esign", (req, res) => {
  void runWithPath(req, res, "send-for-esign");
});

router.get("/tenant-workflow/workspace/:phone", (req, res) => {
  const phone = Array.isArray(req.params.phone) ? req.params.phone[0] : (req.params.phone ?? "");
  void runWithPath(req, res, `workspace/${phone}`);
});

router.patch("/tenant-workflow/workspace", (req, res) => {
  void runWithPath(req, res, "workspace");
});

router.post("/tenant-workflow/record-signature", (req, res) => {
  void runWithPath(req, res, "record-signature");
});

router.get("/tenant-workflow/agreement-status/:agreementId", (req, res) => {
  const agreementId = Array.isArray(req.params.agreementId)
    ? req.params.agreementId[0]
    : (req.params.agreementId ?? "");
  void runWithPath(req, res, `agreement-status/${agreementId}`);
});

router.post("/tenant-workflow/record-party-signature", (req, res) => {
  void runWithPath(req, res, "record-party-signature");
});

export default router;
