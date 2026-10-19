import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/paperTheme";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { quietElevation } from "@/lib/ui/elevation";

type Props = {
  /** When set, renders as the card title. Omit for custom header layouts. */
  title?: string;
  children: ReactNode;
  accessibilityLabel?: string;
};

/**
 * Records list card — same quiet elevation + hairline border as Home alert cards.
 */
export function RecordCard({ title, children, accessibilityLabel }: Props) {
  const theme = useAppTheme();

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[
        quietElevation,
        {
          width: "100%",
          backgroundColor: theme.colors.surface,
          borderRadius: shape.radiusCard,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: 16,
          gap: 12,
        },
      ]}
    >
      {title ? (
        <Text
          variant="titleMedium"
          style={{
            color: theme.colors.headingText,
            fontFamily: fontFamilies.generalSansSemibold,
          }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

type DetailRowProps = {
  label: string;
  value: string;
};

/** Label left / value right — omit at call site when value is null. */
export function RecordDetailRow({ label, value }: DetailRowProps) {
  const theme = useAppTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
      }}
    >
      <Text
        variant="bodyMedium"
        style={{
          flexShrink: 1,
          color: theme.colors.onSurfaceVariant,
          fontFamily: fontFamilies.robotoRegular,
        }}
      >
        {label}
      </Text>
      <Text
        variant="labelMedium"
        style={{
          flexShrink: 1,
          textAlign: "right",
          color: theme.colors.headingText,
          fontFamily: fontFamilies.robotoMedium,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
