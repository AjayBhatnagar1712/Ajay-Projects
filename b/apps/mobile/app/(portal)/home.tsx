import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Text as PaperText } from "react-native-paper";
import { listPortalAgreements } from "@/lib/api/client";
import { RoleSwitcher } from "@/lib/auth/RoleSwitcher";
import { signOut } from "@/lib/auth/phoneOtp";
import { loadStoredSession } from "@/lib/auth/secureSession";
import { isAppRole } from "@/lib/auth/roleRouting";
import {
  buildPortalDerivedAlerts,
} from "@/lib/notifications/portalDerivedAlerts";
import { agreementStatusLabel } from "@/lib/agreements/flow";
import { replaceRoot } from "@/lib/navigation/replaceRoot";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/paperTheme";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { AgreementStatusChip } from "@/lib/ui/AgreementStatusChip";
import { Button } from "@/lib/ui/Button";
import { quietElevation } from "@/lib/ui/elevation";
import { Spinner } from "@/lib/ui/Spinner";
import { Stack } from "@/lib/ui/Stack";
import { StateScreen } from "@/lib/ui/StateScreen";
import { Heading, Text } from "@/lib/ui/Typography";

function propertyTitle(address: string | null): string {
  const trimmed = address?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Untitled property";
}

function agreementHref(agreementId: string): Href {
  return {
    pathname: "/(portal)/agreement/[agreementId]",
    params: { agreementId },
  } as Href;
}

export default function PortalHomeScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ["stored-session"],
    queryFn: loadStoredSession,
  });
  const role = isAppRole(sessionQuery.data?.role)
    ? sessionQuery.data.role
    : null;

  const agreementsQuery = useQuery({
    queryKey: ["portal-agreements"],
    queryFn: listPortalAgreements,
  });

  const agreements = agreementsQuery.data?.agreements ?? [];
  const alerts = useMemo(
    () => buildPortalDerivedAlerts(agreements),
    [agreements],
  );

  const isLoading = agreementsQuery.isLoading || sessionQuery.isLoading;
  const error =
    agreementsQuery.error instanceof Error
      ? agreementsQuery.error.message
      : agreementsQuery.error
        ? "Could not load agreements"
        : null;

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      queryClient.clear();
      replaceRoot(router, "/(auth)/splash");
    } finally {
      setSigningOut(false);
    }
  };

  if (isLoading && agreements.length === 0 && !error) {
    return (
      <ScreenSafeArea scroll={false}>
        <Spinner accessibilityLabel="Loading portal" />
        <Text color="subtle">Loading…</Text>
      </ScreenSafeArea>
    );
  }

  return (
    <ScreenSafeArea
      onRefresh={() => {
        void sessionQuery.refetch();
        void agreementsQuery.refetch();
      }}
    >
      <Stack gap="spacing.4">
        <View style={{ gap: 8, width: "100%" }}>
          <Heading size="xlarge">
            {role === "owner" ? "Owner portal" : role === "tenant" ? "Tenant portal" : "Portal"}
          </Heading>
          <Text size="large" color="subtle">
            Agreements where you are listed as a party.
          </Text>
          <RoleSwitcher currentRole={role} />
        </View>

        {error ? (
          <StateScreen
            icon="alert-circle-outline"
            title="Couldn't load agreements"
            description={error}
            tone="error"
            density="inline"
            primaryAction={{
              title: "Try again",
              onPress: () => void agreementsQuery.refetch(),
            }}
          />
        ) : null}

        {!error && alerts.length > 0 ? (
          <Stack gap="spacing.3">
            <Heading size="small">Needs attention</Heading>
            {alerts.map((alert) => (
              <Pressable
                key={alert.id}
                onPress={() => router.push(agreementHref(alert.agreementId))}
                accessibilityRole="button"
                accessibilityLabel={alert.message}
              >
                <Alert description={alert.message} color="notice" />
              </Pressable>
            ))}
          </Stack>
        ) : null}

        {!error && agreements.length === 0 ? (
          <StateScreen
            icon="file-document-outline"
            title="No agreements yet"
            description="When a broker adds you to a lease, it will show up here."
            density="inline"
          />
        ) : null}

        {!error && agreements.length > 0 ? (
          <Stack gap="spacing.3">
            <Heading size="small">Your agreements</Heading>
            {agreements.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(agreementHref(item.id))}
                accessibilityRole="button"
                accessibilityLabel={`${propertyTitle(item.propertyAddress)}, ${item.partyRole}`}
              >
                <View
                  style={[
                    quietElevation,
                    {
                      width: "100%",
                      backgroundColor: theme.colors.surface,
                      borderRadius: shape.radiusCard,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      padding: 16,
                      gap: 10,
                    },
                  ]}
                >
                  <PaperText
                    variant="titleMedium"
                    style={{
                      color: theme.colors.headingText,
                      fontFamily: fontFamilies.generalSansSemibold,
                    }}
                    numberOfLines={2}
                  >
                    {propertyTitle(item.propertyAddress)}
                  </PaperText>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text size="small" color="subtle">
                      {item.partyRole === "owner" ? "Owner" : "Tenant"}
                    </Text>
                    <AgreementStatusChip status={item.status} />
                  </View>
                  <Text size="small" color="subtle">
                    {agreementStatusLabel(item.status)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Stack>
        ) : null}

        <Button
          title={signingOut ? "Signing out…" : "Sign out"}
          variant="tertiary"
          onPress={() => void onSignOut()}
          isDisabled={signingOut}
          isLoading={signingOut}
          textColor={theme.colors.error}
        />
      </Stack>
    </ScreenSafeArea>
  );
}
