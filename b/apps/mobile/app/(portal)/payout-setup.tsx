import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { z } from "zod";
import {
  completePaymentOnboard,
  createPaymentOnboard,
  getPaymentOnboardStatus,
} from "@/lib/api/client";
import { loadStoredSession } from "@/lib/auth/secureSession";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { CheckboxOption } from "@/lib/ui/CheckboxOption";
import { Spinner } from "@/lib/ui/Spinner";
import { Stack } from "@/lib/ui/Stack";
import { StackScreenHeader } from "@/lib/ui/StackScreenHeader";
import { TextField } from "@/lib/ui/TextField";
import { Heading, Text } from "@/lib/ui/Typography";

const payoutFormSchema = z.object({
  legalName: z.string().trim().min(4, "Legal name must be at least 4 characters"),
  email: z.string().trim().email("Enter a valid email"),
  pan: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z]{3}P[A-Z]\d{4}[A-Z]$/.test(v), "Enter a valid personal PAN"),
  street: z.string().trim().min(1, "Street is required"),
  street2: z.string().trim().min(1, "Area / locality is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z][A-Z0-9_ ]+$/.test(v), "Enter a valid state name"),
  postalCode: z
    .string()
    .trim()
    .refine((v) => /^\d{6}$/.test(v), "PIN must be 6 digits"),
  bankAccountNumber: z
    .string()
    .trim()
    .refine((v) => v.length >= 5 && v.length <= 35, "Account number must be 5–35 characters"),
  bankIfsc: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), "Enter a valid IFSC"),
  bankBeneficiaryName: z
    .string()
    .trim()
    .min(4, "Beneficiary name must be at least 4 characters"),
  tncAccepted: z
    .boolean()
    .refine((value) => value === true, { message: "Accept terms to continue" }),
});

type PayoutFormValues = z.input<typeof payoutFormSchema>;

export default function PortalPayoutSetupScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ agreementId?: string }>();
  const agreementId =
    typeof params.agreementId === "string" ? params.agreementId : undefined;

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["stored-session"],
    queryFn: loadStoredSession,
  });
  const phone = sessionQuery.data?.phone?.replace(/\D/g, "").slice(-10) ?? "";

  const statusQuery = useQuery({
    queryKey: ["payment-onboard-status", phone, "owner"],
    queryFn: () => getPaymentOnboardStatus(phone, "owner"),
    enabled: phone.length === 10,
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PayoutFormValues>({
    resolver: zodResolver(payoutFormSchema),
    defaultValues: {
      legalName: "",
      email: "",
      pan: "",
      street: "",
      street2: "",
      city: "",
      state: "",
      postalCode: "",
      bankAccountNumber: "",
      bankIfsc: "",
      bankBeneficiaryName: "",
      tncAccepted: false,
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (values: z.output<typeof payoutFormSchema>) => {
      if (phone.length !== 10) {
        throw new Error("Phone number missing from session");
      }
      await createPaymentOnboard({
        phone,
        role: "owner",
        legalName: values.legalName,
        email: values.email,
        registeredAddress: {
          street1: values.street,
          street2: values.street2,
          city: values.city,
          state: values.state,
          postalCode: values.postalCode,
          country: "IN",
        },
      });
      await completePaymentOnboard({
        phone,
        role: "owner",
        stakeholderName: values.legalName,
        stakeholderEmail: values.email,
        pan: values.pan,
        residentialAddress: {
          street: values.street,
          city: values.city,
          state: values.state,
          postalCode: values.postalCode,
          country: "IN",
        },
        bankAccountNumber: values.bankAccountNumber,
        bankIfsc: values.bankIfsc,
        bankBeneficiaryName: values.bankBeneficiaryName,
        tncAccepted: true,
      });
    },
  });

  const onSubmit = handleSubmit(async (raw) => {
    setSubmitError(null);
    setSuccessMessage(null);
    const parsed = payoutFormSchema.safeParse(raw);
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    try {
      await submitMutation.mutateAsync(parsed.data);
      const refreshedStatus = await statusQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["portal-agreements"] });
      if (agreementId) {
        await queryClient.invalidateQueries({
          queryKey: ["portal-agreement", agreementId],
        });
      }
      if (refreshedStatus.data?.validationStatus === "needs_clarification") {
        setSubmitError(
          "Razorpay needs corrected payout details. Ensure the legal name and account beneficiary name match exactly.",
        );
      } else {
        setSuccessMessage(
          "Payout details submitted. Verification can take a short while.",
        );
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not submit payout setup",
      );
    }
  });

  const fallback: Href = agreementId
    ? ({
        pathname: "/(portal)/agreement/[agreementId]",
        params: { agreementId },
      } as Href)
    : ("/(portal)/home" as Href);

  if (sessionQuery.isLoading) {
    return (
      <ScreenSafeArea scroll={false}>
        <StackScreenHeader title="Payout setup" fallbackHref={"/(portal)/home" as Href} />
        <Spinner accessibilityLabel="Loading session" />
      </ScreenSafeArea>
    );
  }

  const validationStatus = statusQuery.data?.validationStatus;
  const alreadyActivated = validationStatus === "activated";
  const needsClarification = validationStatus === "needs_clarification";

  return (
    <ScreenSafeArea>
      <StackScreenHeader title="Payout setup" fallbackHref={fallback} />

      <Stack gap="spacing.4">
        <View style={{ gap: 8 }}>
          <Heading size="large">Bank payout details</Heading>
          <Text color="subtle">
            Bank account only — used to receive rent via Razorpay Route.
          </Text>
        </View>

        {statusQuery.isLoading ? (
          <Text color="subtle">Checking payout status…</Text>
        ) : null}
        {statusQuery.error ? (
          <Alert
            description={
              statusQuery.error instanceof Error
                ? statusQuery.error.message
                : "Could not load payout status"
            }
          />
        ) : null}

        {alreadyActivated ? (
          <Alert
            color="positive"
            description="Your payout account is already activated."
          />
        ) : null}

        {needsClarification ? (
          <Alert
            description="Razorpay needs corrected payout details. Ensure the legal name and account beneficiary name match exactly, then submit again."
          />
        ) : null}

        {successMessage ? (
          <Alert color="positive" description={successMessage} />
        ) : null}

        {!alreadyActivated && !successMessage ? (
          <View style={{ width: "100%", gap: 12 }}>
            <Text size="small" color="subtle">
              Fields marked * are mandatory.
            </Text>
            <Controller
              control={control}
              name="legalName"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Legal name"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.legalName?.message}
                  necessityIndicator="required"
                  isDisabled={submitMutation.isPending}
                />
              )}
            />
            <Controller
              control={control}
              name="email"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Email"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  keyboardType="email"
                  autoCapitalize="none"
                  error={errors.email?.message}
                  necessityIndicator="required"
                  isDisabled={submitMutation.isPending}
                />
              )}
            />
            <Controller
              control={control}
              name="pan"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="PAN"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={(text) => onChange(text.toUpperCase())}
                  autoCapitalize="characters"
                  error={errors.pan?.message}
                  necessityIndicator="required"
                  isDisabled={submitMutation.isPending}
                />
              )}
            />
            <Controller
              control={control}
              name="street"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Street address"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.street?.message}
                  necessityIndicator="required"
                  isDisabled={submitMutation.isPending}
                />
              )}
            />
            <Controller
              control={control}
              name="street2"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Area / locality"
                  value={value ?? ""}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.street2?.message}
                  necessityIndicator="required"
                  isDisabled={submitMutation.isPending}
                />
              )}
            />
            <Controller
              control={control}
              name="city"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="City"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.city?.message}
                  necessityIndicator="required"
                  isDisabled={submitMutation.isPending}
                />
              )}
            />
            <Controller
              control={control}
              name="state"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="State"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={(text) => onChange(text.toUpperCase())}
                  autoCapitalize="characters"
                  error={errors.state?.message}
                  necessityIndicator="required"
                  isDisabled={submitMutation.isPending}
                />
              )}
            />
            <Controller
              control={control}
              name="postalCode"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="PIN code"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number"
                  error={errors.postalCode?.message}
                  necessityIndicator="required"
                  isDisabled={submitMutation.isPending}
                />
              )}
            />
            <Controller
              control={control}
              name="bankBeneficiaryName"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Account beneficiary name"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.bankBeneficiaryName?.message}
                  necessityIndicator="required"
                  isDisabled={submitMutation.isPending}
                />
              )}
            />
            <Controller
              control={control}
              name="bankAccountNumber"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Bank account number"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  keyboardType="number"
                  error={errors.bankAccountNumber?.message}
                  necessityIndicator="required"
                  isDisabled={submitMutation.isPending}
                />
              )}
            />
            <Controller
              control={control}
              name="bankIfsc"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="IFSC"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={(text) => onChange(text.toUpperCase())}
                  autoCapitalize="characters"
                  error={errors.bankIfsc?.message}
                  necessityIndicator="required"
                  isDisabled={submitMutation.isPending}
                />
              )}
            />
            <Controller
              control={control}
              name="tncAccepted"
              render={({ field: { onChange, value } }) => (
                <CheckboxOption
                  label="I accept Razorpay Route terms for payouts *"
                  isChecked={Boolean(value)}
                  onChange={onChange}
                  isDisabled={submitMutation.isPending}
                />
              )}
            />
            {errors.tncAccepted?.message ? (
              <Alert description={errors.tncAccepted.message} />
            ) : null}

            {submitError ? <Alert description={submitError} /> : null}

            <Button
              title="Submit payout details"
              onPress={() => void onSubmit()}
              isLoading={submitMutation.isPending}
              isDisabled={submitMutation.isPending}
            />
          </View>
        ) : (
          <Button
            title="Back to agreement"
            variant="secondary"
            onPress={() => {
              if (agreementId) {
                router.replace({
                  pathname: "/(portal)/agreement/[agreementId]",
                  params: { agreementId },
                } as Href);
              } else {
                router.replace("/(portal)/home" as Href);
              }
            }}
          />
        )}
      </Stack>
    </ScreenSafeArea>
  );
}
