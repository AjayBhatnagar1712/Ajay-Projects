import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PGlite } from "../../lib/db/node_modules/@electric-sql/pglite/dist/index.js";
import {
  AGREEMENT_MOVED_FORWARD_MESSAGE,
  generateReviewToken,
  LeaseReviewDecisionSchema,
  REVIEW_TOKEN_EXPIRY_DAYS,
  REVIEW_WITHDRAWN_TERMINAL_MESSAGE,
  reviewTokenExpiresAt,
  WITHDRAW_REQUIRES_APPROVAL_MESSAGE,
} from "./leaseAgreementReview.js";

const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";

const mockState = vi.hoisted(() => ({
  pool: null as
    | {
        query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
        connect: () => Promise<{
          query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
          release: () => void;
        }>;
      }
    | null,
}));

vi.mock("./vercelSyncDb.js", () => ({
  getPool: () => {
    if (!mockState.pool) {
      throw new Error("Mock pool not initialized");
    }
    return mockState.pool;
  },
}));

vi.mock("./syncAuth.js", () => ({
  assertJwtUserAuth: vi.fn(async () => ({
    ok: true as const,
    user: {
      phone: "9876543210",
      userId: TEST_USER_ID,
    },
  })),
}));

import { handleLeaseAgreementRequest } from "./leaseAgreementHandler.js";
import { handleLeaseAgreementReviewRequest } from "./leaseAgreementReviewHandler.js";

function createMockResponse() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body = "";

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
      return res;
    },
    end(payload?: string) {
      body = payload ?? "";
    },
  };

  return {
    res: res as unknown as VercelResponse,
    get statusCode() {
      return statusCode;
    },
    get headers() {
      return headers;
    },
    get body() {
      return body;
    },
  };
}

function authRequest(
  method: string,
  leasePath: string,
  body?: unknown,
): VercelRequest {
  return {
    method,
    headers: {
      authorization: "Bearer test-token",
      host: "app.trustkeyper.com",
      "x-forwarded-proto": "https",
    },
    query: { leasePath },
    body: body ?? null,
  } as unknown as VercelRequest;
}

function publicReviewRequest(
  method: string,
  token: string,
  body?: unknown,
): VercelRequest {
  return {
    method,
    headers: {},
    query: { reviewPath: token },
    body: body ?? null,
  } as unknown as VercelRequest;
}

describe("lease agreement review flow", () => {
  let db: PGlite;
  const agreementId = "11111111-1111-4111-8111-111111111111";
  const ownerPartyId = "22222222-2222-4222-8222-222222222222";
  const tenantPartyId = "33333333-3333-4333-8333-333333333333";

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE auth.users (
        id uuid PRIMARY KEY,
        phone text
      );
      CREATE TABLE public.brokers (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL UNIQUE,
        name text NOT NULL DEFAULT ''
      );
      CREATE TABLE public.lease_agreements (
        id uuid PRIMARY KEY,
        created_by_user_id uuid NOT NULL,
        renewed_from_agreement_id uuid,
        status text NOT NULL DEFAULT 'draft',
        execution_date date,
        effective_date date,
        end_date date,
        execution_city text,
        duration_months integer,
        min_stay_months integer,
        notice_period_licensee_months integer,
        notice_period_licensor_months integer,
        monthly_rent_paise integer,
        security_deposit_paise integer,
        rent_due_day integer,
        brokerage_fee_paise integer,
        maintenance_included boolean NOT NULL DEFAULT false,
        monthly_maintenance_paise integer,
        property_address text,
        area_sqft numeric,
        facing text,
        car_parking_count integer,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        signed_pdf_pathname text,
        signed_at timestamptz,
        signed_uploaded_by_phone text,
        signing_notified_at timestamptz
      );
      CREATE TABLE public.agreement_parties (
        id uuid PRIMARY KEY,
        agreement_id uuid NOT NULL REFERENCES public.lease_agreements(id) ON DELETE CASCADE,
        role text NOT NULL,
        name text NOT NULL,
        phone text NOT NULL,
        title text,
        age integer,
        address text,
        aadhaar text,
        pan text,
        email text,
        is_primary boolean NOT NULL DEFAULT false,
        sort_order integer NOT NULL DEFAULT 0,
        review_token text,
        review_token_expires_at timestamptz,
        approval_status text NOT NULL DEFAULT 'pending'
          CHECK (approval_status IN ('pending', 'approved', 'changes_requested', 'withdrawn')),
        review_comment text,
        reviewed_at timestamptz,
        review_shared_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX agreement_parties_review_token_uidx
        ON public.agreement_parties (review_token)
        WHERE review_token IS NOT NULL;
      CREATE TABLE public.agreement_inventory_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        agreement_id uuid NOT NULL REFERENCES public.lease_agreements(id) ON DELETE CASCADE,
        description text NOT NULL,
        quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await db.query(
      `INSERT INTO auth.users (id, phone) VALUES ($1, $2)`,
      [TEST_USER_ID, "918860826738"],
    );
    await db.query(
      `INSERT INTO public.brokers (id, user_id, name) VALUES ($1, $2, $3)`,
      ["55555555-5555-4555-8555-555555555555", TEST_USER_ID, "Ravi Broker"],
    );

    await db.query(
      `INSERT INTO public.lease_agreements (
        id, created_by_user_id, status, execution_date, effective_date, end_date,
        execution_city, duration_months, min_stay_months,
        notice_period_licensee_months, notice_period_licensor_months,
        monthly_rent_paise, security_deposit_paise, rent_due_day,
        property_address, area_sqft, facing, car_parking_count
      ) VALUES (
        $1, $2, 'draft', '2026-07-27', '2026-08-01', '2027-07-31',
        'Hyderabad', 12, 6, 2, 2, 6000000, 12000000, 5,
        '1 Main Road', 1200, 'East', 1
      )`,
      [agreementId, TEST_USER_ID],
    );

    const parties = [
      [
        ownerPartyId,
        "owner",
        "Owner One",
        "9876543210",
        "Mr.",
        42,
        "1 Main Road",
        "967132807649",
        "ABCDE1234F",
        "owner@example.com",
        true,
        0,
      ],
      [
        tenantPartyId,
        "tenant",
        "Tenant One",
        "9876543211",
        "Ms.",
        31,
        "1 Main Road",
        "234123412346",
        "ABCDE1234G",
        "tenant@example.com",
        true,
        1,
      ],
    ];

    for (const party of parties) {
      await db.query(
        `INSERT INTO public.agreement_parties (
          id, agreement_id, role, name, phone, title, age, address,
          aadhaar, pan, email, is_primary, sort_order
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13
        )`,
        [party[0], agreementId, ...party.slice(1)],
      );
    }

    await db.query(
      `INSERT INTO public.agreement_inventory_items (id, agreement_id, description, sort_order)
       VALUES ('44444444-4444-4444-8444-444444444444', $1, '1 sofa - good', 0)`,
      [agreementId],
    );

    const query = async (sql: string, params?: unknown[]) => {
      const result = await db.query(sql, params);
      return {
        rows: result.rows ?? [],
        rowCount: result.rows?.length ?? 0,
      };
    };

    mockState.pool = {
      query,
      connect: async () => ({
        query,
        release() {},
      }),
    };
  });

  afterEach(async () => {
    mockState.pool = null;
    await db.close();
  });

  describe("token generation", () => {
    it("generates opaque base64url tokens without a timestamp prefix", () => {
      const token = generateReviewToken();
      expect(token.startsWith("bt_")).toBe(false);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBeGreaterThanOrEqual(40);
    });

    it("sets expiry 14 days ahead", () => {
      const from = new Date("2026-07-30T00:00:00.000Z");
      const expires = reviewTokenExpiresAt(from);
      expect(expires.toISOString()).toBe("2026-08-13T00:00:00.000Z");
      expect(REVIEW_TOKEN_EXPIRY_DAYS).toBe(14);
    });
  });

  describe("POST /:id/review/send", () => {
    it("transitions draft to in_review and returns per-party review links", async () => {
      const response = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("POST", `${agreementId}/review/send`),
        response.res,
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        parties: Array<{ name: string; role: string; reviewLink: string }>;
      };
      expect(body.parties).toHaveLength(2);
      expect(body.parties[0]?.reviewLink).toMatch(
        /^https:\/\/app\.trustkeyper\.com\/review\/[A-Za-z0-9_-]+$/,
      );

      const status = await db.query<{ status: string }>(
        `SELECT status FROM public.lease_agreements WHERE id = $1`,
        [agreementId],
      );
      expect(status.rows[0]?.status).toBe("in_review");

      const tokens = await db.query<{ review_token: string | null }>(
        `SELECT review_token FROM public.agreement_parties WHERE agreement_id = $1`,
        [agreementId],
      );
      expect(tokens.rows.every((row) => typeof row.review_token === "string")).toBe(true);
      expect(new Set(tokens.rows.map((row) => row.review_token)).size).toBe(2);
    });

    it("does not mark parties as shared when tokens are minted", async () => {
      const send = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("POST", `${agreementId}/review/send`),
        send.res,
      );
      expect(send.statusCode).toBe(200);

      const detail = createMockResponse();
      await handleLeaseAgreementRequest(authRequest("GET", agreementId), detail.res);
      expect(detail.statusCode).toBe(200);
      const detailBody = JSON.parse(detail.body) as {
        parties: Array<{ hasBeenShared: boolean; reviewSharedAt: string | null }>;
      };
      expect(detailBody.parties.every((party) => party.hasBeenShared === false)).toBe(true);
      expect(detailBody.parties.every((party) => party.reviewSharedAt === null)).toBe(true);
    });

    it("GET /:id reports hasReviewToken true for live tokens without returning the token", async () => {
      const send = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("POST", `${agreementId}/review/send`),
        send.res,
      );
      expect(send.statusCode).toBe(200);

      const detail = createMockResponse();
      await handleLeaseAgreementRequest(authRequest("GET", agreementId), detail.res);
      expect(detail.statusCode).toBe(200);
      const detailBody = JSON.parse(detail.body) as {
        parties: Array<Record<string, unknown>>;
      };
      expect(detailBody.parties).toHaveLength(2);
      for (const party of detailBody.parties) {
        expect(party.hasReviewToken).toBe(true);
        expect(party.reviewLinkStatus).toBe("active");
        expect(party).not.toHaveProperty("reviewToken");
        expect(party).not.toHaveProperty("review_token");
        expect(Object.values(party).every((value) => typeof value !== "string" || !/^https?:\/\//.test(value))).toBe(
          true,
        );
      }

      await db.query(
        `UPDATE public.agreement_parties
         SET review_token_expires_at = NOW() - INTERVAL '1 hour'
         WHERE agreement_id = $1`,
        [agreementId],
      );

      const expired = createMockResponse();
      await handleLeaseAgreementRequest(authRequest("GET", agreementId), expired.res);
      expect(expired.statusCode).toBe(200);
      const expiredBody = JSON.parse(expired.body) as {
        parties: Array<{ hasReviewToken: boolean; reviewLinkStatus: string }>;
      };
      expect(expiredBody.parties.every((party) => party.hasReviewToken === false)).toBe(true);
      expect(expiredBody.parties.every((party) => party.reviewLinkStatus === "expired")).toBe(true);
    });

    it("allows resend while in_review and replaces prior tokens", async () => {
      const first = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("POST", `${agreementId}/review/send`),
        first.res,
      );
      const firstBody = JSON.parse(first.body) as {
        parties: Array<{ reviewLink: string }>;
      };
      const firstTokens = firstBody.parties.map((party) => party.reviewLink.split("/").pop());

      const second = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("POST", `${agreementId}/review/send`),
        second.res,
      );
      const secondBody = JSON.parse(second.body) as {
        parties: Array<{ reviewLink: string }>;
      };
      const secondTokens = secondBody.parties.map((party) => party.reviewLink.split("/").pop());

      expect(second.statusCode).toBe(200);
      expect(secondTokens).not.toEqual(firstTokens);

      const stale = createMockResponse();
      await handleLeaseAgreementReviewRequest(
        publicReviewRequest("GET", firstTokens[0] ?? "missing"),
        stale.res,
      );
      expect(stale.statusCode).toBe(404);
    });
  });

  describe("public review auth boundary", () => {
    async function sendAndGetTokens(): Promise<string[]> {
      const response = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("POST", `${agreementId}/review/send`),
        response.res,
      );
      const body = JSON.parse(response.body) as {
        parties: Array<{ reviewLink: string }>;
      };
      return body.parties.map((party) => {
        const token = party.reviewLink.split("/").pop();
        if (!token) throw new Error("missing token in review link");
        return token;
      });
    }

    it("rejects a wrong token on GET and POST", async () => {
      await sendAndGetTokens();

      const getResponse = createMockResponse();
      await handleLeaseAgreementReviewRequest(
        publicReviewRequest("GET", "definitely-not-a-real-token"),
        getResponse.res,
      );
      expect(getResponse.statusCode).toBe(404);

      const postResponse = createMockResponse();
      await handleLeaseAgreementReviewRequest(
        publicReviewRequest("POST", "definitely-not-a-real-token", {
          decision: "approved",
        }),
        postResponse.res,
      );
      expect(postResponse.statusCode).toBe(404);
    });

    it("rejects an expired token on GET and POST with 410", async () => {
      const [token] = await sendAndGetTokens();
      await db.query(
        `UPDATE public.agreement_parties
         SET review_token_expires_at = now() - interval '1 minute'
         WHERE review_token = $1`,
        [token],
      );

      const getResponse = createMockResponse();
      await handleLeaseAgreementReviewRequest(publicReviewRequest("GET", token), getResponse.res);
      expect(getResponse.statusCode).toBe(410);

      const postResponse = createMockResponse();
      await handleLeaseAgreementReviewRequest(
        publicReviewRequest("POST", token, { decision: "approved" }),
        postResponse.res,
      );
      expect(postResponse.statusCode).toBe(410);
    });

    it("nulls Aadhaar and PAN for every party in the public GET payload", async () => {
      const [token] = await sendAndGetTokens();
      const response = createMockResponse();
      await handleLeaseAgreementReviewRequest(publicReviewRequest("GET", token), response.res);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        parties: Array<{ aadhaar: string | null; pan: string | null; name: string }>;
        broker: { name: string; phone: string } | null;
      };
      expect(body.parties.length).toBeGreaterThan(0);
      for (const party of body.parties) {
        expect(party.aadhaar).toBeNull();
        expect(party.pan).toBeNull();
      }
      expect(body.broker).toEqual({ name: "Ravi Broker", phone: "918860826738" });
    });

    it("accepts changes_requested without a comment", async () => {
      const [token] = await sendAndGetTokens();
      const response = createMockResponse();
      await handleLeaseAgreementReviewRequest(
        publicReviewRequest("POST", token, { decision: "changes_requested" }),
        response.res,
      );
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        decision: string;
        comment: string | null;
      };
      expect(body.decision).toBe("changes_requested");
      expect(body.comment).toBeNull();
    });

    it("allows resubmission before expiry and exposes state on broker GET", async () => {
      const [token] = await sendAndGetTokens();

      const first = createMockResponse();
      await handleLeaseAgreementReviewRequest(
        publicReviewRequest("POST", token, { decision: "approved" }),
        first.res,
      );
      expect(first.statusCode).toBe(200);

      const second = createMockResponse();
      await handleLeaseAgreementReviewRequest(
        publicReviewRequest("POST", token, {
          decision: "changes_requested",
          comment: "Rent should be lower",
        }),
        second.res,
      );
      expect(second.statusCode).toBe(200);

      const detail = createMockResponse();
      await handleLeaseAgreementRequest(authRequest("GET", agreementId), detail.res);
      expect(detail.statusCode).toBe(200);
      const body = JSON.parse(detail.body) as {
        parties: Array<{
          approvalStatus: string;
          reviewComment: string | null;
          reviewedAt: string | null;
        }>;
      };
      const changed = body.parties.find((party) => party.approvalStatus === "changes_requested");
      expect(changed?.reviewComment).toBe("Rent should be lower");
      expect(changed?.reviewedAt).toBeTruthy();
    });
  });

  describe("edit while in_review resets review state", () => {
    async function sendApproveAndCaptureToken(): Promise<string> {
      const send = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("POST", `${agreementId}/review/send`),
        send.res,
      );
      expect(send.statusCode).toBe(200);
      const sendBody = JSON.parse(send.body) as {
        parties: Array<{ reviewLink: string }>;
      };
      const token = sendBody.parties[0]?.reviewLink.split("/").pop();
      if (!token) throw new Error("missing review token");

      const approve = createMockResponse();
      await handleLeaseAgreementReviewRequest(
        publicReviewRequest("POST", token, { decision: "approved" }),
        approve.res,
      );
      expect(approve.statusCode).toBe(200);
      return token;
    }

    it("PATCH while in_review resets all approvals and invalidates tokens", async () => {
      const token = await sendApproveAndCaptureToken();

      const patch = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("PATCH", agreementId, { monthlyRentPaise: 5_000_000 }),
        patch.res,
      );
      expect(patch.statusCode).toBe(200);
      expect(JSON.parse(patch.body)).toMatchObject({
        id: agreementId,
        status: "in_review",
        monthlyRentPaise: 5_000_000,
      });

      const parties = await db.query<{
        approval_status: string;
        review_comment: string | null;
        reviewed_at: string | null;
        review_token: string | null;
        review_token_expires_at: string | null;
      }>(
        `SELECT approval_status, review_comment, reviewed_at, review_token, review_token_expires_at
         FROM public.agreement_parties WHERE agreement_id = $1`,
        [agreementId],
      );
      expect(parties.rows).toHaveLength(2);
      for (const party of parties.rows) {
        expect(party.approval_status).toBe("pending");
        expect(party.review_comment).toBeNull();
        expect(party.reviewed_at).toBeNull();
        expect(party.review_token).toBeNull();
        expect(party.review_token_expires_at).toBeNull();
      }

      const detail = createMockResponse();
      await handleLeaseAgreementRequest(authRequest("GET", agreementId), detail.res);
      expect(detail.statusCode).toBe(200);
      const detailBody = JSON.parse(detail.body) as {
        status: string;
        parties: Array<{ approvalStatus: string; hasReviewToken: boolean; reviewLinkStatus: string }>;
      };
      expect(detailBody.status).toBe("in_review");
      expect(detailBody.parties.every((party) => party.approvalStatus === "pending")).toBe(true);
      expect(detailBody.parties.every((party) => party.hasReviewToken === false)).toBe(true);
      expect(detailBody.parties.every((party) => party.reviewLinkStatus === "none")).toBe(true);

      const stale = createMockResponse();
      await handleLeaseAgreementReviewRequest(publicReviewRequest("GET", token), stale.res);
      expect(stale.statusCode).toBe(404);
    });

    it("PUT inventory while in_review resets approvals and invalidates tokens", async () => {
      const token = await sendApproveAndCaptureToken();

      const replace = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("PUT", `${agreementId}/inventory`, {
          items: [{ description: "sofas - good", quantity: 2, sortOrder: 0 }],
        }),
        replace.res,
      );
      expect(replace.statusCode).toBe(200);

      const parties = await db.query<{
        approval_status: string;
        review_token: string | null;
      }>(
        `SELECT approval_status, review_token
         FROM public.agreement_parties WHERE agreement_id = $1`,
        [agreementId],
      );
      expect(parties.rows.every((row) => row.approval_status === "pending")).toBe(true);
      expect(parties.rows.every((row) => row.review_token === null)).toBe(true);

      const stale = createMockResponse();
      await handleLeaseAgreementReviewRequest(publicReviewRequest("GET", token), stale.res);
      expect(stale.statusCode).toBe(404);
    });

    it("PATCH on a draft agreement leaves parties untouched", async () => {
      const patch = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("PATCH", agreementId, { monthlyRentPaise: 5_500_000 }),
        patch.res,
      );
      expect(patch.statusCode).toBe(200);
      expect(JSON.parse(patch.body)).toMatchObject({
        status: "draft",
        monthlyRentPaise: 5_500_000,
      });

      const parties = await db.query<{
        approval_status: string;
        review_token: string | null;
      }>(
        `SELECT approval_status, review_token
         FROM public.agreement_parties WHERE agreement_id = $1`,
        [agreementId],
      );
      expect(parties.rows).toHaveLength(2);
      expect(parties.rows.every((row) => row.approval_status === "pending")).toBe(true);
      expect(parties.rows.every((row) => row.review_token === null)).toBe(true);

      const status = await db.query<{ status: string }>(
        `SELECT status FROM public.lease_agreements WHERE id = $1`,
        [agreementId],
      );
      expect(status.rows[0]?.status).toBe("draft");
    });
  });

  describe("POST /:id/parties/:partyId/review/shared", () => {
    it("records share confirmation without minting a new token", async () => {
      const send = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("POST", `${agreementId}/review/send`),
        send.res,
      );
      expect(send.statusCode).toBe(200);

      const confirm = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("POST", `${agreementId}/parties/${ownerPartyId}/review/shared`),
        confirm.res,
      );
      expect(confirm.statusCode).toBe(200);
      const confirmBody = JSON.parse(confirm.body) as {
        id: string;
        hasBeenShared: boolean;
        reviewSharedAt: string | null;
        hasReviewToken: boolean;
      };
      expect(confirmBody.id).toBe(ownerPartyId);
      expect(confirmBody.hasBeenShared).toBe(true);
      expect(confirmBody.reviewSharedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(confirmBody.hasReviewToken).toBe(true);

      const detail = createMockResponse();
      await handleLeaseAgreementRequest(authRequest("GET", agreementId), detail.res);
      const detailBody = JSON.parse(detail.body) as {
        parties: Array<{ id: string; hasBeenShared: boolean }>;
      };
      const owner = detailBody.parties.find((party) => party.id === ownerPartyId);
      const tenant = detailBody.parties.find((party) => party.id === tenantPartyId);
      expect(owner?.hasBeenShared).toBe(true);
      expect(tenant?.hasBeenShared).toBe(false);
    });
  });

  describe("POST /:id/parties/:partyId/review/resend", () => {
    async function sendAndApproveBoth(): Promise<{ ownerToken: string; tenantToken: string }> {
      const send = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("POST", `${agreementId}/review/send`),
        send.res,
      );
      expect(send.statusCode).toBe(200);
      const sendBody = JSON.parse(send.body) as {
        parties: Array<{ role: string; reviewLink: string }>;
      };
      const ownerToken = sendBody.parties.find((party) => party.role === "owner")?.reviewLink
        .split("/")
        .pop();
      const tenantToken = sendBody.parties.find((party) => party.role === "tenant")?.reviewLink
        .split("/")
        .pop();
      if (!ownerToken || !tenantToken) throw new Error("missing tokens");

      for (const token of [ownerToken, tenantToken]) {
        const approve = createMockResponse();
        await handleLeaseAgreementReviewRequest(
          publicReviewRequest("POST", token, { decision: "approved" }),
          approve.res,
        );
        expect(approve.statusCode).toBe(200);
      }
      return { ownerToken, tenantToken };
    }

    it("remints one party without touching the other party's token or approval", async () => {
      const { ownerToken, tenantToken } = await sendAndApproveBoth();

      await db.query(
        `UPDATE public.agreement_parties SET review_shared_at = now() WHERE id = $1`,
        [ownerPartyId],
      );

      const resend = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("POST", `${agreementId}/parties/${ownerPartyId}/review/resend`),
        resend.res,
      );
      expect(resend.statusCode).toBe(200);
      const resendBody = JSON.parse(resend.body) as {
        name: string;
        role: string;
        reviewLink: string;
      };
      expect(resendBody).toMatchObject({ name: "Owner One", role: "owner" });
      const newOwnerToken = resendBody.reviewLink.split("/").pop();
      expect(newOwnerToken).toBeTruthy();
      expect(newOwnerToken).not.toBe(ownerToken);

      const parties = await db.query<{
        id: string;
        approval_status: string;
        review_token: string | null;
        review_comment: string | null;
        reviewed_at: string | null;
        review_shared_at: string | null;
      }>(
        `SELECT id, approval_status, review_token, review_comment, reviewed_at, review_shared_at
         FROM public.agreement_parties WHERE agreement_id = $1 ORDER BY sort_order`,
        [agreementId],
      );
      const owner = parties.rows.find((row) => row.id === ownerPartyId);
      const tenant = parties.rows.find((row) => row.id === tenantPartyId);
      expect(owner?.approval_status).toBe("pending");
      expect(owner?.review_comment).toBeNull();
      expect(owner?.reviewed_at).toBeNull();
      expect(owner?.review_shared_at).toBeNull();
      expect(owner?.review_token).toBe(newOwnerToken);
      expect(tenant?.approval_status).toBe("approved");
      expect(tenant?.review_token).toBe(tenantToken);

      const staleOwner = createMockResponse();
      await handleLeaseAgreementReviewRequest(
        publicReviewRequest("GET", ownerToken),
        staleOwner.res,
      );
      expect(staleOwner.statusCode).toBe(404);

      const liveTenant = createMockResponse();
      await handleLeaseAgreementReviewRequest(
        publicReviewRequest("GET", tenantToken),
        liveTenant.res,
      );
      expect(liveTenant.statusCode).toBe(200);

      const status = await db.query<{ status: string }>(
        `SELECT status FROM public.lease_agreements WHERE id = $1`,
        [agreementId],
      );
      expect(status.rows[0]?.status).toBe("in_review");
    });
  });

  describe("GET / list review summary counts", () => {
    it("returns partyCount / approvedCount / changesRequestedCount on each row", async () => {
      const send = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("POST", `${agreementId}/review/send`),
        send.res,
      );
      const sendBody = JSON.parse(send.body) as {
        parties: Array<{ role: string; reviewLink: string }>;
      };
      const ownerToken = sendBody.parties.find((party) => party.role === "owner")?.reviewLink
        .split("/")
        .pop();
      if (!ownerToken) throw new Error("missing owner token");

      const approve = createMockResponse();
      await handleLeaseAgreementReviewRequest(
        publicReviewRequest("POST", ownerToken, { decision: "approved" }),
        approve.res,
      );
      expect(approve.statusCode).toBe(200);

      const tenantToken = sendBody.parties.find((party) => party.role === "tenant")?.reviewLink
        .split("/")
        .pop();
      if (!tenantToken) throw new Error("missing tenant token");
      const changes = createMockResponse();
      await handleLeaseAgreementReviewRequest(
        publicReviewRequest("POST", tenantToken, {
          decision: "changes_requested",
          comment: "Lower rent",
        }),
        changes.res,
      );
      expect(changes.statusCode).toBe(200);

      const list = createMockResponse();
      await handleLeaseAgreementRequest(authRequest("GET", ""), list.res);
      // Collection GET uses empty leasePath — handler treats segments.length === 0
      expect(list.statusCode).toBe(200);
      const listBody = JSON.parse(list.body) as {
        leaseAgreements: Array<{
          id: string;
          partyCount: number;
          approvedCount: number;
          changesRequestedCount: number;
        }>;
      };
      const row = listBody.leaseAgreements.find((agreement) => agreement.id === agreementId);
      expect(row).toMatchObject({
        partyCount: 2,
        approvedCount: 1,
        changesRequestedCount: 1,
        withdrawnCount: 0,
      });
    });
  });

  describe("LeaseReviewDecisionSchema", () => {
    it("accepts approved without a comment", () => {
      expect(LeaseReviewDecisionSchema.safeParse({ decision: "approved" }).success).toBe(true);
    });

    it("accepts changes_requested without a comment", () => {
      expect(
        LeaseReviewDecisionSchema.safeParse({ decision: "changes_requested" }).success,
      ).toBe(true);
    });

    it("accepts withdrawn without a comment", () => {
      expect(LeaseReviewDecisionSchema.safeParse({ decision: "withdrawn" }).success).toBe(true);
    });
  });

  describe("public review withdraw and in_review guard", () => {
    async function sendAndGetTokens(): Promise<{ ownerToken: string; tenantToken: string }> {
      const response = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("POST", `${agreementId}/review/send`),
        response.res,
      );
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        parties: Array<{ role: string; reviewLink: string }>;
      };
      const ownerToken = body.parties.find((party) => party.role === "owner")?.reviewLink
        .split("/")
        .pop();
      const tenantToken = body.parties.find((party) => party.role === "tenant")?.reviewLink
        .split("/")
        .pop();
      if (!ownerToken || !tenantToken) throw new Error("missing tokens");
      return { ownerToken, tenantToken };
    }

    async function postDecision(
      token: string,
      decision: "approved" | "changes_requested" | "withdrawn",
      comment?: string,
    ) {
      const response = createMockResponse();
      await handleLeaseAgreementReviewRequest(
        publicReviewRequest("POST", token, comment ? { decision, comment } : { decision }),
        response.res,
      );
      return response;
    }

    it("withdraws an approved party and is idempotent on a second POST", async () => {
      const { ownerToken } = await sendAndGetTokens();
      expect((await postDecision(ownerToken, "approved")).statusCode).toBe(200);

      const first = await postDecision(ownerToken, "withdrawn");
      expect(first.statusCode).toBe(200);
      const firstBody = JSON.parse(first.body) as {
        decision: string;
        reviewedAt: string | null;
      };
      expect(firstBody.decision).toBe("withdrawn");
      expect(firstBody.reviewedAt).toBeTruthy();

      const second = await postDecision(ownerToken, "withdrawn");
      expect(second.statusCode).toBe(200);
      const secondBody = JSON.parse(second.body) as {
        decision: string;
        reviewedAt: string | null;
      };
      expect(secondBody).toEqual(firstBody);

      const getResponse = createMockResponse();
      await handleLeaseAgreementReviewRequest(
        publicReviewRequest("GET", ownerToken),
        getResponse.res,
      );
      expect(getResponse.statusCode).toBe(200);
      const getBody = JSON.parse(getResponse.body) as {
        viewer: { approvalStatus: string };
      };
      expect(getBody.viewer.approvalStatus).toBe("withdrawn");

      const list = createMockResponse();
      await handleLeaseAgreementRequest(authRequest("GET", ""), list.res);
      const listBody = JSON.parse(list.body) as {
        leaseAgreements: Array<{
          id: string;
          approvedCount: number;
          withdrawnCount: number;
        }>;
      };
      const row = listBody.leaseAgreements.find((agreement) => agreement.id === agreementId);
      expect(row).toMatchObject({ approvedCount: 0, withdrawnCount: 1 });
    });

    it("rejects withdraw unless the party has already approved", async () => {
      const { ownerToken } = await sendAndGetTokens();
      const pending = await postDecision(ownerToken, "withdrawn");
      expect(pending.statusCode).toBe(400);
      expect(JSON.parse(pending.body)).toEqual({ error: WITHDRAW_REQUIRES_APPROVAL_MESSAGE });

      expect((await postDecision(ownerToken, "changes_requested")).statusCode).toBe(200);
      const afterChanges = await postDecision(ownerToken, "withdrawn");
      expect(afterChanges.statusCode).toBe(400);
      expect(JSON.parse(afterChanges.body)).toEqual({ error: WITHDRAW_REQUIRES_APPROVAL_MESSAGE });
    });

    it("rejects withdraw on an expired token without changing approval", async () => {
      const { ownerToken } = await sendAndGetTokens();
      expect((await postDecision(ownerToken, "approved")).statusCode).toBe(200);

      await db.query(
        `UPDATE public.agreement_parties
         SET review_token_expires_at = now() - interval '1 minute'
         WHERE review_token = $1`,
        [ownerToken],
      );

      const withdraw = await postDecision(ownerToken, "withdrawn");
      expect(withdraw.statusCode).toBe(410);

      const party = await db.query<{ approval_status: string }>(
        `SELECT approval_status FROM public.agreement_parties WHERE review_token = $1`,
        [ownerToken],
      );
      expect(party.rows[0]?.approval_status).toBe("approved");
    });

    it("rejects withdraw, approve, and changes_requested after the agreement leaves in_review", async () => {
      const { ownerToken, tenantToken } = await sendAndGetTokens();
      expect((await postDecision(ownerToken, "approved")).statusCode).toBe(200);

      await db.query(
        `UPDATE public.lease_agreements SET status = 'esign_sent' WHERE id = $1`,
        [agreementId],
      );

      const withdraw = await postDecision(ownerToken, "withdrawn");
      expect(withdraw.statusCode).toBe(400);
      expect(JSON.parse(withdraw.body)).toEqual({ error: AGREEMENT_MOVED_FORWARD_MESSAGE });

      const approve = await postDecision(tenantToken, "approved");
      expect(approve.statusCode).toBe(400);
      expect(JSON.parse(approve.body)).toEqual({ error: AGREEMENT_MOVED_FORWARD_MESSAGE });

      await db.query(
        `UPDATE public.lease_agreements SET status = 'signed' WHERE id = $1`,
        [agreementId],
      );

      const changes = await postDecision(tenantToken, "changes_requested");
      expect(changes.statusCode).toBe(400);
      expect(JSON.parse(changes.body)).toEqual({ error: AGREEMENT_MOVED_FORWARD_MESSAGE });

      const owner = await db.query<{ approval_status: string }>(
        `SELECT approval_status FROM public.agreement_parties WHERE id = $1`,
        [ownerPartyId],
      );
      expect(owner.rows[0]?.approval_status).toBe("approved");
    });

    it("rejects approve and changes_requested after withdraw", async () => {
      const { ownerToken } = await sendAndGetTokens();
      expect((await postDecision(ownerToken, "approved")).statusCode).toBe(200);
      expect((await postDecision(ownerToken, "withdrawn")).statusCode).toBe(200);

      const approve = await postDecision(ownerToken, "approved");
      expect(approve.statusCode).toBe(400);
      expect(JSON.parse(approve.body)).toEqual({ error: REVIEW_WITHDRAWN_TERMINAL_MESSAGE });

      const changes = await postDecision(ownerToken, "changes_requested");
      expect(changes.statusCode).toBe(400);
      expect(JSON.parse(changes.body)).toEqual({ error: REVIEW_WITHDRAWN_TERMINAL_MESSAGE });
    });

    it("resend after withdraw remints the party as pending", async () => {
      const { ownerToken } = await sendAndGetTokens();
      expect((await postDecision(ownerToken, "approved")).statusCode).toBe(200);
      expect((await postDecision(ownerToken, "withdrawn")).statusCode).toBe(200);

      const resend = createMockResponse();
      await handleLeaseAgreementRequest(
        authRequest("POST", `${agreementId}/parties/${ownerPartyId}/review/resend`),
        resend.res,
      );
      expect(resend.statusCode).toBe(200);

      const party = await db.query<{
        approval_status: string;
        review_comment: string | null;
        reviewed_at: string | null;
        review_token: string | null;
      }>(
        `SELECT approval_status, review_comment, reviewed_at, review_token
         FROM public.agreement_parties WHERE id = $1`,
        [ownerPartyId],
      );
      expect(party.rows[0]?.approval_status).toBe("pending");
      expect(party.rows[0]?.review_comment).toBeNull();
      expect(party.rows[0]?.reviewed_at).toBeNull();
      expect(party.rows[0]?.review_token).toBeTruthy();
      expect(party.rows[0]?.review_token).not.toBe(ownerToken);
    });
  });
});
