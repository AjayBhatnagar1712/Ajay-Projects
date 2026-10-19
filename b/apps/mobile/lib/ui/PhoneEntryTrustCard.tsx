import { Image, Linking, Pressable, View } from "react-native";
import { Icon, Text as PaperText } from "react-native-paper";
import {
  PHONE_ENTRY_PRIVACY_POLICY_URL,
  PHONE_ENTRY_TERMS_URL,
  PHONE_ENTRY_TRUST_POINTS,
} from "@/lib/auth/phoneEntryTrust";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/shape";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { quietElevation } from "@/lib/ui/elevation";

/** Brand azure/navy stacked wordmark (same mark family as ShellHeader). */
const WORDMARK = require("../../assets/trustkeyper-logo.png");

/**
 * Trust reassurance card under Phone Entry — white surface, quiet elevation,
 * same radius as Home / Records cards. Legal links open in the system browser.
 */
export function PhoneEntryTrustCard() {
  const theme = useAppTheme();

  async function openUrl(url: string): Promise<void> {
    await Linking.openURL(url);
  }

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel="TrustKeyper privacy and data use"
      style={[
        quietElevation,
        {
          width: "100%",
          backgroundColor: theme.colors.surface,
          borderRadius: shape.radiusCard,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: 16,
        },
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{ alignSelf: "flex-start", marginBottom: 24 }}
      >
        <Image
          source={WORDMARK}
          style={{ width: 80, height: 36 }}
          resizeMode="contain"
        />
      </View>

      <View style={{ gap: 12, width: "100%", marginBottom: 16 }}>
        {PHONE_ENTRY_TRUST_POINTS.map((point) => (
          <View
            key={point}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              width: "100%",
            }}
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              <Icon
                source="shield-check-outline"
                size={18}
                color={theme.colors.primary}
              />
            </View>
            <PaperText
              variant="bodyMedium"
              style={{
                flex: 1,
                flexShrink: 1,
                color: theme.colors.bodyText,
                fontFamily: fontFamilies.robotoRegular,
              }}
            >
              {point}
            </PaperText>
          </View>
        ))}
      </View>

      <View style={{ gap: 0, width: "100%" }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Privacy Policy"
          onPress={() => void openUrl(PHONE_ENTRY_PRIVACY_POLICY_URL)}
          hitSlop={4}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingVertical: 8,
          }}
        >
          <PaperText
            variant="bodySmall"
            style={{
              color: theme.colors.primary,
              fontFamily: fontFamilies.robotoMedium,
              textDecorationLine: "underline",
            }}
          >
            Privacy Policy
          </PaperText>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Terms and Conditions"
          onPress={() => void openUrl(PHONE_ENTRY_TERMS_URL)}
          hitSlop={4}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingVertical: 8,
          }}
        >
          <PaperText
            variant="bodySmall"
            style={{
              color: theme.colors.primary,
              fontFamily: fontFamilies.robotoMedium,
              textDecorationLine: "underline",
            }}
          >
            Terms and Conditions
          </PaperText>
        </Pressable>
      </View>
    </View>
  );
}
