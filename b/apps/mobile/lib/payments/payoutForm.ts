import { z } from "zod";
import { normalizeIndianState } from "../broker/workLocationState";

export const LEGAL_NAME_REQUIRED_ERROR = "Legal name is required";
export const LEGAL_NAME_MIN_ERROR = "Legal name must be at least 4 characters";
export const PAN_REQUIRED_ERROR = "PAN is required";
export const PAN_FORMAT_ERROR = "Enter a valid personal PAN";
export const BENEFICIARY_NAME_REQUIRED_ERROR = "Account holder name is required";
export const BENEFICIARY_NAME_MIN_ERROR =
  "Account holder name must be at least 4 characters";
export const ACCOUNT_REQUIRED_ERROR = "Bank account number is required";
export const ACCOUNT_FORMAT_ERROR = "Account number must be 5–35 characters";
export const IFSC_REQUIRED_ERROR = "IFSC is required";
export const IFSC_FORMAT_ERROR = "Enter a valid IFSC";
export const EMAIL_REQUIRED_ERROR = "Email is required";
export const EMAIL_FORMAT_ERROR = "Enter a valid email";
export const ADDRESS_LINE_1_REQUIRED_ERROR = "Address line 1 is required";
export const ADDRESS_LINE_2_REQUIRED_ERROR = "Address line 2 is required";
export const CITY_REQUIRED_ERROR = "City is required";
export const STATE_REQUIRED_ERROR = "State is required";
export const STATE_FORMAT_ERROR = "Enter a valid Indian state";
export const POSTAL_CODE_REQUIRED_ERROR = "PIN is required";
export const POSTAL_CODE_FORMAT_ERROR = "PIN must be 6 digits";

const PERSONAL_PAN_RE = /^[A-Z]{3}P[A-Z]\d{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const brokerPayoutFormSchema = z.object({
  legalName: z
    .string()
    .trim()
    .min(1, LEGAL_NAME_REQUIRED_ERROR)
    .min(4, LEGAL_NAME_MIN_ERROR),
  pan: z
    .string()
    .trim()
    .min(1, PAN_REQUIRED_ERROR)
    .transform((value) => value.toUpperCase())
    .refine((value) => PERSONAL_PAN_RE.test(value), PAN_FORMAT_ERROR),
  bankBeneficiaryName: z
    .string()
    .trim()
    .min(1, BENEFICIARY_NAME_REQUIRED_ERROR)
    .min(4, BENEFICIARY_NAME_MIN_ERROR),
  bankAccountNumber: z
    .string()
    .trim()
    .min(1, ACCOUNT_REQUIRED_ERROR)
    .refine(
      (value) => value.length >= 5 && value.length <= 35,
      ACCOUNT_FORMAT_ERROR,
    ),
  bankIfsc: z
    .string()
    .trim()
    .min(1, IFSC_REQUIRED_ERROR)
    .transform((value) => value.toUpperCase())
    .refine((value) => IFSC_RE.test(value), IFSC_FORMAT_ERROR),
  email: z
    .string()
    .trim()
    .min(1, EMAIL_REQUIRED_ERROR)
    .email(EMAIL_FORMAT_ERROR),
  addressLine1: z.string().trim().min(1, ADDRESS_LINE_1_REQUIRED_ERROR),
  addressLine2: z.string().trim().min(1, ADDRESS_LINE_2_REQUIRED_ERROR),
  city: z.string().trim().min(1, CITY_REQUIRED_ERROR),
  state: z
    .string()
    .trim()
    .min(1, STATE_REQUIRED_ERROR)
    .transform((value) => value.toUpperCase())
    .refine((value) => normalizeIndianState(value) != null, STATE_FORMAT_ERROR),
  postalCode: z
    .string()
    .trim()
    .min(1, POSTAL_CODE_REQUIRED_ERROR)
    .refine((value) => /^\d{6}$/.test(value), POSTAL_CODE_FORMAT_ERROR),
});

export type BrokerPayoutFormValues = z.input<typeof brokerPayoutFormSchema>;
export type BrokerPayoutFormParsed = z.output<typeof brokerPayoutFormSchema>;

export function legalNameBlurError(
  raw: string | null | undefined,
): string | null {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) return LEGAL_NAME_REQUIRED_ERROR;
  if (trimmed.length < 4) return LEGAL_NAME_MIN_ERROR;
  return null;
}

export function panBlurError(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim().toUpperCase();
  if (trimmed.length === 0) return PAN_REQUIRED_ERROR;
  return PERSONAL_PAN_RE.test(trimmed) ? null : PAN_FORMAT_ERROR;
}

export function bankAccountBlurError(
  raw: string | null | undefined,
): string | null {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) return ACCOUNT_REQUIRED_ERROR;
  if (trimmed.length < 5 || trimmed.length > 35) return ACCOUNT_FORMAT_ERROR;
  return null;
}

export function ifscBlurError(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim().toUpperCase();
  if (trimmed.length === 0) return IFSC_REQUIRED_ERROR;
  return IFSC_RE.test(trimmed) ? null : IFSC_FORMAT_ERROR;
}

export function payoutEmailBlurError(
  raw: string | null | undefined,
): string | null {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) return EMAIL_REQUIRED_ERROR;
  return EMAIL_RE.test(trimmed) ? null : EMAIL_FORMAT_ERROR;
}
