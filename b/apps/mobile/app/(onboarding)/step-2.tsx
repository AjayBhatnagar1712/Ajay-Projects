import { zodResolver } from "@hookform/resolvers/zod";
import { BrokerOnboardingStep2Schema } from "@workspace/api-schemas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { Text } from "react-native-paper";
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
  profileHasStep2Data,
  step2ValuesFromProfile,
} from "@/lib/broker/step2FormValues";
import { goBackOrFallback } from "@/lib/navigation/goBackOrFallback";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/shape";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import {
  focusNextField,
  submitPrimaryFromKeyboard,
  type FieldFocusHandle,
} from "@/lib/ui/fieldFocusChain";
import { OnboardingStepLayout } from "@/lib/ui/OnboardingStepLayout";
import { SegmentedControl } from "@/lib/ui/SegmentedControl";
import { TextField } from "@/lib/ui/TextField";

type Step2Values = z.infer<typeof BrokerOnboardingStep2Schema>;

const EMPLOYMENT_OPTIONS = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
] as const;

const EMPTY_STEP2: Step2Values = {
  employmentType: "full_time",
  businessSinceYear: undefined as unknown as number,
  propertiesHandled: undefined as unknown as number,
  stepCompleted: 2,
};

/** Step 2 — Your business (Figma 1103:8787). Employment is required here. */
export default function OnboardingStep2() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const isResumed = useIsOnboardingResume();
  const isEditing = useIsProfileEdit();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const didHydrateRef = useRef(false);
  const businessSinceRef = useRef<FieldFocusHandle>(null);
  const propertiesHandledRef = useRef<FieldFocusHandle>(null);

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
  } = useForm<Step2Values>({
    resolver: zodResolver(BrokerOnboardingStep2Schema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: EMPTY_STEP2,
  });

  useEffect(() => {
    if (didHydrateRef.current) return;
    if (isProfileLoading) return;
    if (isProfileError) {
      didHydrateRef.current = true;
      return;
    }
    if (profileHasStep2Data(profile ?? null) && profile) {
      reset(step2ValuesFromProfile(profile));
    }
    didHydrateRef.current = true;
  }, [profile, isProfileLoading, isProfileError, reset]);

  const employmentType = watch("employmentType");

  const onNext = handleSubmit(async (values) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const saved = await patchBrokerProfile({
        employmentType: values.employmentType,
        businessSinceYear: values.businessSinceYear,
        propertiesHandled: values.propertiesHandled,
        stepCompleted: 2,
      });
      queryClient.setQueryData(["broker-profile"], saved);
      router.push(onboardingStepHref(3, isEditing));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not save step 2");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <OnboardingStepLayout
      step={2}
      title="Your business"
      description={onboardingStepDescription(undefined, isResumed)}
      onBack={() =>
        goBackOrFallback(router, () =>
          router.replace(previousOnboardingStepHref(2, isEditing)),
        )
      }
      onNext={() => void onNext()}
      isSubmitting={isSubmitting}
    >
      {/* Local 24px stack — CreationStepLayout gap:20 is shared with create-agreement. */}
      <View style={{ width: "100%", gap: shape.sectionFieldGap }}>
        <View style={{ width: "100%", gap: 8 }}>
          <Text
            variant="labelLarge"
            style={{
              color: theme.colors.onSurfaceVariant,
              fontFamily: fontFamilies.robotoMedium,
            }}
          >
            Employment type
          </Text>
          <SegmentedControl
            value={employmentType}
            options={EMPLOYMENT_OPTIONS}
            onChange={(value) =>
              setValue(
                "employmentType",
                value as Step2Values["employmentType"],
                {
                  shouldValidate: true,
                },
              )
            }
            accessibilityLabel="Employment type"
          />
          {errors.employmentType ? (
            <Text
              variant="bodySmall"
              style={{
                color: theme.colors.error,
                fontFamily: fontFamilies.robotoRegular,
              }}
            >
              {errors.employmentType.message}
            </Text>
          ) : null}
        </View>

        <Controller
          control={control}
          name="businessSinceYear"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              ref={businessSinceRef}
              label="In business since"
              value={value == null ? "" : String(value)}
              onBlur={onBlur}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, "");
                onChange(
                  digits.length === 0
                    ? (undefined as unknown as number)
                    : Number(digits),
                );
              }}
              keyboardType="number"
              isDisabled={isSubmitting}
              placeholder="YYYY"
              selectTextOnFocus
              error={errors.businessSinceYear?.message}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={focusNextField(propertiesHandledRef)}
            />
          )}
        />

        <Controller
          control={control}
          name="propertiesHandled"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              ref={propertiesHandledRef}
              label="Properties handled"
              value={value == null ? "" : String(value)}
              onBlur={onBlur}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, "");
                onChange(
                  digits.length === 0
                    ? (undefined as unknown as number)
                    : Number(digits),
                );
              }}
              keyboardType="number"
              isDisabled={isSubmitting}
              placeholder="Count"
              necessityIndicator="required"
              selectTextOnFocus
              error={errors.propertiesHandled?.message}
              returnKeyType="next"
              onSubmitEditing={submitPrimaryFromKeyboard(() => void onNext())}
            />
          )}
        />

        {submitError ? <Alert description={submitError} /> : null}
      </View>
    </OnboardingStepLayout>
  );
}
