import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  buildContactSubmitPayload,
  CONTACT_SERVICE_TIMINGS,
  CONTACT_USER_ROLES,
  fireContactConversionEvent,
  isContactFormValid,
  normalizePhoneDigits,
  validateContactForm,
  type ContactFormErrors,
  type ContactFormField,
  type ContactFormValues,
} from "@/lib/contactFormSchema";
import { getMarketingApiBase } from "@/lib/marketingAuthLookup";
import { cn } from "@/lib/utils";

const EMPTY_VALUES: ContactFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  role: "",
  serviceTiming: "",
  message: "",
};

type SubmitState = "idle" | "loading" | "success" | "error";
type SubmitErrorKind = "rate_limit" | "generic";

function FieldLabel({
  children,
  required,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      {...(htmlFor ? { htmlFor } : {})}
      className="mb-3 block px-[14px] text-sm font-medium text-marketing-form-label"
    >
      {children}
      {required ? <span className="text-[#c93631]"> *</span> : null}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-1.5 text-xs text-red-600">{message}</p>;
}

const inputClassName =
  "w-full rounded-full border border-marketing-azure-stroke bg-marketing-cloud-050 px-[14px] py-3 text-sm text-marketing-form-label outline-none transition-colors placeholder:text-marketing-neutral-500 focus:border-marketing-blue focus:bg-white";

const textareaClassName =
  "w-full resize-none rounded-xl border border-marketing-azure-stroke bg-marketing-cloud-050 px-[14px] py-3 text-sm text-marketing-form-label outline-none transition-colors placeholder:text-marketing-neutral-500 focus:border-marketing-blue focus:bg-white";

export function ContactForm() {
  const [values, setValues] = useState<ContactFormValues>(EMPTY_VALUES);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitErrorKind, setSubmitErrorKind] = useState<SubmitErrorKind>("generic");
  const conversionFiredRef = useRef(false);

  const canSubmit = useMemo(() => isContactFormValid(values), [values]);

  const resetForm = useCallback(() => {
    setValues(EMPTY_VALUES);
    setWebsite("");
    setErrors({});
    setSubmitState("idle");
    setSubmitErrorKind("generic");
    conversionFiredRef.current = false;
  }, []);

  useEffect(() => {
    if (submitState !== "success" || conversionFiredRef.current) return;
    conversionFiredRef.current = true;
    fireContactConversionEvent();
  }, [submitState]);

  const updateField = useCallback((field: ContactFormField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
    if (submitState === "error") {
      setSubmitState("idle");
    }
  }, [submitState]);

  const handleSubmit = useCallback(async () => {
    const nextErrors = validateContactForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitState("loading");
    setSubmitErrorKind("generic");

    try {
      const response = await fetch(`${getMarketingApiBase()}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildContactSubmitPayload(values, website)),
      });

      if (response.status === 429) {
        setSubmitState("error");
        setSubmitErrorKind("rate_limit");
        return;
      }

      if (!response.ok) {
        setSubmitState("error");
        setSubmitErrorKind("generic");
        return;
      }

      setSubmitState("success");
    } catch {
      setSubmitState("error");
      setSubmitErrorKind("generic");
    }
  }, [values, website]);

  if (submitState === "success") {
    return (
      <div
        className="rounded-2xl bg-white p-8 shadow-[0_8px_40px_rgba(25,40,57,0.08)] ring-1 ring-black/[0.04] sm:p-10"
        role="status"
      >
        <h2 className="text-2xl font-medium text-marketing-navy">Thank you for reaching out</h2>
        <p className="mt-3 font-roboto text-sm leading-relaxed text-marketing-muted">
          We&apos;ve received your message and our team will get back to you shortly.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center justify-center rounded-lg bg-marketing-blue px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-marketing-blue-bright"
          >
            Send another message
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-marketing-border px-6 py-3 text-sm font-semibold text-marketing-navy transition-colors hover:border-marketing-muted/40 hover:bg-[#f8fafc]"
          >
            Keep exploring
          </Link>
        </div>
      </div>
    );
  }

  const submitErrorMessage =
    submitErrorKind === "rate_limit"
      ? "Too many requests. Please try again shortly."
      : "Something went wrong — email us at info@trustkeyper.com.";

  return (
    <div className="rounded-2xl bg-white p-8 shadow-[0_8px_40px_rgba(25,40,57,0.08)] ring-1 ring-black/[0.04] sm:p-10">
      <div className="grid gap-5 sm:gap-6">
        <input
          type="text"
          name="website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
          <div>
            <FieldLabel required htmlFor="contact-first-name">
              First Name
            </FieldLabel>
            <input
              id="contact-first-name"
              type="text"
              autoComplete="given-name"
              value={values.firstName}
              onChange={(event) => updateField("firstName", event.target.value)}
              className={inputClassName}
              aria-invalid={Boolean(errors.firstName)}
            />
            <FieldError message={errors.firstName} />
          </div>

          <div>
            <FieldLabel required htmlFor="contact-last-name">
              Last Name
            </FieldLabel>
            <input
              id="contact-last-name"
              type="text"
              autoComplete="family-name"
              value={values.lastName}
              onChange={(event) => updateField("lastName", event.target.value)}
              className={inputClassName}
              aria-invalid={Boolean(errors.lastName)}
            />
            <FieldError message={errors.lastName} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
          <div>
            <FieldLabel required htmlFor="contact-phone">
              Contact Number
            </FieldLabel>
            <div className="flex overflow-hidden rounded-full border border-marketing-azure-stroke bg-marketing-cloud-050 focus-within:border-marketing-blue focus-within:bg-white">
              <span className="flex shrink-0 items-center border-r border-marketing-azure-stroke px-[14px] text-sm text-marketing-neutral-500">
                +91
              </span>
              <input
                id="contact-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={values.phone}
                onChange={(event) => updateField("phone", normalizePhoneDigits(event.target.value))}
                maxLength={10}
                className="min-w-0 flex-1 bg-transparent px-[14px] py-3 text-sm text-marketing-form-label outline-none placeholder:text-marketing-neutral-500"
                aria-invalid={Boolean(errors.phone)}
              />
            </div>
            <FieldError message={errors.phone} />
          </div>

          <div>
            <FieldLabel htmlFor="contact-email">Email Address</FieldLabel>
            <input
              id="contact-email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(event) => updateField("email", event.target.value)}
              className={inputClassName}
              aria-invalid={Boolean(errors.email)}
            />
            <FieldError message={errors.email} />
          </div>
        </div>

        <div>
          <FieldLabel required>I am A</FieldLabel>
          <div className="flex flex-wrap gap-x-[15px] gap-y-3 px-[14px]">
            {CONTACT_USER_ROLES.map((role) => {
              const selected = values.role === role.id;

              return (
                <button
                  key={role.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => updateField("role", role.id)}
                  className="flex items-center gap-[7px] transition-colors"
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border border-marketing-azure-stroke bg-marketing-cloud-050",
                      selected && "border-marketing-green",
                    )}
                  >
                    <span
                      className={cn(
                        "size-2 rounded-full bg-marketing-green transition-opacity",
                        selected ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </span>
                  <span className="text-sm text-marketing-neutral-700">{role.label}</span>
                </button>
              );
            })}
          </div>
          <FieldError message={errors.role} />
        </div>

        <div>
          <FieldLabel required htmlFor="contact-service-timing">
            When do you need this service?
          </FieldLabel>
          <div className="relative">
            <select
              id="contact-service-timing"
              value={values.serviceTiming}
              onChange={(event) => updateField("serviceTiming", event.target.value)}
              className={cn(
                inputClassName,
                "appearance-none pr-10",
                !values.serviceTiming && "text-marketing-muted/70",
              )}
              aria-invalid={Boolean(errors.serviceTiming)}
            >
              <option value="">Select</option>
              {CONTACT_SERVICE_TIMINGS.map((timing) => (
                <option key={timing.value} value={timing.value}>
                  {timing.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={18}
              className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-marketing-neutral-500"
              aria-hidden
            />
          </div>
          <FieldError message={errors.serviceTiming} />
        </div>

        <div>
          <FieldLabel required htmlFor="contact-message">
            Message
          </FieldLabel>
          <textarea
            id="contact-message"
            value={values.message}
            onChange={(event) => updateField("message", event.target.value)}
            rows={5}
            placeholder="Placeholder"
            className={textareaClassName}
            aria-invalid={Boolean(errors.message)}
          />
          <FieldError message={errors.message} />
        </div>

        {submitState === "error" ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {submitErrorMessage}
          </p>
        ) : null}

        <div>
          <button
            type="button"
            disabled={!canSubmit || submitState === "loading"}
            onClick={() => void handleSubmit()}
            className={cn(
              "inline-flex h-14 w-full items-center justify-center gap-2 rounded-full px-6 font-roboto text-base font-medium transition-colors",
              canSubmit && submitState !== "loading"
                ? "bg-marketing-green text-marketing-neutral-1100 hover:brightness-105"
                : "cursor-not-allowed bg-marketing-neutral-300 text-marketing-neutral-700",
            )}
          >
            {submitState === "loading" ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                Sending...
              </>
            ) : (
              "Send Message"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
