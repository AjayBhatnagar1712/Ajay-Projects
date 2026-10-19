import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { hasCompletedOnboardingLocal } from "@/lib/auth/onboardingCompleteLocal";
import { PHONE_ENTRY_TRUST_CARD_GAP } from "@/lib/auth/phoneEntryTrust";
import { sendPhoneOtp } from "@/lib/auth/phoneOtp";
import { PhoneFormSchema, type PhoneFormValues } from "@/lib/auth/schemas";
import { Alert } from "@/lib/ui/Alert";
import { AuthScreenLayout } from "@/lib/ui/AuthScreenLayout";
import { Button } from "@/lib/ui/Button";
import { PhoneEntryTrustCard } from "@/lib/ui/PhoneEntryTrustCard";
import { PhoneNumberField } from "@/lib/ui/PhoneNumberField";
import { Heading, Text } from "@/lib/ui/Typography";

export default function PhoneScreen() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PhoneFormValues>({
    resolver: zodResolver(PhoneFormSchema),
    defaultValues: { phone: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const error = await sendPhoneOtp(values.phone);
      if (error) {
        setSubmitError(error);
        return;
      }
      router.push({ pathname: "/(auth)/otp", params: { phone: values.phone } });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Couldn't send code. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  async function onBack(): Promise<void> {
    const onboardingComplete = await hasCompletedOnboardingLocal();
    // Same incompleteness rule as splash cold launch: incomplete → carousel.
    if (!onboardingComplete) {
      if (router.canGoBack()) router.back();
      else router.replace("/(auth)/intro");
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/splash");
  }

  return (
    <AuthScreenLayout
      onBack={() => void onBack()}
      footer={
        <Button
          title="Continue"
          onPress={() => void onSubmit()}
          isDisabled={isSubmitting}
          isLoading={isSubmitting}
        />
      }
    >
      <View style={{ width: "100%" }}>
        <View style={{ gap: 12, width: "100%", marginBottom: 28 }}>
          <Heading size="xlarge">Enter your phone number</Heading>
          <Text size="large" color="subtle">
            We'll send you a verification code to confirm your identity.
          </Text>
        </View>

        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <PhoneNumberField
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              isDisabled={isSubmitting}
              error={errors.phone?.message}
            />
          )}
        />

        {submitError ? (
          <View style={{ marginTop: 16 }}>
            <Alert description={submitError} />
          </View>
        ) : null}

        <View style={{ marginTop: PHONE_ENTRY_TRUST_CARD_GAP, width: "100%" }}>
          <PhoneEntryTrustCard />
        </View>
      </View>
    </AuthScreenLayout>
  );
}
