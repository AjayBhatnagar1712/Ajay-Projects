import { Pressable, View } from "react-native";
import { Text } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";

type Option = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  accessibilityLabel?: string;
};

const MIN_SEGMENT_HEIGHT = 44;

/**
 * Full-width segmented control.
 * Selected: filled primary + onPrimary label (unmistakable).
 * Unselected: transparent + bodyText.
 * Contrast: white on #305EFF ≈ 5.0:1; bodyText on white ≈ 7.6:1.
 */
export function SegmentedControl({
  value,
  options,
  onChange,
  accessibilityLabel = "Record type",
}: Props) {
  const theme = useAppTheme();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: "row",
        width: "100%",
        minHeight: MIN_SEGMENT_HEIGHT,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.colors.outline,
        overflow: "hidden",
        backgroundColor: theme.colors.surface,
      }}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: MIN_SEGMENT_HEIGHT,
              minWidth: 44,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 8,
              paddingVertical: 10,
              backgroundColor: selected
                ? theme.colors.primary
                : "transparent",
              borderRightWidth: isLast ? 0 : 1,
              borderRightColor: theme.colors.outline,
              borderTopLeftRadius: isFirst ? 23 : 0,
              borderBottomLeftRadius: isFirst ? 23 : 0,
              borderTopRightRadius: isLast ? 23 : 0,
              borderBottomRightRadius: isLast ? 23 : 0,
            }}
          >
            <Text
              variant="labelLarge"
              style={{
                color: selected
                  ? theme.colors.onPrimary
                  : theme.colors.bodyText,
                fontFamily: fontFamilies.robotoMedium,
                textAlign: "center",
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
