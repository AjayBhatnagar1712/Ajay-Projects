import { View } from "react-native";
import { Text } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { CheckboxOption } from "@/lib/ui/CheckboxOption";

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

/**
 * Multi-select checkbox list — same value in/out contract as MultiSelectChipGroup.
 * Used on broker onboarding “Your work” (deals-with / property-types).
 */
export function MultiSelectCheckboxGroup({
  label,
  values,
  options,
  onChange,
  isDisabled = false,
  error,
}: Props) {
  const theme = useAppTheme();

  function toggle(value: string, checked: boolean): void {
    if (checked) {
      if (values.includes(value)) return;
      onChange([...values, value]);
      return;
    }
    onChange(values.filter((item) => item !== value));
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
      <View style={{ width: "100%", gap: 4 }}>
        {options.map((option) => (
          <CheckboxOption
            key={option.value}
            label={option.label}
            isChecked={values.includes(option.value)}
            onChange={(checked) => toggle(option.value, checked)}
            isDisabled={isDisabled}
          />
        ))}
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
