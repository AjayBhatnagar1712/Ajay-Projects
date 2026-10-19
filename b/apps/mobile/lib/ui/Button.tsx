import { Button as PaperButton } from "react-native-paper";
import { shape } from "@/lib/theme/shape";
import { resolveSecondaryAccent } from "@/lib/ui/buttonSecondaryAccent";
import { quietElevationStrong } from "@/lib/ui/elevation";

type Props = {
  title: string;
  onPress: () => void;
  isDisabled?: boolean;
  isLoading?: boolean;
  variant?: "primary" | "secondary" | "tertiary" | "tonal";
  isFullWidth?: boolean;
  /** Optional Material Community icon name (leading). */
  icon?: string;
  /** Override contained fill (e.g. success green on final onboarding step). */
  buttonColor?: string;
  textColor?: string;
  /** Outlined border color (secondary). Defaults to theme outline when omitted. */
  outlineColor?: string;
};

const MODE = {
  primary: "contained",
  secondary: "outlined",
  tertiary: "text",
  tonal: "contained-tonal",
} as const;

/** Pill radius derived from the shared CTA height — never hardcode per screen. */
const BUTTON_PILL_RADIUS = shape.buttonHeight / 2;

export function Button({
  title,
  onPress,
  isDisabled = false,
  isLoading = false,
  variant = "primary",
  isFullWidth = true,
  icon,
  buttonColor,
  textColor,
  outlineColor,
}: Props) {
  const secondaryAccent =
    variant === "secondary"
      ? resolveSecondaryAccent({
          isDisabled,
          isLoading,
          textColor,
          outlineColor,
        })
      : null;
  const resolvedTextColor =
    variant === "secondary" ? secondaryAccent?.textColor : textColor;

  return (
    <PaperButton
      mode={MODE[variant]}
      onPress={onPress}
      disabled={isDisabled || isLoading}
      loading={isLoading}
      icon={icon}
      buttonColor={buttonColor}
      textColor={resolvedTextColor}
      style={[
        { borderRadius: BUTTON_PILL_RADIUS },
        variant === "primary" && !isDisabled ? quietElevationStrong : null,
        secondaryAccent?.outlineStyle ?? null,
        isFullWidth ? { width: "100%" } : { alignSelf: "flex-start" },
      ]}
      contentStyle={{
        height: shape.buttonHeight,
        minHeight: shape.buttonHeight,
      }}
      labelStyle={{ marginVertical: 0 }}
    >
      {title}
    </PaperButton>
  );
}
