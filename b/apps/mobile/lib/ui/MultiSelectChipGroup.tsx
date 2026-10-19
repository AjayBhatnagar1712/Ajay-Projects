import { Pressable, View } from "react-native";
import { Icon, Text } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";

type Option = {
  value: string;
  label: string;
};

type Props = {
  label: string;
  values: readonly string[];
  options: readonly Option[];
  onChange: (next: string[]) => void;
  isDisabled?: boolean;
  error?: string;
};

const CHIP_MIN = 44;

/**
 * Multi-select filter chips (≥44pt) with check affordance when selected.
 * Used for broker onboarding deals-with / property-types.
 */
export function MultiSelectChipGroup({
  label,
  values,
  options,
  onChange,
  isDisabled = false,
  error,
}: Props) {
  const theme = useAppTheme();

  function toggle(value: string): void {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
    } else {
      onChange([...values, value]);
    }
  }

  return (
    <View
      accessibilityRole="list"
      accessibilityLabel={label}
      style={{ width: "100%", gap: 8 }}
    >
      <Text
        variant="labelLarge"
        style={{
          color: theme.colors.onSurfaceVariant,
          fontFamily: fontFamilies.robotoMedium,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: isDisabled }}
              accessibilityLabel={option.label}
              disabled={isDisabled}
              onPress={() => toggle(option.value)}
              style={{
                minHeight: CHIP_MIN,
                minWidth: CHIP_MIN,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: selected
                  ? theme.colors.primary
                  : theme.colors.outline,
                backgroundColor: selected
                  ? theme.colors.primaryContainer
                  : theme.colors.surface,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                opacity: isDisabled ? 0.5 : 1,
              }}
            >
              {selected ? (
                <Icon
                  source="check"
                  size={18}
                  color={theme.colors.onPrimaryContainer}
                />
              ) : null}
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
      {error ? (
        <Text
          variant="bodySmall"
          style={{
            color: theme.colors.error,
            fontFamily: fontFamilies.robotoRegular,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
