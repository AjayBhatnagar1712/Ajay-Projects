import { zodResolver } from "@hookform/resolvers/zod";
import {
  BROKER_AGE_ERROR,
  BROKER_AGE_REQUIRED_ERROR,
  BrokerOnboardingStep1Schema,
} from "@workspace/api-schemas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { BackHandler, View } from "react-native";
import { z } from "zod";
import { getBrokerProfile, patchBrokerProfile } from "@/lib/api/client";
import { signOut } from "@/lib/auth/phoneOtp";
import { ageBlurError } from "@/lib/agreements/partyFieldValidation";
import {
  profileHasStep1Data,
  step1ValuesFromProfile,
} from "@/lib/broker/step1FormValues";
import { replaceRoot } from "@/lib/navigation/replaceRoot";
import {
  onboardingStepDescription,
  useIsProfileEdit,
  useIsOnboardingResume,
} from "@/lib/broker/onboardingResume";
import { onboardingStepHref } from "@/lib/broker/previousOnboardingStepHref";
import { shape } from "@/lib/theme/shape";
import { Alert } from "@/lib/ui/Alert";
import {
  focusNextField,
  submitPrimaryFromKeyboard,
  type FieldFocusHandle,
} from "@/lib/ui/fieldFocusChain";
import { OnboardingStepLayout } from "@/lib/ui/OnboardingStepLayout";
import { TextField } from "@/lib/ui/TextField";

type Step1Values = z.infer<typeof BrokerOnboardingStep1Schema>;

const EMPTY_STEP1: Step1Values = {
  name: "",
  age: undefined as unknown as number,
  firmName: null,
  stepCompleted: 1,
};

/**
 * Step 1 — About you (Figma 1103:8677). Does not write employment_type.
 *
 * Back signs out and returns to Phone Entry: Step 1 is the start of
 * onboarding — native stack pop would otherwise reveal `(tabs)` under the
 * root navigator after a Profile → Splash → OTP path.
 *
 * Form defaults are empty. After Next, values are PATCH'd to the broker
 * profile. Stack back/replace remounts this screen and would otherwise lose
 * local RHF state — rehydrate from `getBrokerProfile` (source of truth).
 */
export default function OnboardingStep1() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isResumed = useIsOnboardingResume();
  const isEditing = useIsProfileEdit();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const didHydrateRef = useRef(false);
  const nameRef = useRef<FieldFocusHandle>(null);
  const ageRef = useRef<FieldFocusHandle>(null);
  const firmNameRef = useRef<FieldFocusHandle>(null);

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
    getValues,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<Step1Values>({
    resolver: zodResolver(BrokerOnboardingStep1Schema),
    // Blur shows first field errors; subsequent edits revalidate as the user types
    // (same pattern as party age / phone inline checks on create-agreement).
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: EMPTY_STEP1,
  });

  useEffect(() => {
    if (didHydrateRef.current) return;
    if (isProfileLoading) return;
    if (isProfileError) {
      didHydrateRef.current = true;
      return;
    }
    if (profileHasStep1Data(profile ?? null) && profile) {
      reset(step1ValuesFromProfile(profile));
    }
    didHydrateRef.current = true;
  }, [profile, isProfileLoading, isProfileError, reset]);

  const leaveToPhone = async () => {
    if (isLeaving || isSubmitting) return;
    if (isEditing) {
      router.back();
      return;
    }
    setIsLeaving(true);
    setSubmitError(null);
    try {
      await signOut();
      queryClient.clear();
      replaceRoot(router, "/(auth)/phone");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not return to phone entry",
      );
      setIsLeaving(false);
    }
  };

  const leaveToPhoneRef = useRef(leaveToPhone);
  leaveToPhoneRef.current = leaveToPhone;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      void leaveToPhoneRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  const onNext = handleSubmit(async (values) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const saved = await patchBrokerProfile({
        name: values.name,
        age: values.age,
        firmName: values.firmName ?? null,
        stepCompleted: 1,
      });
      queryClient.setQueryData(["broker-profile"], saved);
      router.push(onboardingStepHref(2, isEditing));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not save step 1");
    } finally {
      setIsSubmitting(false);
    }
  });

  const busy = isSubmitting || isLeaving;

  function applyAgeBlurError(age: number | null | undefined): void {
    if (age === null || age === undefined || Number.isNaN(age)) {
      setError("age", { type: "manual", message: BROKER_AGE_REQUIRED_ERROR });
      return;
    }
    // Out of 18–120 → product copy for incorrect age.
    if (ageBlurError(age)) {
      setError("age", { type: "manual", message: BROKER_AGE_ERROR });
    } else {
      clearErrors("age");
    }
  }

  return (
    <OnboardingStepLayout
      step={1}
      title="About you"
      description={onboardingStepDescription(
        "Tell us a bit about yourself.",
        isResumed,
      )}
      onBack={() => void leaveToPhone()}
      onNext={() => void onNext()}
      isSubmitting={busy}
    >
      {/* Local 24px stack — CreationStepLayout gap:20 is shared with create-agreement. */}
      <View style={{ width: "100%", gap: shape.sectionFieldGap }}>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              ref={nameRef}
              label="Full name"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              isDisabled={busy}
              autoCapitalize="words"
              placeholder="e.g. Arjun Sharma"
              necessityIndicator="required"
              error={errors.name?.message}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={focusNextField(ageRef)}
            />
          )}
        />

        <Controller
          control={control}
          name="age"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              ref={ageRef}
              label="Age"
              value={value == null ? "" : String(value)}
              onBlur={() => {
                onBlur();
                const age = getValues("age");
                applyAgeBlurError(
                  age === undefined ||
                    age === null ||
                    Number.isNaN(Number(age))
                    ? null
                    : Number(age),
                );
              }}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, "");
                const next =
                  digits.length === 0
                    ? (undefined as unknown as number)
                    : Number(digits);
                onChange(next);
                if (errors.age) {
                  applyAgeBlurError(
                    next === undefined || Number.isNaN(next) ? null : next,
                  );
                }
              }}
              keyboardType="number"
              isDisabled={busy}
              placeholder="e.g. 32"
              necessityIndicator="required"
              selectTextOnFocus
              error={errors.age?.message}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={focusNextField(firmNameRef)}
            />
          )}
        />

        <Controller
          control={control}
          name="firmName"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              ref={firmNameRef}
              label="Firm name"
              value={value ?? ""}
              onBlur={onBlur}
              onChangeText={(text) => onChange(text.length > 0 ? text : null)}
              isDisabled={busy}
              necessityIndicator="optional"
              placeholder="Enter your real estate agency"
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
