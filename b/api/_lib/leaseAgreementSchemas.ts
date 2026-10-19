/**
 * Vercel-bundled copy of @workspace/api-schemas lease-agreement Zod schemas.
 * Keep in sync with lib/api-schemas/src/leaseAgreement.ts (mobile imports the workspace package).
 *
 * App-enforced invariants (not DB CHECKs), per docs/esign-decisions.md:
 *   - Draft PUT: 1–5 parties; one role at a time allowed (Owners then Tenants)
 *   - Ready for review / PDF: ≥1 owner + ≥1 tenant (2–5), exactly one primary per role
 *   - phone normalized to E.164 before insert (legacy bare 10-digit India accepted)
 *   - Aadhaar/PAN validated only when present, independently nullable
 *   - Aadhaar: 12 digits + Verhoeff checksum (not live UIDAI verification)
 *   - money as paise integers; dates validated end > effective
 *
 * Note: esign-decisions.md still documents 10-digit for future Leegality invitees.
 * Storage is E.164 now; Leegality adaptation is a separate scope.
 */
import { z } from "zod";
import {
  AADHAAR_INVALID_ERROR,
  AADHAAR_LENGTH_ERROR,
  isValidAadhaarNumber,
  normalizeAadhaarDigits,
} from "./aadhaar.js";
import {
  normalizePartyPhoneE164,
  PARTY_PHONE_FORMAT_ERROR,
} from "./partyPhone.js";

export const LeasePartyRoleSchema = z.enum(["owner", "tenant"]);
export type LeasePartyRole = z.infer<typeof LeasePartyRoleSchema>;

/** Draft PUT may save one role at a time (Owners then Tenants). Final set still needs both. */
export const LEASE_PARTY_MIN = 1;
export const LEASE_PARTY_MAX = 5;
/** Final agreement / review: at least one owner + one tenant. */
export const LEASE_PARTY_COMPLETE_MIN = 2;

const phoneSchema = z.string().transform((value, ctx) => {
  const e164 = normalizePartyPhoneE164(value);
  if (!e164) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: PARTY_PHONE_FORMAT_ERROR,
    });
    return z.NEVER;
  }
  return e164;
});

const aadhaarSchema = z
  .string()
  .transform((value) => normalizeAadhaarDigits(value))
  .refine((value) => value.length === 12, AADHAAR_LENGTH_ERROR)
  .refine((value) => isValidAadhaarNumber(value), AADHAAR_INVALID_ERROR);

const panSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .refine(
    (value) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value),
    "PAN must match AAAAA9999A",
  );

const emailSchema = z.string().trim().email("Invalid email address");

const ymdDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine(
    (value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()),
    "Invalid calendar date",
  );

export const LeasePartyInputSchema = z.object({
  role: LeasePartyRoleSchema,
  name: z.string().trim().min(1, "Name is required"),
  phone: phoneSchema,
  isPrimary: z.boolean(),
  sortOrder: z.number().int().min(0).optional(),
  title: z.string().trim().min(1).nullable().optional(),
  age: z.number().int().min(18).max(120).nullable().optional(),
  address: z.string().trim().min(1).nullable().optional(),
  aadhaar: aadhaarSchema.nullable().optional(),
  pan: panSchema.nullable().optional(),
  email: emailSchema.nullable().optional(),
});

export type LeasePartyInput = z.infer<typeof LeasePartyInputSchema>;

function validatePartySet(
  parties: LeasePartyInput[],
  ctx: z.RefinementCtx,
  requireBothRoles: boolean,
): void {
  if (parties.length < LEASE_PARTY_MIN || parties.length > LEASE_PARTY_MAX) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Between ${LEASE_PARTY_MIN} and ${LEASE_PARTY_MAX} parties are required`,
      path: ["parties"],
    });
  }

  const owners = parties.filter((p) => p.role === "owner");
  const tenants = parties.filter((p) => p.role === "tenant");

  if (requireBothRoles) {
    if (parties.length < LEASE_PARTY_COMPLETE_MIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Between ${LEASE_PARTY_COMPLETE_MIN} and ${LEASE_PARTY_MAX} parties are required`,
        path: ["parties"],
      });
    }
    if (owners.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one owner is required",
        path: ["parties"],
      });
    }
    if (tenants.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one tenant is required",
        path: ["parties"],
      });
    }
  }

  if (owners.length > 0 && owners.filter((p) => p.isPrimary).length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Exactly one primary owner is required",
      path: ["parties"],
    });
  }
  if (tenants.length > 0 && tenants.filter((p) => p.isPrimary).length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Exactly one primary tenant is required",
      path: ["parties"],
    });
  }

  const phones = parties.map((p) => p.phone);
  if (new Set(phones).size !== phones.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Party phone numbers must be unique",
      path: ["parties"],
    });
  }
}

/** Draft PUT — one role at a time is allowed (Owners step before Tenants). */
export const LeasePartiesReplaceSchema = z
  .object({
    parties: z.array(LeasePartyInputSchema),
  })
  .superRefine((data, ctx) => {
    validatePartySet(data.parties, ctx, false);
  });

export type LeasePartiesReplace = z.infer<typeof LeasePartiesReplaceSchema>;

/** Review / PDF readiness — at least one owner and one tenant. */
export const LeasePartiesCompleteSetSchema = z
  .object({
    parties: z.array(LeasePartyInputSchema),
  })
  .superRefine((data, ctx) => {
    validatePartySet(data.parties, ctx, true);
  });

export const LeaseInventoryItemInputSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
  sortOrder: z.number().int().min(0).optional(),
});

export type LeaseInventoryItemInput = z.infer<typeof LeaseInventoryItemInputSchema>;

export const LeaseInventoryReplaceSchema = z.object({
  items: z.array(LeaseInventoryItemInputSchema).max(200),
});

export type LeaseInventoryReplace = z.infer<typeof LeaseInventoryReplaceSchema>;

export const LeaseAgreementPatchSchema = z
  .object({
    executionDate: ymdDateSchema.nullable().optional(),
    effectiveDate: ymdDateSchema.nullable().optional(),
    endDate: ymdDateSchema.nullable().optional(),
    executionCity: z.string().trim().min(1).nullable().optional(),
    durationMonths: z.number().int().min(0).max(600).nullable().optional(),
    minStayMonths: z.number().int().min(0).max(600).nullable().optional(),
    noticePeriodLicenseeMonths: z.number().int().min(0).max(120).nullable().optional(),
    noticePeriodLicensorMonths: z.number().int().min(0).max(120).nullable().optional(),
    monthlyRentPaise: z.number().int().min(0).nullable().optional(),
    securityDepositPaise: z.number().int().min(0).nullable().optional(),
    rentDueDay: z.number().int().min(1).max(31).nullable().optional(),
    brokerageFeePaise: z.number().int().min(0).nullable().optional(),
    maintenanceIncluded: z.boolean().optional(),
    monthlyMaintenancePaise: z.number().int().min(0).nullable().optional(),
    propertyAddress: z.string().trim().min(1).nullable().optional(),
    areaSqft: z.number().nonnegative().nullable().optional(),
    facing: z.string().trim().min(1).nullable().optional(),
    carParkingCount: z.number().int().min(0).max(100).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.effectiveDate != null &&
      data.endDate != null &&
      new Date(`${data.endDate}T00:00:00Z`).getTime() <=
        new Date(`${data.effectiveDate}T00:00:00Z`).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate must be after effectiveDate",
        path: ["endDate"],
      });
    }
  });

export type LeaseAgreementPatch = z.infer<typeof LeaseAgreementPatchSchema>;

export const LeaseAgreementStatusSchema = z.enum([
  "draft",
  "in_review",
  "esign_sent",
  "signed",
]);

export type LeaseAgreementStatus = z.infer<typeof LeaseAgreementStatusSchema>;

export const LeaseAgreementStatusUpdateSchema = z.object({
  status: z.enum(["in_review", "esign_sent", "signed"]),
});

export type LeaseAgreementStatusUpdate = z.infer<typeof LeaseAgreementStatusUpdateSchema>;
