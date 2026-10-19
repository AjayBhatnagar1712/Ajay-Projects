import { zodResolver } from "@hookform/resolvers/zod";
import { BrokerOnboardingStep3Schema } from "@workspace/api-schemas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { z } from "zod";
import { getBrokerProfile, patchBrokerProfile } from "@/lib/api/client";
import {
  onboardingStepHref,
  previousOnboardingStepHref,
} from "@/lib/broker/previousOnboardingStepHref";
import {
  onboardingStepDescription,
  useIsProfileEdit,
  useIsOnboardingResume,
} from "@/lib/broker/onboardingResume";
import {
  profileHasStep3Data,
  step3ValuesFromProfile,
} from "@/lib/broker/step3FormValues";
import { goBackOrFallback } from "@/lib/navigation/goBackOrFallback";
import { shape } from "@/lib/theme/shape";
import { Alert } from "@/lib/ui/Alert";
import {
  focusNextField,
  submitPrimaryFromKeyboard,
  type FieldFocusHandle,
} from "@/lib/ui/fieldFocusChain";
import { FormSectionCard } from "@/lib/ui/FormSectionCard";
import { MultiSelectCheckboxGroup } from "@/lib/ui/MultiSelectCheckboxGroup";
import { OnboardingStepLayout } from "@/lib/ui/OnboardingStepLayout";
import { TextField } from "@/lib/ui/TextField";

type Step3Values = z.infer<typeof BrokerOnboardingStep3Schema>;

const DEAL_OPTIONS = [
  { value: "rent", label: "Rent" },
  { value: "sale", label: "Sale" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
] as const;

const PROPERTY_OPTIONS = [
  { value: "flats", label: "Flats" },
  { value: "independent_house", label: "Independent house" },
  { value: "community_flats", label: "Community flats" },
  { value: "villas", label: "Villas" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Other" },
] as const;

/** Step 3 — Your work (Figma 1103:8893). */
export default function OnboardingStep3() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isResumed = useIsOnboardingResume();
  const isEditing = useIsProfileEdit();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const didHydrateRef = useRef(false);
  const dealsOtherRef = useRef<FieldFocusHandle>(null);
  const propertyOtherRef = useRef<FieldFocusHandle>(null);

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = useQuery({
    queryKey: ["broker-profile"],
    queryFn: getBrokerProfile,
  });

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<Step3Values>({
    resolver: zodResolver(BrokerOnboardingStep3Schema),
    defaultValues: {
      dealsWith: [],
      dealsWithOther: null,
      propertyTypes: [],
      propertyTypesOther: null,
      stepCompleted: 3,
    },
  });

  useEffect(() => {
    if (didHydrateRef.current) return;
    if (isProfileLoading) return;
    if (isProfileError) {
      didHydrateRef.current = true;
      return;
    }
    if (profileHasStep3Data(profile ?? null) && profile) {
      reset(step3ValuesFromProfile(profile));
    }
    didHydrateRef.current = true;
  }, [profile, isProfileLoading, isProfileError, reset]);

  const dealsWith = watch("dealsWith");
  const propertyTypes = watch("propertyTypes");
  const showDealsOther = dealsWith.includes("other");
  const showPropertyOther = propertyTypes.includes("other");

  const onNext = handleSubmit(async (values) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const saved = await patchBrokerProfile({
        dealsWith: values.dealsWith,
        dealsWithOther: values.dealsWith.includes("other")
          ? (values.dealsWithOther ?? null)
          : null,
        propertyTypes: values.propertyTypes,
        propertyTypesOther: values.propertyTypes.includes("other")
          ? (values.propertyTypesOther ?? null)
          : null,
        stepCompleted: 3,
      });
      queryClient.setQueryData(["broker-profile"], saved);
      router.push(onboardingStepHref(4, isEditing));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not save step 3");
    } finally {
      setIsSubmitting(false);
    }
  });

  const submitFromKeyboard = submitPrimaryFromKeyboard(() => void onNext());

  return (
    <OnboardingStepLayout
      step={3}
      title="Your work"
      description={onboardingStepDescription(undefined, isResumed)}
      onBack={() =>
        goBackOrFallback(router, () =>
          router.replace(previousOnboardingStepHref(3, isEditing)),
        )
      }
      onNext={() => void onNext()}
      isSubmitting={isSubmitting}
    >
      {/*
        CreationStepLayout gap is 20 between scroll children. Local wrap uses
        sectionFieldGap (24) between the two section cards — same pattern as
        step-1 / step-2.
      */}
      <View style={{ width: "100%", gap: shape.sectionFieldGap }}>
        <FormSectionCard>
          <MultiSelectCheckboxGroup
            label="What do you deal with?"
            values={dealsWith}
            options={DEAL_OPTIONS}
            onChange={(next) => {
              setValue("dealsWith", next as Step3Values["dealsWith"], {
                shouldValidate: true,
              });
              if (!next.includes("other")) {
                setValue("dealsWithOther", null, { shouldValidate: true });
              }
            }}
            isDisabled={isSubmitting}
            error={errors.dealsWith?.message}
          />

          {showDealsOther ? (
            <Controller
              control={control}
              name="dealsWithOther"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  ref={dealsOtherRef}
                  label="Describe other deal type"
                  value={value ?? ""}
                  onBlur={onBlur}
                  onChangeText={(text) =>
                    onChange(text.length > 0 ? text : null)
                  }
                  isDisabled={isSubmitting}
                  placeholder="Other deal type"
                  necessityIndicator="required"
                  error={errors.dealsWithOther?.message}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={
                    showPropertyOther
                      ? focusNextField(propertyOtherRef)
                      : submitFromKeyboard
                  }
                />
              )}
            />
          ) : null}
        </FormSectionCard>

        <FormSectionCard>
          <MultiSelectCheckboxGroup
            label="Property types"
            values={propertyTypes}
            options={PROPERTY_OPTIONS}
            onChange={(next) => {
              setValue("propertyTypes", next as Step3Values["propertyTypes"], {
                shouldValidate: true,
              });
              if (!next.includes("other")) {
                setValue("propertyTypesOther", null, { shouldValidate: true });
              }
            }}
            isDisabled={isSubmitting}
            error={errors.propertyTypes?.message}
          />

          {showPropertyOther ? (
            <Controller
              control={control}
              name="propertyTypesOther"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  ref={propertyOtherRef}
                  label="Describe other property type"
                  value={value ?? ""}
                  onBlur={onBlur}
                  onChangeText={(text) =>
                    onChange(text.length > 0 ? text : null)
                  }
                  isDisabled={isSubmitting}
                  placeholder="Other property type"
                  necessityIndicator="required"
                  error={errors.propertyTypesOther?.message}
                  returnKeyType="next"
                  onSubmitEditing={submitFromKeyboard}
                />
              )}
            />
          ) : null}
        </FormSectionCard>

        {submitError ? <Alert description={submitError} /> : null}
      </View>
    </OnboardingStepLayout>
  );
}
