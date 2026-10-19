import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const mocks = vi.hoisted(() => ({ query: vi.fn(), gateway: vi.fn() }));
vi.mock("./vercelSyncDb.js", () => ({
  getPool: () => ({ query: mocks.query }),
  phoneVariantsForPartyMatch: (phone: string) => [phone, `+91${phone}`],
}));
vi.mock("./syncAuth.js", () => ({
  assertPaymentAuth: async () => ({ ok: true }),
}));
vi.mock("./razorpayClient.js", () => ({ getRazorpayClient: mocks.gateway }));
import { handleLeaseRentOrderRequest } from "./leasePaymentHandler.js";

describe("lease rent order renewal guard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-20T00:00:00Z"));
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_unit_only");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "unit-test-only");
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("WITH RECURSIVE")) return { rows: [{ conflict: true }] };
      if (sql.includes("FROM public.agreement_parties"))
        return {
          rows: [
            { role: "tenant", phone: "9876543211" },
            { role: "owner", phone: "9876543212" },
          ],
        };
      if (sql.includes("FROM public.lease_agreements"))
        return {
          rows: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              status: "signed",
              monthly_rent_paise: 5000000,
              effective_date: "2026-09-16",
              end_date: "2027-09-15",
            },
          ],
        };
      throw new Error("Unexpected database query");
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it("returns 409 before any gateway call when a signed renewal shares the rent month", async () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };
    const req = {
      method: "POST",
      headers: { authorization: "Bearer unit-test" },
      body: {
        phone: "9876543211",
        agreementId: "11111111-1111-4111-8111-111111111111",
        rentPeriod: "2026-09",
      },
    } as unknown as VercelRequest;
    await handleLeaseRentOrderRequest(req, res as unknown as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(JSON.parse(res.end.mock.calls[0][0])).toMatchObject({
      code: "renewal_rent_review_required",
    });
    expect(mocks.gateway).not.toHaveBeenCalled();
  });
});
