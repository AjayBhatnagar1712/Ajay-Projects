import { Pressable, TextInput, View } from "react-native";
import { Text } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
};

/** Touch-target height; radius is half so the field reads as a true pill. */
const SEARCH_FIELD_HEIGHT = 44;

/**
 * Themed pill search field (Records, Agreements, …) — true-pill radius
 * (borderRadius = height / 2), clear affordance. Height 44 for tap targets.
 */
export function RecordsSearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel = "Search",
}: Props) {
  const theme = useAppTheme();
  const hasValue = value.length > 0;

  return (
    <View
      style={{
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        height: SEARCH_FIELD_HEIGHT,
        borderWidth: 1,
        borderColor: theme.colors.outline,
        borderRadius: SEARCH_FIELD_HEIGHT / 2,
        backgroundColor: theme.colors.surface,
        paddingHorizontal: 16,
        gap: 8,
        overflow: "hidden",
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.mutedText}
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        returnKeyType="search"
        style={{
          flex: 1,
          height: SEARCH_FIELD_HEIGHT,
          paddingVertical: 0,
          color: theme.colors.bodyText,
          fontFamily: fontFamilies.robotoRegular,
          fontSize: 16,
        }}
      />
      {hasValue ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText("")}
          hitSlop={8}
          style={{
            minWidth: 44,
            height: SEARCH_FIELD_HEIGHT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            variant="labelLarge"
            style={{
              color: theme.colors.onSurfaceVariant,
              fontFamily: fontFamilies.robotoMedium,
            }}
          >
            Clear
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
