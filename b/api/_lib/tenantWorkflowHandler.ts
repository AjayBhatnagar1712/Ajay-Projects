import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import {
  findAgreementInBlobList,
  mergeAgreementIntoBlobList,
  type AgreementBlobRecord,
} from "@workspace/tenant-workflow";
import { adaptBlobWrite } from "./blobSyncAdapter.js";
import { json, readJsonBody } from "./http.js";
import { assertSyncAccountAuth } from "./syncAuth.js";
import { releaseEscrowForAgreement } from "./paymentEscrowHandler.js";
import { getPool, normalizePhone } from "./vercelSyncDb.js";

const phoneSchema = z
  .string()
  .transform((value) => normalizePhone(value))
  .refine((value) => value.length === 10, "phone must be a 10-digit number");

const agreementSnapshotSchema = z.object({
  ownerName: z.string(),
  ownerContact: z.string().optional(),
  tenantName: z.string(),
  propertyAddress: z.string(),
  propertyType: z.string().optional(),
  leaseStartDate: z.string(),
  leaseEndDate: z.string().optional(),
  monthlyRent: z.string(),
  securityDeposit: z.string(),
  rentDueDay: z.string(),
  lockInPeriod: z.string(),
  noticePeriod: z.string(),
  brokerageAmount: z.string().optional(),
  agreementText: z.string().optional(),
});

const agreementRecordSchema = z.object({
  id: z.string().trim().min(1),
  propertyId: z.string().optional(),
  propertyTitle: z.string().optional(),
  ownerName: z.string().optional(),
  ownerContact: z.string().optional(),
  tenantId: z.string().optional(),
  tenantName: z.string().optional(),
  tenantContact: z.string().optional(),
  tenantAadhaar: z.string().optional(),
  tenantPan: z.string().optional(),
  coTenantName: z.string().optional(),
  coTenantContact: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  monthlyRent: z.string().optional(),
  securityDeposit: z.string().optional(),
  lockInPeriod: z.string().optional(),
  noticePeriod: z.string().optional(),
  rentDueDay: z.string().optional(),
  maintenanceCharges: z.string().optional(),
  maintenanceIncluded: z.boolean().optional(),
  brokerageAmount: z.string().optional(),
  brokeragePaidBy: z.string().optional(),
  brokerageMode: z.string().optional(),
  customText: z.string().optional(),
  status: z.string().optional(),
  createdAt: z.number().optional(),
});

const sendForESignBodySchema = z.object({
  phone: phoneSchema,
  role: z.enum(["owner", "broker"]),
  agreementId: z.string().trim().min(1),
  tenantPhone: phoneSchema,
  tenantName: z.string().trim().min(1),
  propertyId: z.string().optional(),
  propertyLabel: z.string().trim().min(1),
  propertyAddress: z.string().optional(),
  propertyImage: z.string().optional(),
  monthlyRent: z.string().optional(),
  securityDeposit: z.string().optional(),
  propertyType: z.string().optional(),
  ownerName: z.string().optional(),
  ownerContact: z.string().optional(),
  brokerName: z.string().optional(),
  requesterRole: z.enum(["owner", "broker"]),
  requesterName: z.string().trim().min(1),
  agreementSnapshot: agreementSnapshotSchema,
  agreementRecord: agreementRecordSchema.optional(),
});

const patchWorkspaceBodySchema = z.object({
  lifecycleStage: z.string().trim().min(1).optional(),
  esignSignedPartyPhones: z.array(phoneSchema).optional(),
  preSigningEscrowType: z.enum(["brokerage_tenant", "security_deposit"]).optional(),
  escrowPaymentId: z.string().optional(),
  escrowPaymentStatus: z.enum(["created", "paid", "settled", "failed"]).optional(),
  tenantName: z.string().trim().min(1).optional(),
  propertyLabel: z.string().trim().min(1).optional(),
  propertyId: z.string().optional(),
  propertyAddress: z.string().optional(),
  propertyImage: z.string().optional(),
  monthlyRent: z.string().optional(),
  securityDeposit: z.string().optional(),
  propertyType: z.string().optional(),
  ownerName: z.string().optional(),
  ownerContact: z.string().optional(),
  brokerName: z.string().optional(),
  requesterName: z.string().optional(),
  requesterRole: z.enum(["owner", "broker"]).optional(),
  documentUploadToken: z.string().optional(),
  documentUploadStatus: z.string().optional(),
  agreementId: z.string().optional(),
});

const recordPartySignatureBodySchema = z.object({
  phone: phoneSchema,
  role: z.enum(["owner", "broker"]),
  agreementId: z.string().trim().min(1),
  tenantPhone: phoneSchema,
  signedPartyPhone: phoneSchema,
  fileName: z.string().trim().min(1),
  fileUrl: z.string().trim().min(1),
});

function expandOwnerContacts(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const split = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (split.length > 0) {
    return split.map((contact) => normalizePhone(contact)).filter((digits) => digits.length === 10);
  }
  const digits = normalizePhone(raw);
  return digits.length === 10 ? [digits] : [];
}

function buildSigningStatusPayload(
  agreementId: string,
  workspace: TenantWorkspaceRecord,
  ownerContact?: string,
) {
  const signed = new Set((workspace.esignSignedPartyPhones ?? []).map((phone) => normalizePhone(phone)));
  const tenantPhone = normalizePhone(workspace.phone);
  const ownerDigits = ownerContact ? normalizePhone(ownerContact) : "";
  const tenantSigned = tenantPhone.length === 10 && signed.has(tenantPhone);
  const ownerSigned = ownerDigits.length === 10 && signed.has(ownerDigits);
  const signingStarted =
    workspace.lifecycleStage === "esign_document_upload" ||
    workspace.lifecycleStage === "awaiting_esign_signatures" ||
    workspace.lifecycleStage === "rent_payment_due" ||
    workspace.lifecycleStage === "agreement_signed";

  return {
    agreementId,
    lifecycleStage: workspace.lifecycleStage,
    tenantPhone,
    ownerContact,
    esignSignedPartyPhones: [...signed],
    tenantSigned,
    ownerSigned,
    allSigned: tenantSigned && ownerSigned,
    ownerUploadRequired: signingStarted && !ownerSigned,
  };
}

async function loadRequesterAgreement(
  requesterPhone: string,
  requesterRole: string,
  agreementId: string,
): Promise<AgreementBlobRow | null> {
  const agreements = await readAgreementsBlob(requesterPhone, requesterRole);
  return agreements.find((row) => row.id === agreementId) ?? null;
}

async function persistSignedUpload(
  tenantPhone: string,
  agreementId: string,
  signedPartyPhone: string,
  fileName: string,
  fileUrl: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO public.user_data (phone, role, data_key, value, updated_at)
     VALUES ($1, 'tenant', $2, $3, NOW())
     ON CONFLICT (phone, role, data_key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [
      tenantPhone,
      `agreement_signed_upload_${agreementId}_${signedPartyPhone}`,
      JSON.stringify({
        agreementId,
        signedPartyPhone,
        fileName,
        fileUrl,
        uploadedAt: Date.now(),
      }),
    ],
  );
}

async function handleAgreementStatus(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const segments = workflowPathSegments(req);
  const agreementId = segments[1] ?? "";
  if (segments[0] !== "agreement-status" || !agreementId) {
    json(res, 404, { error: "Not found" });
    return;
  }

  const phoneRaw = typeof req.query.phone === "string" ? req.query.phone : "";
  const roleRaw = typeof req.query.role === "string" ? req.query.role : "";
  const phoneParsed = phoneSchema.safeParse(phoneRaw);
  if (!phoneParsed.success || (roleRaw !== "owner" && roleRaw !== "broker")) {
    json(res, 400, { error: "Invalid requester phone or role" });
    return;
  }

  const auth = await assertSyncAccountAuth(requestAuthorization(req), phoneParsed.data);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  const agreement = await loadRequesterAgreement(phoneParsed.data, roleRaw, agreementId);
  if (!agreement) {
    json(res, 404, { error: "Agreement not found" });
    return;
  }

  const tenantPhone = tenantPhoneFromContact(agreement.tenantContact ?? "");
  if (tenantPhone.length !== 10) {
    json(res, 400, { error: "Agreement is missing tenant contact" });
    return;
  }

  const workspace = await readTenantWorkspace(tenantPhone);
  if (!workspace || workspace.agreementId !== agreementId) {
    json(res, 404, { error: "Tenant workflow not started for this agreement" });
    return;
  }

  json(res, 200, {
    ok: true,
    status: buildSigningStatusPayload(agreementId, workspace, agreement.ownerContact),
  });
}

async function handleRecordPartySignature(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const rawBody = readJsonBody(req);
  if (rawBody === null) {
    json(res, 400, { error: "Malformed JSON body" });
    return;
  }

  const parsed = recordPartySignatureBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body";
    json(res, 400, { error: message });
    return;
  }

  const body = parsed.data;
  const auth = await assertSyncAccountAuth(requestAuthorization(req), body.phone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  const agreement = await loadRequesterAgreement(body.phone, body.role, body.agreementId);
  if (!agreement) {
    json(res, 404, { error: "Agreement not found" });
    return;
  }

  const agreementTenantPhone = tenantPhoneFromContact(agreement.tenantContact ?? "");
  if (agreementTenantPhone !== body.tenantPhone) {
    json(res, 400, { error: "Tenant phone does not match agreement" });
    return;
  }

  const ownerPhones = expandOwnerContacts(agreement.ownerContact);
  if (!ownerPhones.includes(body.signedPartyPhone)) {
    json(res, 400, { error: "Signed party phone is not an owner on this agreement" });
    return;
  }

  const existing = await readTenantWorkspace(body.tenantPhone);
  if (!existing || existing.agreementId !== body.agreementId) {
    json(res, 404, { error: "Tenant workspace not found for agreement" });
    return;
  }

  const signedPhones = mergeSignedPhones(existing.esignSignedPartyPhones, body.signedPartyPhone);
  const merged = await tryCompleteAgreementSignatures(
    {
      ...existing,
      lifecycleStage: "awaiting_esign_signatures",
    },
    signedPhones,
  );

  await persistSignedUpload(
    body.tenantPhone,
    body.agreementId,
    body.signedPartyPhone,
    body.fileName,
    body.fileUrl,
  );
  await writeTenantWorkspace(body.tenantPhone, merged);

  const allSigned = merged.lifecycleStage === "rent_payment_due";
  if (allSigned) {
    await updateAgreementStatusInBlob(body.phone, body.role, body.agreementId, "Signed");
  }

  json(res, 200, {
    ok: true,
    allSigned,
    status: buildSigningStatusPayload(body.agreementId, merged, agreement.ownerContact),
  });
}


type TenantWorkspaceRecord = {
  phone: string;
  tenantName: string;
  propertyId?: string;
  propertyLabel: string;
  propertyAddress?: string;
  propertyImage?: string;
  monthlyRent?: string;
  securityDeposit?: string;
  propertyType?: string;
  ownerName?: string;
  ownerContact?: string;
  brokerName?: string;
  requesterName?: string;
  requesterRole?: "owner" | "broker";
  agreementId?: string;
  documentUploadToken?: string;
  documentUploadStatus?: string;
  lifecycleStage?: string;
  preSigningEscrowType?: "brokerage_tenant" | "security_deposit";
  escrowPaymentId?: string;
  escrowPaymentStatus?: string;
  esignSignedPartyPhones?: string[];
  agreementSnapshot?: z.infer<typeof agreementSnapshotSchema>;
  updatedAt: number;
};

type AgreementBlobRow = AgreementBlobRecord;

function requestAuthorization(req: VercelRequest): string | undefined {
  const header = req.headers.authorization ?? req.headers.Authorization;
  if (Array.isArray(header)) return header[0];
  return header;
}

function workflowPathSegments(req: VercelRequest): string[] {
  const raw = req.query.workflowPath ?? req.query.path;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.length > 0) return raw.split("/").filter(Boolean);
  return [];
}

function parseWorkspace(raw: string | undefined): TenantWorkspaceRecord | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TenantWorkspaceRecord;
  } catch {
    return null;
  }
}

function tenantPhoneFromContact(contact: string): string {
  return normalizePhone(contact);
}

async function readTenantWorkspace(tenantPhone: string): Promise<TenantWorkspaceRecord | null> {
  const pool = getPool();
  const result = await pool.query<{ value: string }>(
    `SELECT value FROM public.user_data
     WHERE phone = $1 AND role = 'tenant' AND data_key = 'tenant_workspace'
     LIMIT 1`,
    [tenantPhone],
  );
  return parseWorkspace(result.rows[0]?.value);
}

async function writeTenantWorkspace(tenantPhone: string, workspace: TenantWorkspaceRecord): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO public.user_data (phone, role, data_key, value, updated_at)
     VALUES ($1, 'tenant', 'tenant_workspace', $2, NOW())
     ON CONFLICT (phone, role, data_key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [tenantPhone, JSON.stringify(workspace)],
  );
}

async function readAgreementsBlob(
  requesterPhone: string,
  requesterRole: string,
): Promise<AgreementBlobRow[]> {
  const pool = getPool();
  const result = await pool.query<{ value: string }>(
    `SELECT value FROM public.user_data
     WHERE phone = $1 AND role = $2 AND data_key = 'agreements'
     LIMIT 1`,
    [requesterPhone, requesterRole],
  );
  const raw = result.rows[0]?.value;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AgreementBlobRow[];
  } catch {
    return [];
  }
}

async function writeAgreementsBlob(
  requesterPhone: string,
  requesterRole: string,
  agreements: AgreementBlobRow[],
): Promise<void> {
  const payload = JSON.stringify(agreements);
  const pool = getPool();
  await pool.query(
    `INSERT INTO public.user_data (phone, role, data_key, value, updated_at)
     VALUES ($1, $2, 'agreements', $3, NOW())
     ON CONFLICT (phone, role, data_key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [requesterPhone, requesterRole, payload],
  );
  await adaptBlobWrite(requesterPhone, requesterRole, "agreements", payload);
}

async function upsertAgreementInBlob(
  requesterPhone: string,
  requesterRole: string,
  record: AgreementBlobRow,
): Promise<void> {
  const agreements = await readAgreementsBlob(requesterPhone, requesterRole);
  const next = mergeAgreementIntoBlobList(agreements, record);
  await writeAgreementsBlob(requesterPhone, requesterRole, next);
}

async function updateAgreementStatusInBlob(
  requesterPhone: string,
  requesterRole: string,
  agreementId: string,
  status: string,
): Promise<void> {
  const agreements = await readAgreementsBlob(requesterPhone, requesterRole);
  if (agreements.length === 0) return;
  const next = agreements.map((row) => (row.id === agreementId ? { ...row, status } : row));
  await writeAgreementsBlob(requesterPhone, requesterRole, next);
}

function mergeSignedPhones(existing: string[] | undefined, phone: string): string[] {
  const set = new Set((existing ?? []).map((row) => normalizePhone(row)));
  set.add(phone);
  return [...set];
}

function requiredSignaturePhones(workspace: TenantWorkspaceRecord): string[] {
  const phones: string[] = [normalizePhone(workspace.phone)];
  const ownerContact =
    workspace.ownerContact ??
    workspace.agreementSnapshot?.ownerContact;
  if (ownerContact) {
    phones.push(normalizePhone(ownerContact));
  }
  return phones.filter((row) => row.length === 10);
}

async function tryCompleteAgreementSignatures(
  workspace: TenantWorkspaceRecord,
  signedPhones: string[],
): Promise<TenantWorkspaceRecord> {
  const required = requiredSignaturePhones(workspace);
  const signed = new Set(signedPhones.map((row) => normalizePhone(row)));
  const allSigned = required.every((phone) => signed.has(phone));

  const base = {
    ...workspace,
    esignSignedPartyPhones: [...signed],
    updatedAt: Date.now(),
  };

  if (!allSigned) {
    return {
      ...base,
      lifecycleStage: "awaiting_esign_signatures",
    };
  }

  if (workspace.agreementId) {
    await releaseEscrowForAgreement(workspace.agreementId);
  }

  return {
    ...base,
    lifecycleStage: "rent_payment_due",
  };
}

async function handleSendForESign(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const rawBody = readJsonBody(req);
  if (rawBody === null) {
    json(res, 400, { error: "Malformed JSON body" });
    return;
  }

  const parsed = sendForESignBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body";
    json(res, 400, { error: message });
    return;
  }

  const body = parsed.data;
  const auth = await assertSyncAccountAuth(requestAuthorization(req), body.phone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  if (body.role !== body.requesterRole) {
    json(res, 403, { error: "Requester role mismatch" });
    return;
  }

  if (body.agreementRecord) {
    await upsertAgreementInBlob(body.phone, body.role, body.agreementRecord);
  }

  const agreements = await readAgreementsBlob(body.phone, body.role);
  const agreement = findAgreementInBlobList(agreements, body.agreementId);
  if (!agreement) {
    json(res, 404, { error: "Agreement not found" });
    return;
  }

  const agreementTenantPhone = tenantPhoneFromContact(agreement.tenantContact ?? "");
  if (agreementTenantPhone !== body.tenantPhone) {
    json(res, 400, { error: "Tenant phone does not match agreement" });
    return;
  }

  const preSigningEscrowType =
    body.requesterRole === "owner" ? "security_deposit" : "brokerage_tenant";

  const existing = await readTenantWorkspace(body.tenantPhone);
  const workspace: TenantWorkspaceRecord = {
    phone: body.tenantPhone,
    tenantName: body.tenantName,
    propertyId: body.propertyId,
    propertyLabel: body.propertyLabel,
    propertyAddress: body.propertyAddress,
    propertyImage: body.propertyImage,
    monthlyRent: body.monthlyRent,
    securityDeposit: body.securityDeposit,
    propertyType: body.propertyType,
    ownerName: body.ownerName,
    ownerContact: body.ownerContact ?? body.agreementSnapshot.ownerContact,
    brokerName: body.brokerName,
    requesterName: body.requesterName,
    requesterRole: body.requesterRole,
    agreementId: body.agreementId,
    documentUploadStatus: "agreement_ready",
    lifecycleStage: "agreement_ready",
    preSigningEscrowType,
    agreementSnapshot: body.agreementSnapshot,
    esignSignedPartyPhones: existing?.esignSignedPartyPhones,
    updatedAt: Date.now(),
  };

  await writeTenantWorkspace(body.tenantPhone, workspace);
  await updateAgreementStatusInBlob(body.phone, body.role, body.agreementId, "Sent");

  json(res, 200, { ok: true, workspace });
}

async function handlePatchWorkspace(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "PATCH") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const rawBody = readJsonBody(req);
  if (rawBody === null) {
    json(res, 400, { error: "Malformed JSON body" });
    return;
  }

  const phoneRaw = typeof rawBody === "object" && rawBody !== null && "phone" in rawBody
    ? String((rawBody as { phone: unknown }).phone)
    : "";
  const phoneParsed = phoneSchema.safeParse(phoneRaw);
  if (!phoneParsed.success) {
    json(res, 400, { error: "phone must be a 10-digit number" });
    return;
  }

  const auth = await assertSyncAccountAuth(requestAuthorization(req), phoneParsed.data);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  const parsed = patchWorkspaceBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body";
    json(res, 400, { error: message });
    return;
  }

  const existing = await readTenantWorkspace(phoneParsed.data);
  const patchBody = parsed.data;

  if (!existing) {
    const tenantName = patchBody.tenantName?.trim() ?? "";
    const propertyLabel = patchBody.propertyLabel?.trim() ?? "";
    if (!tenantName || !propertyLabel) {
      json(res, 404, { error: "Tenant workspace not found" });
      return;
    }

    const created: TenantWorkspaceRecord = {
      phone: phoneParsed.data,
      tenantName,
      propertyLabel,
      propertyId: patchBody.propertyId,
      propertyAddress: patchBody.propertyAddress,
      propertyImage: patchBody.propertyImage,
      monthlyRent: patchBody.monthlyRent,
      securityDeposit: patchBody.securityDeposit,
      propertyType: patchBody.propertyType,
      ownerName: patchBody.ownerName,
      ownerContact: patchBody.ownerContact,
      brokerName: patchBody.brokerName,
      requesterName: patchBody.requesterName,
      requesterRole: patchBody.requesterRole,
      documentUploadToken: patchBody.documentUploadToken,
      documentUploadStatus: patchBody.documentUploadStatus,
      agreementId: patchBody.agreementId,
      lifecycleStage: patchBody.lifecycleStage,
      preSigningEscrowType: patchBody.preSigningEscrowType,
      escrowPaymentId: patchBody.escrowPaymentId,
      escrowPaymentStatus: patchBody.escrowPaymentStatus,
      esignSignedPartyPhones: patchBody.esignSignedPartyPhones,
      updatedAt: Date.now(),
    };

    await writeTenantWorkspace(phoneParsed.data, created);
    json(res, 200, { ok: true, workspace: created });
    return;
  }

  const next: TenantWorkspaceRecord = {
    ...existing,
    ...patchBody,
    phone: phoneParsed.data,
    updatedAt: Date.now(),
  };

  if (parsed.data.esignSignedPartyPhones) {
    const merged = await tryCompleteAgreementSignatures(next, parsed.data.esignSignedPartyPhones);
    await writeTenantWorkspace(phoneParsed.data, merged);
    json(res, 200, { ok: true, workspace: merged });
    return;
  }

  await writeTenantWorkspace(phoneParsed.data, next);
  json(res, 200, { ok: true, workspace: next });
}

async function handleGetWorkspace(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const segments = workflowPathSegments(req);
  const phoneParsed = phoneSchema.safeParse(segments[0] ?? "");
  if (!phoneParsed.success) {
    json(res, 400, { error: "Invalid tenant phone" });
    return;
  }

  const auth = await assertSyncAccountAuth(requestAuthorization(req), phoneParsed.data);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  const workspace = await readTenantWorkspace(phoneParsed.data);
  if (!workspace) {
    json(res, 404, { error: "Tenant workspace not found" });
    return;
  }

  json(res, 200, { ok: true, workspace });
}

async function handleRecordSignature(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const rawBody = readJsonBody(req);
  if (rawBody === null) {
    json(res, 400, { error: "Malformed JSON body" });
    return;
  }

  const recordSignatureBodySchema = z.object({
    phone: phoneSchema,
    agreementId: z.string().trim().min(1),
    signedPartyPhone: phoneSchema,
    fileName: z.string().trim().min(1),
    fileUrl: z.string().trim().min(1),
  });

  const parsed = recordSignatureBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body";
    json(res, 400, { error: message });
    return;
  }

  const body = parsed.data;
  const auth = await assertSyncAccountAuth(requestAuthorization(req), body.phone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  const existing = await readTenantWorkspace(body.phone);
  if (!existing || existing.agreementId !== body.agreementId) {
    json(res, 404, { error: "Tenant workspace not found for agreement" });
    return;
  }

  const signedPhones = mergeSignedPhones(existing.esignSignedPartyPhones, body.signedPartyPhone);
  const merged = await tryCompleteAgreementSignatures(
    {
      ...existing,
      lifecycleStage: "awaiting_esign_signatures",
    },
    signedPhones,
  );

  await persistSignedUpload(
    body.phone,
    body.agreementId,
    body.signedPartyPhone,
    body.fileName,
    body.fileUrl,
  );

  await writeTenantWorkspace(body.phone, merged);
  json(res, 200, { ok: true, workspace: merged });
}

export async function handleTenantWorkflowRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const segments = workflowPathSegments(req);

  if (segments[0] === "send-for-esign") {
    await handleSendForESign(req, res);
    return;
  }

  if (segments[0] === "workspace") {
    if (segments.length === 1) {
      await handlePatchWorkspace(req, res);
      return;
    }
    if (segments.length === 2 && req.method === "GET") {
      await handleGetWorkspace(req, res);
      return;
    }
  }

  if (segments[0] === "record-signature") {
    await handleRecordSignature(req, res);
    return;
  }

  if (segments[0] === "agreement-status" && segments.length === 2) {
    await handleAgreementStatus(req, res);
    return;
  }

  if (segments[0] === "record-party-signature") {
    await handleRecordPartySignature(req, res);
    return;
  }

  json(res, 404, { error: "Not found" });
}
