import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Landmark,
  Loader2,
  MapPin,
  User,
} from "lucide-react";
import OwnerLayout from "@/components/OwnerLayout";
import { OwnerFlowButton } from "@/components/owner/OwnerFlowButton";
import { getActiveSession } from "@/lib/auth";
import { getOwnerProfile } from "@/lib/ownerProfile";
import {
  fetchPaymentRecipientStatus,
  submitOwnerPaymentOnboarding,
} from "@/lib/ownerPaymentOnboard";
import {
  createEmptyOwnerPaymentSetupForm,
  deriveOwnerPaymentSetupView,
  normalizeCountryCode,
  ownerPaymentSetupFormSchema,
  validateOwnerPaymentSetupField,
  type OwnerPaymentSetupFormValues,
  type OwnerPaymentSetupView,
} from "@/lib/ownerPaymentOnboardSchemas";
import { getProperties } from "@/lib/properties";

type PagePhase = "loading" | "status_error" | "ready" | "content";

type FieldKey = keyof OwnerPaymentSetupFormValues;

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 mb-1">
      {children}
      {required ? <span className="text-red-500 ml-0.5">*</span> : null}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  autoComplete,
  inputMode,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete={autoComplete}
      inputMode={inputMode}
      className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
    />
  );
}

function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-xs text-red-600 mt-1">{message}</p>;
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Icon size={18} className="text-primary shrink-0" />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </section>
  );
}

function StatusPanel({
  icon: Icon,
  iconClassName,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  iconClassName: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="max-w-xl mx-auto mt-8 sm:mt-10 px-4 sm:px-0 bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
      <div
        className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center ${iconClassName}`}
      >
        <Icon size={28} />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
      </div>
      {action}
    </div>
  );
}

function buildInitialFormValues(): OwnerPaymentSetupFormValues {
  const profile = getOwnerProfile();
  const property = getProperties()[0];
  return {
    ...createEmptyOwnerPaymentSetupForm(),
    legalName: profile.name?.trim() ?? "",
    email: profile.email?.trim() ?? "",
    street: property?.address?.trim() ?? "",
    street2: property?.area?.trim() ?? "",
    city: property?.city?.trim() ?? "",
    postalCode: property?.pincode?.trim() ?? "",
    country: normalizeCountryCode(property?.country?.trim() ?? ""),
    bankAccountNumber: profile.bankAccountNumber?.trim() ?? "",
    bankIfsc: profile.bankIFSC?.trim().toUpperCase() ?? "",
    bankBeneficiaryName: profile.bankHolderName?.trim() ?? "",
  };
}

function PaymentSetupForm({
  form,
  fieldErrors,
  submitError,
  submitting,
  onFieldChange,
  onSubmit,
}: {
  form: OwnerPaymentSetupFormValues;
  fieldErrors: Partial<Record<FieldKey, string | null>>;
  submitError: string | null;
  submitting: boolean;
  onFieldChange: (field: FieldKey, value: string | boolean) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto mt-8 sm:mt-10 mb-8 sm:mb-10 px-4 sm:px-0 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Set up rent payments</h1>
        <p className="text-sm text-gray-600">
          Connect your bank account to receive monthly rent through TrustKeyper.
        </p>
      </div>

      {submitError ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p>{submitError}</p>
        </div>
      ) : null}

      <SectionCard icon={User} title="Confirm your details">
        <div>
          <FieldLabel required>Legal name</FieldLabel>
          <TextInput
            value={form.legalName}
            onChange={(value) => onFieldChange("legalName", value)}
            placeholder="As on your PAN card"
            autoComplete="name"
          />
          <FieldError message={fieldErrors.legalName} />
        </div>
        <div>
          <FieldLabel required>Email</FieldLabel>
          <TextInput
            type="email"
            value={form.email}
            onChange={(value) => onFieldChange("email", value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <FieldError message={fieldErrors.email} />
        </div>
      </SectionCard>

      <SectionCard icon={CreditCard} title="Tax ID">
        <div>
          <FieldLabel required>PAN number</FieldLabel>
          <TextInput
            value={form.pan}
            onChange={(value) => onFieldChange("pan", value.toUpperCase())}
            placeholder="ABCPK1234D"
            autoComplete="off"
          />
          <FieldError message={fieldErrors.pan} />
        </div>
      </SectionCard>

      <SectionCard icon={MapPin} title="Address">
        <div>
          <FieldLabel required>Street</FieldLabel>
          <TextInput
            value={form.street}
            onChange={(value) => onFieldChange("street", value)}
            placeholder="House / building / street"
            autoComplete="street-address"
          />
          <FieldError message={fieldErrors.street} />
        </div>
        <div>
          <FieldLabel required>Area / Locality / Landmark</FieldLabel>
          <TextInput
            value={form.street2}
            onChange={(value) => onFieldChange("street2", value)}
            placeholder="Area, locality, or landmark"
            autoComplete="address-line2"
          />
          <FieldError message={fieldErrors.street2} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel required>City</FieldLabel>
            <TextInput
              value={form.city}
              onChange={(value) => onFieldChange("city", value)}
              placeholder="City"
              autoComplete="address-level2"
            />
            <FieldError message={fieldErrors.city} />
          </div>
          <div>
            <FieldLabel required>State</FieldLabel>
            <TextInput
              value={form.state}
              onChange={(value) => onFieldChange("state", value.toUpperCase())}
              placeholder="KARNATAKA"
              autoComplete="address-level1"
            />
            <FieldError message={fieldErrors.state} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel required>Postal code</FieldLabel>
            <TextInput
              value={form.postalCode}
              onChange={(value) => onFieldChange("postalCode", value.replace(/\D/g, "").slice(0, 6))}
              placeholder="560034"
              inputMode="numeric"
              autoComplete="postal-code"
            />
            <FieldError message={fieldErrors.postalCode} />
          </div>
          <div>
            <FieldLabel>Country</FieldLabel>
            <TextInput
              value={form.country}
              onChange={(value) => onFieldChange("country", value.toUpperCase())}
              placeholder="IN"
              autoComplete="country"
            />
            <FieldError message={fieldErrors.country} />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Landmark} title="Bank account">
        <div>
          <FieldLabel required>Account number</FieldLabel>
          <TextInput
            value={form.bankAccountNumber}
            onChange={(value) => onFieldChange("bankAccountNumber", value)}
            placeholder="Account number"
            autoComplete="off"
          />
          <FieldError message={fieldErrors.bankAccountNumber} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel required>IFSC</FieldLabel>
            <TextInput
              value={form.bankIfsc}
              onChange={(value) => onFieldChange("bankIfsc", value.toUpperCase())}
              placeholder="HDFC0001234"
              autoComplete="off"
            />
            <FieldError message={fieldErrors.bankIfsc} />
          </div>
          <div>
            <FieldLabel required>Beneficiary name</FieldLabel>
            <TextInput
              value={form.bankBeneficiaryName}
              onChange={(value) => onFieldChange("bankBeneficiaryName", value)}
              placeholder="Name on bank account"
              autoComplete="off"
            />
            <FieldError message={fieldErrors.bankBeneficiaryName} />
          </div>
        </div>
      </SectionCard>

      <section className="bg-white rounded-xl border border-gray-200 px-5 py-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.tncAccepted}
            onChange={(event) => onFieldChange("tncAccepted", event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
          />
          <span className="text-sm text-gray-700">
            I accept the Terms and Conditions for payment settlement
          </span>
        </label>
        <FieldError message={fieldErrors.tncAccepted} />
      </section>

      <OwnerFlowButton
        type="button"
        fullWidth
        disabled={submitting}
        onClick={onSubmit}
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Submitting…
          </>
        ) : (
          "Set up payments"
        )}
      </OwnerFlowButton>
    </div>
  );
}

export default function OwnerPaymentSetup() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<PagePhase>("loading");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [setupView, setSetupView] = useState<OwnerPaymentSetupView>("form");
  const [showFormAfterFailure, setShowFormAfterFailure] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [form, setForm] = useState<OwnerPaymentSetupFormValues>(buildInitialFormValues);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string | null>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = useCallback(async () => {
    setPhase("loading");
    setStatusError(null);

    const session = getActiveSession();
    if (!session || session.role !== "owner") {
      setLocation("/login");
      return;
    }

    const result = await fetchPaymentRecipientStatus();
    if (!result.ok) {
      setStatusError(result.error);
      setPhase("status_error");
      return;
    }

    const view = deriveOwnerPaymentSetupView(result.status);
    setSetupView(view);
    setPhase(view === "ready" ? "ready" : "content");
  }, [setLocation]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleFieldChange = useCallback((field: FieldKey, value: string | boolean) => {
    setForm((current) => {
      const next = { ...current, [field]: value } as OwnerPaymentSetupFormValues;
      setFieldErrors((errors) => ({
        ...errors,
        [field]: validateOwnerPaymentSetupField(field, next),
      }));
      return next;
    });
    setSubmitError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    const parsed = ownerPaymentSetupFormSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: Partial<Record<FieldKey, string | null>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in nextErrors)) {
          nextErrors[key as FieldKey] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      setSubmitError("Please fix the highlighted fields and try again.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const result = await submitOwnerPaymentOnboarding(parsed.data);
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    setJustSubmitted(true);
    setSetupView("verifying");
    setShowFormAfterFailure(false);
    setPhase("content");
  }, [form]);

  const content = useMemo(() => {
    if (phase === "loading") {
      return (
        <div className="max-w-xl mx-auto flex flex-col items-center justify-center py-20 text-gray-500">
          <Loader2 size={28} className="animate-spin mb-3" />
          <p className="text-sm">Loading payment setup…</p>
        </div>
      );
    }

    if (phase === "status_error") {
      return (
        <StatusPanel
          icon={AlertCircle}
          iconClassName="bg-red-50 text-red-600"
          title="Could not load payment status"
          description={statusError ?? "Something went wrong. Please try again."}
          action={
            <OwnerFlowButton type="button" onClick={() => void loadStatus()}>
              Retry
            </OwnerFlowButton>
          }
        />
      );
    }

    if (phase === "ready" || setupView === "ready") {
      return (
        <StatusPanel
          icon={CheckCircle2}
          iconClassName="bg-green-50 text-green-600"
          title="Your account is ready ✓"
          description="Your payout account is verified. Rent payments from tenants will be settled to your linked bank account."
        />
      );
    }

    if (setupView === "verifying" || justSubmitted) {
      return (
        <StatusPanel
          icon={Clock}
          iconClassName="bg-amber-50 text-amber-600"
          title="Verification in progress"
          description="Thanks! Your payment account is being verified. This usually takes about 24 hours. We'll notify you once it's ready."
        />
      );
    }

    if (setupView === "failed" && !showFormAfterFailure) {
      return (
        <StatusPanel
          icon={AlertCircle}
          iconClassName="bg-red-50 text-red-600"
          title="Verification needs attention"
          description="We could not verify your payout account with the details provided. Please review your information and submit again."
          action={
            <OwnerFlowButton type="button" onClick={() => setShowFormAfterFailure(true)}>
              Update details and resubmit
            </OwnerFlowButton>
          }
        />
      );
    }

    return (
      <PaymentSetupForm
        form={form}
        fieldErrors={fieldErrors}
        submitError={submitError}
        submitting={submitting}
        onFieldChange={handleFieldChange}
        onSubmit={() => void handleSubmit()}
      />
    );
  }, [
    fieldErrors,
    form,
    handleFieldChange,
    handleSubmit,
    justSubmitted,
    loadStatus,
    phase,
    setupView,
    showFormAfterFailure,
    statusError,
    submitError,
    submitting,
  ]);

  return <OwnerLayout>{content}</OwnerLayout>;
}
