import { z } from "zod";
import { normalizePhoneDigits } from "@workspace/auth-server/phone";

/** 10-digit Indian mobile — same normalization as web/server. */
export const PhoneDigitsSchema = z
  .string()
  .transform((value) => normalizePhoneDigits(value))
  .refine((value) => value.length === 10, {
    message: "Enter a valid 10-digit phone number",
  });

export const OtpTokenSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, { message: "Enter the 6-digit OTP" });

export const PhoneFormSchema = z.object({
  phone: PhoneDigitsSchema,
});

export const OtpFormSchema = z.object({
  phone: PhoneDigitsSchema,
  token: OtpTokenSchema,
});

export type PhoneFormValues = z.infer<typeof PhoneFormSchema>;
export type OtpFormValues = z.infer<typeof OtpFormSchema>;
