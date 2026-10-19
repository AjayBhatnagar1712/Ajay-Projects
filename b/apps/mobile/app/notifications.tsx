import { useRouter } from "expo-router";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { formatAlertDateTime } from "@/lib/notifications/derivedAlerts";
import { useDerivedAlerts } from "@/lib/notifications/useDerivedAlerts";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/paperTheme";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Button } from "@/lib/ui/Button";
import { quietElevation } from "@/lib/ui/elevation";
import { Spinner } from "@/lib/ui/Spinner";
import { StackScreenHeader } from "@/lib/ui/StackScreenHeader";
import { Stack } from "@/lib/ui/Stack";

/**
 * Full-screen notifications (pushed from shell header).
 * Shares useDerivedAlerts / React Query with Home + bell badge.
 *
 * Important: do not nest a flex:1 ScrollView inside ScreenSafeArea's Stack —
 * that collapses list height to 0 (looks empty while Home still shows cards).
 */
export default function NotificationsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { alerts, isLoading } = useDerivedAlerts();

  return (
    <ScreenSafeArea tabBarClearance={false}>
      <StackScreenHeader title="Notifications" />
      {isLoading && alerts.length === 0 ? (
        <View style={{ paddingVertical: 32, alignItems: "center" }}>
          <Spinner accessibilityLabel="Loading notifications" />
        </View>
      ) : alerts.length === 0 ? (
        <View style={{ paddingVertical: 32 }}>
          <Text
            variant="bodyLarge"
            style={{
              color: theme.colors.onSurfaceVariant,
              fontFamily: fontFamilies.robotoRegular,
              textAlign: "center",
            }}
          >
            You're all caught up
          </Text>
        </View>
      ) : (
        <Stack gap="spacing.4">
          {alerts.map((alert) => {
            const when = formatAlertDateTime(alert.occurredAt);
            return (
              <View
                key={alert.id}
                style={[
                  quietElevation,
                  {
                    backgroundColor: theme.colors.surface,
                    borderRadius: shape.radiusCard,
                    borderWidth: 1,
                    borderColor: theme.colors.primary,
                    padding: 14,
                    gap: 10,
                  },
                ]}
              >
                <Stack gap="spacing.3">
                  <Text
                    variant="bodyLarge"
                    style={{
                      color: theme.colors.headingText,
                      fontFamily: fontFamilies.robotoMedium,
                    }}
                  >
                    {alert.message}
                  </Text>
                  {when ? (
                    <Text
                      variant="bodySmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        fontFamily: fontFamilies.robotoRegular,
                      }}
                    >
                      {when}
                    </Text>
                  ) : null}
                </Stack>
                <Button
                  title="View"
                  variant="secondary"
                  isFullWidth
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
                />
              </View>
            );
          })}
        </Stack>
      )}
    </ScreenSafeArea>
  );
}
