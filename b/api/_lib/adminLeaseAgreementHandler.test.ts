import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PGlite } from "../../lib/db/node_modules/@electric-sql/pglite/dist/index.js";

const ADMIN_PHONE = "8860826738";
const AGREEMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const mockState = vi.hoisted(() => {
  class SignedPdfBlobError extends Error {
    readonly code: "not_configured" | "invalid_pdf" | "too_large" | "store_failed" | "not_found";

    constructor(
      code: "not_configured" | "invalid_pdf" | "too_large" | "store_failed" | "not_found",
      message: string,
    ) {
      super(message);
      this.name = "SignedPdfBlobError";
      this.code = code;
    }
  }

  return {
    pool: null as
      | {
          query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
          connect: () => Promise<{
            query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
            release: () => void;
          }>;
        }
      | null,
    putSignedPdf: vi.fn(async () => ({
      pathname: "signed-lease-agreements/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/signed.pdf",
    })),
    sendSigningNotificationEmail: vi.fn(async () => true),
    adminOk: true,
    SignedPdfBlobError,
  };
});

vi.mock("./vercelSyncDb.js", () => ({
  getPool: () => {
    if (!mockState.pool) throw new Error("Mock pool not initialized");
    return mockState.pool;
  },
}));

vi.mock("./adminAuth.js", () => ({
  assertAdminAuth: vi.fn(async () =>
    mockState.adminOk
      ? { ok: true as const, phone: ADMIN_PHONE }
      : { ok: false as const, status: 401, error: "Unauthorized" },
  ),
  readAuthorizationHeader: vi.fn(() => "Bearer test-token"),
}));

vi.mock("./signedPdfBlob.js", () => ({
  SignedPdfBlobError: mockState.SignedPdfBlobError,
  SIGNED_PDF_MAX_BYTES: 10 * 1024 * 1024,
  assertPdfBytes: (bytes: Buffer) => {
    if (bytes.subarray(0, 4).toString() !== "%PDF") {
      throw new mockState.SignedPdfBlobError("invalid_pdf", "Signed file must be a PDF.");
    }
  },
  putSignedPdf: mockState.putSignedPdf,
  getSignedPdfBytes: vi.fn(async () => Buffer.from("%PDF-1.4 signed")),
  deleteSignedPdf: vi.fn(async () => undefined),
}));

vi.mock("./signingEmail.js", () => ({
  sendSigningNotificationEmail: mockState.sendSigningNotificationEmail,
}));

import {
  ADMIN_SIGNED_PDF_WRONG_STATUS_ERROR,
  applyAdminSignedPdfUpload,
  handleAdminLeaseAgreementRequest,
} from "./adminLeaseAgreementHandler.js";

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

const PDF_BYTES = Buffer.from("%PDF-1.4 test signed agreement");

describe("admin lease agreement signed upload", () => {
  let db: PGlite;

  beforeEach(async () => {
    mockState.adminOk = true;
    mockState.putSignedPdf.mockReset();
    mockState.putSignedPdf.mockResolvedValue({
      pathname: "signed-lease-agreements/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/signed.pdf",
    });
    mockState.sendSigningNotificationEmail.mockReset();
    mockState.sendSigningNotificationEmail.mockResolvedValue(true);

    db = new PGlite();
    await db.exec(`
      CREATE TABLE public.lease_agreements (
        id uuid PRIMARY KEY,
        created_by_user_id uuid NOT NULL,
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
        approval_status text NOT NULL DEFAULT 'pending',
        review_comment text,
        reviewed_at timestamptz,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE public.agreement_inventory_items (
        id uuid PRIMARY KEY,
        agreement_id uuid NOT NULL REFERENCES public.lease_agreements(id) ON DELETE CASCADE,
        description text NOT NULL,
        quantity integer NOT NULL DEFAULT 1,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await db.query(
      `INSERT INTO public.lease_agreements (id, created_by_user_id, status, property_address)
       VALUES ($1, '00000000-0000-4000-8000-000000000001', 'esign_sent', '1 Main Road')`,
      [AGREEMENT_ID],
    );

    const query = async (sql: string, params?: unknown[]) => {
      const result = await db.query(sql, params);
      return { rows: result.rows ?? [], rowCount: result.rows?.length ?? 0 };
    };
    mockState.pool = {
      query,
      connect: async () => ({ query, release() {} }),
    };
  });

  afterEach(async () => {
    mockState.pool = null;
    await db.close();
  });

  it("rejects mark-signed when the agreement is still in_review", async () => {
    await db.query(`UPDATE public.lease_agreements SET status = 'in_review' WHERE id = $1`, [
      AGREEMENT_ID,
    ]);
    const result = await applyAdminSignedPdfUpload({
      agreementId: AGREEMENT_ID,
      uploadedByPhone: ADMIN_PHONE,
      bytes: PDF_BYTES,
      contentType: "application/pdf",
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: ADMIN_SIGNED_PDF_WRONG_STATUS_ERROR,
    });
    const persisted = await db.query<{ status: string; signed_pdf_pathname: string | null }>(
      `SELECT status, signed_pdf_pathname FROM public.lease_agreements WHERE id = $1`,
      [AGREEMENT_ID],
    );
    expect(persisted.rows[0]).toMatchObject({ status: "in_review", signed_pdf_pathname: null });
    expect(mockState.putSignedPdf).not.toHaveBeenCalled();
  });

  it("leaves status unchanged when Blob upload fails", async () => {
    mockState.putSignedPdf.mockRejectedValue(
      new mockState.SignedPdfBlobError("store_failed", "Could not store the signed PDF."),
    );
    const result = await applyAdminSignedPdfUpload({
      agreementId: AGREEMENT_ID,
      uploadedByPhone: ADMIN_PHONE,
      bytes: PDF_BYTES,
      contentType: "application/pdf",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(502);
    const persisted = await db.query<{ status: string }>(
      `SELECT status FROM public.lease_agreements WHERE id = $1`,
      [AGREEMENT_ID],
    );
    expect(persisted.rows[0]?.status).toBe("esign_sent");
  });

  it("marks esign_sent as signed after a successful Blob put", async () => {
    const result = await applyAdminSignedPdfUpload({
      agreementId: AGREEMENT_ID,
      uploadedByPhone: ADMIN_PHONE,
      bytes: PDF_BYTES,
      contentType: "application/pdf",
    });
    expect(result.ok).toBe(true);
    const persisted = await db.query<{
      status: string;
      signed_pdf_pathname: string | null;
      signed_uploaded_by_phone: string | null;
    }>(
      `SELECT status, signed_pdf_pathname, signed_uploaded_by_phone
       FROM public.lease_agreements WHERE id = $1`,
      [AGREEMENT_ID],
    );
    expect(persisted.rows[0]).toMatchObject({
      status: "signed",
      signed_pdf_pathname: "signed-lease-agreements/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/signed.pdf",
      signed_uploaded_by_phone: ADMIN_PHONE,
    });
  });

  it("allows re-upload while already signed", async () => {
    await db.query(
      `UPDATE public.lease_agreements
       SET status = 'signed', signed_pdf_pathname = 'old.pdf', signed_at = now()
       WHERE id = $1`,
      [AGREEMENT_ID],
    );
    mockState.putSignedPdf.mockResolvedValue({ pathname: "new.pdf" });
    const result = await applyAdminSignedPdfUpload({
      agreementId: AGREEMENT_ID,
      uploadedByPhone: ADMIN_PHONE,
      bytes: PDF_BYTES,
      contentType: "application/pdf",
    });
    expect(result.ok).toBe(true);
    const persisted = await db.query<{ status: string; signed_pdf_pathname: string | null }>(
      `SELECT status, signed_pdf_pathname FROM public.lease_agreements WHERE id = $1`,
      [AGREEMENT_ID],
    );
    expect(persisted.rows[0]).toMatchObject({ status: "signed", signed_pdf_pathname: "new.pdf" });
  });

  it("rejects unauthenticated admin list requests", async () => {
    mockState.adminOk = false;
    const response = createMockResponse();
    await handleAdminLeaseAgreementRequest(
      { method: "GET", headers: {}, query: {} } as unknown as VercelRequest,
      response.res,
    );
    expect(response.statusCode).toBe(401);
  });

  it("lists agreements without exposing the blob pathname", async () => {
    await db.query(
      `UPDATE public.lease_agreements
       SET status = 'signed', signed_pdf_pathname = 'secret-path.pdf', signed_at = now()
       WHERE id = $1`,
      [AGREEMENT_ID],
    );
    const response = createMockResponse();
    await handleAdminLeaseAgreementRequest(
      { method: "GET", headers: { authorization: "Bearer test" }, query: {} } as unknown as VercelRequest,
      response.res,
    );
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      leaseAgreements: Array<Record<string, unknown>>;
    };
    expect(body.leaseAgreements[0]).toMatchObject({
      id: AGREEMENT_ID,
      hasSignedPdf: true,
      status: "signed",
    });
    expect(JSON.stringify(body)).not.toContain("secret-path.pdf");
  });

  it("returns full agreement detail with party KYC and inventory for admin verification", async () => {
    await db.query(
      `UPDATE public.lease_agreements
       SET execution_date = '2026-07-27',
           effective_date = '2026-08-01',
           end_date = '2027-07-31',
           execution_city = 'Hyderabad',
           duration_months = 12,
           min_stay_months = 6,
           notice_period_licensee_months = 2,
           notice_period_licensor_months = 2,
           monthly_rent_paise = 6000000,
           security_deposit_paise = 12000000,
           rent_due_day = 5,
           maintenance_included = false,
           monthly_maintenance_paise = 150000,
           property_address = '1 Main Road',
           area_sqft = 1200,
           facing = 'East',
           car_parking_count = 1
       WHERE id = $1`,
      [AGREEMENT_ID],
    );
    await db.query(
      `INSERT INTO public.agreement_parties (
         id, agreement_id, role, name, phone, title, age, address, aadhaar, pan, email,
         is_primary, approval_status, review_comment, sort_order
       ) VALUES
         ('11111111-1111-4111-8111-111111111111', $1, 'owner', 'Owner One', '9876543210', 'Mr.', 42,
          '1 Main Road', '967132807649', 'ABCDE1234F', 'owner@example.com', true, 'approved', NULL, 0),
         ('22222222-2222-4222-8222-222222222222', $1, 'tenant', 'Tenant One', '9876543211', 'Ms.', 31,
          '2 Side Street', '234123412346', 'FGHIJ5678K', 'tenant@example.com', true, 'pending', NULL, 1)`,
      [AGREEMENT_ID],
    );
    await db.query(
      `INSERT INTO public.agreement_inventory_items (id, agreement_id, description, quantity, sort_order)
       VALUES ('33333333-3333-4333-8333-333333333333', $1, 'Sofa', 1, 0)`,
      [AGREEMENT_ID],
    );

    const response = createMockResponse();
    await handleAdminLeaseAgreementRequest(
      {
        method: "GET",
        headers: { authorization: "Bearer test" },
        query: { leasePath: AGREEMENT_ID },
      } as unknown as VercelRequest,
      response.res,
    );

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body).toMatchObject({
      id: AGREEMENT_ID,
      propertyAddress: "1 Main Road",
      executionDate: "2026-07-27",
      effectiveDate: "2026-08-01",
      endDate: "2027-07-31",
      executionCity: "Hyderabad",
      durationMonths: 12,
      minStayMonths: 6,
      noticePeriodLicenseeMonths: 2,
      noticePeriodLicensorMonths: 2,
      monthlyRentPaise: 6000000,
      securityDepositPaise: 12000000,
      rentDueDay: 5,
      maintenanceIncluded: false,
      monthlyMaintenancePaise: 150000,
      areaSqft: 1200,
      facing: "East",
      carParkingCount: 1,
    });
    expect(body.parties).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        role: "owner",
        name: "Owner One",
        phone: "9876543210",
        title: "Mr.",
        age: 42,
        address: "1 Main Road",
        aadhaar: "967132807649",
        pan: "ABCDE1234F",
        email: "owner@example.com",
        isPrimary: true,
        sortOrder: 0,
        approvalStatus: "approved",
        reviewComment: null,
        reviewedAt: null,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        role: "tenant",
        name: "Tenant One",
        phone: "9876543211",
        title: "Ms.",
        age: 31,
        address: "2 Side Street",
        aadhaar: "234123412346",
        pan: "FGHIJ5678K",
        email: "tenant@example.com",
        isPrimary: true,
        sortOrder: 1,
        approvalStatus: "pending",
        reviewComment: null,
        reviewedAt: null,
      },
    ]);
    expect(body.inventory).toEqual([
      {
        id: "33333333-3333-4333-8333-333333333333",
        description: "Sofa",
        quantity: 1,
        sortOrder: 0,
      },
    ]);
  });
});
