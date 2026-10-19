import { randomBytes } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { json, readJsonBody } from "./http.js";
import { getRazorpayClient } from "./razorpayClient.js";
import {
  syncRecipientValidationFromRazorpay,
  validationStatusFromActivationStatus,
} from "./razorpayRouteHelpers.js";
import { assertPaymentAuth } from "./syncAuth.js";
import { sanitizeErrorForLog } from "./sanitizeErrorForLog.js";
import { getPool } from "./vercelSyncDb.js";

const REFERENCE_ID_MIN_LEN = 3;
const REFERENCE_ID_MAX_LEN = 20;
const REFERENCE_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

const onboardBodySchema = z.object({
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, "").slice(-10))
    .refine((v) => v.length === 10, "phone must be a 10-digit number"),
  role: z.enum(["owner", "broker"]),
  legalName: z.string().trim().min(4, "legalName must be at least 4 characters"),
  email: z.string().trim().email("email must be valid"),
  registeredAddress: z.object({
    street1: z.string().trim().min(1, "street1 is required"),
    street2: z.string().trim().min(1, "street2 is required"),
    city: z.string().trim().min(1, "city is required"),
    state: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => /^[A-Z][A-Z0-9_ ]+$/.test(v), "state must be an uppercase Indian state name"),
    postalCode: z
      .string()
      .trim()
      .refine((v) => /^\d{6}$/.test(v), "postalCode must be a 6-digit pin code"),
    country: z.string().trim().default("IN"),
  }),
});

type OnboardBody = z.infer<typeof onboardBodySchema>;

export type PaymentOnboardBody = OnboardBody;

type RecipientConfigRow = {
  razorpay_linked_account_id: string | null;
  validation_status: string;
};

type FullRecipientConfigRow = {
  razorpay_linked_account_id: string | null;
  razorpay_stakeholder_id: string | null;
  razorpay_product_id: string | null;
  validation_status: string;
};

type RecipientKycBankRow = {
  bank_account_number: string | null;
};

/** Last 4 digits of a bank account for masked display. Never returns the full number. */
export function bankAccountLast4(
  accountNumber: string | null | undefined,
): string | null {
  if (accountNumber == null) return null;
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export const onboardCompleteBodySchema = z.object({
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, "").slice(-10))
    .refine((v) => v.length === 10, "phone must be a 10-digit number"),
  role: z.enum(["owner", "broker"]),
  stakeholderName: z.string().trim().min(4, "stakeholderName must be at least 4 characters"),
  stakeholderEmail: z.string().trim().email("stakeholderEmail must be valid"),
  pan: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z]{3}P[A-Z]\d{4}[A-Z]$/.test(v), "pan must be a valid personal PAN"),
  residentialAddress: z.object({
    street: z.string().trim().min(1, "street is required"),
    city: z.string().trim().min(1, "city is required"),
    state: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => /^[A-Z][A-Z0-9_ ]+$/.test(v), "state must be an uppercase Indian state name"),
    postalCode: z
      .string()
      .trim()
      .refine((v) => /^\d{6}$/.test(v), "postalCode must be a 6-digit pin code"),
    country: z.string().trim().default("IN"),
  }),
  bankAccountNumber: z
    .string()
    .trim()
    .refine((v) => v.length >= 5 && v.length <= 35, "bankAccountNumber must be 5-35 characters"),
  bankIfsc: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), "bankIfsc must be a valid IFSC code"),
  bankBeneficiaryName: z
    .string()
    .trim()
    .min(4, "bankBeneficiaryName must be at least 4 characters"),
  tncAccepted: z.literal(true, {
    errorMap: () => ({ message: "tncAccepted must be true" }),
  }),
});

export type PaymentOnboardCompleteBody = z.infer<typeof onboardCompleteBodySchema>;

type RazorpayErrorShape = {
  error?: {
    description?: string;
    code?: string;
    reason?: string;
    metadata?: unknown;
  };
};

function requestAuthorization(req: VercelRequest): string | undefined {
  const header = req.headers.authorization ?? req.headers.Authorization;
  if (Array.isArray(header)) return header[0];
  return header;
}

function roleCharForReferenceId(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (normalized === "owner") return "o";
  if (normalized === "tenant") return "t";
  if (normalized === "broker") return "b";
  throw new Error(`Unsupported role for Razorpay reference_id: ${role}`);
}

function cryptoRandomBase36(length: number): string {
  if (length <= 0) return "";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += REFERENCE_ID_ALPHABET[bytes[i]! % 36];
  }
  return out;
}

/**
 * Per-attempt unique Razorpay linked-account reference_id (≤20 chars).
 * Format: {roleChar}{phone10}{random} — e.g. o8860826738a3f9k2x1q
 * Not reconstructable; stored in payment_recipient_config.razorpay_reference_id.
 */
export function razorpayReferenceId(phone: string, role: string): string {
  const phone10 = phone.replace(/\D/g, "").slice(-10);
  if (phone10.length !== 10) {
    throw new Error(
      `phone must normalize to exactly 10 digits for Razorpay reference_id (got "${phone}")`,
    );
  }

  const roleChar = roleCharForReferenceId(role);
  const prefix = `${roleChar}${phone10}`;
  const randomLen = REFERENCE_ID_MAX_LEN - prefix.length;
  const id = `${prefix}${cryptoRandomBase36(randomLen)}`;

  if (id.length < REFERENCE_ID_MIN_LEN || id.length > REFERENCE_ID_MAX_LEN) {
    throw new Error(
      `Razorpay reference_id length out of bounds: ${id.length} (must be ${REFERENCE_ID_MIN_LEN}–${REFERENCE_ID_MAX_LEN})`,
    );
  }

  return id;
}

function parseRazorpayError(err: unknown): string {
  const shaped = err as RazorpayErrorShape;
  if (shaped.error?.description) return shaped.error.description;
  if (err instanceof Error) return err.message;
  return "Unknown Razorpay error";
}

export async function getRecipientConfig(
  phone: string,
  role: string,
): Promise<RecipientConfigRow | null> {
  const result = await getPool().query<RecipientConfigRow>(
    `SELECT razorpay_linked_account_id, validation_status
     FROM payment_recipient_config
     WHERE phone = $1 AND role = $2`,
    [phone, role],
  );
  return result.rows[0] ?? null;
}

export async function getFullRecipientConfig(
  phone: string,
  role: string,
): Promise<FullRecipientConfigRow | null> {
  const result = await getPool().query<FullRecipientConfigRow>(
    `SELECT razorpay_linked_account_id, razorpay_stakeholder_id, razorpay_product_id, validation_status
     FROM payment_recipient_config
     WHERE phone = $1 AND role = $2`,
    [phone, role],
  );
  return result.rows[0] ?? null;
}

export async function getRecipientKycBankAccount(
  phone: string,
  role: string,
): Promise<RecipientKycBankRow | null> {
  const result = await getPool().query<RecipientKycBankRow>(
    `SELECT bank_account_number
     FROM payment_recipient_kyc
     WHERE phone = $1 AND role = $2`,
    [phone, role],
  );
  return result.rows[0] ?? null;
}

async function updateRecipientStakeholderId(
  phone: string,
  role: string,
  stakeholderId: string,
): Promise<void> {
  await getPool().query(
    `UPDATE payment_recipient_config
     SET razorpay_stakeholder_id = $3, updated_at = NOW()
     WHERE phone = $1 AND role = $2`,
    [phone, role, stakeholderId],
  );
}

async function updateRecipientProductId(
  phone: string,
  role: string,
  productId: string,
): Promise<void> {
  await getPool().query(
    `UPDATE payment_recipient_config
     SET razorpay_product_id = $3, updated_at = NOW()
     WHERE phone = $1 AND role = $2`,
    [phone, role, productId],
  );
}

async function markRecipientSubmitted(
  phone: string,
  role: string,
  razorpayActivationStatus?: string | null,
): Promise<string> {
  const validationStatus = validationStatusFromActivationStatus(razorpayActivationStatus);
  await getPool().query(
    `UPDATE payment_recipient_config
     SET validation_status = $3, updated_at = NOW()
     WHERE phone = $1 AND role = $2`,
    [phone, role, validationStatus],
  );
  return validationStatus;
}

async function upsertRecipientKyc(params: {
  phone: string;
  role: string;
  legalName: string;
  email: string;
  pan: string;
  registeredAddress: Record<string, string>;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankHolderName?: string;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO payment_recipient_kyc (
       phone, role, legal_name, email, pan, registered_address,
       business_category, business_subcategory, business_type,
       bank_account_number, bank_ifsc, bank_holder_name,
       created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'housing', 'space_rental', 'individual', $7, $8, $9, NOW(), NOW())
     ON CONFLICT (phone, role) DO UPDATE SET
       legal_name = EXCLUDED.legal_name,
       email = EXCLUDED.email,
       pan = EXCLUDED.pan,
       registered_address = EXCLUDED.registered_address,
       bank_account_number = EXCLUDED.bank_account_number,
       bank_ifsc = EXCLUDED.bank_ifsc,
       bank_holder_name = EXCLUDED.bank_holder_name,
       updated_at = NOW()`,
    [
      params.phone,
      params.role,
      params.legalName,
      params.email,
      params.pan,
      JSON.stringify(params.registeredAddress),
      params.bankAccountNumber ?? null,
      params.bankIfsc ?? null,
      params.bankHolderName ?? null,
    ],
  );
}

export async function upsertRecipientAccount(params: {
  phone: string;
  role: string;
  accountId: string;
  referenceId: string;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO payment_recipient_config (
       phone,
       role,
       razorpay_linked_account_id,
       razorpay_reference_id,
       validation_status,
       created_at,
       updated_at
     ) VALUES ($1, $2, $3, $4, 'submitted', NOW(), NOW())
     ON CONFLICT (phone, role) DO UPDATE SET
       razorpay_linked_account_id = EXCLUDED.razorpay_linked_account_id,
       razorpay_reference_id = EXCLUDED.razorpay_reference_id,
       validation_status = EXCLUDED.validation_status,
       updated_at = NOW()`,
    [params.phone, params.role, params.accountId, params.referenceId],
  );
}

export function buildRazorpayAccountPayload(body: OnboardBody, referenceId: string) {
  const { registeredAddress: addr } = body;
  return {
    email: body.email,
    phone: body.phone,
    type: "route" as const,
    reference_id: referenceId,
    legal_business_name: body.legalName,
    customer_facing_business_name: body.legalName,
    contact_name: body.legalName,
    business_type: "individual",
    profile: {
      category: "housing",
      subcategory: "space_rental",
      business_model: "Individual property owner collecting monthly rent",
      addresses: {
        registered: {
          street1: addr.street1,
          street2: addr.street2,
          city: addr.city,
          state: addr.state,
          postal_code: addr.postalCode,
          country: addr.country,
        },
      },
    },
  };
}

export async function handlePaymentOnboardRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const rawBody = readJsonBody(req);
  if (rawBody === null) {
    json(res, 400, { error: "Malformed JSON body" });
    return;
  }

  const parsed = onboardBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body";
    json(res, 400, { error: message });
    return;
  }

  const body = parsed.data;
  const phone = body.phone;

  const auth = await assertPaymentAuth(requestAuthorization(req), phone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  try {
    const existing = await getRecipientConfig(phone, body.role);
    if (existing?.razorpay_linked_account_id) {
      json(res, 200, {
        accountId: existing.razorpay_linked_account_id,
        validationStatus: existing.validation_status,
        step: "account_created",
      });
      return;
    }

    const referenceId = razorpayReferenceId(phone, body.role);
    const razorpayPayload = buildRazorpayAccountPayload(body, referenceId);

    let account;
    try {
      account = await getRazorpayClient().accounts.create(razorpayPayload);
    } catch (err) {
      console.error("Razorpay accounts.create failed", {
        phone,
        role: body.role,
        referenceId,
        ...sanitizeErrorForLog(err),
      });
      json(res, 502, {
        error: "Razorpay account creation failed",
        detail: parseRazorpayError(err),
      });
      return;
    }

    await upsertRecipientAccount({
      phone,
      role: body.role,
      accountId: account.id,
      referenceId,
    });

    json(res, 200, {
      accountId: account.id,
      validationStatus: "submitted",
      step: "account_created",
    });
  } catch (err) {
    console.error("Payment onboard handler error", {
      phone,
      role: body.role,
      error: err instanceof Error ? err.message : String(err),
    });
    json(res, 500, { error: "Internal server error" });
  }
}

export type OnboardCompleteSuccess = {
  ok: true;
  accountId: string;
  stakeholderId: string;
  productId: string;
  validationStatus: string;
  stepsRun: {
    stakeholder: boolean;
    product: boolean;
    bank: boolean;
  };
};

export type OnboardCompleteFailure =
  | { ok: false; kind: "precondition"; error: string }
  | {
      ok: false;
      kind: "razorpay";
      step: "stakeholder" | "product" | "bank";
      detail: string;
    };

export async function executePaymentOnboardComplete(
  body: PaymentOnboardCompleteBody,
): Promise<OnboardCompleteSuccess | OnboardCompleteFailure> {
  const phone = body.phone;
  const config = await getFullRecipientConfig(phone, body.role);
  if (!config?.razorpay_linked_account_id) {
    return {
      ok: false,
      kind: "precondition",
      error: "Account not created yet — run onboarding step 1 first",
    };
  }

  const linkedAccountId = config.razorpay_linked_account_id;
  let stakeholderId = config.razorpay_stakeholder_id;
  let productId = config.razorpay_product_id;
  const ranStakeholder = !stakeholderId;
  const ranProduct = !productId;
  const residentialAddressJson = {
    street: body.residentialAddress.street,
    city: body.residentialAddress.city,
    state: body.residentialAddress.state,
    postalCode: body.residentialAddress.postalCode,
    country: body.residentialAddress.country,
  };

  if (!stakeholderId) {
    try {
      const stakeholder = await getRazorpayClient().stakeholders.create(linkedAccountId, {
        name: body.stakeholderName,
        email: body.stakeholderEmail,
        phone: { primary: phone },
        kyc: { pan: body.pan },
        relationship: { executive: true },
        addresses: {
          residential: {
            street: body.residentialAddress.street,
            city: body.residentialAddress.city,
            state: body.residentialAddress.state,
            postal_code: body.residentialAddress.postalCode,
            country: body.residentialAddress.country,
          },
        },
      });
      stakeholderId = stakeholder.id;
      await updateRecipientStakeholderId(phone, body.role, stakeholderId);
      await upsertRecipientKyc({
        phone,
        role: body.role,
        legalName: body.stakeholderName,
        email: body.stakeholderEmail,
        pan: body.pan,
        registeredAddress: residentialAddressJson,
        bankAccountNumber: body.bankAccountNumber,
        bankIfsc: body.bankIfsc,
        bankHolderName: body.bankBeneficiaryName,
      });
    } catch (err) {
      console.error("Razorpay stakeholders.create failed", {
        phone,
        role: body.role,
        linkedAccountId,
        ...sanitizeErrorForLog(err),
      });
      return {
        ok: false,
        kind: "razorpay",
        step: "stakeholder",
        detail: parseRazorpayError(err),
      };
    }
  }

  if (!productId) {
    try {
      const product = await getRazorpayClient().products.requestProductConfiguration(
        linkedAccountId,
        { product_name: "route" },
      );
      productId = product.id;
      await updateRecipientProductId(phone, body.role, productId);
    } catch (err) {
      console.error("Razorpay products.requestProductConfiguration failed", {
        phone,
        role: body.role,
        linkedAccountId,
        ...sanitizeErrorForLog(err),
      });
      return {
        ok: false,
        kind: "razorpay",
        step: "product",
        detail: parseRazorpayError(err),
      };
    }
  }

  let validationStatus = "submitted";
  try {
    const editResult = await getRazorpayClient().products.edit(linkedAccountId, productId, {
      settlements: {
        account_number: body.bankAccountNumber,
        ifsc_code: body.bankIfsc,
        beneficiary_name: body.bankBeneficiaryName,
      },
      tnc_accepted: true,
    });
    validationStatus = await markRecipientSubmitted(
      phone,
      body.role,
      editResult.activation_status,
    );
    await upsertRecipientKyc({
      phone,
      role: body.role,
      legalName: body.stakeholderName,
      email: body.stakeholderEmail,
      pan: body.pan,
      registeredAddress: residentialAddressJson,
      bankAccountNumber: body.bankAccountNumber,
      bankIfsc: body.bankIfsc,
      bankHolderName: body.bankBeneficiaryName,
    });
  } catch (err) {
    console.error("Razorpay products.edit failed", {
      phone,
      role: body.role,
      linkedAccountId,
      productId,
      ...sanitizeErrorForLog(err),
    });
    return {
      ok: false,
      kind: "razorpay",
      step: "bank",
      detail: parseRazorpayError(err),
    };
  }

  return {
    ok: true,
    accountId: linkedAccountId,
    stakeholderId: stakeholderId!,
    productId: productId!,
    validationStatus,
    stepsRun: {
      stakeholder: ranStakeholder,
      product: ranProduct,
      bank: true,
    },
  };
}

export async function handlePaymentOnboardCompleteRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const rawBody = readJsonBody(req);
  if (rawBody === null) {
    json(res, 400, { error: "Malformed JSON body" });
    return;
  }

  const parsed = onboardCompleteBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body";
    json(res, 400, { error: message });
    return;
  }

  const body = parsed.data;
  const phone = body.phone;

  const auth = await assertPaymentAuth(requestAuthorization(req), phone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  try {
    const result = await executePaymentOnboardComplete(body);
    if (!result.ok) {
      if (result.kind === "precondition") {
        json(res, 409, { error: result.error });
        return;
      }
      json(res, 502, {
        error: "Onboarding step failed",
        step: result.step,
        detail: result.detail,
      });
      return;
    }

    json(res, 200, {
      accountId: result.accountId,
      stakeholderId: result.stakeholderId,
      productId: result.productId,
      validationStatus: result.validationStatus,
      step: "onboarding_complete",
    });
  } catch (err) {
    console.error("Payment onboard complete handler error", {
      phone,
      role: body.role,
      error: err instanceof Error ? err.message : String(err),
    });
    json(res, 500, { error: "Internal server error" });
  }
}

const onboardStatusQuerySchema = z.object({
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, "").slice(-10))
    .refine((v) => v.length === 10, "phone must be a 10-digit number"),
  role: z.enum(["owner", "broker"]),
});

export async function handlePaymentOnboardStatusRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const rawPhone = req.query.phone;
  const rawRole = req.query.role;
  const phoneParam = Array.isArray(rawPhone) ? rawPhone[0] : rawPhone;
  const roleParam = Array.isArray(rawRole) ? rawRole[0] : rawRole;

  const parsed = onboardStatusQuerySchema.safeParse({
    phone: phoneParam ?? "",
    role: roleParam ?? "",
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid query parameters";
    json(res, 400, { error: message });
    return;
  }

  const { phone, role } = parsed.data;
  const auth = await assertPaymentAuth(requestAuthorization(req), phone);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  try {
    const config = await getFullRecipientConfig(phone, role);
    let validationStatus = config?.validation_status ?? "pending";

    if (config?.razorpay_linked_account_id && config.razorpay_product_id) {
      const synced = await syncRecipientValidationFromRazorpay({
        linkedAccountId: config.razorpay_linked_account_id,
        productId: config.razorpay_product_id,
        currentValidationStatus: config.validation_status,
      });
      validationStatus = synced.validationStatus;
    }

    const kyc = await getRecipientKycBankAccount(phone, role);

    json(res, 200, {
      validationStatus,
      hasLinkedAccount: Boolean(config?.razorpay_linked_account_id),
      accountId: config?.razorpay_linked_account_id ?? null,
      bankAccountLast4: bankAccountLast4(kyc?.bank_account_number),
    });
  } catch (err) {
    console.error("Payment onboard status handler error", {
      phone,
      role,
      error: err instanceof Error ? err.message : String(err),
    });
    json(res, 500, { error: "Internal server error" });
  }
}
