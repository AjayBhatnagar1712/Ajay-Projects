import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSegments } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { Alert as NativeAlert, Pressable, Share, View } from "react-native";
import { Icon, Text } from "react-native-paper";
import { getBrokerProfile } from "@/lib/api/client";
import {
  buildProfileDetailSections,
  formatConsultantRoleLabel,
  REFER_A_FRIEND_MESSAGE,
} from "@/lib/broker/profileDisplay";
import { createTapUnlock } from "@/lib/auth/createTapUnlock";
import { resetLocalOnboardingData } from "@/lib/auth/resetLocalOnboardingData";
import { signOut } from "@/lib/auth/phoneOtp";
import { loadStoredSession } from "@/lib/auth/secureSession";
import { useRequireOnboardingComplete } from "@/lib/broker/useRequireOnboardingComplete";
import { replaceRoot } from "@/lib/navigation/replaceRoot";
import { useDerivedAlerts } from "@/lib/notifications/useDerivedAlerts";
import { ProfilePayoutCard } from "@/lib/payments/ProfilePayoutCard";
import { useBrokerPayoutStatus } from "@/lib/payments/useBrokerPayoutStatus";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { emerald } from "@/lib/theme/colors";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/shape";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { ErrorRecoveryActions } from "@/lib/ui/ErrorRecoveryActions";
import { RecordDetailRow } from "@/lib/ui/RecordCard";
import { ShellHeader } from "@/lib/ui/ShellHeader";
import { Spinner } from "@/lib/ui/Spinner";
import { StackScreenHeader } from "@/lib/ui/StackScreenHeader";
import { Row, Stack } from "@/lib/ui/Stack";

const TAB_EDGES = ["top", "left", "right"] as const;

/**
 * Profile — tab in the broker shell, also reachable as a stack route.
 *
 * Hidden QA/demo: tap the Role line 5 times quickly → confirm → clear
 * local intro + session, then splash (fresh intro path).
 */
export default function ProfileScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const segments = useSegments();
  const isTab = segments[0] === "(tabs)";
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["stored-session"],
    queryFn: loadStoredSession,
  });
  const profileQuery = useQuery({
    queryKey: ["broker-profile"],
    queryFn: getBrokerProfile,
  });
  const payout = useBrokerPayoutStatus();
  const { alerts, isLoading: alertsLoading } = useDerivedAlerts();

  const busy = signingOut || resetting;
  const gate = useRequireOnboardingComplete();

  const safeAreaProps = isTab
    ? { edges: TAB_EDGES }
    : { tabBarClearance: false as const };

  function profileChrome() {
    if (isTab) {
      return <ShellHeader alerts={alerts} alertsLoading={alertsLoading} />;
    }
    return <StackScreenHeader title="Profile" />;
  }

  const onSignOut = async () => {
    setSigningOut(true);
    setResetError(null);
    try {
      await signOut();
      queryClient.clear();
      replaceRoot(router, "/(auth)/splash");
    } finally {
      setSigningOut(false);
    }
  };

  const runLocalReset = async () => {
    setResetting(true);
    setResetError(null);
    try {
      await resetLocalOnboardingData();
      queryClient.clear();
      replaceRoot(router, "/(auth)/splash");
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : "Could not clear local data",
      );
    } finally {
      setResetting(false);
    }
  };

  const runLocalResetRef = useRef(runLocalReset);
  runLocalResetRef.current = runLocalReset;

  const onRoleSecretTapRef = useRef<(() => void) | null>(null);
  if (onRoleSecretTapRef.current === null) {
    onRoleSecretTapRef.current = createTapUnlock({
      tapsRequired: 5,
      windowMs: 2_500,
      onUnlock: () => {
        NativeAlert.alert(
          "Clear local data?",
          "Signs you out and resets the intro carousel. The next launch starts like a fresh install on this device. Your profile on the server is not deleted.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Clear",
              style: "destructive",
              onPress: () => {
                void runLocalResetRef.current();
              },
            },
          ],
        );
      },
    });
  }

  const onShareRefer = async () => {
    setShareError(null);
    try {
      await Share.share({ message: REFER_A_FRIEND_MESSAGE });
    } catch (err) {
      setShareError(
        err instanceof Error ? err.message : "Could not open the share sheet",
      );
    }
  };

  if (gate.status !== "allowed") {
    return (
      <ScreenSafeArea {...safeAreaProps}>
        {profileChrome()}
        <Text
          variant="bodyLarge"
          style={{
            color: theme.colors.onSurfaceVariant,
            fontFamily: fontFamilies.robotoRegular,
          }}
        >
          {gate.status === "loading" ? "Loading…" : "Continuing onboarding…"}
        </Text>
      </ScreenSafeArea>
    );
  }

  if (profileQuery.isLoading || sessionQuery.isLoading) {
    return (
      <ScreenSafeArea {...safeAreaProps} scroll={false}>
        {profileChrome()}
        <Spinner accessibilityLabel="Loading profile" />
        <Text
          variant="bodyMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            fontFamily: fontFamilies.robotoRegular,
          }}
        >
          Loading profile…
        </Text>
      </ScreenSafeArea>
    );
  }

  if (profileQuery.error || !profileQuery.data) {
    return (
      <ScreenSafeArea {...safeAreaProps} scroll={false}>
        {profileChrome()}
        <ErrorRecoveryActions
          onRetry={() => {
            void profileQuery.refetch();
            void sessionQuery.refetch();
          }}
        />
      </ScreenSafeArea>
    );
  }

  const profile = profileQuery.data;
  const displayName = profile.name.trim() || "Property Consultant";
  const roleLabel = formatConsultantRoleLabel(sessionQuery.data?.role);
  const phoneDisplay = sessionQuery.data?.phone
    ? `+91 ${sessionQuery.data.phone}`
    : "Phone unavailable";
  const detailSections = buildProfileDetailSections(profile);

  function subHeading(title: string) {
    return (
      <Text
        variant="labelMedium"
        style={{
          color: theme.colors.primary,
          fontFamily: fontFamilies.robotoMedium,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {title}
      </Text>
    );
  }

  function sectionDivider() {
    return (
      <View
        style={{
          height: 1,
          width: "100%",
          backgroundColor: theme.colors.outlineVariant,
          marginVertical: 4,
        }}
      />
    );
  }

  function detailBlock(title: string, children: ReactNode) {
    return (
      <Stack gap="spacing.3">
        {subHeading(title)}
        {children}
      </Stack>
    );
  }

  return (
    <ScreenSafeArea {...safeAreaProps}>
      {profileChrome()}
      <Stack gap="spacing.5">
        <Stack gap="spacing.3">
          <Text
            variant="headlineSmall"
            style={{
              color: theme.colors.headingText,
              fontFamily: fontFamilies.generalSansSemibold,
            }}
          >
            {displayName}
          </Text>
          <Text
            variant="bodyLarge"
            style={{
              color: theme.colors.bodyText,
              fontFamily: fontFamilies.robotoRegular,
            }}
          >
            {phoneDisplay}
          </Text>
        </Stack>

        <View
          style={{
            width: "100%",
            backgroundColor: theme.colors.surfaceVariant,
            borderRadius: shape.radiusCard,
            padding: 16,
            gap: 16,
          }}
        >
          {detailBlock(
            "Account",
            <Stack gap="spacing.3">
              <RecordDetailRow label="Phone" value={phoneDisplay} />
              <Pressable
                onPress={() => onRoleSecretTapRef.current?.()}
                disabled={busy}
                accessibilityRole="text"
                accessibilityLabel={`Role: ${roleLabel}`}
                hitSlop={8}
              >
                <RecordDetailRow label="Role" value={roleLabel} />
              </Pressable>
            </Stack>,
          )}

          {detailSections.map((section) => (
            <View key={section.title} style={{ width: "100%", gap: 16 }}>
              {sectionDivider()}
              {detailBlock(
                section.title,
                <Stack gap="spacing.3">
                  {section.rows.map((row) => (
                    <RecordDetailRow
                      key={`${section.title}-${row.label}`}
                      label={row.label}
                      value={row.value}
                    />
                  ))}
                </Stack>,
              )}
            </View>
          ))}
        </View>

        <Button
          title="Edit profile"
          icon="account-edit-outline"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: "/(onboarding)/step-1",
              params: { edit: "1" },
            })
          }
          isDisabled={busy}
        />

        <ProfilePayoutCard
          view={payout.view}
          bankAccountLast4={payout.status?.bankAccountLast4}
          isLoading={payout.isLoading}
        />

        <View
          accessibilityRole="summary"
          accessibilityLabel="Grow with us. Share TrustKeyper with another property consultant."
          style={{
            width: "100%",
            backgroundColor: theme.colors.successContainer,
            borderRadius: shape.radiusCard,
            borderWidth: 1,
            borderColor: emerald[200],
            padding: 16,
            gap: 16,
          }}
        >
          <Row gap="spacing.3">
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: emerald[100],
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon
                source="account-multiple-plus-outline"
                size={24}
                color={theme.colors.onSuccess}
              />
            </View>
            <Text
              variant="titleMedium"
              style={{
                flex: 1,
                color: theme.colors.onSuccess,
                fontFamily: fontFamilies.generalSansSemibold,
              }}
            >
              Grow with us
            </Text>
          </Row>
          <Text
            variant="bodyMedium"
            style={{
              color: theme.colors.onSuccess,
              fontFamily: fontFamilies.robotoRegular,
              lineHeight: 22,
            }}
          >
            Know another property consultant who’d love TrustKeyper? Share the
            app and help them get started.
          </Text>
          <Button
            title="Share"
            icon="share-variant"
            variant="primary"
            buttonColor={theme.colors.success}
            textColor={theme.colors.onSuccess}
            onPress={() => void onShareRefer()}
            isDisabled={busy}
          />
          {shareError ? <Alert description={shareError} /> : null}
        </View>

        <View style={{ width: "100%", paddingTop: 8, gap: 8 }}>
          <Button
            title={signingOut ? "Signing out…" : "Sign out"}
            icon="logout"
            variant="tertiary"
            onPress={() => void onSignOut()}
            isDisabled={busy}
            isLoading={signingOut}
            textColor={theme.colors.error}
          />
          {resetting ? (
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.onSurfaceVariant,
                fontFamily: fontFamilies.robotoRegular,
              }}
            >
              Clearing local data…
            </Text>
          ) : null}
          {resetError ? <Alert description={resetError} /> : null}
        </View>
      </Stack>
    </ScreenSafeArea>
  );
}
