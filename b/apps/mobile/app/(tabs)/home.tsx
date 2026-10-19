import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { Icon, Text as PaperText } from "react-native-paper";
import { getBrokerProfile, listLeaseAgreements } from "@/lib/api/client";
import {
  countDraftAgreements,
  selectMostRecentDraft,
  unfinishedDraftHeading,
} from "@/lib/agreements/draftResume";
import { useResumeAgreementCreation } from "@/lib/agreements/useResumeAgreementCreation";
import { RoleSwitcher } from "@/lib/auth/RoleSwitcher";
import {
  formatAlertDateTime,
  greetingFirstName,
} from "@/lib/notifications/derivedAlerts";
import { useDerivedAlerts } from "@/lib/notifications/useDerivedAlerts";
import { PayoutSetupBanner } from "@/lib/payments/PayoutSetupBanner";
import { useBrokerPayoutStatus } from "@/lib/payments/useBrokerPayoutStatus";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/paperTheme";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { quietElevation } from "@/lib/ui/elevation";
import { ShellHeader } from "@/lib/ui/ShellHeader";
import { Spinner } from "@/lib/ui/Spinner";
import { Heading, Text } from "@/lib/ui/Typography";
import { Row, Stack } from "@/lib/ui/Stack";

const TAB_EDGES = ["top", "left", "right"] as const;

export default function HomeTab() {
  const theme = useAppTheme();
  const router = useRouter();
  const profileQuery = useQuery({
    queryKey: ["broker-profile"],
    queryFn: getBrokerProfile,
  });
  const agreementsQuery = useQuery({
    queryKey: ["lease-agreements"],
    queryFn: listLeaseAgreements,
  });
  const { alerts, isLoading, error, refetch } = useDerivedAlerts();
  const payout = useBrokerPayoutStatus();
  const { resumeId, resumeError, resumeAgreement, clearResumeError } =
    useResumeAgreementCreation();

  const firstName = greetingFirstName(profileQuery.data?.name);
  const leaseAgreements = agreementsQuery.data?.leaseAgreements ?? [];
  const unfinishedDraft = useMemo(
    () => selectMostRecentDraft(leaseAgreements),
    [leaseAgreements],
  );
  const draftCount = useMemo(
    () => countDraftAgreements(leaseAgreements),
    [leaseAgreements],
  );
  const showSeeAllDrafts = draftCount > 1;
  const draftHeading = unfinishedDraft
    ? unfinishedDraftHeading(unfinishedDraft.propertyAddress)
    : null;
  const isResumingDraft =
    unfinishedDraft != null && resumeId === unfinishedDraft.id;
  const showPayoutBanner =
    !payout.isLoading && !payout.error && payout.view !== "active";

  if (isLoading && alerts.length === 0 && !error && !unfinishedDraft) {
    return (
      <ScreenSafeArea edges={TAB_EDGES} scroll={false}>
        <ShellHeader alerts={[]} alertsLoading />
        <Spinner accessibilityLabel="Loading home" />
        <Text color="subtle">Loading…</Text>
      </ScreenSafeArea>
    );
  }

  return (
    <ScreenSafeArea
      edges={TAB_EDGES}
      onRefresh={() => {
        void profileQuery.refetch();
        void agreementsQuery.refetch();
        payout.refetch();
        refetch();
      }}
    >
      <ShellHeader alerts={alerts} alertsLoading={isLoading} />

      {showPayoutBanner ? <PayoutSetupBanner /> : null}

      <Stack gap="spacing.3">
        <Heading size="xlarge">Hello {firstName}</Heading>
        <Text size="large" color="subtle">
          Create and manage lease agreements from your phone.
        </Text>
        <RoleSwitcher currentRole="broker" />
      </Stack>

      {unfinishedDraft && draftHeading ? (
        <View style={{ marginTop: 20, width: "100%" }}>
          <Stack gap="spacing.4">
            <View
              style={{
                width: "100%",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View
                style={{
                  flex: 1,
                  minWidth: 0,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Icon
                  source="file-document-edit-outline"
                  size={22}
                  color={theme.colors.primary}
                />
                <PaperText
                  variant="titleSmall"
                  style={{
                    flexShrink: 1,
                    color: theme.colors.headingText,
                    fontFamily: fontFamilies.generalSansSemibold,
                  }}
                >
                  Unfinished agreement
                </PaperText>
              </View>
              {showSeeAllDrafts ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="See all unfinished agreements"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/agreements",
                      params: { segment: "draft" },
                    })
                  }
                  hitSlop={4}
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    paddingVertical: 4,
                  }}
                >
                  <PaperText
                    variant="labelSmall"
                    style={{
                      color: theme.colors.primary,
                      fontFamily: fontFamilies.robotoMedium,
                    }}
                  >
                    See all
                  </PaperText>
                </Pressable>
              ) : null}
            </View>
            <View
              style={[
                quietElevation,
                {
                  minHeight: 56,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  backgroundColor: theme.colors.surface,
                  borderRadius: shape.radiusCard,
                  borderWidth: 1,
                  borderColor: theme.colors.primary,
                  gap: 12,
                },
              ]}
            >
              <PaperText
                variant="bodyLarge"
                style={{
                  color: theme.colors.headingText,
                  fontFamily: fontFamilies.robotoMedium,
                }}
              >
                {draftHeading}
              </PaperText>
              {resumeError ? <Alert description={resumeError} /> : null}
              <Button
                title="Continue"
                onPress={() => {
                  clearResumeError();
                  void resumeAgreement(unfinishedDraft.id, "home");
                }}
                isLoading={isResumingDraft}
                isDisabled={isResumingDraft}
              />
            </View>
          </Stack>
        </View>
      ) : null}

      <View style={{ marginTop: 20, marginBottom: 20, width: "100%" }}>
        <Button
          title="Create a new agreement"
          onPress={() =>
            router.push({
              pathname: "/(create-agreement)/property",
              params: { entry: "home" },
            })
          }
          variant={unfinishedDraft ? "secondary" : "primary"}
          textColor={unfinishedDraft ? theme.colors.primary : undefined}
          outlineColor={unfinishedDraft ? theme.colors.primary : undefined}
        />
      </View>

      {error ? (
        <View style={{ marginTop: 8, width: "100%" }}>
          <Alert description={`Could not load alerts: ${error.message}`} />
        </View>
      ) : null}

      {alerts.length > 0 ? (
        <View style={{ marginTop: 12, width: "100%" }}>
          <Stack gap="spacing.4">
            <Row gap="spacing.3">
              <Icon
                source="alert-circle-outline"
                size={22}
                color={theme.colors.primary}
              />
              <PaperText
                variant="titleSmall"
                style={{
                  color: theme.colors.headingText,
                  fontFamily: fontFamilies.generalSansSemibold,
                }}
              >
                Needs attention
              </PaperText>
            </Row>
            {alerts.map((alert) => {
              const when = formatAlertDateTime(alert.occurredAt);
              const showReadyMeta = alert.kind === "ready_to_send";
              return (
                <Pressable
                  key={alert.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    alert.kind === "payout_verified"
                      ? `${alert.message}. Open payments`
                      : `${alert.message}. View agreement`
                  }
                  onPress={() => {
                    if (alert.kind === "payout_verified") {
                      router.push("/(tabs)/payments");
                      return;
                    }
                    if (!alert.agreementId) return;
                    router.push({
                      pathname: "/agreements/[agreementId]",
                      params: { agreementId: alert.agreementId },
                    });
                  }}
                  style={[
                    quietElevation,
                    {
                      minHeight: 56,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      backgroundColor: theme.colors.surface,
                      borderRadius: shape.radiusCard,
                      borderWidth: 1,
                      borderColor: theme.colors.primary,
                      gap: 6,
                    },
                  ]}
                >
                  <PaperText
                    variant="bodyLarge"
                    style={{
                      color: theme.colors.headingText,
                      fontFamily: fontFamilies.robotoMedium,
                    }}
                  >
                    {alert.message}
                  </PaperText>
                  {showReadyMeta && alert.propertyAddress ? (
                    <PaperText
                      variant="bodySmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        fontFamily: fontFamilies.robotoRegular,
                      }}
                    >
                      {alert.propertyAddress}
                    </PaperText>
                  ) : null}
                  {when ? (
                    <PaperText
                      variant="bodySmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        fontFamily: fontFamilies.robotoRegular,
                      }}
                    >
                      {when}
                    </PaperText>
                  ) : null}
                </Pressable>
              );
            })}
          </Stack>
        </View>
      ) : !unfinishedDraft && !showPayoutBanner ? (
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 48,
            marginTop: 12,
            gap: 16,
            width: "100%",
          }}
        >
          <View
            style={[
              quietElevation,
              {
                width: 72,
                height: 72,
                borderRadius: shape.radiusCard,
                backgroundColor: theme.colors.surface,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Icon
              source="home-plus-outline"
              size={36}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
          <PaperText
            variant="labelLarge"
            style={{
              color: theme.colors.onSurfaceVariant,
              fontFamily: fontFamilies.robotoMedium,
              textAlign: "center",
            }}
          >
            No active task. Have a peaceful day ahead.
          </PaperText>
        </View>
      ) : null}
    </ScreenSafeArea>
  );
}
