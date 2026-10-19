import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { Text as PaperText } from "react-native-paper";
import { normalizePhoneDigits } from "@workspace/auth-server/phone";
import { formatIndianMobileMasked } from "@/lib/auth/phoneDisplay";
import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/auth/phoneOtp";
import {
  resolveRoleAwareDestination,
} from "@/lib/auth/roleRouting";
import { OtpFormSchema, type OtpFormValues } from "@/lib/auth/schemas";
import {
  loadStoredSession,
  saveSessionIdentity,
} from "@/lib/auth/secureSession";
import { replaceRoot } from "@/lib/navigation/replaceRoot";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { AuthScreenLayout } from "@/lib/ui/AuthScreenLayout";
import { Button } from "@/lib/ui/Button";
import { OtpDigitInput } from "@/lib/ui/OtpDigitInput";
import { Heading, Text } from "@/lib/ui/Typography";

const RESEND_SECONDS = 30;

export default function OtpScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = useMemo(() => normalizePhoneDigits(params.phone ?? ""), [params.phone]);

  const [otpError, setOtpError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OtpFormValues>({
    resolver: zodResolver(OtpFormSchema),
    defaultValues: { phone, token: "" },
  });

  const token = watch("token");

  useEffect(() => {
    setValue("phone", phone);
  }, [phone, setValue]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const verify = useCallback(
    async (values: OtpFormValues) => {
      setOtpError(null);
      setProfileError(null);
      setIsSubmitting(true);
      try {
        const result = await verifyPhoneOtp(values.phone, values.token);
        if (result.error || !result.accessToken) {
          setOtpError(result.error ?? "That code isn't right. Check and try again.");
          return;
        }

        try {
          const stored = await loadStoredSession();
          const destination = await resolveRoleAwareDestination(
            values.phone,
            stored?.role,
          );

          if (destination.kind === "picker") {
            await saveSessionIdentity({ phone: values.phone, role: null });
            replaceRoot(router, {
              pathname: "/(auth)/role-picker",
              params: {
                phone: values.phone,
                roles: destination.roles.join(","),
              },
            } as Href);
            return;
          }

          await saveSessionIdentity({
            phone: values.phone,
            role: destination.role,
          });
          replaceRoot(router, destination.href);
        } catch (err) {
          setProfileError(
            err instanceof Error
              ? err.message
              : "Couldn't load your account. Check your connection and try again.",
          );
        }
      } catch (err) {
        setOtpError(
          err instanceof Error
            ? err.message
            : "Couldn't verify code. Check your connection and try again.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [router],
  );

  const onSubmit = handleSubmit((values) => void verify(values));

  const onComplete = useCallback(
    (fullToken: string) => {
      if (isSubmitting) return;
      void verify({ phone, token: fullToken });
    },
    [isSubmitting, phone, verify],
  );

  const onResend = async () => {
    if (secondsLeft > 0 || isSubmitting) return;
    setOtpError(null);
    setProfileError(null);
    setValue("token", "");
    setIsSubmitting(true);
    try {
      const error = await sendPhoneOtp(phone);
      if (error) {
        setOtpError(error);
        return;
      }
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      setOtpError(
        err instanceof Error
          ? err.message
          : "Couldn't send code. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const goChangePhone = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/phone");
  };

  const displayError = errors.token?.message ?? otpError ?? undefined;
  const canVerify = /^\d{6}$/.test(token.trim()) && !isSubmitting;

  return (
    <AuthScreenLayout
      onBack={goChangePhone}
      footer={
        <Button
          title="Verify"
          onPress={() => void onSubmit()}
          isDisabled={!canVerify}
          isLoading={isSubmitting}
        />
      }
    >
      <View style={{ gap: 28, width: "100%" }}>
        <View style={{ gap: 12, width: "100%" }}>
          <Heading size="xlarge">Enter the code</Heading>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text size="large" color="subtle">
              Sent to {formatIndianMobileMasked(phone)}
            </Text>
            <Pressable
              onPress={goChangePhone}
              accessibilityRole="button"
              accessibilityLabel="Change phone number"
              hitSlop={8}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 4 }}
            >
              <PaperText
                variant="labelLarge"
                style={{
                  color: theme.colors.primary,
                  fontFamily: fontFamilies.robotoMedium,
                  textDecorationLine: "underline",
                }}
              >
                Change
              </PaperText>
            </Pressable>
          </View>
        </View>

        <Controller
          control={control}
          name="token"
          render={({ field: { onChange, value } }) => (
            <OtpDigitInput
              value={value}
              onChange={(next) => {
                setOtpError(null);
                onChange(next);
              }}
              onComplete={onComplete}
              error={displayError}
              isDisabled={isSubmitting}
            />
          )}
        />

        {secondsLeft > 0 ? (
          <Text color="subtle">Resend code in {secondsLeft}s</Text>
        ) : (
          <Pressable
            onPress={() => void onResend()}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Resend code"
            style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
          >
            <PaperText
              variant="labelLarge"
              style={{
                color: theme.colors.primary,
                fontFamily: fontFamilies.robotoMedium,
              }}
            >
              Resend code
            </PaperText>
          </Pressable>
        )}

        {profileError ? <Alert description={profileError} /> : null}
      </View>
    </AuthScreenLayout>
  );
}
