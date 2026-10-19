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

function toVercelRequest(req: Request): VercelRequest {
  return {
    method: req.method,
    query: req.query,
    body: req.body,
    headers: req.headers,
  } as unknown as VercelRequest;
}

async function loadPaymentEscrowHandler(): Promise<{
  handlePaymentCreateEscrowOrderRequest: (req: VercelRequest, res: VercelResponse) => Promise<void>;
  handlePaymentReleaseEscrowRequest: (req: VercelRequest, res: VercelResponse) => Promise<void>;
}> {
  const handlerPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../api/_lib/paymentEscrowHandler.js",
  );
  return import(pathToFileURL(handlerPath).href) as Promise<{
    handlePaymentCreateEscrowOrderRequest: (req: VercelRequest, res: VercelResponse) => Promise<void>;
    handlePaymentReleaseEscrowRequest: (req: VercelRequest, res: VercelResponse) => Promise<void>;
  }>;
}

router.post("/payments-create-escrow-order", (req, res) => {
  void (async () => {
    try {
      const { handlePaymentCreateEscrowOrderRequest } = await loadPaymentEscrowHandler();
      await handlePaymentCreateEscrowOrderRequest(toVercelRequest(req), adaptResponse(res));
    } catch (err) {
      res.status(500).json({
        error: "Payment escrow function failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  })();
});

router.post("/payments-release-escrow", (req, res) => {
  void (async () => {
    try {
      const { handlePaymentReleaseEscrowRequest } = await loadPaymentEscrowHandler();
      await handlePaymentReleaseEscrowRequest(toVercelRequest(req), adaptResponse(res));
    } catch (err) {
      res.status(500).json({
        error: "Payment escrow release failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  })();
});

export default router;
