import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildContactSubmitPayload,
  CONTACT_MESSAGE_MAX_LENGTH,
  fireContactConversionEvent,
  isContactFormValid,
  normalizePhoneDigits,
  validateContactForm,
  type ContactFormValues,
} from "@/lib/contactFormSchema";

const validValues: ContactFormValues = {
  firstName: "Asha",
  lastName: "Sharma",
  phone: "9876543210",
  email: "asha@example.com",
  role: "property_owner",
  serviceTiming: "within_1_month",
  message: "I need help managing two properties.",
};

describe("normalizePhoneDigits", () => {
  it("strips non-digits and keeps the last 10 digits", () => {
    expect(normalizePhoneDigits("+91 98765 43210")).toBe("9876543210");
  });
});

describe("validateContactForm", () => {
  it("returns no errors for a valid form", () => {
    expect(validateContactForm(validValues)).toEqual({});
    expect(isContactFormValid(validValues)).toBe(true);
  });

  it("requires core fields", () => {
    const errors = validateContactForm({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      role: "",
      serviceTiming: "",
      message: "",
    });

    expect(errors.firstName).toBeDefined();
    expect(errors.lastName).toBeDefined();
    expect(errors.phone).toBeDefined();
    expect(errors.role).toBeDefined();
    expect(errors.serviceTiming).toBeDefined();
    expect(errors.message).toBeDefined();
  });

  it("rejects invalid email when provided", () => {
    const errors = validateContactForm({
      ...validValues,
      email: "not-an-email",
    });

    expect(errors.email).toBe("Enter a valid email address");
  });

  it("allows empty email", () => {
    const errors = validateContactForm({
      ...validValues,
      email: "",
    });

    expect(errors.email).toBeUndefined();
  });

  it("caps message length", () => {
    const errors = validateContactForm({
      ...validValues,
      message: "a".repeat(CONTACT_MESSAGE_MAX_LENGTH + 1),
    });

    expect(errors.message).toContain(String(CONTACT_MESSAGE_MAX_LENGTH));
  });
});

describe("buildContactSubmitPayload", () => {
  it("normalizes phone and trims text fields", () => {
    const payload = buildContactSubmitPayload(
      {
        ...validValues,
        firstName: "  Asha ",
        lastName: " Sharma ",
        phone: "+91 9876543210",
        message: "  Hello there ",
      },
      "",
    );

    expect(payload.firstName).toBe("Asha");
    expect(payload.lastName).toBe("Sharma");
    expect(payload.phone).toBe("9876543210");
    expect(payload.message).toBe("Hello there");
    expect(payload.website).toBe("");
  });
});

describe("fireContactConversionEvent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not throw when window.dataLayer is undefined beforehand", () => {
    vi.stubGlobal("window", {});
    expect(() => fireContactConversionEvent()).not.toThrow();
  });

  it("pushes contact_form_submit onto window.dataLayer", () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", { dataLayer });
    fireContactConversionEvent();
    expect(dataLayer).toEqual([{ event: "contact_form_submit" }]);
  });
});
