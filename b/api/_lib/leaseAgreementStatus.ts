import { z } from "zod";
import {
  LeaseAgreementStatusUpdateSchema,
  LeasePartiesCompleteSetSchema,
  type LeaseAgreementStatus,
  type LeaseAgreementStatusUpdate,
} from "./leaseAgreementSchemas.js";

type TransitionAgreement = {
  executionDate: string | null;
  effectiveDate: string | null;
  endDate: string | null;
  executionCity: string | null;
  durationMonths: number | null;
  minStayMonths: number | null;
  noticePeriodLicenseeMonths: number | null;
  noticePeriodLicensorMonths: number | null;
  monthlyRentPaise: number | null;
  securityDepositPaise: number | null;
  rentDueDay: number | null;
  propertyAddress: string | null;
  areaSqft: number | null;
  facing: string | null;
  carParkingCount: number | null;
};

type TransitionParty = {
  role: "owner" | "tenant";
  name: string;
  phone: string;
  title: string | null;
  age: number | null;
  address: string | null;
  aadhaar: string | null;
  pan: string | null;
  email: string | null;
  isPrimary: boolean;
  sortOrder: number;
  approvalStatus: "pending" | "approved" | "changes_requested" | "withdrawn";
};

export type LeaseAgreementTransitionContext = {
  currentStatus: LeaseAgreementStatus;
  nextStatus: LeaseAgreementStatusUpdate["status"];
  agreement: TransitionAgreement;
  parties: TransitionParty[];
};

export type LeaseAgreementTransitionResult =
  | { ok: true; placeholderGate: false }
  | { ok: false; error: string };

export const SEND_FOR_SIGNING_NOT_ALL_APPROVED_ERROR =
  "Cannot send for signing until every party has approved.";

export const BROKER_MARK_SIGNED_ERROR =
  "Only TrustKeyper can mark this agreement as signed after the signed copy is uploaded.";

const readyForReviewAgreementSchema = z
  .object({
    executionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    executionCity: z.string().trim().min(1),
    durationMonths: z.number().int().positive(),
    minStayMonths: z.number().int().min(0),
    noticePeriodLicenseeMonths: z.number().int().min(0),
    noticePeriodLicensorMonths: z.number().int().min(0),
    monthlyRentPaise: z.number().int().min(0),
    securityDepositPaise: z.number().int().min(0),
    rentDueDay: z.number().int().min(1).max(31),
    propertyAddress: z.string().trim().min(1),
    areaSqft: z.number().positive(),
    facing: z.string().trim().min(1),
    carParkingCount: z.number().int().min(0),
  })
  .superRefine((agreement, ctx) => {
    if (
      new Date(`${agreement.endDate}T00:00:00Z`).getTime() <=
      new Date(`${agreement.effectiveDate}T00:00:00Z`).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate must be after effectiveDate",
        path: ["endDate"],
      });
    }
  });

const reviewRequiredPartyFields = [
  "title",
  "age",
  "address",
  "aadhaar",
  "email",
] as const satisfies ReadonlyArray<keyof TransitionParty>;

function humanizeFieldName(field: string): string {
  return field.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

function describeInvalidTransition(
  currentStatus: LeaseAgreementStatus,
  nextStatus: LeaseAgreementStatusUpdate["status"],
): string {
  return [
    `Invalid lease agreement status transition: ${currentStatus} -> ${nextStatus}.`,
    "Allowed broker transitions are draft -> in_review and in_review -> esign_sent.",
  ].join(" ");
}

function validateReadyToSendForSigning(
  parties: TransitionParty[],
): LeaseAgreementTransitionResult {
  if (parties.length === 0) {
    return { ok: false, error: SEND_FOR_SIGNING_NOT_ALL_APPROVED_ERROR };
  }
  const allApproved = parties.every((party) => party.approvalStatus === "approved");
  if (!allApproved) {
    return { ok: false, error: SEND_FOR_SIGNING_NOT_ALL_APPROVED_ERROR };
  }
  return { ok: true, placeholderGate: false };
}

function validateDraftReadyForReview(
  agreement: TransitionAgreement,
  parties: TransitionParty[],
): LeaseAgreementTransitionResult {
  const partySet = LeasePartiesCompleteSetSchema.safeParse({ parties });
  if (!partySet.success) {
    const issues = partySet.error.issues.map((issue) => issue.message).join("; ");
    return {
      ok: false,
      error: `Cannot move draft to in_review: ${issues}`,
    };
  }

  const missingPartyFields = new Set<string>();
  for (const party of parties) {
    for (const field of reviewRequiredPartyFields) {
      const value = party[field];
      if (value === null || value === undefined || value === "") {
        missingPartyFields.add(`party.${field}`);
      }
    }
  }

  const agreementFields = readyForReviewAgreementSchema.safeParse(agreement);
  const missingAgreementFields = agreementFields.success
    ? []
    : agreementFields.error.issues.map((issue) => String(issue.path[0] ?? issue.message));

  if (missingPartyFields.size === 0 && agreementFields.success) {
    return { ok: true, placeholderGate: false };
  }

  const missingFields = [...missingAgreementFields, ...missingPartyFields]
    .map(humanizeFieldName)
    .sort((left, right) => left.localeCompare(right));

  return {
    ok: false,
    error: `Cannot move draft to in_review: complete all required agreement fields first (${missingFields.join(", ")}).`,
  };
}

export function parseLeaseAgreementStatusUpdate(body: unknown) {
  return LeaseAgreementStatusUpdateSchema.safeParse(body);
}

export function validateLeaseAgreementStatusTransition(
  context: LeaseAgreementTransitionContext,
): LeaseAgreementTransitionResult {
  const { currentStatus, nextStatus, agreement, parties } = context;

  if (currentStatus === "draft" && nextStatus === "in_review") {
    return validateDraftReadyForReview(agreement, parties);
  }
  if (currentStatus === "in_review" && nextStatus === "esign_sent") {
    return validateReadyToSendForSigning(parties);
  }
  if (nextStatus === "signed") {
    return { ok: false, error: BROKER_MARK_SIGNED_ERROR };
  }
  return { ok: false, error: describeInvalidTransition(currentStatus, nextStatus) };
}
