import { z } from "zod";

const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, "").slice(-10))
  .refine((v) => v.length === 10, "phone must be a 10-digit number");

const roleSchema = z.enum(["owner", "broker"]);

const stateSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z][A-Z0-9_ ]+$/.test(v), "state must be an uppercase Indian state name");

const postalCodeSchema = z
  .string()
  .trim()
  .refine((v) => /^\d{6}$/.test(v), "postalCode must be a 6-digit pin code");

export const ownerPaymentOnboardBodySchema = z.object({
  phone: phoneSchema,
  role: roleSchema,
  legalName: z.string().trim().min(4, "legalName must be at least 4 characters"),
  email: z.string().trim().email("email must be valid"),
  registeredAddress: z.object({
    street1: z.string().trim().min(1, "street1 is required"),
    street2: z.string().trim().optional(),
    city: z.string().trim().min(1, "city is required"),
    state: stateSchema,
    postalCode: postalCodeSchema,
    country: z.string().trim().default("IN"),
  }),
});

export const ownerPaymentOnboardCompleteBodySchema = z.object({
  phone: phoneSchema,
  role: roleSchema,
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
    state: stateSchema,
    postalCode: postalCodeSchema,
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

export const ownerPaymentSetupFormSchema = z.object({
  legalName: z.string().trim().min(4, "legalName must be at least 4 characters"),
  email: z.string().trim().email("email must be valid"),
  pan: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z]{3}P[A-Z]\d{4}[A-Z]$/.test(v), "pan must be a valid personal PAN"),
  street: z.string().trim().min(1, "street is required"),
  street2: z.string().trim().min(1, "Area / locality is required"),
  city: z.string().trim().min(1, "city is required"),
  state: stateSchema,
  postalCode: postalCodeSchema,
  country: z.string().trim().min(1, "country is required"),
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
  tncAccepted: z
    .boolean()
    .refine((value) => value === true, { message: "tncAccepted must be true" }),
});

export type OwnerPaymentSetupFormValues = z.infer<typeof ownerPaymentSetupFormSchema>;

export type PaymentRecipientValidationStatus =
  | "pending"
  | "submitted"
  | "needs_clarification"
  | "cooling"
  | "activated"
  | "failed";

export type OwnerPaymentSetupView = "form" | "verifying" | "ready" | "failed";

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  india: "IN",
};

export function normalizeCountryCode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "IN";
  const mapped = COUNTRY_NAME_TO_CODE[trimmed.toLowerCase()];
  if (mapped) return mapped;
  return trimmed.toUpperCase();
}

export function deriveOwnerPaymentSetupView(input: {
  validationStatus: PaymentRecipientValidationStatus;
  hasLinkedAccount: boolean;
}): OwnerPaymentSetupView {
  if (input.validationStatus === "activated") return "ready";
  if (input.validationStatus === "failed") return "failed";
  if (
    input.hasLinkedAccount ||
    input.validationStatus === "submitted" ||
    input.validationStatus === "cooling" ||
    input.validationStatus === "needs_clarification"
  ) {
    return "verifying";
  }
  return "form";
}

export function buildOnboardRequestBody(
  phone: string,
  role: "owner" | "broker",
  form: OwnerPaymentSetupFormValues,
) {
  return ownerPaymentOnboardBodySchema.parse({
    phone,
    role,
    legalName: form.legalName,
    email: form.email,
    registeredAddress: {
      street1: form.street,
      street2: form.street2,
      city: form.city,
      state: form.state,
      postalCode: form.postalCode,
      country: normalizeCountryCode(form.country),
    },
  });
}

export function buildOnboardCompleteRequestBody(
  phone: string,
  role: "owner" | "broker",
  form: OwnerPaymentSetupFormValues,
) {
  return ownerPaymentOnboardCompleteBodySchema.parse({
    phone,
    role,
    stakeholderName: form.legalName,
    stakeholderEmail: form.email,
    pan: form.pan,
    residentialAddress: {
      street: form.street,
      city: form.city,
      state: form.state,
      postalCode: form.postalCode,
      country: normalizeCountryCode(form.country),
    },
    bankAccountNumber: form.bankAccountNumber,
    bankIfsc: form.bankIfsc,
    bankBeneficiaryName: form.bankBeneficiaryName,
    tncAccepted: true,
  });
}

export function validateOwnerPaymentSetupField(
  field: keyof OwnerPaymentSetupFormValues,
  values: OwnerPaymentSetupFormValues,
): string | null {
  const fieldSchema = ownerPaymentSetupFormSchema.shape[field];
  const parsed = fieldSchema.safeParse(values[field]);
  if (parsed.success) return null;
  return parsed.error.issues[0]?.message ?? "Invalid value";
}

export function createEmptyOwnerPaymentSetupForm(): OwnerPaymentSetupFormValues {
  return {
    legalName: "",
    email: "",
    pan: "",
    street: "",
    street2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "IN",
    bankAccountNumber: "",
    bankIfsc: "",
    bankBeneficiaryName: "",
    tncAccepted: false,
  };
}
