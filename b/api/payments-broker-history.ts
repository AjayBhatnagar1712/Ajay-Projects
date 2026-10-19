/**
 * Vercel serverless entry for GET /api/payments-broker-history —
 * authenticated broker consultancy-fee payment history.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleBrokerPaymentHistoryRequest } from "./_lib/paymentReadHandler.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleBrokerPaymentHistoryRequest(req, res);
}
