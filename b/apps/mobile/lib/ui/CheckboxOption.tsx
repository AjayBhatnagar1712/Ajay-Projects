import { Pressable, View } from "react-native";
import { Text } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";

type Props = {
  label: string;
  isChecked: boolean;
  onChange: (checked: boolean) => void;
  isDisabled?: boolean;
};

/**
 * Leading checkbox + label row. Draws an explicit box so the control is always
 * visible (Paper Checkbox.Item alone can blend into surfaceVariant cards).
 */
export function CheckboxOption({
  label,
  isChecked,
  onChange,
  isDisabled = false,
}: Props) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked, disabled: isDisabled }}
      accessibilityLabel={label}
      disabled={isDisabled}
      onPress={() => onChange(!isChecked)}
      style={{
        width: "100%",
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: isChecked
            ? theme.colors.primary
            : theme.colors.onSurfaceVariant,
          backgroundColor: isChecked
            ? theme.colors.primary
            : theme.colors.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isChecked ? (
          <Text
            style={{
              color: theme.colors.onPrimary,
              fontFamily: fontFamilies.robotoMedium,
              fontSize: 14,
              lineHeight: 16,
            }}
          >
            ✓
          </Text>
        ) : null}
      </View>
      <Text
        variant="bodyLarge"
        style={{
          flex: 1,
          color: theme.colors.onSurface,
          fontFamily: fontFamilies.robotoRegular,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
