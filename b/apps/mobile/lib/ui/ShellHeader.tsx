import { useRouter } from "expo-router";
import { Image, Pressable, View } from "react-native";
import { Icon, Text } from "react-native-paper";
import type { DerivedAlert } from "@/lib/notifications/derivedAlerts";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { AppIconButton } from "@/lib/ui/AppIconButton";

type Props = {
  alerts: DerivedAlert[];
  /** Kept for call-site compatibility; badge uses alerts.length. */
  alertsLoading?: boolean;
};

const MARK = require("../../assets/trustkeyper-mark.png");

/**
 * App shell header: profile tab (left) — TrustKeyper mark (center) — notifications (right).
 */
export function ShellHeader({ alerts }: Props) {
  const theme = useAppTheme();
  const router = useRouter();

  const badgeCount = alerts.length;
  const bellLabel =
    badgeCount === 0
      ? "Notifications, no alerts"
      : `Notifications, ${badgeCount} unread`;

  return (
    <View
      style={{
        position: "relative",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        minHeight: 48,
        marginBottom: 8,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        onPress={() => router.navigate("/(tabs)/profile")}
        hitSlop={4}
        style={{
          width: 44,
          height: 44,
          minWidth: 44,
          minHeight: 44,
          borderRadius: 22,
          backgroundColor: theme.colors.primaryContainer,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon source="account" size={22} color={theme.colors.primary} />
      </Pressable>

      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={MARK}
          accessibilityLabel="TrustKeyper"
          style={{ width: 36, height: 32 }}
          resizeMode="contain"
        />
      </View>

      <View style={{ position: "relative" }}>
        <AppIconButton
          icon="bell-outline"
          accessibilityLabel={bellLabel}
          onPress={() => router.push("/notifications")}
          iconColor={theme.colors.headingText}
        />
        {badgeCount > 0 ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              paddingHorizontal: 4,
              backgroundColor: theme.colors.error,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              variant="labelSmall"
              style={{
                color: theme.colors.onError,
                fontSize: 10,
                lineHeight: 12,
                fontFamily: fontFamilies.robotoMedium,
              }}
            >
              {badgeCount > 9 ? "9+" : String(badgeCount)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
