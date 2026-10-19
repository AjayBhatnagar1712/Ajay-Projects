import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import {
  completePaymentOnboard,
  createPaymentOnboard,
  getBrokerProfile,
} from "@/lib/api/client";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { derivePayoutAddressFromProfile } from "@/lib/payments/payoutAddress";
import {
  brokerPayoutFormSchema,
  type BrokerPayoutFormValues,
} from "@/lib/payments/payoutForm";
import { derivePayoutSetupView } from "@/lib/payments/payoutStatus";
import {
  brokerPayoutStatusQueryKey,
  useBrokerPayoutStatus,
} from "@/lib/payments/useBrokerPayoutStatus";
import { goBackOrFallback } from "@/lib/navigation/goBackOrFallback";
import { shape } from "@/lib/theme/shape";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import {
  focusNextField,
  submitPrimaryFromKeyboard,
  type FieldFocusHandle,
} from "@/lib/ui/fieldFocusChain";
import { Spinner } from "@/lib/ui/Spinner";
import { StackScreenHeader } from "@/lib/ui/StackScreenHeader";
import { TintedSectionCard } from "@/lib/ui/TintedSectionCard";
import { Text } from "@/lib/ui/Typography";
import { TextField } from "@/lib/ui/TextField";
import { Stack } from "@/lib/ui/Stack";

const SUCCESS_COPY =
  "Payout details submitted. Verification can take a short while.";

const FALLBACK: Href = "/(tabs)/profile";

export default function BrokerPayoutSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ edit?: string }>();
  const queryClient = useQueryClient();
  const { phone, status, view, isLoading, error, refetch } =
    useBrokerPayoutStatus();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [editingExisting, setEditingExisting] = useState(params.edit === "1");

  const profileQuery = useQuery({
    queryKey: ["broker-profile"],
    queryFn: getBrokerProfile,
  });

  const legalNameRef = useRef<FieldFocusHandle>(null);
  const panRef = useRef<FieldFocusHandle>(null);
  const beneficiaryNameRef = useRef<FieldFocusHandle>(null);
  const accountRef = useRef<FieldFocusHandle>(null);
  const ifscRef = useRef<FieldFocusHandle>(null);
  const emailRef = useRef<FieldFocusHandle>(null);
  const addressLine1Ref = useRef<FieldFocusHandle>(null);
  const addressLine2Ref = useRef<FieldFocusHandle>(null);
  const cityRef = useRef<FieldFocusHandle>(null);
  const stateRef = useRef<FieldFocusHandle>(null);
  const postalCodeRef = useRef<FieldFocusHandle>(null);

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<BrokerPayoutFormValues>({
    resolver: zodResolver(brokerPayoutFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      legalName: "",
      pan: "",
      bankBeneficiaryName: "",
      bankAccountNumber: "",
      bankIfsc: "",
      email: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
    },
  });

  useEffect(() => {
    const name = profileQuery.data?.name?.trim() ?? "";
    if (name.length === 0) return;
    if (getValues("legalName").trim().length > 0) return;
    setValue("legalName", name);
  }, [profileQuery.data, getValues, setValue]);

  useEffect(() => {
    const result = derivePayoutAddressFromProfile(profileQuery.data ?? null);
    if (!result.ok) return;

    const { address } = result;
    if (getValues("city").trim().length === 0) {
      setValue("city", address.city);
    }
    if (getValues("state").trim().length === 0) {
      setValue("state", address.state);
    }
    if (getValues("postalCode").trim().length === 0) {
      setValue("postalCode", address.postalCode);
    }
  }, [profileQuery.data, getValues, setValue]);

  const submitMutation = useMutation({
    mutationFn: async (values: BrokerPayoutFormValues) => {
      if (phone.length !== 10) {
        throw new Error("Phone number missing from session");
      }
      const parsed = brokerPayoutFormSchema.parse(values);
      await createPaymentOnboard({
        phone,
        role: "broker",
        legalName: parsed.legalName,
        email: parsed.email,
        registeredAddress: {
          street1: parsed.addressLine1,
          street2: parsed.addressLine2,
          city: parsed.city,
          state: parsed.state,
          postalCode: parsed.postalCode,
          country: "IN",
        },
      });
      await completePaymentOnboard({
        phone,
        role: "broker",
        stakeholderName: parsed.legalName,
        stakeholderEmail: parsed.email,
        pan: parsed.pan,
        residentialAddress: {
          street: `${parsed.addressLine1}, ${parsed.addressLine2}`,
          city: parsed.city,
          state: parsed.state,
          postalCode: parsed.postalCode,
          country: "IN",
        },
        bankAccountNumber: parsed.bankAccountNumber,
        bankIfsc: parsed.bankIfsc,
        bankBeneficiaryName: parsed.bankBeneficiaryName,
        tncAccepted: true,
      });
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await submitMutation.mutateAsync(values);
      await refetch();
      await queryClient.invalidateQueries({
        queryKey: brokerPayoutStatusQueryKey(phone),
      });
      setEditingExisting(false);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Could not submit payout details",
      );
    }
  });

  const goBack = () => {
    goBackOrFallback(router, () => {
      router.replace(FALLBACK);
    });
  };

  if (isLoading || profileQuery.isLoading) {
    return (
      <ScreenSafeArea tabBarClearance={false} scroll={false}>
        <StackScreenHeader title="Payout Details" fallbackHref={FALLBACK} />
        <Spinner accessibilityLabel="Loading payout details" />
        <Text color="subtle">Loading…</Text>
      </ScreenSafeArea>
    );
  }

  const currentView = submitted
    ? derivePayoutSetupView(status) === "active"
      ? "active"
      : "pending"
    : view;
  const showForm =
    editingExisting || currentView === "not_setup" || currentView === "failed";
  const showConfirmation = !showForm;

  return (
    <ScreenSafeArea tabBarClearance={false}>
      <StackScreenHeader title="Payout Details" fallbackHref={FALLBACK} />

      <Stack gap="spacing.4">
        {error ? (
          <Alert
            description={
              error.message.length > 0
                ? error.message
                : "Could not load payout status"
            }
          />
        ) : null}

        {showConfirmation ? (
          <Stack gap="spacing.4">
            <Alert
              color="positive"
              description={
                currentView === "active"
                  ? "Your payout details are verified — you can now receive consultancy fees."
                  : SUCCESS_COPY
              }
            />
            <Button
              title="Change payout details"
              variant="secondary"
              onPress={() => {
                setSubmitError(null);
                setSubmitted(false);
                setEditingExisting(true);
              }}
            />
            <Button title="Back" variant="secondary" onPress={goBack} />
          </Stack>
        ) : (
          <View style={{ width: "100%", gap: shape.sectionFieldGap }}>
            {editingExisting ? (
              <Alert description="Enter all required details again. Submitting will replace the bank account used for future consultancy-fee payouts." />
            ) : null}
            <Text size="small" color="subtle">
              Fields marked * are mandatory.
            </Text>
            <TintedSectionCard gap={shape.sectionFieldGap}>
              <Controller
                control={control}
                name="legalName"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    ref={legalNameRef}
                    label="Legal name"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    autoCapitalize="words"
                    error={errors.legalName?.message}
                    necessityIndicator="required"
                    isDisabled={submitMutation.isPending}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={focusNextField(panRef)}
                  />
                )}
              />
              <Controller
                control={control}
                name="pan"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    ref={panRef}
                    label="PAN"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={(text) => onChange(text.toUpperCase())}
                    autoCapitalize="characters"
                    error={errors.pan?.message}
                    necessityIndicator="required"
                    isDisabled={submitMutation.isPending}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={focusNextField(beneficiaryNameRef)}
                  />
                )}
              />
              <Controller
                control={control}
                name="bankBeneficiaryName"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    ref={beneficiaryNameRef}
                    label="Account holder name"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    autoCapitalize="words"
                    error={errors.bankBeneficiaryName?.message}
                    necessityIndicator="required"
                    isDisabled={submitMutation.isPending}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={focusNextField(accountRef)}
                  />
                )}
              />
              <Controller
                control={control}
                name="bankAccountNumber"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    ref={accountRef}
                    label="Bank account number"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    keyboardType="number"
                    error={errors.bankAccountNumber?.message}
                    necessityIndicator="required"
                    isDisabled={submitMutation.isPending}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={focusNextField(ifscRef)}
                  />
                )}
              />
              <Controller
                control={control}
                name="bankIfsc"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    ref={ifscRef}
                    label="IFSC code"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={(text) => onChange(text.toUpperCase())}
                    autoCapitalize="characters"
                    error={errors.bankIfsc?.message}
                    necessityIndicator="required"
                    isDisabled={submitMutation.isPending}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={focusNextField(emailRef)}
                  />
                )}
              />
              <Controller
                control={control}
                name="email"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    ref={emailRef}
                    label="Email"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    keyboardType="email"
                    autoCapitalize="none"
                    error={errors.email?.message}
                    necessityIndicator="required"
                    isDisabled={submitMutation.isPending}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={focusNextField(addressLine1Ref)}
                  />
                )}
              />
              <Controller
                control={control}
                name="addressLine1"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    ref={addressLine1Ref}
                    label="Address line 1"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    autoCapitalize="words"
                    error={errors.addressLine1?.message}
                    necessityIndicator="required"
                    isDisabled={submitMutation.isPending}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={focusNextField(addressLine2Ref)}
                  />
                )}
              />
              <Controller
                control={control}
                name="addressLine2"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    ref={addressLine2Ref}
                    label="Address line 2 / locality"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    autoCapitalize="words"
                    error={errors.addressLine2?.message}
                    necessityIndicator="required"
                    isDisabled={submitMutation.isPending}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={focusNextField(cityRef)}
                  />
                )}
              />
              <Controller
                control={control}
                name="city"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    ref={cityRef}
                    label="City"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    autoCapitalize="words"
                    error={errors.city?.message}
                    necessityIndicator="required"
                    isDisabled={submitMutation.isPending}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={focusNextField(stateRef)}
                  />
                )}
              />
              <Controller
                control={control}
                name="state"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    ref={stateRef}
                    label="State"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={(text) => onChange(text.toUpperCase())}
                    autoCapitalize="characters"
                    error={errors.state?.message}
                    necessityIndicator="required"
                    isDisabled={submitMutation.isPending}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={focusNextField(postalCodeRef)}
                  />
                )}
              />
              <Controller
                control={control}
                name="postalCode"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    ref={postalCodeRef}
                    label="PIN code"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={(text) =>
                      onChange(text.replace(/\D/g, "").slice(0, 6))
                    }
                    keyboardType="number"
                    error={errors.postalCode?.message}
                    necessityIndicator="required"
                    isDisabled={submitMutation.isPending}
                    returnKeyType="done"
                    onSubmitEditing={submitPrimaryFromKeyboard(() =>
                      void onSubmit()
                    )}
                  />
                )}
              />
            </TintedSectionCard>

            <Text size="small" color="subtle">
              By submitting, you accept Razorpay Route terms for payouts.
            </Text>

            {submitError ? <Alert description={submitError} /> : null}

            <Button
              title="Submit"
              onPress={() => void onSubmit()}
              isLoading={submitMutation.isPending}
              isDisabled={submitMutation.isPending}
            />
          </View>
        )}
      </Stack>
    </ScreenSafeArea>
  );
}
