/**
 * Zod validation for POST /api/contact.
 */
import { z } from "zod";

export const CONTACT_MESSAGE_MAX_LENGTH = 5000;

export const CONTACT_USER_ROLE_VALUES = ["property_owner", "tenant", "broker"] as const;
export const CONTACT_SERVICE_TIMING_VALUES = [
  "immediately",
  "within_1_month",
  "within_3_months",
  "within_6_months",
  "exploring",
] as const;

export type ContactUserRole = (typeof CONTACT_USER_ROLE_VALUES)[number];
export type ContactServiceTiming = (typeof CONTACT_SERVICE_TIMING_VALUES)[number];

export const ContactRoleLabels: Record<ContactUserRole, string> = {
  property_owner: "Property Owner",
  tenant: "Tenant",
  broker: "Broker",
};

export const ContactServiceTimingLabels: Record<ContactServiceTiming, string> = {
  immediately: "Immediately",
  within_1_month: "Within 1 month",
  within_3_months: "Within 3 months",
  within_6_months: "Within 6 months",
  exploring: "Just exploring",
};

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(-10);
}

export const ContactRequestSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  phone: z
    .string()
    .transform(normalizePhoneDigits)
    .refine((digits) => digits.length === 10, "Enter a valid 10-digit mobile number"),
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? "")
    .refine(
      (value) => value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Enter a valid email address",
    ),
  role: z.enum(CONTACT_USER_ROLE_VALUES, { message: "Select your role" }),
  serviceTiming: z.enum(CONTACT_SERVICE_TIMING_VALUES, {
    message: "Select when you need this service",
  }),
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(CONTACT_MESSAGE_MAX_LENGTH, `Message must be at most ${CONTACT_MESSAGE_MAX_LENGTH} characters`),
});

export type ValidatedContactInput = z.infer<typeof ContactRequestSchema>;

export type ContactValidationResult =
  | { ok: true; value: ValidatedContactInput }
  | { ok: false; status: 400; error: string };

/**
 * Validates contact form JSON body.
 */
export function validateContactBody(body: unknown): ContactValidationResult {
  const parsed = ContactRequestSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      status: 400,
      error: firstIssue?.message ?? "Invalid request",
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Returns true when honeypot field indicates a bot submission.
 */
export function isContactHoneypotTriggered(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const website = (body as { website?: unknown }).website;
  return typeof website === "string" && website.trim().length > 0;
}
