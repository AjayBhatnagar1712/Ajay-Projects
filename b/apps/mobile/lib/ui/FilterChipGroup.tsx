import { Pressable, View } from "react-native";
import { Text } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/paperTheme";
import { useAppTheme } from "@/lib/theme/useAppTheme";

type Option = {
  value: string;
  label: string;
};

type Props = {
  label?: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  isDisabled?: boolean;
  accessibilityLabel?: string;
};

const CHIP_MIN_HEIGHT = 44;

/**
 * Single-select filter chips (e.g. Mr. / Ms. / Mrs.) — ≥44pt tap targets,
 * theme radiusChip, azure selected state.
 */
export function FilterChipGroup({
  label,
  value,
  options,
  onChange,
  isDisabled = false,
  accessibilityLabel,
}: Props) {
  const theme = useAppTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel ?? label}
      style={{ width: "100%", gap: 8 }}
    >
      {label ? (
        <Text
          variant="labelLarge"
          style={{
            color: theme.colors.headingText,
            fontFamily: fontFamilies.robotoMedium,
          }}
        >
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: isDisabled }}
              accessibilityLabel={option.label}
              disabled={isDisabled}
              onPress={() => onChange(option.value)}
              style={{
                minHeight: CHIP_MIN_HEIGHT,
                minWidth: CHIP_MIN_HEIGHT,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: shape.radiusChip,
                borderWidth: 1,
                borderColor: selected
                  ? theme.colors.primary
                  : theme.colors.outline,
                backgroundColor: selected
                  ? theme.colors.primaryContainer
                  : theme.colors.surface,
                alignItems: "center",
                justifyContent: "center",
                opacity: isDisabled ? 0.5 : 1,
              }}
            >
              <Text
                variant="labelLarge"
                style={{
                  color: selected
                    ? theme.colors.onPrimaryContainer
                    : theme.colors.bodyText,
                  fontFamily: fontFamilies.robotoMedium,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
