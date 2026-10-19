import { useRouter, type Href } from "expo-router";
import { View } from "react-native";
import { Text as PaperText } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/paperTheme";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Button } from "@/lib/ui/Button";
import { quietElevation } from "@/lib/ui/elevation";

/**
 * Home / Payments CTA while payout is not yet activated.
 * Disappears automatically once status is active — no dismiss control.
 */
export function PayoutSetupBanner() {
  const theme = useAppTheme();
  const router = useRouter();

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel="Set up payout details to receive consultancy fees"
      style={[
        quietElevation,
        {
          width: "100%",
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
        Set up payout details to receive consultancy fees
      </PaperText>
      <Button
        title="Set up payout details"
        onPress={() => router.push("/payout-setup" as Href)}
      />
    </View>
  );
}
