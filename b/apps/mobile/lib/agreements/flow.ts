import { z } from "zod";
import {
  isValidAadhaarNumber,
  LeasePartiesReplaceSchema,
  LeasePartyInputSchema,
  partyPhoneUniqueKey,
  type LeasePartyInput,
  type LeasePartyRole,
} from "@workspace/api-schemas";
import type {
  LeaseAgreement,
  LeaseAgreementDetail,
  LeaseAgreementParty,
} from "../api/client";
import { isPartyFullyComplete } from "./partyCardHelpers";
import { AGE_ERROR_MESSAGE } from "./partyFieldValidation";
import { durationMonthsFromRange } from "./dateHelpers";
import {
  labeledDateText,
  labeledDurationMonthsText,
  labeledMoneyText,
  labeledRentDueDayText,
  labeledRequiredText,
  labeledWholeNumberText,
  MIN_DURATION_MONTHS_ERROR,
} from "./termsFieldValidation";

const nonNegativeIntegerText = z
  .string()
  .trim()
  .regex(/^\d+$/, "Enter a whole number");

const positiveIntegerText = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "Enter a number greater than zero");

const moneyText = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/, "Enter rupees with at most 2 decimal places");

export const PropertyStepSchema = z.object({
  propertyAddress: z.string().trim().min(1, "Property address is required"),
  areaSqft: positiveIntegerText,
  facing: z.string().trim().min(1, "Facing is required"),
  carParkingCount: nonNegativeIntegerText,
});

export type PropertyStepValues = z.infer<typeof PropertyStepSchema>;

/** Facing options — same set as web property direction picker. */
export const PROPERTY_FACING_OPTIONS = [
  "North",
  "South",
  "East",
  "West",
  "North-East",
  "North-West",
  "South-East",
  "South-West",
] as const;

export const TermsStepSchema = z
  .object({
    executionDate: labeledDateText("Agreement execution date"),
    effectiveDate: labeledDateText("Start date"),
    endDate: labeledDateText("End date"),
    executionCity: labeledRequiredText("City"),
    durationMonths: labeledDurationMonthsText("Duration"),
    minStayMonths: labeledWholeNumberText("Lock-in period"),
    noticePeriodLicenseeMonths: labeledWholeNumberText("Notice (tenant)"),
    noticePeriodLicensorMonths: labeledWholeNumberText("Notice (owner)"),
    monthlyRentRupees: labeledMoneyText("Monthly rent"),
    securityDepositRupees: labeledMoneyText("Security deposit"),
    brokerageFeeRupees: z.string().superRefine((value, context) => {
      const trimmed = value.trim();
      if (trimmed.length === 0) return;
      if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter rupees with at most 2 decimal places",
        });
      }
    }),
    maintenanceIncluded: z.boolean(),
    monthlyMaintenanceRupees: z.string(),
    rentDueDay: labeledRentDueDayText("Rent due date"),
  })
  .refine(
    (values) =>
      values.effectiveDate.trim().length === 0 ||
      values.endDate.trim().length === 0 ||
      new Date(`${values.endDate}T00:00:00Z`).getTime() >
        new Date(`${values.effectiveDate}T00:00:00Z`).getTime(),
    { message: "End date must be after start date", path: ["endDate"] },
  )
  .superRefine((values, context) => {
    if (
      durationMonthsFromRange(values.effectiveDate, values.endDate) === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: MIN_DURATION_MONTHS_ERROR,
        path: ["endDate"],
      });
    }
  })
  .superRefine((values, context) => {
    if (values.maintenanceIncluded) return;
    const parsed = labeledMoneyText("Monthly maintenance").safeParse(
      values.monthlyMaintenanceRupees,
    );
    if (!parsed.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          parsed.error.issues[0]?.message ??
          "Monthly maintenance cannot be empty",
        path: ["monthlyMaintenanceRupees"],
      });
    }
  });

export type TermsStepValues = z.infer<typeof TermsStepSchema>;

export const PartyCreationSchema = LeasePartiesReplaceSchema.superRefine((values, context) => {
  values.parties.forEach((party, index) => {
    const requiredFields = [
      ["title", party.title, "Title is required"],
      ["age", party.age, "Age is required"],
      ["address", party.address, "Current address is required"],
      ["aadhaar", party.aadhaar, "Aadhaar Number is required"],
      ["email", party.email, "Email Address is required"],
    ] as const;
    for (const [field, value, message] of requiredFields) {
      if (value === null || value === undefined || value === "") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message,
          path: ["parties", index, field],
        });
      }
    }
    const aadhaarDigits =
      party.aadhaar === null || party.aadhaar === undefined
        ? ""
        : String(party.aadhaar).replace(/\D/g, "");
    if (aadhaarDigits.length > 0 && aadhaarDigits.length !== 12) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Aadhaar Number must be exactly 12 digits",
        path: ["parties", index, "aadhaar"],
      });
    } else if (
      aadhaarDigits.length === 12 &&
      !isValidAadhaarNumber(aadhaarDigits)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid Aadhaar number",
        path: ["parties", index, "aadhaar"],
      });
    }
  });
});

/** Role-scoped step validation — at least one party of `role`, all fully complete. */
export function createRolePartySchema(role: LeasePartyRole) {
  const partySchema = LeasePartyInputSchema.omit({ age: true }).extend({
    age: z
      .number()
      .int(AGE_ERROR_MESSAGE)
      .min(18, AGE_ERROR_MESSAGE)
      .max(120, AGE_ERROR_MESSAGE)
      .nullable()
      .optional(),
  });

  return z
    .object({
      parties: z.array(partySchema).min(1, `Add at least one ${role}`),
    })
    .superRefine((values, context) => {
      values.parties.forEach((party, index) => {
        if (party.role !== role) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Expected ${role} party`,
            path: ["parties", index, "role"],
          });
        }
        const requiredFields = [
          ["title", party.title, "Title is required"],
          ["age", party.age, "Age is required"],
          ["address", party.address, "Current address is required"],
          ["aadhaar", party.aadhaar, "Aadhaar Number is required"],
          ["email", party.email, "Email Address is required"],
        ] as const;
        for (const [field, value, message] of requiredFields) {
          if (value === null || value === undefined || value === "") {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message,
              path: ["parties", index, field],
            });
          }
        }
        const aadhaarDigits =
          party.aadhaar === null || party.aadhaar === undefined
            ? ""
            : String(party.aadhaar).replace(/\D/g, "");
        if (aadhaarDigits.length > 0 && aadhaarDigits.length !== 12) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Aadhaar Number must be exactly 12 digits",
            path: ["parties", index, "aadhaar"],
          });
        } else if (
          aadhaarDigits.length === 12 &&
          !isValidAadhaarNumber(aadhaarDigits)
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid Aadhaar number",
            path: ["parties", index, "aadhaar"],
          });
        }
      });

      // When phoneSchema's transform aborts (incomplete/invalid), Zod still
      // runs this superRefine with `party.phone` as `{ status: "aborted" }`.
      // Only compare real strings — partyPhoneUniqueKey also guards this.
      const phones = values.parties.map((party) =>
        typeof party.phone === "string" ? partyPhoneUniqueKey(party.phone) : "",
      );
      if (
        phones.every((phone) => phone.length > 0) &&
        new Set(phones).size !== phones.length
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Party phone numbers must be unique",
          path: ["parties"],
        });
      }
    });
}

/** Blank party row. Callers must pass isPrimary for the first owner/tenant. */
export function emptyParty(role: LeasePartyRole, isPrimary: boolean): LeasePartyInput {
  return {
    role,
    title: null,
    name: "",
    age: null,
    address: null,
    aadhaar: null,
    pan: null,
    email: null,
    phone: "",
    isPrimary,
  };
}

/**
 * Auto-assign primary: first owner and first tenant in list order.
 * Matches the IA — primary is not a manual picker for the common single-owner case.
 * Also stamps sortOrder for PUT .../parties.
 */
export function primaryByRole(parties: LeasePartyInput[]): LeasePartyInput[] {
  let ownerSeen = false;
  let tenantSeen = false;
  return parties.map((party, index) => {
    const isPrimary = party.role === "owner" ? !ownerSeen : !tenantSeen;
    if (party.role === "owner") ownerSeen = true;
    else tenantSeen = true;
    return { ...party, isPrimary, sortOrder: index };
  });
}

/** Default blank row for a role-scoped step. */
export function defaultNewRoleParties(role: LeasePartyRole): LeasePartyInput[] {
  return primaryByRole([emptyParty(role, true)]);
}

/** Both-role default — used by older tests; role steps use defaultNewRoleParties. */
export function defaultNewParties(): LeasePartyInput[] {
  return primaryByRole([emptyParty("owner", true), emptyParty("tenant", true)]);
}

export function rupeesToPaise(value: string): number {
  const [rupees = "0", fraction = ""] = value.trim().split(".");
  return Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));
}

export function paiseToRupees(value: number | null): string {
  if (value === null) return "";
  const rupees = Math.floor(value / 100);
  const paise = value % 100;
  return paise === 0 ? String(rupees) : `${rupees}.${String(paise).padStart(2, "0")}`;
}

export type AgreementCreationStep = 1 | 2 | 3 | 4 | 5;

export function inferAgreementCreationStep(detail: LeaseAgreementDetail): AgreementCreationStep {
  if (!detail.propertyAddress) return 1;

  const owners = detail.parties.filter((party) => party.role === "owner");
  const tenants = detail.parties.filter((party) => party.role === "tenant");
  const hasCompleteOwner = owners.some((party) => isPartyFullyComplete(party));
  if (!hasCompleteOwner) return 2;

  const hasCompleteTenant = tenants.some((party) => isPartyFullyComplete(party));
  if (!hasCompleteTenant) return 3;

  const termsStarted = [
    detail.executionDate,
    detail.effectiveDate,
    detail.endDate,
    detail.executionCity,
    detail.durationMonths,
    detail.monthlyRentPaise,
  ].some((value) => value !== null);
  return termsStarted || detail.inventory.length > 0 ? 5 : 4;
}

export type AgreementStatusSegment = "draft" | "sent" | "signed";

export function agreementStatusSegment(status: string): AgreementStatusSegment {
  if (status === "signed" || status === "completed") return "signed";
  if (
    status === "in_review" ||
    status === "esign_sent" ||
    status === "sent" ||
    status === "sent_for_signing" ||
    status === "signing"
  ) {
    return "sent";
  }
  return "draft";
}

/** Chip / list label for agreement status. */
export function agreementStatusLabel(status: string): string {
  if (status === "signed" || status === "completed") return "Signed";
  if (status === "esign_sent" || status === "sent" || status === "sent_for_signing") {
    return "Sent for signing";
  }
  if (status === "in_review" || status === "signing") return "In review";
  return "Draft";
}

export function partyRoleLabel(role: LeasePartyRole): string {
  return role === "owner" ? "Owner" : "Tenant";
}

export function formatAgreementMoney(paise: number | null): string {
  if (paise === null) return "Not set";
  return `Rs.${paiseToRupees(paise)}`;
}

export function formatAgreementDate(value: string | null): string {
  if (!value) return "Not set";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export type PartyReviewSummary = Pick<
  LeaseAgreementParty,
  | "id"
  | "name"
  | "role"
  | "approvalStatus"
  | "reviewComment"
  | "reviewedAt"
  | "hasReviewToken"
  | "reviewLinkStatus"
  | "reviewSharedAt"
  | "hasBeenShared"
>;

export type ReviewLinkStatus = NonNullable<LeaseAgreementParty["reviewLinkStatus"]>;

/**
 * Staging/older GET payloads omit `reviewLinkStatus`. Without a live token the
 * party is not "waiting" — treat that as never-sent until the API can name expiry.
 */
export function resolveReviewLinkStatus(
  party: Pick<PartyReviewSummary, "hasReviewToken" | "reviewLinkStatus">,
): ReviewLinkStatus {
  if (
    party.reviewLinkStatus === "none" ||
    party.reviewLinkStatus === "active" ||
    party.reviewLinkStatus === "expired"
  ) {
    return party.reviewLinkStatus;
  }
  return party.hasReviewToken ? "active" : "none";
}

/** Broker confirmed the review link was shared (iOS Share or persisted attestation). */
export function partyHasConfirmedShare(
  party: Pick<PartyReviewSummary, "hasBeenShared" | "reviewSharedAt">,
): boolean {
  if (party.hasBeenShared === true) return true;
  const sharedAt = party.reviewSharedAt?.trim();
  return sharedAt !== undefined && sharedAt.length > 0;
}

/** Live token minted but share not yet confirmed — distinct from never-sent. */
export function partyAwaitingShareConfirmation(
  party: Pick<
    PartyReviewSummary,
    "hasReviewToken" | "reviewLinkStatus" | "hasBeenShared" | "reviewSharedAt"
  >,
): boolean {
  return resolveReviewLinkStatus(party) === "active" && !partyHasConfirmedShare(party);
}

export function countApprovedParties(parties: PartyReviewSummary[]): number {
  return parties.filter((party) => party.approvalStatus === "approved").length;
}

export function allPartiesApproved(parties: PartyReviewSummary[]): boolean {
  return parties.length > 0 && parties.every((party) => party.approvalStatus === "approved");
}

/**
 * True when the agreement is in review but no party has a live review link
 * (typical after an edit reset). Broker must resend before anyone can review.
 */
export function needsReviewResend(
  status: string,
  parties: Array<Pick<PartyReviewSummary, "hasReviewToken">>,
): boolean {
  return status === "in_review" && parties.length > 0 && parties.every((party) => !party.hasReviewToken);
}

/** List-row glance text for in-review agreements, e.g. "1 of 2 approved". */
export function reviewProgressLabel(parties: PartyReviewSummary[]): string | null {
  if (parties.length === 0) return null;
  return `${countApprovedParties(parties)} of ${parties.length} approved`;
}

/** List-row glance from list-endpoint review summary counts. */
export function reviewProgressFromCounts(
  partyCount: number | undefined,
  approvedCount: number | undefined,
): string | null {
  const total = partyCount ?? 0;
  if (total <= 0) return null;
  return `${approvedCount ?? 0} of ${total} approved`;
}

export function partyReviewHeadline(party: PartyReviewSummary): string {
  if (party.approvalStatus === "approved") {
    const when = party.reviewedAt ? formatAgreementDate(party.reviewedAt) : null;
    return when ? `Approved · ${when}` : "Approved";
  }
  if (party.approvalStatus === "changes_requested") {
    const when = party.reviewedAt ? formatAgreementDate(party.reviewedAt) : null;
    return when ? `Requested changes · ${when}` : "Requested changes";
  }
  if (party.approvalStatus === "withdrawn") {
    const when = party.reviewedAt ? formatAgreementDate(party.reviewedAt) : null;
    return when ? `Withdrew approval · ${when}` : "Withdrew approval";
  }
  const linkStatus = resolveReviewLinkStatus(party);
  if (linkStatus === "none") {
    return "Review link not sent";
  }
  if (linkStatus === "expired") {
    return "Review link expired";
  }
  if (!partyHasConfirmedShare(party)) {
    return "Not yet shared";
  }
  return "Waiting for response";
}

/**
 * Secondary note only when an approval already exists but the link is gone.
 * Pending states are fully described by the headline — never pair
 * "Waiting for response" with a "no link / resend" line.
 */
export function partyReviewLinkNote(party: PartyReviewSummary): string | null {
  if (
    party.approvalStatus !== "approved" &&
    party.approvalStatus !== "changes_requested" &&
    party.approvalStatus !== "withdrawn"
  ) {
    return null;
  }
  if (party.hasReviewToken) return null;
  return "Their review link is no longer active. Resend a link if they need to change their response.";
}

/** Material Community icon for the party Response status row. */
export function partyReviewStatusIcon(party: PartyReviewSummary): string {
  if (party.approvalStatus === "approved") return "check-circle";
  if (party.approvalStatus === "changes_requested") return "alert-circle-outline";
  if (party.approvalStatus === "withdrawn") return "close-circle-outline";
  const linkStatus = resolveReviewLinkStatus(party);
  if (linkStatus === "expired") return "clock-alert-outline";
  if (linkStatus === "none") return "link-off";
  if (!partyHasConfirmedShare(party)) return "share-variant-outline";
  return "clock-outline";
}

export function partyReviewSendActionTitle(party: PartyReviewSummary): string {
  return resolveReviewLinkStatus(party) === "none" ? "Send link" : "Resend link";
}

export function partyChangesComment(party: PartyReviewSummary): string | null {
  if (party.approvalStatus !== "changes_requested") return null;
  const comment = party.reviewComment?.trim();
  if (comment) return comment;
  return "They asked to discuss this by phone.";
}

export type PropertyRecord = {
  key: string;
  address: string;
  areaSqft: number | null;
  facing: string | null;
  carParkingCount: number | null;
};

export function derivePropertyRecords(agreements: LeaseAgreement[]): PropertyRecord[] {
  const records = new Map<string, PropertyRecord>();
  for (const agreement of agreements) {
    const address = agreement.propertyAddress?.trim();
    if (!address) continue;
    const key = address.toLowerCase();
    records.set(key, {
      key,
      address,
      areaSqft: agreement.areaSqft,
      facing: agreement.facing,
      carParkingCount: agreement.carParkingCount,
    });
  }
  return [...records.values()];
}

export type PersonRecord = Pick<
  LeaseAgreementParty,
  "name" | "phone" | "email" | "address" | "role"
>;

export function derivePersonRecords(
  details: LeaseAgreementDetail[],
  role: "owner" | "tenant",
): PersonRecord[] {
  const records = new Map<string, PersonRecord>();
  for (const detail of details) {
    for (const party of detail.parties) {
      if (party.role !== role) continue;
      records.set(party.phone, {
        name: party.name,
        phone: party.phone,
        email: party.email,
        address: party.address,
        role,
      });
    }
  }
  return [...records.values()];
}
