import { useState } from "react";
import { TextInput, View } from "react-native";
import { HelperText, Text } from "react-native-paper";
import { formatIndianMobileDisplay, digitsOnly } from "@/lib/auth/phoneDisplay";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/paperTheme";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { quietElevation } from "@/lib/ui/elevation";

type Props = {
  value: string;
  onChangeText: (digits: string) => void;
  onBlur?: () => void;
  error?: string;
  isDisabled?: boolean;
};

/**
 * Elevated phone field with +91 prefix — Figma layout, theme tokens.
 * Accessible name is "Mobile number" (not the placeholder).
 *
 * onBlur only clears the local focus ring and notifies RHF (mark touched).
 * It does not validate or block subsequent presses — submit uses onSubmit mode.
 */
export function PhoneNumberField({
  value,
  onChangeText,
  onBlur,
  error,
  isDisabled = false,
}: Props) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.error
    : focused
      ? theme.colors.primary
      : theme.colors.outline;
  const borderWidth = focused || error ? 2 : 1;

  return (
    <View style={{ width: "100%", gap: 8 }}>
      <View
        style={[
          quietElevation,
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 4,
            minHeight: 56,
            backgroundColor: theme.colors.surface,
            borderRadius: shape.radiusInput,
            borderWidth,
            borderColor,
          },
        ]}
      >
        <Text
          variant="titleSmall"
          style={{
            color: theme.colors.primary,
            fontFamily: fontFamilies.robotoMedium,
          }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          +91
        </Text>
        <View
          style={{
            width: 1,
            height: 24,
            backgroundColor: theme.colors.outlineVariant,
          }}
        />
        <TextInput
          value={formatIndianMobileDisplay(value)}
          onChangeText={(text) => onChangeText(digitsOnly(text, 10))}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          editable={!isDisabled}
          keyboardType="number-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={11}
          placeholder="00000 00000"
          placeholderTextColor={theme.colors.mutedTextAccessible}
          accessibilityLabel="Mobile number"
          accessibilityHint="Enter your 10-digit Indian mobile number"
          style={{
            flex: 1,
            minHeight: 48,
            fontSize: 16,
            color: theme.colors.headingText,
            fontFamily: fontFamilies.robotoRegular,
            paddingVertical: 12,
          }}
        />
      </View>
      {error ? (
        <HelperText type="error" visible accessibilityLiveRegion="polite">
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}
