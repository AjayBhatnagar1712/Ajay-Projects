import { View } from "react-native";
import { Icon, Text } from "react-native-paper";
import { azure, cloud, emerald, semantic } from "@/lib/theme/colors";
import { shape } from "@/lib/theme/paperTheme";
import { useAppTheme } from "@/lib/theme/useAppTheme";

type Props = {
  title?: string;
  description: string;
  color?: "negative" | "notice" | "information" | "positive" | "neutral";
  /** Optional Material Community icon shown before the description. */
  icon?: string;
  /** Override icon color (defaults to the tint text color). */
  iconColor?: string;
};

/**
 * Notice amber is provisional — Figma Colors has no warning family
 * (same gap class as error; only error is tracked in open-items).
 */
const TINTS: Record<NonNullable<Props["color"]>, { background: string; text: string }> = {
  negative: {
    background: semantic.errorContainer,
    text: semantic.onErrorContainer,
  },
  notice: {
    background: "#FFF4E5",
    text: "#8A5300",
  },
  information: {
    background: azure[100],
    text: azure[800],
  },
  positive: {
    background: emerald[50],
    text: semantic.onSuccess,
  },
  neutral: {
    background: cloud[50],
    text: cloud[800],
  },
};

const STATUS_ROW_LINE_HEIGHT = 24;
const STATUS_ICON_SIZE = 20;

export function Alert({ title, description, color = "negative", icon, iconColor }: Props) {
  const theme = useAppTheme();
  const tint = TINTS[color];

  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: tint.background,
        borderRadius: shape.radiusCard,
        padding: 12,
        gap: 4,
      }}
    >
      {title ? (
        <Text variant="titleSmall" style={{ color: tint.text }}>
          {title}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon ? (
          <View
            style={{
              width: STATUS_ROW_LINE_HEIGHT,
              height: STATUS_ROW_LINE_HEIGHT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon source={icon} size={STATUS_ICON_SIZE} color={iconColor ?? tint.text} />
          </View>
        ) : null}
        <Text
          variant="bodyMedium"
          style={{
            flex: 1,
            color: tint.text,
            lineHeight: STATUS_ROW_LINE_HEIGHT,
            fontFamily: theme.fonts.bodyMedium.fontFamily,
          }}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}
