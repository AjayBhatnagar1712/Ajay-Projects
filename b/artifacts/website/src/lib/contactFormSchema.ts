export const CONTACT_MESSAGE_MAX_LENGTH = 5000;

export const CONTACT_USER_ROLES = [
  { id: "property_owner", label: "Property Owner" },
  { id: "tenant", label: "Tenant" },
  { id: "broker", label: "Broker" },
] as const;

export type ContactUserRole = (typeof CONTACT_USER_ROLES)[number]["id"];

export const CONTACT_SERVICE_TIMINGS = [
  { value: "immediately", label: "Immediately" },
  { value: "within_1_month", label: "Within 1 month" },
  { value: "within_3_months", label: "Within 3 months" },
  { value: "within_6_months", label: "Within 6 months" },
  { value: "exploring", label: "Just exploring" },
] as const;

export type ContactServiceTiming = (typeof CONTACT_SERVICE_TIMINGS)[number]["value"];

export interface ContactFormValues {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  role: ContactUserRole | "";
  serviceTiming: ContactServiceTiming | "";
  message: string;
}

export type ContactFormField =
  | "firstName"
  | "lastName"
  | "phone"
  | "email"
  | "role"
  | "serviceTiming"
  | "message";

export type ContactFormErrors = Partial<Record<ContactFormField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(-10);
}

export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = "First name is required";
  }

  if (!values.lastName.trim()) {
    errors.lastName = "Last name is required";
  }

  const phoneDigits = normalizePhoneDigits(values.phone);
  if (phoneDigits.length !== 10) {
    errors.phone = "Enter a valid 10-digit mobile number";
  }

  if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Enter a valid email address";
  }

  if (!values.role) {
    errors.role = "Select your role";
  }

  if (!values.serviceTiming) {
    errors.serviceTiming = "Select when you need this service";
  }

  if (!values.message.trim()) {
    errors.message = "Message is required";
  } else if (values.message.trim().length > CONTACT_MESSAGE_MAX_LENGTH) {
    errors.message = `Message must be at most ${CONTACT_MESSAGE_MAX_LENGTH} characters`;
  }

  return errors;
}

export function isContactFormValid(values: ContactFormValues): boolean {
  return Object.keys(validateContactForm(values)).length === 0;
}

export interface ContactFormSubmitPayload extends ContactFormValues {
  website: string;
}

export function buildContactSubmitPayload(
  values: ContactFormValues,
  website: string,
): ContactFormSubmitPayload {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: normalizePhoneDigits(values.phone),
    email: values.email.trim(),
    role: values.role,
    serviceTiming: values.serviceTiming,
    message: values.message.trim(),
    website,
  };
}

export function fireContactConversionEvent(): void {
  if (typeof globalThis.window === "undefined") return;
  globalThis.window.dataLayer = globalThis.window.dataLayer ?? [];
  globalThis.window.dataLayer.push({ event: "contact_form_submit" });
}
