import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PGlite } from "../../lib/db/node_modules/@electric-sql/pglite/dist/index.js";
import { dedupePartyContactRows } from "./partiesHandler.js";

const mockState = vi.hoisted(() => ({
  userId: "00000000-0000-4000-8000-000000000001",
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

const BROKER_A = "00000000-0000-4000-8000-000000000001";
const BROKER_B = "00000000-0000-4000-8000-000000000002";

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
      userId: mockState.userId,
    },
  })),
}));

import { handlePartiesRequest } from "./partiesHandler.js";

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
    get body() {
      return body;
    },
  };
}

function partiesRequest(role: string | undefined): VercelRequest {
  return {
    method: "GET",
    headers: {
      authorization: "Bearer test-token",
    },
    query: role === undefined ? {} : { role },
    body: null,
  } as unknown as VercelRequest;
}

describe("dedupePartyContactRows", () => {
  it("uses the newest party row name and surfaces alternate names", () => {
    const summaries = dedupePartyContactRows([
      {
        phone: "9849012345",
        name: "Older Name",
        email: "old@example.com",
        address: "Old address",
        role: "owner",
        partyCreatedAt: "2026-07-01T00:00:00.000Z",
        agreementId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        propertyAddress: "1 Main Road",
        status: "in_review",
      },
      {
        phone: "9849012345",
        name: "Newer Name",
        email: "new@example.com",
        address: "New address",
        role: "owner",
        partyCreatedAt: "2026-07-30T00:00:00.000Z",
        agreementId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        propertyAddress: "2 Side Street",
        status: "draft",
      },
    ]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      phone: "9849012345",
      name: "Newer Name",
      email: "new@example.com",
      address: "New address",
      alternateNames: ["Older Name"],
      agreementCount: 2,
    });
    expect(summaries[0]?.agreements).toEqual([
      {
        agreementId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        propertyAddress: "1 Main Road",
        status: "in_review",
      },
      {
        agreementId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        propertyAddress: "2 Side Street",
        status: "draft",
      },
    ]);
  });
});

describe("GET /api/v1/parties ownership", () => {
  let db: PGlite;

  beforeEach(async () => {
    mockState.userId = BROKER_A;
    db = new PGlite();
    await db.exec(`
      CREATE TABLE public.lease_agreements (
        id uuid PRIMARY KEY,
        created_by_user_id uuid NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        property_address text,
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
        email text,
        address text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await db.query(
      `INSERT INTO public.lease_agreements (id, created_by_user_id, status, property_address)
       VALUES
         ('11111111-1111-4111-8111-111111111111', $1, 'draft', 'Broker A Property'),
         ('22222222-2222-4222-8222-222222222222', $2, 'draft', 'Broker B Property')`,
      [BROKER_A, BROKER_B],
    );

    await db.query(
      `INSERT INTO public.agreement_parties (
         id, agreement_id, role, name, phone, email, address, created_at
       ) VALUES
         (
           'aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
           '11111111-1111-4111-8111-111111111111',
           'owner', 'Owner A', '9000000001', 'a@example.com', 'A Address',
           '2026-07-30T10:00:00.000Z'
         ),
         (
           'bbbb2222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
           '22222222-2222-4222-8222-222222222222',
           'owner', 'Owner B', '9000000002', 'b@example.com', 'B Address',
           '2026-07-30T11:00:00.000Z'
         ),
         (
           'cccc3333-cccc-4ccc-8ccc-cccccccccccc',
           '11111111-1111-4111-8111-111111111111',
           'tenant', 'Tenant A', '9000000011', NULL, NULL,
           '2026-07-30T12:00:00.000Z'
         )`,
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

  it("returns only parties from the authenticated broker's own agreements", async () => {
    mockState.userId = BROKER_A;
    const response = createMockResponse();
    await handlePartiesRequest(partiesRequest("owner"), response.res);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      parties: Array<{
        name: string;
        phone: string;
        agreementCount: number;
        agreements: Array<{
          agreementId: string;
          propertyAddress: string | null;
          status: string;
        }>;
      }>;
    };

    expect(body.parties).toHaveLength(1);
    expect(body.parties[0]).toMatchObject({
      name: "Owner A",
      phone: "9000000001",
      agreementCount: 1,
    });
    expect(body.parties[0]?.agreements).toEqual([
      {
        agreementId: "11111111-1111-4111-8111-111111111111",
        propertyAddress: "Broker A Property",
        status: "draft",
      },
    ]);
    expect(body.parties.every((party) => party.phone !== "9000000002")).toBe(true);
    expect(
      body.parties.every((party) =>
        party.agreements.every((agreement) => agreement.agreementId.startsWith("11111111")),
      ),
    ).toBe(true);
  });

  it("rejects missing or invalid role", async () => {
    const missing = createMockResponse();
    await handlePartiesRequest(partiesRequest(undefined), missing.res);
    expect(missing.statusCode).toBe(400);

    const invalid = createMockResponse();
    await handlePartiesRequest(partiesRequest("broker"), invalid.res);
    expect(invalid.statusCode).toBe(400);
  });

  it("filters by role", async () => {
    const response = createMockResponse();
    await handlePartiesRequest(partiesRequest("tenant"), response.res);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { parties: Array<{ name: string; role: string }> };
    expect(body.parties).toEqual([
      expect.objectContaining({ name: "Tenant A", role: "tenant" }),
    ]);
  });
});
